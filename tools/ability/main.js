// 能力＋能力樹：左欄樹清單、中間樹畫布（照遊戲 uiability.js 的畫法）、右欄技能表單
// 同時編 ability.json（技能＋前置 refs）、ab_tree.json（{樹:[{id,x,y}]}）、local.json（樹名 <樹>.lab）、role.json（技能改名／刪除時的 abilities）：
// undo 一起記，存檔各自比對外部修改、三方合併
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import '../common/combo.js';
import {$, h, ul, ask, status} from '../common/dom.js';
import {str, setAt, replaceRaw, merge3} from '../common/obj.js';
import {fieldInput, createForm} from '../common/form.js';
import {renderDatalists} from '../common/views.js';
import {ID_RE, scanRefsIn} from '../common/doc.js';
import * as IC from '../common/icons.js';
import * as SC from './schema.js';

const FILES = ['ability.json', 'ab_tree.json', 'local.json', 'role.json'];
// 遊戲一格 50px、邊界留白 5px，這裡等比放大
const CELL = 64, M = 8;

const S = {
    assets: null,               // {dir: public/assets, json, root: 專案根目錄（測試直接給 public/assets 時是 null）}
    doc: Object.fromEntries(FILES.map(f => [f, {data: {}, saved: {}, diskText: null}])),
    hist: [], hi: -1,
    tree: null, sel: null, search: '',
    link: null,                 // 畫布上選中的連線 {child, ref}，Del 刪掉
    extra: {},                  // id → Set：「加欄位」叫出來、還沒填值的欄位
    drafts: {}, open: {}, formOf: null,
    anims: [], fx: [],
};
const F = createForm({S, render});

const abs = () => S.doc['ability.json'].data;
const trees = () => S.doc['ab_tree.json'].data;
const locals = () => S.doc['local.json'].data;
const roles = () => S.doc['role.json'].data;
const treeOf = (id) => Object.keys(trees()).find(t => trees()[t].some(n => n.id === id));
const treeLab = (t) => locals()[t]?.lab;
const dirtyOf = (f) => str(S.doc[f].data) !== str(S.doc[f].saved);
const isDirty = () => FILES.some(dirtyOf);
const dirtyAb = (id) => str(abs()[id]) !== str(S.doc['ability.json'].saved[id]);

// ---------- 歷史 ----------
const snap = () => FILES.map(f => str(S.doc[f].data));
const pos = () => ({tree: S.tree, sel: S.sel});

function resetHist()
{
    S.hist = [{data: snap(), before: pos(), after: pos()}];
    S.hi = 0;
}

function commit(fn)
{
    const before = pos(), prev = str(snap());
    fn();
    const now = snap();
    if (str(now) !== prev)
    {
        S.hist.length = S.hi + 1;
        S.hist.push({data: now, before, after: pos()});
        if (S.hist.length > 300) S.hist.shift();
        S.hi = S.hist.length - 1;
    }
    render();
}

function restore(i, at)
{
    S.hi = i;
    FILES.forEach((f, k) => {S.doc[f].data = JSON.parse(S.hist[i].data[k]);});
    Object.assign(S, at);
    render();
}
const undo = () => S.hi > 0 && restore(S.hi - 1, S.hist[S.hi].before);
const redo = () => S.hi < S.hist.length - 1 && restore(S.hi + 1, S.hist[S.hi + 1].after);

const set = (id, path, value) => commit(() => setAt(abs()[id], path, value));

// ---------- 讀寫 ----------
// 殼給專案根目錄；無頭測試可以直接給 public/assets
async function setAssets(dir)
{
    let assets = dir, root = null;
    if (!await FS.tryDir(dir, 'json')) {assets = await FS.tryDir(await FS.tryDir(dir, 'public') ?? dir, 'assets'); root = dir;}
    const json = await FS.tryDir(assets, 'json');
    if (!json) throw new Error(`「${dir.name}」裡沒有 public/assets/json`);
    for (const f of FILES) if (!await FS.tryFile(json, f)) throw new Error(`「${dir.name}」裡沒有 public/assets/json/${f}`);
    S.assets = {dir: assets, json, root};
    await reload();
}

async function load(file)
{
    const text = await FS.readText(S.assets.json, file);
    Object.assign(S.doc[file], {diskText: text, saved: JSON.parse(text), data: JSON.parse(text)});
}

async function reload()
{
    for (const f of FILES) await load(f);
    S.extra = {};
    S.drafts = {};
    resetHist();
    if (!trees()[S.tree]) S.tree = Object.keys(trees())[0] ?? null;
    if (!abs()[S.sel]) S.sel = null;
    status(`讀入 ${Object.keys(abs()).length} 個技能、${Object.keys(trees()).length} 棵樹`);
    render();
}

async function save()
{
    if (!S.assets) return status('先在上方選擇專案資料夾');
    const warns = [...Object.entries(S.drafts).map(([k, d]) => `${S.sel}：JSON 有錯還沒套用（${k}）${d.msg}`), ...validateAll()];
    if (warns.length)
    {
        const r = await ask(`有 ${warns.length} 個問題`, ul(warns), [['save', '仍然存檔'], ['cancel', '取消']]);
        if (r !== 'save') return status('取消存檔');
    }
    const done = [];
    for (const file of FILES)
    {
        const d = S.doc[file];
        if (!dirtyOf(file)) continue;
        const disk = await FS.readText(S.assets.json, file);
        if (disk !== d.diskText)
        {
            const m = merge3(JSON.parse(d.diskText), d.data, JSON.parse(disk));
            const r = await ask(`${file} 在讀進來之後被改過了`, [
                m.external.length && h('div', null, `外部改了：${m.external.join('、')}`),
                m.conflict.length && h('div', {class: 'warn'}, `兩邊都改了（合併時以這裡的為準）：${m.conflict.join('、')}`),
            ], [['merge', '合併後存檔'], ['overwrite', '直接覆蓋'], ['cancel', '取消']]);
            if (r !== 'merge' && r !== 'overwrite') {status('取消存檔'); render(); return;}
            if (r === 'merge') commit(() => {d.data = m.data;});
        }
        const text = JSON.stringify(d.data, null, 2);
        await FS.writeFile(S.assets.json, file, new Blob([text]));
        d.diskText = text;
        d.saved = JSON.parse(text);
        SH.notifySaved(file);
        done.push(file);
    }
    status(done.length ? `已存 ${done.join('、')}　${new Date().toLocaleTimeString()}` : '沒有修改');
    render();
}

// 別的分頁存了檔：沒改過就重讀（undo 紀錄從現在重算），改過就只提示（存檔時會合併）
async function onSaved(file)
{
    if (file === 'textures.json') return IC.ready.then(render);
    if (!FILES.includes(file) || !S.assets) return;
    if (dirtyOf(file)) return status(`${file} 在別的分頁存過了，存檔時會合併`);
    await load(file);
    resetHist();
    render();
    status(`${file} 在別的分頁存過了，已重讀`);
}

// ---------- 檢查 ----------
function checkVal(def, v, where, out)
{
    if (v === undefined) return;
    if (def.type === 'int' || def.type === 'num')
    {
        if (typeof v !== 'number') out.push(`${where} 不是數字：${str(v)}`);
        else if (def.type === 'int' && !Number.isInteger(v)) out.push(`${where} 應該是整數：${v}`);
    }
    else if (def.type === 'enum' && !def.options.includes(v)) out.push(`${where} 不認識的值：${v}`);
    else if (def.type === 'bool' && typeof v !== 'boolean') out.push(`${where} 應該是 true/false：${str(v)}`);
}

function validate(id)
{
    const ab = abs()[id], out = [];
    if (!ab.lab) out.push('沒有名稱 lab');
    const e = IC.check(ab.icon);
    if (e) out.push(`icon：${e}`);
    for (const [k, v] of Object.entries(ab))
    {
        const def = SC.FIELDS[k];
        if (!def || k === 'icon') continue;
        if (def.type !== 'cards') {checkVal(def, v, k, out); continue;}
        if (!Array.isArray(v)) {out.push(`${k} 應該是陣列`); continue;}
        v.forEach((x, i) => {for (const [f, d] of Object.entries(SC.CARDS[k].fields)) checkVal(d, x?.[f], `${k}[${i}].${f}`, out);});
    }
    out.push(...desWarns(ab));
    const t = treeOf(id);
    if (ab.refs !== undefined && !Array.isArray(ab.refs)) out.push('refs 應該是陣列');
    else for (const [i, r] of (ab.refs ?? []).entries())
    {
        if (ab.refs.indexOf(r) !== i) out.push(`前置重複：${r}`);
        else if (!abs()[r]) out.push(`前置指到不存在的技能：${r}`);
        else if (t && treeOf(r) !== t) out.push(`前置 ${r} 在別棵樹（${treeOf(r) ?? '不在樹上'}）`);
        else if (t && !linkOk(t, r, id)) out.push(`前置 ${r} 沒有在上面，遊戲的連線會畫歪`);
    }
    if (inCycle(id)) out.push('前置繞成一圈，永遠解不開');
    if (!t) out.push('不在任何一棵樹上');
    return out;
}

// ---------- 說明的 token（同遊戲 utility.js 的 fmt_Des） ----------
const TOKEN_RE = /{#([a-zA-Z]+)(\d*)}/g;
const HIT_TOKENS = ['fmt', 'formula', 'elm'];
// 沒有 hits 的技能把自己當第 0 筆
const hitOf = (ab, i) => Array.isArray(ab.hits) ? ab.hits[i] : i === 0 ? ab : undefined;
const whOf = (ab) => [ab.w ?? ab.zoneW, ab.h ?? ab.zoneH];
const lab = (k) => locals()[k]?.lab ?? k;

function tokenError(ab, key, idx)
{
    const tok = `{#${key}${idx}}`;
    if (HIT_TOKENS.includes(key))
        return hitOf(ab, idx === '' ? 0 : +idx) ? '' : `說明的 ${tok} 超出 hits 筆數（${Array.isArray(ab.hits) ? ab.hits.length : 1}）`;
    if (key === 'wh') return whOf(ab).includes(undefined) ? `說明的 ${tok} 沒有 w/h（或 zoneW/zoneH）` : '';
    if (idx !== '') return `說明的 ${tok}：只有 fmt／formula／elm 能帶索引`;
    return ab[key] ? '' : `說明的 ${tok}：技能沒有 ${key} 欄位（遊戲會顯示空白）`;
}

const desWarns = (ab) => typeof ab.des === 'string' ? [...ab.des.matchAll(TOKEN_RE)].map(m => tokenError(ab, m[1], m[2])).filter(Boolean) : [];

// 遊戲裡 {#fmt} 是用施放者屬性算出來的數字，這裡拿不到屬性，顯示成公式
function tokenEl(ab, key, idx)
{
    const err = tokenError(ab, key, idx);
    if (err) return h('span', {class: 'tokbad', title: err}, `{#${key}${idx}}`);
    const chip = (text) => h('span', {class: 'chip'}, text);
    if (HIT_TOKENS.includes(key))
    {
        const hit = hitOf(ab, idx === '' ? 0 : +idx), {pow = 1, flat = 0} = hit;
        const src = lab(hit.src ?? (ab.tag === 'heal' ? 'int' : 'atk'));
        const parts = [flat ? `${flat}+` : '', pow !== 1 ? `${pow}×` : '', src].join('');
        if (key === 'fmt') return chip(parts);
        if (key === 'elm') return h('b', null, lab(hit.elm ?? 'phy'));
        return ['\n', chip(`${lab(hit.elm ?? 'phy')} ${parts}`)];
    }
    if (key === 'wh') return h('b', null, whOf(ab).join('×'));
    return h('b', null, typeof ab[key] === 'string' ? lab(ab[key]) : String(ab[key]));
}

function desPreview(ab)
{
    const des = typeof ab.des === 'string' ? ab.des : '', out = [];
    let last = 0;
    for (const m of des.matchAll(TOKEN_RE))
    {
        out.push(des.slice(last, m.index), tokenEl(ab, m[1], m[2]));
        last = m.index + m[0].length;
    }
    out.push(des.slice(last));
    return h('div', {class: 'despv'}, out);
}

const nodeOf = (t, id) => trees()[t]?.find(n => n.id === id);
// 遊戲的連線只會從父往下畫，父要在子的上面（y 比較小）
function linkOk(t, parent, child)
{
    const p = nodeOf(t, parent), c = nodeOf(t, child);
    return !p || !c || p.y < c.y;
}

function inCycle(id)
{
    const seen = new Set(), stack = [...(abs()[id].refs ?? [])];
    while (stack.length)
    {
        const r = stack.pop();
        if (r === id) return true;
        if (seen.has(r)) continue;
        seen.add(r);
        const refs = abs()[r]?.refs;
        if (Array.isArray(refs)) stack.push(...refs);
    }
    return false;
}

function validateTree(t)
{
    const out = [], seen = {};
    if (!treeLab(t)) out.push(`沒有名稱（local.json 的 ${t}.lab）`);
    for (const n of trees()[t])
    {
        if (!abs()[n.id]) out.push(`${n.id} 不在 ability.json`);
        if (!Number.isInteger(n.x) || !Number.isInteger(n.y) || n.x < 0 || n.y < 0) out.push(`${n.id} 座標不是非負整數：${n.x},${n.y}`);
        const at = `${n.x},${n.y}`;
        if (seen[at]) out.push(`${seen[at]}、${n.id} 疊在同一格 ${at}`);
        seen[at] ??= n.id;
        const others = Object.keys(trees()).filter(o => o !== t && trees()[o].some(m => m.id === n.id));
        if (others.length) out.push(`${n.id} 也在 ${others.join('、')}`);
    }
    return out;
}

const validateAll = () => [
    ...Object.keys(trees()).flatMap(t => validateTree(t).map(w => `樹 ${t}：${w}`)),
    ...Object.keys(abs()).flatMap(id => validate(id).map(w => `${id}：${w}`)),
];

// ---------- 選取 ----------
function select(id)
{
    S.sel = id;
    S.tree = treeOf(id) ?? S.tree;
    S.link = null;
    render();
}

function selectTree(t)
{
    S.tree = t;
    S.link = null;
    if (treeOf(S.sel) !== t) S.sel = null;
    render();
}

// ---------- 樹的編輯 ----------
function moveNode(id, x, y)
{
    const nodes = trees()[S.tree], n = nodes.find(m => m.id === id), hit = nodes.find(m => m !== n && m.x === x && m.y === y);
    if (hit) {status(`${x},${y} 已經有 ${hit.id}`); return render();}
    if (n.x === x && n.y === y) return render();
    commit(() => {n.x = x; n.y = y; S.sel = id; S.link = null;});
}

function addRef(child, parent)
{
    const a = abs()[child];
    if (!a || child === parent) return render();
    if (Array.isArray(a.refs) && a.refs.includes(parent)) {status(`${parent} 已經是 ${child} 的前置`); return render();}
    commit(() => {
        if (Array.isArray(a.refs)) a.refs.push(parent);
        else a.refs = [parent];
        S.sel = child;
        S.link = {child, ref: parent};
    });
}

function removeRef(child, parent)
{
    const a = abs()[child];
    if (!Array.isArray(a?.refs) || !a.refs.includes(parent)) return;
    commit(() => {
        a.refs = a.refs.filter(r => r !== parent);
        if (!a.refs.length) delete a.refs;
        S.link = null;
    });
}

// ---------- 右鍵選單 ----------
const closeMenu = () => document.querySelector('.ctxmenu')?.remove();
addEventListener('pointerdown', (e) => {if (!e.target.closest?.('.ctxmenu')) closeMenu();});

// items: [[文字, fn, disabled]]，'-' 是分隔線
function menu(e, items)
{
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    document.body.append(h('div', {class: 'ctxmenu', style: `left:${e.clientX}px;top:${e.clientY}px`},
        items.filter(Boolean).map(([label, fn, disabled]) => label === '-' ? h('hr') :
            h('button', {type: 'button', disabled, onclick: () => {closeMenu(); fn();}}, label))));
}

// ---------- 技能：新增／複製／放上樹／改名／刪除 ----------
// 改名／刪除時這三個檔由工具一起改，掃外部引用時跳過
const OWN = ['json/ability.json', 'json/ab_tree.json', 'json/role.json'];
const renameKey = (obj, from, to) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));
const isFree = (t, x, y) => !trees()[t].some(n => n.x === x && n.y === y);

function idError(id, taken)
{
    if (!id) return '不能是空的';
    if (!ID_RE.test(id)) return '只能用英數字、底線、減號';
    if (taken) return `「${id}」已經有了`;
    return '';
}

// 排在 after 後面；沒給就排在目前這棵樹最後一個技能後面，都沒有就排最後
function insertAbility(id, value, after)
{
    const e = Object.entries(abs());
    const i = after ? e.findIndex(([k]) => k === after) : e.findLastIndex(([k]) => treeOf(k) === S.tree);
    e.splice(i < 0 ? e.length : i + 1, 0, [id, value]);
    S.doc['ability.json'].data = Object.fromEntries(e);
}

function add(id, x, y, lab)
{
    const err = idError(id, abs()[id]);
    if (err) return status(err);
    if (!isFree(S.tree, x, y)) return status(`${x},${y} 已經有技能了`);
    commit(() => {
        insertAbility(id, {...SC.template(), ...(lab && {lab})});
        trees()[S.tree].push({id, x, y});
        S.sel = id;
        S.link = null;
    });
}

async function askNew(x, y)
{
    const id = h('input', {size: 24}), lab = h('input', {size: 24});
    const p = ask(`新技能（${S.tree} 的 ${x},${y}）`, [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '名稱'), lab)],
        [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim(), x, y, lab.value.trim());
}

function place(id, x, y)
{
    if (treeOf(id) || !isFree(S.tree, x, y)) return;
    commit(() => {trees()[S.tree].push({id, x, y}); S.sel = id;});
}

function unplace(id)
{
    const t = treeOf(id);
    if (!t) return;
    commit(() => {trees()[t] = trees()[t].filter(n => n.id !== id); S.link = null;});
    status(`${id} 移出 ${t}，列在左欄「不在樹上」，在樹上空格右鍵可以放回去`);
}

function dup(id)
{
    let n = `${id}_copy`;
    for (let i = 2; abs()[n]; i++) n = `${id}_copy${i}`;
    const t = treeOf(id), at = t && nodeOf(t, id);
    commit(() => {
        insertAbility(n, structuredClone(abs()[id]), id);
        if (at)
        {
            let x = at.x + 1;
            while (!isFree(t, x, at.y)) x++;
            trees()[t].push({id: n, x, y: at.y});
        }
        S.sel = n;
    });
}

// 工具一起改的引用
function innerRefs(id)
{
    const out = [];
    for (const [k, a] of Object.entries(abs())) if (Array.isArray(a.refs) && a.refs.includes(id)) out.push(`ability.json：${k}.refs`);
    for (const t of Object.keys(trees())) if (trees()[t].some(n => n.id === id)) out.push(`ab_tree.json：${t}`);
    for (const [rid, r] of Object.entries(roles())) if (Array.isArray(r.abilities) && r.abilities.includes(id)) out.push(`role.json：${rid}.abilities`);
    return out;
}

const refList = (refs) => [
    refs.length ? ul(refs.map(r => `${r.file}：${r.path}`)) : h('div', {class: 'dim'}, '（沒有）'),
    !S.assets.root && h('div', {class: 'dim'}, '只掃了 public/assets；給專案根目錄才會一起掃 xls/、src/'),
];
const innerList = (refs) => refs.length ? ul(refs) : h('div', {class: 'dim'}, '（沒有）');

async function rename(from, to)
{
    if (from === to) return;
    const err = idError(to, abs()[to]);
    if (err) return status(err);
    const inner = innerRefs(from), outer = await scanRefsIn(S.assets, from, p => OWN.includes(p));
    const r = await ask(`改名 ${from} → ${to}`, [
        h('div', {class: 'title'}, '會一起改的'),
        innerList(inner),
        h('div', {class: 'title'}, '其他檔案（不會改，要自己處理）'),
        refList(outer),
        h('div', {class: 'dim'}, `翻譯的情境 ability.${from} 會變 orphan，要跑 node scripts/lang.js 後到 en.xlsx 處理`),
    ], [['ok', '改名'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    const sw = (a) => a.map(x => x === from ? to : x);
    commit(() => {
        S.doc['ability.json'].data = renameKey(abs(), from, to);
        for (const a of Object.values(abs())) if (Array.isArray(a.refs)) a.refs = sw(a.refs);
        for (const nodes of Object.values(trees())) for (const n of nodes) if (n.id === from) n.id = to;
        for (const ro of Object.values(roles())) if (Array.isArray(ro.abilities)) ro.abilities = sw(ro.abilities);
        if (S.extra[from]) {S.extra[to] = S.extra[from]; delete S.extra[from];}
        if (S.link) S.link = null;
        S.sel = to;
    });
    status(`已改名 ${from} → ${to}${outer.length ? `，其他檔案還有 ${outer.length} 處引用` : ''}`);
}

async function askRename(from)
{
    const to = h('input', {size: 24, value: from});
    const p = ask(`改名 ${from}`, [h('div', null, '新的 id：'), to], [['ok', '下一步'], ['cancel', '取消']]);
    to.select();
    if (await p === 'ok') await rename(from, to.value.trim());
}

async function remove(id)
{
    const inner = innerRefs(id), outer = await scanRefsIn(S.assets, id, p => OWN.includes(p));
    const r = await ask(`刪除 ${id}`, [
        h('div', {class: 'title'}, '會一起拿掉的（別人的前置、樹上的節點、角色的 abilities）'),
        innerList(inner),
        h('div', {class: 'title'}, '其他檔案（不會改）'),
        refList(outer),
    ], [['ok', '刪除'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    commit(() => {
        delete abs()[id];
        for (const a of Object.values(abs())) if (Array.isArray(a.refs) && a.refs.includes(id))
        {
            a.refs = a.refs.filter(x => x !== id);
            if (!a.refs.length) delete a.refs;
        }
        for (const t of Object.keys(trees())) trees()[t] = trees()[t].filter(n => n.id !== id);
        for (const ro of Object.values(roles())) if (Array.isArray(ro.abilities)) ro.abilities = ro.abilities.filter(x => x !== id);
        S.sel = null;
        S.link = null;
    });
}

// ---------- 樹：新增／改名／排序／刪除（樹名在 local.json 的 <樹>.lab，跟著改） ----------
function addTree(id, lab)
{
    const err = idError(id, trees()[id]);
    if (err) return status(err);
    commit(() => {
        trees()[id] = [];
        if (lab) setAt(locals(), [id, 'lab'], lab);
        S.tree = id;
        S.sel = null;
    });
}

async function askNewTree()
{
    const id = h('input', {size: 24}), lab = h('input', {size: 24});
    const p = ask('新樹', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '名稱'), lab)], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') addTree(id.value.trim(), lab.value.trim());
}

async function renameTree(from, to)
{
    if (from === to) return;
    const err = idError(to, trees()[to]) || (locals()[to] ? `local.json 已經有「${to}」` : '');
    if (err) return status(err);
    const outer = await scanRefsIn(S.assets, from, p => p === 'json/ab_tree.json' || p === 'json/local.json');
    const r = await ask(`樹改名 ${from} → ${to}`, [
        h('div', null, 'ab_tree.json 的 key 跟 local.json 的樹名 key 會一起改'),
        h('div', {class: 'title'}, '其他檔案（不會改，要自己處理）'),
        refList(outer),
        h('div', {class: 'dim'}, `翻譯的情境 ui.${from} 會變 orphan，要跑 node scripts/lang.js 後到 en.xlsx 處理`),
    ], [['ok', '改名'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    commit(() => {
        S.doc['ab_tree.json'].data = renameKey(trees(), from, to);
        if (from in locals()) S.doc['local.json'].data = renameKey(locals(), from, to);
        S.tree = to;
    });
}

async function askRenameTree(from)
{
    const to = h('input', {size: 24, value: from});
    const p = ask(`樹改名 ${from}`, [h('div', null, '新的 id：'), to], [['ok', '下一步'], ['cancel', '取消']]);
    to.select();
    if (await p === 'ok') await renameTree(from, to.value.trim());
}

// 樹的順序＝遊戲技能頁的分頁順序
function moveTree(t, d)
{
    const e = Object.entries(trees()), i = e.findIndex(([k]) => k === t);
    if (i + d < 0 || i + d >= e.length) return;
    [e[i], e[i + d]] = [e[i + d], e[i]];
    commit(() => {S.doc['ab_tree.json'].data = Object.fromEntries(e);});
}

async function removeTree(t)
{
    const n = trees()[t].length;
    const r = await ask(`刪除樹 ${t}`, [
        h('div', null, n ? `樹上的 ${n} 個技能留在 ability.json，變成「不在樹上」` : '樹上沒有技能'),
        locals()[t] && h('div', null, `local.json 的 ${t}（樹名）一起拿掉`),
    ], [['ok', '刪除'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    const keys = Object.keys(trees()), i = keys.indexOf(t);
    commit(() => {
        delete trees()[t];
        delete locals()[t];
        S.tree = keys[i + 1] ?? keys[i - 1] ?? null;
        S.sel = null;
        S.link = null;
    });
}

function treeMenu(e, t)
{
    const keys = Object.keys(trees()), i = keys.indexOf(t);
    menu(e, [
        ['改名…', () => askRenameTree(t)],
        ['上移', () => moveTree(t, -1), i === 0],
        ['下移', () => moveTree(t, 1), i === keys.length - 1],
        ['-'],
        ['新增樹…', askNewTree],
        ['-'],
        ['刪除…', () => removeTree(t)],
    ]);
}

function nodeMenu(e, id)
{
    menu(e, [
        ['改名…', () => askRename(id)],
        ['複製', () => dup(id)],
        ['移出這棵樹', () => unplace(id)],
        ['-'],
        ['刪除…', () => remove(id)],
    ]);
}

// 空格右鍵：新增技能，或把「不在樹上」的技能放上來
function cellMenu(e)
{
    if (e.target.closest('.node')) return;
    const b = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((e.clientX - b.left - M) / CELL), y = Math.floor((e.clientY - b.top - M) / CELL);
    if (x < 0 || y < 0) return;
    const orphans = Object.keys(abs()).filter(id => !treeOf(id));
    menu(e, [
        [`新增技能…（${x},${y}）`, () => askNew(x, y)],
        orphans.length && ['-'],
        ...orphans.map(id => [`放上 ${id}${abs()[id].lab ? `　${abs()[id].lab}` : ''}`, () => place(id, x, y)]),
    ]);
}

// ---------- 左欄 ----------
function abRow(id)
{
    const ab = abs()[id], w = validate(id);
    return h('div', {class: 'item' + (id === S.sel ? ' sel' : ''), dataset: {id}, onclick: () => select(id)},
        IC.iconEl(ab.icon, 20),
        h('span', {class: 'id'}, id),
        h('span', {class: 'lab'}, ab.lab ?? ''),
        h('span', {class: 'mark'}, dirtyAb(id) && h('span', {class: 'dirty', title: '未存檔'}, '●'), w.length && h('span', {class: 'warn', title: w.join('\n')}, '⚠')));
}

function renderList()
{
    const q = S.search.trim().toLowerCase();
    if (q)
    {
        const ids = Object.keys(abs()).filter(id => id.toLowerCase().includes(q) || (abs()[id].lab ?? '').toLowerCase().includes(q));
        return $('list').replaceChildren(ids.length ? h('div', {class: 'group'}, `技能（${ids.length}）`) : h('div', {class: 'dim'}, '（沒有符合的技能）'), ...ids.map(abRow));
    }
    const orphans = Object.keys(abs()).filter(id => !treeOf(id));
    $('list').replaceChildren(
        h('div', {class: 'group'}, `樹（${Object.keys(trees()).length}）`),
        ...Object.keys(trees()).map(t => {
            const w = validateTree(t), bad = trees()[t].filter(n => abs()[n.id] && validate(n.id).length).length;
            const dirty = trees()[t].some(n => dirtyAb(n.id)) || str(trees()[t]) !== str(S.doc['ab_tree.json'].saved[t]) || str(locals()[t]) !== str(S.doc['local.json'].saved[t]);
            return h('div', {class: 'item' + (t === S.tree ? ' sel' : ''), dataset: {tree: t}, title: '右鍵：改名、排序、刪除',
                onclick: () => selectTree(t), oncontextmenu: e => treeMenu(e, t)},
                h('span', {class: 'id'}, t),
                h('span', {class: 'lab'}, treeLab(t) ?? ''),
                h('span', {class: 'mark'}, h('span', {class: 'dim'}, trees()[t].length),
                    dirty && h('span', {class: 'dirty', title: '未存檔'}, ' ●'),
                    (w.length || bad) && h('span', {class: 'warn', title: [...w, bad && `${bad} 個技能有警告`].filter(Boolean).join('\n')}, ' ⚠')));
        }),
        orphans.length && h('div', {class: 'group'}, `不在樹上（${orphans.length}）`),
        ...orphans.map(abRow));
    $('list').querySelector('.item.sel')?.scrollIntoView({block: 'nearest'});
}

// ---------- 樹畫布 ----------
const center = (n) => ({x: M + CELL / 2 + n.x * CELL, y: M + CELL / 2 + n.y * CELL});

// 同 uiability.js 的 drawLink：同欄直線、不同欄從父往下到子的上一格再橫拉；子的上方那一小段由 selfMark 畫
function linkPts(p0, p1)
{
    if (p0.x === p1.x) return [[p1.x, p0.y + CELL / 2], [p1.x, p1.y - CELL / 2]];
    return [[p0.x, p0.y + CELL / 2], [p0.x, p1.y - CELL], [p1.x, p1.y - CELL]];
}
const selfMark = (p) => [[p.x, p.y - CELL], [p.x, p.y - CELL / 2]];

function svgEl(tag, attrs)
{
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
}

const cellAt = (px) => Math.max(0, Math.round((px - M) / CELL));

// 拖節點：放開時吸附到最近的格子；沒拖動（< 4px）交給 onclick 選取
function nodeDown(e, n)
{
    if (e.button !== 0) return;
    const el = e.currentTarget, sx = e.clientX, sy = e.clientY, ox = parseFloat(el.style.left), oy = parseFloat(el.style.top);
    let moved = false;
    if (e.isTrusted) el.setPointerCapture(e.pointerId);
    el.onpointermove = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true;
        el.classList.add('drag');
        el.style.left = `${ox + dx}px`;
        el.style.top = `${oy + dy}px`;
    };
    el.onpointerup = (ev) => {
        el.onpointermove = el.onpointerup = null;
        if (moved) moveNode(n.id, cellAt(ox + ev.clientX - sx), cellAt(oy + ev.clientY - sy));
    };
}

// 從節點底下的把手拉線到另一個節點：被拉到的那個多一個前置（拉線的這個）
function linkDown(e, n)
{
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = e.currentTarget, svg = el.closest('.tree').querySelector('svg.links'), box = svg.getBoundingClientRect(), p = center(n);
    const line = svgEl('polyline', {class: 'temp', points: `${p.x},${p.y + CELL / 2}`});
    svg.append(line);
    if (e.isTrusted) el.setPointerCapture(e.pointerId);
    el.onpointermove = (ev) => line.setAttribute('points', `${p.x},${p.y + CELL / 2} ${ev.clientX - box.left},${ev.clientY - box.top}`);
    el.onpointerup = (ev) => {
        el.onpointermove = el.onpointerup = null;
        line.remove();
        const to = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.node')?.dataset.id;
        if (to && to !== n.id) addRef(to, n.id);
    };
}

function renderTree()
{
    const t = S.tree, nodes = trees()[t];
    if (!nodes) return $('view').replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選樹）' : '先在上方選擇專案資料夾'));
    // 右邊、下面多留兩格，讓節點有地方拖
    const w = Math.max(0, ...nodes.map(n => n.x)) + 3, hh = Math.max(0, ...nodes.map(n => n.y)) + 3;
    const svg = svgEl('svg', {class: 'links', width: w * CELL + 2 * M, height: hh * CELL + 2 * M});
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
    for (const n of nodes)
    {
        const refs = abs()[n.id]?.refs;
        if (!Array.isArray(refs)) continue;
        for (const r of refs)
        {
            if (!byId[r]) continue;
            const pts = linkPts(center(byId[r]), center(n)).join(' ');
            const sel = S.link?.child === n.id && S.link.ref === r;
            const hit = svgEl('polyline', {class: 'hit', points: pts}), tip = svgEl('title', {});
            tip.textContent = `${r} → ${n.id}（點選後按 Del 刪除）`;
            hit.append(tip);
            hit.addEventListener('click', () => {S.link = sel ? null : {child: n.id, ref: r}; render();});
            const g = svgEl('g', {'data-link': `${r}>${n.id}`});
            g.append(svgEl('polyline', {class: 'link' + (linkOk(t, r, n.id) ? '' : ' bad') + (sel ? ' sel' : ''), points: pts}), hit);
            svg.append(g);
        }
        svg.append(svgEl('polyline', {class: 'link', points: selfMark(center(n)).join(' ')}));
    }
    const warns = validateTree(t);
    $('view').replaceChildren(
        h('div', {class: 'treebar'},
            h('span', {class: 'bigid'}, t),
            h('label', null, '名稱 ', h('input', {dataset: {k: `tree.${t}.lab`}, value: treeLab(t) ?? '',
                onchange: e => commit(() => setAt(locals(), [t, 'lab'], e.target.value.trim() || undefined))}))),
        warns.length && h('ul', {class: 'warns'}, warns.map(x => h('li', null, x))),
        h('div', {class: 'tree', style: `width:${w * CELL + 2 * M}px;height:${hh * CELL + 2 * M}px;--cell:${CELL}px;--m:${M}px`, oncontextmenu: cellMenu},
            svg,
            nodes.map(n => {
                const ab = abs()[n.id], p = center(n), bad = !ab || validate(n.id).length;
                return h('div', {class: 'node' + (n.id === S.sel ? ' sel' : '') + (bad ? ' bad' : ''), dataset: {id: n.id},
                    title: [n.id, ...(ab ? validate(n.id) : ['不在 ability.json'])].join('\n'),
                    style: `left:${p.x - CELL / 2}px;top:${p.y - CELL / 2}px`, onclick: () => ab && select(n.id), onpointerdown: e => nodeDown(e, n), oncontextmenu: e => ab ? nodeMenu(e, n.id) : e.preventDefault()},
                    IC.iconEl(ab?.icon, 40),
                    h('div', {class: 'nlab'}, ab?.lab ?? n.id),
                    ab && h('div', {class: 'handle', title: '拉到另一個技能＝設成它的前置', onpointerdown: e => linkDown(e, n), onclick: e => e.stopPropagation()}));
            })));
}

// ---------- 表單 ----------
function addCard(id, k)
{
    S.open[k] = true;
    commit(() => {const ab = abs()[id]; (ab[k] ??= []).push(SC.CARDS[k].blank());});
}

function delCard(id, k, i)
{
    commit(() => {const ab = abs()[id]; ab[k].splice(i, 1); if (!ab[k].length) delete ab[k];});
}

function card(id, k, list, i)
{
    const C = SC.CARDS[k], x = list[i], path = [k, i];
    const move = (d) => commit(() => {const a = abs()[id][k]; [a[i], a[i + d]] = [a[i + d], a[i]];});
    const known = (f) => !!C.fields[f];
    return h('div', {class: 'card'},
        h('div', {class: 'bar'},
            h('span', {class: 'sum'}, C.summary(x, abs()[id])),
            h('button', {type: 'button', title: '上移', disabled: i === 0, onclick: () => move(-1)}, '↑'),
            h('button', {type: 'button', title: '下移', disabled: i === list.length - 1, onclick: () => move(1)}, '↓'),
            h('button', {type: 'button', title: '複製', onclick: () => commit(() => abs()[id][k].splice(i + 1, 0, structuredClone(x)))}, '⧉'),
            h('button', {type: 'button', title: '刪除', onclick: () => delCard(id, k, i)}, '×')),
        h('div', {class: 'sub'},
            C.fieldsOf(x).map(f => h('label', null, h('span', {title: f}, C.fields[f].label),
                fieldInput(C.fields[f], x[f], v => set(id, [...path, f], v), `${k}.${i}.${f}`)))),
        h('details', {open: Object.keys(x).some(f => !known(f))}, h('summary', {class: 'dim'}, '額外欄位（JSON）'),
            F.rawArea(x, known, v => commit(() => replaceRaw(abs()[id][k][i], known, v)), `${k}.${i}.#raw`)));
}

function cardBox(id, ab, k)
{
    const C = SC.CARDS[k], list = Array.isArray(ab[k]) ? ab[k] : [];
    const open = F.isOpen(k, list);
    return h('div', {class: 'box'},
        F.boxBar(k, open, list.length > 0, h('span', {title: k}, C.label), h('span', {class: 'dim'}, `（${list.length}）`), h('span', {class: 'grow'}),
            h('button', {type: 'button', onclick: () => addCard(id, k)}, C.add)),
        open && list.map((_, i) => card(id, k, list, i)));
}

function otherBox(id, ab, known)
{
    const raw = Object.fromEntries(Object.entries(ab).filter(([k]) => !known(k)));
    const open = F.isOpen('#raw', raw), n = Object.keys(raw).length;
    return h('div', {class: 'box'},
        F.boxBar('#raw', open, n > 0, '其他欄位', h('span', {class: 'dim'}, `（${n}）原始 JSON，表單沒列到的 key`)),
        open && F.rawArea(ab, known, raw => commit(() => replaceRaw(abs()[id], known, raw)), '#raw'));
}

function renderForm()
{
    const id = S.sel, ab = abs()[id];
    if (!ab) return $('pv').replaceChildren(h('div', {class: 'dim'}, '（點樹上的技能）'));
    const shown = [...new Set([...SC.shownFields(ab), ...(S.extra[id] ?? [])])];
    const rest = Object.keys(SC.FIELDS).filter(k => !shown.includes(k));
    const known = (k) => !!SC.FIELDS[k] || SC.SPECIAL.includes(k);
    const warns = validate(id);
    $('pv').replaceChildren(...[
        h('div', {class: 'head'},
            IC.iconEl(ab.icon, 48),
            h('span', {class: 'bigid'}, id),
            dirtyAb(id) && h('span', {class: 'dirty'}, '●'),
            h('span', {class: 'grow'}),
            h('button', {type: 'button', onclick: () => askRename(id)}, '改名…'),
            h('button', {type: 'button', onclick: () => dup(id)}, '複製'),
            h('button', {type: 'button', onclick: () => remove(id)}, '刪除…')),
        warns.length && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
        h('div', {class: 'fields'},
            shown.map(k => SC.FIELDS[k].type === 'cards' ? cardBox(id, ab, k) : [
                h('span', {class: 'k' + (ab[k] === undefined ? ' unset' : ''), title: k}, SC.FIELDS[k].label),
                fieldInput(SC.FIELDS[k], ab[k], v => set(id, [k], v), k),
                k === 'des' && [h('span', {class: 'k unset'}, '預覽'), desPreview(ab)],
            ]),
            h('span', {class: 'k' + (ab.refs ? '' : ' unset'), title: 'refs（在樹上拉線）'}, '前置'),
            h('span', {class: 'refs'}, Array.isArray(ab.refs) && ab.refs.length ? ab.refs.join('、') : h('span', {class: 'dim'}, '—')),
            rest.length && [h('span', {class: 'k unset'}, '加欄位'),
                h('select', {onchange: e => {
                    const k = e.target.value;
                    if (SC.FIELDS[k].type === 'cards') return addCard(id, k);
                    (S.extra[id] ??= new Set()).add(k);
                    render();
                }},
                    h('option', {value: ''}, '…'), rest.map(k => h('option', {value: k}, `${SC.FIELDS[k].label}　${k}`)))],
            otherBox(id, ab, known)),
    ].filter(Boolean));
}

// ---------- 畫面 ----------
function render()
{
    const focus = document.activeElement?.dataset?.k;
    if (S.formOf !== S.sel) {S.drafts = {}; S.open = {}; S.formOf = S.sel;}
    const vals = (k) => Object.values(abs()).map(a => a[k]);
    const sub = (list, k) => Object.values(abs()).flatMap(a => Array.isArray(a[list]) ? a[list].map(x => x?.[k]) : []);
    renderDatalists({
        tag: [...SC.FIELDS.tag.suggest, ...vals('tag')],
        reqClass: [...SC.FIELDS.reqClass.suggest, ...vals('reqClass'), ...sub('effects', 'reqClass')],
        anim: [...S.anims, ...vals('anim')],
        src: [...SC.STATS, ...sub('hits', 'src')],
        key: [...SC.STATS, ...sub('effects', 'key')],
        id: [...S.fx, ...sub('effects', 'id')],
    });
    renderList();
    renderTree();
    renderForm();
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1;
    $('btnSave').disabled = $('btnReload').disabled = $('btnNewTree').disabled = !S.assets;
    $('dirty').hidden = !isDirty();
    SH.setDirty(isDirty());
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

$('btnReload').onclick = async () => {
    if (isDirty() && await ask('重新讀取', '還沒存檔的修改會不見', [['ok', '重新讀取'], ['cancel', '取消']]) !== 'ok') return;
    reload();
};
$('btnSave').onclick = save;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('search').oninput = (e) => {S.search = e.target.value; render();};
$('btnNewTree').onclick = askNewTree;

addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // 先失焦讓正在打的欄位觸發 change 套用
    if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
    if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if ((k === 'delete' || k === 'backspace') && S.link) {e.preventDefault(); removeRef(S.link.child, S.link.ref);}
    if (k === 'escape') {closeMenu(); if (S.link) {S.link = null; render();}}
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});

(async () => {
    S.anims = await fetch('/assets/json/anim.json').then(r => r.json()).then(Object.keys).catch(() => []);
    S.fx = await fetch('/assets/json/fx.json').then(r => r.json()).then(Object.keys).catch(() => []);
    render();
    IC.ready.then(render);
    SH.onSaved(onSaved);
    SH.onProject(dir => setAssets(dir).catch(e => status(e.message)));
})();

// 給無頭測試用
window.__ab = {S, setAssets, reload, save, commit, set, undo, redo, select, selectTree, moveNode, addRef, removeRef, addCard, delCard,
               add, place, unplace, dup, rename, remove, innerRefs, addTree, renameTree, moveTree, removeTree, validate, validateTree, validateAll, render, IC, CELL, M};
