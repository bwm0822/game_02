import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'

// --- 具體行為：攻擊（近戰/遠程） ---

export class BehAttack extends Behavior 
{
    constructor(opts={}) 
    { 
        super('ATTACK', { minInterval: opts.minInterval ?? 1, ...opts }); 
        this._onAttack=false;
        this._t=null;
    }

    score(ctx) 
    {
        // 回傳 [score, reason]；0 代表不考慮

        const {bb,root,sta} = ctx;
        const t=bb.target ?? root.sensePlayer?.();
        this._t=t;
        if (!t) 
        {
            if(this._onAttack)
            {
                // 攻擊不到目標時，進入待機狀態幾回合
                this._onAttack=false;
                bb.idleCnt=5; 
            }  
            return [0, 'no target']; 
        }
        if (!root.canSee?.(t)) { return [0.1, 'target unseen']; } // 很低分：可以先追
        
        let base = 1;
        return [base*this.weight, 'none'];
    }

    async act(ctx) 
    {
        const {bb,root} = ctx;

        this._onAttack=true;
        bb.routine=null;
        const t=this._t;

        if (root.inAttackRange?.(t)) 
        {
            const ok = await root.attack?.(t);
            if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            else {return { ok:false, note:'attack failed' };}
        } 
        else
        {
            root.findPath?.(t.pos)
            if(root.checkPath?.()===false) {root.findPath(t.pos);}
            const ok = await root.move?.();
            return { ok:true, note:'chase' };
        }
    }
}