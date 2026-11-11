// 作息 24 小時橫條：buildPlan() 的時刻表 → 一列分段（之後全 NPC 總覽疊很多列也用這支）
import {h} from '../common/dom.js';
import {DAY, mod, hhmm} from '../../src/data/schedplan.js';

const PALETTE = ['#3f7fbf', '#4f9a4a', '#b5793a', '#8a5bb0', '#3a9a94', '#b0544f', '#9a9a3a', '#5b6fc4', '#b05b8f', '#6b8a3a'];

// 同一張地圖（跨角色）同一個顏色
export function mapColor(map)
{
    let x = 0;
    for (const c of map ?? '') x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[x % PALETTE.length];
}

const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} 時${m % 60 ? ` ${m % 60} 分` : ''}` : `${m} 分`);

// 分段：{kind:'stay'|'walk'|'late'|'nope', i, s, len}（s＝開始分鐘，len 可能跨午夜）；plan＝null 回傳 null
export function daySegs(plan, sch, warns = [])
{
    if (!plan?.length) return null;
    const n = plan.length, segs = [];
    const lateOf = (i) => warns.find(w => w.i === i && w.kind === 'late')?.late ?? 0;
    plan.forEach((p, i) => {
        if (!p.path) segs.push({kind: 'nope', i, s: p.dep, len: 0});
        else if (p.cost > 0) segs.push({kind: 'walk', i, s: p.dep, len: p.cost});
        const late = lateOf(i);
        if (n > 1 && late > 0) segs.push({kind: 'late', i, s: p.dep, len: late});
        const next = plan[(i + 1) % n];
        const len = n > 1 && lateOf((i + 1) % n) > 0 ? 0 : mod(next.dep - p.arr) || (n === 1 ? DAY - p.cost : 0);
        if (len > 0) segs.push({kind: 'stay', i, s: p.arr, len, map: sch[i]?.map, go: sch[i]?.go, do: sch[i]?.do});
    });
    return segs;
}

// 某時刻在哪：{kind:'stay', i, map, go} 或 {kind:'walk', i, map, go}（走去第 i 筆）；沒有時刻表＝null
export function whereAt(plan, sch, t, segs = daySegs(plan, sch))
{
    if (!segs) return null;
    const hit = (k) => segs.find(g => g.kind === k && mod(t - g.s) < g.len);
    const g = hit('walk') ?? hit('stay');
    return g && {kind: g.kind, i: g.i, map: sch[g.i]?.map, go: sch[g.i]?.go};
}

// 跨午夜切成兩截
const pieces = (s, len) => (s + len <= DAY ? [[s, len]] : [[s, DAY - s], [0, s + len - DAY]]);

function tip(g, plan)
{
    const p = plan[g.i], e = mod(g.s + g.len), no = g.i + 1;
    if (g.kind === 'stay') return `${no}. ${g.go ?? '?'}（${g.map ?? '?'}）${g.do ? ` ${g.do}` : ''}\n${hhmm(g.s)}～${hhmm(e)}，停 ${dur(g.len)}`;
    if (g.kind === 'walk') return `${no}. 走去 ${g.go ?? p.key}\n出發 ${hhmm(p.dep)} → 抵達 ${hhmm(p.arr)}，走 ${dur(p.cost)}`;
    if (g.kind === 'late') return `⚠ ${no}. 排不下：晚 ${g.len} 分\n${hhmm(p.dep)} 要出發，上一筆 ${hhmm(e)} 才到`;
    return `⚠ ${no}. 從 ${p.from} 走不到 ${p.key}（${hhmm(p.dep)}）`;
}

// opt.sel＝選中第幾筆（-1＝沒有）、opt.onPick(i)＝點了某段、opt.bare＝不畫刻度跟圖例（總覽每列）
export function dayBarEl(plan, sch, warns, opt = {})
{
    const segs = opt.segs ?? daySegs(plan, sch, warns);
    if (!segs) return h('div', {class: 'daybar none dim'}, '作息資料有問題，無法排時刻表');
    const pct = (m) => `${(m / DAY) * 100}%`;
    const bar = h('div', {class: 'track'},
        Array.from({length: 23}, (_, k) => h('i', {class: 'hr' + ((k + 1) % 6 ? '' : ' six'), style: `left:${pct((k + 1) * 60)}`})),
        segs.flatMap(g => pieces(g.s, g.len).map(([s, len]) => {
            const label = g.kind === 'stay' ? `${g.i + 1}${g.do === 'patrol' ? '↻' : ''}` : g.kind === 'nope' ? '⚠' : '';
            const style = `left:${pct(s)};` + (g.kind === 'nope' ? '' : `width:${pct(len)};`) + (g.kind === 'stay' ? `background:${mapColor(g.map)};` : '');
            return h('div', {class: `seg ${g.kind}` + (opt.sel === g.i ? ' sel' : ''), dataset: {i: g.i, map: sch[g.i]?.map ?? ''}, title: tip({...g, go: g.go ?? sch[g.i]?.go}, plan), style,
                onclick: (e) => {e.stopPropagation(); opt.onPick?.(g.i);}}, label);
        })));
    if (opt.bare) return h('div', {class: 'daybar'}, bar);
    const maps = [...new Set(segs.filter(g => g.kind === 'stay').map(g => g.map))];
    const legend = h('div', {class: 'legend'}, maps.map(m => h('span', {title: m ?? ''}, h('b', {style: `background:${mapColor(m)}`}), m?.split('/').at(-1) ?? '?')));
    return h('div', {class: 'daybar'}, bar, axisEl(), legend);
}

export const axisEl = () => h('div', {class: 'axis'}, [0, 6, 12, 18, 24].map(t => h('span', {style: `left:${(t / 24) * 100}%`}, String(t))));

// 只換反白（不重畫）
export function markSel(root, i)
{
    for (const s of root.querySelectorAll('.daybar .seg')) s.classList.toggle('sel', +s.dataset.i === i);
}
