import TimeManager from '../../time.js';
import {BehAttack, BehChase} from './behavior.js';


// 回合制冷卻：以 TimeManager.ticks（回合數）判定
export class Cooldown 
{
    constructor() { this.map = new Map(); }   // key -> nextTurn
    ready(key, cdTurns = 1, nowTurn = TimeManager.ticks) 
    {
        const nextTurn = this.map.get(key) ?? -Infinity;
        if (nowTurn >= nextTurn) 
        {
            this.map.set(key, nowTurn + cdTurns);
            return true;
        }
        return false;
    }
    remaining(key, nowTurn = TimeManager.ticks) 
    {
        const nextTurn = this.map.get(key) ?? -Infinity;
        return Math.max(0, nextTurn - nowTurn);
    }
    set(key, nextTurn) { this.map.set(key, nextTurn); }
    reset(key) { this.map.delete(key); }
    clear() { this.map.clear(); }
}

// 防止被動到（Object.freeze）
// 不能增刪屬性：AI_CD.NEW = 'x' 會失敗
// 不能改值：AI_CD.TAUNT = 'roar' 會失敗（嚴格模式下丟錯）
const AI_CD = Object.freeze({ 
        FLEE:'flee', TAUNT:'taunt', PATROL:'patrol', 
        WANDER:'wander', SENSE:'sense', SNARL:'snarl',  
        GREET:'greet', CHIRP:'chirp', FLOCK:'flock'
    });

// --- 決策器：Utility 選最高分，然後執行 ---
// 你也可以在這裡加上「分數門檻」、「次佳備援」等策略
class UtilityDecider 
{
    decide(ctx, behaviors) 
    {
        let best = null;
        let logs = [];
        for (const b of behaviors) 
        {
            const [s, why] = b.score(ctx);
            logs.push([b.name, s, why]);
            if (!best || s > best.score) best = { beh: b, score: s, why };
        }
        return { best, logs };
    }
}

// --- 狀態機（可選）：把「正在施法」「硬直」等暫時狀態抽象化 ---
class StateMachine 
{
    constructor() { this.state = 'idle'; }
    canAct() { return this.state !== 'stun' && this.state !== 'casting'; }
    set(s) { this.state = s; }
}


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : ai
// 功能 :
//  控制 NPC 的行為
//--------------------------------------------------
export class AIController 
{
    constructor() 
    {
        this.debug = false;

        this.cd = new Cooldown();
        // this.bb = makeBlackboard(role);
        this.sm = new StateMachine();
        this.decider = new UtilityDecider();

        // 行為清單（可自由增刪/調整權重）
        this.behaviors = [
            // new BehDrinkPotion({ weight: 1.0 }),
            // new BehFlee({ weight: 1.0 }),
            new BehAttack({weight:1.2}),   // 偏攻擊
            // new BehChase({minInterval:2}),
            // new BehPatrol({ weight: 0.6 }),
        ];
    }

    get tag() {return 'ai';}  // 回傳元件的標籤
    get root() {return this._root;}
    get ctx() {return {...this._root.ctx, cd:this.cd, tick:TimeManager.ticks};}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _preUpdateBlackboard(ctx) 
    {
        // 例如：若沒有 target，找一個最近敵人
        if (!ctx.bb.target) 
        {
            const t = ctx.senses.findNearestEnemy();
            if (t) ctx.bb.target = t;
        }
        // 更新 lastSeen
        if (ctx.bb.target) ctx.bb.lastSeen.set(ctx.bb.target.id ?? ctx.bb.target, ctx.tick);
    }

    // 回合主流程
    async _think() 
    {
        // 狀態不可行動 → 嘗試恢復/等待
        if (!this.sm.canAct()) 
        {
            this.debug && console.log('[AI] cannot act, state=', this.sm.state);
            return { ok:false, note:'wait' };
        }

        const ctx = this.ctx;

        // 事前黑板更新（可選）
        // this._preUpdateBlackboard(ctx);

        // 決策
        const { best, logs } = this.decider.decide(ctx, this.behaviors);
        this.debug && console.table(logs.map(([n,s,w]) => ({ behavior:n, score:s.toFixed(3), why:w })));

        if (!best || best.score <= 0) 
        {
            this.debug && console.log('[AI] no viable behavior');
            return { ok:false, note:'idle' };
        }

        // this.bb.intent = best.beh.name;

        // 執行
        const res = await best.beh.act(ctx);
        this.debug && console.log(`[AI] do ${best.beh.name} ->`, res);
        return { ...res, chosen: best.beh.name, score: best.score };
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        this._root = root;
        // 註冊 event
        root.on('think', async(resolve)=>{await this._think();resolve?.();});
    }

}



