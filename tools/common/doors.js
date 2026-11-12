// 地圖上的門（type:"port"＋map 屬性）：找出來、畫橘框 🚪（壞的紅／黃）、點門進去後鏡頭移到落腳點閃一下
// 地圖分頁跟角色分頁的作息地圖共用；壞門的判斷在 src/data/mapcheck.js
import {isPortObj, portIssue} from '../../src/data/mapcheck.js';
import * as PZ from './panzoom.js';

export const DOOR = {ok: {fill: 'rgba(255,152,0,0.22)', line: '#ff9800'}, warn: {fill: 'rgba(240,180,0,0.25)', line: '#f0b400'}, error: {fill: 'rgba(229,57,53,0.3)', line: '#e53935'}};

// d＝mapview.js 的 mapData()；namesOf(地圖)＝那張圖的物件名稱 Set（不存在＝null）→ [{o, rect, issue}]
export function portsOf(d, namesOf)
{
    return d.objs.filter(isPortObj).map(o => {
        const w = o.width || d.map.tilewidth, hh = o.height || d.map.tileheight;
        return {o, rect: {x: o.x, y: o.gid ? o.y - hh : o.y, w, h: hh}, issue: portIssue(o, namesOf)};
    });
}

export const doorAt = (ports, p) => (ports ?? []).find(d => p.x >= d.rect.x && p.x <= d.rect.x + d.rect.w && p.y >= d.rect.y && p.y <= d.rect.y + d.rect.h) ?? null;

// 門的目的地 {map, port}
export const targetOf = (door) => ({map: String(door.o.props.map), port: String(door.o.props.port ?? '')});

// 滑過的那扇實線、其他虛線
export function drawDoors(g, ports, K, hover)
{
    g.font = `${14 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const p of ports ?? [])
    {
        const {x, y, w, h: hh} = p.rect, on = hover === p, c = DOOR[p.issue?.level ?? 'ok'];
        g.fillStyle = c.fill;
        g.fillRect(x, y, w, hh);
        g.setLineDash(on ? [] : [4 / K, 3 / K]);
        g.strokeStyle = c.line;
        g.lineWidth = (on ? 2.5 : 1.5) / K;
        g.strokeRect(x, y, w, hh);
        g.setLineDash([]);
        g.fillText(p.issue ? '⚠' : '🚪', x + w / 2, y + hh / 2);
    }
    g.textBaseline = 'alphabetic';
}

// 點門進來：倍率不動，落腳點放到畫布正中央、閃一下（st.flash，畫圖時呼叫 drawFlash）；找不到回 false
export const FLASH_MS = 1200;
export function landAt(st, view, port)
{
    const n = st.data.named.get(port);
    if (!n) return false;
    view.ox = -(n.cen.x - st.data.W / 2) * view.zoom;
    view.oy = -(n.cen.y - st.data.H / 2) * view.zoom;
    PZ.setZoom(view.zoom, 0, 0, view);
    const t0 = performance.now();
    st.flash = {rect: n.rect, t0};
    const tick = () => {
        if (st.flash?.t0 !== t0) return;
        if (performance.now() - t0 >= FLASH_MS) st.flash = null;
        st.redraw();
        if (st.flash) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
}

export function drawFlash(g, st, K)
{
    if (!st.flash || Math.floor((performance.now() - st.flash.t0) / 200) % 2 !== 0) return;
    const {x, y, w, h: hh} = st.flash.rect, m = 4 / K;
    g.strokeStyle = '#fff176';
    g.lineWidth = 3 / K;
    g.strokeRect(x - m, y - m, w + m * 2, hh + m * 2);
}
