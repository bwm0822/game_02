import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI_STYLE} from '../setting.js'
import Ui from './uicommon.js'
import {Slot, EquipSlot} from '../ui.js'

export default class UiInv extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w,
            y : 0,
            width : 100,
            height : 100,
            orientation : 'y',
            space : {left:10,right:10,bottom:10,item:0},
        }

        super(scene, config, 'UiInv_1');
        UiInv.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'bag')
            .addEquips(scene)
            .addGold(scene)
            .addBag(scene)
            .setOrigin(1,0)
            .layout()
            .hide()
    }

    addEquips(scene)
    {
        const cats=[
            GM.CAT_WEAPON, GM.CAT_HELMET, GM.CAT_CHESTPLATE, GM.CAT_GLOVES,GM.CAT_BOOTS, 
            GM.CAT_NECKLACE, GM.CAT_RING, GM.CAT_RING, GM.CAT_EQUIP|GM.CAT_BAG
        ];

        const equip = (i)=>
        {
            if(i>=cats.length) return;
            let cat=cats[i];
            return new EquipSlot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i, {cat:cat});
        }

        this._equips = ui.uGrid.call(this,scene,{column:5, row:2, addItem:equip});
        return this;
    }

    addBag(scene)
    {
        const slot = (i)=>{return new Slot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);}

        this._bag = ui.uGrid.call(this,scene,{column:5,row:4,addItem:slot});
        return this;
    }

    addGold(scene)
    {
        const p = ui.uPanel.call(this, scene, {
            bg: UI_STYLE.BORDER,
            space: 5,
            ext: {expand:true}  
        });
        let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
        let text = `[color=yellow][img=gold][/color] ${0}`
        this._gold = ui.uBbc.call(p, scene, {text:text,images:images});
        return this;
    }

    // 檢查所有裝備欄位，符合類別的裝備欄位，背景設置為 COLOR_SLOT_DRAG，否則設置為 COLOR_SLOT
    checkEquipSlots(cat)  
    {
        this._equips.loop(elm => {elm?.checkIfSameCat(cat);});
    }

    refresh()
    {
        this._equips.loop((elm)=>elm?.update(this._owner));
        this._bag.loop((elm)=>elm?.update(this._owner));
        this._gold.setText(`[color=yellow][img=gold][/color] ${this._owner.gold}`)
    }

    toggle(owner)
    {
        if(this.visible) {this.close();}
        else {this.show(owner);}
    }

    close()
    {
        super.close();
        this.unregister();
        Ui.closeAll(GM.UI_LEFT);
    }

    show(owner)
    {
        super.show();
        this._owner=owner;
        this.refresh();
        this.register(GM.UI_RIGHT);
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
    static toggle(owner) {this.instance?.toggle(owner);}
    static checkEquipSlots(cat) {this.instance?.checkEquipSlots(cat);}
}

