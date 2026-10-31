// 部位（part.json）總覽與整理：左樹（照 kind 分組）、中間沒選＝縮圖總覽／選了＝詳細、右欄合成；壞的／沒人用的標出來；改名、改 kind、換圖、新增、複製、刪除都立刻寫檔＋廣播，沒有 undo
// 擺放數字不在這裡調（唯讀），要調按「↗ 到試穿調」
import {$, h, ask, status} from '../common/dom.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import * as IC from '../common/icons.js';
import * as PT from '../common/part.js';
import {ID_RE} from '../common/doc.js';
import {createFold} from '../common/fold.js';
import '../common/splitter.js';
import {previewEl} from '../role/preview.js';
import {ROLE_PARTS} from '../../src/core/equip.js';

const KIND_NAMES = {body: '身體', shoes: '鞋子', cloth: '衣服', head: '頭', hair: '頭髮', hand: '手'};
const FILTERS = [['all', '全部'], ['unused', '未使用'], ['bad', '壞的']];
// 人偶：角色編輯器人形範本的身體跟尺寸
const DOLL = {m: 'body-man', f: 'body-woman'};
const DOLL_ROLE = {w: 32, h: 64, anchor: {x: 0, y: 16}};

const S = {
    assets: null,       // {dir: public/assets, json, root: 專案根目錄（測試直接給 public/assets 時是 null）}
    parts: {},
    roles: {},
    filter: 'all',
    search: '',
    sel: null,
    sex: 'm',           // 合成套在男／女人偶，記在頁面
};
const SEX_KEY = 'tools.part.sex';
try {if (localStorage.getItem(SEX_KEY) === 'f') S.sex = 'f';} catch {}

const F = createFold();

const usersOf = (pid) => PT.usersOf(S.roles, pid);
const isDoll = (r) => !!(r.head || r.hand);

function problems(pid)
{
    const p = S.parts[pid], out = [];
    if (!ROLE_PARTS.includes(p.kind)) out.push(`kind「${p.kind ?? ''}」不是 ${ROLE_PARTS.join('／')}`);
    const e = IC.check(p.sprite);
    if (e) out.push(`sprite：${e}`);
    for (const [rid, r] of Object.entries(S.roles))
        for (const k of ROLE_PARTS) if (r[k] === pid && k !== p.kind) out.push(`${rid} 的 ${k} 指到它，但它是 ${p.kind}`);
    return out;
}
const isBad = (pid) => problems(pid).length > 0;
const isUnused = (pid) => !usersOf(pid).length;

// ---------- 讀取 ----------
// 殼給專案根目錄；無頭測試可以直接給 public/assets
async function setRoot(dir)
{
    let root = null, assets = dir, json = await FS.tryDir(dir, 'json');
    if (!json)
    {
        assets = await FS.tryDir(await FS.tryDir(dir, 'public') ?? dir, 'assets');
        json = assets && await FS.tryDir(assets, 'json');
        root = dir;
    }
    if (!json || !await FS.tryFile(json, 'part.json')) throw new Error(`「${dir.name}」裡沒有 public/assets/json/part.json`);
    S.assets = {dir: assets, json, root};
    await reload();
}

async function reload()
{
    if (!S.assets) return;
    S.parts = await PT.readParts(S.assets.json);
    S.roles = JSON.parse(await FS.readText(S.assets.json, 'role.json'));
    if (!S.parts[S.sel]) S.sel = null;
    render();
}

// ---------- 篩選、分組 ----------
function visible()
{
    const q = S.search.trim().toLowerCase();
    return Object.keys(S.parts).filter(pid =>
        (S.filter !== 'unused' || isUnused(pid)) && (S.filter !== 'bad' || isBad(pid))
        && (!q || pid.toLowerCase().includes(q) || String(S.parts[pid].sprite ?? '').toLowerCase().includes(q)));
}

const SECS = [...ROLE_PARTS.map(k => [k, `${KIND_NAMES[k]}　${k}`]), ['#unknown', '不認識的 kind']];
const inSec = (k, pid) => (k === '#unknown' ? !ROLE_PARTS.includes(S.parts[pid].kind) : S.parts[pid].kind === k);
// [[key, 標題, ids]]，空的組不列
function groups()
{
    const ids = visible();
    return SECS.map(([k, name]) => [k, name, ids.filter(pid => inSec(k, pid))]).filter(([, , list]) => list.length);
}

// 再點一次選到的＝取消選取（回總覽）
const pick = (pid) => {S.sel = S.sel === pid ? null : pid; render();};

// ---------- 左欄：樹 ----------
// 同 views.js 的 renderList：摺起來的組裡不留選取，從別處選到（總覽卡片、新增、改名、↗ 跳過來）就展開那組
function renderList()
{
    const searching = !!S.search.trim(), gs = groups(), keys = gs.map(([k]) => k);
    const mine = gs.find(([, , list]) => list.includes(S.sel))?.[0];
    if (mine !== undefined && !searching) F.open(mine);
    const onToggle = () => {
        if (mine !== undefined && F.folded(mine, searching)) S.sel = null;
        render();
    };
    $('list').replaceChildren(...gs.flatMap(([k, name, list]) => [
        F.head(k, `${name}（${list.length}）`, keys, onToggle, searching),
        ...F.folded(k, searching) ? [] : list.map(pid => {
            const users = usersOf(pid), bad = problems(pid);
            return h('div', {class: 'item' + (pid === S.sel ? ' sel' : '') + (users.length ? '' : ' unused'), dataset: {id: pid}, onclick: () => pick(pid)},
                IC.iconEl(S.parts[pid].sprite, 20),
                h('span', {class: 'id'}, pid),
                h('span', {class: 'n', title: users.join('、') || '沒有角色在用'}, users.length),
                bad.length > 0 && h('span', {class: 'warn', title: bad.join('\n')}, '⚠'));
        }),
    ]));
    $('list').querySelector('.item.sel')?.scrollIntoView({block: 'nearest'});
}

// ---------- 中間：沒選＝縮圖總覽 ----------
function cell(pid)
{
    const p = S.parts[pid], n = usersOf(pid).length, bad = problems(pid);
    return h('div', {class: ['cell', !n && 'unused', bad.length && 'bad'].filter(Boolean).join(' '), dataset: {id: pid},
            title: [pid, bad.length ? bad.join('\n') : n ? `${n} 個角色在用` : '沒有角色在用'].join('\n'), onclick: () => pick(pid)},
        IC.iconEl(p.sprite, 64), h('div', {class: 'k'}, pid), n > 0 && h('span', {class: 'n'}, n));
}

function renderWall()
{
    const gs = groups();
    $('view').replaceChildren(...(gs.length
        ? gs.flatMap(([, name, list]) => [h('div', {class: 'sec'}, name, h('span', {class: 'dim'}, `（${list.length}）`)), h('div', {class: 'cells'}, list.map(cell))])
        : [h('div', {class: 'dim'}, '（沒有符合的）')]));
}

// ---------- 中間：詳細；右欄：合成 ----------
function dollOf(pid, sex)
{
    const r = {...DOLL_ROLE, sex, body: DOLL[sex]};
    const k = S.parts[pid].kind;
    if (ROLE_PARTS.includes(k)) r[k] = pid;
    return r;
}

function fieldRows(p)
{
    return Object.entries(p).filter(([k]) => k !== 'kind').map(([k, v]) =>
        h('tr', null, h('td', {class: 'k'}, k), h('td', null, typeof v === 'object' ? JSON.stringify(v) : String(v))));
}

function renderDetail()
{
    const pid = S.sel, p = S.parts[pid];
    const users = usersOf(pid), bad = problems(pid), doll = users.find(rid => isDoll(S.roles[rid]));
    $('view').replaceChildren(
        h('div', {class: 'head'}, h('span', {class: 'bigid'}, pid), h('span', {class: 'dim'}, `${KIND_NAMES[p.kind] ?? ''} ${p.kind ?? ''}`),
            h('span', {class: 'grow'}),
            h('span', {class: 'acts'},
                h('button', {disabled: !doll, title: doll ? `到試穿分頁選 ${doll}、游標放在這個部位的數字` : '沒有紙娃娃型角色（有 head 或 hand）在用，試穿挑不到',
                    onclick: () => SH.gotoTab('fit', [doll, p.kind])}, '↗ 到試穿調'),
                h('button', {onclick: () => act(renamePart(pid))}, '改名…'),
                h('button', {onclick: () => act(changeKind(pid))}, '改 kind…'),
                h('button', {onclick: () => act(changeSprite(pid))}, '換圖…'),
                h('button', {onclick: () => act(askEntry(pid))}, '複製…'),
                h('button', {onclick: () => act(deletePart(pid))}, '刪除…'))),
        bad.length > 0 && h('ul', {class: 'warns'}, bad.map(w => h('li', null, w))),
        h('div', {class: 'title'}, '原圖'),
        IC.iconEl(p.sprite, 160),
        h('div', {class: 'title'}, '欄位（唯讀）'),
        h('table', null, fieldRows(p)),
        h('div', {class: 'title'}, `使用者（${users.length}）`),
        users.length ? h('ul', {class: 'users'}, users.map(rid => h('li', null, rid, ' ', h('span', {class: 'dim'}, S.roles[rid].lab ?? ''),
                h('a', {class: 'go', title: '到角色分頁', onclick: () => SH.gotoTab('role', [rid])}, ' ↗'))))
            : h('div', {class: 'dim'}, '（沒有角色在用；路人隨機長相做好之後也可能是素材，不一定要刪）'));
    const sexBtn = (sx, name) => h('button', {class: S.sex === sx ? 'on' : '', dataset: {sex: sx}, onclick: () => setSex(sx)}, name);
    $('right').replaceChildren(
        h('div', {class: 'cap'}, `套在 ${DOLL[S.sex]}`, S.sex === 'f' && (p.f ? '，用女版 f' : '（沒有 f，用基準數字）')),
        previewEl(dollOf(pid, S.sex), {}, S.parts),
        h('div', {class: 'sexsw'}, sexBtn('m', '男'), sexBtn('f', '女')));
}

function setSex(sx)
{
    S.sex = sx;
    try {localStorage.setItem(SEX_KEY, sx);} catch {}
    render();
}

function render()
{
    const all = Object.keys(S.parts);
    const count = {all: all.length, unused: all.filter(isUnused).length, bad: all.filter(isBad).length};
    $('filters').replaceChildren(...FILTERS.map(([f, name]) => h('button', {class: S.filter === f ? 'on' : '', dataset: {filter: f},
        onclick: () => {S.filter = f; render();}}, `${name}（${count[f]}）`)));
    $('btnNew').disabled = !S.assets;
    renderList();
    if (S.parts[S.sel]) return renderDetail();
    $('right').replaceChildren();
    if (S.assets) renderWall();
    else $('view').replaceChildren(h('div', {class: 'dim'}, '先在上方選擇專案資料夾'));
}

// ---------- 動作（立刻寫檔） ----------
const act = (p) => p.catch(e => status(e.message));

// 照 entries 排好的新 part.json 寫檔、選到 sel
async function save(parts, sel, msg)
{
    await PT.writeParts(S.assets.json, parts);
    S.sel = sel;
    await reload();
    status(msg);
}

// 插在 after 後面；after 不在就接在同 kind 最後一筆後面（都沒有就最後）
function insert(parts, id, v, after)
{
    const e = Object.entries(parts);
    let i = e.findIndex(([k]) => k === after);
    if (i < 0) i = e.findLastIndex(([, x]) => x.kind === v.kind);
    e.splice(i < 0 ? e.length : i + 1, 0, [id, v]);
    return Object.fromEntries(e);
}

async function renamePart(from)
{
    const users = usersOf(from), to = await PT.askRename(S.assets.json, S.assets.root, from, users);
    if (!to) return;
    await PT.rename(S.assets.json, from, to);
    if (users.length)
    {
        const roles = JSON.parse(await FS.readText(S.assets.json, 'role.json'));
        PT.renameRefs(roles, from, to);
        await FS.writeFile(S.assets.json, 'role.json', new Blob([JSON.stringify(roles, null, 2)]));
        SH.notifySaved('role.json');
    }
    S.sel = to;
    await reload();
    status(`已改名 ${from} → ${to}${users.length ? `（${users.join('、')}）` : ''}`);
}

async function deletePart(pid)
{
    if (!await PT.askDelete(pid, usersOf(pid))) return;
    await PT.remove(S.assets.json, pid);
    S.sel = null;
    await reload();
    status(`已刪除 ${pid}`);
}

const kindSelect = (cur) => h('select', null, ROLE_PARTS.map(k => h('option', {value: k, selected: k === cur}, `${KIND_NAMES[k]}　${k}`)));

// 有角色在用就擋：角色的欄位跟著 kind 走，改了會變成放錯欄位
async function changeKind(pid)
{
    const users = usersOf(pid);
    if (users.length) return void await ask(`不能改 ${pid} 的 kind`, h('div', null, `還有角色在用：${users.join('、')}`), [['ok', '知道了']]);
    const sel = kindSelect(S.parts[pid].kind);
    if (await ask(`改 ${pid} 的 kind`, sel, [['ok', '改'], ['cancel', '取消']]) !== 'ok' || sel.value === S.parts[pid].kind) return;
    const parts = await PT.readParts(S.assets.json);
    parts[pid].kind = sel.value;
    await save(parts, pid, `${pid} 改成 ${sel.value}`);
}

async function changeSprite(pid)
{
    const v = await IC.pickIcon(S.parts[pid].sprite);
    if (!v || v === S.parts[pid].sprite) return;
    const parts = await PT.readParts(S.assets.json);
    parts[pid].sprite = v;
    await save(parts, pid, `${pid} 換成 ${v}（擺放沒動，到試穿調）`);
}

// 新增（src 省略）或複製 src：問 id、kind、圖
// 新增的數字抄同 kind 第一筆的 scale/x/y，複製整筆照抄；都排在同 kind 後面（複製排在 src 後面）
async function askEntry(src)
{
    const base = src && S.parts[src];
    let sprite = base?.sprite ?? '', auto = !base;
    const suggest = () => {let n = sprite.replace(/:/g, '-'); for (let i = 2; S.parts[n]; i++) n = `${sprite.replace(/:/g, '-')}-${i}`; return n;};
    const id = h('input', {size: 24, value: base ? `${src}-2` : '', oninput: () => {auto = false;}});
    const kind = kindSelect(base?.kind ?? S.parts[S.sel]?.kind ?? 'body');
    const ico = h('span', null, IC.iconEl(sprite, 48));
    const pick = h('button', {type: 'button', onclick: async () => {
        const v = await IC.pickIcon(sprite);
        if (!v) return;
        sprite = v;
        ico.replaceChildren(IC.iconEl(sprite, 48));
        if (auto) id.value = suggest();
    }}, '選圖…');
    const p = ask(base ? `複製 ${src}` : '新增部位', [h('div', {class: 'fields'},
        h('span', {class: 'k'}, 'id'), id,
        h('span', {class: 'k'}, 'kind'), kind,
        h('span', {class: 'k'}, '圖'), h('span', {class: 'iconField'}, ico, pick)),
        h('div', {class: 'hint'}, base ? '整筆照抄（含女版 f），可以換圖' : '數字抄同 kind 第一筆的 scale／x／y，建好再到試穿調')],
        [['ok', base ? '複製' : '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p !== 'ok') return;
    const nid = id.value.trim(), parts = await PT.readParts(S.assets.json);
    if (!ID_RE.test(nid)) return status('id 只能用英數字、底線、減號');
    if (parts[nid]) return status(`part.json 已經有 ${nid}`);
    if (!sprite) return status('要選一張圖');
    let v;
    if (base) v = {...structuredClone(base), kind: kind.value, sprite};
    else
    {
        const first = Object.values(parts).find(x => x.kind === kind.value);
        v = {kind: kind.value, sprite, ...Object.fromEntries(['scale', 'x', 'y'].filter(k => first?.[k] !== undefined).map(k => [k, first[k]]))};
    }
    await save(insert(parts, nid, v, base && kind.value === base.kind ? src : null), nid, `已${base ? '複製' : '新增'} ${nid}`);
}

// ---------- 接線 ----------
$('btnNew').onclick = () => act(askEntry());
$('search').oninput = (e) => {S.search = e.target.value; render();};
SH.onSaved((file) => {
    if (file === 'part.json' || file === 'role.json') act(reload());
    if (file === 'textures.json') IC.ready.then(render);
});
SH.onGoto(([pid]) => {S.sel = pid; S.filter = 'all'; render();});
SH.onProject((dir) => act(setRoot(dir)));
render();
IC.ready.then(render);

// 給無頭測試用
window.__pt = {S, setRoot, reload, render, problems, isBad, isUnused, renamePart, deletePart, changeKind, changeSprite, askEntry, IC};
