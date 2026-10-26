// 掃 local.json 的 key 被用在哪：src/ 的程式碼（src/old 不掃）跟 public/assets/json 的資料
//   uses：寬鬆，字串字面量或 json 的值／key 剛好等於 key 就算（算引用數、「未使用」）；動態組出來的 key 抓不到
//   needs：嚴格，明確拿來查表的寫法才算（「缺少」）：'x'.lab()／.des()、Local.lab|name|des('x')、role.json 的 job、ab_tree.json 的樹名
import * as FS from '../common/fs.js';

const SKIP_JSON = ['local.json', 'textures.json', 'navgraph.json'];
const LIT = /(['"`])([\w-]+)\1/g;
const NEED = [/(['"`])([\w-]+)\1\.(?:lab|des)\(/g, /Local\.(?:lab|name|des)\((['"`])([\w-]+)\1/g];

async function walk(dir, path, fn)
{
    for await (const fh of dir.values())
    {
        const p = `${path}/${fh.name}`;
        if (fh.kind === 'directory') {if (p !== 'src/old') await walk(fh, p, fn);}
        else await fn(fh, p);
    }
}

const add = (map, key, loc) => {const a = map.get(key) ?? []; a.push(loc); map.set(key, a);};

// assets: doc.js 的 S.assets（{dir, json, root}）；沒有專案根目錄（測試直接給 public/assets）就不掃 src
export async function scan(assets)
{
    const uses = new Map(), needs = new Map();
    const src = assets.root && await FS.tryDir(assets.root, 'src');
    if (src) await walk(src, 'src', async (fh, p) => {
        if (!fh.name.endsWith('.js')) return;
        (await (await fh.getFile()).text()).split('\n').forEach((line, i) => {
            const t = line.trim();
            if (t.startsWith('//')) return;
            const loc = `${p} ${i + 1} 行：${t.slice(0, 80)}`;
            for (const m of line.matchAll(LIT)) add(uses, m[2], loc);
            for (const re of NEED) for (const m of line.matchAll(re)) add(needs, m[2], loc);
        });
    });

    const json = {};
    for await (const fh of assets.json.values())
    {
        if (fh.kind !== 'file' || !fh.name.endsWith('.json') || SKIP_JSON.includes(fh.name)) continue;
        try {json[fh.name] = JSON.parse(await (await fh.getFile()).text());} catch {}
    }
    for (const [file, data] of Object.entries(json))
    {
        const visit = (v, at) => {
            if (typeof v === 'string') add(uses, v, `${file}：${at}`);
            else if (v && typeof v === 'object')
                for (const [k, c] of Object.entries(v))
                {
                    const sub = at ? `${at}.${k}` : k;
                    if (!Array.isArray(v)) add(uses, k, `${file}：${sub}（key）`);
                    visit(c, sub);
                }
        };
        visit(data, '');
    }
    for (const [id, r] of Object.entries(json['role.json'] ?? {})) if (r?.job) add(needs, r.job, `role.json：${id}.job`);
    for (const t of Object.keys(json['ab_tree.json'] ?? {})) add(needs, t, `ab_tree.json：${t}（樹名）`);
    return {uses, needs, scanned: !!src};
}
