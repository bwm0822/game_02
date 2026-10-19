export const $ = (id) => document.getElementById(id);

export function h(tag, props, ...kids)
{
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props ?? {}))
    {
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') || k === 'value' || k === 'checked') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
    }
    // 0 也跳過：讓 `list.length && …` 可以直接當子節點
    el.append(...kids.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false && c !== 0));
    return el;
}

export const ul = (rows) => h('ul', null, rows.map(r => h('li', null, r)));

export const status = (msg) => {$('status').textContent = msg;};

// 用頁面上的 #dlgAsk；buttons: [[value, 文字], ...]；Esc 關掉回傳 ''
export function ask(title, body, buttons)
{
    const dlg = $('dlgAsk');
    dlg.querySelector('.title').textContent = title;
    dlg.querySelector('.body').replaceChildren(...[body].flat().filter(Boolean));
    dlg.querySelector('.buttons').replaceChildren(...buttons.map(([v, t]) => h('button', {value: v}, t)));
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue), {once: true}));
}
