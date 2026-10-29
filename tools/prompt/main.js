// 提示詞：管理給 AI 生圖用的提示詞（{items: {分類路徑: [{name, file, desc, common}]}, common: {名稱: 文字}}），組好按複製貼到外面
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
    sel: null,              // items：{cat, i}；common：名稱；多選時是 Shift 範圍的起點
    picks: [],              // 物品多選：兩個以上才算，[{cat, i}]
    search: '',
    open: new Set(),        // 展開的分組（預設摺起來）：分類名稱，共用組是 COMMON
    hist: [], hi: -1,
};
const COMMON = '\0common';
const OPEN_KEY = 'tools.prompt.open';

try {S.path = localStorage.getItem(PATH_KEY) || DEFAULT_PATH;}
catch {}
try {S.open = new Set(JSON.parse(localStorage.getItem(OPEN_KEY)) ?? []);}
catch {}

const saveOpen = () => {
    try {localStorage.setItem(OPEN_KEY, JSON.stringify([...S.open]));}
    catch {}
};
const openGroup = (key) => {if (!S.open.has(key)) {S.open.add(key); saveOpen();}};

// ---------- 分類路徑 ----------
// items 的 key 是「武器/劍」這種路徑；一律補齊祖先、照樹的前序排（兄弟照第一次出現的順序），檔案順序＝畫面順序
const parentOf = (p) => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
const leafOf = (p) => p.slice(p.lastIndexOf('/') + 1);
const join = (parent, name) => parent ? `${parent}/${name}` : name;
const under = (p, top) => p === top || p.startsWith(`${top}/`);
const rebase = (p, from, to) => under(p, from) ? to + p.slice(from.length) : p;

// 路徑 → 子分類路徑（'' 是根）
function tree(items)
{
    const kids = new Map([['', []]]);
    for (const k of Object.keys(items))
    {
        const segs = k.split('/');
        for (let n = 1; n <= segs.length; n++)
        {
            const p = segs.slice(0, n).join('/');
            if (kids.has(p)) continue;
            kids.set(p, []);
            kids.get(parentOf(p)).push(p);
        }
    }
    return kids;
}

function normItems(items)
{
    const kids = tree(items), out = {};
    const walk = (p) => {out[p] = items[p] ?? []; kids.get(p).forEach(walk);};
    kids.get('').forEach(walk);
    return out;
}

const norm = (d) => ({...d, items: normItems(d?.items ?? {}), common: d?.common ?? {}});
const isDirty = () => !!S.data && str(S.data) !== str(S.saved);
const view = () => ({mode: S.mode, sel: structuredClone(S.sel), picks: structuredClone(S.picks)});
const selItem = () => S.mode === 'items' && S.sel ? S.data?.items[S.sel.cat]?.[S.sel.i] : null;
const multi = () => S.mode === 'items' && S.picks.length > 1;
const same = (a, b) => a.cat === b.cat && a.i === b.i;

// 剩一個就退回單選
function fixPicks()
{
    if (S.picks.length === 1) S.sel = S.picks[0];
    if (S.picks.length < 2) S.picks = [];
}

// 行內註解：// 到行尾，緊貼在 : 後面的（網址）不算
const COMMENT = /(?<!:)\/\/.*/;

// 純註解行整行拿掉，其他行拿掉註解、去行尾空白
export function strip(text)
{
    return (text ?? '').split('\n').flatMap(l => {
        if (!COMMENT.test(l)) return [l];
        const s = l.replace(COMMENT, '').trimEnd();
        return s.trim() ? [s] : [];
    }).join('\n');
}

// 先各自去註解再組：common 有 {desc}／{name}／{file} 就代換進去，沒有就接在描述後面；沒填 file 時含 {file} 的行整行拿掉
export function compose(it, common)
{
    const desc = strip(it.desc);
    const c = strip(common[it.common]).split('\n').filter(l => it.file || !l.includes('{file}')).join('\n');
    if (/\{(desc|name|file)\}/.test(c)) return c.replaceAll('{desc}', desc).replaceAll('{name}', it.name ?? '').replaceAll('{file}', it.file ?? '');
    return [desc, c].filter(Boolean).join('\n');
}

// 網頁版 ChatGPT 同一輪裡生完圖拿不到圖檔，要下一輪才能用 Python 另存
export const saveCmd = (file) => `把剛剛那張圖用 Python 原樣存成 ${file}.png（不要重畫、不要縮放、不要改背景），給我下載連結。`;

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

const restore = (v) => {S.mode = v.mode; S.sel = structuredClone(v.sel); S.picks = structuredClone(v.picks ?? []);};

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
    S.picks = [];
    S.hist =[{data: str(S.data), before: view(), after: view()}];
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
        if (r === 'merge') commit(() => {S.data = {...S.data, items: normItems(mi.data), common: mc.data};});
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

// 從最深一層往上找第一個同名的 common
const defaultCommon = (cat) => cat.split('/').reverse().find(s => s in S.data.common) ?? '';

function addItem(cat)
{
    commit(() => {
        const list = S.data.items[cat];
        list.push({name: '新物品', file: '', desc: '', common: defaultCommon(cat)});
        S.mode = 'items';
        S.sel = {cat, i: list.length - 1};
        S.picks = [];
    });
}

function dupItem({cat, i})
{
    commit(() => {
        S.data.items[cat].splice(i + 1, 0, structuredClone(S.data.items[cat][i]));
        S.sel = {cat, i: i + 1};
        S.picks = [];
    });
}

function removeItem({cat, i})
{
    commit(() => {
        const list = S.data.items[cat];
        list.splice(i, 1);
        S.sel = list.length ? {cat, i: Math.min(i, list.length - 1)} : null;
        S.picks = [];
    });
}

// froms 照給的順序緊挨著插在 to.i 前面（= 長度就放最後）；可以跨分類；to 是被搬的其中一個就往後找第一個沒被搬的
function moveItems(froms, to)
{
    commit(() => {
        const items = S.data.items, its = froms.map(f => items[f.cat][f.i]);
        const anchor = items[to.cat].slice(to.i).find(it => !its.includes(it));
        for (const f of [...froms].sort((a, b) => b.i - a.i)) items[f.cat].splice(f.i, 1);
        const list = items[to.cat], i = anchor ? list.indexOf(anchor) : list.length;
        list.splice(i, 0, ...its);
        S.picks = its.length > 1 ? its.map((_, n) => ({cat: to.cat, i: i + n})) : [];
        S.sel = {cat: to.cat, i};
    });
}

const moveItem = (from, to) => moveItems([from], to);
const setItem = (sel, k, v) => commit(() => {S.data.items[sel.cat][sel.i][k] = v;});
const setPicks = (k, v) => commit(() => {for (const p of S.picks) S.data.items[p.cat][p.i][k] = v;});

function removePicks()
{
    commit(() => {
        for (const p of [...S.picks].sort((a, b) => b.i - a.i)) S.data.items[p.cat].splice(p.i, 1);
        S.picks = [];
        S.sel = null;
    });
}

async function askName(title, value)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, inp, [['ok', '確定'], ['cancel', '取消']]);
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

const badName = (name) => name.includes('/') && (status('分類名稱不能有 /'), true);

// parent 空的＝頂層
async function addCat(parent = '')
{
    const name = await askName(parent ? `新子分類（${parent}）` : '新分類', uniqueName('新分類', n => join(parent, n) in S.data.items));
    if (!name || badName(name)) return;
    const p = join(parent, name);
    if (p in S.data.items) return status(`分類「${p}」已經有了`);
    if (parent) openGroup(parent);
    commit(() => {S.data.items = normItems({...S.data.items, [p]: []});});
}

// 子分類路徑、選擇、摺疊跟著換前綴
function repath(from, to)
{
    if (S.sel?.cat && under(S.sel.cat, from)) S.sel.cat = rebase(S.sel.cat, from, to);
    for (const p of S.picks) p.cat = rebase(p.cat, from, to);
    S.open = new Set([...S.open].map(k => rebase(k, from, to)));
    saveOpen();
}

async function renameCat(from)
{
    const name = await askName(`分類改名 ${from}`, leafOf(from));
    if (!name || badName(name)) return;
    const to = join(parentOf(from), name);
    if (to === from) return;
    if (to in S.data.items) return status(`分類「${to}」已經有了`);
    commit(() => {
        S.data.items = Object.fromEntries(Object.entries(S.data.items).map(([k, v]) => [rebase(k, from, to), v]));
        repath(from, to);
    });
}

// 連整棵子樹一起刪
async function removeCat(top)
{
    const keys = Object.keys(S.data.items).filter(k => under(k, top));
    const subs = keys.length - 1, n = keys.reduce((s, k) => s + S.data.items[k].length, 0);
    if ((subs || n) && await ask(`刪除分類 ${top}`, `裡面還有${subs ? ` ${subs} 個子分類、` : ' '}${n} 個物品，會一起刪掉`, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    commit(() => {
        for (const k of keys) delete S.data.items[k];
        if (S.sel?.cat && under(S.sel.cat, top)) S.sel = null;
        S.picks = S.picks.filter(p => !under(p.cat, top));
        fixPicks();
    });
}

// where：before／after＝當 target 的兄弟、in＝當 target 的最後一個子分類；整棵子樹一起搬
function moveCat(from, target, where)
{
    if (under(target, from)) return;
    const to = join(where === 'in' ? target : parentOf(target), leafOf(from));
    if (to !== from && to in S.data.items) return status(`分類「${to}」已經有了`);
    commit(() => {
        const all = Object.entries(S.data.items);
        const moving = all.filter(([k]) => under(k, from)).map(([k, v]) => [rebase(k, from, to), v]);
        const rest = all.filter(([k]) => !under(k, from));
        let i = rest.findIndex(([k]) => k === target);
        if (where !== 'before') while (i < rest.length && under(rest[i][0], target)) i++;
        rest.splice(i, 0, ...moving);
        S.data.items = normItems(Object.fromEntries(rest));
        repath(from, to);
    });
}

function renameKey(obj, from, to)
{
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));
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
let drag = null;           // 物品 {cat, i}、整批物品 {many}、分類 {top}
const dragged = (d) => d.many ?? [d];

// 物品列只收物品
function dropTarget(el, to)
{
    el.ondragover = (e) => {if (drag && !drag.top) {e.preventDefault(); el.classList.add('drop');}};
    el.ondragleave = () => el.classList.remove('drop');
    el.ondrop = (e) => {e.preventDefault(); el.classList.remove('drop'); const d = drag; drag = null; if (d && !d.top) moveItems(dragged(d), to);};
}

// 分類標題：物品放最後；分類看放在上／中／下段
function catDrop(el, cat)
{
    const zone = (e) => {const r = el.getBoundingClientRect(), y = (e.clientY - r.top) / r.height; return y < .25 ? 'before' : y > .75 ? 'after' : 'in';};
    const ok = () => drag && (!drag.top || !under(cat, drag.top));
    const clear = () => el.classList.remove('drop', 'drop-before', 'drop-after');
    el.ondragover = (e) => {
        if (!ok()) return;
        e.preventDefault();
        clear();
        const z = drag.top ? zone(e) : 'in';
        el.classList.add(z === 'in' ? 'drop' : `drop-${z}`);
    };
    el.ondragleave = clear;
    el.ondrop = (e) => {
        e.preventDefault();
        clear();
        if (!ok()) return;
        const d = drag;
        drag = null;
        if (d.top) moveCat(d.top, cat, zone(e));
        else moveItems(dragged(d), {cat, i: S.data.items[cat].length});
    };
}

const indent = (depth) => `padding-left: ${4 + depth * 14}px`;

// 再點一次選到的就取消選擇
const pick = (mode, sel) => {S.mode = mode; S.sel = sel; S.picks = []; render();};

let shown = [];             // 清單上看得到的物品，照畫面順序，給 Shift 範圍跟整批拖曳排序用
const order = (p) => shown.findIndex(s => same(s, p));
const picked = (p) => S.picks.some(s => same(s, p));

// Ctrl＋點加減、Shift＋點從起點選到這裡（照畫面順序、可跨分類）
function clickItem(e, me)
{
    const cur = S.mode === 'items' && S.sel ? S.sel : null;
    if (e.shiftKey && cur && order(cur) >= 0)
    {
        const [a, b] = [order(cur), order(me)].sort((x, y) => x - y);
        S.picks = shown.slice(a, b + 1);
    }
    else if (e.ctrlKey || e.metaKey)
    {
        const base = S.picks.length ? S.picks : cur ? [cur] : [];
        S.picks = base.some(s => same(s, me)) ? base.filter(s => !same(s, me)) : [...base, me];
        S.sel = picked(me) ? me : S.picks.at(-1) ?? null;
    }
    else return pick('items', !multi() && cur && same(cur, me) ? null : me);
    S.mode = 'items';
    fixPicks();
    render();
}

// 搜尋中全部展開
const folded = (key) => !S.search && !S.open.has(key);

// Alt＋點：分類＝連整棵子樹一起摺／展開，共用組＝所有組一起
function groupHead(key, label, title, depth, ...buttons)
{
    const inside = (k) => k === COMMON ? S.mode === 'common' : S.mode === 'items' && !!S.sel?.cat && under(S.sel.cat, k);
    const toggle = (alt) => {
        const fold = S.open.has(key);
        const keys = !alt ? [key] : key === COMMON ? [COMMON, ...Object.keys(S.data.items)] : Object.keys(S.data.items).filter(k => under(k, key));
        for (const k of keys)
        {
            if (!fold) S.open.add(k);
            else
            {
                S.open.delete(k);
                if (inside(k)) S.sel = null;
                if (k !== COMMON) S.picks = S.picks.filter(p => !under(p.cat, k));
            }
        }
        saveOpen();
        fixPicks();
        render();
    };
    return h('div', {class: 'group', style: indent(depth), title: `${title}，Alt＋點${key === COMMON ? '全部' : '連子分類'}`, onclick: (e) => {if (!e.target.closest('button')) toggle(e.altKey);}},
        h('span', {class: 'arrow'}, folded(key) ? '▸' : '▾'),
        h('span', {class: 'name'}, label),
        ...buttons);
}

function catHead(cat, depth, n)
{
    const g = groupHead(cat, `${leafOf(cat)}（${n}）`, '點一下展開／摺疊，雙擊改名，可拖曳', depth,
        h('button', {title: '新增物品', onclick: () => {openGroup(cat); addItem(cat);}}, '＋'),
        h('button', {title: '新增子分類', onclick: () => addCat(cat)}, '⊞'),
        h('button', {title: '刪除分類（連子分類）', onclick: () => removeCat(cat)}, '✕'));
    g.ondblclick = (e) => {if (!e.target.closest('button')) renameCat(cat);};
    g.setAttribute('draggable', 'true');
    g.ondragstart = (e) => {drag = {top: cat}; e.dataTransfer.effectAllowed = 'move';};
    g.ondragend = () => {drag = null;};
    catDrop(g, cat);
    return g;
}

function itemRow(cat, i, depth)
{
    const it = S.data.items[cat][i];
    const lost = it.common && !(it.common in S.data.common);
    const me = {cat, i};
    const on = multi() ? picked(me) : S.mode === 'items' && !!S.sel && same(S.sel, me);
    shown.push(me);
    const row = h('div', {class: `item${on ? ' sel' : ''}`, style: indent(depth), draggable: 'true', title: 'Ctrl＋點多選、Shift＋點選範圍', onclick: (e) => clickItem(e, me)},
        h('span', {class: 'id'}, it.name || '（未命名）'),
        lost && h('span', {class: 'mark missing', title: `共用「${it.common}」遺失`}, '⚠'));
    // 拖選到的其中一個＝整批照畫面順序搬
    row.ondragstart = (e) => {drag = multi() && picked(me) ? {many: [...S.picks].sort((a, b) => order(a) - order(b))} : me; e.dataTransfer.effectAllowed = 'move';};
    row.ondragend = () => {drag = null;};
    dropTarget(row, {cat, i});
    return row;
}

// 子分類在前、直屬物品在後；搜尋時只留有命中的路徑，分類名稱命中就整棵子樹都留
function drawItemList()
{
    const q = S.search.toLowerCase(), kids = tree(S.data.items);
    shown = [];
    const hit = (it) => `${it.name}\n${it.file ?? ''}\n${it.desc}`.toLowerCase().includes(q);
    const total = (p) => S.data.items[p].length + kids.get(p).reduce((n, c) => n + total(c), 0);
    const draw = (cat, depth, all) => {
        all ||= !q || leafOf(cat).toLowerCase().includes(q);
        const body = folded(cat) ? [] : [
            ...kids.get(cat).flatMap(c => draw(c, depth + 1, all)),
            ...S.data.items[cat].flatMap((it, i) => all || hit(it) ? [itemRow(cat, i, depth + 1)] : []),
        ];
        return !all && !body.length ? [] : [catHead(cat, depth, total(cat)), ...body];
    };
    return kids.get('').flatMap(c => draw(c, 0, false));
}

// 放在所有分類前面
function drawCommonList()
{
    const q = S.search.toLowerCase();
    return [
        groupHead(COMMON, `⚙ 共用（${Object.keys(S.data.common).length}）`, '點一下展開／摺疊', 0,
            h('button', {title: '新增共用', onclick: () => {openGroup(COMMON); addCommon();}}, '＋')),
        folded(COMMON) ? [] : Object.entries(S.data.common)
            .filter(([k, v]) => !q || `${k}\n${v}`.toLowerCase().includes(q))
            .map(([k]) => h('div', {class: `item${S.mode === 'common' && S.sel === k ? ' sel' : ''}`, onclick: () => pick('common', S.mode === 'common' && S.sel === k ? null : k)},
                h('span', {class: 'id'}, k))),
    ];
}

const esc = (s) => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'})[c]);

function paint(text)
{
    return text.split('\n').map(l => {
        const m = COMMENT.exec(l);
        return m ? esc(l.slice(0, m.index)) + `<span class="cm">${esc(m[0])}</span>` : esc(l);
    }).join('\n') + '\n';
}

// Ctrl+/：游標行或選取的行首加減「// 」，非空行全是註解就拿掉、否則全加；整段一次 insertText，原生 undo 一步
function toggleComment(ta)
{
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
    const s = v.lastIndexOf('\n', a - 1) + 1;
    let e = v.indexOf('\n', b > a && v[b - 1] === '\n' ? b - 1 : b);
    if (e < 0) e = v.length;
    const lines = v.slice(s, e).split('\n');
    const off = lines.filter(l => l.trim()).every(l => /^\s*\/\//.test(l));
    const text = lines.map(l => !l.trim() ? l : off ? l.replace(/^(\s*)\/\/ ?/, '$1') : l.replace(/^(\s*)/, '$1// ')).join('\n');
    ta.setSelectionRange(s, e);
    document.execCommand('insertText', false, text);
    ta.setSelectionRange(s, s + text.length);
}

// 寬度變了（拖分隔線、視窗縮放）換行跟著變，高度要重算
// 下一幀才改高度：在回呼裡直接改會觸發 ResizeObserver loop 錯誤
const refit = new ResizeObserver(es => requestAnimationFrame(() => {
    for (const {target} of es) target.isConnected ? target.fit() : refit.unobserve(target);
}));

// textarea 文字透明、底下疊上色的 pre（註解灰色）；高度跟著內容長，沒有捲軸換行才對得齊
function commentArea(props)
{
    const pre = h('pre', {class: 'cm-hl'});
    const ta = h('textarea', {...props, class: 'cm-ta', spellcheck: false});
    ta.fit = () => {
        pre.innerHTML = paint(ta.value);
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight + 2}px`;
    };
    ta.addEventListener('input', ta.fit);
    ta.addEventListener('keydown', (e) => {if (e.ctrlKey && e.key === '/') {e.preventDefault(); toggleComment(ta);}});
    pre.innerHTML = paint(ta.value);
    refit.observe(ta);
    return h('div', {class: 'cm-area'}, pre, ta);
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
    // mousedown 不搶焦點：不然輸入框先 change → 重畫，按鈕被換掉這下 click 就掉了
    const keep = (e) => e.preventDefault();
    const fileInp = h('input', {'data-k': 'file', value: it.file ?? '', placeholder: '不含副檔名', oninput: (e) => live('file')(e), onchange: (e) => setItem(sel, 'file', e.target.value.trim())});
    const btnFile = h('button', {disabled: !it.file, onmousedown: keep, onclick: () => copy(fileInp.value.trim())}, '複製檔名');
    const btnSave = h('button', {disabled: !it.file, onmousedown: keep, onclick: () => copy(saveCmd(fileInp.value.trim()))}, '複製存檔指令');
    const live = (k) => (e) => {
        const v = {...it, [k]: e.target.value};
        out.textContent = compose(v, common);
        btnFile.disabled = btnSave.disabled = !v.file?.trim();
    };
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
            h('span', {class: 'k'}, '檔名'),
            h('div', {class: 'file'},
                fileInp,
                h('span', {class: 'dim'}, '.png'),
                btnFile),
            h('span', {class: 'k'}, '共用'),
            h('div', null, select),
            h('span', {class: 'k'}, '描述'),
            commentArea({'data-k': 'desc', value: it.desc ?? '', title: '// 到行尾是註解（灰色，不會組進去），Ctrl+/ 切換', oninput: live('desc'), onchange: (e) => setItem(sel, 'desc', e.target.value)})),
        h('div', {class: 'row2'}, h('span', {class: 'title'}, '組合結果'), h('button', {onmousedown: keep, onclick: () => copy(out.textContent)}, '複製提示詞'), btnSave),
        out,
    ];
}

// 多選：批次改共用、批次刪除
function drawMulti()
{
    const sorted = [...S.picks].sort((a, b) => order(a) - order(b));
    const select = h('select', {onchange: (e) => {if (e.target.value !== '\0') setPicks('common', e.target.value);}},
        h('option', {value: '\0'}, '（不變）'),
        h('option', {value: ''}, '（無）'),
        Object.keys(S.data.common).map(k => h('option', {value: k}, k)));
    return [
        h('div', {class: 'head'},
            h('span', {class: 'bigid'}, `已選 ${S.picks.length} 個物品`),
            h('span', {class: 'grow'}),
            h('button', {onclick: () => {S.picks = []; S.sel = null; render();}}, '取消選取'),
            h('button', {onclick: removePicks}, '刪除')),
        h('div', {class: 'hint'}, '拖曳其中一個＝整批照順序搬'),
        h('div', {class: 'fields'}, h('span', {class: 'k'}, '共用'), h('div', null, select)),
        h('div', {class: 'users'}, ul(sorted.map(p => h('a', {onclick: () => pick('items', p)}, `${p.cat}／${S.data.items[p.cat][p.i].name || '（未命名）'}`)))),
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
        h('div', {class: 'hint'}, '可用 {desc}、{name} 把物品的描述／名稱代換進來；沒有的話會接在描述後面（描述＋換行＋這段）；// 到行尾是註解（灰色，不會組進去），Ctrl+/ 切換'),
        commentArea({'data-k': 'ctext', value: S.data.common[name], onchange: (e) => commit(() => {S.data.common[name] = e.target.value;})}),
        h('div', {class: 'title'}, `用到的物品（${users.length}）`),
        users.length
            ? h('div', {class: 'users'}, ul(users.map(u => h('a', {onclick: () => pick('items', {cat: u.cat, i: u.i})}, `${u.cat}／${u.it.name || '（未命名）'}`))))
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
        : S.mode === 'items' ? (multi() ? drawMulti() : selItem() ? drawItem() : [h('div', {class: 'dim'}, '左邊選一個物品')])
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
$('btnNew').onclick = () => addCat();
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
window.__pe = {S, setRoot, setPath, load, save, compose, strip, saveCmd, commit, undo, redo, addItem, dupItem, removeItem, moveItem, moveItems, setItem, setPicks, removePicks,
               addCat, renameCat, removeCat, moveCat, normItems, addCommon, renameCommon, removeCommon, usersOf};
