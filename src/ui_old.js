import {ItemDB, Inventory, ItemType, CardDB, QuestDB} from './database_old.js';
import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import Utility from './utility.js';
//import {Player} from './role.js';
import Record from './record.js';
import {QuestManager} from  './quest.js';
//import Button from 'phaser3-rex-plugins/plugins/button.js';

const COLOR_PRIMARY = 0x4e342e;
const COLOR_LIGHT = 0x7b5e57;
const COLOR_DARK = 0x260e04;
//const S_COLOR_DARK = '#260e04';
const COLOR_SLOT = 0xa4d4ff;
const COLOR_SLOT_DOWN = 0x4f9ef7;
const COLOR_COUNT = 0xff0000;//0x260e04;
const COLOR_WHITE = 0xffffff;
const COLOR_GRAY = 0x777777;
const COLOR_RED = 0xff0000;
const COLOR_YELLOW = 0xffff00;
const COLOR_BLACK = 0x0;
const FONT = "Arial";
const ICON_CLOSE = 'cursors/cross_small';
const ICON_DROP = 'cursors/iconPack_123';
const ICON_USE = 'cursors/iconPack_123';
const ICON_INFO = 'cursors/iconPack_27';


//const ICON_FULL = 'cursorPack/resize_d_cross';
const ICON_NONFULL = 'cursors/resize_d_cross_diagonal';
const ICON_REARRANGE = 'cursors/busy_circle';
const ICON_NEXT = 'cursors/arrow_s';
const ICON_NAV_N = 'cursors/navigation_n';
const ICON_NAV_S = 'cursors/navigation_s';

const ICON_HOME = 'buffs/16';
const ICON_EXIT = 'buffs/184';
const ICON_BAG = 'buffs/9';
const ICON_PROFILE = 'buffs/167';
const ICON_FULL = 'buffs/174';
const ICON_QUEST = 'buffs/187';



let _scene;
let _w,_h;
let _shown = false;
// let _slot;

export default function createUI(scene)
{
    console.log('createUI');
    _scene = scene;
    //scene.uiLayer = scene.add.layer();
    //scene.uiLayer.name = 'uiLayer';
    _w = scene.sys.canvas.width;
    _h = scene.sys.canvas.height;

    new UiMain(scene);
    new UiBag(scene);
    new UiProfile(scene);
    new UiStorage(scene);
    new UiTrade(scene);
    new UiEquipList(scene);
    new UiItemInfo(scene);
    //new UiItemEquip(scene);
    //new UiTest(scene);
    new UiEquipInfo(scene);

    new UiWeaponState(scene);
    new UiCursor(scene);
    //new UiDialog(scene);
    new UiBattle(scene);
    new UiStore(scene);

    new UiConfirm(scene);
    new UiMessage(scene);
    new UiCount(scene);
    
    new UiDialog(scene);
    new UiQuest(scene);

}   


function textArea(scene, {x=0,y=0,width, height, fontSize=16, bgColor=COLOR_DARK, slider=false}={})
{
    let config = {
        x: x,
        y: y,
        width: width,
        height: height,
        background: rect(scene, {color:bgColor}),
        text: text(scene,{wrapWidth:width-10,fontSize:fontSize}),
        space: {left:5, right:5, top:5, bottom:5, panel:0},
    }

    if(slider)
    {
        config.slider = {
            track: rect(scene, {color:COLOR_PRIMARY, radius:10}),
            thumb: rect(scene, {color:COLOR_LIGHT, radius:10}),
            // position: 'left'
        }
    }
        
    return scene.rexUI.add.textArea(config);
}

export function text_1(scene, config={})    
{
    // fixedWidth:fixedWidth,
    config.fontSize = config.fontSize ?? 24;
    config.fontFamily = config.fontFamily ?? FONT;
    config.wrapWidth && (config.wordWrap = {width:config.wrapWidth, useAdvancedWrap:true});
    let t = scene.add.text(config?.x, config?.y, config?.str, config);
    config.name && (t.name = config.name);
    config.anchor && (t.anchor = config.anchor);
    return t;
}

export function text(scene, config={})    
{
    // fixedWidth:fixedWidth,
    config.fontSize = config.fontSize ?? 20;
    config.fontFamily = config.fontFamily ?? FONT;
    config.wrapWidth && (config.wrap = {mode:'mix',width:config.wrapWidth});
    let t = scene.add.rexBBCodeText(config?.x, config?.y, config?.str, config);
    config.name && (t.name = config.name);
    config.anchor && (t.anchor = config.anchor);
    return t;
}

function label(scene, config={})    
{
    let t = text(scene, config);
    //let sizer = scene.rexUI.add.sizer({orientation:'x'});
    //return sizer.addSpace().add(t).addSpace();
    return scene.rexUI.add.label({text:t,align:'center',space:10});
}

// function rect(scene, {color=COLOR_PRIMARY, radius=0, alpha=1, w=0, h=0, strokeColor, strokeWidth}={})
// {
//     return scene.rexUI.add.roundRectangle({width:w,height:h,radius:radius,
//                                         color:color,alpha:alpha,
//                                         strokeColor:strokeColor, strokeWidth:strokeWidth});
// }

export function rect(scene, config={})
{
    config.color = config.color ?? COLOR_PRIMARY;
    return scene.rexUI.add.roundRectangle(config);
}

export function sprite(scene, {icon, name}={})
{
    let [atlas, frame] = icon ? icon.split('/'):[];
    let sprite = scene.add.sprite(0,0,atlas,frame);
    name && (sprite.name = name);
    return sprite;
}

function button(scene, {icon, onclick})
{
    let btn = sprite(scene,{icon:icon})
    btn.setInteractive()
        .on('pointerover',()=>{btn.setTint(0x777777);})
        .on('pointerout',()=>{btn.setTint(0xffffff);})
        .on('pointerup',()=>{onclick?.();})
    return btn;
}

// class UiCard extends Phaser.GameObjects.Container
// {
//     constructor(scene,depth,id)
//     {
//         super(scene,0,0);
//         this.id = id;
//         let dat = CardDB.get(id);
//         this.ap = dat.ap;

//         let top = scene.rexUI.add.overlapSizer();
        
//         let sizer = scene.rexUI.add.sizer({orientation:'y',space:{left:10,right:10,top:25,bottom:10}});
//         top.add(sizer);

//         sizer.addBackground(this.createBg(scene))
//             .add(this.createIcon(scene,0,0,150,100,dat.icon))
//             .add(this.createDescript(scene,0,0,150,100,dat))
//             .layout();
    
//         top.add(sizer)
//             .add(this.createAP(scene,dat.ap),{align:'left-top',expand: false})
//             .add(this.createTitle(scene,dat.title),{align:'right-top',expand: false})
//             .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
           
//         this.add(top);
//         this.setDepth(depth);
//         this.setSize(top.width,top.height);

//         scene.add.existing(this);

//         this.checkAp = (ap)=>{
//             this._ap.setText(ap<dat.ap?`[color=red]${dat.ap}[/color]`:dat.ap);
//         }

//         this.update = ()=>{
//             this._des.setText(this.parse(dat))
//         }
//     }

//     createBg(scene)
//     {
//         return rect(scene,{x:0,y:0,width:this.width,height:this.height,color:COLOR_DARK,radius:10});
//     }

//     createIcon(scene,x,y,w,h,icon=ICON_NEXT)
//     {
//         //console.log('createIcon')
//         this._icon = new Pic(scene,w,h,{x:x,y:y,icon:icon,radius:0});
//         return this._icon;
//     }

//     createDescript(scene,x,y,w,h,dat)
//     {
//         //console.log('createDes')
//         let sizer = scene.rexUI.add.sizer({x:x,y:y,width:w,height:h})
//         sizer.addBackground(rect(scene));
//         sizer.addSpace();
//         this._des = text(scene,{str:this.parse(dat),wrapWidth:w});
//         sizer.add(this._des)
//         sizer.addSpace();
//         return sizer;
//     }

//     createLabel(scene,str,w)
//     {
//         let config={
//             x: 0,
//             y: 0,
//             width: w,
//             space: 5,
//             background: rect(scene,{color:COLOR_DARK,radius:10}),
//             text: text(scene,{str:str}),
//             align: 'center',
//         }
//         let label = scene.rexUI.add.label(config);
//         return label;
//     }

//     createAP(scene, ap)
//     {
//         //console.log('createAP')
//         this._ap = this.createLabel(scene,ap);
//         return this._ap;
//     }

//     createTitle(scene, title)
//     {
//         //console.log('createTitle')
//         return this.createLabel(scene,title);
//     }

//     parse(dat)
//     {
//         let des=dat.descript.replace('%dmg', Player.role.damage);
//         des=des.replace('%val', dat.buffs?.[0].val);
//         des=des.replace('%dur', dat.buffs?.[0].dur);
//         return des;
//     }
// }

// class UiCard extends OverlapSizer
// {
//     constructor(scene,depth)
//     {
//         super(scene,0,0);
//         let sizer = scene.rexUI.add.sizer({orientation:'y',space:{left:10,right:10,top:25,bottom:10}});
//         this.add(sizer);
//         sizer.addBackground(this.createBg(scene))
//             .add(this.createIcon(scene,0,0,150,100))
//             .add(this.createDescript(scene,0,0,150,100))
//             .layout();
           
//         this.add(this.createAP(scene),{align:'left-top',expand: false})
//             .add(this.createTitle(scene),{align:'right-top',expand: false})
//             .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
           
//         scene.add.existing(this);

//         this.getLayer().name = 'UiCard'; // 產生layer，並設定layer名稱
//         this.depth=depth;
//         this.getLayer().setDepth(depth);

//         //scene.uiLayer.add(this.getLayer())

//         // this.setInteractive()
//         // .on('pointerup',()=>{
//         //     this.sel=!this.sel;
//         //     this.getLayer().setDepth(this.sel?100+this.depth:this.depth);
//         //     console.log(this.scene);
//         //     scene.tweens.add({
//         //         targets:this,
//         //         scale: this.sel ? 1.1 : 1,
//         //         ease:'back.out',
//         //         duration:300
//         //     })
//         // })
//     }

//     createBg(scene)
//     {
//         return rect(scene,{x:0,y:0,width:this.width,height:this.height,color:COLOR_DARK,radius:10});
//     }

//     createIcon(scene,x,y,w,h)
//     {
//         console.log('createIcon')
//         let icon = new Pic(scene,w,h,{x:x,y:y,icon:ICON_NEXT,radius:0})
//         return icon;
//     }

//     createDescript(scene,x,y,w,h)
//     {
//         console.log('createDes')
//         let sizer = scene.rexUI.add.sizer({x:x,y:y,width:w,height:h})
//         sizer.addBackground(rect(scene));
//         sizer.addSpace()
//         sizer.add(text(scene,{str:'普通攻擊，造成[color=red]12[/color]傷害',wrapWidth:w}))
//         sizer.addSpace()
//         return sizer;
//     }

//     createLabel(scene,str,w)
//     {
//         let config={
//             x: 0,
//             y: 0,
//             width: w,
//             space: 5,
//             background: rect(scene,{color:COLOR_DARK,radius:10}),
//             text: text(scene,{str:str}),
//             align: 'center',
//         }
//         let label = scene.rexUI.add.label(config);
//         return label;
//     }

//     createAP(scene)
//     {
//         console.log('createAP')
//         return this.createLabel(scene,3);
//     }

//     createTitle(scene)
//     {
//         console.log('createTitle')
//         return this.createLabel(scene,'普通攻擊');
//     }
// }

class UiCards extends Phaser.GameObjects.Container
{
    constructor(scene,x,y,cb)
    {
        super(scene,x,y);
        this._scl = 0.7;
        this._cb = cb;
        this._selected = undefined;
        scene.add.existing(this);
    }

    addCard(card,cb)
    {
        card.setScale(this._scl)
        card.y=-card.displayHeight/2;
        this.add(card);
        card.setInteractive()
            .on('pointerup',()=>{
                if(this._selected){this.tween_Sel(this._selected,false);}
                this._selected = this._selected!=card ? card : undefined;
                if(this._selected){this.tween_Sel(this._selected,true);}
                cb?.(this._selected);
            })
        return this;
    }

    tween_Sel(card, on)
    {
        card.setDepth(on?card.depth+100:card.depth-100);
        this.sort('depth');
        this.scene.tweens.add({
            targets: card,
            scale: on?1:this._scl,
            y: on?-card.height/2:-card.height*this._scl/2,
            ease: 'back.out',
            duration: 300,
            //onComplete: ()=>{this.layout();}
        })
    }

    tween_Remove(card)
    {
        this.scene.tweens.add({
            targets: card,
            scale: 0,
            alpha: 0,
            ease: 'linear',
            duration: 300,
            onComplete: ()=>{
                this.remove(card);
                this.layout();
            }
        })
    }

    layout()
    {
        let sum=0;
        this.iterate((child)=>{sum+=child.displayWidth;});
        let off=-sum/2;
        this.iterate((child)=>{
            child.x=(off+child.displayWidth/2);
            off+=child.displayWidth;
        });
    }

    checkAp(ap)
    {
        this.iterate((child)=>{child.checkAp(ap);})
    }

    update()
    {
        this.iterate((child)=>{child.update();})
    }

    reset()
    {
        if(this._selected)
        {
            this.tween_Sel(this._selected,false);
            this._selected=undefined;
        }
    }

    setCard(cards)
    {
        this._selected = undefined;
        this.removeAll();
        cards.forEach((card,i)=>{this.addCard(new UiCard(this.scene,i,card),this._cb)})
        this.layout();
    }

    useCard()
    {
        if(this._selected)
        {
            this.tween_Remove(this._selected);
            this._selected=null;
        }
    }

    clear()
    {
        this.removeAll();
    }
    
}

// class UiCards extends Buttons
// {
//     // options = [{text:'', icon:'', name:'',act:()=>{}}]
//     constructor(scene, options=[],config={})
//     {

//         config.orientation= 'x',
//         config.buttonsType= 'radio',
//         config.setValueCallback= function (button, value, previousValue ) {
        
//             scene.tweens.add({
//                 targets: button,
//                 scale: value ? 1 : 0.65,
//                 y: value ? -50:0,
//                 ease:'back.out',
//                 duration: 300,
//             })

//             console.log(scene);
//         }

//         let selected;
//         super(scene, config);
//         this.scene=scene;
//         this.set(options)
//             .on('button.click', (button,index, buttonArray)=>{
//                 if(selected == button.name)
//                 {
//                     selected = undefined;
//                     this.value = undefined;
//                     //this.clearAllButtonsState();
//                 }
//                 selected = this.value;
//                 button.act(this.value);
//             })
//             .layout();
            
//     }

//     set(options)
//     {
//         this.removeAll(true);

//         let btn = (opt)=>{
//             let t = new UiCard(this.scene);
//             t.act = opt.act;
//             t.up = opt.up;
//             t.down = opt.down;
//             t.out = opt.out;
//             t.ap = opt.ap ?? 1;
//             t.setScale(0.65);
//             return t;
//         }

//         options.forEach((opt,i) => {
//             this.addButton(btn(opt));
//         });

//         return this;
//     }
// }

class UiButtonsBase extends Buttons
{
    set(options, addSpace=true)
    {
        this.removeAll(true);

        let btn = (opt)=>{
            let config = {
                name: opt.name,
                space: opt.space,
                background: opt.bg ? rect(this.scene, {radius:5,color:opt.bg}):undefined,
                text: opt.text ? text(this.scene, {str:opt.text,fontSize:opt.fontSize??24}):undefined,
                icon: opt.icon ? sprite(this.scene, {icon:opt.icon}):undefined,
            }

            let t = this.scene.rexUI.add.label(config);
            t.act = opt.act;
            t.up = opt.up;
            t.down = opt.down;
            t.out = opt.out;
            t.ap = opt.ap ?? 1;
            return t;
        }

        options.forEach((opt,i) => {
            if(addSpace && options.length==1) {this.addSpace();}
            this.addButton(btn(opt));
            if(addSpace && (options.length==1 || i<options.length-1)) {this.addSpace();}
        });

        return this;
    }
}

class UiButtons extends UiButtonsBase
{
    // options = [{text:'', icon:'', name:'',act:()=>{}}]
    constructor(scene, options=[], config={})
    {
        config.orientation = config.orientation ?? 'x';
        super(scene, config);
        this.set(options)
            .on('button.click', (btn)=>{btn.act?.(btn);})
            .on('button.down', (btn)=>{btn.setAlpha(0.5);btn.down?.(btn)})
            .on('button.up', (btn)=>{btn.setAlpha(1);btn.up?.(btn)})
            .on('button.out', (btn)=>{btn.setAlpha(1);btn.out?.(btn)})
            .layout();
    }
}

class UiTags extends UiButtonsBase
{
    // options = [{text:'', icon:'', name:'',act:()=>{}}]
    constructor(scene, options=[],config={})
    {
        //let config = {
            config.orientation = 'x';
            config.buttonsType = 'radio';
            config.setValueCallback = function (button, value) {
                button?.getElement('text').setTint(value ? 0xffffff : 0x777777);
            };
        //}
        super(scene, config);
        this.set(options)
            .on('button.click', (button)=>{button.act(button);})
            .layout();
            
    }

    init()
    {
        this.emitButtonClick(0);
    }
}

class UiRadios extends UiButtonsBase
{
    // options = [{text:'', icon:'', name:'',act:()=>{}}]
    constructor(scene, options=[],config={})
    {

        config.orientation= 'x',
        config.buttonsType= 'radio',
        config.setValueCallback= function (button, value, previousValue ) {
            button?.getElement('text').setTint(value ? 0xffffff : 0x777777);
        }

        let selected;
        super(scene, config);
        this.set(options)
            .on('button.click', (button,index, buttonArray)=>{
                if(selected == button.name)
                {
                    selected = undefined;
                    this.value = undefined;
                    //this.clearAllButtonsState();
                }
                selected = this.value;
                button.act(this.value);
            })
            .layout();
            
    }

    clear()
    {
        this.clearAllButtonsState();
    }
}


function debug()
{
    //console.log('debug');
    console.log(_scene);
    //_slot.setIcon('smg')
    //_slot.layout().drawBounds(_scene.add.graphics(), 0xff0000);
    //_toast.showMessage('Hello');
    //UiMessage.show('Hello');
    //UiCount.show(1,10,1);
    UiWeaponState.show('weaponPack/shotgun', '12/12');
}

function emit_ignore(on) {_scene.events.emit('ignore', on); Cursor.set(on?'none':undefined);}
function emit_reload() {_scene.events.emit('reload');}
function emit_pause() {_scene.events.emit('pause'); UiCursor.ui(true);}
function emit_resume() {_scene.events.emit('resume'); UiCursor.ui(false);}

class Pic extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, color=COLOR_SLOT,radius=10, alpha=1, space=10}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.addBackground(rect(scene,{color:color,radius:radius, alpha:alpha}),'background')
            .add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'sprite'})           

        scene.add.existing(this);
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
    }
}

class Icon extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, count, color=COLOR_SLOT,radius=10, alpha=1, space=10, fontSize=20}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.fontSize=fontSize;
        this.addBackground(rect(scene,{color:color,radius:radius, alpha:alpha}),'background')
            .set(icon, count);            

        //if(name!=undefined) {this.name = name;}

        
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        scene.add.existing(this);
    }

    set(icon, count)
    {
        this.removeAll(true);
        if(icon)
        {
            this.add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'sprite'})
                .add(text(this.scene,{str:count, fontSize:this.fontSize, color:'#ff0', stroke:'#000', strokeThickness:3}),
                            {key:'count',align:'right-bottom',expand:false,offsetY:5,offsetX:5})
        }
        return this;
    }
}

class Slot extends Icon
{
    constructor(scene, w, h, {icon, count, onclick, radius, space}={})
    {
        super(scene, w, h, {icon:icon, count:count, radius:radius, space:space});
        this.on('over', ()=>{this.getElement('background').fillColor=COLOR_SLOT_DOWN;})
            .on('out', ()=>{this.getElement('background').fillColor=COLOR_SLOT;})
            .on('click', ()=>{if(onclick) {onclick(this);}})
    }
}

class ItemSlot extends Slot
{
    constructor(scene, w, h, {container,i,onclick,radius,space}={})
    {
        if(i!= -1 && i<container.items.length)
        {
            let item = container.items[i];
            let data = ItemDB.get(item.id);
            super(scene, w, h, {icon:data.icon, count:item.count, onclick:onclick, radius:radius, space:space});
            this._container = container;
            this._i = i;
            this._item = item;
            this._data = data;
        }
        else
        {
            super(scene, w, h, {radius:radius, space:space});
            this._container = container;
            this._i = i;
        }

    }

    get count(){return this._item.count;}
    set count(val){return this._item.count=val;}
    get id(){return this._item.id;}
    get icon(){return this._data.icon;}
    get cat(){return this._data.cat;}
    get label(){return this._data.name;}
    get dat(){return this._data;}
    get container(){return this._container;}
    get label(){return this._data.name;}
    get price(){return this._data.price;}

    remove()
    {
        this._container.items.splice(this._i, 1);
    }

    split(cnt)
    {
        let item = {id:this.id, count:cnt};
        this.count -= cnt;
        this._container.items.splice(this._i+1, 0, item);
    }
}

class ShopSlot extends ItemSlot
{
    constructor(scene, w, h, {container,i,onclick}={})
    {
        super(scene, w, h, {container:container,i:i,onclick:onclick,space:0});
        this.setInfo(container,i,w,h);

    }

    set(icon, count){return this;}

    
    setInfo(container,i,w,h)
    {
        if(i!=-1 && i<container.items.length)
        {
            this.removeAll(true);

            let item = this._item;
            let data = this._data;

            let top = this.scene.rexUI.add.sizer({orientation:'x'});
            this.add(top);
            let icon = new Icon(this.scene, h, h, {icon:data.icon, count:item.count,color:COLOR_SLOT_DOWN,radius:{tl:10,bl:10},space:10})
            top.add(icon)

            let info = this.scene.rexUI.add.sizer({orientation:'y',space:5,expand:true});
            let name = label(this.scene,{str:data.name,fontSize:24,width:w-h,color:'#000'});
            let price = text(this.scene,{str:data.price,fontSize:20, color:'#000'});
            info.add(name,{proportion:1,expand:true})
                .add(price,{align:"right"});
            top.add(info,{proportion:1,expand:true});
        }
    }

}

class EquipSlot extends OverlapSizer
{
    constructor(scene, w, h, cat, onclick)
    {
        super(scene, 100, 100, w, h, {orientation:'y', space:10});
        this.addBackground(rect(scene,{color:COLOR_SLOT,radius:10}),'background')
            .set();

        this.setInteractive()
            //.on('pointerover', ()=>{this.getElement('background').fillColor=COLOR_SLOT_DOWN;})
            .on('pointerout', ()=>{this.getElement('background').fillColor=COLOR_SLOT;})
            .on('pointerdown', ()=>{this.getElement('background').fillColor=COLOR_SLOT_DOWN;})
            .on('pointerup', ()=>{this.getElement('background').fillColor=COLOR_SLOT;if(onclick) {onclick(this);}});

        this.name = cat;
        scene.add.existing(this);
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
    }

    get cat(){return this.name;}
    set cat(value){this.name = value;}

    set(icon)
    {
        this.removeAll(true);
        if(icon)
        {
            this.add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'sprite'})
        }
        else
        {
            this.add(text(this.scene,{str:Utility.local(this.cat),color:'#555'}),{key:'text',expand:false});
        }
    }
}

class Scroll extends ScrollablePanel
{
    constructor(scene, {x=0,y=0,col=5,row=5,space=10,sw=80,sh=80,slider=false}={})
    {
        let left = space, right = space, top = space, bottom = space;
        let w = (sw + space) * col - space + right;
        let h = (sh + space) * row - space + top + bottom;

        //console.log('w:',w,'h:',h);

        let createPanel = function(scene){
            return scene.rexUI.add.fixWidthSizer({
                orientation: 'x',
                width: w,
                space: {left:0, right:0, top:0, bottom:0, item:space, line:space}
            })
        }

        let config = {
            x: x,
            y: y,
            width: w,
            height: h,
            scrollMode: 'y',
            background: rect(scene,{color:COLOR_LIGHT,alpha:1}),
            panel: {child: createPanel(scene)},
            space: {left:space, right:0, top:space, bottom:space, panel:0},
        };

        if(slider) 
        {
            config.slider = 
            {
                track: rect(scene, {color:COLOR_PRIMARY, radius:10}),
                thumb: rect(scene, {color:COLOR_DARK, radius:10}),
                //position: 'left'
            };
        }

        super(scene,config);
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);

        this.setChildrenInteractive()
            .on('child.click', (child)=>{child.emit('click',child);})
            .on('child.over', (child)=>{child.emit('over',child);})
            .on('child.out', (child)=>{child.emit('out',child);});

    }   
    
    addSlot(slot)
    {
        this.getElement('panel').add(slot);
        return this;
    }

    clear()
    {
        this.getElement('panel').clear(true);
        return this;
    }
}

class ScrollPage extends Sizer
{
    constructor(scene, {col=3,row=4,sw=80,sh=80,name,gold,buttons,tags,container,classType,onClick}={})
    {
        super(scene, {orientation: 'y'});
        this.scene = scene;
        this._sw=sw;
        this._sh=sh;

        container && (this._container = container);
        classType && (this._classType = classType);
        onClick && (this._onClick = onClick);

        this._bar = this.createBar(scene,{name:name,gold:gold,buttons:buttons,tags:tags});
        this._scroll = new Scroll(scene,{col:col,row:row,sw:sw,sh:sh,slider:false});
        this.add(this._bar,{expand:true});
        this.add(this._scroll);
    }

    set container(value) {this._container=value;}
    set classType(value) {this._classType=value;}
    set onClick(value) {this._onClick=value;}   

    get isFull() {return Utility.isFull(this._container);}

    createBar(scene,{name,gold,buttons,tags}={})
    {
        let bar = scene.rexUI.add.sizer({orientation: 'x'});

        if(buttons)
        {
            bar.add(new UiButtons(scene,buttons));
            bar.addSpace();
        }
        if(tags)
        {
            bar.add(new UiTags(scene,tags),{proportion:5,key:'tags'});
            bar.addSpace();
        }
        if(name)
        {
            bar.add(text(scene,{str:name}));
            bar.addSpace();
        }
        if(gold)
        {
            bar.add(this.createGold(scene),{key:'gold'});
        }
        return bar;
    }

    createGold(scene)
    {
        return scene.rexUI.add.label({
            width: 100,
            //height: 40,
            background: rect(scene, {radius:5,color:COLOR_LIGHT}),
            text: text(scene, {str:Player.role.gold, fontSize:20}),
            align: 'right',
            space:{left:5,right:5},
        })
    }

    rearrange()
    {
        let container = this._container
        container.items = Inventory.rearrange(container.items);
        return this;
    }

    update(cat='all')
    {
        this._bar?.getElement('gold',true)?.setText(Player.role.gold);

        let container = this._container;
        this._scroll.clear(); 
        let n=0;
        container.items.forEach((item,i) => {
            if(cat!='all') 
            {
                let data = ItemDB.get(item.id);
                if(!(data.cat==cat || cat=='other'&&!ItemType.includes(data.cat))){return;}
            }
            n++;
            this.addSlotAt(i);
        });

        if(container.capacity!=-1) 
        {
            for(;n<container.capacity;n++){this.addSlotAt(-1);}
        }

        this.layout();

        return this;
    }

    clear()
    {
        this._scroll.clear();
        return this;
    }

    addItem(item)
    {
        this._container.items.push(item);
        return this;
    }

    // addSlot(slot)
    // {
    //     this._scroll.addSlot(slot);
    //     return this;
    // }

    addSlotAt(i)
    {
        this._scroll.addSlot(new this._classType(this.scene, this._sw, this._sh, 
                        {container:this._container,i:i,onclick:this._onClick}));     
    }

    init()
    {
        if(this._bar?.getElement('tags',true))
        {
            this._bar?.getElement('tags',true)?.init();
        }
    }

}

class ScrollText extends ScrollablePanel
{
    constructor(scene, {x=0,y=0,width=300,height=300,space=10,slider=false}={})
    {
        let createPanel = function(){
            return scene.rexUI.add.sizer({
                orientation: 'y',
                space: {left:0, right:0, top:0, bottom:0, item:space}
            })
        }

        let config = {
            x: x,
            y: y,
            height: height,
            scrollMode: 'y',
            background: rect(scene,{color:COLOR_DARK}),
            panel: {child: createPanel()},
            space: {left:space, right:space, top:space, bottom:space, panel:0},
        };

        super(scene,config);
        
        this.sz = this.getElement('panel')
        this.scene = scene;
        //this.setOrigin(0).layout();

        this.w = width-space*2;
    }

    prop(prop, value)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(this.scene,{color:COLOR_LIGHT}))
            .add(text(this.scene,{str:prop,fontSize:20,padding:{left:5}}),{proportion:1})
            .add(text(this.scene,{str:value,fontSize:20,padding:{right:5}}),{proportion:0});
        this.sz.add(sizer,{expand:true});
        return this;
    }

    skill(prop, value)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(this.scene,{color:COLOR_LIGHT}))
            .add(text(this.scene,{str:prop,fontSize:20,padding:{left:5}}),{proportion:1, align:'top'})
            .add(text(this.scene,{str:value,fontSize:20,fixedWidth:this.w*0.6, wrapWidth:this.w*0.6}),{proportion:0});
        this.sz.add(sizer,{expand:true});
        return this;
    }

    text(str)
    {
        this.sz.add(text(this.scene,{str:str, fixedWidth:this.w, wrapWidth:this.w, fontSize:20}));
        return this;
    }

    clear()
    {
        this.sz.clear(true);
        return this;
    }
}

class Trade extends Sizer
{
    constructor(scene,{text,min,max,limit=Infinity,price,budget=Infinity,act}={})
    {
        let opts={
            plus:{icon:'cursorPack/arrow_n',act:()=>{this.inc(1);},down:()=>{this.hold(1)},up:()=>{this.stop()},out:()=>{this.stop()}},
            minus:{icon:'cursorPack/arrow_s',act:()=>{this.inc(-1);},down:()=>{this.hold(-1)},up:()=>{this.stop()},out:()=>{this.stop()}},
            trade:{text:text,act:()=>{act(this._count);}}
        }
        super(scene, {orientation: 'x', space:{item:0}});
        this//.addBackground(rect(scene,{color:COLOR_DARK,radius:10}))
            .add(this.createButton(scene,opts.plus))
            .add(this.createLabel(scene,40,{alpha:0,radius:5,strokeColor:COLOR_YELLOW,strokeWidth:1}),{key:'count'})
            .add(this.createButton(scene,opts.minus))
            .add(this.createLabel(scene,80,{align:'right',color:COLOR_LIGHT,radius:5}),{key:'price'})
            .addSpace()
            .add(this.createButton(scene,opts.trade))

            //console.log(text,min,max,price);
            this._min = min;
            this._max = max;
            this._price = price;
            this._count = min;
            this._limit = limit;
            this._budget = budget;

            this.setCount(min);

        this.layout();
    }

    setCount(count)
    {
        this.getElement('count',true).setText(count);
        this.getElement('count',true).getElement('text').setTint(count>this._limit?COLOR_RED:COLOR_WHITE);
        let cost = count*this._price;
        this.getElement('price',true).setText(cost);
        this.getElement('price',true).getElement('text').setTint(cost>this._budget?COLOR_RED:COLOR_WHITE);
        this.rexContainer?.parent.layout();
    }

    hold(d)
    {
        this._timer = this.scene.time.addEvent({
            delay: 500,
            callback: ()=>{
                this._timer = this.scene.time.addEvent({
                    delay: 100,
                    callback: ()=>{d*=1.1;this.inc(Math.floor(d));},
                    loop: true
                });
            },
        });
    }

    stop() {this._timer&&this._timer.remove();}

    inc(d)
    {
        this._count = Utility.clamp(this._count+d,this._min,this._max);
        this.setCount(this._count);
    }

    // createSlider(scene,w,min=1,max=50,price=1000)
    // {
    //     let range = max - min;
    //     let slider = scene.rexUI.add.slider({
    //         orientation: 'x',
    //         width: w,
    //         //value: 0,
    //         track: rect(scene,{color:COLOR_DARK, radius:10}),
    //         thumb: rect(scene,{color:COLOR_LIGHT, radius:15}),
    //         input: 'drag',
    //         //gap: 0,
    //         valuechangeCallback:  (value) =>{
    //             let count = Math.round(value*range)+min;
    //             this.getElement('count',true)?.setText(count);
    //             this.getElement('price',true)?.setText(count*price);
    //             this.layout();
    //         }
    //     })

    //     slider.gap = 1/(max - min);

    //     return slider;
    // }

    createLabel(scene,w,config)
    {
        return scene.rexUI.add.label({
            width: w,
            //height: 40,
            background: rect(scene, config),
            text: text(scene, {str:'0', fontSize:20}),
            align: config.align ?? 'center',
            space:{left:5,right:5},
        })
    }

    createButton(scene,option)
    {
        return new UiButtons(scene,[option]);
    }
}

class UiTemplate extends OverlapSizer
{
    constructor(scene, w, h)
    {
        super(scene, 0, 0, w, h);
        this.scene = scene;
        this.x = _w/2;
        this.y = _h/2;
        this.width = w;
        this.height = h;
        this.addBackground(this.bg(scene))
            .add(this.btnClose(scene),{align:'right-top',expand: false, offsetY:-30})

        //scene.add.existing(this.getLayer());
    }

    bg(scene)
    {
        return rect(scene,{radius:10});
    }

    btnClose(scene)
    {
        return scene.rexUI.add.buttons({buttons:[sprite(scene,{icon:ICON_CLOSE}).setDisplaySize(30,30)]})
                .on('button.click', ()=>{this.hide();})
                .on('button.down', (button)=>{button.setAlpha(0.5);})
                .on('button.up', (button)=>{button.setAlpha(1);})
                .on('button.out', (button)=>{button.setAlpha(1);});
    }

    // createLabel_1(scene, w)
    // {
    //     return text(scene, {fontSize:24, other:{backgroundColor:S_COLOR_DARK, align:'center', fixedWidth:w, padding:{x:5,y:5}}});
    // }

    createLabel(scene)
    {
        return scene.rexUI.add.label({
            background: rect(scene,{color:COLOR_DARK}),
            text: text(scene),
            align: 'center',
            space: 10
        });
    }

    createIcon(scene,w,h)
    {
        return new Icon(scene, w, h,{icon:'iconPack/iconPack_123',radius:0});
    }

    // createDescript_old(scene,h)
    // {
    //     return textArea(scene, {height:h, slider:false});
    // }

    createDescript(scene, w, h)
    {
        return new ScrollText(scene,{width:w,height:h,space:5,fontSize:20,slider:true});
    }

    // createButtons(scene)
    // {
    //     return new UiButtons(scene);
    // }

    setLabel(text)
    {
        this.getElement('label',true).setText(text);
        return this;
    }

    setIcon(icon, count)
    {
        this.getElement('icon',true).set(icon, count);
        return this;
    }

    setDescript(data)
    {
        let scroll = this.getElement('descript',true);
        let keys = ['damage','rof','magazine','range',
                    'life','heal','shield'];

        scroll.clear();
        keys.forEach((key,i)=>{
            if(data.prop[key]) 
            {
                let value = data.prop[key];
                if(key=='rof') {value=`${data.prop[key]}/s`}
                scroll.prop(Utility.local(key),value);
            }
        });
        //scroll.skill('技能','123456778901223455');
        scroll.text();
        scroll.text(data.descript);
        scroll.layout();
        return this;
    }

    // setButtons(options)
    // {
    //     let buttons = this.getElement('sizer',true).getElement('buttons',true);
    //     buttons.set(options);
    //     return this;
    // }

    addButtons(options)
    {
        let top = this.getElement('top',true);
        top.add(new UiButtons(this.scene,options),{key:'buttons',padding:{top:10,bottom:0},expand:true});
        return this;
    }

    addTrade(config)
    {
        let top = this.getElement('top',true);
        top.add(new Trade(this.scene,config),{key:'buttons',padding:{top:10,bottom:0},expand:true});
        return this;
    }

    init(scene, {w=300, hIcon=150, hDescript=150}={})
    {
        let top = scene.rexUI.add.sizer(0,0,0,0,{orientation:'y',space:10});
        this.add(top,{key:'top'})
        top.add(this.createLabel(scene),{key:'label', expand:true})
            .add(this.createIcon(scene,w,hIcon),{key:'icon'})
            .add(this.createDescript(scene,w,hDescript),{key:'descript'})
            //.add(this.createButtons(scene),{key:'buttons', padding:{top:10,bottom:10}, expand:true})

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);        
        this.hide();
    }

    reset()
    {
        let top = this.getElement('top',true);
        let btn = this.getElement('buttons',true);
        if(btn) {top.remove(btn,true);}

        return this;
    }

}

class UiEquipInfo extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {
        super(scene, 0, 0);
        
        let w=250,hIcon=100,hDescript=150;
        this.init(scene, {w:w, hIcon:hIcon, hDescript:hDescript});
        let options = [
                    {text:'卸下',name:'unequip',act:()=>{this.unequip(this.cat);}},
                    {text:'丟棄',name:'drop',act:()=>{this.drop(this.cat);}},
                    {text:'其他',name:'other',act:()=>{this.other(this.cat);}},
                ];
        //this.setButtons(options);
        this.addButtons(options);
        
        UiEquipInfo.instance = this;
        this.getLayer().name = 'UiEquipInfo';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());

    }

    unequip(cat)
    {
        Player.unequip(cat);
        this.hide();
        UiProfile.refresh();
    }

    other(cat)
    {
        this.hide();
        UiEquipList.show(cat);
    }

    drop(cat)
    {
        Player.drop_equip(cat);
        this.hide();
        UiProfile.refresh();
    }

    show(cat, id)
    {
        super.show();
        this.cat = cat;
        let data = ItemDB.get(id);
        this.setLabel(data.name)
            .setIcon(data.icon)
            .setDescript(data)
            .layout()//.drawBounds(this.scene.add.graphics(),0xff0000)
            .modal({cover: {color: 0x0,alpha: 0.5,}});
    }

    static show(cat, id)
    {
        if(UiEquipInfo.instance) {UiEquipInfo.instance.show(cat, id);}
    }
}

class UiItemInfo extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {  
        super(scene, 0, 0);

        let w=250,hIcon=100,hDescript=150;
        this.init(scene, {w:w, hIcon:hIcon, hDescript:hDescript});
        
        UiItemInfo.instance = this;
        this.getLayer().name = 'UiItemInfo';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
    }

    getOption(list)
    {
        let opts = [];
        list.forEach((opt)=>{
            switch(opt)
            {
                case 'use': opts.push({text:'使用',name:'use',act:()=>{this.use();}}); break;
                case 'drop': opts.push({text:'丟棄',name:'drop',act:()=>{this.drop();}}); break;
                case 'take': opts.push({text:'拿取',name:'take',act:()=>{this.take();}}); break;
                case 'put': opts.push({text:'放入',name:'put',act:()=>{this.put();}}); break;
                case 'split': opts.push({text:'拆分',name:'split',act:()=>{this.split();}}); break;
                case 'buy': opts.push({text:'購買',name:'but',act:()=>{this.buy();}}); break;
                case 'sell': opts.push({text:'出售',name:'sell',act:()=>{this.sell();}}); break;
                case '': break;
            }
        });
        return opts;
    }

    getTrade(type,slot)
    {
        let opt;
        switch(type)
        {
            case 'buy': 
                let limit = Player.role.checkSpace(slot.id);
                let budget = Player.role.gold;
                //console.log('limit:',limit,'budget:',budget);
                opt={text:'購買', min:1, max:slot.count, limit:limit, budget:budget, price:slot.price, act:(count)=>{this.buy(count);}}; break;
            case 'sell': opt={text:'出售', min:1, max:slot.count, price:slot.price, act:(count)=>{this.sell(count);}}; break;
        }   
        return opt;
    }

    show(slot, parent, {buttons,trade}={})
    {
        super.show();
        this._parent = parent;
        this._slot = slot;
        this.reset()
            .setLabel(slot.label)
            .setIcon(slot.icon, slot.count)
            .setDescript(slot.dat)

        if(buttons){this.addButtons(this.getOption(buttons));}
        if(slot.price&&trade){this.addTrade(this.getTrade(trade,slot));}

        this.layout()//.drawBounds(this.scene.add.graphics(),0xff0000)
            .modal({cover: {color: 0x0,alpha: 0.5,}})
    }

    buy(count)
    {
        if(Player.buy(this._slot, count))
        {
            this.hide();
            this._parent.refresh();
        }
    }

    sell(count)
    {
        //console.log('sell',this._slot,count);
        Player.sell(this._slot, count);
        this.hide();
        this._parent.refresh();
    }

    use()
    {
        Player.use(this._slot);
        this.hide();
        this._parent.refresh();
    }

    take()
    {
        this._parent.take(this._slot);
        this.hide();
        this._parent.refresh();
    }

    put()
    {
        this._parent.put(this._slot);
        this.hide();
        this._parent.refresh();
    }

    async drop()
    {
        let cnt = 1;

        if(this._slot.count > 1)
        {
            cnt = await UiCount.show(1,this._slot.count,1);
        }

        if(cnt > 0)
        {
            Player.drop(this._slot, cnt);
            this.hide();
            this._parent.refresh();
        }
    }

    async split()
    {
        if(Utility.isFull(this._slot.container)) 
        {
            UiMessage.show('背包已滿!!!');
            return;
        }

        let cnt = 1;

        if(this._slot.count > 2)
        {
            cnt = await UiCount.show(1,this._slot.count-1,1);
        }

        if(cnt > 0)
        {
            this._slot.split(cnt);
            this.hide();
            this._parent.refresh();
        }
    }

    static show(slot, parent, config)
    {
        if(UiItemInfo.instance) {UiItemInfo.instance.show(slot, parent, config);}
    }
}

class UiTest extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {  
        super(scene);
        UiTest.instance = this;
        this.add(new Scroll(scene,{col:1}),{key:'scroll'})

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.hide();

        this.getLayer().name = 'UiTest';    // 產生layer，並設定layer名稱

    }

    show()
    {
        super.show();
        this.getElement('scroll').addSlot(rect(this.scene,{color:COLOR_DARK,w:80,h:80})).layout();
    }

    static show()
    {
        if(UiTest.instance) {UiTest.instance.show();}
    }
}

export class UiMain extends Sizer//OverlapSizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiMain.instance = this;

        this.addBackground(rect(scene,{alpha:0.5}))
            //.add(this.createBar(scene),{align:'left-top',expand:{width:true}})
            .add(this.createBar(scene))
            //.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
            .onResize()
            .hide();
        
        
        //scene.scale.on('resize', this.onResize, this);
        this.getLayer().name = 'UiMain';    // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
        this.setInteractive();
        this.on('pointerover',()=>{this.mark(false);})
            .on('pointerout',()=>{this.mark(true);})
    }

    // pause(){if(!_shown){this.scene.events.emit('pause'); Cursor.ui(true);}}
    // resume(){if(!_shown){this.scene.events.emit('resume'); Cursor.ui(false);}}

    mark(on) {this.scene.events.emit('mark',on);}

    onResize()
    {
        let viewport = this.scene.rexUI.viewport;
        this.setPosition(0, 0)
            .setOrigin(0,0)
            .setMinWidth(viewport.width)
            //.setMinSize(viewport.width, viewport.height)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        return this;
    }

    onResize_old()
    {
        let viewport = this.scene.rexUI.viewport;
        this.setPosition(viewport.centerX, viewport.centerY)
            .setMinSize(viewport.width, viewport.height)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        return this;
    }

    onClick(button, index, pointer, event)
    {   
        switch(button.name)
        {
            case 'home': this.home(); break;
            case 'bag': UiBag.show();break;//UiBag.show('test'); break;
            case 'profile': UiProfile.show(); break;
            case 'zoom': this.zoom(button); break;
            case 'test': UiQuest.show(); break;
        }
    }

    home()
    {
        this.hide();
        this.scene.events.emit('home');
    }

    zoom(button)
    {
        if(this.scene.scale.isFullscreen)
        {
            let [atlas, frame] = ICON_FULL.split('/');
            button.setFrame(frame);
            this.scene.scale.stopFullscreen();
        }
        else
        {
            let [atlas, frame] = ICON_NONFULL.split('/');
            button.setFrame(frame);
            this.scene.scale.startFullscreen();
        }
    }

    createBar(scene)
    {
        let bar = this.scene.rexUI.add.sizer(0,0,0,0,{orientation: 'x'})
                    //.addBackground(rect(scene, {color:COLOR_WHITE, radius:0, alpha:0.25}))
                    .add(this.scene.rexUI.add.buttons({
                        buttons:[
                                sprite(scene, {icon:ICON_HOME, name:'home'}),
                                sprite(scene, {icon:ICON_PROFILE, name:'profile'}),
                                sprite(scene, {icon:ICON_BAG, name:'bag'}),
                                sprite(scene, {icon:ICON_QUEST, name:'test'}),
                                this.scene.rexUI.add.space(),
                                sprite(scene, {icon:ICON_FULL, name:'zoom'})
                                ],
                        }),{proportion: 1,key:'buttons'})
                    .layout()

        this._buttons = bar.getElement('buttons')

        //bar.getElement('buttons')
        this._buttons
            .on('button.down', (button)=>{button.setAlpha(0.5);})
            .on('button.up', (button)=>{button.setAlpha(1);this.onClick(button);})
            // .on('button.over', (button)=>{button.setAlpha(0.5); emit_ignore(true); this.mark(false);})//Cursor.set('none')})
            // .on('button.out', (button)=>{button.setAlpha(1); emit_ignore(false); this.mark(true);});// Cursor.set();});
            .on('button.over', (button)=>{button.setAlpha(0.5); this.mark(false);})//Cursor.set('none')})
            .on('button.out', (button)=>{button.setAlpha(1); this.mark(true);});// Cursor.set();});

        return bar;

    }


    static show()
    {
        if(UiMain.instance) {UiMain.instance.show();}
    }

    static hide()
    {
        if(UiMain.instance) {UiMain.instance.hide();}
    }
}

class UiBag extends UiTemplate
{
    static instance = null;

    constructor(scene)
    {
        super(scene);
        this.sw = 80; this.sh = 80;

        UiBag.instance = this;
        this.add(this.createPage(scene),{key:'page',padding:10});

        this.hide();
        this.getLayer().name = 'UiBag'; // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
    }

    createPage(scene)
    {
        let config_buttons = [
            {icon:ICON_REARRANGE,act:()=>{this.rearrange();}}
        ];

        let act_tag = (btn)=>{this.filter(btn.name);};

        let config_tags = [
            {text:'全部',name:'all',act:act_tag},
            {text:'武器',name:'weapon',act:act_tag},
            {text:'頭盔',name:'helmet',act:act_tag},
            {text:'胸甲',name:'chestplate',act:act_tag},
            {text:'道具',name:'useable',act:act_tag},
            {text:'其他',name:'other',act:act_tag},
        ];

        this._page = new ScrollPage(scene,{col:6,row:4,sw:this.sw,sh:this.sh,
                        //name: '背包',
                        gold: true,
                        buttons: config_buttons, 
                        tags: config_tags,
                        classType: ItemSlot,
                        container: Player.role.bag,
                        onClick: (slot)=>{
                            let options = [];
                            switch(slot.cat)
                            {
                                case 'weapon':case 'helmet':case 'chestplate':case 'useable': 
                                    options = ['use',slot.count>1?'split':'','drop']; break;
                                default: 
                                    options = [slot.count>1?'split':'','drop']; break;
                            }
                            UiItemInfo.show(slot,this,{buttons:options});
                        }
                    });

        return this._page;
    }

    rearrange()
    {
        this._page.rearrange().init();
    }
    
    filter(cat)
    {
        this._cat = cat;
        this._page.update(cat);
        this.layout();
    }

    show()
    {
        super.show();
        this._page.init();
        emit_pause();
        _shown = true;
        this.modal({cover: {color: 0x0,alpha: 0.5,}})
    }

    hide()
    {
        super.hide();
        emit_resume();
        _shown = false;
    }

    refresh()
    {
        if(this.visible){this.filter(this._cat);}
    }

    static show()
    {
        if(UiBag.instance) {UiBag.instance.show();}
    }

    static hide()
    {
        if(UiBag.instance) {UiBag.instance.hide();}
    }

    static refresh()
    {
        if(UiBag.instance) {UiBag.instance.refresh();}
    }
}

class UiEquipList extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        this.cw=80;
        this.ch=80;
        UiEquipList.instance = this;
        let top = scene.rexUI.add.sizer({orientation:'y',space:10});
        this.add(top,{key:'top'})
        this.slots = new Scroll(scene,{col:1,row:4,cw:this.cw,ch:this.ch,slider:false});
        top.add(text(scene,{str:'裝備'}),{key:'label'});
        top.add(this.slots)

        this.hide();
        this.getLayer().name = 'UiEquip'; // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
    }

    refresh()
    {
        this.hide();
        UiProfile.refresh();
    }

    show(cat)
    {
        //let onClick = (slot)=>{UiItemEquip.show(slot);};
        let onClick = (slot)=>{UiItemInfo.show(slot, this, {buttons:['use']});};

        super.show();
        this.getElement('label',true).setText(Utility.local(cat));
        this.slots.clear();
        let container = Player.role.bag;
        container.items.forEach((item,i) => {
            if(ItemDB.get(item.id).cat===cat)
            {
                this.slots.addSlot(new ItemSlot(this.scene, this.cw, this.ch, 
                                    {container:container,i:i,onclick:onClick}));
            }
        });
        this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)
            .modal({cover: {color: 0x0,alpha: 0.5,}});
    }

    static hide()
    {   
        if(UiEquipList.instance) {UiEquipList.instance.hide();}
    }

    static show(cat)
    {
        if(UiEquipList.instance) {UiEquipList.instance.show(cat);}
    }
}



class UiProfile extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        let w=500, h=400;
        UiProfile.instance = this;
        this.add(this.createTagPage(scene, w, h),{key:'tagPage'})
          
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.getLayer().name = 'UiProfile';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
        this.hide();
    }

    createTagPage(scene,w,h)
    {
        let pages = this.scene.rexUI.add.tabPages({
            width: w, height: h,
            background: rect(scene,{alpha:0}),
            tabs: {space: { item: 20 }},
            pages: {fadeIn: 300},
            align: {tabs: 'left'},
            space: {left: 10, right: 10, top: 10, bottom: 10, item: 5}
        })
        .on('tab.focus', (tab, key)=>{tab.tint = 0xff0000;
            if(key == 'equip'){this.updateEquip();}
        })
        .on('tab.blur', (tab, key)=>{tab.tint = 0xffffff;})

        pages.addPage({
                key: 'equip',
                tab: text(scene,{str:'裝備'}),
                page: new EquipPage(scene)
            })
            .addPage({
                key: 'page1',
                tab: text(scene,{str:'技能'}),
                page: this.createPage(scene)
            })
            .addPage({
                key: 'page2',
                tab: text(scene,{str:'Page2'}),
                page: this.createPage(scene)
            })
            .layout()


        return pages;
    }

    createPage(scene)
    {
        return textArea(scene);
    }

    updateEquip()
    {
        let pages = this.getElement('tagPage');
        let equipPage = pages.getPage('equip');
        equipPage.update();
        this.layout();
    }

    show()
    {
        super.show();
        this.getElement('tagPage').swapFirstPage();
        this.updateEquip();
        this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        this.modal({cover: {color: 0x0,alpha: 0.5,}})

        //this.scene.events.emit('pause');
        emit_pause();
        _shown = true;
    }

    hide()
    {
        super.hide();
        //this.scene.events.emit('resume');
        emit_resume();
        _shown = false;
    }

    refresh()
    {
        this.updateEquip();
    }

    static refresh()
    {
        if(UiProfile.instance) {UiProfile.instance.refresh();}
    }
    
    static show()
    {
        if(UiProfile.instance) {UiProfile.instance.show();}
    }

}

export class UiStorage extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {
        super(scene,);
        UiStorage.instance = this;

        this.sw = 80;
        this.sh = 80;
        let top = this.createTop(scene);
        this.add(top);
        top.add(this.createBag(scene));
        top.add(this.createStorage(scene));

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.getLayer().name = 'UiStorage';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
        this.hide();
    } 

    createTop(scene)
    {
        return scene.rexUI.add.sizer({orientation:'x',
            space:{left:10,right:10,top:10,bottom:10,item:50}});
    }

    createBag(scene)
    {
        let config = {
            col:3,row:4,sw:this.sw,sh:this.sh,name:'背包',
            buttons: [{icon:ICON_REARRANGE,act:()=>{this._bag.rearrange().update();}}],
            classType: ItemSlot,
            onClick: (slot)=>{UiItemInfo.show(slot,this,
                                {buttons:['put',slot.count>1?'split':'','drop']});}
        }
        this._bag = new ScrollPage(scene,config);
        return this._bag;
    }

    createStorage(scene)
    {
        let config = {
            col:3,row:4,sw:this.sw,sh:this.sh,name:'倉庫',
            buttons: [{icon:ICON_REARRANGE,act:()=>{this._storage.rearrange().update();}}],
            classType: ItemSlot,
            onClick: (slot)=>{UiItemInfo.show(slot,this,
                                {buttons:['take',slot.count>1?'split':'','drop']});}
        }
        this._storage = new ScrollPage(scene,config);
        return this._storage;
    }


    put(slot)
    {
        if(!this._storage.isFull)
        {
            slot.remove();
            this._storage.addItem({id:slot.id,count:slot.count});
            this.refresh();
        }
        else
        {
            UiMessage.show('空間已滿!!!');
        }
    }

    take(slot)
    {
        if(!this._bag.isFull)
        {
            slot.remove();
            this._bag.addItem({id:slot.id,count:slot.count});
            this.refresh();
        }
        else
        {
            UiMessage.show('背包已滿!!!');
        }
    }

    refresh()
    {
        this._bag.update();
        this._storage.update();
        this.layout();
    }

    hide()
    {
        super.hide();
        emit_resume();
        _shown = false;
    }

    show(data)
    {
        super.show();
        this._bag.container = Player.role.bag;
        this._storage.container = data;
        this.refresh();
        emit_pause();
        _shown = true;
    }

    static show(data)
    {
        if(UiStorage.instance) {UiStorage.instance.show(data);}
    }
}

export class UiTrade extends UiTemplate
{
    static instance = null;
    constructor(scene)
    {
        super(scene,);
        UiTrade.instance = this;

        let top = this.createTop(scene);
        this.add(top);

        top.add(this.createBag(scene));
        top.add(this.createShop(scene));

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.getLayer().name = 'UiShop';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
        this.hide();
    } 

    createTop(scene)
    {
        return scene.rexUI.add.sizer({orientation:'x',
            space:{left:10,right:10,top:10,bottom:10,item:50}});
    }

    createBag(scene)
    {
        let sw = 80, sh = 80;
        let config = {
            col:3,row:4,sw:sw,sh:sh,
            name:'背包',
            gold: true,
            buttons: [{icon:ICON_REARRANGE,act:()=>{this._bag.rearrange().update();}}],
            classType: ItemSlot,
            onClick: (slot)=>{UiItemInfo.show(slot,this,{trade:'sell'});}
        }
        this._bag = new ScrollPage(scene,config);
        return this._bag;
    }

    createShop(scene)
    {
        let sw = 250, sh = 80;
        let config = {
            col:1,row:4,sw:sw,sh:sh,
            name:'商店',
            classType: ShopSlot,
            onClick: (slot)=>{UiItemInfo.show(slot,this,{trade:'buy'});}
        }
        this._shop = new ScrollPage(scene,config);
        return this._shop;
    }

    refresh()
    {
        this._bag.update();
        this._shop.update();
        this.layout();
    }

    hide()
    {
        super.hide();
        emit_resume();
        _shown = false;
    }

    show(data)
    {
        super.show();
        this._bag.container = Player.role.bag;
        this._shop.container = data;
        this.refresh();
        this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        emit_pause();
        _shown = true;
    }

    static show(data)
    {
        if(UiTrade.instance) {UiTrade.instance.show(data);}
    }
}

class EquipPage extends Sizer
{
    constructor(scene)
    {
        super(scene, {orientation: 'x'});
        let left = this.createLeft(scene);
        let right = new ScrollText(scene);

        this.add(left, {proportion: 0, expand: true, key:'equip'})
            .add(right, {proportion: 1, expand: true, key:'descript'})

        this.layout();
    }

    createLeft(scene)
    {
        const space = 10, size = 80, item = 50;
        let w = space*2 + size*2 + item;
        let left = scene.rexUI.add.fixWidthSizer({width:w,orientation: 'x',
                                                    space:{left:space,right:space,top:space,bottom:space,item:item,line:30}})
                                    .addBackground(rect(scene, {color:COLOR_LIGHT})/*.setStrokeStyle(2, 0xff0000)*/);     
        
        let slots = ['helmet','chestplate','weapon','other'];
        slots.forEach((type,i)=>{left.add(new EquipSlot(scene, size, size, type, this.onClick));})
        return left;
    }

    onClick(slot)
    {
        let id = Player.role.equips[slot.cat];

        if(id){UiEquipInfo.show(slot.cat, id);}
        else{UiEquipList.show(slot.cat);}
    }

    update()
    {
        let equips = Player.role.equips;
        let descript = this.getElement('descript');

        descript.clear();

        let fields = ['state:life','prop:damage','prop:shield'];
        fields.forEach((field,i)=>{
            let [cat,key] = field.split(':');
            let value = Player.role[cat][key];
            if(value) 
            {
                switch(key)
                {
                    case 'life': 
                        descript.prop(Utility.local(key),`${value.val}/${value.max}`); break;
                    default:
                        descript.prop(Utility.local(key),value); break;
                }
            }
        });

        let slots = this.getElement('equip').getElement('items');
        slots.forEach((slot,i)=>{
            let id = equips[slot.cat];
            if(id)
            {
                let item = ItemDB.get(id);
                slot.set(item.icon);
                //descript.prop(Utility.local(slot.cat),item.name);
            }
            else
            {
                slot.set();
            }
        })

        //descript.text('塌塌塌塌塌塌塌塌塌塌塌塌塌塌塌塌塌塌塌')

    }   
}


class UiCount extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        let config = {
            x: _w/2,
            y: _h/2,
            width: 200,
            height: 50,
            orientation: 'y',
            space: {left:10, right:10, top:10, bottom:10, item:10},
        }
        super(scene, config);
        UiCount.instance = this;

        this.addBackground(rect(scene,{radius:10}))
            .add(this.label(scene),{key:'label'})
            .add(this.createButtons(scene),{key:'button', expand:true})
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);

        this.range = 0;
        this.min = 0;
        this.count = 0;
        this.reject;
        this.resolve;

        this.hide();
        this.getLayer().name = 'UiCount';    // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());
    }

    label(scene)
    {
        return scene.rexUI.add.sizer({orientation: 'x'})
            .add(this.slider(scene),{key:'slider', padding:0})
            .add(scene.rexUI.add.label({
                width: 40,
                height: 30,
                background: rect(scene, {color:COLOR_LIGHT, radius:5}),
                text: text(scene, {str:'0', fontSize:20}),
                align: 'center',
                //space: 10,
            }),{key:'text',padding:{left:5}})
    }

    slider(scene)
    {
        let slider = scene.rexUI.add.slider({
            orientation: 'x',
            width: 150,
            //value: 0,
            track: rect(scene,{color:COLOR_DARK, radius:10}),
            thumb: rect(scene,{color:COLOR_LIGHT, radius:15}),
            input: 'drag',
            //gap: 0,
            valuechangeCallback:  (value) =>{
                this.count = Math.round((value * this.range) + this.min);
                this?.getElement('text',true)?.setText(this.count).layout();
            }
        })
        //.setDepth(1);

        return slider;
    }

    createButtons(scene)
    {
        let act = scene.rexUI.add.buttons({buttons:[
            text(scene,{str:'取消',fontSize:20}),
            scene.rexUI.add.space(),
            text(scene,{str:'確定',fontSize:20}),
            ],
            space:{item:0}
        })

        act.on('button.click', (button, index, pointer, event)=>{
            if(index==0) {this.hide();this.resolve(0);}
            else if(index==1) {this.hide();this.resolve(this.count);}
        })
        .on('button.down', function (button) {button.setAlpha(0.5);})
        .on('button.up', function (button) {button.setAlpha(1);})
        .on('button.out', function (button) {button.setAlpha(1);});

        return act;
    }

    show(min,max,step)
    {
        super.show();
        let slider = this.getElement('slider',true);
        this.min = min;
        this.range = max - min;
        slider.gap = step / (max - min);
        slider.value = 0;
        slider.value = 1;

        //this.root.show()
        this.modal({cover: {color: 0x0,alpha: 0.5,}})

        return new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        })

    }

    static show(min,max,step)
    {
        if(UiCount.instance) {return UiCount.instance.show(min,max,step);}
    }
}

export class UiWeaponState extends Icon
{
    static instance = null;
    constructor(scene)
    {   
        
        let config = {
            x: _w/2,
            y: 0,
            space: 5,
            fontSize: 16,
        }
        super(scene, 100, 50, config);
        UiWeaponState.instance = this;
        this.setOrigin(0.5,0)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        this.hide();
        this.setInteractive()
            .on('pointerdown', ()=>{this.setAlpha(0.5);})
            .on('pointerup', ()=>{this.setAlpha(1); emit_reload();})
            .on('pointerover', ()=>{this.setAlpha(1); emit_ignore(true);})
            .on('pointerout', ()=>{this.setAlpha(1); emit_ignore(false);})

        this.getLayer().name="UiWeaponState";

    }

    setAlpha(alpha)
    {
        this.getElement('background',true).setAlpha(alpha);
        return this;
    }

    setCount(count)
    {
        this.getElement('count',true).setText(count);
        this.layout();
        return this;
    }
    
    show(icon, count)
    {
        super.show();
        this.set(icon, count).layout();
    }

    static ammo(count)
    {
        if(UiWeaponState.instance) 
        {
            UiWeaponState.instance.setCount(count);
        }
    }

    static show(icon, count)
    {
        if(UiWeaponState.instance) {UiWeaponState.instance.show(icon,count);}
    }

    static hide()
    {
        if(UiWeaponState.instance) {UiWeaponState.instance.hide();}
    }
}

export class UiMessage extends Toast
{
    static instance = null;
    constructor(scene)
    {
        let config = {
            x: _w/2,
            y: _h,
    
            background: rect(scene, {radius:10, alpha:0.5}),
            text: text(scene),
            space: 10,
    
            duration: {
                in: 250,
                hold: 1000,
                out: 250,
            },
        }
        super(scene, config);
        this.setOrigin(0.5, 1);

        UiMessage.instance = this;
        this.getLayer().name = 'UiMessage';    // 產生layer，並設定layer名稱
        //scene.add.existing(this.getLayer());
        //scene.uiLayer.add(this.getLayer());
    }

    show(text)
    {
        this.showMessage(text);//.bringToTop();
    }

    static show(text)
    {
        if(UiMessage.instance) {UiMessage.instance.show(text);}
    }
}


export class UiCursor extends Phaser.GameObjects.Sprite
{
    static icons = {
        none :  {sprite:'cursors/cursor_none', origin:{x:0.25,y:0}, scale:1},
        aim :   {sprite:'cursors/target_b', origin:{x:0.5,y:0.5}, scale:0.7},
        melee :  {sprite:'cursors/tool_sword_b', origin:{x:0.5,y:0.5}, scale:0.7},
        take :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
        talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
    }

    static instance = null;

    constructor(scene)
    {
        super(scene);
        UiCursor.instance = this;
        this.scene = scene;
        scene.add.existing(this);
        this.setDepth(1000);
        this.setIcon('none');
    }

    preUpdate(time, delta)
    {
        this.setPosition(this.scene.input.x, this.scene.input.y);
    }

    setIcon(type)
    {
        console.log(type)
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


    ui(on) {}

    static pos(x,y)
    {
        if(UiCursor.instance) {UiCursor.instance.setPos(x,y);}
    }

    static set(type)
    {
        if(UiCursor.instance) {UiCursor.instance.setIcon(type);}
    }

    static ui(on)
    {
        if(UiCursor.instance) {UiCursor.instance.ui(on);}
    }

}



export class Cursor_old extends Phaser.GameObjects.GameObject
{
    static instance = null;
    static type = {
        none :  {frame:'cursor_none', anchor:{x:0.25,y:0}, scale:0.7},
        aim :   {frame:'target_b', anchor:{x:0.5,y:0.5}, scale:0.7},
        melee :  {frame:'tool_sword_b', anchor:{x:0.5,y:0.5}, scale:0.7},
        grap :  {frame:'hand_open', anchor:{x:0.5,y:0.5}, scale:0.7},
        talk :  {frame:'message_dots_square', anchor:{x:0.5,y:0.5}, scale:0.7},
        
    }

    constructor(scene)
    {
        super(scene);
        Cursor.instance = this;
        this.scene = scene;
        this.set('none');
        this.scene.input.setDefaultCursor('none');
        this.addToUpdateList();
        this._pre = Cursor.type.none;
        this._cur = Cursor.type.none;
        this._ui = false;
    } 

    set(type)
    {
        if(!this._cursor)
        {
            this._cursor = this.scene.add.sprite(0,0).setDepth(1000);
            this.scene.add.existing(this._cursor);
        }

        if(type)
        {
            this._pre = this._cur;
            this._cur = Cursor.type[type];
        }
        else
        {
            this._cur = this._pre;
        }

        
        this.update();
        
    }

    update()
    {
        //console.log('ui:',this._ui,'cur:',this._cur?.frame,'pre:',this._pre?.frame);

        let cur = this._ui ? Cursor.type.none : this._cur;
        this._cursor.setTexture('cursors',cur.frame)
                    .setOrigin(cur.anchor.x,cur.anchor.y)
                    .setScale(cur.scale);
    }

    ui(on) {this._ui = on; this.update();}

    // preUpdate(time, delta)
    // {
    //     this._cursor.setPosition(this.scene.input.x, this.scene.input.y);
    // }

    setPos(x,y) 
    {
        this._cursor.setPosition(x, y);
    }

    static pos(x,y)
    {
        if(Cursor.instance) {Cursor.instance.setPos(x,y);}
    }

    static set(type)
    {
        if(Cursor.instance) {Cursor.instance.set(type);}
    }

    static ui(on)
    {
        if(Cursor.instance) {Cursor.instance.ui(on);}
    }


}

class UiDialog extends Sizer
{
    constructor(scene, w=350, h=100)
    {
        super(scene, 0, 0, w, h,{orientation:'x',space:10});
        this.scene = scene;
        this.x = _w/2;
        this.y = _h/2;
        this.width = w;
        this.height = h;
        this.addBackground(this.bg(scene))
            .add(this.createFigure(scene),{expand:true})
            .add(this.createText(scene),{proportion:1,expand:true})
            .add(this.createButton(scene),{expand:true})
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);

        
        this.getLayer().name = 'UiDialog';  // 產生layer，並設定layer名稱
        //scene.uiLayer.add(this.getLayer());

        this.UnitTest();
        
    }

    UnitTest()
    {
        let content =
        {
            icon:ICON_INFO,
            name:'Tony',
            default:
                {
                    text:'網摘精選 · 費德勒的三堂網球人生課： 冠軍，是一再經歷失敗，學會更努力前進 · 揭密國宴顧問團蔡珠兒：國家光榮感，是最強勁的推動力 · 520國宴菜單的誕生：用美食讓世界看見台灣.',
                    options:[   {text:'選項1',act:'go test1'},
                                {text:'選項2',act:'go test2'}] ,
                },
            test1:
                {
                    text:'這是選項1',

                },
            test2:
                {
                    text:'這是選項2',
                    
                }
        }
        this.process(content);
    }

    async process(content,id='default')
    {
        this.setFigure(content.icon,content.name);
        this.resetText();
        let sel=content[id];
        if(sel.text) 
        {
            await this.typing(sel.text);
        }

        if(sel.options)
        {
            for(let i=0;i<sel.options.length;i++)
            {
                await Utility.delay(250);
                this.addOption(sel.options[i].text,()=>{this.execute(content,sel.options[i].act);});
                this.scrollToBottom();
            }
        }
        else if(sel.act)
        {
            this.execute(content,sel.act);
        }
        else
        {
            this._panel.setInteractive()
                .on('pointerdown',()=>{
                    this._panel.off('pointerdown');
                    this.hide();
                });
        }
    }

    execute(content,action)
    {
        let [cmd,p0,p1] = action.split(' ');
        console.log('cmd:',cmd,'p0:',p0,'p1:',p1);
        switch(cmd)
        {
            case 'end': this.hide(); break;
            case 'go': this.process(content,p0); break;
        }
    }

    scrollToBottom()
    {
        this.layout();
        this._panel.scrollToBottom();
    }

    typing(str)
    {
        return new Promise((resolve, reject) => {
            this._panel.scrollerEnable = false;
            this.doTyping(this._text,str,0,()=>{resolve();});
        });
    }

    doTyping(target,str,s,cb)
    {
        console.log('start:',s,str.length);
       
        let i=s;
        let timer = this.scene.time.addEvent({
            delay: 100,
            //repeat: str.length,
            loop: true,
            callback: ()=>{
                //console.log(s,i);
                target.setText(str.substring(s,++i));
                this._sizer.layout();
                //console.log(i,'height:',target.getBounds(), this._panel.getBounds());
                //console.log(target.height, this._panel.height);

                if(target.height>this._panel.height)
                {
                    //console.log('chk1',i,str.length);
                    target.setText(str.substring(s,--i));
                    timer.remove();
                    this._btn.setVisible(true);
                    this._btn.on('pointerdown',()=>{
                        this._btn.off('pointerdown');
                        this._btn.setVisible(false);
                        this.doTyping(target,str,i,cb);
                    });
                }

                if(i==str.length)
                {
                    //console.log('chk2');
                    timer.remove();
                    this._panel.scrollerEnable = true;
                    cb();
                }
                
            }

        });
    }

    addOption(content,cb)
    {
        let config = 
        {
            background: rect(this.scene,{color:COLOR_DARK, radius:10}),
            text: text(this.scene,{str:content,fontSize:20,wrapWidth:this._sizer.width}),
            space:5,
        }

        let label= this.scene.rexUI.add.label(config);
        label.setInteractive()
            .on('pointerover',()=>{label.getElement('background').setAlpha(0.5);})
            .on('pointerout',()=>{label.getElement('background').setAlpha(1);})
            .on('pointerup',()=>{label.getElement('background').setAlpha(1);})
            .on('pointerdown',()=>{label.getElement('background').setAlpha(0);cb();})
        
            
        this._sizer.add(label,{align:'left',padding:{left:10}});
    }

    bg(scene)
    {
        return rect(scene,{radius:10});
    }

    resetText()
    {
        this._sizer.clear(true);
        this._text = text(this.scene,{fontSize:20,wrapWidth:this._sizer.width});
        this._sizer.add(this._text,{align:'left'});
        this.layout();
    }

    setFigure(icon, name)
    {
        let[key,frame] = icon.split('/');
        this._fig.setTexture(key,frame);
        this._fig.setText(name);
        this.layout();
    }

    createFigure(scene)
    {
        let config = {
            text: text(scene,{fontSize:20}),
            icon: sprite(scene),
            orientation: 'y',
        }

        let sizer = scene.rexUI.add.sizer({orientation:'y'});
        this._fig = scene.rexUI.add.label(config);
        sizer.add(this._fig);
        return sizer;

    }

    createText(scene)
    {
        let create =() =>{
            let sizer = scene.rexUI.add.sizer({orientation:'y',space:{item:5}});
            sizer.addBackground(rect(scene,{color:COLOR_GRAY, radius:10}));
            this._sizer = sizer;
            return sizer;
        }

        let config = {
            background: rect(scene,{color:COLOR_LIGHT, radius:0}),
            panel:{child:create()},
            space:{left:5,right:5,top:0,bottom:0,}
        }

        this._panel = scene.rexUI.add.scrollablePanel(config);
        this._panel.scrollerEnable = false;
        return this._panel;
    }

    createButton(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        this._btn = sprite(scene,{icon:ICON_NEXT});
        sizer.add(this._btn,{align:'bottom'});
        this._btn.setInteractive()
                    .setVisible(false);
        return sizer;
    }

}

class UiFrame extends Phaser.GameObjects.Container
{
    constructor(scene,x,y,width,height)
    {
        super(scene, x, y);
        this.scene = scene;
        this.setSize(width,height);
        this.scene.add.existing(this);
    }

    layout()
    {
        this.list.forEach((child,i)=>{
            if(child.anchor)
            {
                //let o={x:child.originX,y:child.originY};
                let a = child.anchor;
                let off={x:(a.x-0.5)*this.width,y:(a.y-0.5)*this.height};
                child.x += off.x;
                child.y += off.y;
                //console.log(child,'a:',a,'off:',off);
                child.layout?.();
            }
            else
            {
                child.layout?.();
            }
        });
    }

    hide() {this.setVisible(false);}

    show() {this.setVisible(true);}
}

class UiResult extends UiFrame
{
    constructor(scene)
    {
        super(scene, _w/2, _h/2, 600, 400);
        this.createBg(scene);
        this.createTitle(scene);
        this.createButton(scene);
        this.layout();
        this.hide();
    }

    createBg(scene)
    {
        this.add(rect(scene,{x:0,y:0,width:this.width,height:this.height,color:COLOR_LIGHT,alpha:0.5}));
    }

    createTitle(scene)
    {
        let title = text(scene,{fontSize:64});
        title.setText('失敗').setOrigin(0.5,0);
        title.anchor = {x:0.5,y:0};
        title.y = 20;
        title.name = 'title';
        this.add(title);
    }

    createButton(scene)
    {
        let config = {y:-10};
        let _resolve;
        let options = [
                {text:'離開',act:()=>{this.hide();_resolve();},bg:COLOR_LIGHT,space:10},
            ]
        let btn = new UiButtons(scene, options, config);
        btn.setOrigin(0.5,1);
        btn.anchor = {x:0.5,y:1};
        this.add(btn);
        this.wait = ()=>{return new Promise((resolve)=>{_resolve = resolve;})}
    }

    show(result)
    {
        super.show();
        this.getByName('title').setText(result?'勝利':'失敗');
        this.scene.tweens.add({
            targets: this,
            scale: {from: 0.1, to: 1},
            duration: 1000,
            ease: 'back.out',
        });
    }
}



class UiCtrl extends UiFrame
{
    constructor(scene, resolve)
    {
        super(scene, _w/2, _h-75, _w, 150);
        this.createBg(scene);
        this.createTurnEnd(scene);
        this.createCards(scene);
        this.createAP(scene);
        this.layout();
        this.hide();
        this._resolve = resolve;
    }

    createBg(scene)
    {
        this.add(rect(scene,{x:0,y:0,width:this.width,height:this.height,color:COLOR_LIGHT,alpha:0.5}));
    }

    createTurnEnd(scene)
    {
        let config = {x:-10,y:10}

        let _turnEnd = ()=>{
            this.hide();
            this.resetCard();
            this._resolve?.(false);
        }

        let options = [{text:'回合結束',act:()=>{_turnEnd();},bg:COLOR_DARK,space:10},]
        let btn = new UiButtons(scene, options, config);
        btn.setOrigin(1,0);
        btn.anchor={x:1,y:0};

        btn.endPlayerTurn =()=>{_turnEnd();}

        this._turnEnd = btn;
        this.add(btn);
    }

    createCards(scene)
    {
        let config = {x:0,y:0,space:1}

        let onClick = (sel)=>{
            this.emit('selected',sel);    // battle.js/Battle.action()
            Cursor.set(sel?'melee':'none');
        }

        // let options = [
        //         {icon:ICON_NEXT,text:'攻擊',name:'atk',act:(sel)=>{onClick(sel);},bg:COLOR_DARK,space:10},
        //         {icon:ICON_NEXT,text:'治療',name:'heal',act:(sel)=>{onClick(sel);},bg:COLOR_DARK,space:10},
        // ]

        let options=['attack','shield','cure','poison','strong'];

        //let btn = new UiRadios(scene, options, config);
        //let cards = new UiCards(scene, 0,0, options,(sel)=>{onClick(sel)});
        //btn.setOrigin(0.5,1)
        let cards = new UiCards(scene, 0,0,(sel)=>{onClick(sel)});
        cards.anchor={x:0.5,y:1};
        this._cards = cards;

        this.add(cards);
    }

    createAP(scene)
    {
        let config={
            x: 10,
            y: 10,
            width: 50,
            space: 10,
            background: rect(scene,{color:COLOR_DARK,radius:10}),
            text: text(scene,{str:1}),
            align: 'center',
        }
        let ap = scene.rexUI.add.label(config);
        ap.setOrigin(0);
        ap.anchor={x:0,y:0};
        //ap.layout().drawBounds(this.scene.add.graphics(), 0xff0000);
        this.add(ap);

        this._ap = ap;
    }

    setAp(ap)
    {
        this._ap.text = ap;
        this._cards.checkAp(ap);
    }

    resetCard() // call by this.createTurnEnd()/_turnEnd
    {
        this._cards.clear();
        Cursor.set('none');
    }

    updateCard() {this._cards.update();}

    setCard(cards) {this._cards.setCard(cards);}

    useCard() {this._cards.useCard();Cursor.set('none');}

    end()
    {
        this._turnEnd.endPlayerTurn();
    }

    show()
    {
        super.show();
        //this.setAp();
    }

}

export class UiBattle extends Phaser.GameObjects.Container
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiBattle.instance = this;
        this.scene = scene;
        
        this.createTurn(scene);
        this.createBtnExit(scene);
        this.createTurnStart(scene);
        this.createGameOver(scene);
        this.createCtrl(scene);

        scene.add.existing(this);
    }

    emit(type,msg) {this.scene.events.emit(type,msg);}

    setResolve(resolve) {this._resolve = resolve;}

    resolve(ret) {this._resolve?.(ret); this._resolve = null;}

    createBtnExit(scene)
    {
        let config = {
            x: _w-10,
            y: 10,
        }

        let exit = ()=>{
            this.exit();
            this.emit('exit')   // call GameBattle.js/exit()
        }

        let options = [{text:'離開',act:()=>{exit();},bg:COLOR_DARK,space:10},]
        let btn = new UiButtons(scene, options, config);
        btn.setOrigin(1,0).layout().hide();
        this._btnExit = btn;
        this.add(btn);
    }

    createCtrl(scene)
    {
        this._ctrl = new UiCtrl(scene, (ret)=>{this.resolve(ret);});
        this._ctrl.emit = this.emit;
    }

    createTurn(scene)
    {
        let config = {
            x: _w/2,
            y: 100,
            width: _w/2,
            orientation: 'y',
            space: 10,
        }

        let sizer = scene.rexUI.add.sizer(config);
        sizer.addBackground(rect(scene,{color:COLOR_BLACK, alpha:0.3}))
            .add(text(scene,{fontSize:32,strokeThickness:5,stroke:COLOR_RED}),{key:'turn'})
            .hide();

        sizer.setText = (turn)=>{
            sizer.getElement('turn').setText(turn?`第 ${turn} 局`:'');
            sizer.show().layout();
        }

        sizer.start = async(turn)=>{
            sizer.setText(turn);
            return new Promise((resolve)=>{
                scene.tweens.add({
                    targets: sizer,
                    scale: {from: 1, to: 1.5},  // from不能設成0，否則如果yoto:true，第二次執行時會無法顯示
                    duration: 1000,
                    ease: 'back.out',
                    yoyo: true,
                    onComplete: (tween, targets, gameObject)=>{resolve();}         
                });
            });
        }

        this._turn = sizer;
        this.add(sizer);
    }

    createTurnStart(scene)
    {
        let config = {
            x: _w/2,
            y: _h/2,
            width: _w,
            orientation: 'y',
            space: 10,
        }

        let sizer = scene.rexUI.add.sizer(config);
        sizer.addBackground(rect(scene,{color:COLOR_BLACK, alpha:0.3}))
            .add(text(scene,{fontSize:64,strokeThickness:5,stroke:COLOR_RED}),{key:'title'})
            .hide();

        sizer.setText = (title,turn)=>{
            sizer.getElement('title').setText(title);
            sizer.show()
                .layout();
        }

        sizer.start = async(title)=>{
            sizer.setText(title);
            return new Promise((resolve)=>{
                scene.tweens.add({
                    //persist: true,  // true:執行完不刪除，用restart()可再執行, false:執行完刪除，預設是false     
                    targets: sizer,
                    scale: {from: 0.1, to: 1},  // from不能設成0，否則如果yoto:true，第二次執行時會無法顯示
                    duration: 1000,
                    ease: 'back.out',
                    yoyo: true,
                    //delaycomplete: 1000,
                    onStart: (tween, targets, gameObject)=>{
                        targets.forEach((target)=>target.show());
                    },
                    onComplete: (tween, targets, gameObject)=>{
                        targets.forEach((target)=>target.hide());
                        resolve();
                    }         
                });
            });
        }

        this._turnStart = sizer;
        this.add(sizer);
    }


    // createTurnStart(scene)
    // {
    //     let config = {
    //         x: _w/2,
    //         y: _h/2,
    //         width: _w,
    //         orientation: 'y',
    //         space: 10,
    //     }

    //     let sizer = scene.rexUI.add.sizer(config);
    //     sizer.addBackground(rect(scene,{color:COLOR_BLACK, alpha:0.3}))
    //         .add(text(scene,{fontSize:64,strokeThickness:5,stroke:COLOR_RED}),{key:'title'})
    //         .add(text(scene,{fontSize:24,strokeThickness:5,stroke:COLOR_RED}),{key:'turn'})
    //         .hide();

    //     sizer.setText = (title,turn)=>{
    //         sizer.getElement('title').setText(title);
    //         sizer.getElement('turn').setText(turn?`第 ${turn} 局`:'');
    //         sizer.show()
    //             .layout();
    //     }

    //     sizer.start = async(title,turn)=>{
    //         sizer.setText(title,turn);
    //         return new Promise((resolve)=>{
    //             scene.tweens.add({
    //                 //persist: true,  // true:執行完不刪除，用restart()可再執行, false:執行完刪除，預設是false     
    //                 targets: sizer,
    //                 scale: {from: 0.1, to: 1},  // from不能設成0，否則如果yoto:true，第二次執行時會無法顯示
    //                 duration: 1000,
    //                 ease: 'back.out',
    //                 yoyo: true,
    //                 //delaycomplete: 1000,
    //                 onStart: (tween, targets, gameObject)=>{
    //                     targets.forEach((target)=>target.show());
    //                 },
    //                 onComplete: (tween, targets, gameObject)=>{
    //                     targets.forEach((target)=>target.hide());
    //                     resolve();
    //                 }         
    //             });
    //         });
    //     }

    //     this._turnStart = sizer;
    // }

    createGameOver(scene, cb)
    {
        this._result = new UiResult(scene, cb);
    }

    async turn(msg, resolve)
    {
        await this._turn.start(msg);
        resolve?.();
    }

    async playerTurn(msg,resolve)
    {        
        await this._turnStart.start('玩家回合');
        this._ctrl.show(msg.ap);
        this._btnExit.show();
        resolve?.();
    }

    async enemyTurn(msg,resolve)
    {
        this._btnExit.hide();
        await this._turnStart.start('敵人回合');
        resolve?.();
    }

    waitAck(resolve)
    {
        this.setResolve(resolve); 
    }

    endPlayerTurn() {this._ctrl.end();}

    async end(msg,resolve)
    {
        this._result.show(msg);
        this._ctrl.hide();
        this._turn.hide(); 
        await this._result.wait();
        resolve?.();
    }

    exit()
    {
        //this._btnStart.show();
        //UiMain.show();
        this._ctrl.hide();
        this._turn.hide(); 
        this._btnExit.hide();
    }

    setAp(ap) {this._ctrl.setAp(ap);}
    updateCard() {this._ctrl.updateCard();}
    setCard(cards) {this._ctrl.setCard(cards);}
    useCard() {this._ctrl.useCard();}

    static turn(msg,resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.turn(msg,resolve);}
    }

    static playerTurn(msg,resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.playerTurn(msg,resolve);}
    }

    static enemyTurn(msg,resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.enemyTurn(msg,resolve);}
    }

    static end(msg,resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.end(msg,resolve);}
    }

    static exit(msg,resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.exit(msg,resolve);}
    }

    static endPlayerTurn()
    {
        if(UiBattle.instance) {UiBattle.instance.endPlayerTurn();}
    }

    static waitAck(resolve)
    {
        if(UiBattle.instance) {UiBattle.instance.waitAck(resolve);}
    }

    static setAp(ap)
    {
        if(UiBattle.instance) {UiBattle.instance.setAp(ap);}
    }

    static updateCard()
    {
        if(UiBattle.instance) {UiBattle.instance.updateCard();}
    }

    static setCard(cards)
    {
        if(UiBattle.instance) {UiBattle.instance.setCard(cards);}
    }

    static useCard()
    {
        if(UiBattle.instance) {UiBattle.instance.useCard();}
    }
}

class StoreSlot extends OverlapSizer
{
    constructor(scene, w, h,{container,i,onclick})
    {
        super(scene, 0, 0, w, h);
        
        this.scene = scene;
        this.addBg(scene)
            .addInner(scene)
            //.addLabel(scene)
            .addIcon(scene)
            .addDescript(scene)
            .addPrice(scene)
            .addLabel(scene)
        this.layout();

        scene.add.existing(this);

        this._item = container[i];
        this._data = ItemDB.get(this._item.id);
        this._container = container;
        this._i = i;
        this._onclick = onclick;

        this.set(this._data);
        this.interactive();
    }

    get count(){return this._item.count;}
    set count(val){return this._item.count=val;}
    get id(){return this._item.id;}
    get icon(){return this._data.icon;}
    get cat(){return this._data.cat;}
    get label(){return this._data.name;}
    get dat(){return this._data;}
    get container(){return this._container;}
    get label(){return this._data.name;}
    get price(){return this._data.price;}

    unitTest()
    {
        let data = {icon:'cursorPack', price:100, label:'test', descript:'descript'};
        this.set(data);
    }

    interactive()
    {
        //this.setInteractive();    // 由 scroll.setChildrenInteractive()
        this.on('click',async ()=>{
                if(await UiConfirm.show('要買嗎?'))
                {
                    if(Player.buy(this,1)){this._onclick?.();}
                }
            })
            .on('over',()=>{
                this.scene.tweens.add({targets:this,scale:1.05,duration:100})
            })
            .on('out',()=>{
                this.scene.tweens.add({targets:this,scale:1,duration:100 })
            })
    }

    addBg(scene)
    {
        this.addBackground(rect(scene,{color:COLOR_DARK,alpha:0}));
        return this;
    }

    addInner(scene)
    {
        //this._inner = rect(scene,{color:0xffffff,alpha:0.5});
        //this.add(this._inner)
        let sizer = scene.rexUI.add.sizer({orientation:'y',space:10});
        sizer.addBackground(rect(scene,{color:COLOR_BLACK,radius:10, alpha:0.5}));
        this.add(sizer,{padding:{bottom:25}});
        this._inner = sizer;
        return this;
    }

    btnClose(scene)
    {
        return scene.rexUI.add.buttons({buttons:[sprite(scene,{icon:ICON_CLOSE}).setDisplaySize(30,30)]})
                .on('button.click', ()=>{this.hide();})
                .on('button.down', (button)=>{button.setAlpha(0.5);})
                .on('button.up', (button)=>{button.setAlpha(1);})
                .on('button.out', (button)=>{button.setAlpha(1);});
    }

    addLabel(scene)
    {
        let label = scene.rexUI.add.label({
            width:200,
            height:40,
            background: rect(scene,{color:COLOR_DARK,strokeWidth:3,strokeColor:COLOR_LIGHT,radius:10}),
            text: text(scene,{str:'致命一擊',fontSize:24}),
            align: 'center',
            space: 10
        });
        //this._inner.add(label,{expand:true})
        this.add(label,{align:'top',offsetY:140,expand:false})
        this._label = label;
        return this;
    }

    addIcon(scene)
    {
        let icon = new Icon(scene, 0, 150,{icon:'cursorPack',radius:0});
        this._inner.add(icon, {expand:true});
        this._icon = icon;
        return this;
    }

    addDescript(scene)
    {
        let w=250-20,h=150;
        let sizer = scene.rexUI.add.sizer({width:w, height:h,space:{left:5,right:5,top:30}})
        sizer.addBackground(rect(scene,{color:COLOR_PRIMARY}));
        sizer.addSpace();
        this._descript = text(scene,{str:'造成 100 傷害。',wrapWidth:w});
        sizer.add(this._descript)
        sizer.addSpace();
        this._inner.add(sizer);
        return this;
    }

    addPrice(scene)
    {
        this._price = text(scene,{str:50});
        this.add(this._price, {align:'center-bottom',expand:false})
        return this;
    }

    set(data)
    {
        this._icon.set(data.icon);
        this._price.setText(data.price);
        this._label.setText(data.name);
        this._descript.setText(data.descript);
    }

    remove()
    {
        this._container.splice(this._i, 1);
    }

    split(cnt)
    {
        let item = {id:this.id, count:cnt};
        this.count -= cnt;
        this._container.splice(this._i+1, 0, item);
    }






    // createLabel_1(scene, w)
    // {
    //     return text(scene, {fontSize:24, other:{backgroundColor:S_COLOR_DARK, align:'center', fixedWidth:w, padding:{x:5,y:5}}});
    // }

    createLabel(scene)
    {
        return scene.rexUI.add.label({
            background: rect(scene,{color:COLOR_DARK}),
            text: text(scene),
            align: 'center',
            space: 10
        });
    }

    createIcon(scene,w,h)
    {
        return new Icon(scene, w, h,{icon:'iconPack/iconPack_123',radius:0});
    }

    // createDescript_old(scene,h)
    // {
    //     return textArea(scene, {height:h, slider:false});
    // }

    createDescript(scene, w, h)
    {
        return new ScrollText(scene,{width:w,height:h,space:5,fontSize:20,slider:true});
    }

    // createButtons(scene)
    // {
    //     return new UiButtons(scene);
    // }

    setLabel(text)
    {
        this.getElement('label',true).setText(text);
        return this;
    }

    setIcon(icon, count)
    {
        this.getElement('icon',true).set(icon, count);
        return this;
    }

    setDescript(data)
    {
        let scroll = this.getElement('descript',true);
        let keys = ['damage','rof','magazine','range',
                    'life','heal','shield'];

        scroll.clear();
        keys.forEach((key,i)=>{
            if(data.prop[key]) 
            {
                let value = data.prop[key];
                if(key=='rof') {value=`${data.prop[key]}/s`}
                scroll.prop(Utility.local(key),value);
            }
        });
        //scroll.skill('技能','123456778901223455');
        scroll.text();
        scroll.text(data.descript);
        scroll.layout();
        return this;
    }

    // setButtons(options)
    // {
    //     let buttons = this.getElement('sizer',true).getElement('buttons',true);
    //     buttons.set(options);
    //     return this;
    // }

    addButtons(options)
    {
        let top = this.getElement('top',true);
        top.add(new UiButtons(this.scene,options),{key:'buttons',padding:{top:10,bottom:0},expand:true});
        return this;
    }

    addTrade(config)
    {
        let top = this.getElement('top',true);
        top.add(new Trade(this.scene,config),{key:'buttons',padding:{top:10,bottom:0},expand:true});
        return this;
    }

    init(scene, {w=300, hIcon=150, hDescript=150}={})
    {
        let top = scene.rexUI.add.sizer(0,0,0,0,{orientation:'y',space:10});
        this.add(top,{key:'top'})
        top.add(this.createLabel(scene),{key:'label', expand:true})
            .add(this.createIcon(scene,w,hIcon),{key:'icon'})
            .add(this.createDescript(scene,w,hDescript),{key:'descript'})
            //.add(this.createButtons(scene),{key:'buttons', padding:{top:10,bottom:10}, expand:true})

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);        
        this.hide();
    }

    reset()
    {
        let top = this.getElement('top',true);
        let btn = this.getElement('buttons',true);
        if(btn) {top.remove(btn,true);}

        return this;
    }

}

export class UiStore extends OverlapSizer
{
    static instance = null;
    constructor(scene)
    {
        //super(scene, x, y, minWidth, minHeight, config);
        super(scene, _w/2, _h/2, _w, _h);
        UiStore.instance = this;

        this.addBg(scene)
            .addBar(scene)
            .addBtnExit(scene)
            .addScroll(scene)
            .layout()
            .hide()

        scene.add.existing(this);
        this.getLayer().name='UiStore';
    }
    

    addBg(scene)
    {
        //return rect(scene,{alpha:0.5});
        let bg = rect(scene,{alpha:0.9});
        bg.setInteractive();
        this.addBackground(bg);
        return this;
    }

    addBar(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        this._gold = text(scene,{fontSize:32});
        this._gold.addImage('gold', {
            key: 'buffs',
            frame: 210,
            width: 32,
            height: 32,
        })
        this._gold.updateText();
        sizer.add(this._gold);
        sizer.setOrigin(0);
        this.add(sizer,{align:'left-top',expand:false});
        return this;
    }

    addBtnExit(scene)
    {

        let config = 
        {
            background: rect(scene, {radius:0, color:COLOR_LIGHT}),
            text: text(scene,{str:'離開',fontSize:24}),
            space: 10
        }

        let lb = scene.rexUI.add.buttons({buttons:[scene.rexUI.add.label(config)]})
                .on('button.click', ()=>{this.hide();})
                .on('button.down', (button)=>{button.setAlpha(0.5);})
                .on('button.up', (button)=>{button.setAlpha(1);})
                .on('button.out', (button)=>{button.setAlpha(1);});
        lb.setOrigin(1,0);
        this.add(lb,{align:'right-top',expand:false});
        return this;
    }


    addScroll(scene)
    {
        this._scroll = new Scroll(scene,{col:3,row:2,sw:250,sh:300});       
        this.add(this._scroll,{align:'center',expand:false})
        return this;
    }

    refresh()
    {
        this._scroll.clear();
        this._items?.forEach((item,i)=>{
            let slot = ItemDB.get(item.id);
            this._scroll.addSlot(new StoreSlot(this.scene,250,300,
                {container:this._items,i:i,onclick:()=>{this.refresh();}}));
        })
        this._gold.setText(`[img=gold] ${Player.role.gold}`);
        this.layout();
    }

    onSell()
    {
        this.refresh();   
    }

    show(items)
    {
        super.show();
        this._items = items;
        this.refresh();
    }

    static show(items)
    {
        if(UiStore.instance) {UiStore.instance.show(items);}
    }

}

class UiConfirm extends Sizer
{
    static instance;
    constructor(scene)
    {
        super(scene,_w/2,_h/2,300,150,{orientation:'y',space:10});
        UiConfirm.instance=this;
        this.addBg(scene)
            .addContent(scene)
            //.addSpace()
            .addButtons(scene)
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000); 
        scene.add.existing(this);
        this.hide();
        this._resolve;
        this.getLayer().name='UiConfirm';
    }

    addBg(scene)
    {
        this.addBackground(rect(scene,{color:COLOR_PRIMARY,radius:20,strokeColor:COLOR_LIGHT,strokeWidth:2}));
        return this;
    }

    addContent(scene)
    {
        let sizer=scene.rexUI.add.sizer({width:100,height:100});
        this._content = text(scene,{str:'123',fontSize:24});
        sizer.addSpace().add(this._content).addSpace();
        this.add(sizer);
        return this;
    }

    addButtons(scene)
    {
        let config=
        {
            buttons: [
                scene.rexUI.add.space(),
                this.createButton(scene,'是'),
                scene.rexUI.add.space(),
                this.createButton(scene,'否'),
                scene.rexUI.add.space(),
            ],
        }
        let buttons = scene.rexUI.add.buttons(config);
        this.add(buttons,{expand:true})

        buttons.on('button.click', (button,index)=>{
                    this.hide();
                    this?._resolve(index==0);
                })
                .on('button.out', (button)=>{
                    button.getElement('background').setStrokeStyle(2, COLOR_LIGHT, 0);
                })
                .on('button.over', (button)=>{
                    button.getElement('background').setStrokeStyle(2, COLOR_LIGHT, 1);
                })

        return this;
    }

    createButton(scene,label)
    {
        let config =
        {
            space:5,
            background:rect(scene,{color:COLOR_DARK,radius:10,strokeColor:COLOR_LIGHT,strokeWidth:2,strokeAlpha:0}),
            text:text(scene,{str:label,fontSize:24})
        }

        return scene.rexUI.add.label(config)
    }

    show(text)
    {
        super.show();
        this._content.setText(text);
        this.layout()
            .modal({cover: {color: 0x0,alpha: 0.5}});
        return new Promise((resolve)=>{this._resolve=resolve;})
    }

    static show(text)
    {
        if(UiConfirm.instance){return UiConfirm.instance.show(text);}
    }
}

export class UiDialog_old extends Sizer
{
    static instance = null;
    constructor(scene,{enType=true,enPre=false}={})
    {
        let fontSize = 24;
        let lineCnt = 5;
        let width = 400;
        let lineSpace = 5;
        let height = (fontSize+lineSpace)*lineCnt*1.05;

        super(scene, {x:_w/2,y:_h/2+100,orientation:'x',space:{left:10,right:10,top:10,bottom:10,item:10}});
        UiDialog.instance=this;

        this.addBackground(rect(scene,{radius:10}));
        let sz1 = scene.rexUI.add.sizer({width:width,height:height})
        this.add(sz1);
        
        let txt = text(scene,{fontSize:fontSize,wrapWidth:width,lineSpacing:lineSpace,interactive: false});
        sz1.add(txt,{align:'top'});
        let sz2 = scene.rexUI.add.sizer({height:height,orientation:'y'})
        this.add(sz2);
        let btn_pre = sprite(scene,{icon:ICON_NAV_N});
        let btn_nxt = sprite(scene,{icon:ICON_NAV_S});
        sz2.addSpace().add(btn_pre).add(btn_nxt);
        btn_nxt.setInteractive()
                .on('pointerup',()=>{this.typeNextPage();})
                .on('pointerover',()=>{btn_nxt.setTint(0x777777);})
                .on('pointerout',()=>{btn_nxt.setTint(0xffffff);})
        btn_pre.setInteractive()
                .on('pointerup',()=>{this.typePrePage();})
                .on('pointerover',()=>{btn_pre.setTint(0x777777);})
                .on('pointerout',()=>{btn_pre.setTint(0xffffff);})
        btn_pre.visible=false; btn_nxt.visible=false;
        
        this.setInteractive()
        this.on('pointerup',()=>{
            if(typing.isTyping){typing.stop(true)}
            else if(page.isLastPage){this.next();}
        })
        txt.on('areaover', (key, pointer, localX, localY, event)=>{
                let t = page.getPage();
                let regex = new RegExp(`\\[area=${key}\\]\\[bgcolor=blue\\]`);
                let replacement = `[area=${key}][bgcolor=green]`;
                t = t.replace(regex,replacement);
                txt.setText(t);
            })
            .on('areaout',(key, pointer, localX, localY, event)=>{
                !typing.isTyping&&txt.setText(page.getPage());
            })
            .on('areaclick', (key, pointer, localX, localY, event)=>{
                this.option(key);
            })
        
        let typing = scene.plugins.get('rexTextTyping').add(txt,{speed:50,wrap:true});
        let page = scene.plugins.get('rexTextPage').add(txt,{maxLines:lineCnt});

        this.start = (text, speed) =>{  
            btn_pre.visible=false;btn_nxt.visible=false;
            page.setText(text);
            if (speed) {typing.setTypeSpeed(speed);}
            this.typeNextPage();
        };
            
        this.typeNextPage = ()=>{
            btn_nxt.visible = false; 
            btn_pre.visible = false;
            txt.disableInteractive();
            if (!page.isLastPage) 
            {
                let t = page.getNextPage();
                if(enType){typing.start(t);}
                else{txt.setText(t); onComplete();}
            } 
        };

        this.typePrePage = ()=>{
            btn_nxt.visible = false;
            btn_pre.visible = false;
            txt.disableInteractive();
            if (!page.isFirstPage) 
            {
                let t = page.getPreviousPage();
                if(enType){typing.start(t);}
                else{txt.setText(t); onComplete();}
            }
        };

        let onComplete = ()=>{  btn_nxt.visible=!page.isLastPage;
                                btn_pre.visible=enPre&&!page.isFirstPage;
                                txt.setInteractive();
                            };

        typing.on('complete', onComplete);

        this.getLayer().name='UiDialog';
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.hide();

    }

    get sel() {return this._content[this._id];}

    UnitTest()
    {
        this._content =
        {
            icon:ICON_INFO,
            name:'Tony',
            default:
                {
                    text:'網摘精選 · 費德勒的三堂網球人生課： 冠軍，是一再經歷失敗，學會更努力前進 · 揭密國宴顧問團蔡珠兒：國家光榮感，是最強勁的推動力 · 520國宴菜單的誕生：用美食讓世界看見台灣.\n'+
                        '[area=1][bgcolor=blue]選項1[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]選項2[/bgcolor][/area]\n'+
                        '[area=3][bgcolor=blue]離開[/bgcolor][/area]',
                    options:{1:'go default',2:'go test2',3:'exit'} ,
                },
            test1:
                {
                    text:'這是選項1\n這是選項1\n這是選項1\n'+
                        '[area=1][bgcolor=blue]選項1[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]選項2[/bgcolor][/area]\n',
                    options:{1:'go default',2:'go test2',3:'exit'} ,

                },
            test2:
                {
                    text:'這是選項2',
                    
                }
        }
        this.process();
    }

    parse(content)
    {
        if (Array.isArray(content))
        {
            let text='';
            content.forEach((child)=>{text+=this.parse(child);})
            return text;
        } 
        else if (typeof content === 'object' && content !== null) 
        {
            return this.checkCond(content.cond) ? content.text : '';
        } 
        else 
        {
            return content;
        }
    }

    checkCond(cond)
    {
        return cond
    }

    process(id='0')
    {
        this._id=id;
        this.start(this.parse(this.sel.text));
    }

    next()
    {
        this.execute(this.sel.next);
    }

    option(key)
    {
        let action = this.sel.options[key];
        this.execute(action);
    }

    execute(action)
    {
        if(!action) {return;}

        let acts = action.split(';')

        acts.forEach((act)=>{
            let [cmd,p0,p1] = act.split(' ');
            console.log(`[${cmd}] [${p0}] [${p1}]`);
            switch(cmd)
            {
                case 'exit': this.hide(); break;
                case 'go': this.process(p0); break;
                case 'save': this.save(p0); break;
                case 'quest': this.quest(p0); break;
                case 'battle': this.battle(p0); break;
            }
        });
    }

    battle(id)
    {
        console.log('battle',id);
        this.scene.events.emit('battle',id);
    }

    quest(id)
    {
        QuestManager.add(id);
    }

    save(id)
    {
        Record.data[this._content.name]=id; 
        Record.save(); 
    }

    load()
    {
        return Record.data[this._content.name];
    }

    show(dialog)
    {
        super.show()
            .modal({cover: {color: 0x0,alpha: 0.5,}});
        //this.UnitTest();
        this._content=dialog;
        let id = this.load();
        console.log('id',id)
        this.process(id);
    }

    static show(dialog)
    {
        if(UiDialog.instance) {UiDialog.instance.show(dialog);}
    }

   

    
}

export class UiQuest extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene, {x:_w/2,y:_h/2,width:_w,height:_h,orientation:'y',space:{left:10,right:10,top:10,bottom:10,item:0}});
        UiQuest.instance=this;

        this.addBackground(rect(scene,{radius:10,color:COLOR_PRIMARY}))

        // top bar
        let sz1 = scene.rexUI.add.sizer({orientation:'x',height:50});
        sz1.add(this.tags(scene),{proportion:0,key:'tags'});
        sz1.addSpace();
        sz1.add(button(scene,{icon:ICON_CLOSE,onclick:()=>{this.hide();}}))
        this.add(sz1,{expand:true});

        //
        let sz2 = scene.rexUI.add.sizer({orientation:'x',height:_h-70})
        this.add(sz2,{expand:true});
        sz2.add(this.scroll(scene,400,_h-70))
        sz2.add(this.descript(scene,_w-400-20),{expand:true})

        this.getLayer().name='UiQuest';
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        this.hide();
    }

    tags(scene)
    {
        let options = 
        [
            {text:'執行中',name:'opened',act:()=>{this.updateSlot('opened')}},
            {text:'已完成',name:'closed',act:()=>{this.updateSlot('closed')}},
        ]

        let createBtns = function(scene,options){
            let btns=[];
            options.forEach((option)=>{
                let btn=text(scene,{str:option.text,name:option.name});
                btn.act=option.act;
                btns.push(btn);
            })
            return btns
        }

        let tags = scene.rexUI.add.buttons({
            orientation: 'x',
            buttons: createBtns(scene,options),
            space: {item:10},
            type: 'radio',
            setValueCallback: function (button, value) {
                button.setTint(value ? 0xffffff : 0x777777);
            }
        })

        tags.on('button.click', (btn)=>{btn.act?.(btn);})
                .on('button.down', (btn)=>{btn.setAlpha(0.5);btn.down?.(btn)})
                .on('button.up', (btn)=>{btn.setAlpha(1);btn.up?.(btn)})
                .on('button.out', (btn)=>{btn.setAlpha(1);btn.out?.(btn)})
                .layout();

        tags.init = function(){this.emitButtonClick(0);}

        this._tags = tags;
        return tags;
    }

    scroll(scene,width,height)
    {
        let scroll = scene.rexUI.add.scrollablePanel({
            width:width,
            height:height,
            background: rect(scene,{color:COLOR_LIGHT}),
            panel:{child:scene.rexUI.add.sizer({orientation:'y',space:{item:5}})},
            //space:{item:10}
        })

        scroll.addSlot = function(child){
            this.getElement('panel').add(child);
            this.layout();
            return this;
        }

        scroll.clearSlot = function(){
            this.getElement('panel').clear(true);
            return this;
        }

        scroll.setChildrenInteractive()
            .on('child.click', (child)=>{child.emit('click',child);})

        this._scroll=scroll;

        return scroll;
    }

    descript(scene,width)
    {
        let des = scene.rexUI.add.sizer({orientation:'x',width:width,space:10});
        des.addBackground(rect(scene,{color:COLOR_DARK}));
        des.add(text(scene),{align:'top',key:'text'});
        des.set = function(quest){
            if(quest)
            {
                des.getElement('text').setText(quest.descript);
            }
            else
            {
                des.getElement('text').setText('');
            }
        }

        this._des=des;
        return des;
    }

    createSlot(quest)
    {
        let scene = this.scene;
        let width=400-10;
        let height = 50;
        let sz = scene.rexUI.add.sizer({orientation:'x',width:width,height:height,space:10});
        sz.addBackground(rect(scene,{color:COLOR_DARK}),{},'bg');
        sz.add(text(scene,{str:quest.title}),{align:'top'});
        sz.on('click',()=>{
                this._scroll.sel?.setStrokeStyle();
                this._scroll.sel = sz.getElement('bg');
                sz.getElement('bg').setStrokeStyle(2,0xffffff);
                this.updateContent(quest);
            })
        return sz;
    }

    show()
    {
        super.show()
            
        this._tags.init();
        this.modal({cover: {color: 0x0,alpha: 0.5,}});
    }

    updateSlot(cat)
    {
        console.log(cat);
        this._scroll.clearSlot();
        let list = cat=='opened' ? QuestManager.opened : QuestManager.closed ;
        list.forEach((id)=>{
            let quest = QuestDB.get(id);
            this._scroll.addSlot(this.createSlot(quest))
        })
        this.updateContent();
    }

    updateContent(quest)
    {
        this._des.set(quest);
    }

    static show()
    {
        if(UiDialog.instance) {UiQuest.instance.show();}
    }
}








