import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import ContainerLite from 'phaser3-rex-plugins/plugins/containerlite.js';
import Utility from './utility.js';
import {rect, sprite, text, bbcText, Pic, Icon, bar, scrollBar, label, slider} from './uibase.js';
import {GM} from './setting.js';
import * as Role from './role.js';
import {ItemDB} from './database.js';
import {Mark} from './gameUi.js';
import TimeManager from './time.js';

let uiScene;
let _mode=0;

export default function createUI(scene)
{
    console.log('createUI');
    GM.w = scene.sys.canvas.width;
    GM.h = scene.sys.canvas.height;
    uiScene = scene;
    console.log('resolution:',GM.w, GM.h)

    //test(scene);
    //t1();
    new UiCover(scene);
    new UiMain(scene);
    new UiManufacture(scene);
    new UiProfile(scene);
    new UiCursor(scene);
    new UiInv(scene);
    new UiTrade(scene);
    new UiStorage(scene);
    new UiDialog(scene);
    new UiObserve(scene);

    new UiCount(scene);
    
    new UiDragged(scene, 80, 80);
    new UiInfo(scene);
    new UiOption(scene);
    new UiMessage(scene);

    new UiGameOver(scene);

    new UiChangeScene(scene);

    new UiDebuger(scene);


    new UiTime(scene);

    //t3({});

}

async function t3(config={a:0,b:1,c:2})
{
    let cnt = await UiCount.getCount(1,5);
    console.log(cnt);
    //console.log(config.a,config.b,config.c,config.d);
    //progress(uiScene,{x:100,y:100,value:0.5});
}



function t2(scene)
{
    let dialog =
    {
        0:
        {   
            A:'你好\n1\n2\n3\n4\n5\n6',
            B:['1.交易/trade','2.離開/exit']
        }
    }

    UiDialog.show(dialog);
    // let owner =
    // {
    //     trade:true,
    //     gold:500,
    //     equip:{},
    //     bag:{0:{id:'sword_01'}}
    // }

    // let box={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    // //let box={};
    // UiTrade.show(owner);

    //let inv={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    //UiInv.show(player);
    //new UiButton(scene,{x:100,y:100,icon:GM.ICON_CLOSE})

    //console.log('test')
    //new UiButton(scene,{x:100,y:100,icon:GM.ICON_CLOSE})
    //sprite(scene,{icon:GM.ICON_CLOSE});
}

function t1()
{
    let a={test:1}
    let b;
    let c=b;
    b=a;
    console.log('c',c,b)
}

function test(scene)
{
    let bag={0:{icon:'weapons/28'},1:{icon:'weapons/30'}}
    let slot0 = new Slot(scene,80,80,{x:100,y:100,icon:GM.ICON_CLOSE,space:0});
    //slot1.setIcon('weapons/28').setCount(2);
    slot0.id=0;
    slot0.container=bag;
    slot0.update();

    let slot1 = new Slot(scene,80,80,{x:100,y:200,space:0});
    //slot2.setIcon('weapons/30').setCount(2);
    slot1.id=1;
    slot1.container=bag;
    slot1.update();

    let slot2 = new Slot(scene,80,80,{x:100,y:300,space:0});
    //slot2.setIcon('weapons/30').setCount(2);
    slot2.id=2;
    slot2.container=bag;
    slot2.update();

    console.log(scene);

}

function mark(on) {Mark.visible=on;}

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

function send(event) {uiScene.events.emit(event);}



export class Ui
{
    static _list = {};
    //static closeAll(force=false) {for(let key in Ui._list){Ui._list[key].ui.close(force);}}
    static closeAll(mode=GM.UI_FORCE) 
    {
        for(let key in Ui._list)
        {
            if((Ui._list[key].type&mode) != 0) {Ui._list[key].ui.close();}
        }
    }
    static refreshAll() {for(let key in Ui._list){Ui._list[key].ui.refresh?.();}}
    static register(ui,type) {Ui._list[ui.constructor.name]={ui:ui,type:type};}
    static unregister(ui) {delete Ui._list[ui.constructor.name];}
}

class Slot extends Icon
{
    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, config);
        this.add(bar(scene,{width:0,height:5,value:0}),{key:'progress',align:'bottom',expand:{width:true},offsetY:5});
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK, radius:config?.radius??0, alpha:0.6}),'disabled');
        this.getElement('disabled').fillAlpha=0;
        this._i = i;
        this._getOwner = getOwner;
        this._cat = GM.CAT_ALL;
        this.addListener();
    }

    get i() {return this._i;}
    get cps() {return this.item.cps;}
    get slot() {return this._i>=0?this.container?.[this._i]:this.container;}
    set slot(value) {this._i>=0?this.container[this._i]=value:this.container=value; this.setSlot(value);}

    get item() {return this._item;}
    get gold() {return this.slot.count*this.item.gold;}

    get isEmpty() {return Utility.isEmpty(this.slot)||this.slot.count==0;}
    get container() {return this.owner?.storage?.items;}
    get capacity() {return this.owner?.storage?.capacity; }
    get owner() {return this._getOwner?.();}
    //get isValid() {return true;}
    get cat() {return this._cat;}
    set cat(value) {this._cat=value;}
    get isValid() {return UiDragged.checkCat(this.cat)}

    get storage() {
        if(!this.slot.storage) {this.slot.storage={capacity:this.item.storage,items:[]}};
        return this.slot.storage;
    }
    get acts()
    {
        if(this.owner.trade)
        {
            if(this.owner.trade == GM.BUYER) {return ['sell','drop'];}
            else {return ['buy'];}
        }
        else
        {
            if(this.owner.target) 
            {
                let acts = ['transfer','use','drop'];
                if(this.slot.count>1) {return [...acts,'split'];}
                else if(this.slot.storage) {return [...acts,'open'];}
                else {return acts;}
            }
            else 
            {
                if(this.slot.count>1) {return ['use','drop','split'];}
                else if(this.item.storage) {return ['use','drop','openbag'];}
                else {return ['use','drop'];}
            }
        }
    }

    get trading() {return this.owner.trade != UiDragged.owner.trade;}
    get enabled() {return this.capacity==-1 || this._i<this.capacity;}
    get dropable() {return true;}

    setSlot(value)
    {
        this._item = ItemDB.get(value?.id);
        this.setIcon(this._item?.icon);
        this.setCount(value?.count>1?value.count:'');
        if(this._item?.endurance)
        {
            if(!value.endurance) {value.endurance=this._item.endurance.cur;}
            this.getElement('progress').setValue(value.endurance/this._item.endurance.max);
        }
        else
        {
            this.getElement('progress').setValue(0);
        }
    }

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{
            if (pointer.rightButtonDown()) {}
            else if(pointer.middleButtonDown()) {this.middleButtonDown(x,y);}
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

    copyData() {return this.slot ? {slot:Utility.deepClone(this.slot),owner:this.owner,item:this._item} : null;}

    update(cat)
    {
        cat && (this.cat=cat);
        this.setSlot(this.slot);
        this.setEnable(this.enabled);
    }

    setEnable(on)
    {
        if(on)
        {
            this.setInteractive({draggable:true,dropZone:true});
            //this.setBgColor(GM.COLOR_SLOT);
            this.getElement('disabled').fillAlpha=0;
        }
        else
        {
            this.disableInteractive();
            //this.setBgColor(GM.COLOR_SLOT_DISABLE);
            this.getElement('disabled').fillAlpha=0.6;
        }
    }

    clear() {super.clear();this.slot=null;this._item=null;}
    
    over(check=true)
    {
        if(this.dropable && UiDragged.on) 
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
        else if(!this.isEmpty)
        {
            this.setBgColor(GM.COLOR_SLOT_OVER);
            // 使用 setTimeout 延遲執行 UiInfo.show()
            this.pointerOverTimeout = setTimeout(() => {UiInfo.show(this);}, GM.OVER_DELAY);
            check && UiInv.check(this.item.cat);
        }
    }

    out(check=true)
    {
        clearTimeout(this.pointerOverTimeout);        
        this.setBgColor(GM.COLOR_SLOT);
        UiInfo.close();
        check && UiInv.check();
    }

    leave(gameObject)
    {
        UiDragged.on&&gameObject.setBgColor(GM.COLOR_SLOT);
    }

    enter(gameObject)
    {
        UiDragged.on&&this.noTrade&&gameObject.setBgColor(GM.COLOR_SLOT_DRAG);
    }

    middleButtonDown(x,y)
    {
        if(!this.isEmpty) {UiOption.show(this.left+x-20,this.top+y-20, this.acts, this);}
    }

    leftButtonDown(x,y)
    {
        UiInfo.close();
        if(this.dropable && UiDragged.on)
        {            
            if(this.isValid)
            {
                if(this.trading) 
                {
                    if(!this.isEmpty) {return;}

                    if(UiDragged.owner.sell(this.owner, UiDragged, this._i, this.isEquip))
                    {
                        UiDragged.clear();
                        Ui.refreshAll();
                    }
                }
                else
                {
                    if(this.isMergeable())
                    {
                        this.merge();
                    }
                    else
                    {
                        let dataCopy = this.copyData();
                        this.slot = UiDragged.slot;
                        UiDragged.clear();
                        if(!Utility.isEmpty(dataCopy?.slot)) {UiDragged.data=dataCopy;}
                        if(!UiDragged.on) {this.setBgColor(GM.COLOR_SLOT);}
                    }  
                }
                this.over();
            }
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(GM.COLOR_SLOT_DRAG);
            UiDragged.data = this.copyData();
            UiDragged.setPos(this.left+x,this.top+y);
            this.clear();
            UiInv.check();
        }
    }

    isMergeable() {return this.slot && this.slot.id==UiDragged.slot.id && this.cps>1;}

    merge()
    {
        //console.log('merge',this.slot.count,this.cps)
        if(this.slot.count<this.cps)
        {
            let draggedCount = UiDragged.slot.count;
            let count = Math.min(this.slot.count+draggedCount,this.cps);
            draggedCount -= count-this.slot.count;
            this.slot.count = count;
            UiDragged.slot.count = draggedCount;
            this.update();
            UiDragged.update();
        }
    }



    // dragStart()
    // {
    //     if(this.icon)
    //     {
    //         this.dragged = new Pic(this.scene,this.width,this.height,{x:this.x,y:this.y,icon:this.icon})
    //         this.dragged.icon = this.icon;
    //         this.clear();
    //     }
    // }

    // drag(x,y)
    // {
    //     if(this.dragged) {this.dragged.setPosition(x,y);}
    // }

    // dragend(x,y,dropped)
    // {
    //     if(!dropped)
    //     {
    //         this.setIcon(this.dragged.icon)
    //     }

    //     if(this.dragged)
    //     {
    //         this.dragged.destroy();
    //         delete this.dragged;
    //     }

    // }

    // dragenter(gameObject) {gameObject.emit('pointerover');}

    // dragleave(gameObject) {gameObject.emit('pointerout');}

    // drop(gameObject)
    // {
    //     if(this.dragged) {gameObject.setIcon(this.dragged.icon);}
    // }

}

class EquipSlot extends Slot
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

    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, i, getOwner, config);
        this._cat = config?.cat;
        this.setIcon();
    }

    get container() {return this.owner?.status?.equips;}
    get capacity() {return -1;}

    //get cat() {return this._cat;}

    get isEquip() {return true;}

    //get isValid() {return UiDragged.checkCat(this.cat)}

    // get, set 都要 assign 才會正常 work
    get slot() {return super.slot;}
    set slot(value) {super.slot=value; this.owner.equip();}

    checkCat(cat)   {return (this.cat & cat) == cat;}  

    over() {super.over(false);}
    out() {super.out(false);}

    check(cat)
    {
        this.setBgColor( this.checkCat(cat) ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT);
    }

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.cat2Icon(this.cat),{alpha:0.25,tint:0x0});}
    }

}

class MatSlot extends Slot
{
    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, i, getOwner, config);
        this.onset = config?.onset;
    }

    // get, set 都要 assign 才會正常 work
    get slot() {return super.slot;}
    set slot(value) {super.slot=value; this.onset?.();}
}

class OutputSlot extends Slot
{
    constructor(scene, w, h, getOwner, config)
    {
        super(scene, w, h, -1, getOwner, config);
        this.onset = config?.onset;
    }

    get dropable() {return false;}
    get container() {return this.owner?.output;}
    set container(value) {this.owner.output=value;}
    get capacity() {return -1; }

    // get, set 都要 assign 才會正常 work
    get slot() {return super.slot;}
    set slot(value) {super.slot=value; this.onset?.();}

    clear() {this.slot.count=0;this.slot=this.slot;}

    setSlot(value)
    {
        this._item = ItemDB.get(value?.id);
        this.setIcon(this._item?.icon,{alpha:value?.count>0?1:0.25});
    }
}


export class UiDragged extends Pic
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, w, h);
        UiDragged.instance = this;
        this.addCount(scene)
            .layout()
            .hide()
        this.getLayer().name = 'Dragged';
    }

    static get on() {return this.instance.visible;}
    static get slot() {return this.instance.slot;}
    static get owner() {return this.instance.owner;}
    static get item() {return this.instance.item;}
    static get gold() {return this.instance.item.gold*this.instance.slot.count;}
    static get isTrade() {return this.instance.data.owner.tradeable??false;}
    static set data(value) {this.instance.setData(value);}

    get owner() {return this.data.owner;}
    get slot() {return this.data.slot;}
    get item() {return this.data.item;}

    checkCat(cat) {return (this.data.item.cat & cat) == this.data.item.cat;}

    update() 
    {
        if(this.slot.count==0)
        {
            this.clear();
        }
        else
        {
            this.setCount(valuthise.slot.count>1?value.slot.count:'')
        }
    }

    clear()
    {
        this.hide();
        delete this.data;
        UiCover.close();
        UiMain.enable(true);
    }

    addCount(scene)
    {
        this.add(text(scene,{fontSize:20, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false})
        return this
    }

    setData(value)
    {
        this.show();
        this.data = value;
        console.log(value)
        this.setIcon(value.item.icon)
            .setCount(value.slot.count>1?value.slot.count:'')
        UiCover.show();
        UiMain.enable(false);
    }

    setIcon(icon)
    {
        let [key,frame]=icon.split('/');
        this.getElement('sprite').setTexture(key,frame);
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
        if(this.visible&&this.owner.trade!=GM.SELLER)
        {
            this.owner.drop(this);
            this.clear();
        }
    }

    static setPos(x,y) {return UiDragged.instance?.setPosition(x,y);}

    static clear() {UiDragged.instance?.clear();}
    
    static checkCat(cat) {return UiDragged.instance?.checkCat(cat);}

    static update() {UiDragged.instance?.update();}

    static drop() {UiDragged.instance?.drop();}

}

// class UiButton extends Sizer
// {
//     constructor(scene,option)
//     {
//         super(scene,option);
//         this.onclick=option?.onclick;
//         if(option?.rect)
//         {
//             this.addBackground(option.rect,'rect')
//             if(option?.text){ this.add(text(scene,{text:option.text})) }
//         }
//         else if(option?.text) 
//         {
//             this.addBackground(rect(scene,{color:GM.COLOR_SLOT_OVER,alpha:0}),'bg')
//                 .add(text(scene,{text:option.text}))
//         }
//         else if(option?.icon) 
//         {
//             this.add(sprite(scene,{icon:option.icon}),{key:'sp'})
//         }

//         this.layout().addListener()
//         scene.add.existing(this);
        
//     }

//     addListener()
//     {
//         let rect = this.getElement('rect');
//         let bg = this.getElement('bg');
//         let sp = this.getElement('sp');

//         let over = function(on)
//         {
//             rect && (rect.fillAlpha = on ? 0.5 : 1 );
//             bg && (bg.fillAlpha = on ? 1 : 0); 
//             sp && sp.setTint( on ? 0x777777 : 0xffffff);
//         }

//         this.setInteractive();
//         this
//             // .on('pointerover',()=>{bg&&(bg.fillAlpha=1); sp&&(sp.setTint(0x777777));})
//             // .on('pointerout',()=>{bg&&(bg.fillAlpha=0); sp&&(sp.setTint(0xffffff));})
//             .on('pointerover',()=>{over(true);})
//             .on('pointerout',()=>{over(false);})
//             .on('pointerdown',()=>{this.onclick&&this.onclick();})
//     }

//     setEnable(on)
//     {
//         this.setInteractive(on);
//         if(on) {this.getElement('bg').setAlpha(0);}
//         else {this.getElement('bg').setAlpha(0.5);}
//     }
// }


class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene,option);
        this.onclick = option?.onclick;
        this.type = option.type ?? GM.BTN_NORMAL;
        let radius = option.radius ?? 10;
        let padding = option.padding ?? 10;

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
                    icon && (icon.setTint( on ? 0x777777 : 0xffffff)); 
                    text && (text.setTint( on ? 0x777777 : 0xffffff)); 
                    break;
                case GM.BTN_TEXT: 
                    bg && (bg.fillAlpha = on ? 1 : 0); 
                    break;
            }
        }

        this.setInteractive();
        this
            // .on('pointerover',()=>{bg&&(bg.fillAlpha=1); sp&&(sp.setTint(0x777777));})
            // .on('pointerout',()=>{bg&&(bg.fillAlpha=0); sp&&(sp.setTint(0xffffff));})
            .on('pointerover',()=>{over(true);})
            .on('pointerout',()=>{over(false);})
            .on('pointerdown',()=>{this.onclick&&this.onclick();})
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



class UiCover extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,GM.w,GM.h);
        UiCover.instance = this;
        this.addBackground(rect(scene,{color:GM.COLOR_DARK,alpha:0}))
            .setOrigin(0,0)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getLayer().name = 'UiCover';
        this.setInteractive()
            .on('pointerdown',()=>{UiDragged.drop();})
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

class UiInfo extends Sizer
{
    static instance = null;
    static gap = 10;    // show() 有用到，不可移除
    static w = 250;
    constructor(scene)
    {
        super(scene,{orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:0}});
        UiInfo.instance = this;

        this.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3}))
            .layout()
            .hide();

        scene.add.existing(this);
        this.getLayer().name = 'UiInfo';
    }

    addTitle(item)
    {
        this.add(bbcText(this.scene,{text:item.name}));
        return this;
    }

    addCat(item)
    {
        if(item.cat)
        {
            let cat = `[color=gray]${item.cat.local()}[/color]`;
            this.add(bbcText(this.scene,{text:cat}));
        }
        return this;
    }

    addDivider()
    {
        this.add(rect(this.scene,{width:200,height:1,color:0xffffff}),{padding:{top:10,bottom:10}})
        return this;
    }

    addDescript(item)
    {
        if(item.des)
        {
            this.addDivider();
            this.add(bbcText(this.scene,{text:item.des,wrapWidth:200}),{align:'left'});
        }
        return this;
    }

    addProps(item,slot)
    {
        if(item.props || item.endurance || item.storage) 
        {
            this.addDivider();
        }

        if(item.props)
        {
            for(let [key,value] of Object.entries(item.props))
            {
                //console.log(key,value);
                this.addProp(key,value);
            }
        }
        if(item.endurance)
        {
            //this.addProp('耐久',`${slot.endurance}/${item.endurance.max}`);
            this.addProp('endurance'.local(),Utility.tick2Str(slot.endurance));
        }
        if(item.storage)
        {
            let cnt = slot.storage?.items.filter(item => item).length;
            this.addProp('storage'.local(),`${cnt??0}/${item.storage}`);
        }
        return this;
    }

    addProp(key, value)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer//.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}))
            .add(bbcText(this.scene,{text:key.local()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0});
        this.add(sizer,{expand:true});
        return this;
    }

    addMake(item)
    {
        if(!item.make) {return this;}
        this.addDivider();
        let text = `[color=yellow]需求[/color]\n`;
        Object.entries(item.make.items).forEach(([key,value])=>{
            let item = ItemDB.get(key);
            text+=`- ${item.name} (${value})\n`;
        });
        this.add(bbcText(this.scene,{text:text}),{expand:true});
        return this;
        
    }

    addGold(item,slot)
    {
        if(item.gold)
        {
            let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
            let text = `[color=yellow][img=gold][/color] ${(slot.count??1)*item.gold}`
            this.add(bbcText(this.scene,{text:text,images:images}),{align:'right'});
        }

        return this;
    }

    update(slot)
    {
        let item = ItemDB.get(slot.id);
        this.removeAll(true)
            .addTitle(item)
            .addCat(item)
            .addProps(item,slot)
            .addMake(item)
            .addDescript(item)
            .addGold(item,slot)
            .layout()
    }

    show(target)
    {
        super.show();
        let x,y=target.y;

        if(target.x>GM.w/2)
        {
            this.setOrigin(1,0.5);
            x=target.left-UiInfo.gap;
        }
        else
        {
            this.setOrigin(0,0.5);
            x=target.right+UiInfo.gap;
        }

        this.update(target.slot);

        this.setPosition(x,y).rePos();
        this.layout();
    }

    rePos()
    {
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static close() {UiInfo.instance?.hide();}

    static show(target) {UiInfo.instance?.show(target);}
}

class UiContainerBase extends ContainerLite
{
    constructor(scene, touchClose=true)
    {
        super(scene,0,0,GM.w,GM.h);
        this.addBg(scene, touchClose)
        scene.add.existing(this);
    }

    addBg(scene, touchClose)
    {
        let sizer = scene.rexUI.add.sizer(0,0,GM.w,GM.h);
        sizer.addBackground(rect(scene,{alpha:0.5}))
            .setOrigin(0)
            .layout()
            .setInteractive()
        touchClose && sizer.on('pointerdown',()=>{this.visible=false;});
        this.add(sizer);

        return this;
    }

    add(content)
    {
        this.content = content;
        this.content.onclose = this.close.bind(this);
        super.add(this.content);
        return this;
    }

    show(...args)
    {
        this.visible=true;
        return this.content.show(...args);
    }

    close() {this.visible=false;}

}

class UiBase extends Sizer
{
    // static _register={};
    // closeAll() {for(let key in UiBase._register){UiBase._register[key].close();}}
    // refreshAll() {for(let key in UiBase._register){UiBase._register[key].refresh?.();}}
    // static refreshAll() {for(let key in UiBase._register){UiBase._register[key].refresh?.();}}
    // register() {UiBase._register[this.constructor.name]=this;}
    // unregister() {delete UiBase._register[this.constructor.name];}

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}

    getOwner() {return this.owner;}

    addBg_Int(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        this.getElement('bg').setInteractive() //避免 UI scene 的 input event 傳到其他 scene
            .on('pointerover',()=>{UiCursor.set();clearpath();})
        return this;
    }

    addBg(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        return this;
    }

    addTop(scene, label)
    {
        let sz = scene.rexUI.add.overlapSizer();
        sz//.addBackground(rect(scene,{color:GM.COLOR_GRAY}))
            .add(text(scene,{text:label}),{align:'center',expand:false,key:'label'})
            .add(new UiButton(scene,{icon:GM.ICON_CLOSE,type:'nobg', onclick:this.close.bind(this)}),{align:'right',expand:false})
        this.add(sz,{padding:{left:5,right:5}, expand:true, key:'top'});
        return this;
    }

    // addGrid(scene, column, row, getOwner, space)
    // {
    //     let config =
    //     {
    //         column: column,
    //         row: row,
    //         space: {column:5,row:5,...space},
    //     }

    //     let grid = scene.rexUI.add.gridSizer(config);
    //     let count = config.column * config.row;
    //     for(let i=0; i<count; i++)
    //     {
    //         let slot = new Slot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE, i, getOwner);
    //         grid.add(slot);
    //     }

    //     this.add(grid,{key:'grid'});
    //     return this;
    // }

    addGrid(scene, column, row, getOwner, ext={})
    {
        let config =
        {
            column: column,
            row: row,
            space: {column:5,row:5,...ext.space},
        }

        let slot_w = ext.slot_w ?? GM.SLOT_SIZE;
        let slot_h = ext.slot_h ?? GM.SLOT_SIZE;

        let classT = ext.classT ?? Slot;
        let classC = ext.classC ?? {};

        let grid = scene.rexUI.add.gridSizer(config);
        let count = config.column * config.row;
        for(let i=0; i<count; i++)
        {
            let slot = new classT(scene, slot_w, slot_h, i, getOwner, classC);
            grid.add(slot);
        }

        this.add(grid,{key:'grid'});
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

    addGold(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:0x777777,strokeWidth:3}),'bg')
        let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
        let text = `[color=yellow][img=gold][/color] ${0}`
        sizer.add(bbcText(scene,{text:text,images:images}),{padding:{left:10},align:'left',key:'gold'});
        this.add(sizer,{expand:true,padding:10,key:'info'})
        return this;
    }

    addDivider(scene)
    {
        this.add(rect(scene,{width:200,height:1,color:0xffffff}),
                    {padding:10,expand:true})
        return this;
    }

    item(id,{onover,onout,ondown}={})
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        let item = ItemDB.get(id);
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(text(this.scene,{text:item.name.local(),color:'#777777'}),{key:'label'})
        let bg = sizer.getElement('bg').setAlpha(0);
        let lb = sizer.getElement('label');
        sizer.unsel = ()=>{lb.setColor('#777777');}
        sizer.sel = ()=>{lb.setColor('#ffffff');}
        sizer.setInteractive()
            .on('pointerover',()=>{ onover?.(sizer); bg.alpha=1; })
            .on('pointerout',()=>{ bg.alpha=0; onout?.();})
            .on('pointerdown',()=>{ ondown?.(sizer); })
        sizer.slot = {id:id,type:'make'};
        
        return sizer;  
    }

    prop(key, value, interactive=true)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:key.local()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0})
        let bg = sizer.getElement('bg').setAlpha(0);
        if(interactive)
        {
            sizer.setInteractive()
                .on('pointerover',()=>{ bg.alpha=1; })
                .on('pointerout',()=>{ bg.alpha=0; })
        }
        return sizer;
    }

    setTitle(title) {this.getElement('label',true).setText(title);}

    updateEquip() {this.getElement('equip',true).getElement('items').forEach(item => {item?.update();});}

    updateGrid(cat) {this.getElement('grid',true).getElement('items').forEach(item => {item?.update(cat);});}

    updateGold() {this.getElement('gold',true).setText(`[color=yellow][img=gold][/color] ${this.owner.status.gold}`);}

    close() {this.hide();}

}

class Option extends UiBase
{
    constructor(scene)
    {
        super(scene,{width:100,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
        this.btns={};

        this//.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3}))
            .addBg(scene, {color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3})
            .addButton('talk')
            .addButton('trade')
            .addButton('observe',this.observe.bind(this))
            .addButton('attack')
            .addButton('open')
            .addButton('tool')
            // for slot
            .addButton('buy',this.trade.bind(this))
            .addButton('sell',this.trade.bind(this))
            .addButton('transfer',this.transfer.bind(this))
            .addButton('use',this.use.bind(this))
            .addButton('drop',this.drop.bind(this))
            .addButton('split',this.split.bind(this))
            .addButton('openbag',this.openbag.bind(this))
            .setOrigin(0)
            .layout()
            .hide();

        //scene.add.existing(this);
        //this.getLayer().name = 'UiOption';
    }

    get owner() {return this.object.owner;}
    get target() {return this.object.owner.target;}

    addButton(key,onclick)
    {
        let btn = new UiButton(this.scene,{type:GM.BTN_TEXT,text:key.local(),onclick:()=>{
            //onclick ? onclick(key) : this.act(key); 
            (onclick??this.act.bind(this))(key);
        }});
            
        this.btns[key] = btn;
        this.add(btn,{expand:true})
        return this;
    }

    use()
    {
        this.close();
        //console.log('use');
        this.object.use();
    }

    drop()
    {
        this.close();
        this.owner.drop(this.object);
        this.object.clear();
        this.refreshAll();
    }

    transfer()
    {
        this.close();
        if(this.owner.transfer(this.target, this.object))
        {
            this.object.clear();
            this.refreshAll();
        }
    }

    trade()
    {
        this.close();
        if(this.owner.sell(this.target, this.object))
        {
            this.object.clear();
            this.refreshAll();
        }
    }

    observe()
    {
        this.close();
        UiObserve.show(this.object);
    }

    async split()
    {
        this.close();
        console.log('split',this.object);
        let cnt = await UiCount.getCount(1, this.object.slot.count-1)
        if(cnt==0) {return;}
        this.owner.split(this.object,cnt);
        this.refreshAll();
    }

    openbag()
    {
        this.close();        
        UiStorage.show(this.object, ~GM.CAT_BAG);
        this.object.setEnable(false);
    }
 
    act(act)
    {
        this.close();
        Role.Avatar.setDes(this.object.pos,this.object,act);
    }

    show(x,y,options=['use','drop'],object)
    {
        this.object = object;
        super.show();        
        Object.values(this.btns).forEach((btn)=>{btn.hide();})
        options.forEach((opt)=>{this.btns[opt].show();})
        this.setPosition(x,y).rePos().layout();
        // close
        UiInfo.close();
        UiCursor.set();
    }

    rePos()
    {
        if(this.right>GM.w) {this.x-=this.right-GM.w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
        return this;
    }

    close() 
    {
        this.hide();
        this.onclose?.();
    }

}

class Observe extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : 300,
            height : 300,
            orientation : 'y',
        }

        super(scene,config)

        this.addBg(scene)
            .addTop(scene)
            .addName(scene)
            .addDivider(scene)
            .addProps(scene)
            .layout()
            .hide()
    }

    addName(scene)
    {
        this.add(text(scene),{key:'name'})
        return this;
    }

    addProps(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'y'})
        this.add(sizer,{expand:true,key:'props'})
        return this;
    }

    update()
    {
        this.getElement('name').setText(this.owner.role.name);
        let props = this.getElement('props');
        props.removeAll(true)
        let life = this.owner.status.states['life'];
        let value = `${life.cur} / ${life.max}`
        props.add(this.prop('life'.local(), value, false),{expand:true,padding:{left:10,right:10}})
        this.layout();
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
    }
}

export class UiStorage extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x:100,
            y:GM.h-150,
            orientation:'y'
        }

        super(scene,config);
        UiStorage.instance = this;
        this.addBg_Int(scene)
            .addTop(scene)
            .addGrid(scene,4,4,this.getOwner.bind(this),{space:{left:20,right:20,bottom:20}})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(0,1)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getLayer().name = 'UiStorage';
    }

    setCat(cat)
    {
        this.cat = cat;
        this.updateGrid();
    }

    close() 
    {
        if(!this.visible) {return;}

        super.close();
        // close/unregister/camera
        UiCover.close();
        this.owner.setEnable?.(true);
        clrCamera(GM.CAM_LEFT_TOP);
        this.unregister();

        delete this.owner.target;
        delete Role.Avatar.instance.target;
    }

    refresh()
    {
        this.updateGrid();
    }

    show(owner, cat=GM.CAT_ALL)
    {
        super.show();
        this.owner = owner;
        this.owner.target = Role.Avatar.instance;
        Role.Avatar.instance.target = this.owner;

        this.setTitle(owner.name);
        this.updateGrid(cat);
        this.layout();
        UiCursor.set();
        
        // show
        UiInv.show(Role.Avatar.instance);
        // cover/closeAll/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);  
        setCamera(GM.CAM_LEFT_TOP);
    }

    static close() {this.instance?.close();}

    static show(owner,cat) {this.instance?.show(owner,cat);}
}

export class UiInv extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w,
            y : 0,
            width : 450,
            height : 500,
            orientation : 'y',
        }

        super(scene,config)
        UiInv.instance = this;

        this.addBg_Int(scene)
            .addTop(scene,'裝備')
            .addEquip(scene,this.getOwner.bind(this))
            .addGold(scene)
            .addGrid(scene,5,4,this.getOwner.bind(this),{space:{bottom:30}})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(1,0)
            .layout()
            .hide()
        scene.add.existing(this);
        
           //.on('pointerout',()=>{!this.isPointerInBounds()&&console.log('out')})
        //this.onClickOutside(()=>{console.log('outside')});
        
        this.getLayer().name = 'UiInv';
    }

    addEquip(scene, getOwner)
    {
        let config =
        {
            column: 5,
            row: 2,
            space: {column:5,row:5,left:0,right:0,bottom:20},
        }
        let grid = scene.rexUI.add.gridSizer(config);
        let equip = function(id, cat, getOwner)
        {
            let slot = new EquipSlot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, id, getOwner, {cat:cat});
            return slot;
        }
        let i=0;
        grid.add(equip(i++, GM.CAT_WEAPON, getOwner))
            .add(equip(i++, GM.CAT_HELMET, getOwner))
            .add(equip(i++, GM.CAT_CHESTPLATE, getOwner))
            .add(equip(i++, GM.CAT_GLOVES, getOwner))
            .add(equip(i++, GM.CAT_BOOTS, getOwner))
            .add(equip(i++, GM.CAT_NECKLACE, getOwner))
            .add(equip(i++, GM.CAT_RING, getOwner))
            .add(equip(i++, GM.CAT_RING, getOwner))
            .add(equip(i++, GM.CAT_EQUIP|GM.CAT_BAG, getOwner))

        this.add(grid,{key:'equip'});
        return this;
        
    }

    update()
    {
        if(!this.visible) {return;}
        this.updateEquip();
        this.updateGrid();
        this.updateGold();
        this.layout();
    }

    refresh()
    {
        this.update();
    }

    check(cat)
    {
        this.getElement('equip').getElement('items').forEach(item => {item?.check(cat);});
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        // closeAll/unregister/camera
        this.unregister();
        Ui.closeAll(GM.UI_LEFT);
        clrCamera(GM.CAM_LEFT);
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        // register/camera
        this.register(GM.UI_RIGHT);     
        setCamera(GM.CAM_LEFT);
    }

    toggle(owner)
    {
        if(this.visible) {this.close();}
        else {this.show(owner);}
    }

    filter(type)
    {
        if(type=='storage')
        {
            this.getElement('equip').getElement('items').forEach((slot) => {
                slot?.setEnable(!slot?.item?.storage);
            });
            this.getElement('grid').getElement('items').forEach((slot) => {
                slot.setEnable(!slot?.item?.storage);
            });
        }
    }

    unfilter()
    {
        this.getElement('equip').getElement('items').forEach((slot) => {
            slot?.setEnable(true);
        });
        this.getElement('grid').getElement('items').forEach((slot) => {
            slot.setEnable(true);
        });
    }   

    static close() {UiInv.instance?.close();}
    static show(owner) {UiInv.instance?.show(owner);}
    static updateGold() {UiInv.instance?.updateGold();}
    static refresh() {UiInv.instance?.update();}
    static toggle(owner) {UiInv.instance?.toggle(owner);}
    static check(cat) {UiInv.instance?.check(cat);}
    static filter(type) {UiInv.instance?.filter(type);}
    static unfilter() {UiInv.instance?.unfilter();}
    
}

export class UiOption extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiOption.instance = this;
        this.add(new Option(scene))
            .close() 

        this.getLayer().name = 'UiOption';
    }

    static show(x,y,acts,target) {UiOption.instance?.show(x,y,acts,target);}

}

class UiObserve extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene,false);
        UiObserve.instance = this;
        this.add(new Observe(scene))
            .close()

        this.getLayer().name = 'UiObserve';
    }

    static show(owner) {this.instance?.show(owner);}
}

class UiCount extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene,false);
        UiCount.instance = this;
        this.add(new Count(scene))
            .close()

        this.getLayer().name = 'UiCount';
    }

    // static show(owner) {this.instance?.show(owner);}
    static getCount(min,max) {return this.instance.show(min,max);}
}

export class UiMain extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config = {space:{item:10,left:10,right:10,top:10,bottom:10}}
        super(scene,config);
        UiMain.instance = this;

        this.addBg_Int(scene)
            .add(new UiButton(scene,{text:'裝\n備',onclick:this.inv.bind(this)}))
            .add(new UiButton(scene,{text:'個\n人',onclick:this.profile.bind(this)}))
            .add(new UiButton(scene,{text:'離\n開',onclick:this.menu.bind(this)}))
            .add(new UiButton(scene,{text:'測\n試',onclick:this.test.bind(this)}))
            .add(new UiButton(scene,{text:'除\n錯',onclick:this.debug.bind(this)}))
            .addEnable(scene)
            .size()
            .hide();
        
        this.getLayer().name = 'UiMain';    // 產生layer，並設定layer名稱
        this.addListener();
       
    }

    addEnable(scene)
    {
        this.addBackground(rect(scene,{alpha:0}),'enable');
        this._enable = this.getElement('enable');
        return this;
    }

    enable(en)
    {
        if(en){this._enable.disableInteractive();}
        else{this._enable.setInteractive();}
    }

    inv() {
        // UiInv.toggle(Role.Avatar.instance);
        UiInv.toggle(Role.getPlayer());
    }

    profile() {
        // UiProfile.toggle(Role.Avatar.instance);
        UiProfile.toggle(Role.getPlayer());
    }

    menu() {this.close();this.closeAll(GM.UI_ALL);send('menu');}

    test() 
    {
        //this.closeAll();
        //UiGameOver.show();
        TimeManager.inc(60);
        console.log(TimeManager.time)
    }

    debug()
    {
        console.log('debuger')
        UiDebuger.show();
    }

    addListener()
    {
        this.setInteractive();
        this.on('pointerover',()=>{mark(false);})
            .on('pointerout',()=>{mark(true);})
    }

    size()
    {
        let viewport = this.scene.rexUI.viewport;
        this.setPosition(viewport.width/2, viewport.height)
            .setOrigin(0.5,1)
            .setMinWidth(viewport.width-100)
            //.setMinSize(viewport.width-100, 80)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        return this;
    }

    close() 
    {
        super.close();
        this.unregister();   
    }

    show()
    {
        super.show();
        this.register(GM.UI_BOTTOM);
    }

    static show() {UiMain.instance?.show();}

    static close() {UiMain.instance?.close(true);}

    static enable(en) {UiMain.instance?.enable(en);} 

}

export class UiCursor extends Phaser.GameObjects.Sprite
{
    static icons = {
        none :  {sprite:'cursors/cursor_none', origin:{x:0.25,y:0}, scale:1},
        aim :   {sprite:'cursors/target_b', origin:{x:0.5,y:0.5}, scale:0.7},
        attack :  {sprite:'cursors/tool_sword_b', origin:{x:0.5,y:0.5}, scale:0.7},
        pickup :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
        talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
        open :  {sprite:'cursors/gauntlet_open', origin:{x:0.5,y:0.5}, scale:1},
        tool :  {sprite:'cursors/tool_wrench', origin:{x:0.5,y:0.5}, scale:1},
    }

    static instance = null;

    constructor(scene)
    {
        super(scene);
        UiCursor.instance = this;
        this.scene = scene;
        scene.add.existing(this);
        this.setDepth(Infinity);
        this.setIcon('none');
    }

    preUpdate(time, delta)
    {
        //console.log(this.scene.input.x,this.scene.input.y);
        this.setPosition(this.scene.input.x, this.scene.input.y);
    }

    setIcon(type)
    {
        type = !type || type=='' ? 'none':type;
        let icon = UiCursor.icons[type];
        let [key,frame]=icon.sprite.split('/')
        this.setTexture(key,frame);
        this.setOrigin(icon.origin.x,icon.origin.y);
        this.setScale(icon.scale);
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.setDepth(10000);
            this._dbgGraphics.name = 'cursor';
        }

        //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics//.strokeRectShape(rect)
                        .strokeCircleShape(circle);
    }

    setPos(x,y)
    {
        this.setPosition(x,y);
        this.debugDraw();
    }

    static pos(x,y)
    {
        if(UiCursor.instance) {UiCursor.instance.setPos(x,y);}
    }

    static set(type)
    {
        if(UiCursor.instance) {UiCursor.instance.setIcon(type);}
    }

}

export class UiTrade extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : 450,
            height : 500,
            orientation : 'y',
            space:{bottom:20},
        }
        super(scene, config);
        UiTrade.instance = this;

        this.addBg(scene)    
            .addTop(scene,'交易')
            .addInfo(scene)
            .addGold(scene)
            .addGrid(scene,5,6,this.getOwner.bind(this))
            .setOrigin(0)
            .layout()
            .hide()
        
        this.getLayer().name = 'UiTrade';    // 產生layer，並設定layer名稱       
    }


    addInfo(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.add(sprite(scene,{icon:'portraits/0'}),{padding:10, key:'icon'});
        sizer.add(bbcText(scene,{text:'阿凡達\n精靈'}),{align:'top',key:'name'});
        this.add(sizer,{expand:true,key:'descript'});
        return this;
    }

    update()
    {
        this.updateInfo();
        this.updateGrid();
        this.updateGold();
        this.layout();
    }

    updateInfo()
    {
        let [key,frame]=this.owner.role.icon.split('/');
        this.getElement('icon',true).setTexture(key,frame);
        this.getElement('name',true).setText(this.owner.role.name);
    }

    refresh()
    {
        this.update();
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        // close/camera/unregister
        UiCover.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();

        delete this.owner.trade;
        delete this.owner.target;
        delete Role.Avatar.instance.trade;
        delete Role.Avatar.instance.target;
    }

    show(owner)
    {
        super.show();
        owner.restock();
        this.owner = owner;
        this.owner.trade = GM.SELLER;
        this.owner.target = Role.Avatar.instance;
        Role.Avatar.instance.trade = GM.BUYER;
        Role.Avatar.instance.target = this.owner;

        this.update();
        // show
        UiInv.show(Role.Avatar.instance);
        // cover/closeAll/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);    
        setCamera(GM.CAM_RIGHT);         
    }

    static show(owner) {UiTrade.instance?.show(owner);}
    static close() {UiTrade.instance?.close();}
    static updateGold() {UiTrade.instance?.updateGold();}

}

export class UiProfile extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : 450,
            height : 500,
            orientation : 'y',
            space:{bottom:20},
        }
        super(scene, config);
        UiProfile.instance = this;

        this.addBg_Int(scene)    
            .addTop(scene,'個人')
            .addInfo(scene)
            .addTab(scene)
            .addPage(scene,'attrs')
            .addPage(scene,'states')
            .setOrigin(0)
            .layout()
            .hide()
        
        this.getLayer().name = 'UiProfile';    // 產生layer，並設定layer名稱       
    }

    addInfo(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{alpha:0,strokeColor:0x777777,strokeWidth:2}))
        sizer.add(sprite(scene,{icon:'portraits/0'}),{padding:10, key:'icon'});
        sizer.add(bbcText(scene,{text:'阿凡達\n精靈'}),{align:'top',padding:{top:10},key:'name'});
        this.add(sizer,{expand:true,padding:{left:10,right:10},key:'info'});
        return this;
    }

    updateInfo()
    {
        let [key,frame]=this.owner.role.icon.split('/');
        this.getElement('icon',true).setTexture(key,frame);
        this.getElement('name',true).setText(this.owner.role.name);
    }

    // addTabPages(scene)
    // {
    //     let config = {
    //         background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 0, GM.COLOR_GRAY),
    //         tabs: {space: { item: 10 }},
    //         //pages: {fadeIn: 300},
    //         align: {tabs: 'left'},
    //         space: { left: 5, right: 5, top: 5, bottom: 5, item: 10 }
    //     }

    //     let tabPages = scene.rexUI.add.tabPages(config); 

    //     tabPages
    //         .addPage({
    //             key: 'page0',
    //             tab: text(scene,{text:'page0'}),
    //             page: text(scene,{text:'page0'})
    //         })
    //         .addPage({
    //             key: 'page1',
    //             tab: text(scene,{text:'page1'}),
    //             page: text(scene,{text:'page1'})
    //         })
    //         .on('tab.focus', function (tab, key) {
    //             //console.log(tab,key)
    //             console.log('focus',key)
    //             tab.setColor('#ff0000');
    //         })
    //         .on('tab.blur', function (tab, key) {
    //             //console.log(tab,key)
    //             console.log('blur',key)
    //             tab.setColor('#ffffff');
    //         })

    //     this.add(tabPages,{expand:true,padding:{left:10,right:10}});
    //     return this;
    // }

    addTab(scene)
    {
        let button_pre;
        let config = {
            background: rect(scene,{alpha:0,strokeColor:0x777777,strokeWidth:2}),
            topButtons:[text(scene,{text:'attrs'.local(),color:'#777777'}),
                        text(scene,{text:'states'.local(),color:'#777777'})],
            space: {left:5, top:5, bottom:5, topButton:20}
        }

        let tabs = scene.rexUI.add.tabs(config); 

        tabs.on('button.click', (button, groupName, index)=>{
                if(button_pre) 
                {
                    button_pre.setColor('#777777');
                    this.getElement(button_pre.text)?.hide();
                }
                button_pre = button;
                button.setColor('#ffffff');
                this.getElement(button.text)?.show();
                this.layout();
            })

        this.add(tabs,{expand:true,padding:{left:10,right:10},key:'tags'});
        return this;
    }

    addPage(scene, key)
    {
        let config = {
            //width: 400,
            height: 220,
            background: rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
            panel: {
                child: scene.rexUI.add.sizer({orientation:'y',space:5}),
            },
        }
        let panel = scene.rexUI.add.scrollablePanel(config);
        this.add(panel,{expand:true,padding:{left:10,right:10},key:key.local()});
        panel.hide();
        return this;
    }

    updatePage(cat)
    {
        let panel = this.getElement(cat.local());
        let childPanel = panel.getElement('panel');

        childPanel.removeAll(true);

        for(let [key,value] of Object.entries(this.owner.status[cat]))
        {
            switch(key)
            {
                case 'life': value = `${value.cur} / ${value.max}`; break;
            }

            childPanel.add(this.prop(key,value),{expand:true,padding:{left:5,right:5}})
        }

        return this;
    }

    update()
    {
        if(this.visible)
        {
            //console.log('update');
            this.updatePage('attrs')
                .updatePage('states')
                .layout();
        }
    }

    show(owner)
    {
        this.owner = owner;
        super.show();
        this.updateInfo();
        this.update();
        this.getElement('tags').emitTopButtonClick(0);
        // closeAll/register/camera
        Ui.closeAll(GM.UI_LEFT);
        this.register(GM.UI_LEFT_P);
        setCamera(GM.CAM_RIGHT);
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();
    }

    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner) {UiProfile.instance?.show(owner);}
    static close() {UiProfile.instance?.close();}
    static refresh() {UiProfile.instance?.update();}
    static toggle(owner) {UiProfile.instance?.toggle(owner);}
    static get shown() {UiProfile.instance?.visible;}
}

export class UiDialog extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h,
            width : 600,
            //height : 300,
            orientation : 'y',
            //space:{bottom:20},
        }

        super(scene, config);
        UiDialog.instance=this;
        this//.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:0x777777,strokeWidth:3}),'bg')
            .addBg(scene)
            .addSpeakerA(scene)
            .addSpeakerB(scene)
            .setOrigin(0.5,1)
            .layout()
            .hide()

        let iconA = this.getElement('iconA',true);
        let iconB = this.getElement('iconB',true);
        let nameA = this.getElement('nameA',true);
        let textA = this.getElement('textA',true);
        let textB = this.getElement('textB',true).getElement('panel');

        //let typing = scene.plugins.get('rexTextTyping').add(txt,{speed:50,wrap:true});
        const lineCnt=3;
        let page = scene.plugins.get('rexTextPage').add(textA,{maxLines:lineCnt});

        this.getLayer().name = 'UiDialog';    // 產生layer，並設定layer名稱

 
        this.setIconA = (icon)=>{let [key,frame]=icon.split('/');iconA.setTexture(key,frame);return this;}
        this.setNameA = (name)=>{nameA.setText(name);return this;}
        this.setTextA = (text)=>{page.setText(text);return this;}

        this.setTextB = (options)=>{
            textB.removeAll(true);
            options.forEach((option)=>{
                textB.add(this.createOption(option),{align:'left',expand:true})
            })
            this.layout();
            return this;
        }

        this.nextPage = ()=>{
            let np = page.getNextPage();
            textA.setText(np);
            //console.log(page.pageCount,page.pageIndex)
            if (page.isLastPage) {this.setTextB(this.dialog[this.id].B);} 
            else {this.setTextB(['*聆聽...*/next']);}
        }
    }

    addSpeakerA(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(sprite(scene,{icon:'portraits/0'}),{padding:{left:10,top:10,bottom:50,right:10},key:'iconA'})
            .add(this.createSub(scene),{align:'top',padding:{top:10},key:'sub'});
        this.add(sizer,{expand:true,padding:{left:10,right:10,top:10},key:'speakerA'});
        return this;
    }

    createSub(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'y'});
        sizer.add(bbcText(scene,{text:'[color=yellow]阿凡達[/color]'}),{align:'left',key:'nameA'})
            .add(bbcText(scene,{text:'說明',wrapWidth:500}),{align:'left',key:'textA'})
        return sizer;
    }
    

    addSpeakerB(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_DARK}),'bg')
            .add(sprite(scene,{icon:'portraits/1'}),{padding:{left:10,top:10,bottom:50,right:10},key:'iconB'})
            .add(this.createTextB(),{padding:{top:10},expand:true,align:'top',proportion:1,key:'textB'})
        this.add(sizer,{expand:true,padding:{left:10,right:10,bottom:10},key:'speakerB'});
        return this;
    }

    createTextB()
    {
        let scene = this.scene;
        let scroll = scene.rexUI.add.scrollablePanel({
            //background:rect(scene),
            panel: {child:scene.rexUI.add.sizer({orientation:'y'})},
            mouseWheelScroller: {focus:false,speed:0.1},
            slider: {
                // track: scene.rexUI.add.roundRectangle(0, 0, 20, 10, 10, GM.COLOR_DARK),
                // thumb: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 13, GM.COLOR_LIGHT),
                track: rect(scene,{width:20,color:GM.COLOR_PRIMARY}),
                thumb: rect(scene,{radius:13,color:GM.COLOR_LIGHT}),
                hideUnscrollableSlider: true,
            },
        })
        return scroll;
    }

    createOption(option)
    {
        let [text, cmd] = option.split('/');
        let scene = this.scene;
        let sizer = scene.rexUI.add.sizer();
        sizer.addBackground(rect(scene,{color:GM.COLOR_GRAY}),'bg')
            .add(bbcText(scene,{text:text}),{align:'left'})
        let bg = sizer.getElement('bg').setAlpha(0);
        if(cmd)
        {
            sizer.setInteractive()
                .on('pointerover',()=>{bg.setAlpha(1);})
                .on('pointerout',()=>{bg.setAlpha(0);})
                .on('pointerdown',()=>{this.execute(cmd);})
        }
        return sizer;
    }

    execute(cmd)
    {
        let [op,p1]=cmd.split(' ');
        switch(op)
        {
            case 'next': this.nextPage(); break;
            case 'exit': this.close(); break;
            case 'trade': this.trade(); break;
        }
    }

    trade()
    {
        this.close();
        UiTrade.show(this.owner); 
    }

    close()
    {
        super.close(); 
        UiCover.close();
        UiMain.show();
    }

    show(owner)
    {
        this.owner = owner;
        this.dialog = owner.dialog;
        this.id = 0;
        super.show();
        this.setIconA(owner.role.icon)
            .setNameA(owner.role.name)
            .setTextA(this.dialog[this.id].A)
            .nextPage();
        // show
        UiCover.show();
        UiCursor.set();
        // close
        this.closeAll(~GM.UI_MSG);
    }

    static show(owner) {if(UiDialog.instance) {UiDialog.instance.show(owner);}}

}

export class UiChangeScene extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : GM.w,
            height : GM.h,
            //orientation : 'x',
            //space:{left:10},
        }

        super(scene, config);
        UiChangeScene.instance = this;

        this.addBg_Int(scene,{color:GM.COLOR_BLACK,alpha:1})
            .setOrigin(0)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()
    }

    start(gotoScene, duration=GM.T_CHANGE_SCENE)
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0,to:1},
            duration: duration,
            onComplete: ()=>{gotoScene();this._t = this.scene.time.now;}
        })
    }

    done()
    {
        console.log('t(change scene) =',this.scene.time.now-this._t);
        this.close();
    }

    static done() {this.instance?.done();}
    static start(changeScene) {this.instance?.start(changeScene);}

}

export class UiMessage extends ContainerLite
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiMessage.instance = this;
        this.scene = scene;
        scene.add.existing(this);

        let config =
        {
            x: 10,
            y: GM.h-80,
            width: 200,
            height: 500,
        }

        this.addMask(scene, config)
            .addPanel(scene, config)
            .visible = false;

        this.originY = config.y;
        this.queue = [];
        this.processing = false;

        //this.UnitTest();
    }

    UnitTest()
    {
        this.push('test-1111111111111111111111')
            .push('test-2')
            .push('test-3')
            .push('test-4')
            .push('test-5')
            .push('test-6')
            .push('test-7')
            .push('test-8')
    }

    addMask(scene, config)
    {
        config.alpha=0.5;
        const maskRect = rect(scene,config).setVisible(false);
        maskRect.setOrigin(0,1);
        const mask = maskRect.createGeometryMask();
        this.add(maskRect)
        this.setMask(mask);
        return this;
    }

    addPanel(scene, config)
    {
        this.panel = scene.rexUI.add.sizer({x:config.x,y:config.y,orientation:'y'});
        this.panel.setOrigin(0,1);
        this.add(this.panel);
        return this;
    }

    delayAlpha(delay=3000)
    {
        this.setAlpha(1);
        if (this._interval) {clearTimeout(this._interval);}
        this._interval = setTimeout(() => {this.setAlpha(0.5);}, delay); 
    }

    processNext(msgCnt=5) 
    {
        let msgs = this.panel.getElement('items')
        if(msgs.length > msgCnt)
        {
            this.panel.remove(msgs[0],true);
            this.panel.layout();
        }

        if (this.queue.length === 0) 
        {
            this.processing = false;
            return;
        }

        this.processing = true;
        let msg = this.queue.shift();
        
        this.process(msg);
    }


    process(msg,{wrapWidth=200,duration=250,completeDelay=100}={}) 
    {
        this.delayAlpha();

        let hTmp = this.panel.height;
        this.panel.add(bbcText(this.scene, {text:msg, wrapWidth:wrapWidth}),{align:'left'})
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)

        let from = this.originY + this.panel.height - hTmp;
        let to = this.originY;
        this.panel.y = from;
        
        this.scene.tweens.addCounter({
            from: from,
            to: to,
            duration: duration,
            completeDelay: completeDelay,
            onUpdate: (tween) => {this.panel.y = tween.getValue();},
            onComplete: () => {this.processNext();}
        });
    }

    push(msg) 
    {
        if(!this.visible) {this.show();}
        this.queue.push(msg);
        if (!this.processing) {this.processNext();}

        return this;
    }

    clear()
    {
        console.log('clear')
        this.queue = [];
        this.panel.removeAll(true).layout();
    }

    close() 
    {
        this.visible = false;
        Ui.unregister(this);   
    }

    show()
    {
        this.visible = true;
        Ui.register(this,GM.UI_MSG);
    }

    static clear() {this.instance?.clear();}
    static push(msg) {return this.instance?.push(msg);}
}


export class UiGameOver extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : GM.w,
            height : GM.h,
            orientation: 'x'
        }

        super(scene,config)
        this.scene=scene;
        UiGameOver.instance=this;
        this.addBg(scene,{color:GM.COLOR_BLACK,alpha:0.5})
            .addSpace()
            .add(text(scene,{text:'遊 戲 結 束',fontSize:64}),{align:'bottom',padding:{bottom:GM.h/4}})
            .addSpace()
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)
            .addLisitener()
            .close()
    }

    addLisitener()
    {
        this.setInteractive()
            .on('pointerdown',()=>{this.close(); send('menu');})
        return this;
    }

    show()
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0, to:1},
            duration: 1000,
        })
    }

    static show() {UiGameOver.instance?.show();}

}


class UiDebuger extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            orientation: 'y',
            space:{top:10,bottom:10,left:10,right:10,item:10},
        }

        super(scene,config)
        UiDebuger.instance=this;
        this.scene=scene;
        this.addBg_Int(scene)
            .addTop(scene, '除錯器')
            .addTextArea(scene)
            .addInput(scene)
            .layout()
            .close()
    }

    addTextArea(scene)
    {
        this.area =  scene.rexUI.add.textArea({
            width: GM.w/2,
            height: GM.h/4,
            background: rect(scene,{color:GM.COLOR_LIGHT}),
            text: bbcText(scene),
            //content: '123\n456\n789\n1111\n777\n888\n999\n111'
        })
        this.add(this.area)
        return this;
    }

    addInput(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});

        let label = scene.rexUI.add.label({
            orientation: 'x',
            background: rect(scene, {color:GM.COLOR_LIGHT}),
            text: bbcText(scene, {fixedWidth:GM.w/2-100, fixedHeight:36, valign:'center'}),
            space: {top:5,bottom:5,left:5,right:5,icon: 10}
        })
        .setInteractive()
        .on('pointerdown', function () {
            var config = {
                enterClose: false,
                onTextChanged: (textObject, text) =>{textObject.text=text;}
            }
            scene.rexUI.edit(label.getElement('text'), config);
        });

        let btn = new UiButton(scene,{text:'送出',onclick:()=>{
            let cmd = label.getElement('text').text;
            label.getElement('text').text='';
            this.process(cmd);

        }})
    
        sizer.add(label)
            .addSpace()
            .add(btn)
        this.add(sizer,{expand:true})

        return this;
    }

    process(cmd)
    {
        console.log('cmd =',cmd)
        let args = cmd.split(' ');
        let func = eval(`this.cmd_${args[0]}`);
        if(func) {func.bind(this)(args);}
        else {this.print(cmd+'  [color=yellow][無效指令!!!][/color]\n')}
    }

    print(str)
    {
        this.area.appendText(str);
        this.area.scrollToBottom();
    }

    cmd_clr(args) 
    {
        //console.log(args)
        this.area.setText('');
    }

    cmd_t(args)
    {
        //console.log(args);
        if(args.length == 1)
        {
            let t = TimeManager.time;
            let str = `d:${t.d} h:${t.h} m:${t.m}\n`;
            this.print(str)
        }
        else
        {
            for(let i=1;i<args.length;i++)
            {
                let [type,val]=args[i].split(':');
                console.log(type,val);
                TimeManager.set(type,val)
            }
        }

    }

    static show() {UiDebuger.instance?.show();}
}

export class UiTime extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w,
            y : GM.h,
            orientation: 'y',
            space:{top:10,bottom:10,left:10,right:10,item:10},
        }

        super(scene,config)
        UiTime.instance=this;
        this.scene=scene;
        this.addBg(scene)
            .addTime(scene)
            .setOrigin(1,1)
            .layout()
    }

    addTime(scene)
    {
        this.time = text(scene,{text:'D1 10:01'});
        this.add(this.time)
        return this;
    }

    static updateTime(time)
    {
        let h = String(time.h).padStart(2, '0');
        let m = String(time.m).padStart(2, '0');
        this.instance.time.setText(`D${time.d} ${h}:${m}`);
    }
}

export class UiManufacture extends UiBase
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

        super(scene,config)
        UiManufacture.instance=this;
        this.scene=scene;
        this.addBg_Int(scene)
            .addTop(scene,'製作')
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
                .addGrid(scene, 3, 3, this.getOwner, {space:{top:10},classT:MatSlot,classC:{onset:this.check}})
                .addSpace()
                .add(new OutputSlot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE,this.getOwner),{key:'output'})
                .addSpace()
                .add(new UiButton(scene,{text:'製作',onclick:this.make}),{key:'button'})
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

    update()
    {
        let itemSel = null;
        let onover = (item)=>{UiInfo.show(item);}
        let onout = ()=>{UiInfo.close();}  
        let ondown = (item)=>{
                if(!this.owner.isFull)
                {
                    itemSel?.unsel();
                    itemSel=item;
                    item.sel();
                    this.owner.sel=item.slot.id;
                    this.getElement('output',true).update();
                    this.check();
                }
            }

        let panel = this.getElement('panel',true);
        panel.removeAll(true);
        this.owner.menu.forEach((item)=>{
            let add =this.item(item,{onover:onover, onout:onout, ondown:ondown});
            if(item==this.owner.sel) {add.sel();itemSel=add;}
            panel.add(add,{expand:true})
        })
        this.layout();
        this.check();

        this.updateGrid(this.owner.cat);
        this.getElement('output',true).update();
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
        this.owner = owner;
        super.show();
        this.update();
        UiCursor.set();

        UiInv.show(Role.Avatar.instance);
        
        // cover/close/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);  
        setCamera(GM.CAM_RIGHT);

    }

    static show(owner) {this.instance.show(owner);}
}


class Count extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 300,
            height : 100,
            orientation : 'y',
            space : 0,
        }

        super(scene,config)
        this.scene=scene;
        this.addBg_Int(scene)
            .addSlider(scene)
            .addButtons(scene)
            .layout()
            //.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()
    }

    addSlider(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        let lab = label(scene,{width:50});
        let bar = slider(scene);
        bar.on('valuechange', (value) => {
            this._val = Math.round(this._min+value*(this._max-this._min));
            lab.setText(this._val)
            lab.layout();
        })
        sizer.add(lab)
        sizer.add(bar,{proportion:1,padding:{left:10},key:'bar'});
        this.add(sizer,{expand:true,padding:{left:10,right:10,top:20,bottom:20},key:'slider'});
        return this;
    }

    addButtons(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer
            .add(new UiButton(scene,{text:'確定',onclick:this.confirm.bind(this),radius:5,padding:5}))
            .addSpace()
            .add(new UiButton(scene,{text:'取消',onclick:this.cancel.bind(this),radius:5,padding:5}))
        this.add(sizer,{expand:true,padding:{left:10,right:10,bottom:20}});
        return this;
    }

    confirm()
    {
        this._resolve(this._val);
        this.close();
    }

    cancel()
    {
        this._resolve(0);
        this.close();
    }

    show(min,max)
    {
        console.log('getCount',min,max)
        super.show();
        this._min = min;
        this._max = max;
        this.getElement('bar',true).setGap(1,min,max);
        this.getElement('bar',true).setValue(1);
        this.getElement('bar',true).setValue(0);

        return new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    
}

