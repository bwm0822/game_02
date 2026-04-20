import UiFrame from "./uiframe.js"
import {uButton} from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js';
import Record from '../infra/record.js'

const WIDTH=250;
export default class UiButtons extends UiFrame
{
    static instance = null;

    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            // width : 100,
            // height : 100,
            orientation : 'y',
            // space:{...UI.SPACE.LRTB.p10,item:10},
            cover: true,
        }

        super(scene, config, UI.TAG.BUTTONS);
        UiButtons.instance = this;

        this.addBg(scene,{color:GM.COLOR.DARK,...UI.BG.BORDER})
            .layout()
            .hide()
    }

    show(elm,options) 
    {
        super.show();
        const b=Utility.getBound(elm);
        const [x,y]=[b.x,b.y];

        this.removeAll(true)

        options.forEach(opt=>{
            uButton.call(this, this.scene, {style:UI.BTN.OPTION,text:opt.text,
                                            onclick:()=>{opt.onclick();this.close();},
                                            ext:{expand:true}})
        })
        
        this.setOrigin(0.5,1)
        this.setPosition(b.x,b.t).rePos();
    }

}