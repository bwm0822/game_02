import TileMap from '../core/tilemap.js'

export class MiniMap
{
    static tex = 'WORLD_MAP_TEX';
    static map;

    static async init(scene)
    {
        if(this.map) {return;}

        const mapName='map';
        await TileMap.load(scene, mapName);
        const map = scene.make.tilemap({key: mapName});   
        const tilesets = TileMap.getTilesets(scene, map, mapName);

        const rt = scene.add.renderTexture(0, 0, 1024, 1024)
                        .setOrigin(0, 0)
                        .setScrollFactor(0); // 如果當 UI 用

        rt.clear();
        map.layers.forEach((layer)=>{
            // console.log(layer)
            const l = map.createLayer(layer.name, tilesets, 0, 0).setVisible(false);
            rt.draw(l);
        });
        rt.saveTexture(MiniMap.tex);
        rt.destroy(); // RT 物件可丟掉，texture 還在

        this.map=map;
    }

}