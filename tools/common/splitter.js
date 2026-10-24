// 左欄 #left 右邊框拖拉改寬度：各工具分開記在 localStorage（tools.left.<工具資料夾>），雙擊恢復 CSS 預設
// 把手是 #left 後面的兄弟元素（#left 常會自己捲動，放裡面會跟著捲走）
const left = document.getElementById('left');
if (left)
{
    const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);
    const KEY = `tools.left.${tool}`;
    const clamp = (w) => Math.round(Math.min(innerWidth * 0.6, Math.max(80, w)));
    const set = (w) => {left.style.width = w ? `${clamp(w)}px` : '';};
    const store = (w) => {
        try {w ? localStorage.setItem(KEY, w) : localStorage.removeItem(KEY);}
        catch {}
    };

    left.style.flex = 'none';
    try {set(+localStorage.getItem(KEY));}
    catch {}

    const grip = document.createElement('div');
    grip.className = 'left-grip';
    grip.title = '拖拉改寬度，雙擊恢復預設';
    Object.assign(grip.style, {flex: 'none', width: '6px', margin: '0 -3px', position: 'relative', zIndex: 5, cursor: 'col-resize', touchAction: 'none'});
    left.after(grip);

    grip.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        const [x0, w0] = [e.clientX, left.getBoundingClientRect().width];
        if (e.isTrusted) grip.setPointerCapture(e.pointerId);
        document.body.style.userSelect = 'none';
        const move = (ev) => set(w0 + ev.clientX - x0);
        const up = () => {
            grip.removeEventListener('pointermove', move);
            grip.removeEventListener('pointerup', up);
            document.body.style.userSelect = '';
            store(parseFloat(left.style.width));
        };
        grip.addEventListener('pointermove', move);
        grip.addEventListener('pointerup', up);
    });
    grip.addEventListener('dblclick', () => {set(0); store(0);});
}
