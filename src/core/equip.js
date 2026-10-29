// 角色的 sex（role.json，沒寫＝'m'）在 equip 裡有同名覆寫（如 equip.f）就蓋掉 scale/x/y，其他欄位共用
export const equipFor = (equip, sex) => equip?.[sex] ? {...equip, ...equip[sex]} : equip;
