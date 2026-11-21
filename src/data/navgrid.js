import {astar, Graph} from '../core/astar.js';

// 路網的格子權重＋A*：scripts/navgraph.js（node）跟角色分頁的作息地圖（瀏覽器）共用
// 規則要跟遊戲的 Map._createGraph()／View 物件登記一致；不碰 fs，讀檔由呼叫端傳 readJson(相對 assets 的路徑)

export const W_BLOCK = 1000;       // 同 GM.W.BLOCK
export const W_ITEM = 1000;        // 同 View 預設 weight
export const W_DOOR = 20;          // 同 GM.W.DOOR

const num = (v)=>v==null||v==='' ? null : Number(v);

export function joinPath(dir, rel)
{
    const out = dir ? dir.split('/') : [];
    for(const s of rel.split('/'))
    {
        if(s==='..') {out.pop();}
        else if(s && s!=='.') {out.push(s);}
    }
    return out.join('/');
}

const dirOf = (p)=>p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';

// Tiled 物件：套用 template（tpl＝template 檔的內容），回傳 {id,name,type,gid,x,y,width,height,props,raw}；raw＝地圖裡原本的物件
export function resolveObject(obj, tpl)
{
    const base = tpl?.object ?? {};
    const props = {};
    for(const p of base.properties??[]) {props[p.name]=p.value;}
    for(const p of obj.properties??[]) {props[p.name]=p.value;}
    return {
        raw: obj,
        id: obj.id,
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

// 依 Phaser createFromObjects + View(_addGrid/_setAnchor) 的規則，算出單張圖物件在世界座標的各個位置(grid 量圖片的邊，沒寫＝整張圖)
export function placeObject(o)
{
    const w = o.width, h = o.height, p = o.props;
    // Phaser 把物件放在視覺中心(Tiled 的 tile 物件以左下為原點，其他以左上)
    const cen = {x:o.x + w/2, y:o.gid ? o.y - h/2 : o.y + h/2};

    const gh = resolveAxis(num(p.gl), num(p.gr), num(p.gw), w);
    const gv = resolveAxis(num(p.gt), num(p.gb), num(p.gh), h);
    const grid = {w:gh.size, h:gv.size};
    const posG = {x:cen.x - w/2 + gh.a + gh.size/2, y:cen.y - h/2 + gv.a + gv.size/2};

    // 錨點：al/ar/at/ab 量圖片的邊，沒寫的軸＝中心(同 View._setAnchor)
    let ax = 0, ay = 0;
    if(p.al!=null) {ax = -w/2 + num(p.al);} else if(p.ar!=null) {ax = w/2 - num(p.ar);}
    if(p.at!=null) {ay = -h/2 + num(p.at);} else if(p.ab!=null) {ay = h/2 - num(p.ab);}
    const pos = {x:cen.x + ax, y:cen.y + ay};

    const pts = p.json_pts ? JSON.parse(p.json_pts).map(d=>({x:pos.x+d.x, y:pos.y+d.y})) : [posG];
    return {cen, posG, grid, pts};
}

export function objectWeight(o)
{
    if(o.type==='door') {return W_DOOR;}    // 關著的門 NPC 撞到會打開(COM_Door)，路網當成可通行
    if(o.props.weight!=null) {return num(o.props.weight);}
    if(o.type==='point' || o.type==='pickup' || o.type==='npc') {return 0;}
    return W_ITEM;
}

// tilesets＝跟 map.tilesets 對齊的 tileset 內容（外部 tsj 已讀進來）
function tileLut(map, tilesets)
{
    const lut = [];     // gid -> {collide, weight}
    map.tilesets.forEach((ts,i)=>{
        for(const t of tilesets[i].tiles??[])
        {
            if(!t.properties) {continue;}
            lut[ts.firstgid + t.id] = Object.fromEntries(t.properties.map(p=>[p.name,p.value]));
        }
    });
    return lut;
}

// flags＝true 保留翻轉旗標（高 3 bit），畫圖用
export function decodeLayer(layer, flags=false)
{
    const mask = flags ? 0xffffffff : 0x1fffffff;
    if(Array.isArray(layer.data)) {return flags ? layer.data : layer.data.map(v=>v & 0x1fffffff);}
    if(layer.encoding==='base64' && !layer.compression)
    {
        const bin = atob(layer.data);
        const out = [];
        for(let i=0;i<bin.length;i+=4)
        {
            const v = bin.charCodeAt(i) | bin.charCodeAt(i+1)<<8 | bin.charCodeAt(i+2)<<16 | bin.charCodeAt(i+3)<<24;
            out.push(((v>>>0) & mask)>>>0);
        }
        return out;
    }
    throw new Error(`不支援的 tile layer 編碼：${layer.name} ${layer.encoding}/${layer.compression}`);
}

// 同 Map._createGraph() + 物件登記的 weight(Map.updateGrid/gridTiles)；回傳 grid[ty][tx]，0＝牆
export function buildGrid(map, tilesets, objs)
{
    const cols = map.width, rows = map.height, tw = map.tilewidth, th = map.tileheight;
    const grid = Array.from({length:rows}, ()=>new Array(cols).fill(1));
    const lut = tileLut(map, tilesets);

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

// 物件的站位格子（json_pts 有幾個就幾格），夾在地圖內
export function objectTiles(map, o)
{
    return placeObject(o).pts.map(p=>[
        Math.min(map.width-1, Math.max(0, Math.floor(p.x/map.tilewidth))),
        Math.min(map.height-1, Math.max(0, Math.floor(p.y/map.tileheight)))]);
}

// sp → ep 的格子路徑（不含起點，[[tx,ty],...]），走不到回 null；起訖點本身就算被物件佔住也允許站上去
export function findPath(grid, sp, ep)
{
    if(sp[0]===ep[0] && sp[1]===ep[1]) {return [];}
    const g = grid.map(r=>r.slice());
    g[sp[1]][sp[0]] = g[sp[1]][sp[0]] || 1;
    g[ep[1]][ep[0]] = g[ep[1]][ep[0]] || 1;
    const graph = new Graph(g, {diagonal:true});
    const res = astar.search(graph, graph.grid[sp[1]][sp[0]], graph.grid[ep[1]][ep[0]]);
    return res.length ? res.map(n=>[n.y, n.x]) : null;
}

// 從 sp 到 eps 任一點的最短路徑（[[tx,ty],...]），都走不到回 null
export function bestPath(grid, sp, eps)
{
    let best = null;
    for(const ep of eps)
    {
        const p = findPath(grid, sp, ep);
        if(p && (!best || p.length<best.length)) {best = p;}
        if(best?.length===0) {break;}
    }
    return best;
}

// 讀一張地圖＋它的 template／tileset：readJson(相對 assets 的路徑) 可同步或 async，找不到回 null
// 回傳 {map, tilesets（跟 map.tilesets 對齊的內容）, objs, tpls（obj.template → template 內容）}
export async function loadMap(mapName, readJson)
{
    const file = `maps/${mapName}.json`;
    const map = await readJson(file);
    if(!map) {return null;}
    const dir = dirOf(file);
    const tpls = {};
    for(const l of map.layers)
    {
        if(l.type!=='objectgroup') {continue;}
        for(const o of l.objects) {if(o.template && !(o.template in tpls)) {tpls[o.template] = await readJson(joinPath(dir, o.template));}}
    }
    const tilesets = [];
    for(const ts of map.tilesets) {tilesets.push(ts.source ? await readJson(joinPath(dir, ts.source)) : ts);}
    const objs = map.layers
        .filter(l=>l.type==='objectgroup')
        .flatMap(l=>l.objects.map(o=>resolveObject(o, tpls[o.template])));
    return {map, tilesets, objs, tpls};
}
