// 預覽畫布的縮放平移（同紙娃娃）：畫布鋪滿外框，滾輪以游標為中心 ×1.2、按住中鍵拖曳平移
// view＝{zoom, ox, oy}：世界原點（角色的 view 中心）在畫布中心＋(ox, oy) 螢幕 px；每頁（每個工具 iframe）一組、同頁的預覽共用，
// 換條目不動，記在 localStorage tools.preview.view.<工具>；沒記過＝第一次畫時置中
import {h} from './dom.js';

export const ZOOM_MIN = 0.1, ZOOM_MAX = 20;
const GRID = [...Array.from({length: 9}, (_, i) => (i + 1) / 10), 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20];
export const stepZoom = (z, dir) => (dir > 0 ? GRID.find(g => g > z + 1e-9) : GRID.findLast(g => g < z - 1e-9)) ?? z;
const clamp = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
const r3 = (v) => Math.round(v * 1000) / 1000;

const tool = location.pathname.split('/').filter(s => s && !s.endsWith('.html')).at(-1);
const KEY = `tools.preview.view.${tool}`;
export const V = {zoom: 3, ox: 0, oy: 0, set: false};
try
{
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Number.isFinite(v?.zoom)) Object.assign(V, {zoom: clamp(v.zoom), ox: +v.ox || 0, oy: +v.oy || 0, set: true});
} catch {}
const save = () => {try {localStorage.setItem(KEY, JSON.stringify({zoom: V.zoom, ox: V.ox, oy: V.oy}));} catch {}};

// 畫在頁面上的預覽（canvas → redraw）；view 變了全部重畫、倍率欄跟著換
const live = new Map();
function changed()
{
    V.set = true;
    save();
    for (const inp of document.querySelectorAll('input.zoom')) if (document.activeElement !== inp) inp.value = r3(V.zoom);
    for (const [cv, redraw] of live) cv.isConnected ? redraw() : live.delete(cv);
}

// (rx, ry)：縮放中心，相對畫布中心的螢幕 px（預設畫布中心）
export function setZoom(z, rx = 0, ry = 0)
{
    const f = clamp(z) / V.zoom;
    V.zoom = clamp(z);
    V.ox = rx - (rx - V.ox) * f;
    V.oy = ry - (ry - V.oy) * f;
    changed();
}

// 置中：原點放回畫布中央、倍率剛好裝下 frame()（世界單位 {w, h}，以原點為中心）；畫布還沒有大小就等第一次畫
let centerOf = null;
export function center()
{
    const c = centerOf?.();
    if (!c) return;
    V.zoom = clamp(c.z);
    V.ox = V.oy = 0;
    changed();
}

// frame()：置中要裝下的範圍；redraw()：重畫這張畫布（呼叫端的 draw）
// 回傳 {K, o, begin(g)}：o＝世界原點在畫布上的位置（css px）；begin 量好畫布大小、填底、換到世界座標，回傳 {K, o, cw, ch}
export function panzoom(cv, {frame, redraw})
{
    live.set(cv, redraw);
    // 用 rect（小數）不用 clientWidth（取整數），滾輪縮放中心才對得準
    const size = () => {const rc = cv.getBoundingClientRect(); return {cw: rc.width, ch: rc.height};};
    const fit = () => {
        const {cw, ch} = size(), f = frame();
        return cw && ch ? {z: Math.min(cw / f.w, ch / f.h)} : null;
    };
    centerOf = fit;
    const pz = {
        get K() {return V.zoom;},
        get o() {const {cw, ch} = size(); return {x: cw / 2 + V.ox, y: ch / 2 + V.oy};},
        panning: false,
        toWorld(e)
        {
            const rc = cv.getBoundingClientRect(), o = pz.o;
            return {x: (e.clientX - rc.left - o.x) / V.zoom, y: (e.clientY - rc.top - o.y) / V.zoom};
        },
        // bg(g, cw, ch)：在螢幕座標填底
        begin(g, bg)
        {
            const dpr = devicePixelRatio || 1, {cw, ch} = size();
            const w = Math.max(1, Math.round(cw * dpr)), hh = Math.max(1, Math.round(ch * dpr));
            if (cv.width !== w || cv.height !== hh) {cv.width = w; cv.height = hh;}
            if (!V.set && cw && ch) {const c = fit(); V.zoom = clamp(c.z); V.ox = V.oy = 0; V.set = true;}
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            bg?.(g, cw, ch);
            const o = pz.o, K = V.zoom;
            g.setTransform(K * dpr, 0, 0, K * dpr, o.x * dpr, o.y * dpr);
            return {K, o, cw, ch};
        },
    };
    let pan = null;
    // 中鍵按下時擋掉 Chrome 的自動捲動
    cv.addEventListener('mousedown', e => {if (e.button === 1) e.preventDefault();});
    cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 1) return;
        e.preventDefault();
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        pan = {x: e.clientX, y: e.clientY, ox: V.ox, oy: V.oy};
        pz.panning = true;
        cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', (e) => {
        if (!pan) return;
        V.ox = pan.ox + e.clientX - pan.x;
        V.oy = pan.oy + e.clientY - pan.y;
        changed();
    });
    const end = () => {
        if (!pan) return;
        pan = null;
        pz.panning = false;
        cv.style.cursor = '';
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rc = cv.getBoundingClientRect();
        setZoom(V.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX - rc.left - rc.width / 2, e.clientY - rc.top - rc.height / 2);
    }, {passive: false});
    new ResizeObserver(() => cv.isConnected && redraw()).observe(cv);
    return pz;
}

// 倍率數字欄：可直接打；↑↓、上下三角形照格子走（小於 1 每次 0.1、1～6 每次 1，再上去 8/10/12/16/20）
export function zoomField()
{
    const inp = h('input', {type: 'number', class: 'num zoom', min: ZOOM_MIN, max: ZOOM_MAX, step: 0.1, value: r3(V.zoom),
        title: `倍率 ${ZOOM_MIN}～${ZOOM_MAX}（滾輪縮放、按住中鍵拖曳平移）`,
        // 點上下三角形的 input 事件沒有 inputType（打字才有），只拿來判斷方向、改照格子走
        oninput: e => {
            if (e.inputType) return;
            const v = parseFloat(e.target.value);
            if (!Number.isFinite(v) || v === V.zoom) return;
            const z = stepZoom(V.zoom, v > V.zoom ? 1 : -1);
            e.target.value = z;
            setZoom(z);
        },
        onchange: e => {const v = parseFloat(e.target.value); Number.isFinite(v) && v > 0 ? setZoom(v) : e.target.value = r3(V.zoom);},
        onkeydown: e => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            setZoom(stepZoom(V.zoom, e.key === 'ArrowUp' ? 1 : -1));
            e.target.value = r3(V.zoom);
        }});
    return h('label', null, '×', inp);
}

export const centerBtn = () => h('button', {type: 'button', class: 'center', title: '角色放回中央、倍率剛好裝滿畫布', onclick: center}, '置中');
