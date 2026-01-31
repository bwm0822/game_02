import {FixWidthSizer, OverlapSizer, Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {sprite, text, text_1, rect} from '../ui_old.js';
import Utility from './utility.js';

const ICON_SHIELD = 'buffs/32';
const ICON_MARK = 'buffs/108';
const ICON_GO = 'cursors/steps';
const ICON_TALK = 'cursors/message_dots_round';
const ICON_EXIT = 'cursors/door_exit';
const ICON_ENTER = 'cursors/door_enter';
const ICON_UP = 'cursors/stairs_up';
const ICON_DOWN = 'cursors/stairs_down';
const ICON_TAKE = 'cursors/hand_small_open';

export class Shield extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon=ICON_SHIELD, fontSize=14}={})
    {
        super(scene, x, y, w, h);
        this.add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'icon'})
            .add(text_1(this.scene,{fontSize:fontSize, color:'#f00', stroke:'#f00', strokeThickness:1}).setOrigin(0.5),
                        {key:'num',align:'centor',expand:false,offsetY:0,offsetX:0})           
        scene.add.existing(this);
        this.setVisible(false);
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
    }

    setNum(num, tween=true)
    {
        if(tween)
        {
            if(num>0)
            {
                this.setVisible(true);
                this.scene.tweens.add({
                    targets: this,
                    scaleX: {from:1,to:1.5},
                    scaleY: {from:1,to:1.5},
                    duration: 100,
                    yoyo: true,
                    onComplete: () => {
                        this.getElement('num').setText(num);
                    }
                });
            }
            else if(this.visible)
            {
                this.scene.tweens.add({
                    targets: this,
                    scaleX: {from:1,to:0.1},
                    scaleY: {from:1,to:0.1},
                    duration: 100,
                    onComplete: () => {
                        this.getElement('num').setText(num);
                        this.setVisible(false);
                    }
                });
            }
        }
        else
        {
            this.getElement('num').setText(num);
            this.setVisible(num>0);
        }
        
        return this;
    }
}

export class Buff extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, buff, fontSize=12}={})
    {
        super(scene, x, y, w, h);
        this.set(buff,fontSize);            
        scene.add.existing(this);
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
    }

    get buff(){return this._buff;}

    set(buff,fontSize)
    {
        //this.removeAll(true);
        this._buff = buff;
        this.name = buff.name;
        this.add(sprite(this.scene,{icon:buff.icon}),{aspectRatio:true, key:'icon'})
            .add(text_1(this.scene,{str:buff.val, fontSize:fontSize, color:'#000', stroke:'#000', strokeThickness:1}).setOrigin(0.5),
                    {key:'numL',align:'left-top',expand:false,offsetY:0,offsetX:0})
            .add(text_1(this.scene,{str:buff.dur, fontSize:fontSize, color:'#000', stroke:'#000', strokeThickness:1}).setOrigin(0.5),
                    {key:'numR',align:'right-bottom',expand:false,offsetY:0,offsetX:0})
        
        return this;
    }

    setBuff(buff)
    {
        this.getElement('numL').setText(buff.val==0?'':buff.val);
        this.getElement('numR').setText(buff.dur==-1?'':buff.dur);
        return this;
    }
}

// export class Buff extends OverlapSizer
// {
//     constructor(scene, w, h, {x=0, y=0, buff, fontSize=12, align='right-bottom'}={})
//     {
//         super(scene, x, y, w, h);
//         this.set(buff,fontSize,align);            
//         scene.add.existing(this);
//         this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
//     }

//     set(buff,fontSize,align)
//     {
//         //this.removeAll(true);
//         this.name = buff.name;
//         this.add(sprite(this.scene,{icon:buff.icon}),{aspectRatio:true, key:'icon'})
//             .add(text(this.scene,{str:buff.dur, fontSize:fontSize, color:'#000', stroke:'#000', strokeThickness:3}).setOrigin(0.5),
//                         {key:'num',align:align,expand:false,offsetY:0,offsetX:0})
        
//         return this;
//     }

//     setNum(num)
//     {
//         this.getElement('num').setText(num);
//         this.setVisible(num>0);
//         return this;
//     }
// }

export class ProgressBar extends Phaser.GameObjects.Container
{
    constructor(scene, x, y, width, height, {fontFamily='arial', barColor=0xff0000, borderColor=0x000000, border=1}={})
    {
        super(scene, x, y);
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.bg = scene.add.rectangle(0, 0, width, height, 0).setStrokeStyle(border, borderColor);
        this.bar = scene.add.rectangle(0, 0, width-border, height-border, barColor);
        this.text = scene.add.text(0, 0, '', {fontFamily:fontFamily ,fontSize:'18px',color:'#fff',stroke:'#000',strokeThickness:1}).setOrigin(0.5);
        this.w_bar = this.bar.width;
        this.add([this.bg,this.bar,this.text]);
        //scene.gameLayer.add(this);
        //this.setDepth(1000);
        this.visible = false;
    }

    setP(percent)
    {
        //console.log('percent:', percent);
        this.bar.width = this.w_bar * percent;
        return this;
    }

    set(value, max, delay=-1)
    {
        //console.log('value:', value, 'max:', max);
        max = max ?? this.max;
        this.bar.width = this.w_bar * value / max;
        this.text.setText(`${value}/${max}`);
        this.visible = true;
        if(delay>0)
        {
            this.delayedCall && this.scene.time.removeEvent(this.delayedCall);
            this.delayedCall = this.scene.time.delayedCall(delay, () => {this.visible = false;});
        }
        return this;
    }

    hide(delay=-1)
    {
        if(delay>0)
        {
            this.delayedCall && this.scene.time.removeEvent(this.delayedCall);
            this.delayedCall = this.scene.time.delayedCall(delay, () => {this.visible = false;});
        }
        else
        {
            this.visible = false;
        }
    }

    destroy()
    {
        this.delayedCall && this.scene.time.removeEvent(this.delayedCall);
        super.destroy();
    }
}

export class Flag extends Sizer
{
    constructor(scene,x,y,{fontSize=20}={})
    {
        super(scene,x,y,{orientation:'x',space:{item:0}});
        let oz = scene.rexUI.add.overlapSizer(0,0,fontSize,fontSize);
        oz.add(sprite(scene),{aspectRatio:true, key:'icon'})
        this.add(oz,{key:'oz'})
            .add(text_1(this.scene,{fontSize:fontSize}),{key:'num'})           
        scene.add.existing(this);
        this.hide();
        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
    }

    set(action, role)
    {
        if(!action) return;
        let [key,frame]=action.icon.split(':');
        this.getElement('icon',true).setTexture(key,frame);
        let num = action.id=='attack' ? role.damage : '';
        this.getElement('num').setText(num??'');
        this.show();
        this.layout();
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets:this,
                scale:{from:1, to:2},
                yoyo: true,
                duration:250,
                onComplete:()=>{resolve();},
            });
        });
    }

    // set(icon, num)
    // {
    //     let [key,frame]=icon.split('/');
    //     this.getElement('icon',true).setTexture(key,frame);
    //     this.getElement('num').setText(num??'');
    //     this.show();
    //     this.layout();
    //     return new Promise((resolve)=>{
    //         this.scene.tweens.add({
    //             targets:this,
    //             scale:{from:1, to:2},
    //             yoyo: true,
    //             duration:500,
    //             onComplete:()=>{resolve();},
    //         });
    //     });
    // }
}

export class BuffInfo extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,{orientation:'y',space:{item:5}});
        BuffInfo.instance = this;
        this._cx = scene.sys.canvas.width/2;
        this._cy = scene.sys.canvas.height/2;
        this.hide();
    }

    create_prepare(prepare,role)
    {
        let w=150, space=5;
        let sizer = this.scene.rexUI.add.sizer({width:w+2*space,space:space});
        this.add(sizer);

        sizer.addBackground(rect(this.scene,{radius:10}))
        let txt = text(this.scene,{wrapWidth:w});
        sizer.add(txt);
        let info = `[color=yellow]${prepare.id.local()}[/color] [img=icon]\n${prepare.prepare}`;
        info = info.replace('%dmg',role.role.damage);
        //info = info.replace('%val',prepare.val);
        txt.setText(info);
        let [key,frame]=prepare.icon.split(':');
        txt.addImage('icon', {
            key: key,
            frame: frame,
            width: 20,
            height: 20,
        })
        txt.updateText();
    }

    create(buff)
    {
        let w=150, space=5;
        let sizer = this.scene.rexUI.add.sizer({width:w+2*space,space:space});
        this.add(sizer);

        sizer.addBackground(rect(this.scene,{radius:10}))
        let txt = text(this.scene,{wrapWidth:w});
        sizer.add(txt);
        let info = `[color=yellow]${buff.name.local()}[/color] [img=icon]\n${buff.descript}`;
        info = info.replace('%val',buff.val);
        txt.setText(info);
        let [key,frame]=buff.icon.split('/');
        txt.addImage('icon', {
            key: key,
            frame: frame,
            width: 20,
            height: 20,
        })
        txt.updateText();
    }

    show(role,prepare,buffs)
    {
        if(role.x>this._cx)
        {
            this.setOrigin(1,0.5);
            this.setPosition(role.x-role.width/2,role.y);
        }
        else
        {
            this.setOrigin(0,0.5);
            this.setPosition(role.x+role.width/2,role.y);
        }
        super.show();
        this.removeAll(true);
        if(prepare){this.create_prepare(prepare,role);}
        buffs.forEach((buff)=>{this.create(buff)});
        this.layout();
    }

    static show(rect,repare,buffs)
    {
        if(BuffInfo.instance) {BuffInfo.instance.show(rect,repare,buffs);}
    }

    static hide()
    {
        if(BuffInfo.instance) {BuffInfo.instance.hide();}
    }
}

export class BuffBar extends FixWidthSizer
{
    constructor(scene, x, y, width)
    {
        super(scene, x, y, {width:width, orientation: 'x'});
        this.createInfo(scene);
        this.setOrigin(0.5,0);
    }

    createInfo(scene)
    {
        this._info = new BuffInfo(scene,-50,0)
        this._info.hide();
    }

    updateBuff(buff, apply)
    {
        let buf = this.getByName(buff.name);
        if(!buf && buff.icon)
        {
            buf = new Buff(this.scene, 30, 20, {buff:buff});
            this.add(buf);
            this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        }
        
        if(apply)
        {
            return new Promise((resolve)=>{
                this.scene.tweens.add({
                    targets: buf,
                    scale: 2,
                    yoyo: true,
                    duration: 250,
                    //completeDelay: 250,
                    onComplete: async() => { 
                        buf.setBuff(buff);
                        if(buff.dur==0) {buf.destroy();}
                        else {buf.setBuff(buff)}
                        this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
                        Utility.delay(250);
                        resolve();
                    }
                });
            })
        }
        else if(buff.dur==0)
        {
            return new Promise((resolve)=>{
                this.scene.tweens.add({
                    targets: buf,
                    alpha: 0,
                    duration: 250,
                    onComplete: () => { 
                        buf.destroy();
                        this.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
                        resolve();
                    }
                });
            })
        }
        else
        {
            buf.setBuff(buff);
        }


        //this._info.set();
    }

    showInfo()
    {
        console.log('showInfo');
        
        var items = this.getElement('items');
        console.log(items);

        this._info.show();
    }

    hideInfo()
    {
        console.log('hideInfo');
        this._info.hide();
    }

    hide(delay=-1)
    {
        if(delay>0)
        {
            this.delayedCall && this.scene.time.removeEvent(this.delayedCall);
            this.delayedCall = this.scene.time.delayedCall(delay, () => {this.visible = false;});
        }
        else
        {
            this.visible = false;
        }
    }

}

export class Mark
{
    constructor(scene)
    {
        //this._icons = {go:ICON_GO, talk:ICON_TALK, enter:ICON_ENTER, exit:ICON_EXIT, take:ICON_TAKE}
        this._sp = sprite(scene,{icon:ICON_MARK,name:'mark'})
        this._sp.setScale(0.5);
        this._sp.visible=false;
        //this._sp.setDisplaySize(32,32);
        this._sp.setDepth(Infinity);
    }

    set visible(value) {this._sp.visible = value;}

    show(p,color=0xffffff)
    {
        this.visible=true;
        this._sp.x=p.x;
        this._sp.y=p.y;
        this._sp.setTint(color);
    }

    hide()
    {
        this.visible=false;
    }

}