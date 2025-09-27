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
    }

    get tag() { return 'stats'; }
    get ctx() { return this._root; }

    _bind(root) {
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

    getStat(k){ return this.data[k]; }

    // ---- 生命變動 ----
    applyDamage(amount) {
        const prev = this.hp;
        this.hp = Math.max(0, this.hp - Math.max(0, Math.floor(amount)));
        this.ctx?.ev?.emit?.('damaged', { from: null, hit: amount, hp: this.hp, prev });
        if (this.hp === 0) {
        this.ctx?.ev?.emit?.('dead', { who: this.ctx });
        }
        return this.hp;
    }

    heal(amount) {
        const prev = this.hp;
        this.hp = Math.min(this.maxHP, this.hp + Math.max(0, Math.floor(amount)));
        this.ctx?.ev?.emit?.('healed', { who: this.ctx, amount, hp: this.hp, prev });
        return this.hp;
    }

    // ---- DoT（可選）----
    addDot({type='poison', ticks=3, perTick=1}) {
        this.dots.push({type, ticks, perTick});
    }

    tickDots() {
        if (!this.dots.length) return;
        const left = [];
        for (const d of this.dots) {
        this.applyDamage(d.perTick);
        d.ticks -= 1;
        if (d.ticks > 0) left.push(d);
        }
        this.dots = left;
    }
}

export default Stats;
