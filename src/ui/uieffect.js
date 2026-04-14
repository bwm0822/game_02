import UiFrame from './uiframe.js'
import {GM,UI} from '../core/setting.js'
import {DEBUG,DBG} from '../core/debug.js'
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
        const config = 
        {
            width : (50+5)*10,
            orientation : 'x',
            align : 'center',
            space: {top:0, item:5, line:5},
        }
        this._main = ui.uFix.call(this, scene, config);
        return this;
    }

    findEff(id)
    {
        return this._main.getElement('items').find(elm=>elm.dat.id===id);
    }
    
    addEff(effect)
    {
        const elm = new Effect(this.scene,50,50,effect);
        this._main.add(elm);
        return elm;
    }

    refresh()
    {
        this._main.removeAll(true);

        const actives = this.player?.actives;
        if(actives)
        {
            actives.forEach(eff=>{
                if(eff.icon)
                {
                    const found = this.findEff(eff.id);
                    if(!found) {this.addEff(eff);}
                    else {found.set(eff);}
                }
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