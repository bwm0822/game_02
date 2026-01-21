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
        const {bb,root,fav} = ctx;
        
        if(!bb.scenePlayer)         // 沒有目標
        {
            if(this._onAttack)
            {
                // 失去攻擊目標時，進入 IDLE 狀態幾回合
                this._onAttack = false;
                bb.idleCnt = 5;         // 設定進入 IDLE 狀態的回合數
                bb.go = null;           // 清除目前目標點
                root.clearPath?.();     // 清除路徑
            }  
            return [0, 'no target']; 
        }
        else 
        {
            if(fav()>GM.FAV.HATE) { return [0, 'no target']; }
            this._t=bb.scenePlayer;
        }        

        let base = bb.sensePlayer ? 1 : 0.5;
        return [base*this.weight, 'none'];

    }

    async act(ctx) 
    {
        const {root} = ctx;

        this._onAttack=true;
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