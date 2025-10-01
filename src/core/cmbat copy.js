// systems/combat.js
// 傷害型別：'phys' | 'fire' | 'ice' | 'poison' ...
// skill = { power:1.0, element:'phys', kind:'melee'|'ranged'|'magic', flat?:0, ignoreDef?:0 }
export function computeDamage(attacker, defender, skill={}) 
{
    const aStats = attacker.coms?.stats ?? attacker.stats ?? attacker; // 保守取法
    const dStats = defender.coms?.stats ?? defender.stats ?? defender;
    const element = skill.element || 'phys';
    const kind = skill.kind || 'melee';
    const power = skill.power ?? 1.0;
    const flat  = skill.flat  ?? 0;
    const ignoreDef = skill.ignoreDef ?? 0; // 0~1

    // --- 1) 攻擊力：基礎 + 武器 ---
    // 你的規則：近戰 atk = base_atk + weapon_atk；遠程 atk = weapon_atk
    // 這裡假設 attacker.weapon = { atk, ranged:boolean, magic?:boolean }
    const w = attacker.weapon ?? { atk: 0, ranged:false, magic:false };

    let baseATK = 0;
    if (kind === 'melee') baseATK = aStats.baseMeleeATK + (w.atk||0);
    else if (kind === 'ranged') baseATK = (w.atk||0); // ranged 規則：只吃武器ATK
    else if (kind === 'magic') baseATK = aStats.baseMagicATK + (w.atk||0);

    let atk = Math.max(0, baseATK * power + flat);

    // --- 2) 防禦 ---
    let def = (element === 'phys') ? dStats.basePDEF : dStats.baseMDEF;
    def = Math.max(0, def * (1 - ignoreDef));

    // --- 3) 先算基礎傷害 ---
    let dmg = Math.max(1, atk - def);

    // --- 4) 屬性抗性 ---
    const res = defender.resists ? defender.resists() : (dStats.data?.res ?? {});
    const r = res[element] ?? 0; // 0.2=減20%，-0.5=多吃50%
    dmg *= (1 - r);

    // --- 5) 暴擊 ---
    const crit = Math.random() < (aStats.critRate ?? 0.05);
    if (crit) dmg *= (aStats.critMult ?? 1.5);

    // --- 6) 隨機浮動（±10%）---
    dmg *= (0.9 + Math.random() * 0.2);

    return { damage: Math.floor(dmg), crit };
}

export default { computeDamage };
