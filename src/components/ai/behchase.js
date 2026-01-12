import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：追逐目標 ---

export class BehChase extends Behavior 
{
    constructor(opts={}) { super('CHASE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮
        
        if (this._isOnCooldown(ctx)) 
        {
            return [0, `cooldown`];
        }
        else
        {
            const { bb, root } = ctx;
            const t = bb.target ?? root.sensePlayer?.();

            if (!t) {return [0, 'no target'];}
            if (!root.canSee?.(t)) {return [0.1, 'target unseen'];} // 很低分：可以先追
            let base = 1;
            return [Math.max(0, base * this.weight), `none`];
        }
    }

    async act(ctx) 
    {
        const { bb, emit, root } = ctx;a
        const t = bb.target ?? root.sensePlayer?.();
        if (!t) {return { ok:false, note:'no target' };}

        this._commitUse(ctx); 
        const ok = await root.moveToward?.(t, { maxSteps: 2 });
        return { ok, note:'chase' };
        
    }
}