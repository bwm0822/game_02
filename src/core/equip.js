// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
export const equipFor = (equip, sex) => equip?.[sex] ? {...equip, ...equip[sex]} : equip;

// 角色的部位（role.body 之類）寫的是 part.json 的 id，女角同樣套 f
export const ROLE_PARTS = ['body', 'shoes', 'cloth', 'head', 'hair', 'handF', 'handB'];
export const partFor = (parts, r, kind) => r?.[kind] ? equipFor(parts?.[r[kind]], r.sex) : undefined;

// body 條目上的支點（neck／wristF／wristB），沒寫＝(0,0)；body 已經套過 f
export const PIVOTS = ['neck', 'wristF', 'wristB'];
export const pivotOf = (body, k) => ({x: body?.[k]?.x ?? 0, y: body?.[k]?.y ?? 0});

// 穿著的裝備（有 equip 的道具）會藏掉哪些部位：hideHair 藏頭髮、任何護甲藏衣服、任何靴子藏鞋子、任何手套藏兩隻手
// cat 是分類常數（遊戲傳 GM.CAT，工具傳 {CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS', GLOVES: 'CAT_GLOVES'}）
export function hiddenParts(items, cat)
{
    const out = new Set();
    for (const it of items)
    {
        if (!it?.equip) continue;
        if (it.equip.hideHair) out.add('hair');
        if (it.cat === cat.CHESTPLATE) out.add('cloth');
        if (it.cat === cat.BOOTS) out.add('shoes');
        if (it.cat === cat.GLOVES) {out.add('handF'); out.add('handB');}
    }
    return out;
}
