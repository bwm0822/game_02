// 能力＋能力樹：左欄樹清單、中間樹畫布（照遊戲 uiability.js 的畫法）、右欄技能表單
// 同時編 ability.json（技能＋前置 refs）、ab_tree.json（{樹:[{id,x,y}]}）、local.json（樹名 <樹>.lab）：undo 一起記，存檔各自比對外部修改、三方合併
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import '../common/combo.js';
import {$, h, ul, ask, status} from '../common/dom.js';
import {str, setAt, replaceRaw, merge3} from '../common/obj.js';
import {fieldInput, createForm} from '../common/form.js';
import {renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import * as SC from './schema.js';

const FILES = ['ability.json', 'ab_tree.json', 'local.json'];
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
    anims: [],
};
const F = createForm({S, render});

const abs = () => S.doc['ability.json'].data;
const trees = () => S.doc['ab_tree.json'].data;
const locals = () => S.doc['local.json'].data;
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
    for (const [k, v] of Object.entries(ab)) if (SC.FIELDS[k] && k !== 'icon') checkVal(SC.FIELDS[k], v, k, out);
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
            return h('div', {class: 'item' + (t === S.tree ? ' sel' : ''), dataset: {tree: t}, onclick: () => selectTree(t)},
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
        h('div', {class: 'tree', style: `width:${w * CELL + 2 * M}px;height:${hh * CELL + 2 * M}px;--cell:${CELL}px;--m:${M}px`},
            svg,
            nodes.map(n => {
                const ab = abs()[n.id], p = center(n), bad = !ab || validate(n.id).length;
                return h('div', {class: 'node' + (n.id === S.sel ? ' sel' : '') + (bad ? ' bad' : ''), dataset: {id: n.id},
                    title: [n.id, ...(ab ? validate(n.id) : ['不在 ability.json'])].join('\n'),
                    style: `left:${p.x - CELL / 2}px;top:${p.y - CELL / 2}px`, onclick: () => ab && select(n.id), onpointerdown: e => nodeDown(e, n)},
                    IC.iconEl(ab?.icon, 40),
                    h('div', {class: 'nlab'}, ab?.lab ?? n.id),
                    ab && h('div', {class: 'handle', title: '拉到另一個技能＝設成它的前置', onpointerdown: e => linkDown(e, n), onclick: e => e.stopPropagation()}));
            })));
}

// ---------- 表單 ----------
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
            dirtyAb(id) && h('span', {class: 'dirty'}, '●')),
        warns.length && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
        h('div', {class: 'fields'},
            shown.map(k => [
                h('span', {class: 'k' + (ab[k] === undefined ? ' unset' : ''), title: k}, SC.FIELDS[k].label),
                fieldInput(SC.FIELDS[k], ab[k], v => set(id, [k], v), k),
            ]),
            h('span', {class: 'k' + (ab.refs ? '' : ' unset'), title: 'refs（在樹上拉線）'}, '前置'),
            h('span', {class: 'refs'}, Array.isArray(ab.refs) && ab.refs.length ? ab.refs.join('、') : h('span', {class: 'dim'}, '—')),
            rest.length && [h('span', {class: 'k unset'}, '加欄位'),
                h('select', {onchange: e => {(S.extra[id] ??= new Set()).add(e.target.value); render();}},
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
    renderDatalists({
        tag: [...SC.FIELDS.tag.suggest, ...vals('tag')],
        reqClass: [...SC.FIELDS.reqClass.suggest, ...vals('reqClass')],
        anim: [...S.anims, ...vals('anim')],
    });
    renderList();
    renderTree();
    renderForm();
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1;
    $('btnSave').disabled = $('btnReload').disabled = !S.assets;
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

addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // 先失焦讓正在打的欄位觸發 change 套用
    if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
    if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if ((k === 'delete' || k === 'backspace') && S.link) {e.preventDefault(); removeRef(S.link.child, S.link.ref);}
    if (k === 'escape' && S.link) {S.link = null; render();}
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});

(async () => {
    S.anims = await fetch('/assets/json/anim.json').then(r => r.json()).then(Object.keys).catch(() => []);
    render();
    IC.ready.then(render);
    SH.onSaved(onSaved);
    SH.onProject(dir => setAssets(dir).catch(e => status(e.message)));
})();

// 給無頭測試用
window.__ab = {S, setAssets, reload, save, commit, set, undo, redo, select, selectTree, moveNode, addRef, removeRef, validate, validateTree, validateAll, render, IC, CELL, M};
