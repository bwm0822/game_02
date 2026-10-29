import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {Doll} from './uiclass.js'
import UiConfirm from './uiconfirm.js'
import {GM,UI} from '../core/setting.js'
import DB from '../data/db.js'
import Record from '../infra/record.js'

//--------------------------------------------------
// 新遊戲的選角面板（主選單用）：可選角色是 role.json 裡 kind:'player' 的角色
//--------------------------------------------------
export default class UiSelect extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x : GM.w/2,
            y : GM.h/2,
            orientation : 'y',
            space:UI.SPACE.FRAME,
            cover:{alpha:0.5},
        }

        super(scene, config, UI.TAG.SELECT);
        UiSelect.instance = this;
        this._ids = DB.playerIds();
        this.addBg(scene)
            .addTop(scene, 'select_role')
            .addMain(scene)
            .addStart(scene)
            .layout()
            .hide()
    }

    addMain(scene)
    {
        const space = UI.SPACE.LRTBI_5;
        const p = ui.uPanel.call(this, scene, {space:{item:10}, ext:{expand:true}});

        const pL = ui.uPanel.call(p, scene, {bg:UI.BG.BORDER, orientation:'y', space, width:120,
                                                ext:{expand:true}});
        this._btns = this._ids.map(id=>ui.uButton.call(pL, scene, {text:DB.role(id).lab, style:UI.BTN.ITEM,
                                                onclick:()=>this.select(id), ext:{expand:true}}));

        const pR = ui.uPanel.call(p, scene, {bg:UI.BG.BORDER, orientation:'y', space,
                                                ext:{expand:true, proportion:1}});
        this._doll = new Doll(scene, 160, 200);
        pR.add(this._doll);
        this._des = ui.uDes.call(pR, scene, {text:'', wrapWidth:240});
        this._stats = ui.uPanel.call(pR, scene, {orientation:'y', width:240, ext:{expand:true}});
        return this;
    }

    addStart(scene)
    {
        ui.uButton.call(this, scene, {text:'start'.lab(), onclick:()=>this.start(), ext:{align:'right'}});
        return this;
    }

    select(id)
    {
        this._id = id;
        this._btns.forEach((btn,i)=>btn.setValue(this._ids[i]===id));

        const dat = DB.role(id);
        this._doll.update({bb:{meta:dat}, equips:dat.inv?.equips});
        this._des.setText(`${dat.lab}  ${dat.job?.lab() ?? ''}\n${dat.des ?? ''}`);
        this._stats.removeAll(true);
        const add = (key,val)=>{ui.uStat.call(this._stats, this.scene, key.lab(), val ?? 0, {interactive:false});};
        GM.BASE.forEach(key=>add(key, dat.attrs?.[key] ?? GM.BASE_DEF[key]));
        add('gold', dat.gold);
        this.layout();
    }

    async start()
    {
        if(Record.hasGame() && !await UiConfirm.msg('overwrite_save'.lab())) {return;}
        Record.newGame(this._id);
        this.scene.scene.start('Game');
    }

    show()
    {
        super.show();
        this.select(this._id ?? this._ids[0]);
    }

    static show() {this.instance?.show();}
}
