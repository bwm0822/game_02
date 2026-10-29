// 左欄分組收合（預設摺起來）：點組標題切換、Alt＋點全部一起；展開的組 key 各工具分開記在 localStorage（tools.<工具資料夾>.open）
import {h} from './dom.js';

export function createFold()
{
    const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);
    const KEY = `tools.${tool}.open`;
    let set = new Set();
    try {set = new Set(JSON.parse(localStorage.getItem(KEY)) ?? []);}
    catch {}
    const save = () => {
        try {localStorage.setItem(KEY, JSON.stringify([...set]));}
        catch {}
    };

    // 搜尋中全部展開（存著的狀態不動）
    const folded = (key, searching) => !searching && !set.has(key);
    const open = (key) => {if (!set.has(key)) {set.add(key); save();}};

    // all：Alt＋點時一起切的 keys
    const toggle = (key, all) => {
        const fold = set.has(key);
        for (const k of all ?? [key]) fold ? set.delete(k) : set.add(k);
        save();
    };

    // keys：清單上所有組的 key（Alt＋點用）；onToggle 由呼叫端清選取、重畫
    function head(key, label, keys, onToggle, searching)
    {
        return h('div', {class: 'group fold', title: '點一下展開／摺疊，Alt＋點全部', onclick: (e) => {
            toggle(key, e.altKey ? keys : null);
            onToggle();
        }}, h('span', {class: 'arrow'}, folded(key, searching) ? '▸' : '▾'), label);
    }

    return {folded, open, toggle, head};
}
