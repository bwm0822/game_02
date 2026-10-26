import {$, h, ask, status} from '../common/dom.js';
import {createDoc} from '../common/doc.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import {flattenStory, mergeDialog} from '../../src/data/storydata.js';
import {extract, analyze, verify, SHARED, META, DEFAULT_META} from '../../src/data/langdata.js';

// public/assets/lang/<lang>.json：{_meta, _shared:{原文:{t,r}}, <情境>:{原文:{t,r}}}，只存有譯文的列，格式見 src/data/langdata.js
const SOURCES = ['local', 'item', 'role', 'ability', 'dialog', 'story'];
const ALL = '', ORPHAN = '@orphan';
const LANG_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;
const NOT_LANG = ['zh-TW', 'qps'];
const PREF = 'tools.lang.lang';
const DOMAIN = {ui: '介面', item: '道具', role: '角色', ability: '能力', dlg: '對話', line: '台詞', story: '任務',
                'story.let': '劇情卡', 'story.thread': '任務日誌', 'story.node': '長對話節點'};
const REVIEW = ['', 'mt', 'ok'];
const TAB_LAB = {local: '文字', item: '道具', role: '角色', ability: '能力', dialog: '對話', story: '任務'};

const opt = {
    file: 'en.json', dir: 'lang', noun: '個情境',
    external: '可能是手動改的，或別的分頁存過。',
    draw, validateAll: () => S.rows.filter(r => r.check === 'error').map(r => `${r.ctx}「${r.src}」：${r.err}`),
    onNew: () => askLang(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if (SOURCES.some(s => file === `${s}.json`)) loadRefs().then(render);},
    encode: (d) => ordered(d),
};
const D = createDoc(opt);
const {S, render, commit} = D;
S.entries = [];
S.rows = [];
S.node = 'ui';
S.filter = '';
S.fold = new Set();     // 展開的樹節點
S.langs = [];
S.roles = {};
S.quiet = null;         // 只改了一列譯文：就地更新那一列，不重建表格（打字中的 textarea 留著）

const rowKey = (ctx, src) => JSON.stringify([ctx, src]);
const langCode = () => opt.file.slice(0, -5);

// key 順序：檔案裡原有的照舊，新加的插在原文順序（ref）裡前一個已存在的 key 後面
function arrange(keys, base, ref)
{
    const has = new Set(keys);
    const out = base.filter(k => has.has(k));
    const pos = new Map(ref.map((k, i) => [k, i]));
    for (const k of keys)
    {
        if (out.includes(k)) continue;
        const i = pos.get(k);
        let at = out.length;
        if (i !== undefined)
        {
            at = 0;
            for (let j = i - 1; j >= 0; j--) {const p = out.indexOf(ref[j]); if (p >= 0) {at = p + 1; break;}}
        }
        out.splice(at, 0, k);
    }
    return out;
}

// 每次 draw 都排好，S.data 跟存檔內容順序一致才不會一直算成未存檔
function ordered(data)
{
    const order = {};
    for (const e of S.entries) (order[e.ctx] ??= []).push(e.src);
    const out = {};
    for (const ctx of arrange(Object.keys(data), Object.keys(S.saved), [META, ...Object.keys(order), SHARED]))
    {
        if (ctx === META) {out[ctx] = data[ctx]; continue;}
        const rows = data[ctx];
        out[ctx] = Object.fromEntries(arrange(Object.keys(rows), Object.keys(S.saved[ctx] ?? {}), order[ctx] ?? []).map(s => [s, rows[s]]));
    }
    return out;
}

// ---------- 編輯 ----------
function setRow(ctx, src, fn)
{
    const rows = S.data[ctx] ??= {};
    const v = fn(rows[src] ? {...rows[src]} : {t: ''});
    if (v?.t) rows[src] = v.r ? {t: v.t, r: v.r} : {t: v.t};
    else delete rows[src];
    if (!Object.keys(rows).length) delete S.data[ctx];
}

function setT(ctx, src, t)
{
    if ((S.data[ctx]?.[src]?.t ?? '') === t) return;
    S.quiet = rowKey(ctx, src);
    commit(() => setRow(ctx, src, v => ({...v, t})));
    S.quiet = null;
}

const cycleR = (ctx, src) => commit(() => setRow(ctx, src, v => ({...v, r: REVIEW[(REVIEW.indexOf(v.r ?? '') + 1) % REVIEW.length]})));

// 建議：同情境 orphan 的舊譯文搬到這列（原文變了，審核標 mt），orphan 刪掉
function adopt(r, o)
{
    commit(() => {
        setRow(r.ctx, r.src, () => ({t: o.t, r: 'mt'}));
        setRow(o.ctx, o.src, () => null);
    });
}

const removeRow = (r) => commit(() => setRow(r.ctx, r.src, () => null));

async function removeOrphans()
{
    const list = S.rows.filter(r => r.check === 'orphan');
    if (!list.length) return;
    if (await ask(`刪除全部 ${list.length} 筆 orphan`, '原文已經不存在的舊譯文都會刪掉（可以 undo）', [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    commit(() => {for (const r of list) setRow(r.ctx, r.src, () => null);});
}

// 升為 shared：這列的譯文搬進 _shared，同原文、譯文一模一樣的其他情境也一起刪掉
async function promote(r)
{
    const same = S.rows.filter(x => x.src === r.src && x.ctx !== SHARED && x.check !== 'orphan' && x.t === r.t);
    const cur = S.data[SHARED]?.[r.src]?.t;
    if (await ask(`升為 shared：「${r.src}」→「${r.t}」`, [
        h('div', null, `${same.length} 個情境的譯文一樣，會一起刪掉、改用 shared：`),
        h('div', {class: 'dim'}, same.map(x => x.ctx).join('、')),
        cur && cur !== r.t && h('div', {class: 'warn'}, `_shared 原本是「${cur}」，會被蓋掉`),
    ], [['ok', '升為 shared'], ['cancel', '取消']]) !== 'ok') return;
    commit(() => {
        setRow(SHARED, r.src, () => ({t: r.t, r: r.r}));
        for (const x of same) setRow(x.ctx, x.src, () => null);
    });
}

function setFont(font)
{
    commit(() => {
        if (font) (S.data[META] ??= {}).font = font;
        else if (S.data[META]) {delete S.data[META].font; if (!Object.keys(S.data[META]).length) delete S.data[META];}
    });
}

// ---------- 語言 ----------
async function langDirOf(dir)
{
    return await FS.tryDir(dir, 'lang') ?? await FS.tryDir(await FS.tryDir(await FS.tryDir(dir, 'public') ?? dir, 'assets'), 'lang');
}

async function listLangs(langDir)
{
    const {files} = await FS.listDir(langDir);
    S.langs = files.map(f => f.name).filter(n => n.endsWith('.json')).map(n => n.slice(0, -5)).filter(c => !NOT_LANG.includes(c));
}

// 殼給專案根目錄，無頭測試直接給 public/assets
async function useProject(dir)
{
    S.root = dir;
    const langDir = await langDirOf(dir);
    if (!langDir) throw new Error(`「${dir.name}」裡沒有 public/assets/lang/`);
    S.langDir = langDir;
    await listLangs(langDir);
    let pref = null;
    try {pref = localStorage.getItem(PREF);} catch {}
    const code = S.langs.includes(pref) ? pref : S.langs[0];
    if (!code) {status('還沒有任何翻譯檔，按「＋ 語言」新增'); return render();}
    opt.file = `${code}.json`;
    await D.setAssets(dir);
}

async function switchLang(code)
{
    if (`${code}.json` === opt.file) return;
    if (D.isDirty() && await ask('切換語言', `${langCode()} 還沒存檔的修改會不見`, [['ok', '切換'], ['cancel', '取消']]) !== 'ok') return render();
    opt.file = `${code}.json`;
    try {localStorage.setItem(PREF, code);} catch {}
    if (S.assets) await D.reload();
    else await D.setAssets(S.root);
}

async function askLang()
{
    if (!S.langDir) return status('先在上方選擇專案資料夾');
    const code = h('input', {size: 12, placeholder: 'ja、zh-CN…'});
    const p = ask('新增語言', [h('div', null, 'BCP 47 語系代碼：'), code,
        h('div', {class: 'hint'}, `會建立 public/assets/lang/<代碼>.json（只有 _meta.font），遊戲的語言選單要另外加`)], [['ok', '建立'], ['cancel', '取消']]);
    code.focus();
    if (await p !== 'ok') return;
    const c = code.value.trim();
    if (!LANG_RE.test(c) || NOT_LANG.includes(c)) return status(`「${c}」不是可用的語系代碼`);
    if (S.langs.includes(c)) return status(`已經有 ${c}`);
    const meta = DEFAULT_META[c] ?? {font: 'Arial, sans-serif'};
    await FS.writeFile(S.langDir, `${c}.json`, new Blob([JSON.stringify({[META]: meta}, null, 2)]));
    await listLangs(S.langDir);
    await switchLang(c);
    status(`已建立 ${c}.json`);
}

// ---------- 原文 ----------
async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}.json`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const [local, item, role, ability, dialog, story] = await Promise.all(SOURCES.map(get));
    S.roles = role;
    S.src = {local, item, role, ability, dialog, story};
    S.entries = extract({local, item, role, ability, dialog: mergeDialog(dialog, role), story: flattenStory(story)});
}

// ↗：情境 → [分頁, path]（各分頁 onGoto 收的格式）；ui.* 沒有編輯器
function sourceOf(r)
{
    const [dom, a, b] = r.ctx.split('.');
    const {dialog, story} = S.src ?? {};
    const lines = Object.entries(story?.lines ?? {});
    if ((dom === 'item' || dom === 'role' || dom === 'ability') && S.src?.[dom]?.[a]) return [dom, [a]];
    if (dom === 'ui' && S.src?.local?.[a]) return ['local', [a]];
    if (dom === 'dlg')
    {
        if (dialog?.[a]?.nodes?.[b]) return ['dialog', [a, 'nodes', b]];
        if (dialog?.[a]?.extend?.[b]) return ['dialog', [a, 'extend', b]];
    }
    if (dom === 'line' && dialog?.[a])
    {
        const i = (dialog[a].lines ?? []).findIndex(l => l.concept === b && l.text === r.src);
        return ['dialog', i < 0 ? [a] : [a, 'lines', i]];
    }
    if (dom === 'story' && a === 'let')
        for (const [l, line] of lines)
        {
            const i = (line.storylets ?? []).findIndex(s => s.id === b);
            if (i >= 0) return ['story', [l, 'storylets', i]];
        }
    if (dom === 'story' && a === 'thread')
        for (const [l, line] of lines) if (line.threads?.[b]) return ['story', [l, 'threads', b]];
    if (dom === 'story' && a === 'node')
        for (const [l, line] of lines)
            for (const [npc, ns] of Object.entries(line.nodes ?? {})) if (ns[b]) return ['story', [l, 'nodes', npc, b]];
    return null;
}

// ---------- 樹 ----------
const parents = (ctx) => {const p = ctx.split('.'); return p.slice(0, -1).map((_, i) => p.slice(0, i + 1).join('.'));};
const nodeOf = (r) => r.check === 'orphan' ? ORPHAN : r.ctx === SHARED ? SHARED : null;
const isTodo = (r) => r.check === 'new' || r.check === 'error';

function inNode(r, node)
{
    if (node === ALL) return true;
    const special = nodeOf(r);
    if (node === ORPHAN || node === SHARED) return special === node;
    return !special && (r.ctx === node || r.ctx.startsWith(node + '.'));
}

function nodeLabel(node)
{
    if (DOMAIN[node]) return DOMAIN[node];
    const [dom, id] = node.split('.');
    if ((dom === 'dlg' || dom === 'line' || dom === 'role') && id) return S.roles[id]?.lab ?? (id === '_common' ? '共用' : '');
    return '';
}

// 選節點時展開它跟上層；之後箭頭照樣可以收合
function selectNode(node)
{
    S.node = node;
    const p = node.split('.');
    if (node !== ALL && node !== SHARED && node !== ORPHAN) p.forEach((_, i) => S.fold.add(p.slice(0, i + 1).join('.')));
    render();
}

function renderTree()
{
    const cnt = new Map(), kids = new Map();
    const bump = (n, r) => {const c = cnt.get(n) ?? {todo: 0, all: 0}; c.all++; if (isTodo(r)) c.todo++; cnt.set(n, c);};
    for (const r of S.rows)
    {
        bump(ALL, r);
        const special = nodeOf(r);
        if (special) {bump(special, r); continue;}
        let up = ALL;
        for (const p of parents(r.ctx))
        {
            if (!kids.has(up)) kids.set(up, []);
            if (!kids.get(up).includes(p)) kids.get(up).push(p);
            bump(p, r);
            up = p;
        }
    }
    const out = [];
    const row = (node, depth, name) => {
        // 「全部」不展開：頂層的領域固定列在它下面
        const c = cnt.get(node) ?? {todo: 0, all: 0}, sub = node === ALL ? [] : kids.get(node) ?? [];
        const open = S.fold.has(node);
        out.push(h('div', {class: 'node' + (S.node === node ? ' sel' : ''), style: `padding-left: ${4 + depth * 14}px`, dataset: {node},
                onclick: () => selectNode(node)},
            h('span', {class: 'arrow', onclick: sub.length ? (e) => {e.stopPropagation(); S.fold.has(node) ? S.fold.delete(node) : S.fold.add(node); render();} : null},
                sub.length ? (open ? '▾' : '▸') : ''),
            h('span', null, name ?? node.split('.').at(-1)),
            h('span', {class: 'lab'}, name ? '' : nodeLabel(node)),
            h('span', {class: 'cnt' + (c.todo ? ' todo' : '')}, c.todo ? `${c.todo}/${c.all}` : `${c.all}`)));
        if (open) for (const k of sub) row(k, depth + 1);
    };
    row(ALL, 0, '全部');
    for (const k of kids.get(ALL) ?? []) row(k, 1, `${k}　${DOMAIN[k] ?? ''}`);
    row(SHARED, 1, '_shared　共用詞');
    row(ORPHAN, 1, 'orphan　孤兒');
    $('list').replaceChildren(...out);
}

// ---------- 表格 ----------
function matchFilter(r)
{
    switch (S.filter)
    {
        case 'todo': return isTodo(r);
        case 'new': case 'error': case 'orphan': return r.check === S.filter;
        case 'mt': case 'ok': return r.t && r.r === S.filter;
    }
    return true;
}

function visibleRows()
{
    const q = S.search.trim().toLowerCase();
    if (q) return S.rows.filter(r => matchFilter(r) && [r.ctx, r.src, r.t].some(s => s.toLowerCase().includes(q)));
    return S.rows.filter(r => inNode(r, S.node) && matchFilter(r));
}

const lines = (s) => s.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil([...l].length / 40)), 0);
const fit = (ta) => {ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px';};

function focusRow(tr, dir)
{
    let n = tr;
    do n = dir > 0 ? n.nextElementSibling : n.previousElementSibling;
    while (n && !n.querySelector('textarea'));
    const ta = n?.querySelector('textarea');
    if (ta) {ta.focus(); ta.select();}
}

function textCell(r)
{
    const ta = h('textarea', {rows: lines(r.t || r.shared || r.src), value: r.t, placeholder: r.shared,
        oninput: () => fit(ta),
        onchange: () => setT(r.ctx, r.src, ta.value),
        onkeydown: (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing)
            {
                e.preventDefault();
                setT(r.ctx, r.src, ta.value);
                focusRow(ta.closest('tr'), e.ctrlKey ? -1 : 1);
            }
            if (e.key === 'Escape') {ta.value = r.t; fit(ta); ta.blur();}
        }});
    return h('td', null, ta);
}

function hintCell(r)
{
    const kids = [];
    if (r.check === 'orphan') kids.push(h('button', {title: '刪掉這筆舊譯文', onclick: () => removeRow(r)}, '刪除'));
    for (const o of r.hints) kids.push(h('a', {class: 'sug', title: `舊原文：${o.src}\n點了搬過來（審核標 mt），orphan 刪掉`, onclick: () => adopt(r, o)}, `舊：${o.t}`));
    if (r.t && r.ctx !== SHARED && S.data[SHARED]?.[r.src]?.t)
        kids.push(h('a', {class: 'sug', title: `_shared：${S.data[SHARED][r.src].t}\n點了刪掉這個情境自己的譯文`, onclick: () => removeRow(r)}, '↺ 回到 shared'));
    return h('td', {class: 'hint'}, kids);
}

// 同情境恰好一筆 new、一筆 orphan：多半是原文改了字
function retyped(r)
{
    if (r.check !== 'new' || r.hints.length !== 1) return false;
    return S.rows.filter(x => x.ctx === r.ctx && x.check === 'new').length === 1;
}

function rowEl(r, base)
{
    const k = rowKey(r.ctx, r.src);
    const dirty = (S.data[r.ctx]?.[r.src]?.t ?? '') !== (S.saved[r.ctx]?.[r.src]?.t ?? '') || (S.data[r.ctx]?.[r.src]?.r ?? '') !== (S.saved[r.ctx]?.[r.src]?.r ?? '');
    const ctx = base && r.ctx.startsWith(base + '.') ? r.ctx.slice(base.length + 1) : r.ctx;
    const go = r.check !== 'orphan' && sourceOf(r);
    const check = r.check === 'error' ? `error：${r.err}` : retyped(r) ? 'new（可能是改字）' : r.check || (r.shared ? 'shared' : '');
    return h('tr', {class: [r.check, dirty && 'dirty'].filter(Boolean).join(' '), dataset: {k},
            oncontextmenu: r.t && r.ctx !== SHARED && r.check !== 'orphan' ? (e) => {e.preventDefault(); promote(r);} : null,
            title: r.t && r.ctx !== SHARED && r.check !== 'orphan' ? '右鍵：升為 shared' : null},
        h('td', {class: 'ctx', title: r.ctx}, ctx, go && h('a', {class: 'go', title: `跳到${TAB_LAB[go[0]]}分頁`, onclick: () => SH.gotoTab(...go)}, ' ↗'),
            r.uses && h('div', {class: 'dim'}, `${r.uses} 個情境`)),
        h('td', {class: 'src'}, r.src),
        textCell(r),
        h('td', null, r.t && h('button', {class: 'rv ' + r.r, title: '審核：空白 → mt（機翻未審）→ ok（已審）', onclick: () => cycleR(r.ctx, r.src)}, r.r || '·')),
        h('td', {class: 'chk'}, check),
        hintCell(r));
}

const COLS = [['情境', '14%'], ['原文', '28%'], ['譯文', '34%'], ['審核', '56px'], ['檢查', '9%'], ['建議', '']];

function renderTable()
{
    const rows = visibleRows();
    const base = S.search.trim() ? '' : S.node.startsWith('@') || S.node === SHARED ? '' : S.node;
    const max = 1000;
    const orphans = S.node === ORPHAN && !S.search.trim() && rows.length > 0;
    $('view').replaceChildren(...[
        orphans && h('div', {class: 'row2'}, h('span', {class: 'dim'}, '原文已經不存在的舊譯文；new 列的「建議」欄可以把同情境的搬過去'),
            h('span', {class: 'grow'}), h('button', {onclick: removeOrphans}, `刪除全部 orphan（${rows.length}）`)),
        rows.length ? h('table', {class: 'tr'},
            h('colgroup', null, COLS.map(([, w]) => h('col', {style: w && `width: ${w}`}))),
            h('thead', null, h('tr', null, COLS.map(([t]) => h('th', null, t)))),
            h('tbody', null, rows.slice(0, max).map(r => rowEl(r, base))))
            : h('div', {class: 'dim'}, S.assets ? '（沒有符合的列）' : '先在上方選擇專案資料夾'),
        rows.length > max && h('div', {class: 'dim'}, `只列前 ${max} 列，共 ${rows.length} 列`)].filter(Boolean));
    for (const ta of $('view').querySelectorAll('textarea')) fit(ta);
}

// 只改了一列：換掉那一列除了譯文格以外的格子
function patchRow(k)
{
    const tr = document.querySelector(`#view tr[data-k="${CSS.escape(k)}"]`);
    const r = S.rows.find(x => rowKey(x.ctx, x.src) === k);
    if (!tr || !r) return false;
    const base = S.search.trim() ? '' : S.node.startsWith('@') || S.node === SHARED ? '' : S.node;
    const fresh = rowEl(r, base), cells = [...fresh.children];
    [...tr.children].forEach((td, i) => {if (i !== 2) td.replaceWith(cells[i]);});
    tr.className = fresh.className;
    return true;
}

function draw()
{
    S.data = ordered(S.data);
    const {rows, stat} = analyze(S.data, S.entries);
    S.rows = rows;
    S.stat = stat;
    $('lang').replaceChildren(...S.langs.map(c => h('option', {value: c, selected: `${c}.json` === opt.file}, c)));
    const font = $('font');
    if (document.activeElement !== font) font.value = S.data[META]?.font ?? '';
    font.disabled = !S.assets;
    renderTree();
    if (!(S.quiet && patchRow(S.quiet))) renderTable();
    if (S.assets && !S.quiet) status(`${langCode()}：${stat.ok} ok / ${stat.new} new / ${stat.orphan} orphan / ${stat.error} error`);
}

// ---------- 給 AI 翻 ----------
// 表格裡看得到的 new／error 列 → 提示詞＋{情境:{原文:""}}；不打 API，複製去貼
function exportText()
{
    const rows = visibleRows().filter(isTodo);
    if (!rows.length) return null;
    const json = {};
    for (const r of rows) (json[r.ctx] ??= {})[r.src] = '';
    const npcs = new Set(rows.map(r => r.ctx.split('.')).filter(([d]) => d === 'dlg' || d === 'line' || d === 'role').map(p => p[1]));
    const name = (id) => {const lab = S.roles[id]?.lab; return lab && (S.data[`role.${id}`]?.[lab]?.t ?? S.data[SHARED]?.[lab]?.t);};
    const glossary = Object.keys(S.roles).filter(id => S.roles[id].lab && name(id))
        .map(id => `- ${S.roles[id].lab}（${id}）→ ${name(id)}${npcs.has(id) && S.roles[id].des ? `：${S.roles[id].des}` : ''}`);
    return [
        `你是遊戲翻譯。把下面 JSON 的原文（繁體中文）翻成 ${langCode()}，填進空字串，維持同樣的 JSON 結構，只回傳 JSON。`,
        '- 遊戲是 2D 奇幻 RPG。外層 key 是情境：ui.* 介面、item.* 道具、role.* 角色、ability.* 技能、dlg.<NPC>.<節點> / line.<NPC>.* 對話、story.* 任務',
        '- {#xxx} 是佔位符、[color=…]…[/color] 之類是 BBCode，原樣保留、不要翻',
        '- 對話裡用 / 分隔的是隨機挑一句的變體，整串一起翻，變體數可以跟原文不同',
        '- 介面文字盡量短；\\n 是換行，保留',
        glossary.length && '角色名（照這個翻，括號是 id）：',
        ...glossary,
        '',
        JSON.stringify(json, null, 2),
    ].filter(l => l !== 0).join('\n');
}

async function copyTodo()
{
    const text = exportText();
    if (!text) return status('表格裡沒有 new／error 的列');
    try {await navigator.clipboard.writeText(text); status(`已複製 ${visibleRows().filter(isTodo).length} 句待翻＋提示詞`);}
    catch (e) {status(`複製失敗：${e.message}`);}
}

// 貼回 {情境:{原文:譯文}}（可以包在 ``` 裡）→ 分類預覽 → 套用（審核標 mt）
function parsePaste(text)
{
    const s = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const json = JSON.parse(s);
    const known = new Set(S.rows.filter(r => r.check !== 'orphan').map(r => rowKey(r.ctx, r.src)));
    const out = {apply: [], same: [], unknown: [], empty: 0};
    for (const [ctx, rows] of Object.entries(json))
    {
        if (!rows || typeof rows !== 'object') continue;
        for (const [src, t] of Object.entries(rows))
        {
            if (typeof t !== 'string' || !t.trim()) {out.empty++; continue;}
            if (!known.has(rowKey(ctx, src))) {out.unknown.push({ctx, src, t}); continue;}
            const cur = S.data[ctx]?.[src]?.t ?? '';
            if (cur === t) {out.same.push({ctx, src, t}); continue;}
            out.apply.push({ctx, src, t, cur, err: verify(src, t)});
        }
    }
    return out;
}

function applyPaste(list)
{
    commit(() => {for (const x of list) setRow(x.ctx, x.src, () => ({t: x.t, r: 'mt'}));});
    status(`已套用 ${list.length} 句（審核標 mt）`);
}

async function pasteDone()
{
    const ta = h('textarea', {class: 'paste', placeholder: '把 AI 回的 JSON 整段貼進來（前後有說明文字或 ``` 也沒關係）'});
    const p = ask('貼上譯文', ta, [['ok', '預覽'], ['cancel', '取消']]);
    ta.focus();
    if (await p !== 'ok' || !ta.value.trim()) return;
    let res;
    try {res = parsePaste(ta.value);} catch (e) {return status(`不是 JSON：${e.message}`);}
    if (!res.apply.length) return status(`沒有要套用的（一樣 ${res.same.length}、對不到 ${res.unknown.length}、空的 ${res.empty}）`);
    const errs = res.apply.filter(x => x.err).length;
    const r = await ask(`套用 ${res.apply.length} 句譯文`, [
        h('div', {class: 'dim'}, `一樣的 ${res.same.length} 句跳過、空的 ${res.empty} 句跳過`),
        errs > 0 && h('div', {class: 'warn'}, `${errs} 句佔位符／BBCode 跟原文不合，還是會套用，在表格裡標 error`),
        res.unknown.length > 0 && h('div', {class: 'warn'}, `對不到原文的 ${res.unknown.length} 句不套用：${res.unknown.slice(0, 5).map(x => `${x.ctx}「${x.src}」`).join('、')}${res.unknown.length > 5 ? '…' : ''}`),
        h('table', {class: 'tr'}, h('tbody', null, res.apply.map(x => h('tr', {class: x.err ? 'error' : ''},
            h('td', {class: 'ctx'}, x.ctx), h('td', {class: 'src'}, x.src),
            h('td', null, x.cur && h('div', {class: 'dim'}, `原本：${x.cur}`), x.t),
            h('td', {class: 'chk'}, x.err))))),
    ], [['ok', '套用'], ['cancel', '取消']]);
    if (r === 'ok') applyPaste(res.apply);
}

// ---------- 事件 ----------
$('btnCopy').onclick = copyTodo;
$('btnPaste').onclick = pasteDone;
$('lang').onchange = (e) => switchLang(e.target.value);
$('font').onchange = (e) => setFont(e.target.value.trim());
$('filter').onchange = (e) => {S.filter = e.target.value; render();};

// 文字分頁的「翻譯 ↗」：path = [情境]，用搜尋列出那個情境的每一句
SH.onGoto(([ctx]) => {
    S.search = $('search').value = ctx;
    S.filter = $('filter').value = '';
    render();
});

(async () => {
    await loadRefs();
    render();
    D.start(useProject);
})();

// 給無頭測試用
window.__lt = {S, D, opt, useProject, switchLang, setT, cycleR, loadRefs, render, exportText, parsePaste, applyPaste};
