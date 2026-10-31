// 畫布上拖部件／支點十字用的共用幾何（試穿、部位分頁的預覽）：座標都是 shape 本地（面向右、相對 view 中心），p 是已加回支點的部件
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

// 繞 o 從 a0（弧度）轉到 l 的角度差（度，[-180, 180)）
export function turnDeg(o, a0, l)
{
    const d = (Math.atan2(l.y - o.y, l.x - o.x) - a0) * 180 / Math.PI;
    return d - Math.floor((d + 180) / 360) * 360;
}
