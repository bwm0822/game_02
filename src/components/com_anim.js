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

    // phase: 'raise' 舉到目標方向-arc/2、'strike' 砍過 arc、null 收回原角度；以 grip 為支點旋轉
    _swing(pt, phase=null)
    {
        const {root} = this.ctx;
        const swinger = root.view?.swinger;
        if(!swinger) {return Promise.resolve(false);}
        const {sp, aim, grip, arc} = swinger;
        swinger.base ??= {x:sp.x, y:sp.y, angle:sp.angle};
        const base = swinger.base;
        this._twSwing?.stop();

        let [to, duration, ease] = [base.angle, 150, 'quad.out'];
        if(phase)
        {
            const sign = Math.sign(root.view.shape.scaleX) || 1;
            const deg = Phaser.Math.RadToDeg(Math.atan2(pt.y-root.pos.y, (pt.x-root.pos.x)*sign));
            const start = sp.angle + Phaser.Math.Angle.ShortestBetween(sp.angle, deg - aim - arc/2);
            if(phase==='raise') {[to, duration, ease] = [start, 80, 'quad.out'];}
            else {[to, duration, ease] = [start + arc, 100, 'cubic.in'];}
        }

        const ox = (grip.x - sp.width*sp.originX) * sp.scaleX;
        const oy = (grip.y - sp.height*sp.originY) * sp.scaleY;
        const rot = (angle)=>{
            const r = Phaser.Math.DegToRad(angle);
            return [ox*Math.cos(r) - oy*Math.sin(r), ox*Math.sin(r) + oy*Math.cos(r)];
        };
        const [gx, gy] = rot(base.angle);
        const [cx, cy] = [base.x + gx, base.y + gy];
        const place = (angle)=>{
            const [dx, dy] = rot(angle);
            sp.setAngle(angle).setPosition(cx - dx, cy - dy);
        };

        if(this._dead) {place(base.angle); swinger.base = null; return Promise.resolve(false);}

        const proxy = {angle:sp.angle};
        return new Promise((resolve)=>{
            const tw = this.scene.tweens.add({
                targets: proxy,
                angle: to,
                duration: duration,
                ease: ease,
                onUpdate: ()=>place(proxy.angle),
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
    }

}