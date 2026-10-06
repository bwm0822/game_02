import fs from 'fs';
import path from 'path';
import {astar, Graph} from '../src/core/astar.js';

// 產生 NPC 作息用的跨地圖路網 public/assets/json/navgraph.json
// 節點 = 每張地圖的具名物件("地圖:名稱")，邊 = 同圖內節點間的步數(walk) + port 連到別張圖的對應物件(port)
// 地圖從 main.world 列的地圖出發，沿著 port 的 map 屬性找出所有室內地圖
// 改了 Tiled 地圖(物件位置、名稱、port 目標)之後要重跑

const ASSETS = './public/assets';
const MAPS = `${ASSETS}/maps`;
const OUT = `${ASSETS}/json/navgraph.json`;

const W_BLOCK = 1000;       // 同 GM.W.BLOCK
const W_ITEM = 1000;        // 同 View 預設 weight
const W_DOOR = 20;          // 同 GM.W.DOOR
const PORT_COST = 1;        // 過門/樓梯花 1 分鐘(同 COM_Port._enter 的 TimeSystem.inc())

const readJson = (p)=>JSON.parse(fs.readFileSync(p,'utf-8'));
const num = (v)=>v==null||v==='' ? null : Number(v);

// Tiled 物件：套用 template，回傳 {name,type,gid,x,y,width,height,props}
function resolveObject(obj, mapDir)
{
    let base = {};
    if(obj.template) {base = readJson(path.resolve(mapDir, obj.template)).object;}
    const props = {};
    for(const p of base.properties??[]) {props[p.name]=p.value;}
    for(const p of obj.properties??[]) {props[p.name]=p.value;}
    return {
        name: obj.name || base.name || '',
        type: obj.type || obj.class || base.type || base.class || '',
        gid: obj.gid ?? base.gid,
        x: obj.x, y: obj.y,
        width: obj.width ?? base.width ?? 0,
        height: obj.height ?? base.height ?? 0,
        props,
    };
}

// 同 View._resolveAxis()
function resolveAxis(a, b, size, total)
{
    if(a!=null && b!=null) {}
    else if(a!=null) {b = (size!=null) ? total-a-size : 0;}
    else if(b!=null) {a = (size!=null) ? total-b-size : 0;}
    else {b = 0; a = (size!=null) ? total-b-size : 0;}
    return {a, size:total-a-b};
}

// 依 Phaser createFromObjects + View(_addGrid/_setAnchor) 的規則，算出物件在世界座標的各個位置
function placeObject(o)
{
    const w = o.width, h = o.height, p = o.props;
    // Phaser 把物件放在視覺中心(Tiled 的 tile 物件以左下為原點，其他以左上)
    const cen = {x:o.x + w/2, y:o.gid ? o.y - h/2 : o.y + h/2};

    const gh = resolveAxis(num(p.gl), num(p.gr), num(p.gw), w);
    const gv = resolveAxis(num(p.gt), num(p.gb), num(p.gh), h);
    const grid = {w:gh.size, h:gv.size};
    const posG = {x:cen.x - w/2 + gh.a + gh.size/2, y:cen.y - h/2 + gv.a + gv.size/2};

    let ax = num(p.anchorX) ?? 0, ay = num(p.anchorY) ?? 0;
    if(p.al!=null) {ax = -w/2 + num(p.al);} else if(p.ar!=null) {ax = w/2 - num(p.ar);}
    if(p.at!=null) {ay = -h/2 + num(p.at);} else if(p.ab!=null) {ay = h/2 - num(p.ab);}
    const pos = {x:cen.x + ax, y:cen.y + ay};

    const pts = p.json_pts ? JSON.parse(p.json_pts).map(d=>({x:pos.x+d.x, y:pos.y+d.y})) : [posG];
    return {posG, grid, pts};
}

function objectWeight(o)
{
    if(o.type==='door') {return W_DOOR;}    // 關著的門 NPC 撞到會打開(COM_Door)，路網當成可通行
    if(o.props.weight!=null) {return num(o.props.weight);}
    if(o.type==='point' || o.type==='pickup' || o.type==='npc') {return 0;}
    return W_ITEM;
}

function loadTileProps(map, mapDir)
{
    const lut = [];     // gid -> {collide, weight}
    for(const ts of map.tilesets)
    {
        const tsj = ts.source ? readJson(path.resolve(mapDir, ts.source)) : ts;
        for(const t of tsj.tiles??[])
        {
            if(!t.properties) {continue;}
            const pr = Object.fromEntries(t.properties.map(p=>[p.name,p.value]));
            lut[ts.firstgid + t.id] = pr;
        }
    }
    return lut;
}

function decodeLayer(layer)
{
    if(Array.isArray(layer.data)) {return layer.data;}
    if(layer.encoding==='base64' && !layer.compression)
    {
        const buf = Buffer.from(layer.data, 'base64');
        const out = [];
        for(let i=0;i<buf.length;i+=4) {out.push(buf.readUInt32LE(i) & 0x1fffffff);}
        return out;
    }
    throw new Error(`不支援的 tile layer 編碼：${layer.name} ${layer.encoding}/${layer.compression}`);
}

// 同 Map._createGraph() + 物件登記的 weight(Map.updateGrid/gridTiles)
function buildGrid(map, mapDir, objs)
{
    const cols = map.width, rows = map.height, tw = map.tilewidth, th = map.tileheight;
    const grid = Array.from({length:rows}, ()=>new Array(cols).fill(1));
    const lut = loadTileProps(map, mapDir);

    for(const layer of map.layers)
    {
        if(layer.type!=='tilelayer') {continue;}
        decodeLayer(layer).forEach((gid,i)=>{
            const p = lut[gid];
            if(!p) {return;}
            const tx = i % cols, ty = Math.floor(i / cols);
            if(p.collide) {grid[ty][tx]=0;}
            else if(p.weight!=null) {grid[ty][tx]=p.weight;}
        });
    }

    const toTile = (x,y)=>[Math.floor(x/tw), Math.floor(y/th)];
    for(const o of objs)
    {
        const wei = objectWeight(o);
        if(!wei) {continue;}
        const {posG, grid:g} = placeObject(o);
        let tiles;
        if(g.w>tw || g.h>th)
        {
            const w2 = Math.floor(g.w/2)-2, h2 = Math.floor(g.h/2)-2;
            const [x0,y0] = toTile(posG.x-w2, posG.y-h2);
            const [x1,y1] = toTile(posG.x+w2, posG.y+h2);
            tiles = [];
            for(let tx=x0;tx<=x1;tx++) {for(let ty=y0;ty<=y1;ty++) {tiles.push([tx,ty]);}}
        }
        else {tiles = [toTile(posG.x, posG.y)];}
        for(const [tx,ty] of tiles)
        {
            if(tx<0||tx>=cols||ty<0||ty>=rows) {continue;}
            grid[ty][tx] += wei;
        }
    }

    // A* 只把 0 當牆，這裡把 BLOCK 以上(物件佔住的格子)也當牆
    return grid.map(row=>row.map(w=>w<=0||w>=W_BLOCK ? 0 : w));
}

// 從 sp 到 eps 任一點的最少步數；起訖點本身就算被物件佔住也允許站上去
function steps(grid, sp, eps)
{
    let best = Infinity;
    for(const ep of eps)
    {
        if(sp[0]===ep[0] && sp[1]===ep[1]) {return 0;}
        const g = grid.map(r=>r.slice());
        g[sp[1]][sp[0]] = g[sp[1]][sp[0]] || 1;
        g[ep[1]][ep[0]] = g[ep[1]][ep[0]] || 1;
        const graph = new Graph(g, {diagonal:true});
        const res = astar.search(graph, graph.grid[sp[1]][sp[0]], graph.grid[ep[1]][ep[0]]);
        if(res.length>0 && res.length<best) {best = res.length;}
    }
    return best;
}

function loadMap(mapName)
{
    const file = path.join(MAPS, `${mapName}.json`);
    if(!fs.existsSync(file)) {return null;}
    const map = readJson(file);
    const mapDir = path.dirname(file);
    const objs = map.layers
        .filter(l=>l.type==='objectgroup')
        .flatMap(l=>l.objects.map(o=>resolveObject(o, mapDir)));
    return {map, mapDir, objs};
}

function main()
{
    const world = readJson(`${MAPS}/main.world`);
    const queue = world.maps.map(m=>m.fileName.replace(/\.json$/,''));
    const seen = new Set();
    const nodes = {};
    const edges = {};
    const addEdge = (from,to,cost,type)=>{(edges[from] ??= []).push({to,cost,type});};
    let warn = 0;

    while(queue.length)
    {
        const mapName = queue.shift();
        if(seen.has(mapName)) {continue;}
        seen.add(mapName);

        const loaded = loadMap(mapName);
        if(!loaded) {console.warn(`WARN 找不到地圖 ${mapName}`); warn++; continue;}
        const {map, mapDir, objs} = loaded;
        const grid = buildGrid(map, mapDir, objs);
        const toTile = (p)=>[
            Math.min(map.width-1, Math.max(0, Math.floor(p.x/map.tilewidth))),
            Math.min(map.height-1, Math.max(0, Math.floor(p.y/map.tileheight)))];

        const named = {};
        for(const o of objs)
        {
            if(!o.name || o.type==='npc') {continue;}
            if(named[o.name]) {console.warn(`WARN ${mapName} 有重複的名字 "${o.name}"，只取最後一個`); warn++;}
            named[o.name] = o;
        }

        const keys = [];
        for(const [name,o] of Object.entries(named))
        {
            const key = `${mapName}:${name}`;
            keys.push(key);
            nodes[key] = {tiles: placeObject(o).pts.map(toTile)};

            if(o.props.map && o.props.port)
            {
                addEdge(key, `${o.props.map}:${o.props.port}`, PORT_COST, 'port');
                queue.push(o.props.map);
            }
        }

        for(let i=0;i<keys.length;i++)
        {
            for(let j=i+1;j<keys.length;j++)
            {
                const a = nodes[keys[i]].tiles, b = nodes[keys[j]].tiles;
                const cost = Math.min(...a.map(sp=>steps(grid, sp, b)));
                if(cost===Infinity) {continue;}
                addEdge(keys[i], keys[j], cost, 'walk');
                addEdge(keys[j], keys[i], cost, 'walk');
            }
        }
        if(keys.length) {console.log(`OK   ${mapName} (${keys.length} 個節點)`);}
    }

    for(const [from,list] of Object.entries(edges))
    {
        for(const e of list)
        {
            if(e.type==='port' && !nodes[e.to]) {console.warn(`WARN ${from} 的 port 指向不存在的 ${e.to}`); warn++;}
        }
    }

    // 作息的目的地一定要在路網裡
    const roles = readJson(`${ASSETS}/json/role.json`);
    for(const [id,role] of Object.entries(roles))
    {
        for(const sh of role.schedule??[])
        {
            if(sh.go==null) {continue;}
            const key = `${sh.map}:${sh.go}`;
            if(!nodes[key]) {console.warn(`WARN 角色 ${id} 的作息目的地 ${key} 不在路網裡`); warn++;}
        }
    }

    for(const n of Object.values(nodes)) {delete n.tiles;}
    fs.writeFileSync(OUT, JSON.stringify({nodes, edges}, null, 2), 'utf-8');
    console.log(`\n完成：${Object.keys(nodes).length} 個節點，${warn} 個警告 -> ${OUT}`);
}

main();
