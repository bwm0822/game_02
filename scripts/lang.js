import ExcelJS from 'exceljs'
import fs from 'fs'

// 翻譯表：從產出的 json 抽「情境＋原文」，merge 進 xls/lang/<lang>.xlsx，再產出 public/assets/lang/<lang>.json
// 設計見 docs/i18n-architecture.md §11；要排在 run_all 最後（讀的是其他腳本的產出）
//   node scripts/lang.js            更新所有語言
//   node scripts/lang.js --add ja   新增語言
//   node scripts/lang.js --prune    刪掉 orphan 列

const JSON_DIR = './public/assets/json';
const XLS_DIR  = './xls/lang';
const OUT_DIR  = './public/assets/lang';
const LEGACY   = `${XLS_DIR}/_legacy_%s.json`;
const SHEETS   = ['ui', 'item', 'ability', 'dialog', 'story', 'shared'];
const COLS     = ['情境', '原文', '譯文', '檢查', '審核', '建議'];
const WIDTHS   = [28, 50, 50, 16, 8, 30];
const SHARED_MIN = 3;           // 同一句出現在幾個情境以上，就列進 shared 當候選
const DEFAULT_META = {en: {font: 'Arial, sans-serif'}};

const read = f => JSON.parse(fs.readFileSync(`${JSON_DIR}/${f}.json`, 'utf8'));
const cellText = v => (v?.richText ? v.richText.map(t => t.text).join('') : v == null ? '' : String(v));

function sheetOf(ctx)
{
    if (ctx === '_shared') return 'shared';
    const dom = ctx.split('.')[0];
    return {ui: 'ui', item: 'item', ability: 'ability', dlg: 'dialog', line: 'dialog', story: 'story'}[dom];
}

// ── 抽取 ──
function extract()
{
    const out = new Map();
    const add = (ctx, src) => {
        if (typeof src !== 'string' || !src.trim()) return;
        out.set(`${ctx}\u0000${src}`, {ctx, src});
    };
    for (const [id, v] of Object.entries(read('local'))) {add(`ui.${id}`, v.lab); add(`ui.${id}`, v.des);}
    for (const [dom, file] of [['item', 'item'], ['ability', 'ability']])
        for (const [id, v] of Object.entries(read(file))) {add(`${dom}.${id}`, v.lab); add(`${dom}.${id}`, v.des);}

    const nodes = list => {
        for (const n of list)
        {
            for (const t of typeof n.texts === 'object' ? Object.values(n.texts) : [n.texts]) add(n.ctx, t);
            for (const c of n.choices ?? []) add(c.ctx ?? n.ctx, c.label);
        }
    };
    const dialog = read('dialog');
    for (const d of Object.values(dialog))
    {
        nodes(Object.values(d.nodes ?? {}));
        for (const l of d.lines ?? []) add(l.ctx, l.text);
    }
    const story = read('story');
    for (const npc of Object.values(story.nodes)) nodes(Object.values(npc));
    for (const s of story.storylets)
    {
        const ctx = `story.let.${s.id}`;
        add(ctx, s.label); add(ctx, s.hint);
        if (!s.text?.startsWith('@')) add(ctx, s.text);
    }
    for (const t of Object.values(story.threads))
    {
        const ctx = `story.thread.${t.id}`;
        add(ctx, t.title); add(ctx, t.desc);
        for (const v of Object.values(t.values)) {add(ctx, v.journal); add(ctx, v.reward);}
    }
    return [...out.values()];
}

// ── 檢查：佔位符與 BBCode 要跟原文一致 ──
const TOKEN = /\{#?[^{}]+\}|\[\/?[a-z]+(?:=[^\]]*)?\]/gi;
function tokens(s) {return (s.match(TOKEN) ?? []).sort();}
function verify(src, dst)
{
    const a = tokens(src), b = tokens(dst);
    const miss = a.filter(t => !b.includes(t)), extra = b.filter(t => !a.includes(t));
    if (!miss.length && !extra.length) return '';
    return `error: ${[miss.length && `少 ${miss.join(' ')}`, extra.length && `多 ${extra.join(' ')}`].filter(Boolean).join('，')}`;
}

// ── xlsx 讀寫 ──
async function readBook(file)
{
    const rows = {}, meta = {};
    if (!fs.existsSync(file)) return {rows, meta};
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    wb.eachSheet(ws => {
        if (ws.name === 'meta')
        {
            ws.eachRow((r, i) => {if (i > 1 && cellText(r.getCell(1).value)) meta[cellText(r.getCell(1).value)] = cellText(r.getCell(2).value);});
            return;
        }
        ws.eachRow((r, i) => {
            if (i === 1) return;
            const [ctx, src, dst, , review] = [1, 2, 3, 4, 5].map(c => cellText(r.getCell(c).value));
            if (ctx && src) rows[`${ctx}\u0000${src}`] = {ctx, src, dst, review};
        });
    });
    return {rows, meta};
}

const FILL = {
    head:   {type: 'pattern', pattern: 'solid', fgColor: {theme: 9}},
    row:    {type: 'pattern', pattern: 'solid', fgColor: {theme: 8, tint: 0.7999816888943144}},
    orphan: {type: 'pattern', pattern: 'solid', fgColor: {theme: 0, tint: -0.1499984740745262}},
};
const FONT = {name: '微軟正黑體 Light', size: 12, color: {theme: 1}};
const THIN = {style: 'thin'};

function rowHeight(values)
{
    const lines = values.map((v, i) => {
        const w = WIDTHS[i] * 0.75;
        return String(v ?? '').split('\n').reduce((n, part) => {
            const len = [...part].reduce((s, ch) => s + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0);
            return n + Math.max(1, Math.ceil(len / w));
        }, 0);
    });
    return Math.max(...lines) * 15.75;
}

function writeSheet(wb, name, rows)
{
    const ws = wb.addWorksheet(name, {views: [{state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2', activePane: 'bottomRight'}]});
    ws.properties.defaultRowHeight = 15.75;
    ws.columns = WIDTHS.map(width => ({width}));
    const put = (i, values, fill, last) => {
        const row = ws.getRow(i);
        values.forEach((v, c) => {
            const cell = row.getCell(c + 1);
            cell.value = v || null;
            cell.font = i === 1 ? {...FONT, bold: true} : FONT;
            cell.fill = fill;
            cell.alignment = {wrapText: true, vertical: 'middle'};
            cell.border = i === 1 ? {bottom: THIN, ...(c && {left: THIN}), right: THIN}
                                  : {top: THIN, ...(!last && {bottom: THIN}), ...(c && {left: THIN}), right: THIN};
        });
        row.height = rowHeight(values);
    };
    put(1, COLS, FILL.head);
    rows.forEach((r, i) => put(i + 2, [r.ctx, r.src, r.dst, r.check, r.review, r.hint], r.check === 'orphan' ? FILL.orphan : FILL.row, i === rows.length - 1));
}

function writeMeta(wb, meta)
{
    const ws = wb.addWorksheet('meta');
    ws.properties.defaultRowHeight = 15.75;
    ws.columns = [{width: 16}, {width: 50}];
    ws.getRow(1).values = ['key', 'value'];
    ws.getRow(1).font = {...FONT, bold: true};
    Object.entries(meta).forEach(([k, v], i) => {ws.getRow(i + 2).values = [k, v]; ws.getRow(i + 2).font = FONT;});
}

// ── merge ──
async function update(lang, entries, prune)
{
    const file = `${XLS_DIR}/${lang}.xlsx`;
    const old = await readBook(file);
    const legacyFile = LEGACY.replace('%s', lang);
    const legacy = fs.existsSync(legacyFile) ? JSON.parse(fs.readFileSync(legacyFile, 'utf8')) : {};
    let imported = 0;

    // shared：同一句出現在很多情境的候選＋手動加過的
    const ctxCount = {};
    for (const e of entries) (ctxCount[e.src] ??= new Set()).add(e.ctx);
    const sharedSrc = new Set(Object.keys(ctxCount).filter(s => ctxCount[s].size >= SHARED_MIN));
    for (const r of Object.values(old.rows)) if (r.ctx === '_shared' && ctxCount[r.src]) sharedSrc.add(r.src);
    const all = [...entries, ...[...sharedSrc].map(src => ({ctx: '_shared', src}))];
    const alive = new Set(all.map(e => `${e.ctx}\u0000${e.src}`));
    const sharedDst = {};
    for (const r of Object.values(old.rows)) if (r.ctx === '_shared' && r.dst && !verify(r.src, r.dst)) sharedDst[r.src] = r.dst;

    const orphans = Object.entries(old.rows).filter(([k]) => !alive.has(k));
    const orphanBy = {};
    for (const [, r] of orphans) if (r.dst) (orphanBy[r.ctx] ??= []).push(r.dst);

    const bySheet = Object.fromEntries(SHEETS.map(s => [s, []]));
    const stat = {ok: 0, new: 0, orphan: 0, error: 0};
    const tbl = {};
    for (const e of all)
    {
        const prev = old.rows[`${e.ctx}\u0000${e.src}`] ?? {};
        let dst = prev.dst ?? '';
        if (!dst && legacy[e.ctx]?.[e.src]) {dst = legacy[e.ctx][e.src]; imported++;}
        let check = dst ? verify(e.src, dst) : 'new';
        let hint = '';
        if (!dst && e.ctx !== '_shared' && sharedDst[e.src]) {check = ''; hint = `shared: ${sharedDst[e.src]}`;}
        else if (!dst && orphanBy[e.ctx]?.length) hint = `舊譯文: ${orphanBy[e.ctx].join(' ／ ')}`;
        stat[check === '' ? 'ok' : check === 'new' ? 'new' : 'error']++;
        if (dst && check === '') (e.ctx === '_shared' ? (tbl._shared ??= {}) : (tbl[e.ctx] ??= {}))[e.src] = dst;
        bySheet[sheetOf(e.ctx)].push({...e, dst, check, review: prev.review ?? '', hint});
    }
    if (!prune)
    {
        for (const [, r] of orphans)
        {
            bySheet[sheetOf(r.ctx) ?? 'ui'].push({...r, check: 'orphan', hint: ''});
            stat.orphan++;
        }
    }

    const meta = Object.keys(old.meta).length ? old.meta : (DEFAULT_META[lang] ?? {font: ''});
    if (meta.font) tbl._meta = {font: meta.font};

    const wb = new ExcelJS.Workbook();
    for (const s of SHEETS) writeSheet(wb, s, bySheet[s]);
    writeMeta(wb, meta);
    await wb.xlsx.writeFile(file);
    fs.mkdirSync(OUT_DIR, {recursive: true});
    fs.writeFileSync(`${OUT_DIR}/${lang}.json`, JSON.stringify(tbl, null, 2), 'utf8');
    console.log(`${lang}: ${stat.ok} ok / ${stat.new} new / ${stat.orphan} orphan / ${stat.error} error${imported ? `（匯入舊譯文 ${imported} 句）` : ''}`);
}

const args = process.argv.slice(2);
const addIdx = args.indexOf('--add');
fs.mkdirSync(XLS_DIR, {recursive: true});
const langs = new Set(fs.readdirSync(XLS_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$')).map(f => f.slice(0, -5)));
if (addIdx >= 0)
{
    const lang = args[addIdx + 1];
    if (!lang || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(lang)) {console.error('用法：node scripts/lang.js --add <BCP 47 語系代碼，例如 ja、zh-CN>'); process.exit(1);}
    langs.add(lang);
}
const entries = extract();
for (const lang of langs) await update(lang, entries, args.includes('--prune'));
if (!langs.size) console.log('還沒有任何翻譯表，用 node scripts/lang.js --add <lang> 新增');
