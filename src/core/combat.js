import {GM, RESIST_MAP} from '../setting.js';

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
    const aStats = attacker.getTotalStats();
    const dStats = defender.getTotalStats(aStats.enemy);
    console.log(aStats,dStats)

    const element = skill.element || GM.PHY;
    const kind = skill.kind || GM.MELEE;
    const power = skill.power ?? 1.0;
    const flat  = skill.flat  ?? 0;
    const ignoreDef = skill.ignoreDef ?? 0; // 0~1

    // 計算是否命中
    const ret = _checkHit(aStats, dStats, skill);
    if(ret) {return ret;}

    // 計算 Effect
    let procs = [...aStats.enemy.procs]
    procs.forEach((proc)=>{defender.addProcs(proc);});

    // 計算傷害
    let type = GM.HIT;
    let atk = aStats[GM.ATK] || 0;          // 基本攻擊
    let elm = skill?.dat?.elm ?? GM.PHY;    // 攻擊屬性
    let pow = skill?.dat?.mul ?? 1;         // 傷害倍率
    let pen = skill?.dat?.pen ?? 0;         // 防禦穿透率(penetrate)

    // 1. 計算基礎傷害
    let baseDamage = atk * pow;
    // 2. 計算防禦係數
    const effectiveDef = dStats.def * (1 - pen);
    let defFactor = baseDamage / (baseDamage + effectiveDef);
    // 3. 計算實際傷害
    let damage = baseDamage * defFactor;
    const resist = dStats.resists?.[RESIST_MAP[elm]] || 0;
    damage *= 1 - resist;
    // 4. 計算暴擊
    if (Math.random() < aStats[GM.CRITR]) 
    {
        damage *= aStats[GM.CRITD];
        console.log(`💥 ${attacker.name} 暴擊！`);
        type = GM.CRIT;
    }
    // 5. 浮動傷害(0.85 ~ 1.05)
    damage *= 0.95 + Math.random() * 0.1;
    damage = Math.round(Math.max(1, damage))


    return {amount:damage, type:type};

}








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
