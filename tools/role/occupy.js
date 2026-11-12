// 作息點的占用時間圖：某張圖的某個點（具名物件或 @x,y）誰在什麼時段停在那裡（地圖分頁、角色分頁作息地圖的浮動框共用）
import {h} from '../common/dom.js';
import {DAY, mod, destOf} from '../../src/data/schedplan.js';
import {mapColor, pieces} from './schedbar.js';

// entries＝[{id, sch, segs}]（segs＝daySegs()，排不出時刻表＝null）
// → Map 點名稱 → [{id, nums:[第幾筆（0 起）], segs:[{s, len, i, kind:'stay'|'patrol'}], noPlan}]
// 巡邏那筆：入口照常 stay；route 上其他點同一段時段記 patrol（只是路過，不算撞）
export function spotsOn(entries, map)
{
    const out = new Map();
    const rowOf = (name, id) => {
        const rs = out.get(name) ?? out.set(name, []).get(name);
        return rs.find(r => r.id === id) ?? rs[rs.push({id, nums: [], segs: [], noPlan: false}) - 1];
    };
    for (const {id, sch, segs} of entries)
        sch.forEach((s, i) => {
            if (s?.map !== map) return;
            const stay = segs?.filter(g => g.kind === 'stay' && g.i === i) ?? [];
            const add = (name, kind) => {
                const r = rowOf(name, id);
                if (!r.nums.includes(i)) r.nums.push(i);
                if (!segs) r.noPlan = true;
                for (const g of stay) r.segs.push({s: g.s, len: g.len, i, kind});
            };
            const dest = destOf(s);
            if (dest) add(dest, 'stay');
            if (s.do === 'patrol') for (const p of new Set(s.route ?? [])) if (p !== dest) add(p, 'patrol');
        });
    return out;
}

// 兩個（不同）角色以上同時 stay 的時段：[[s, len]]（跨午夜切兩截）
export function clashOf(rows)
{
    const cnt = new Uint8Array(DAY);
    for (const r of rows)
    {
        const me = new Uint8Array(DAY);
        for (const g of r.segs) if (g.kind === 'stay') for (let k = 0; k < g.len; k++) me[(g.s + k) % DAY] = 1;
        for (let k = 0; k < DAY; k++) cnt[k] += me[k];
    }
    const out = [];
    let s = -1;
    for (let k = 0; k <= DAY; k++)
    {
        const on = k < DAY && cnt[k] >= 2;
        if (on && s < 0) s = k;
        else if (!on && s >= 0) {out.push([s, k - s]); s = -1;}
    }
    return out;
}

const here = (r, now) => now != null && r.segs.some(g => mod(now - g.s) < g.len);

// opt.map＝地圖（顏色）、opt.now＝現在幾分（畫白線、此刻在這的人加粗）、opt.mine＝排第一、名字橘色的角色、opt.sel＝mine 選中第幾筆（那段加白框）
export function occupyEl(rows, {map, now = null, mine = null, sel = -1} = {})
{
    const pct = (m) => `${(m / DAY) * 100}%`;
    const track = (kids) => h('div', {class: 'otrack'},
        Array.from({length: 23}, (_, k) => h('i', {class: 'hr' + ((k + 1) % 6 ? '' : ' six'), style: `left:${pct((k + 1) * 60)}`})),
        kids, now != null && h('i', {class: 'onow', style: `left:${pct(now)}`}));
    const piece = ([s, len], cls, style = '') => h('div', {class: `oseg ${cls}`, style: `left:${pct(s)};width:${pct(len)};${style}`});
    const sorted = [...rows].sort((a, b) => (b.id === mine) - (a.id === mine));
    const clash = clashOf(rows);
    const row = (cls, lab, body) => h('div', {class: `orow ${cls}`}, lab, body);
    return h('div', {class: 'occ'},
        clash.length > 0 && row('clash', h('span', {class: 'olab'}, '撞了'), track(clash.map(p => piece(p, 'clash')))),
        sorted.map(r => row(r.id === mine ? 'mine' : '',
            h(here(r, now) ? 'b' : 'span', {class: 'olab', title: r.segs.some(g => g.kind === 'patrol') ? '↻ 巡邏經過' : null},
                `${r.id} ${r.nums.map(i => i + 1).join(',')}${r.segs.some(g => g.kind === 'patrol') ? ' ↻' : ''}`),
            r.noPlan ? h('span', {class: 'onone'}, '排不出時刻表')
                : track(r.segs.flatMap(g => pieces(g.s, g.len).map(p => piece(p, g.kind + (r.id === mine && g.i === sel ? ' sel' : ''),
                    g.kind === 'stay' ? `background:${mapColor(map)}` : '')))))),
        row('axis', h('span', {class: 'olab'}), h('div', {class: 'oaxis'}, [0, 6, 12, 18, 24].map(t => h('span', {style: `left:${(t / 24) * 100}%`}, String(t))))));
}
