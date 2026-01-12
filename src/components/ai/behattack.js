import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：攻擊（近戰/遠程） ---

export class BehAttack extends Behavior 
{
    constructor(opts={}) { super('ATTACK', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮

        const {bb, emit, root} = ctx;
        const t = bb.target ?? root.sensePlayer?.();
        if (!t) { return [0, 'no target']; }
        if (!root.canSee?.(t)) { return [0.1, 'target unseen']; } // 很低分：可以先追
        let base = 1;

        return [Math.max(0, base * this.weight), 'none'];
    }

    async act(ctx) 
    {
        const {bb, emit, sta, root} = ctx;
        const t = bb.target ?? root.sensePlayer?.();
        if (!t)
        {
            sta(GM.ST_IDLE);
            return { ok:false, note:'no target' };
        }

        if (root.inAttackRange?.(t)) 
        {
            sta(GM.ST_ATTACK);
            const ok = await root.attack?.(t);
            if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            else {return { ok:false, note:'attack failed' };}
        } 
        else
        {
            sta(GM.ST_MOVING);
            root.findPath?.(t.pos)
            if(root.checkPath?.()===false) {root.findPath(t.pos);}
            const ok = await root.move?.();
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