// item.json 的欄位定義：表單、總覽表、檢查都看這份；沒列到的 key 不會被丟掉（道具層級進原始 JSON 區、effect 進額外欄位）
// type：text / textarea / int / num / bool / enum（下拉，options 固定）/ list（自由輸入＋建議）/ tags（字串陣列）
//       icon / sprite（選圖器）/ itemref（道具 id）/ color（0xRRGGBB 整數）/ obj（fields 子欄位）/ map（道具 id → 數量）/ effects

export const CATS = ['CAT_WEAPON', 'CAT_HELMET', 'CAT_CHESTPLATE', 'CAT_GLOVES', 'CAT_BOOTS', 'CAT_NECKLACE', 'CAT_RING',
                     'CAT_EQUIP', 'CAT_BAG', 'CAT_FOOD', 'CAT_ITEM', 'CAT_DEVICE'];

export const CAT_NAMES = {
    CAT_WEAPON: '武器', CAT_HELMET: '頭盔', CAT_CHESTPLATE: '胸甲', CAT_GLOVES: '手套', CAT_BOOTS: '靴子',
    CAT_NECKLACE: '項鍊', CAT_RING: '戒指', CAT_EQUIP: '裝備', CAT_BAG: '背包', CAT_FOOD: '食物', CAT_ITEM: '道具', CAT_DEVICE: '裝置',
};

export const STATS = ['str', 'dex', 'con', 'int', 'luk', 'hpMax', 'atk', 'def', 'range', 'acc', 'eva', 'cri', 'crd', 'pen',
                      'phy_res', 'fire_res', 'ice_res', 'poison_res', 'hp', 'hunger', 'thirst'];

const SPRITE = {
    sprite: {label: 'sprite', type: 'sprite'},
    scale: {label: 'scale', type: 'num'},
    x: {label: 'x', type: 'num'},
    y: {label: 'y', type: 'num'},
    a: {label: 'a', type: 'num'},
    ox: {label: 'ox', type: 'num'},
    oy: {label: 'oy', type: 'num'},
};

export const FIELDS = {
    lab: {label: '名稱', type: 'text'},
    cat: {label: '分類', type: 'enum', options: ['', ...CATS], names: CAT_NAMES},
    icon: {label: 'icon', type: 'icon'},
    gold: {label: '價格', type: 'int'},
    des: {label: '說明', type: 'textarea'},
    type: {label: '攻擊類型', type: 'enum', options: ['', 'melee', 'ranged'], names: {melee: '近戰', ranged: '遠程'}},
    atk: {label: '攻擊', type: 'num'},
    def: {label: '防禦', type: 'num'},
    range: {label: '射程', type: 'int'},
    cat_sub: {label: '子類別', type: 'tags', suggest: ['sword', 'axe', 'bow']},
    useable: {label: '可使用', type: 'bool'},
    cps: {label: '堆疊數', type: 'int'},
    keep: {label: '用完保留', type: 'bool'},
    capacity: {label: '容量', type: 'int'},
    dft: {label: '初始量', type: 'int'},
    times: {label: '使用次數', type: 'int'},
    endurance: {label: '耐久', type: 'int'},
    storage: {label: '格數', type: 'int'},
    equip: {label: '裝備圖', type: 'obj', fields: {...SPRITE, hideHair: {label: '藏頭髮', type: 'bool'}}},
    drop: {label: '掉落圖', type: 'obj', fields: SPRITE},
    light: {label: '光源', type: 'obj', fields: {color: {label: '顏色', type: 'color'}, radius: {label: '半徑', type: 'int'}}},
    cook: {label: '烹煮成', type: 'obj', fields: {id: {label: 'id', type: 'itemref'}}},
    make: {label: '製作材料', type: 'obj', fields: {items: {label: '材料', type: 'map'}}},
    device: {label: '裝置', type: 'obj', fields: {class: {label: 'class', type: 'list', suggest: ['pot', 'dummy']}}},
    effects: {label: '效果', type: 'effects'},
};

export const BASE = ['lab', 'cat', 'icon', 'gold', 'des'];

const ARMOR = ['def', 'equip', 'drop', 'effects'];
export const CAT_FIELDS = {
    CAT_WEAPON: ['type', 'atk', 'range', 'cat_sub', 'equip', 'effects'],
    CAT_HELMET: ARMOR, CAT_CHESTPLATE: ARMOR, CAT_GLOVES: ARMOR, CAT_BOOTS: ARMOR,
    CAT_NECKLACE: ['def', 'effects'], CAT_RING: ['def', 'effects'],
    CAT_EQUIP: ['endurance', 'light', 'equip'],
    CAT_BAG: ['storage'],
    CAT_FOOD: ['useable', 'cps', 'effects', 'cook', 'make'],
    CAT_ITEM: ['cps', 'useable', 'effects', 'drop'],
    CAT_DEVICE: ['device'],
};

// 表單要顯示的欄位：基本＋這個分類建議的＋已經有值的已知欄位
export function shownFields(item)
{
    const keys = new Set([...BASE, ...(CAT_FIELDS[item.cat] ?? []), ...Object.keys(item).filter(k => FIELDS[k])]);
    return Object.keys(FIELDS).filter(k => keys.has(k));
}

// ---------- effects ----------
export const EFF_FIELDS = {
    type: {label: '類型', type: 'enum', options: ['', 'mod', 'buff', 'debuff', 'dot', 'hot', 'action'],
           names: {'': '使用', mod: '屬性修正', buff: '增益', debuff: '減益', dot: '持續傷害', hot: '持續治療', action: '動作'}},
    stage: {label: '時機', type: 'enum', options: ['', 'atk', 'hit'], names: {'': '常駐', atk: '攻擊時', hit: '命中時'}},
    scope: {label: '對象', type: 'enum', options: ['', 'self', 'target'], names: {'': '—', self: '自己', target: '目標'}},
    key: {label: '屬性', type: 'list', suggest: STATS},
    a: {label: '固定值 a', type: 'num'},
    m: {label: '倍率 m', type: 'num'},
    dur: {label: '回合', type: 'int'},
    stack: {label: '堆疊上限', type: 'int'},
    chance: {label: '機率', type: 'num'},
    ctrl: {label: '控制', type: 'bool'},
    elm: {label: '元素', type: 'enum', options: ['', 'phy', 'fire', 'ice', 'poison'], names: {phy: '物理', fire: '火', ice: '冰', poison: '毒'}},
    id: {label: 'id', type: 'list', suggest: ['lifesteal']},
    icon: {label: '圖示', type: 'text'},
};

const BUFF = ['stage', 'scope', 'key', 'a', 'm', 'dur', 'stack', 'chance', 'ctrl', 'id', 'icon'];
const DOT = ['stage', 'scope', 'elm', 'a', 'm', 'dur', 'stack', 'chance', 'id', 'icon'];
export const EFF_BY_TYPE = {
    '': ['scope', 'key', 'a', 'm'],
    mod: ['stage', 'scope', 'key', 'a', 'm'],
    buff: BUFF, debuff: BUFF,
    dot: DOT, hot: DOT,
    action: ['stage', 'scope', 'key', 'a', 'm', 'chance', 'id'],
};

export function effFields(eff)
{
    const keys = new Set(['type', ...(EFF_BY_TYPE[eff.type ?? ''] ?? []), ...Object.keys(eff).filter(k => EFF_FIELDS[k])]);
    return Object.keys(EFF_FIELDS).filter(k => keys.has(k));
}

const PCT = ['acc', 'eva', 'cri', 'pen', 'phy_res', 'fire_res', 'ice_res', 'poison_res'];
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);
const pct = (v) => `${signed(Math.round(v * 1000) / 10)}%`;

// 一行人話摘要（卡片標題、總覽表用），不是遊戲裡的說明文字
export function effSummary(e)
{
    const name = (f, v) => EFF_FIELDS[f].names?.[v] ?? v;
    const num = e.a !== undefined ? (PCT.includes(e.key) ? pct(e.a) : signed(e.a)) : e.m !== undefined ? pct(e.m) : '';
    const what = [e.key, e.elm && name('elm', e.elm), num].filter(Boolean).join(' ');
    return [
        e.stage && name('stage', e.stage),
        e.scope && `對${name('scope', e.scope)}`,
        `${name('type', e.type ?? '')}${e.id ? ` ${e.icon ?? ''}${e.id}` : ''}${what ? ` ${what}` : ''}`,
        e.dur !== undefined && `${e.dur} 回合`,
        e.stack !== undefined && `最多 ${e.stack} 層`,
        e.chance !== undefined && `${Math.round(e.chance * 100)}% 機率`,
        e.ctrl && '控制',
    ].filter(Boolean).join('・');
}

// ---------- 總覽表 ----------
// cats: null＝全部、[]＝沒有 cat 的；'#eff' 是 effects 摘要（唯讀）
export const TABS = [
    {label: '全部', cats: null, cols: ['lab', 'cat', 'icon', 'gold']},
    {label: '武器', cats: ['CAT_WEAPON'], cols: ['lab', 'icon', 'gold', 'type', 'atk', 'range', 'cat_sub', '#eff']},
    {label: '防具', cats: ['CAT_HELMET', 'CAT_CHESTPLATE', 'CAT_GLOVES', 'CAT_BOOTS'], cols: ['lab', 'icon', 'cat', 'gold', 'def', '#eff']},
    {label: '飾品', cats: ['CAT_NECKLACE', 'CAT_RING'], cols: ['lab', 'icon', 'cat', 'gold', 'def', '#eff']},
    {label: '食物', cats: ['CAT_FOOD'], cols: ['lab', 'icon', 'gold', 'cps', 'useable', '#eff']},
    {label: '道具', cats: ['CAT_ITEM', 'CAT_BAG', 'CAT_EQUIP'], cols: ['lab', 'icon', 'cat', 'gold', 'cps', 'useable', 'storage', 'capacity', 'times', 'endurance', '#eff']},
    {label: '裝置', cats: ['CAT_DEVICE'], cols: ['lab', 'icon', 'gold']},
    {label: '其他', cats: [], cols: ['lab']},
];

export const inTab = (tab, item) => !tab.cats || (tab.cats.length ? tab.cats.includes(item.cat) : !item.cat);

// ---------- 道具 id 的引用（改名時一起改、刪除時警告） ----------
// 每個 ref 給 get(item) → 引用到的 id 陣列、set(item, from, to)
export const ITEM_REFS = [
    {path: 'cook.id', get: (it) => [it.cook?.id], set: (it, a, b) => {if (it.cook?.id === a) it.cook.id = b;}},
    {path: 'bb.harvest.id', get: (it) => [it.bb?.harvest?.id], set: (it, a, b) => {if (it.bb?.harvest?.id === a) it.bb.harvest.id = b;}},
    {path: 'make.items', get: (it) => Object.keys(it.make?.items ?? {}), set: (it, a, b) => {
        const m = it.make?.items;
        if (m && a in m) it.make.items = Object.fromEntries(Object.entries(m).map(([k, v]) => [k === a ? b : k, v]));
    }},
];

// 新道具的初始內容
export const template = (cat) => ({...(cat && {cat}), gold: 0, lab: '新道具'});
