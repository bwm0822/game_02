// 地圖分頁改 Tiled 地圖（角色物件、@群組圖層）跟 story.json 的 spawns：讀硬碟上的檔 → 改 → 寫回（地圖照 Tiled 排版）；每次寫回傳前後全文給 undo
// 位置一律用「站的格子」：root＝有大小的物件左下角那一格的中心、點物件＝點本身（同 mapcheck.js 的 placeOf），換算回 Tiled 的 x/y 看物件格式（template 的圖塊物件／點物件）
import * as FS from '../common/fs.js';
import {stringify, eolOf} from '../common/tiledjson.js';
import {resolveObject} from '../../src/data/navgrid.js';

export const ROLES_LAYER = 'roles';
const file = (name) => `maps/${name}.json`;

export const mapFile = file;
// 地圖照 Tiled 排版，其他 json（story.json）同 doc.js 的 2 格縮排
const serialize = (rel, data, before) => (rel.startsWith('maps/') ? stringify(data, eolOf(before)) : JSON.stringify(data, null, 2));
const readRel = async (assets, rel) => {const {dir, file: fh} = await FS.resolveFile(assets, rel); return {dir, name: fh.name, text: await (await fh.getFile()).text()};};

// 一次改好幾個檔（相對 assets 的路徑）：fn({rel: data}) 改；回傳 false＝不寫；throw Error＝不寫、訊息給呼叫端
// 全部改好才一起寫；寫了回傳 [{rel, before, after}]（有變的檔，全文），都沒變回傳 null
export async function editFiles(assets, rels, fn)
{
    const src = {};
    for (const rel of rels) src[rel] = await readRel(assets, rel);
    const data = Object.fromEntries(rels.map(rel => [rel, JSON.parse(src[rel].text)]));
    if (fn(data) === false) return null;
    const out = rels.map(rel => ({rel, before: src[rel].text, after: serialize(rel, data[rel], src[rel].text)})).filter(f => f.after !== f.before);
    if (!out.length) return null;
    for (const f of out) await FS.writeFile(src[f.rel].dir, src[f.rel].name, new Blob([f.after]));
    return out;
}

// 只改一張地圖：fn(data)
export const editMap = (assets, name, fn) => editFiles(assets, [file(name)], d => fn(d[file(name)]));

// undo／redo：每個檔現在都要等於 expect（不然是別處改過，不蓋）才全部寫回 text；files：[{rel, expect, text}]
export async function restore(assets, files)
{
    const src = {};
    for (const f of files)
    {
        src[f.rel] = await readRel(assets, f.rel);
        if (src[f.rel].text !== f.expect) throw new Error(`${f.rel} 之後在別處改過了，不能復原這一步`);
    }
    for (const f of files) await FS.writeFile(src[f.rel].dir, src[f.rel].name, new Blob([f.text]));
}

// ---------- @群組 ----------
// 加一個空的 @群組 物件層（接在最後）
export function addGroupLayer(data, g)
{
    if (data.layers.some(l => l.name === `@${g}`)) throw new Error(`已經有 @${g} 圖層`);
    data.layers.push({draworder: 'topdown', id: data.nextlayerid, name: `@${g}`, objects: [], opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0});
    data.nextlayerid++;
}

export function renameGroupLayer(data, from, to)
{
    const l = data.layers.find(x => x.name === `@${from}`);
    if (!l) return false;
    l.name = `@${to}`;
}

export function deleteGroupLayer(data, g)
{
    const i = data.layers.findIndex(x => x.name === `@${g}`);
    if (i < 0) throw new Error(`沒有 @${g} 圖層`);
    data.layers.splice(i, 1);
}

// story.json 的 spawns：改 key 保留順序
export function renameKey(obj, from, to)
{
    const e = Object.entries(obj);
    for (const k of Object.keys(obj)) delete obj[k];
    for (const [k, v] of e) obj[k === from ? to : k] = v;
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
    const c = tileC(data, tile), tw = data.tilewidth, th = data.tileheight;
    if (tpl && (tpl.object.width ?? 0) > 0)
    {
        const hh = tpl.object.height ?? 0;
        return {id, template: relFromMap(mapName, tpl.path), x: c.x - tw / 2, y: tpl.object.gid != null ? c.y + th / 2 : c.y + th / 2 - hh};
    }
    if (tpl) return {id, template: relFromMap(mapName, tpl.path), x: c.x, y: c.y};
    return {height: 0, id, name: '', point: true, properties: [{name: 'id', type: 'string', value: rid}],
        rotation: 0, type: 'npc', visible: true, width: 0, x: c.x, y: c.y};
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
