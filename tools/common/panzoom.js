// 預覽畫布的縮放平移（同紙娃娃）：畫布鋪滿外框，滾輪以游標為中心 ×1.2、按住中鍵拖曳平移
// view＝{zoom, ox, oy}：世界原點（角色的 view 中心）在畫布中心＋(ox, oy) 螢幕 px；每頁（每個工具 iframe）預設一組 V、同頁的預覽共用，
// 換條目不動，記在 localStorage tools.preview.view.<工具>；沒記過＝第一次畫時置中
// 要另外一組（例如角色分頁的作息地圖，每張地圖一組）用 createView(key)，panzoom／zoomField／centerBtn／setZoom／center 帶 view
import {h} from './dom.js';

export const ZOOM_MIN = 0.1, ZOOM_MAX = 20;
const GRID = [...Array.from({length: 9}, (_, i) => (i + 1) / 10), 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
export const stepZoom = (z, dir) => (dir > 0 ? GRID.find(g => g > z + 1e-9) : GRID.findLast(g => g < z - 1e-9)) ?? z;
// v.max：這組 view 自己的倍率上限（地圖分頁的世界總覽）
const clamp = (z, v) => Math.min(v?.max ?? ZOOM_MAX, Math.max(ZOOM_MIN, z));
const r3 = (v) => Math.round(v * 1000) / 1000;

const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);

export function createView(key, {max} = {})
{
    const v = {key, zoom: 3, ox: 0, oy: 0, set: false, centerOf: null, max};
    try
    {
        const s = JSON.parse(localStorage.getItem(key));
        if (Number.isFinite(s?.zoom)) Object.assign(v, {zoom: clamp(s.zoom, v), ox: +s.ox || 0, oy: +s.oy || 0, set: true});
    } catch {}
    return v;
}
export const V = createView(`tools.preview.view.${tool}`);
const save = (v) => {try {localStorage.setItem(v.key, JSON.stringify({zoom: v.zoom, ox: v.ox, oy: v.oy}));} catch {}};

// 畫在頁面上的預覽（canvas → {redraw, view}）；view 變了重畫用這組 view 的、倍率欄跟著換
const live = new Map();
const zooms = new Map();    // 倍率欄 input → view
function changed(v)
{
    v.set = true;
    save(v);
    for (const [inp, iv] of zooms)
    {
        if (!inp.isConnected) {zooms.delete(inp); continue;}
        if (iv === v && document.activeElement !== inp) inp.value = r3(v.zoom);
    }
    for (const [cv, e] of live)
    {
        if (!cv.isConnected) live.delete(cv);
        else if (e.view === v) e.redraw();
    }
}

// (rx, ry)：縮放中心，相對畫布中心的螢幕 px（預設畫布中心）
export function setZoom(z, rx = 0, ry = 0, v = V)
{
    const f = clamp(z, v) / v.zoom;
    v.zoom = clamp(z, v);
    v.ox = rx - (rx - v.ox) * f;
    v.oy = ry - (ry - v.oy) * f;
    changed(v);
}

// 置中：原點放回畫布中央、倍率剛好裝下 frame()（世界單位 {w, h}，以原點為中心）；畫布還沒有大小就等第一次畫
export function center(v = V)
{
    const c = v.centerOf?.();
    if (!c) return;
    v.zoom = clamp(c.z, v);
    v.ox = v.oy = 0;
    changed(v);
}

// frame()：置中要裝下的範圍；redraw()：重畫這張畫布（呼叫端的 draw）；view：用哪組（預設 V）
// leftPan：左鍵按住拖超過 4px 也平移（拖過的話 pz.dragged 在接著的 click 時是 true，呼叫端拿來吃掉點擊）
// 回傳 {K, o, begin(g)}：o＝世界原點在畫布上的位置（css px）；begin 量好畫布大小、填底、換到世界座標，回傳 {K, o, cw, ch}
export function panzoom(cv, {frame, redraw, view = V, leftPan = false})
{
    const v = view;
    live.set(cv, {redraw, view: v});
    // 用 rect（小數）不用 clientWidth（取整數），滾輪縮放中心才對得準
    const size = () => {const rc = cv.getBoundingClientRect(); return {cw: rc.width, ch: rc.height};};
    const fit = () => {
        const {cw, ch} = size(), f = frame();
        return cw && ch ? {z: Math.min(cw / f.w, ch / f.h)} : null;
    };
    v.centerOf = fit;
    const pz = {
        view: v,
        get K() {return v.zoom;},
        get o() {const {cw, ch} = size(); return {x: cw / 2 + v.ox, y: ch / 2 + v.oy};},
        panning: false,
        toWorld(e)
        {
            const rc = cv.getBoundingClientRect(), o = pz.o;
            return {x: (e.clientX - rc.left - o.x) / v.zoom, y: (e.clientY - rc.top - o.y) / v.zoom};
        },
        // bg(g, cw, ch)：在螢幕座標填底
        begin(g, bg)
        {
            const dpr = devicePixelRatio || 1, {cw, ch} = size();
            const w = Math.max(1, Math.round(cw * dpr)), hh = Math.max(1, Math.round(ch * dpr));
            if (cv.width !== w || cv.height !== hh) {cv.width = w; cv.height = hh;}
            if (!v.set && cw && ch) {const c = fit(); v.zoom = clamp(c.z, v); v.ox = v.oy = 0; v.set = true;}
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            bg?.(g, cw, ch);
            const o = pz.o, K = v.zoom;
            g.setTransform(K * dpr, 0, 0, K * dpr, o.x * dpr, o.y * dpr);
            return {K, o, cw, ch};
        },
    };
    let pan = null;
    // 中鍵按下時擋掉 Chrome 的自動捲動
    cv.addEventListener('mousedown', e => {if (e.button === 1) e.preventDefault();});
    cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 1 && !(leftPan && e.button === 0)) return;
        if (e.button === 1) e.preventDefault();
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        // 左鍵：先記著，移超過 4px 才算平移（沒移就是點擊）
        pan = {x: e.clientX, y: e.clientY, ox: v.ox, oy: v.oy, left: e.button === 0, moved: e.button === 1};
        pz.dragged = false;
        if (pan.moved) {pz.panning = true; cv.style.cursor = 'grabbing';}
    });
    cv.addEventListener('pointermove', (e) => {
        if (!pan) return;
        if (!pan.moved)
        {
            if (Math.hypot(e.clientX - pan.x, e.clientY - pan.y) < 4) return;
            pan.moved = true;
            pz.panning = true;
            cv.style.cursor = 'grabbing';
        }
        v.ox = pan.ox + e.clientX - pan.x;
        v.oy = pan.oy + e.clientY - pan.y;
        changed(v);
    });
    const end = () => {
        if (!pan) return;
        if (pan.left && pan.moved) {pz.dragged = true; setTimeout(() => {pz.dragged = false;}, 0);}
        pan = null;
        pz.panning = false;
        cv.style.cursor = '';
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rc = cv.getBoundingClientRect();
        setZoom(v.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - rc.left - rc.width / 2, e.clientY - rc.top - rc.height / 2, v);
    }, {passive: false});
    new ResizeObserver(() => cv.isConnected && redraw()).observe(cv);
    return pz;
}

// 倍率數字欄：可直接打；↑↓、上下三角形照格子走（小於 1 每次 0.1、1～6 每次 1，再上去 8/10/12/16/20）
export function zoomField(v = V)
{
    const inp = h('input', {type: 'number', class: 'num zoom', min: ZOOM_MIN, max: v.max ?? ZOOM_MAX, step: 0.1, value: r3(v.zoom),
        title: `倍率 ${ZOOM_MIN}～${v.max ?? ZOOM_MAX}（滾輪縮放、按住中鍵拖曳平移）`,
        // 點上下三角形的 input 事件沒有 inputType（打字才有），只拿來判斷方向、改照格子走
        oninput: e => {
            if (e.inputType) return;
            const n = parseFloat(e.target.value);
            if (!Number.isFinite(n) || n === v.zoom) return;
            const z = stepZoom(v.zoom, n > v.zoom ? 1 : -1);
            e.target.value = z;
            setZoom(z, 0, 0, v);
        },
        onchange: e => {const n = parseFloat(e.target.value); Number.isFinite(n) && n > 0 ? setZoom(n, 0, 0, v) : e.target.value = r3(v.zoom);},
        onkeydown: e => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            setZoom(stepZoom(v.zoom, e.key === 'ArrowUp' ? 1 : -1), 0, 0, v);
            e.target.value = r3(v.zoom);
        }});
    zooms.set(inp, v);
    return h('label', null, '×', inp);
}

export const centerBtn = (v = V, title = '角色放回中央、倍率剛好裝滿畫布') => h('button', {type: 'button', class: 'center', title, onclick: () => center(v)}, '置中');
