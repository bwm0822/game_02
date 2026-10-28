import {$, h, ask, status} from '../common/dom.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import {createFold} from '../common/fold.js';
import {listTextures, scan} from './scan.js';

// 整理 textures/：看哪些圖沒人引用；一般資料夾的「刪除」是搬進 tbd/（保留相對路徑），tbd/ 裡才真的刪
const UNUSED = '#unused', TBD = 'textures/tbd';
const S = {
    root: null, assets: null,
    tex: [],            // listTextures()
    refs: null,         // scan()
    node: UNUSED,
    search: '',
    sel: new Set(),     // path
    cur: null,          // 右欄顯示的 path（最後點的）
    anchor: null,       // Shift 範圍選取的起點
};
const urls = new Map();     // path → object URL
const FOLD = createFold();

const refsOf = (e) => S.refs ? [...S.refs.uses.get(e.key) ?? [], ...S.refs.paths.get(e.path) ?? []] : [];
const isUnused = (e) => !e.tbd && !!S.refs?.scanned && !refsOf(e).length;
const isBad = (e) => e.tbd && refsOf(e).length > 0;
const byPath = (p) => S.tex.find(e => e.path === p);
const selected = () => S.tex.filter(e => S.sel.has(e.path));
const parentOf = (p) => p.slice(0, p.lastIndexOf('/'));
const nameOf = (p) => p.slice(p.lastIndexOf('/') + 1);
const under = (e, dir) => e.path.startsWith(dir + '/');

// ---------- 讀取 ----------
async function setRoot(dir)
{
    S.root = dir;
    S.assets = await FS.tryDir(await FS.tryDir(dir, 'public'), 'assets');
    if (!S.assets) return status(`「${dir.name}」裡沒有 public/assets`);
    await relist();
    await rescan();
}

async function relist()
{
    if (!S.assets) return;
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls.clear();
    S.tex = await listTextures(S.assets);
    for (const p of S.sel) if (!byPath(p)) S.sel.delete(p);
    if (S.cur && !byPath(S.cur)) S.cur = null;
    render();
}

async function rescan()
{
    if (!S.root) return;
    status('掃描中…');
    S.refs = await scan(S.root);
    render();
    const n = S.tex.filter(isUnused).length, bad = S.tex.filter(isBad).length;
    status(S.refs.scanned ? `${S.tex.length} 張、未使用 ${n}` + (bad ? `、tbd 裡還被引用 ${bad}` : '') : '沒有 src/，未使用不準');
}

function imgEl(e, cls)
{
    const img = h('img', {class: cls, alt: e.key});
    const set = (u) => {img.src = u;};
    if (urls.has(e.path)) set(urls.get(e.path));
    else FS.resolveFile(S.assets, e.path).then(async ({file}) => {
        if (!urls.has(e.path)) urls.set(e.path, URL.createObjectURL(await file.getFile()));
        set(urls.get(e.path));
    }).catch(() => {});
    return img;
}

// ---------- 左欄：未使用＋資料夾樹（tbd 排最後） ----------
function dirs()
{
    const all = new Set();
    for (const e of S.tex) for (let d = e.dir; d !== 'textures'; d = parentOf(d)) all.add(d);
    const tbd = (d) => d === TBD || d.startsWith(TBD + '/');
    return [...all].sort((a, b) => tbd(a) - tbd(b) || a.localeCompare(b));
}

function renderList()
{
    const all = dirs(), parents = all.filter(d => all.some(x => x.startsWith(d + '/')));
    const hidden = (d) => {for (let p = parentOf(d); p !== 'textures'; p = parentOf(p)) if (FOLD.folded(p)) return true; return false;};
    const arrow = (d) => parents.includes(d)
        ? h('span', {class: 'arrow', title: '點一下摺疊，Alt＋點全部', onclick: (e) => {e.stopPropagation(); FOLD.toggle(d, e.altKey ? parents : null); renderList();}},
            FOLD.folded(d) ? '▸' : '▾')
        : h('span', {class: 'arrow'});
    const node = (id, name, n, {depth = 0, cls = '', bad = 0, pre = null} = {}) => h('div', {class: `node ${cls}` + (S.node === id ? ' sel' : ''), dataset: {node: id},
            style: `padding-left: ${6 + depth * 14}px`, onclick: () => {S.node = id; S.search = $('search').value = ''; render();}},
        pre, h('span', null, name), bad > 0 && h('span', {class: 'cnt bad', title: 'tbd 裡還被引用的'}, `⚠ ${bad}`), h('span', {class: 'cnt'}, n));
    $('list').replaceChildren(
        node(UNUSED, '未使用', S.refs ? S.tex.filter(isUnused).length : '…'),
        ...all.map((d, i) => {
            if (hidden(d)) return null;
            const files = S.tex.filter(e => under(e, d));
            return node(d, nameOf(d), files.length, {depth: d.split('/').length - 2, cls: i === 0 || d === TBD ? 'gap' : '', bad: files.filter(isBad).length, pre: arrow(d)});
        }).filter(Boolean));
}

// ---------- 中間：縮圖 ----------
function visible()
{
    const q = S.search.trim().toLowerCase();
    if (q) return S.tex.filter(e => e.key.toLowerCase().includes(q));
    if (S.node === UNUSED) return S.tex.filter(isUnused);
    return S.tex.filter(e => under(e, S.node));
}

function click(ev, p)
{
    const list = visible().map(e => e.path);
    if (ev.shiftKey && S.anchor && list.includes(S.anchor))
    {
        const [a, b] = [list.indexOf(S.anchor), list.indexOf(p)].sort((x, y) => x - y);
        if (!ev.ctrlKey) S.sel.clear();
        for (const x of list.slice(a, b + 1)) S.sel.add(x);
    }
    else
    {
        if (ev.ctrlKey) S.sel.has(p) ? S.sel.delete(p) : S.sel.add(p);
        else S.sel = new Set([p]);
        S.anchor = p;
    }
    S.cur = p;
    render();
}

function renderView()
{
    const list = visible();
    $('view').replaceChildren(...(list.length ? list.map(e => h('div', {
            class: ['cell', S.sel.has(e.path) && 'sel', isUnused(e) && 'unused', isBad(e) && 'bad'].filter(Boolean).join(' '),
            dataset: {path: e.path}, title: e.path, onclick: (ev) => click(ev, e.path)},
        imgEl(e), h('div', {class: 'k'}, e.key, e.metas.length > 0 && ' ▦')))
        : [h('div', {class: 'dim'}, S.assets ? '（沒有符合的）' : '先在上方選擇專案資料夾')]));
}

// ---------- 右欄 ----------
const sheetCount = (img, g) => {
    const m = g.margin ?? 0, sp = g.spacing ?? 0, fh = g.h ?? g.w;
    return Math.floor((img.naturalWidth - m + sp) / (g.w + sp)) * Math.floor((img.naturalHeight - m + sp) / (fh + sp));
};

function renderDetail()
{
    const e = S.cur && byPath(S.cur);
    if (!e) return $('detail').replaceChildren(h('div', {class: 'dim'}, S.sel.size ? `選了 ${S.sel.size} 張` : '點一張圖看誰在用它（Ctrl／Shift 多選）'));
    const refs = refsOf(e), info = h('div', {class: 'dim'});
    const big = imgEl(e, 'big');
    big.onload = async () => {
        const txt = [`${big.naturalWidth}×${big.naturalHeight}`];
        for (const m of e.metas)
        {
            const j = await FS.resolveFile(S.assets, `${e.dir}/${m}`).then(({file}) => file.getFile()).then(f => f.text()).then(JSON.parse).catch(() => null);
            if (m.endsWith('_sheet.json') && j?.w) txt.push(`sheet ${j.w}×${j.h ?? j.w}，${sheetCount(big, j)} 格`);
            if (m.endsWith('_atlas.json') && j?.frames) txt.push(`atlas ${Object.keys(j.frames).length} 個 frame`);
        }
        info.textContent = txt.join('　');
    };
    const LIMIT = 100;
    $('detail').replaceChildren(
        big,
        h('div', {class: 'path'}, e.path),
        e.metas.length > 0 && h('div', {class: 'dim'}, `＋ ${e.metas.join('、')}`),
        info,
        S.sel.size > 1 && h('div', {class: 'dim'}, `（共選了 ${S.sel.size} 張）`),
        h('div', {class: 'title'}, `引用（${S.refs ? refs.length : '…'}）`),
        isBad(e) && h('div', {class: 'bad'}, '在 tbd/ 裡還被引用：遊戲載不到這張圖，是搬錯了還是要把引用拿掉？'),
        S.refs && !refs.length && h('div', {class: 'dim'}, '（沒找到；用字串組出來的 key 掃不到，刪之前自己再確認）'),
        refs.length > 0 && h('ul', {class: 'refs'}, refs.slice(0, LIMIT).map(r => h('li', null, r.text,
            r.go && h('a', {class: 'go', title: '跳過去', onclick: () => SH.gotoTab(...r.go)}, ' ↗')))),
        refs.length > LIMIT && h('div', {class: 'dim'}, `…還有 ${refs.length - LIMIT} 處`));
}

function renderButtons()
{
    const sel = selected(), out = sel.filter(e => !e.tbd), inTbd = sel.filter(e => e.tbd);
    const set = (id, n, txt) => {$(id).disabled = !n; $(id).textContent = n ? `${txt}（${n}）` : txt;};
    set('btnTbd', out.length, '搬到 tbd');
    set('btnBack', inTbd.length, '搬回原位');
    set('btnDel', inTbd.length, '刪除');
}

function render()
{
    renderList();
    renderView();
    renderDetail();
    renderButtons();
}

// ---------- 搬移／刪除（檔案操作，不進 undo） ----------
async function mkdirs(path)
{
    let d = S.assets;
    for (const seg of path.split('/')) d = await d.getDirectoryHandle(seg, {create: true});
    return d;
}

// 從 dir 往上刪空資料夾，刪到 stop 為止（不含 stop）
async function pruneEmpty(dir, stop)
{
    for (let d = dir; d !== stop && d.startsWith(stop + '/'); d = parentOf(d))
    {
        const dh = await FS.resolveDir(S.assets, d).catch(() => null);
        if (!dh) continue;
        const {dirs, files} = await FS.listDir(dh);
        if (dirs.length || files.length) return;
        await (await FS.resolveDir(S.assets, parentOf(d))).removeEntry(nameOf(d));
    }
}

const filesOf = (e) => [nameOf(e.path), ...e.metas];
// textures/a/b ↔ textures/tbd/a/b
const join = (a, b) => b ? `${a}/${b}` : a;
const tbdDir = (e) => join(TBD, e.dir.slice('textures/'.length));
const backDir = (e) => join('textures', e.dir.slice(TBD.length + 1));

async function move(e, toDir)
{
    const to = await mkdirs(toDir);
    for (const n of filesOf(e)) if (await FS.tryFile(to, n)) throw new Error(`${toDir}/${n} 已經存在`);
    const from = await FS.resolveDir(S.assets, e.dir);
    for (const n of filesOf(e)) await FS.moveFile(from, n, to);
}

function refsBody(list)
{
    const used = list.filter(e => refsOf(e).length);
    return used.length ? [h('div', {class: 'warn'}, `這 ${used.length} 張還被引用（不會跟著改）：`),
        ...used.slice(0, 20).map(e => {
            const r = refsOf(e);
            return h('div', null, h('b', null, e.key), h('ul', null, r.slice(0, 5).map(x => h('li', null, x.text)), r.length > 5 && h('li', {class: 'dim'}, `…還有 ${r.length - 5} 處`)));
        }),
        used.length > 20 && h('div', {class: 'dim'}, `…還有 ${used.length - 20} 張`)] : [];
}

async function run(list, fn, verb)
{
    const errs = [];
    let n = 0;
    for (const e of list)
    {
        try {await fn(e); n++;}
        catch (err) {errs.push(`${e.key}：${err.message}`);}
    }
    await relist();
    status(`${verb} ${n} 張` + (errs.length ? `；失敗 ${errs.length}：${errs.join('；')}` : ''));
    return {n, errs};
}

async function toTbd(list = selected().filter(e => !e.tbd))
{
    if (!list.length) return;
    const body = refsBody(list);
    if (body.length && await ask(`搬 ${list.length} 張到 tbd/`, body, [['ok', '還是要搬'], ['cancel', '取消']]) !== 'ok') return;
    return run(list, (e) => move(e, tbdDir(e)), '搬到 tbd/');
}

async function back(list = selected().filter(e => e.tbd))
{
    if (!list.length) return;
    return run(list, async (e) => {
        const other = S.tex.find(x => !x.tbd && x.key === e.key);
        if (other) throw new Error(`撞名 ${other.path}`);
        await move(e, backDir(e));
        await pruneEmpty(e.dir, TBD);
    }, '搬回原位');
}

async function remove(list = selected().filter(e => e.tbd))
{
    if (!list.length) return;
    const r = await ask(`刪除 ${list.length} 張`, [
        h('div', {class: 'warn'}, '直接從硬碟刪掉，沒有資源回收筒、不能 undo（只能靠 git 救回）'),
        h('ul', null, list.slice(0, 20).map(e => h('li', null, [e.path, ...e.metas].join('、'))), list.length > 20 && h('li', {class: 'dim'}, `…還有 ${list.length - 20} 張`)),
        ...refsBody(list),
    ], [['ok', '刪除'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    return run(list, async (e) => {
        const dir = await FS.resolveDir(S.assets, e.dir);
        for (const n of filesOf(e)) await dir.removeEntry(n);
        await pruneEmpty(e.dir, TBD);
    }, '刪除');
}

// ---------- 接線 ----------
$('btnScan').onclick = rescan;
$('btnTbd').onclick = () => toTbd();
$('btnBack').onclick = () => back();
$('btnDel').onclick = () => remove();
$('search').oninput = (e) => {S.search = e.target.value; render();};
SH.onSaved((file) => {
    if (file === 'textures.json') relist();
    else if (file.endsWith('.json')) rescan();
});
SH.onProject((dir) => setRoot(dir).catch(e => status(e.message)));
render();

// 給無頭測試用
window.__tx = {S, setRoot, relist, rescan, render, click, refsOf, isUnused, isBad, toTbd, back, remove};
