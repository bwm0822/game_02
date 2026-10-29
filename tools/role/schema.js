// role.json 的欄位定義：表單、總覽表、檢查都看這份；沒列到的 key（stats/states/weapon/type 這些遊戲沒在讀的）放「其他欄位」原樣保留
// type 跟道具編輯器共用 tools/common/form.js 的 fieldInput()；inv、schedule 是自己畫的
import AI from '../../src/components/ai/com_ai.js?raw';

export const KINDS = ['player', 'npc', 'rogue', 'monster', 'animal', 'boss'];
export const KIND_NAMES = {player: '玩家', npc: 'NPC', rogue: '盜賊', monster: '怪物', animal: '動物', boss: '頭目'};

// 性格：com_ai.js 的 wTBL 裡沒被註解掉的才算，行尾註解當說明
const wTBL = AI.match(/const wTBL\s*=\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
export const STYLES = Object.fromEntries([...wTBL.matchAll(/^\s*(\w+)\s*:\s*\{[^}]*\}[^\n]*?(?:\/\/\s*(.*))?$/gm)].map(([, k, note]) => [k, note?.trim() ?? '']));
export const STYLE_DEFAULT = 'passive_fighter';

export const JOBS = ['ranger', 'innkeeper', 'smith', 'trader', 'butcher', 'merchant', 'guard', 'rogue'];

export const STATS = ['str', 'dex', 'con', 'int', 'luk', 'hpMax', 'atk', 'def', 'range', 'acc', 'eva', 'cri', 'crd', 'pen',
                      'phy_res', 'fire_res', 'ice_res', 'poison_res'];

const XY = {x: {label: 'x', type: 'num'}, y: {label: 'y', type: 'num'}};
const LRTB = {l: {label: '左 l', type: 'num'}, r: {label: '右 r', type: 'num'}, t: {label: '上 t', type: 'num'}, b: {label: '下 b', type: 'num'}};
const PART = {
    sprite: {label: 'sprite', type: 'sprite'},
    scale: {label: 'scale', type: 'num'},
    x: {label: 'x', type: 'num'},
    y: {label: 'y', type: 'num'},
    a: {label: '角度 a', type: 'num'},
    ox: {label: 'ox', type: 'num'},
    oy: {label: 'oy', type: 'num'},
    ext: {label: '疊圖 ext', type: 'sprite'},
};

export const FIELDS = {
    kind: {label: '分類', type: 'enum', options: ['', ...KINDS], names: KIND_NAMES},
    loc: {label: '地點', type: 'list'},
    lab: {label: '名稱', type: 'text'},
    des: {label: '說明', type: 'textarea'},
    icon: {label: '頭像', type: 'icon'},
    job: {label: '職業', type: 'list'},
    gold: {label: '金錢', type: 'int'},
    style: {label: '性格', type: 'enum', options: ['', ...Object.keys(STYLES)],
            names: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, v || k]))},
    trade: {label: '可交易', type: 'bool'},
    unique: {label: '唯一（好感）', type: 'bool'},
    survival: {label: '會餓會渴', type: 'bool'},
    animal: {label: '動物（不開門）', type: 'bool'},
    attrs: {label: '天生屬性', type: 'obj', fields: Object.fromEntries(STATS.map(k => [k, {label: k, type: 'num'}]))},
    abilities: {label: '技能', type: 'tags'},
    meat: {label: '掉落肉', type: 'itemref'},
    skin: {label: '掉落皮', type: 'itemref'},
    fall: {label: '倒地角度', type: 'int'},
    faceR: {label: '圖朝右', type: 'bool'},
    sex: {label: '性別', type: 'enum', options: ['', 'm', 'f'], names: {'': '男（預設）', m: '男', f: '女'}},
    w: {label: '寬 w', type: 'int'},
    h: {label: '高 h', type: 'int'},
    anchor: {label: '錨點', type: 'obj', fields: XY},
    b: {label: '物理 b', type: 'obj', fields: LRTB},
    g: {label: '佔格 g', type: 'obj', fields: LRTB},
    z: {label: '互動區 z', type: 'obj', fields: LRTB},
    body: {label: '身體', type: 'obj', fields: PART},
    head: {label: '頭', type: 'obj', fields: PART},
    hair: {label: '頭髮', type: 'obj', fields: PART},
    hand: {label: '手', type: 'obj', fields: PART},
    corpse: {label: '屍體圖', type: 'obj', fields: PART},
    inv: {label: '物品欄', type: 'inv'},
    schedule: {label: '作息', type: 'schedule'},
};

// 遊戲畫角色一定要有的（RoleView 直接讀，沒有會出錯）
export const REQUIRED = ['w', 'h', 'anchor'];

export const SECTIONS = [
    {title: '基本', keys: ['kind', 'loc', 'lab', 'des', 'icon', 'job', 'gold', 'style', 'trade', 'unique', 'survival', 'animal']},
    {title: '戰鬥', keys: ['attrs', 'abilities', 'meat', 'skin', 'fall']},
    {title: '外觀', keys: ['faceR', 'sex','w', 'h', 'anchor', 'b', 'g', 'z', 'body', 'head', 'hair', 'hand', 'corpse']},
    {title: '物品', keys: ['inv']},
    {title: '作息', keys: ['schedule']},
];

const BASE = ['kind', 'lab', 'des', 'icon', 'faceR', 'w', 'h', 'anchor', 'b', 'g', 'z', 'body'];
const FIGHTER = ['job', 'gold', 'style', 'attrs', 'inv'];
export const KIND_FIELDS = {
    player: ['sex', 'job', 'gold', 'survival', 'inv', 'hand', 'head', 'hair'],
    npc: ['sex', 'loc', 'job', 'gold', 'style', 'trade', 'unique', 'inv', 'schedule'],
    rogue: FIGHTER, monster: FIGHTER, boss: FIGHTER,
    animal: ['style', 'animal', 'attrs', 'meat', 'skin', 'fall'],
};

// 表單要顯示的欄位：基本＋這個 kind 建議的＋已經有值的已知欄位
export function shownFields(r)
{
    const keys = new Set([...BASE, ...(KIND_FIELDS[r.kind] ?? []), ...Object.keys(r).filter(k => FIELDS[k])]);
    return Object.keys(FIELDS).filter(k => keys.has(k));
}

// ---------- 作息 ----------
export const SCH_FIELDS = ['t', 'map', 'go', 'do', 'route', 'wait'];
export const DO_NAMES = {'': '預設（目的地物件的動作）', idle: '站著', patrol: '巡邏'};

export function schSummary(s)
{
    const t = s.t ?? '';
    return `${t.startsWith('@') ? '抵達' : '出發'} ${t.replace(/^@/, '') || '??:??'} → ${s.map?.split('/').at(-1) ?? '?'}／${s.go ?? '?'}${s.do ? `（${DO_NAMES[s.do] ?? s.do}）` : ''}`;
}

// ---------- 預覽 ----------
// 跟 RoleView._addPart 的 _DEPTH 一樣（裝備依 item.json 的 cat）
export const DEPTH = {body: 0, head: 2, hair: 2.5, hand: 5, CAT_HELMET: 3, CAT_CHESTPLATE: 1, CAT_GLOVES: 6, CAT_BOOTS: 0.5, CAT_WEAPON: 4, ext: 6, back: 1.5};

// ---------- 總覽表 ----------
// kind: null＝全部；欄位可以是 attrs.atk 這種路徑；# 開頭是唯讀摘要
const FIGHT_COLS = ['lab', 'icon', 'gold', 'style', 'attrs.hpMax', 'attrs.atk', 'attrs.def', '#equips'];
export const TABS = [
    {label: '全部', kind: null, cols: ['lab', 'icon', 'kind', 'job', 'gold', 'style']},
    {label: '玩家', kind: 'player', cols: ['lab', 'icon', 'job', 'gold', 'survival', '#equips']},
    {label: 'NPC', kind: 'npc', cols: ['lab', 'icon', 'loc', 'job', 'gold', 'style', 'trade', 'unique', '#sch']},
    {label: '盜賊', kind: 'rogue', cols: FIGHT_COLS},
    {label: '怪物', kind: 'monster', cols: FIGHT_COLS},
    {label: '動物', kind: 'animal', cols: ['lab', 'icon', 'style', 'meat', 'skin', 'fall', 'attrs.hpMax', 'attrs.atk', 'attrs.def']},
    {label: '頭目', kind: 'boss', cols: FIGHT_COLS},
];

export const colDef = (c) => {const [a, b] = c.split('.'); return b ? FIELDS[a]?.fields?.[b] : FIELDS[a];};

// ---------- 新角色 ----------
const box = () => ({l: 0, r: 0, t: 32, b: 0});
const HUMAN = () => ({faceR: true, anchor: {x: 0, y: 16}, w: 32, h: 64, b: box(), g: box(), z: box(),
                      body: {sprite: 'body-man', scale: 0.25, y: 32}, hand: {sprite: 'hand-man', scale: 0.25, y: 32}});
const BEAST = () => ({faceR: false, anchor: {x: -16, y: 16}, w: 64, h: 64, b: box(), g: box(), z: box(),
                      body: {sprite: 'animals:42', scale: 2, y: 32}, fall: 180});
const ATTRS = () => ({attrs: {atk: 5, def: 0}});

export function template(kind)
{
    const lab = '新角色';
    switch (kind)
    {
        case 'player': return {kind, lab, gold: 100, survival: true, ...HUMAN(), inv: {storage: {capacity: 20}}};
        case 'npc': return {kind, loc: 'brooklyn', lab, gold: 200, unique: true, ...HUMAN(), inv: {storage: {capacity: -1, items: []}}, schedule: []};
        case 'rogue': return {kind, lab, gold: 200, ...HUMAN(), inv: {equips: []}, ...ATTRS()};
        case 'animal': return {kind, lab, style: 'skittish', animal: true, ...BEAST(), ...ATTRS()};
        default: return {kind, lab, gold: 200, ...BEAST(), ...ATTRS()};
    }
}
