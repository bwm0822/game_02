import Com from './com.js'
import Utility from '../core/utility.js'
import {uBbc,uRect} from '../ui/uicomponents.js'
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

    _pop(words, {duration=1000,tween=false}={})
    {
        if(!this._p)
        {
            this._p = this.scene.rexUI.add.sizer(0,-48,{space:5});
            this._p.addBackground(uRect(this.scene,{color:GM.COLOR_WHITE,radius:10,strokeColor:0x0,strokeWidth:0}))
                        .add(uBbc(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
                        .setOrigin(0.5,1)
                        .setDepth(100)
            this.ctx.root.add(this._p);
        }

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

        if(words)
        {
            this._p.getElement('text').setText(words);
            this._p.show();
            this._p.layout();
            if(duration>0)
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
                this._to = setTimeout(()=>{this._p?.hide();this._to=null;}, duration);
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
    }

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


    async skill(skill)
    {
        const sp = sprite(this._role.scene,{icon:skill.dat.icon});
        this.ctx.root.add(sp);
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

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.popup = this._popup.bind(this);
        root.pop = this._pop.bind(this);
        root.wait = this._waitAll.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
    }

    
}