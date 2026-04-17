import {GM, RESIST_MAP} from './setting.js'
import {T,dlog} from '../core/debug.js'

// export { computeDamage };

// systems/combat.js
// 傷害型別：'phys' | 'fire' | 'ice' | 'poison' ...
// skill = { power:1.0, element:'phys', kind:'melee'|'ranged'|'magic', flat?:0, ignoreDef?:0 }

function _checkHit(aStats, dStats, skill)
{   
    let acc = aStats[GM.ACC] + (skill?.dat?.self?.hit??0); 
    let eva = dStats[GM.EVA] + (skill?.dat?.target?.dodge??0);
    let rnd = Math.random();
    if(rnd >= acc) {return {amount:0, type:GM.MISS};}
    else if(rnd >= (acc-eva)) {return {amount:0, type:GM.EVA};}
}

export function computeDamage(attacker, defender, skill={}) 
{
    const cond = skill?.type??'attack';
    const aStats = attacker.getTotalStats({stage:'atk', skill:skill});
    const dStats = defender.getTotalStats({attacker:aStats});
    dlog(T.COMBAT)(aStats,dStats)

    // 計算是否命中
    const ret = _checkHit(aStats, dStats, skill);
    if(ret) {return ret;}

    // 計算 effs
    defender.addEffs(aStats.effs, 'target', 'hit');

    // 計算傷害
    let type = GM.HIT;
    let dmg = aStats[skill?.src??GM.ATK] || 0; // 基本攻擊
    let elm = skill?.elm ?? GM.PHY;    // 攻擊屬性
    let pow = skill?.pow ?? 1;         // 傷害倍率
    let pen = skill?.pen ?? 0;         // 防禦穿透率(penetrate)
    let flat = skill?.flat ?? 0;       // 固定傷害

    // 1. 計算基礎傷害
    let baseDamage = dmg * pow + flat;

    // 2. 計算防禦係數
    const effectiveDef = dStats.def * (1 - pen);
    let defFactor = baseDamage / (baseDamage + effectiveDef);

    // 3. 計算實際傷害
    let damage = baseDamage * defFactor;

    // 4. 計算抗性
    const resist = dStats.resists?.[RESIST_MAP[elm]] || 0;
    damage *= 1 - resist;

    // 5. 計算暴擊
    if (Math.random() < aStats[GM.CRI]) 
    {
        damage *= aStats[GM.CRD];
        dlog(T.COMBAT)(`💥 ${attacker.name} 暴擊！`);
        type = GM.CRIT;
    }

    // 6. 浮動傷害(0.85 ~ 1.05)
    damage *= 0.95 + Math.random() * 0.1;
    damage = Math.round(Math.max(1, damage))

    attacker.addEffs(aStats.effs, 'self', 'hit', {dmg:damage});

    return {amount:-damage, type:type, attacker:attacker};

}

export function computeHealing(caster, skill) 
{
    const stats = caster.getTotalStats({stage:'cast', skill:skill});
    dlog(T.COMBAT)(stats);

    // 計算 effs
    caster.addEffs(stats.effs, 'self', 'cast');

    // 計算治療量
    let base = stats[skill?.src??GM.INT] || 0;  // 基本治療
    let pow = skill?.pow ?? 1;                  // 治療倍率
    let flat = skill?.flat ?? 0;                // 固定治療
    let amount = base * pow + flat;

    return amount;
}

// export function computeHealing(healer, skill) 
// {
//     const cond = skill?.type??'heal';
//     const stats = healer.getTotalStats({condition:cond, skill:skill});
//     dlog(T.COMBAT)(stats);

//     // 計算 Procs
//     let procs = [...stats.procs.self]
//     procs.forEach((proc)=>{healer.addProcs(proc);});

//     // 計算治療量
//     let base = stats[skill?.src??GM.INT] || 0;  // 基本治療
//     let pow = skill?.pow ?? 1;                  // 治療倍率
//     let flat = skill?.flat ?? 0;                // 固定治療
//     let amount = base * pow + flat;

//     return amount;
// }






// _calculateDamage(attacker, defender, skill) 
// {
//     // console.log('skill------------------',skill?.dat)
//     const aStats = attacker.getTotalStats();
//     const dStats = defender.getTotalStats(aStats.mTarget);
//     console.log(aStats,dStats)

//     // 計算是否命中
//     let hit = aStats[GM.HIT] + (skill?.dat?.self?.hit??0); 
//     let dodge = dStats[GM.DODGE] + (skill?.dat?.target?.dodge??0);
//     let rnd = Math.random();
//     // console.log('---------------------------------',rnd,hit,hit-dodge)
//     if(rnd >= hit) {return {amount:0, type:GM.MISS};}
//     else if(rnd >= (hit-dodge)) {return {amount:0, type:GM.DODGE};}


//     // 計算 Effect
//     let effs = [...aStats.mTarget.effs,...(skill?.dat?.effects??[])]
//     // console.log('---------------effs',effs)
//     for(const effect of effs)
//     {
//         defender.addEffect(effect,['dot','debuff']);
//     }

//     // for(const effect of aStats.mTarget.effs)
//     // {
//     //     defender.addEffect(effect,['dot','debuff']);
//     // }

//     // for(const effect of skill?.dat?.effects??[])
//     // {
//     //     defender.addEffect(effect,['dot','debuff']);
//     // }

//     // 計算傷害
//     let type = 'normal';
//     let atk = aStats[GM.ATK] || 0;          // 基本攻擊
//     let elm = skill?.dat?.elm ?? GM.PHY;    // 攻擊屬性
//     let mul = skill?.dat?.mul ?? 1;         // 傷害倍率
//     let penetrate = skill?.dat?.pen ?? 0;   // 防禦穿透率

//     // 1. 計算基礎傷害
//     let baseDamage = atk * mul;
//     // 2. 計算防禦係數
//     const effectiveDef = dStats.def * (1 - penetrate);
//     let defFactor = baseDamage / (baseDamage + effectiveDef);
//     // 3. 計算實際傷害
//     let damage = baseDamage * defFactor;
//     // const resist = dStats.resists?.[elm+'_res'] || 0;
//     const resist = dStats.resists?.[RESIST_MAP[elm]] || 0;
//     damage *= 1 - resist;
//     // 4. 計算暴擊
//     if (Math.random() < aStats[GM.CRITR]) 
//     {
//         damage *= aStats[GM.CRITD];
//         console.log(`💥 ${attacker.name} 暴擊！`);
//         type = GM.CRIT;
//     }
//     // 5. 浮動傷害(0.85 ~ 1.05)
//     damage *= 0.95 + Math.random() * 0.1;
//     damage = Math.round(Math.max(1, damage))

//     return {amount:damage, type:type};
// }
