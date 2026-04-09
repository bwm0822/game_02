import Com from './com.js'
import {GM} from '../core/setting.js';
import DB from '../data/db.js';
import {T,dlog} from '../core/debug.js'
import Utility from '../core/utility.js';


function _baseHPMAX(base) {return Math.round((base[GM.CON] || 0) * 10);}     // HPMAX = CON x 10
function _baseATK(base) {return (base[GM.STR] || 0) * 1.5;}                  // 攻擊 = STR x 1.5
function _baseDEF(base) {return (base[GM.CON] || 0);}                        // 物防 = CON
function _baseACC(base) {return 1;}                                          // 準確 = 1
function _baseEVA(base) {return (base[GM.DEX] || 0) * 0.01;}                 // 閃避 = DEX x 0.01
function _baseCRI(base) {return Math.min(0.5, (base[GM.DEX] || 0) * 0.01);}  // 每點 DEX +1% 暴擊，上限 50%
function _baseCRD(base) {return 1.5;}                                       // 基礎暴擊傷害倍率 = 1.5
function _baseRES(base) {return { [GM.FIRE_RES]: 0, [GM.ICE_RES]: 0, [GM.POISON_RES]: 0, [GM.PHY_RES]: 0 };}


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
    if (base[GM.CRD]===undefined) {out[GM.CRD] = _baseCRD(base);}                                                

    // 4) Resistances
    if (base.resists===undefined) {out.resists = _baseRES(base);}

    return out;
}

function _calcMods(eff, mods, {_scope, _stage, _type}={})
{
    const {scope, stage, key, a, m, type} = eff;
    if (scope && scope !== _scope) {return;} // 條件不符，跳過
    if (stage && stage !== _stage) {return;} // 條件不符，跳過
    if (_type && type !== _type) {return;} // 條件不符，跳過

    if(GM.BASE.includes(key)) // 基礎屬性
    {        
        if(a) { mods.basA[key] = (mods.basA[key] || 0) + a };
        if(m) { mods.basM[key] = (mods.basM[key] || 0) + m };
    }
    else    // 次級屬性、抗性
    {
        if(a) { mods.derA[key] = (mods.derA[key] || 0) + a };
        if(m) { mods.derM[key] = (mods.derM[key] || 0) + m };
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

function _getMods(bb, attacker, skill, stage)
{
    const mods={ basA:{}, basM:{}, derA:{}, derM:{} }

    // 1. from equips
    bb.equips.forEach(eq=>{
        if(!eq) {return;}
        const dat = DB.item(eq.id??eq);
        dat?.mods?.forEach(eff=>_calcMods(eff, mods,{_scope:'self'}))
        dat?.effects?.forEach(eff=>_calcMods(eff, mods, {_scope:'self', _stage:stage, _type:'mod'}));
    });

    // 2. from active effects
    bb.actives.forEach(eff=>_calcMods(eff, mods));

    // 3. from attacker
    attacker?.effs.forEach(eff=>_calcMods(eff, mods, {_scope:'target', _stage:'atk', _type:'mod'}));

    return mods;
}

function _getEffs(bb, skill)
{
    const effs=[];
    // from equips
    bb.equips.forEach(eq=>{
        if(!eq) {return;}
        const dat = DB.item(eq.id??eq);
        dat?.effects?.forEach(eff=>effs.push(eff));
    });

    // from skill
    skill?.effects?.forEach(eff=>effs.push(eff));

    return effs;
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
    for (const [k, v] of Object.entries(mods.basA)) {base[k] = (base[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.basM)) {base[k] = (base[k] || 0) * (1 + v);}
}

function _adjustDerived(total, mods)
{
    for (const [k, v] of Object.entries(mods.derA)) {total[k] = (total[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.derM)) {total[k] = (total[k] || 0) * (1 + v);}
}

function _getStats(base, mods, meta, effs)
{
    // 1. adjust Base
    for (const [k, v] of Object.entries(mods.basA)) {base[k] = (base[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.basM)) {base[k] = (base[k] || 0) * (1 + v);}

    // 2. get Derived from adjusted Base
    const derived = _derivedStats(base,meta);

    // 3. adjust Derived
    for (const [k, v] of Object.entries(mods.derA)) {derived[k] = (derived[k] || 0) + v;}
    for (const [k, v] of Object.entries(mods.derM)) {derived[k] = (derived[k] || 0) * (1 + v);}

    // 4. 合併：base 值優先，derived 補空位
    return {...derived,...base, effs};

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

        this._states = {
            [GM.HP]:_baseHPMAX(this.baseStats),
            [GM.HUNGER]:0,  // max:100%
            [GM.THIRST]:0,  // max:100%
            [GM.STUN]: false,
        };
        this._actives = [];     // 作用中的 effects
        this._dirty = true;     // 標記屬性需要重算
    }

    get tag() { return 'stats'; }


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _setDirty() {this._dirty = true;}


    _getTotalStats({attacker, stage, skill}={})
    {
        // stage: attack/hit

        // 有參數傳入，強制重算
        if(attacker || stage || skill) {this._dirty = true;} 
        // 已經是最新的，直接回傳
        if(!this._dirty) {return this._total;} 
        // 重算後，標記為最新
        this._dirty = false; 

        const {bb} = this.ctx;
        
        // 取得裝備基本屬性，如:攻擊、防禦、攻擊類型、距離...等
        const meta = _metaOfEquips(bb.equips);

        // 1) 淺層拷貝 [基礎屬性]
        const base = {...this.baseStats};

        // 2) 計算 [裝備/技能] mods
        dlog(T.NORMAL,bb.id)('stage:', stage,'attacker:', attacker);
        const mods = _getMods(bb, attacker, skill, stage);

        // 3) 取得 [裝備/技能] effs
        const effs = _getEffs(bb, skill, stage);

        // 6) 取得 stats
        const stats = _getStats(base, mods, meta, effs);

        // 10) 最後合併狀態，並確保當前生命值不超過最大值
        this._states[GM.HP] = Math.min(stats[GM.HPMAX], this._states[GM.HP]);
        stats.states = this._states;
        
        // 11) 儲存 stats
        this._total = stats;

        dlog(T.NORMAL,bb.id)(mods, effs, stats);
        
        return stats;







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
        const {root,emit}=this.ctx;

        root.addFavor?.(dmg.attacker?.id, -50);  // 受攻擊，降低好感度

        switch(dmg.type)
        {
            case GM.CRI:
                root.popup?.(`${'暴擊'} ${dmg.amount}`, '#f00', '#fff');
                this._states[GM.HP] = Math.max(0, this._states[GM.HP]+dmg.amount); 
                // console.log(`${this.name} 受到 ${dmg.amount} 暴擊傷害`);
                break;
            case GM.EVA:
                root.popup?.(GM.EVA.lab(), '#0f0', '#000');
                break;
            case GM.MISS:
                root.popup?.(GM.MISS.lab(), '#0f0', '#000');
                break;
            default:
                root.popup?.(dmg.amount, '#f00', '#fff');
                this._states[GM.HP] = Math.max(0, this._states[GM.HP]+dmg.amount); 
                // console.log(`${this.name} 受到 ${dmg.amount} 傷害`);
        }

        emit('damage');
        this._states[GM.HP]===0 && emit('ondead');
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
                dlog()(`${this.name} 的 ${proc.stat || proc.tag} ${proc.type} 效果結束`);
                this._setDirty();
                return false;
            }
            return true;
        });

    }

    _addEffs(effs,scope,stage,ctx)
    {
        this._tmp=[];
        effs.forEach(eff=>{
            if(eff.type==='mod') {return;}                  // mod，跳過
            if(eff.scope && eff.scope!==scope) {return;}    // scope 條件不符，跳過
            if(eff.stage && eff.stage!==stage) {return;}    // stage 條件不符，跳過
            if(eff.type === 'action')
            {
                if(eff.id==='lifesteal')
                {
                    const heal = Math.floor(ctx.dmg * (eff.m ?? 0))  ;
                    this._heal(heal);
                }
            }
            else
            {
                // 先暫存，等回合結束再加入 _actives，避免剛加入就被處理
                const { stage, scope, ...rest} = eff;
                const active = {...rest, remaining:eff.dur};
                this._tmp.push(active); 
            }
        });
    }

    _processEffs_TurnStart()
    {
        const{root}=this.ctx;

        // 1. 每回合開始先清除眩暈狀態，確保角色不會永久眩暈
        this._states[GM.STUN] = false;
        root.pop?.();

        // 2. 處理作用中的效果
        this._actives.forEach((eff)=>{
            switch(eff.type)
            {
                case GM.DOT:
                {
                    let dmg = eff.a ?? (eff.m ?? 0) * this._total[GM.HPMAX];
                    if (eff.elm) 
                    {
                        const resist = this._total.resists?.[RESIST_MAP[eff.elm]] || 0;
                        dmg *= 1 - resist;
                    }
                    this._takeDamage({amount:dmg});
                    eff.remaining -= 1;
                    break;
                }
                case GM.HOT:
                {
                    const heal = eff.a ?? (eff.m ?? 0) * this._total[GM.HPMAX];
                    this._heal(heal);
                    eff.remaining -= 1;
                    break;
                }
                case GM.DEBUFF:
                case GM.BUFF:
                {
                    if (eff.id === 'stun')
                    {
                        // 眩暈：跳過下一次行動
                        root.pop?.('💫',{duration:0});
                        this._states[GM.STUN] = true;
                    }
                    break;
                }
            }
        });

        // 移除過期效果
        const{bb}=this.ctx;
        this._actives = this._actives.filter(eff => {
            if (eff.remaining <= 0) {
                dlog(T.NORMAL,bb.id)(`${eff.key || eff.id} ${eff.type} 效果結束`);
                if(eff.type==='buff'||eff.type==='debuff') {this._setDirty();}
                return false;
            }
            return true;
        });

    }

    _processEffs_TurnEnd()
    {
        // 回合結束處理

        // remaining-1 及 移除過期效果
        const{bb}=this.ctx;
        this._actives = this._actives.filter(eff => {
            if(eff.type===GM.BUFF||eff.type===GM.DEBUFF) {eff.remaining -= 1;}
            if (eff.remaining <= 0) 
            {
                dlog(T.NORMAL,bb.id)(`${eff.key || eff.id} ${eff.type} 效果結束`);
                if(eff.type==='buff'||eff.type==='debuff') {this._setDirty();}
                return false;
            }
            return true;
        });

        // 處理新加入的效果
        this._tmp?.forEach(eff=>{
            this._setDirty();
            this._actives.push(eff);
        });
        this._tmp=[];
    }

    _updateStates()
    {
        const{bb}=this.ctx;
        if(bb.meta.survival)
        {
            this._states[GM.HUNGER]=Math.min(this._states[GM.HUNGER]+0.05,100);
            this._states[GM.THIRST]=Math.min(this._states[GM.THIRST]+0.25,100);
        }
    }

    // _update(dt=1)
    // {
    //     while(dt>0)
    //     {
    //         // this._processProcs();
    //         const{bb}=this.ctx;
    //         dlog(T.NORMAL,bb.id)('update');
    //         this._processEffs_TurnStart();
    //         this._updateStates();
    //         dt--;
    //     }
    // }

    _turnStart()
    {
        const{bb}=this.ctx;
        dlog(T.NORMAL,bb.id)('turnStart');
        this._processEffs_TurnStart();
        this._updateStates();   
    }

    _turnEnd()
    {
        const{bb}=this.ctx;
        dlog(T.NORMAL,bb.id)('turnEnd');
        this._processEffs_TurnEnd();
    }

    // amount = number or {a,m}
    _heal(amount)
    {
        if(typeof amount!=='number')
        {
            amount = (amount.a??0) + (amount.m??0)*this._total[GM.HPMAX];
        }
        const {root}=this.ctx;
        this._states[GM.HP] = Math.min(this._total[GM.HPMAX], this._states[GM.HP]+amount); 
        root.popup?.(`+${amount}`, '#0f0', '#000');
        // console.log(`${this.name} 回復 ${amount} 點生命`);
    }

    _eat(amount)
    {
        if(typeof amount!=='number')
        {
            amount = (amount.a??0) + (amount.m??0)*100;
        }
        const {send,bb}=this.ctx;
        this._states[GM.HUNGER] = Math.max(0, this._states[GM.HUNGER]+amount); 
        send('msg',`${bb.id} ${amount}% 飢餓`)
    }

    _drink(amount=-50)
    {
        if(typeof amount!=='number')
        {
            amount = (amount.a??0) + (amount.m??0)*100;
        }
        const {send,bb}=this.ctx;
        this._states[GM.THIRST] = Math.max(0, this._states[GM.THIRST]+amount);
        send('msg',`${bb.id} ${amount}% 口渴`)
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
        // this.addP(root, 'total', {get:this._getTotalStats.bind(this)});
        // this.addP(root, 'actives', {target:this, key:'_actives'});
        // this.addP(root, 'isAlive', {get:()=>this._states[GM.HP]>0});
        this.addRt('total', {get:this._getTotalStats.bind(this)});
        this.addRt('actives');
        this.addBB('actives');
        this.addRt('isAlive', {get:()=>this._states[GM.HP]>0});
        root.addProcs = this._addProcs.bind(this);
        root.addEffs = this._addEffs.bind(this);
        root.takeDamage = this._takeDamage.bind(this);
        root.getTotalStats = this._getTotalStats.bind(this);
        root.drink = this._drink.bind(this);
        root.heal = this._heal.bind(this);
        root.setDirty = this._setDirty.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on('turnstart', this._turnStart.bind(this) );
        root.on('turnend', this._turnEnd.bind(this) );

        // 計算總屬性
        this._getTotalStats();
   
    }

    

    
}
