import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：行為排程更新 ---

export class BehSchedule extends Behavior
{
    constructor(opts={}) { super('SCHEDULE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮
        return [1, 'always'];  // 固定分數1
    }

    async act(ctx)
    {
        ctx.root.updateSch?.();
        return { ok:true, note:'schedule update' };
    }
}