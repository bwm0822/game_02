import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'
import {uPic} from './uicomponents.js'
import UiInfo from './uiinfo.js'
import Ui from './uicommon.js'

export function uTag(scene,{x,y,icon='buffs:1',w=40,h=40}={})
{
    const tag = uPic(scene,{x:x,y:y,icon:icon,w:w,h:h,bg:{}})
    // tag.setInteractive()
    Ui.setInteractive(tag)
        .on('pointerover',()=>{UiInfo.show(UI.INFO.NODE,tag);})
        .on('pointerout',()=>{UiInfo.close();})
    return tag;
}


export class UNode extends Phaser.GameObjects.Container
{
    constructor(scene, map, obj) 
    {
        const dat =  Utility.getProps(obj);
        // obj.x,obj.y是左下角，轉成center
        const x = obj.x+obj.width/2;
        const y = obj.y-obj.height/2;

        super(scene, x, y);
        scene.add.existing(this); // ❗非常重要
        this._zone = this._getZone(dat, obj);
        this._dat = dat;

        this._init(map, obj);
        // this._debugDraw(obj);
    }

    get dat() {return this._dat;}
    get loc() {return {x:this.x+this._zone.x, y:this.y+this._zone.y};}

    get left() {return this.x-this.width/2;}
    get right() {return this.x+this.width/2;}
    get top() {return this.y-this.height/2;}
    get bottom() {return this.y+this.height/2;}

    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    _debugDraw(obj)
    {
        // console.log(obj)
        const scene=this.scene;

        const w=obj.width;
        const h=obj.height;

        const z = this._zone;

        const zcen = scene.add.circle(z.x, z.y, 5)
                                .setStrokeStyle(2, 0x00ff00);
        const zrect = scene.add.rectangle(z.x, z.y, z.w, z.h)
                                .setStrokeStyle(2, 0xffffff);

        const rect = scene.add.rectangle(0, 0, w, h)
                            .setStrokeStyle(2, 0xffffff);
        this.add(zcen).add(zrect).add(rect)
    }

    _onover()
    {
        console.log('onover');
        UiInfo.show(UI.INFO.NODE,this)
    }

    _onout()
    {
        console.log('onout');
        UiInfo.close();
    }

    _ondown()
    {
        console.log('ondown')
    }

    _getZone(dat, obj)
    {
        const l=dat.zl??0;
        const r=dat.zr??0;
        const t=dat.zt??0;
        const b=dat.zb??0;
        const w=obj.width-l-r;
        const h=obj.height-b-t;

        return {x:(l-r)/2, y:(t-b)/2, w:w, h:h};
    }

    _init(map, obj)
    {
        const scene=this.scene;

        // image
        const [key,frame] = Utility.getbygid(map,obj.gid);
        const img = scene.add.image(0,0,key,frame);
        this.add(img);

        // this.addTag(this.scene);

        // event
        const z = this._zone;
        const w=obj.width;
        const h=obj.height;
        this.setSize(w,h)
        // Phaser.Geom.Rectangle 的 (x, y) 是「左上角」
        // this.setInteractive(
        //     new Phaser.Geom.Rectangle(z.x-z.w/2+w/2, z.y-z.h/2+h/2, z.w, z.h),
        //     Phaser.Geom.Rectangle.Contains);
        Ui.setInteractive(this,
            new Phaser.Geom.Rectangle(z.x-z.w/2+w/2, z.y-z.h/2+h/2, z.w, z.h),
            Phaser.Geom.Rectangle.Contains);
        this.on('pointerover', this._onover.bind(this))
        this.on('pointerout', this._onout.bind(this))
        this.on('pointerdown', this._ondown.bind(this))

    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    addTag()
    {
        this.add(uTag(this.scene,{x:0,y:-32}))
    }
   
}