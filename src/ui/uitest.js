import UiFrame from './uiframe.js'
import {GM,UI} from '../setting.js'
import * as ui from './uicomponents.js'


export default class UiTest extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x: GM.w/2,
            y: GM.h/2,
            width: 300,
            height : 200,
            orientation: 'y',

            space: {item:20},
            // cover: {interactive:true, alpha:0.5},
        }
        super(scene, config, UI.TAG.TEST);
        UiTest.instance = this;
        this.addBg(scene,{color:GM.COLOR.PRIMARY,...UI.BG.BORDER_DARK})
            .addTop(scene)
            .test()

    }

    test()
    {
        const chk = ui.uButton.call(this, this.scene, {text:'check', style:UI.BTN.CHECK,ext:{align:'left'}});
        const dp=ui.uDropdown.call(this,this.scene,{ext:{align:'left'}});
        dp.setValue('us');
        this.layout();
    }
}