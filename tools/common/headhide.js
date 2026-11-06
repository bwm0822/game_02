// 預覽的「頭／頭髮」勾選（勾＝顯示）：只影響預覽，道具／部位／角色／試穿共用，記在 localStorage
// 藏頭只藏 head 部位、藏頭髮連後片一起藏；帽子、頭盔不跟著藏
import {h} from './dom.js';

const KEY = 'tools.preview.hide';
export const hide = {head: false, hair: false};
const load = () => {
    let v = {};
    try {v = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};} catch {}
    hide.head = !!v.head;
    hide.hair = !!v.hair;
};
load();

const sync = () => {for (const c of document.querySelectorAll('input[data-hide]')) c.checked = !hide[c.dataset.hide];};
// 別的分頁（iframe）改了：跟著換、用最後一個 hideChecks 的 onChange 重畫
let redraw = null;
addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    load();
    sync();
    redraw?.();
});

export const hidden = (k) => !!hide[k];

export function hideChecks(onChange)
{
    redraw = onChange;
    const box = (k, text) => h('label', {title: '只影響預覽'}, h('input', {type: 'checkbox', checked: !hide[k], dataset: {hide: k},
        onchange: e => {
            hide[k] = !e.target.checked;
            try {localStorage.setItem(KEY, JSON.stringify(hide));} catch {}
            sync();
            onChange();
        }}), text);
    return [box('head', '頭'), box('hair', '頭髮')];
}
