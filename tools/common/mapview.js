// 工具共用的 Tiled 地圖：讀檔（dev server 或專案資料夾）、圖塊＋有 gid 的物件烤成一張圖（每張地圖烤一次）、具名物件、可走格子
// 角色分頁的作息地圖、地圖分頁都用；格子／物件的算法跟路網共用 src/data/navgrid.js
import {loadMap, decodeLayer, joinPath, objectTiles, buildGrid} from '../../src/data/navgrid.js';
import {parseAt} from '../../src/data/schedplan.js';

const FH = 0x80000000, FV = 0x40000000, FD = 0x20000000, GID = 0x1fffffff;

const fetchJson = (rel) => fetch(`/assets/${rel}`, {cache: 'no-store'}).then(r => (r.ok ? r.json() : null)).catch(() => null);
// 讀檔：預設走 dev server；分頁可以設成先讀專案資料夾（工具剛寫的地圖、測試的假資料夾），讀不到再走 dev server
let reader = null;
export const setReader = (fn) => {reader = fn;};
export const readJson = async (rel) => (reader && await reader(rel)) ?? fetchJson(rel);
export const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

const imgs = new Map();
export function loadImg(url)
{
    if (!imgs.has(url)) imgs.set(url, new Promise(res => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => res(null);
        im.src = url;
    }));
    return imgs.get(url);
}

// tileset → 畫圖用：{firstgid, img（整張）, tw, th, cols, margin, spacing} 或 {firstgid, tiles: {id: img}}（集合型）
async function drawSets(map, tilesets, mdir)
{
    return Promise.all(map.tilesets.map(async (ref, i) => {
        const ts = tilesets[i], src = ref.source ? joinPath(mdir, ref.source) : null, base = src ? dirOf(src) : mdir;
        if (!ts) return {firstgid: ref.firstgid, src};
        if (ts.image) return {firstgid: ref.firstgid, src, img: await loadImg(`/assets/${joinPath(base, ts.image)}`),
                              tw: ts.tilewidth, th: ts.tileheight, cols: ts.columns, margin: ts.margin ?? 0, spacing: ts.spacing ?? 0};
        const tiles = {};
        await Promise.all((ts.tiles ?? []).map(async t => {if (t.image) tiles[t.id] = await loadImg(`/assets/${joinPath(base, t.image)}`);}));
        return {firstgid: ref.firstgid, src, tiles};
    }));
}

const setOf = (sets, gid) => sets.findLast(s => s.firstgid <= gid);

// 一格圖：{img, sx, sy, sw, sh}
function frameOf(sets, gid)
{
    const s = setOf(sets, gid);
    if (!s) return null;
    const id = gid - s.firstgid;
    if (s.tiles) {const img = s.tiles[id]; return img ? {img, sx: 0, sy: 0, sw: img.width, sh: img.height} : null;}
    if (!s.img || !s.cols) return null;
    return {img: s.img, sx: s.margin + (id % s.cols) * (s.tw + s.spacing), sy: s.margin + Math.floor(id / s.cols) * (s.th + s.spacing), sw: s.tw, sh: s.th};
}

// 畫在 (dx, dy, dw, dh)，翻轉照 Tiled（先對角再水平／垂直）
function blit(g, f, flags, dx, dy, dw, dh)
{
    g.save();
    g.translate(dx + dw / 2, dy + dh / 2);
    g.scale(flags & FH ? -1 : 1, flags & FV ? -1 : 1);
    if (flags & FD) {g.rotate(Math.PI / 2); g.scale(1, -1);}
    g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, -dw / 2, -dh / 2, dw, dh);
    g.restore();
}

// 物件的全域 gid（帶翻轉旗標）：template 的 gid 是相對 template 自己的 tileset，換成這張地圖的
function gidOf(o, tpls, sets, mdir)
{
    const raw = o.raw;
    if (raw.gid != null) return raw.gid >>> 0;
    const tpl = tpls[raw.template];
    if (tpl?.object?.gid == null || !tpl.tileset) return null;
    const src = joinPath(dirOf(joinPath(mdir, raw.template)), tpl.tileset.source);
    const s = sets.find(s => s.src === src);
    if (!s) return null;
    const g = tpl.object.gid >>> 0;
    return ((g & ~GID) | (s.firstgid + (g & GID) - tpl.tileset.firstgid)) >>> 0;
}

// skip(o)＝不烤進去的物件（地圖分頁的角色另外畫）
function bake(map, sets, objs, tpls, mdir, skip)
{
    const tw = map.tilewidth, th = map.tileheight;
    const cv = document.createElement('canvas');
    cv.width = map.width * tw;
    cv.height = map.height * th;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const byRaw = new Map(objs.map(o => [o.raw, o]));
    for (const layer of map.layers)
    {
        if (layer.visible === false) continue;
        g.globalAlpha = layer.opacity ?? 1;
        if (layer.type === 'tilelayer')
        {
            const ox = layer.offsetx ?? 0, oy = layer.offsety ?? 0;
            decodeLayer(layer, true).forEach((v, i) => {
                const gid = v & GID;
                if (!gid) return;
                const f = frameOf(sets, gid);
                if (!f) return;
                const tx = i % map.width, ty = Math.floor(i / map.width);
                blit(g, f, v, ox + tx * tw, oy + (ty + 1) * th - f.sh, f.sw, f.sh);
            });
        }
        else if (layer.type === 'objectgroup')
        {
            const list = layer.objects.filter(r => r.visible !== false).map(r => byRaw.get(r)).filter(o => o && !skip?.(o));
            for (const o of list.sort((a, b) => a.y - b.y))
            {
                const v = gidOf(o, tpls, sets, mdir);
                if (!v) continue;
                const f = frameOf(sets, v & GID);
                if (!f) continue;
                const w = o.width || f.sw, hh = o.height || f.sh;
                g.save();
                g.translate(o.x, o.y);
                g.rotate((o.raw.rotation ?? 0) * Math.PI / 180);
                blit(g, f, v, 0, -hh, w, hh);
                g.restore();
            }
        }
    }
    g.globalAlpha = 1;
    return cv;
}

// 具名物件（跟路網的節點一樣：有名字、不是 npc）：{name, type, rect, cen, tiles}
function namedOf(map, objs)
{
    const out = new Map();
    for (const o of objs)
    {
        if (!o.name || o.type === 'npc') continue;
        const w = o.width || map.tilewidth, hh = o.height || map.tileheight;
        const rect = {x: o.x, y: o.gid ? o.y - hh : o.y, w, h: hh};
        out.set(o.name, {name: o.name, type: o.type, rect, cen: {x: rect.x + w / 2, y: rect.y + hh / 2}, tiles: objectTiles(map, o)});
    }
    return out;
}

// 作息目的地（具名物件名稱，或格子 "@tx,ty"）→ 同 named 的格式；格子的 type 是 'at'，不在地圖內／找不到＝null
export function spotOf(d, name)
{
    const n = d.named.get(name);
    if (n) return n;
    const at = parseAt(name);
    if (!at || at[0] < 0 || at[1] < 0 || at[0] >= d.map.width || at[1] >= d.map.height) return null;
    const tw = d.map.tilewidth, th = d.map.tileheight, rect = {x: at[0] * tw, y: at[1] * th, w: tw, h: th};
    return {name, type: 'at', rect, cen: {x: rect.x + tw / 2, y: rect.y + th / 2}, tiles: [at]};
}

// 地圖名 → Promise<{map, tilesets, objs, tpls, bake, named, W, H} | null>；opt.skip 不同的（地圖分頁不烤角色）各快取一份
const loaded = new Map();
export function mapData(name, {skip = null, tag = ''} = {})
{
    const key = `${tag}|${name}`;
    if (!loaded.has(key)) loaded.set(key, (async () => {
        const d = await loadMap(name, readJson);
        if (!d) return null;
        const mdir = dirOf(`maps/${name}.json`);
        const sets = await drawSets(d.map, d.tilesets, mdir);
        const cv = bake(d.map, sets, d.objs, d.tpls, mdir, skip);
        return {...d, bake: cv, named: namedOf(d.map, d.objs), W: cv.width, H: cv.height};
    })());
    return loaded.get(key);
}
// 地圖檔改了（工具寫檔、或別的分頁通知）就丟掉重讀
export const forget = (name) => {
    if (!name) return loaded.clear();
    for (const k of [...loaded.keys()]) if (k.slice(k.indexOf('|') + 1) === name) loaded.delete(k);
};

export const gridOf = (d) => (d.grid ??= buildGrid(d.map, d.tilesets, d.objs));

// 像素 → 格子左上角
export const snapTile = (d, p) => {const tw = d.map.tilewidth, th = d.map.tileheight; return {x: Math.floor(p.x / tw) * tw, y: Math.floor(p.y / th) * th};};

// 可走格子底色（紅＝擋住、黃＝慢）
export function drawGrid(g, d)
{
    const tw = d.map.tilewidth, th = d.map.tileheight;
    gridOf(d).forEach((row, ty) => row.forEach((w, tx) => {
        if (w === 1) return;
        g.fillStyle = w === 0 ? 'rgba(255,60,60,0.35)' : 'rgba(255,220,60,0.3)';
        g.fillRect(tx * tw, ty * th, tw, th);
    }));
}
