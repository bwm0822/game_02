import UiFrame from './uiframe.js'
import {GM,UI} from '../core/setting.js'
import * as ui from './uicomponents.js'


export default class UiCount extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x: GM.w/2,
            y: GM.h/2,
            width: 300,
            height : 100,
            orientation: 'y',
            space: {...UI.SPACE.LRTB.p10,item:20},
            cover: {interactive:true, alpha:0.5},
        }
        super(scene, config, UI.TAG.COUNT);
        UiCount.instance = this;
        this.addBg(scene,{color:GM.COLOR.PRIMARY,...UI.BG.BORDER_DARK})
            .addSlider(scene)
            .addButtons(scene)
            .layout()
            .hide()

        // this.unit_test();
    }

    async unit_test()
    {
        const ret = await this.show(1,8,5);
        console.log(ret);
    }

    addSlider(scene)
    {
        // this._slider = ui.uValueSlider.call(this,scene)
        this._slider = ui.uSlider.call(this,scene)
        return this;
    }

    addButtons(scene)
    {
        const p = ui.uPanel(scene);        
        p.add(ui.uButton(scene,{text:'❌',
                                onclick:this.cancle.bind(this)
                        }))
            .addSpace()
            .add(ui.uButton(scene,{text:'✔️',
                            onclick:this.confirm.bind(this)
                        }))
        this.add(p,{expand:true});
        return this;
    }

    cancle()
    {
        this._resolve(0);
        this.close();   
    }

    confirm()
    {
        this._resolve(this._slider.value);
        this.close();
    }

    show(min,max)
    {
        super.show();
        this._slider.setRange(min,max);
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    static getCount(min,max) {return this.instance.show(min,max);}
}