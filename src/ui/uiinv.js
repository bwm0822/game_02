import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Ui from './uicommon.js'
import {Slot, EquipSlot, Doll} from './uiclass.js'
// import UiCover from './uicover.js'
// import UiCursor from './uicursor.js'

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
            space:UI.SPACE.FRAME,
        }

        super(scene, config, UI.TAG.INV);
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

    // i 是 owner.equips 的索引，3(手套)目前不顯示
    addEquips(scene)
    {
        const S = GM.SLOT_SIZE, sp = 5;
        const slots = [];
        const equip = (p, i, cat)=>
        {
            const slot = new EquipSlot(scene, S, S, i, {cat:cat});
            p.add(slot);
            slots.push(slot);
        }

        // 靠左才會跟背包格子同欄(背包右邊多了捲軸)
        const p = ui.uPanel.call(this, scene, {orientation:'y', bg:UI.BG.BORDER, space:{...UI.SPACE.LRTB_5, item:sp}, ext:{align:'left'}});
        const top = ui.uPanel.call(p, scene, {orientation:'x', space:{item:sp}});
        const left = ui.uPanel.call(top, scene, {orientation:'y', space:{item:sp}});
        equip(left, 1, GM.CAT.HELMET);
        equip(left, 2, GM.CAT.CHESTPLATE);
        equip(left, 4, GM.CAT.BOOTS);
        const mid = ui.uPanel.call(top, scene, {orientation:'y', space:{item:sp}});
        this._doll = new Doll(scene, S*3+sp*2, S*2+sp);
        mid.add(this._doll);
        const bottom = ui.uPanel.call(mid, scene, {orientation:'x', space:{item:sp}});
        equip(bottom, 0, GM.CAT.WEAPON);
        ui.uRect.call(bottom, scene, {width:S, height:S});
        equip(bottom, 8, GM.CAT.EQUIP|GM.CAT.BAG);
        const right = ui.uPanel.call(top, scene, {orientation:'y', space:{item:sp}});
        equip(right, 5, GM.CAT.NECKLACE);
        equip(right, 6, GM.CAT.RING);
        equip(right, 7, GM.CAT.RING);

        this._equips = {loop:(cb)=>{slots.forEach(cb);}};
        return this;
    }

    addBag(scene)
    {
        this._bag = ui.uStorage.call(this, scene, {column:5, row:4});
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

    init(owner)
    {
        const addItem = (i) => new Slot(this.scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);
        this._bag.init(addItem, owner.storage);
        this.refresh();
        this.layout();
    }

    filter(conds)
    {
        this._equips.loop(slot=>slot?.filter(conds));
        this._bag.loop(slot=>slot?.filter(conds));  
        this.refresh(); 
    }

    // 檢查所有裝備欄位，符合類別的裝備欄位，背景設置為 COLOR_SLOT_DRAG，否則設置為 COLOR_SLOT
    checkEquipSlots(cat)  
    {
        this._equips.loop(elm => {elm?.checkIfSameCat(cat);});
    }

    refresh()
    {
        const owner=this.owner;
        this._equips.loop((elm)=>elm?.update(owner));
        this._doll.update(owner);
        this._bag.loop((elm)=>elm?.update(owner));
        this._gold.setText(`[color=yellow][img=gold][/color] ${owner.gold}`)
    }

    toggle(owner)
    {
        if(this.visible) {this.close();}
        else {this.show(owner);}
    }

    close()
    {
        super.close();
        this.unregister()
        this.closeAll(GM.UI_LEFT);
        Ui.setMode(GM.UI_MODE_NORMAL);
        // UiCover.close();
        // UiCursor.set();
        Ui.off(UI.TAG.COVER);
        Ui.get(UI.TAG.CURSOR).set();
        this.clrCamera(GM.CAM_LEFT);
    }

    show(owner,conds=[])
    {
        if(this.visible) {return;}
        super.show();
        this.owner=owner;
        this.init(owner);
        this.filter(conds); //呼叫 filter() 之前，至少要先執行過一次 refresh()
        this.closeAll(GM.UI_RIGHT);
        this.register(GM.UI_RIGHT);
        this.setCamera(GM.CAM_LEFT);
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
    static toggle(owner) {this.instance?.toggle(owner);}
    static checkEquipSlots(cat) {this.instance?.checkEquipSlots(cat);}
    static filter(conds) {this.instance?.filter(conds);}
}

