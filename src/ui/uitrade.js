import UiFrame from "./uiframe"
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import {Slot} from './uiclass.js'


export default class UiTrade extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            // width : 500,
            // height : 500,
            orientation : 'y',
            space:UI.SPACE.FRAME,
        }

        super(scene, config, UI.TAG.TRADE);
        UiTrade.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'trade')
            .addInfo(scene)
            .addGold(scene)
            .addBag(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addInfo(scene)
    {
        const p = ui.uPanel.call(this, scene, {
                    bg:UI.BG.BORDER,
                    height:50,
                    space:UI.SPACE.LRTBI_10,
                    ext:{expand:true}
                })
        const pic = ui.uPic.call(p,scene,{w:GM.PORTRAITS_W,h:GM.PORTRAITS_H,icon:'portraits/0'})
        const bbc = ui.uBbc.call(p,scene,{text:'阿凡達\n精靈',ext:{align:'top'}})

        // 操作介面
        p.setIcon = (owner)=>{pic.setIcon(owner.icon);}
        p.setDes = (owner)=>{bbc.setText(`${owner.id.lab()}\n${owner.job?.lab()}`);}
        this._info=p;

        return this;
    }

    addGold(scene)
    {
        const p = ui.uPanel.call(this, scene, {
            bg: UI.BG.BORDER,
            space: 5,
            ext: {expand:true}  
        });
        const images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
        const text = `[color=yellow][img=gold][/color] ${0}`
        this._gold = ui.uBbc.call(p, scene, {text:text,images:images});
        return this;
    }

    addBag(scene)
    {
        const slot = (i)=>{return new Slot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);}

        this._bag = ui.uGrid.call(this,scene,{column:5,row:6,addItem:slot});
        return this;
    }

    updateInfo()
    {
        const owner=this.owner;
        this._info.setIcon(owner)
        this._info.setDes(owner)
    }

    refresh()
    {
        const owner=this.owner;
        this._bag.loop((elm)=>elm?.update(owner));
        this._gold.setText(`[color=yellow][img=gold][/color] ${owner.gold}`)
    }

    close()
    {
        this.owner.stopTrade();
        super.close();
        this.unregister();
        this.clrCamera(GM.CAM_RIGHT);
    }

    show(owner)
    {
        super.show();
        this.owner=owner;
        this.updateInfo();
        this.refresh();
        //
        this.closeAll(GM.UI_LEFT);
        this.register(GM.UI_LEFT);
        this.setCamera(GM.CAM_RIGHT);
        this.on(UI.TAG.INV, this.player);
    }

    static show(owner) {this.instance?.show(owner);} 

}