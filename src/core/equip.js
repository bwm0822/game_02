// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
export const equipFor = (equip, sex) => equip?.[sex] ? {...equip, ...equip[sex]} : equip;

// 角色的部位（role.body 之類）寫的是 part.json 的 id，女角同樣套 f
export const ROLE_PARTS = ['body', 'head', 'hair', 'hand'];
export const partFor = (parts, r, kind) => r?.[kind] ? equipFor(parts?.[r[kind]], r.sex) : undefined;
