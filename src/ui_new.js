import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import Utility from './utility.js';

const COLOR_PRIMARY = 0x4e342e;
const COLOR_LIGHT = 0x7b5e57;
const COLOR_DARK = 0x260e04;
//const S_COLOR_DARK = '#260e04';
const COLOR_SLOT = 0xa4d4ff;
const COLOR_SLOT_OVER = 0x4f9ef7;
const COLOR_SLOT_DRAG = 0x55aa55;
const COLOR_SLOT_DISABLE = 0x333333;
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

let _scene;
let _w,_h;

export default function createUI(scene)
{
    console.log('createUI');
    _scene = scene;
    _w = scene.sys.canvas.width;
    _h = scene.sys.canvas.height;
    console.log('resolution:',_w,_h)

    new UiMain(scene);
    new UiCursor(scene);



    let bag={0:{icon:'weapons/28'},1:{icon:'weapons/30'}}
    let slot0 = new Slot(scene,80,80,{x:100,y:100,icon:ICON_CLOSE,count:1,space:0});
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

    new Dragged(scene, 80, 80);

    new UiCover(scene);

    new UiOption(scene);
    new UiInfo(scene);
    //opt.show(100,100)

    //let btn=new UiButton(scene);
    //btn.setPosition(100,400);



    console.log(scene);

    //let t1 = text(scene,{x:100,y:100,text:'幹你娘123',color:'#0ff',backgroundColor:'#fff',stroke:'#000',strokeThickness:5,wrapWidth:50});
    //let t2 = bbcText(scene,{x:100,y:200,text:'[stroke]123456[/stroke]',color:'#000',backgroundColor:'#555',wrapWidth:50});

}

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

export function text(scene, config={})    
{
    // fixedWidth:fixedWidth,
    config.fontSize = config.fontSize ?? 20;
    config.fontFamily = config.fontFamily ?? FONT;
    config.wrapWidth && (config.wordWrap = {width:config.wrapWidth, useAdvancedWrap:true});
    config.wrapWidth && delete config.wrapWidth;
    let t = scene.add.text(config?.x, config?.y, config?.text, config);
    return t;
}

export function bbcText(scene, config={})    
{
    // fixedWidth:fixedWidth,
    let style = {};
    style.fontSize = config.fontSize ?? 20;
    style.fontFamily = config.fontFamily ?? FONT;
    style.strokeThickness = config.strokeThickness ?? 1;
    config.color && (style.color = config.color);
    config.stroke && (style.stroke = config.stroke);
    config.strokeThickness && (style.strokeThickness = config.strokeThickness);
    config.wrapWidth && (style.wrap = {mode:'char',width:config.wrapWidth}); 
    //mode: 0|'none'|1|'word'|2|'char'|'character'|3|'mix'
    config.backgroundColor && (style.backgroundColor = config.backgroundColor);
    let t = scene.add.rexBBCodeText(config?.x, config?.y, config?.text, style);
    return t;
}

class Pic extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, color=COLOR_SLOT, radius=0, alpha=0, space=0}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.addBackground(rect(scene,{color:color,radius:radius, alpha:alpha}),'background')
            .add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'sprite'})        
            .layout()//.drawBounds(scene.add.graphics(), 0xff0000);   

        scene.add.existing(this);
    }
}

class Icon extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, count, color=COLOR_SLOT, radius=0, alpha=1, space=10, fontSize=20}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.fontSize=fontSize;
        this.addBackground(rect(scene,{color:color, radius:radius, alpha:alpha}),'background')
            .add(sprite(scene,{icon:icon}),{aspectRatio:true, key:'sprite'})   
            .add(text(scene,{text:count, fontSize:this.fontSize, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false,offsetY:0,offsetX:0})        

        //if(name!=undefined) {this.name = name;}

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        scene.add.existing(this);
    }

    setIcon(icon)
    {
        let [key,frame] = icon ? icon.split('/'):[undefined,undefined];
        this.getElement('sprite').setTexture(key,frame);
        return this;
    }

    setCount(count)
    {
        this.getElement('count').setText(count);
        return this;
    }

    clear()
    {
        this.getElement('sprite').setTexture();
        this.getElement('count').setText('');
    }

}

export class Dragged extends Pic
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, w, h);
        Dragged.instance = this;
        this.hide();

        this.getLayer().name = 'Dragged';
        
    }

    static get on() {return Dragged.instance.visible;}
    static get icon() {return Dragged.instance.icon;}
    static get slot() {return Dragged.instance.slot;}
    static set slot(value) {return Dragged.instance.setSlot(value);}

    clear()
    {
        this.hide();
        delete this.slot;
    }

    setSlot(value)
    {
        this.slot=value;
        this.setIcon(value.icon);
    }


    setIcon(icon)
    {
        this.show();
        let [key,frame]=icon.split('/');
        this.getElement('sprite').setTexture(key,frame);
        return this;
    }

    static hide()
    {
        if(Dragged.instance){Dragged.instance.hide();}
    }

    static setIcon(icon)
    {
        if(Dragged.instance){return Dragged.instance.setIcon(icon);}
    }

    static setPos(x,y)
    {
        if(Dragged.instance){return Dragged.instance.setPosition(x,y);}
    }

    static clear()
    {
        if(Dragged.instance){return Dragged.instance.clear();}
    }
    
    
}

class Slot extends Icon
{
    constructor(scene, w, h, config)
    {
        super(scene, w, h, config);
        this.addListener();
        this.getLayer().name = 'Slot';
    }

    get slot() {return this.container[this.id];}
    set slot(value) {this.container[this.id]=value; this.setIcon(value.icon);}
    get isEmpty() {return this.checkIfEmpty(this.slot);}

    addListener()
    {
        this.setInteractive({draggable:true/*,dropZone:true*/})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{
            if (pointer.rightButtonDown()) {}
            else if(pointer.middleButtonDown()) {this.middleButtonDown(x,y);}
            else {this.leftButtonDown(x,y);}
        })
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

    copySlot() {return this.slot ? Utility.deepClone(this.slot) : null;}

    update()
    {
        let data = this.container?.[this.id];
        this.setIcon(data?.icon);
    }

    clear()
    {
        super.clear();
        this.slot={};
    }
    
    over()
    {
        if(Dragged.on) 
        {
            this.setBgColor(COLOR_SLOT_DRAG);
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(COLOR_SLOT_OVER);
            UiInfo.show(this);
        }
    }

    out()
    {
        this.setBgColor(COLOR_SLOT);
        UiInfo.hide();
    }

    
    middleButtonDown(x,y)
    {
        if(!this.isEmpty) {UiOption.show(this.left+x,this.top+y);}
    }

    leftButtonDown(x,y)
    {
        UiInfo.hide();
        let slotCopy = this.copySlot();
        if(Dragged.on)
        {
            this.slot = Dragged.slot;
            Dragged.clear();
            //console.log('slotCopty',slotCopy);
            if(!this.checkIfEmpty(slotCopy)) {Dragged.slot = slotCopy;}
            if(!Dragged.on) {this.setBgColor(COLOR_SLOT);}
        }
        else if(!this.checkIfEmpty(slotCopy))
        {
            this.setBgColor(COLOR_SLOT_DRAG);
            Dragged.slot = slotCopy;
            Dragged.setPos(this.left+x,this.top+y);
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

class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene);
        this.onclick=option.onclick;
        this.addBackground(rect(scene,{color:COLOR_SLOT_OVER,alpha:0}),'bg')
            .add(text(scene,{text:option.text}))
            .layout()
            .addListener()
        scene.add.existing(this);
        
    }

    addListener()
    {
        this.setInteractive();
        this.on('pointerover',()=>{this.getElement('bg').fillAlpha=1;})
            .on('pointerout',()=>{this.getElement('bg').fillAlpha=0;})
            .on('pointerdown',()=>{this.onclick&&this.onclick();})
    }
}

class UiCover extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,_w,_h);
        UiCover.instance = this;
        this.addBackground(rect(scene,{color:COLOR_DARK,alpha:0}))
            .setOrigin(0,0)
            .layout()
            .hide()
        scene.add.existing(this);
        this.getLayer().name = 'UiCover';
        this.setInteractive().on('pointerdown',()=>{UiOption.hide();})
    }

    static show() {if(UiCover.instance){UiCover.instance.show();}}
    static hide() {if(UiCover.instance){UiCover.instance.hide();}}
}

class UiOption extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,{width:100,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
        UiOption.instance = this;

        this.addBackground(rect(scene,{color:COLOR_DARK,alpha:1}))
            .add(new UiButton(scene,{text:'使用',onclick:()=>{this.use();}}),{expand:true,key:'use'})
            .add(new UiButton(scene,{text:'丟棄',onclick:()=>{this.drop();}}),{expand:true,key:'drop'})
            .setOrigin(0.2,0.2)
            .layout()
            .hide();

        scene.add.existing(this);
        this.getLayer().name = 'UiOption';
    }

    use()
    {
        this.hide();
        console.log('use');
    }

    drop()
    {
        this.hide();
        console.log('drop');
    }

    show(x,y)
    {
        UiCover.show();
        UiInfo.hide();
        super.show();
        this.setPosition(x,y).rePos();
    }

    rePos()
    {
        if(this.right>_w) {this.x-=this.right-_w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>_h) {this.y-=this.bottom-_h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    hide()
    {
        UiCover.hide();
        super.hide();
    }

    static hide() {if(UiOption.instance){UiOption.instance.hide();}}

    static show(x,y) {if(UiOption.instance){UiOption.instance.show(x,y);}}

}

class UiInfo extends Sizer
{
    static instance = null;
    static gap = 10;
    constructor(scene)
    {
        super(scene,{width:200,height:300,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
        UiInfo.instance = this;

        this.addBackground(rect(scene,{color:COLOR_DARK,alpha:1}))
            .layout()
            .hide();

        scene.add.existing(this);
        this.getLayer().name = 'UiInfo';
    }

    show(target)
    {
        super.show();
        let x,y=target.y;

        if(target.x>_w/2)
        {
            this.setOrigin(1,0.5);
            x=target.left-UiInfo.gap;
        }
        else
        {
            this.setOrigin(0,0.5);
            x=target.right+UiInfo.gap;
        }


        this.setPosition(x,y).rePos();
        this.layout();
    }

    rePos()
    {
        if(this.bottom>_h) {this.y-=this.bottom-_h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static hide() {if(UiInfo.instance){UiInfo.instance.hide();}}

    static show(target) {if(UiInfo.instance){UiInfo.instance.show(target);}}
}



export class UiMain extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiMain.instance = this;

        this.addBackground(rect(scene,{color:COLOR_DARK,alpha:1}))
            .size()
            .hide();
        
        this.getLayer().name = 'UiMain';    // 產生layer，並設定layer名稱
        this.addListener();
       
    }

    addListener()
    {
        this.setInteractive();
        this.on('pointerover',()=>{this.mark(false);})
            .on('pointerout',()=>{this.mark(true);})
    }

    mark(on) {this.scene.events.emit('mark',on);}

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

    static show()
    {
        if(UiMain.instance) {UiMain.instance.show();}
    }

    static hide()
    {
        if(UiMain.instance) {UiMain.instance.hide();}
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
        this.setDepth(Infinity);
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

    static pos(x,y)
    {
        if(UiCursor.instance) {UiCursor.instance.setPos(x,y);}
    }

    static set(type)
    {
        if(UiCursor.instance) {UiCursor.instance.setIcon(type);}
    }

}