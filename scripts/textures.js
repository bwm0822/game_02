// 掃 public/assets/textures/ 產生 textures.json（Preloader 開機載入清單、工具選圖器也讀它）
// key 是檔名（去副檔名），整個 textures/ 不能撞名；有 <key>_atlas.json 的是 atlas，sheets.json 有列的是 spritesheet，其他是單張圖
// tbd/、minimap/ 不收；maps/ 只檢查撞名，不進清單（由 tilemap 進地圖時照 *.tsj 載）
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, relative, dirname, basename, extname, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['tbd', 'minimap']);
const LAZY = 'maps';
const IMG = new Set(['.png', '.jpg', '.jpeg']);

function walk(dir, top, out = [])
{
    for (const e of readdirSync(dir, {withFileTypes: true}))
    {
        const p = join(dir, e.name);
        if (e.isDirectory()) {if (!(dir === top && SKIP.has(e.name))) walk(p, top, out);}
        else if (IMG.has(extname(e.name).toLowerCase())) out.push(p);
    }
    return out;
}

const grid = (o) => ({w: o.w, h: o.h ?? o.w, margin: o.margin ?? 0, spacing: o.spacing ?? 0});
const same = (a, b) => a.w === b.w && a.h === b.h && a.margin === b.margin && a.spacing === b.spacing;
const fmt = (g) => `${g.w}x${g.h} margin ${g.margin} spacing ${g.spacing}`;

// assets 給測試換成假資料夾
export function run({assets = join(ROOT, 'public/assets'), write = true} = {})
{
    const TEX = join(assets, 'textures');
    const rel = (p) => relative(assets, p).replace(/\\/g, '/');
    const errors = [];
    const sheets = JSON.parse(readFileSync(join(TEX, 'sheets.json'), 'utf8'));
    const byKey = {};
    for (const p of walk(TEX, TEX))
    {
        const key = basename(p, extname(p));
        (byKey[key] ??= []).push(p);
    }
    for (const [key, ps] of Object.entries(byKey))
        if (ps.length > 1) errors.push(`檔名撞名「${key}」：${ps.map(rel).join('、')}`);

    const out = {image: {}, sheet: {}, atlas: {}};
    const pathKey = {};
    for (const [key, [p]] of Object.entries(byKey))
    {
        pathKey[rel(p)] = key;
        if (rel(p).startsWith(`textures/${LAZY}/`)) continue;
        const atlas = join(dirname(p), `${key}_atlas.json`);
        if (existsSync(atlas))
        {
            if (sheets[key]) errors.push(`「${key}」同時有 ${rel(atlas)} 跟 sheets.json 設定`);
            out.atlas[key] = {url: rel(p), json: rel(atlas)};
        }
        else if (sheets[key]) out.sheet[key] = {url: rel(p), ...grid(sheets[key])};
        else out.image[key] = rel(p);
    }
    for (const key of Object.keys(sheets))
        if (!out.sheet[key] && !out.atlas[key]) errors.push(`sheets.json 的「${key}」找不到圖（或在 ${LAZY}/ 底下）`);

    const tsDir = join(assets, 'tilesets');
    for (const f of readdirSync(tsDir).filter(f => f.endsWith('.tsj')))
    {
        const ts = JSON.parse(readFileSync(join(tsDir, f), 'utf8'));
        const img = (s) => rel(resolve(tsDir, s));
        if (ts.image)
        {
            const p = img(ts.image), key = pathKey[p];
            if (!key) {errors.push(`${f}：圖 ${p} 不存在或不在收錄範圍`); continue;}
            if (ts.name !== key) errors.push(`${f}：name「${ts.name}」要跟檔名「${key}」一樣`);
            const g = grid({w: ts.tilewidth, h: ts.tileheight, margin: ts.margin, spacing: ts.spacing});
            if (out.image[key]) errors.push(`${f}：「${key}」被當 tileset 用，sheets.json 要列格子 ${fmt(g)}`);
            else if (out.sheet[key] && !same(out.sheet[key], g)) errors.push(`${f}：格子 ${fmt(g)} 跟 sheets.json 的 ${fmt(out.sheet[key])} 不一樣`);
        }
        for (const t of ts.tiles ?? [])
            if (t.image && !pathKey[img(t.image)]) errors.push(`${f}：圖 ${img(t.image)} 不存在或不在收錄範圍`);
    }

    const count = `image ${Object.keys(out.image).length}、sheet ${Object.keys(out.sheet).length}、atlas ${Object.keys(out.atlas).length}`;
    if (!errors.length && write) writeFileSync(join(assets, 'json/textures.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
    return {ok: !errors.length, errors, count};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
    const r = run();
    if (r.ok) {console.log(`textures.json：${r.count}`);}
    else {r.errors.forEach(e => console.error('✘ ' + e)); process.exit(1);}
}
