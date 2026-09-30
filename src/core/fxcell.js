import {Pic} from '../ui/uicomponents.js'

//--------------------------------------------------
// 類別 : 單格特效動畫
// 功能 :
//  anim = {cell, spawn, idle, tick, end}，spawn/idle/tick/end 是 Phaser tween 設定(另支援 idle.randDelay)
//  holder(container) 包一個 Pic：cell 的隨機大小/翻轉/alpha 設在 Pic 上，tween 只動 holder，兩者才不會互相覆蓋
//  originY=1 時 Pic 底部對齊 holder 原點，holder 縮放會以底部為支點
//  parent=null 時 holder 直接放在 scene 上(x,y 為世界座標)，可以自己設 depth
//--------------------------------------------------

const rand = (v)=>Array.isArray(v) ? Phaser.Math.FloatBetween(v[0],v[1]) : v;

export default class FxCell
{
    constructor(scene, parent, img, anim={}, {x=0, y=0, size:defSize=32, originY=0.5}={})
    {
        this.scene = scene;
        this.anim = anim ?? {};
        this.idle = null;
        this.ticking = false;

        const {size=defSize, scale=1, alpha=1, flipX=false} = this.anim.cell ?? {};
        const pic = new Pic(scene, size, size, {icon:img});
        pic.setOrigin(0.5, originY).layout();
        const s = rand(scale);
        const flip = (flipX==='random' ? Math.random()<0.5 : flipX) ? -1 : 1;
        pic.setScale(s*flip, s).setAlpha(alpha);

        this.holder = scene.add.container(x, y, [pic]);
        parent?.add(this.holder);
        if(this.anim.spawn) {this.holder.setVisible(false);}
    }

    _tween(cfg, extra={})
    {
        return new Promise(resolve=>{
            this.scene.tweens.add({...cfg, ...extra, targets:this.holder, onComplete:resolve});
        });
    }

    startIdle()
    {
        this.holder.setVisible(true);
        const cfg = this.anim.idle;
        if(!cfg || this.idle) {return;}
        const {randDelay=0, ...tw} = cfg;
        this.idle = this.scene.tweens.add({...tw, targets:this.holder, delay:Math.random()*randDelay});
    }

    spawn(delay=0)
    {
        const cfg = this.anim.spawn;
        if(!cfg) {this.startIdle(); return Promise.resolve();}
        const {stagger, from, ...tw} = cfg;
        return this._tween(tw, {delay, onStart:()=>this.holder.setVisible(true)})
                    .then(()=>this.startIdle());
    }

    // idle 跟 tick 通常都動 scale，tick 期間先暫停 idle 避免互相搶值
    tick()
    {
        const cfg = this.anim.tick;
        if(!cfg || this.ticking) {return;}
        this.ticking = true;
        this.idle?.pause();
        this._tween(cfg).then(()=>{
            this.ticking = false;
            this.idle?.resume();
        });
    }

    // 先砍掉 spawn/idle/tick 所有進行中的 tween，end 才不會跟它們搶 scale/alpha
    end()
    {
        this.scene.tweens.killTweensOf(this.holder);
        this.idle = null;
        const cfg = this.anim.end;
        if(!cfg) {return Promise.resolve();}
        return this._tween(cfg);
    }

    destroy()
    {
        this.scene?.tweens.killTweensOf(this.holder);
        this.holder.destroy();
    }
}
