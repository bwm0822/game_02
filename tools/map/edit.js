// 地圖分頁改 Tiled 地圖（只動角色物件）：讀硬碟上的地圖 json → 改 → 照 Tiled 排版寫回；每次寫回傳前後全文給 undo
// 位置一律用「站的格子」：root＝物件中心＋role.anchor（同 roles.js 的 placeOf），換算回 Tiled 的 x/y 看物件格式（template 的圖塊物件／點物件）
import * as FS from '../common/fs.js';
import {stringify, eolOf} from '../common/tiledjson.js';
import {resolveObject} from '../../src/data/navgrid.js';

export const ROLES_LAYER = 'roles';
const file = (name) => `maps/${name}.json`;

// fn(data) 改 data；回傳 false＝不寫；throw Error＝不寫、訊息給呼叫端；寫了回傳 {before, after}（全文）
export async function editMap(assets, name, fn)
{
    const {dir, file: fh} = await FS.resolveFile(assets, file(name));
    const before = await (await fh.getFile()).text();
    const data = JSON.parse(before);
    if (fn(data) === false) return null;
    const after = stringify(data, eolOf(before));
    if (after === before) return null;
    await FS.writeFile(dir, fh.name, new Blob([after]));
    return {before, after};
}

// undo／redo：現在的檔案要等於 expect（不然是別處改過，不蓋）才寫回 text
export async function restore(assets, name, expect, text)
{
    const {dir, file: fh} = await FS.resolveFile(assets, file(name));
    const now = await (await fh.getFile()).text();
    if (now !== expect) throw new Error(`${name} 之後在別處改過了，不能復原這一步`);
    await FS.writeFile(dir, fh.name, new Blob([text]));
}

// templates/ 底下 type npc＋屬性 id 的 template：{角色 id: {path（相對 assets）, object}}，同一個角色有好幾個取路徑排第一的
export async function scanTemplates(assets)
{
    const out = {};
    const walk = async (dir, pre) => {
        const {dirs, files} = await FS.listDir(dir);
        for (const f of files)
        {
            if (!f.name.endsWith('.tj')) continue;
            let tpl;
            try {tpl = JSON.parse(await (await f.getFile()).text());} catch {continue;}
            const o = resolveObject({}, tpl);
            const path = `${pre}${f.name}`;
            if (o.type === 'npc' && o.props.id && !(String(o.props.id) in out && out[o.props.id].path < path)) out[o.props.id] = {path, object: tpl.object};
        }
        for (const d of dirs) await walk(d, `${pre}${d.name}/`);
    };
    const dir = await FS.tryDir(assets, 'templates');
    if (dir) await walk(dir, 'templates/');
    return out;
}

// 從地圖所在資料夾到 assets 底下某個檔案的相對路徑（同 Tiled 存的寫法）
export const relFromMap = (mapName, path) => `${'../'.repeat(file(mapName).split('/').length - 1)}${path}`;

const groups = (data) => data.layers.filter(l => l.type === 'objectgroup');
export function findObj(data, id)
{
    for (const layer of groups(data))
    {
        const i = layer.objects.findIndex(o => o.id === id);
        if (i >= 0) return {layer, obj: layer.objects[i], i};
    }
    return null;
}

// 物件層：'' 或 roles＝常駐（沒有就建在最後）；@群組要已經存在
export function layerFor(data, name)
{
    const want = name || ROLES_LAYER;
    let l = groups(data).find(g => g.name === want);
    if (l) return l;
    if (want.startsWith('@')) throw new Error(`地圖沒有 ${want} 圖層`);
    l = {draworder: 'topdown', id: data.nextlayerid, name: want, objects: [], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0};
    data.nextlayerid++;
    data.layers.push(l);
    return l;
}

const tileC = (data, [tx, ty]) => ({x: tx * data.tilewidth + data.tilewidth / 2, y: ty * data.tileheight + data.tileheight / 2});

// 新角色物件：有 template 用 template（x/y 換回 Tiled 的左下／左上），沒有寫點物件
export function makeRole(data, mapName, id, rid, tile, role, tpl)
{
    const c = tileC(data, tile), ax = role?.anchor?.x ?? 0, ay = role?.anchor?.y ?? 0;
    if (tpl)
    {
        const w = tpl.object.width ?? 0, hh = tpl.object.height ?? 0;
        return {id, template: relFromMap(mapName, tpl.path), x: c.x - ax - w / 2, y: tpl.object.gid != null ? c.y - ay + hh / 2 : c.y - ay - hh / 2};
    }
    return {height: 0, id, name: '', point: true, properties: [{name: 'id', type: 'string', value: rid}],
        rotation: 0, type: 'npc', visible: true, width: 0, x: c.x - ax, y: c.y - ay};
}

export function placeRole(data, mapName, layerName, rid, tile, role, tpl)
{
    const layer = layerFor(data, layerName);
    const id = data.nextobjectid;
    layer.objects.push(makeRole(data, mapName, id, rid, tile, role, tpl));
    data.nextobjectid++;
    return id;
}

// 整格移動（dx/dy 是格數），格式不變
export function moveRole(data, id, dx, dy)
{
    const f = findObj(data, id);
    if (!f) throw new Error(`找不到物件 ${id}`);
    if (!dx && !dy) return false;
    f.obj.x += dx * data.tilewidth;
    f.obj.y += dy * data.tileheight;
}

export function deleteRole(data, id)
{
    const f = findObj(data, id);
    if (!f) throw new Error(`找不到物件 ${id}`);
    f.layer.objects.splice(f.i, 1);
}

// 換圖層：接在那層最後
export function setLayer(data, id, layerName)
{
    const f = findObj(data, id);
    if (!f) throw new Error(`找不到物件 ${id}`);
    const to = layerFor(data, layerName);
    if (to === f.layer) return false;
    f.layer.objects.splice(f.i, 1);
    to.objects.push(f.obj);
}

// 換成別的角色：站的格子不變、物件 id 不變，格式照新角色（有 template 用 template）；物件自己的其他屬性保留
export function replaceRole(data, mapName, id, rid, tile, role, tpl)
{
    const f = findObj(data, id);
    if (!f) throw new Error(`找不到物件 ${id}`);
    const keep = (f.obj.properties ?? []).filter(p => p.name !== 'id');
    const o = makeRole(data, mapName, id, rid, tile, role, tpl);
    f.layer.objects[f.i] = withProps(o, [...(tpl ? [] : o.properties), ...keep]);
}

// Tiled 物件的 key 照字母排、properties 照名稱排
const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
function withProps(o, ps)
{
    const out = {...o};
    delete out.properties;
    if (ps.length) out.properties = [...ps].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return sortKeys(out);
}

// 物件自己的屬性（不動 template 的）：value undefined＝刪掉
export function setProp(data, id, name, type, value)
{
    const f = findObj(data, id);
    if (!f) throw new Error(`找不到物件 ${id}`);
    const ps = (f.obj.properties ?? []).filter(p => p.name !== name);
    if (value !== undefined) ps.push({name, type, value});
    f.layer.objects[f.i] = withProps(f.obj, ps);
}
