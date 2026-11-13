// 作息 point 改 Tiled 地圖（新增／移動／刪除只動 point，改名 point 跟門都能、連帶改別張圖指過來的門；角色分頁的作息地圖跟地圖分頁共用）：讀硬碟上的地圖 json → 改 → 照 Tiled 排版寫回（tiledjson.js）
// 另外看路網是不是過期：地圖檔比 navgraph.json 新；過期橫幅、「更新路網」
import * as FS from './fs.js';
import {h} from './dom.js';
import {stringify, eolOf} from './tiledjson.js';
import {loadMap} from '../../src/data/navgrid.js';
import {isPortObj} from '../../src/data/mapcheck.js';

const file = (name) => `maps/${name}.json`;

const isPointRaw = (o) => o.type === 'point' || /(^|\/)point\.tj$/.test(o.template ?? '');

// fn(data) 改 data；回傳 false＝不寫；throw Error＝不寫、訊息給呼叫端
export async function editMap(assets, name, fn)
{
    return await editMaps(assets, [name], d => fn(d[name])) !== false;
}

// 好幾張圖一起改：fn({地圖: data})；全部改好才一起寫，回傳有變的地圖名（都沒變＝[]、fn 回 false＝false）
export async function editMaps(assets, names, fn)
{
    const src = {};
    for (const n of names)
    {
        const {dir, file: fh} = await FS.resolveFile(assets, file(n));
        src[n] = {dir, name: fh.name, text: await (await fh.getFile()).text()};
    }
    const data = Object.fromEntries(names.map(n => [n, JSON.parse(src[n].text)]));
    if (fn(data) === false) return false;
    const out = [];
    for (const n of names)
    {
        const text = stringify(data[n], eolOf(src[n].text));
        if (text === src[n].text) continue;
        await FS.writeFile(src[n].dir, src[n].name, new Blob([text]));
        out.push(n);
    }
    return out;
}

// maps/ 底下所有地圖（_ 開頭、. 開頭的資料夾不算）
export async function listMaps(assets)
{
    const out = [];
    const walk = async (dir, pre) => {
        const {dirs, files} = await FS.listDir(dir);
        for (const f of files) if (f.name.endsWith('.json') && !f.name.startsWith('_')) out.push(pre + f.name.slice(0, -5));
        for (const d of dirs) if (!d.name.startsWith('_') && !d.name.startsWith('.')) await walk(d, `${pre}${d.name}/`);
    };
    const maps = await FS.tryDir(assets, 'maps');
    if (maps) await walk(maps, '');
    return out.sort();
}

// 讀專案資料夾的 json（相對 assets），讀不到＝null
export const readerOf = (assets) => async (rel) => {
    try {return JSON.parse(await (await (await FS.resolveFile(assets, rel)).file.getFile()).text());}
    catch {return null;}
};

// 門的 port 指到 mapName:pname 的（落腳點）：portsOf(地圖)＝那張圖的門（已套 template）→ [{map, id, name}]
export async function portsTo(maps, portsOf, mapName, pname)
{
    const out = [];
    for (const m of maps)
        for (const o of await portsOf(m) ?? [])
            if (String(o.props.map) === mapName && String(o.props.port ?? '') === pname) out.push({map: m, id: o.id, name: o.name});
    return out;
}

// portsOf 讀硬碟（角色分頁用；地圖分頁有徽章算好的）
export const portsReader = (assets) => {
    const read = readerOf(assets);
    return async (m) => (await loadMap(m, read))?.objs.filter(isPortObj) ?? null;
};

export const portsText = (refs) => refs.map(r => `${r.map} 的門 ${r.name || `#${r.id}`}`).join('、');

const objects = (data) => data.layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
const byName = (data, name) => objects(data).find(o => o.name === name);

// 從地圖所在資料夾到 assets/templates/point.tj 的相對路徑（同 Tiled 存的寫法）
const pointTpl = (name) => `${'../'.repeat(file(name).split('/').length - 1)}templates/point.tj`;

// 新增 point：放進已經有 point 的物件層，沒有就第一個物件層；x/y 是格子左上角
export function addPoint(data, mapName, pname, x, y)
{
    if (byName(data, pname)) throw new Error(`${mapName} 已經有 ${pname}`);
    const groups = data.layers.filter(l => l.type === 'objectgroup');
    const layer = groups.find(l => l.objects.some(isPointRaw)) ?? groups[0];
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

// 具名物件（point、門…）改名：get(地圖)＝那張圖的 data；refs＝portsTo() 找到的門，port 一起改
export function renameNamed(get, mapName, from, to, refs = [])
{
    const data = get(mapName);
    if (byName(data, to)) throw new Error(`${mapName} 已經有 ${to}`);
    const o = byName(data, from);
    if (!o) throw new Error(`找不到 ${from}`);
    o.name = to;
    for (const r of refs)
    {
        const d = objects(get(r.map)).find(x => x.id === r.id);
        if (!d) throw new Error(`${r.map} 找不到門 #${r.id}`);
        setStrProp(d, 'port', to);
    }
}

// 同 Tiled：properties 照名稱排
function setStrProp(o, name, value)
{
    const ps = o.properties ?? [];
    const p = ps.find(x => x.name === name);
    if (p) p.value = value;
    else o.properties = [...ps, {name, type: 'string', value}].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
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

export const usersText = (users) => users.map(u => `${u.id} 第 ${u.i + 1} 筆`).join('、');

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

// 重跑 scripts/navgraph.js（vite dev 的 POST /__tools/navgraph）：{ok, msg（第一行是摘要，後面是警告）}
export async function updateNavgraph()
{
    let r;
    try {r = await (await fetch('/__tools/navgraph', {method: 'POST'})).json();}
    catch (e) {r = {ok: false, errors: [e.message]};}
    const msg = r.ok ? `路網已更新：${r.count} 個節點${r.warns.length ? `，${r.warns.length} 個警告\n${r.warns.join('\n')}` : ''}` : `路網更新失敗：${(r.errors ?? []).join('；')}`;
    return {ok: !!r.ok, msg};
}

const shortMap = (m) => m.split('/').at(-1);

// 路網過期橫幅（沒過期回傳 []）＋上次更新的結果：stale＝過期的地圖、atStale＝還沒進路網的作息格子數
export function navBanner({stale = null, atStale = 0, onUpdate = null, navMsg = ''})
{
    const why = [stale?.length > 0 && `${stale.map(m => `${shortMap(m)}.json`).join('、')} 比 navgraph.json 新`, atStale > 0 && `${atStale} 個作息格子還沒進路網`].filter(Boolean);
    return [why.length > 0 && h('div', {class: 'stale navstale', title: '遊戲的 NPC 照 navgraph.json 走；地圖或作息格子改了沒更新，遊戲裡找不到新的點、時間也不準（工具裡的時刻表先用臨時算的）'},
        `⚠ 路網已過期（${why.join('；')}）`,
        onUpdate && h('button', {type: 'button', class: 'navupd', onclick: onUpdate}, '更新路網')),
    navMsg && h('div', {class: 'navmsg dim'}, navMsg)].filter(Boolean);
}
