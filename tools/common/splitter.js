// 左欄 #left、中間欄（有 data-resize 的 #view）的右邊框、右欄（有 data-resize-right）的左邊框拖拉改寬度：各工具分開記在 localStorage
// （tools.left.<工具資料夾>、tools.mid.<工具資料夾>、tools.right.<工具資料夾>），雙擊恢復 CSS 預設
// 把手是欄位後面的兄弟元素（欄位常會自己捲動，放裡面會跟著捲走）
const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);

// clamp(w)：夾範圍；apply(w)：w 是 0 時恢復預設；rev：把手在欄位左邊、往左拉變寬；inside：把手放進欄位裡、貼著左邊（欄位會整個被搬來搬去時用）
// 回傳照記住的值重套（視窗縮放用）
function splitter(panel, key, cls, clamp, apply, rev = false, inside = false)
{
    const set = (w) => apply(w ? clamp(w) : 0);
    const store = (w) => {
        try {w ? localStorage.setItem(key, w) : localStorage.removeItem(key);}
        catch {}
    };
    let saved = 0;
    try {saved = +localStorage.getItem(key);}
    catch {}
    set(saved);

    const grip = document.createElement('div');
    grip.className = cls;
    grip.title = '拖拉改寬度，雙擊恢復預設';
    Object.assign(grip.style, {flex: 'none', width: '6px', margin: '0 -3px', position: 'relative', zIndex: 5, cursor: 'col-resize', touchAction: 'none'});
    if (inside) {Object.assign(grip.style, {position: 'absolute', left: '-11px', top: 0, bottom: 0, margin: 0}); panel.prepend(grip);}
    else if (rev) panel.before(grip); else panel.after(grip);

    grip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const [x0, w0] = [e.clientX, panel.getBoundingClientRect().width];
        if (e.isTrusted) grip.setPointerCapture(e.pointerId);
        document.body.style.userSelect = 'none';
        const move = (ev) => set(w0 + (rev ? x0 - ev.clientX : ev.clientX - x0));
        const up = () => {
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', up);
            document.body.style.userSelect = '';
            saved = parseFloat(panel.style.width) || 0;
            store(saved);
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => {saved = 0; set(0); store(0);});
    return () => set(saved);
}

// 動態建的右欄（特效／粒子的預覽 .split > .pv）：把手放在欄位裡貼左邊，跟著欄位搬；寬度記 tools.right.<工具>
// 一定寫死寬度（雙擊／沒記過＝defW），onWidth(w) 給呼叫端跟著調內容（畫布）
export function resizeRight(panel, defW, onWidth)
{
    const apply = (w) => {
        const v = w || defW;
        panel.style.width = `${v}px`;
        onWidth(v);
    };
    const refit = splitter(panel, `tools.right.${tool}`, 'right-grip', (w) => Math.round(Math.min(innerWidth * 0.6, Math.max(200, w))), apply, true, true);
    addEventListener('resize', refit);
    return refit;
}

const left = document.getElementById('left');
if (left)
{
    left.style.flex = 'none';
    splitter(left, `tools.left.${tool}`, 'left-grip', (w) => Math.round(Math.min(innerWidth * 0.6, Math.max(80, w))),
        (w) => {left.style.width = w ? `${w}px` : '';});
}

// 右欄（有 data-resize-right）固定寬度、左邊框拖拉，中間吃剩下的（記 tools.right.<工具>）
const rpanel = document.querySelector('[data-resize-right]');
if (rpanel)
{
    rpanel.style.flex = 'none';
    splitter(rpanel, `tools.right.${tool}`, 'right-grip', (w) => Math.round(Math.min(innerWidth * 0.6, Math.max(200, w))),
        (w) => {rpanel.style.width = w ? `${w}px` : '';}, true);
}

// 中間欄固定寬度、右欄吃剩下的（右欄至少留它 CSS 的 min-width）；視窗縮放時重夾，不改記住的值
// 右欄是空的（沒選東西）時中間照舊吃滿、把手藏起來，有內容再套回記住的寬度
const mid = document.querySelector('[data-resize]');
const right = mid?.nextElementSibling;
if (mid && right)
{
    const MIN = 200;
    const empty = () => right.childElementCount === 0;
    const clamp = (w) => {
        const room = mid.parentElement.getBoundingClientRect().right - mid.getBoundingClientRect().left - (parseFloat(getComputedStyle(right).minWidth) || 0);
        return Math.round(Math.max(MIN, Math.min(room, w)));
    };
    const apply = (w) => {
        if (empty()) w = 0;
        Object.assign(mid.style, w ? {width: `${w}px`, flex: 'none'} : {width: '', flex: ''});
        Object.assign(right.style, w ? {flex: '1', maxWidth: 'none'} : {flex: '', maxWidth: ''});
    };
    const refit = splitter(mid, `tools.mid.${tool}`, 'mid-grip', clamp, apply);
    const grip = mid.nextElementSibling;
    const sync = () => {grip.style.display = empty() ? 'none' : ''; refit();};
    sync();
    new MutationObserver(sync).observe(right, {childList: true});
    addEventListener('resize', refit);
}
