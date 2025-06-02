import {Store} from './store.js';
import {Entity,Port,Pickup,Case,Node,Point,Stove,Well,Door,Bed} from './entity.js';
import {Npc} from './role.js';
import Utility from './utility.js';
import QuestManager from './quest.js';
import {astar, Graph} from './astar.js';
import {GM} from './setting.js';

let DEBUG = false;

function debug(...args) {if(DEBUG) {console.log(args);}}

class Map
{
    static maploaded = [];
    static loaded = [];
    
    constructor(scene, mapName, diagonal, weight)
    {
        scene.map = this;
        this.scene = scene;
        //return this.createMap(scene, mapName, diagonal, weight);
    }

    isLoaded(name)
    {
        if(Map.loaded.includes(name)) {return true;}
        Map.loaded.push(name);
        return false;
    }

    isMaploaded(name)
    {
        if(Map.maploaded.includes(name)) {return true;}
        Map.maploaded.push(name);
        return false;
    }

    // static load(scene, maps)
    // {
    //     let promises=[];
    //     maps.forEach(map=>promises.push(Map.prerun(scene,map)));
    //     return Promise.all(promises);
    // }

    // static async prerun(scene, map)
    // {
    //     if(Map.isMaploaded(map)) {return;}
    //     await Map.loadTileMap(scene, map);
    //     await Map.preload(scene, map);
    //     await Map.preprocess(scene, map);
    // }

    loadTileMap(scene, mapName)
    {
        return new Promise((resolve)=>{
            debug('loadTileMap');

            scene.load.setPath('assets');   //Load the assets for the game - Replace with your own assets
            scene.load.tilemapTiledJSON(mapName, `maps/${mapName}.json`);
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    // Map 無法直接處理 template(*.tj)及 外部tileset(*.tsj)，所以要先載入到cache裡,再取出來處理
    // 1) 載入 template(*.tj) 及 外部tileset(*.tsj) 到 cache 裡
    // 2) 載入 內部tileset(*.png)
    preload_Template(scene, map)
    {
        map.data.layers.forEach((layer) => {
            if(layer.type=='objectgroup')
            {
                layer.objects.forEach((obj) => {
                    if(obj.template)    // 載入 template(*.tj) 的資料到 cache 裡
                    {
                        obj.template = obj.template.replace('../','');
                        if(this.isLoaded(obj.template)) {return;}
                        debug(`load[${obj.template}]`);
                        scene.load.json(obj.template, obj.template);
                    }
                });
            }
        });
    }

    preload_Tileset(scene, map)
    {
        map.data.tilesets.forEach((tile) => {
            if(tile.image)  // 載入 tileset(*.png) 的資料
            {
                tile.image = tile.image.replace('../','');
                if(this.isLoaded(tile.image)) {return;}
                debug(`load[${tile.image}]`);
                scene.load.spritesheet(tile.name, tile.image, { frameWidth: tile.tilewidth, frameHeight: tile.tileheight });
            }
            else if(tile.source) // 載入 外部tileset(*.tsj) 到 cache 裡
            {
                tile.source = tile.source.replace('../','');
                if(this.isLoaded(tile.source)) {return;}
                debug(`load[${tile.source}]`);
                scene.load.json(tile.source, tile.source);
            } 
        });
    }

    preload(scene, mapName)   
    {
        return new Promise((resolve)=>{
            debug('preload');

            scene.load.setPath('assets');   //Load the assets for the game - Replace with your own assets

            let map = scene.cache.tilemap.get(mapName);
            this.preload_Template(scene, map);
            this.preload_Tileset(scene, map);
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    // 1) 將 cache 裡的 template(*.tj) 及 外部tileset(*.tsj) 的資料取出來，放到 object 裡
    // 2) 載入外部 tileset(*.png)
    preprocess_Template(scene, map)
    {
        map.data.layers.forEach((layer) => {
            if(layer.type=='objectgroup')
            {
                layer.objects.forEach((obj,index) => {
                    if(obj.template) // 將 template(*.tj) 的資料取出來，放到 object 裡
                    {
                        let template = scene.cache.json.get(obj.template);
                        let object = Utility.deepClone(template.object);
                        // 從 tileset 裡找到對應的 tileset，並將 gid 轉換成正確的 gid
                        map.data.tilesets.forEach(element => {
                            if(template.tileset?.source.includes(element.source))
                            {
                                object.gid = element.firstgid + object.gid - 1;
                            }   
                        }); 
                        delete obj.template;
                        //將 obj.properties 的值 覆蓋到 object.properties 上
                        if(obj.properties)
                        {
                            if(!object.properties){object.properties=[];}
                            obj.properties.forEach((p)=>
                            {
                                for(let value of object.properties)
                                {
                                    if(value.name == p.name)
                                    {
                                        let i = object.properties.indexOf(value);
                                        object.properties.splice(i,1);
                                        object.properties.push(p);
                                        return;
                                    }
                                }
                                object.properties.push(p);
                            });
                            delete obj.properties;
                        }
                        
                        layer.objects[index] = {...object, ...obj};
                    }
                });
            }
        });
    }

    preprocess_Tileset(scene, map)
    {
        map.lut={};
        // 處理外部 tileset(*.tsj) 的資料
        map.data.tilesets.forEach((tile,index) => {
            if(tile.source) // tile 是外部 tileset(*.tsj)
            {
                //let source = tile.source.split('.').shift();
                let json = scene.cache.json.get(tile.source);
                delete tile.source;
                map.data.tilesets[index] = {...tile, ...json};
                if(json.image)  // (*.tsj) 為 .png
                {
                    if(this.isLoaded(json.image)) {return;}
                    debug(`load[${json.image}]`);
                    scene.load.spritesheet(json.name, json.image, { frameWidth: json.tilewidth, frameHeight: json.tileheight });
                }
                else    // (*.tsj) 為圖片集合
                {
                    json.tiles.forEach((tile) => {
                        if(tile.image)
                        {
                            map.lut[tile.image]={w:tile.imagewidth,h:tile.imageheight};
                            if(this.isLoaded(tile.image)) {return;}
                            debug(`load[${tile.image}]`);
                            scene.load.image(tile.image,tile.image);
                        }
                    });
                }
            }
        });
    }

    preprocess(scene, mapName)  
    {
        return new Promise((resolve)=>{
            debug('preprocess');

            let map = scene.cache.tilemap.get(mapName);
            this.preprocess_Template(scene, map);
            this.preprocess_Tileset(scene, map);

            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    get center() {return this._center;}
    get small() {return this._small;}

    async load(scene, mapName)
    {
        if(this.isMaploaded(mapName)) {return;}
        await this.loadTileMap(scene, mapName);
        await this.preload(scene, mapName);
        await this.preprocess(scene, mapName);
    }

    createMap(mapName, diagonal, weight)
    {
        let scene = this.scene;

        return new Promise(async (resolve)=>{

            await this.load(scene, mapName);

            let lut = scene.cache.tilemap.get(mapName).lut;

            this.map = scene.make.tilemap({key: mapName});
            let map = this.map;
            map.tW_half = map.tileWidth*0.5;
            map.tH_half = map.tileHeight*0.5;
            map.tW_p45 = map.tileWidth*0.45;
            map.tH_p45 = map.tileHeight*0.45;
            this._diagonal = diagonal;
            this._center = {x:map.widthInPixels/2, y:map.heightInPixels/2};
            this._small = map.widthInPixels<GM.w && map.heightInPixels<GM.h;


            map.tilesets.forEach((tileset) => {
                if(tileset.name in lut)
                {
                    tileset.tileWidth=lut[tileset.name].w;
                    tileset.tileHeight=lut[tileset.name].h;
                }
                map.addTilesetImage(tileset.name);
            });

            let tilesets = map.tilesets.map(tileset=>tileset.name);
            //debug(tilesets)

            
            map.layers.forEach((layer)=>{
                map.createLayer(layer.name, tilesets, 0, 0).setPipeline('Light2D');
            });

            this.createGraph(diagonal, weight);

            scene.objects = [];

            map.objects.forEach((layer)=>{
                if(layer.name,layer.name.includes('q'))
                {
                    if(!QuestManager.query(layer.name)){return;}
                }

                // 將 id 加到 properties 的 uid
                layer.objects.forEach((obj)=>{
                    if(!obj.properties){obj.properties=[]}
                    obj.properties.push({name:'uid',type:'int',value:obj.id});
                });
                
                let objs = map.createFromObjects(layer.name,
                [
                    {type:'node',classType:Node},
                    {type:'port',classType:Port},
                    {type:'store',classType:Store},
                    {type:'entity',classType:Entity},
                    {type:'pickup',classType:Pickup},
                    {type:'npc',classType:Npc},
                    {type:'case',classType:Case},
                    {type:'point',classType:Point},
                    {type:'stove',classType:Stove},
                    {type:'well',classType:Well},
                    {type:'door',classType:Door},
                    {type:'bed',classType:Bed},
                ]);
                objs.forEach((obj) => {obj.init_prefab?.()});
            });

            resolve();
        });

    }

    createGraph(diagonal=false,weight=1)
    {
        let map = this.map;

        let grid = [];
        for (let y = 0; y < map.height; y++) 
        {
            let row = [];
            for (let x = 0; x < map.width; x++) {row.push(weight);}
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

    getPath(sp, eps)
    {
        let rst;
        eps.forEach((ep)=>{
            let path = this.calcPath(sp,ep)
            if(path)
            {
                if(!rst) {rst=path;}
                else if(path.state>0 && path.cost<rst.cost){rst=path}
            }
        })
        return rst;
    }

    calcPath(sp,ep)
    {
        let map = this.map;

        let [ex,ey] =  this.worldToTile(ep.x, ep.y);
        if(ex<0||ex>=map.width||ey<0||ey>=map.height){return;}

        let [sx,sy] =  this.worldToTile(sp.x, sp.y);

        let end = this.graph.grid[ey][ex];
        let start = this.graph.grid[sy][sx];

        let pt = this.tileToWorld(ex,ey);

        if(end.weight==0)
        {
            return {state:-1,pt:pt,cost:Infinity}
        }
        else if(start==end)
        {
            return {state:0,pt:pt,cost:Infinity}
        }
        else
        {
            let result = astar.search(this.graph, start, end);
            let len = result.length;
            if(len==0 || (len>=2 && result[len-2].g>=1000))
            {
                return {state:-1,pt:pt,cost:Infinity}
            }
            else
            {
                let path = result.map( (node)=>{return this.tileToWorld(node.y,node.x);} ); //注意:node.x/y位置要對調
                return {state:1,pt:pt,path:path,cost:result.at(-1).g}
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

    getDropPoint(p)
    {
        let lut = [ {x:-1,y:-1}, {x:0,y:-1}, {x:1,y:-1},
                    {x:-1,y:0}, {x:1,y:0},
                    {x:-1,y:1}, {x:0,y:1}, {x:1,y:1} ]

        let [tx,ty] = this.worldToTile(p.x, p.y)
        let r = Phaser.Math.Between(0,lut.length-1);

        for(let i=0;i<lut.length;i++)
        {
            let nx = tx + lut[r].x;
            let ny = ty + lut[r].y;
            if(this.getWeightByTile(nx,ny)==1)
            {
                let p = this.tileToWorld(nx,ny);
                let dx = Phaser.Math.Between(0, this.map.tW_p45);
                let dy = Phaser.Math.Between(0, this.map.tH_p45);
                return {x:p.x+dx, y:p.y+dy}
            }

            if(++r>=lut.length) {r=0;}

        }

        return p;
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

    updateGrid(p,weight,w,h)
    {
        let pts=[];
        if(w>this.map.tileWidth || h>this.map.tileHeight)
        {
            let w_2 = Math.floor(w/2)-1;
            let h_2 = Math.floor(h/2)-1;

            let [tx0,ty0] = this.worldToTile(p.x-w_2, p.y-h_2);
            let [tx1,ty1] = this.worldToTile(p.x+w_2, p.y+h_2);

            for(let tx=tx0;tx<=tx1;tx++)
            {
                for(let ty=ty0;ty<=ty1;ty++)
                {
                    this.graph.grid[ty][tx].weight += weight;
                    pts.push(this.tileToWorld(tx,ty))
                }
            }
        }
        else
        {
            let [tx,ty] = this.worldToTile(p.x, p.y);
            this.graph.grid[ty][tx].weight += weight;
            pts.push(p)
        }
        return pts;
    }

    isWalkable(p,w=1000)
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

    isNearby(a,b)
    {
        let tw = this.map.tileWidth;
        let th = this.map.tileHeight;
        let dx = Math.abs(a.x-b.x);
        let dy = Math.abs(a.y-b.y);
        return dx<=tw && dy<=th;
    }

    getWeight(p)
    {
        let [tx,ty] = this.worldToTile(p.x,p.y);
        return this.getWeightByTile(tx,ty);
    }

    setWeight(p,weight)
    {
        let [tx,ty] = this.worldToTile(p.x,p.y);
        this.graph.grid[ty][tx].weight = weight;
    }

    getWeightByTile(tx,ty)
    {
        if(!this.isInside(tx,ty)){return;}
        return this.graph.grid[ty][tx].weight; 
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