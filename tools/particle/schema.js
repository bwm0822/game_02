// particle.json = {id: Phaser ParticleEmitter config＋自己的欄位}，播放是 src/core/particle.js（playParticle），遊戲 DB.particle(id)
// 引用：ability.json 技能的 cast／travel／fx.particle、fx.json 的 particle／tickParticle（地圖的 Tiled 屬性之後再收）

// 自己的欄位（不傳給 Phaser）
export const OWN = {
    img:      {type: 'pimg', label: '圖', hint: 'p- 內建形狀／textures 的圖／emoji'},
    mode:     {type: 'enum', label: '模式', options: ['', 'burst'], names: {'': '持續噴', burst: '一次噴'}},
    count:    {type: 'int', label: '顆數', hint: '一次噴幾顆，沒填 10', mode: 'burst'},
    duration: {type: 'num', label: '噴多久', hint: 'ms；沒填＝噴到使用端叫停（使用端也能傳）', mode: 'stream'},
    local:    {type: 'bool', label: '跟著走', hint: '勾＝整團粒子黏在物件上；不勾＝噴出去的留在原地（拖尾）'},
    depth:    {type: 'enum', label: '深度', options: ['', 'under'], names: {'': '最上層', under: '目標底下'}},
    x:        {type: 'num', label: '偏移 x'},
    y:        {type: 'num', label: '偏移 y'},
};

// Phaser 的欄位 → 種類／新增時的預設值／數字欄 ↑↓ 的步進；group 決定放在哪個框
//   val：數字、{min,max}、{start,end,ease}、[a,b,...]（隨機挑）
//   color：'#hex' 或 {start,end}；colors：['#hex', ...] 依壽命漸變；blend：混合模式；json：直接改 JSON
export const PROPS = {
    frequency:    {group: 'emit', kind: 'num', def: 100, step: 10, hint: 'ms 噴一次'},
    quantity:     {group: 'emit', kind: 'val', def: 1, step: 1, hint: '每次噴幾顆'},
    lifespan:     {group: 'emit', kind: 'val', def: 1000, step: 50, hint: 'ms，沒填 1000'},
    maxParticles: {group: 'emit', kind: 'num', def: 100, step: 10},
    speed:        {group: 'move', kind: 'val', def: {min: 20, max: 60}, step: 5},
    speedX:       {group: 'move', kind: 'val', def: 0, step: 5},
    speedY:       {group: 'move', kind: 'val', def: 0, step: 5},
    angle:        {group: 'move', kind: 'val', def: {min: 0, max: 360}, step: 5, hint: '方向，0＝右、90＝下'},
    gravityX:     {group: 'move', kind: 'num', def: 0, step: 10},
    gravityY:     {group: 'move', kind: 'num', def: 0, step: 10},
    accelerationX:{group: 'move', kind: 'val', def: 0, step: 10},
    accelerationY:{group: 'move', kind: 'val', def: 0, step: 10},
    maxVelocityX: {group: 'move', kind: 'val', def: 100, step: 10},
    maxVelocityY: {group: 'move', kind: 'val', def: 100, step: 10},
    moveToX:      {group: 'move', kind: 'val', def: 0, step: 1, hint: '飛向這點（相對發射點）'},
    moveToY:      {group: 'move', kind: 'val', def: 0, step: 1},
    radial:       {group: 'move', kind: 'bool', def: false},
    scale:        {group: 'look', kind: 'val', def: {start: 1, end: 0}, step: 0.05},
    scaleX:       {group: 'look', kind: 'val', def: 1, step: 0.05},
    scaleY:       {group: 'look', kind: 'val', def: 1, step: 0.05},
    alpha:        {group: 'look', kind: 'val', def: {start: 1, end: 0}, step: 0.05},
    rotate:       {group: 'look', kind: 'val', def: 0, step: 5, hint: '粒子自己轉的角度'},
    tint:         {group: 'look', kind: 'color', def: '#ffffff', hint: 'emoji 不吃'},
    color:        {group: 'look', kind: 'colors', def: ['#ffffff', '#ff0000'], hint: '依壽命漸變，emoji 不吃'},
    blendMode:    {group: 'look', kind: 'blend', def: 'ADD'},
    emitZone:     {group: 'zone', kind: 'zone', def: {type: 'random', source: {w: 32, h: 8}}, hint: '相對發射點；random＝範圍內隨機、edge＝沿邊緣（quantity 切幾點）'},
    deathZone:    {group: 'zone', kind: 'zone', def: {type: 'onLeave', source: {w: 64, h: 64}}, hint: '相對發射點；onEnter＝進去就消失、onLeave＝出去就消失'},
};

// ---------- zone：source 寫 {x,y,w,h}｜{x,y,r}｜{x1,y1,x2,y2}（判斷順序同 src/core/particle.js 的 geom()）----------
// deathZone 要 source.contains()，Phaser 的 Line 沒有
export const ZONES = {
    emitZone:  {types: ['random', 'edge'], shapes: ['rect', 'circle', 'line']},
    deathZone: {types: ['onEnter', 'onLeave'], shapes: ['rect', 'circle']},
};
export const SHAPES = {rect: '矩形', circle: '圓', line: '線段'};
export const SHAPE_KEYS = {rect: ['x', 'y', 'w', 'h'], circle: ['x', 'y', 'r'], line: ['x1', 'y1', 'x2', 'y2']};
export const optKey = (shape, c) => shape !== 'line' && (c === 'x' || c === 'y');
const EDGE_KEYS = ['quantity', 'yoyo', 'seamless', 'stepRate'];
const obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export const shapeOf = (s) => !obj(s) ? null : 'r' in s ? 'circle' : 'x1' in s ? 'line' : 'w' in s ? 'rect' : null;

// 表單／預覽拖曳能接手的寫法：單一 zone、認得的形狀、數字齊全；其他（陣列、polygon…）退回 JSON 框
export function zoneEditable(k, z)
{
    const shape = obj(z) && shapeOf(z.source);
    return !!shape && ZONES[k].shapes.includes(shape)
        && SHAPE_KEYS[shape].every(c => typeof z.source[c] === 'number' || (optKey(shape, c) && z.source[c] === undefined));
}

// 矩形沒寫 x／y＝以發射點為中心
export const rectOf = (s) => ({x: s.x ?? -s.w / 2, y: s.y ?? -s.h / 2, w: s.w, h: s.h});

const box = (shape, s) => {
    if (shape === 'rect') {const r = rectOf(s); return {cx: r.x + r.w / 2, cy: r.y + r.h / 2, hx: r.w / 2, hy: r.h / 2};}
    if (shape === 'circle') return {cx: s.x ?? 0, cy: s.y ?? 0, hx: s.r, hy: s.r};
    return {cx: (s.x1 + s.x2) / 2, cy: (s.y1 + s.y2) / 2, hx: Math.abs(s.x2 - s.x1) / 2, hy: Math.abs(s.y2 - s.y1) / 2};
};
const strip = (s) => Object.fromEntries(Object.entries(s).filter(([c]) => !['x', 'y', 'w', 'h', 'r', 'x1', 'y1', 'x2', 'y2'].includes(c)));

// 換形狀：保留中心跟大概的大小
export function convertShape(s, to)
{
    const from = shapeOf(s);
    if (from === to) return s;
    const {cx, cy, hx, hy} = box(from, s), R = Math.round;
    if (to === 'rect') {const w = Math.max(1, R(hx * 2)), h = Math.max(1, R(hy * 2)); return {x: R(cx - w / 2), y: R(cy - h / 2), w, h, ...strip(s)};}
    if (to === 'circle') return {x: R(cx), y: R(cy), r: Math.max(1, R(Math.min(hx, hy) || Math.max(hx, hy))), ...strip(s)};
    const hw = Math.max(1, R(hx || hy));
    return {x1: R(cx - hw), y1: R(cy), x2: R(cx + hw), y2: R(cy), ...strip(s)};
}

// 換 type：改成 edge 沒有 quantity／stepRate 就補 quantity；離開 edge 拿掉 edge 才看的 key
export function setZoneType(z, t)
{
    const o = {...z, type: t};
    if (t === 'edge' && o.quantity === undefined && o.stepRate === undefined) o.quantity = 12;
    if (t !== 'edge' && z.type === 'edge') for (const c of EDGE_KEYS) delete o[c];
    return o;
}

// 預覽的把手（zone 自己的座標）
export function handlesOf(shape, s)
{
    if (shape === 'circle') return [{id: 'r', x: (s.x ?? 0) + s.r, y: s.y ?? 0}];
    if (shape === 'line') return [{id: 'p1', x: s.x1, y: s.y1}, {id: 'p2', x: s.x2, y: s.y2}];
    const {x, y, w, h} = rectOf(s), mx = x + w / 2, my = y + h / 2;
    return [{id: 'nw', x, y}, {id: 'n', x: mx, y}, {id: 'ne', x: x + w, y}, {id: 'e', x: x + w, y: my},
        {id: 'se', x: x + w, y: y + h}, {id: 's', x: mx, y: y + h}, {id: 'sw', x, y: y + h}, {id: 'w', x, y: my}];
}

export function hitZone(shape, s, px, py, tol)
{
    if (shape === 'rect') {const {x, y, w, h} = rectOf(s); return px >= x - tol && px <= x + w + tol && py >= y - tol && py <= y + h + tol;}
    if (shape === 'circle') return Math.hypot(px - (s.x ?? 0), py - (s.y ?? 0)) <= s.r + tol;
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1, L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / L)) : 0;
    return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy)) <= tol;
}

export const zoneArea = (shape, s) => shape === 'rect' ? s.w * s.h : shape === 'circle' ? Math.PI * s.r * s.r : 0;

// 拖曳：p0＝按下時、p＝現在的游標（zone 座標），step＝吸附格子；part＝'move' 或把手 id；回傳新的 source（其他 key 保留）
export function dragZone(shape, s, part, p0, p, step = 1)
{
    const snap = (v) => Math.round(v / step) * step, dx = p.x - p0.x, dy = p.y - p0.y;
    if (shape === 'circle')
    {
        const cx = s.x ?? 0, cy = s.y ?? 0;
        if (part === 'r') return {...s, x: cx, y: cy, r: Math.max(1, snap(Math.hypot(p.x - cx, p.y - cy)))};
        return {...s, x: snap(cx + dx), y: snap(cy + dy)};
    }
    if (shape === 'line')
    {
        if (part === 'p1') return {...s, x1: snap(s.x1 + dx), y1: snap(s.y1 + dy)};
        if (part === 'p2') return {...s, x2: snap(s.x2 + dx), y2: snap(s.y2 + dy)};
        const mx = snap(s.x1 + dx) - s.x1, my = snap(s.y1 + dy) - s.y1;
        return {...s, x1: s.x1 + mx, y1: s.y1 + my, x2: s.x2 + mx, y2: s.y2 + my};
    }
    const r = rectOf(s);
    let [l, t, rr, b] = [r.x, r.y, r.x + r.w, r.y + r.h];
    if (part === 'move') {const nl = snap(l + dx), nt = snap(t + dy); [l, t, rr, b] = [nl, nt, nl + r.w, nt + r.h];}
    else
    {
        if (part.includes('w')) l = Math.min(snap(l + dx), rr - 1);
        if (part.includes('e')) rr = Math.max(snap(rr + dx), l + 1);
        if (part.includes('n')) t = Math.min(snap(t + dy), b - 1);
        if (part.includes('s')) b = Math.max(snap(b + dy), t + 1);
    }
    return {x: l, y: t, w: rr - l, h: b - t, ...strip(s)};
}

export const GROUPS = [
    {k: 'emit', label: '發射'},
    {k: 'move', label: '運動'},
    {k: 'look', label: '外觀'},
    {k: 'zone', label: '範圍'},
];

export const BLENDS = ['NORMAL', 'ADD', 'MULTIPLY', 'SCREEN'];
export const EASE_HINT = 'start→end 漸變的曲線';

export const isKnown = (k) => k in OWN || k in PROPS;

// val 欄位的寫法：num 數字、range {min,max}、se {start,end,ease?}、pick [a,b]、raw 其他
export function valMode(v)
{
    if (typeof v === 'number') return 'num';
    if (Array.isArray(v) && v.every(n => typeof n === 'number')) return 'pick';
    if (v && typeof v === 'object' && !Array.isArray(v))
    {
        const ks = Object.keys(v);
        if (ks.length === 2 && 'min' in v && 'max' in v) return 'range';
        if ('start' in v && 'end' in v && ks.every(k => ['start', 'end', 'ease'].includes(k))) return 'se';
    }
    return 'raw';
}

// 換寫法：盡量保留數字
export function convertVal(v, mode)
{
    const m = valMode(v);
    const n = m === 'num' ? v : m === 'range' ? v.min : m === 'se' ? v.start : m === 'pick' ? v[0] ?? 0 : 0;
    const n2 = m === 'range' ? v.max : m === 'se' ? v.end : m === 'pick' ? v.at(-1) ?? n : n;
    return {num: n, range: {min: n, max: n2}, se: {start: n, end: n2}, pick: [n, n2]}[mode];
}

export const template = () => ({
    img: 'p-soft',
    speed: {min: 20, max: 60},
    lifespan: 600,
    scale: {start: 0.5, end: 0},
    alpha: {start: 1, end: 0},
    frequency: 80,
});

export const TABS = [{label: '全部', cols: ['img', 'mode', '#amount', 'lifespan', 'blendMode', '#refs']}];
