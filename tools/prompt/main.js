// 提示詞：管理給 AI 生圖用的提示詞（{items: {分類: [{name, desc, common}]}, common: {名稱: 文字}}），組好按複製貼到外面
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import {$, h, ul, ask, status} from '../common/dom.js';
import {str, merge3} from '../common/obj.js';
import '../common/splitter.js';

const PATH_KEY = 'tools.prompt.path';
const DEFAULT_PATH = 'prompts/prompt.json';
const SKELETON = {items: {武器: [], 護具: [], 道具: []}, common: {武器: '', 護具: '', 道具: ''}};

const S = {
    root: null,
    path: DEFAULT_PATH,
    data: null,
    saved: null,
    diskText: null,
    mode: 'items',          // 選的是哪一種：items | common
    sel: null,              // items：{cat, i}；common：名稱
    search: '',
    fold: new Set(),        // 摺起來的分組：分類名稱，共用組是 COMMON
    hist: [], hi: -1,
};
const COMMON = '\0common';

try {S.path = localStorage.getItem(PATH_KEY) || DEFAULT_PATH;}
catch {}

const norm = (d) => ({...d, items: d?.items ?? {}, common: d?.common ?? {}});
const isDirty = () => !!S.data && str(S.data) !== str(S.saved);
const view = () => ({mode: S.mode, sel: structuredClone(S.sel)});
const selItem = () => S.mode === 'items' && S.sel ? S.data?.items[S.sel.cat]?.[S.sel.i] : null;

// common 有 {desc}／{name} 就代換進去，沒有就接在描述後面
export function compose(it, common)
{
    const c = common[it.common] ?? '';
    if (/\{(desc|name)\}/.test(c)) return c.replaceAll('{desc}', it.desc ?? '').replaceAll('{name}', it.name ?? '');
    return [it.desc, c].filter(Boolean).join('\n');
}

// ---------- 歷史 ----------
function commit(fn)
{
    const before = view(), prev = str(S.data);
    fn();
    const now = str(S.data);
    if (now !== prev)
    {
        S.hist.length = S.hi + 1;
        S.hist.push({data: now, before, after: view()});
        if (S.hist.length > 300) S.hist.shift();
        S.hi = S.hist.length - 1;
    }
    render();
}

const restore = (v) => {S.mode = v.mode; S.sel = structuredClone(v.sel);};

function undo()
{
    if (S.hi <= 0) return;
    restore(S.hist[S.hi].before);
    S.data = JSON.parse(S.hist[--S.hi].data);
    render();
}

function redo()
{
    if (S.hi >= S.hist.length - 1) return;
    const e = S.hist[++S.hi];
    S.data = JSON.parse(e.data);
    restore(e.after);
    render();
}

// ---------- 讀寫 ----------
const segs = () => S.path.split('/').filter(Boolean);

async function fileDir(create)
{
    let dir = S.root;
    for (const seg of segs().slice(0, -1)) if (!(dir = create ? await dir.getDirectoryHandle(seg, {create: true}) : await FS.tryDir(dir, seg))) return null;
    return dir;
}

function loaded(text)
{
    S.diskText = text;
    S.saved = norm(JSON.parse(text));
    S.data = structuredClone(S.saved);
    S.hist = [{data: str(S.data), before: view(), after: view()}];
    S.hi = 0;
    if (S.mode === 'items' ? !selItem() : !(S.sel in S.data.common)) S.sel = null;
}

async function load()
{
    if (!S.root) return;
    S.data = null;
    const dir = await fileDir(false), name = segs().at(-1);
    if (!name) {render(); return status('檔案路徑是空的');}
    if (!dir || !await FS.tryFile(dir, name))
    {
        render();
        if (await ask(`沒有 ${S.path}`, '要建立一個空的骨架嗎？', [['ok', '建立'], ['cancel', '取消']]) !== 'ok') return status(`沒有 ${S.path}`);
        await FS.writeFile(await fileDir(true), name, new Blob([JSON.stringify(SKELETON, null, 2)]));
    }
    try {loaded(await FS.readText(await fileDir(false), name));}
    catch (e) {render(); return status(`${S.path} 讀不了：${e.message}`);}
    status(`讀入 ${Object.values(S.data.items).flat().length} 個物品、${Object.keys(S.data.common).length} 個共用`);
    render();
}

async function setRoot(dir)
{
    S.root = dir;
    await load();
}

async function save()
{
    if (!S.data) return;
    const dir = await fileDir(true), name = segs().at(-1);
    const disk = await FS.tryFile(dir, name) ? await FS.readText(dir, name) : null;
    if (disk !== S.diskText)
    {
        const base = norm(JSON.parse(S.diskText)), theirs = norm(disk ? JSON.parse(disk) : {});
        const mi = merge3(base.items, S.data.items, theirs.items), mc = merge3(base.common, S.data.common, theirs.common);
        const r = await ask(`${S.path} 在讀進來之後被改過了`, [
            h('div', null, '物品以分類為單位合併，共用以每一條為單位'),
            (mi.external.length || mc.external.length) && h('div', null, `外部改了：${[...mi.external, ...mc.external].join('、')}`),
            (mi.conflict.length || mc.conflict.length) && h('div', {class: 'warn'}, `兩邊都改了（合併時以這裡的為準）：${[...mi.conflict, ...mc.conflict].join('、')}`),
        ], [['merge', '合併後存檔'], ['overwrite', '直接覆蓋'], ['cancel', '取消']]);
        if (r !== 'merge' && r !== 'overwrite') return status('取消存檔');
        if (r === 'merge') commit(() => {S.data = {...S.data, items: mi.data, common: mc.data};});
    }
    const text = JSON.stringify(S.data, null, 2);
    await FS.writeFile(dir, name, new Blob([text]));
    S.diskText = text;
    S.saved = JSON.parse(text);
    SH.notifySaved(S.path);
    status(`已存檔 ${new Date().toLocaleTimeString()}`);
    render();
}

async function setPath(path)
{
    path = path.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (path === S.path && S.data) return;
    if (isDirty() && await ask('換檔案', '還沒存檔的修改會不見', [['ok', '換'], ['cancel', '取消']]) !== 'ok') {$('path').value = S.path; return;}
    S.path = path;
    try {localStorage.setItem(PATH_KEY, path);}
    catch {}
    await load();
}

// ---------- 物品 ----------
function uniqueName(base, has)
{
    let n = base;
    for (let i = 2; has(n); i++) n = `${base}${i}`;
    return n;
}

function addItem(cat)
{
    commit(() => {
        const list = S.data.items[cat];
        list.push({name: '新物品', desc: '', common: cat in S.data.common ? cat : ''});
        S.mode = 'items';
        S.sel = {cat, i: list.length - 1};
    });
}

function dupItem({cat, i})
{
    commit(() => {
        S.data.items[cat].splice(i + 1, 0, structuredClone(S.data.items[cat][i]));
        S.sel = {cat, i: i + 1};
    });
}

function removeItem({cat, i})
{
    commit(() => {
        const list = S.data.items[cat];
        list.splice(i, 1);
        S.sel = list.length ? {cat, i: Math.min(i, list.length - 1)} : null;
    });
}

// to.i 是插在誰前面（= 長度就放最後）；可以跨分類
function moveItem(from, to)
{
    commit(() => {
        const [it] = S.data.items[from.cat].splice(from.i, 1);
        let i = to.i;
        if (from.cat === to.cat && from.i < i) i--;
        S.data.items[to.cat].splice(i, 0, it);
        S.sel = {cat: to.cat, i};
    });
}

const setItem = (sel, k, v) => commit(() => {S.data.items[sel.cat][sel.i][k] = v;});

async function askName(title, value)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, inp, [['ok', '確定'], ['cancel', '取消']]);
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

async function addCat()
{
    const name = await askName('新分類', uniqueName('新分類', n => n in S.data.items));
    if (!name) return;
    if (name in S.data.items) return status(`分類「${name}」已經有了`);
    commit(() => {S.data.items[name] = [];});
}

function renameKey(obj, from, to)
{
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));
}

async function renameCat(from)
{
    const to = await askName(`分類改名 ${from}`, from);
    if (!to || to === from) return;
    if (to in S.data.items) return status(`分類「${to}」已經有了`);
    commit(() => {
        S.data.items = renameKey(S.data.items, from, to);
        if (S.sel?.cat === from) S.sel.cat = to;
    });
}

async function removeCat(cat)
{
    const n = S.data.items[cat].length;
    if (n && await ask(`刪除分類 ${cat}`, `裡面還有 ${n} 個物品，會一起刪掉`, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    commit(() => {
        delete S.data.items[cat];
        if (S.sel?.cat === cat) S.sel = null;
    });
}

// ---------- 共用 ----------
function addCommon()
{
    commit(() => {
        const name = uniqueName('新共用', n => n in S.data.common);
        S.data.common[name] = '';
        S.mode = 'common';
        S.sel = name;
    });
}

// 改名連物品的引用一起改
function renameCommon(from, to)
{
    to = to.trim();
    if (!to || to === from) return render();
    if (to in S.data.common) {render(); return status(`共用「${to}」已經有了`);}
    commit(() => {
        S.data.common = renameKey(S.data.common, from, to);
        for (const it of Object.values(S.data.items).flat()) if (it.common === from) it.common = to;
        S.sel = to;
    });
}

// 用到的物品照留，下拉會顯示遺失
function removeCommon(name)
{
    const keys = Object.keys(S.data.common), i = keys.indexOf(name);
    commit(() => {
        delete S.data.common[name];
        S.sel = keys[i + 1] ?? keys[i - 1] ?? null;
    });
}

const usersOf = (name) => Object.entries(S.data.items).flatMap(([cat, list]) => list.flatMap((it, i) => it.common === name ? [{cat, i, it}] : []));

// ---------- 畫面 ----------
let drag = null;

function dropTarget(el, to)
{
    el.ondragover = (e) => {if (drag) {e.preventDefault(); el.classList.add('drop');}};
    el.ondragleave = () => el.classList.remove('drop');
    el.ondrop = (e) => {e.preventDefault(); el.classList.remove('drop'); if (drag) moveItem(drag, to);};
}

// 再點一次選到的就取消選擇
const pick = (mode, sel) => {S.mode = mode; S.sel = sel; render();};

// 搜尋中全部展開
const folded = (key) => !S.search && S.fold.has(key);

// Alt＋點：所有組跟著被點的那組一起摺／展開
function groupHead(key, label, title, ...buttons)
{
    const inside = (k) => k === COMMON ? S.mode === 'common' : S.mode === 'items' && S.sel?.cat === k;
    const toggle = (all) => {
        const fold = !S.fold.has(key);
        for (const k of all ? [COMMON, ...Object.keys(S.data.items)] : [key])
        {
            if (!fold) S.fold.delete(k);
            else {S.fold.add(k); if (inside(k)) S.sel = null;}
        }
        render();
    };
    return h('div', {class: 'group', title: `${title}，Alt＋點全部`, onclick: (e) => {if (!e.target.closest('button')) toggle(e.altKey);}},
        h('span', {class: 'arrow'}, folded(key) ? '▸' : '▾'),
        h('span', {class: 'name'}, label),
        ...buttons);
}

function drawItemList()
{
    const q = S.search.toLowerCase();
    const hit = (it) => !q || `${it.name}\n${it.desc}`.toLowerCase().includes(q);
    const rows = [];
    for (const [cat, list] of Object.entries(S.data.items))
    {
        const g = groupHead(cat, `${cat}（${list.length}）`, '點一下摺疊，雙擊改名',
            h('button', {title: '新增物品', onclick: () => {S.fold.delete(cat); addItem(cat);}}, '＋'),
            h('button', {title: '刪除分類', onclick: () => removeCat(cat)}, '✕'));
        g.ondblclick = (e) => {if (!e.target.closest('button')) renameCat(cat);};
        dropTarget(g, {cat, i: list.length});
        rows.push(g);
        if (folded(cat)) continue;
        list.forEach((it, i) => {
            if (!hit(it)) return;
            const lost = it.common && !(it.common in S.data.common);
            const on = S.mode === 'items' && S.sel?.cat === cat && S.sel.i === i;
            const row = h('div', {class: `item${on ? ' sel' : ''}`, draggable: 'true', onclick: () => pick('items', on ? null : {cat, i})},
                h('span', {class: 'id'}, it.name || '（未命名）'),
                lost && h('span', {class: 'mark missing', title: `共用「${it.common}」遺失`}, '⚠'));
            row.ondragstart = (e) => {drag = {cat, i}; e.dataTransfer.effectAllowed = 'move';};
            row.ondragend = () => {drag = null;};
            dropTarget(row, {cat, i});
            rows.push(row);
        });
    }
    return rows;
}

// 放在所有分類前面
function drawCommonList()
{
    const q = S.search.toLowerCase();
    return [
        groupHead(COMMON, `⚙ 共用（${Object.keys(S.data.common).length}）`, '點一下摺疊',
            h('button', {title: '新增共用', onclick: () => {S.fold.delete(COMMON); addCommon();}}, '＋')),
        folded(COMMON) ? [] : Object.entries(S.data.common)
            .filter(([k, v]) => !q || `${k}\n${v}`.toLowerCase().includes(q))
            .map(([k]) => h('div', {class: `item${S.mode === 'common' && S.sel === k ? ' sel' : ''}`, onclick: () => pick('common', S.mode === 'common' && S.sel === k ? null : k)},
                h('span', {class: 'id'}, k))),
    ];
}

function copy(text)
{
    navigator.clipboard.writeText(text).then(() => status('已複製'), e => status(`複製失敗：${e.message}`));
}

function drawItem()
{
    const sel = S.sel, it = selItem(), common = S.data.common;
    const lost = it.common && !(it.common in common);
    const out = h('pre', {class: 'out'}, compose(it, common));
    const live = (k) => (e) => {out.textContent = compose({...it, [k]: e.target.value}, common);};
    const select = h('select', {class: lost ? 'missing' : null, onchange: (e) => setItem(sel, 'common', e.target.value)},
        h('option', {value: ''}, '（無）'),
        Object.keys(common).map(k => h('option', {value: k}, k)),
        lost && h('option', {value: it.common, class: 'missing'}, `${it.common}（遺失）`));
    select.value = it.common ?? '';
    return [
        h('div', {class: 'head'},
            h('span', {class: 'bigid'}, it.name || '（未命名）'),
            h('span', {class: 'dim'}, sel.cat),
            h('span', {class: 'grow'}),
            h('button', {onclick: () => dupItem(sel)}, '複製物品'),
            h('button', {onclick: () => removeItem(sel)}, '刪除')),
        h('div', {class: 'fields'},
            h('span', {class: 'k'}, '名稱'),
            h('input', {'data-k': 'name', value: it.name ?? '', oninput: live('name'), onchange: (e) => setItem(sel, 'name', e.target.value)}),
            h('span', {class: 'k'}, '共用'),
            h('div', null, select),
            h('span', {class: 'k'}, '描述'),
            h('textarea', {'data-k': 'desc', value: it.desc ?? '', oninput: live('desc'), onchange: (e) => setItem(sel, 'desc', e.target.value)})),
        h('div', {class: 'row2'}, h('span', {class: 'title'}, '組合結果'), h('button', {onclick: () => copy(out.textContent)}, '複製提示詞')),
        out,
    ];
}

function drawCommon()
{
    const name = S.sel, users = usersOf(name);
    return [
        h('div', {class: 'head'},
            h('input', {'data-k': 'cname', class: 'bigid', value: name, title: '改名會連物品的引用一起改', onchange: (e) => renameCommon(name, e.target.value)}),
            h('span', {class: 'grow'}),
            h('button', {onclick: () => removeCommon(name)}, '刪除')),
        h('div', {class: 'hint'}, '可用 {desc}、{name} 把物品的描述／名稱代換進來；沒有的話會接在描述後面（描述＋換行＋這段）'),
        h('textarea', {'data-k': 'ctext', rows: 12, value: S.data.common[name], onchange: (e) => commit(() => {S.data.common[name] = e.target.value;})}),
        h('div', {class: 'title'}, `用到的物品（${users.length}）`),
        users.length
            ? h('div', {class: 'users'}, ul(users.map(u => h('a', {onclick: () => {S.mode = 'items'; S.sel = {cat: u.cat, i: u.i}; render();}}, `${u.cat}／${u.it.name || '（未命名）'}`))))
            : h('div', {class: 'dim'}, '（沒有）'),
    ];
}

function render()
{
    const focus = document.activeElement?.dataset?.k;
    const has = !!S.data;
    $('path').value = S.path;
    $('btnUndo').disabled = S.hi <= 0 || !has;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1 || !has;
    $('btnSave').disabled = $('btnReload').disabled = $('btnNew').disabled = !has;
    $('btnLoad').disabled = !S.root;
    $('dirty').hidden = !isDirty();
    SH.setDirty(isDirty());
    $('list').replaceChildren(...(has ? [...drawCommonList().flat(), ...drawItemList()] : []));
    const body = !has ? [h('div', {class: 'dim'}, S.root ? '' : '要從 /tools/ 開、選好專案資料夾')]
        : S.mode === 'items' ? (selItem() ? drawItem() : [h('div', {class: 'dim'}, '左邊選一個物品')])
        : S.sel in S.data.common ? drawCommon() : [h('div', {class: 'dim'}, '左邊選一個共用')];
    $('view').replaceChildren(...body);
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

// ---------- 事件 ----------
$('btnLoad').onclick = () => setPath($('path').value);
$('path').onkeydown = (e) => {if (e.key === 'Enter') setPath($('path').value);};
$('btnReload').onclick = async () => {
    if (isDirty() && await ask('重新讀取', '還沒存檔的修改會不見', [['ok', '重新讀取'], ['cancel', '取消']]) !== 'ok') return;
    load();
};
$('btnSave').onclick = save;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnNew').onclick = addCat;
$('search').oninput = (e) => {S.search = e.target.value; render();};

addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
    if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});

SH.onSaved((file) => {
    if (file !== S.path || !S.data) return;
    if (isDirty()) status(`${file} 在別的分頁存過了，存檔時會合併`);
    else load().then(() => status(`${file} 在別的分頁存過了，已重讀`)).catch(e => status(e.message));
});
SH.onProject(dir => setRoot(dir).catch(e => status(e.message)));
render();

// 給無頭測試用
window.__pe = {S, setRoot, setPath, load, save, compose, commit, undo, redo, addItem, dupItem, removeItem, moveItem, setItem,
               addCat, renameCat, removeCat, addCommon, renameCommon, removeCommon, usersOf};
