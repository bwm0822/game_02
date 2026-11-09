// role.json 的欄位定義：表單、總覽表、檢查都看這份；沒列到的 key（stats/states/weapon/type 這些遊戲沒在讀的）放「其他欄位」原樣保留
// type 跟道具編輯器共用 tools/common/form.js 的 fieldInput()；inv、schedule 是自己畫的
import AI from '../../src/components/ai/com_ai.js?raw';
import {handOf} from '../../src/core/equip.js';

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
    grp: {label: '子分類', type: 'list'},
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
    // 部位：part.json 的 id，用 pool 選圖器挑
    body: {label: '身體', type: 'part', part: true},
    head: {label: '頭', type: 'part', part: true},
    hair: {label: '頭髮', type: 'part', part: true},
    hat: {label: '帽子', type: 'part', part: true},
    handF: {label: '前手', type: 'part', part: true},
    handB: {label: '後手', type: 'part', part: true},
    cloth: {label: '衣服', type: 'part', part: true},
    shoes: {label: '鞋子', type: 'part', part: true},
    corpse: {label: '屍體圖', type: 'obj', fields: PART},
    inv: {label: '物品欄', type: 'inv'},
    schedule: {label: '作息', type: 'schedule'},
};

// 遊戲畫角色一定要有的（RoleView 直接讀，沒有會出錯）
export const REQUIRED = ['w', 'h', 'anchor'];

export const SECTIONS = [
    {title: '基本', keys: ['kind', 'grp','lab', 'des', 'icon', 'job', 'gold', 'style', 'trade', 'unique', 'survival', 'animal']},
    {title: '戰鬥', keys: ['attrs', 'abilities', 'meat', 'skin', 'fall']},
    {title: '外觀', keys: ['faceR', 'sex','w', 'h', 'anchor', 'b', 'g', 'z', 'body', 'head', 'hair', 'hat', 'handF', 'handB', 'cloth', 'shoes', 'corpse']},
    {title: '物品', keys: ['inv']},
    {title: '作息', keys: ['schedule']},
];

const BASE = ['kind', 'grp', 'lab', 'des', 'icon', 'faceR', 'w', 'h', 'anchor', 'b', 'g', 'z', 'body'];
const FIGHTER = ['job', 'gold', 'style', 'attrs', 'inv'];
export const KIND_FIELDS = {
    player: ['sex', 'job', 'gold', 'survival', 'inv', 'handF', 'handB', 'head', 'hair'],
    npc: ['sex', 'job', 'gold', 'style', 'trade', 'unique', 'inv', 'schedule'],
    rogue: ['sex', ...FIGHTER], monster: FIGHTER, boss: FIGHTER,
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
// 跟 setting.js 的 flatDepth() 一樣：攤成一層（支點節點整組的 depth＋節點裡的 depth/100；裝備依 item.json 的 cat）
// 節點：neck 1.5（back 後片 1.5、頭 2、髮 2.5、頭盔 3）、wristF 4（手／手套後片 1.5、武器 4、前手／手套 5）、wristB -1（同 wristF）、neckB -2（頭髮後片 2.5）
export const DEPTH = {body: 0, shoes: 0.2, cloth: 0.7, head: 1.52, hair: 1.525, hat: 1.53, handF: 4.05, handB: -0.95,
    CAT_HELMET: 1.53, CAT_CHESTPLATE: 1, CAT_GLOVES: 4.05, CAT_BOOTS: 0.5, CAT_WEAPON: 4.04, ext: 6, back: 1.515};
// 後片的 depth：手、手套的後片在同一個手腕節點的武器後面、頭髮後片在身體和後手後面（neckB），其他照 DEPTH.back
export const BACK_DEPTH = {handF: 4.015, handB: -0.985, CAT_GLOVES: 4.015, hair: -1.975};
// 手套 handB（後手那組前後片）的 depth，進 wristB
export const REAR_DEPTH = {sprite: -0.95, back: -0.985};
// 掛在支點節點的部位（跟 setting.js 的 PART_NODE／BACK_NODE 一樣），試穿播動畫時 wristF 上的一起動
export const NODE = {head: 'neck', hair: 'neck', hat: 'neck', CAT_HELMET: 'neck', handF: 'wristF', CAT_WEAPON: 'wristF', CAT_GLOVES: 'wristF', handB: 'wristB'};
export const BACK_NODE = {hair: 'neckB'};
// 武器掛哪隻手照 equip.hand（後手＝wristB，畫在身體後面、後手蓋住握把），同 setting.js 的 nodeFor()
const WEAPON_DEPTH = {wristF: 4.04, wristB: -0.96};
// 武器動畫在動這個節點時整組加的 depth（setting.js 的 NODE_DEPTH_ANIM：wristB -1 → 3，舉到頭、身體前面、前手後面）
export const ANIM_LIFT = {wristB: 4};
export const nodeOf =(k, equip) => (k === 'CAT_WEAPON' ? handOf(equip) : NODE[k]);
export const depthOf = (k, equip) => (k === 'CAT_WEAPON' ? WEAPON_DEPTH[handOf(equip)] : DEPTH[k]);
// equip.js 的 hiddenParts 用：item.json 的 cat 是字串
export const CAT = {HELMET: 'CAT_HELMET', CHESTPLATE: 'CAT_CHESTPLATE', BOOTS: 'CAT_BOOTS', GLOVES: 'CAT_GLOVES', WEAPON: 'CAT_WEAPON'};

// ---------- 總覽表 ----------
// kind: null＝全部；欄位可以是 attrs.atk 這種路徑；# 開頭是唯讀摘要
const FIGHT_COLS = ['lab', 'grp', 'icon', 'gold', 'style', 'attrs.hpMax', 'attrs.atk', 'attrs.def', '#equips'];
export const TABS = [
    {label: '全部', kind: null, cols: ['lab', 'icon', 'kind', 'job', 'gold', 'style']},
    {label: '玩家', kind: 'player', cols: ['lab', 'grp', 'icon', 'job', 'gold', 'survival', '#equips']},
    {label: 'NPC', kind: 'npc', cols: ['lab', 'grp', 'icon', 'job', 'gold', 'style', 'trade', 'unique', '#sch']},
    {label: '盜賊', kind: 'rogue', cols: FIGHT_COLS},
    {label: '怪物', kind: 'monster', cols: FIGHT_COLS},
    {label: '動物', kind: 'animal', cols: ['lab', 'grp', 'icon', 'style', 'meat', 'skin', 'fall', 'attrs.hpMax', 'attrs.atk', 'attrs.def']},
    {label: '頭目', kind: 'boss', cols: FIGHT_COLS},
];

// ---------- 左欄樹（角色、試穿共用）----------
// 子分類照 data 裡第一次出現的順序
export const grpsIn = (data, kind) => [...new Set(Object.values(data).filter(r => (r.kind ?? '') === kind && r.grp).map(r => r.grp))];

// kind ▸ grp 兩層，給 views.js 的 treeEls()；o：grpsOf(kind)＝子分類清單（預設 grpsIn）、keep＝空子分類也畫、head(kind, grp?)＝標題加事件
export function roleTree(data, ids, o = {})
{
    const kindOf = (id) => data[id].kind ?? '';
    const grps = o.grpsOf ?? ((k) => grpsIn(data, k));
    return [
        ...[...KINDS, ''].map(k => {
            const ks = ids.filter(id => kindOf(id) === k);
            return [n => `${k ? KIND_NAMES[k] : '無分類'}（${n}）`, ks.filter(id => !data[id].grp), k, {
                head: o.head?.(k),
                sub: grps(k).map(g => [n => `${g}（${n}）`, ks.filter(id => data[id].grp === g), `${k}:${g}`, {keep: o.keep, head: o.head?.(k, g)}]),
            }];
        }),
        ['不認識的分類', ids.filter(id => kindOf(id) && !KINDS.includes(kindOf(id))), '#unknown'],
    ];
}

export const colDef =(c) => {const [a, b] = c.split('.'); return b ? FIELDS[a]?.fields?.[b] : FIELDS[a];};

// ---------- 新角色 ----------
const box = () => ({l: 0, r: 0, t: 32, b: 0});
export const HUMAN_KINDS = ['player', 'npc', 'rogue'];
export const stdBody = (sex) => (sex === 'f' ? 'body-woman' : 'body-man');
export const isStdBody = (body) => body === stdBody('m') || body === stdBody('f');
const HUMAN = (sex) => ({...(sex === 'f' && {sex}), faceR: true, anchor: {x: 0, y: 16}, w: 32, h: 64, b: box(), g: box(), z: box(),
                         body: stdBody(sex), handF: 'handF', handB: 'handB'});
const BEAST = () => ({faceR: false, anchor: {x: -16, y: 16}, w: 64, h: 64, b: box(), g: box(), z: box(),
                      body: 'animals-42', fall: 180});
const ATTRS = () => ({attrs: {atk: 5, def: 0}});

export function template(kind, sex)
{
    const lab = '新角色';
    switch (kind)
    {
        case 'player': return {kind, lab, gold: 100, survival: true, ...HUMAN(sex), inv: {storage: {capacity: 20}}};
        case 'npc': return {kind, lab, gold: 200, unique: true, ...HUMAN(sex), inv: {storage: {capacity: -1, items: []}}, schedule: []};
        case 'rogue': return {kind, lab, gold: 200, ...HUMAN(sex), inv: {equips: []}, ...ATTRS()};
        case 'animal': return {kind, lab, style: 'skittish', animal: true, ...BEAST(), ...ATTRS()};
        default: return {kind, lab, gold: 200, ...BEAST(), ...ATTRS()};
    }
}
