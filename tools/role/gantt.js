// 角色分頁總覽「作息」分頁：全部 NPC 的 24 小時甘特圖，固定時間游標、點圖例加亮一張地圖
import {h} from '../common/dom.js';
import {DAY, mod, hhmm} from '../../src/data/schedplan.js';
import * as SB from './schedbar.js';

const KT = 'tools.role.gantt.t', KM = 'tools.role.gantt.map', KH = 'tools.role.gantt.hide';
const load = (k) => {try {return localStorage.getItem(k);} catch {return null;}};
const save = (k, v) => {try {v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);} catch {}};
const loadHide = () => {try {const a = JSON.parse(load(KH)); return new Set(Array.isArray(a) ? a : []);} catch {return new Set();}};

// hide＝藏起來的角色 id（記藏的，新角色預設顯示）
export const G = {t: +(load(KT) ?? 18 * 60) || 0, map: load(KM) || null, hide: loadHide()};
export function setT(t) {G.t = mod(Math.round(t)); save(KT, String(G.t));}
export function setMap(m) {G.map = m || null; save(KM, G.map);}
export function setHide(ids, on)
{
    for (const id of ids) on ? G.hide.add(id) : G.hide.delete(id);
    save(KH, G.hide.size ? JSON.stringify([...G.hide]) : null);
}

// 「角色 ▾」：照子分類分組的勾選清單（組標題＝整組）、全部／全不勾
function rolePicker(all, data, rerender)
{
    const shown = all.filter(id => !G.hide.has(id)).length;
    const btn = h('button', {type: 'button', class: 'showbtn', dataset: {k: 'ganttRoles'}}, `角色（${shown}/${all.length}）▾`);
    let pop = null;
    const close = () => {pop?.remove(); pop = null; document.removeEventListener('pointerdown', outside, true);};
    const outside = (e) => {if (!pop?.contains(e.target) && e.target !== btn) close();};
    const change = (ids, on) => {setHide(ids, !on); close(); rerender(); document.querySelector('[data-k=ganttRoles]')?.click();};
    const box = (ids, text, title) => {
        const n = ids.filter(id => !G.hide.has(id)).length;
        const b = h('input', {type: 'checkbox', checked: n === ids.length, dataset: {role: title ?? ''}, onchange: e => change(ids, e.target.checked)});
        b.indeterminate = n > 0 && n < ids.length;
        return h('label', {class: title === undefined ? 'ggrphead' : ''}, b, text);
    };
    btn.onclick = () => {
        if (pop) return close();
        const groups = [];
        for (const id of all) (groups.find(g => g.grp === (data[id].grp ?? '')) ?? groups[groups.push({grp: data[id].grp ?? '', ids: []}) - 1]).ids.push(id);
        pop = h('div', {class: 'showpop gpick'},
            h('div', {class: 'gpall'},
                h('button', {type: 'button', onclick: () => change(all, true)}, '全部'),
                h('button', {type: 'button', onclick: () => change(all, false)}, '全不勾')),
            groups.map(g => h('div', {class: 'gpgrp'}, box(g.ids, g.grp || '（無子分類）'),
                g.ids.map(id => box([id], h('span', null, id, h('span', {class: 'dim'}, ` ${data[id].lab ?? ''}`)), id)))));
        document.body.append(pop);
        const rc = btn.getBoundingClientRect();
        pop.style.left = `${Math.max(0, Math.min(rc.left, innerWidth - pop.offsetWidth - 4))}px`;
        pop.style.top = `${rc.bottom + 2}px`;
        pop.style.maxHeight = `${innerHeight - rc.bottom - 8}px`;
        document.addEventListener('pointerdown', outside, true);
    };
    return btn;
}

const toMin = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
const short = (m) => m?.split('/').at(-1) ?? '?';

// o：{ids（已篩好、照 role.json 順序）, data, planOf(id), onRole(id), onSeg(id, i), typeName(s), planFor(sch)＝拖曳中的試算, onShift(id, j, delta)＝拖分界線放開,
//     onMenu(e, id, t)＝右鍵, onMulti(id, i)＝Shift＋點, multiOf(id)＝那列多選的 index（沒有＝null）}
export function ganttEl(o)
{
    const rows = o.ids.filter(id => !G.hide.has(id)).map(id => {
        const r = o.data[id], sch = Array.isArray(r.schedule) ? r.schedule : [];
        const pl = sch.length ? o.planOf(id) : {plan: null, warns: []};
        return {id, r, sch, pl, segs: sch.length ? SB.daySegs(pl.plan, sch, pl.warns) : null};
    });
    const maps = [...new Set(rows.flatMap(w => (w.segs ?? []).filter(g => g.kind === 'stay').map(g => g.map)))];
    if (G.map && !maps.includes(G.map)) setMap(null);

    const pct = (m) => `${(m / DAY) * 100}%`;
    const curs = [], nows = [], counts = new Map();
    const inp = h('input', {class: 'num', size: 5, dataset: {k: 'ganttT'}, value: hhmm(G.t), onchange: e => {const v = toMin(e.target.value); if (v !== null) setT(v); update();}});

    function update()
    {
        for (const c of curs) c.style.left = pct(G.t);
        inp.value = hhmm(G.t);
        const n = new Map();
        for (const {w, el} of nows)
        {
            const at = SB.whereAt(w.pl.plan, w.sch, G.t, w.segs);
            el.textContent = !w.sch.length ? '' : !at ? '?' : at.kind === 'walk' ? `走路中 → ${short(at.map)}／${at.go}` : `${short(at.map)}／${at.go}`;
            el.title = at ? `${at.i + 1}. ${at.map}／${at.go}` : '';
            el.classList.toggle('on', !!G.map && at?.kind === 'stay' && at.map === G.map);
            if (at?.kind === 'stay') n.set(at.map, (n.get(at.map) ?? 0) + 1);
        }
        for (const [m, el] of counts) el.textContent = `（${n.get(m) ?? 0}）`;
    }

    // 頂端時間軸：按住拖游標
    const track = h('div', {class: 'track'});
    const head = h('div', {class: 'gaxis'}, track, SB.axisEl());
    const tAt = (e) => {const rc = track.getBoundingClientRect(); return Math.max(0, Math.min(DAY - 1, ((e.clientX - rc.left) / rc.width) * DAY));};
    head.onpointerdown = (e) => {
        if (e.button !== 0) return;
        head.setPointerCapture?.(e.pointerId);
        setT(tAt(e)); update();
        head.onpointermove = (ev) => {setT(tAt(ev)); update();};
        head.onpointerup = () => {head.onpointermove = head.onpointerup = null;};
    };
    const cur = (cls) => {const c = h('i', {class: cls}); curs.push(c); return c;};
    track.append(cur('cur'), cur('knob'));
    // 滑過時序條：每列＋頂端時間軸各一條細白線、時間軸上一個時間標籤（同表單的游標時間）
    const hovs = [], hovT = h('span', {class: 'ghovt', hidden: true});
    const hovLine = () => {const c = h('i', {class: 'ghov', hidden: true}); hovs.push(c); return c;};
    const onHover = (t, text) => {
        for (const c of [...hovs, hovT])
        {
            c.hidden = t === null;
            if (t !== null) c.style.left = pct(t);
        }
        if (t !== null) hovT.textContent = text;
    };
    track.append(hovLine());
    head.append(hovT);
    // 拖曳中兩端：頂端時間軸各一個時間（左靠右、右靠左對齊），豎線貫穿每列
    const ends = [0, 1].map(() => ({lines: [], t: h('span', {class: 'gendt', hidden: true})}));
    const endLines = () => ends.map(x => {const c = h('i', {class: 'gend', hidden: true}); x.lines.push(c); return c;});
    const onEnds = (ts) => {
        ends.forEach((x, k) => {
            const m = ts?.[k];
            for (const c of [...x.lines, x.t]) {c.hidden = m === undefined; if (m !== undefined) c.style.left = pct(m);}
            if (m === undefined) return;
            x.t.textContent = hhmm(m);
            const w = track.getBoundingClientRect().width, px = (m / DAY) * w, want = ts.length === 1 ? -50 : k === 0 ? -100 : 0;
            x.t.style.transform = `translateX(${px < 40 ? 0 : w - px < 40 ? -100 : want}%)`;
        });
    };
    track.append(...endLines());
    head.append(...ends.map(x => x.t));

    const legend = h('div', {class: 'legend glegend'}, maps.map(m => {
        const cnt = h('small');
        counts.set(m, cnt);
        return h('span', {class: 'pick' + (G.map === m ? ' on' : ''), title: `${m}（點＝只看這張圖，再點取消；括號＝游標時刻在這張圖的人數）`, dataset: {map: m},
            onclick: () => {setMap(G.map === m ? null : m); o.rerender();}}, h('b', {style: `background:${SB.mapColor(m)}`}), short(m), cnt);
    }));

    const groups = [];
    for (const w of rows) (groups.find(g => g.grp === (w.r.grp ?? '')) ?? groups[groups.push({grp: w.r.grp ?? '', rows: []}) - 1]).rows.push(w);
    const body = groups.flatMap(g => [
        h('div', {class: 'ggrp'}, g.grp || '（無子分類）'),
        ...g.rows.map(w => {
            const now = h('div', {class: 'gnow'});
            nows.push({w, el: now});
            const bar = SB.dayBarEl(w.pl.plan, w.sch, w.pl.warns, {segs: w.segs ?? (w.sch.length ? null : []), bare: true, sel: -1, multi: o.multiOf?.(w.id),
                onPick: (i, shift) => (shift && o.onMulti ? o.onMulti(w.id, i) : o.onSeg(w.id, i)),
                onMenu: o.onMenu && ((e, t) => o.onMenu(e, w.id, t)),
                typeName: o.typeName, planOf: o.planFor, onShift: (js, d) => o.onShift(w.id, js, d), dim: G.map ? (m) => m !== G.map : null, onHover, onEnds});
            bar.querySelector('.track')?.append(cur('cur'), hovLine(), ...endLines());
            return h('div', {class: 'grole' + (w.sch.length ? '' : ' nosch'), dataset: {id: w.id}},
                h('div', {class: 'gname'}, h('a', {onclick: () => o.onRole(w.id)}, w.id), h('span', {class: 'dim'}, w.r.lab ?? '')),
                bar, now);
        }),
    ]);

    const el = h('div', {class: 'gantt'},
        h('div', {class: 'gtop'}, h('label', null, '時間 ', inp), rolePicker(o.ids, o.data, o.rerender),
            h('span', {class: 'dim'}, '在上方時間軸按住拖曳；點圖例只看一張圖；右鍵時序條編輯、Shift＋點多選'), legend),
        h('div', {class: 'grole ghead'}, h('div', {class: 'gname'}), head, h('div', {class: 'gnow dim'}, '此刻')),
        body);
    update();
    return el;
}
