import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'

export default class UiChangeScene extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x : 0,
            y : 0,
            width : GM.w,
            height : GM.h,
        }

        super(scene, config , UI.TAG.CHANGESCENE)
        UiChangeScene.instance=this;

        this.addBg(scene,{color:GM.COLOR_BLACK,alpha:1})
            .setOrigin(0)
            .layout()
            .hide()
    }

    start(gotoScene, duration=GM.T_CHANGE_SCENE)
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0,to:1},
            duration: duration,
            onComplete: ()=>{gotoScene();this._t = this.scene.time.now;}
        })
    }

    done()
    {
        this.close();
    }

    static done() {this.instance?.done();}
    static start(changeScene) {this.instance?.start(changeScene);}

}


