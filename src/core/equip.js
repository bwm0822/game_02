// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
// only＝道具／部位限定的性別（item.sex、part 條目的 sex，預設讀 equip.sex）：有寫就是畫給那個性別的，基準數字直接用、不套覆寫
export const equipFor = (equip, sex, only = equip?.sex) => !only && equip?.[sex] ? {...equip, ...equip[sex]} : equip;

// 道具／部位的 sex（'m'／'f'）限定誰能用，沒寫＝都能用
export const sexOk = (dat, sex) => !dat?.sex || dat.sex === (sex ?? 'm');

// 角色的部位（role.body 之類）寫的是 part.json 的 id，女角同樣套 f
export const ROLE_PARTS = ['body', 'shoes', 'cloth', 'head', 'hair', 'hat', 'handF', 'handB'];
export const partFor = (parts, r, kind) => r?.[kind] ? equipFor(parts?.[r[kind]], r.sex) : undefined;

// body 條目上的支點（neck／wristF／wristB）{x, y, a}，位置相對 rig（見 rigOf），a＝節點靜止時的角度，沒寫＝0；body 已經套過 f
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
// 手上那把東西掛在哪個手腕節點：equip.hand 'B'＝後手（如弓），沒寫＝前手；武器動畫也動這隻手
export const handOf = (held) => (held?.hand === 'B' ? 'wristB' : 'wristF');

const rot = (x, y, deg) => {const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c];};
const still = (pv) => !pv.x && !pv.y && !pv.a;
// 掛在支點上的部位／裝備數字相對支點（繞支點轉 a）：atPivot 換成 rig 座標，fromPivot 反過來
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

// rig＝body 條目的 x/y/a：身體圖（在 rig 的 0,0）、支點、其他部位都掛在 rig 上，數字相對 rig，調 body 的 x/y/a 整個人跟著動；scale/ox/oy 只套在身體圖
export const rigOf = (body) => ({x: body?.x ?? 0, y: body?.y ?? 0, a: body?.a ?? 0});
// 靜態合成攤成一層：部位數字（掛支點的相對支點、其他相對 rig）換成 shape 座標；body 自己的 x/y/a 就是 rig，不用換
export const flatPart = (p, body, node, held) => atPivot(node ? atPivot(p, pivotOf(body, node, held)) : p, rigOf(body));
export const unflatPart = (p, body, node, held) => {const q = fromPivot(p, rigOf(body)); return node ? fromPivot(q, pivotOf(body, node, held)) : q;};

// 穿著的裝備（有 equip 的道具）會藏掉哪些部位：hideHair 藏頭髮、任何頭盔藏帽子、任何護甲藏衣服、任何靴子藏鞋子、任何手套藏兩隻手
// hat＝角色的帽子條目：沒被頭盔藏掉時它的 hideHair 才生效
// cat 是分類常數（遊戲傳 GM.CAT，工具傳 {HELMET: 'CAT_HELMET', CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS', GLOVES: 'CAT_GLOVES', WEAPON: 'CAT_WEAPON'}）
export function hiddenParts(items, cat, hat)
{
    const out = new Set();
    for (const it of items)
    {
        if (!it?.equip) continue;
        if (it.equip.hideHair) out.add('hair');
        if (it.cat === cat.HELMET) out.add('hat');
        if (it.cat === cat.CHESTPLATE) out.add('cloth');
        if (it.cat === cat.BOOTS) out.add('shoes');
        if (it.cat === cat.GLOVES) {out.add('handF'); out.add('handB');}
    }
    if (hat?.hideHair && !out.has('hat')) out.add('hair');
    return out;
}
