import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：測試用行為 ---

export class BehIdle extends Behavior 
{
    constructor(opts={}) { super('IDLE', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮
        const {bb} = ctx;
        let base = 1;
        
        if(bb.idleCnt>0)
        {
            bb.idleCnt--;
            return [base*this.weight, `still idling (${bb.idleCnt} turns left)`];
        }
        else
        {
            return [0, 'not idling' ];
        }
    }

    async act(ctx) 
    {
        console.log('---------------------- idle');
        ctx.sta(GM.ST_IDLE);
        return { ok:true, note:'idle' };   
    }
}