// fx.json = {id: {img, cell, spawn, idle, tick, end, body}}，遊戲 DB.fx(id)，查不到就不顯示；兩種：
//   效果特效：id 就是 ability／item effects 的 id，掛在角色身上（src/components/com_disp.js 的 _fxOn/_fxTick/_fxFlash）
//   區域特效：技能的 zoneFx 指的 id，每格一個（src/components/view.js 的 ZoneView，HazardZone 用）
// 單格動畫：src/core/fxcell.js（FxCell、attachCell、bodyTween、zoneDelays）

export const CELL = {
    size:  {type: 'num', label: '大小', hint: 'px，沒填是 30'},
    scale: {type: 'range', label: '縮放', hint: '數字，或 min, max 每次隨機'},
    alpha: {type: 'num', label: '透明度'},
    align: {type: 'enum', label: '基準', options: ['', 'top', 'center', 'bottom'], names: {'': '（腳底）', top: '頭頂', center: '中間', bottom: '腳底'}},
    ox:    {type: 'num', label: '偏移 x'},
    oy:    {type: 'num', label: '偏移 y'},
    flash: {type: 'bool', label: '閃一下', hint: '不常駐，只在 tick（DOT/HOT 扣血）時播 spawn→tick→end', zone: false},
    flipX: {type: 'flip', label: '翻面'},
    jitter: {type: 'num', label: '抖動', hint: '每格隨機偏移 ±px', zone: true},
};
// zone: true 只給區域特效（技能 zoneFx 引用的），false 只給效果特效，沒寫兩種都有
export const forKind = (def, zone) => def.zone === undefined || def.zone === zone;

export const STAGES = [
    {k: 'spawn', label: '出現', hint: '效果上身時播一次'},
    {k: 'idle', label: '待機', hint: '出現後一直循環（randDelay：隨機延遲上限，錯開多個特效）'},
    {k: 'tick', label: '跳一下', hint: '每回合 DOT/HOT 扣血、控制效果刷新時'},
    {k: 'end', label: '消失', hint: '效果結束時'},
    {k: 'body', label: '身體', hint: '套在角色身上（view.shape），只支援 angle，以腳底為支點轉', zone: false},
];

// tween 的時間參數；屬性（PROPS）以外、這裡也沒有的 key 放「其他」JSON
export const TIME = {
    duration:  {type: 'num', label: '時長', hint: 'ms'},
    ease:      {type: 'ease', label: '曲線'},
    delay:     {type: 'num', label: '延遲'},
    yoyo:      {type: 'bool', label: '來回'},
    repeat:    {type: 'num', label: '重複', hint: '-1 無限'},
    randDelay: {type: 'num', label: '隨機延遲', only: ['idle']},
    stagger:   {type: 'num', label: '逐格間隔', hint: 'ms', only: ['spawn'], zone: true},
    from:      {type: 'enum', label: '從哪開始', only: ['spawn'], zone: true, options: ['', 'center', 'near', 'random'],
                names: {'': '（中心）', center: '中心往外', near: '離施法者近的', random: '隨機'}},
};
export const timeKeys = (stage, zone) => Object.keys(TIME).filter(k => (!TIME[k].only || TIME[k].only.includes(stage)) && forKind(TIME[k], zone));

// 屬性 → 新增時的預設值；值的寫法：數字、相對字串 "+=4"／"-=4"、{from, to}
export const PROPS = {scale: 1, scaleX: 1, scaleY: 1, alpha: 1, x: '+=0', y: '+=0', angle: 0};
export const propsOf = (stage) => stage === 'body' ? ['angle'] : Object.keys(PROPS);

export const EASES = ['Linear', 'Stepped', 'Power0', 'Power1', 'Power2', 'Power3', 'Power4',
    ...['Quad', 'Cubic', 'Quart', 'Quint', 'Sine', 'Expo', 'Circ', 'Back', 'Elastic', 'Bounce'].flatMap(n => [`${n}.In`, `${n}.Out`, `${n}.InOut`])];

// 值的寫法：num 數字、rel 相對字串、ft {from, to}、raw 其他（JSON 直接改）
export function valMode(v)
{
    if (typeof v === 'number') return 'num';
    if (typeof v === 'string' && /^[+-]=-?[\d.]+$/.test(v)) return 'rel';
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k => k === 'from' || k === 'to') && 'to' in v) return 'ft';
    return 'raw';
}

export const TOP = new Set(['img', 'cell', ...STAGES.map(s => s.k)]);

export const TABS = [{label: '全部', cols: ['img', '#kind', 'cell.size', 'cell.align', 'cell.flash', '#stages', '#refs']}];

export const template = () => ({
    img: '✨',
    cell: {size: 20, align: 'center'},
    spawn: {scale: {from: 0, to: 1}, duration: 200, ease: 'Back.Out'},
    idle: {scale: {from: 0.9, to: 1.1}, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.InOut', randDelay: 400},
    tick: {scale: {from: 1, to: 1.4}, duration: 150, yoyo: true, ease: 'Quad.Out'},
    end: {alpha: 0, scale: 0.3, duration: 300, ease: 'Quad.In'},
});
