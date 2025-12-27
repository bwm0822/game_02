import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import ContainerLite from 'phaser3-rex-plugins/plugins/containerlite.js';
import Utility from './utility.js';
import {rect, divider, sprite, text, bbcText, Pic, Icon, bar, progress, progress_text, scrollBar, label, slider, dropdown, vSpace} from './uibase.js';
import {GM, ACT_TYPE, UI} from './setting.js';

import DB from './db.js';
import {Mark} from './gameUi.js';
import TimeManager from './time.js';
import Record from './record.js';
import QuestManager from './quest.js';

import InventoryService from './services/inventoryService.js'
import PressService from './services/pressService.js'
import DragService from './services/dragService.js'

import {getPlayer} from './roles/player.js'
import Ui from './ui/uicommon.js'

import UiStorage from './ui/uistorage.js'
import UiQuest from './ui/uiquest.js'
import UiMain from './ui/uimain.js'
import UiOption from './ui/uioption.js'
import UiInv from './ui/uiinv.js'
import UiProfile from './ui/uiprofile.js'
import UiDialog from './ui/uidialog.js'
import UiTrade from './ui/uitrade.js'

import UiInfo from './ui/uiinfo.js'
import UiObserve from './ui/uiobserve.js'
import UiCount from './ui/uicount.js'
import UiConfirm from './ui/uiconfirm.js'
import UiAbility from './ui/uiability.js'
import UiDebuger from './ui/uidebuger.js'
import UiCursor from './ui/uicursor.js'
import UiEffect  from './ui/uieffect.js'
import UiTime  from './ui/uitime.js'
import UiMessage  from './ui/uimessage.js'
import UiChangeScene  from './ui/uichangescene.js'
import UiGameOver  from './ui/uigameover.js'
import UiManufacture  from './ui/uimanufacture.js'

import UiTest from './ui/uitest.js'


let uiScene;
let _mode = 0;


function getSuper(obj) 
{
  let proto = Object.getPrototypeOf(Object.getPrototypeOf(obj));
  return proto;
}

function getRoot(obj) 
{
  let proto = Object.getPrototypeOf(obj);        // Avatar.prototype
  while (Object.getPrototypeOf(proto)) {         // 繼續往上爬
    proto = Object.getPrototypeOf(proto);
  }
  
  return proto; // 這會是 Object.prototype
}

export default function createUI(scene)
{
    console.log('createUI');
    GM.w = scene.sys.canvas.width;
    GM.h = scene.sys.canvas.height;
    uiScene = scene;
    console.log('resolution:',GM.w, GM.h)

    PressService.bindToScene(scene);
    DragService.init(scene);

    new UiCover(scene);             // 1
    new UiAbility(scene);
    new UiMain(scene);              // 2
    new UiEffect(scene);

    new UiTime(scene);              // 19
    new UiManufacture(scene);       // 3
    new UiProfile(scene);           // 4
    new UiCursor(scene);            // 5
    new UiInv(scene);               // 6
    new UiTrade(scene);             // 7
    new UiStorage(scene);           // 8
    new UiQuest(scene);              // 20
    new UiDialog(scene);            // 9
    new UiObserve(scene);           // 10
    new UiCount(scene);             // 11
    new UiDragged(scene, 80, 80);   // 12
    new UiInfo(scene);              // 13
    new UiOption(scene);            // 14
    new UiMessage(scene);           // 15
    new UiGameOver(scene);          // 16
    new UiChangeScene(scene);       // 17
    new UiDebuger(scene);           // 18
    
    new UiConfirm(scene);

    // new UiManufacture_1(scene);
    // new UiTest(scene);

    test();

}

function test()
{
    let str = "#var:def";
    let [c, v, d] = str.split(/[:#]/);
    console.log(c??v??d);
    console.log(`c:${c}, v:${v}, d:${d}`); // var def

    str = "#var";
    [c, v, d] = str.split(/[:#]/);
    console.log(c??v??d);
    console.log(`c:${c}, v:${v}, d:${d}`); // var def

    
    str = "var";
    [c, v, d] = str.split(/[:#]/);
    console.log(c??v??d);
    console.log(`c:${c}, v:${v}, d:${d}`); // var def
}

function setCamera(mode) 
{
    _mode |= mode;
    uiScene.events.emit('camera',_mode);
}

function clrCamera(mode) 
{
    _mode &= ~mode;
    uiScene.events.emit('camera',_mode);
}

function clearpath() {uiScene.events.emit('clearpath');}


export class Slot extends Icon
{
    constructor(scene, w, h, i, config)
    {
        super(scene, w, h, config);
        this.add(bar(scene,{width:0,height:5,value:0}),{key:'bar',align:'bottom',expand:{width:true},offsetY:5});
        this.add(progress(scene,{width:0,height:5,value:0}),{key:'progress',align:'bottom',expand:{width:true},offsetY:5});
        this.add(bbcText(scene,{text:'',fontSize:16, lineSpacing:-8,color:'#fff', stroke:'#000', strokeThickness:5}),{key:'times',align:'left-bottom',expand:false,offsetY:10,offsetX:0});
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK, radius:config?.radius??0, alpha:0.6}),'disabled');
        this.getElement('disabled').fillAlpha=0;
        this._i = i;
        this.addListener();
    }

    get i() {return this._i;}
    get cps() {return this.dat.cps;}
    get count() {return this.content.count;}
    set count(value) {return this.content.count=value;}
    get props() {return this.dat.props;}
    get label() {return this.content.id.lab();}
    get tp() {return GM.IF_SLOT;}

    get id() {return this.content?.id;}
    // content
    get content() {return this.owner.storage.items[this._i];}
    set content(value) {this.owner.storage.items[this._i]=value; this.setSlot(value);}
    // dat
    get dat() {return this._dat;}
    set dat(value) {return this._dat=value;}
    // cat
    get cat() {return GM.CAT_ALL;}
    set cat(value) {}
    get isValid() {return UiDragged.checkCat(this.cat)&&this.dropable;}
    // others
    get gold() {return this.content.count*this.dat.gold;}

    get isEmpty() {return Utility.isEmpty(this.content)||this.content.count==0;}
    get capacity() {return this.owner?.storage?.capacity; }

    get storage() {return this.content.storage;}

    get acts()
    {
        let acts = {};
        // console.log('useable',this.dat.useable,this.dat)

        console.log(this.owner)

        if(this.owner.tradeType)    // 交易
        {
            if(this.owner.tradeType == GM.BUYER) {acts = {'sell':true,'drop':true};}
            else {acts = {'buy':true};}
            if(this.content.count>1) {acts = {...acts,'split':true};}
        }
        else
        {
            if(this.dat.useable) 
            {
                if(this.content?.times===0 || this.content?.capacity===0)
                    acts = {...acts,'use':false};
                else
                    acts = {...acts,'use':true};
            }

            if(this.owner.target) // 打開箱子
            {
                acts = {...acts,'transfer':true,'drop':true};
                if(this.content.count>1) {acts = {...acts,'split':true};}
                else if(this.content.storage) {acts = {...acts,'openbag':false};}
            }
            else 
            {
                if(this.content.count>1) {acts = {...acts,'drop':true,'split':true};}
                else if(this.dat.storage) {acts = {...acts,'drop':true,'openbag':true};}
                else {acts = {...acts,'drop':true};}
            }
        }

        return acts;
    }

    get trading() {return this.owner.tradeType !== UiDragged.owner.tradeType;}
    get enabled() {return this.capacity==-1 || this._i<this.capacity;}
    get dropable() {return true;}

    p(prop) // content,dat 有可能會是 null/undefined (例如:EquipSlot的第10個)
    {
        let [p,sub] = prop.split('.');
        return sub ? this.content?.[p]?.[sub] != undefined ? this.content[p][sub] 
                                                        : this.dat?.[p]?.[sub]
                    : this.content?.[p] != undefined ? this.content[p] 
                                                    : this.dat?.[p];
    }  

    fill(p) {if(this.dat[p] != undefined) {this.content[p] = this.dat[p].max;}}

    setSlot(content)
    {
        this.dat = DB.item(content?.id);
        this.setIcon(this.dat?.icon,{alpha:content?.count>0?1:0.25});
        this.setCount(content?.count>1?content.count:'');

        this.setBar(false);
        this.setProgress(false);
        this.setTimes(false);

        if(this.dat) 
        { 
            const fmap = {  [GM.ENDURANCE] : this.setBar.bind(this),
                            [GM.CAPACITY] : this.setProgress.bind(this),
                            [GM.TIMES] : this.setTimes.bind(this),
                            [GM.STORAGE] : null        };

            Object.keys(fmap).forEach(key=>{
                if(this.dat[key])
                {
                    if(content[key]===undefined) 
                    {
                        content[key]=key===GM.STORAGE ? {capacity:this.dat[key],items:[]}
                                                        : this.dat[GM.DFT]??this.dat[key];
                    }
                    fmap[key]?.(true, content[key], this.dat[key]);
                }
            })
        }
    }

    setBar(visible, cur, max)
    {
        let elm = this.getElement('bar');
        elm.visible = visible;
        if(visible) {elm.setValue(cur/max);}
    }

    setProgress(visible, cur, max)
    {
        let elm = this.getElement('progress');
        elm.visible = visible;
        if(visible) 
        {
            elm.setValue(cur/max);
        }
    }

    setTimes(visible, cur, max)
    {
        let elm = this.getElement('times');
        elm.visible=visible;
        if(visible) 
        {
            let times = '';
            for(let i=0;i<max;i++) 
            {
                times += cur>i?'■':'□';
                if(i%6==5 && i!=max-1) {times += '\n';}
            }
            elm.setText(times);
            this.layout();  // 長度會改變，所以要加 layout()
        }

    }

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{
            if (pointer.rightButtonDown()) {this.rightButtonDown(x,y);}
            else if(pointer.middleButtonDown()) {}
            else {this.leftButtonDown(x,y);}
        })
        .on('dragleave', (pointer,gameObject)=>{this.leave(gameObject);})
        .on('dragenter', (pointer,gameObject)=>{this.enter(gameObject);})
        // .on('pointerup', (pointer,x,y)=>{
        //     if(pointer.middleButtonUp())
        //     {
        //         //console.log('middle');
        //         UiOption.show(this.x-this.width/2+x,this.y-this.height/2+y);
        //     }
        // })
        // .on('dragstart',(pointer)=>{this.dragStart();})
        // .on('drag',(pointer,x,y)=>{this.drag(x,y);})
        // .on('dragend', (pointer,x,y,dropped)=>{this.dragend(x,y,dropped);})
        // .on('dragenter', (pointer,gameObject)=>{this.dragenter(gameObject);})
        // .on('dragleave', (pointer,gameObject)=>{this.dragleave(gameObject);})
        // .on('dragover', (pointer,gameObject)=>{console.log('dragover',gameObject);})
        // .on('drop', (pointer,gameObject)=>{this.drop(gameObject);})
    }

    setBgColor(color) {this.getElement('background').fillColor = color;}

    update(owner,cat)
    {
        owner && (this.owner=owner);
        cat && (this.cat=cat);  // for MatSlot
        this.setSlot(this.content);
        this.setEnable(this.enabled);
    }

    setEnable(on)
    {
        if(on)
        {
            this.setInteractive({draggable:true,dropZone:true});
            this.getElement('disabled').fillAlpha=0;
        }
        else
        {
            this.disableInteractive();
            this.setBgColor(GM.COLOR_SLOT);
            this.getElement('disabled').fillAlpha=0.6;
        }
    }

    empty() {super.empty();this.content=null;this.dat=null;}
    
    over(checkEquip=true)
    {
        if(this.dropable && UiDragged.isSlot)
        {
            if(this.trading)
            {
                if(this.isEmpty)
                {
                    this.setBgColor(this.isValid ? GM.COLOR_SLOT_TRADE : GM.COLOR_SLOT_INVALID);
                }
                else
                {
                    this.setBgColor(GM.COLOR_SLOT_DISABLE);
                }
            }
            else
            {
                this.setBgColor(this.isValid ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT_INVALID);
            }
        }
        else if(!this.isEmpty && !UiDragged.isAbility)
        {
            this.setBgColor(GM.COLOR_SLOT_OVER);

            // 使用 delacyCall 延遲執行 UiInfo.show()
            Ui.delayCall(() => {UiInfo.show(UI.INFO.SLOT,this);}); 
            // 檢查裝備欄位，符合類別的裝備，設置背景顏色為 COLOR_SLOT_DRAG，否，設置為 COLOR_SLOT
            checkEquip && UiInv.checkEquipSlots(this.dat.cat);
        }
    }

    out(checkEquip=true)
    { 
        Ui.cancelDelayCall();    
        this.setBgColor(GM.COLOR_SLOT);
        UiInfo.close();
        // 將裝備欄位的背景顏色設置為 COLOR_SLOT
        checkEquip && UiInv.checkEquipSlots(null);   
    }

    leave(gameObject)
    {
        UiDragged.on && gameObject.setBgColor(GM.COLOR_SLOT);
    }

    enter(gameObject)
    {
        UiDragged.on && this.noTrade && gameObject.setBgColor(GM.COLOR_SLOT_DRAG);
    }

    rightButtonDown(x,y)
    {
        // if(!this.isEmpty) {UiOption.show(this.left+x-20,this.top+y-20, this.acts, this);}
        if(!this.isEmpty) {UiOption.show(this.left+x+20,this.top+y-20, this.acts, this);}
    }

    leftButtonDown(x,y)
    {
        DragService.onSlotDown(this, x, y);
    }

}

export class EquipSlot extends Slot
{
    static cat2Icon(cat)
    {
        switch(cat)
        {
            case GM.CAT_WEAPON: return GM.ICON_WEAPON;
            case GM.CAT_HELMET: return GM.ICON_HELMET;
            case GM.CAT_CHESTPLATE: return GM.ICON_CHESTPLATE;
            case GM.CAT_GLOVES: return GM.ICON_GLOVES;
            case GM.CAT_BOOTS: return GM.ICON_BOOTS;
            case GM.CAT_NECKLACE: return GM.ICON_NECKLACE;
            case GM.CAT_RING: return GM.ICON_RING;
            case GM.CAT_EQUIP|GM.CAT_BAG: return GM.ICON_BAG;
        }
    }

    constructor(scene, w, h, i, config)
    {
        super(scene, w, h, i, config);
        this._cat = config?.cat;
        this.setIcon();
    }

    get capacity() {return -1;}

    get cat() {return this._cat;}

    get isEquip() {return true;}

    // get, set 都要 assign 才會正常 work
    get content() {return this.owner.equips[this._i];}
    set content(value) {this.owner.equips[this._i]=value; this.setSlot(value); this.owner.equip();}

    _isSameCat(cat)   {return (this.cat & cat) == cat;}  

    over() {super.over(false);}
    out() {super.out(false);}

    // 檢查裝備欄位，是否有是符合類別的裝備，是，設置背景顏色為 COLOR_SLOT_DRAG，否，設置為 COLOR_SLOT
    checkIfSameCat(cat)
    {
        this.setBgColor( this._isSameCat(cat) ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT);
    }

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.cat2Icon(this.cat),{alpha:0.25,tint:0x0});}
    }

}

export class MatSlot extends Slot
{
    // constructor(scene, w, h, i, getOwner, config)
    // {
    //     super(scene, w, h, i, getOwner, config);
    //     this.onset = config?.onset;
    // }
    constructor(scene, w, h, i, config)
    {
        const {onset,...cfg}=config
        super(scene, w, h, i, cfg);
        this.onset = onset;
    }

    get cat() {return this._cat;}
    set cat(cat) {this._cat=cat;}

    // get, set 都要 assign 才會正常 work
    get content() {return super.content;}
    set content(value) {super.content=value; this.onset?.();}
}

export class OutputSlot extends Slot
{
    // constructor(scene, w, h, getOwner, config)
    // {
    //     super(scene, w, h, -1, getOwner, config);
    //     this.onset = config?.onset;
    // }

    constructor(scene, w, h, config={})
    {
        const {onset,...cfg}=config
        super(scene, w, h, -1, cfg);
        this.onset = onset;
    }

    get dropable() {return false;}
    get capacity() {return -1; }

    // get, set 都要 assign 才會正常 work
    get content() {return this.owner?.output;}
    set content(value) {this.owner.output=value; this.setSlot(value); this.onset?.();}

    empty() {this.content={id:this.content.id,count:0};}
}

export class AbilitySlot extends Pic
{
    static selected = null; // 用來記錄目前選擇的技能
    constructor(scene, w, h, i, config)
    {
        super(scene, w, h, config);
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK,radius:config?.radius??0, alpha:0.6}),'disabled');
        this.add(bbcText(scene,{text:'',fontSize:20,color:'#fff'}),{key:'remain',align:'center-center',expand:false});
        this.setIcon(config?.icon);
        this.getElement('disabled').fillAlpha=0;
        this.addListener();
        this._i = i;            // 技能欄位索引
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return getPlayer();}
    get id() {return this.owner.getSlot(this._i);}
    get remain() {return this.owner.abilities[this.id].remain;}
    get ready() {return this.remain===0;}
    get i() {return this._i;}
    get dat() {return this._dat;}
    get isEmpty() {return this._dat===null;}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{this.leftButtonDown(x,y);})
        .on('pointerup', (pointer,x,y)=>{this.leftButtonUp(x,y);})
    }

    setBgColor(color) {this.getElement('background').fillColor = color;}
    setStrokeColor(color) {this.getElement('background').strokeColor = color;}
    over() { this.scale=1.1;this._id && Ui.delayCall(()=>{UiInfo.show(GM.IF_ABILITY_TB,this);}); } // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() { this.scale=1;Ui.cancelDelayCall();UiInfo.close(); }

    leftButtonDown(x,y)
    {
        if(this.isEmpty || AbilitySlot.selected) {return;}
        Ui.delayCall(() => {DragService.onAbilityDown(this);}, GM.PRESS_DELAY) ;
    }

    leftButtonUp(x,y)
    {
        Ui.cancelDelayCall();  
        DragService.onAbilityUp(this);
    }

    update()
    {
        if(this.id) {this.set();}
        else {this.empty();}
    }

    use()
    {
        if(this.ready) {this.owner.useAbility(this.owner, this.id);}
    }

    toggle()
    {
        if(AbilitySlot.selected)
        {
            AbilitySlot.selected===this && AbilitySlot.selected.unselect();
        }
        else if(this.ready)
        {
            this.select();
        }
    }

    select()
    {
        AbilitySlot.selected = this; // 設定目前選擇的技能
        this.setStrokeColor(GM.COLOR_RED);
        this.owner.selectAbility(this.id); // 設定角色的技能

    }

    unselect()
    {
        AbilitySlot.selected = null; // 清除目前選擇的技能
        this.setStrokeColor(GM.COLOR_WHITE);
        this.owner.unselectAbility();// 清除角色的技能
    }

    reset() // call by role.resetAbility()
    {
        AbilitySlot.selected = null; // 清除目前選擇的技能
        this.setStrokeColor(GM.COLOR_WHITE);
        this.update();
    }

    set()
    {
        this._dat = DB.ability(this.id);
        this.setIcon(this._dat.icon);
        this.getElement('remain').setText( this.remain>0 ? this.remain : '' );
        this.getElement('disabled').fillAlpha = this.remain>0 ? 0.5 : 0;
        this.layout();
    }

    empty()
    {
        this._dat = null
        this.setIcon();
        this.getElement('remain').setText('');
        this.setBgColor(GM.COLOR_SLOT);
        this.getElement('disabled').fillAlpha = 0;
        this.owner.clearSlot(this.i); // 清除技能欄位   
    }
}

export class AbilityItem extends Pic
{
    constructor(scene, w, h, config)
    {
        super(scene, w, h, config);
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK,radius:config?.radius??0}),'disabled');
        this.add(bbcText(scene,{text:'',fontSize:20,color:'#fff'}),{key:'text',align:'center-center',expand:false});
        this.setIcon(config?.icon);
        this.getElement('disabled').fillAlpha=0;
        this.addListener();
        this._id = null;
        this._ability = null;     // 用來存放技能狀態
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return getPlayer();}
    get id() {return this._id;}
    get i() {return this._i;}
    get dat() {return this._dat;}

    get en() {return this._ability;}

    get locked()
    {
        if(this.en) {return false;}
        let ret = this._dat.refs?.find(ref=> this.owner.abilities[ref]===undefined || this.owner.abilities[ref].en===false);
        return ret!==undefined;
    }
    

    leave() {UiDragged.interact(true);}
    enter(gameObject) {(gameObject instanceof AbilitySlot) && UiDragged.interact(false);}
    over() {Ui.delayCall(() => {UiInfo.show(UI.INFO.ABILITY.LR,this);});} // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() {Ui.cancelDelayCall();UiInfo.close();}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', async (pointer,x,y)=>{this.leftButtonDown(x,y);})
        .on('pointerup', (pointer,x,y)=>{this.leftButtonUp(x,y);})
        .on('dragleave', (pointer,gameObject)=>{this.leave(gameObject);})
        .on('dragenter', (pointer,gameObject)=>{this.enter(gameObject);})
    }

    async leftButtonDown(x,y)
    {
        if(this.locked || AbilitySlot.selected) {return;}
       
        if(!this._ability)
        {
            let ret = await UiConfirm.msg('學習此技能?');
            if(ret)
            {
                this.owner.learnAbility(this._id);
                Ui.refreshAll();
            }
        }
        else if(this.dat.type !== GM.PASSIVE)
        {
            Ui.delayCall(() => {DragService.onAbilityDown(this);}, GM.PRESS_DELAY) ;
        }
    }

    leftButtonUp(x,y)
    {
        Ui.cancelDelayCall();   
        UiDragged.empty();
    }


    update()
    {
        this.getElement('text').setText(this.locked?'🔒':'');
        this.getElement('disabled').fillAlpha=this.en?0:0.7;

    }

    set(id, x, y)
    {
        this._id = id;
        this.x = x;
        this.y = y;
        this._ability =  this.owner.abilities[this._id];
        this._dat = DB.ability(this._id);
        this.setIcon(this._dat.icon);
        this.getElement('text').setText(this.locked?'🔒':'');
        this.getElement('disabled').fillAlpha=this.en?0:0.7;
        this.layout();
    }

}

export class UiDragged extends OverlapSizer
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, 0, 0, w, h);
        UiDragged.instance = this;
        Ui.addLayer(scene, 'UiDragged', this);    // 產生layer，並設定layer名稱
        this.addBackground(rect(scene,{color:GM.COLOR_SLOT,radius:0, alpha:0}),'background')
            .add(sprite(this.scene),{aspectRatio:true, key:'sprite'})  
            .addCount(scene)
            .layout()
            .hide()
            .addListener();
    }


    static get on() {return this.instance.visible;}
    static get obj() {return this.instance;}
    static get owner() {return this.instance.owner;}
    static get dat() {return this.instance.dat;}

    static get isSlot() {return this.instance._obj?.content !== undefined;}
    static get isAbility() {return this.instance._obj?.id !== undefined;}


    get owner() {return this._obj.owner;}
    get content() {return this._obj.content;}
    set content(val) {this.setItm(val);}
    get dat() {return this._obj.dat;}
    get id() {return this._obj.id;}
    get i() {return this._obj.i;}
    get label() {return this.content.id.lab();}
    get gold() {return this.content.count*this.dat.gold;}


    addListener()
    {
        this//.setInteractive()
            .on('pointerup',()=>{
                console.log('-drop-')
                this.empty();
                this.disableInteractive();
            })
    }

    interact(on) 
    {
        if(on) {this.setInteractive();}
        else {this.disableInteractive();}
    }

    checkCat(cat) 
    {
        return (this.dat.cat & cat) === this.dat.cat;
    }

    update() 
    {
        if(this.content.count==0)
        {
            this.empty();
        }
        else
        {
            this.setCount(this.content.count>1 ? this.content.count : '')
        }
    }

    empty()
    {
        this.hide();
        delete this._obj;
        UiCover.close();
        UiMain.enable(true);
    }

    addCount(scene)
    {
        this.add(text(scene,{fontSize:20, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false})
        return this
    }

    setItm(content)
    {
        if(content)
        {
            console.log(content)
            this._obj.content = content;
            this._obj.dat = DB.item(content.id);
            this.setIcon(this.dat.icon)
                .setCount(this.content.count>1 ? this.content.count : '')
        }
        else
        {
            this.empty();
        }
    }

    set(obj)
    {
        if(obj instanceof Slot)
        {            
            this._obj = {
                content: obj.content,
                dat: obj.dat,
                owner: obj.owner,
                gold: obj.gold
            };

            this.show()
                .setIcon(this.dat.icon)
                .setCount(this.content.count>1 ? this.content.count : '')
            UiCover.show();
            UiMain.enable(false);
        }
        else
        {
            console.log('ability', obj.id, obj.i)
            
            this._obj = {
                dat: DB.ability(obj.id),
                id: obj.id,
                i: obj.i,
            }

            this.show()
                .setIcon(this.dat.icon).setCount('')
            UiCover.show();
        }

    }

    setIcon(icon)
    {
        let [key,frame]=icon.split('/');
        let sp = this.getElement('sprite');
        sp.setTexture(key,frame);
        sp.rexSizer.aspectRatio = sp.width/sp.height;
        this.layout();
        return this;
    }

    setCount(count)
    {
        this.getElement('count').setText(count);
        this.layout();
        return this;
    }

    drop()
    {
        console.log('-----trader=',this.owner.tradeType)
        if(this._obj && this.owner.tradeType!=GM.SELLER)
        {
            this.owner.drop(this._obj);
            this.empty();
        }
    }


    static set(obj) {return this.instance?.set(obj);}

    static setPos(x,y) {return this.instance?.setPosition(x,y);}

    static empty() {this.instance?.empty();}
    
    static checkCat(cat) {return this.instance?.checkCat(cat);}

    static update() {this.instance?.update();}

    static drop() {this.instance?.drop();}

    static interact(on) {this.instance.interact(on);}

}

class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene,option);
        this.onclick = option?.onclick;
        this.onover = option?.onover;
        this.onout = option?.onout;
        this.type = option?.type ?? GM.BTN_NORMAL;
        this.key = option?.key;
        let radius = option.radius ?? 5;
        let padding = option.padding ?? 5;

        switch(this.type)
        {
            case GM.BTN_NORMAL:
                let bg = option.bg ?? rect(scene,{color:GM.COLOR_DARK,radius:radius,});
                this.addBackground(bg,'bg')
                if(option.text) { this.add(text(scene,{text:option.text}),{padding:padding,key:'text'}); }
                if(option.icon) { this.add(sprite(scene,{icon:option.icon}),{padding:padding,key:'icon'}); }
                break;

            case GM.BTN_NOBG:
                if(option.text) { this.add(text(scene,{text:option.text}),{key:'text'}); }
                if(option.icon) { this.add(sprite(scene,{icon:option.icon}),{key:'icon'}); }
                break;

            case GM.BTN_TEXT:
                this.addBackground( rect(scene,{color:GM.COLOR_SLOT,alpha:0}),'bg' )
                if(option.text) { this.add(text(scene,{text:option.text}),{key:'text'}); }
                break;
        }

        this.layout().addListener()
        scene.add.existing(this);
        
    }

    addListener()
    {
        let bg = this.getElement('bg');
        let icon = this.getElement('icon');
        let text = this.getElement('text');

        let over = (on)=>{

            switch(this.type)
            {
                case GM.BTN_NORMAL: 
                    bg && (bg.fillAlpha = on ? 0.5 : 1); 
                    break;
                case GM.BTN_NOBG: 
                    icon && (icon.setTint( on ? GM.COLOR_GRAY : GM.COLOR_WHITE)); 
                    text && (text.setTint( on ? GM.COLOR_GRAY : GM.COLOR_WHITE)); 
                    break;
                case GM.BTN_TEXT: 
                    bg && (bg.fillAlpha = on ? 1 : 0); 
                    break;
            }
        }

        this.setInteractive();
        this.on('pointerover',()=>{over(true);this.onover&&this.onover(this);})
            .on('pointerout',()=>{over(false);this.onout&&this.onout(this);})
            .on('pointerdown',()=>{this.onclick&&this.onclick(this);})
    }

    setEnable(on)
    {        
        if(on) 
        {
            this.setInteractive();
            this.getElement('bg')?.setAlpha(1);
            this.getElement('icon')?.setAlpha(1);
            this.getElement('text')?.setAlpha(1);
        }
        else 
        {
            this.disableInteractive();
            this.getElement('bg')?.setAlpha(0.5);
            this.getElement('icon')?.setAlpha(0.5);
            this.getElement('text')?.setAlpha(0.5);
        }
    }
}

export class UiCover extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,GM.w,GM.h);
        UiCover.instance = this;
        Ui.addLayer(scene, 'UiCover', this);    // 產生layer，並設定layer名稱

        this.addBackground(rect(scene,{color:GM.COLOR_DARK,alpha:0.5}))
            .setOrigin(0,0)
            .layout()
            .hide()
        // scene.add.existing(this);
        // Ui.addLayer(scene, 'UiCover', this);


        // this.setInteractive()
        //     .on('pointerdown',()=>{UiDragged.drop();})
        this.setInteractive();
        this._cnt=0;
    }

    show()
    {
        super.show();
        this._cnt++;
    }

    close()
    {
        if(--this._cnt<=0)
        {
            this.hide();
            this._cnt=0;
        }
    }

    static show() {UiCover.instance?.show();}
    static close() {UiCover.instance?.close();}
}

class UiBase extends Sizer
{
    constructor(scene, config, layername)
    {
        super(scene, config)
        if(layername) {Ui.addLayer(scene, layername, this);}
        else {scene.add.existing(this);}
    }

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}

    getOwner() {return this.owner;}

    addBg_Int(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        this.getElement('bg').setInteractive() //避免 UI scene 的 input event 傳到其他 scene
            .on('pointerover',()=>{if(Ui.mode==GM.UI_MODE_NORMAL){UiCursor.set();clearpath();}})
        return this;
    }

    addBg(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        return this;
    }

    addTop(scene, {text='',bgColor}={})
    {
        let sz = scene.rexUI.add.overlapSizer();
        if(bgColor!=undefined) {sz.addBackground(rect(scene,{color:bgColor}))}
        sz.add(bbcText(scene,{text:text}),{align:'center',expand:false,key:'label'})
            .add(new UiButton(scene,{icon:GM.ICON_CLOSE,type:GM.BTN_NOBG, onclick:this.close.bind(this)}),{align:'right',expand:false})
        this.add(sz,{padding:{left:0,right:0}, expand:true, key:'top'});
        return this;
    }

    addGrid(scene, column, row, ext={})
    {
        let config =
        {
            column: column,
            row: row,
            space: {column:5,row:5,left:5,right:5,top:5,bottom:5,...ext.space},
        }

        let slot_w = ext.slot_w ?? GM.SLOT_SIZE;
        let slot_h = ext.slot_h ?? GM.SLOT_SIZE;

        let classT = ext.classT ?? Slot;
        let classC = ext.classC ?? {};

        let grid = scene.rexUI.add.gridSizer(config);
        grid.addBackground(rect(scene,{strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
        let count = config.column * config.row;
        for(let i=0; i<count; i++)
        {
            let slot = new classT(scene, slot_w, slot_h, i, classC);
            grid.add(slot);
        }

        this.add(grid,{key:'grid',padding:ext.padding});
        return this;
    }

    addScroll(scene, {  width=0, height=0,
                        bg={alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2},
                        panel={orientation:'y',space:5},
                        add={expand:true, key:'scroll'},
                    }={})
    {
        let config = 
        {
            width: width,
            height: height,
            background: rect(scene, bg),
            panel: {child:scene.rexUI.add.sizer(panel)},
            slider: {
                track: rect(scene,{width:15,color:GM.COLOR_DARK}),
                thumb: rect(scene,{width:20,height:20,radius:5,color:GM.COLOR_LIGHT}),
                space: 5,
                hideUnscrollableSlider: true,
                disableUnscrollableDrag: true,
            },
        }
        let scroll = scene.rexUI.add.scrollablePanel(config);
        this.add(scroll, add);
        return this;
    }

    addPanel(scene, {  width=0, height=0,
                        orientation='y',space=5,
                        color=GM.COLOR_PRIMARY,strokeColor=GM.COLOR_GRAY,strokeWidth=2,
                    }={})
    {
        let config = 
        {
            width: width,
            height: height,
            orientation: orientation,
            space: space,
        }
        let panel = scene.rexUI.add.sizer(config);
        panel.addBackground(rect(scene,{color:color,strokeColor:strokeColor,strokeWidth:strokeWidth}),'bg')
        this.add(panel,{expand:true, proportion:1, key:'panel'});
        return this;
    }

    addGold(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),'bg')
        let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
        let text = `[color=yellow][img=gold][/color] ${0}`
        sizer.add(bbcText(scene,{text:text,images:images}),{padding:{left:10,top:5,bottom:5},align:'left',key:'gold'});
        this.add(sizer,{expand:true,key:'info'})
        return this;
    }

    addDivider(scene,padding={left:0,right:0,top:10,bottom:10})
    {
        // this.add(rect(scene,{width:200,height:1,color:GM.COLOR_WHITE}),
        //             {padding:padding,expand:true})
        this.add(divider(scene),{padding:padding,expand:true})
        return this;
    }

    item(id,{onover,onout,ondown}={})
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:id,color:'#777777'}),{key:'label'})
        let bg = sizer.getElement('bg').setAlpha(0);
        let lb = sizer.getElement('label');
        sizer.unsel = ()=>{lb.setColor('#777777');}
        sizer.sel = ()=>{lb.setColor('#ffffff');}
        sizer.setInteractive()
            .on('pointerover',()=>{ onover?.(sizer); bg.alpha=1; })
            .on('pointerout',()=>{ bg.alpha=0; onout?.();})
            .on('pointerdown',()=>{ ondown?.(sizer); })
        return sizer;  
    }

    prop(key, value, interactive=true)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        if(value.max) {value=`${value.cur} / ${value.max}`;}
        else if(value.den) {value=`${Math.floor(value.cur)} %`;}
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:key.lab()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0})
        let bg = sizer.getElement('bg').setAlpha(0);
        if(interactive)
        {
            sizer.p = key;
            sizer.setInteractive()
                .on('pointerover',()=>{ bg.alpha=1; Ui.delayCall(()=>{UiInfo.show(GM.IF_PROP,sizer);}) })
                .on('pointerout',()=>{ bg.alpha=0; Ui.cancelDelayCall(); UiInfo.close();})
        }
        return sizer;
    }

    stat(key, value, interactive=true)
    {
        let row = this.scene.rexUI.add.sizer({orientation:'x'});

        if(typeof value !== 'string')
        {
            if(GM.PCT.includes(key)){value=value*100+'%'}
            else {value=value?.toFixed?.(1);}
        }
        else
        {
            value=value.lab();
        }

        row.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:key.lab()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}))
        let bg = row.getElement('bg').setAlpha(0);
        if(interactive)
        {
            row.p = key;
            row.setInteractive()
                .on('pointerover',()=>{ bg.alpha=1; Ui.delayCall(()=>{UiInfo.show(GM.IF_PROP,row);}) })
                .on('pointerout',()=>{ bg.alpha=0; Ui.cancelDelayCall(); UiInfo.close();})
        }
        return row;
    }

    setTitle(title) {this.getElement('label',true).setText(title);}

    updateEquip() {this.getElement('equip',true).getElement('items').forEach(item => {item?.update(this.owner);});}
    updateGrid(cat) {this.getElement('grid',true).getElement('items').forEach(item => {item?.update(this.owner,cat);});}
    updateGold() {this.getElement('gold',true).setText(`[color=yellow][img=gold][/color] ${this.owner.gold}`);}

    close() {this.hide();}

    // destroy() {super.destroy();}

}

export class Block extends Pic
{
    constructor(scene, w, h, effect)
    {
        super(scene, w, h, {icon:effect.icon, strokeWidth:0, space:0});
        this.layout()
            .addListener()
        this._dat=effect;
    }

    get dat() {return this._dat;}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
    }

    over() {Ui.delayCall(() => {UiInfo.show(GM.IF_ACTIVE,this);});} // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() {Ui.cancelDelayCall();UiInfo.close();}

}

export class UiManufacture_1 extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            height : 500,
            orientation : 'y',
            space : 0,
        }

        super(scene, config, 'UiManufacture')
        UiManufacture_1.instance=this;
        this.scene=scene;
        this.addBg_Int(scene)
            .addTop(scene,{text:'make'.lab()})
            .addMain(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addMain(scene)
    {
        let config = 
        {
            height:600,
            orientation:'x',
        }

        let main = scene.rexUI.add.sizer(config);
        main.addMenu = this.addMenu;
        main.addProduce = this.addProduce;
        main.addGrid = this.addGrid;
        main.getOwner = this.getOwner.bind(this);
        main.addScroll = this.addScroll;
        main.check = this.check.bind(this);
        main.make = this.make.bind(this);
        main.addBackground(rect(scene))
            .addMenu(scene)
            .addProduce(scene)
        this.add(main, {padding:{left:10,right:10,bottom:10},expand:true,key:'main'});
        return this;
    }

    addMenu(scene)
    {
        this.addScroll(scene,{width:100})
        return this;
    }

    addProduce(scene)
    {
        let config = {
          width: 300,
          orientation:'y',
        }

        let produce = scene.rexUI.add.sizer(config);
        produce.addGrid = this.addGrid;
        produce.addBackground( rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}) )
                .addGrid(scene, 3, 3, {padding:{top:10},classT:MatSlot,classC:{onset:this.check}})
                .addSpace()
                .add(new OutputSlot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE),{key:'output'})
                .addSpace()
                .add(new UiButton(scene,{text:'make'.lab(),onclick:this.make}),{key:'button'})
                .addSpace()
        this.add( produce, {expand:true, key:'produce'} );
        return this;
    }

    check()
    {
        let on = this.owner.check();
        this.getElement('button',true).setEnable(on);
    }

    make()
    {
        this.owner.make();
        this.updateGrid(this.owner.cat);
        this.getElement('output',true).update();
        this.check();
    }

    updateOutput()
    {
        this.getElement('output',true).update(this.owner);
    }

    update()
    {
        let itemSel = null;
        let onover = (item)=>{UiInfo.show(GM.IF_SLOT, item);}
        let onout = ()=>{UiInfo.close();}  
        let ondown = (item)=>{
                if(!this.owner.isFull)
                {
                    itemSel?.unsel();
                    itemSel=item;
                    item.sel();
                    this.owner.sel=item.content.id;
                    this.updateOutput();
                    this.check();
                }
            }

        let panel = this.getElement('panel',true);
        panel.removeAll(true);
        this.owner.menu.forEach((id)=>{
            let add = this.item(id.lab(),{onover:onover, onout:onout, ondown:ondown});
            add.content = {id:id,type:'make'};
            add.dat = DB.item(id)??id;
            if(id==this.owner.sel) {add.sel();itemSel=add;}
            panel.add(add,{expand:true})
        })
        this.layout();
        this.check();

        this.updateGrid(this.owner.cat);
        this.updateOutput();
    }

    close() 
    {
        super.close();
        UiCover.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();
    }


    show(owner)
    {
        console.log(owner)
        this.owner = owner;
        super.show();
        this.update();
        UiCursor.set();

        UiInv.show(getPlayer());
        
        // cover/close/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);  
        setCamera(GM.CAM_RIGHT);

    }

    static show(owner) {this.instance.show(owner);}
}

export class Effect extends Pic
{
    constructor(scene, w, h, effect, style=GM.IF_ACTIVE_TB)
    {
        super(scene, w, h, {icon:effect.icon, strokeWidth:0, space:0});
        this.add(bbcText(scene,{text:`[stroke=#000]${effect.remaining}[/stroke]`,fontSize:20,color:'#fff'}),{align:'bottom-center',expand:false})
            .layout();
        this.addListener()
        this._dat=effect;
        this._style=style;
    }

    get dat() {return this._dat;}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
    }

    over() {Ui.delayCall(() => {UiInfo.show(this._style,this);});} // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() {Ui.cancelDelayCall();UiInfo.close();}

}

