import XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import {splitTables} from './tools.js'

const IN_XLSX   = './xls/story.xlsx';
const OUT_JSON  = './public/assets/json/story.json';
const ROLE_JSON = './public/assets/json/role.json';
const DIALOG_JSON = './public/assets/json/dialog.json';
const QUEST_JSON  = './public/assets/json/quest.json';
const MAP_DIR   = './public/assets/maps';

// 條件裡由查詢方提供的情境事實，不是 quality
const FACTS = ['time', 'map', 'hp', 'job', 'style', 'true', 'false'];
// 不帶 quality 名稱的指令
const PLAIN_OPS = ['trade', 'close', 'goto', 'give', 'take', 'consume', 'qstart', 'qclose', 'approach', 'count', 'stop'];

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

// ── 名稱檢查 ──
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

// 跟 src/systems/script.js 的 splitAction/ASSIGN 同一套規則
function actionNames(action)
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
    if (m) {names.push(m[1]); return names;}
    const [op, p1] = cmd.split(/\s+/);
    if (['set', 'clr', 'rm'].includes(op) && p1) names.push(p1);
    return names;
}

function checkName(name, where, ctx)
{
    if (name.startsWith('_') || name.startsWith('item:') || name.startsWith('#')) return;
    if (FACTS.includes(name) || /^-?\d+(\.\d+)?$/.test(name) || name === 'gold') return;
    if (!isDeclared(name, ctx.qualities, ctx.roleIds))
    {
        console.error(`ERROR 未宣告的 quality「${name}」 @ ${where}`);
        ctx.errors++;
    }
}

function checkDialog(dialog, ctx)
{
    for (const [npc, d] of Object.entries(dialog))
    {
        const at = s => `dialog.xlsx/${npc} ${s}`;
        (d.actions ?? []).forEach(a => actionNames(a).forEach(n => checkName(n, at('action'), ctx)));
        for (const e of d.entries ?? [])
        {
            condNames(e.condition).forEach(n => checkName(n, at(`entry ${e.nodeId}`), ctx));
            (e.actions ?? []).forEach(a => actionNames(a).forEach(n => checkName(n, at(`entry ${e.nodeId}`), ctx)));
        }
        for (const [id, node] of Object.entries(d.nodes ?? {}))
        {
            const where = at(`node ${id}`);
            if (node.textKeys && typeof node.textKeys === 'object')
            {
                Object.keys(node.textKeys).forEach(c => condNames(c).forEach(n => checkName(n, where, ctx)));
            }
            [...(node.actions ?? []), ...(node.posts ?? [])].forEach(a => actionNames(a).forEach(n => checkName(n, where, ctx)));
            for (const c of node.choices ?? [])
            {
                const w = `${where} choice「${c.labelKey}」`;
                condNames(c.condition).forEach(n => checkName(n, w, ctx));
                (c.actions ?? []).forEach(a => actionNames(a).forEach(n => checkName(n, w, ctx)));
            }
        }
    }
}

function checkQuest(quest, ctx)
{
    for (const [id, q] of Object.entries(quest))
    {
        const at = s => `quest.xlsx/${q.npcId} ${id} ${s}`;
        [...(q.action?.start ?? []), ...(q.action?.complete ?? [])].forEach(a => actionNames(a).forEach(n => checkName(n, at('actions'), ctx)));
        for (const [sid, st] of Object.entries(q.steps ?? {}))
        {
            if (st.complete?.type === 'flag') checkName(st.complete.flag, at(sid), ctx);
            (st.actions ?? []).forEach(a => actionNames(a).forEach(n => checkName(n, at(sid), ctx)));
        }
    }
}

function walkLayers(layers, file, ctx)
{
    for (const l of layers ?? [])
    {
        if (l.name?.startsWith('#')) checkName(l.name.slice(1), `${file} layer ${l.name}`, ctx);
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

const wb = XLSX.readFile(IN_XLSX);
const qualities = readQualities(wb);
fs.writeFileSync(OUT_JSON, JSON.stringify({qualities}, null, 2), 'utf-8');
console.log(`Output written to ${OUT_JSON}`);

const ctx = {qualities, roleIds: new Set(Object.keys(readJson(ROLE_JSON))), errors: 0};
checkDialog(readJson(DIALOG_JSON), ctx);
checkQuest(readJson(QUEST_JSON), ctx);
checkMaps(MAP_DIR, ctx);
if (ctx.errors) {console.error(`story 檢查：${ctx.errors} 個錯誤`); process.exitCode = 1;}
else {console.log('story 檢查：OK');}
