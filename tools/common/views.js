// 左邊清單、總覽表、combo 選項來源
import {$, h} from './dom.js';
import * as IC from './icons.js';
import {createFold} from './fold.js';

// row: {icon(id), lab(id), warns(id)}
export function createViews({S, render, dirty}, row)
{
    const F = createFold();
    const unpick = () => {S.sel = null; S.view = 'table';};
    // 表單開著時再點一次選到的＝取消選擇
    const pick = (id) => {
        if (id === S.sel && S.view === 'form') unpick();
        else {S.sel = id; S.view = 'form';}
        render();
    };

    function matchSearch(id)
    {
        const q = S.search.trim().toLowerCase();
        return !q || id.toLowerCase().includes(q) || (row.lab(id) ?? '').toLowerCase().includes(q);
    }

    // groups: [[標題, ids, key, opt?]]，空的組不畫；key 是收合狀態用的穩定名稱；標題是函式的話傳這組（含子組）的數量
    // opt：sub＝子組（同格式，畫在這組的角色後面、縮排）、keep＝沒東西也畫（搜尋時不算）、head(el)／item(el, id)＝呼叫端加事件
    // 摺起來的組裡不留選取：摺的時候取消選擇，從別處選到（新增、改名、undo、表格點 id）就展開那組（連同上層）
    function renderList(groups)
    {
        const searching = !!S.search.trim();
        const filter = (gs) => gs.map(([t, ids, key, opt = {}]) => {
            const sub = filter(opt.sub ?? []);
            return {t, ids: ids.filter(matchSearch), key, opt, sub, n: 0};
        }).map(g => ({...g, n: g.ids.length + g.sub.reduce((a, s) => a + s.n, 0)}))
          .filter(g => g.n || g.sub.length || (g.opt.keep && !searching));
        const shown = filter(groups);
        const path = (gs) => {
            for (const g of gs)
            {
                if (g.ids.includes(S.sel)) return [g.key];
                const p = path(g.sub);
                if (p) return [g.key, ...p];
            }
            return null;
        };
        const mine = path(shown) ?? [];
        if (!searching) mine.forEach(F.open);
        const all = (gs) => gs.flatMap(g => [g.key, ...all(g.sub)]);
        const keys = all(shown);
        const onToggle = () => {
            if (mine.some(k => F.folded(k, searching))) unpick();
            render();
        };
        const item = (id) => {
            const w = row.warns(id);
            const el = h('div', {class: 'item' + (id === S.sel ? ' sel' : ''), dataset: {id}, onclick: () => pick(id)},
                IC.iconEl(row.icon(id), 20),
                h('span', {class: 'id'}, id),
                h('span', {class: 'lab'}, row.lab(id) ?? ''),
                h('span', {class: 'mark'}, dirty(id) && h('span', {class: 'dirty', title: '未存檔'}, '●'), w.length && h('span', {class: 'warn', title: w.join('\n')}, '⚠')));
            row.item?.(el, id);
            return el;
        };
        const draw = (gs) => gs.flatMap(g => {
            const head = F.head(g.key, typeof g.t === 'function' ? g.t(g.n) : g.t, keys, onToggle, searching);
            g.opt.head?.(head);
            if (F.folded(g.key, searching)) return [head];
            const sub = draw(g.sub);
            return [head, ...g.ids.map(item), ...sub.length ? [h('div', {class: 'subgroups'}, sub)] : []];
        });
        $('list').replaceChildren(...draw(shown));
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
