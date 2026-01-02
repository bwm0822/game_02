import Com from './com.js'
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
    return {self:[], enemy: fromEnemy ? [...fromEnemy.procs] : [] };
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

function _calcMods(eff, mods, condition)
{
    const { scope, stat, a, m, cond } = eff;
    const o = scope!=='enemy' ? mods.self : mods.enemy;
    if (cond && cond !== condition) {return;} // 條件不符，跳過

    console.log(scope, stat, a, m, cond)

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
    
function _modsFromEquips(equips, mods, condition)
{
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id??equip);
        eq?.effects?.forEach((eff)=>{_calcMods(eff, mods, condition);});
    }
}

function _procsFromEquips(equips, procs, condition)
{
    for(let equip of equips)
    {
        if(!equip) {continue;}
        let eq = DB.item(equip.id??equip);
        eq?.procs?.forEach((proc)=>{
            const {cond, scope} = proc;
            if(cond && cond !== condition) {return;}   // 條件不符，跳過
            scope===GM.ENEMY && procs.enemy.push(proc)
        });
    }
}

function _procsFromUsingSkill(skill, procs)
{
    skill?.procs?.forEach((proc)=>{
        const {scope} = proc;
        scope===GM.SELF && procs.self.push(proc)
    });
}

function _modsFromActives(actives, mods)
{
    for(let proc of actives)
    {
        proc.effects?.forEach((eff)=>{_calcMods(eff, mods);});   
    }
}

function _modsFromPassiveSkills(skills, mods)
{
    for(const id in skills)
    {
        let sk = DB.skill(id);
        if(sk.type === GM.PASSIVE)
        {
            sk.effects?.forEach((eff)=>{_calcMods(eff, mods);});
        }
    }
}

function _modsFromUsingSkill(skill, mods)
{
    skill?.effects?.forEach((eff)=>{_calcMods(eff, mods);}); 
}

function _adjustBase(base, mods)
{
    for (const [k, v] of Object.entries(mods.self.basA)) {base[k] = (base[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.self.basM)) {base[k] = (base[k] || 0) * (1 + v);}
}

function _adjustDerived(total, mods)
{
    for (const [k, v] of Object.entries(mods.self.derA)) {total[k] = (total[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.self.derM)) {total[k] = (total[k] || 0) * (1 + v);}
}


//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : stats
// 功能 : 角色屬性、衍生屬性、HP/MP、抗性、受傷/治療、DoT
//--------------------------------------------------
export class COM_Stats extends Com
{
    constructor(init={}) 
    {
        super();
        // --- 基礎屬性（可依你資料庫載入覆蓋） ---
        this.baseStats =
        {
            [GM.STR] : 5, [GM.DEX] : 5, [GM.INT] : 5,
            [GM.CON] : 5, [GM.LUK] : 5,
        }

        this._states = {[GM.HP]:_baseHPMAX(this.baseStats)};
        this._actives = [];
        this._dirty = true;  // 標記屬性需要重算
    }

    get tag() { return 'stats'; }


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _setDirty() {this._dirty = true;}

    _getTotalStats({fromEnemy, condition, skill}={})
    {
        // console.log('-------- getTotalStats',fromEnemy, condition, skill);
        // console.trace();

        // 有參數傳入，強制重算
        if(fromEnemy || condition || skill) {this._dirty = true;} 
        // 已經是最新的，直接回傳
        if(!this._dirty) {return this._total;} 
        // 重算後，標記為最新
        this._dirty = false; 

        const {bb} = this.ctx;

        // 初始化 mod
        const mods = _initMod(fromEnemy?.mods);
        const procs = _initProcs(fromEnemy?.procs);
        
        // 取得裝備基本屬性，如:攻擊、防禦、攻擊類型、距離...等
        const meta = _metaOfEquips(bb.equips);

        // 1) 淺層拷貝 [基礎屬性]
        const base = {...this.baseStats};

        // 2) 計算 [裝備] 加成
        _modsFromEquips(bb.equips, mods, condition);

        // 3) 取得 [裝備] procs
        _procsFromEquips(bb.equips, procs, condition);

        // 4) 計算 [技能] 加成
        _modsFromPassiveSkills(bb.skills, mods);
        _modsFromUsingSkill(skill, mods);
        _procsFromUsingSkill(skill, procs);

        // 5) 計算 [作用中效果] 的加成
        _modsFromActives(this._actives, mods);

        // 6) 修正 base
        _adjustBase(base, mods);

        // 7) 修正後的 base 推導 derived
        const derived = _derivedStats(base, meta);

        // 8) 合併：base 值優先，derived 補空位
        const total = {...derived, ...base};
        total.mods = mods.enemy;
        total.procs = procs;

        // 9) 修正 derived
        _adjustDerived(total, mods);

        // 10) 最後合併狀態，並確保當前生命值不超過最大值
        this._states[GM.HP] = Math.min(total[GM.HPMAX], this._states[GM.HP]);
        total.states = this._states;
        
        // 11) 儲存 local
        this._total = total;
        
        return total;
    }

    _takeDamage(dmg) 
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
                emit('text',GM.EVA.lab(), '#0f0', '#000');
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
        this._states[GM.HP]===0 && emit('ondead');
    }

    // amount = number or {a,m}
    _heal(amount)
    {
        if(typeof amount!=='number')
        {
            amount = (amount.a??0) + (amount.m??0)*this._total[GM.HPMAX];
        }
        const {emit}=this.ctx;
        this._states[GM.HP] = Math.min(this._total[GM.HPMAX], this._states[GM.HP]+amount); 
        emit('text',`+${amount}`, '#0f0', '#000');
        // console.log(`${this.name} 回復 ${amount} 點生命`);
    }

    _addProcs(procs)
    {
        this._actives.push({...procs,skip:true,remaining:procs.dur});
    }

    _processProcs()
    {
        this._actives.forEach((proc)=>{
            if(proc.skip) 
            {
                proc.skip=false; 
                this._setDirty(); 
                return;
            }
            if (proc.type === GM.DOT) 
            {
                let finalDamage = proc.value;
                if (proc.elm) 
                {
                    const resist = this._total.resists?.[RESIST_MAP[proc.elm]] || 0;
                    finalDamage *= 1 - resist;
                }
                this._takeDamage({amount:finalDamage});
            }
            else if (proc.type === GM.HOT) 
            {
                let finalHeal = proc.value;
                this._heal(finalHeal);
            }
            proc.remaining -= 1;
        });

        // 移除過期效果
        this._actives = this._actives.filter(proc => {
            if (proc.remaining <= 0) {
                console.log(`${this.name} 的 ${proc.stat || proc.tag} ${proc.type} 效果結束`);
                this._setDirty();
                return false;
            }
            return true;
        });

    }

    _drink()
    {
        console.log('drink')
    }
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    load(data) 
    {
        if(data?.states) {Object.assign(this._states, data.states);}
    }

    save() 
    {
        return {states:this._states};
    }

    bind(root) 
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addP(root, 'total', {getter:this._getTotalStats.bind(this)});
        this.addP(root, 'actives', {target:this, key:'_actives'});
        this.addP(root, 'isAlive', {getter:()=>this._states[GM.HP]>0});
        root.addProcs = this._addProcs.bind(this);
        root.takeDamage = this._takeDamage.bind(this);
        root.getTotalStats = this._getTotalStats.bind(this);
        root.drink = this._drink.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on('heal', this._heal.bind(this) );
        root.on('update', this._processProcs.bind(this) );
        root.on('dirty', this._setDirty.bind(this));
        root.on('total', this._getTotalStats.bind(this));

        // 計算總屬性
        this._getTotalStats();
   
    }

    

    
}
