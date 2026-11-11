// 依 cat 分頁挑道具（icon 格子＋搜尋）；對話框自己建、掛在 body
// onPick(id) 每點一次呼叫；Ctrl＋點且 multi 時不關窗、照 count() 重畫格子上的數字；回傳 Promise 在關窗時 resolve
import {h} from './dom.js';
import * as IC from './icons.js';
import {CATS, CAT_NAMES} from '../item/schema.js';

const ALL = '#all', NONE = '#none';

let dlg;
const ensure = () => dlg ??= document.body.appendChild(h('dialog', {class: 'itempick'}));

export function pickItem(items, {title = '選擇道具', filter = () => true, count = () => 0, onPick, multi = true} = {})
{
    ensure();
    const ids = Object.keys(items).filter(id => filter(id, items[id]));
    const catOf = (id) => (items[id].cat && CATS.includes(items[id].cat) ? items[id].cat : NONE);
    let tab = ALL;
    const search = h('input', {class: 'search', placeholder: '搜尋 id／名稱', dataset: {k: 'itempick.search'}});
    const tabsEl = h('div', {class: 'tabs'}), tilesEl = h('div', {class: 'tiles'});
    const match = (id) => {
        const q = search.value.trim().toLowerCase();
        return !q || id.toLowerCase().includes(q) || String(items[id].lab ?? '').toLowerCase().includes(q);
    };
    const shown = () => ids.filter(id => match(id) && (tab === ALL || catOf(id) === tab));
    const pick = (id, keep) => {
        onPick?.(id);
        if (keep && multi) draw();
        else dlg.close();
    };
    const draw = () => {
        const hits = ids.filter(match);
        const n = (t) => (t === ALL ? hits.length : hits.filter(id => catOf(id) === t).length);
        const tabs = [ALL, ...CATS, ...(ids.some(id => catOf(id) === NONE) ? [NONE] : [])];
        tabsEl.replaceChildren(...tabs.map(t => h('button', {type: 'button', class: (t === tab ? 'on' : '') + (n(t) ? '' : ' empty'), dataset: {tab: t},
            onclick: () => {tab = t; draw(); search.focus();}},
            `${t === ALL ? '全部' : t === NONE ? '無分類' : CAT_NAMES[t]} ${n(t)}`)));
        tilesEl.replaceChildren(...shown().map(id => {
            const it = items[id], c = count(id);
            return h('div', {class: 'tile', dataset: {id}, title: `${id}　${it.cat ? CAT_NAMES[it.cat] ?? it.cat : '無分類'}　${it.gold ?? 0} 金`,
                    onclick: (e) => pick(id, e.ctrlKey || e.metaKey)},
                IC.iconEl(it.icon, 48), h('div', {class: 'lab'}, it.lab ?? id), c > 0 && h('span', {class: 'n'}, String(c)));
        }));
    };
    search.oninput = draw;
    search.onkeydown = (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const s = shown();
        if (s.length === 1) pick(s[0], e.ctrlKey || e.metaKey);
    };
    dlg.replaceChildren(h('div', {class: 'bar'}, h('span', {class: 'title'}, title), h('span', {class: 'dim'}, multi ? '　Ctrl＋點＝連續加' : ''), h('span', {class: 'grow'}), search),
        tabsEl, tilesEl);
    draw();
    dlg.onclick = (e) => {if (e.target === dlg) dlg.close();};
    dlg.showModal();
    search.focus();
    return new Promise(res => dlg.addEventListener('close', () => res(), {once: true}));
}
