import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：逃跑 ---

export class BehFlee extends Behavior 
{
    constructor(opts={}) { super('Flee', { minInterval: opts.minInterval ?? 1, ...opts }); }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮
        const {bb,fav} = ctx;
        
        if(bb.sensePlayer && fav()<=GM.FAV.HATE)
        {
            return [this.weight, 'flee'];
        }

        return [0, 'none'];

    }

    async act(ctx) 
    {
        const {root,bb} = ctx;
        bb.idleCnt = 5; // 重設進入IDLE狀態的回合數
        
        root.flee?.(bb.sensePlayer.pos);
        return { ok:true, note:'flee' };   
    }
}