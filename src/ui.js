import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import ContainerLite from 'phaser3-rex-plugins/plugins/containerlite.js';
import Utility from './utility.js';
import {rect, sprite, text, bbcText, Pic, Icon} from './uibase.js';
import {GM} from './setting.js';
import * as Role from './role.js';
import {ItemDB} from './database.js';
import {Mark} from './gameUi.js';

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
    new UiProfile(scene);
    new UiCursor(scene);
    new UiInv(scene);
    new UiTrade(scene);
    new UiCase(scene);
    new UiDialog(scene);
    new UiObserve(scene);
    
    new UiDragged(scene, 80, 80);
    new UiInfo(scene);
    new UiOption(scene);
    new UiMessage(scene);

    new UiChangeScene(scene);

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

   
    //opt.show(100,100)

    //let btn=new UiButton(scene);
    //btn.setPosition(100,400);

    console.log(scene);

    //let t1 = text(scene,{x:100,y:100,text:'幹你娘123',color:'#0ff',backgroundColor:'#fff',stroke:'#000',strokeThickness:5,wrapWidth:50});
    //let t2 = bbcText(scene,{x:100,y:200,text:'[stroke]123456[/stroke]',color:'#000',backgroundColor:'#555',wrapWidth:50});

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

class Slot extends Icon
{
    constructor(scene, w, h, id, getOwner, config)
    {
        super(scene, w, h, config);
        this._id = id
        this._getOwner = getOwner;
        this.addListener();
    }

    get slot() {return this.container?.[this._id];}
    set slot(value) {this.container[this._id]=value; this.setSlot(value);}

    get gold() {return this._item?.gold;}
    get item() {return this._item;}

    get isEmpty() {return Utility.isEmpty(this.slot);}
    get container() {return this.owner?.status?.bag?.items;}
    get capacity() {return this.owner?.status?.bag?.capacity; }
    get owner() {return this._getOwner?.();}
    get isValid() {return true;}
    get acts() {return !this.owner.trade ? this.owner.target ? ['transfer','use','drop'] 
                                                            : ['use','drop']
                                        : this.owner.trade == GM.BUYER ? ['sell','drop'] 
                                                                        : ['buy'];}

    get trading() {return this.owner.trade != UiDragged.owner.trade;}
    get enabled() {return this.capacity==-1 || this._id<this.capacity;}

    setSlot(value)
    {
        this._item = ItemDB.get(value?.id);
        this.setIcon(this._item?.icon);
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

    update()
    {
        this.setSlot(this.slot);
        this.setEnable(this.enabled);
    }

    setEnable(on)
    {
        if(on)
        {
            this.setInteractive({draggable:true,dropZone:true});
            this.setBgColor(GM.COLOR_SLOT);
        }
        else
        {
            this.disableInteractive();
            this.setBgColor(GM.COLOR_SLOT_DISABLE);
        }
    }

    clear() {super.clear();this.slot=null;this._item=null;}
    
    over(check=true)
    {
        if(UiDragged.on) 
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
        if(UiDragged.on)
        {            
            if(this.isValid)
            {
                if(this.trading) 
                {
                    if(!this.isEmpty) {return;}

                    if(UiDragged.owner.sell(this.owner, UiDragged, this._id, this.isEquip))
                    {
                        UiDragged.clear();
                        UiReg.refreshAll();
                    }
                }
                else
                {
                    let dataCopy = this.copyData();
                    this.slot = UiDragged.slot;
                    UiDragged.clear();
                    if(!Utility.isEmpty(dataCopy?.slot)) {UiDragged.data=dataCopy;}
                    if(!UiDragged.on) {this.setBgColor(GM.COLOR_SLOT);}
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
    static icons =
    {
        weapon      : GM.ICON_WEAPON,
        helmet      : GM.ICON_HELMET,
        chestplate  : GM.ICON_CHESTPLATE,
        gloves      : GM.ICON_GLOVES,
        boots       : GM.ICON_BOOTS,
        necklace    : GM.ICON_NECKLACE,
        ring        : GM.ICON_RING,
    }

    constructor(scene, w, h, id, getOwner, config, cat)
    {
        super(scene, w, h, id, getOwner, config);
        this._cat = cat;
        this.setIcon();
    }

    get container() {return this.owner?.status?.equips;}
    get capacity() {return -1;}

    get cat() {return this._cat;}

    get isEquip() {return true;}

    get isValid() {return UiDragged.isCat(this.cat)}

    // get, set 都要 assign 才會正常 work
    get slot() {return super.slot;}
    set slot(value) {super.slot=value; this.owner.equip();}

    over() {super.over(false);}
    out() {super.out(false);}

    check(cat)
    {
        this.setBgColor(cat == this.cat ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT);
    }

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.icons[this.cat],{alpha:0.25,tint:0x0});}
    }

}

export class UiDragged extends Pic
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, w, h);
        UiDragged.instance = this;
        this.hide();
        this.getLayer().name = 'Dragged';
    }

    static get on() {return UiDragged.instance.visible;}
    static get slot() {return UiDragged.instance.slot;}
    static get owner() {return UiDragged.instance.owner;}
    static get item() {return UiDragged.instance.item;}
    static get gold() {return UiDragged.instance.item.gold;}
    static get isTrade() {return UiDragged.instance.data.owner.tradeable??false;}
    static set data(value) {UiDragged.instance.setData(value);}

    get owner() {return this.data.owner;}
    get slot() {return this.data.slot;}
    get item() {return this.data.item;}

    isCat(cat) {return this.data.item.cat == cat;}

    clear()
    {
        this.hide();
        delete this.data;
        UiCover.close();
        UiMain.enable(true);
    }

    setData(value)
    {
        this.show();
        this.data = value;
        //this.data.item = ItemDB.get(value.slot.id);
        //this.setIcon(this.data.item.icon);
        this.setIcon(value.item.icon);
        UiCover.show();
        UiMain.enable(false);
    }

    setIcon(icon)
    {
        let [key,frame]=icon.split('/');
        this.getElement('sprite').setTexture(key,frame);
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
    
    static isCat(cat) {return UiDragged.instance?.isCat(cat);}

    static drop() {UiDragged.instance?.drop();}

}

class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene,option);
        this.onclick=option?.onclick;
        if(option?.text) 
        {
            this.addBackground(rect(scene,{color:GM.COLOR_SLOT_OVER,alpha:0}),'bg')
                .add(text(scene,{text:option.text}))
        }
        else if(option?.icon) 
        {
            console.log('icon',option?.icon)
            this.add(sprite(scene,{icon:option.icon}),{key:'sp'})
        }

        this.layout().addListener()
        scene.add.existing(this);
        
    }

    addListener()
    {
        let bg = this.getElement('bg');
        let sp = this.getElement('sp');
        this.setInteractive();
        this.on('pointerover',()=>{bg&&(bg.fillAlpha=1); sp&&(sp.setTint(0x777777));})
            .on('pointerout',()=>{bg&&(bg.fillAlpha=0); sp&&(sp.setTint(0xffffff));})
            .on('pointerdown',()=>{this.onclick&&this.onclick();})
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
        let cat = `[color=gray]${item.cat.local()}[/color]`;
        this.add(bbcText(this.scene,{text:cat}));
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

    addProps(item)
    {
        if(item.props)
        {
            this.addDivider();
            for(let [key,value] of Object.entries(item.props))
            {
                //console.log(key,value);
                this.addProp(key,value);
            }
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

    addGold(item)
    {
        if(item.gold)
        {
            let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
            let text = `[color=yellow][img=gold][/color] ${item.gold}`
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
            .addProps(item)
            .addDescript(item)
            .addGold(item)
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

class UiReg
{
    static _list = {};
    static closeAll() {for(let key in UiReg._list){UiReg._list[key].close();}}
    static refreshAll() {for(let key in UiReg._list){UiReg._list[key].refresh?.();}}
    static register(obj) {UiReg._list[obj.constructor.name]=obj;}
    static unregister(obj) {delete UiReg._list[obj.constructor.name];}
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
        this.content.show(...args);
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

    closeAll() {UiReg.closeAll();}
    refreshAll() {UiReg.refreshAll();}
    //static refreshAll() {UiReg.refreshAll();}
    register() {UiReg.register(this);}
    unregister() {UiReg.unregister(this);}

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
            .add(new UiButton(scene,{icon:GM.ICON_CLOSE, onclick:this.close.bind(this)}),{align:'right',expand:false})
        this.add(sz,{expand:true, key:'top'});
        return this;
    }

    addGrid(scene, column, row, getOwner, space)
    {
        let config =
        {
            column: column,
            row: row,
            space: {column:5,row:5,...space},
        }

        let grid = scene.rexUI.add.gridSizer(config);
        let count = config.column * config.row;
        for(let i=0; i<count; i++)
        {
            let slot = new Slot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE, i, getOwner);
            grid.add(slot);
        }

        this.add(grid,{key:'grid'});
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

    updateEquip() {this.getElement('equip').getElement('items').forEach(item => {item?.update();});}

    updateGrid() {this.getElement('grid').getElement('items').forEach(item => {item?.update();});}

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
            // slot
            .addButton('buy',this.trade.bind(this))
            .addButton('sell',this.trade.bind(this))
            .addButton('transfer',this.transfer.bind(this))
            .addButton('use',this.use.bind(this))
            .addButton('drop',this.drop.bind(this))
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
        let btn = new UiButton(this.scene,{text:key.local(),onclick:()=>{
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

export class UiCase extends UiBase
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
        UiCase.instance = this;
        this.addBg_Int(scene)
            .addTop(scene)
            .addGrid(scene,4,4,this.getOwner.bind(this),{left:20,right:20,bottom:20})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(0,1)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getLayer().name = 'UiCase';
    }

    close() 
    {
        if(!this.visible) {return;}

        super.close();
        // close
        UiCover.close();
        clrCamera(GM.CAM_LEFT_TOP);
        // unregister
        this.unregister();

        delete this.owner.target;
        delete Role.Avatar.instance.target;
    }

    refresh()
    {
        this.updateGrid();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.owner.target = Role.Avatar.instance;
        Role.Avatar.instance.target = this.owner;

        this.setTitle(owner.name);
        this.updateGrid();
        this.layout();
        UiCursor.set();
        
        // show
        UiInv.show(Role.Avatar.instance);
        UiCover.show();
        // close
        UiProfile.close();
        // register
        this.register();  
        // camera
        setCamera(GM.CAM_LEFT_TOP);
    }

    static close() {UiCase.instance?.close();}

    static show(owner) {UiCase.instance?.show(owner);}
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
            .addGrid(scene,5,4,this.getOwner.bind(this),{bottom:30})
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
            let slot = new EquipSlot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, id, getOwner, {}, cat);
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
        // unregister
        this.unregister();
        // close
        UiCase.close();
        UiTrade.close();
        clrCamera(GM.CAM_LEFT);
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        // register
        this.register();     
        // camera
        setCamera(GM.CAM_LEFT);
    }

    toggle(owner)
    {
        if(this.visible) {this.close();}
        else {this.show(owner);}
    }

    static close() {UiInv.instance?.close();}
    static show(owner) {UiInv.instance?.show(owner);}
    static updateGold() {UiInv.instance?.updateGold();}
    static refresh() {UiInv.instance?.update();}
    static toggle(owner) {UiInv.instance?.toggle(owner);}
    static check(cat) {UiInv.instance?.check(cat);}
    
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

    static show(owner) {UiObserve.instance?.show(owner);}
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

    inv() {UiInv.toggle(Role.Avatar.instance);}

    profile() {UiProfile.toggle(Role.Avatar.instance);}

    menu() {this.close();this.closeAll();this.scene.events.emit('menu');}

    test() {this.closeAll();}

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

    close(force) 
    {
        if(force) 
        {
            super.close();
            this.unregister();
        }
    }

    show()
    {
        super.show();
        this.register();
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
        take :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
        talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
        open :  {sprite:'cursors/gauntlet_open', origin:{x:0.5,y:0.5}, scale:1},
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
        // close
        UiCover.close();
        // camera
        clrCamera(GM.CAM_RIGHT);
        // 
        this.unregister();

        delete this.owner.trade;
        delete this.owner.target;
        delete Role.Avatar.instance.trade;
        delete Role.Avatar.instance.target;
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.owner.trade = GM.SELLER;
        this.owner.target = Role.Avatar.instance;
        Role.Avatar.instance.trade = GM.BUYER;
        Role.Avatar.instance.target = this.owner;

        this.update();
        // show
        UiInv.show(Role.Avatar.instance);
        UiCover.show();
        // close
        UiProfile.close();
        // camera
        setCamera(GM.CAM_RIGHT);
        // register
        this.register();     
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
            background: rect(scene,{alpha:0,strokeColor:0x777777,strokeWidth:2}),
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
        this.register();
        // close
        UiCase.close();
        UiTrade.close();
        // camera
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
        this.closeAll();
        UiMain.close();
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

    start(changeScene, duration=GM.T_CHANGE_SCENE)
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0,to:1},
            duration: duration,
            onComplete: ()=>{
                changeScene();
                //this._t0 = this.scene.time.now;
            }
        })
    }

    done()
    {
        //console.log('t(change scene) =',this.scene.time.now-this._t0);
        this.close();
    }

    static done() {UiChangeScene.instance?.done();}
    static start(changeScene) {UiChangeScene.instance?.start(changeScene);}

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
        this.panel.removeAll(true).layout();
    }

    close(force) 
    {
        if(force)
        {
            this.visible = false;
            UiReg.unregister(this);
        }
    }

    show()
    {
        this.visible = true;
        UiReg.register(this);
    }

    static push(msg) {return UiMessage.instance?.push(msg)}

    
}