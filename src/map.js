//import {ProgressBar} from './item.js';
import {Node} from './node.js';
//import {Port} from './port.js';
import {Store} from './store.js';
import {Block,Entity,Port,Pickup,Case} from './entity.js';
import {Character} from './character.js';
import {Npc} from './role.js';
import Utility from './utility.js';
import Record from './record.js';
import {CharacterDB} from './database.js';
import {QuestManager} from './quest.js';
import {astar, Graph} from './astar.js';

class Map
{
    constructor(scene, mapName, diagonal)
    {
        scene.map = this;
        this.createMap(scene, mapName, diagonal);
    }

    static load(scene, maps)
    {
        let promises=[];
        maps.forEach(map=>promises.push(Map.prerun(scene,map)));
        return Promise.all(promises);
    }

    static async prerun(scene, map)
    {
        await Map.preload(scene, map);
        await Map.preprocess(scene, map);
    }

    // Map 無法直接處理 template(*.tj)及 外部tileset(*.tsj)，所以要先載入到cache裡,再取出來處理
    // 1) 載入 template(*.tj) 及 外部tileset(*.tsj) 到 cache 裡
    // 2) 載入 內部tileset(*.png)
    static preload(scene, mapName, onComplete)   
    {
        return new Promise((resolve)=>{
            console.log('preload');
            //  Load the assets for the game - Replace with your own assets
            scene.load.setPath('assets');

            function loadTemplate(map)
            {
                map.data.layers.forEach((layer) => {
                    if(layer.type=='objectgroup')
                    {
                        layer.objects.forEach((obj) => {
                            if(obj.template)    // 載入 template(*.tj) 的資料到 cache 裡
                            {
                                //console.log(`load[${obj.template}]`);
                                scene.load.json(obj.template, obj.template);
                            }
                        });
                    }
                });
            }

            function loadTileset(map)
            {
                map.data.tilesets.forEach((tile) => {
                    if(tile.image)  // 載入 tileset(*.png) 的資料
                    {
                        //console.log(`load[${tile.image}]`);
                        scene.load.spritesheet(tile.name, tile.image, { frameWidth: tile.tilewidth, frameHeight: tile.tileheight });
                    }
                    else if(tile.source) // 載入 外部tileset(*.tsj) 到 cache 裡
                    {
                        //console.log(`load[${tile.source}]`);
                        scene.load.json(tile.source, tile.source);
                    } 
                });
            }

            //let map = scene.cache.tilemap.get('map');
            let map = scene.cache.tilemap.get(mapName);
            loadTemplate(map);
            loadTileset(map);
            //scene.load.once('complete', ()=>{Map.preprocess(scene, onComplete);});
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    // 1) 將 cache 裡的 template(*.tj) 及 外部tileset(*.tsj) 的資料取出來，放到 object 裡
    // 2) 載入 外部tileset(*.png)
    static preprocess(scene, mapName, onComplete)  
    {
        return new Promise((resolve)=>{

            console.log('preprocess');
            function processTemplate(map)
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
                                    if(template.tileset.source.includes(element.source))
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

                                layer.objects[index] = {...obj, ...object};
                            }
                        });
                    }
                });
            }

            function processTileset(map)
            {
                map.lut={};
                // 處理 外部tileset(*.tsj) 的資料
                map.data.tilesets.forEach((tile,index) => {
                    if(tile.source) // tile 是 外部tileset(*.tsj)
                    {
                        let source = tile.source.split('.').shift();
                        let json = scene.cache.json.get(tile.source);
                        delete tile.source;
                        map.data.tilesets[index] = {...tile, ...json};
                        if(json.image)  // (*.tsj) 為 .png
                        {
                            //console.log(`load[${json.image}]`);
                            scene.load.spritesheet(json.name, json.image, { frameWidth: json.tilewidth, frameHeight: json.tileheight });
                        }
                        else    // (*.tsj) 為圖片集合
                        {
                            json.tiles.forEach((tile) => {
                                if(tile.image)
                                {
                                    //console.log(`load[${tile.image}]`);
                                    let name = source+'_'+Utility.extractFileName(tile.image);
                                    //scene.load.spritesheet(name, tile.image, { frameWidth: json.tilewidth, frameHeight: json.tileheight });
                                    //scene.load.spritesheet(name, tile.image, { frameWidth: tile.imagewidth, frameHeight: tile.imageheight });
                                    scene.load.image(name,tile.image);
                                    tile.image = name;
                                    map.lut[name]={w:tile.imagewidth,h:tile.imageheight};
                                }
                            });
                        }
                    }
                });
            }

            //let map = scene.cache.tilemap.get('map');
            let map = scene.cache.tilemap.get(mapName);
            processTemplate(map);
            processTileset(map);

            //scene.load.once('complete', ()=>{if(onComplete){onComplete();}});
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }


    createMap(scene, mapName, diagonal)
    {
        let lut = scene.cache.tilemap.get(mapName).lut;

        //this.scene = scene;
        //let map = scene.make.tilemap({key: 'map'});
        this.map = scene.make.tilemap({key: mapName});
        let map = this.map;
        map.tilesets.forEach((tileset) => {
            if(tileset.name in lut)
            {
                tileset.tileWidth=lut[tileset.name].w;
                tileset.tileHeight=lut[tileset.name].h;
            }
            map.addTilesetImage(tileset.name);
        });

        let tilesets = map.tilesets.map(tileset=>tileset.name);
        //console.log(tilesets)

        
        map.layers.forEach((layer)=>{
            map.createLayer(layer.name, tilesets, 0, 0);    
        });

        this.createGraph(diagonal);

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
                {type:'block',classType:Block},
                {type:'store',classType:Store},
                {type:'character',classType:Character},
                {type:'entity',classType:Entity},
                {type:'pickup',classType:Pickup},
                {type:'npc',classType:Npc},
                {type:'case',classType:Case},
            ]);
            objs.forEach((obj) => {obj.init?.(mapName);});
            scene.objects.push(...objs);
        });

    }

    createGraph(diagonal=false)
    {
        let map = this.map;

        let grid = [];
        for (let y = 0; y < map.height; y++) 
        {
            let row = [];
            for (let x = 0; x < map.width; x++) {row.push(1);}
            grid.push(row);
        }

        map.layers.forEach((layer)=>{
            map.setLayer(layer.name);
            map.forEachTile((tile)=>{
                //let p = tile.tileset?.tileProperties[tile.index-1];
                let p = tile?.properties;
                if(p)
                {
                    if(p.collide){grid[tile.y][tile.x]=0;}
                    else if(p.weight){grid[tile.y][tile.x]=p.weight;}
                }
            });
        });

        this.graph = new Graph(grid,{diagonal:diagonal});
        
    }

    getPath(sp,ep,act='go')
    {
        let map = this.map;
        let ex = map.worldToTileX(ep.x);
        let ey = map.worldToTileX(ep.y);
        if(ex<0||ex>=map.width||ey<0||ey>=map.height){return;}

        let sx = map.worldToTileX(sp.x);
        let sy = map.worldToTileX(sp.y);

        let end = this.graph.grid[ey][ex];
        let start = this.graph.grid[sy][sx];

        let tW = map.tileWidth, tW_2=tW/2;
        let tH = map.tileHeight, tH_2=tH/2;
        let pt = {x:ex*tW+tW_2,y:ey*tH+tH_2}

        if(end.weight==0)
        {
            return {valid:false,pt:pt}
        }
        else if(start==end)
        {
            return {valid:false,pt:null}
        }
        else
        {
            let result = astar.search(this.graph, start, end);
            let len = result.length;
            if(len>=2 && result[len-2].g>=1000)
            {
                return {valid:false,pt:pt}
            }
            else
            {
                let path=[];
                result.forEach((node,i)=>{
                    let pt = {x:node.y*tW+tW_2,y:node.x*tH+tH_2}
                    path.push({pt:pt,act:i==len-1?act:'go'});
                })
                return {valid:true,pt:pt,path:path}
            }
        }
    }

    updateGrid(pos,w)
    {
        let tx = this.map.worldToTileX(pos.x);
        let ty = this.map.worldToTileX(pos.y);
        this.graph.grid[ty][tx].weight += w;
    }

    isValid(pos,w=1000)
    {
        let tx = this.map.worldToTileX(pos.x);
        let ty = this.map.worldToTileX(pos.y);
        return this.graph.grid[ty][tx].weight<w;
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
                //console.log(colBoxX, colBoxY, colBoxW, colBoxH);
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
            //console.log(tileX, tileY);
            let tile = this.map.getTileAt(tileX, tileY, true, 'Tile Layer 1');

            this.marker.x = this.map.tileToWorldX(tileX);
            this.marker.y = this.map.tileToWorldY(tileY);
            //this.text.setText(`${tileX},${tileY}\n(${tile?.index})`).setPosition(this.marker.x, this.marker.y);
            this.text.setText(`${tileX},${tileY}\n(${p.x.toFixed(1)},${p.y.toFixed(1)})`).setPosition(this.marker.x, this.marker.y);

            if(this.scene.ctrl.get().pressed)
            {
                console.log(tile?.tileset);
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