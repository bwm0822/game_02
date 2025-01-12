import {FixWidthSizer, OverlapSizer, Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {UI, sprite, text, rect} from './uibase.js';
import Utility from './utility.js';

export class Mark
{
    constructor(scene)
    {
        //this._icons = {go:ICON_GO, talk:ICON_TALK, enter:ICON_ENTER, exit:ICON_EXIT, take:ICON_TAKE}
        this._sp = sprite(scene,{icon:UI.ICON_MARK,name:'mark'})
        this._sp.setScale(0.5);
        this._sp.visible=false;
        //this._sp.setDisplaySize(32,32);
        this._sp.setDepth(Infinity);
    }

    set visible(value) {this._sp.visible = value;}

    show(p,color=0xffffff)
    {
        this.visible=true;
        this._sp.x=p.x;
        this._sp.y=p.y;
        this._sp.setTint(color);
    }

    hide()
    {
        this.visible=false;
    }

}