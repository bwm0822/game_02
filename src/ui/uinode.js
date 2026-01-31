import {GM,UI} from '../core/setting.js'
import {uPic} from './uicomponents.js'
import UiInfo from './uiinfo.js'

function uTag(scene,{x,y,icon=GM.ICON.AIM}={})
{
    const tag = uPic(scene,{x:x,y:y,icon:icon,w:32,h:32,bg:{}})
    tag.setInteractive()
        .on('pointerover',()=>{UiInfo.show(UI.INFO.NODE,tag);})
        .on('pointerout',()=>{UiInfo.close();})
    return tag;
}


export class UiNode extends Phaser.GameObjects.Container
{
    constructor(scene, map, obj) 
    {
        // obj.x, obj.y 是 左下角
        const x = obj.x+obj.width/2;
        const y = obj.y-obj.height/2;

        super(scene, x, y);
        scene.add.existing(this); // ❗非常重要

        this._init(map, obj);
        // this._debugDraw(obj);
    }

    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    _debugDraw(obj)
    {
        // console.log(obj)
        const scene=this.scene;
        const w=obj.width;
        const h=obj.height;
        const cen = scene.add.circle(0, 0, 5)
                                .setStrokeStyle(2, 0x00ff00);
        const rect = scene.add.rectangle(0, 0, w, h)
                                .setStrokeStyle(2, 0xffffff);
        this.add(cen).add(rect);
    }

    _getbygid(map,gid)
    {
        const tileset = map.tilesets.find(t=>gid>=t.firstgid&&gid<t.firstgid+t.total);
        const frame=gid-tileset.firstgid;
        return [tileset.name,frame]
    }

    _onover()
    {
        console.log('onover')
    }

    _onout()
    {
        console.log('onout')
    }

    _ondown()
    {
        console.log('ondown')
    }

    _init(map, obj)
    {
        const scene=this.scene;

        // image
        const [key,frame] = this._getbygid(map,obj.gid);
        const img = scene.add.image(0,0,key,frame);
        this.add(img);

        this.addTag(this.scene);

        // event
        this.setSize(obj.width,obj.height)
        this.setInteractive();
        this.on('pointerover', this._onover.bind(this))
        this.on('pointerout', this._onout.bind(this))
        this.on('pointerdown', this._ondown.bind(this))

    }

    addTag(scene)
    {
        this.add(uTag(scene,{x:0,y:-32}))
    }
   
}