// 畫布上拖部件用的共用幾何（試穿、部位分頁的預覽）：座標都是 shape 本地（面向右、相對 view 中心），p 是已加回支點的部件
const rad = (d) => d * Math.PI / 180;

// 旋轉游標：上半圓弧兩端各一個實心箭頭（左右轉），白色加黑邊在哪種底色都看得到；熱點在中間
const ROT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" stroke-linejoin="round">`
    + [['#000', 4, '#000'], ['#fff', 2, '#fff']].map(([c, w, f]) => `<path d="M5 13 A7 7 0 0 1 19 13" fill="none" stroke="${c}" stroke-width="${w}"/>`
        + `<path d="M1.5 12.5 H8.5 L5 18 Z M15.5 12.5 H22.5 L19 18 Z" fill="${f}" stroke="${c}" stroke-width="${w - 1.5}"/>`).join('')
    + `</svg>`;
export const ROT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(ROT_SVG)}") 8 8, grab`;

// body 的支點（neck／wristF／wristB）畫成十字：名稱、顏色；白點（旋轉把手）在十字往上 16
export const PIVOT_NAMES = {neck: '脖子', wristF: '前手腕', wristB: '後手腕'};
export const PIVOT_COLOR = {neck: '#ff66cc', wristF: '#66ffcc', wristB: '#ffaa33'};
const CROSS_HANDLE = 16;
export const crossHandle = (pt) => ({x: pt.x + Math.sin(rad(pt.a ?? 0)) * CROSS_HANDLE, y: pt.y - Math.cos(rad(pt.a ?? 0)) * CROSS_HANDLE});

// 十字照靜止角度 a 轉，往上那條長一點看得出方向；on＝滑過／拖著變粗，locked＝變淡、不畫白點
export function drawCross(g, k, pt, px, {on = false, locked = false} = {})
{
    const hd = crossHandle(pt);
    g.save();
    g.globalAlpha = locked ? 0.3 : 1;
    g.lineWidth = (on ? 3 : 1.5) * px;
    g.strokeStyle = PIVOT_COLOR[k];
    if (!locked)
    {
        g.beginPath(); g.moveTo(pt.x, pt.y); g.lineTo(hd.x, hd.y);
        g.save(); g.lineWidth = (on ? 1.5 : 0.75) * px; g.setLineDash([2 * px, 2 * px]); g.stroke(); g.restore();
        g.fillStyle = '#fff';
        g.beginPath(); g.arc(hd.x, hd.y, (on ? 4 : 2.5) * px, 0, Math.PI * 2); g.fill();
    }
    g.translate(pt.x, pt.y);
    g.rotate(rad(pt.a ?? 0));
    g.beginPath();
    g.moveTo(-4, 0); g.lineTo(4, 0);
    g.moveTo(0, -7); g.lineTo(0, 4);
    g.stroke();
    g.restore();
}

// 部件的四個角（照 p.a 繞 origin 轉）
export function boxOf(p, f)
{
    const s = p.scale ?? 1, a = rad(p.a ?? 0), [c, sn] = [Math.cos(a), Math.sin(a)];
    const x0 = -(p.ox ?? 0.5) * f.w * s, y0 = -(p.oy ?? 1) * f.h * s, x1 = x0 + f.w * s, y1 = y0 + f.h * s;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => ({x: (p.x ?? 0) + u * c - v * sn, y: (p.y ?? 0) + u * sn + v * c}));
}

// 選中部件的旋轉把手：圖的上緣中間再往上 gap（跟支點十字的把手錯開）
export function partHandle(p, f, gap)
{
    const [tl, tr] = boxOf(p, f), a = rad(p.a ?? 0), top = {x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2};
    return {top, x: top.x + Math.sin(a) * gap, y: top.y - Math.cos(a) * gap};
}

// (lx, ly) 有沒有在部件 p（畫在 p.x/p.y、轉 p.a）的圖框裡
export function inPart(p, f, lx, ly)
{
    const s = p.scale ?? 1, r = -rad(p.a ?? 0), [dx, dy] = [lx - (p.x ?? 0), ly - (p.y ?? 0)];
    const [u, v] = [(dx * Math.cos(r) - dy * Math.sin(r)) / s + (p.ox ?? 0.5) * f.w, (dx * Math.sin(r) + dy * Math.cos(r)) / s + (p.oy ?? 1) * f.h];
    return u >= 0 && u <= f.w && v >= 0 && v <= f.h;
}

// 畫面上的位移換回支點本地（支點有靜止角度 a）
export function unpivot(dx, dy, pv)
{
    const r = -rad(pv?.a ?? 0);
    return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
}

// 繞 o 從 a0（弧度）轉到 l 的角度差（度，[-180, 180)）
export function turnDeg(o, a0, l)
{
    const d = (Math.atan2(l.y - o.y, l.x - o.x) - a0) * 180 / Math.PI;
    return d - Math.floor((d + 180) / 360) * 360;
}

// 在 g（已經在 shape 本地座標、1 單位＝px 倍）畫選中部件的外框跟把手；width／on 控制粗細
export function drawSel(g, its, ph, px, {thick = false, rotOn = false, dash = false} = {})
{
    g.strokeStyle = '#fff';
    g.lineWidth = (thick ? 2.5 : dash ? 1 : 1.5) * px;
    g.setLineDash(dash ? [2 * px, 2 * px] : []);
    for (const it of its)
    {
        const c = boxOf(it.p, it.f);
        g.beginPath(); c.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.closePath(); g.stroke();
    }
    g.setLineDash([]);
    if (!ph) return;
    g.lineWidth = (rotOn ? 1.5 : 1) * px;
    g.beginPath(); g.moveTo(ph.top.x, ph.top.y); g.lineTo(ph.x, ph.y); g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(ph.x, ph.y, (rotOn ? 4 : 3) * px, 0, Math.PI * 2); g.fill();
}
