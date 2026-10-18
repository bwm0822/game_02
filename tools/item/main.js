import * as FS from '../common/fs.js';
import * as SC from './schema.js';
import * as IC from './icons.js';
import * as JE from './jsonedit.js';

const $ = (id) => document.getElementById(id);
const DIRS = FS.dirStore('item');

const S = {
    assets: null,           // {dir: public/assets, json: public/assets/json}
    pending: null,          // 還沒授權的 handle
    items: {},
    saved: {},              // 上次讀檔／存檔的內容，判斷哪些道具改過
    diskText: null,         // 上次讀檔／存檔時硬碟上的原文，存檔前比對有沒有被別人改過
    sel: null,
    view: 'form',
    tab: 0,
    sort: null,             // {col, dir}
    search: '',
    extra: {},              // id → Set：使用者用「加欄位」叫出來、還沒填值的欄位
    // 只留目前這個道具的（換道具就清）：JSON 框有錯沒套用的原文（data-k → {text, msg}）、手動開關過的框（key → bool）
    drafts: {}, open: {}, formOf: null,
    hist: [], hi: -1,
    fx: [],
};

// ---------- 小工具 ----------
function h(tag, props, ...kids)
{
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props ?? {}))
    {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') || k === 'value' || k === 'checked') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    // 0 也跳過：讓 `list.length && …` 可以直接當子節點
    el.append(...kids.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false && c !== 0));
    return el;
}

const str = (v) => JSON.stringify(v);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function getAt(obj, path)
{
    return path.reduce((o, k) => o?.[k], obj);
}

// value 是 undefined 就刪 key，刪完往上把變空的物件也刪掉（陣列裡的元素不刪）
function setAt(obj, path, value)
{
    const chain = [obj];
    for (const k of path.slice(0, -1))
    {
        const cur = chain.at(-1);
        if (value === undefined && cur[k] === undefined) return;
        if (cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = {};
        chain.push(cur[k]);
    }
    const last = path.at(-1);
    if (value !== undefined) {chain.at(-1)[last] = value; return;}
    delete chain.at(-1)[last];
    for (let i = chain.length - 1; i > 0; i--)
    {
        const o = chain[i];
        if (!isObj(o) || Object.keys(o).length || Array.isArray(chain[i - 1])) break;
        delete chain[i - 1][path[i - 1]];
    }
}

// 換掉物件裡「不認識」的那些 key，認識的照原位置保留
function replaceRaw(obj, isKnown, raw)
{
    const out = {};
    for (const k of Object.keys(obj))
    {
        if (isKnown(k)) out[k] = obj[k];
        else if (k in raw) out[k] = raw[k];
    }
    for (const k of Object.keys(raw)) if (!(k in out)) out[k] = raw[k];
    for (const k of Object.keys(obj)) delete obj[k];
    Object.assign(obj, out);
}

function parseNum(s)
{
    s = s.trim();
    if (s === '') return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
}

const status = (msg) => {$('status').textContent = msg;};

// ---------- 對話框 ----------
// buttons: [[value, 文字], ...]；Esc 關掉回傳 ''
function ask(title, body, buttons)
{
    const dlg = $('dlgAsk');
    dlg.querySelector('.title').textContent = title;
    dlg.querySelector('.body').replaceChildren(...[body].flat().filter(Boolean));
    dlg.querySelector('.buttons').replaceChildren(...buttons.map(([v, t]) => h('button', {value: v}, t)));
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue), {once: true}));
}

const ul = (rows) => h('ul', null, rows.map(r => h('li', null, r)));

// ---------- 歷史 ----------
function commit(fn)
{
    const before = S.sel, prev = str(S.items);
    fn();
    const now = str(S.items);
    if (now !== prev)
    {
        S.hist.length = S.hi + 1;
        S.hist.push({items: now, before, after: S.sel});
        if (S.hist.length > 300) S.hist.shift();
        S.hi = S.hist.length - 1;
    }
    render();
}

function undo()
{
    if (S.hi <= 0) return;
    S.sel = S.hist[S.hi].before;
    S.items = JSON.parse(S.hist[--S.hi].items);
    render();
}

function redo()
{
    if (S.hi >= S.hist.length - 1) return;
    const e = S.hist[++S.hi];
    S.items = JSON.parse(e.items);
    S.sel = e.after;
    render();
}

const set = (id, path, value) => commit(() => setAt(S.items[id], path, value));

// ---------- 讀寫 ----------
async function setAssets(h)
{
    const json = await FS.tryDir(h, 'json');
    if (!json || !await FS.tryFile(json, 'item.json')) throw new Error(`「${h.name}」裡沒有 json/item.json，要選遊戲的 public/assets`);
    S.assets = {dir: h, json};
    S.pending = null;
    $('btnReauth').hidden = true;
    $('assetsName').textContent = h.name;
    $('assetsName').classList.remove('dim');
    await reload();
}

async function reload()
{
    const text = await FS.readText(S.assets.json, 'item.json');
    S.diskText = text;
    S.saved = JSON.parse(text);
    S.items = JSON.parse(text);
    S.extra = {};
    S.drafts = {};
    S.hist =[{items: str(S.items), before: S.sel, after: S.sel}];
    S.hi = 0;
    if (!S.items[S.sel]) S.sel = Object.keys(S.items)[0] ?? null;
    status(`讀入 ${Object.keys(S.items).length} 個道具`);
    render();
}

const isDirty = () => str(S.items) !== str(S.saved);
const itemDirty = (id) => str(S.items[id]) !== str(S.saved[id]);

// 道具層級的三方合併：只有一邊改的取那一邊，兩邊都改的以我的為準
function merge3(base, mine, theirs)
{
    const out = {}, external = [], conflict = [];
    for (const id of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base)]))
    {
        const b = str(base[id]), m = str(mine[id]), t = str(theirs[id]);
        let v = mine[id];
        if (m === b) {v = theirs[id]; if (t !== b) external.push(id);}
        else if (t !== b && t !== m) conflict.push(id);
        if (v !== undefined) out[id] = v;
    }
    return {items: out, external, conflict};
}

async function save()
{
    if (!S.assets) return status('先選擇遊戲資料夾');
    const disk = await FS.readText(S.assets.json, 'item.json');
    if (disk !== S.diskText)
    {
        const m = merge3(JSON.parse(S.diskText), S.items, JSON.parse(disk));
        const r = await ask('item.json 在讀進來之後被改過了', [
            h('div', null, '可能是紙娃娃「存到 item.json」或手動改的。'),
            m.external.length && h('div', null, `外部改了：${m.external.join('、')}`),
            m.conflict.length && h('div', {class: 'warn'}, `兩邊都改了（合併時以這裡的為準）：${m.conflict.join('、')}`),
        ], [['merge', '合併後存檔'], ['overwrite', '直接覆蓋'], ['cancel', '取消']]);
        if (r !== 'merge' && r !== 'overwrite') return status('取消存檔');
        if (r === 'merge') commit(() => {S.items = m.items;});
    }
    const warns = [...Object.entries(S.drafts).map(([k, d]) => `${S.sel}：JSON 有錯還沒套用（${k}）${d.msg}`), ...validateAll()];
    if (warns.length)
    {
        const r = await ask(`有 ${warns.length} 個問題`, ul(warns), [['save', '仍然存檔'], ['cancel', '取消']]);
        if (r !== 'save') return status('取消存檔');
    }
    const text = JSON.stringify(S.items, null, 2);
    await FS.writeFile(S.assets.json, 'item.json', new Blob([text]));
    S.diskText = text;
    S.saved = JSON.parse(text);
    status(`已存檔 ${new Date().toLocaleTimeString()}`);
    render();
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
    else if (def.type === 'sprite') {const e = IC.check(v); if (e) out.push(`${where}：${e}`);}
    else if (def.type === 'itemref' && !S.items[v]) out.push(`${where} 指到不存在的道具：${v}`);
    else if (def.type === 'map' && isObj(v))
    {
        for (const [k, n] of Object.entries(v))
        {
            if (!S.items[k]) out.push(`${where} 指到不存在的道具：${k}`);
            if (!Number.isInteger(n)) out.push(`${where}.${k} 數量應該是整數：${str(n)}`);
        }
    }
}

function validate(id)
{
    const it = S.items[id], out = [];
    if (it.cat !== undefined || it.icon !== undefined)
    {
        if (!it.lab) out.push('沒有名稱 lab');
        const e = IC.check(it.icon);
        if (e) out.push(`icon：${e}`);
    }
    for (const [k, v] of Object.entries(it))
    {
        const def = SC.FIELDS[k];
        if (!def) continue;
        if (def.type === 'obj')
        {
            if (!isObj(v)) {out.push(`${k} 應該是物件`); continue;}
            for (const [f, d] of Object.entries(def.fields)) checkVal(d, v[f], `${k}.${f}`, out);
        }
        else if (def.type === 'effects')
        {
            if (!Array.isArray(v)) {out.push('effects 應該是陣列'); continue;}
            v.forEach((e, i) => {for (const [f, d] of Object.entries(SC.EFF_FIELDS)) checkVal(d, e[f], `effects[${i}].${f}`, out);});
        }
        else if (k !== 'icon') checkVal(def, v, k, out);
    }
    if (it.bb?.harvest?.id && !S.items[it.bb.harvest.id]) out.push(`bb.harvest.id 指到不存在的道具：${it.bb.harvest.id}`);
    return out;
}

const validateAll = () => Object.keys(S.items).flatMap(id => validate(id).map(w => `${id}：${w}`));

// ---------- 新增／複製／改名／刪除 ----------
const ID_RE = /^[A-Za-z0-9_-]+$/;

function idError(id)
{
    if (!id) return '不能是空的';
    if (!ID_RE.test(id)) return '只能用英數字、底線、減號';
    if (S.items[id]) return `「${id}」已經有了`;
    return '';
}

function insertAt(index, id, item)
{
    const e = Object.entries(S.items);
    e.splice(index, 0, [id, item]);
    S.items = Object.fromEntries(e);
}

function add(id, cat)
{
    const err = idError(id);
    if (err) return status(err);
    const keys = Object.keys(S.items);
    const last = keys.findLastIndex(k => (S.items[k].cat ?? '') === (cat ?? ''));
    commit(() => {insertAt(last < 0 ? keys.length : last + 1, id, SC.template(cat)); S.sel = id;});
}

function dup(id)
{
    let n = `${id}_copy`;
    for (let i = 2; S.items[n]; i++) n = `${id}_copy${i}`;
    commit(() => {insertAt(Object.keys(S.items).indexOf(id) + 1, n, structuredClone(S.items[id])); S.sel = n;});
}

// item.json 裡引用到 id 的地方
function innerRefs(id)
{
    const out = [];
    for (const [k, it] of Object.entries(S.items))
        for (const r of SC.ITEM_REFS) if (r.get(it).includes(id)) out.push(`${k}.${r.path}`);
    return out;
}

// public/assets 底下其他 json 引用到 id 的地方（字串值或 key 裡有這個 id 當作獨立單字）
async function scanRefs(id)
{
    const re = new RegExp(`(^|[^\\w])${id.replace(/[-]/g, '\\-')}([^\\w]|$)`);
    const out = [];
    const walk = async (dir, path) => {
        for await (const fh of dir.values())
        {
            const p = path ? `${path}/${fh.name}` : fh.name;
            if (fh.kind === 'directory') {await walk(fh, p); continue;}
            if (!/\.(json|world|tmj|tsj)$/.test(fh.name) || p === 'json/item.json') continue;
            const text = await (await fh.getFile()).text();
            if (!re.test(text)) continue;
            let data;
            try {data = JSON.parse(text);} catch {out.push({file: p, path: '（不是 JSON）'}); continue;}
            const hits = [];
            const visit = (v, at) => {
                if (hits.length >= 10) return;
                if (typeof v === 'string') {if (re.test(v)) hits.push(`${at}＝${v.length > 40 ? v.slice(0, 40) + '…' : v}`);}
                else if (v && typeof v === 'object')
                    for (const [k, c] of Object.entries(v))
                    {
                        const sub = Array.isArray(v) ? `${at}[${k}]` : at ? `${at}.${k}` : k;
                        if (!Array.isArray(v) && re.test(k)) hits.push(`${sub}（key）`);
                        visit(c, sub);
                    }
            };
            visit(data, '');
            for (const x of hits) out.push({file: p, path: x});
        }
    };
    await walk(S.assets.dir, '');
    return out;
}

const refList = (refs) => refs.length ? ul(refs.map(r => `${r.file}：${r.path}`)) : h('div', {class: 'dim'}, '（沒有）');

async function rename(from, to)
{
    if (from === to) return;
    const err = idError(to);
    if (err) return status(err);
    const inner = innerRefs(from), outer = await scanRefs(from);
    const r = await ask(`改名 ${from} → ${to}`, [
        h('div', {class: 'title'}, 'item.json 裡會一起改的'),
        inner.length ? ul(inner) : h('div', {class: 'dim'}, '（沒有）'),
        h('div', {class: 'title'}, '其他檔案（不會改，要自己處理；很多是 xlsx 轉出來的）'),
        refList(outer),
    ], [['ok', '改名'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    commit(() => {
        S.items = Object.fromEntries(Object.entries(S.items).map(([k, v]) => [k === from ? to : k, v]));
        for (const it of Object.values(S.items)) for (const ref of SC.ITEM_REFS) ref.set(it, from, to);
        if (S.extra[from]) {S.extra[to] = S.extra[from]; delete S.extra[from];}
        S.sel = to;
    });
    status(`已改名 ${from} → ${to}${outer.length ? `，其他檔案還有 ${outer.length} 處引用` : ''}`);
}

async function remove(id)
{
    const inner = innerRefs(id), outer = await scanRefs(id);
    const r = await ask(`刪除 ${id}`, [
        h('div', {class: 'title'}, 'item.json 裡還在引用的（不會跟著改）'),
        inner.length ? ul(inner) : h('div', {class: 'dim'}, '（沒有）'),
        h('div', {class: 'title'}, '其他檔案'),
        refList(outer),
    ], [['ok', '刪除'], ['cancel', '取消']]);
    if (r !== 'ok') return;
    const keys = Object.keys(S.items), i = keys.indexOf(id);
    commit(() => {
        delete S.items[id];
        S.sel = keys[i + 1] ?? keys[i - 1] ?? null;
    });
}

async function askNew()
{
    const id = h('input', {size: 24}), cat = h('select', null, SC.CATS.map(c => h('option', {value: c}, `${SC.CAT_NAMES[c]}　${c}`)), h('option', {value: ''}, '（無分類）'));
    cat.value = S.items[S.sel]?.cat ?? 'CAT_ITEM';
    const p = ask('新道具', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '分類'), cat)], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim(), cat.value || undefined);
}

async function askRename(from)
{
    const to = h('input', {size: 24, value: from});
    const p = ask(`改名 ${from}`, [h('div', null, '新的 id：'), to], [['ok', '下一步'], ['cancel', '取消']]);
    to.select();
    if (await p === 'ok') await rename(from, to.value.trim());
}

// ---------- 欄位輸入 ----------
function fieldInput(def, val, put, k)
{
    const data = {k};
    switch (def.type)
    {
        case 'textarea':
            return h('textarea', {rows: 2, dataset: data, value: val ?? '', onchange: e => put(e.target.value || undefined)});
        case 'bool':
            return h('input', {type: 'checkbox', dataset: data, checked: !!val, onchange: e => put(e.target.checked || undefined)});
        case 'enum':
        {
            const opts = def.options.includes(val ?? '') ? def.options : [...def.options, val];
            return h('select', {dataset: data, onchange: e => put(e.target.value || undefined)},
                opts.map(o => h('option', {value: o, selected: o === (val ?? '')}, def.names?.[o] ? `${def.names[o]}${o ? `　${o}` : ''}` : o || '—')));
        }
        case 'int': case 'num':
            return h('input', {class: 'num', inputmode: 'decimal', dataset: data, value: val ?? '', onchange: e => put(parseNum(e.target.value))});
        case 'tags':
            return h('input', {dataset: data, list: `dl-${k.split('.').at(-1)}`, value: (val ?? []).join(', '),
                onchange: e => {const a = e.target.value.split(',').map(s => s.trim()).filter(Boolean); put(a.length ? a : undefined);}});
        case 'color':
        {
            const hex = typeof val === 'number' ? `#${val.toString(16).padStart(6, '0')}` : '#ffffff';
            return h('span', {class: 'iconField'},
                h('input', {type: 'color', dataset: data, value: hex, onchange: e => put(parseInt(e.target.value.slice(1), 16))}),
                h('span', {class: 'dim'}, val === undefined ? '（未設定）' : `${val}（0x${hex.slice(1)}）`),
                val !== undefined && h('button', {type: 'button', onclick: () => put(undefined)}, '清除'));
        }
        case 'icon': case 'sprite':
            return h('span', {class: 'iconField'},
                IC.iconEl(val, 32),
                h('input', {dataset: data, value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)}),
                h('button', {type: 'button', onclick: async () => {const v = await IC.pickIcon(val); if (v !== null) put(v || undefined);}}, '選圖…'));
        case 'itemref':
            return h('input', {dataset: data, list: 'dl-items', value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)});
        case 'list':
            return h('input', {dataset: data, list: `dl-${k.split('.').at(-1)}`, value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)});
        default:
            return h('input', {dataset: data, value: val ?? '', onchange: e => put(e.target.value || undefined)});
    }
}

function rawArea(obj, isKnown, put, k)
{
    const raw = Object.fromEntries(Object.entries(obj).filter(([key]) => !isKnown(key)));
    const text = Object.keys(raw).length ? JSON.stringify(raw, null, 2) : '';
    return JE.jsonEdit({k, text: S.drafts[k]?.text ?? text, placeholder: '{ }',
        onApply: v => {delete S.drafts[k]; put(v);},
        onDraft: (t, msg) => {S.drafts[k] = {text: t, msg};}});
}

function mapEditor(id, path, val)
{
    val = isObj(val) ? val : {};
    const k = path.join('.');
    const rekey = (from, to) => set(id, path, Object.fromEntries(Object.entries(val).map(([a, b]) => [a === from ? to : a, b]).filter(([a]) => a)));
    const blankId = h('input', {list: 'dl-items', dataset: {k: `${k}.+`}, placeholder: '加材料…',
        onchange: e => {const v = e.target.value.trim(); if (v && !(v in val)) set(id, [...path, v], 1);}});
    return h('div', {class: 'sub'},
        Object.entries(val).map(([mid, n]) => h('label', null,
            IC.iconEl(S.items[mid]?.icon, 20),
            h('input', {list: 'dl-items', size: 12, dataset: {k: `${k}.${mid}#id`}, value: mid, onchange: e => rekey(mid, e.target.value.trim())}),
            '×', h('input', {class: 'num', dataset: {k: `${k}.${mid}`}, value: n, onchange: e => set(id, [...path, mid], parseNum(e.target.value))}))),
        blankId);
}

// ---------- 表單 ----------
function effCard(id, effs, i)
{
    const e = effs[i], path = ['effects', i];
    const move = (d) => commit(() => {const a = S.items[id].effects; [a[i], a[i + d]] = [a[i + d], a[i]];});
    const known = (k) => !!SC.EFF_FIELDS[k];
    return h('div', {class: 'card'},
        h('div', {class: 'bar'},
            h('span', {class: 'sum'}, SC.effSummary(e)),
            h('button', {type: 'button', title: '上移', disabled: i === 0, onclick: () => move(-1)}, '↑'),
            h('button', {type: 'button', title: '下移', disabled: i === effs.length - 1, onclick: () => move(1)}, '↓'),
            h('button', {type: 'button', title: '複製', onclick: () => commit(() => S.items[id].effects.splice(i + 1, 0, structuredClone(e)))}, '⧉'),
            h('button', {type: 'button', title: '刪除', onclick: () => delEff(id, i)}, '×')),
        h('div', {class: 'sub'},
            SC.effFields(e).map(f => h('label', null, h('span', {title: f}, SC.EFF_FIELDS[f].label),
                fieldInput(SC.EFF_FIELDS[f], e[f], v => set(id, [...path, f], v), `effects.${i}.${f}`)))),
        h('details', {open: Object.keys(e).some(k => !known(k))}, h('summary', {class: 'dim'}, '額外欄位（JSON）'),
            rawArea(e, known, v => commit(() => replaceRaw(S.items[id].effects[i], known, v)), `effects.${i}.#raw`)));
}

function addEff(id, eff = {type: 'mod'})
{
    S.open.effects = true;
    commit(() => {const it = S.items[id]; (it.effects ??= []).push(eff);});
}

// ---------- 框的收合 ----------
// 這個道具第一次畫到時看內容決定（array 或超過一個 key 收起來），之後記住，免得改了內容框自己收起來
const isOpen = (key, v) => S.open[key] ??= !(Array.isArray(v) || (isObj(v) && Object.keys(v).length > 1));

// 點標題列（按鈕以外）開關；fold=false 表示沒有內容可收
function boxBar(key, open, fold, ...kids)
{
    return h('div', {class: 'bar' + (fold ? ' fold' : ''), onclick: fold && (e => {if (!e.target.closest('button')) {S.open[key] = !open; render();}})},
        fold && h('span', {class: 'arrow'}, open ? '▼' : '▶'), ...kids);
}

function delEff(id, i)
{
    commit(() => {const it = S.items[id]; it.effects.splice(i, 1); if (!it.effects.length) delete it.effects;});
}

function fieldRow(id, it, k)
{
    const def = SC.FIELDS[k], v = it[k];
    const label = h('span', {class: 'k' + (v === undefined ? ' unset' : ''), title: k}, def.label);
    if (def.type === 'obj')
    {
        const known = (f) => !!def.fields[f];
        const o = isObj(v) ? v : {};
        const open = v !== undefined && isOpen(k, v);
        return h('div', {class: 'box'},
            boxBar(k, open, v !== undefined, `${def.label}`, h('span', {class: 'dim'}, v === undefined ? k : `${k}（${Object.keys(o).length}）`), h('span', {class: 'grow'}),
                v === undefined ? h('button', {type: 'button', onclick: () => {S.open[k] = true; set(id, [k], {});}}, '建立')
                                : h('button', {type: 'button', onclick: () => set(id, [k], undefined)}, '移除')),
            open && h('div', {class: 'fields'},
                Object.entries(def.fields).map(([f, d]) => [
                    h('span', {class: 'k' + (o[f] === undefined ? ' unset' : ''), title: `${k}.${f}`}, d.label),
                    d.type === 'map' ? mapEditor(id, [k, f], o[f]) : fieldInput(d, o[f], val => set(id, [k, f], val), `${k}.${f}`),
                ]),
                h('span', {class: 'k unset'}, '其他'),
                rawArea(o, known, raw => commit(() => {S.items[id][k] ??= {}; replaceRaw(S.items[id][k], known, raw);}), `${k}.#raw`)));
    }
    if (def.type === 'effects')
    {
        const effs = Array.isArray(v) ? v : [];
        const open = isOpen(k, effs);
        return h('div', {class: 'box'},
            boxBar(k, open, effs.length > 0, `效果`, h('span', {class: 'dim'}, `effects（${effs.length}）`), h('span', {class: 'grow'}),
                h('button', {type: 'button', onclick: () => addEff(id)}, '＋ 新增效果')),
            open && effs.map((_, i) => effCard(id, effs, i)));
    }
    return [label, fieldInput(def, v, val => set(id, [k], val), k)];
}

function otherBox(id, it, known)
{
    const raw = Object.fromEntries(Object.entries(it).filter(([k]) => !known(k)));
    const open = isOpen('#raw', raw), n = Object.keys(raw).length;
    return h('div', {class: 'box'},
        boxBar('#raw', open, n > 0, '其他欄位', h('span', {class: 'dim'}, `（${n}）原始 JSON，工具不認識的 key，例如 bb`)),
        open && rawArea(it, known, raw => commit(() => replaceRaw(S.items[id], known, raw)), '#raw'));
}

function renderForm()
{
    const id = S.sel, it = S.items[id];
    const view = $('view');
    if (!it) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選道具）' : '先在上方選擇遊戲資料夾（public/assets）'));
    const shown = [...new Set([...SC.shownFields(it), ...(S.extra[id] ?? [])])];
    const rest = Object.keys(SC.FIELDS).filter(k => !shown.includes(k));
    const warns = validate(id);
    const known = (k) => !!SC.FIELDS[k];
    view.replaceChildren(...[
        h('div', {class: 'head'},
            IC.iconEl(it.icon, 48),
            h('span', {class: 'bigid'}, id),
            itemDirty(id) && h('span', {class: 'dirty'}, '●'),
            h('span', {class: 'grow'}),
            h('button', {type: 'button', onclick: () => askRename(id)}, '改名…'),
            h('button', {type: 'button', onclick: () => dup(id)}, '複製'),
            h('button', {type: 'button', onclick: () => remove(id)}, '刪除…')),
        warns.length && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
        h('div', {class: 'fields'},
            shown.map(k => fieldRow(id, it, k)),
            rest.length && [h('span', {class: 'k unset'}, '加欄位'),
                h('select', {onchange: e => {
                    const k = e.target.value, def = SC.FIELDS[k];
                    if (def.type === 'obj') {S.open[k] = true; return set(id, [k], {});}
                    if (def.type === 'effects') return addEff(id);
                    (S.extra[id] ??= new Set()).add(k);
                    render();
                }}, h('option', {value: ''}, '…'), rest.map(k => h('option', {value: k}, `${SC.FIELDS[k].label}　${k}`)))],
            otherBox(id, it, known)),
    ].filter(Boolean));
}

// ---------- 總覽表 ----------
function cellText(k, it)
{
    if (k === '#eff') return (it.effects ?? []).map(SC.effSummary).join('；');
    const v = it[k];
    if (v === undefined) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (k === 'cat') return SC.CAT_NAMES[v] ?? v;
    if (typeof v === 'boolean') return v ? '✔' : '';
    return String(v);
}

function editCell(td, id, k)
{
    const def = SC.FIELDS[k], it = S.items[id];
    const el = fieldInput(def, it[k], v => set(id, [k], v), `table.${id}.${k}`);
    td.replaceChildren(el);
    el.focus();
    el.addEventListener('keydown', e => {
        if (e.key === 'Enter') el.blur();
        if (e.key === 'Escape') {el.onchange = null; render();}
    });
    el.addEventListener('blur', () => setTimeout(() => td.isConnected && td.contains(el) && render()), {once: true});
}

function renderTable()
{
    const tab = SC.TABS[S.tab];
    let ids = Object.keys(S.items).filter(id => SC.inTab(tab, S.items[id]) && matchSearch(id));
    if (S.sort)
    {
        const {col, dir} = S.sort;
        const key = (id) => col === '#id' ? id : col === '#eff' ? (S.items[id].effects?.length ?? 0) : S.items[id][col];
        ids.sort((a, b) => {
            const x = key(a), y = key(b);
            if (x === y) return 0;
            if (x === undefined) return 1;
            if (y === undefined) return -1;
            return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
        });
    }
    const th = (col, text) => h('th', {title: col.startsWith('#') ? null : col, onclick:() => {S.sort = S.sort?.col === col ? (S.sort.dir > 0 ? {col, dir: -1} : null) : {col, dir: 1}; render();}},
        text, S.sort?.col === col ? (S.sort.dir > 0 ? ' ▲' : ' ▼') : '');
    $('view').replaceChildren(
        h('div', {class: 'tabs'}, SC.TABS.map((t, i) => h('button', {type: 'button', class: i === S.tab ? 'on' : '', onclick: () => {S.tab = i; render();}},
            `${t.label}（${Object.values(S.items).filter(it => SC.inTab(t, it)).length}）`))),
        h('table', {class: 'grid'},
            h('thead', null, h('tr', null, th('#id', 'id'), tab.cols.map(c => th(c, c === '#eff' ? '效果' : SC.FIELDS[c].label)))),
            h('tbody', null, ids.map(id => {
                const it = S.items[id];
                return h('tr', {class: itemDirty(id) ? 'dirty' : ''},
                    h('td', null, h('a', {onclick: () => {S.sel = id; S.view = 'form'; render();}}, id), itemDirty(id) && ' ●'),
                    tab.cols.map(c => {
                        if (c === '#eff') return h('td', {class: 'eff', title: cellText(c, it)}, cellText(c, it));
                        const def = SC.FIELDS[c];
                        if (def.type === 'icon') return h('td', {class: 'edit', onclick: async () => {const v = await IC.pickIcon(it.icon); if (v !== null) set(id, ['icon'], v || undefined);}}, IC.iconEl(it[c], 24));
                        if (def.type === 'bool') return h('td', null, h('input', {type: 'checkbox', checked: !!it[c], onchange: e => set(id, [c], e.target.checked || undefined)}));
                        const num = def.type === 'int' || def.type === 'num';
                        return h('td', {class: 'edit' + (num ? ' n' : ''), title: '雙擊編輯', ondblclick: e => editCell(e.currentTarget, id, c)}, cellText(c, it));
                    }));
            }))));
}

// ---------- 清單 ----------
function matchSearch(id)
{
    const q = S.search.trim().toLowerCase();
    return !q || id.toLowerCase().includes(q) || (S.items[id].lab ?? '').toLowerCase().includes(q);
}

function renderList()
{
    const groups = [...SC.CATS, ''].map(c => [c, Object.keys(S.items).filter(id => (S.items[id].cat ?? '') === c && matchSearch(id))]);
    const strays = Object.keys(S.items).filter(id => S.items[id].cat && !SC.CATS.includes(S.items[id].cat) && matchSearch(id));
    if (strays.length) groups.push(['?', strays]);
    $('list').replaceChildren(...groups.filter(([, ids]) => ids.length).flatMap(([c, ids]) => [
        h('div', {class: 'group'}, c === '?' ? '不認識的分類' : c ? `${SC.CAT_NAMES[c]}（${ids.length}）` : `無分類（${ids.length}）`),
        ...ids.map(id => {
            const w = validate(id);
            return h('div', {class: 'item' + (id === S.sel ? ' sel' : ''), dataset: {id}, onclick: () => {S.sel = id; S.view = 'form'; render();}},
                IC.iconEl(S.items[id].icon, 20),
                h('span', {class: 'id'}, id),
                h('span', {class: 'lab'}, S.items[id].lab ?? ''),
                h('span', {class: 'mark'}, itemDirty(id) && h('span', {class: 'dirty', title: '未存檔'}, '●'), w.length && h('span', {class: 'warn', title: w.join('\n')}, '⚠')));
        }),
    ]));
    $('list').querySelector('.item.sel')?.scrollIntoView({block: 'nearest'});
}

function renderDatalists()
{
    const its = Object.values(S.items);
    const effs = its.flatMap(it => Array.isArray(it.effects) ? it.effects : []);
    const lists = {
        items: Object.keys(S.items),
        cat_sub: [...SC.FIELDS.cat_sub.suggest, ...its.flatMap(it => it.cat_sub ?? [])],
        class: [...SC.FIELDS.device.fields.class.suggest, ...its.map(it => it.device?.class)],
        key: [...SC.STATS, ...effs.map(e => e.key)],
        id: [...SC.EFF_FIELDS.id.suggest, ...S.fx, ...effs.map(e => e.id)],
    };
    $('datalists').replaceChildren(...Object.entries(lists).map(([k, v]) =>
        h('datalist', {id: `dl-${k}`}, [...new Set(v.filter(Boolean))].map(o => h('option', {value: o})))));
}

function render()
{
    const focus = document.activeElement?.dataset?.k;
    if (S.formOf !== S.sel) {S.drafts = {}; S.open = {}; S.formOf = S.sel;}
    renderDatalists();
    renderList();
    if (S.view === 'form') renderForm();
    else renderTable();
    $('btnForm').classList.toggle('on', S.view === 'form');
    $('btnTable').classList.toggle('on', S.view === 'table');
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1;
    $('btnSave').disabled = $('btnReload').disabled = $('btnNew').disabled = !S.assets;
    $('dirty').hidden = !isDirty();
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

// ---------- 事件 ----------
$('btnAssets').onclick = async () => {
    try {await setAssets(await DIRS.pick('assets'));}
    catch (e) {if (e.name !== 'AbortError') status(e.message);}
};
$('btnReauth').onclick = async () => {
    if (S.pending && await FS.askPermission(S.pending)) setAssets(S.pending).catch(e => status(e.message));
};
$('btnReload').onclick = async () => {
    if (isDirty() && await ask('重新讀取', '還沒存檔的修改會不見', [['ok', '重新讀取'], ['cancel', '取消']]) !== 'ok') return;
    reload();
};
$('btnSave').onclick = save;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnForm').onclick = () => {S.view = 'form'; render();};
$('btnTable').onclick = () => {S.view = 'table'; render();};
$('btnNew').onclick = askNew;
$('search').oninput = (e) => {S.search = e.target.value; render();};

addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // 先失焦讓正在打的欄位觸發 change 套用
    if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
    if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});
addEventListener('beforeunload', (e) => {if (isDirty()) e.preventDefault();});

(async () => {
    S.fx = await fetch('/assets/json/fx.json').then(r => r.json()).then(Object.keys).catch(() => []);
    render();
    IC.ready.then(render);
    const ah = await DIRS.saved('assets');
    if (ah && await FS.hasPermission(ah)) await setAssets(ah).catch(e => status(e.message));
    else if (ah)
    {
        S.pending = ah;
        $('btnReauth').textContent = `重新授權「${ah.name}」`;
        $('btnReauth').hidden = false;
    }
})();

// 給無頭測試用
window.__ie = {S, setAssets, reload, save, commit, set, undo, redo, add, dup, rename, remove, addEff, delEff, scanRefs, innerRefs, validate, validateAll, render, IC, JE};
