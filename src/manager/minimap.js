import TileMap from '../core/tilemap.js'

export class MiniMap
{
    constructor(scene)
    {
        scene.minimap = this;
        this.scene = scene;
    }

    async create(mapName)
    {
        await TileMap.load(this.scene, mapName);
        const map = this.scene.make.tilemap({key: mapName});   
        const tilesets = TileMap.getTilesets(this.scene, map, mapName);

        map.layers.forEach((layer)=>{
            map.createLayer(layer.name, tilesets, 32, 32);    
        });
    }

}