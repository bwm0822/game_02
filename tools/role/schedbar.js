// 作息 24 小時橫條：buildPlan() 的時刻表 → 一列分段（之後全 NPC 總覽疊很多列也用這支）
import {h} from '../common/dom.js';
import {DAY, mod, hhmm, destOf} from '../../src/data/schedplan.js';
import {toMin, shiftT as shift, dragRange, blockRange, SNAP} from './schedit.js';

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
// opt.dim(map)＝true 的段變淡（總覽點圖例）、opt.onHover(t, text)＝bare 時的游標時間（離開＝null）、opt.onEnds(ts)＝bare 時拖曳中兩端的時刻（放開＝null）
// 編輯：opt.onMenu(e, t)＝右鍵（t＝那裡的分鐘）；opt.planOf(sch)＝{plan, warns}、opt.onShift(js, delta)＝拖曳放開，js 那幾筆一起平移
//（分界線＝第 j 筆的走路段 [j]、停留段中間＝整塊 [i, i+1]）
export function dayBarEl(plan, sch, warns, opt = {})
{
    const segs0 = opt.segs ?? (sch.length ? daySegs(plan, sch, warns) : []);
    if (!segs0) return h('div', {class: 'daybar none dim'}, '作息資料有問題，無法排時刻表');
    const pct = (m) => `${(m / DAY) * 100}%`;
    const bar = h('div', {class: 'track'});
    const isSel = (i) => (opt.multi ? opt.multi.includes(i) : opt.sel === i);
    const fill = (pl, list, segs) => {
        const tyOf = (i) => opt.typeName?.(list[i]) ?? '';
        const extra = [...bar.children].filter(c => !c.matches('.hr, .seg'));
        bar.replaceChildren(...extra,
            ...Array.from({length: 23}, (_, k) => h('i', {class: 'hr' + ((k + 1) % 6 ? '' : ' six'), style: `left:${pct((k + 1) * 60)}`})),
            ...segs.flatMap(g => pieces(g.s, g.len).map(([s, len]) => {
                const label = g.kind === 'stay' ? `${tyOf(g.i)}${g.do === 'patrol' ? '↻' : ''}` : g.kind === 'nope' ? '⚠' : '';
                const style = `left:${pct(s)};` + (g.kind === 'nope' ? '' : `width:${pct(len)};`) + (g.kind === 'stay' ? `background:${mapColor(g.map)};` : '');
                const map = list[g.i]?.map ?? '';
                return h('div', {class: `seg ${g.kind}` + (isSel(g.i) ? ' sel' : '') + (opt.dim?.(map) ? ' dim' : ''),
                    dataset: {i: g.i, map, kind: g.kind, l: s === g.s ? 1 : 0, r: s + len === g.s + g.len || s + len === mod(g.s + g.len) ? 1 : 0},
                    title: tip({...g, go: g.go ?? destOf(list[g.i])}, pl, tyOf(g.i)), style}, label);
            })));
    };
    fill(plan, sch, segs0);
    if (!sch.length) bar.append(h('span', {class: 'empty dim'}, opt.onMenu ? '（沒有作息，右鍵插入）' : '（沒有作息）'));
    const tOf = (x) => {const rc = bar.getBoundingClientRect(); return Math.max(0, Math.min(DAY - 1, ((x - rc.left) / rc.width) * DAY));};
    // 滑鼠底下能拖什麼：停留段的左右邊緣、整塊走路段＝分界線（edge，第 j 筆的走路段）；停留段中間＝整塊（block，第 i 筆停留不變）
    const grab = (e) => {
        if (!opt.onShift || !sch.length) return null;
        const el = e.target.closest?.('.seg');
        if (!el) return null;
        const i = +el.dataset.i, n = sch.length, rc = el.getBoundingClientRect();
        const edge = (j) => ({kind: 'edge', j, js: [j]});
        if (el.dataset.kind === 'walk') return edge(i);
        if (el.dataset.kind !== 'stay') return null;
        if (+el.dataset.l && e.clientX - rc.left <= EDGE) return edge(i);
        if (+el.dataset.r && rc.right - e.clientX <= EDGE) return edge((i + 1) % n);
        return {kind: 'block', j: i, js: n === 1 ? [i] : [i, (i + 1) % n]};
    };
    const rangeOf = (g) => (sch.length === 1 ? [1 - DAY, DAY - 1] : (g.kind === 'block' ? blockRange(plan, g.j) : dragRange(plan, g.j)) ?? [0, 0]);
    // 拖曳中兩端的時刻：分界線＝走路段的出發／抵達、整塊＝停留段的抵達／離開（同一刻只一個）
    const endsOf = (g, pl) => {
        const n = pl?.length ?? 0, p = pl?.[g.j];
        if (!p) return [];
        const ts = n === 1 ? [p.arr] : g.kind === 'block' ? [p.arr, pl[(g.j + 1) % n].dep] : [p.dep, p.arr];
        return ts[0] === ts.at(-1) ? [ts[0]] : ts;
    };
    // 兩端：短豎線＋時間，左邊那個靠右對齊、右邊那個靠左對齊（不會疊）；bare 交給 opt.onEnds
    const endEls = [0, 1].map(() => ({mk: h('i', {class: 'endmk', hidden: true}), t: h('span', {class: 'endt', hidden: true})}));
    const showEnds = (ts) => {
        if (opt.bare) return opt.onEnds?.(ts);
        const w = bar.getBoundingClientRect().width;
        endEls.forEach(({mk, t}, k) => {
            const m = ts?.[k];
            mk.hidden = t.hidden = m === undefined;
            if (m === undefined) return;
            mk.style.left = t.style.left = pct(m);
            t.textContent = hhmm(m);
            const x = (m / DAY) * w, want = ts.length === 1 ? -50 : k === 0 ? -100 : 0;
            t.style.transform = `translateX(${x < 40 ? 0 : w - x < 40 ? -100 : want}%)`;
        });
    };
    // 游標時間：刻度列那排跟著游標的小標籤＋細直線（總覽每列不畫，交給 opt.onHover(t 分｜null, 文字) 畫整張）
    const hovLine = h('i', {class: 'hovline', hidden: true}), hovT = h('span', {class: 'hovt', hidden: true});
    const hover = (x, text) => {
        if (opt.bare) return opt.onHover?.(text === null ? null : tOf(x), text);
        hovLine.hidden = hovT.hidden = text === null;
        if (text === null) return;
        const rc = bar.getBoundingClientRect(), left = `${Math.max(0, Math.min(rc.width, x - rc.left))}px`;
        hovLine.style.left = hovT.style.left = left;
        hovT.textContent = text;
    };
    // 滑過一段＝同一筆作息的段都亮（走路＋停留、跨午夜切成兩塊的）
    let hovI = null;
    const hovSeg = (i) => {
        if (i === hovI) return;
        hovI = i;
        for (const s of bar.querySelectorAll('.seg')) s.classList.toggle('hov', i !== null && +s.dataset.i === i);
    };
    let drag = null, swallow = false;
    const cursor = (g) => {
        bar.classList.toggle('grab', g?.kind === 'edge');
        bar.classList.toggle('move', g?.kind === 'block');
    };
    bar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        const g = grab(e);
        if (!g) return;
        e.preventDefault();
        drag = {...g, x0: e.clientX, t0: toMin(sch[g.j].t), delta: 0, moved: false, range: rangeOf(g), pointerId: e.pointerId};
        // 還沒 capture 前在外面放開也要結束
        window.addEventListener('pointerup', end, {once: true});
    });
    bar.addEventListener('pointermove', (e) => {
        if (!drag)
        {
            cursor(grab(e));
            const el = e.target.closest?.('.seg');
            hovSeg(el ? +el.dataset.i : null);
            const step = e.shiftKey ? 1 : SNAP;
            hover(e.clientX, hhmm(mod(Math.round(tOf(e.clientX) / step) * step)));
            return;
        }
        if (!drag.moved)
        {
            if (Math.abs(e.clientX - drag.x0) < 3) return;
            // 真的拖了才 capture（不然停留段中間單擊的 click 會落到 track、選不到段）
            try {bar.setPointerCapture(drag.pointerId);} catch {}
            drag.moved = true;
            hovSeg(null);
            hover(0, null);
            drag.delta = null;
        }
        const raw = tOf(e.clientX) - tOf(drag.x0);
        const step = e.shiftKey ? 1 : SNAP;
        const want = Math.round((drag.t0 + raw) / step) * step - drag.t0;
        const delta = Math.max(drag.range[0], Math.min(drag.range[1], want));
        if (delta === drag.delta) return;
        drag.delta = delta;
        const list = sch.map((s, k) => (drag.js.includes(k) ? {...s, t: shift(s.t, delta)} : s));
        const pl = opt.planOf(list);
        fill(pl.plan, list, daySegs(pl.plan, list, pl.warns) ?? []);
        showEnds(endsOf(drag, pl.plan));
    });
    bar.addEventListener('pointerleave', () => {if (!drag) {hover(0, null); hovSeg(null); cursor(null);}});
    function end()
    {
        if (!drag) return;
        const d = drag;
        drag = null;
        showEnds(null);
        if (!d?.moved) return;
        swallow = true;
        setTimeout(() => {swallow = false;}, 0);
        if (d.delta) opt.onShift(d.js, d.delta);
        else fill(plan, sch, segs0);
    }
    bar.addEventListener('pointerup', end);
    bar.addEventListener('pointercancel', end);
    bar.addEventListener('click', (e) => {
        if (swallow) return;
        const el = e.target.closest?.('.seg');
        if (el) {e.stopPropagation(); opt.onPick?.(+el.dataset.i, e.shiftKey);}
    });
    if (opt.onMenu) bar.addEventListener('contextmenu', (e) => opt.onMenu(e, Math.round(tOf(e.clientX))));
    if (opt.bare) return h('div', {class: 'daybar'}, bar);
    const segs = segs0;
    const maps = [...new Set(segs.filter(g => g.kind === 'stay').map(g => g.map))];
    const legend = h('div', {class: 'legend'}, maps.map(m => h('span', {title: m ?? ''}, h('b', {style: `background:${mapColor(m)}`}), m?.split('/').at(-1) ?? '?')));
    return h('div', {class: 'daybar'}, bar, hovLine, hovT, ...endEls.flatMap(x => [x.mk, x.t]), axisEl(), legend);
}

export const axisEl = () => h('div', {class: 'axis'}, [0, 6, 12, 18, 24].map(t => h('span', {style: `left:${(t / 24) * 100}%`}, String(t))));

// 只換反白（不重畫）；i 可以是 index 陣列（多選）
export function markSel(root, i)
{
    const on = Array.isArray(i) ? (k) => i.includes(k) : (k) => k === i;
    for (const s of root.querySelectorAll('.daybar .seg')) s.classList.toggle('sel', on(+s.dataset.i));
}
