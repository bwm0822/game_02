export class MiniMap
{
    static tex = 'WORLD_MAP_TEX';

    // mapName(不含 .json) -> 該地圖縮圖在合成貼圖裡的 {x,y,w,h}，供其他地方（例如置中顯示）查詢
    static layout = {};

    // 縮圖跟 map.world 換算相對位置用的比例常數，必須跟 scripts/minimap.js 的 OUTPUT_SIZE 一致
    // （目前假設 map.world 裡所有地圖 tile 數都一樣，用第一張地圖的尺寸當比例基準）
    static OUTPUT_SIZE = 100;

    // 每格 tile 換算成合成貼圖上幾像素，_composeWorldTex() 算出來後存這裡，供 worldToTex() 共用
    static pxPerTile = 1;

    static _inited = false;

    static async init(scene)
    {
        if(this._inited) {return;}
        this._inited = true;

        await this._composeWorldTex(scene);
    }

    // 依 map.world 把每張地圖的縮圖 png 組成一張合成貼圖，取代原本烘 map.json tile layer 的做法
    static async _composeWorldTex(scene)
    {
        const world = scene.cache.json.get('world');

        // Preloader 階段還不知道 map.world 裡列了哪些地圖，這裡另外動態載入縮圖 png
        await new Promise((resolve)=>{
            world.maps.forEach(m=>{
                const key = this._texKey(m.fileName);
                if(!scene.textures.exists(key))
                {
                    scene.load.image(key, `textures/minimap/${m.fileName.replace(/\.json$/, '.png')}`);
                }
            });
            scene.load.once('complete', resolve);
            scene.load.start();
        });

        // 每格 tile 縮成幾像素，用第一張地圖的尺寸反推（假設所有地圖 tile 數相同）
        const ref = world.maps[0];
        this.pxPerTile = this.OUTPUT_SIZE / (Math.max(ref.width, ref.height) / 32);
        const toPx = (worldPx)=>Math.round(worldPx / 32 * this.pxPerTile);

        const minX = Math.min(...world.maps.map(m=>m.x));
        const minY = Math.min(...world.maps.map(m=>m.y));
        const maxX = Math.max(...world.maps.map(m=>m.x + m.width));
        const maxY = Math.max(...world.maps.map(m=>m.y + m.height));

        const rt = scene.add.renderTexture(0, 0, toPx(maxX - minX), toPx(maxY - minY))
                        .setOrigin(0, 0)
                        .setScrollFactor(0); // 如果當 UI 用

        rt.clear();
        world.maps.forEach(m=>{
            const name = m.fileName.replace(/\.json$/, '');
            const x = toPx(m.x - minX), y = toPx(m.y - minY);
            const w = toPx(m.width), h = toPx(m.height);
            this.layout[name] = {x, y, w, h};
            rt.draw(this._texKey(m.fileName), x, y);
        });
        rt.saveTexture(MiniMap.tex);
        rt.destroy(); // RT 物件可丟掉，texture 還在
    }

    static _texKey(fileName)
    {
        return 'minimap_' + fileName.replace(/\.json$/, '');
    }

    // 把「某張地圖自己座標系裡的一個點（例如玩家世界座標）」換算成合成貼圖座標，查不到該地圖時回傳 null
    static worldToTex(mapName, x, y)
    {
        const l = this.layout[mapName];
        if(!l) {return null;}
        return {x: l.x + x/32*this.pxPerTile, y: l.y + y/32*this.pxPerTile};
    }
}
