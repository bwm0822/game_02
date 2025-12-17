import UiFrame from './uiframe.js'
import {GM,UI} from '../setting.js'
import * as ui from './uicomponents.js'


export default class UiConfirm extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 250,
            orientation : 'y',
            space: {...UI.SPACE.LRTB.p10,item:20},
            cover: {interactive:true, alpha:0.5},
        }
        super(scene, config, UI.TAG.COUNT);
        UiConfirm.instance = this;
        this.addBg(scene,{color:GM.COLOR.PRIMARY,...UI.BG.BORDER_DARK})
            .addMsg(scene)
            .addButtons(scene)
            .layout()
            .hide()
        
        // this.unit_test()
    }

    async unit_test()
    {
        const ret = await this.show('測試');
        console.log(ret)
    }

    addMsg(scene)
    {
        this._msg = ui.uBbc.call(this,scene,{text:'123'})
        return this;
    }

    addButtons(scene)
    {
        const p = ui.uPanel(scene);        
        p.add(ui.uButton(scene,{text:'❌',
                        onclick:this.cancle.bind(this)} ))
            .addSpace()
            .add(ui.uButton(scene,{text:'✔️',
                            onclick:this.confirm.bind(this)} ))
        this.add(p,{expand:true});
        return this;
    }

    cancle()
    {
        this._resolve(false);
        this.close();   
    }

    confirm()
    {
        this._resolve(true);
        this.close();
    }

    show(msg)
    {
        super.show();
        this._msg.setText(msg);
        this.layout();
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    static msg(msg) {return this.instance?.show(msg);}
}