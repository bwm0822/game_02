import Com from './com.js'
import Utility from '../core/utility.js'
import {uBbc,uRect,uImage,Pic,uPanel} from '../ui/uicomponents.js'
import { GM } from '../core/setting.js'
import {T,dlog} from '../core/debug.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : disp
// 功能 :
//  負責顯示 傷害、對話...等
//--------------------------------------------------

export class COM_Disp extends Com
{
    get tag() {return 'disp';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _create(value, color='#fff', stroke='#000')
    {
        const text=`[stroke=${stroke}]${value}[/stroke]`;
        const t = uBbc(this.scene,{text:text,color:color,strokeThickness:5});
        this.ctx.root.add(t);
        t.setOrigin(0.5,0.5);
        t.setDepth(100);
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

    _popup(value, color='#fff', stroke='#000')
    {
        if(!this._queue){this._queue=[];}
        if(!this._promises) {this._promises=[];}
        this._queue.push({value:value,color:color,stroke:stroke});
        if(!this._busy) {this._show();}
    }

    _init()
    {
        const{root}=this.ctx;
        const config=
        {
            x:0,
            y:-48,
            orientation:'y',
            space:{item:5},
        }
        const p=uPanel.call(root, this.scene, config).setOrigin(0.5,1);
        p.add(this._createPop()).add(this._createSpeak());
        this._sz=p;
    }

    _createSpeak()
    {
        const p=uPanel(this.scene, {space:5});
        p.addBackground(uRect(this.scene,{color:GM.COLOR.WHITE,radius:10}))
            .add(uBbc(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
            .hide()
        this._spk=p;
        return p;
    }

    _createPop()
    {
        const p=uPanel(this.scene, {space:5});
        p.addBackground(uRect(this.scene,{color:GM.COLOR.BLACK,radius:10,alpha:0.25}))
            .add(uBbc(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
            .hide()
        this._p=p;
        return p;
    }

    _speak(words,{duration=1000}={})
    {
        const{root}=this.ctx;

        if(words)
        {
            this._spk.getElement('text').setText(words);
            this._spk.show();
            if(duration>0)
            {
                if (this._toSpk) {clearTimeout(this._toSpk);this._toSpk=null;}
                this._toSpk = setTimeout(()=>{this._spk?.hide();this._toSpk=null;this._sz.layout();}, duration);
            }
            else
            {
                if (this._toSpk) {clearTimeout(this._toSpk);this._toSpk=null;}
            }
        }
        else
        {
            if (this._toSpk) {clearTimeout(this._toSpk);this._toSpk=null;}
            this._spk.hide();
        }

        this._sz.layout();
    }

    _pop(icon, {duration=1000,tween=false}={})
    {
        if(tween)
        {
            this._p.tw = this.scene.tweens.add({
                targets: this._p,
                scale: 0.5,
                loop: -1,
                duration: 1000,
                yoyo:true,
                onStop: ()=>{this._p.setScale(1);}, 
            })
        }

        if(icon)
        {
            this._p.getElement('text').setText(icon);
            this._p.show();
            
            if(duration>0)
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
                this._to = setTimeout(()=>{this._p?.hide();this._to=null;this._sz.layout();}, duration);
            }
            else
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
            }
        }
        else
        {
            if (this._to) {clearTimeout(this._to);this._to=null;}
            this._p.hide();
            this._p.tw?.stop();
        }

        this._sz.layout();
    }

    // _pop(words, {duration=1000,tween=false}={})
    // {
    //     if(!this._p)
    //     {
    //         this._p = this.scene.rexUI.add.sizer(0,-48,{space:5});
    //         this._p.addBackground(uRect(this.scene,{color:GM.COLOR_WHITE,radius:10,strokeColor:0x0,strokeWidth:0}))
    //                     .add(uBbc(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
    //                     .setOrigin(0.5,1)
    //                     .setDepth(100)
    //         this.ctx.root.add(this._p);
    //     }

    //     if(tween)
    //     {
    //         this._p.tw = this.scene.tweens.add({
    //             targets: this._p,
    //             scale: 0.5,
    //             loop: -1,
    //             duration: 1000,
    //             yoyo:true,
    //             onStop: ()=>{this._p.setScale(1);}, 
    //         })
    //     }

    //     console.trace();
    //     const{bb}=this.ctx;
    //     dlog(T.NPC,bb.id)('pop=',words);

    //     if(words)
    //     {
    //         this._p.getElement('text').setText(words);
    //         this._p.show();
    //         this._p.layout();
    //         if(duration>0)
    //         {
    //             if (this._to) {clearTimeout(this._to);this._to=null;}
    //             this._to = setTimeout(()=>{this._p?.hide();this._to=null;}, duration);
    //         }
    //         else
    //         {
    //             if (this._to) {clearTimeout(this._to);this._to=null;}
    //         }
    //     }
    //     else
    //     {
    //         if (this._to) {clearTimeout(this._to);this._to=null;}
    //         this._p.hide();
    //         this._p.tw?.stop();
    //     }
    // }

    // 等待所有彈出完成，才繼續下一步
    async _waitAll() 
    {
        if (!this._promises || 
            this._promises.length === 0 && !this._currentWait) 
        {
            return;
        }

        // 如果已經有人在 wait 了，就直接 await 那個正在進行的 process
        if (this._currentWait) {return await this._currentWait;}

        // 建立一個新的等待程序並存起來，確保同一時間只有一個等待程序在運行
        this._currentWait = (async () => {
            try 
            {
                while (this._promises.length > 0) 
                {
                    const currentBatch = [...this._promises];
                    this._promises = [];
                    await Promise.all(currentBatch);
                }
            } 
            finally 
            {
                this._currentWait = null; // 確保發生錯誤也會清空，避免鎖死
            }
        })();

        return await this._currentWait;
    }


    async _skill(skill)
    {
        // const sp = uImage(this.scene,{icon:skill.icon});
        const sp = new Pic(this.scene,30,30,{icon:skill.icon});
        this.ctx.root.add(sp);
        sp.setOrigin(0.5,0.5);
        sp.setDepth(100);
        
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: sp,
                y: {from:-32, to:-32},
                scale:{from:1, to:2},
                duration: 500,
                ease: 'linear',
                onStart: ()=>{},
                onComplete: (tween, targets, gameObject)=>{sp.destroy();resolve()}         
            });
        });
    }

    _underAtk(id)
    {
        this._speak('找死!!!')
    }

    _stolen(id)
    {
        this._speak('有小偷!!!')
    }

    _ondead()
    {
        this._queue = [];
        this._busy = false;
        this._speak(null);
        this._pop(null);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        this._init();

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.popup = this._popup.bind(this);
        root.pop = this._pop.bind(this);
        root.speak = this._speak.bind(this);
        root.wait = this._waitAll.bind(this);
        root.skill = this._skill.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.UNDERATK, this._underAtk.bind(this));
        root.on(GM.EVT.STOLEN, this._stolen.bind(this));
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

    
}