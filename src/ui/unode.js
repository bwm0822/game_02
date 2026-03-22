import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import Utility from '../core/utility.js'
import {uPic,uBbc,uPanel} from './uicomponents.js'
import UiInfo from './uiinfo.js'
import Ui from './uicommon.js'

function uTag(scene,{x,y,icon='buffs:1',w=40,h=40,margin,ext}={})
{
    const tag = uPic(scene,{x:x,y:y,icon:icon,w:w,h:h,bg:{}})
    if(this&&this.add) {this.add(tag,ext);}
    tag.qs=[];
    tag.margin=margin;
    tag.setInteractive()
        .on('pointerover',()=>{UiInfo.show(UI.INFO.NODE,tag);})
        .on('pointerout',()=>{UiInfo.close();})
    tag.add=(q)=>{tag.qs.push(q);}
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

        // console.log(dat)
        this._pts = dat.json_pts && JSON.parse(dat.json_pts);

        this._init(map, obj);
        // this._debugDraw(obj);
    }

    get dat() {return this._dat;}
    // get loc() {return {x:this.x+this._zone.x, y:this.y+this._zone.y};}
    get pos() {return {x:this.x, y:this.y}}
    
    get ol() {return -this.width/2+this._dat.zl;}
    get or() {return -this.width/2-this._dat.zr;}
    get ot() {return -this.height/2+this._dat.zt;}
    get ob() {return this.height/2-this._dat.zb;}

    // get left() {return this.x-this.width/2;}
    // get right() {return this.x+this.width/2;}
    // get top() {return this.y-this.height/2;}
    // get bottom() {return this.y+this.height/2;}

    get left() {return this.x-this.ol;}
    get right() {return this.x+this.or;}
    get top() {return this.y-this.ot;}
    get bottom() {return this.y+this.ob;}

    // 可互動的點(陣列)
    get pts() {return this._pts ? this._pts.map((p)=>{return {x:p.x+this.pos.x,y:p.y+this.pos.y}})
                                : [this.pos]} 

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

    _setOutline(on)
    {
        if(!this._outline) {this._outline = this.scene.plugins.get('rexOutlinePipeline');}
        if(on) {this._outline.add(this._shape,{thickness:3, outlineColor:0xffffff});}
        else {this._outline.remove(this._shape);}
    }

    _onover()
    {
        // UiInfo.show(UI.INFO.NODE,this)
        this._setOutline(true);
    }

    _onout()
    {
        // UiInfo.close();
        this._setOutline(false);
    }

    _ondown()
    {
        dlog()('ondown')
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
        const w=obj.width;
        const h=obj.height;
        this.setSize(w,h)

        // 1. shape
        this._addShape(scene,map,obj);

        // 2. panel
        this._addPanel(scene);
        this._addTags(scene);
        this._addText(this._dat.name);

        // event
        const z = this._zone;
        // Phaser.Geom.Rectangle 的 (x, y) 是「左上角」
        this.setInteractive(
            new Phaser.Geom.Rectangle(z.x-z.w/2+w/2, z.y-z.h/2+h/2, z.w, z.h),
            Phaser.Geom.Rectangle.Contains);
        this.on('pointerover', this._onover.bind(this))
        this.on('pointerout', this._onout.bind(this))
        this.on('pointerdown', this._ondown.bind(this))

    }

    _addShape(scene,map,obj)
    {
        const [key,frame] = Utility.getbygid(map,obj.gid);
        const img = scene.add.image(0,0,key,frame);
        this.add(img);
        this._shape = img;  // for outline
    }

    _addPanel(scene)
    {
        this._p = uPanel.call(this,scene,{
                                        y:this.ot,
                                        orientation:'y',
                                        // rtl: true,
                                    })
                        .setOrigin(0.5,1)
        return this._p;
    }

    _addTags(scene)
    {
        this._tags = uPanel.call(this._p,scene,{orientation:'x'})
    }

    _addText(text)
    {
        const bbc = uBbc(this.scene,{   text:text,
                                        color:'#000',
                                        backgroundColor:'#ccc',
                                        padding:1
                                    }).setOrigin(0.5,1);
        this._p.add(bbc).layout();
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    addTag(q,margin)
    {
        if(!this._tag)
        {
            // this._tags.add(uTag(this.scene,{q:q,margin:margin}));
            this._tag = uTag.call(this._tags,this.scene,{margin:margin});
        }
        this._tag.add(q);
        this._p.layout();
    }
   
}