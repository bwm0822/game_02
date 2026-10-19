// 左邊清單、總覽表、combo 選項來源
import {$, h} from './dom.js';
import * as IC from './icons.js';

// row: {icon(id), lab(id), warns(id)}
export function createViews({S, render, dirty}, row)
{
    const pick = (id) => {S.sel = id; S.view = 'form'; render();};

    function matchSearch(id)
    {
        const q = S.search.trim().toLowerCase();
        return !q || id.toLowerCase().includes(q) || (row.lab(id) ?? '').toLowerCase().includes(q);
    }

    // groups: [[標題, ids]]，空的組不畫
    function renderList(groups)
    {
        $('list').replaceChildren(...groups.map(([t, ids]) => [t, ids.filter(matchSearch)]).filter(([, ids]) => ids.length).flatMap(([t, ids]) => [
            h('div', {class: 'group'}, typeof t === 'function' ? t(ids.length) : t),
            ...ids.map(id => {
                const w = row.warns(id);
                return h('div', {class: 'item' + (id === S.sel ? ' sel' : ''), dataset: {id}, onclick: () => pick(id)},
                    IC.iconEl(row.icon(id), 20),
                    h('span', {class: 'id'}, id),
                    h('span', {class: 'lab'}, row.lab(id) ?? ''),
                    h('span', {class: 'mark'}, dirty(id) && h('span', {class: 'dirty', title: '未存檔'}, '●'), w.length && h('span', {class: 'warn', title: w.join('\n')}, '⚠')));
            }),
        ]));
        $('list').querySelector('.item.sel')?.scrollIntoView({block: 'nearest'});
    }

    // tabs: [{label, cols}]；t: {inTab(tab, id), sortKey(id, col), head(col) → [文字, title], cell(id, col) → td}
    function renderTable(tabs, t)
    {
        const tab = tabs[S.tab];
        const all = Object.keys(S.data);
        let ids = all.filter(id => t.inTab(tab, id) && matchSearch(id));
        if (S.sort)
        {
            const {col, dir} = S.sort;
            const key = (id) => col === '#id' ? id : t.sortKey(id, col);
            ids.sort((a, b) => {
                const x = key(a), y = key(b);
                if (x === y) return 0;
                if (x === undefined) return 1;
                if (y === undefined) return -1;
                return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
            });
        }
        const th = (col, [text, title]) => h('th', {title, onclick: () => {S.sort = S.sort?.col === col ? (S.sort.dir > 0 ? {col, dir: -1} : null) : {col, dir: 1}; render();}},
            text, S.sort?.col === col ? (S.sort.dir > 0 ? ' ▲' : ' ▼') : '');
        $('view').replaceChildren(
            h('div', {class: 'tabs'}, tabs.map((tb, i) => h('button', {type: 'button', class: i === S.tab ? 'on' : '', onclick: () => {S.tab = i; render();}},
                `${tb.label}（${all.filter(id => t.inTab(tb, id)).length}）`))),
            h('table', {class: 'grid'},
                h('thead', null, h('tr', null, th('#id', ['id']), tab.cols.map(c => th(c, t.head(c))))),
                h('tbody', null, ids.map(id => h('tr', {class: dirty(id) ? 'dirty' : ''},
                    h('td', null, h('a', {onclick: () => pick(id)}, id), dirty(id) && ' ●'),
                    tab.cols.map(c => t.cell(id, c)))))));
    }

    // 雙擊格子換成輸入框：Enter／失焦套用（輸入框自己的 onchange），Esc 取消
    function editCell(td, el)
    {
        td.replaceChildren(el);
        el.focus();
        el.addEventListener('keydown', e => {
            if (e.key === 'Enter') el.blur();
            if (e.key === 'Escape') {el.onchange = null; render();}
        });
        el.addEventListener('blur', () => setTimeout(() => td.isConnected && td.contains(el) && render()), {once: true});
    }

    return {matchSearch, renderList, renderTable, editCell};
}

// 只當 combo.js 的選項來源；lists: {名稱: 值陣列}，labels: {名稱: 值 → 說明}
export function renderDatalists(lists, labels = {})
{
    $('datalists').replaceChildren(...Object.entries(lists).map(([k, v]) =>
        h('datalist', {id: `dl-${k}`}, [...new Set(v.filter(Boolean))].map(o => h('option', {value: o, label: labels[k]?.(o)})))));
}
