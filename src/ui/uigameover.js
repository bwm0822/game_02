import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'



export default class UiGameOver extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : GM.w,
            height : GM.h,
        }

        super(scene, config , UI.TAG.GAMEOVER)
        UiGameOver.instance=this;

        this.addBg(scene,{color:GM.COLOR_BLACK,alpha:0.5,ondown:this.ondown.bind(this)})
            .addSpace()
            .add(ui.uBbc(scene,{text:'GameOver',fontSize:64}),{align:'bottom',padding:{bottom:GM.h/4}})
            .addSpace()
            .layout()
            .hide()
            // .unit_test()
    }

    unit_test()
    {
        this.show();
    }

    ondown() { this.close().send('restart'); }

    show()
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0, to:1},
            duration: 1000,
        })
    }

    static show() {this.instance?.show();}
}