// 角色分頁右欄「作息」：畫 Tiled 地圖（圖塊＋有 gid 的物件先烤成一張圖，每張地圖烤一次），上面疊具名物件跟這個角色的作息點
// 地圖資料走 dev server（/assets/maps/…），格子／物件的算法跟路網共用 src/data/navgrid.js；縮放平移每張地圖一組 view
import {h} from '../common/dom.js';
import * as PZ from '../common/panzoom.js';
import {loadMap, decodeLayer, joinPath, objectTiles} from '../../src/data/navgrid.js';

const FH = 0x80000000, FV = 0x40000000, FD = 0x20000000, GID = 0x1fffffff;
const KEY = 'tools.role.sched';

export const M = {map: null};       // 目前顯示的地圖（null＝跟著作息第一筆）
try {M.map = localStorage.getItem(`${KEY}.map`);} catch {}
const remember = () => {try {M.map ? localStorage.setItem(`${KEY}.map`, M.map) : localStorage.removeItem(`${KEY}.map`);} catch {}};

const readJson = (rel) => fetch(`/assets/${rel}`, {cache: 'no-store'}).then(r => (r.ok ? r.json() : null)).catch(() => null);
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');

const imgs = new Map();
function loadImg(url)
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

function bake(map, sets, objs, tpls, mdir)
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
            const list = layer.objects.filter(r => r.visible !== false).map(r => byRaw.get(r)).filter(Boolean);
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

const loaded = new Map();       // 地圖名 → Promise<{map, bake, named, W, H} | null>
export function mapData(name)
{
    if (!loaded.has(name)) loaded.set(name, (async () => {
        const d = await loadMap(name, readJson);
        if (!d) return null;
        const mdir = dirOf(`maps/${name}.json`);
        const sets = await drawSets(d.map, d.tilesets, mdir);
        const cv = bake(d.map, sets, d.objs, d.tpls, mdir);
        return {...d, bake: cv, named: namedOf(d.map, d.objs), W: cv.width, H: cv.height};
    })());
    return loaded.get(name);
}
// 地圖檔改了（之後工具寫 point、或別的分頁通知）就丟掉重讀
export const forget = (name) => (name ? loaded.delete(name) : loaded.clear());

const views = new Map();
const viewOf = (name) => {if (!views.has(name)) views.set(name, PZ.createView(`tools.preview.view.role.map.${name}`)); return views.get(name);};

const COLOR = {point: '#ffd24a', port: '#5cd0ff', door: '#5cd0ff', bed: '#c88cff'};

// 這個角色在這張圖的作息點：名稱 → [卡片編號（1 起）]
function stopsOn(schedule, mapName)
{
    const out = new Map();
    (schedule ?? []).forEach((s, i) => {if (s.map === mapName && s.go) (out.get(s.go) ?? out.set(s.go, []).get(s.go)).push(i + 1);});
    return out;
}

function draw(cv, st)
{
    const d = st.data, g = cv.getContext('2d');
    const {K} = st.pz.begin(g, (g, cw, ch) => {g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, cw, ch);});
    if (!d) return;
    g.imageSmoothingEnabled = false;
    g.translate(-d.W / 2, -d.H / 2);
    g.drawImage(d.bake, 0, 0);
    const stops = stopsOn(st.schedule, st.name);
    g.lineWidth = 1 / K;
    for (const n of d.named.values())
    {
        const c = COLOR[n.type] ?? '#ffffff', on = st.hover === n.name;
        g.globalAlpha = on ? 1 : 0.55;
        g.strokeStyle = c;
        g.lineWidth = (on ? 2 : 1) / K;
        if (n.type === 'point') {g.beginPath(); g.arc(n.cen.x, n.cen.y, 5, 0, Math.PI * 2); g.stroke();}
        else g.strokeRect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
    }
    g.globalAlpha = 1;
    // 作息點：實心圓＋卡片編號（大小固定在螢幕 px）
    const r = 9 / K;
    g.font = `bold ${11 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [name, nums] of stops)
    {
        const n = d.named.get(name);
        if (!n) continue;
        const txt = nums.join(','), w = Math.max(r * 2, g.measureText(txt).width + 8 / K);
        g.fillStyle = '#e8743b';
        g.strokeStyle = '#000';
        g.lineWidth = 1.5 / K;
        g.beginPath();
        g.roundRect(n.cen.x - w / 2, n.cen.y - r, w, r * 2, r);
        g.fill(); g.stroke();
        g.fillStyle = '#fff';
        g.fillText(txt, n.cen.x, n.cen.y + 0.5 / K);
    }
    cv.dataset.drawn = d.named.size;
}

// 滑鼠底下的具名物件（點物件取最近的圓、其他看框；框重疊取面積小的）
function hitAt(d, p, K)
{
    let best = null, area = Infinity;
    for (const n of d.named.values())
    {
        const inPt = n.type === 'point' && Math.hypot(p.x - n.cen.x, p.y - n.cen.y) <= Math.max(8, 8 / K);
        const inRect = p.x >= n.rect.x && p.x <= n.rect.x + n.rect.w && p.y >= n.rect.y && p.y <= n.rect.y + n.rect.h;
        if (!inPt && !inRect) continue;
        const a = inPt ? 0 : n.rect.w * n.rect.h;
        if (a < area) {best = n; area = a;}
    }
    return best;
}

// r＝角色；maps＝路網裡的地圖清單；refresh()＝換地圖後要整個重畫右欄
export function schedMapEl(r, maps, refresh)
{
    const name = M.map && maps.includes(M.map) ? M.map : (r.schedule?.find(s => maps.includes(s.map))?.map ?? maps[0]);
    const view = viewOf(name);
    const cv = h('canvas', {title: '滾輪縮放、按住中鍵拖曳平移'});
    const info = h('span', {class: 'info dim'}, '讀取中…');
    const st = {name, schedule: r.schedule, data: null, hover: null};
    const redraw = () => draw(cv, st);
    st.pz = PZ.panzoom(cv, {frame: () => ({w: st.data?.W ?? 320, h: st.data?.H ?? 320}), redraw, view});
    cv.st = st;
    const users = (n) => {const nums = stopsOn(r.schedule, name).get(n.name); return nums ? `　作息 ${nums.join(',')}` : '';};
    const say = () => {
        const n = st.hover && st.data?.named.get(st.hover);
        info.textContent = n ? `${n.name}（${n.type || '無 type'}）${users(n)}` : st.data ? `${name}　具名物件 ${st.data.named.size}` : info.textContent;
    };
    cv.addEventListener('pointermove', (e) => {
        if (!st.data || st.pz.panning) return;
        const p = st.pz.toWorld(e), n = hitAt(st.data, {x: p.x + st.data.W / 2, y: p.y + st.data.H / 2}, st.pz.K);
        const k = n?.name ?? null;
        cv.style.cursor = n ? 'pointer' : '';
        if (k === st.hover) return;
        st.hover = k;
        say();
        redraw();
    });
    cv.addEventListener('pointerleave', () => {if (st.hover) {st.hover = null; say(); redraw();}});
    mapData(name).then(d => {
        st.data = d;
        if (!d) info.textContent = `讀不到地圖 ${name}`;
        else say();
        if (d && !view.set) PZ.center(view);
        redraw();
    });
    requestAnimationFrame(redraw);
    const pick = h('select', {title: '地圖', dataset: {k: 'schedMap'}, onchange: e => {M.map = e.target.value; remember(); refresh();}},
        maps.map(m => h('option', {value: m, selected: m === name}, m)));
    return h('div', {class: 'pv smap'},
        h('div', {class: 'opts'}, pick),
        h('div', {class: 'cvbox'}, cv),
        h('div', {class: 'opts'}, PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布'), info));
}
