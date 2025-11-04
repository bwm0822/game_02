import Com from './com.js'
import Utility from '../utility.js'
import {text, rect} from '../uibase.js'
import { GM } from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : disp
// 功能 :
//  負責顯示 傷害、對話...等
//--------------------------------------------------

export class Disp extends Com
{

    get tag() {return 'disp';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get ent() {return this._root.ent;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _create(value, color='#fff', stroke='#000')
    {
        let t = text(this.scene,{text:value,color:color,stroke:stroke,strokeThickness:5});
        this.ent.add(t);
        t.setOrigin(0.5,0.5);
        t.setDepth(100);
        // t.setText(value).setTint(color);
        let x = Phaser.Math.Between(10, -10);
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                    targets: t,
                    x: {from:x, to:x},
                    y: {from:-48, to:-64},
                    duration: 300,
                    ease: 'linear',
                    onStart: ()=>{},
                    onComplete: (tween, targets, gameObject)=>{t.destroy();resolve()}         
                });
        });
    }

    async _show()
    {
        this._busy = true;
        let m = this._queue.shift();
        this._promises.push(this._create(m.value,m.color,m.stroke));
        await Utility.delay(100);
        if (this._queue.length === 0) 
        {
            this._busy = false;
        }
        else
        {
            this._busy = true;
            this._show();
        }
    }

    _text(value, color='#fff', stroke='#000')
    {
        if(!this._queue){this._queue=[];}
        if(!this._promises) {this._promises=[];}
        this._queue.push({value:value,color:color,stroke:stroke});
        if(!this._busy) {this._show();}
    }

    _speak(words, {duration=1000,tween=false}={})
    {
        console.log('speak',words)
        if(!this._spk)
        {
            this._spk = this.scene.rexUI.add.sizer(0,-48,{space:5});
            this._spk.addBackground(rect(this.scene,{color:GM.COLOR_WHITE,radius:10,strokeColor:0x0,strokeWidth:0}))
                        .add(text(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
                        .setOrigin(0.5,1)
                        .setDepth(100)
            this.ent.add(this._spk);
            // this.ent.sort('depth')
        }

        if(tween)
        {
            this._spk.tw = this.scene.tweens.add({
                targets: this._spk,
                scale: 0.5,
                loop: -1,
                duration: 1000,
                yoyo:true,
                onStop: ()=>{this._spk.setScale(1);}, 
            })
        }

        if(words)
        {
            this._spk.getElement('text').setText(words);
            this._spk.show();
            this._spk.layout();
            if(duration>0)
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
                this._to = setTimeout(()=>{this._spk?.hide();this._to=null;}, duration);
            }
            else
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
            }
        }
        else
        {
            if (this._to) {clearTimeout(this._to);this._to=null;}
            this._spk.hide();
            this._spk.tw?.stop();
        }

    }



    // 等待 所有 disp 都結束
    async wait()
    {
        if(!this._promises || this._promises.length===0) {return;}
        await Promise.all(this._promises);    
        this._queue=[]; 
        this._promises=[];
    }

    async skill(skill)
    {
        let sp = sprite(this._role.scene,{icon:skill.dat.icon});
        this.ent.add(sp);
        sp.setOrigin(0.5,0.5);
        sp.setDepth(100);
        
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: sp,
                y: {from:-32, to:-64},
                scale:{from:1, to:2},
                duration: 300,
                ease: 'linear',
                onStart: ()=>{},
                onComplete: (tween, targets, gameObject)=>{sp.destroy();resolve()}         
            });
        });

    }

    

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        // 在上層綁定操作介面，提供給其他元件使用
        // 註冊 event
        root.on('text', this._text.bind(this));
        root.on('speak', this._speak.bind(this));
    }

    
}