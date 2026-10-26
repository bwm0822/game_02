// ability.json 的欄位定義：表單、檢查都看這份；沒列到的 key 不會被丟掉（進「其他欄位」原始 JSON）
// type 同道具編輯器（tools/item/schema.js），另外 cards＝物件陣列（每筆一張卡片）；refs 不在這裡，在樹畫布上拉線
import {EFF_FIELDS as ITEM_EFF, EFF_BY_TYPE, STATS, effSummary} from '../item/schema.js';

export {STATS, effSummary};

export const ELM_NAMES = {phy: '物理', fire: '火', ice: '冰', poison: '毒'};

export const HIT_FIELDS = {
    elm: {label: '元素', type: 'enum', options: ['', 'phy', 'fire', 'ice', 'poison'], names: ELM_NAMES},
    pow: {label: '倍率 pow', type: 'num'},
    flat: {label: '固定 flat', type: 'num'},
    src: {label: '屬性 src', type: 'list', suggest: STATS},
};

// 一行人話摘要，例如「火 10+1.5×int」；沒寫 src 的照遊戲預設（治療用 int、其他 atk）
export function hitSummary(hit, tag)
{
    const {pow = 1, flat = 0} = hit;
    const src = hit.src ?? (tag === 'heal' ? 'int' : 'atk');
    return `${ELM_NAMES[hit.elm ?? 'phy'] ?? hit.elm} ${flat ? `${flat}+` : ''}${pow !== 1 ? `${pow}×` : ''}${src}`;
}

// 技能的 effects 跟道具一樣，多一個 reqClass（拿對的武器才生效）
export const EFF_FIELDS = {...ITEM_EFF, reqClass: {label: '需要武器', type: 'list', suggest: ['sword', 'bow']}};

export function effFields(eff)
{
    const keys = new Set(['type', ...(EFF_BY_TYPE[eff.type ?? ''] ?? []), ...Object.keys(eff).filter(k => EFF_FIELDS[k])]);
    return Object.keys(EFF_FIELDS).filter(k => keys.has(k));
}

export const CARDS = {
    hits: {label: '傷害', add: '＋ 新增傷害', fields: HIT_FIELDS, fieldsOf: () => Object.keys(HIT_FIELDS), blank: () => ({elm: 'phy', pow: 1}),
           summary: (x, ab) => hitSummary(x, ab.tag)},
    effects: {label: '效果', add: '＋ 新增效果', fields: EFF_FIELDS, fieldsOf: effFields, blank: () => ({type: 'mod'}),
              summary: (x) => effSummary(x)},
};

export const FIELDS = {
    lab: {label: '名稱', type: 'text'},
    icon: {label: 'icon', type: 'icon'},
    mode: {label: '模式', type: 'enum', options: ['active', 'passive'], names: {active: '主動', passive: '被動'}},
    tag: {label: '標籤', type: 'list', suggest: ['atk', 'buff', 'heal', 'summon', 'steal', 'lockpick', 'butcher']},
    des: {label: '說明', type: 'textarea'},
    scope: {label: '範圍', type: 'enum', options: ['', 'single', 'arc', 'cone', 'area', 'dash', 'group'],
            names: {single: '單體', arc: '弧形', cone: '錐形', area: '區域', dash: '衝刺', group: '群體'}},
    cd: {label: '冷卻', type: 'int'},
    range: {label: '射程', type: 'int'},
    w: {label: '寬 w', type: 'int'},
    h: {label: '高 h', type: 'int'},
    angle: {label: '角度', type: 'num'},
    minCount: {label: '最少目標', type: 'int'},
    knock: {label: '擊退格數', type: 'int'},
    reqClass: {label: '需要武器', type: 'list', suggest: ['sword', 'bow']},
    weapon: {label: '武器攻擊', type: 'bool'},
    roles: {label: '被角色擋', type: 'bool'},
    anim: {label: '動畫', type: 'list', suggest: []},
    hits: {label: '傷害', type: 'cards'},
    effects: {label: '效果', type: 'cards'},
};

export const BASE = ['lab', 'icon', 'mode', 'tag', 'des'];

// 表單要顯示的欄位：基本＋已經有值的已知欄位
export function shownFields(ab)
{
    const keys = new Set([...BASE, ...Object.keys(ab).filter(k => FIELDS[k])]);
    return Object.keys(FIELDS).filter(k => keys.has(k));
}

// 表單另外處理、不進「其他欄位」的 key
export const SPECIAL = ['refs'];

export const template = () => ({icon: '❓', mode: 'active', lab: '新技能', des: ''});
