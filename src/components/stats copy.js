import {GM} from '../setting.js';
import DB from '../db.js';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : stats
// 功能 : 角色屬性、衍生屬性、HP/MP、抗性、受傷/治療、DoT
//--------------------------------------------------
export class Stats 
{
    constructor(root, init={}) 
    {
        this._root = root;
        this._bind(root);

        // --- 基礎屬性（可依你資料庫載入覆蓋） ---
        const base = 
        {
            lvl: 1,
            STR: 5, DEX: 5, CON: 5, INT: 5, LUK: 5,
            baseHP: 50, baseMP: 20,
            // 武器/防具計入「裝備」層處理，這裡只放基礎
            res: { // 抗性 0.2=減20%，-0.5=吃50%額外傷
                phys: 0.0, fire: 0.0, ice: 0.0, poison: 0.0,
            },
            critRate: 0.05,  // 5%
            critMult: 1.5,
        };

        this.data = Object.assign({}, base, init);

        // --- 狀態條 ---
        this.hp = this.maxHP;
        this.mp = this.maxMP;

        // --- 持續效果（可選） ---
        this.dots = []; // {type:'poison', ticks:3, perTick: 3}

        this.mods = {                // 預設修正
            dmgOut: { all:0, phys:0, fire:0, ice:0, poison:0 },
            dmgIn : { all:0, phys:0, fire:0, ice:0, poison:0 },
            critRateAdd: 0,
            critMultAdd: 0,
            skillPower: {},            // 例：{ fireball:+0.2 }
            onHit: [],                 // 例：[{chance:.2, addDot:{...}}]
        };

        this._recalcFromEquip = this._recalcFromEquip?.bind(this) || (( )=>this.recalcFromEquip());
        this.ctx.ev?.on?.('equip-changed', this._recalcFromEquip);
        this.recalcFromEquip();      // 初始化時先跑一次
    }

    get tag() { return 'stats'; }
    get ctx() { return this._root.ctx; }
    get emit() { return this._root.emit;}
    get on() {return this._root.on;}

    // ---- 衍生屬性 ----
    get maxHP() { return Math.max(1, this.data.baseHP + this.data.CON * 10); }
    get maxMP() { return Math.max(0, this.data.baseMP + this.data.INT * 8); }

    // 近戰/遠程/法術用到的基礎攻擊力（不含武器）
    get baseMeleeATK() { return this.data.STR * 2; }
    get baseRangedATK(){ return this.data.DEX * 2; }
    get baseMagicATK() { return this.data.INT * 2; }

    // 基礎防禦（不含裝備）：你也可把裝備DEF計在別的層再取總和
    get basePDEF(){ return this.data.CON * 2; }
    get baseMDEF(){ return Math.floor(this.data.INT * 1.5); }

    get critRate(){ return this.data.critRate; }
    get critMult(){ return this.data.critMult; }

    _bind(root) 
    {
        // 對上層公開 API
        root.getStat = this.getStat.bind(this);
        root.maxHP = () => this.maxHP;
        root.maxMP = () => this.maxMP;
        root.hpPct = () => this.hp / this.maxHP;
        root.mpPct = () => this.mp / this.maxMP;
        root.applyDamage = this.applyDamage.bind(this);
        root.heal = this.heal.bind(this);
        root.addDot = this.addDot.bind(this);
        root.tickDots = this.tickDots.bind(this);
        root.resists = () => this.data.res;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------

    getStat(k){ return this.data[k]; }

    // ---- 生命變動 ----
    applyDamage(amount) 
    {
        const prev = this.hp;
        this.hp = Math.max(0, this.hp - Math.max(0, Math.floor(amount)));
        this.ctx?.ev?.emit?.('damaged', { from: null, hit: amount, hp: this.hp, prev });
        if (this.hp === 0) { this.ctx?.ev?.emit?.('dead', { who: this.ctx }); }
        return this.hp;
    }

    heal(amount) 
    {
        const prev = this.hp;
        this.hp = Math.min(this.maxHP, this.hp + Math.max(0, Math.floor(amount)));
        this.ctx?.ev?.emit?.('healed', { who: this.ctx, amount, hp: this.hp, prev });
        return this.hp;
    }

    // ---- DoT（可選）----
    addDot({type='poison', ticks=3, perTick=1}) 
    {
        this.dots.push({type, ticks, perTick});
    }

    tickDots() 
    {
        if (!this.dots.length) return;
        const left = [];
        for (const d of this.dots) {
        this.applyDamage(d.perTick);
        d.ticks -= 1;
        if (d.ticks > 0) left.push(d);
        }
        this.dots = left;
    }

    recalcFromEquip()
    {
        // const inv = this.ctx.inv || this.ctx.coms?.inv || this.ctx.inventory;
        // const eq = inv?.getEquipped ? inv.getEquipped() : Object.values(inv?.slots||{}).filter(Boolean);

        const {inv} = this.ctx;
        const eq = inv?.getEquipped()

        // 1) 重置
        const base = this.data;
        // 基礎（屬性、抗性）
        let addStats = { STR:0, DEX:0, CON:0, INT:0, LUK:0 };
        let addRes   = { phys:0, fire:0, ice:0, poison:0 };

        // mods 重置
        this.mods = {
            dmgOut:{ all:0, phys:0, fire:0, ice:0, poison:0 },
            dmgIn :{ all:0, phys:0, fire:0, ice:0, poison:0 },
            critRateAdd:0, critMultAdd:0, skillPower:{}, onHit:[],
        };

        // 預設武器為空
        this.ctx.weapon = { atk:0, ranged:false, element:'phys' };

        // 2) 彙總每件裝備
        for (const it of eq)
        {
            // 2-1 屬性
            if (it.stats) for (const [k,v] of Object.entries(it.stats)) addStats[k] = (addStats[k]||0) + (v||0);
            // 2-2 抗性
            if (it.res)   for (const [k,v] of Object.entries(it.res))   addRes[k]   = (addRes[k]||0) + (v||0);
            // 2-3 武器
            if (it.slot === 'weapon' && it.weapon){
            this.ctx.weapon = {
                atk: it.weapon.atk||0,
                ranged: !!it.weapon.ranged,
                element: it.weapon.element || 'phys',
            };
            }
            // 2-4 修正
            if (it.mods){
            const m = it.mods;
            if (m.dmgOut) for (const [k,v] of Object.entries(m.dmgOut)) this.mods.dmgOut[k] = (this.mods.dmgOut[k]||0)+(v||0);
            if (m.dmgIn ) for (const [k,v] of Object.entries(m.dmgIn )) this.mods.dmgIn [k] = (this.mods.dmgIn [k]||0)+(v||0);
            if (m.critRateAdd) this.mods.critRateAdd += m.critRateAdd;
            if (m.critMultAdd) this.mods.critMultAdd += m.critMultAdd;
            if (m.skillPower)  for (const [k,v] of Object.entries(m.skillPower)) this.mods.skillPower[k]=(this.mods.skillPower[k]||0)+(v||0);
            if (m.onHit) this.mods.onHit.push(...m.onHit);
            }
        }

        // 3) 寫回「最終生效的屬性/抗性」
        //   最終屬性 = base + add
        for (const k of Object.keys(addStats)) { this.data[k] = (this.data[k]||0) + addStats[k]; }
        //   最終抗性 = base.res + addRes（並夾在 [-0.9, +0.9]）
        const r = this.data.res;
        for (const k of Object.keys(addRes)) { r[k] = Math.max(-0.9, Math.min(0.9, (r[k]||0) + addRes[k])); }

        // 4) 重新計算 HP/MP 上限變化（保持血量百分比）
        const hpPct = this.hp / this.maxHP;
        const mpPct = this.mp / this.maxMP;
        this.hp = Math.round(this.maxHP * Math.max(0, Math.min(1, hpPct)));
        this.mp = Math.round(this.maxMP * Math.max(0, Math.min(1, mpPct)));

        this.emit?.('recalc-stats', { who:this.ctx, mods:this.mods, weapon:this.ctx.weapon });
    }

    getTotalStats(extern) 
    {
        let calc = function(stats, out)
        {
            for(let [k,v] of Object.entries(stats))
            {
                if(GM.BASE.includes(k)) // 基礎屬性
                {
                    // 如果 v 為包含'*'的字串(如 '0.1*') => 乘， 其餘 => 加
                    if(v?.includes?.('*')) {out.baseMul[k] = (out.baseMul[k] || 0) + parseFloat(v);}
                    else {out.baseAdd[k] = (out.baseAdd[k] || 0) + parseFloat(v);}
                }
                else    // 次級屬性、抗性
                {
                    // 如果 v 為包含'x'的字串(如 '0.1*') => 乘， 其餘 => 加
                    if(v?.includes?.('*')) {out.secMul[k] = (out.secMul[k] || 0) + parseFloat(v);}
                    else {out.secAdd[k] = (out.secAdd[k] || 0) + parseFloat(v);}
                }
            }
        }

        let addEffs = function(effs, out)
        {
            for(const eff of effs)
            {
                if(['dot','debuff'].includes(eff.type)) {out.effs.push(eff);}
            }
        }

        const {inv} = this.ctx;

        // 1) 淺層拷貝 [基礎屬性]
        let base = {...this.base};

        // 基礎屬性(加),基礎屬性(乘),次級屬性(加),次級屬性(乘)
        let mSelf = extern ?? {baseAdd:{}, baseMul:{}, secAdd:{}, secMul:{}}
        let mTarget = {baseAdd:{}, baseMul:{}, secAdd:{}, secMul:{}, effs:[]}

        // 2) 計算 [裝備] 加成
        for(const equip of inv.getEquipped()) 
        {
            if(equip)
            {
                let eq = DB.item(equip.id);
                let self = eq.self || {};
                let target = eq.target || {};
                let effs = eq.effects || [];
                calc(self, mSelf);
                calc(target, mTarget);
                addEffs(effs, mTarget)
                if(eq.cat === GM.CAT_WEAPON) {base.type = self.type;}
            }
        }

        // 3) 計算 [被動技能] 的加成
        for(const key in this.rec.skills)
        {
            let sk = DB.skill(key);
            if(sk.type === GM.PASSIVE) {calc(sk.stats || {}, mSelf);}
        }

        // 4) 計算 [作用中效果] 的加成
        for (const eff of this.rec.activeEffects) 
        {
            if (eff.type === "buff" || eff.type === "debuff") {calc(eff.stats, mSelf)}
        }

        // 4) 修正後的 base
        for (const [k, v] of Object.entries(mSelf.baseAdd)) {base[k] = (base[k] || 0) + v;}
        for (const [k, v] of Object.entries(mSelf.baseMul)) {base[k] = (base[k] || 0) * (1 + v);}

        // 5) 修正後的 base 推導 derived
        const derived = this._deriveStats(base);

        // 6) 合併：base 值優先，derived 補空位
        const total = { ...derived, ...base};
        total.mTarget = mTarget;

        // 7) 再套用「推導後」的裝備加成與抗性、武器
        for (const [k, v] of Object.entries(mSelf.secAdd)) {total[k] = (total[k] || 0) + v;}
        for (const [k, v] of Object.entries(mSelf.secMul)) {total[k] = (total[k] || 0) * ( 1 + v);}

        // 8) 最後合併狀態，並確保當前生命值不超過最大值
        this.rec.states[GM.HP] = Math.min(total[GM.HPMAX], this.rec.states[GM.HP]); 
        Object.assign(total, this.rec.states);

        this.total = total;
        return total;
    }
}

export default Stats;
