import Com from './com.js'
import {GM} from '../core/setting.js'
import DB from '../data/db.js'
import {dirTo, animTrack, poseAt, trackEnd} from '../core/pose.js'
const _tag = 'anim';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : anim
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view 元件
//--------------------------------------------------

export class COM_Anim extends Com
{
    get tag() {return _tag;}  // 回傳元件的標籤
    get scene() {return this._root.scene;}


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _idle(on)
    {
        const {root} = this.ctx;
        const view = root.view;
        if(!view) {return;}   // 判斷 this.view ，以避免在地圖上出錯
        if(on)
        {
            if(!this._twIdle)
            {
                this._twIdle = this.scene.tweens.add({
                        targets: view.shape,
                        scaleY: {from:1, to:1.05},
                        ease: 'sine.inOut',
                        duration: 600,
                        yoyo: true,
                        loop: -1,
                    });
            }
        }
        else
        {
            if(this._twIdle) {this._twIdle.stop(); this._twIdle=null;}
        }
    }

    _walk(duration)
    {
        const {root} = this.ctx;
        const view = root.view;
        this.scene.tweens.add({
            targets: view.shape,
            angle: {from: -10, to: 10},
            ease: 'sine.inOut',
            duration: duration,
            yoyo: true,
            onComplete: () => { view.shape.angle = 0; },
        });
    }

    // 同一個 shape 的位移表演(前撲/後座/擊退)共用一個 tween 槽：新的蓋掉舊的，
    // _base 只在沒有位移進行中時記錄，避免從偏移中的位置當成原位而累積漂移
    _offset(dx, dy, {duration, ease})
    {
        const shape = this.ctx.root.view?.shape;
        if(!shape) {return Promise.resolve();}
        if(!this._twPos) {this._base = {x:shape.x, y:shape.y};}
        this._twPos?.stop();
        if(dx!==0 || dy!==0) {shape.setPosition(this._base.x, this._base.y);}
        return new Promise((resolve)=>{
            const tw = this.scene.tweens.add({
                targets: shape,
                x: this._base.x + dx,
                y: this._base.y + dy,
                duration: duration,
                ease: ease,
                onComplete: ()=>{
                    if(dx===0 && dy===0 && this._twPos===tw) {this._twPos=null;}
                    resolve(true);
                },
                onStop: ()=>resolve(false),   // 被新的位移蓋掉，呼叫端不該再接 _rest，不然會把新的也停掉
            });
            this._twPos = tw;
        });
    }

    _lunge(pt, dist, {duration=100, ease='cubic.in'}={})
    {
        const {root} = this.ctx;
        const ang = Math.atan2(pt.y-root.pos.y, pt.x-root.pos.x);
        return this._offset(Math.cos(ang)*dist, Math.sin(ang)*dist, {duration, ease});
    }

    _rest({duration=150, ease='quad.out'}={})
    {
        if(!this._twPos) {return Promise.resolve();}
        return this._offset(0, 0, {duration, ease});
    }

    _flash(duration=80)
    {
        const shape = this.ctx.root.view?.shape;
        if(!shape) {return;}
        const sps = shape.list ?? [shape];
        sps.forEach(sp=>sp.setTintFill?.(0xffffff));
        this._twFlash?.remove();
        this._twFlash = this.scene.time.delayedCall(duration, ()=>{
            sps.forEach(sp=>sp.clearTint?.());
            this._twFlash = null;
        });
    }

    async _hit(attacker)
    {
        if(this._dead) {return;}
        this._flash();
        if(!attacker) {return;}
        const {root} = this.ctx;
        const [p, a] = [root.pos, attacker.pos];
        if(p.x===a.x && p.y===a.y) {return;}
        const pt = {x:p.x*2-a.x, y:p.y*2-a.y};
        if(await this._lunge(pt, 6, {duration:60, ease:'quad.out'}))
        {
            await this._rest({duration:120, ease:'quad.inOut'});
        }
    }

    _dirTo(pt)
    {
        const {root} = this.ctx;
        return dirTo(pt.x-root.pos.x, pt.y-root.pos.y, Math.sign(root.view.shape.scaleX) || 1);
    }

    _place(sp, {x, y, angle}) {sp.setAngle(angle).setPosition(x, y);}

    // 時間軸 from→to(ms) 線性推進，緩動在 poseAt 裡算；被 _stop 打斷回傳 false
    _seg(run, from, to)
    {
        if(to<=from) {return Promise.resolve(this._run===run);}
        const proxy = {ms:from};
        return new Promise((resolve)=>{
            run.tw = this.scene.tweens.add({
                targets: proxy,
                ms: to,
                duration: to - from,
                onUpdate: ()=>this._place(run.sp, poseAt(run.track, proxy.ms)),
                onComplete: ()=>resolve(this._run===run),
                onStop: ()=>resolve(false),
            });
        });
    }

    _stop()
    {
        const run = this._run;
        this._run = null;
        run?.tw?.stop();
        run?.release();
    }

    // 播 anim.json 的武器動畫(見 core/pose.js)；播到 ready 標記先等 ready()(身體位移)做完，
    // 回傳的 Promise 在 hit 標記 resolve(true＝有播)；之後自動播完收回，hold 動畫停在最後一格等 _end()
    _play(id, pt=null, {ready}={})
    {
        const sp = this.ctx.root.view?.weapon;
        const anim = DB.anim(id);
        if(!sp || !anim || this._dead) {return (async()=>{await ready?.(); return false;})();}

        this._stop();
        if(this._wpRest?.sp!==sp) {this._wpRest = {sp, x:sp.x, y:sp.y, angle:sp.angle};}
        const track = animTrack(anim, {x:sp.x, y:sp.y, angle:sp.angle}, this._wpRest, pt ? this._dirTo(pt) : 0);
        const run = {sp, track};
        const free = new Promise((resolve)=>{run.release = resolve;});
        this._run = run;

        const [readyAt, hitAt, end] = [anim.ready ?? 0, anim.hit ?? track.end, track.end];
        return new Promise((resolve)=>{
            (async()=>{
                if(!await this._seg(run, 0, readyAt)) {return resolve(false);}
                await ready?.();
                if(this._run!==run || !await this._seg(run, readyAt, hitAt)) {return resolve(false);}
                resolve(true);
                if(!await this._seg(run, hitAt, end)) {return;}
                if(anim.hold) {await free;}
                if(this._run===run && await this._seg(run, end, trackEnd(track))) {this._run = null; this._wpRest = null;}
            })();
        });
    }

    _end() {this._run?.release();}

    _ondead()
    {
        this._idle(false);
        this._dead = true;
        this._stop();
        const rest = this._wpRest;
        if(rest?.sp.active) {this._place(rest.sp, rest);}
        this._wpRest = null;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.anim_idle = this._idle.bind(this);
        root.anim_walk = this._walk.bind(this);
        root.anim_lunge = this._lunge.bind(this);
        root.anim_rest = this._rest.bind(this);
        root.anim_hit = this._hit.bind(this);
        root.anim_play = this._play.bind(this);
        root.anim_end = this._end.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
        root.on(GM.EVT.ONREVIVE, ()=>{this._dead = false;});
    }

}