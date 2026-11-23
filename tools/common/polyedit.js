// 多邊形編輯（手繪＋Ctrl 磁性套索、拖點、點邊插點、退點），紙娃娃跟場景分頁的切前後片共用
// 頂點是圖片像素座標；呼叫端先把滑鼠換成像素座標 raw 再丟進來
// m：{poly: {pts, closed, cursor?, live?, vert?, edge?} | null, method?: 'hand'|..., mag?}，只有 method==='hand' 才有磁性套索
// h：{scr(n) 螢幕 px → 像素, grad(m) 梯度圖（PX.gradMap）, mag() {width, freq, contrast}, commit(before) 記一步 undo}
import * as PX from '../paperdoll/pixels.js';

const MAG_TOL = 0.75;
const tol = (h) => h.scr(8);

// Shift：從 from 出發的方向鎖在 45° 的倍數
export function snap45(from, p)
{
    const d = Math.hypot(p.x - from.x, p.y - from.y), a = Math.round(Math.atan2(p.y - from.y, p.x - from.x) / (Math.PI / 4)) * Math.PI / 4;
    return {x: from.x + d * Math.cos(a), y: from.y + d * Math.sin(a)};
}

export function edgeHit(h, P, p)
{
    const n = P.pts.length, t0 = tol(h);
    let best = null;
    for (let i = 0; i < n; i++)
    {
        const a = P.pts[i], b = P.pts[(i + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
        const t = len2 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
        const q = {x: a.x + t * dx, y: a.y + t * dy}, d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < t0 && (!best || d < best.d)) best = {i, q, d};
    }
    return best;
}

export const vertexHit = (h, P, p) => P.pts.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) < tol(h));
export const nearFirst = (h, P, p) => P.pts.length >= 3 && Math.hypot(P.pts[0].x - p.x, P.pts[0].y - p.y) < tol(h);
// 手繪按住 Ctrl（沒按 Shift）＝磁性套索
export const magOn = (m, e) => m.method === 'hand' && e.ctrlKey && !e.shiftKey && !m.poly?.closed;

// 按下：沒有多邊形＝第一點；沒閉合＝加點（雙擊／點第一點閉合）；閉合＝點頂點拖、點邊插點拖。回傳拖曳 {type:'polyPt', i} 或 null
export function down(h, m, raw, e)
{
    const P = m.poly;
    if (!P)
    {
        const {width, contrast} = h.mag();
        const p = magOn(m, e) ? PX.edgeNear(h.grad(m), raw, h.scr(width), contrast) ?? raw : raw;
        m.poly = {pts: [p], closed: false, cursor: p};
        if (m.mag) m.mag.trail = [p];
        return null;
    }
    if (!P.closed)
    {
        if (e.detail >= 2) P.closed = P.pts.length >= 3;
        else if (magOn(m, e)) magClick(h, m, raw);
        else if (nearFirst(h, P, raw)) P.closed = true;
        else P.pts = [...P.pts, e.shiftKey ? snap45(P.pts.at(-1), raw) : raw];
        return null;
    }
    const i = vertexHit(h, P, raw);
    if (i >= 0) return {type: 'polyPt', i};
    const hit = edgeHit(h, P, raw);
    if (!hit) return null;
    P.pts = [...P.pts.slice(0, hit.i + 1), hit.q, ...P.pts.slice(hit.i + 1)];
    P.edge = null;
    return {type: 'polyPt', i: hit.i + 1};
}

export function drag(m, raw, e, i)
{
    const P = m.poly, prev = P.pts[(i - 1 + P.pts.length) % P.pts.length];
    P.pts = P.pts.map((v, k) => k === i ? (e.shiftKey ? snap45(prev, raw) : raw) : v);
}

export function hover(h, m, raw, e)
{
    const P = m.poly;
    if (m.mag && !e.ctrlKey) magEnd(h, m);
    if (m.mag && P.live) delete P.live;
    if (!P.closed && magOn(m, e)) {magHover(h, m, raw); P.vert = null;}
    else if (!P.closed)
    {
        P.cursor = e.shiftKey && P.pts.length ? snap45(P.pts.at(-1), raw) : raw;
        const v = vertexHit(h, P, raw);
        P.vert = v >= 0 ? v : null;
    }
    else
    {
        const v = vertexHit(h, P, raw);
        P.vert = v >= 0 ? v : null;
        P.edge = v < 0 ? edgeHit(h, P, raw)?.i ?? null : null;
    }
}

// Backspace：刪最後一點；已閉合就先解開閉合
export function back(m)
{
    const P = m.poly;
    if (P.closed) P.closed = false;
    else if (P.pts.length > 1) P.pts = P.pts.slice(0, -1);
    else m.poly = null;
}

// 手繪按住 Ctrl＝磁性套索（m.mag＝這次按住的 session）：移動時從最後一點沿顏色邊界即時尋路到游標，路徑走滿 freq 就把那段簡化成頂點釘下來；
// Ctrl＋點收進到游標那段，靠近第一點就接回去閉合；放開 Ctrl 丟掉黃線，整段按住期間記一步 undo（h.commit(before)）
export function magBegin(m, before)
{
    m.mag = {before, changed: false, trail: m.poly ? [m.poly.pts.at(-1)] : []};
}

export function magEnd(h, m)
{
    const s = m.mag;
    if (!s) return;
    m.mag = null;
    if (m.poly) delete m.poly.live;
    if (s.changed) h.commit(s.before);
}

function magPath(h, m, to)
{
    const {width, contrast} = h.mag();
    return PX.liveWire(h.grad(m), m.poly.pts.at(-1), to, [...m.mag.trail, to], h.scr(width), contrast);
}

function magHover(h, m, raw)
{
    const P = m.poly, s = m.mag ?? (magBegin(m, h.before?.()), m.mag), F = h.scr(h.mag().freq);
    let path = magPath(h, m, raw);
    for (;;)
    {
        let len = 0, i = 1;
        for (; i < path.length; i++)
        {
            len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
            if (len >= F) break;
        }
        if (i >= path.length - 1) break;
        const pin = path[i];
        P.pts = [...P.pts, ...PX.simplify(path.slice(0, i + 1), MAG_TOL).slice(1)];
        s.changed = true;
        const k = s.trail.reduce((b, t, j) => Math.hypot(t.x - pin.x, t.y - pin.y) < Math.hypot(s.trail[b].x - pin.x, s.trail[b].y - pin.y) ? j : b, 0);
        s.trail = [pin, ...s.trail.slice(k + 1)];
        path = path.slice(i);
    }
    s.trail.push(raw);
    P.live = PX.simplify(path, MAG_TOL).slice(1);
    P.cursor = path.at(-1);
}

function magClick(h, m, raw)
{
    const P = m.poly, s = m.mag ?? (magBegin(m, h.before?.()), m.mag);
    const close = nearFirst(h, P, raw);
    const add = PX.simplify(magPath(h, m, close ? P.pts[0] : raw), MAG_TOL).slice(1);
    if (close && add.length && nearFirst(h, P, add.at(-1))) add.pop();
    P.pts = [...P.pts, ...add];
    if (close) P.closed = P.pts.length >= 3;
    delete P.live;
    P.cursor = P.pts.at(-1);
    s.trail = [P.pts.at(-1)];
}

// 畫多邊形：toW(x, y) 像素 → 畫布座標，K＝畫布座標每單位幾螢幕 px；線色用呼叫端設好的 strokeStyle
export function draw(g, h, P, toW, K)
{
    const wp = P.pts.map(p => toW(p.x, p.y));
    const line = (pts, close) => {
        g.beginPath();
        pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
        if (close) g.closePath();
        g.stroke();
    };
    if (P.closed)
    {
        line(wp, true);
        if (P.edge != null)
        {
            const lw = g.lineWidth;
            g.lineWidth = 3 / K;
            line([wp[P.edge], wp[(P.edge + 1) % wp.length]]);
            g.lineWidth = lw;
        }
    }
    else
    {
        line([...wp, ...(P.live ? [] : [toW(P.cursor.x, P.cursor.y)])]);
        if (P.live)
        {
            const s = g.strokeStyle;
            g.strokeStyle = '#ff0';
            line([wp.at(-1), ...P.live.map(p => toW(p.x, p.y))]);
            g.strokeStyle = s;
        }
    }
    g.fillStyle = '#fff';
    wp.forEach((p, i) => {
        const r = ((i === 0 && !P.closed && nearFirst(h, P, P.cursor)) || i === P.vert ? 6 : 3) / K;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
}
