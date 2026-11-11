// 地圖（maps/**/*.json）跟 template（templates/**/*.tj）裡指到某個角色 id 的地方：物件自己的屬性 id、template 的屬性 id（用那個 template 的地圖列出來）
// 角色分頁改名時連帶改（地圖照 Tiled 排版寫回、template 只換那個值），刪除時有人用就擋
import * as FS from './fs.js';
import {stringify, eolOf} from './tiledjson.js';
import {joinPath} from '../../src/data/navgrid.js';

async function walk(dir, pre, ext, out = [])
{
    const {dirs, files} = await FS.listDir(dir);
    for (const f of files) if (f.name.endsWith(ext) && !f.name.startsWith('_')) out.push({rel: `${pre}${f.name}`, fh: f});
    for (const d of dirs) if (!d.name.startsWith('_') && !d.name.startsWith('.')) await walk(d, `${pre}${d.name}/`, ext, out);
    return out;
}
const dirOf = (p) => p.slice(0, p.lastIndexOf('/'));
const idProp = (o) => o?.properties?.find(p => p.name === 'id');
const objects = (map) => (map.layers ?? []).filter(l => l.type === 'objectgroup').flatMap(l => l.objects);

// → {maps: [{rel, oids}]（物件自己寫 id 的）, tpls: [{rel, maps: [rel]}]}（相對 public/assets）
export async function roleRefs(assets, rid)
{
    const tpls = new Map();
    const td = await FS.tryDir(assets, 'templates');
    for (const f of td ? await walk(td, 'templates/', '.tj') : [])
    {
        try {if (String(idProp(JSON.parse(await (await f.fh.getFile()).text()).object)?.value) === rid) tpls.set(f.rel, []);}
        catch {}
    }
    const maps = [];
    const md = await FS.tryDir(assets, 'maps');
    for (const f of md ? await walk(md, 'maps/', '.json') : [])
    {
        let map;
        try {map = JSON.parse(await (await f.fh.getFile()).text());} catch {continue;}
        const oids = [];
        for (const o of objects(map))
        {
            const own = idProp(o);
            if (own) {if (String(own.value) === rid) oids.push(o.id); continue;}
            const t = o.template && joinPath(dirOf(f.rel), o.template);
            if (t && tpls.has(t) && !tpls.get(t).includes(f.rel)) tpls.get(t).push(f.rel);
        }
        if (oids.length) maps.push({rel: f.rel, oids});
    }
    return {maps, tpls: [...tpls].map(([rel, m]) => ({rel, maps: m}))};
}

export const refLines = (refs) => [
    ...refs.maps.map(m => `${m.rel}：物件 ${m.oids.join('、')}`),
    ...refs.tpls.map(t => `${t.rel}（template${t.maps.length ? `，${t.maps.join('、')} 在用` : '，沒有地圖在用'}）`),
];
export const refCount = (refs) => refs.maps.length + refs.tpls.length;

// 改名：地圖物件自己的 id、template 的 id；回傳寫了哪些檔（相對 assets）
export async function renameRoleRefs(assets, refs, from, to)
{
    const done = [];
    for (const m of refs.maps)
    {
        const {dir, file} = await FS.resolveFile(assets, m.rel);
        const text = await (await file.getFile()).text(), map = JSON.parse(text);
        for (const o of objects(map)) {const p = idProp(o); if (p && String(p.value) === from) p.value = to;}
        await FS.writeFile(dir, file.name, new Blob([stringify(map, eolOf(text))]));
        done.push(m.rel);
    }
    // template 是 Tiled 另一種排版，只換那個值、其他一字不動
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const t of refs.tpls)
    {
        const {dir, file} = await FS.resolveFile(assets, t.rel);
        const text = await (await file.getFile()).text();
        const re = new RegExp(`("name"\\s*:\\s*"id"\\s*,(?:\\s*"type"\\s*:\\s*"string"\\s*,)?\\s*"value"\\s*:\\s*)"${esc(from)}"`);
        if (!re.test(text)) throw new Error(`${t.rel} 找不到 id「${from}」`);
        await FS.writeFile(dir, file.name, new Blob([text.replace(re, `$1"${to}"`)]));
        done.push(t.rel);
    }
    return done;
}
