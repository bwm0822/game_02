import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'
import {T,dlog} from '../../core/debug.js'

// --- 具體行為：測試用行為 ---

export class BehTest extends Behavior 
{
    constructor(opts={}) { super('TEST', { minInterval: opts.minInterval ?? 1, ...opts }); }

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
            bb.target = root.sensePlayer?.();

            if (!bb.target) {return [0, 'no target'];}
            let base = 1;
            return [Math.max(0, base * this.weight), `none`];
        }
    }

    async act(ctx) 
    {
        const { bb, root } = ctx;

        if(!bb.path)
        {
            dlog(T.AI,bb.id)('------ findPath')
            root.findPath?.({ent:bb.target});
        }
        const ep = bb.path.ep
        let ret = await root.move?.();
        if(ret===false)
        {
            dlog(T.AI,bb.id)('------ rePath')
            root.findPath?.({ep:ep});
            await root.move?.();
        }

        this._commitUse(ctx);
        return { ok:true, note:'chase' };
        
    }
}