// 預覽的「顯示 ▾」下拉：一組勾選（記在 localStorage）＋按鈕；createShowMenu() 產生一組
// 預設那組＝虛線 view、錨點、b/g/z 框、三個支點十字，試穿、角色、部位分頁共用；角色分頁的作息地圖自己一組
import {h} from './dom.js';
import {PIVOT_NAMES, PIVOT_COLOR} from './handles.js';

// items：[[key, 文字, 顏色], null＝分隔線, …]；defaults：預設勾的（存過的蓋過去；後來才加的預設項目，舊的存檔也照預設勾）
export function createShowMenu(key, items, defaults = {})
{
    const show = {};
    const load = () => {
        for (const k in show) delete show[k];
        let saved = null;
        try {saved = JSON.parse(localStorage.getItem(key));} catch {}
        Object.assign(show, defaults, saved);
    };
    load();
    // 別的分頁（iframe）改了：跟著換、用最後一個按鈕的 onChange 重畫
    let redraw = null;
    addEventListener('storage', (e) => {
        if (e.key !== key) return;
        load();
        label();
        redraw?.();
    });
    // 存勾了的＋預設勾卻取消的（false）
    const save = () => {try {localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(show).filter(([k, v]) => v || defaults[k]))));} catch {}};
    const text = () => `顯示（${items.filter(it => it && show[it[0]]).length}）▾`;
    // 同頁可能有好幾張預覽（部位分頁的男／女版），按鈕上的數字一起更新
    const label = () => {for (const b of document.querySelectorAll(`.showbtn[data-key="${key}"]`)) b.textContent = text();};

    // disabled：這頁用不到的 key（變灰）；onChange 勾了之後呼叫（呼叫端重畫）
    function showMenu(onChange, disabled = [])
    {
        const btn = h('button', {type: 'button', class: 'showbtn', dataset: {key}}, text());
        redraw = onChange;
        let pop = null;
        const close = () => {pop?.remove(); pop = null; document.removeEventListener('pointerdown', outside, true);};
        const outside = (e) => {if (!pop?.contains(e.target) && e.target !== btn) close();};
        btn.onclick = () => {
            if (pop) return close();
            pop = h('div', {class: 'showpop'}, items.map(it => it ? h('label', {style: `color:${it[2]}`},
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
    return {show, showMenu};
}

// 預設全部不勾
const PREVIEW = createShowMenu('tools.preview.show', [['view', '虛線 view', '#aaa'], ['anchor', '錨點', '#ffd700'],
    ['b', '物理 b', '#ff5555'], ['g', '佔格 g', '#55dd55'], ['z', '互動 z', '#5599ff'], null,
    ...Object.keys(PIVOT_NAMES).map(k => [k, PIVOT_NAMES[k], PIVOT_COLOR[k]])]);
export const show = PREVIEW.show;
export const showMenu = PREVIEW.showMenu;
