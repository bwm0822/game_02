// 預覽的「顯示 ▾」下拉：虛線 view、錨點、b/g/z 框、三個支點十字；試穿、角色、部位分頁共用一份勾選（記在 localStorage）
import {h} from './dom.js';
import {PIVOT_NAMES, PIVOT_COLOR} from './handles.js';

const KEY = 'tools.preview.show';
const ITEMS = [['view', '虛線 view', '#aaa'], ['anchor', '錨點', '#ffd700'],
    ['b', '物理 b', '#ff5555'], ['g', '佔格 g', '#55dd55'], ['z', '互動 z', '#5599ff'], null,
    ...Object.keys(PIVOT_NAMES).map(k => [k, PIVOT_NAMES[k], PIVOT_COLOR[k]])];

// 預設全部不勾
export const show = {};
const load = () => {try {for (const k in show) delete show[k]; Object.assign(show, JSON.parse(localStorage.getItem(KEY) ?? '{}'));} catch {}};
load();
// 別的分頁（iframe）改了：跟著換、用最後一個按鈕的 onChange 重畫
let redraw = null;
addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    load();
    label();
    redraw?.();
});

function save()
{
    try {localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(show).filter(([, v]) => v))));} catch {}
}

const text = () => `顯示（${ITEMS.filter(it => it && show[it[0]]).length}）▾`;
// 同頁可能有好幾張預覽（部位分頁的男／女版），按鈕上的數字一起更新
const label = () => {for (const b of document.querySelectorAll('.showbtn')) b.textContent = text();};

// disabled：這頁用不到的 key（變灰）；onChange 勾了之後呼叫（呼叫端重畫）
export function showMenu(onChange, disabled = [])
{
    const btn = h('button', {type: 'button', class: 'showbtn'}, text());
    redraw = onChange;
    let pop = null;
    const close = () => {pop?.remove(); pop = null; document.removeEventListener('pointerdown', outside, true);};
    const outside = (e) => {if (!pop?.contains(e.target) && e.target !== btn) close();};
    btn.onclick = () => {
        if (pop) return close();
        pop = h('div', {class: 'showpop'}, ITEMS.map(it => it ? h('label', {style: `color:${it[2]}`},
            h('input', {type: 'checkbox', checked: !!show[it[0]], disabled: disabled.includes(it[0]), dataset: {show: it[0]},
                onchange: e => {show[it[0]] = e.target.checked; save(); label(); onChange();}}), it[1]) : h('hr')));
        document.body.append(pop);
        // 往上開（預覽的選項列在畫布下面），超出畫面頂端就往下
        const rc = btn.getBoundingClientRect(), ph = pop.offsetHeight;
        pop.style.left = `${Math.min(rc.left, innerWidth - pop.offsetWidth - 4)}px`;
        pop.style.top = `${rc.top - ph - 2 >= 0 ? rc.top - ph - 2 : rc.bottom + 2}px`;
        document.addEventListener('pointerdown', outside, true);
    };
    return btn;
}
