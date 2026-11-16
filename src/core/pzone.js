//--------------------------------------------------
// 粒子的 emitZone／deathZone 幾何（純函式）：粒子分頁的表單／預覽、場景分頁 sandbox 拖 zone 共用
// source 寫 {x,y,w,h}｜{x,y,r}｜{x1,y1,x2,y2}（判斷順序同 particle.js 的 geom()）；deathZone 要 source.contains()，Phaser 的 Line 沒有
//--------------------------------------------------
export const ZONES = {
    emitZone:  {types:['random', 'edge'], shapes:['rect', 'circle', 'line']},
    deathZone: {types:['onEnter', 'onLeave'], shapes:['rect', 'circle']},
};
export const SHAPES = {rect:'矩形', circle:'圓', line:'線段'};
export const SHAPE_KEYS = {rect:['x', 'y', 'w', 'h'], circle:['x', 'y', 'r'], line:['x1', 'y1', 'x2', 'y2']};
export const optKey = (shape, c) => shape!=='line' && (c==='x' || c==='y');
const EDGE_KEYS = ['quantity', 'yoyo', 'seamless', 'stepRate'];
const obj = (v) => !!v && typeof v==='object' && !Array.isArray(v);

export const shapeOf = (s) => !obj(s) ? null : 'r' in s ? 'circle' : 'x1' in s ? 'line' : 'w' in s ? 'rect' : null;

// 表單／拖曳能接手的寫法：單一 zone、認得的形狀、數字齊全；其他（陣列、polygon…）退回 JSON 框
export function zoneEditable(k, z)
{
    const shape = obj(z) && shapeOf(z.source);
    return !!shape && ZONES[k].shapes.includes(shape)
        && SHAPE_KEYS[shape].every(c=>typeof z.source[c]==='number' || (optKey(shape, c) && z.source[c]===undefined));
}

// 矩形沒寫 x／y＝以發射點為中心
export const rectOf = (s) => ({x:s.x ?? -s.w/2, y:s.y ?? -s.h/2, w:s.w, h:s.h});

const box = (shape, s) => {
    if(shape==='rect') {const r = rectOf(s); return {cx:r.x + r.w/2, cy:r.y + r.h/2, hx:r.w/2, hy:r.h/2};}
    if(shape==='circle') {return {cx:s.x ?? 0, cy:s.y ?? 0, hx:s.r, hy:s.r};}
    return {cx:(s.x1 + s.x2)/2, cy:(s.y1 + s.y2)/2, hx:Math.abs(s.x2 - s.x1)/2, hy:Math.abs(s.y2 - s.y1)/2};
};
const strip = (s) => Object.fromEntries(Object.entries(s).filter(([c])=>!['x', 'y', 'w', 'h', 'r', 'x1', 'y1', 'x2', 'y2'].includes(c)));

// 換形狀：保留中心跟大概的大小
export function convertShape(s, to)
{
    const from = shapeOf(s);
    if(from===to) {return s;}
    const {cx, cy, hx, hy} = box(from, s), R = Math.round;
    if(to==='rect') {const w = Math.max(1, R(hx*2)), h = Math.max(1, R(hy*2)); return {x:R(cx - w/2), y:R(cy - h/2), w, h, ...strip(s)};}
    if(to==='circle') {return {x:R(cx), y:R(cy), r:Math.max(1, R(Math.min(hx, hy) || Math.max(hx, hy))), ...strip(s)};}
    const hw = Math.max(1, R(hx || hy));
    return {x1:R(cx - hw), y1:R(cy), x2:R(cx + hw), y2:R(cy), ...strip(s)};
}

// 換 type：改成 edge 沒有 quantity／stepRate 就補 quantity；離開 edge 拿掉 edge 才看的 key
export function setZoneType(z, t)
{
    const o = {...z, type:t};
    if(t==='edge' && o.quantity===undefined && o.stepRate===undefined) {o.quantity = 12;}
    if(t!=='edge' && z.type==='edge') {for(const c of EDGE_KEYS) {delete o[c];}}
    return o;
}

// 把手（zone 自己的座標）
export function handlesOf(shape, s)
{
    if(shape==='circle') {return [{id:'r', x:(s.x ?? 0) + s.r, y:s.y ?? 0}];}
    if(shape==='line') {return [{id:'p1', x:s.x1, y:s.y1}, {id:'p2', x:s.x2, y:s.y2}];}
    const {x, y, w, h} = rectOf(s), mx = x + w/2, my = y + h/2;
    return [{id:'nw', x, y}, {id:'n', x:mx, y}, {id:'ne', x:x + w, y}, {id:'e', x:x + w, y:my},
        {id:'se', x:x + w, y:y + h}, {id:'s', x:mx, y:y + h}, {id:'sw', x, y:y + h}, {id:'w', x, y:my}];
}

export function hitZone(shape, s, px, py, tol)
{
    if(shape==='rect') {const {x, y, w, h} = rectOf(s); return px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;}
    if(shape==='circle') {return Math.hypot(px - (s.x ?? 0), py - (s.y ?? 0)) <= s.r + tol;}
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = dx*dx + dy*dy;
    const t = L ? Math.max(0, Math.min(1, ((px - s.x1)*dx + (py - s.y1)*dy)/L)) : 0;
    return Math.hypot(px - (s.x1 + t*dx), py - (s.y1 + t*dy)) <= tol;
}

export const zoneArea = (shape, s) => shape==='rect' ? s.w*s.h : shape==='circle' ? Math.PI*s.r*s.r : 0;

// 拖曳：p0＝按下時、p＝現在的游標（zone 座標），step＝吸附格子；part＝'move' 或把手 id；回傳新的 source（其他 key 保留）
export function dragZone(shape, s, part, p0, p, step=1)
{
    const snap = (v) => Math.round(v/step)*step, dx = p.x - p0.x, dy = p.y - p0.y;
    if(shape==='circle')
    {
        const cx = s.x ?? 0, cy = s.y ?? 0;
        if(part==='r') {return {...s, x:cx, y:cy, r:Math.max(1, snap(Math.hypot(p.x - cx, p.y - cy)))};}
        return {...s, x:snap(cx + dx), y:snap(cy + dy)};
    }
    if(shape==='line')
    {
        if(part==='p1') {return {...s, x1:snap(s.x1 + dx), y1:snap(s.y1 + dy)};}
        if(part==='p2') {return {...s, x2:snap(s.x2 + dx), y2:snap(s.y2 + dy)};}
        const mx = snap(s.x1 + dx) - s.x1, my = snap(s.y1 + dy) - s.y1;
        return {...s, x1:s.x1 + mx, y1:s.y1 + my, x2:s.x2 + mx, y2:s.y2 + my};
    }
    const r = rectOf(s);
    let [l, t, rr, b] = [r.x, r.y, r.x + r.w, r.y + r.h];
    if(part==='move') {const nl = snap(l + dx), nt = snap(t + dy); [l, t, rr, b] = [nl, nt, nl + r.w, nt + r.h];}
    else
    {
        if(part.includes('w')) {l = Math.min(snap(l + dx), rr - 1);}
        if(part.includes('e')) {rr = Math.max(snap(rr + dx), l + 1);}
        if(part.includes('n')) {t = Math.min(snap(t + dy), b - 1);}
        if(part.includes('s')) {b = Math.max(snap(b + dy), t + 1);}
    }
    return {x:l, y:t, w:rr - l, h:b - t, ...strip(s)};
}

// 游標樣式（把手 id → cursor）
export const ZONE_CURSOR = {move:'move', r:'ew-resize', p1:'crosshair', p2:'crosshair', n:'ns-resize', s:'ns-resize', e:'ew-resize', w:'ew-resize', nw:'nwse-resize', se:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize'};
