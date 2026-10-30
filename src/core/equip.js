// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
export const equipFor = (equip, sex) => equip?.[sex] ? {...equip, ...equip[sex]} : equip;

// 角色的部位（role.body 之類）寫的是 part.json 的 id，女角同樣套 f
export const ROLE_PARTS = ['body', 'shoes', 'cloth', 'head', 'hair', 'hand'];
export const partFor = (parts, r, kind) => r?.[kind] ? equipFor(parts?.[r[kind]], r.sex) : undefined;

// 穿著的裝備（有 equip 的道具）會藏掉哪些部位：hideHair 藏頭髮、任何護甲藏衣服、任何靴子藏鞋子
// cat 是分類常數（遊戲傳 GM.CAT，工具傳 {CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS'}）
export function hiddenParts(items, cat)
{
    const out = new Set();
    for (const it of items)
    {
        if (!it?.equip) continue;
        if (it.equip.hideHair) out.add('hair');
        if (it.cat === cat.CHESTPLATE) out.add('cloth');
        if (it.cat === cat.BOOTS) out.add('shoes');
    }
    return out;
}
