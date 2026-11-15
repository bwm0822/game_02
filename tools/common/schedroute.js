// 作息路線：某筆作息走的路（藍）＋時間標籤、巡邏圈（綠）畫在 Tiled 地圖上（角色分頁作息地圖、地圖分頁 📍 跟著共用）
import {bestPath} from '../../src/data/navgrid.js';
import {edgeCost, hhmm, mod, destOf, patrolMode, patrolEnd} from '../../src/data/schedplan.js';
import {gridOf, spotOf} from './mapview.js';

const mapOf = (key) => key.slice(0, key.indexOf(':'));
const nameOf = (key) => key.slice(key.indexOf(':') + 1);
export const shortMap = (m) => m.split('/').at(-1);

// 一筆作息（buildPlan 的 plan[i]）的路線，照地圖分段：[{map, nodes: [{key, name, t}]}]（t＝經過那個節點的時刻）；沒有路線回傳 null
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

// 這張圖上要畫的路線：{lines: [{pts: [{x,y}...], broken}], labels: [{x, y, text, go?（點了切到哪張圖）, land?（那張圖上這段路的端點名稱）}]}
export function routeOn(d, legs, name)
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
        const toPrev = prev && {go: prev.map, land: prev.nodes.at(-1).name}, toNext = next && {go: next.map, land: next.nodes[0].name};
        if (first.o) labels.push({...first.o.cen, text: prev ? `${hhmm(first.t)} 從 ${shortMap(prev.map)} 進來` : `${hhmm(first.t)} 出發`, ...toPrev});
        if (last.o && last !== first) labels.push({...last.o.cen, text: next ? `${hhmm(last.t)} → ${shortMap(next.map)}` : `${hhmm(last.t)} 抵達`, ...toNext});
        else if (last.o && next) labels.push({...last.o.cen, y: last.o.cen.y + 1, text: `${hhmm(last.t)} → ${shortMap(next.map)}`, ...toNext});
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

// 巡邏（同遊戲 COM_Schedule）：入口 go → route[0]（kind entry），route 依序走（fwd ➜；原路來回＝back ⟷），循環的最後一點回 route[0]（close，虛線 ➜）
// end＝一次／單向走完停的點（標「停」）
export function patrolOn(d, s)
{
    const rt = (s.route ?? []).filter(Boolean);
    if (!rt.length) return null;
    const lines = [], at = (n) => spotOf(d, n), mode = patrolMode(s);
    const add = (a, b, kind) => {if (at(a) && at(b) && a !== b) lines.push({...walkLine(d, at(a), at(b)), kind});};
    const back = mode === 'back' || mode === 'back1';
    add(destOf(s), rt[0], 'entry');
    for (let i = 0; i + 1 < rt.length; i++) add(rt[i], rt[i + 1], back ? 'back' : 'fwd');
    if (rt.length > 1 && (mode === 'loop' || mode === 'loop1')) add(rt.at(-1), rt[0], 'close');
    return {lines, route: rt, end: patrolEnd(s)};
}

// 折線中間（照長度）畫箭頭；both＝兩頭都畫（⟷）
function arrowMid(g, pts, K, both)
{
    const segs = pts.slice(1).map((p, i) => [pts[i], p, Math.hypot(p.x - pts[i].x, p.y - pts[i].y)]);
    let half = segs.reduce((a, s) => a + s[2], 0) / 2;
    const s = segs.find(x => (half -= x[2]) <= 0);
    if (!s || !s[2]) return;
    const [a, b, len] = s, f = 1 + half / len;
    const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f, ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const head = (dir, off) => {
        const L = 9 / K, W = 5 / K, tx = x + ux * dir * off, ty = y + uy * dir * off;
        g.beginPath();
        g.moveTo(tx + ux * dir * L / 2, ty + uy * dir * L / 2);
        g.lineTo(tx - ux * dir * L / 2 - uy * W, ty - uy * dir * L / 2 + ux * W);
        g.lineTo(tx - ux * dir * L / 2 + uy * W, ty - uy * dir * L / 2 - ux * W);
        g.closePath();
        g.fill(); g.stroke();
    };
    if (both) {head(1, 6 / K); head(-1, 6 / K);}
    else head(1, 0);
}

// st.route（routeOn）：亮藍折線（走不到的段畫紅虛線）
export function drawRoute(g, st, K)
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

// st.route 起訖／換圖處的時間標籤（畫在最上面）；能點的標籤範圍記在 st.hits [{x, y, w, h, go, land}]
export function drawLabels(g, st, K)
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
        if (lb.go) st.hits.push({x, y, w, h: hh, go: lb.go, land: lb.land});
    }
    g.textBaseline = 'alphabetic';
}

// st.patrol（patrolOn）：綠線（入口那段細、回起點那段虛線）＋中間箭頭＋終點「停」
export function drawPatrol(g, st, K)
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
    g.strokeStyle = '#000';
    g.lineWidth = 1 / K;
    for (const ln of pt.lines)
    {
        if (ln.kind === 'entry') continue;
        g.fillStyle = ln.broken ? '#ff5555' : '#7ddc5a';
        arrowMid(g, ln.pts, K, ln.kind === 'back');
    }
    const n = pt.end && spotOf(st.data, pt.end);
    if (!n) return;
    g.font = `bold ${11 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const w = 20 / K, hh = 14 / K, x = n.cen.x, y = n.cen.y + 14 / K;
    g.fillStyle = '#b71c1c';
    g.beginPath();
    g.roundRect(x - w / 2, y - hh / 2, w, hh, 3 / K);
    g.fill(); g.stroke();
    g.fillStyle = '#fff';
    g.fillText('停', x, y + 0.5 / K);
    g.textBaseline = 'alphabetic';
}
