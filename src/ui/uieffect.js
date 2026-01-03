import UiFrame from './uiframe.js'
import {GM,UI,DEBUG,DBG} from '../core/setting.js'
import * as ui from './uicomponents.js'
import {Effect} from './uiclass.js'

export default class UiEffect extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : 0,
            // width : 500,
            // height : 50,
            orientation : 'y',
            // space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, UI.TAG.EFFECT);
        UiEffect.instance = this;
        this.setOrigin(0.5,0)
        this.addMain(scene)
            .layout()
            .hide()
            // .unit_test(scene)

    }

    unit_test(scene)
    {
        const elm=()=>{return ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY})}
        super.show()
        this._main.add(elm()).add(elm()).add(elm())
                    .add(elm()).add(elm()).add(elm())
                    .add(elm()).add(elm()).add(elm())
                    .add(elm()).add(elm())
        this.layout()
    }

    addMain(scene)
    {
        let config = 
        {
            width : (50+5)*10,
            orientation : 'x',
            align : 'center',
            space: {top:0, item:5, line:5},
        }
        this._main = ui.uFix.call(this, scene, config);
        return this;
    }

    refresh()
    {
        this._main.removeAll(true);

        // let effects = this.getOwner()?.rec?.activeEffects;
        let effects = this.player?.actives;
        if(effects)
        {
            effects.forEach(effect=>{
                if(effect.icon){this._main.add(new Effect(this.scene,50,50,effect));}
            })
        }

        this.layout();
    }

    show()
    {
        super.show();
        this.register(GM.UI_TOP);
        this.refresh()
    }

    static show() {this.instance?.show();}

    static close() {this.instance?.close(true);}
}