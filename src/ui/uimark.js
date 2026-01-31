import {GM} from '../core/setting.js'

export default class UiMark
{
    static instance=null;
    constructor(scene)
    {
        UiMark.instance=this;
        this.scene = scene;
        const [key,frame]=GM.ICON_MARK.split(':');
        this._sp = scene.add.sprite(0,0,key,frame);
        this._sp.setScale(0.5);
        this._sp.visible=false;
        //this._sp.setDisplaySize(32,32);
        this._sp.setDepth(Infinity);
    }

    //set visible(value) {this._sp.visible = value;}
    static set visible(value) 
    {
        this.instance&&(this.instance._sp.visbile=value);
    }

    show(p,color=0xffffff)
    {
        this._sp.visible=true;
        if(this._xp!=p.x||this._yp!=p.y)
        {
            this._sp.x=p.x;
            this._sp.y=p.y;
            this._xp=p.x
            this._yp=p.y;
            this._sp.setTint(color);
            this.scene.tweens.add({
                targets: this._sp,
                scale: {from:0.7,to:0.5},
                //ease:'exp.in',
                duration: 200,
            })
        }
    }

    hide() {this._sp.visible=false;}

    static show(p,color) {this.instance?.show(p,color);}

    static close() {this.instance?.hide();}
}

