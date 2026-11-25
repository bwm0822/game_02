// 場景分頁中欄右鍵空地的放置面板（docs/scene-tool.md「放置面板」）：上排分頁、搜尋框、列表；
//  點一筆＝放在右鍵位置然後關（Shift＝放了不關）、拖到畫面任意位置（application/x-prefab，sandbox 收 drop）
//  tabs: [{k, label, head?(ctx)→[按鈕], rows(q, ctx)→[元素]}]；ctx＝open() 帶的右鍵位置＋render()／close()
import {h} from '../common/dom.js';

export const DRAG = 'application/x-prefab';

export function createPanel({tabs, tab, onTab, onOpen, onClose})
{
    let el = null, ctx = null, q = '';
    const cur = () => tabs.find(t => t.k === tab) ?? tabs[0];

    function render()
    {
        if (!el) return;
        const t = cur();
        const search = h('input', {class: 'q', placeholder: '搜尋', value: q, oninput: () => {q = search.value; list.replaceChildren(...t.rows(q.trim().toLowerCase(), ctx));},
            onkeydown: (e) => {if (e.key === 'Escape') {e.preventDefault(); close();}}});
        const list = h('div', {class: 'plist'}, ...t.rows(q.trim().toLowerCase(), ctx));
        el.replaceChildren(
            h('div', {class: 'ptabs'}, tabs.map(x => h('button', {type: 'button', class: x.k === t.k ? 'on' : '', dataset: {tab: x.k},
                onclick: () => {tab = x.k; onTab?.(tab); render();}}, x.label))),
            h('div', {class: 'phead'}, search, ...(t.head?.(ctx) ?? [])),
            list);
        if (document.activeElement === document.body || !el.contains(document.activeElement)) search.focus();
    }

    function open(at, c)
    {
        close(false);
        ctx = {...c, render, close: () => close()};
        q = '';
        el = h('div', {class: 'addpanel'});
        document.body.append(el);
        render();
        const r = el.getBoundingClientRect();
        el.style.left = `${Math.max(4, at.clientX + r.width > innerWidth - 4 ? at.clientX - r.width : at.clientX)}px`;
        el.style.top = `${Math.max(4, at.clientY + r.height > innerHeight - 4 ? at.clientY - r.height : at.clientY)}px`;
        onOpen?.();
    }

    function close(notify = true)
    {
        if (!el) return;
        el.remove();
        el = null;
        ctx = null;
        if (notify) onClose?.();
    }

    // 面板外按下（分頁這邊）＝關；對話框／右鍵選單是從面板開的，不算
    addEventListener('pointerdown', (e) => {if (el && !e.target.closest('.addpanel, dialog, .ctxmenu')) close();});

    return {open, close, render, isOpen: () => !!el, get tab() {return tab;}, set tab(k) {tab = k; render();}};
}

// 一列：pick(e)＝點了（呼叫端判斷 Shift）、drag＝拖曳帶的字串、menu(e)＝右鍵
export function row({icon, id, lab, mark, title, cls = '', data, drag, pick, menu})
{
    return h('div', {class: `item prow ${cls}`.trim(), title: title ?? '', draggable: drag ? 'true' : 'false', dataset: data ?? {},
        onclick: pick, oncontextmenu: menu,
        ondragstart: drag && ((e) => {e.dataTransfer.setData(DRAG, drag); e.dataTransfer.effectAllowed = 'copy';})},
        icon, h('span', {class: 'id'}, id), lab && h('span', {class: 'lab'}, lab), mark && h('span', {class: 'mark dim'}, mark));
}

export const groupHead = (text) => h('div', {class: 'pgroup'}, text);
