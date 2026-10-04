import Com from './com.js'
import {GM} from '../core/setting.js'
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

    // pt 為 null 表示還原；以圖片中心為支點旋轉(origin 是底部中心，所以要同步補償 x/y)
    _aim(pt, {duration=60, ease='quad.out'}={})
    {
        const {root} = this.ctx;
        const aimer = root.view?.aimer;
        if(!aimer) {return Promise.resolve(false);}
        const sp = aimer.sp;
        aimer.base ??= {x:sp.x, y:sp.y, angle:sp.angle};
        const base = aimer.base;
        this._twAim?.stop();

        let to = base.angle;
        if(pt)
        {
            const sign = Math.sign(root.view.shape.scaleX) || 1;
            const deg = Phaser.Math.RadToDeg(Math.atan2(pt.y-root.pos.y, (pt.x-root.pos.x)*sign));
            to = sp.angle + Phaser.Math.Angle.ShortestBetween(sp.angle, deg - aimer.aim);
        }

        const h = sp.displayHeight/2;
        const r0 = Phaser.Math.DegToRad(base.angle);
        const [cx, cy] = [base.x + Math.sin(r0)*h, base.y - Math.cos(r0)*h];
        const place = (angle)=>{
            const r = Phaser.Math.DegToRad(angle);
            sp.setAngle(angle).setPosition(cx - Math.sin(r)*h, cy + Math.cos(r)*h);
        };

        const proxy = {angle:sp.angle};
        return new Promise((resolve)=>{
            const tw = this.scene.tweens.add({
                targets: proxy,
                angle: to,
                duration: duration,
                ease: ease,
                onUpdate: ()=>place(proxy.angle),
                onComplete: ()=>{
                    if(!pt && this._twAim===tw) {this._twAim=null; aimer.base=null;}
                    resolve(true);
                },
                onStop: ()=>resolve(false),
            });
            this._twAim = tw;
        });
    }

    // phase: 'raise' 握把上提、劍繞握把往後轉；'strike' 手臂(軸心→握把)繞軸心往前砍，劍同時甩到跟手臂一直線；null 收回原狀
    // 'sweepRaise' 手臂(角色中心→握把)跟劍連成一直線，轉到 pt 方向 -90°；'sweep' 從那裡順時針掃 180°
    // 都是 shape 本地座標(面向右)，面向左時 shape 已鏡像；raise/strike 姿勢固定，不看目標方向
    _swing(phase=null, pt=null)
    {
        const SWING = {LIFT:12, RAISE:-90, ARM:6, CHOP:120, SWEEP:180, SWEEP_ARM:14};
        const {root} = this.ctx;
        const swinger = root.view?.swinger;
        if(!swinger) {return Promise.resolve(false);}
        const {sp, aim, grip} = swinger;
        this._twSwing?.stop();

        const ox = (grip.x - sp.width*sp.originX) * sp.scaleX;
        const oy = (grip.y - sp.height*sp.originY) * sp.scaleY;
        const rot = (angle)=>{
            const r = Phaser.Math.DegToRad(angle);
            return [ox*Math.cos(r) - oy*Math.sin(r), ox*Math.sin(r) + oy*Math.cos(r)];
        };
        const gripAt = ()=>{const [dx, dy] = rot(sp.angle); return {x:sp.x+dx, y:sp.y+dy};};
        const place = (g, angle)=>{
            const [dx, dy] = rot(angle);
            sp.setAngle(angle).setPosition(g.x - dx, g.y - dy);
        };

        swinger.base ??= {g:gripAt(), angle:sp.angle};
        const base = swinger.base;
        if(this._dead) {place(base.g, base.angle); swinger.base = null; return Promise.resolve(false);}

        const lerp = Phaser.Math.Linear;
        const lerpG = (from, to, t)=>({x:lerp(from.x, to.x, t), y:lerp(from.y, to.y, t)});
        const [g0, a0] = [gripAt(), sp.angle];
        let pose, duration, ease;
        if(phase==='raise')
        {
            const g1 = {x:base.g.x, y:base.g.y - SWING.LIFT};
            const a1 = a0 + Phaser.Math.Angle.ShortestBetween(a0, base.angle + SWING.RAISE);
            pose = (t)=>[lerpG(g0, g1, t), lerp(a0, a1, t)];
            [duration, ease] = [120, 'quad.out'];
        }
        else if(phase==='strike')
        {
            const p = {x:base.g.x, y:base.g.y - SWING.LIFT + SWING.ARM};
            const end = -90 + SWING.CHOP;
            const a1 = a0 + ((((end - aim) - a0) % 360) + 360) % 360;   // 劍順時針甩到跟手臂一直線
            pose = (t)=>{
                const r = Phaser.Math.DegToRad(-90 + SWING.CHOP*t);
                return [{x:p.x + Math.cos(r)*SWING.ARM, y:p.y + Math.sin(r)*SWING.ARM}, lerp(a0, a1, t)];
            };
            [duration, ease] = [80, 'cubic.in'];
        }
        else if(phase==='sweepRaise' || phase==='sweep')
        {
            const sign = Math.sign(root.view.shape.scaleX) || 1;
            const dir = Phaser.Math.RadToDeg(Math.atan2(pt.y-root.pos.y, (pt.x-root.pos.x)*sign));
            const from = dir - SWING.SWEEP/2;
            const arm = (deg)=>{
                const r = Phaser.Math.DegToRad(deg);
                return {x:Math.cos(r)*SWING.SWEEP_ARM, y:Math.sin(r)*SWING.SWEEP_ARM};
            };
            if(phase==='sweepRaise')
            {
                const a1 = a0 + Phaser.Math.Angle.ShortestBetween(a0, from - aim);
                pose = (t)=>[lerpG(g0, arm(from), t), lerp(a0, a1, t)];
                [duration, ease] = [120, 'quad.out'];
            }
            else
            {
                pose = (t)=>[arm(from + SWING.SWEEP*t), a0 + SWING.SWEEP*t];
                [duration, ease] = [300, 'cubic.in'];
            }
        }
        else
        {
            const a1 = a0 + Phaser.Math.Angle.ShortestBetween(a0, base.angle);
            pose = (t)=>[lerpG(g0, base.g, t), lerp(a0, a1, t)];
            [duration, ease] = [150, 'quad.out'];
        }

        const proxy = {t:0};
        return new Promise((resolve)=>{
            const tw = this.scene.tweens.add({
                targets: proxy,
                t: 1,
                duration: duration,
                ease: ease,
                onUpdate: ()=>place(...pose(proxy.t)),
                onComplete: ()=>{
                    if(!phase && this._twSwing===tw) {this._twSwing=null; swinger.base=null;}
                    resolve(true);
                },
                onStop: ()=>resolve(false),
            });
            this._twSwing = tw;
        });
    }

    _ondead()
    {
        this._idle(false);
        this._dead = true;
        this._swing(null);
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
        root.anim_aim = this._aim.bind(this);
        root.anim_swing = this._swing.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
        root.on(GM.EVT.ONREVIVE, ()=>{this._dead = false;});
    }

}