// ability.json 的欄位定義：表單、檢查都看這份；沒列到的 key 不會被丟掉（進「其他欄位」原始 JSON）
// type 同道具編輯器（tools/item/schema.js）；refs 不在這裡，在樹畫布上拉線

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
