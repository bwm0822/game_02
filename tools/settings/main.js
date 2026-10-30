// 設定：看／改 tools/settings.json（工具共用的步進、紙娃娃自動拆圖的數字）；只存改過的值，空白＝內建值（灰字 placeholder）
// 改了直接存（settings.js 延遲寫檔＋廣播），紙娃娃那邊調的數字也寫同一份，收到廣播就重畫、undo 從現在重算
import * as SH from '../common/shell.js';
import * as ST from '../common/settings.js';
import {WCLS} from '../common/settings.js';
import {$, h, ask, status} from '../common/dom.js';
import {str, getAt, setAt} from '../common/obj.js';

const STEP_COLS = [['pct', '存檔%'], ['scale', 'scale'], ['xy', 'x / y（含方向鍵、拖曳吸附）'], ['o', 'ox / oy'], ['a', 'a（角度）']];
const AUTO_COLS = ['pct', 'scale', 'x', 'y', 'a', 'ox', 'oy'];
const AUTO_LABS = {pct: '存檔%'};
const PT_COLS = [['size', '尺寸'], ['fill', '%']];
// 要大於 0 的欄位
const POS = new Set(['pct', 'scale', 'size', 'fill', 'xy', 'o', 'a']);
const AUTO_ROWS = [
    ['護具', [['頭盔', ['helmet']], ['護甲', ['armor']], ['靴子', ['boots']]]],
    ['護具（女版）', [['頭盔', ['f', 'helmet']], ['護甲', ['f', 'armor']], ['靴子', ['f', 'boots']]]],
    ['頭像', [['頭', ['head']], ['頭髮', ['hair']]]],
    ['武器', WCLS.map(([k, lab]) => [`${lab} ${k}`, ['weapon', k]])],
];

const S = {hist: [], hi: -1};

const apply = (o) => {ST.set('step', o.step); ST.set('auto', o.auto);};

function resetHist()
{
    S.hist = [str(ST.over())];
    S.hi = 0;
}

function commit(fn)
{
    const o = ST.over();
    fn(o);
    apply(o);
    const now = str(ST.over());
    if (now !== S.hist[S.hi])
    {
        S.hist.length = S.hi + 1;
        S.hist.push(now);
        if (S.hist.length > 300) S.hist.shift();
        S.hi = S.hist.length - 1;
    }
    render();
}

const edit = (path, v) => commit(o => setAt(o, path, v));

function undo()
{
    if (S.hi <= 0) return;
    apply(JSON.parse(S.hist[--S.hi]));
    render();
}

function redo()
{
    if (S.hi >= S.hist.length - 1) return;
    apply(JSON.parse(S.hist[++S.hi]));
    render();
}

// ---------- 畫面 ----------
function numCell(path)
{
    const f = path.at(-1), def = getAt(ST.DEF, path), v = getAt(ST.over(), path);
    // 空白時 ↑↓／上下三角形會從 0 起跳：先填入內建值再讓瀏覽器步進
    const fromPh = (el) => {if (el.value === '') el.value = def;};
    return h('td', null, h('input', {type: 'number', class: v === undefined ? null : 'changed', value: v ?? '', placeholder: def,
        dataset: {k: path.join('.'), step: f}, title: `內建 ${def}`,
        onkeydown: (e) => {if (e.key === 'ArrowUp' || e.key === 'ArrowDown') fromPh(e.target);},
        onmousedown: (e) => {if (e.offsetX > e.target.clientWidth - 20) fromPh(e.target);},
        onchange: (e) => {
            const s = e.target.value.trim(), n = Number(s);
            if (s === '') return edit(path, undefined);
            if (!Number.isFinite(n) || POS.has(f) && !(n > 0)) {status(`${path.join('.')} 要是${POS.has(f) ? '大於 0 的' : ''}數字`); return render();}
            edit(path, n);
        }}));
}

const resetBtn = (path, title) => h('button', {title, disabled: getAt(ST.over(), path) === undefined || null, onclick: () => edit(path, undefined)}, '↺');

async function resetAll(sec, name)
{
    if (getAt(ST.over(), [sec]) === undefined) return;
    if (await ask(`${name}全部回到內建值`, '改過的數字會清掉（可以 undo）', [['ok', '回到內建'], ['cancel', '取消']]) === 'ok') edit([sec], undefined);
}

const title = (text, sec) => h('h3', null, text, h('button', {disabled: getAt(ST.over(), [sec]) === undefined || null, onclick: () => resetAll(sec, text)}, '全部回到內建'));

function stepTable()
{
    return h('table', {class: 'grid'},
        h('tr', null, STEP_COLS.map(([, lab]) => h('th', null, lab))),
        h('tr', null, STEP_COLS.map(([k]) => numCell(['step', k]))));
}

function autoTable()
{
    const rows = AUTO_ROWS.flatMap(([grp, list]) => [
        h('tr', null, h('td', {class: 'k', colspan: AUTO_COLS.length + 2}, h('b', null, grp))),
        ...list.map(([lab, p]) => {
            const path = ['auto', ...p], def = getAt(ST.DEF, path);
            return h('tr', {class: 'sub'}, h('td', {class: 'k'}, lab),
                AUTO_COLS.map(f => f in def ? numCell([...path, f]) : h('td', {class: 'na'})),
                h('td', null, resetBtn(path, `${grp} ${lab} 整列回到內建`)));
        }),
    ]);
    const pt = ['auto', 'portrait'];
    return [
        h('table', {class: 'grid'}, h('tr', null, h('th'), AUTO_COLS.map(f => h('th', null, AUTO_LABS[f] ?? f)), h('th')), rows),
        h('div', {class: 'title'}, '頭像合成'),
        h('table', {class: 'grid'},
            h('tr', null, PT_COLS.map(([, lab]) => h('th', null, lab)), h('th')),
            h('tr', null, PT_COLS.map(([k]) => numCell([...pt, k])), h('td', null, resetBtn(pt, '頭像合成回到內建')))),
    ];
}

function render()
{
    const focus = document.activeElement?.dataset?.k;
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1;
    $('view').replaceChildren(...(ST.ready() ? [
        title('步進（數字欄 ↑↓ 一次多少）', 'step'), stepTable(),
        h('div', {class: 'hint'}, '紙娃娃（自動表、圖層屬性、批次存武器）、試穿共用；Shift＋方向鍵 ×10'),
        title('紙娃娃自動拆圖', 'auto'),
        h('div', {class: 'hint'}, '就是紙娃娃自動面板目前的數字：那邊調了這裡跟著變，這裡改了下次拆圖照這組；紙娃娃的「重設」＝回到內建'),
        ...autoTable(),
    ] : [h('div', {class: 'hint'}, '等專案資料夾…')]));
    ST.applySteps();
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    else if (k === 'y' || k === 'z' && e.shiftKey) {e.preventDefault(); redo();}
});

ST.onChange(() => {resetHist(); render();});
SH.onProject(async (dir) => {
    try {await ST.load(dir); status('');}
    catch (e) {status(`tools/settings.json 讀不到：${e.message}`);}
    resetHist();
    render();
});
render();

// 給無頭測試用
window.__st = {S, ST, edit, undo, redo, render, resetAll};
