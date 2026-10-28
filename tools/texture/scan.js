// 圖片被誰引用（字串剛好等於檔名才算，key:frame 取冒號前；組出來的 key 抓不到）。只認放圖的地方，不然 type:'well'、align:'top' 這種同名字串會誤判：
//   資料 json：欄位名在 FIELDS 裡的字串值（遊戲加了放圖的新欄位要加進來，不然會被當成未使用）
//   地圖／template／tsj：Tiled 自訂屬性的 value；tsj 的 image 比路徑（相對 .tsj），不追那個 tsj 有沒有地圖在用
//   src/：字串字面量（src/old、整行註解不算）要是 key:frame 寫法、或那行有圖片相關的字（CTX）
import * as FS from '../common/fs.js';

const IMG = /\.(png|jpe?g)$/i;
const SKIP_JSON = ['textures.json', 'navgraph.json'];
const FIELDS = new Set(['icon', 'sprite', 'back', 'img']);
const TILED = new Set(['value']);
const LIT = /(['"`])([\w-]+)(:[\w.-]*)?\1/g;
const CTX = /image|sprite|texture|icon|img|pic|background|frame|portrait|cursor/i;
// 能跳過去的分頁：資料 json 裡的 path → [分頁, 那個分頁 onGoto 收的 path]
const GOTO = {
    'item.json': (p) => ['item', [p[0]]],
    'role.json': (p) => ['role', [p[0]]],
    'ability.json': (p) => ['ability', [p[0]]],
    'fx.json': (p) => ['fx', [p[0]]],
    'dialog.json': (p) => ['dialog', p],
    'story.json': (p) => p[0] === 'lines' && p.length > 1 ? ['story', p.slice(1)] : undefined,
};

const add = (map, key, loc) => {const a = map.get(key) ?? []; a.push(loc); map.set(key, a);};
const keyOf = (s) => s.split(':')[0];
// a/b/../c → a/c
const norm = (p) => p.split('/').reduce((s, seg) => seg === '..' ? s.slice(0, -1) : seg === '.' ? s : [...s, seg], []).join('/');

async function walk(dir, path, fn, skip)
{
    for await (const fh of dir.values())
    {
        const p = `${path}/${fh.name}`;
        if (fh.kind === 'directory') {if (!skip?.(p)) await walk(fh, p, fn, skip);}
        else await fn(fh, p);
    }
}

const readJson = async (fh) => {try {return JSON.parse(await (await fh.getFile()).text());} catch {return null;}};

// textures/ 底下的圖（minimap/ 不列）：[{path, key, dir, tbd, metas}]，path 相對 public/assets，metas 是同資料夾的 <key>_sheet|atlas.json
export async function listTextures(assets)
{
    const tex = await FS.tryDir(assets, 'textures');
    if (!tex) return [];
    const names = new Map(), out = [];
    await walk(tex, 'textures', async (fh, p) => {
        const dir = p.slice(0, p.lastIndexOf('/'));
        if (!names.has(dir)) names.set(dir, new Set());
        names.get(dir).add(fh.name);
        if (IMG.test(fh.name)) out.push({path: p, key: fh.name.replace(IMG, ''), dir, tbd: p.startsWith('textures/.tbd/')});
    }, (p) => p === 'textures/minimap');
    for (const e of out) e.metas = ['sheet', 'atlas'].map(k => `${e.key}_${k}.json`).filter(n => names.get(e.dir).has(n));
    return out.sort((a, b) => a.path.localeCompare(b.path));
}

// root：專案根目錄；回傳 {uses: key → [loc], paths: 路徑 → [loc], scanned}，loc = {text, go?: [分頁, path]}
export async function scan(root)
{
    const uses = new Map(), paths = new Map();
    const src = await FS.tryDir(root, 'src');
    if (src) await walk(src, 'src', async (fh, p) => {
        if (!fh.name.endsWith('.js')) return;
        (await (await fh.getFile()).text()).split('\n').forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('//')) return;
            const ctx = CTX.test(line);
            for (const m of line.matchAll(LIT)) if (ctx || m[3]) add(uses, m[2], {text: `${p} ${i + 1} 行：${t.slice(0, 80)}`});
        });
    }, (p) => p === 'src/old');

    // fields：算 key 的欄位名（陣列裡的看上一層）；base：tsj 所在資料夾，image 欄照它解析成路徑
    const visit = (file, data, fields, base = null) => {
        const go = GOTO[file];
        const rec = (v, at) => {
            if (typeof v === 'string')
            {
                const loc = {text: `${file}：${at.join('.')}`, go: go?.(at)};
                if (base && at.at(-1) === 'image') add(paths, norm(`${base}/${v}`), loc);
                else if (fields.has(at.findLast(s => typeof s === 'string'))) add(uses, keyOf(v), loc);
            }
            else if (v && typeof v === 'object')
                for (const [k, c] of Object.entries(v)) rec(c, [...at, Array.isArray(v) ? +k : k]);
        };
        rec(data, []);
    };

    const assets = await FS.tryDir(await FS.tryDir(root, 'public'), 'assets');
    const json = assets && await FS.tryDir(assets, 'json');
    if (json) for await (const fh of json.values())
    {
        if (fh.kind !== 'file' || !fh.name.endsWith('.json') || SKIP_JSON.includes(fh.name)) continue;
        const data = await readJson(fh);
        if (data) visit(fh.name, data, FIELDS);
    }
    for (const [dir, ext] of [['maps', '.json'], ['templates', '.tj'], ['tilesets', '.tsj']])
    {
        const d = assets && await FS.tryDir(assets, dir);
        if (d) await walk(d, dir, async (fh, p) => {
            if (!fh.name.endsWith(ext)) return;
            const data = await readJson(fh);
            if (data) visit(p, data, TILED, ext === '.tsj' ? p.slice(0, p.lastIndexOf('/')) : null);
        });
    }
    return {uses, paths, scanned: !!src};
}
