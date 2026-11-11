// 角色分頁總覽「作息」分頁：全部 NPC 的 24 小時甘特圖，固定時間游標、點圖例加亮一張地圖
import {h} from '../common/dom.js';
import {DAY, mod, hhmm} from '../../src/data/schedplan.js';
import * as SB from './schedbar.js';

const KT = 'tools.role.gantt.t', KM = 'tools.role.gantt.map';
const load = (k) => {try {return localStorage.getItem(k);} catch {return null;}};
const save = (k, v) => {try {v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v);} catch {}};

export const G = {t: +(load(KT) ?? 18 * 60) || 0, map: load(KM) || null};
export function setT(t) {G.t = mod(Math.round(t)); save(KT, String(G.t));}
export function setMap(m) {G.map = m || null; save(KM, G.map);}

const toMin = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
};
const short = (m) => m?.split('/').at(-1) ?? '?';

// o：{ids（已篩好、照 role.json 順序）, data, planOf(id), onRole(id), onSeg(id, i)}
export function ganttEl(o)
{
    const rows = o.ids.map(id => {
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
            const bar = !w.sch.length ? h('div', {class: 'daybar'}, h('div', {class: 'track empty'}, h('span', {class: 'dim'}, '（沒有作息）')))
                : SB.dayBarEl(w.pl.plan, w.sch, w.pl.warns, {segs: w.segs, bare: true, sel: -1, onPick: (i) => o.onSeg(w.id, i)});
            bar.querySelector('.track')?.append(cur('cur'));
            if (G.map) for (const s of bar.querySelectorAll('.seg')) s.classList.toggle('dim', s.dataset.map !== G.map);
            return h('div', {class: 'grole' + (w.sch.length ? '' : ' nosch'), dataset: {id: w.id}},
                h('div', {class: 'gname'}, h('a', {onclick: () => o.onRole(w.id)}, w.id), h('span', {class: 'dim'}, w.r.lab ?? '')),
                bar, now);
        }),
    ]);

    const el = h('div', {class: 'gantt'},
        h('div', {class: 'gtop'}, h('label', null, '時間 ', inp), h('span', {class: 'dim'}, '在上方時間軸按住拖曳；點圖例只看一張圖'), legend),
        h('div', {class: 'grole ghead'}, h('div', {class: 'gname'}), head, h('div', {class: 'gnow dim'}, '此刻')),
        body);
    update();
    return el;
}
