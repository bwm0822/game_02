// 角色分頁右欄「作息」：畫 Tiled 地圖（讀檔／烤圖／具名物件／格子在 tools/common/mapview.js，地圖分頁共用），上面疊具名物件跟這個角色的作息點
import {h} from '../common/dom.js';
import * as PZ from '../common/panzoom.js';
import {bestPath} from '../../src/data/navgrid.js';
import {edgeCost, hhmm, mod, destOf, atName, parseAt} from '../../src/data/schedplan.js';
import {createShowMenu} from '../common/showmenu.js';
import {mapData, gridOf, drawGrid, snapTile, spotOf} from '../common/mapview.js';
import * as DR from '../common/doors.js';
import {navBanner} from '../common/pointedit.js';
import {spotsOn, clashOf, occupyEl} from './occupy.js';
export {setReader, forget, mapData, spotOf, gridOf} from '../common/mapview.js';

const SHOW = createShowMenu('tools.role.sched.show', [['mine', '這個角色其他行程', '#e8743b'], ['others', '其他角色的點', '#9ccc65'],
    ['names', '物件名稱', '#dddddd', {filter: true}], ['grid', '格子可走（紅＝擋住、黃＝慢）', '#ff7777'], ['coord', '座標（滑過空地的浮動框）', '#aaccff']], {mine: true, coord: true});
export const show = SHOW.show;
export const nameOk = SHOW.nameOk;

const KEY = 'tools.role.sched';

export const M = {map: null, back: [], land: null, free: null, focus: null, shown: null};       // map＝目前顯示的地圖（null＝跟著作息第一筆）；back＝點門進來之前那幾張（← 返回）、land＝要落腳的 {map, port}、free＝點門進的路網外地圖、focus＝下次畫要對準的 {map, key}（一次性）、shown＝上次對準的結果 {map, rect, msg, t0}
try {M.map = localStorage.getItem(`${KEY}.map`);} catch {}
const remember = () => {try {M.map ? localStorage.setItem(`${KEY}.map`, M.map) : localStorage.removeItem(`${KEY}.map`);} catch {}};

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
        const ns = leg.nodes.map(n => ({...n, o: spotOf(d, n.name)}));
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
    const lines = [], at = (n) => spotOf(d, n);
    const add = (a, b, kind) => {if (at(a) && at(b) && a !== b) lines.push({...walkLine(d, at(a), at(b)), kind});};
    add(destOf(s), rt[0], 'entry');
    for (let i = 0; i + 1 < rt.length; i++) add(rt[i], rt[i + 1], 'loop');
    if (rt.length > 1) add(rt.at(-1), rt[0], 'close');
    return {lines, route: rt};
}

const views = new Map();
const viewOf = (name) => {if (!views.has(name)) views.set(name, PZ.createView(`tools.preview.view.role.map.${name}`)); return views.get(name);};

const COLOR = {point: '#ffd24a', port: '#5cd0ff', door: '#5cd0ff', bed: '#c88cff'};

const push = (m, k, v) => (m.get(k) ?? m.set(k, []).get(k)).push(v);

// 這個角色在這張圖的作息點：名稱（格子＝"@x,y"）→ [{i（第幾筆，0 起）, text（抵達時間）}]
function stopsOn(schedule, mapName, plan)
{
    const out = new Map();
    (schedule ?? []).forEach((s, i) => {
        if (s.map === mapName && destOf(s)) push(out, destOf(s), {i, text: plan?.[i] ? hhmm(plan[i].arr) : (s.t ?? '?').replace(/^@/, '')});
    });
    return out;
}

// 其他角色在這張圖的作息點：名稱 → [{id, i, t}]
function othersOn(others, mapName)
{
    const out = new Map();
    for (const o of others ?? []) if (o.s.map === mapName && destOf(o.s)) push(out, destOf(o.s), {id: o.id, i: o.i, t: o.s.t});
    return out;
}

// 這張圖所有角色的作息點占用（occupy.js），每次重建右欄（資料改了）才重算
const spotsOf = (st) => (st.spots ??= spotsOn(st.occ(), st.name));

function draw(cv, st)
{
    const d = st.data, g = cv.getContext('2d');
    const {K} = st.pz.begin(g, (g, cw, ch) => {g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, cw, ch);});
    if (!d) return;
    g.imageSmoothingEnabled = false;
    g.translate(-d.W / 2, -d.H / 2);
    g.drawImage(d.bake, 0, 0);
    if (show.grid) drawGrid(g, d);
    // 只顯示選中那筆時，其他筆的編號不畫
    const stops = stopsOn(st.schedule, st.name, st.plan);
    if (!show.mine) for (const [name, nums] of stops) {const keep = nums.filter(n => n.i === st.sel); keep.length ? stops.set(name, keep) : stops.delete(name);}
    g.lineWidth = 1 / K;
    const doorNames = new Set((st.ports ?? []).map(p => p.o.name).filter(Boolean));
    for (const n of d.named.values())
    {
        if (doorNames.has(n.name)) continue;
        const c = COLOR[n.type] ?? '#ffffff', on = st.hover === n.name;
        g.globalAlpha = on ? 1 : 0.55;
        g.strokeStyle = c;
        g.lineWidth = (on ? 2 : 1) / K;
        if (n.type === 'point') {g.beginPath(); g.arc(n.cen.x, n.cen.y, 5, 0, Math.PI * 2); g.stroke();}
        else g.strokeRect(n.rect.x, n.rect.y, n.rect.w, n.rect.h);
    }
    // 作息 at 格子（所有角色的、含巡邏 route 經過的）：淡黃方框，兩人以上同時停留＝紅
    for (const [key, rows] of spotsOf(st))
    {
        const n = parseAt(key) && spotOf(d, key);
        if (!n) continue;
        const clash = clashOf(rows).length > 0, on = st.cell?.key === key;
        g.globalAlpha = on ? 1 : clash ? 0.85 : 0.55;
        g.strokeStyle = clash ? '#ff4d4d' : COLOR.point;
        g.lineWidth = (on || clash ? 2 : 1) / K;
        g.strokeRect(n.rect.x + 2, n.rect.y + 2, n.rect.w - 4, n.rect.h - 4);
    }
    g.globalAlpha = 1;
    DR.drawDoors(g, st.ports, K, st.door);
    drawCursor(g, st, K);
    drawRoute(g, st, K);
    drawPatrol(g, st, K);
    // 作息點：膠囊一格一個卡片編號，選中那張反白（大小固定在螢幕 px）；畫在路線上面
    const r = 9 / K;
    g.font = `bold ${11 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const [name, nums] of stops)
    {
        const n = spotOf(d, name);
        if (!n) continue;
        const ws = nums.map(v => g.measureText(v.text).width + 8 / K);
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
            const on = v.i === st.sel;
            if (on) {g.fillStyle = '#fff'; g.fillRect(x, y0, ws[i], r * 2);}
            if (i) {g.fillStyle = '#000'; g.fillRect(x - 0.5 / K, y0, 1 / K, r * 2);}
            g.fillStyle = on ? '#e8743b' : '#fff';
            g.fillText(v.text, x + ws[i] / 2, n.cen.y + 0.5 / K);
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
            const n = spotOf(d, name);
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
            if (!SHOW.nameOk(n.name)) continue;
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
    DR.drawFlash(g, st, K);
    cv.dataset.drawn = d.named.size;
}

// 游標底下：空地＝對齊格子的方框（白＝可以站、紅＝擋住）、具名物件＝框住整個物件（門有自己的框）
function drawCursor(g, st, K)
{
    const c = st.cell, n = !c && !st.door && st.hover && st.data.named.get(st.hover);
    const r = c ? c.rect : n?.rect;
    if (!r || st.drag?.moved) return;
    g.strokeStyle = '#000';
    g.lineWidth = 3.5 / K;
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = c?.blocked ? '#ff5555' : '#ffffff';
    g.lineWidth = 1.5 / K;
    g.strokeRect(r.x, r.y, r.w, r.h);
    if (c?.blocked) {g.fillStyle = 'rgba(255,60,60,0.25)'; g.fillRect(r.x, r.y, r.w, r.h);}
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
        g.fillStyle = st.editRoute && idx === st.routeMark ? '#c62828' : st.editRoute ? '#2e7d32' : '#3d8b2f';
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

// 用下拉／標籤／麵包屑換地圖：清掉「← 返回」
export function setMap(m)
{
    M.map = m;
    M.back = [];
    M.free = null;
    remember();
}

// 換選中的作息：切到目的地那張圖，下次畫時鏡頭對準目的地（倍率不動）、閃一下
export function focusSch(s)
{
    if (!s?.map) return;
    setMap(s.map);
    M.focus = {map: s.map, key: destOf(s)};
}

// 點門：記住從哪來、打開那張圖（路網外的也能看）、鏡頭移到落腳點
function enterDoor(from, door)
{
    const t = DR.targetOf(door);
    M.back.push(from);
    M.land = t;
    M.map = t.map;
    M.free = t.map;
    remember();
}

function goBack()
{
    const m = M.back.pop();
    if (!m) return;
    M.map = m;
    M.free = m;
    remember();
}

// 門的問題要別張圖的物件名稱：先把門指到的地圖讀進來
async function portsFor(d)
{
    const names = new Map();
    const targets = [...new Set(d.objs.filter(o => o.type === 'port' && o.props?.map).map(o => String(o.props.map)))];
    await Promise.all(targets.map(async m => {const x = await mapData(m); names.set(m, x ? new Set(x.objs.map(o => o.name).filter(Boolean)) : null);}));
    return DR.portsOf(d, (m) => names.get(m) ?? null);
}

// r＝角色；maps＝路網裡的地圖清單；refresh()＝換地圖後要整個重畫右欄
// opt.plan＝schedplan.js 的 buildPlan().plan（可以是 null）、opt.sel＝選中第幾筆（-1＝沒有）、opt.edges＝路網的 edges
// opt.others＝其他角色的作息 [{id, i, s}]（地圖上的綠字）
// opt.id＝這個角色的 id、opt.occ()＝全部角色的 [{id, sch, segs}]（occupy.js 的 spotsOn，浮動框的占用時間圖；第一次 hover 才算）
// 左鍵只看（點門進去、點路線標籤切圖、拖 point 改 Tiled）；改資料都走右鍵 opt.onMenu(e, map, hit)：
//   hit＝{name?, type?（具名物件）, door?（{o, issue}）, tile: [tx, ty], blocked（格子走不到）, inNav（這張圖在路網裡）}
// point 編輯：opt.onMove(map, name, x, y)＝拖完（x/y＝格子左上角）
// 路網：opt.stale＝比 navgraph.json 新的地圖（null／[]＝沒過期）、opt.atStale＝還沒進路網的作息格子數、opt.onUpdate()＝按「更新路網」、opt.navMsg＝上次更新的結果文字
// 巡邏：opt.patrol＝選中那筆（do 是 patrol 才給）、opt.editRoute＝編輯路線中（點物件＝onRouteAdd(map, name)、點空地＝onNew(map, x, y, data)、右鍵號碼＝onRouteDel(第幾個)、Shift＋點號碼＝onRouteMark(第幾個)）
// opt.routeMark＝標記的第幾個（紅底，新點插在它前面）
// 挑目的地：opt.pick＝提示文字（有＝挑選模式，左鍵點物件／空地＝onPick(map, {name?, tile})，門照樣能進去）
export function schedMapEl(r, maps, refresh, {plan = null, sel = -1, edges = {}, others = [], id = null, occ = () => [],
    onNew = null, onMove = null, onMenu = null, stale = null, atStale = 0, onUpdate = null, navMsg = '',
    patrol = null, editRoute = false, onRouteAdd = null, onRouteDel = null, routeMark = null, onRouteMark = null, pick = null, onPick = null} = {})
{
    const free = M.map && M.free === M.map;
    const name = M.map && (maps.includes(M.map) || free) ? M.map : (r.schedule?.find(s => maps.includes(s.map))?.map ?? maps[0]);
    const inNav = maps.includes(name);
    const view = viewOf(name);
    const cv = h('canvas');
    const tip = h('div', {class: 'smaptip', hidden: true});
    const msg = h('div', {class: 'smapmsg dim', hidden: true});
    const legs = legsOf(plan?.[sel], edges);
    const st = {name, schedule: r.schedule, plan, sel, others, occ, data: null, hover: null, cell: null, door: null, ports: [], legs, route: null, hits: [], patrol: null, routeHits: [], editRoute, routeMark};
    const markName = routeMark != null && patrol?.route?.[routeMark] ? `${routeMark + 1} ${patrol.route[routeMark]}` : null;
    const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
    const go = (m) => {setMap(m); refresh();};
    const toMap = (e) => {const p = st.pz.toWorld(e); return {x: p.x + st.data.W / 2, y: p.y + st.data.H / 2};};
    const inMap = (p) => p.x >= 0 && p.y >= 0 && p.x < st.data.W && p.y < st.data.H;
    const tileOf = (p) => [Math.floor(p.x / st.data.map.tilewidth), Math.floor(p.y / st.data.map.tileheight)];
    const blockedAt = ([tx, ty]) => gridOf(st.data)[ty]?.[tx] === 0;
    // 滑鼠底下是什麼：門 → 具名物件 → 空地格子
    const probe = (p) => {
        const door = DR.doorAt(st.ports, p);
        const n = !door && hitAt(st.data, p, st.pz.K);
        const tile = tileOf(p);
        return {door, n: n || null, tile, blocked: !door && !n && blockedAt(tile)};
    };
    cv.addEventListener('click', (e) => {
        if (!st.data || st.swallow) return;
        const p = toMap(e);
        const hit = st.hits.find(b => inBox(p, b));
        if (hit) return go(hit.go);
        const rh = editRoute && e.shiftKey && st.routeHits.find(b => inBox(p, b));
        if (rh) return onRouteMark?.(rh.idx);
        const {door, n} = probe(p);
        if (door)
        {
            if (door.issue?.level === 'error') {tip.hidden = true; msg.textContent = `⚠ ${door.issue.msg}`; msg.hidden = false; setTimeout(() => {msg.hidden = true;}, 2000); return;}
            enterDoor(name, door);
            return refresh();
        }
        if (pick)
        {
            if (!inMap(p) || !inNav) return;
            const tile = tileOf(p);
            if (!n && blockedAt(tile)) return;
            onPick?.(name, {name: n?.name, tile});
            return;
        }
        if (!editRoute) return;
        if (n) {onRouteAdd?.(name, n.name); return;}
        if (onNew && inMap(p)) {const s = snap(p); onNew(name, s.x, s.y, st.data);}
    });
    const redraw = () => draw(cv, st);
    st.redraw = redraw;
    st.pz = PZ.panzoom(cv, {frame: () => ({w: st.data?.W ?? 320, h: st.data?.H ?? 320}), redraw, view});
    cv.st = st;
    const hint = (x) => {
        if (x.door) return x.door.issue?.level === 'error' ? '地圖不存在，點了不會進去' : '點＝進去、右鍵＝選單';
        if (pick) return !inNav ? '這張圖不在路網裡，不能選' : !x.n && x.blocked ? '這格走不到' : '點＝選這裡';
        if (editRoute) return markName ? (x.n ? `點＝插在 ${markName} 前面` : `點＝新增 point 並插在 ${markName} 前面`)
            : x.n ? '點＝加到巡邏路線最後' : '點＝新增 point 並加進巡邏路線';
        if (!inNav) return '這張圖不在路網裡，不能設成作息目的地（先更新路網）';
        if (x.blocked) return '這格走不到，不能設成目的地';
        return x.n ? '右鍵＝新增目的地／改目的地…' : '右鍵＝新增目的地…';
    };
    // 游標旁浮動框：物件／格子的名稱、這個角色第幾筆作息＋時間、其他角色、操作提示，靠右／下邊翻面
    const say = (e) => {
        const x = st.probe;
        if (!x || st.drag?.moved) {tip.hidden = true; return;}
        if (x.badge)
        {
            const i = x.badge.idx;
            tip.replaceChildren(h('div', {class: 'tname'}, `第 ${i + 1} 個：${st.patrol.route[i]}`),
                h('div', {class: 'thint'}, i === routeMark ? 'Shift＋點＝取消標記、右鍵＝拿掉這一次' : 'Shift＋點＝標記（新點插在它前面）、右鍵＝拿掉這一次'));
            tip.hidden = false;
            if (e) place(e);
            return;
        }
        const key =x.n?.name ?? (x.door ? x.door.o.name : atName(x.tile));
        const rows = key && spotsOf(st).get(key);
        if (!x.door && !x.n && !rows && !show.coord) {tip.hidden = true; return;}
        const title = x.door ? `🚪 ${x.door.o.name || '（沒名字）'} → ${x.door.o.props.map}` : x.n ? `${x.n.name}（${x.n.type || '無 type'}）` : `格 ${x.tile[0]}, ${x.tile[1]}`;
        tip.replaceChildren(...[
            h('div', {class: 'tname'}, title),
            x.door && h('div', {class: 'tsub'}, `落腳點 ${x.door.o.props.port || '（沒寫）'}`),
            x.door?.issue && h('div', {class: 'twarn'}, `⚠ ${x.door.issue.msg}`),
            rows && occupyEl(rows, {map: name, mine: id, sel}),
            h('div', {class: 'thint'}, hint(x))].filter(Boolean));
        tip.hidden = false;
        if (e) place(e);
    };
    const place = (e) => {
        const box = cv.getBoundingClientRect(), cx = e.clientX - box.left, cy = e.clientY - box.top;
        const w = tip.offsetWidth, ht = tip.offsetHeight;
        tip.style.left = `${Math.max(0, cx + 14 + w > box.width ? cx - 14 - w : cx + 14)}px`;
        tip.style.top = `${Math.max(0, cy + 16 + ht > box.height ? cy - 10 - ht : cy + 16)}px`;
    };
    // 拖 point（左鍵按在 point 上、移超過 4px 才算拖）：放開時 onMove(map, name, x, y)，x/y＝格子左上角；拖過就吃掉接著的 click
    const snap = (p) => snapTile(st.data, p);
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
    const unhover = () => {st.hover = st.cell = st.door = st.probe = null;};
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
        const p = toMap(e);
        if (!inMap(p))
        {
            if (st.probe) {unhover(); say(); redraw();}
            return;
        }
        const x = probe(p), was = `${st.hover}|${st.cell?.key}|${st.door?.o.id}`;
        x.badge = editRoute ? st.routeHits.find(b => inBox(p, b)) ?? null : null;
        const tw = st.data.map.tilewidth, th = st.data.map.tileheight;
        st.probe = x;
        st.door = x.door;
        st.hover = x.n?.name ?? null;
        st.cell = !x.door && !x.n && !editRoute ? {key: atName(x.tile), blocked: x.blocked, rect: {x: x.tile[0] * tw, y: x.tile[1] * th, w: tw, h: th}} : null;
        cv.style.cursor = x.badge ? 'pointer' : x.door ? 'pointer' : pick ? (x.n || !x.blocked ? 'crosshair' : 'not-allowed') : x.n?.type === 'point' && onMove ? 'grab' : x.n && editRoute ? 'pointer' : '';
        say(e);
        if (was !== `${st.hover}|${st.cell?.key}|${st.door?.o.id}`) redraw();
    });
    cv.addEventListener('pointerleave', () => {if (st.probe) {unhover(); say(); redraw();}});
    cv.addEventListener('contextmenu', (e) => {
        if (!st.data) return;
        e.preventDefault();
        const p = toMap(e);
        const rh = editRoute && st.routeHits.find(b => inBox(p, b));
        if (rh) {onRouteDel?.(rh.idx); return;}
        if (!onMenu || !inMap(p)) return;
        const x = probe(p);
        onMenu(e, name, {name: x.n?.name, type: x.n?.type, door: x.door, tile: x.tile, blocked: x.blocked, inNav,
            enter: x.door && x.door.issue?.level !== 'error' ? () => {enterDoor(name, x.door); refresh();} : null});
    });
    const land = M.land?.map === name ? M.land : null;
    if (land) M.land = null;
    if (M.focus && M.focus.map !== name) M.focus = null;
    mapData(name).then(async d => {
        st.data = d;
        if (!d) {msg.textContent = `讀不到地圖 ${name}`; msg.hidden = false;}
        else
        {
            st.route = routeOn(d, legs, name);
            st.patrol = patrol?.map === name ? patrolOn(d, patrol) : null;
        }
        if (d && !view.set) PZ.center(view);
        if (d && land && !DR.landAt(st, view, land.port)) {msg.textContent = `⚠ ${name} 找不到落腳點「${land.port}」`; msg.hidden = false;}
        // 對準目的地：結果記在 M.shown，閃完之前右欄重畫（checkStale…）的新畫布接著閃、照樣顯示 ⚠
        if (d && M.focus?.map === name)
        {
            const key = M.focus.key, n = key && spotOf(d, key);
            M.focus = null;
            M.shown = {map: name, rect: n?.rect, msg: n ? '' : `⚠ ${name} 找不到「${key ?? '（沒寫目的地）'}」`,
                t0: n ? DR.flashAt(st, view, n.rect) : performance.now()};
        }
        else if (d && M.shown?.map === name && performance.now() - M.shown.t0 < DR.FLASH_MS && M.shown.rect) DR.flash(st, M.shown.rect, M.shown.t0);
        if (d && M.shown?.map === name && M.shown.msg && performance.now() - M.shown.t0 < DR.FLASH_MS) {msg.textContent = M.shown.msg; msg.hidden = false;}
        redraw();
        // 門要讀它指到的地圖才知道壞不壞，讀完再畫
        if (d) {st.ports = await portsFor(d); redraw();}
    });
    requestAnimationFrame(redraw);
    const mapSel = h('select', {title: '地圖', dataset: {k: 'schedMap'}, onchange: e => go(e.target.value)},
        !inNav && h('option', {value: name, selected: true}, `${name}（路網沒有）`),
        maps.map(m => h('option', {value: m, selected: m === name}, m)));
    const back = h('button', {type: 'button', class: 'back', dataset: {k: 'schedBack'}, disabled: !M.back.length,
        title: M.back.length ? `回到 ${M.back.at(-1)}（點門進來之前那張）` : '點門進來的才能返回', onclick: () => {goBack(); refresh();}}, '← 返回');
    // 麵包屑：這段路依序經過的地圖（點了切過去），標進出時刻
    const crumbs = legs && legs.length > 0 && h('div', {class: 'crumbs', title: `作息 ${sel + 1} 經過的地圖`},
        legs.flatMap((l, i) => [i > 0 && h('span', {class: 'dim'}, '→'),
            h('button', {type: 'button', class: l.map === name ? 'on' : '', dataset: {map: l.map}, onclick: () => go(l.map)},
                shortMap(l.map), h('small', null, ` ${hhmm(l.nodes[0].t)}～${hhmm(l.nodes.at(-1).t)}`))]));
    const editBar = editRoute && h('div', {class: 'routeedit'},
        markName ? `編輯作息 ${sel + 1} 的巡邏路線：點點／空地＝插在 ${markName} 前面（Shift＋點號碼換位置、Esc 取消標記）`
            : `編輯作息 ${sel + 1} 的巡邏路線（${patrol?.map ?? ''}）：點點＝加到最後、Shift＋點號碼＝插在它前面、右鍵綠色號碼＝拿掉那一次、點空地＝新增 point 並加進去、Esc 結束`);
    return h('div', {class: 'pv smap'},
        ...navBanner({stale, atStale, onUpdate, navMsg}),
        editBar,
        pick && h('div', {class: 'routeedit pickbar'}, `${pick}：點物件或空地（可以點門進去），Esc 取消`),
        h('div', {class: 'opts'}, mapSel, back, h('span', {class: 'help', title: '滾輪縮放、按住中鍵拖曳平移；點門（橘框 🚪）進去、「← 返回」回來；點路線上的「→ 地圖」切過去；右鍵空地或物件＝新增目的地／改目的地，右鍵 point／門還能改名（別張圖指過來的門、作息一起改）；拖 point 改位置'}, '?')),
        crumbs,
        h('div', {class: 'cvbox'}, cv, tip, msg),
        h('div', {class: 'opts'}, SHOW.showMenu(redraw, [], {names: () => [...(st.data?.named.keys() ?? [])]}), PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布')));
}
