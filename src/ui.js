import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import ContainerLite from 'phaser3-rex-plugins/plugins/containerlite.js';
import Utility from './utility.js';
import {UI, rect, sprite, text, bbcText, Pic, Icon} from './uibase.js';
import * as Role from './role.js';
import {ItemDB} from './database.js';
import {Mark} from './gameUi.js';

let uiScene;

export default function createUI(scene)
{
    console.log('createUI');
    UI.w = scene.sys.canvas.width;
    UI.h = scene.sys.canvas.height;
    uiScene = scene;
    console.log('resolution:',UI.w, UI.h)

    //test(scene);
    //t1();
    new UiCover(scene);
    new UiCursor(scene);
    new UiInv(scene);
    new UiTrade(scene);
    new UiProfile(scene);
    new UiCase(scene);
    new UiDialog(scene);
    new UiObserve(scene);
    new UiMain(scene);
    new UiDragged(scene, 80, 80);
    new UiInfo(scene);
    new UiOption(scene);


    //t2(scene);

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
    //new UiButton(scene,{x:100,y:100,icon:UI.ICON_CLOSE})

    //console.log('test')
    //new UiButton(scene,{x:100,y:100,icon:UI.ICON_CLOSE})
    //sprite(scene,{icon:UI.ICON_CLOSE});
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
    let slot0 = new Slot(scene,80,80,{x:100,y:100,icon:UI.ICON_CLOSE,space:0});
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

function camera(mode) {uiScene.events.emit('camera',mode);}

class Slot extends Icon
{
    constructor(scene, w, h, id, getOwner, config)
    {
        super(scene, w, h, config);
        this.addListener();
        this._id = id
        this._getOwner = getOwner;
    }

    get slot() {return this.container?.[this._id];}
    set slot(value) {this.container[this._id]=value; this.setSlot(value);}

    get isEmpty() {return this.checkIfEmpty(this.slot);}
    get container() {return this._getOwner ? this._getOwner().status.bag : null;}
    get owner() {return this._getOwner?.();}
    get isValid() {return true;}
    get isTrade() {return this.owner?.tradeable??false;}
    get acts() {return ['use','drop']}

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

    checkIfEmpty(slot) {return !slot || Object.keys(slot).length==0;}

    setBgColor(color) {this.getElement('background').fillColor = color;}

    copyData() {return this.slot ? {slot:Utility.deepClone(this.slot),owner:this.owner} : null;}

    update() {this.setSlot(this.slot);}

    clear() {super.clear();this.slot={};}
    
    over()
    {
        if(UiDragged.on) 
        {
            //console.log('slot:',this.isTrade,'dragged:',UiDragged.isTrade);
            //console.log('buy:',this.isSell,'sell:',this.isBuy)
            if(this.isSell||this.isBuy)
            {
                if(this.isEmpty)
                {
                    this.setBgColor(this.isValid ? UI.COLOR_SLOT_TRADE : UI.COLOR_SLOT_INVALID);
                }
                else
                {
                    this.setBgColor(UI.COLOR_SLOT_DISABLE);
                }
            }
            else
            {
                this.setBgColor(this.isValid ? UI.COLOR_SLOT_DRAG : UI.COLOR_SLOT_INVALID);
            }
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(UI.COLOR_SLOT_OVER);
            // 使用 setTimeout 延遲執行 UiInfo.show()
            this.pointerOverTimeout = setTimeout(() => {UiInfo.show(this);}, UI.OVER_DELAY);
        }
    }

    out()
    {
        clearTimeout(this.pointerOverTimeout);        
        this.setBgColor(UI.COLOR_SLOT);
        UiInfo.close();
    }

    leave(gameObject)
    {
        UiDragged.on&&gameObject.setBgColor(UI.COLOR_SLOT);
    }

    enter(gameObject)
    {
        UiDragged.on&&this.noTrade&&gameObject.setBgColor(UI.COLOR_SLOT_DRAG);
    }

    middleButtonDown(x,y)
    {
        if(!this.isEmpty) {UiOption.show(this.left+x-20,this.top+y-20, this.acts,this);}
    }

    get isSell() {return this.isTrade && !UiDragged.isTrade;}

    get isBuy() {return !this.isTrade && UiDragged.isTrade;}

    get noTrade() {return this.isTrade == UiDragged.isTrade;}

    use()
    {
        console.log('use');
        this.clear();
    }

    drop()
    {
        console.log('drop');
        console.log(this.owner);
        this.owner.drop(this);
        this.clear();
    }

    trade()
    {
        if(!this.isEmpty) {return;}
        if(this.owner.status.gold >= UiDragged.gold)
        {
            this.owner.status.gold -= UiDragged.gold;
            UiDragged.owner.status.gold += UiDragged.gold;
            this.slot = UiDragged.slot;
            UiDragged.clear();
            UiInv.updateGold();
            UiTrade.updateGold();
        }   
    }

    leftButtonDown(x,y)
    {
        UiInfo.close();
        if(UiDragged.on)
        {
            if(this.isBuy||this.isSell) {this.trade();}
            else if(this.isValid)
            {
                let dataCopy = this.copyData();
                this.slot = UiDragged.slot;
                UiDragged.clear();
                //console.log('slotCopty',slotCopy);
                if(!this.checkIfEmpty(dataCopy?.slot)) {UiDragged.data=dataCopy;}
                if(!UiDragged.on) {this.setBgColor(UI.COLOR_SLOT);}
            }
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(UI.COLOR_SLOT_DRAG);
            //UiDragged.slot = this.copySlot();;
            UiDragged.data = this.copyData();;
            UiDragged.setPos(this.left+x,this.top+y);
            this.clear();
        }
        //console.log(this.container)
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
        weapon      : UI.ICON_WEAPON,
        helmet      : UI.ICON_HELMET,
        chestplate  : UI.ICON_CHESTPLATE,
        gloves      : UI.ICON_GLOVES,
        boots       : UI.ICON_BOOTS,
        necklace    : UI.ICON_NECKLACE,
        ring        : UI.ICON_RING,
    }

    constructor(scene, w, h, id, getOwner, config, cat)
    {
        super(scene, w, h, id, getOwner, config);
        this._cat = cat;
        this.setIcon();
    }

    get container() {return this._getOwner ? this._getOwner().status.equips : null;}

    get cat() {return this._cat;}

    get isValid() {return UiDragged.isCat(this.cat)}

    // get, set 都要 assign 才會正常 work
    get slot() {return super.slot;}
    set slot(value) {super.slot=value; Role.Player.equip(); UiProfile.refresh();}

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.icons[this.cat],{alpha:0.25,tint:0x0});}
    }

}

function addTop(scene, label)
{
    let sz = scene.rexUI.add.overlapSizer();
    sz//.addBackground(rect(scene,{color:UI.COLOR_GRAY}))
        .add(text(scene,{text:label}),{align:'center',expand:false,key:'label'})
        .add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.close.bind(this)}),{align:'right',expand:false})
    this.add(sz,{expand:true, key:'top'});
    return this;
}


function addGrid(scene, column, row, getOwner, space)
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
        let slot = new Slot(scene,UI.SLOT_SIZE,UI.SLOT_SIZE, i, getOwner);
        //slot.id = i;
        //slot.container = getContainer;
        grid.add(slot);
    }

    this.add(grid,{key:'grid'});
    return this;
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
    static get slot() {return UiDragged.instance.data.slot;}
    static get owner() {return UiDragged.instance.data.owner;}
    static get gold() {return UiDragged.instance.data.item.gold;}
    static get isTrade() {return UiDragged.instance.data.owner.tradeable??false;}
    static set data(value) {UiDragged.instance.setData(value);}

    isCat(cat) {return this.data.item.cat == cat;}

    clear()
    {
        this.hide();
        delete this.data;
    }

    setData(value)
    {
        this.show();
        this.data = value;
        this.data.item = ItemDB.get(value.slot.id);
        this.setIcon(this.data.item.icon);
    }

    setIcon(icon)
    {
        let [key,frame]=icon.split('/');
        this.getElement('sprite').setTexture(key,frame);
        return this;
    }

    //static close() {UiDragged.instance?.hide();}

    static setPos(x,y) {return UiDragged.instance?.setPosition(x,y);}

    static clear() {UiDragged.instance?.clear();}
    
    static isCat(cat) {return UiDragged.instance?.isCat(cat);}

}

class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene,option);
        this.onclick=option?.onclick;
        if(option?.text) 
        {
            this.addBackground(rect(scene,{color:UI.COLOR_SLOT_OVER,alpha:0}),'bg')
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
        super(scene,0,0,UI.w,UI.h);
        UiCover.instance = this;
        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:0}))
            .setOrigin(0,0)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getLayer().name = 'UiCover';
        this.setInteractive()
            .on('pointerdown',()=>{
                if(this._touchClose) {UiOption.close();}
                else {console.log('touch')}
            })
    }

    show(touchClose=false)
    {
        super.show();
        this._touchClose = touchClose;
    }

    static show(touchClose) {if(UiCover.instance){UiCover.instance.show(touchClose);}}
    static close() {if(UiCover.instance){UiCover.instance.hide();}}
}

// export class UiOption extends Sizer
// {
//     static instance = null;
//     constructor(scene)
//     {
//         super(scene,{width:100,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
//         UiOption.instance = this;
//         this.btns={};

//         this.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:UI.COLOR_GRAY,strokeWidth:3}))
//             .addButton('use',this.use.bind(this))
//             .addButton('drop',this.drop.bind(this))
//             .addButton('talk')
//             .addButton('trade')
//             .addButton('observe',this.observe.bind(this))
//             .addButton('attack')
//             .addButton('open')
//             .setOrigin(0)
//             .layout()
//             .hide();

//         scene.add.existing(this);
//         this.getLayer().name = 'UiOption';
//     }

//     addButton(key,onclick)
//     {
//         let btn = new UiButton(this.scene,{text:key.local(),onclick:()=>{
//             //onclick ? onclick(key) : this.act(key); 
//             (onclick??this.act.bind(this))(key);
//         }});
            
//         this.btns[key] = btn;
//         this.add(btn,{expand:true})
//         return this;
//     }

//     use()
//     {
//         this.close();
//         //console.log('use');
//         this.target.use();
//     }

//     drop()
//     {
//         this.close();
//         //console.log('drop');
//         this.target.drop();
//     }

//     observe()
//     {
//         this.close();
//         UiObserve.show(this.target);
//     }

//     act(act)
//     {
//         this.close();
//         Role.Avatar.setDes(this.target.pos,this.target,act);
//     }


//     show(x,y,options=['use','drop'],target)
//     {
//         this.target = target;
//         UiCover.show(true);
//         UiInfo.close();
//         UiCursor.set();
//         super.show();        
//         Object.values(this.btns).forEach((btn)=>{btn.hide();})
//         options.forEach((opt)=>{this.btns[opt].show();})
//         this.setPosition(x,y).rePos().layout();
//     }

//     rePos()
//     {
//         if(this.right>UI.w) {this.x-=this.right-UI.w;}
//         else if(this.left<0) {this.x-=this.left;}
//         if(this.bottom>UI.h) {this.y-=this.bottom-UI.h;}
//         else if(this.top<0) {this.y-=this.top;}
//         return this;
//     }

//     close() {this.hide();UiCover.close();}

//     static close() {UiOption.instance?.close();}

//     static show(x,y,acts,target) {UiOption.instance?.show(x,y,acts,target);}

// }


export class UiOption extends ContainerLite
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,UI.w,UI.h);
        UiOption.instance = this;
        //this.btns={};
        this.addBg(scene)
            .addOption(scene)
            .visible=false;

        scene.add.existing(this);
        this.getLayer().name = 'UiOption';
    }

    addBg(scene)
    {
        let sizer = scene.rexUI.add.sizer(0,0,UI.w,UI.h);
        sizer.addBackground(rect(scene,{alpha:0.5}))
            .setOrigin(0)
            .layout()
            .setInteractive()
            .on('pointerdown',()=>{this.visible=false;})
        this.add(sizer);

        return this;
    }

    addOption(scene)
    {
        let sizer = scene.rexUI.add.sizer({width:100,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
        sizer.addButton = this.addButton;
        sizer.rePos = this.rePos
        sizer.btns = {};
        this.setOption = (options)=> {
            Object.values(sizer.btns).forEach((btn)=>{btn.hide();})
            options.forEach((opt)=>{sizer.btns[opt].show();});
            return this;
        }
        this.setPos = (x,y)=>{sizer.setPosition(x,y).rePos().layout();};

        sizer
            .addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:UI.COLOR_GRAY,strokeWidth:3}))
            .addButton('use',this.use.bind(this))
            .addButton('drop',this.drop.bind(this))
            .addButton('talk',this.act.bind(this))
            .addButton('trade',this.act.bind(this))
            .addButton('observe',this.observe.bind(this))
            .addButton('attack',this.act.bind(this))
            .addButton('open',this.act.bind(this))
            .setOrigin(0)
        
        this.add(sizer);
        return this;
    }

    addButton(key,onclick)
    {
        let btn = new UiButton(this.scene,{text:key.local(),onclick:()=>{
            onclick?.(key);
        }});
            
        this.btns[key] = btn;
        this.add(btn,{expand:true})
        return this;
    }

    use()
    {
        this.close();
        //console.log('use');
        this.target.use();
    }

    drop()
    {
        this.close();
        //console.log('drop');
        this.target.drop();
    }

    observe()
    {
        this.close();
        UiObserve.show(this.target);
    }

    act(act)
    {
        this.close();
        Role.Avatar.setDes(this.target.pos,this.target,act);
    }


    show(x,y,options=['use','drop'],target)
    {
        this.target = target;
        UiInfo.close();
        UiCursor.set();   
        this.visible = true;
        this.setOption(options).setPos(x,y);
    }

    rePos()
    {
        if(this.right>UI.w) {this.x-=this.right-UI.w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>UI.h) {this.y-=this.bottom-UI.h;}
        else if(this.top<0) {this.y-=this.top;}
        return this;
    }

    close() {this.visible=false;}

    static close() {UiOption.instance?.close();}

    static show(x,y,acts,target) {UiOption.instance?.show(x,y,acts,target);}

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

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:UI.COLOR_GRAY,strokeWidth:3}))
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
        sizer//.addBackground(rect(this.scene,{color:UI.COLOR_LIGHT}))
            .add(bbcText(this.scene,{text:key.local()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0});
        this.add(sizer,{expand:true});
        return this;
    }

    addGold(item)
    {
        if(item.gold)
        {
            let images = {gold:{key:'buffs',frame:210,width:UI.FONT_SIZE,height:UI.FONT_SIZE,tintFill:true }};
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

        if(target.x>UI.w/2)
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
        if(this.bottom>UI.h) {this.y-=this.bottom-UI.h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static close() {UiInfo.instance?.hide();}

    static show(target) {UiInfo.instance?.show(target);}
}

class UiBase extends Sizer
{
    getOwner() {return this.owner;}

    addBg(scene)
    {
        this.addBackground(rect(scene,{color:UI.COLOR_PRIMARY,strokeColor:0xffffff,strokeWidth:0}),'bg');
        return this;
    }

    addTop(scene, label)
    {
        let sz = scene.rexUI.add.overlapSizer();
        sz//.addBackground(rect(scene,{color:UI.COLOR_GRAY}))
            .add(text(scene,{text:label}),{align:'center',expand:false,key:'label'})
            .add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.close.bind(this)}),{align:'right',expand:false})
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
            let slot = new Slot(scene,UI.SLOT_SIZE,UI.SLOT_SIZE, i, getOwner);
            //slot.id = i;
            //slot.container = getContainer;
            grid.add(slot);
        }

        this.add(grid,{key:'grid'});
        return this;
    }

    addGold(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:0x777777,strokeWidth:3}),'bg')
        let images = {gold:{key:'buffs',frame:210,width:UI.FONT_SIZE,height:UI.FONT_SIZE,tintFill:true }};
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
        sizer.addBackground(rect(this.scene,{color:UI.COLOR_LIGHT}),'bg')
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

    updateEquip() {this.getElement('equip').getElement('items').forEach(item => {item?.update();});}

    updateGrid() {this.getElement('grid').getElement('items').forEach(item => {item?.update();});}

    updateGold() {this.getElement('gold',true).setText(`[color=yellow][img=gold][/color] ${this.owner.status.gold}`);}

    close() {this.hide();}
}

export class UiCase extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x:100,
            y:100,
            orientation:'y'
        }

        super(scene,config);
        UiCase.instance = this;
        this.addTop = addTop;
        this.addGrid = addGrid;
        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:1,strokeColor:0x777777,strokeWidth:3}),'bg')
            //.add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.hide.bind(this)}),{align:'right'})
            .addTop(scene)
            //.addGrid(scene,4,4,this.getContainer.bind(this),{left:20,right:20,bottom:20})
            .addGrid(scene,4,4,this.getOwner.bind(this),{left:20,right:20,bottom:20})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(0)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getElement('bg').setInteractive(); //避免 UI scene 的 input event 傳到其他 scene
        this.getLayer().name = 'UiCase';
    }

    //getContainer() {return this.container;}
    getOwner() {return this.owner;}

    update()
    {
        //this.grid.getElement('items').forEach(item => {item.update();});
        this.getElement('grid').getElement('items').forEach(item => {item.update();});
    }

    close() {this.hide();UiCover.close();}

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.getElement('label',true).setText(owner.name);
        this.layout();
        this.update();
        UiInv.show(Role.Avatar.instance);
        UiCover.show();
        UiCursor.set();
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
            x : UI.w-3,//UI.w/2,
            y : 2,
            width : 450,//UI.w/2,
            height : 500,
            orientation : 'y',
        }

        super(scene,config)
        UiInv.instance = this;

        this.addBg(scene)
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
        this.getElement('bg').setInteractive() //避免 UI scene 的 input event 傳到其他 scene
            .on('pointerover',()=>{UiCursor.set();})
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
            let slot = new EquipSlot(scene, UI.SLOT_SIZE, UI.SLOT_SIZE, id, getOwner, {}, cat);
            return slot;
        }
        let i=0;
        grid.add(equip(i++, UI.CAT_WEAPON, getOwner))
            .add(equip(i++, UI.CAT_HELMET, getOwner))
            .add(equip(i++, UI.CAT_CHESTPLATE, getOwner))
            .add(equip(i++, UI.CAT_GLOVES, getOwner))
            .add(equip(i++, UI.CAT_BOOTS, getOwner))
            .add(equip(i++, UI.CAT_NECKLACE, getOwner))
            .add(equip(i++, UI.CAT_RING, getOwner))
            .add(equip(i++, UI.CAT_RING, getOwner))

        this.add(grid,{key:'equip'});
        return this;
        
    }

    update()
    {
        this.updateEquip();
        this.updateGrid();
        this.updateGold();
        this.layout();
    }

    close()
    {
        this.hide();
        UiCase.close();
        UiTrade.close();
        camera(UI.CAM_CENTER);
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        camera(UI.CAM_LEFT);
        
    }

    static close() {UiInv.instance?.close();}
    static show(owner) {UiInv.instance?.show(owner);}
    static updateGold() {UiInv.instance?.updateGold();}
}

class UiObserve extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : UI.w/2,
            y : UI.h/2,
            width : 300,
            height : 300,
            orientation : 'y',
        }

        super(scene,config)
        UiObserve.instance = this;

        this.addBg(scene)
            .addTop(scene)
            .addName(scene)
            .addDivider(scene)
            .addProps(scene)
            .layout()
            .hide()
        scene.add.existing(this);
       
        this.getLayer().name = 'UiObserve';
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

    close() {this.hide();UiCover.close();}

    show(owner)
    {
        super.show();
        UiCover.show();
        this.owner = owner;
        this.update();
    }

    static show(owner) {UiObserve.instance?.show(owner);}
}




export class UiMain extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        let config = {space:{item:5}}
        super(scene,config);
        UiMain.instance = this;

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:1}),'bg')
            .add(new UiButton(scene,{text:'裝\n備',onclick:this.inv.bind(this)}))
            .add(new UiButton(scene,{text:'個\n人',onclick:this.profile.bind(this)}))
            .add(new UiButton(scene,{text:'離\n開',onclick:this.menu.bind(this)}))
            .size()
            .hide();
        
        this.getLayer().name = 'UiMain';    // 產生layer，並設定layer名稱
        this.addListener();
       
    }

    //inv() {UiInv.show(Role.Player.instance);}
    inv() {UiInv.show(Role.Avatar.instance);}

    //profile() {UiProfile.show(Role.Player.instance);}
    profile() {UiProfile.show(Role.Avatar.instance);}

    menu() {this.hide();this.scene.events.emit('menu');}

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
            //.setMinWidth(viewport.width)
            .setMinSize(viewport.width-100, 80)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        return this;
    }

    static show() {UiMain.instance?.show();}

    static close() {UiMain.instance?.hide();}

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
        this.setPosition(this.scene.input.x, this.scene.input.y);
    }

    setIcon(type)
    {
        type = type??'none';
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
            x : 3,
            y : 2,
            width : 450,//UI.w/2,
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

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        UiInv.show(Role.Avatar.instance);
        UiCover.show();
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
            x : 3,
            y : 2,
            width : 450,
            height : 500,
            orientation : 'y',
            space:{bottom:20},
        }
        super(scene, config);
        UiProfile.instance = this;

        this.addBg(scene)    
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
    //         background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 0, UI.COLOR_GRAY),
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

    }

    static show(owner) {UiProfile.instance?.show(owner);}
    static close() {UiProfile.instance?.close();}
    static refresh() {UiProfile.instance?.update();}
}

export class UiDialog extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : UI.w/2,
            y : UI.h/2,
            width : 600,
            //height : 300,
            orientation : 'y',
            //space:{bottom:20},
        }

        super(scene, config);
        UiDialog.instance=this;
        this.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:0x777777,strokeWidth:3}),'bg')
            .addSpeakerA(scene)
            .addSpeakerB(scene)
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
        sizer.addBackground(rect(scene,{color:UI.COLOR_LIGHT}),'bg')
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
        sizer.addBackground(rect(scene,{color:UI.COLOR_DARK}),'bg')
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
                // track: scene.rexUI.add.roundRectangle(0, 0, 20, 10, 10, UI.COLOR_DARK),
                // thumb: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 13, UI.COLOR_LIGHT),
                track: rect(scene,{width:20,color:UI.COLOR_PRIMARY}),
                thumb: rect(scene,{radius:13,color:UI.COLOR_LIGHT}),
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
        sizer.addBackground(rect(scene,{color:UI.COLOR_GRAY}),'bg')
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
        this.hide(); 
        UiCover.close();
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
        UiCover.show();
        UiCursor.set();
    }

    static show(owner) {if(UiDialog.instance) {UiDialog.instance.show(owner);}}

}