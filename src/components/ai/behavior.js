import {GM} from '../../core/setting.js'

// --- 行為介面 ---
export default class Behavior 
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

    // move() 回傳 blocked 後呼叫：人類會開門(其他障礙物下回合重新找路)；回傳 true 代表是動物被門擋住、過不去
    async _onBlocked(ctx)
    {
        const {bb,root,probe} = ctx;
        if(!bb.meta.animal) {await root.checkBlock?.(); return false;}
        return probe(bb.path.pts[0])?.tag===GM.TP.DOOR;
    }
}
