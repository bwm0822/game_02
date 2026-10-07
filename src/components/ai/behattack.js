import Behavior from './behavior.js'
import {GM} from '../../core/setting.js'
import {T,dlog} from '../../core/debug.js'

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

        if(!bb.sensePlayer)         // 沒有目標
        {
            if(this._onAttack)
            {
                this._onAttack = false;
                bb.go = null;           // 清除目前目標點
                root.clearPath?.();     // 清除路徑
            }
            return [0, 'no target'];
        }

        const style = bb.meta?.style;
        if(style === 'aggressive')
        {
            this._t = bb.sensePlayer;
            return [this.weight, 'aggressive'];
        }

        if(fav() > GM.FAV.HATE) { return [0, 'not hated']; }
        this._t = bb.sensePlayer;
        return [this.weight, 'hated'];

    }

    async act(ctx) 
    {
        const {bb,root} = ctx;
        bb.idleCnt = 5; // 重設進入IDLE狀態的回合數

        this._onAttack=true;
        const t=this._t;
        bb.lastKnownPos = {x: t.x, y: t.y};

        // check HP
        dlog(T.NPC,bb.id)(root.total);
        const hpMax = root.total.hpMax;
        const hp = root.total.states.hp;
        if(hp < hpMax*0.5) 
        {
            dlog(T.NPC,bb.id)('HP低於50%'); 
            const ab = root.queryAb?.('heal')?.[0];
            if(ab)
            {
                const ok = await root.useAb?.(root, ab);
                if(ok) { this._commitUse(ctx); return { ok:true, note:'heal' }; }
                else {return { ok:false, note:'heal failed' };}
            }
        }
        
        
        const ab = root.queryAb?.('atk')?.[0];
        if(ab)
        {
            const ok = await root.useAb?.(t, ab);
            if(ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            // else {return { ok:false, note:'attack failed' };}
        }

        if (root.inAttackRange?.(t)) 
        {
            const ok = await root.attack?.([t]);
            if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
            else {return { ok:false, note:'attack failed' };}
        } 
        else
        {
            root.findPath?.({ent:t})
            // 找不到路就原地盯著，下回合再判斷；路徑要清掉，不然 Schedule 會拿這個沒有 pts 的 path 去 move
            if(bb.path?.state===GM.PATH.NONE) {root.clearPath?.(); return { ok:true, note:'unreachable' };}
            await root.move?.();
            if(bb.cACT.st==='blocked') {await this._onBlocked(ctx);}
            return { ok:true, note:'chase' };
        }
    }
}