// 角色分頁右欄「作息」：畫 Tiled 地圖（圖塊＋有 gid 的物件先烤成一張圖，每張地圖烤一次），上面疊具名物件跟這個角色的作息點
// 地圖資料走 dev server（/assets/maps/…），格子／物件的算法跟路網共用 src/data/navgrid.js；縮放平移每張地圖一組 view
import {h} from '../common/dom.js';
import * as PZ from '../common/panzoom.js';
import {loadMap, decodeLayer, joinPath, objectTiles, buildGrid, bestPath} from '../../src/data/navgrid.js';
import {edgeCost, hhmm, mod} from '../../src/data/schedplan.js';

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
    d.grid ??= buildGrid(d.map, d.tilesets, d.objs);
    const tw = d.map.tilewidth, th = d.map.tileheight, px = ([tx, ty]) => ({x: (tx + 0.5) * tw, y: (ty + 0.5) * th});
    const lines = [], labels = [];
    legs.forEach((leg, li) => {
        if (leg.map !== name) return;
        const ns = leg.nodes.map(n => ({...n, o: d.named.get(n.name)}));
        for (let i = 1; i < ns.length; i++)
        {
            const a = ns[i - 1].o, b = ns[i].o;
            if (!a || !b) continue;
            let best = null;
            for (const sp of a.tiles)
            {
                const path = bestPath(d.grid, sp, b.tiles);
                if (path && (!best || path.length < best.path.length)) best = {sp, path};
            }
            lines.push({pts: best ? [best.sp, ...best.path].map(px) : [a.cen, b.cen], broken: !best});
        }
        const first = ns[0], last = ns.at(-1);
        const prev = legs[li - 1], next = legs[li + 1];
        if (first.o) labels.push({...first.o.cen, text: prev ? `${hhmm(first.t)} 從 ${shortMap(prev.map)} 進來` : `${hhmm(first.t)} 出發`, go: prev?.map});
        if (last.o && last !== first) labels.push({...last.o.cen, text: next ? `${hhmm(last.t)} → ${shortMap(next.map)}` : `${hhmm(last.t)} 抵達`, go: next?.map});
        else if (last.o && next) labels.push({...last.o.cen, y: last.o.cen.y + 1, text: `${hhmm(last.t)} → ${shortMap(next.map)}`, go: next.map});
    });
    return {lines, labels};
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
    drawRoute(g, st, K);
    cv.dataset.drawn = d.named.size;
}

// 選中那筆的路線：亮藍折線（走不到的段畫紅虛線），起訖／換圖處標時間；標籤的螢幕範圍記在 st.hits（點了切圖）
function drawRoute(g, st, K)
{
    st.hits = [];
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
// opt.plan＝schedplan.js 的 buildPlan().plan（可以是 null）、opt.sel＝選中第幾筆、opt.edges＝路網的 edges
export function schedMapEl(r, maps, refresh, {plan = null, sel = -1, edges = {}} = {})
{
    const name = M.map && maps.includes(M.map) ? M.map : (r.schedule?.find(s => maps.includes(s.map))?.map ?? maps[0]);
    const view = viewOf(name);
    const cv = h('canvas', {title: '滾輪縮放、按住中鍵拖曳平移；點路線上的「→ 地圖」切過去'});
    const info = h('span', {class: 'info dim'}, '讀取中…');
    const legs = legsOf(plan?.[sel], edges);
    const st = {name, schedule: r.schedule, data: null, hover: null, legs, route: null, hits: []};
    const go = (m) => {setMap(m); refresh();};
    cv.addEventListener('click', (e) => {
        const rc = cv.getBoundingClientRect(), K = st.pz.K, o = st.pz.o;
        // hits 是世界座標（地圖左上角為 0）；換成螢幕
        const x = e.clientX - rc.left, y = e.clientY - rc.top;
        const hit = st.hits.find(b => {
            const sx = o.x + (b.x - (st.data?.W ?? 0) / 2) * K, sy = o.y + (b.y - (st.data?.H ?? 0) / 2) * K;
            return x >= sx && x <= sx + b.w * K && y >= sy && y <= sy + b.h * K;
        });
        if (hit) go(hit.go);
    });
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
        else {st.route = routeOn(d, legs, name); say();}
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
    return h('div', {class: 'pv smap'},
        h('div', {class: 'opts'}, pick),
        crumbs,
        h('div', {class: 'cvbox'}, cv),
        h('div', {class: 'opts'}, PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布'), info));
}
