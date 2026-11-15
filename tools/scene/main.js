// 場景分頁：iframe 跑遊戲本身（開發版 /?sandbox，src/scenes/Sandbox.js），左欄場景清單＋場景裡的東西、右欄屬性，tools/scenes.json 立刻寫檔＋undo；見 docs/scene-tool.md
// 跟 sandbox 的訊息都帶 sb 欄位：→ load {scene}／grid {on}／home／select {key}／hide {keys}
//                               ← ready（剛開好、還沒載場景）／loaded {map}／error {msg}／select {key}／move {key,tx,ty}／ctx {tx,ty,key,cx,cy}／key {key,ctrl,shift,alt}
import '../common/splitter.js';
import {$, h, status, ask} from '../common/dom.js';
import * as SH from '../common/shell.js';
import * as FS from '../common/fs.js';
import {KINDS, KIND_NAMES} from '../role/schema.js';
import * as ST from './store.js';

const LS = {sel: 'tools.scene.sel', grid: 'tools.scene.grid', role: 'tools.scene.lastRole'};
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};
const SLOTS = [['CAT_WEAPON', '武器'], ['CAT_HELMET', '頭盔'], ['CAT_CHESTPLATE', '護甲'], ['CAT_GLOVES', '手套'], ['CAT_BOOTS', '靴子']];
// 這些檔改了 sandbox 的 DB 就舊了：整個重開
const GAME_FILES = ['role.json', 'item.json', 'part.json', 'anim.json', 'fx.json', 'particle.json', 'ability.json', 'local.json', 'textures.json'];

const S = {
    root: null,
    data: {},
    sel: ls.get(LS.sel) || null,    // 場景名
    pick: null,                     // 場景裡選中的角色 key
    hidden: new Set(),              // 👁 暫藏（只在這次開著時）
    undo: [],
    redo: [],
    ready: false,                   // sandbox 開好了
    grid: ls.get(LS.grid) !== '0',
    refs: {roles: {}, items: {}},
    q: Promise.resolve(),
};

const frame = $('game');
const toGame = (msg) => S.ready && frame.contentWindow?.postMessage(msg, '*');
const scene = () => S.data[S.sel];
const roles = () => scene()?.roles ?? [];
const roleOf = (key) => roles().find(r => r.key === key);

// 寫檔一個接一個，不會兩次讀到同一份
const queue = (fn) => (S.q = S.q.then(fn).catch(e => status(e.message)));

// ---------- 編輯（立刻寫檔＋undo） ----------
function commit(fn, sel, pick)
{
    return queue(async () => {
        const r = await ST.edit(fn);
        if (!r) return;
        S.undo.push({before: r.before, after: r.after, sel: [S.sel, sel === undefined ? S.sel : sel], pick: [S.pick, pick === undefined ? S.pick : pick]});
        S.redo = [];
        S.data = r.data;
        if (sel !== undefined) select(sel, false);
        if (pick !== undefined) S.pick = pick;
        refresh();
    });
}

// 改目前場景：fn(場景)；場景被別處刪了就擋
const editScene = (fn, pick) => {
    const name = S.sel;
    if (name === null) {status('先選或新增一個場景'); return Promise.resolve();}
    return commit(d => {
        if (!(name in d)) throw new Error(`找不到場景「${name}」`);
        return fn(d[name]);
    }, undefined, pick);
};

const step = (from, to, i) => queue(async () => {
    const u = from.pop();
    if (!u) return;
    try {S.data = await ST.restore(i === 0 ? u.after : u.before, i === 0 ? u.before : u.after);}
    catch (e) {from.push(u); throw e;}
    to.push(u);
    select(u.sel[i] in S.data ? u.sel[i] : null, false);
    S.pick = u.pick[i];
    refresh();
});
const undo = () => step(S.undo, S.redo, 0);
const redo = () => step(S.redo, S.undo, 1);

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
    await commit(d => {d[name] = ST.newScene();}, name, null);
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
    }, name, null);
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
    await commit(d => {delete d[name];}, S.sel === name ? null : S.sel, S.sel === name ? null : S.pick);
}

function select(name, sync = true)
{
    if (name !== S.sel) {S.pick = null; S.hidden.clear();}
    S.sel = name;
    ls.set(LS.sel, name ?? '');
    if (sync) refresh();
}

// ---------- 角色 ----------
const roleKey = () => {let i = 1; while (roleOf(`r${i}`)) i++; return `r${i}`;};
const roleLab = (id) => S.refs.roles[id]?.lab ?? '';

function addRole(id, tx, ty)
{
    if (!S.refs.roles[id]) {status(`role.json 沒有 ${id}`); return Promise.resolve();}
    ls.set(LS.role, id);
    const key = roleKey();
    return editScene(sc => {(sc.roles ??= []).push({key, id, tx, ty});}, key);
}

// patch 的值 undefined＝拿掉那個欄位
function setRole(key, patch)
{
    return editScene(sc => {
        const r = sc.roles?.find(x => x.key === key);
        if (!r) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete r[k]; else r[k] = v;}
    });
}

function setEquip(key, cat, v)
{
    return editScene(sc => {
        const r = sc.roles?.find(x => x.key === key);
        if (!r) throw new Error(`場景裡沒有 ${key}`);
        const eq = {...r.equip};
        if (v === undefined) delete eq[cat]; else eq[cat] = v;
        if (Object.keys(eq).length) r.equip = eq; else delete r.equip;
    });
}

function deleteRole(key)
{
    return editScene(sc => {
        const i = sc.roles?.findIndex(x => x.key === key) ?? -1;
        if (i < 0) return false;
        sc.roles.splice(i, 1);
        if (!sc.roles.length) delete sc.roles;
    }, S.pick === key ? null : S.pick);
}

function pickRole(key)
{
    S.pick = key;
    toGame({sb: 'select', key});
    renderTree();
    renderRight();
}

function toggleHide(key)
{
    if (S.hidden.has(key)) S.hidden.delete(key); else S.hidden.add(key);
    toGame({sb: 'hide', keys: [...S.hidden]});
    renderTree();
}

// role.json 照 kind → grp 分組的下拉
function roleSelect(value, size)
{
    const sel = h('select', {size});
    const groups = {};
    for (const [id, r] of Object.entries(S.refs.roles))
    {
        const g = `${KIND_NAMES[r.kind] ?? r.kind ?? '其他'}${r.grp ? `／${r.grp}` : ''}`;
        (groups[g] ??= {kind: KINDS.indexOf(r.kind), ids: []}).ids.push(id);
    }
    for (const [g, {ids}] of Object.entries(groups).sort((a, b) => (a[1].kind < 0 ? 99 : a[1].kind) - (b[1].kind < 0 ? 99 : b[1].kind)))
        sel.append(h('optgroup', {label: g}, ids.map(id => h('option', {value: id}, `${id}　${roleLab(id)}`))));
    sel.value = value ?? '';
    return sel;
}

async function askRole(title)
{
    const sel = roleSelect(ls.get(LS.role) ?? Object.keys(S.refs.roles)[0], 14);
    const q = h('input', {placeholder: '搜尋 id／名字', oninput: () => {
        const s = q.value.trim().toLowerCase();
        for (const o of sel.options) o.hidden = !!s && !`${o.value} ${o.textContent}`.toLowerCase().includes(s);
    }});
    sel.ondblclick = () => $('dlgAsk').close('ok');
    const p = ask(title, [q, h('div', null, sel)], [['ok', '放置'], ['cancel', '取消']]);
    sel.style.width = '100%';
    q.focus();
    return await p === 'ok' && sel.value ? sel.value : null;
}

async function placeAt(tx, ty)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const id = await askRole(`放角色（${tx}, ${ty}）`);
    if (id) await addRole(id, tx, ty);
}

// ---------- 畫面 ----------
function menu(e, items)
{
    e.preventDefault?.();
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

function renderTree()
{
    const box = $('tree');
    box.hidden = S.sel === null;
    if (box.hidden) return box.replaceChildren();
    box.replaceChildren(
        h('div', {class: 'row2'}, h('span', {class: 'sec grow'}, `角色（${roles().length}）`),
            h('button', {title: '放角色（放在地圖中間；也可以在畫面上右鍵）', onclick: () => placeAt(...S.center)}, '＋')),
        ...roles().map(r => h('div', {
            class: `item${r.key === S.pick ? ' sel' : ''}${S.hidden.has(r.key) ? ' hid' : ''}`, dataset: {key: r.key},
            onclick: () => pickRole(r.key === S.pick ? null : r.key),
            oncontextmenu: (e) => menu(e, [['刪除', () => deleteRole(r.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(r.key);}}, S.hidden.has(r.key) ? '◌' : '👁'),
           h('span', {class: 'id'}, r.id), h('span', {class: 'lab'}, roleLab(r.id)), h('span', {class: 'mark dim'}, `${r.tx},${r.ty}`))),
    );
}

const num = (value, onchange) => h('input', {type: 'number', step: 1, value, class: 'n', onchange});

function equipSelect(r, cat)
{
    const meta = S.refs.roles[r.id] ?? {}, sex = meta.sex ?? 'm';
    const orig = (meta.inv?.equips ?? []).map(e => e?.id ?? e).find(id => S.refs.items[id]?.cat === cat);
    const ids = Object.entries(S.refs.items).filter(([, it]) => it.cat === cat && it.equip && (!it.sex || it.sex === sex)).map(([id]) => id);
    const v = r.equip && cat in r.equip ? r.equip[cat] : '__orig';
    const sel = h('select', {dataset: {cat}, onchange: () => setEquip(r.key, cat, sel.value === '__orig' ? undefined : sel.value)},
        h('option', {value: '__orig'}, `（原本：${orig ?? '空'}）`), h('option', {value: ''}, '（空）'),
        ids.map(id => h('option', {value: id}, id)));
    if (v && !ids.includes(v)) sel.append(h('option', {value: v}, `⚠ ${v}`));
    sel.value = v;
    return sel;
}

function renderRight()
{
    const r = roleOf(S.pick), box = $('right');
    if (!r) return box.replaceChildren(h('span', {class: 'dim'}, S.sel === null ? '' : '點畫面上的角色、或左邊清單選一個；右鍵畫面放角色'));
    const idSel = roleSelect(r.id);
    idSel.onchange = () => setRole(r.key, {id: idSel.value});
    const face = h('select', {onchange: () => setRole(r.key, {face: face.value || undefined})},
        h('option', {value: ''}, '（預設）'), h('option', {value: 'l'}, '左'), h('option', {value: 'r'}, '右'));
    face.value = r.face ?? '';
    box.replaceChildren(
        h('div', {class: 'sec'}, `角色 ${r.key}`, S.refs.roles[r.id] ? null : h('span', {class: 'warn'}, `　role.json 沒有 ${r.id}`)),
        h('table', {class: 'props'},
            h('tr', null, h('td', {class: 'k'}, '角色'), h('td', null, idSel)),
            h('tr', null, h('td', {class: 'k'}, '格子'), h('td', null,
                num(r.tx, (e) => setRole(r.key, {tx: +e.target.value})), ' ', num(r.ty, (e) => setRole(r.key, {ty: +e.target.value})))),
            h('tr', null, h('td', {class: 'k'}, '面向'), h('td', null, face))),
        h('div', {class: 'sec'}, '裝備', h('span', {class: 'dim'}, '（只改這個場景，不寫回 role.json）')),
        h('table', {class: 'props'}, SLOTS.map(([cat, name]) => h('tr', null, h('td', {class: 'k'}, name), h('td', null, equipSelect(r, cat))))),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteRole(r.key)}, '刪除（Del）')),
    );
}

function refresh()
{
    if (S.sel !== null && !(S.sel in S.data)) select(null, false);
    if (S.pick && !roleOf(S.pick)) S.pick = null;
    renderList();
    renderTree();
    renderRight();
    $('sceneName').textContent = S.sel ?? '（沒選場景：空白 sandbox）';
    $('btnUndo').disabled = !S.undo.length;
    $('btnRedo').disabled = !S.redo.length;
    syncGame();
}

const cur = () => scene() ?? ST.newScene();

function syncGame()
{
    toGame({sb: 'grid', on: S.grid});
    toGame({sb: 'select', key: S.pick});
    toGame({sb: 'hide', keys: [...S.hidden]});
    toGame({sb: 'load', scene: cur()});
}

// ---------- sandbox ----------
function onKey(k)
{
    if (k.ctrl && k.key.toLowerCase() === 'z' && !k.shift) undo();
    else if (k.ctrl && (k.key.toLowerCase() === 'y' || (k.key.toLowerCase() === 'z' && k.shift))) redo();
    else if (k.key === 'Delete' && S.pick) deleteRole(S.pick);
    else return false;
    return true;
}

addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow || !e.data?.sb) return;
    const m = e.data;
    if (m.sb === 'ready') {S.ready = true; syncGame();}
    else if (m.sb === 'loaded') S.center = [Math.floor(m.w / 2), Math.floor(m.h / 2)];
    else if (m.sb === 'error') status(m.msg);
    else if (m.sb === 'select') {S.pick = m.key; renderTree(); renderRight();}
    else if (m.sb === 'move') setRole(m.key, {tx: m.tx, ty: m.ty}).then(syncGame);
    else if (m.sb === 'key') onKey(m);
    else if (m.sb === 'ctx')
    {
        const b = frame.getBoundingClientRect(), at = {clientX: b.left + m.cx, clientY: b.top + m.cy};
        const items = [[`在這裡放角色…（${m.tx}, ${m.ty}）`, () => placeAt(m.tx, m.ty)]];
        if (m.key) items.push([`刪除 ${roleOf(m.key)?.id ?? m.key}`, () => deleteRole(m.key)]);
        if (S.sel === null) return status('先選或新增一個場景');
        menu(at, items);
    }
});

function reloadGame()
{
    S.ready = false;
    frame.src = '/?sandbox=1';
}

// ---------- 事件 ----------
$('btnNew').onclick = () => addScene();
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('chkGrid').checked = S.grid;
$('chkGrid').onchange = () => {S.grid = $('chkGrid').checked; ls.set(LS.grid, S.grid ? '1' : '0'); toGame({sb: 'grid', on: S.grid});};
$('btnHome').onclick = () => toGame({sb: 'home'});
$('btnReload').onclick = reloadGame;
addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    if (onKey({key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey})) e.preventDefault();
});

async function loadRefs()
{
    const json = await FS.tryDir(await FS.tryDir(await FS.tryDir(S.root, 'public'), 'assets'), 'json');
    const read = async (name) => {const fh = json && await FS.tryFile(json, name); return fh ? JSON.parse(await (await fh.getFile()).text()) : {};};
    S.refs = {roles: await read('role.json'), items: await read('item.json')};
}

async function setProject(root)
{
    S.root = root;
    S.undo = [];
    S.redo = [];
    try {await loadRefs();}
    catch (e) {status(`role.json／item.json 讀不了：${e.message}`);}
    try {S.data = await ST.load(root);}
    catch (e) {S.data = {}; status(`${ST.FILE} 讀不了：${e.message}`);}
    refresh();
}
SH.onProject(setProject);
SH.onSaved((file) => {
    if (!S.root) return;
    if (file === ST.FILE) queue(async () => {S.data = await ST.read(); refresh();});
    else if (GAME_FILES.includes(file))
    {
        if (['role.json', 'item.json'].includes(file)) queue(async () => {await loadRefs(); refresh();});
        reloadGame();
    }
});
S.center = [12, 8];
frame.src = '/?sandbox=1';
refresh();

// 給無頭測試用
window.__sc = {S, setProject, addScene, dupScene, renameScene, deleteScene, select, undo, redo, addRole, setRole, setEquip, deleteRole, pickRole, toggleHide,
               flush: () => S.q};
