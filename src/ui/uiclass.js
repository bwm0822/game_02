// import * as ui from './uicomponents.js'
import {Pic, Icon, uRect, uBbc, uBar} from './uicomponents.js'
import {GM, UI} from '../core/setting.js'
import DB from '../data/db.js'
import Utility from '../core/utility.js'
import Ui from './uicommon.js'
import UiInv from './uiinv.js'
import UiInfo from './uiinfo.js'
import UiDragged from './uidragged.js'
import UiOption from './uioption.js'
import UiConfirm from './uiconfirm.js'
import UiMessage from './uimessage.js'
import DragService from '../services/dragService.js'


export class Slot extends Icon
{
    constructor(scene, w, h, i, config)
    {
        super(scene, w, h, config);
        this._bar=uBar.call(this,scene,{width:0,height:5,value:0,barColor:GM.COLOR.BAR_GREEN,
                                            ext:{align:'bottom',expand:{width:true},offsetY:5}})
        this._progress=uBar.call(this,scene,{width:0,height:5,value:0,barColor:GM.COLOR.BAR_GREEN,trackColor:GM.COLOR.BLACK,
                                            ext:{align:'bottom',expand:{width:true},offsetY:5}})
        this._times=uBbc.call(this,scene,{text:'',fontSize:16, lineSpacing:-8,color:'#fff'})
        this._disabled=uRect.call(this,scene,{color:GM.COLOR.BLACK, alpha:0})
        this.addBackground(this._disabled,'disabled');

        this._i = i;
        this._filter = true;
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

    // p(prop) // content,dat 有可能會是 null/undefined (例如:EquipSlot的第10個)
    // {
    //     let [p,sub] = prop.split('.');
    //     return sub ? this.content?.[p]?.[sub] != undefined ? this.content[p][sub] 
    //                                                     : this.dat?.[p]?.[sub]
    //                 : this.content?.[p] != undefined ? this.content[p] 
    //                                                 : this.dat?.[p];
    // }  

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
        const elm=this._bar;
        elm.visible=visible;
        if(visible) {elm.setValue(cur/max);}
    }

    setProgress(visible, cur, max)
    {
        const elm=this._progress;
        elm.visible = visible;
        if(visible) {elm.setValue(cur/max);}
    }

    setTimes(visible, cur, max)
    {
        const elm=this._times;
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

    filter(conds)
    {
        conds = conds||[];
        this._filter=true;
        for(const cond of conds)
        {
            if(this.isEmpty) {this._filter=false; return}
            if(cond.cat)
            {
                if((this.dat.cat&cond.cat)!==cond.cat)
                {
                    this._filter=false;
                    return;
                }
            }
            if(cond.p)
            {
                const ps= [].concat(cond.p);
                for(const p of ps)
                {
                    if(this.dat[p]===undefined)
                    {
                        this._filter=false;
                        return;
                    }
                }
                
            }
            if(cond.id)
            {
                const ids = [].concat(cond.id);
                if(!ids.includes(this.id))
                {
                    this._filter=false;
                    return;
                }
            }
        }
    }

    update(owner,cat)
    {
        owner && (this.owner=owner);
        cat && (this.cat=cat);  // for MatSlot
        this.setSlot(this.content);
        this.setEnable(this.enabled&&this._filter);
    }

    setEnable(on)
    {
        if(on)
        {
            this.setInteractive({draggable:true,dropZone:true});
            this._disabled.fillAlpha=0;
        }
        else
        {
            this.disableInteractive();
            this.setBgColor(GM.COLOR.SLOT);
            this._disabled.fillAlpha=0.6;
        }
    }

    empty() {super.empty();this.content=null;this.dat=null;}
    
    over(checkEquip=true)
    {
        if(Ui.mode===UI.MODE.NORMAL)
        {
            if(this.dropable && UiDragged.isSlot)
            {
                if(this.trading)
                {
                    if(this.isEmpty)
                    {
                        this.setBgColor(this.isValid ? GM.COLOR.SLOT_TRADE : GM.COLOR.SLOT_INVALID);
                    }
                    else
                    {
                        this.setBgColor(GM.COLOR.SLOT_DISABLE);
                    }
                }
                else
                {
                    this.setBgColor(this.isValid ? GM.COLOR.SLOT_DRAG : GM.COLOR.SLOT_INVALID);
                }
            }
            else if(!this.isEmpty && !UiDragged.isAbility)
            {
                this.setBgColor(GM.COLOR.SLOT_OVER);

                // 使用 delacyCall 延遲執行 UiInfo.show()
                Ui.delayCall(() => {UiInfo.show(UI.INFO.SLOT,this);}); 
                // 檢查裝備欄位，符合類別的裝備，設置背景顏色為 COLOR_SLOT_DRAG，否，設置為 COLOR_SLOT
                checkEquip && UiInv.checkEquipSlots(this.dat.cat);
            }
        }

    }

    out(checkEquip=true)
    { 
        Ui.cancelDelayCall();    
        this.setBgColor(GM.COLOR.SLOT);
        UiInfo.close();
        // 將裝備欄位的背景顏色設置為 COLOR_SLOT
        checkEquip && UiInv.checkEquipSlots(null);   
    }

    leave(gameObject)
    {
        UiDragged.on && gameObject.setBgColor(GM.COLOR.SLOT);
    }

    enter(gameObject)
    {
        UiDragged.on && this.noTrade && gameObject.setBgColor(GM.COLOR.SLOT_DRAG);
    }

    rightButtonDown(x,y)
    {
        // if(!this.isEmpty) {UiOption.show(this.left+x-20,this.top+y-20, this.acts, this);}
        if(!this.isEmpty) {UiOption.show(this.left+x+20,this.top+y-20, this.acts, this);}
    }

    leftButtonDown(x,y)
    {
        if(Ui.mode===UI.MODE.FILL)
        {
            this.fill();
        }
        else
        {
            DragService.onSlotDown(this, x, y);
        }
    }

    fill()
    {
        const content=this.content;
        if(content.capacity<this.dat.capacity)
        {
            content.capacity=this.dat.capacity;
            this.update()
            UiMessage.push(`${this.owner.id} 裝水`)
        }
        else
        {
            UiMessage.push(`${this.owner.id} 水壺已滿`)
        }
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
    set content(value) {
        this.owner.equips[this._i]=value; 
        this.setSlot(value); 
        this.owner.equip();
        Ui.refreshAll();
    }

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
        this._disabled=uRect(scene,{color:GM.COLOR.BLACK, alpha:0})
        this.addBackground(this._disabled);
        this._remain=uBbc.call(this,scene,{fontSize:20,color:'#fff',
                                            ext:{align:'center-center',expand:false}})
        this.setIcon(config?.icon);
        this.addListener();
        this._i = i;            // 技能欄位索引
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return GM.player;}
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
    over() { this.scale=1.1;this._id && Ui.delayCall(()=>{UiInfo.show(UI.INFO.ABILITY.TB,this);}); } // 使用 delacyCall 延遲執行 UiInfo.show()}
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
        this._remain.setText(this.remain>0 ? this.remain : '');
        this._disabled.fillAlpha = this.remain>0 ? 0.5 : 0;
        this.layout();
    }

    empty()
    {
        this._dat = null
        this.setIcon();
        this._remain.setText('');
        this.setBgColor(GM.COLOR.SLOT);
        this._disabled.fillAlpha = 0;
        this.owner.clearSlot(this.i); // 清除技能欄位   
    }
}

export class AbilityItem extends Pic
{
    constructor(scene, w, h, config)
    {
        super(scene, w, h, config);
        this._disabled=uRect(scene,{color:GM.COLOR.BLACK, alpha:0})
        this.addBackground(this._disabled);
        this._locked=uBbc.call(this,scene,{fontSize:20,color:'#fff',
                                        ext:{align:'center-center',expand:false}})
        this.setIcon(config?.icon);
        this.addListener();
        this._id = null;
        this._ability = null;     // 用來存放技能狀態
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return GM.player;}
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
        this._locked.setText(this.locked?'🔒':'');
        this._disabled.fillAlpha=this.en?0:0.7;

    }

    set(id, x, y)
    {
        this._id = id;
        this.x = x;
        this.y = y;
        this._ability =  this.owner.abilities[this._id];
        this._dat = DB.ability(this._id);
        this.setIcon(this._dat.icon);
        this._locked.setText(this.locked?'🔒':'');
        this._disabled.fillAlpha=this.en?0:0.7;
        this.layout();
    }

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

export class Effect extends Pic
{
    constructor(scene, w, h, effect, style=GM.IF_ACTIVE_TB)
    {
        super(scene, w, h, {icon:effect.icon, strokeWidth:0, space:0});
        uBbc.call(this,scene,{text:`[stroke=#000]${effect.remaining}[/stroke]`,
                                fontSize:20,color:'#fff',
                                ext:{align:'bottom-center',expand:false}})
        this.layout()
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


