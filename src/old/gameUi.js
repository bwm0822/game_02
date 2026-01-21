import {FixWidthSizer, OverlapSizer, Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {sprite, text, rect} from './uibase.js';
import {GM} from '../core/setting.js';
import Utility from '../core/utility.js';

export class Mark
{
    static instance=null;
    constructor(scene)
    {
        Mark.instance=this;
        this.scene = scene;
        this._sp = sprite(scene,{icon:GM.ICON_MARK,name:'mark'})
        this._sp.setScale(0.5);
        this._sp.visible=false;
        //this._sp.setDisplaySize(32,32);
        this._sp.setDepth(Infinity);
    }

    //set visible(value) {this._sp.visible = value;}
    static set visible(value) 
    {
        Mark.instance&&(Mark.instance._sp.visbile=value);
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

    static show(p,color) {Mark.instance?.show(p,color);}

    static close() {Mark.instance?.hide();}

}