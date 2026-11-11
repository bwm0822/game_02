// 角色分頁右欄「作息」：畫 Tiled 地圖（圖塊＋有 gid 的物件先烤成一張圖，每張地圖烤一次），上面疊具名物件跟這個角色的作息點
// 地圖資料走 dev server（/assets/maps/…），格子／物件的算法跟路網共用 src/data/navgrid.js；縮放平移每張地圖一組 view
import {h} from '../common/dom.js';
import * as PZ from '../common/panzoom.js';
import {loadMap, decodeLayer, joinPath, objectTiles, buildGrid, bestPath} from '../../src/data/navgrid.js';
import {edgeCost, hhmm, mod} from '../../src/data/schedplan.js';
import {createShowMenu} from '../common/showmenu.js';

const SHOW = createShowMenu('tools.role.sched.show', [['mine', '這個角色其他行程', '#e8743b'], ['others', '其他角色的點', '#9ccc65'],
    ['names', '物件名稱', '#dddddd'], ['grid', '格子可走（紅＝擋住、黃＝慢）', '#ff7777']], {mine: true});
export const show = SHOW.show;

const FH = 0x80000000, FV = 0x40000000, FD = 0x20000000, GID = 0x1fffffff;
const KEY = 'tools.role.sched';

export const M = {map: null};       // 目前顯示的地圖（null＝跟著作息第一筆）
try {M.map = localStorage.getItem(`${KEY}.map`);} catch {}
const remember = () => {try {M.map ? localStorage.setItem(`${KEY}.map`, M.map) : localStorage.removeItem(`${KEY}.map`);} catch {}};

const fetchJson = (rel) => fetch(`/assets/${rel}`, {cache: 'no-store'}).then(r => (r.ok ? r.json() : null)).catch(() => null);
// 讀檔：預設走 dev server；角色分頁設成先讀專案資料夾（工具剛寫的地圖、測試的假資料夾），讀不到再走 dev server
let reader = null;
export const setReader = (fn) => {reader = fn;};
const readJson = async (rel) => (reader && await reader(rel)) ?? fetchJson(rel);
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

const mapOf = (key) => key.slice(0, key.indexOf(':'));
const nameOf = (key) => key.slice(key.indexOf(':') + 1);
export const shortMap = (m) => m.split('/').at(-1);

// 選中那筆作息的路線，照地圖分段：[{map, nodes: [{key, name, t}]}]（t＝經過那個節點的時刻）；沒有路線回傳 null
export function legsOf(p, edges)
{
    if (!p?.path) return null;
    const keys = [p.from, ...p.path], legs = [];
    let t = p.dep;
    keys.forEach((key, i) => {
        if (i > 0) t = mod(t + edgeCost(edges, keys[i - 1], key));
        const m = mapOf(key);
        if (legs.at(-1)?.map !== m) legs.push({map: m, nodes: []});
        legs.at(-1).nodes.push({key, name: nameOf(key), t});
    });
    return legs;
}

// 這張圖上要畫的路線：[{pts: [{x,y}...]}]、標籤 [{x, y, text, go?（點了切到哪張圖）}]
function routeOn(d, legs, name)
{
    if (!legs) return null;
    const lines = [], labels = [];
    legs.forEach((leg, li) => {
        if (leg.map !== name) return;
        const ns = leg.nodes.map(n => ({...n, o: d.named.get(n.name)}));
        for (let i = 1; i < ns.length; i++)
        {
            const a = ns[i - 1].o, b = ns[i].o;
            if (a && b) lines.push(walkLine(d, a, b));
        }
        const first = ns[0], last = ns.at(-1);
        const prev = legs[li - 1], next = legs[li + 1];
        if (first.o) labels.push({...first.o.cen, text: prev ? `${hhmm(first.t)} 從 ${shortMap(prev.map)} 進來` : `${hhmm(first.t)} 出發`, go: prev?.map});
        if (last.o && last !== first) labels.push({...last.o.cen, text: next ? `${hhmm(last.t)} → ${shortMap(next.map)}` : `${hhmm(last.t)} 抵達`, go: next?.map});
        else if (last.o && next) labels.push({...last.o.cen, y: last.o.cen.y + 1, text: `${hhmm(last.t)} → ${shortMap(next.map)}`, go: next.map});
    });
    return {lines, labels};
}

// a → b 的格子路徑（換成像素中心點）：起點試 a 的每個站位格、取最短；走不到回傳直線＋broken
function walkLine(d, a, b)
{
    const tw = d.map.tilewidth, th = d.map.tileheight, px = ([tx, ty]) => ({x: (tx + 0.5) * tw, y: (ty + 0.5) * th});
    let best = null;
    for (const sp of a.tiles)
    {
        const path = bestPath(gridOf(d), sp, b.tiles);
        if (path && (!best || path.length < best.path.length)) best = {sp, path};
    }
    return best ? {pts: [best.sp, ...best.path].map(px), broken: false} : {pts: [a.cen, b.cen], broken: true};
}

// 巡邏（同遊戲 COM_Schedule）：入口 go → route[0]（kind entry），route 依序走（loop），最後一點回 route[0]（close，虛線）
function patrolOn(d, s)
{
    const rt = (s.route ?? []).filter(Boolean);
    if (!rt.length) return null;
    const lines = [], at = (n) => d.named.get(n);
    const add = (a, b, kind) => {if (at(a) && at(b) && a !== b) lines.push({...walkLine(d, at(a), at(b)), kind});};
    add(s.go, rt[0], 'entry');
    for (let i = 0; i + 1 < rt.length; i++) add(rt[i], rt[i + 1], 'loop');
    if (rt.length > 1) add(rt.at(-1), rt[0], 'close');
    return {lines, route: rt};
}

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

// 其他角色在這張圖的作息點：名稱 → [{id, i, t}]
function othersOn(others, mapName)
{
    const out = new Map();
    for (const o of others ?? []) if (o.s.map === mapName && o.s.go) (out.get(o.s.go) ?? out.set(o.s.go, []).get(o.s.go)).push({id: o.id, i: o.i, t: o.s.t});
    return out;
}

const gridOf = (d) => (d.grid ??= buildGrid(d.map, d.tilesets, d.objs));

function draw(cv, st)
{
    const d = st.data, g = cv.getContext('2d');
    const {K} = st.pz.begin(g, (g, cw, ch) => {g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, cw, ch);});
    if (!d) return;
    g.imageSmoothingEnabled = false;
    g.translate(-d.W / 2, -d.H / 2);
    g.drawImage(d.bake, 0, 0);
    if (show.grid)
    {
        const grid = gridOf(d), tw = d.map.tilewidth, th = d.map.tileheight;
        grid.forEach((row, ty) => row.forEach((w, tx) => {
            if (w === 1) return;
            g.fillStyle = w === 0 ? 'rgba(255,60,60,0.35)' : 'rgba(255,220,60,0.3)';
            g.fillRect(tx * tw, ty * th, tw, th);
        }));
    }
    // 只顯示選中那筆時，其他筆的編號不畫
    const stops = stopsOn(st.schedule, st.name);
    if (!show.mine) for (const [name, nums] of stops) {const keep = nums.filter(n => n === st.sel + 1); keep.length ? stops.set(name, keep) : stops.delete(name);}
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
    drawRoute(g, st, K);
    drawPatrol(g, st, K);
    // 作息點：膠囊一格一個卡片編號，選中那張反白（大小固定在螢幕 px）；畫在路線上面
    const r = 9 / K;
    g.font = `bold ${11 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [name, nums] of stops)
    {
        const n = d.named.get(name);
        if (!n) continue;
        const ws = nums.map(v => g.measureText(String(v)).width + 8 / K);
        if (ws.length === 1) ws[0] = Math.max(r * 2, ws[0]);
        const w = ws.reduce((a, b) => a + b, 0), x0 = n.cen.x - w / 2, y0 = n.cen.y - r;
        g.beginPath();
        g.roundRect(x0, y0, w, r * 2, r);
        g.fillStyle = '#e8743b';
        g.fill();
        g.save();
        g.clip();
        let x = x0;
        nums.forEach((v, i) => {
            const on = v === st.sel + 1;
            if (on) {g.fillStyle = '#fff'; g.fillRect(x, y0, ws[i], r * 2);}
            if (i) {g.fillStyle = '#000'; g.fillRect(x - 0.5 / K, y0, 1 / K, r * 2);}
            g.fillStyle = on ? '#e8743b' : '#fff';
            g.fillText(String(v), x + ws[i] / 2, n.cen.y + 0.5 / K);
            x += ws[i];
        });
        g.restore();
        g.strokeStyle = '#000';
        g.lineWidth = 1.5 / K;
        g.beginPath();
        g.roundRect(x0, y0, w, r * 2, r);
        g.stroke();
    }
    // 其他角色用到的點：綠字列在下面（id 編號）
    if (show.others)
    {
        g.font = `${14 / K}px sans-serif`;
        for (const [name, list] of othersOn(st.others, st.name))
        {
            const n = d.named.get(name);
            if (!n) continue;
            const txt = list.map(o => `${o.id} ${o.i + 1}`).join('、'), w = g.measureText(txt).width + 8 / K, y = n.cen.y + r + 10 / K;
            g.fillStyle = 'rgba(20,40,10,0.85)';
            g.fillRect(n.cen.x - w / 2, y - 9 / K, w, 18 / K);
            g.fillStyle = '#9ccc65';
            g.fillText(txt, n.cen.x, y);
        }
    }
    if (show.names)
    {
        g.font = `bold ${14 / K}px sans-serif`;
        g.lineWidth = 3.5 / K;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.fillStyle = '#eee';
        for (const n of d.named.values())
        {
            const y = n.type === 'point' ? n.cen.y - 18 / K : n.rect.y - 9 / K;
            g.strokeText(n.name, n.cen.x, y);
            g.fillText(n.name, n.cen.x, y);
        }
    }
    drawBadges(g, st, K);
    drawLabels(g, st, K);
    // 拖曳中的 point：放開後會落在的格子
    if (st.drag?.moved)
    {
        const {x, y} = st.drag.to;
        g.setLineDash([4 / K, 3 / K]);
        g.strokeStyle = '#ffd24a';
        g.lineWidth = 2 / K;
        g.strokeRect(x, y, d.map.tilewidth, d.map.tileheight);
        g.setLineDash([]);
    }
    cv.dataset.drawn = d.named.size;
}

// 選中那筆的路線：亮藍折線（走不到的段畫紅虛線）
function drawRoute(g, st, K)
{
    const rt = st.route;
    if (!rt) return;
    g.lineJoin = g.lineCap = 'round';
    for (const ln of rt.lines)
    {
        g.beginPath();
        ln.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.setLineDash(ln.broken ? [6 / K, 4 / K] : []);
        g.strokeStyle = '#000';
        g.lineWidth = 5 / K;
        g.stroke();
        g.strokeStyle = ln.broken ? '#ff5555' : '#4fc3f7';
        g.lineWidth = 3 / K;
        g.stroke();
    }
    g.setLineDash([]);
}

// 路線起訖／換圖處的時間標籤（畫在最上面）；標籤的範圍記在 st.hits（點了切圖）
function drawLabels(g, st, K)
{
    st.hits = [];
    const rt = st.route;
    if (!rt) return;
    g.font = `${12 / K}px sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const pad = 4 / K, hh = 18 / K;
    for (const lb of rt.labels)
    {
        const w = g.measureText(lb.text).width + pad * 2, x = lb.x + 12 / K, y = lb.y - hh / 2;
        g.fillStyle = lb.go ? 'rgba(20,60,90,0.92)' : 'rgba(0,0,0,0.8)';
        g.strokeStyle = lb.go ? '#4fc3f7' : '#888';
        g.lineWidth = 1 / K;
        g.beginPath();
        g.roundRect(x, y, w, hh, 3 / K);
        g.fill(); g.stroke();
        g.fillStyle = '#fff';
        g.fillText(lb.text, x + pad, lb.y);
        if (lb.go) st.hits.push({x, y, w, h: hh, go: lb.go});
    }
}

// 巡邏：綠線（入口那段細、回起點那段虛線）
function drawPatrol(g, st, K)
{
    const pt = st.patrol;
    if (!pt) return;
    g.lineJoin = g.lineCap = 'round';
    for (const ln of pt.lines)
    {
        g.beginPath();
        ln.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.setLineDash(ln.broken || ln.kind === 'close' ? [6 / K, 4 / K] : []);
        g.strokeStyle = '#000';
        g.lineWidth = (ln.kind === 'entry' ? 3 : 5) / K;
        g.stroke();
        g.strokeStyle = ln.broken ? '#ff5555' : '#7ddc5a';
        g.lineWidth = (ln.kind === 'entry' ? 1.5 : 3) / K;
        g.stroke();
    }
    g.setLineDash([]);
}

// 巡邏每個路點旁邊一排號碼（走到第幾個；重複經過就好幾個），號碼的範圍記在 st.routeHits（右鍵刪那一次）
function drawBadges(g, st, K)
{
    st.routeHits = [];
    const pt = st.patrol;
    if (!pt) return;
    g.font = `bold ${10 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const r = 7 / K, slot = new Map();
    pt.route.forEach((name, idx) => {
        const n = st.data.named.get(name);
        if (!n) return;
        const k = slot.get(name) ?? 0;
        slot.set(name, k + 1);
        const x = n.cen.x - 10 / K + k * (r * 2 + 2 / K), y = n.cen.y - 14 / K;
        g.fillStyle = st.editRoute ? '#2e7d32' : '#3d8b2f';
        g.strokeStyle = '#000';
        g.lineWidth = 1 / K;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill(); g.stroke();
        g.fillStyle = '#fff';
        g.fillText(String(idx + 1), x, y + 0.5 / K);
        st.routeHits.push({x: x - r, y: y - r, w: r * 2, h: r * 2, idx});
    });
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

export function setMap(m)
{
    M.map = m;
    remember();
}

// r＝角色；maps＝路網裡的地圖清單；refresh()＝換地圖後要整個重畫右欄
// opt.plan＝schedplan.js 的 buildPlan().plan（可以是 null）、opt.sel＝選中第幾筆（-1＝沒有）、opt.edges＝路網的 edges
// opt.others＝其他角色的作息 [{id, i, s}]；opt.onPick(map, name, shift)＝點了具名物件（有選卡片才改、Shift＝在後面插入）
// point 編輯：opt.onNew(map, x, y, data)＝點空地、opt.onMove(map, name, x, y)＝拖完、opt.onMenu(e, map, name)＝右鍵（x/y＝格子左上角）
// 路網：opt.stale＝比 navgraph.json 新的地圖（null／[]＝沒過期）、opt.onUpdate()＝按「更新路網」、opt.navMsg＝上次更新的結果文字
// 巡邏：opt.patrol＝選中那筆（do 是 patrol 才給）、opt.editRoute＝編輯路線中（點物件＝onRouteAdd(map, name)、右鍵號碼＝onRouteDel(第幾個)）
export function schedMapEl(r, maps, refresh, {plan = null, sel = -1, edges = {}, others = [], onPick = null,
    onNew = null, onMove = null, onMenu = null, stale = null, onUpdate = null, navMsg = '',
    patrol = null, editRoute = false, onRouteAdd = null, onRouteDel = null} = {})
{
    const name = M.map && maps.includes(M.map) ? M.map : (r.schedule?.find(s => maps.includes(s.map))?.map ?? maps[0]);
    const view = viewOf(name);
    const cv = h('canvas');
    const tip = h('div', {class: 'smaptip', hidden: true});
    const msg = h('div', {class: 'smapmsg dim', hidden: true});
    const legs = legsOf(plan?.[sel], edges);
    const st = {name, schedule: r.schedule, sel, others, data: null, hover: null, legs, route: null, hits: [], patrol: null, routeHits: [], editRoute};
    const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    const go = (m) => {setMap(m); refresh();};
    const toMap = (e) => {const p = st.pz.toWorld(e); return {x: p.x + st.data.W / 2, y: p.y + st.data.H / 2};};
    cv.addEventListener('click', (e) => {
        if (!st.data || st.swallow) return;
        // 先看路線標籤（「→ 地圖」切圖），再看具名物件，都沒點到＝空地（新增 point）
        const p = toMap(e);
        const hit = st.hits.find(b => inBox(p, b));
        if (hit) return go(hit.go);
        const n = hitAt(st.data, p, st.pz.K);
        if (n && editRoute) {onRouteAdd?.(name, n.name); return;}
        if (n) {if (onPick && (e.shiftKey || sel >= 0)) onPick(name, n.name, e.shiftKey); return;}
        if (onNew && p.x >= 0 && p.y >= 0 && p.x < st.data.W && p.y < st.data.H) {const s = snap(p); onNew(name, s.x, s.y, st.data);}
    });
    const redraw = () => draw(cv, st);
    st.pz = PZ.panzoom(cv, {frame: () => ({w: st.data?.W ?? 320, h: st.data?.H ?? 320}), redraw, view});
    cv.st = st;
    const hint = () => (editRoute ? '點＝加到巡邏路線最後' : sel >= 0 ? `點＝設成作息 ${sel + 1} 的目的地、Shift＋點＝在後面插入` : 'Shift＋點＝新增一筆作息');
    // 滑過具名物件：游標旁浮動框（名稱、這個角色第幾筆作息＋時間、其他角色、操作提示），靠右／下邊翻面
    const say = (e) => {
        const n = st.hover && st.data?.named.get(st.hover);
        if (!n) {tip.hidden = true; return;}
        const nums = stopsOn(r.schedule, name).get(n.name), os = othersOn(others, name).get(n.name);
        tip.replaceChildren(...[
            h('div', {class: 'tname'}, `${n.name}（${n.type || '無 type'}）`),
            nums && h('div', {class: 'tmine'}, '作息 ', nums.flatMap((v, i) => [i > 0 && '、', h(v === sel + 1 ? 'b' : 'span', null, `${v}（${r.schedule[v - 1].t}）`)])),
            os && h('div', {class: 'tothers'}, os.map(o => `${o.id} ${o.i + 1}（${o.t}）`).join('、')),
            (onPick || editRoute) && h('div', {class: 'thint'}, hint())].filter(Boolean));
        tip.hidden = false;
        if (!e) return;
        const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
        const w = tip.offsetWidth, ht = tip.offsetHeight;
        tip.style.left = `${Math.max(0, x + 14 + w > box.width ? x - 14 - w : x + 14)}px`;
        tip.style.top = `${Math.max(0, y + 16 + ht > box.height ? y - 10 - ht : y + 16)}px`;
    };
    // 拖 point（左鍵按在 point 上、移超過 4px 才算拖）：放開時 onMove(map, name, x, y)，x/y＝格子左上角；拖過就吃掉接著的 click
    const snap = (p) => {const tw = st.data.map.tilewidth, th = st.data.map.tileheight; return {x: Math.floor(p.x / tw) * tw, y: Math.floor(p.y / th) * th};};
    cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !st.data || !onMove) return;
        const n = hitAt(st.data, toMap(e), st.pz.K);
        if (n?.type !== 'point') return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        st.drag = {name: n.name, sx: e.clientX, sy: e.clientY, moved: false, to: snap(toMap(e))};
    });
    cv.addEventListener('pointerup', (e) => {
        const dr = st.drag;
        st.drag = null;
        if (!dr?.moved) return;
        st.swallow = true;
        setTimeout(() => {st.swallow = false;}, 0);
        redraw();
        onMove(name, dr.name, dr.to.x, dr.to.y);
    });
    cv.addEventListener('pointermove', (e) => {
        if (!st.data || st.pz.panning) return;
        const dr = st.drag;
        if (dr)
        {
            if (!dr.moved && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) < 4) return;
            dr.moved = true;
            dr.to = snap(toMap(e));
            cv.style.cursor = 'grabbing';
            tip.hidden = true;
            return redraw();
        }
        const n = hitAt(st.data, toMap(e), st.pz.K);
        const k = n?.name ?? null;
        cv.style.cursor = n?.type === 'point' && onMove ? 'grab' : n ? 'pointer' : '';
        const changed = k !== st.hover;
        st.hover = k;
        say(e);
        if (changed) redraw();
    });
    cv.addEventListener('pointerleave', () => {if (st.hover) {st.hover = null; say(); redraw();}});
    cv.addEventListener('contextmenu', (e) => {
        if (!st.data) return;
        const rh = editRoute && st.routeHits.find(b => inBox(toMap(e), b));
        if (rh) {e.preventDefault(); onRouteDel?.(rh.idx); return;}
        if (!onMenu) return;
        const n = hitAt(st.data, toMap(e), st.pz.K);
        if (n?.type !== 'point') return;
        e.preventDefault();
        onMenu(e, name, n.name);
    });
    mapData(name).then(d => {
        st.data = d;
        if (!d) {msg.textContent = `讀不到地圖 ${name}`; msg.hidden = false;}
        else {st.route = routeOn(d, legs, name); st.patrol = patrol?.map === name ? patrolOn(d, patrol) : null;}
        if (d && !view.set) PZ.center(view);
        redraw();
    });
    requestAnimationFrame(redraw);
    const pick = h('select', {title: '地圖', dataset: {k: 'schedMap'}, onchange: e => go(e.target.value)},
        maps.map(m => h('option', {value: m, selected: m === name}, m)));
    // 麵包屑：這段路依序經過的地圖（點了切過去），標進出時刻
    const crumbs = legs && legs.length > 0 && h('div', {class: 'crumbs', title: `作息 ${sel + 1} 經過的地圖`},
        legs.flatMap((l, i) => [i > 0 && h('span', {class: 'dim'}, '→'),
            h('button', {type: 'button', class: l.map === name ? 'on' : '', dataset: {map: l.map}, onclick: () => go(l.map)},
                shortMap(l.map), h('small', null, ` ${hhmm(l.nodes[0].t)}～${hhmm(l.nodes.at(-1).t)}`))]));
    const banner = stale?.length > 0 && h('div', {class: 'stale', title: '遊戲的 NPC 照 navgraph.json 走；地圖改了沒更新，遊戲裡找不到新的點、時間也不準'},
        `⚠ 路網已過期（${stale.map(m => `${shortMap(m)}.json`).join('、')} 比 navgraph.json 新）`,
        onUpdate && h('button', {type: 'button', class: 'navupd', onclick: onUpdate}, '更新路網'));
    const editBar = editRoute && h('div', {class: 'routeedit'},
        `編輯作息 ${sel + 1} 的巡邏路線（${patrol?.map ?? ''}）：點點＝加到最後、右鍵綠色號碼＝拿掉那一次、點空地＝新增 point 並加進去、Esc 結束`);
    return h('div', {class: 'pv smap'},
        banner,
        navMsg && h('div', {class: 'navmsg dim'}, navMsg),
        editBar,
        h('div', {class: 'opts'}, pick, h('span', {class: 'help', title: '滾輪縮放、按住中鍵拖曳平移；點路線上的「→ 地圖」切過去；滑過物件看誰在用'}, '?')),
        crumbs,
        h('div', {class: 'cvbox'}, cv, tip, msg),
        h('div', {class: 'opts'}, SHOW.showMenu(redraw), PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布')));
}
