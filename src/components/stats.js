import {GM} from '../setting.js';
import DB from '../db.js';
import Utility from '../utility.js';


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

function _initProcs(fromEnemy)
{
    return Utility.isEmpty(fromEnemy?.procs) ? [] : [...fromEnemy.procs];
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
        if(out[GM.TYPE]!==GM.MELEE) {out[GM.ATK] = (meta[GM.ATK] || 0);}
        else {out[GM.ATK] = _baseATK(base) + (meta[GM.ATK] || 0);}
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
        if(m) { o.basM[stat] = (o.basM[stat] || 0) + m };
    }
    else    // 次級屬性、抗性
    {
        if(a) { o.derA[stat] = (o.derA[stat] || 0) + a };
        if(m) { o.derM[stat] = (o.derM[stat] || 0) + m };
    }
}

function _metaOfEquips(equips)   // 取得裝備基本屬性
{
    const meta={};
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id??equip);
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
        let eq = DB.item(equip.id??equip);
        eq?.effects?.forEach((eff)=>{_calcMods(eff, mod);});
    }
}

function _procsFromEquips(equips, procs)
{
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id??equip);
        eq?.procs?.forEach((proc)=>{proc.scope===GM.ENEMY && procs.push(proc)});
    }
}

function _modsFromActives(actives, mod)
{
    for(let proc of actives)
    {
        proc.effects?.forEach((eff)=>{_calcMods(eff, mod);});   
    }
}


function _modsFromSkills(skills, mod)
{
    for(const id in skills)
    {
        let sk = DB.skill(id);
        if(sk.type === GM.PASSIVE)
        {
            sk.effects?.forEach((eff)=>{_calcMods(eff, mod);});
        }
    }
}

function _adjustBase(base, mod)
{
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
    constructor(init={}) 
    {
        // --- 基礎屬性（可依你資料庫載入覆蓋） ---
        this.baseStats =
        {
            [GM.STR] : 5, [GM.DEX] : 5, [GM.INT] : 5,
            [GM.CON] : 5, [GM.LUK] : 5,
        }

        this._states = {[GM.HP]:100};
        this._actives = [];
    }

    get tag() { return 'stats'; }
    get ctx() { return this._root.ctx; }


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    
    
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        this._root = root;

        // 對上層公開 API
        root.prop('total', this, '_total');
        root.prop('actives', this, '_actives');
        // root.states = this._states;
        root.addProcs = this.addProcs.bind(this);
        root.takeDamage = this.takeDamage.bind(this);
        root.getTotalStats = this.getTotalStats.bind(this);

        // 註冊 event 
        root.on('equip', this.getTotalStats.bind(this) );
        root.on('update', this.processProcs.bind(this) );
        root.on('stats', this.getTotalStats.bind(this) );   // 更新屬性

        // 綁定時，先跑一次
        this.getTotalStats();      
    }

    getTotalStats(fromEnemy)
    {
        const {bb} = this.ctx;

        // 初始化 mod
        const mod = _initMod(fromEnemy?.mod);
        const procs = _initProcs(fromEnemy?.procs);
        
        // 取得裝備基本屬性，如:攻擊、防禦、攻擊類型、距離...等
        const meta = _metaOfEquips(bb.equips);

        // 1) 淺層拷貝 [基礎屬性]
        const base = {...this.baseStats};

        // 2) 計算 [裝備] 加成
        _modsFromEquips(bb.equips, mod);

        // 3) 取得 [裝備] procs
        _procsFromEquips(bb.equips, procs);

        // 3) 計算 [被動技能] 加成
        _modsFromSkills(bb.skills, mod);

        // 4) 計算 [作用中效果] 的加成
        _modsFromActives(this._actives, mod);

        // 5) 修正 base
        _adjustBase(base, mod);

        // 6) 修正後的 base 推導 derived
        const derived = _derivedStats(base, meta);

        // 7) 合併：base 值優先，derived 補空位
        const total = {...derived, ...base};
        total.enemy = {mod:mod.enemy, procs:procs};

        // 8) 修正 derived
        _adjustDerived(total, mod);

        // 9) 最後合併狀態，並確保當前生命值不超過最大值
        this._states[GM.HP] = Math.min(total[GM.HPMAX], this._states[GM.HP]); 
        total.states = this._states;

        this._total = total;
        bb.total = total;

        return total;

    }


    takeDamage(dmg) 
    {
        const {emit}=this.ctx;
        switch(dmg.type)
        {
            case GM.CRI:
                emit('text',`${'暴擊'} -${dmg.amount}`, '#f00', '#fff');
                this._states[GM.HP] = Math.max(0, this._states[GM.HP]-dmg.amount); 
                // console.log(`${this.name} 受到 ${dmg.amount} 暴擊傷害`);
                break;
            case GM.EVA:
                emit('text',GM.DODGE.lab(), '#0f0', '#000');
                break;
            case GM.MISS:
                emit('text',GM.MISS.lab(), '#0f0', '#000');
                break;
            default:
                emit('text',-dmg.amount, '#f00', '#fff');
                this._states[GM.HP] = Math.max(0, this._states[GM.HP]-dmg.amount); 
                // console.log(`${this.name} 受到 ${dmg.amount} 傷害`);
        }

        emit('damage');
        this._states[GM.HP]===0 && emit('dead');
    }

    heal(amount)
    {
        const {emit}=this.ctx;
        this._states[GM.HP] = Math.min(this._total[GM.HPMAX], this._states[GM.HP]+amount); 
        emit('text',`+${amount}`, '#0f0', '#000');
        // console.log(`${this.name} 回復 ${amount} 點生命`);
    }

    addProcs(procs)
    {
        this._actives.push({...procs,remaining:procs.dur});
    }

    processProcs()
    {
        this._actives.forEach((proc)=>{
            if (proc.type === GM.DOT) 
            {
                let finalDamage = proc.value;
                if (proc.elm) 
                {
                    const resist = this._total.resists?.[RESIST_MAP[proc.elm]] || 0;
                    finalDamage *= 1 - resist;
                }
                this.takeDamage({amount:finalDamage});
            }
            else if (proc.type === GM.HOT) 
            {
                let finalHeal = proc.value;
                this.heal(finalHeal);
            }
            proc.remaining -= 1;
        });

        // 移除過期效果
        this._actives = this._actives.filter(proc => {
            if (proc.remaining <= 0) {
                console.log(`${this.name} 的 ${proc.stat || proc.tag} ${proc.type} 效果結束`);
                return false;
            }
            return true;
        });

    }



    addEffect(effect,types=['hot','dot','buff','debuff'])
    {
        if(!types.includes(effect.type)) {return;}

        const maxStack = effect.maxStack || 99;
        if (true)//effect.stackable) 
        {
            const existingStacks = this.rec.activeEffects.filter(e => e.tag === effect.tag && e.type === effect.type);
            if (existingStacks.length >= maxStack) {
                console.log(`${this.name} 的 ${effect.tag} 疊層已達上限 (${maxStack})`);
                return;
            }
            const newEff = { ...effect, remaining: effect.dur, newAdd:true };
            this.rec.activeEffects.push(newEff);
            console.log(`${this.name} 疊加 ${effect.tag} 效果（第 ${existingStacks.length + 1} 層）`);
        } 
        else 
        {
            const existing = this.rec.activeEffects.find(e => e.tag === effect.tag && e.type === effect.type);
            if (existing) 
            {
                existing.remaining = effect.duration;
                existing.value = effect.value;
                console.log(`${this.name} 的 ${effect.tag} 效果已刷新`);
            } 
            else 
            {
                const newEff = { ...effect, remaining: effect.dur, newAdd:true };
                this.rec.activeEffects.push(newEff);
                console.log(`${this.name} 獲得 ${effect.type}：${effect.stat || effect.tag} ${effect.value * 100 || effect.value}% 持續 ${effect.duration} 回合`);
            }
        }
    }

    
}
