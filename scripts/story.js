import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import {splitTables, toArray, buildChoice, buildNode} from './tools.js'

const IN_XLSX   = './xls/story.xlsx';
const OUT_JSON  = './public/assets/json/story.json';
const ROLE_JSON = './public/assets/json/role.json';
const DIALOG_JSON = './public/assets/json/dialog.json';
const MAP_DIR   = './public/assets/maps';

// 條件裡由查詢方提供的情境事實，不是 quality
const FACTS = ['time', 'hour', 'map', 'hp', 'job', 'style', 'dead', 'true', 'false'];
const EVENTS = ['kill', 'item', 'enter', 'time', 'quality', 'see'];

function readQualities(wb)
{
    const ws = wb.Sheets['qualities'];
    if (!ws) throw new Error(`${IN_XLSX} 缺少 qualities sheet`);
    const raw = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    const out = {};
    for (const {rows} of splitTables(raw))
    {
        for (const r of rows)
        {
            if (!r.name) continue;
            if (out[r.name]) console.warn(`WARN quality ${r.name} 重複宣告`);
            if (r.scope !== 'global' && r.scope !== 'npc') console.error(`ERROR quality ${r.name} 的 scope 必須是 global 或 npc`);
            out[r.name] = {
                scope: r.scope,
                default: Number(r.default) || 0,
                show: r.show === 'yes',
                label: r.label || r.name,
            };
        }
    }
    return out;
}

// ── 劇情線 sheet：thread / storylet / 長對話節點三種表，依表頭欄位判斷 ──
function readThreads(sheet, rows, story)
{
    let cur = null;
    for (const r of rows)
    {
        if (r.thread)
        {
            cur = {id: r.thread, sheet, row: r._row, title: r.title, desc: r.desc, quality: r.quality, values: {}};
            story.threads[r.thread] = cur;
        }
        if (!cur || r.value === '') continue;
        const v = {journal: r.journal, row: r._row};
        if (r.pos) v.pos = r.pos;
        if (r.end === 'Y') v.end = true;
        if (r.reward_hint) v.reward = r.reward_hint;
        cur.values[Number(r.value)] = v;
    }
}

function readStorylets(sheet, rows, story)
{
    for (const r of rows)
    {
        if (!r.id) continue;
        const s = {id: r.id, sheet, row: r._row};
        for (const k of ['who', 'tease', 'requires', 'label', 'hint', 'text']) {if (r[k] !== '') s[k] = String(r[k]);}
        if (r.on) s.on = toArray(r.on);
        if (r.effects) s.effects = toArray(r.effects);
        story.storylets.push(s);
    }
}

// 地圖 @群組 圖層的出現條件
function readSpawns(sheet, rows, story)
{
    for (const r of rows)
    {
        if (!r.group) continue;
        if (story.spawns[r.group]) err(`${sheet}!${r._row} spawn 群組「${r.group}」重複（另一個在 ${story.spawns[r.group].sheet}）`);
        story.spawns[r.group] = {requires: String(r.requires), sheet, row: r._row};
    }
}

function readNodes(sheet, rows, story)
{
    let node = null;
    for (const r of rows)
    {
        if (r.section === 'node')
        {
            if (!r.who) {err(`${sheet}!${r._row} 節點 ${r.node_id} 沒填 who`); node = null; continue;}
            node = buildNode(r);
            node.sheet = sheet;
            node.row = r._row;
            (story.nodes[r.who] ??= {})[r.node_id] = node;
        }
        else if (r.section === 'choice' && node) {node.choices.push(buildChoice(r));}
        else if (r.section === 'post' && node) {node.posts.push(...toArray(r.actions));}
    }
    for (const npc of Object.values(story.nodes))
    {
        for (const n of Object.values(npc)) {n.choices.sort((a, b) => (a.priority || 0) - (b.priority || 0));}
    }
}

function readStory(wb)
{
    const story = {threads: {}, storylets: [], nodes: {}, spawns: {}};
    for (const sheet of wb.SheetNames)
    {
        if (sheet === 'qualities') continue;
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:''});
        for (const {header, rows} of splitTables(raw))
        {
            if (header.includes('thread')) readThreads(sheet, rows, story);
            else if (header.includes('section')) readNodes(sheet, rows, story);
            else if (header.includes('group')) readSpawns(sheet, rows, story);
            else if (header.includes('requires')) readStorylets(sheet, rows, story);
            else console.warn(`WARN ${sheet} 有認不得的表頭：${header.filter(Boolean).join(',')}`);
        }
    }
    return story;
}

// ── 名稱檢查 ──
let errors = 0;
function err(msg) {console.error(`ERROR ${msg}`); errors++;}

function isDeclared(name, qualities, roleIds)
{
    if (qualities[name]) return true;
    if (Object.keys(qualities).some(k => k.endsWith('.*') && name.startsWith(k.slice(0, -1)))) return true;
    const dot = name.indexOf('.');
    if (dot > 0 && roleIds.has(name.slice(0, dot)))
    {
        const sub = name.slice(dot + 1);
        return sub.startsWith('_') || qualities[sub]?.scope === 'npc';
    }
    return false;
}

function condNames(expr)
{
    if (!expr || expr === true) return [];
    return String(expr).split(/&&|\|\|/)
        .map(s => s.trim().replace(/^!/, '').split(/>=|<=|!=|==|=|>|</)[0].trim())
        .filter(Boolean);
}

// 跟 src/systems/script.js 的 COND_PREFIX/ASSIGN 同一套規則
function parseAction(action)
{
    const names = [];
    const m0 = action.match(/^(.*?)\s+:\s+(.*)$/);
    let cmd = action.trim();
    if (m0)
    {
        names.push(...condNames(m0[1]));
        cmd = m0[2].trim();
    }
    const m = cmd.match(/^(\S+?)(?:=(\S*)|([+-])(\d+(?:\.\d+)?))$/);
    if (m) {names.push(m[1]); return {names};}
    const [op, ...args] = cmd.split(/\s+/);
    if (['count', 'stop'].includes(op) && args[0]) names.push(args[0]);
    return {names, op, args};
}

function checkName(name, where, ctx)
{
    if (name.startsWith('_') || name.startsWith('item:')) return;
    if (FACTS.includes(name) || /^-?\d+(\.\d+)?$/.test(name) || name === 'gold') return;
    if (!isDeclared(name, ctx.qualities, ctx.roleIds)) err(`未宣告的 quality「${name}」 @ ${where}`);
}

function checkCond(expr, where, ctx) {condNames(expr).forEach(n => checkName(n, where, ctx));}

// npcs：這段動作可能發生在哪些 NPC 身上（goto 要檢查節點存在）；null = 不在對話中
function checkActions(actions, where, ctx, npcs)
{
    for (const a of actions ?? [])
    {
        const {names, op, args} = parseAction(a);
        names.forEach(n => checkName(n, where, ctx));
        if ((op === 'goto' || op === 'approach') && npcs) npcs.forEach(npc => checkNode(npc, args[0], where, ctx));
    }
}

function nodeExists(npc, id, ctx) {return !!(ctx.story.nodes[npc]?.[id] || ctx.dialog[npc]?.nodes?.[id]);}

function checkNode(npc, id, where, ctx)
{
    if (!id || id.startsWith('[')) return;
    if (!nodeExists(npc, id, ctx)) err(`${npc} 沒有節點「${id}」 @ ${where}`);
}

function checkDialogNodes(npc, nodes, at, ctx)
{
    for (const [id, node] of Object.entries(nodes ?? {}))
    {
        const where = at(id, node);
        if (node.textKeys && typeof node.textKeys === 'object') Object.keys(node.textKeys).forEach(c => checkCond(c, where, ctx));
        checkActions([...(node.actions ?? []), ...(node.posts ?? [])], where, ctx, [npc]);
        for (const c of node.choices ?? [])
        {
            const w = `${where} choice「${c.labelKey}」`;
            checkCond(c.condition, w, ctx);
            checkActions(c.actions, w, ctx, [npc]);
            checkNode(npc, c.next, w, ctx);
        }
    }
}

function checkDialog(ctx)
{
    for (const [npc, d] of Object.entries(ctx.dialog))
    {
        const at = s => `dialog.xlsx/${npc} ${s}`;
        checkActions(d.actions, at('action'), ctx, [npc]);
        for (const e of d.entries ?? [])
        {
            checkCond(e.condition, at(`entry ${e.nodeId}`), ctx);
            checkActions(e.actions, at(`entry ${e.nodeId}`), ctx, [npc]);
            checkNode(npc, e.nodeId, at('entry'), ctx);
        }
        checkDialogNodes(npc, d.nodes, id => at(`node ${id}`), ctx);
    }
}

// who 對得上的 NPC id 清單；寫錯回傳 null
function whoNpcs(who, ctx)
{
    if (who === '*') return [...ctx.roleIds];
    if (who.startsWith('job:'))
    {
        const job = who.slice(4);
        const ids = Object.entries(ctx.roles).filter(([, r]) => r.job === job).map(([id]) => id);
        return ids.length ? ids : null;
    }
    return ctx.roleIds.has(who) ? [who] : null;
}

function checkStory(ctx)
{
    const {story} = ctx;
    for (const [npc, nodes] of Object.entries(story.nodes))
    {
        if (!ctx.roleIds.has(npc)) err(`story.xlsx 節點的 who「${npc}」不是 NPC id`);
        checkDialogNodes(npc, nodes, (id, n) => `story.xlsx/${n.sheet}!${n.row} node ${id}`, ctx);
    }
    for (const t of Object.values(story.threads))
    {
        const at = r => `story.xlsx/${t.sheet}!${r} thread ${t.id}`;
        checkName(t.quality, at(t.row), ctx);
        for (const v of Object.values(t.values))
        {
            for (const [, n] of String(v.journal ?? '').matchAll(/\{([^}]+)\}/g)) checkName(n, at(v.row), ctx);
        }
    }
    for (const [g, s] of Object.entries(story.spawns)) checkCond(s.requires, `story.xlsx/${s.sheet}!${s.row} spawn ${g}`, ctx);
    const ids = new Set();
    for (const s of story.storylets)
    {
        const where = `story.xlsx/${s.sheet}!${s.row} storylet ${s.id}`;
        const key = `${s.id}|${s.who ?? ''}`;
        if (ids.has(key)) err(`storylet id+who 重複 @ ${where}`);
        ids.add(key);
        let npcs = null;
        if (s.who)
        {
            npcs = whoNpcs(s.who, ctx);
            if (!npcs) {err(`who「${s.who}」對不到任何 NPC @ ${where}`); npcs = null;}
        }
        if (!s.who && !s.on) err(`storylet 沒有 who 也沒有 on @ ${where}`);
        if (!s.on && !s.label) err(`對話卡沒有 label @ ${where}`);
        (s.on ?? []).forEach(e => {if (!EVENTS.includes(e)) err(`認不得的事件「${e}」 @ ${where}`);});
        checkCond(s.requires, where, ctx);
        checkCond(s.tease, where, ctx);
        checkActions(s.effects, where, ctx, s.on ? null : npcs);
        if (s.text?.startsWith('@'))
        {
            if (s.on) err(`事件卡的 text 不能跳節點 @ ${where}`);
            else npcs?.forEach(npc => checkNode(npc, s.text.slice(1), where, ctx));
        }
    }
}

function walkLayers(layers, file, ctx)
{
    for (const l of layers ?? [])
    {
        if (l.name?.startsWith('#')) err(`${file} layer ${l.name}：條件圖層改用 @群組，條件寫在 story.xlsx 的 spawn 表`);
        if (l.name?.startsWith('@'))
        {
            const g = l.name.slice(1);
            if (!ctx.story.spawns[g]) err(`${file} layer ${l.name}：story.xlsx 沒有宣告 spawn 群組「${g}」`);
            ctx.usedGroups.add(g);
        }
        walkLayers(l.layers, file, ctx);
    }
}

function checkMaps(dir, ctx)
{
    for (const f of fs.readdirSync(dir, {withFileTypes:true}))
    {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {checkMaps(p, ctx); continue;}
        if (!f.name.endsWith('.json')) continue;
        try {walkLayers(JSON.parse(fs.readFileSync(p, 'utf-8')).layers, p, ctx);}
        catch {}
    }
}

function readJson(p) {return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {};}

function strip(story)
{
    // sheet/row 只給檢查報錯用，不輸出
    const clean = o => {const {sheet, row, ...rest} = o; return rest;};
    const threads = Object.fromEntries(Object.entries(story.threads).map(([k, t]) => [k, {
        ...clean(t), values: Object.fromEntries(Object.entries(t.values).map(([v, d]) => [v, clean(d)])),
    }]));
    const nodes = Object.fromEntries(Object.entries(story.nodes).map(([npc, ns]) => [npc,
        Object.fromEntries(Object.entries(ns).map(([id, n]) => [id, clean(n)]))]));
    const spawns = Object.fromEntries(Object.entries(story.spawns).map(([g, s]) => [g, s.requires]));
    return {threads, storylets: story.storylets.map(clean), nodes, spawns};
}

const wb = XLSX.readFile(IN_XLSX);
const qualities = readQualities(wb);
const story = readStory(wb);
fs.writeFileSync(OUT_JSON, JSON.stringify({qualities, ...strip(story)}, null, 2), 'utf-8');
console.log(`Output written to ${OUT_JSON}`);

const roles = readJson(ROLE_JSON);
const ctx = {qualities, story, roles, roleIds: new Set(Object.keys(roles)), dialog: readJson(DIALOG_JSON), usedGroups: new Set()};
checkDialog(ctx);
checkStory(ctx);
checkMaps(MAP_DIR, ctx);
Object.entries(story.spawns).filter(([g]) => !ctx.usedGroups.has(g))
    .forEach(([g, s]) => console.warn(`WARN story.xlsx/${s.sheet}!${s.row} spawn 群組「${g}」沒有任何地圖用到`));
if (errors) {console.error(`story 檢查：${errors} 個錯誤`); process.exitCode = 1;}
else {console.log('story 檢查：OK');}
