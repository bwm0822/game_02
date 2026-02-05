import Utility from './utility.js'

const DEBUG = false;
function debug(...args) {if(DEBUG) {console.log(args);}}

//--------------------------------------------------
// 說明 : 載入 tilemap 所需的資料
// 功能 :
//  1. 處理 phaser3 tilemap 無法處理的 template(*.tj)及 外部 tileset(*.tsj)
//  2. 分析 tilemap，自動載入所需的資料
//  3. 記錄已經載入的資料，不浪費時間重複載入
//--------------------------------------------------
export default class TileMap
{
    static _maploaded = [];
    static _loaded = [];

    // 是否已載入地圖
    static _isMaploaded(name)
    {
        if(this._maploaded.includes(name)) {return true;}
        this._maploaded.push(name);
        return false;
    }

    // 是否已載入
    static _isLoaded(name)
    {
        if(this._loaded.includes(name)) {return true;}
        this._loaded.push(name);
        return false;
    }

    // 載入 tilemap
    static _loadTileMap(scene, mapName)
    {
        return new Promise((resolve)=>{
            debug('loadTileMap');

            scene.load.setPath('assets');   //Load the assets for the game - Replace with your own assets
            scene.load.tilemapTiledJSON(mapName, `maps/${mapName}.json`);
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    //--------------------------------------------------
    // phaser3 的 Map 無法處理 template(*.tj)及 外部 tileset(*.tsj)
    // 所以要分成兩步驟 preload / preprocess 來處理
    // 1) preload : 先將 template(*.tj) 及 外部 tileset(*.tsj)，載入到 cache 裡
    // 2) preprocess : 從 cache 取出資料來出處理
    //--------------------------------------------------
    
    //---------- 步驟 1 : preload
    // 載入 template(*.tj) 到 cache
    static _preload_Template(scene, map)
    {
        map.data.layers.forEach((layer) => {
            if(layer.type=='objectgroup')
            {
                layer.objects.forEach((obj) => {
                    if(obj.template)    // 載入 template(*.tj) 的資料到 cache 裡
                    {
                        obj.template = obj.template.replace('../','');
                        if(this._isLoaded(obj.template)) {return;}
                        debug(`load[${obj.template}]`);
                        scene.load.json(obj.template, obj.template);
                    }
                });
            }
        });
    }

    // 載入 內部tileset(*.png)，載入 外部tileset(*.tsj) 到 cache 裡
    static _preload_Tileset(scene, map)
    {
        map.data.tilesets.forEach((tile) => {
            if(tile.image)  // 載入 tileset(*.png) 的資料
            {
                tile.image = tile.image.replace('../','');
                if(this._isLoaded(tile.image)) {return;}
                debug(`load[${tile.image}]`);
                scene.load.spritesheet(tile.name, tile.image, { frameWidth: tile.tilewidth, frameHeight: tile.tileheight });
            }
            else if(tile.source) // 載入 外部tileset(*.tsj) 到 cache 裡
            {
                tile.source = tile.source.replace('../','');
                if(this._isLoaded(tile.source)) {return;}
                debug(`load[${tile.source}]`);
                scene.load.json(tile.source, tile.source);
            } 
        });
    }

    static _preload(scene, mapName)   
    {
        return new Promise((resolve)=>{
            debug('preload');

            scene.load.setPath('assets');   //Load the assets for the game - Replace with your own assets

            const map = scene.cache.tilemap.get(mapName);

            console.log(map)


            this._preload_Template(scene, map);
            this._preload_Tileset(scene, map);
            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    //---------- 步驟 2 : preprocess
    // 將 cache 裡的 template(*.tj) 的資料取出來，放到 object 裡
    static _preprocess_Template(scene, map)
    {
        map.data.layers.forEach((layer) => {
            if(layer.type=='objectgroup')
            {
                layer.objects.forEach((obj,index) => {
                    if(obj.template) 
                    {
                        // 將 template(*.tj) 的資料取出來，放到 object 裡
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

    // 外部tileset(*.tsj) 的資料取出來，載入外部 tileset(*.png)
    static _preprocess_Tileset(scene, map)
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
                    if(this._isLoaded(json.image)) {return;}
                    debug(`load[${json.image}]`);
                    scene.load.spritesheet(json.name, json.image, { frameWidth: json.tilewidth, frameHeight: json.tileheight });
                }
                else    // (*.tsj) 為圖片集合
                {
                    json.tiles.forEach((tile) => {
                        if(tile.image)
                        {
                            map.lut[tile.image]={w:tile.imagewidth,h:tile.imageheight};
                            if(this._isLoaded(tile.image)) {return;}
                            debug(`load[${tile.image}]`);
                            scene.load.image(tile.image,tile.image);
                        }
                    });
                }
            }
        });
    }

    static _preprocess(scene, mapName)  
    {
        return new Promise((resolve)=>{
            debug('preprocess');

            let map = scene.cache.tilemap.get(mapName);
            this._preprocess_Template(scene, map);
            this._preprocess_Tileset(scene, map);

            scene.load.once('complete', ()=>{resolve()});
            scene.load.start();
        });
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    // 載入 tilemap 所需許的資料
    static async load(scene, mapName)
    {
        if(this._isMaploaded(mapName)) {return;}
        await this._loadTileMap(scene, mapName);
        await this._preload(scene, mapName);
        await this._preprocess(scene, mapName);
    }

    // 取得 tilesets (繪製 tilelayer 時，需要tilesets)
    static getTilesets(scene, map, mapName)
    {
        const lut = scene.cache.tilemap.get(mapName).lut;
        return map.tilesets.map(ts=>{
                if(ts.name in lut)
                {
                    ts.tileWidth=lut[ts.name].w;
                    ts.tileHeight=lut[ts.name].h;
                }
                return map.addTilesetImage(ts.name);
            })
    }

    // 取得 tileset by gid
    static getbygid(map,gid)
    {
        const t = map.tilesets.find(t=>gid>=t.firstgid&&gid<t.firstgid+t.total);
        // console.log(gid,t)
        return t;
    }

    static getTilesets_name(scene, map, mapName)
    {
        const lut = scene.cache.tilemap.get(mapName).lut;
        map.tilesets.forEach(ts => {
            if(ts.name in lut)
            {
                ts.tileWidth=lut[ts.name].w;
                ts.tileHeight=lut[ts.name].h;
            }
            map.addTilesetImage(ts.name);
        });

        return map.tilesets.map(ts=>ts.name);
    }
}