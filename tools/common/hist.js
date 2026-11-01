// 數字欄同一格連按 ↑↓（或上下三角形）合併成一步 undo：form.js 在步進前 arrow(k)，commit 有變更時 take() 決定要不要蓋掉上一步
// 焦點／滑鼠到別的地方就斷開；commit 後重畫還原焦點是同一個 data-k，不會斷
let mark = null, run = null;

export const arrow = (k) => {mark = k;};
export const clear = () => {mark = null;};
export const brk = () => {run = null;};

export function take()
{
    const k = mark;
    mark = null;
    const merge = k !== null && k === run;
    run = k;
    return merge;
}

const away = (e) => {if (run !== null && e.target?.dataset?.k !== run) run = null;};
document.addEventListener('focusin', away);
document.addEventListener('mousedown', away);
