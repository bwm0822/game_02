import fs from 'fs';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';
import {loadMap, buildGrid, objectTiles, bestPath} from '../src/data/navgrid.js';
import {atName, parseAt, schKey} from '../src/data/schedplan.js';

// 產生 NPC 作息用的跨地圖路網 public/assets/json/navgraph.json
// 節點 = 每張地圖的具名物件("地圖:名稱")，邊 = 同圖內節點間的步數(walk) + port 連到別張圖的對應物件(port)
// 地圖從 main.world 列的地圖出發，沿著 port 的 map 屬性找出所有室內地圖
// 改了 Tiled 地圖(物件位置、名稱、port 目標)之後要重跑；格子權重／A* 在 src/data/navgrid.js（角色分頁作息地圖共用）

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets');
const PORT_COST = 1;        // 過門/樓梯花 1 分鐘(同 COM_Port._enter 的 TimeSystem.inc())

const readJson = (rel)=>{
    const p = path.join(ASSETS, rel);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p,'utf-8')) : null;
};

// 回傳 {ok, warns, count}；log＝逐張地圖印 OK
export async function run({log = ()=>{}} = {})
{
    const world = readJson('maps/main.world');
    const queue = world.maps.map(m=>m.fileName.replace(/\.json$/,''));
    const seen = new Set();
    const nodes = {};
    const edges = {};
    const addEdge = (from,to,cost,type)=>{(edges[from] ??= []).push({to,cost,type});};
    const warns = [];
    const roles = readJson('json/role.json');

    // 作息用到的格子目的地 at:[tx,ty]，照地圖收集，當成那張圖的節點 "地圖:@tx,ty"
    const ats = {};
    for(const role of Object.values(roles))
    {
        for(const sh of role.schedule??[]) {if(sh.at && sh.map) {(ats[sh.map] ??= new Set()).add(atName(sh.at));}}
    }

    while(queue.length)
    {
        const mapName = queue.shift();
        if(seen.has(mapName)) {continue;}
        seen.add(mapName);

        const loaded = await loadMap(mapName, readJson);
        if(!loaded) {warns.push(`找不到地圖 ${mapName}`); continue;}
        const {map, tilesets, objs} = loaded;
        const grid = buildGrid(map, tilesets, objs);

        const named = {};
        for(const o of objs)
        {
            if(!o.name || o.type==='npc') {continue;}
            if(named[o.name]) {warns.push(`${mapName} 有重複的名字 "${o.name}"，只取最後一個`);}
            named[o.name] = o;
        }

        const keys = [];
        for(const [name,o] of Object.entries(named))
        {
            const key = `${mapName}:${name}`;
            keys.push(key);
            nodes[key] = {tiles: objectTiles(map, o)};

            if(o.props.map && o.props.port)
            {
                addEdge(key, `${o.props.map}:${o.props.port}`, PORT_COST, 'port');
                queue.push(o.props.map);
            }
        }
        for(const name of ats[mapName] ?? [])
        {
            const [tx,ty] = parseAt(name);
            if(tx<0 || ty<0 || tx>=map.width || ty>=map.height) {warns.push(`${mapName}:${name} 在地圖外`); continue;}
            const key = `${mapName}:${name}`;
            keys.push(key);
            nodes[key] = {tiles: [[tx,ty]]};
        }

        for(let i=0;i<keys.length;i++)
        {
            for(let j=i+1;j<keys.length;j++)
            {
                const a = nodes[keys[i]].tiles, b = nodes[keys[j]].tiles;
                const cost = Math.min(...a.map(sp=>bestPath(grid, sp, b)?.length ?? Infinity));
                if(cost===Infinity) {continue;}
                addEdge(keys[i], keys[j], cost, 'walk');
                addEdge(keys[j], keys[i], cost, 'walk');
            }
        }
        if(keys.length) {log(`OK   ${mapName} (${keys.length} 個節點)`);}
    }

    for(const [from,list] of Object.entries(edges))
    {
        for(const e of list)
        {
            if(e.type==='port' && !nodes[e.to]) {warns.push(`${from} 的 port 指向不存在的 ${e.to}`);}
        }
    }

    // 作息的目的地一定要在路網裡
    for(const [id,role] of Object.entries(roles))
    {
        for(const sh of role.schedule??[])
        {
            if(sh.go==null && !sh.at) {continue;}
            const key = schKey(sh);
            if(!nodes[key]) {warns.push(`角色 ${id} 的作息目的地 ${key} 不在路網裡`);}
            if(sh.do==='patrol' && !sh.route?.length) {warns.push(`角色 ${id} 的巡邏沒有 route`);}
            for(const name of sh.route??[])
            {
                if(!nodes[`${sh.map}:${name}`]) {warns.push(`角色 ${id} 的巡邏路點 ${sh.map}:${name} 不在路網裡`);}
            }
        }
    }

    for(const n of Object.values(nodes)) {delete n.tiles;}
    fs.writeFileSync(path.join(ASSETS, 'json/navgraph.json'), JSON.stringify({nodes, edges}, null, 2), 'utf-8');
    return {ok: true, warns, count: Object.keys(nodes).length};
}

if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
{
    const r = await run({log: console.log});
    for(const w of r.warns) {console.warn(`WARN ${w}`);}
    console.log(`\n完成：${r.count} 個節點，${r.warns.length} 個警告 -> public/assets/json/navgraph.json`);
}
