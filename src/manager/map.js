import Utility from '../core/utility.js'
import TileMap from '../core/tilemap.js'
import QuestManager from './quest.js'
import {astar, Graph} from '../core/astar.js'
import {GM} from '../core/setting.js'
import Record from '../infra/record.js'
import {Npc} from '../roles/npc.js'
import Pickup from '../items/pickup.js'
import Case from '../items/case.js'
import Port from '../items/port.js'
import Node from '../items/node.js'
import Stove from '../items/stove.js'
import Well from '../items/well.js'
import Door from '../items/door.js'
import Bed from '../items/bed.js'
import Lamp from '../items/lamp.js'
import Point from '../items/point.js'
import Item from '../items/item.js'
import Plant from '../items/plant.js'
import {T,dlog} from '../core/debug.js'


class Map
{
    static classMap = {
        stove: Stove,
        well:  Well,
        bed:   Bed,
        case:  Case,
        door:  Door,
        lamp:  Lamp,
        item:  Item,
        plant: Plant,
        node:  Node,
        port:  Port,
    };

    constructor(scene)
    {
        scene.map = this;
        this.scene = scene;
        //return this.createMap(scene, mapName, diagonal, weight);
    }

    get center() {return this._center;}
    get small() {return this._small;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _createTileLayer(map, tilesets)
    {
        map.layers.forEach((layer)=>{
            map.createLayer(layer.name, tilesets, 0, 0).setPipeline('Light2D');
        });
    }

    _createObjectLayer(scene, map, mapName)
    {
        scene.objects = [];
        map.objects.forEach((layer)=>{
            
            let qid;
            // 如果 layer name 開頭是 'q_'，代表是任務 layer，
            // layer.name 移除'q_'當成 qid，比對 QuestManager 有沒有開啟任務
            if(layer.name.startsWith('q_'))
            {
                const questId = layer.name.slice(2);
                if(!QuestManager.query(questId))
                {
                    // 如果任務完成，就移除任務的存檔
                    Record.remove(mapName,layer.name);
                    return;
                }
                qid = questId;
            }

            // 將 id,qid 加到 properties
            layer.objects.forEach((obj)=>{
                if(!obj.properties){obj.properties=[]}
                obj.properties.push({name:'uid',type:'int',value:obj.id});
                if(qid) {obj.properties.push({name:'qid',type:'string',value:qid});}
            });
            
            let objs = map.createFromObjects(layer.name,
            [
                {type:'node',classType:Node},
                {type:'port',classType:Port},
                // {type:'store',classType:Store},
                // {type:'entity',classType:Entity},
                {type:'pickup',classType:Pickup},
                {type:'npc',classType:Npc},
                {type:'case',classType:Case},
                {type:'point',classType:Point},
                {type:'stove',classType:Stove},
                {type:'well',classType:Well},
                {type:'door',classType:Door},
                {type:'bed',classType:Bed},
                {type:'lamp',classType:Lamp},
                {type:'item',classType:Item},
                {type:'plant',classType:Plant},
                // {type:'enemy',classType:Enemy},
                // {type:'npc_n',classType:Npc_n},
            ]);
            objs.forEach((obj) => {obj.init_prefab?.()});
        });
    }

    _createGraph(map, diagonal=false, weight=1)
    {
        const rows = this.map.height, cols = this.map.width;
        const grid = [];
        for (let ty = 0; ty < rows; ty++)
        {
            let row = [];
            for (let tx = 0; tx < cols; tx++) {row.push(weight);}
            grid.push(row);
        }

        map.layers.forEach((layer)=>{
            map.setLayer(layer.name);
            map.forEachTile((tile)=>{
                //let p = tile.tileset?.tileProperties[tile.index-1];
                let p = tile?.properties;
                if(p)
                {
                    if(p.collide) {grid[tile.y][tile.x]=0;}
                    else if(p.weight!=undefined) {grid[tile.y][tile.x]=p.weight;}
                }
            });
        });

        this.graph = new Graph(grid,{diagonal:diagonal});
    }

    _createGraphExt({tw,th}={})
    {
        const rows = this.map.height, cols = this.map.width;
        const grid = [];
        for (let ty = 0; ty < rows; ty++)
        {
            const row = [];
            for (let tx = 0; tx < cols; tx++)
            {
                let passable = true, maxW = 0;
                outer:
                for (let dy = 0; dy < th; dy++)
                {
                    for (let dx = 0; dx < tw; dx++)
                    {
                        const ny = ty-dy, nx = tx+dx;
                        if (ny<0 || nx>=cols) {passable=false; break outer;}
                        const w = this.graph.grid[ny][nx].weight;
                        if (w===0) {passable=false; break outer;}
                        if (w>maxW) {maxW=w;}
                    }
                }
                row.push(passable ? maxW : 0);
            }
            grid.push(row);
        }
        if(!this.graphExt) {this.graphExt={};}
        const key = `${tw}x${th}`;
        this.graphExt[key]=new Graph(grid, {diagonal:this._diagonal});
        this.graphExt[key].tw=tw;
        this.graphExt[key].th=th;

    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    async createMap(mapName, diagonal, weight)
    {
        const scene = this.scene;

        // 1) 載入 tilemap 所需許的資料
        await TileMap.load(scene, mapName);

        // 2) 產生 tilemap
        const map = scene.make.tilemap({key: mapName});
        map.tW_half = map.tileWidth*0.5;
        map.tH_half = map.tileHeight*0.5;
        map.tW_p45 = map.tileWidth*0.45;
        map.tH_p45 = map.tileHeight*0.45;
        this._diagonal = diagonal;
        this._center = {x:map.widthInPixels/2, y:map.heightInPixels/2};
        this._small = map.widthInPixels<GM.w && map.heightInPixels<GM.h;
        this.map = map;
        GM.map = map;

        // 3) 取得 tilesets 
        const tilesets = TileMap.getTilesets(scene, map, mapName)

        // 4) 繪製 tilelayer
        this._createTileLayer(map, tilesets);

        // 5) 產生 graphs
        this._createGraph(map, diagonal, weight);
        this._createGraphExt({tw:2, th:1});
        this.graphs={'1x1':this.graph,...this.graphExt};

        // 6) 繪製 object layer
        this._createObjectLayer(scene, map, mapName);

    }
    
    getPath(sp, eps, tile)
    {
        let bestPath;
        eps = Array.isArray(eps) ? eps : [eps];
        eps.forEach((ep,i)=>{
            const path = this.calcPath(sp,ep,tile);
            if(path)
            {
                if(!bestPath) {bestPath=path;}
                else if(path.state>0 && path.cost<bestPath.cost) {bestPath=path}
            }
        })
        return bestPath;
    }

    calcPath(sp, ep, tile)
    {
        const map = this.map;

        const [ex,ey] = this.worldToTile(ep.x, ep.y);

        // 1. 終點 超出 map 範圍，(隱藏框框)
        if(ex<0||ex>=map.width||ey<0||ey>=map.height) {return;}

        // 2.
        const [sx,sy] = this.worldToTile(sp.x, sp.y);

        const key = `${tile.tw}x${tile.th}`;
        const graph = this.graphs[key];
        const end   = graph.grid[ey][ex];
        const start = graph.grid[sy][sx];

        const ept = this.tileToWorld(ex,ey);

        if(end.weight===0)   // 終點為不可通過的點，(顯示紅色框框)
        {
            return {state:GM.PATH.NONE, ep:ept, cost:Infinity}
        }
        else if(start===end) // 起點 = 終點
        {
            return {state:GM.PATH.OK, ep:ept, pts:[], cost:0}
        }
        else
        {
            const result = astar.search(graph, start, end);
            const len = result.length;
            if(len===0)  // 找不到路徑，(顯示紅色框框)
            {
                return {state:GM.PATH.NONE, ep:ept, cost:Infinity}
            }
            else
            {
                const pts = result.map((node)=>this.tileToWorld(node.y,node.x)); //注意:node.x/y位置要對調
                // 如果到達目的地之前的 g >= W_BLOCK，代表有非牆壁的阻擋物(如:人、門)
                const block = len>=2 && result.at(-2).g>=GM.W.BLOCK;
                const state = block ? GM.PATH.BLK : GM.PATH.OK;
                const cost = result.at(-1).g;   // 用於判斷最佳路徑
                // if(act&&act!==GM.ENTER) {pts.pop();}
                return {state:state, ep:ept, pts:pts, cost:cost}
            }
        }
    }

    stepMove(from,h,v)
    {
        let to = {x:from.x+h*this.map.tileWidth, y:from.y+v*this.map.tileHeight};
        let w = this.getWeight(to);
        debug('w',w)
        if(w==1){return {state:1, pt:to, path:[to]};}
        else {return {state:-1, pt:to};}
    }

    getValidPoint_old(p, {th=GM.W.BLOCK,
                        random=false,
                        includeP=true}={})
    {
        const lut = [   {x:-1,y:-1}, {x:0,y:-1}, {x:1,y:-1},
                        {x:-1,y:0}, {x:1,y:0},
                        {x:-1,y:1}, {x:0,y:1}, {x:1,y:1} ]

        const [tx,ty] = this.worldToTile(p.x, p.y)

        // 檢查P點(中心點)
        if(includeP)
        {
            const w=this.getWeightByTile(tx,ty);
            if(w>0 && w<th) {return p;}
        }

        // 檢查P周圍的點
        let r = random ? Phaser.Math.Between(0,lut.length-1) : 1;
        for(let i=0;i<lut.length;i++)
        {
            const nx = tx + lut[r].x;
            const ny = ty + lut[r].y;
            const w=this.getWeightByTile(nx,ny);
            if(w>0 && w<=th)
            {
                let p = this.tileToWorld(nx,ny);
                let dx = random ? Phaser.Math.Between(0, this.map.tW_p45) : 0;
                let dy = random ? Phaser.Math.Between(0, this.map.tH_p45) : 0;
                return {x:p.x+dx, y:p.y+dy}
            }

            if(++r>=lut.length) {r=0;}
        }

        return p;
    }

    flee(p,s,tile={tw:1,th:1})
    {
        const [tx,ty] = this.worldToTile(p.x, p.y)

        const lut={
            'lt':[{x:-1,y:-1},{x:-1,y:0},{x:0,y:-1}],
            'rt':[{x:1,y:-1},{x:1,y:0},{x:0,y:-1}],
            'lb':[{x:-1,y:1},{x:-1,y:0},{x:0,y:1}],
            'rb':[{x:1,y:1},{x:1,y:0},{x:0,y:1}],
            'l':[{x:-1,y:0},{x:-1,y:1},{x:-1,y:-1},{x:0,y:1},{x:0,y:-1}],
            'r':[{x:1,y:0},{x:1,y:1},{x:1,y:-1},{x:0,y:1},{x:0,y:-1}],
            't':[{x:0,y:-1},{x:-1,y:-1},{x:1,y:-1},{x:-1,y:0},{x:1,y:0}],
            'b':[{x:0,y:1},{x:-1,y:1},{x:1,y:1},{x:-1,y:0},{x:1,y:0}]
        }

        const key = (p.x>s.x?'r':p.x<s.x?'l':'')+
                    (p.y>s.y?'b':p.y<s.y?'t':'');

        dlog(T.MAP)(p,s,key)
        const tbl = lut[key];

        const d = tbl.find(d=>this.getWeightByTile(tx+d.x,ty+d.y,tile)>0);
        if(d)
        {
            return this.tileToWorld(tx+d.x,ty+d.y)
        }

        return null;
    }

    getValidPoint(p, {th=GM.W.BLOCK,
                        random=false,
                        includeP=true,
                        returnnull=false}={})
    {
        const isValid=(g)=>{
            const w=this.getWeightByTile(g.x,g.y);
            return w>0 && w<=th;
        }

        const [tx,ty] = this.worldToTile(p.x, p.y)
        const t={x:tx,y:ty}


        // 檢查P點(中心點)
        if(includeP&&isValid(t)) {return p;}

        const c = random ? Utility.findRandomFreeCellByRings(t, isValid)
                        : Utility.findFreeByRings(t, isValid);

        if(c) {return this.tileToWorld(c.x,c.y);}

        return returnnull ? null : p;
    }

    // 計算 mover 靠近 target 時，mover anchor 的所有合法候選位置
    // targetTile/moverTile = {tw, th}，anchor 在左下角 tile
    // checkWeight=false 時只做幾何計算，不過濾動態權重（供 isAt 判斷用）
    getApproachEps(targetPos, targetTile, moverTile)
    {
        const ttw = targetTile?.tw ?? 1, tth = targetTile?.th ?? 1;
        const tw  = moverTile?.tw  ?? 1, th  = moverTile?.th  ?? 1;
        const tW_2 = this.map.tW_half, tH_2 = this.map.tH_half;
        // targetPos 是 posG (grid 中心)，換算成 anchor (左下 tile 中心)
        const [Tx, Ty] = this.worldToTile(
            targetPos.x - (ttw - 1) * tW_2,
            targetPos.y + (tth - 1) * tH_2
        );

        const eps = [];
        const tile = moverTile ?? {tw:1,th:1};
        const push = (tx, ty) => {
            const w = this.getWeightByTile(tx, ty, tile);
            if (w!==0) {eps.push(this.tileToWorld(tx, ty));}
        };

        // 左: anchor.x = Tx-tw，y 遍歷 target 的 anchor y 範圍
        for (let j = 0; j < tth; j++)
            push(Tx - tw, Ty - tth + 1 + j);

        // 右: anchor.x = Tx+ttw
        for (let j = 0; j < tth; j++)
            push(Tx + ttw, Ty - tth + 1 + j);

        // 上: anchor.y = Ty-tth，x 遍歷左右重疊範圍
        for (let i = 0; i < ttw + tw - 1; i++)
            push(Tx - tw + 1 + i, Ty - tth);

        // 下: anchor.y = Ty+th (mover 的底部在 target 底部+1 的下方)
        for (let i = 0; i < ttw + tw - 1; i++)
            push(Tx - tw + 1 + i, Ty + th);

        return eps;
    }

    tileToWorld(tx,ty)
    {
        return {x:tx*this.map.tileWidth+this.map.tW_half, y:ty*this.map.tileHeight+this.map.tH_half}
    }

    worldToTile(x,y)
    {
        return [this.map.worldToTileX(x), this.map.worldToTileY(y)];
    }

    getPt(p)    // get center of tile
    {
        let [tx,ty]=this.worldToTile(p.x,p.y);
        return this.tileToWorld(tx,ty);
    }

    updateGrid(p,weight,{w,h})
    {
        const rows = this.map.height, cols = this.map.width;
        const inBounds = (tx,ty) => tx>=0 && tx<cols && ty>=0 && ty<rows;
        let pts=[];
        if(w>this.map.tileWidth || h>this.map.tileHeight)
        {
            const w_2 = Math.floor(w/2)-2;
            const h_2 = Math.floor(h/2)-2;

            let [tx0,ty0] = this.worldToTile(p.x-w_2, p.y-h_2);
            let [tx1,ty1] = this.worldToTile(p.x+w_2, p.y+h_2);

            for(let tx=tx0;tx<=tx1;tx++)
            {
                for(let ty=ty0;ty<=ty1;ty++)
                {
                    if(!inBounds(tx,ty)) {continue;}
                    this.graph.grid[ty][tx].weight += weight;
                    this._updateGridExt(tx,ty);
                    pts.push(this.tileToWorld(tx,ty))
                }
            }
        }
        else
        {
            let [tx,ty] = this.worldToTile(p.x, p.y);
            if(inBounds(tx,ty))
            {
                this.graph.grid[ty][tx].weight += weight;
                this._updateGridExt(tx,ty);
                pts.push(p)
            }
        }
        return pts;
    }

    _updateGridExt(tx,ty)
    {
        const gExt = this.graphExt;
        for(let key in gExt)
        {
            this._setGridExt(gExt[key],tx,ty);
        }
    }

    _setGridExt(graph,tx,ty)
    {
        if (!graph) return;
        const rows = this.map.height, cols = this.map.width;
        const tw=graph.tw, th=graph.th;

        for (let ay = ty+(th-1); ay<=ty; ay++)
        {
            for (let ax = tx-(tw-1); ax<=tx; ax++)
            {
                if (ax<0 || ay<0 || ax>=cols || ay>=rows) continue;
                let passable = true, maxW = 0;
                outer:
                for (let dy = 0; dy<th; dy++)
                {
                    for (let dx = 0; dx<tw; dx++)
                    {
                        const ny = ay-dy, nx = ax+dx;
                        if (ny>=rows || nx>=cols) {passable=false; break outer;}
                        const w = this.graph.grid[ny][nx].weight;
                        if (w===0) {passable=false; break outer;}
                        if (w>maxW) {maxW=w;}
                    }
                }
                graph.grid[ay][ax].weight = passable ? maxW : 0;
            }
        }
    }

    isTouch(c,w,h,p)
    {
        let min = {x:c.x-w/2-this.map.tW_half, y:c.y-h/2-this.map.tH_half};
        let max = {x:c.x+w/2+this.map.tW_half, y:c.y+h/2+this.map.tH_half};
        return p.x>=min.x && p.x<=max.x && p.y>=min.y && p.y<=max.y;
    }

    isWalkable(p,w=GM.W.BLOCK)
    {
        let [tx,ty] = this.worldToTile(p.x,p.y)
        return this.graph.grid[ty][tx].weight<w;
    }

    isInside(tx,ty)
    {
        return !(tx<0||tx>=this.map.width||ty<0||ty>=this.map.height);
    }

    // isNearby(a,b)
    // {
    //     let [tx_a,ty_a] = this.worldToTile(a.x,a.y);
    //     let [tx_b,ty_b] = this.worldToTile(b.x,b.y);
    //     let dx = Math.abs(tx_a-tx_b);
    //     let dy = Math.abs(ty_a-ty_b);
    //     return this._diagonal ? dx<=1 && dy<=1 : dx<=1 && dy==0 || dx==0 && dy<=1;
    //     // return dx<=1 && dy==0 || dx==0 && dy<=1;
    // }

    // isNearby(a,b)
    // {
    //     let tw = this.map.tileWidth;
    //     let th = this.map.tileHeight;
    //     let dx = Math.abs(a.x-b.x);
    //     let dy = Math.abs(a.y-b.y);
    //     return dx<=tw && dy<=th;
    // }

    getWeight(p,tile)
    {
        const [tx,ty] = this.worldToTile(p.x,p.y);
        return this.getWeightByTile(tx,ty,tile);
    }

    setWeight(p,weight)
    {
        let [tx,ty] = this.worldToTile(p.x,p.y);
        this.graph.grid[ty][tx].weight = weight;
        this._updateGridExt(tx,ty);
    }

    getWeightByTile(tx,ty,{tw=1,th=1}={})
    {
        if(!this.isInside(tx,ty)){return -1;}
        let key = `${tw}x${th}`;
        const graph = this.graphs[key];
        return graph.grid[ty][tx].weight; 
    }

    processMap(map)
    {
        map.layers.forEach((layer) => {
            map.setLayer(layer.name);
            map.forEachTile((tile) => {
                let p = tile?.tileset?.tileProperties[tile.index-1];
                if(p)
                {
                    p.collides&&this.collides(tile);
                    p.interactables&&this.interactables(tile);
                }
            });
        });
            
    }   

    collides(tile)
    {
        let tD = tile?.tileset?.tileData[tile.index-1];
        if(tD)
        {
            tD.objectgroup.objects.forEach((obj) => {
                let colBoxX = tile.pixelX + obj.x;
                let colBoxY = tile.pixelY + obj.y;
                let colBoxW = obj.width;
                let colBoxH = obj.height;
                //debug(colBoxX, colBoxY, colBoxW, colBoxH);
                let zone = this.scene.add.zone(colBoxX+(colBoxW/2),colBoxY+(colBoxH/2), colBoxW,colBoxH);
                this.scene.static.add(zone);
                this.scene.mapLayer.add(zone);
            });
        }
        else
        {
            let zone = this.scene.add.zone(tile.pixelX+(tile.width/2),tile.pixelY+(tile.height/2), tile.width,tile.height);
            this.scene.static.add(zone);
            this.scene.mapLayer.add(zone);
        }
    }

    interactables(tile)
    {
        let zone = this.scene.add.zone(tile.pixelX+(tile.width/2),tile.pixelY+(tile.height/2), tile.width,tile.height);
        this.scene.interactables.add(zone);
    }

    select(p)
    {
        if(this.marker)
        {
            const tileX = this.map.worldToTileX(p.x);
            const tileY = this.map.worldToTileY(p.y);
            //debug(tileX, tileY);
            let tile = this.map.getTileAt(tileX, tileY, true, 'Tile Layer 1');

            this.marker.x = this.map.tileToWorldX(tileX);
            this.marker.y = this.map.tileToWorldY(tileY);
            //this.text.setText(`${tileX},${tileY}\n(${tile?.index})`).setPosition(this.marker.x, this.marker.y);
            this.text.setText(`${tileX},${tileY}\n(${p.x.toFixed(1)},${p.y.toFixed(1)})`).setPosition(this.marker.x, this.marker.y);

            if(this.scene.ctrl.get().pressed)
            {
                debug(tile?.tileset);
            }
        }
        
    }

    debug(p)
    {
        this.text.setText(`(${p.x.toFixed(1)},${p.y.toFixed(1)})`).setPosition(p.x, p.y);
    }

    craeteMark(map)
    {
        this.marker = this.scene.add.graphics();
        this.marker.lineStyle(2, 0x00ff00, 1);
        this.marker.strokeRect(0, 0, map.tileWidth, map.tileHeight);
        this.scene.mapLayer.add(this.marker);
        this.text = this.scene.add.text(0, 0, '0,0', {fontSize: '12px', fill: '#ffffff'});
    }

    debugDraw()
    {
        let graphics = this.scene.add.graphics();
        // this.map.renderDebug(graphics, {
        //     tileColor: null, // Non-colliding tiles
        //     collidingTileColor: new Phaser.Display.Color(243, 134, 48, 200), // Colliding tiles
        //     faceColor: new Phaser.Display.Color(40, 39, 37, 255) // Colliding face edges
        // });
    }


}



export default Map;