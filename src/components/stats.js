import {GM} from '../setting.js';
import DB from '../db.js';


function _baseHPMAX(base) {return Math.round((base[GM.CON] || 0) * 10);}     // HPMAX = CON x 10
function _baseATK(base) {return (base[GM.STR] || 0) * 1.5;}                  // 攻擊 = STR x 1.5
function _baseDEF(base) {return (base[GM.CON] || 0);}                        // 物防 = CON
function _baseACC(base) {return 1;}                                          // 準確 = 1
function _baseEVA(base) {return (base[GM.DEX] || 0) * 0.01;}                 // 閃避 = DEX x 0.01
function _baseCRI(base) {return Math.min(0.5, (base[GM.DEX] || 0) * 0.01);}  // 每點 DEX +1% 暴擊，上限 50%
function _baseCRID(base) {return 1.5;}                                       // 基礎暴擊傷害倍率 = 1.5
function _baseRES(base) {return { [GM.FIRE_RES]: 0, [GM.ICE_RES]: 0, [GM.POISON_RES]: 0, [GM.PHY_RES]: 0 };}

function _initMod(fromEnemy)
{
    const mod={};
    // 基礎屬性(加),基礎屬性(乘),次級屬性(加),次級屬性(乘)
    mod.self = fromEnemy ?? { basA:{}, basM:{}, derA:{}, derM:{} };
    mod.enemy = { basA:{}, basM:{}, derA:{}, derM:{} };
    return mod;
}

function _derivedStats(base, meta) 
{
    const out = {};

    // 1) Vital & resource
    if (base[GM.HPMAX]===undefined) {out[GM.HPMAX] = _baseHPMAX(base);}
    if (base[GM.TYPE]===undefined) {out[GM.TYPE] = meta[GM.TYPE] || GM.MELEE; }

    // 2) Combat basics
    if (base[GM.ATK]===undefined)
    {
        if(base[GM.TYPE]!==GM.MELEE) {out[GM.ATK] = (meta[GM.ATK] || 0);}
        else {out[GM.ATK] = _baseATK(base) + (meta[GM.ATK] || 0); }
    } 
    if (base[GM.DEF]===undefined) {out[GM.DEF] = (meta[GM.DEF] || 0) + _baseDEF(base);}
    if (base[GM.RANGE]===undefined) {out[GM.RANGE] = (meta[GM.RANGE] || 1);}
    if (base[GM.ACC]===undefined) {out[GM.ACC] = _baseACC(base);}                                           
    if (base[GM.EVA]===undefined) {out[GM.EVA] = _baseEVA(base);}                             
    
    // 3) Critical
    if (base[GM.CRI]===undefined) {out[GM.CRI] = _baseCRI(base);}             
    if (base[GM.CRID]===undefined) {out[GM.CRID] = _baseCRID(base);}                                                

    // 4) Resistances
    if (base.resists===undefined) {out.resists = _baseRES(base);}

    return out;
}

function _calcMods(eff, mod)
{
    const { scope, stat, a, m } = eff;
    const o = scope==='self' ? mod.self : mod.enemy;

    if(GM.BASE.includes(stat)) // 基礎屬性
    {        
        if(a) { o.basA[stat] = (o.basA[stat] || 0) + a };
        if(m) { o.basA[stat] = (o.basM[stat] || 0) + m };
    }
    else    // 次級屬性、抗性
    {
        if(a) { o.derA[stat] = (o.derA[stat] || 0) + a };
        if(m) { o.derA[stat] = (o.derM[stat] || 0) + m };
    }
}

function _metaOfEquips(equips)   // 取得裝備基本屬性
{
    const meta={};
    console.log(equips)
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id);
        console.log('eq=',eq)
        for(let[k,v] of Object.entries(eq))
        {
            if(k===GM.DEF)  // 裝備防禦會累加
            {
                meta[k] = (meta[k]||0)+ v;
            }
            else if(GM.COMBAT.includes(k)) 
            {
                meta[k] = v;
            }
        }
    }

    return meta;
}
    
function _modsFromEquips(equips, mod)
{
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id);
        for(let eff in eq.effects) {_calcMods(eff, mod);}
    }
}

function _modsFromSkills(skills, mod)
{
    for(const id in skills)
    {
        let sk = DB.skill(id);
        if(sk.type === GM.PASSIVE) 
        {
            for(let eff in sk.effects) {this._calcMods(eff, mod);}
        }
    }
}

function _adjustBase(base, mod)
{
    console.log(mod)
    for (const [k, v] of Object.entries(mod.self.basA)) {base[k] = (base[k] || 0) + v;}
    for (const [k, v] of Object.entries(mod.self.basM)) {base[k] = (base[k] || 0) * (1 + v);}
}

function _adjustDerived(total, mod)
{
    for (const [k, v] of Object.entries(mod.self.derA)) {total[k] = (total[k] || 0) + v;}
    for (const [k, v] of Object.entries(mod.self.derM)) {total[k] = (total[k] || 0) * (1 + v);}
}


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
        const baseStats =
        {
            [GM.STR] : 5, [GM.DEX] : 5, [GM.INT] : 5,
            [GM.CON] : 5, [GM.LUK] : 5,
        }

        this._hp = 100;

        this._effs = [];
        
        this._total = this.getTotalStats();      // 初始化時先跑一次
    }

    get tag() { return 'stats'; }
    get ctx() { return this._root.ctx; }


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _bind(root) 
    {
        // 對上層公開 API
        // 
        root.on('equip', ()=>{this.getTotalStats();});
    }
    
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    getTotalStats(fromEnemy)
    {
        const {inv} = this.ctx;

        // 初始化 mod
        const mod = _initMod(fromEnemy);
        // 取得裝備基本屬性，如:攻擊、防禦、攻擊類型、距離...等
        const meta = _metaOfEquips(inv.equips);
        console.log('-------- meta=',meta)
        // 1) 淺層拷貝 [基礎屬性]
        const base = {...this.baseStats};

        // 2) 計算 [裝備] 加成
        _modsFromEquips(inv.equips, mod);

        // 3) 計算 [被動技能] 加成
        // this._modsFromSkills(skills, mod);

        // 4) 計算 [作用中效果] 的加成

        // 5) 修正 base
        _adjustBase(base, mod);

        // 6) 修正後的 base 推導 derived
        const derived = _derivedStats(base, meta);

        // 7) 合併：base 值優先，derived 補空位
        const total = { ...derived, ...base };
        total.enemy = mod.enemy;

        // 8) 修正 derived
        _adjustDerived(total, mod);

        // 9) 最後合併狀態，並確保當前生命值不超過最大值
        this._hp = Math.min(total[GM.HPMAX], this._hp); 

        console.log(total);

        return total;

    }

    
}
