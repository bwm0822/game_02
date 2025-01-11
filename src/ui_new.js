import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import Utility from './utility.js';
import {UI, rect, sprite, text, bbcText} from './uibase.js';

export default function createUI(scene)
{
    console.log('createUI');
    UI.w = scene.sys.canvas.width;
    UI.h = scene.sys.canvas.height;
    console.log('resolution:',UI.w, UI.h)

    //test(scene);
    //t1();

    new UiCase(scene);
    new UiMain(scene);
    new UiCursor(scene);
    new UiDragged(scene, 80, 80);
    new UiCover(scene);
    new UiInfo(scene);
    new UiOption(scene);

    t2(scene);

}

function t2(scene)
{
    let bag={0:{icon:'weapons/28'},1:{icon:'weapons/30'}};
    UiCase.show(bag);
    //new UiButton(scene,{x:100,y:100,icon:UI.ICON_CLOSE})

    console.log('test')
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


class Pic extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, color=UI.COLOR_SLOT, radius=0, alpha=0, space=0}={})
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
    constructor(scene, w, h, {x=0, y=0, icon, count, color=UI.COLOR_SLOT, radius=0, alpha=1, space=10, fontSize=20}={})
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
        let [key,frame] = icon ? icon.split('/') : [undefined,undefined];
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


class Slot extends Icon
{
    constructor(scene, w, h, config)
    {
        super(scene, w, h, config);
        this.addListener();
        //this.getLayer().name = 'Slot';
        this._getContainer=null;
    }

    get slot() {return this.container?.[this.id];}
    set slot(value) {this.container[this.id]=value; this.setIcon(value.icon);}
    get isEmpty() {return this.checkIfEmpty(this.slot);}
    get container() {return this._getContainer ? this._getContainer() : null;}
    set container(value) {this._getContainer = value;}

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

    copySlot() {return this.slot ? Utility.deepClone(this.slot) : null;}

    update() {this.setIcon(this.slot?.icon);}

    clear()
    {
        super.clear();
        this.slot={};
    }
    
    over()
    {
        if(UiDragged.on) 
        {
            this.setBgColor(UI.COLOR_SLOT_DRAG);
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(UI.COLOR_SLOT_OVER);
            UiInfo.show(this);
        }
    }

    out()
    {
        this.setBgColor(UI.COLOR_SLOT);
        UiInfo.hide();
    }

    leave(gameObject)
    {
        UiDragged.on&&gameObject.setBgColor(UI.COLOR_SLOT);
    }

    enter(gameObject)
    {
        UiDragged.on&&gameObject.setBgColor(UI.COLOR_SLOT_DRAG);
    }

    middleButtonDown(x,y)
    {
        if(!this.isEmpty) {UiOption.show(this.left+x,this.top+y);}
    }

    leftButtonDown(x,y)
    {
        UiInfo.hide();
        let slotCopy = this.copySlot();
        if(UiDragged.on)
        {
            this.slot = UiDragged.slot;
            UiDragged.clear();
            //console.log('slotCopty',slotCopy);
            if(!this.checkIfEmpty(slotCopy)) {UiDragged.slot=slotCopy;}
            if(!UiDragged.on) {this.setBgColor(UI.COLOR_SLOT);}
        }
        else if(!this.checkIfEmpty(slotCopy))
        {
            this.setBgColor(UI.COLOR_SLOT_DRAG);
            UiDragged.slot = slotCopy;
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
    static get icon() {return UiDragged.instance.icon;}
    static get slot() {return UiDragged.instance.slot;}
    static set slot(value) {return UiDragged.instance.setSlot(value);}

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
        if(UiDragged.instance){UiDragged.instance.hide();}
    }

    static setIcon(icon)
    {
        if(UiDragged.instance){return UiDragged.instance.setIcon(icon);}
    }

    static setPos(x,y)
    {
        if(UiDragged.instance){return UiDragged.instance.setPosition(x,y);}
    }

    static clear()
    {
        if(UiDragged.instance){return UiDragged.instance.clear();}
    }
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

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:UI.COLOR_GRAY,strokeWidth:3}))
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
        if(this.right>UI.w) {this.x-=this.right-UI.w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>UI.h) {this.y-=this.bottom-UI.h;}
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

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,strokeColor:UI.COLOR_GRAY,strokeWidth:3}))
            .layout()
            .hide();

        scene.add.existing(this);
        this.getLayer().name = 'UiInfo';
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


        this.setPosition(x,y).rePos();
        this.layout();
    }

    rePos()
    {
        if(this.bottom>UI.h) {this.y-=this.bottom-UI.h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static hide() {if(UiInfo.instance){UiInfo.instance.hide();}}

    static show(target) {if(UiInfo.instance){UiInfo.instance.show(target);}}
}

class UiCase extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,{x:200,y:200,orientation:'y'});
        UiCase.instance = this;
        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:1,strokeColor:0x777777,strokeWidth:3}))
            //.add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.hide.bind(this)}),{align:'right'})
            .addTop(scene)
            .addGrid(scene)
            .layout();
        scene.add.existing(this);
        this.getLayer().name = 'UiCase';
    }

    getContainer() {return this.container;}

    addTop(scene)
    {
        let sz = scene.rexUI.add.overlapSizer();
        sz//.addBackground(rect(scene,{color:UI.COLOR_GRAY}))
            .add(text(scene,{text:'箱子'}),{align:'center',expand:false})
            .add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.hide.bind(this)}),{align:'right',expand:false})
        this.add(sz,{expand:true});
        return this;
    }

    addGrid(scene)
    {
        let config =
        {
            column: 4,
            row: 4,
            space: {column:5,row:5,left:10,right:10,bottom:10},
        }

        this.grid = scene.rexUI.add.gridSizer(config);
        let count = config.column * config.row;
        for(let i=0; i<count; i++)
        {
            let slot = new Slot(scene,UI.SLOT_SIZE,UI.SLOT_SIZE);
            slot.id = i;
            // 傳遞function，方法1,2 都可以
            //slot.container = ()=>{return this.getContainer();}; // 方法1
            slot.container = this.getContainer.bind(this); // 方法2
            //slot.container = this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            this.grid.add(slot);
        }

        this.add(this.grid);
        return this;
    }

    update()
    {
        this.grid.getElement('items').forEach(item => {item.update();});
    }

    show(container)
    {
        this.container = container;
        this.update();
    }

    

    static hide() {if(UiCase.instance){UiCase.instance.hide();}}

    static show(container) {if(UiCase.instance){UiCase.instance.show(container);}}
}



export class UiMain extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        UiMain.instance = this;

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:1}))
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