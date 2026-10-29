// 表單共用：依欄位定義（{type, label, options, names, ...}）畫輸入框、原始 JSON 框、可收合的框
import {h} from './dom.js';
import {isObj, parseNum} from './obj.js';
import * as IC from './icons.js';
import * as JE from './jsonedit.js';

// put(v)：v 是 undefined 表示清空；k 是 data-k（重繪後還原焦點、combo 的 datalist 用最後一段）
export function fieldInput(def, val, put, k)
{
    const data = {k};
    switch (def.type)
    {
        case 'textarea':
            return h('textarea', {rows: 2, dataset: data, value: val ?? '', onchange: e => put(e.target.value || undefined)});
        case 'bool':
            return h('input', {type: 'checkbox', dataset: data, checked: !!val, onchange: e => put(e.target.checked || undefined)});
        case 'enum':
        {
            const opts = def.options.includes(val ?? '') ? def.options : [...def.options, val];
            return h('select', {dataset: data, onchange: e => put(e.target.value || undefined)},
                opts.map(o => h('option', {value: o, selected: o === (val ?? '')}, def.names?.[o] ? `${def.names[o]}${o ? `　${o}` : ''}` : o || '—')));
        }
        case 'int': case 'num':
            return h('input', {class: 'num', inputmode: 'decimal', dataset: data, value: val ?? '', onchange: e => put(parseNum(e.target.value))});
        case 'tags':
            return h('input', {dataset: {...data, combo: `dl-${k.split('.').at(-1)}`, tags: ''}, value: (val ?? []).join(', '),
                onchange: e => {const a = e.target.value.split(',').map(s => s.trim()).filter(Boolean); put(a.length ? a : undefined);}});
        case 'color':
        {
            const hex = typeof val === 'number' ? `#${val.toString(16).padStart(6, '0')}` : '#ffffff';
            return h('span', {class: 'iconField'},
                h('input', {type: 'color', dataset: data, value: hex, onchange: e => put(parseInt(e.target.value.slice(1), 16))}),
                h('span', {class: 'dim'}, val === undefined ? '（未設定）' : `${val}（0x${hex.slice(1)}）`),
                val !== undefined && h('button', {type: 'button', onclick: () => put(undefined)}, '清除'));
        }
        case 'icon': case 'sprite':
            return h('span', {class: 'iconField'},
                IC.iconEl(val, 32),
                h('input', {dataset: data, value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)}),
                h('button', {type: 'button', onclick: async () => {const v = await IC.pickIcon(val); if (v !== null) put(v || undefined);}}, '選圖…'));
        case 'itemref':
            return h('input', {dataset: {...data, combo: 'dl-items'}, value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)});
        case 'list':
            return h('input', {dataset: {...data, combo: `dl-${k.split('.').at(-1)}`}, value: val ?? '', onchange: e => put(e.target.value.trim() || undefined)});
        default:
            return h('input', {dataset: data, value: val ?? '', onchange: e => put(e.target.value || undefined)});
    }
}

export function createForm({S, render, commit})
{
    S.json ??= false;   // 整筆 JSON 模式：記在頁面，換一筆保持
    const FULL = '#full';

    const modeBtn = () => h('button', {type: 'button', class: S.json ? 'on' : '', title: '切換表單／整筆 JSON',
        onclick: () => {S.json = !S.json; render();}}, S.json ? '表單' : 'JSON');

    // 整筆物件（不含 id）；不是物件也當成錯，留草稿
    function fullJson(id)
    {
        return JE.jsonEdit({k: FULL, text: S.drafts[FULL]?.text ?? JSON.stringify(S.data[id], null, 2), placeholder: '{ }', maxRows: 200,
            onApply: v => {
                if (!isObj(v)) {S.drafts[FULL] = {text: JSON.stringify(v, null, 2), msg: '整筆要是物件 { }'}; return render();}
                delete S.drafts[FULL];
                commit(() => {S.data[id] = v;});
            },
            onDraft: (t, msg) => {S.drafts[FULL] = {text: t, msg};}});
    }

    const fullDraft = () => S.drafts[FULL] && `整筆 JSON 有錯還沒套用（${S.drafts[FULL].msg}）`;

    // obj 裡 isKnown 以外的 key 用 JSON 框編輯；有錯沒套用的原文留在 S.drafts
    function rawArea(obj, isKnown, put, k)
    {
        const raw = Object.fromEntries(Object.entries(obj).filter(([key]) => !isKnown(key)));
        const text = Object.keys(raw).length ? JSON.stringify(raw, null, 2) : '';
        return JE.jsonEdit({k, text: S.drafts[k]?.text ?? text, placeholder: '{ }',
            onApply: v => {delete S.drafts[k]; put(v);},
            onDraft: (t, msg) => {S.drafts[k] = {text: t, msg};}});
    }

    // 這筆第一次畫到時看內容決定（array 或超過一個 key 收起來），之後記住，免得改了內容框自己收起來
    const isOpen = (key, v) => S.open[key] ??= !(Array.isArray(v) || (isObj(v) && Object.keys(v).length > 1));

    // 點標題列（按鈕以外）開關；fold=false 表示沒有內容可收
    function boxBar(key, open, fold, ...kids)
    {
        return h('div', {class: 'bar' + (fold ? ' fold' : ''), onclick: fold && (e => {if (!e.target.closest('button')) {S.open[key] = !open; render();}})},
            fold && h('span', {class: 'arrow'}, open ? '▼' : '▶'), ...kids);
    }

    return {rawArea, isOpen, boxBar, modeBtn, fullJson, fullDraft};
}
