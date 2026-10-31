// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
export const equipFor = (equip, sex) => equip?.[sex] ? {...equip, ...equip[sex]} : equip;

// 角色的部位（role.body 之類）寫的是 part.json 的 id，女角同樣套 f
export const ROLE_PARTS = ['body', 'shoes', 'cloth', 'head', 'hair', 'handF', 'handB'];
export const partFor = (parts, r, kind) => r?.[kind] ? equipFor(parts?.[r[kind]], r.sex) : undefined;

// body 條目上的支點（neck／wristF／wristB）{x, y, a}，a＝節點靜止時的角度，沒寫＝0；body 已經套過 f
// held＝手上那把東西（武器，或暫拿的工具）的 equip：它的 wristF／wristB {x, y, a} 是疊在 body 支點上的位移，不分男女（不放 f）
export const PIVOTS = ['neck', 'wristF', 'wristB'];
export const WRISTS = ['wristF', 'wristB'];
export function pivotOf(body, k, held)
{
    const o = WRISTS.includes(k) ? held?.[k] : null;
    return {x: (body?.[k]?.x ?? 0) + (o?.x ?? 0), y: (body?.[k]?.y ?? 0) + (o?.y ?? 0), a: (body?.[k]?.a ?? 0) + (o?.a ?? 0)};
}
// 穿著的道具裡武器的 equip（只有武器的手腕位移會生效）；cat 同 hiddenParts
export const weaponOf = (items, cat) => items.find(it => it?.cat === cat.WEAPON)?.equip;

const rot = (x, y, deg) => {const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c];};
const still = (pv) => !pv.x && !pv.y && !pv.a;
// 掛在支點上的部位／裝備數字相對支點（繞支點轉 a）：atPivot 換成身體座標（靜態合成攤成一層時用），fromPivot 反過來
export function atPivot(p, pv)
{
    if (still(pv)) return p;
    const [x, y] = rot(p.x ?? 0, p.y ?? 0, pv.a);
    return {...p, x: pv.x + x, y: pv.y + y, a: (p.a ?? 0) + pv.a};
}
export function fromPivot(p, pv)
{
    if (still(pv)) return p;
    const [x, y] = rot((p.x ?? 0) - pv.x, (p.y ?? 0) - pv.y, -pv.a);
    return {...p, x, y, a: (p.a ?? 0) - pv.a};
}

// 穿著的裝備（有 equip 的道具）會藏掉哪些部位：hideHair 藏頭髮、任何護甲藏衣服、任何靴子藏鞋子、任何手套藏兩隻手
// cat 是分類常數（遊戲傳 GM.CAT，工具傳 {CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS', GLOVES: 'CAT_GLOVES', WEAPON: 'CAT_WEAPON'}）
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
