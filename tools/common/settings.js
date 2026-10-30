// 工具設定 tools/settings.json（不進 git）：只存跟內建值 DEF 不一樣的值，沒有的 key＝內建值；改了延遲寫檔、廣播 settings.json 讓其他分頁重讀
import * as FS from './fs.js';
import * as SH from './shell.js';
import {str, isObj} from './obj.js';

export const FILE = 'settings.json';
const DELAY = 500;

// 數字欄 ↑↓ 一次多少；xy 也是紙娃娃方向鍵移動、拖曳吸附的格子；欄位名 → 步進 key 照 STEP_OF
const STEP = {pct: 0.25, scale: 0.01, xy: 0.25, o: 0.05, a: 1};
export const STEP_OF = {pct: 'pct', scale: 'scale', x: 'xy', y: 'xy', ox: 'o', oy: 'o', a: 'a'};

// 紙娃娃自動拆圖的數字：pct＝存檔%、scale＝equip.scale／role 的 head.scale…；武器照分類各一組＝WEAPON 蓋上第三欄
const ARMOR = {helmet: {pct: 28, scale: 0.25, x: -1.75, y: -0.25}, armor: {pct: 20, scale: 0.25, x: 0.25, y: 26.5}, boots: {pct: 20, scale: 0.25, x: 1.5, y: 33}};
const WEAPON = {pct: 10, scale: 0.25, x: -13, y: 18, a: 0, ox: 0.5, oy: 0.85};
export const WCLS = [
    ['sword', '劍', {pct: 12, x: -6, y: 17, a: 60}],
    ['axe', '斧', {pct: 12, x: -6, y: 17, a: 60, ox: 0.3}],
    ['hammer', '錘', {x: -6, y: 17, a: 60}],
    ['dagger', '匕首', {x: 0, y: 16, a: 70, oy: 0.75}],
    ['staff', '法杖', {pct: 15, x: -6, y: 17, a: 60, oy: 0.7}],
    ['bow', '弓', {pct: 12, x: 5, y: 17, a: 60, ox: 0.7, oy: 0.5}],
    ['default', '預設', {}],
];

export const DEF = {
    step: STEP,
    auto: {
        ...ARMOR,
        head: {pct: 18, scale: 0.25, x: -2, y: 4},
        hair: {pct: 18, scale: 0.25, x: -1, y: 2},
        weapon: Object.fromEntries(WCLS.map(([k, , o]) => [k, {...WEAPON, ...o}])),
        portrait: {size: 100, fill: 100},
        // 女版護具只有 scale/x/y（PNG 跟存檔% 跟男版共用）
        f: Object.fromEntries(Object.entries(ARMOR).map(([k, {scale, x, y}]) => [k, {scale, x, y}])),
    },
};

const S = {dir: null, over: {}, cur: structuredClone(DEF), timer: null, fns: []};

// 只認 DEF 有的 key，葉子不是數字就用內建值
const merge = (d, o) => isObj(d) ? Object.fromEntries(Object.entries(d).map(([k, v]) => [k, merge(v, o?.[k])])) : Number.isFinite(o) ? o : d;

function diff(d, c)
{
    if (!isObj(d)) return c === d || !Number.isFinite(c) ? undefined : c;
    const out = {};
    for (const k of Object.keys(d))
    {
        const v = diff(d[k], c?.[k]);
        if (v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
}

export const ready = () => !!S.dir;
export const get = (sec) => structuredClone(S.cur[sec]);
export const over = () => structuredClone(S.over);
export const step = (f) => S.cur.step[STEP_OF[f] ?? f];

async function read(dir = S.dir)
{
    const fh = await FS.tryFile(dir, FILE);
    S.over = fh ? JSON.parse(await (await fh.getFile()).text()) : {};
    S.cur = merge(DEF, S.over);
    return !!fh;
}

// root：專案根目錄；回傳檔案原本在不在（不在＝第一次，呼叫端可以搬舊資料進來）；檔案壞了會 throw，也不會寫檔蓋掉它
export async function load(root)
{
    clearTimeout(S.timer);
    S.timer = S.dir = null;
    const dir = await root.getDirectoryHandle('tools', {create: true});
    const had = await read(dir);
    S.dir = dir;
    return had;
}

// 整段換掉（sec＝'step'／'auto'），跟內建值一樣的 key 不存；還沒 load 只改記憶體
export function set(sec, value)
{
    S.cur = {...S.cur, [sec]: merge(DEF[sec], value)};
    const o = diff(DEF, S.cur) ?? {};
    if (str(o) === str(S.over)) return;
    S.over = o;
    if (!S.dir) return;
    clearTimeout(S.timer);
    S.timer = setTimeout(flush, DELAY);
}

export async function flush()
{
    if (!S.timer) return;
    clearTimeout(S.timer);
    S.timer = null;
    await FS.writeFile(S.dir, FILE, JSON.stringify(S.over, null, 4) + '\n');
    SH.notifySaved(FILE);
}

// 別的分頁寫了檔：重讀再通知
export const onChange = (fn) => S.fns.push(fn);
SH.onSaved(async (file) => {
    if (file !== FILE || !S.dir) return;
    await read();
    for (const fn of S.fns) fn();
});

// 有 data-step 的數字欄照設定換 step（data-step 填欄位名或步進 key）
export function applySteps(root = document)
{
    for (const inp of root.querySelectorAll('input[data-step]')) inp.step = step(inp.dataset.step);
}
