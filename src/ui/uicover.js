import UiFrame from './uiframe.js'
import {GM,UI} from '../setting.js'
import * as ui from './uicomponents.js'

export default class UiCover extends UiFrame
{
    constructor(scene)
    {
        const config=
        {
            width: GM.w,
            height : GM.h,
        }
        super(scene, config, UI.TAG.COVER);
        UiCover.instance = this;

        this.addBg(scene,{color:GM.COLOR_DARK,alpha:0.5})
            .setOrigin(0)
            .layout()
            .hide()

        // this.setInteractive()
        //     .on('pointerdown',()=>{UiDragged.drop();})
        this.setInteractive();
        this._cnt=0;
    }

    show()
    {
        super.show();
        this._cnt++;
    }

    close()
    {
        if(--this._cnt<=0)
        {
            this.hide();
            this._cnt=0;
        }
    }

    static show() {this.instance?.show();}
    static close() {this.instance?.close();}
}