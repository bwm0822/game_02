// 預覽的「顯示 ▾」下拉：一組勾選（記在 localStorage）＋按鈕；createShowMenu() 產生一組
// 預設那組＝虛線 view、錨點、b/g/z 框、三個支點十字，試穿、角色、部位分頁共用；角色分頁的作息地圖自己一組
import {h} from './dom.js';
import {PIVOT_NAMES, PIVOT_COLOR} from './handles.js';

// 名稱過濾：空白／逗號隔開好幾個關鍵字、符合任一個就算、不分大小寫；沒有 * ＝部分比對、有 * ＝萬用字元整個名字要對上；空的＝全部
export function nameFilter(text)
{
    const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const tests = String(text ?? '').toLowerCase().split(/[\s,，]+/).filter(Boolean).map(k => {
        if (!k.includes('*')) return (s) => s.includes(k);
        const re = new RegExp(`^${k.split('*').map(esc).join('.*')}$`);
        return (s) => re.test(s);
    });
    if (!tests.length) return () => true;
    return (name) => {const s = String(name ?? '').toLowerCase(); return tests.some(t => t(s));};
}

// items：[[key, 文字, 顏色, {filter:true}?], null＝分隔線, …]；defaults：預設勾的（存過的蓋過去；後來才加的預設項目，舊的存檔也照預設勾）
// 帶 filter 的那一項後面多一個名稱過濾框（記在 `${key}.filter`），呼叫端畫名字前問 nameOk(name)
export function createShowMenu(key, items, defaults = {})
{
    const show = {}, fkey = `${key}.filter`;
    let ftext = '', pred = () => true;
    const load = () => {
        for (const k in show) delete show[k];
        let saved = null;
        try {saved = JSON.parse(localStorage.getItem(key));} catch {}
        Object.assign(show, defaults, saved);
        try {ftext = localStorage.getItem(fkey) ?? '';} catch {}
        pred = nameFilter(ftext);
    };
    load();
    // 別的分頁（iframe）改了：跟著換、用最後一個按鈕的 onChange 重畫
    let redraw = null;
    addEventListener('storage', (e) => {
        if (e.key !== key && e.key !== fkey) return;
        load();
        label();
        redraw?.();
    });
    // 存勾了的＋預設勾卻取消的（false）
    const save = () => {try {localStorage.setItem(key, JSON.stringify(Object.fromEntries(Object.entries(show).filter(([k, v]) => v || defaults[k]))));} catch {}};
    const text = () => `顯示（${items.filter(it => it && show[it[0]]).length}）${ftext.trim() ? '🔍' : ''}▾`;
    // 同頁可能有好幾張預覽（部位分頁的男／女版），按鈕上的數字一起更新
    const label = () => {for (const b of document.querySelectorAll(`.showbtn[data-key="${key}"]`)) b.textContent = text();};

    // disabled：這頁用不到的 key（變灰）；onChange 勾了之後呼叫（呼叫端重畫）；opt.names()＝這張圖的名稱（過濾框底下算符合幾個）
    function showMenu(onChange, disabled = [], {names = () => []} = {})
    {
        const btn = h('button', {type: 'button', class: 'showbtn', dataset: {key}}, text());
        redraw = onChange;
        let pop = null;
        const close = () => {pop?.remove(); pop = null; document.removeEventListener('pointerdown', outside, true);};
        const outside = (e) => {if (!pop?.contains(e.target) && e.target !== btn) close();};
        // 過濾框：邊打邊重畫、沒勾就自動勾、✕ 清空
        const filterRow = (it, box) => {
            const count = h('div', {class: 'fcount dim'});
            const recount = () => {const all = names(); count.textContent = `符合 ${all.filter(pred).length}／${all.length}`;};
            const inp = h('input', {type: 'search', class: 'fname', placeholder: '過濾：sit bed、*-p1', value: ftext, dataset: {filter: it[0]}});
            const set = (v) => {
                ftext = v;
                pred = nameFilter(v);
                try {localStorage.setItem(fkey, v);} catch {}
                if (v.trim() && !show[it[0]]) {show[it[0]] = true; box.checked = true; save();}
                label();
                recount();
                onChange();
            };
            inp.oninput = () => set(inp.value);
            recount();
            return [inp, h('button', {type: 'button', class: 'fclear', title: '清空', onclick: () => {inp.value = ''; set('');}}, '✕'), count];
        };
        const row = (it) => {
            const box = h('input', {type: 'checkbox', checked: !!show[it[0]], disabled: disabled.includes(it[0]), dataset: {show: it[0]},
                onchange: e => {show[it[0]] = e.target.checked; save(); label(); onChange();}});
            const lab = h('label', {style: `color:${it[2]}`}, box, it[1]);
            if (!it[3]?.filter) return lab;
            const [inp, x, count] = filterRow(it, box);
            return h('div', {class: 'frow'}, h('div', {class: 'fline'}, lab, inp, x), count);
        };
        btn.onclick = () => {
            if (pop) return close();
            pop = h('div', {class: 'showpop'}, items.map(it => (it ? row(it) : h('hr'))));
            document.body.append(pop);
            // 往上開（預覽的選項列在畫布下面），超出畫面頂端就往下
            const rc = btn.getBoundingClientRect(), ph = pop.offsetHeight;
            pop.style.left = `${Math.min(rc.left, innerWidth - pop.offsetWidth - 4)}px`;
            pop.style.top = `${rc.top - ph - 2 >= 0 ? rc.top - ph - 2 : rc.bottom + 2}px`;
            document.addEventListener('pointerdown', outside, true);
        };
        return btn;
    }
    return {show, showMenu, nameOk: (name) => pred(name)};
}

// 預設全部不勾
const PREVIEW = createShowMenu('tools.preview.show', [['view', '虛線 view', '#aaa'], ['anchor', '錨點', '#ffd700'],
    ['b', '物理 b', '#ff5555'], ['g', '佔格 g', '#55dd55'], ['z', '互動 z', '#5599ff'], null,
    ...Object.keys(PIVOT_NAMES).map(k => [k, PIVOT_NAMES[k], PIVOT_COLOR[k]])]);
export const show = PREVIEW.show;
export const showMenu = PREVIEW.showMenu;
