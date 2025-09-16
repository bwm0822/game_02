// ai.js （回合制）
// 依你的現有架構：GM / Utility / DB / TimeManager / Role/Npc 的 API
import Utility from './utility.js';
import DB from './db.js';
import { GM } from './setting.js';
import TimeManager from './time.js';
import * as Role from './role.js';

const dist2 = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
};
const withinTiles = (a, b, tiles=5) => {
  const dx = Math.abs((a.x - b.x) / GM.TILE_W);
  const dy = Math.abs((a.y - b.y) / GM.TILE_H);
  return dx <= tiles && dy <= tiles;
};
const rnd = (min, max) => Math.random() * (max - min) + min;
const choose = arr => arr[Math.floor(Math.random() * arr.length)];

/** 回合制冷卻：以 TimeManager.ticks（回合數）判定 */
export class TurnCooldown 
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
const AI_CD = Object.freeze({ FLEE:'flee', TAUNT:'taunt', PATROL:'patrol', WANDER:'wander', SENSE:'sense'});

class AiBase 
{
    constructor(role) 
    {
        this.role = role;
        this.cd = new TurnCooldown();
        this.bb = {               // 簡易 blackboard
            target: null,
            home: { ...role.pos },
            patrolIdx: 0,
            hungerAim: null,
            waterAim: null,
        };
    }

    // ---- 感知 ----
    sensePlayer(maxTiles=8, needSight=true) 
    {
        // const player = this.role.scene?.roles?.find(r => r.isPlayer);
        const player = Role.getPlayer();
        if (!player || !player.isAlive) {return null;}
        if (!withinTiles(this.role.pos, player.pos, maxTiles)) {return null;}
        if (needSight) 
        {
            const hits = Utility.raycast(this.role.x, this.role.y, player.x, player.y, [this.role.scene.staGroup]);
            if (hits.length > 0) {return null;}
        }
        return player;
    }

    senseFood(maxTiles=6) {
        const foods = Object.values(this.role.scene.ents || {}).filter(ent => ent.kind === 'food');
        return foods.filter(f => withinTiles(this.role.pos, f.pos, maxTiles));
    }

    senseWater(maxTiles=6) {
        const waters = Object.values(this.role.scene.ents || {}).filter(ent => ent.kind === 'water');
        return waters.filter(w => withinTiles(this.role.pos, w.pos, maxTiles));
    }

    // ---- 行為工具（全部以回合為節奏）----
    goToEnt(ent, act=null) { if (!ent) return; this.role.order({ act: act || GM.MOVE, target: ent }); }

    goToPos(pt) { this.role.order({ act: GM.MOVE, pt }); }

    randomWander(radiusTiles=4, cdTurns=2) {
        if (!this.cd.ready(AI_CD.WANDER, cdTurns)) return;
        const ox = this.bb.home.x;
        const oy = this.bb.home.y;
        const wx = ox + Math.round(rnd(-radiusTiles, radiusTiles)) * GM.TILE_W;
        const wy = oy + Math.round(rnd(-radiusTiles, radiusTiles)) * GM.TILE_H;
        this.goToPos({ x: wx, y: wy });
    }

    /** 生命需求優先：喝水/進食/睡覺（此處示意，睡覺可接你的 bed ent） */
    tryDrinkEatSleep() {
        const s = this.role.rec.states;
        if (s[GM.THIRST] >= 80) {
        if (!this.bb.waterAim) this.bb.waterAim = choose(this.senseWater(12));
        if (this.bb.waterAim) { this.goToEnt(this.bb.waterAim, GM.DRINK); return true; }
        }
        if (s[GM.HUNGER] >= 80) {
        if (!this.bb.hungerAim) this.bb.hungerAim = choose(this.senseFood(12));
        if (this.bb.hungerAim) { this.goToEnt(this.bb.hungerAim, GM.USE); return true; }
        }
        return false;
    }

    attackOrApproach(target) 
    {
        if (!target || !target.isAlive) {return;}

        this.role._ent = target;
        this.role._act = GM.ATTACK;
        
        // if (this.role._isInAttackRange(target)) 
        // {
        //     // 交由你現成的命令流程（會在角色回合內完成）
        //     this.role._cmd(target, GM.ATTACK);
        // } 
        // else 
        {
            this.role.order({ act: GM.ATTACK, target: target });
        }
    }

    fleeFrom(target, tiles=6) {
        if (!target) return;
        if (!this.cd.ready(AI_CD.FLEE, 1)) return;  // 每回合最多下一次逃跑目的地
        const vx = this.role.x - target.x;
        const vy = this.role.y - target.y;
        const len = Math.max(1, Math.hypot(vx, vy));
        const ux = vx / len, uy = vy / len;
        const dist = tiles * GM.TILE_W;
        const px = this.role.x + ux * dist;
        const py = this.role.y + uy * dist;
        this.goToPos({
        x: Math.round(px / GM.TILE_W) * GM.TILE_W,
        y: Math.round(py / GM.TILE_H) * GM.TILE_H
        });
    }

    // 子類別實作：每回合呼叫一次
    updateTurn() {}
}

/* -------------------------
 * 村民：排程優先；空檔巡邏/閒逛；口渴/飢餓優先
 * ------------------------- */
export class VillagerAI extends AiBase 
{
    updateTurn() 
    {
        // 1) 生命需求（喝水/進食）優先
        if (this.tryDrinkEatSleep()) {return;}

        // 2) 若有 _Schedule，讓 Npc 自己跑；空檔時偶爾互動或閒逛
        if (this.role.state === GM.ST_IDLE) 
        {
            // 與玩家簡易互動（每 20 回合一次）
            const p = this.sensePlayer(4, false);
            if (p && this.cd.ready('greet', 20)) 
            {
                this.role.faceTo(p.pos);
                this.role.disp.speak('你好！');
            }

            // 閒逛（每 2 回合可能換一個點）
            //   this.randomWander(3, 2);
        }
    }
}

/* -------------------------
 * 敵人：巡邏→發現玩家→追擊→攻擊；殘血撤退
 * ------------------------- */
export class EnemyAI extends AiBase 
{
    constructor(role) 
    {
        super(role);
        const dat = DB.role(role.id);
        this.patrol = (dat?.patrol?.map(id => role.scene.ents[id]) || []).filter(Boolean);
    }

    updateTurn() 
    {
        const player = this.sensePlayer(8, true);
        const stats = this.role.getTotalStats();
        const hp = this.role.rec.states[GM.HP] || 0;
        const hpmax = stats[GM.HPMAX] || 1;

        // 殘血撤退（優先級最高）
        if (hp / hpmax < 0.2 && player) { this.fleeFrom(player, 8); return; }

        if (player) 
        {
            // 嘲諷每 5 回合一次
            if (this.cd.ready(AI_CD.TAUNT, 5)) {this.role.disp.speak('你逃不掉的！');}
            // 交給現有攻擊/追擊流程
            this.attackOrApproach(player);
            return;
        }

        // 巡邏（每 3 回合換下一點）
        if (this.patrol.length > 0 && this.role.state === GM.ST_IDLE && this.cd.ready(AI_CD.PATROL, 3)) 
        {
            const ent = this.patrol[this.bb.patrolIdx % this.patrol.length];
            this.bb.patrolIdx++;
            this.goToEnt(ent, null);
            return;
        }

        // 空檔閒逛
        // if (this.role.state === GM.ST_IDLE) this.randomWander(2, 2);
    }
}

/* -------------------------
 * 野獸：飢餓找食物/獵物；被逼近威嚇→攻擊或逃跑
 * ------------------------- */
export class BeastAI extends AiBase {
  updateTurn() {
    const s = this.role.rec.states;
    const player = this.sensePlayer(7, true);

    // 被逼近的警戒反應（距離 ≤3 格）
    if (player && withinTiles(this.role.pos, player.pos, 3)) {
      if (this.cd.ready('snarl', 4)) this.role.disp.speak('低吼…');
      if (Math.random() < 0.5) this.attackOrApproach(player);
      else this.fleeFrom(player, 6);
      return;
    }

    // 飢餓驅動（>70）
    if (s[GM.HUNGER] > 70) {
      const foods = this.senseFood(10);
      if (foods.length > 0) { this.goToEnt(choose(foods), GM.USE); return; }

      // 若沒有食物，找弱小目標（示意：非玩家、非自己）
      const prey = this.role.scene.roles.find(r => r !== this.role && !r.isPlayer && r.isAlive);
      if (prey) { this.attackOrApproach(prey); return; }
    }

    // 平時遊走
    if (this.role.state === GM.ST_IDLE) this.randomWander(4, 2);
  }
}

/* -------------------------
 * 動物：群聚/遊走；被驚擾就逃跑；偶爾進食/喝水
 * ------------------------- */
export class AnimalAI extends AiBase {
  updateTurn() {
    const player = this.sensePlayer(6, false);

    // 受驚逃跑（距離 ≤3 格）
    if (player && withinTiles(this.role.pos, player.pos, 3)) {
      this.fleeFrom(player, 8);
      if (this.cd.ready('chirp', 6)) this.role.disp.speak('！');
      return;
    }

    // 簡化群聚：靠近最近的同類（每 3 回合調整一次）
    if (this.role.state === GM.ST_IDLE && this.cd.ready('flock', 3)) {
      const kin = this.role.scene.roles
        .filter(r => r !== this.role && r.constructor === this.role.constructor)
        .sort((a, b) => dist2(a.pos, this.role.pos) - dist2(b.pos, this.role.pos));
      if (kin[0] && dist2(kin[0].pos, this.role.pos) > (2*GM.TILE_W)*(2*GM.TILE_W)) {
        this.goToPos(kin[0].pos);
        return;
      }
    }

    // 偶爾進食/喝水
    if (this.tryDrinkEatSleep()) return;

    // 閒逛
    if (this.role.state === GM.ST_IDLE) this.randomWander(3, 2);
  }
}

/* -------------------------
 * 工廠：依 DB.role(id) 的 ai/type 指派
 * 可用標籤：'villager' | 'enemy' | 'beast' | 'animal'
 * ------------------------- */
export function createAIFor(role) 
{
    const dat = DB.role(role.id) || {};
    const kind = dat.ai || dat.type || 'villager';
    switch (kind) 
    {
        case 'enemy':   return new EnemyAI(role);
        case 'beast':   return new BeastAI(role);
        case 'animal':  return new AnimalAI(role);
        case 'villager':
        default:        return new VillagerAI(role);
    }
}

