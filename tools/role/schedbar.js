// 作息 24 小時橫條：buildPlan() 的時刻表 → 一列分段（之後全 NPC 總覽疊很多列也用這支）
import {h} from '../common/dom.js';
import {DAY, mod, hhmm, destOf} from '../../src/data/schedplan.js';
import {toMin, shiftT as shift, dragRange, SNAP} from './schedit.js';

const PALETTE = ['#3f7fbf', '#4f9a4a', '#b5793a', '#8a5bb0', '#3a9a94', '#b0544f', '#9a9a3a', '#5b6fc4', '#b05b8f', '#6b8a3a'];

// 同一張地圖（跨角色）同一個顏色
export function mapColor(map)
{
    let x = 0;
    for (const c of map ?? '') x = (x * 31 + c.charCodeAt(0)) >>> 0;
    return PALETTE[x % PALETTE.length];
}

export const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} 時${m % 60 ? ` ${m % 60} 分` : ''}` : `${m} 分`);

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
        if (len > 0) segs.push({kind: 'stay', i, s: p.arr, len, map: sch[i]?.map, go: destOf(sch[i]), do: sch[i]?.do});
    });
    return segs;
}

// 某時刻在哪：{kind:'stay', i, map, go} 或 {kind:'walk', i, map, go}（走去第 i 筆）；沒有時刻表＝null
export function whereAt(plan, sch, t, segs = daySegs(plan, sch))
{
    if (!segs) return null;
    const hit = (k) => segs.find(g => g.kind === k && mod(t - g.s) < g.len);
    const g = hit('walk') ?? hit('stay');
    return g && {kind: g.kind, i: g.i, map: sch[g.i]?.map, go: destOf(sch[g.i])};
}

// 跨午夜切成兩截
export const pieces = (s, len) => (s + len <= DAY ? [[s, len]] : [[s, DAY - s], [0, s + len - DAY]]);

function tip(g, plan, ty)
{
    const p = plan[g.i], e = mod(g.s + g.len), pre = ty ? `${ty} · ` : '';
    if (g.kind === 'stay') return `${pre}${g.go ?? '?'}（${g.map ?? '?'}）${g.do ? ` ${g.do}` : ''}\n${hhmm(g.s)}～${hhmm(e)}，停 ${dur(g.len)}`;
    if (g.kind === 'walk') return `走去 ${g.go ?? p.key}\n出發 ${hhmm(p.dep)} → 抵達 ${hhmm(p.arr)}，走 ${dur(p.cost)}`;
    if (g.kind === 'late') return `⚠ 排不下：晚 ${g.len} 分\n${hhmm(p.dep)} 要出發，上一筆 ${hhmm(e)} 才到`;
    return `⚠ 從 ${p.from} 走不到 ${p.key}（${hhmm(p.dep)}）`;
}

const EDGE = 4;

// opt.sel＝選中第幾筆（-1＝沒有）、opt.onPick(i)＝點了某段、opt.bare＝不畫刻度跟圖例（總覽每列）、opt.typeName(s)＝段內寫的類型名
// opt.dim(map)＝true 的段變淡（總覽點圖例）
// 編輯：opt.onMenu(e, t)＝右鍵（t＝那裡的分鐘）；opt.planOf(sch)＝{plan, warns}、opt.onShift(j, delta)＝拖第 j 筆的分界線（走路段）放開
export function dayBarEl(plan, sch, warns, opt = {})
{
    const segs0 = opt.segs ?? (sch.length ? daySegs(plan, sch, warns) : []);
    if (!segs0) return h('div', {class: 'daybar none dim'}, '作息資料有問題，無法排時刻表');
    const pct = (m) => `${(m / DAY) * 100}%`;
    const bar = h('div', {class: 'track'});
    const fill = (pl, list, segs) => {
        const tyOf = (i) => opt.typeName?.(list[i]) ?? '';
        bar.replaceChildren(
            ...Array.from({length: 23}, (_, k) => h('i', {class: 'hr' + ((k + 1) % 6 ? '' : ' six'), style: `left:${pct((k + 1) * 60)}`})),
            ...segs.flatMap(g => pieces(g.s, g.len).map(([s, len]) => {
                const label = g.kind === 'stay' ? `${tyOf(g.i)}${g.do === 'patrol' ? '↻' : ''}` : g.kind === 'nope' ? '⚠' : '';
                const style = `left:${pct(s)};` + (g.kind === 'nope' ? '' : `width:${pct(len)};`) + (g.kind === 'stay' ? `background:${mapColor(g.map)};` : '');
                const map = list[g.i]?.map ?? '';
                return h('div', {class: `seg ${g.kind}` + (opt.sel === g.i ? ' sel' : '') + (opt.dim?.(map) ? ' dim' : ''),
                    dataset: {i: g.i, map, kind: g.kind, l: s === g.s ? 1 : 0, r: s + len === g.s + g.len || s + len === mod(g.s + g.len) ? 1 : 0},
                    title: tip({...g, go: g.go ?? destOf(list[g.i])}, pl, tyOf(g.i)), style}, label);
            })));
    };
    fill(plan, sch, segs0);
    if (!sch.length) bar.append(h('span', {class: 'empty dim'}, opt.onMenu ? '（沒有作息，右鍵插入）' : '（沒有作息）'));
    const tOf = (x) => {const rc = bar.getBoundingClientRect(); return Math.max(0, Math.min(DAY - 1, ((x - rc.left) / rc.width) * DAY));};
    // 滑鼠底下哪條分界線能拖：停留段的左右邊緣、整塊走路段；回傳第幾筆的走路段（j）
    const grab = (e) => {
        if (!opt.onShift || sch.length < 2) return -1;
        const el = e.target.closest?.('.seg');
        if (!el) return -1;
        const i = +el.dataset.i, n = sch.length, rc = el.getBoundingClientRect();
        if (el.dataset.kind === 'walk') return i;
        if (el.dataset.kind !== 'stay') return -1;
        if (+el.dataset.l && e.clientX - rc.left <= EDGE) return i;
        if (+el.dataset.r && rc.right - e.clientX <= EDGE) return (i + 1) % n;
        return -1;
    };
    const tipEl = h('div', {class: 'dragtip', hidden: true});
    // 游標時間：刻度列那排跟著游標的小標籤＋細直線（總覽每列不畫）
    const hovLine = h('i', {class: 'hovline', hidden: true}), hovT = h('span', {class: 'hovt', hidden: true});
    const hover = (x, text) => {
        if (opt.bare) return;
        hovLine.hidden = hovT.hidden = text === null;
        if (text === null) return;
        const rc = bar.getBoundingClientRect(), left = `${Math.max(0, Math.min(rc.width, x - rc.left))}px`;
        hovLine.style.left = hovT.style.left = left;
        hovT.textContent = text;
    };
    let drag = null, swallow = false;
    bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const j = grab(e);
        if (j < 0) return;
        e.preventDefault();
        try {bar.setPointerCapture(e.pointerId);} catch {}
        const t0 = toMin(sch[j].t);
        drag = {j, x0: e.clientX, t0, delta: 0, moved: false, range: dragRange(plan, j) ?? [0, 0]};
    });
    bar.addEventListener('pointermove', (e) => {
        if (!drag)
        {
            bar.classList.toggle('grab', grab(e) >= 0);
            const step = e.shiftKey ? 1 : SNAP;
            hover(e.clientX, hhmm(mod(Math.round(tOf(e.clientX) / step) * step)));
            return;
        }
        if (!drag.moved && Math.abs(e.clientX - drag.x0) < 3) return;
        drag.moved = true;
        const raw = tOf(e.clientX) - tOf(drag.x0);
        const step = e.shiftKey ? 1 : 10;
        const want = Math.round((drag.t0 + raw) / step) * step - drag.t0;
        const delta = Math.max(drag.range[0], Math.min(drag.range[1], want));
        if (delta === drag.delta && !tipEl.hidden) return;
        drag.delta = delta;
        const list = sch.map((s, k) => (k === drag.j ? {...s, t: shift(s.t, delta)} : s));
        const pl = opt.planOf(list);
        fill(pl.plan, list, daySegs(pl.plan, list, pl.warns) ?? []);
        const n = list.length, p = pl.plan?.[drag.j], pre = pl.plan?.[(drag.j - 1 + n) % n], nx = pl.plan?.[(drag.j + 1) % n];
        tipEl.textContent = p ? `停 ${dur(mod(p.dep - pre.arr))} ｜ 抵達 ${hhmm(p.arr)} ｜ 停 ${dur(mod(nx.dep - p.arr))}` : list[drag.j].t;
        tipEl.style.left = pct(tOf(e.clientX));
        tipEl.hidden = false;
        hover(e.clientX, p ? hhmm(p.arr) : list[drag.j].t.replace(/^@/, ''));
    });
    bar.addEventListener('pointerleave', () => {if (!drag) {hover(0, null); bar.classList.remove('grab');}});
    const end = () => {
        const d = drag;
        drag = null;
        tipEl.hidden = true;
        hover(0, null);
        if (!d?.moved) return;
        swallow = true;
        setTimeout(() => {swallow = false;}, 0);
        if (d.delta) opt.onShift(d.j, d.delta);
        else fill(plan, sch, segs0);
    };
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('click', (e) => {
        if (swallow) return;
        const el = e.target.closest?.('.seg');
        if (el) {e.stopPropagation(); opt.onPick?.(+el.dataset.i);}
    });
    if (opt.onMenu) bar.addEventListener('contextmenu', (e) => opt.onMenu(e, Math.round(tOf(e.clientX))));
    if (opt.bare) return h('div', {class: 'daybar'}, bar, tipEl);
    const segs = segs0;
    const maps = [...new Set(segs.filter(g => g.kind === 'stay').map(g => g.map))];
    const legend = h('div', {class: 'legend'}, maps.map(m => h('span', {title: m ?? ''}, h('b', {style: `background:${mapColor(m)}`}), m?.split('/').at(-1) ?? '?')));
    return h('div', {class: 'daybar'}, bar, tipEl, hovLine, hovT, axisEl(), legend);
}

export const axisEl = () => h('div', {class: 'axis'}, [0, 6, 12, 18, 24].map(t => h('span', {style: `left:${(t / 24) * 100}%`}, String(t))));

// 只換反白（不重畫）
export function markSel(root, i)
{
    for (const s of root.querySelectorAll('.daybar .seg')) s.classList.toggle('sel', +s.dataset.i === i);
}
