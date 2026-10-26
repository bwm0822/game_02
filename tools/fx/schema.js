// fx.json = {效果 id: {img, cell, spawn, idle, tick, end, body}}；id 就是 ability／item effects 的 id（遊戲 DB.fx(id)，查不到就不顯示）
// 播放邏輯：src/core/fxcell.js（FxCell）、src/components/com_disp.js（_fxOn/_fxTick/_fxFlash/_bodyTween）

export const CELL = {
    size:  {type: 'num', label: '大小', hint: 'px，沒填是 30'},
    scale: {type: 'range', label: '縮放', hint: '數字，或 min, max 每次隨機'},
    alpha: {type: 'num', label: '透明度'},
    align: {type: 'enum', label: '基準', options: ['', 'top', 'center', 'bottom'], names: {'': '（腳底）', top: '頭頂', center: '中間', bottom: '腳底'}},
    ox:    {type: 'num', label: '偏移 x'},
    oy:    {type: 'num', label: '偏移 y'},
    flash: {type: 'bool', label: '閃一下', hint: '不常駐，只在 tick（DOT/HOT 扣血）時播 spawn→tick→end'},
    flipX: {type: 'flip', label: '翻面'},
};

export const STAGES = [
    {k: 'spawn', label: '出現', hint: '效果上身時播一次'},
    {k: 'idle', label: '待機', hint: '出現後一直循環（randDelay：隨機延遲上限，錯開多個特效）'},
    {k: 'tick', label: '跳一下', hint: '每回合 DOT/HOT 扣血、控制效果刷新時'},
    {k: 'end', label: '消失', hint: '效果結束時'},
    {k: 'body', label: '身體', hint: '套在角色身上（view.shape），只支援 angle，以腳底為支點轉'},
];

export const TOP = new Set(['img', 'cell', ...STAGES.map(s => s.k)]);

export const TABS = [{label: '全部', cols: ['img', 'cell.size', 'cell.align', 'cell.flash', '#stages', '#refs']}];

export const template = () => ({
    img: '✨',
    cell: {size: 20, align: 'center'},
    spawn: {scale: {from: 0, to: 1}, duration: 200, ease: 'Back.Out'},
    idle: {scale: {from: 0.9, to: 1.1}, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.InOut', randDelay: 400},
    tick: {scale: {from: 1, to: 1.4}, duration: 150, yoyo: true, ease: 'Quad.Out'},
    end: {alpha: 0, scale: 0.3, duration: 300, ease: 'Quad.In'},
});
