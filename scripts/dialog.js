import XLSX from 'xlsx'
import fs from 'fs'
import {splitTables, toArray, buildChoice, buildNode} from './tools.js'

// 格式見 docs/story-architecture.md §6
const IN_XLSX   = './xls/dialog.xlsx';
const OUT_JSON  = './public/assets/json/dialog.json';
const ROLE_JSON = './public/assets/json/role.json';
const COMMON    = '_common';
const SKIP_SHEETS = ['locales', '說明'];

function buildEntry(row)
{
    const entry = {nodeId: row.node_id, order: Number(row.priority)};
    if (row.condition) entry.condition = row.condition;
    if (row.actions)   entry.actions   = toArray(row.actions);
    return entry;
}

function buildLine(row)
{
    const line = {concept: row.node_id, text: String(row.text_keys)};
    if (row.condition) line.condition = String(row.condition);
    return line;
}

// dynamic：section 寫 'choice:<node_id>' 的列，合併 _common 之後才掛上去
function readSheet(sheet, rows)
{
    const d = {entries: [], nodes: {}, lines: [], dynamic: []};
    let node = null;
    for (const row of rows)
    {
        const sec = row.section;
        if (sec === 'entry') d.entries.push(buildEntry(row));
        else if (sec === 'line') d.lines.push(buildLine(row));
        else if (sec === 'node') {node = buildNode(row); d.nodes[row.node_id] = node;}
        else if (sec === 'choice' && node) node.choices.push(buildChoice(row));
        else if (sec === 'post' && node) node.posts.push(...toArray(row.actions));
        else if (sec === 'storylets' && node) node.cards = Number(row.priority);
        else if (sec?.startsWith('choice:')) d.dynamic.push({nodeId: sec.slice('choice:'.length).trim(), row});
        else if (sec) console.warn(`WARN dialog.xlsx/${sheet}!${row._row} 認不得的 section「${sec}」`);
    }
    return d;
}

// own 蓋過 common：同名節點用自己的、同 nodeId 的 entry 用自己的；line 兩邊都留，自己的標 own（挑選時 +1 分）
function merge(sheet, own, common)
{
    const nodes = structuredClone({...common.nodes, ...own.nodes});
    for (const {nodeId, row} of [...common.dynamic, ...own.dynamic])
    {
        if (!nodes[nodeId]) {console.warn(`WARN dialog.xlsx/${sheet}!${row._row} 找不到節點 ${nodeId}，跳過選項「${row.label_key}」`); continue;}
        nodes[nodeId].choices.push(buildChoice(row));
    }
    for (const n of Object.values(nodes)) n.choices.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const mine = new Set(own.entries.map(e => e.nodeId));
    const entries = [...common.entries.filter(e => !mine.has(e.nodeId)), ...own.entries]
                        .sort((a, b) => a.order - b.order);
    const lines = [...own.lines.map(l => ({...l, own: true})), ...common.lines];
    return {id: sheet, entries, nodes, lines};
}

function excelToJson()
{
    const wb = XLSX.readFile(IN_XLSX);
    const sheets = {};
    for (const sheet of wb.SheetNames)
    {
        if (SKIP_SHEETS.includes(sheet)) continue;
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {header:1, defval:''});
        sheets[sheet] = readSheet(sheet, splitTables(raw).flatMap(t => t.rows));
    }

    const empty = {entries: [], nodes: {}, lines: [], dynamic: []};
    const common = sheets[COMMON] ?? empty;
    const out = {[COMMON]: merge(COMMON, empty, common)};

    // 有自己 sheet 的 NPC，加上 unique NPC（沒 sheet 就只用 _common）才能對話；其他角色只吃 _common 的 line
    const roles = fs.existsSync(ROLE_JSON) ? JSON.parse(fs.readFileSync(ROLE_JSON, 'utf-8')) : {};
    const ids = new Set([...Object.keys(sheets), ...Object.keys(roles).filter(id => roles[id].unique)]);
    ids.delete(COMMON);
    for (const id of ids)
    {
        if (!roles[id]) console.warn(`WARN dialog.xlsx sheet「${id}」不是 NPC id`);
        out[id] = merge(id, sheets[id] ?? empty, common);
    }

    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), 'utf-8');
    console.log(`Output written to ${OUT_JSON}`);
}

excelToJson();
