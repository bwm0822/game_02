import {$, h, ul, ask, status} from '../common/dom.js';
import {createDoc} from '../common/doc.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import {scan} from './scan.js';

// local.json = {key: {lab, des?, grp?}}：UI 原文表，遊戲用 'key'.lab()；grp 只給這個工具分組（舊 local.xlsx 的分頁名）
const GROUPS = {general: '一般', items: '道具', jobs: '職業', stat: '屬性', tag: '標籤', other: '其他', quest: '任務', ability: '能力樹', option: '互動選項', msg: '訊息'};
const ALL = '#all', NONE = '#none', MISS = '#miss', UNUSED = '#unused';

const D = createDoc({
    file: 'local.json', noun: '筆文字',
    external: '可能是能力分頁（樹名）存過，或手動改的。',
    draw, validateAll: () => Object.keys(S.data).filter(k => !S.data[k].lab).map(k => `${k}：沒有 lab（遊戲會顯示紅字 key）`),
    onNew: () => askNew(),
    innerRefs: (id) => [`lang/*.json 的情境 ui.${id}（存檔時一起改名，譯文不會變 orphan）`],
    renameRefs: (from, to) => S.renames.push([from, to]),
    onSaved: (file) => {if (file !== 'local.json' && file.endsWith('.json') && S.assets) rescan();},
    afterSave: () => renameLang(),
});
const {S, render, commit} = D;
S.node = ALL;
S.scan = null;
S.renames = [];         // 還沒套到翻譯檔的改名 [[from, to]]，存檔後套
S.quiet = null;         // 只改了一列的 lab/des：就地更新那一列，不重建表格

const grpOf = (k) => S.data[k]?.grp || NONE;
const usesOf = (k) => S.scan?.uses.get(k) ?? [];
const isUnused = (k) => S.scan?.scanned && !usesOf(k).length;
const missing = () => S.scan ? [...S.scan.needs.keys()].filter(k => !(k in S.data)) : [];

// ---------- 掃描 ----------
async function rescan()
{
    if (!S.assets) return;
    status('掃描中…');
    S.scan = await scan(S.assets);
    render();
    status(S.scan.scanned ? `${Object.keys(S.data).length} 筆、缺少 ${missing().length}、未使用 ${Object.keys(S.data).filter(isUnused).length}`
                          : '沒有專案根目錄，只掃了資料 json（未使用不準）');
}

// ---------- 編輯 ----------
function setField(k, f, v)
{
    if ((S.data[k]?.[f] ?? '') === v) return;
    S.quiet = k;
    commit(() => {if (v) S.data[k][f] = v; else delete S.data[k][f];});
    S.quiet = null;
}

const setGrp = (k, g) => commit(() => {S.data[k].grp = g;});

// 新的一筆放在同組最後一筆後面，讓同組排在一起
function insert(key, value)
{
    const keys = Object.keys(S.data);
    let at = keys.length;
    for (let i = keys.length - 1; i >= 0; i--) if (S.data[keys[i]].grp === value.grp) {at = i + 1; break;}
    commit(() => {D.insertAt(at, key, value); S.sel = key;});
}

function guessGrp(k)
{
    if (k.startsWith('_')) return 'msg';
    const locs = S.scan?.needs.get(k) ?? [];
    if (locs.some(l => l.startsWith('role.json'))) return 'jobs';
    if (locs.some(l => l.startsWith('ab_tree.json'))) return 'ability';
    return GROUPS[S.node] ? S.node : 'general';
}

async function askNew(key = '')
{
    if (!S.assets) return status('先在上方選擇專案資料夾');
    const id = h('input', {size: 24, value: key}), lab = h('input', {size: 32});
    const grp = h('select', null, Object.entries(GROUPS).map(([g, t]) => h('option', {value: g, selected: g === guessGrp(key)}, `${g}　${t}`)));
    const p = ask(key ? `補上 ${key}` : '新增文字', [h('div', {class: 'fields'},
        h('span', {class: 'k'}, 'key'), id, h('span', {class: 'k'}, 'lab（原文）'), lab, h('span', {class: 'k'}, '分組'), grp),
        h('div', {class: 'hint'}, 'key 只能用英數字、底線、減號；_ 開頭習慣上是訊息模板（{#name} 是佔位符）')], [['ok', '新增'], ['cancel', '取消']]);
    (key ? lab : id).focus();
    if (await p !== 'ok') return;
    const k = id.value.trim(), err = D.idError(k);
    if (err) return status(err);
    insert(k, {lab: lab.value.trim(), grp: grp.value});
    S.node = grp.value;
    S.search = $('search').value = '';
    render();
    flash(k, true);
}

// ---------- 改名：存檔後把 lang/*.json 的情境 ui.<舊> 一起改 ----------
async function renameLang()
{
    const map = new Map();
    for (const [from, to] of S.renames)
    {
        const orig = [...map].find(([, v]) => v === from)?.[0] ?? from;
        map.set(orig, to);
    }
    S.renames = [];
    const todo = [...map].filter(([a, b]) => a !== b && !(a in S.data) && b in S.data);
    const dir = todo.length && await FS.tryDir(S.assets.dir, 'lang');
    if (!dir) return;
    const done = [];
    for (const {name} of (await FS.listDir(dir)).files)
    {
        if (!name.endsWith('.json')) continue;
        const data = JSON.parse(await FS.readText(dir, name));
        let changed = false;
        for (const [a, b] of todo)
        {
            const from = `ui.${a}`, to = `ui.${b}`;
            if (!data[from]) continue;
            const merged = {...data[from], ...data[to]};
            const out = {};
            for (const [k, v] of Object.entries(data)) if (k !== to) out[k === from ? to : k] = k === from ? merged : v;
            for (const k of Object.keys(data)) delete data[k];
            Object.assign(data, out);
            changed = true;
        }
        if (!changed) continue;
        await FS.writeFile(dir, name, new Blob([JSON.stringify(data, null, 2)]));
        SH.notifySaved(name);
        done.push(name);
    }
    if (done.length) status(`已存檔，翻譯情境一起改名：${done.join('、')}`);
}

// ---------- 左欄 ----------
function renderList()
{
    const keys = Object.keys(S.data);
    const cnt = {};
    for (const k of keys) cnt[grpOf(k)] = (cnt[grpOf(k)] ?? 0) + 1;
    const groups = [...Object.keys(GROUPS).filter(g => cnt[g]), ...Object.keys(cnt).filter(g => !GROUPS[g] && g !== NONE), ...(cnt[NONE] ? [NONE] : [])];
    const node = (id, name, n, cls = '') => h('div', {class: `node ${cls}` + (S.node === id ? ' sel' : ''), dataset: {node: id}, onclick: () => {S.node = id; render();}},
        h('span', null, name), h('span', {class: 'cnt' + (cls.includes('w') && n ? ' warn' : '')}, n));
    $('list').replaceChildren(
        node(ALL, '全部', keys.length),
        ...groups.map(g => node(g, g === NONE ? '（未分組）' : `${g}　${GROUPS[g] ?? ''}`, cnt[g])),
        node(MISS, '⚠ 缺少', S.scan ? missing().length : '…', 'gap w'),
        node(UNUSED, '未使用', S.scan?.scanned ? keys.filter(isUnused).length : '…'));
}

// ---------- 表格 ----------
const lines = (s) => (s ?? '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / 30)), 0);
const fit = (ta) => {ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px';};

function focusNext(ta, dir)
{
    const td = ta.closest('td'), col = [...td.parentElement.children].indexOf(td);
    let tr = td.parentElement;
    do tr = dir > 0 ? tr.nextElementSibling : tr.previousElementSibling;
    while (tr && !tr.children[col]?.querySelector('textarea'));
    const next = tr?.children[col].querySelector('textarea');
    if (next) {next.focus(); next.select();}
}

function textCell(k, f)
{
    const v = S.data[k][f] ?? '';
    const ta = h('textarea', {rows: lines(v), value: v, placeholder: f === 'des' ? '（說明）' : '',
        oninput: () => fit(ta),
        onchange: () => setField(k, f, ta.value),
        onkeydown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {e.preventDefault(); setField(k, f, ta.value); focusNext(ta, e.ctrlKey ? -1 : 1);}
            if (e.key === 'Escape') {ta.value = S.data[k][f] ?? ''; fit(ta); ta.blur();}
        }});
    return h('td', null, ta);
}

function showRefs(k)
{
    const u = usesOf(k), n = S.scan?.needs.get(k) ?? [];
    ask(`${k} 用在哪`, [
        u.length ? ul(u) : h('div', {class: 'dim'}, '（沒找到；動態組出來的 key，例如 `${x}`.lab()，掃不到）'),
        n.length > 0 && h('div', {class: 'hint'}, `明確查表的有 ${n.length} 處`),
    ], [['ok', '關閉']]);
}

async function menu(k)
{
    const r = await ask(k, h('div', {class: 'dim'}, S.data[k].lab ?? ''), [['rename', '改名…'], ['remove', '刪除…'], ['lang', '翻譯 ↗'], ['cancel', '取消']]);
    if (r === 'rename') D.askRename(k);
    if (r === 'remove') D.remove(k);
    if (r === 'lang') SH.gotoTab('lang', [`ui.${k}`]);
}

function rowEl(k)
{
    const v = S.data[k], n = usesOf(k).length;
    const dirty = JSON.stringify(v) !== JSON.stringify(S.saved[k]);
    const grps = [...new Set([...Object.keys(GROUPS), ...(v.grp ? [v.grp] : [])])];
    return h('tr', {class: [isUnused(k) && 'unused', dirty && 'dirty'].filter(Boolean).join(' '), dataset: {k}},
        h('td', {class: 'key'}, k),
        textCell(k, 'lab'),
        textCell(k, 'des'),
        h('td', null, h('select', {onchange: (e) => setGrp(k, e.target.value)},
            !v.grp && h('option', {value: '', selected: true}, '（未分組）'),
            grps.map(g => h('option', {value: g, selected: g === v.grp}, GROUPS[g] ? `${g} ${GROUPS[g]}` : g)))),
        h('td', {class: 'refs'}, S.scan ? h('a', {title: '點了看用在哪', onclick: () => showRefs(k)}, `${n}`) : '…'),
        h('td', null, h('button', {title: '改名／刪除／翻譯', onclick: () => menu(k)}, '⋯')));
}

const COLS = [['key', '18%'], ['lab（原文）', '30%'], ['des（說明）', '26%'], ['分組', '12%'], ['引用', '56px'], ['', '48px']];

function visibleKeys()
{
    const q = S.search.trim().toLowerCase(), keys = Object.keys(S.data);
    if (q) return keys.filter(k => [k, S.data[k].lab ?? '', S.data[k].des ?? ''].some(s => s.toLowerCase().includes(q)));
    if (S.node === UNUSED) return keys.filter(isUnused);
    if (S.node === ALL) return keys;
    return keys.filter(k => grpOf(k) === S.node);
}

function renderMissing()
{
    const list = missing();
    $('view').replaceChildren(
        h('div', {class: 'hint'}, '程式碼明確寫了 \'key\'.lab()／Local.lab(\'key\')，或 role.json 的 job、ab_tree.json 的樹名有用到，但 local.json 沒有（遊戲會顯示紅字 key）'),
        list.length ? h('table', {class: 'tx'},
            h('thead', null, h('tr', null, h('th', {style: 'width: 18%'}, 'key'), h('th', null, '用到的地方'), h('th', {style: 'width: 80px'}, ''))),
            h('tbody', null, list.map(k => h('tr', {class: 'miss', dataset: {k}},
                h('td', {class: 'key'}, k),
                h('td', null, h('div', {class: 'locs'}, S.scan.needs.get(k).slice(0, 5).join('\n'))),
                h('td', null, h('button', {onclick: () => askNew(k)}, '＋ 補上'))))))
            : h('div', {class: 'dim'}, S.scan ? '（沒有缺少的）' : '掃描中…'));
}

function renderTable()
{
    if (S.node === MISS && !S.search.trim()) return renderMissing();
    const keys = visibleKeys();
    $('view').replaceChildren(keys.length
        ? h('table', {class: 'tx'},
            h('colgroup', null, COLS.map(([, w]) => h('col', {style: `width: ${w}`}))),
            h('thead', null, h('tr', null, COLS.map(([t]) => h('th', null, t)))),
            h('tbody', null, keys.map(rowEl)))
        : h('div', {class: 'dim'}, S.assets ? '（沒有符合的）' : '先在上方選擇專案資料夾'));
    for (const ta of $('view').querySelectorAll('textarea')) fit(ta);
}

// 只改了一列：換掉 lab／des 以外的格子（打字中的 textarea 留著）
function patchRow(k)
{
    const tr = document.querySelector(`#view tr[data-k="${CSS.escape(k)}"]`);
    if (!tr || !S.data[k]) return false;
    const fresh = rowEl(k), cells = [...fresh.children];
    [...tr.children].forEach((td, i) => {if (i !== 1 && i !== 2) td.replaceWith(cells[i]);});
    tr.className = fresh.className;
    return true;
}

function flash(k, focus)
{
    const tr = document.querySelector(`#view tr[data-k="${CSS.escape(k)}"]`);
    if (!tr) return;
    tr.scrollIntoView({block: 'center'});
    tr.classList.add('flash');
    setTimeout(() => tr.classList.remove('flash'), 1200);
    if (focus) tr.querySelector('textarea')?.focus();
}

function draw()
{
    renderList();
    if (!(S.quiet && patchRow(S.quiet))) renderTable();
}

// 翻譯分頁的 ↗：path = [key]；還沒讀檔就等讀完
let pending = null;
function gotoKey(k)
{
    if (!S.data[k]) return;
    S.node = grpOf(k);
    S.search = $('search').value = '';
    render();
    flash(k);
}
SH.onGoto(([k]) => {if (S.data[k]) gotoKey(k); else pending = k;});

$('btnScan').onclick = rescan;

render();
D.start(async (dir) => {
    await D.setAssets(dir);
    await rescan();
    if (pending) {gotoKey(pending); pending = null;}
});

// 給無頭測試用
window.__lc = {S, D, render, rescan, setField, setGrp, insert, askNew, renameLang, missing, isUnused, gotoKey};
