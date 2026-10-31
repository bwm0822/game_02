// 部位（part.json）總覽與整理：左樹（照 kind 分組）、中間沒選＝縮圖總覽／選了＝詳細、右欄合成；壞的／沒人用的標出來；改名、改 kind、換圖、新增、複製、刪除都立刻寫檔＋廣播
// 擺放數字（scale/x/y/a/ox/oy，女版改 f）也在詳細裡改，一樣立刻寫檔；只有擺放有 undo（條目層級，undo 也立刻寫）
import {$, h, ask, status} from '../common/dom.js';
import {str, isObj, parseNum} from '../common/obj.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import * as ST from '../common/settings.js';
import * as IC from '../common/icons.js';
import * as PT from '../common/part.js';
import {ID_RE} from '../common/doc.js';
import {createFold} from '../common/fold.js';
import '../common/splitter.js';
import {previewEl} from '../role/preview.js';
import {ROLE_PARTS, PIVOTS, pivotOf, equipFor} from '../../src/core/equip.js';
import {PIVOT_NAMES, PIVOT_COLOR} from '../common/handles.js';

const KIND_NAMES = {body: '身體', shoes: '鞋子', cloth: '衣服', head: '頭', hair: '頭髮', handF: '前手', handB: '後手'};
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
    sex: 'm',           // 合成套在男／女人偶，記在頁面；女＝擺放數字的 scale/x/y 改 f
    hist: [], hi: 0,    // 擺放的 undo：[{pid, before, after}]，hi＝下一筆要放的位置
};
const NUMS = [['scale', '1'], ['x', '0'], ['y', '0'], ['a', '0'], ['ox', '0.5'], ['oy', '1']];
const SEX_NUMS = ['scale', 'x', 'y'];
const SEX_KEY = 'tools.part.sex', TAB_KEY = 'tools.part.tab';
S.tab = 'all';      // 總覽的部位分頁：all／kind／#unknown，記在頁面
try {if (localStorage.getItem(SEX_KEY) === 'f') S.sex = 'f'; S.tab = localStorage.getItem(TAB_KEY) || 'all';} catch {}

const F = createFold();

const usersOf = (pid) => PT.usersOf(S.roles, pid);
const isDoll = (r) => !!(r.head || r.handF || r.handB);

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
    // 數字欄的步進看 tools/settings.json，讀不到用內建值
    if (root) await ST.load(root).catch(e => status(`tools/settings.json 讀不到：${e.message}`));
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

// 上方分頁切部位：全部＝照組分段，其他一次只列一個部位；目前分頁就算篩選後空了也留著
function renderWall()
{
    const gs = groups(), n = gs.reduce((s, [, , list]) => s + list.length, 0);
    const tabs = [['all', '全部', n], ...SECS.map(([k, name]) => [k, name.split('　')[0], gs.find(([g]) => g === k)?.[2].length ?? 0])
        .filter(([k, , c]) => c || k === S.tab)];
    const shown = S.tab === 'all' ? gs : gs.filter(([k]) => k === S.tab);
    $('view').replaceChildren(
        h('div', {class: 'tabs'}, tabs.map(([k, name, c]) => h('button', {class: S.tab === k ? 'on' : '', dataset: {tab: k}, onclick: () => setTab(k)}, `${name}（${c}）`))),
        ...(shown.length
            ? shown.flatMap(([, name, list]) => [S.tab === 'all' && h('div', {class: 'sec'}, name, h('span', {class: 'dim'}, `（${list.length}）`)), h('div', {class: 'cells'}, list.map(cell))])
            : [h('div', {class: 'dim'}, '（沒有符合的）')]));
}

function setTab(k)
{
    S.tab = k;
    try {localStorage.setItem(TAB_KEY, k);} catch {}
    render();
}

// ---------- 中間：詳細；右欄：合成 ----------
function dollOf(pid, sex)
{
    const r = {...DOLL_ROLE, sex, body: DOLL[sex]};
    const k = S.parts[pid].kind;
    if (ROLE_PARTS.includes(k)) r[k] = pid;
    return r;
}

// 擺放、支點以外的欄位唯讀
function fieldRows(p)
{
    return Object.entries(p).filter(([k]) => k !== 'kind' && k !== 'f' && !NUMS.some(([n]) => n === k) && !(p.kind === 'body' && PIVOTS.includes(k))).map(([k, v]) =>
        h('tr', null, h('td', {class: 'k'}, k), h('td', null, typeof v === 'object' ? JSON.stringify(v) : String(v))));
}

// 擺放數字：女（右欄切到女）的 scale/x/y 改 f，第一次改從基準複製（同試穿的 sexCells）；清空＝刪 key
function numTable(pid)
{
    const p = S.parts[pid], sx = S.sex === 'f' ? 'f' : null, has = isObj(p.f);
    const cell = (k, ph) => {
        const inF = sx && SEX_NUMS.includes(k), v = inF ? p.f?.[k] : p[k];
        const fromPh = (el) => {if (el.value === '' && Number.isFinite(parseFloat(el.placeholder))) el.value = el.placeholder;};
        return h('td', null, h('input', {type: 'number', step: ST.step(k) ?? 'any', class: 'num', value: v ?? '',
            placeholder: inF ? String(p[k] ?? ph) : ph, dataset: {k: `part.json|${pid}|${inF ? `f.${k}` : k}`},
            onkeydown: (e) => {if (e.key === 'ArrowUp' || e.key === 'ArrowDown') fromPh(e.target);},
            onmousedown: (e) => {if (e.offsetX > e.target.clientWidth - 20) fromPh(e.target);},
            onchange: (e) => {
                const n = parseNum(e.target.value);
                if (typeof n === 'string') {status(`${k} 要是數字`); return render();}
                act(edit(pid, (q) => setVals(q, {[k]: n})));
            }}));
    };
    return [
        h('div', {class: 'title'}, `擺放（改了立刻存檔${sx ? '；scale／x／y 是女版 f' : ''}）`),
        h('table', {class: 'nums'},
            h('tr', null, NUMS.map(([k]) => h('th', null, sx && SEX_NUMS.includes(k) ? `${k}（f）` : k))),
            h('tr', null, NUMS.map(([k, ph]) => cell(k, ph)))),
        sx && h('div', {class: 'sexnote dim'}, has ? 'scale／x／y 是 f（女版專用）' : '沒有 f，顯示的是共用值；改了就建立 f',
            has && h('button', {class: 'delsex', onclick: () => act(edit(pid, (q) => {delete q.f;}))}, '刪除女版')),
    ];
}

// 女（右欄切到女）的 scale/x/y 寫 f（第一次從基準複製），其他寫基準；undefined＝刪 key
function setVals(q, vals)
{
    for (const [k, n] of Object.entries(vals))
    {
        const inF = S.sex === 'f' && SEX_NUMS.includes(k);
        if (inF && !isObj(q.f)) q.f = Object.fromEntries(SEX_NUMS.map(s => [s, q[s]]).filter(([, v]) => v !== undefined));
        const t = inF ? q.f : q;
        if (n === undefined) delete t[k];
        else t[k] = n;
    }
}

// body 的支點（neck／wristF／wristB {x, y, a}）：女改 f 裡的；還沒有就從目前值（女＝套過 f）起建，帶上角度
// vals 的值 undefined＝清空：清 x 或 y＝刪掉整個支點（回到基準／0），清 a 只刪 a（同試穿）
function setPivot(q, k, vals)
{
    const female = S.sex === 'f', cur = pivotOf(female ? equipFor(q, 'f') : q, k);
    const t = female ? (isObj(q.f) ? q.f : (q.f = {})) : q;
    const o = {...(isObj(t[k]) ? t[k] : {x: cur.x, y: cur.y, ...(cur.a ? {a: cur.a} : {})}), ...vals};
    if (!o.a) delete o.a;
    if (o.x === undefined || o.y === undefined) delete t[k];
    else t[k] = o;
    if (female && !Object.keys(q.f).length) delete q.f;
}

// 右欄合成上拖這個條目（身體另外可以拖三個支點十字）：拖的時候只改記憶體跟重畫，放開才寫檔（一筆 undo）
function dragEdit(pid)
{
    let last = null;
    const apply = (q, {vals, k}) => (k ? setPivot(q, k, vals) : setVals(q, vals));
    return {
        k: S.parts[pid].kind,
        pivots: S.parts[pid].kind === 'body',
        set: (vals, k) => {
            last = {vals: {...(last && last.k === k ? last.vals : {}), ...vals}, k};
            apply(S.parts[pid], {vals, k});
        },
        done: () => {const v = last; last = null; if (v) act(edit(pid, (q) => apply(q, v)));},
    };
}

// 身體的支點表：同試穿的支點表（x／y 只填一個補上另一個目前值，清空 x 或 y＝刪掉支點）
function pivotTable(pid)
{
    const p = S.parts[pid], female = S.sex === 'f', t = female ? p.f ?? {} : p;
    const cur = (k) => pivotOf(female ? equipFor(p, 'f') : p, k);
    const cell = (k, c) => h('td', null, h('input', {type: 'number', step: ST.step(c) ?? 'any', class: 'num',
        value: t[k]?.[c] ?? '', placeholder: String(cur(k)[c]), dataset: {k: `part.json|${pid}|${female ? 'f.' : ''}${k}.${c}`},
        onchange: (e) => {
            const n = parseNum(e.target.value);
            if (typeof n === 'string') {status(`${k}.${c} 要是數字`); return render();}
            act(edit(pid, (q) => setPivot(q, k, {[c]: n})));
        }}));
    return [
        h('div', {class: 'title'}, `支點（${female ? '女版 f；' : ''}右欄十字可拖、白點轉 a；掛在上面的部位、裝備數字相對支點）`),
        h('table', {class: 'nums pivots'},
            h('tr', null, ['支點', '', 'x', 'y', 'a'].map(t => h('th', null, t))),
            PIVOTS.map(k => h('tr', null, h('td', {class: 'k', style: `color:${PIVOT_COLOR[k]}`}, PIVOT_NAMES[k]), h('td', null, k),
                ['x', 'y', 'a'].map(c => cell(k, c))))),
    ];
}

// ---------- 擺放：立刻寫檔＋undo ----------
// 從磁碟讀最新的再改（別的分頁剛存的不會被蓋掉），記一筆 undo；動作排隊，連打不會互蓋
let queue = Promise.resolve();
const enqueue = (fn) => (queue = queue.then(fn));

function edit(pid, fn)
{
    return enqueue(async () => {
        const parts = await PT.readParts(S.assets.json);
        if (!parts[pid]) {status(`part.json 已經沒有 ${pid}`); return reload();}
        const before = structuredClone(parts[pid]);
        fn(parts[pid]);
        if (str(before) === str(parts[pid])) return render();
        S.hist.length = S.hi;
        S.hist.push({pid, before, after: structuredClone(parts[pid])});
        S.hi = S.hist.length;
        await save(parts, pid, `${pid} 已存檔`);
    });
}

function putBack(e, v, msg)
{
    return enqueue(async () => {
        const parts = await PT.readParts(S.assets.json);
        if (!parts[e.pid]) {status(`part.json 已經沒有 ${e.pid}`); return reload();}
        parts[e.pid] = structuredClone(v);
        await save(parts, e.pid, `${msg} ${e.pid}`);
    });
}
function undo()
{
    if (S.hi <= 0) return Promise.resolve();
    const e = S.hist[--S.hi];
    return putBack(e, e.before, '已復原');
}
function redo()
{
    if (S.hi >= S.hist.length) return Promise.resolve();
    const e = S.hist[S.hi++];
    return putBack(e, e.after, '已重做');
}

function renderDetail()
{
    const pid = S.sel, p = S.parts[pid];
    const users = usersOf(pid), bad = problems(pid), doll = users.find(rid => isDoll(S.roles[rid]));
    $('view').replaceChildren(h('div', {class: 'detail'},
        h('div', {class: 'head'}, h('span', {class: 'bigid'}, pid), h('span', {class: 'dim'}, `${KIND_NAMES[p.kind] ?? ''} ${p.kind ?? ''}`),
            h('span', {class: 'grow'}),
            h('span', {class: 'acts'},
                h('button', {disabled: !doll, title: doll ? `到試穿分頁選 ${doll}、游標放在這個部位的數字` : '沒有紙娃娃型角色（有 head 或 handF／handB）在用，試穿挑不到',
                    onclick: () => SH.gotoTab('fit', [doll, p.kind])}, '↗ 到試穿調'),
                h('button', {onclick: () => act(renamePart(pid))}, '改名…'),
                h('button', {onclick: () => act(changeKind(pid))}, '改 kind…'),
                h('button', {onclick: () => act(changeSprite(pid))}, '換圖…'),
                h('button', {onclick: () => act(askEntry(pid))}, '複製…'),
                h('button', {onclick: () => act(deletePart(pid))}, '刪除…'))),
        bad.length > 0 && h('ul', {class: 'warns'}, bad.map(w => h('li', null, w))),
        h('div', {class: 'title'}, '原圖'),
        IC.iconEl(p.sprite, 160),
        numTable(pid),
        p.kind === 'body' && pivotTable(pid),
        h('div', {class: 'title'}, '其他欄位（唯讀）'),
        h('table', null, fieldRows(p)),
        h('div', {class: 'title'}, `使用者（${users.length}）`),
        users.length ? h('ul', {class: 'users'}, users.map(rid => h('li', null, rid, ' ', h('span', {class: 'dim'}, S.roles[rid].lab ?? ''),
                h('a', {class: 'go', title: '到角色分頁', onclick: () => SH.gotoTab('role', [rid])}, ' ↗'))))
            : h('div', {class: 'dim'}, '（沒有角色在用；路人隨機長相做好之後也可能是素材，不一定要刪）')));
    const sexBtn = (sx, name) => h('button', {class: S.sex === sx ? 'on' : '', dataset: {sex: sx}, onclick: () => setSex(sx)}, name);
    $('right').replaceChildren(
        h('div', {class: 'cap'}, `套在 ${DOLL[S.sex]}`, S.sex === 'f' && (p.f ? '，用女版 f' : '（沒有 f，用基準數字）')),
        previewEl(dollOf(pid, S.sex), {}, S.parts, {edit: dragEdit(pid)}),
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
    const focus = document.activeElement?.dataset?.k;
    draw();
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length;
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

function draw()
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
    for (const e of S.hist) if (e.pid === from) e.pid = to;
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
    // 刪掉的條目沒辦法 undo 回去：拿掉它的紀錄，hi 扣掉前面被拿掉的
    S.hi -= S.hist.slice(0, S.hi).filter(e => e.pid === pid).length;
    S.hist = S.hist.filter(e => e.pid !== pid);
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
$('btnUndo').onclick = () => act(undo());
$('btnRedo').onclick = () => act(redo());
// 文字欄（搜尋、對話框）留給瀏覽器自己的復原
addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.matches?.('input:not([type=number]), textarea')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) {e.preventDefault(); act(undo());}
    else if (k === 'y' || (k === 'z' && e.shiftKey)) {e.preventDefault(); act(redo());}
});
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
window.__pt = {S, setTab, setRoot, reload, render, problems, isBad, isUnused, renamePart, deletePart, changeKind, changeSprite, askEntry, edit, undo, redo, idle: () => queue, IC};
