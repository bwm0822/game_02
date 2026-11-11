// 作息地圖改 Tiled 地圖（只動 point）：讀硬碟上的地圖 json → 改 → 照 Tiled 排版寫回（tools/common/tiledjson.js）
// 另外看路網是不是過期：地圖檔比 navgraph.json 新
import * as FS from '../common/fs.js';
import {stringify, eolOf} from '../common/tiledjson.js';

const file = (name) => `maps/${name}.json`;

// fn(data) 改 data；回傳 false＝不寫；throw Error＝不寫、訊息給呼叫端
export async function editMap(assets, name, fn)
{
    const {dir, file: fh} = await FS.resolveFile(assets, file(name));
    const text = await (await fh.getFile()).text();
    const data = JSON.parse(text);
    if (fn(data) === false) return false;
    await FS.writeFile(dir, fh.name, new Blob([stringify(data, eolOf(text))]));
    return true;
}

const objects = (data) => data.layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
const byName = (data, name) => objects(data).find(o => o.name === name);

// 從地圖所在資料夾到 assets/templates/point.tj 的相對路徑（同 Tiled 存的寫法）
const pointTpl = (name) => `${'../'.repeat(file(name).split('/').length - 1)}templates/point.tj`;

// 新增 point：放進已經有 point 的物件層（isPoint(raw) 判斷），沒有就第一個物件層；x/y 是格子左上角
export function addPoint(data, mapName, pname, x, y, isPoint)
{
    if (byName(data, pname)) throw new Error(`${mapName} 已經有 ${pname}`);
    const groups = data.layers.filter(l => l.type === 'objectgroup');
    const layer = groups.find(l => l.objects.some(isPoint)) ?? groups[0];
    if (!layer) throw new Error(`${mapName} 沒有物件層`);
    layer.objects.push({id: data.nextobjectid, name: pname, template: pointTpl(mapName), x, y});
    data.nextobjectid++;
}

export function movePoint(data, pname, x, y)
{
    const o = byName(data, pname);
    if (!o) throw new Error(`找不到 ${pname}`);
    if (o.x === x && o.y === y) return false;
    Object.assign(o, {x, y});
}

export function renamePoint(data, mapName, from, to)
{
    if (byName(data, to)) throw new Error(`${mapName} 已經有 ${to}`);
    const o = byName(data, from);
    if (!o) throw new Error(`找不到 ${from}`);
    o.name = to;
}

export function deletePoint(data, pname)
{
    for (const l of data.layers.filter(l => l.type === 'objectgroup'))
    {
        const i = l.objects.findIndex(o => o.name === pname);
        if (i >= 0) {l.objects.splice(i, 1); return;}
    }
    throw new Error(`找不到 ${pname}`);
}

// 角色作息裡用到 map:pname 的（go 或巡邏 route）：[{id, i}]
export function usersOf(roles, mapName, pname)
{
    const out = [];
    for (const [id, r] of Object.entries(roles))
    {
        (Array.isArray(r.schedule) ? r.schedule : []).forEach((s, i) => {
            if (s.map === mapName && (s.go === pname || s.route?.includes(pname))) out.push({id, i});
        });
    }
    return out;
}

export function renameRefs(roles, mapName, from, to)
{
    for (const r of Object.values(roles))
    {
        for (const s of Array.isArray(r.schedule) ? r.schedule : [])
        {
            if (s.map !== mapName) continue;
            if (s.go === from) s.go = to;
            if (Array.isArray(s.route)) s.route = s.route.map(p => (p === from ? to : p));
        }
    }
}

// 比 navgraph.json 新的地圖檔（maps＝要看的地圖名）；讀不到 navgraph.json 回傳 null
export async function staleMaps(assets, maps)
{
    let nav;
    try {nav = (await (await FS.resolveFile(assets, 'json/navgraph.json')).file.getFile()).lastModified;}
    catch {return null;}
    const out = [];
    for (const m of maps)
    {
        try {if ((await (await FS.resolveFile(assets, file(m))).file.getFile()).lastModified > nav) out.push(m);}
        catch {}
    }
    return out;
}
