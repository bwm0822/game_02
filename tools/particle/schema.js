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

// Phaser 的欄位 → 種類／新增時的預設值；group 決定放在哪個框
//   val：數字、{min,max}、{start,end,ease}、[a,b,...]（隨機挑）
//   color：'#hex' 或 {start,end}；colors：['#hex', ...] 依壽命漸變；blend：混合模式；json：直接改 JSON
export const PROPS = {
    frequency:    {group: 'emit', kind: 'num', def: 100, hint: 'ms 噴一次'},
    quantity:     {group: 'emit', kind: 'val', def: 1, hint: '每次噴幾顆'},
    lifespan:     {group: 'emit', kind: 'val', def: 1000, hint: 'ms，沒填 1000'},
    maxParticles: {group: 'emit', kind: 'num', def: 100},
    speed:        {group: 'move', kind: 'val', def: {min: 20, max: 60}},
    speedX:       {group: 'move', kind: 'val', def: 0},
    speedY:       {group: 'move', kind: 'val', def: 0},
    angle:        {group: 'move', kind: 'val', def: {min: 0, max: 360}, hint: '方向，0＝右、90＝下'},
    gravityX:     {group: 'move', kind: 'num', def: 0},
    gravityY:     {group: 'move', kind: 'num', def: 0},
    accelerationX:{group: 'move', kind: 'val', def: 0},
    accelerationY:{group: 'move', kind: 'val', def: 0},
    maxVelocityX: {group: 'move', kind: 'val', def: 100},
    maxVelocityY: {group: 'move', kind: 'val', def: 100},
    moveToX:      {group: 'move', kind: 'val', def: 0, hint: '飛向這點（相對發射點）'},
    moveToY:      {group: 'move', kind: 'val', def: 0},
    radial:       {group: 'move', kind: 'bool', def: false},
    scale:        {group: 'look', kind: 'val', def: {start: 1, end: 0}},
    scaleX:       {group: 'look', kind: 'val', def: 1},
    scaleY:       {group: 'look', kind: 'val', def: 1},
    alpha:        {group: 'look', kind: 'val', def: {start: 1, end: 0}},
    rotate:       {group: 'look', kind: 'val', def: 0, hint: '粒子自己轉的角度'},
    tint:         {group: 'look', kind: 'color', def: '#ffffff', hint: 'emoji 不吃'},
    color:        {group: 'look', kind: 'colors', def: ['#ffffff', '#ff0000'], hint: '依壽命漸變，emoji 不吃'},
    blendMode:    {group: 'look', kind: 'blend', def: 'ADD'},
    emitZone:     {group: 'zone', kind: 'json', def: {type: 'random', source: {w: 32, h: 8}}, hint: 'source：{x,y,w,h}｜{x,y,r}｜{x1,y1,x2,y2}；type：random／edge（edge 要 quantity）'},
    deathZone:    {group: 'zone', kind: 'json', def: {type: 'onLeave', source: {w: 64, h: 64}}},
};

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
