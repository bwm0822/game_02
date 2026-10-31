// 左欄 #left、中間欄（有 data-resize 的 #view）的右邊框拖拉改寬度：各工具分開記在 localStorage
// （tools.left.<工具資料夾>、tools.mid.<工具資料夾>），雙擊恢復 CSS 預設
// 把手是欄位後面的兄弟元素（欄位常會自己捲動，放裡面會跟著捲走）
const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);

// clamp(w)：夾範圍；apply(w)：w 是 0 時恢復預設；回傳照記住的值重套（視窗縮放用）
function splitter(panel, key, cls, clamp, apply)
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
    panel.after(grip);

    grip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const [x0, w0] = [e.clientX, panel.getBoundingClientRect().width];
        if (e.isTrusted) grip.setPointerCapture(e.pointerId);
        document.body.style.userSelect = 'none';
        const move = (ev) => set(w0 + ev.clientX - x0);
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

const left = document.getElementById('left');
if (left)
{
    left.style.flex = 'none';
    splitter(left, `tools.left.${tool}`, 'left-grip', (w) => Math.round(Math.min(innerWidth * 0.6, Math.max(80, w))),
        (w) => {left.style.width = w ? `${w}px` : '';});
}

// 中間欄固定寬度、右欄吃剩下的（右欄至少留它 CSS 的 min-width）；視窗縮放時重夾，不改記住的值
const mid = document.querySelector('[data-resize]');
const right = mid?.nextElementSibling;
if (mid && right)
{
    const MIN = 200;
    const clamp = (w) => {
        const room = mid.parentElement.getBoundingClientRect().right - mid.getBoundingClientRect().left - (parseFloat(getComputedStyle(right).minWidth) || 0);
        return Math.round(Math.max(MIN, Math.min(room, w)));
    };
    const apply = (w) => {
        Object.assign(mid.style, w ? {width: `${w}px`, flex: 'none'} : {width: '', flex: ''});
        Object.assign(right.style, w ? {flex: '1', maxWidth: 'none'} : {flex: '', maxWidth: ''});
    };
    addEventListener('resize', splitter(mid, `tools.mid.${tool}`, 'mid-grip', clamp, apply));
}
