// 作息時序條的編輯（純函式，直接改 sch 陣列）：插入（夾一小時）、平移分界線、刪除（前後同目的地合併）、分層目的地清單
import {DAY, mod, hhmm, destOf} from '../../src/data/schedplan.js';

export const MIN_STAY = 10;
export const SNAP = 10;
export const STAY = 60;

export const toMin = (s) => {const m = /^@?(\d{1,2}):(\d{2})$/.exec(s ?? ''); return m ? +m[1] * 60 + +m[2] : null;};
export const sameDest = (a, b) => !!a && !!b && a.map === b.map && destOf(a) === destOf(b);

// t 照原本型別（@抵達／出發）平移 delta 分
export const shiftT = (t, delta) => `${t.startsWith('@') ? '@' : ''}${hhmm(mod(toMin(t) + delta))}`;

// 時刻 t 落在哪一筆：停留段＝那筆、走路段＝走去的那筆；沒有＝-1
export function entryAt(segs, t)
{
    const hit = (k) => segs?.find(g => g.kind === k && mod(t - g.s) < g.len);
    return (hit('stay') ?? hit('walk'))?.i ?? -1;
}

// 插入用：時刻 t 是在哪一筆停留的期間（走路段算上一筆的）；作息是空的＝-1
export function stayAt(segs, t, n)
{
    const g = segs?.find(x => x.kind === 'stay' && mod(t - x.s) < x.len);
    if (g) return g.i;
    const w = segs?.find(x => x.kind === 'walk' && mod(t - x.s) < x.len);
    return w ? (w.i - 1 + n) % n : n ? n - 1 : -1;
}

// 插入：新目的地 t 抵達，停 STAY 分後回原處（出發型）；回原處的時間超過原本下一筆出發＝只插一筆
// i＝插入點所在那筆（-1＝作息是空的）；回傳新那筆的 index
export function insertAt(sch, plan, i, t, map, dest)
{
    const add = {t: `@${hhmm(mod(t))}`, map, ...dest};
    if (i < 0 || !sch.length) {sch.push(add); return sch.length - 1;}
    const n = sch.length, p = plan?.[i], next = plan?.[(i + 1) % n];
    const back = mod(t + STAY);
    const room = p && next ? mod(next.dep - p.arr) || DAY : DAY;
    const ret = p && mod(back - p.arr) < room && !sameDest(sch[i], add);
    sch.splice(i + 1, 0, add);
    if (ret)
    {
        const {t: _, ...rest} = sch[i];
        sch.splice(i + 2, 0, {t: hhmm(back), ...rest});
    }
    return i + 1;
}

// 第 j 筆的走路段（＝第 j-1 筆停留的右緣＋第 j 筆停留的左緣）能平移的範圍 [lo, hi]；只有一筆＝null
export function dragRange(plan, j)
{
    const n = plan?.length ?? 0;
    if (n < 2) return null;
    const pre = plan[(j - 1 + n) % n], cur = plan[j], next = plan[(j + 1) % n];
    const lo = MIN_STAY - mod(cur.dep - pre.arr);
    const hi = mod(next.dep - cur.arr) - MIN_STAY;
    return lo <= hi ? [lo, hi] : [0, 0];
}

export const clampDelta = (d, r) => (r ? Math.max(r[0], Math.min(r[1], d)) : 0);

// 分割：時刻 t 那段停留切成兩筆同目的地（新的一筆 @t 抵達，其他欄位抄原本那筆）
// 回傳 {i}＝切的是第幾筆，或 {why}＝不能切的原因
export function splitCheck(segs, t)
{
    const g = segs?.find(x => x.kind === 'stay' && mod(t - x.s) < x.len);
    if (!g) return {why: '要點在停留段上（走路段不能分割）'};
    const off = mod(t - g.s);
    if (off < MIN_STAY || g.len - off < MIN_STAY) return {why: `離段的邊緣至少 ${MIN_STAY} 分`};
    return {i: g.i};
}

export function splitAt(sch, i, t)
{
    sch.splice(i + 1, 0, {...sch[i], t: `@${hhmm(mod(t))}`});
    return i + 1;
}

// 從第 s 筆開始連續 len 筆（可繞回開頭）的 index
export const rangeIdx = (n, s, len) => Array.from({length: len}, (_, k) => (s + k) % n);

// 錨點 a、點了 k：取時間順序比較短的那一邊 → {s, len}
export function pickRange(n, a, k)
{
    const fwd = mod2(k - a, n), back = mod2(a - k, n);
    return fwd <= back ? {s: a, len: fwd + 1} : {s: k, len: back + 1};
}
const mod2 = (x, n) => ((x % n) + n) % n;

const spliceOut = (sch, idx) => {for (const k of [...idx].sort((x, y) => y - x)) sch.splice(k, 1);};

// 合併第 s 筆起連續 len 筆：留 keep 那筆的內容、時間用第 s 筆的 t；回傳合併後那筆的 index
export function mergeRange(sch, s, len, keep)
{
    const idx = rangeIdx(sch.length, s, len);
    const out = {...sch[keep], t: sch[s].t};
    sch[s] = out;
    spliceOut(sch, idx.filter(k => k !== s));
    return sch.indexOf(out);
}

// 刪除第 s 筆起連續 len 筆；刪完前後兩筆同目的地＝刪掉後面那筆（插入再刪剛好復原）。回傳要選的 index（沒了＝-1）
export function removeRange(sch, s, len)
{
    const idx = rangeIdx(sch.length, s, len);
    const pos = s - idx.filter(k => k < s).length;
    spliceOut(sch, idx);
    const n = sch.length;
    if (n < 2) return n ? 0 : -1;
    const a = (pos - 1 + n) % n, b = pos % n;
    if (a !== b && sameDest(sch[a], sch[b])) {sch.splice(b, 1); return b === 0 ? sch.length - 1 : a;}
    return a;
}

export const removeAt = (sch, i) => removeRange(sch, i, 1);

// 分層目的地：[{map, room: bool, names:[...]}]，世界圖（m/ 開頭）底下掛 m_xxx/ 的室內圖；藏 port（門、樓梯）跟 @格子；只剩門的室內圖不列
export function destTree(nav)
{
    const byMap = {};
    for (const key of Object.keys(nav.nodes ?? {}))
    {
        const k = key.indexOf(':'), map = key.slice(0, k), name = key.slice(k + 1);
        byMap[map] ??= [];
        if (name.startsWith('@') || (nav.edges?.[key] ?? []).some(e => e.type === 'port')) continue;
        byMap[map].push(name);
    }
    const worlds = Object.keys(byMap).filter(m => m.startsWith('m/')).sort();
    const parentOf = (m) => {const w = `m/${m.split('/')[0]}`; return !m.startsWith('m/') && byMap[w] ? w : null;};
    const out = worlds.map(w => ({map: w, names: byMap[w], rooms: []}));
    const other = [];
    for (const m of Object.keys(byMap).sort())
    {
        if (m.startsWith('m/') || !byMap[m].length) continue;
        const w = parentOf(m);
        (w ? out.find(x => x.map === w).rooms : other).push({map: m, names: byMap[m]});
    }
    return [...out, ...other.map(o => ({...o, rooms: []}))];
}
