
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
        const { bb, sense, role } = ctx;
        const t = bb.target ?? sense.findNearestEnemy();
        if (!t) return [0, 'no target'];
        if (!sense.canSee(t)) return [0.1, 'target unseen']; // 很低分：可以先追
        const dist = sense.distTo(t);
        const inRange = sense.inAttackRange(t);
        if (!role.canAttack()) return [0, 'cant attack'];
        let base = inRange ? 0.8 : 0.4;
        // 目標血量越低，優先度越高（收頭）
        base += (1 - t.hpRatio) * 0.3;
        // 自身血量越低，降低攻擊傾向
        base -= (1 - role.hpRatio) * 0.4;
        // 冷卻扣分
        if (this._isOnCooldown(ctx)) base *= 0.2;
        return [Math.max(0, base * this.weight), `dist=${dist.toFixed(1)} inRange=${inRange}`];
    }

    async act(ctx) 
    {
        const { bb, action, sense } = ctx;
        const t = bb.target ?? sense.findNearestEnemy();
        if (!t) return { ok:false, note:'no target' };
        if (sense.inAttackRange(t)) 
        {
            const ok = await action.attack(t);
            if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            return { ok:false, note:'attack failed' };
        } 
        else 
        {
            const ok = await action.moveToward(t, { maxSteps: 1 });
            return { ok, note:'chase' };
        }
    }
}

export class BehChase extends Behavior 
{
    constructor(opts={}) { super('CHASE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        const { bb, sense } = ctx;
        const t = bb.target ?? sense.sensePlayer();
        if (!t) {return [0, 'no target'];}
        if (!sense.canSee(t)) {return [0.1, 'target unseen'];} // 很低分：可以先追
        let base = 1;
        return [Math.max(0, base * this.weight), `none`];
    }

    async act(ctx) 
    {
        const { bb, action, sense } = ctx;
        const t = bb.target ?? sense.sensePlayer();
        if (!t) return { ok:false, note:'no target' };
        const ok = await action.moveToward(t, { maxSteps: 2 });
        return { ok, note:'chase' };
        
    }
}