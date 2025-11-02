import {GM} from '../../setting.js'

// --- 行為介面 ---
class Behavior 
{
    constructor(name, opts={}) 
    {
        this.name = name;
        this.coolKey = opts.coolKey ?? name;
        this.minInterval = opts.minInterval ?? 0;   // 最小間隔時間
        this.lastUsedTick = -1;
        this.weight = opts.weight ?? 1.0;   // 基礎權重（可用於傾向）
        this.debug = !!opts.debug;  // !! 作用是把任何值強制轉成布林值，相當於 Boolean()
    }

    // 回傳 [score, reason]；0 代表不考慮
    score(ctx) { return [0, 'abstract']; }

    // 回傳 { ok:boolean, usedTick?:number, note?:string }
    async act(ctx) { return { ok:false, note:'abstract' }; }

    // 工具：冷卻與間隔
    _isOnCooldown(ctx) 
    {
        if (this.minInterval > 0 && ctx.tick - this.lastUsedTick < this.minInterval) return true;
        return !ctx.cd.ready(this.coolKey, 0);
    }
    _commitUse(ctx) 
    {
        this.lastUsedTick = ctx.tick;
        // 若你想把 minInterval 寫進 Cooldown，可用：ctx.cd.set(this.coolKey, this.minInterval);
    }
}

// --- 具體行為：攻擊（近戰/遠程） ---
export class BehAttack extends Behavior 
{
    constructor(opts={}) { super('ATTACK', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        const {bb, emit} = ctx;
        const t = bb.target ?? emit('sensePlayer');
        if (!t) { return [0, 'no target']; }
        if (!emit('canSee',t)) { return [0.1, 'target unseen']; } // 很低分：可以先追
        let base = 1;
        return [Math.max(0, base * this.weight), 'none'];
    }

    async act(ctx) 
    {
        const {bb, emit, aEmit, sta} = ctx;
        const t = bb.target ?? emit('sensePlayer');
        if (!t)
        {
            sta(GM.ST_IDLE);
            return { ok:false, note:'no target' };
        }

        if (emit('inAttackRange',t)) 
        {
            sta(GM.ST_ATTACK);
            const ok = await aEmit('attack',t);
            if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            else {return { ok:false, note:'attack failed' };}
        } 
        else
        {
            sta(GM.ST_MOVING);
            emit('findPath', t.pos)
            if(emit('checkPath')===false) {emit('findPath', t.pos);}
            const ok = await aEmit('move');
            return { ok:true, note:'chase' };
        }
        // else 
        // {
        //     sta(GM.ST_MOVING);
        //     const ok = await aEmit('moveToward',t, { maxSteps: 1 });
        //     return { ok, note:'chase' };
        // }
    }
}

export class BehChase extends Behavior 
{
    constructor(opts={}) { super('CHASE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        if (this._isOnCooldown(ctx)) 
        {
            return [0, `cooldown`];
        }
        else
        {
            const { bb, emit } = ctx;
            const t = bb.target ?? emit('sensePlayer');

            if (!t) {return [0, 'no target'];}
            if (!emit('canSee',t)) {return [0.1, 'target unseen'];} // 很低分：可以先追
            let base = 1;
            return [Math.max(0, base * this.weight), `none`];
        }
    }

    async act(ctx) 
    {
        const { bb, emit, aEmit } = ctx;a
        const t = bb.target ?? emit('sensePlayer');
        if (!t) {return { ok:false, note:'no target' };}

        this._commitUse(ctx); 
        const ok = await aEmit('moveToward',t, { maxSteps: 2 });
        return { ok, note:'chase' };
        
    }
}


export class BehTest extends Behavior 
{
    constructor(opts={}) { super('TEST', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        if (this._isOnCooldown(ctx)) 
        {
            return [0, `cooldown`];
        }
        else
        {
            const { bb, emit } = ctx;
            bb.target = emit('sensePlayer');

            if (!bb.target) {return [0, 'no target'];}
            let base = 1;
            return [Math.max(0, base * this.weight), `none`];
        }
    }

    async act(ctx) 
    {
        const { bb, emit, aEmit, sta } = ctx;

        sta(GM.ST_MOVING);
        if(!bb.path) 
        {
            console.log('------ findPath')
            emit('findPath', bb.target.pos??bb.target);
        }
        const ep = bb.path.ep
        let ret = await aEmit('move');
        if(ret[0]===false) 
        {
            console.log('------ rePath')
            emit('findPath', ep);
            await aEmit('move');
        }

        this._commitUse(ctx); 
        // const ok = await aEmit('move');
        return { ok:true, note:'chase' };
        
    }
}