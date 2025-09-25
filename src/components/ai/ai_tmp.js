// ai.js
// 回合制 Utility AI + 簡易狀態機骨架（與 Phaser 解耦）
// 需外部提供：senses, actions, rng (可選)

export class Cooldown {
  constructor() { this.map = new Map(); }
  ready(key, cdTicks = 30, now = performance.now()) {
    const due = this.map.get(key) || 0;
    if (now >= due) { this.map.set(key, now + cdTicks * 16); return true; }
    return false;
  }
  set(key, cdTicks, now = performance.now()) {
    this.map.set(key, now + cdTicks * 16);
  }
}

// --- 黑板：AI 的工作記憶 ---
export function makeBlackboard(role) {
  return {
    selfId: role.id ?? null,
    target: null,           // 目前關注目標（敵/物）
    home: { ...role.pos },  // 家點 / 出生點
    patrolIdx: 0,           // 巡邏索引
    lastHitFrom: null,      // 最近被誰打
    lastSeen: new Map(),    // 目標 -> 最後看見時間
    hungerAim: null,        // 飢餓時的食物目標
    waterAim: null,         // 口渴時的水源目標
    intent: null,           // 當前意圖（字串）
    state: 'idle',          // 狀態機目前狀態
  };
}

// --- 行為介面 ---
class Behavior {
  constructor(name, opts={}) {
    this.name = name;
    this.coolKey = opts.coolKey ?? name;
    this.minInterval = opts.minInterval ?? 0; // ticks
    this.lastUsedTick = -1;
    this.weight = opts.weight ?? 1.0; // 基礎權重（可用於傾向）
    this.debug = !!opts.debug;
  }
  // 回傳 [score, reason]；0 代表不考慮
  score(ctx) { return [0, 'abstract']; }
  // 回傳 { ok:boolean, usedTick?:number, note?:string }
  async act(ctx) { return { ok:false, note:'abstract' }; }
  // 工具：冷卻與間隔
  _isOnCooldown(ctx) {
    if (this.minInterval > 0 && ctx.tick - this.lastUsedTick < this.minInterval) return true;
    return !ctx.cd.ready(this.coolKey, 0);
  }
  _commitUse(ctx) {
    this.lastUsedTick = ctx.tick;
    // 若你想把 minInterval 寫進 Cooldown，可用：ctx.cd.set(this.coolKey, this.minInterval);
  }
}

// --- 具體行為：攻擊（近戰/遠程） ---
class BehAttack extends Behavior {
  constructor(opts={}) { super('ATTACK', { minInterval: opts.minInterval ?? 1, ...opts }); }
  score(ctx) {
    const { bb, senses, role } = ctx;
    const t = bb.target ?? senses.findNearestEnemy();
    if (!t) return [0, 'no target'];
    if (!senses.canSee(t)) return [0.1, 'target unseen']; // 很低分：可以先追
    const dist = senses.distTo(t);
    const inRange = senses.inAttackRange(t);
    if (!role.canAttack()) return [0, 'cant attack'];
    let base = inRange ? 0.8 : 0.4;
    // 目標血量越低，優先度越高（收頭）
    base += (1 - t.hpRatio) * 0.3;
    // 自身血量越低，降低攻擊傾向
    base -= (1 - role.hpRatio) * 0.4;
    // 冷卻扣分
    if (this._isOnCooldown(ctx)) base *= 0.2;
    return [Math.max(0, base * this.weight), `dist=${dist.toFixed(1)} inRange=${inRange}`];
  }
  async act(ctx) {
    const { bb, actions, senses } = ctx;
    const t = bb.target ?? senses.findNearestEnemy();
    if (!t) return { ok:false, note:'no target' };
    if (senses.inAttackRange(t)) {
      const ok = await actions.attack(t);
      if (ok) { this._commitUse(ctx); return { ok:true, note:'attack' }; }
      return { ok:false, note:'attack failed' };
    } else {
      const ok = await actions.moveToward(t, { maxSteps: 1 });
      return { ok, note:'chase' };
    }
  }
}

// --- 具體行為：逃跑 ---
class BehFlee extends Behavior {
  constructor(opts={}) { super('FLEE', { minInterval: opts.minInterval ?? 1, ...opts }); }
  score(ctx) {
    const { role, senses } = ctx;
    // 低血量 + 週遭威脅多 → 提高逃跑
    const lowHp = (1 - role.hpRatio);
    const threat = senses.threatLevel(); // e.g., 0~1
    let base = Math.max(0, lowHp * 0.7 + threat * 0.5 - 0.2);
    if (this._isOnCooldown(ctx)) base *= 0.2;
    return [base * this.weight, `lowHp=${lowHp.toFixed(2)} threat=${threat.toFixed(2)}`];
  }
  async act(ctx) {
    const { actions, senses } = ctx;
    const dir = senses.bestEscapeDirection();
    const ok = await actions.move(dir, { maxSteps: 1 });
    if (ok) { this._commitUse(ctx); }
    return { ok, note:'flee' };
  }
}

// --- 具體行為：喝藥水 ---
class BehDrinkPotion extends Behavior {
  constructor(opts={}) { super('DRINK_POTION', { minInterval: opts.minInterval ?? 3, ...opts }); }
  score(ctx) {
    const { role, inventory } = ctx;
    if (!inventory.has('potion')) return [0, 'no potion'];
    const need = (1 - role.hpRatio);
    let base = Math.max(0, need - 0.3) * 0.9; // HP < 70% 才考慮
    return [base * this.weight, `need=${need.toFixed(2)}`];
  }
  async act(ctx) {
    const { actions, inventory } = ctx;
    const ok = await actions.useItem('potion');
    if (ok) this._commitUse(ctx);
    return { ok, note:'drink potion' };
  }
}

// --- 具體行為：巡邏 ---
class BehPatrol extends Behavior {
  constructor(opts={}) { super('PATROL', { minInterval: opts.minInterval ?? 1, ...opts }); }
  score(ctx) {
    const { senses } = ctx;
    // 沒敵人時的背景行為
    if (senses.findNearestEnemy()) return [0.1, 'enemy exists'];
    return [0.3 * this.weight, 'idle background'];
  }
  async act(ctx) {
    const { bb, actions, nav } = ctx;
    const pts = nav.patrolPoints?.length ? nav.patrolPoints : [bb.home];
    const p = pts[bb.patrolIdx % pts.length];
    const ok = await actions.moveTo(p, { maxSteps: 1 });
    if (ok) {
      bb.patrolIdx = (bb.patrolIdx + 1) % pts.length;
      this._commitUse(ctx);
      return { ok:true, note:'patrol step' };
    }
    return { ok:false, note:'patrol blocked' };
  }
}

// --- 決策器：Utility 選最高分，然後執行 ---
// 你也可以在這裡加上「分數門檻」、「次佳備援」等策略
class UtilityDecider {
  decide(ctx, behaviors) {
    let best = null;
    let logs = [];
    for (const b of behaviors) {
      const [s, why] = b.score(ctx);
      logs.push([b.name, s, why]);
      if (!best || s > best.score) best = { beh: b, score: s, why };
    }
    return { best, logs };
  }
}

// --- 狀態機（可選）：把「正在施法」「硬直」等暫時狀態抽象化 ---
class StateMachine {
  constructor() { this.state = 'idle'; }
  canAct() { return this.state !== 'stun' && this.state !== 'casting'; }
  set(s) { this.state = s; }
}

// --- AI Controller 本體 ---
export class AIController {
  constructor({ role, senses, actions, inventory, nav, rng=Math, debug=false }) {
    this.role = role;
    this.senses = senses;
    this.actions = actions;
    this.inventory = inventory;
    this.nav = nav;
    this.rng = rng;
    this.debug = debug;

    this.cd = new Cooldown();
    this.bb = makeBlackboard(role);
    this.sm = new StateMachine();
    this.decider = new UtilityDecider();

    // 行為清單（可自由增刪/調整權重）
    this.behaviors = [
      new BehDrinkPotion({ weight: 1.0 }),
      new BehFlee({ weight: 1.0 }),
      new BehAttack({ weight: 1.2 }),   // 偏攻擊
      new BehPatrol({ weight: 0.6 }),
    ];

    this.tick = 0;
  }

  // 回合主流程
  async think() {
    this.tick++;

    // 狀態不可行動 → 嘗試恢復/等待
    if (!this.sm.canAct()) {
      if (this.debug) console.log('[AI] cannot act, state=', this.sm.state);
      return { ok:false, note:'wait' };
    }

    const ctx = {
      tick: this.tick,
      role: this.role,
      senses: this.senses,
      actions: this.actions,
      inventory: this.inventory,
      nav: this.nav,
      bb: this.bb,
      cd: this.cd,
      rng: this.rng,
      debug: this.debug,
    };

    // 事前黑板更新（可選）
    this._preUpdateBlackboard(ctx);

    // 決策
    const { best, logs } = this.decider.decide(ctx, this.behaviors);
    if (this.debug) console.table(logs.map(([n,s,w]) => ({ behavior:n, score:s.toFixed(3), why:w })));

    if (!best || best.score <= 0) {
      if (this.debug) console.log('[AI] no viable behavior');
      return { ok:false, note:'idle' };
    }

    this.bb.intent = best.beh.name;

    // 執行
    const res = await best.beh.act(ctx);
    if (this.debug) console.log(`[AI] do ${best.beh.name} ->`, res);
    return { ...res, chosen: best.beh.name, score: best.score };
  }

  _preUpdateBlackboard(ctx) {
    // 例如：若沒有 target，找一個最近敵人
    if (!ctx.bb.target) {
      const t = ctx.senses.findNearestEnemy();
      if (t) ctx.bb.target = t;
    }
    // 更新 lastSeen
    if (ctx.bb.target) ctx.bb.lastSeen.set(ctx.bb.target.id ?? ctx.bb.target, ctx.tick);
  }
}
