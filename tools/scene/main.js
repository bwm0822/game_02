// 場景分頁：iframe 跑遊戲本身（開發版 /?sandbox，src/scenes/Sandbox.js），左欄場景清單、tools/scenes.json 立刻寫檔＋undo；見 docs/scene-tool.md
// 跟 sandbox 的訊息都帶 sb 欄位：→ load {scene}／grid {on}／home；← ready（剛開好、還沒載場景）／loaded {map}／error {msg}
import '../common/splitter.js';
import {$, h, status, ask} from '../common/dom.js';
import * as SH from '../common/shell.js';
import * as ST from './store.js';

const LS = {sel: 'tools.scene.sel', grid: 'tools.scene.grid'};
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};

const S = {
    root: null,
    data: {},
    sel: ls.get(LS.sel),
    undo: [],
    redo: [],
    ready: false,       // sandbox 開好了
    grid: ls.get(LS.grid) !== '0',
    q: Promise.resolve(),
};

const frame = $('game');
const toGame = (msg) => S.ready && frame.contentWindow?.postMessage(msg, '*');

// 寫檔一個接一個，不會兩次讀到同一份
const queue = (fn) => (S.q = S.q.then(fn).catch(e => status(e.message)));

// ---------- 編輯（立刻寫檔＋undo） ----------
function commit(fn, sel)
{
    return queue(async () => {
        const r = await ST.edit(fn);
        if (!r) return;
        S.undo.push({before: r.before, after: r.after, sel: [S.sel, sel === undefined ? S.sel : sel]});
        S.redo = [];
        S.data = r.data;
        if (sel !== undefined) select(sel, false);
        refresh();
    });
}

const step = (from, to, i, j) => queue(async () => {
    const u = from.pop();
    if (!u) return;
    try {S.data = await ST.restore(i === 0 ? u.after : u.before, i === 0 ? u.before : u.after);}
    catch (e) {from.push(u); throw e;}
    to.push(u);
    select(u.sel[j] in S.data ? u.sel[j] : null, false);
    refresh();
});
const undo = () => step(S.undo, S.redo, 0, 0);
const redo = () => step(S.redo, S.undo, 1, 1);

// ---------- 場景清單 ----------
const uniq = (base) => {let n = base; for (let i = 2; n in S.data; i++) n = `${base}${i}`; return n;};

function nameError(name, from)
{
    if (!name) return '名稱不能空白';
    if (name !== from && name in S.data) return `已經有「${name}」`;
}

async function askName(title, value)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, h('label', null, '名稱 ', inp), [['ok', '確定'], ['cancel', '取消']]);
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

async function addScene(name)
{
    name ??= await askName('新場景', uniq('場景'));
    if (name === null) return;
    const err = nameError(name);
    if (err) return status(err);
    await commit(d => {d[name] = ST.newScene();}, name);
}

async function dupScene(from, name)
{
    name ??= await askName(`複製 ${from}`, uniq(`${from}-複製`));
    if (name === null) return;
    const err = nameError(name);
    if (err) return status(err);
    await commit(d => {
        if (!(from in d)) throw new Error(`找不到「${from}」`);
        d[name] = structuredClone(d[from]);
    }, name);
}

async function renameScene(from, to)
{
    to ??= await askName(`改名 ${from}`, from);
    if (to === null || to === from) return;
    const err = nameError(to, from);
    if (err) return status(err);
    await commit(d => {
        if (!(from in d)) throw new Error(`找不到「${from}」`);
        ST.renameKey(d, from, to);
    }, S.sel === from ? to : S.sel);
}

async function deleteScene(name, sure)
{
    if (!sure && await ask('刪除場景', `「${name}」會從 scenes.json 拿掉（可以復原）`, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    await commit(d => {delete d[name];}, S.sel === name ? null : S.sel);
}

function select(name, sync = true)
{
    S.sel = name;
    ls.set(LS.sel, name ?? '');
    if (sync) refresh();
}

function menu(e, items)
{
    e.preventDefault();
    document.querySelector('.ctxmenu')?.remove();
    const m = h('div', {class: 'ctxmenu'}, items.map(([t, fn]) => h('button', {onclick: () => {m.remove(); fn();}}, t)));
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
    m.style.top = `${Math.min(e.clientY, innerHeight - r.height - 4)}px`;
}
addEventListener('pointerdown', (e) => {if (!e.target.closest('.ctxmenu')) document.querySelector('.ctxmenu')?.remove();});

function renderList()
{
    $('list').replaceChildren(...Object.keys(S.data).map(name => h('div', {
        class: `item${name === S.sel ? ' sel' : ''}`, dataset: {name},
        onclick: () => select(name === S.sel ? null : name),
        ondblclick: () => renameScene(name),
        oncontextmenu: (e) => menu(e, [['改名…', () => renameScene(name)], ['複製…', () => dupScene(name)], ['刪除', () => deleteScene(name)]]),
    }, h('span', {class: 'id'}, name), h('span', {class: 'lab'}, S.data[name].map ?? ''))));
    if (!Object.keys(S.data).length) $('list').append(h('div', {class: 'dim'}, S.root ? '還沒有場景，按 ＋ 新增' : '先在上方選擇專案資料夾'));
}

function refresh()
{
    if (S.sel !== null && !(S.sel in S.data)) S.sel = null;
    renderList();
    $('sceneName').textContent = S.sel ?? '（沒選場景：空白 sandbox）';
    $('btnUndo').disabled = !S.undo.length;
    $('btnRedo').disabled = !S.redo.length;
    syncGame();
}

const cur = () => S.data[S.sel] ?? ST.newScene();

function syncGame()
{
    toGame({sb: 'grid', on: S.grid});
    toGame({sb: 'load', scene: cur()});
}

// ---------- sandbox ----------
addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow || !e.data?.sb) return;
    const m = e.data;
    if (m.sb === 'ready') {S.ready = true; syncGame();}
    else if (m.sb === 'error') status(m.msg);
});
frame.src = '/?sandbox=1';

// ---------- 事件 ----------
$('btnNew').onclick = () => addScene();
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('chkGrid').checked = S.grid;
$('chkGrid').onchange = () => {S.grid = $('chkGrid').checked; ls.set(LS.grid, S.grid ? '1' : '0'); toGame({sb: 'grid', on: S.grid});};
$('btnHome').onclick = () => toGame({sb: 'home'});
addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});

async function setProject(root)
{
    S.root = root;
    S.undo = [];
    S.redo = [];
    try {S.data = await ST.load(root);}
    catch (e) {S.data = {}; status(`${ST.FILE} 讀不了：${e.message}`);}
    refresh();
}
SH.onProject(setProject);
SH.onSaved((file) => {
    if (file !== ST.FILE || !S.root) return;
    queue(async () => {S.data = await ST.read(); refresh();});
});
refresh();

// 給無頭測試用
window.__sc = {S, setProject, addScene, dupScene, renameScene, deleteScene, select, undo, redo, flush: () => S.q};
