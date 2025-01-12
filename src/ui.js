import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import Utility from './utility.js';
import {UI, rect, sprite, text, bbcText, Pic, Icon} from './uibase.js';

export default function createUI(scene)
{
    console.log('createUI');
    UI.w = scene.sys.canvas.width;
    UI.h = scene.sys.canvas.height;
    console.log('resolution:',UI.w, UI.h)

    //test(scene);
    //t1();
    new UiCursor(scene);
    new UiInv(scene);
    new UiCase(scene);
    new UiMain(scene);
    new UiDragged(scene, 80, 80);
    new UiCover(scene);
    new UiInfo(scene);
    new UiOption(scene);

    t2(scene);

}

function t2(scene)
{
    let box={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    UiCase.show(box,'箱子');

    let inv={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    UiInv.show(inv);
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

class Slot extends Icon
{
    constructor(scene, w, h, id, getContainer, config)
    {
        super(scene, w, h, config);
        this.addListener();
        this._id = id
        this._getContainer = getContainer;
    }

    get slot() {return this.container?.[this._id];}
    set slot(value) {this.container[this._id]=value; this.setIcon(value.icon);}
    get isEmpty() {return this.checkIfEmpty(this.slot);}
    get container() {return this._getContainer ? this._getContainer() : null;}
    get isValid() {return true;}
    //set container(value) {this._getContainer = value;}

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
            this.setBgColor(this.isValid ? UI.COLOR_SLOT_DRAG : UI.COLOR_RED);
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
        if(UiDragged.on)
        {
            if(this.isValid)
            {
                let slotCopy = this.copySlot();
                this.slot = UiDragged.slot;
                UiDragged.clear();
                //console.log('slotCopty',slotCopy);
                if(!this.checkIfEmpty(slotCopy)) {UiDragged.slot=slotCopy;}
                if(!UiDragged.on) {this.setBgColor(UI.COLOR_SLOT);}
            }
        }
        else if(!this.checkIfEmpty(this.slot))
        {
            this.setBgColor(UI.COLOR_SLOT_DRAG);
            UiDragged.slot = this.copySlot();;
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
        weapon : UI.ICON_WEAPON,
        helmet : UI.ICON_HELMET,
        armor : UI.ICON_ARMOR,
        boot : UI.ICON_BOOT,
    }

    constructor(scene, w, h, cat, conatiner, config)
    {
        super(scene, w, h, cat, conatiner, config);
        this.setIcon();
    }

    get cat() {return this._id;}

    get isValid() {return UiDragged.isCat(this.cat)}

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.icons[this._id],{alpha:0.5,tint:0x0});}
    }

}

function addTop(scene, label)
{
    let sz = scene.rexUI.add.overlapSizer();
    sz//.addBackground(rect(scene,{color:UI.COLOR_GRAY}))
        .add(text(scene,{text:label}),{align:'center',expand:false,key:'label'})
        .add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.hide.bind(this)}),{align:'right',expand:false})
    this.add(sz,{expand:true, key:'top'});
    return this;
}


function addGrid(scene, column, row, getContainer, space)
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
        let slot = new Slot(scene,UI.SLOT_SIZE,UI.SLOT_SIZE, i, getContainer);
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
    static get icon() {return UiDragged.instance.icon;}
    static get slot() {return UiDragged.instance.slot;}
    static set slot(value) {return UiDragged.instance.setSlot(value);}

    isCat(cat)
    {
        return this.slot.cat == cat;
    }

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

    static isCat(cat)
    {
        if(UiDragged.instance){return UiDragged.instance.isCat(cat);}
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
            .addGrid(scene,4,4,this.getContainer.bind(this),{left:20,right:20,bottom:20})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .layout().setOrigin(0)
        scene.add.existing(this);
        this.getElement('bg').setInteractive(); //避免 UI scene 的 input event 傳到其他 scene
        this.getLayer().name = 'UiCase';
    }

    getContainer() {return this.container;}

    update()
    {
        //this.grid.getElement('items').forEach(item => {item.update();});
        this.getElement('grid').getElement('items').forEach(item => {item.update();});
    }

    show(container,label)
    {
        this.container = container;
        this.getElement('label',true).setText(label);
        this.layout();
        this.update();
    }

    static hide() {if(UiCase.instance){UiCase.instance.hide();}}

    static show(container,label) {if(UiCase.instance){UiCase.instance.show(container,label);}}
}

class UiInv extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : UI.w/2,
            y : 0,
            width : UI.w/2,
            height : 500,
            orientation : 'y',
        }

        super(scene,config)
        UiInv.instance = this;
        this.addTop = addTop;
        this.addGrid = addGrid;

        this.addBackground(rect(scene,{color:UI.COLOR_DARK,alpha:1,strokeColor:0x777777,strokeWidth:3}),'bg')
            //.add(new UiButton(scene,{icon:UI.ICON_CLOSE, onclick:this.hide.bind(this)}),{align:'right'})
            .addTop(scene,'裝備')
            .addEquip(scene,this.getContainer.bind(this))
            .addGrid(scene,5,4,this.getContainer.bind(this),{bottom:30})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(0)
            .layout();
        scene.add.existing(this);
        this.getElement('bg').setInteractive(); //避免 UI scene 的 input event 傳到其他 scene
        this.getLayer().name = 'UiCase';
    }

    getContainer() {return this.container;}

    addEquip(scene, getContainer)
    {
        let config =
        {
            column: 5,
            row: 2,
            space: {column:5,row:5,left:10,right:10,bottom:20},
        }
        let grid = scene.rexUI.add.gridSizer(config);
        let equip = function(cat, getContainer)
        {
            let slot = new EquipSlot(scene,UI.SLOT_SIZE,UI.SLOT_SIZE, cat, getContainer);
            return slot;
        }
        grid.add(equip('weapon', getContainer))
            .add(equip('helmet', getContainer))
            .add(equip('armor', getContainer))

        this.add(grid,{key:'grid'});
        return this;
        
    }

    update()
    {
        //this.grid.getElement('items').forEach(item => {item.update();});
        this.getElement('grid').getElement('items').forEach(item => {item.update();});
    }

    show(container)
    {
        this.container = container;
        this.update();
    }

    static hide() {if(UiInv.instance){UiInv.instance.hide();}}
    static show(container) {if(UiInv.instance){UiInv.instance.show(container);}}
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