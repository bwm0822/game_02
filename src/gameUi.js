import {FixWidthSizer, OverlapSizer, Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {UI, sprite, text, rect} from './uibase.js';
import Utility from './utility.js';

export class Mark
{
    static instance=null;
    constructor(scene)
    {
        Mark.instance=this;
        this._sp = sprite(scene,{icon:UI.ICON_MARK,name:'mark'})
        this._sp.setScale(0.5);
        this._sp.visible=false;
        //this._sp.setDisplaySize(32,32);
        this._sp.setDepth(Infinity);
    }

    //set visible(value) {this._sp.visible = value;}
    static set visible(value) 
    {
        if(Mark.instance){console.log('mark',value)}
        Mark.instance&&(Mark.instance._sp.visbile=value);
    }

    show(p,color=0xffffff)
    {
        this._sp.visible=true;
        this._sp.x=p.x;
        this._sp.y=p.y;
        this._sp.setTint(color);
    }

    hide()
    {
        this._sp.visible=false;
    }

    static show(p,color) {Mark.instance?.show(p,color);}

    static hide() {Mark.instance?.hide();}

}