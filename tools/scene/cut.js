// 切前後片的對話框（擺設、prefab png 零件共用）：魔術棒點一下產生多邊形、手繪改頂點／補點（Ctrl 磁性套索），圈起來的＝後片；見 docs/scene-tool.md
// cutDialog({src: canvas（原圖，像素座標）, title, pts?: [[x,y]…]（重切帶回）, side: 右欄下方的元素（資料夾／檔名）, check: async () => 錯誤字串｜null})
// → {pts: [[x,y]…]}｜null（取消）
import {h} from '../common/dom.js';
import * as PE from '../common/polyedit.js';
import * as PX from '../paperdoll/pixels.js';
import * as CFG from '../common/settings.js';
import {panzoom, createView, zoomField, centerBtn, center} from '../common/panzoom.js';

const LS_METHOD = 'tools.scene.cutMethod', LS_PV = 'tools.scene.cutPreview';
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};
const WAND = [['lum', '輪廓亮度', '亮度低於它當輪廓線（0＝沒有線，只靠透明停）'], ['close', '閉運算', '填平寬 ≤ 2×它的縫（px，0＝不做）'],
              ['drop', '往下射', '每一直行下緣往下幾格內碰到透明就收進來（0＝不做）'], ['right', '往右射', '每一橫列右緣往右幾格（0＝不做）']];
const TINT = 'rgba(60,130,255,.55)';
const view = createView('tools.scene.cutView');

let dlg = null;
function build()
{
    dlg = h('dialog', {id: 'dlgCut'});
    document.body.append(dlg);
    return dlg;
}

const r2 = (v) => Math.round(v * 100) / 100;

export function cutDialog({src, title, pts, side, check})
{
    dlg ??= build();
    const W = src.width, H = src.height;
    const m = {poly: pts?.length >= 3 ? {pts: pts.map(([x, y]) => ({x, y})), closed: true} : null, method: pts ? 'hand' : ls.get(LS_METHOD) === 'hand' ? 'hand' : 'wand',
               start: null, err: null, mag: null};
    let pv = ['src', 'front', 'back'].includes(ls.get(LS_PV)) ? ls.get(LS_PV) : 'src';
    const undo = [], redo = [];
    const snap = () => ({poly: m.poly && {...m.poly, pts: [...m.poly.pts]}, start: m.start, err: m.err});
    const commit = (before) => {undo.push(before); redo.length = 0;};
    const cv = h('canvas', {class: 'cutcv'}), g = cv.getContext('2d');
    const host = {scr: (n) => n / pz.K, grad: () => PX.gradMap(src), mag: () => CFG.get('mag'), commit, before: snap};
    const msg = h('span', {class: 'dim cutmsg'});
    const wand = () => CFG.get('scene').wand;

    // 前片／後片／原圖＋後片染藍：多邊形變了才重算
    let pvKey = null, pvCv = null;
    const pvImg = () => {
        if (!m.poly?.closed) return src;
        const P = m.poly.pts.map(p => [p.x, p.y]), key = `${pv}|${JSON.stringify(P)}`;
        if (key === pvKey) return pvCv;
        pvKey = key;
        if (pv === 'front') return (pvCv = PX.mask(src, {pts: P, keep: false}));
        if (pv === 'back') return (pvCv = PX.mask(src, {pts: P, keep: true}));
        const c = PX.clone(src), t = PX.mask(src, {pts: P, keep: true}), tg = t.getContext('2d');
        tg.globalCompositeOperation = 'source-atop';
        tg.fillStyle = TINT;
        tg.fillRect(0, 0, W, H);
        c.getContext('2d').drawImage(t, 0, 0);
        return (pvCv = c);
    };

    const draw = () => {
        const {K} = pz.begin(g, (gg, cw, ch) => {gg.fillStyle = '#202226'; gg.fillRect(0, 0, cw, ch);});
        g.translate(-W / 2, -H / 2);
        g.imageSmoothingEnabled = K < 2;
        g.drawImage(pvImg(), 0, 0);
        g.lineWidth = 1 / K;
        g.setLineDash([4 / K, 4 / K]);
        g.strokeStyle = 'rgba(255,255,255,.35)';
        g.strokeRect(0, 0, W, H);
        g.setLineDash([]);
        if (m.start)
        {
            const {x, y} = m.start, r = 6 / K;
            g.strokeStyle = '#f0f';
            g.beginPath();
            g.moveTo(x + 0.5 - r, y + 0.5); g.lineTo(x + 0.5 + r, y + 0.5);
            g.moveTo(x + 0.5, y + 0.5 - r); g.lineTo(x + 0.5, y + 0.5 + r);
            g.stroke();
        }
        if (m.poly)
        {
            g.strokeStyle = '#4af';
            g.lineWidth = 1.5 / K;
            PE.draw(g, host, m.poly, (x, y) => ({x, y}), K);
        }
        msg.textContent = m.err ?? (m.poly?.closed ? `後片 ${m.poly.pts.length} 點` : m.poly ? '多邊形還沒閉合（點第一點或雙擊）' : m.method === 'wand' ? '點圖上要當後片的區域' : '點頂點圍出後片');
    };
    const pz = panzoom(cv, {frame: () => ({w: W * 1.1, h: H * 1.1}), redraw: draw, view});

    const runWand = () => {
        if (!m.start) return;
        const w = wand(), r = PX.splitCut(src, {...m.start, c: {lum: w.lum}, close: w.close, drop: w.drop, right: w.right});
        m.err = r.err ?? null;
        if (r.pts) m.poly = {pts: r.pts, closed: true};
    };
    const raw = (e) => {const p = pz.toWorld(e); return {x: p.x + W / 2, y: p.y + H / 2};};
    const delPt = (i) => {
        const P = m.poly;
        if (P.closed && P.pts.length <= 3) return (m.err = '多邊形最少要 3 點');
        commit(snap());
        m.poly = P.pts.length > 1 ? {...P, pts: P.pts.filter((_, k) => k !== i), vert: null, edge: null} : null;
    };

    let drag = null;
    cv.onpointerdown = (e) => {
        if (e.button !== 0) return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        const p = raw(e), before = snap(), P = m.poly;
        if (e.altKey)
        {
            const i = P ? PE.vertexHit(host, P, p) : -1;
            if (i >= 0) delPt(i);
        }
        else if (m.method === 'wand' && !(P?.closed && (PE.vertexHit(host, P, p) >= 0 || PE.edgeHit(host, P, p))))
        {
            commit(before);
            m.start = {x: Math.floor(p.x), y: Math.floor(p.y)};
            runWand();
        }
        else
        {
            const pts0 = P?.pts, closed0 = P?.closed;
            if (PE.magOn(m, e) && !m.mag) PE.magBegin(m, before);
            drag = PE.down(host, m, p, e);
            const changed = m.poly?.pts !== pts0 || m.poly?.closed !== closed0;
            if (m.mag) m.mag.changed ||= changed;
            else if (changed) commit(before);
            else if (drag) drag.before = before;
        }
        draw();
    };
    cv.onpointermove = (e) => {
        if (pz.panning) return;
        const p = raw(e);
        if (drag)
        {
            if (drag.before) {commit(drag.before); drag.before = null;}
            PE.drag(m, p, e, drag.i);
        }
        else if (m.poly) PE.hover(host, m, p, e);
        else return;
        draw();
    };
    cv.onpointerup = () => {drag = null;};

    const step = (from, to) => {
        const s = from.pop();
        if (!s) return;
        to.push(snap());
        Object.assign(m, s);
        draw();
    };
    const magStop = () => {if (m.mag) {PE.magEnd(host, m); draw();}};
    dlg.onkeydown = (e) => {
        if (e.target.matches('input, select, textarea') && e.key !== 'Escape') return;
        const k = e.key.toLowerCase();
        if (e.key !== 'Control' && e.key !== 'Shift') magStop();
        if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {e.preventDefault(); (k === 'y' || e.shiftKey) ? step(redo, undo) : step(undo, redo);}
        else if (!m.poly) return;
        // 沒指著頂點：Backspace 退最後一點（已閉合先解開），沒閉合時 Del 也一樣；指著頂點＝刪那點
        else if ((e.key === 'Delete' || e.key === 'Backspace') && m.poly.vert != null) {e.preventDefault(); delPt(m.poly.vert); draw();}
        else if (e.key === 'Backspace' || (e.key === 'Delete' && !m.poly.closed))
        {
            e.preventDefault();
            commit(snap());
            PE.back(m);
            if (m.poly) m.poly.cursor ??= m.poly.pts.at(-1);
            draw();
        }
    };
    dlg.onkeyup = (e) => {if (e.key === 'Control') magStop();};

    const radio = (name, v, t, cur, on) => h('label', null, h('input', {type: 'radio', name, value: v, checked: cur === v, onchange: () => on(v)}), t);
    const wandBox = h('div', {class: 'cutwand'});
    const fillWand = () => {
        const w = wand();
        wandBox.hidden = m.method !== 'wand';
        wandBox.replaceChildren(...WAND.map(([k, t, tip]) => h('label', {title: tip}, t, ' ', h('input', {type: 'number', class: 'n', min: 0, max: k === 'lum' ? 256 : 99, step: 1, value: w[k], dataset: {k},
            onchange: (e) => {
                const v = Math.max(0, Math.round(+e.target.value || 0));
                CFG.set('scene', {...CFG.get('scene'), wand: {...wand(), [k]: v}});
                if (m.start) {commit(snap()); runWand(); draw();}
            }}))));
    };
    fillWand();
    const setMethod = (v) => {m.method = v; ls.set(LS_METHOD, v); fillWand(); draw();};
    const setPv = (v) => {pv = v; ls.set(LS_PV, v); draw();};

    const ok = h('button', {type: 'button'}, '確定');
    const cancel = h('button', {type: 'button'}, '取消');
    dlg.replaceChildren(
        h('div', {class: 'title'}, title),
        h('div', {class: 'cutbody'},
            h('div', {class: 'cutview'}, cv),
            h('div', {class: 'cutside'},
                h('div', {class: 'row2'}, '切法 ', radio('cutMethod', 'wand', '魔術棒', m.method, setMethod), radio('cutMethod', 'hand', '手繪', m.method, setMethod)),
                wandBox,
                h('div', {class: 'row2'}, '看 ', radio('cutPv', 'src', '原圖＋後片', pv, setPv), radio('cutPv', 'front', '前片', pv, setPv), radio('cutPv', 'back', '後片', pv, setPv)),
                h('div', {class: 'row2'}, zoomField(view), centerBtn(view, '圖放回中央、倍率剛好裝滿')),
                h('div', {class: 'hint dim'}, '圈起來的＝後片（藍色），其餘＝前片。魔術棒：點區域產生多邊形；手繪：點頂點、點第一點或雙擊閉合、Ctrl＝磁性套索。',
                    '閉合後拖頂點、點邊插點；Alt＋點／指著按 Del 刪點、Backspace 退一點；Ctrl+Z／Y 復原；滾輪縮放、中鍵平移'),
                side)),
        h('div', {class: 'row2 buttons'}, msg, h('span', {class: 'grow'}), ok, cancel));

    // 無頭測試用：狀態＋像素座標換成滑鼠座標
    dlg.__cut = {m, src, toClient: (x, y) => {
        const rc = cv.getBoundingClientRect(), o = pz.o;
        return {clientX: rc.left + o.x + (x - W / 2) * pz.K, clientY: rc.top + o.y + (y - H / 2) * pz.K};
    }};
    return new Promise(res => {
        const done = (v) => {
            magStop();
            dlg.onkeydown = dlg.onkeyup = null;
            dlg.close();
            res(v);
        };
        ok.onclick = async () => {
            if (!m.poly?.closed) {m.err = m.poly ? '多邊形還沒閉合' : '還沒圈後片'; return draw();}
            const err = await check?.();
            if (err) {m.err = err; return draw();}
            done({pts: m.poly.pts.map(p => [r2(p.x), r2(p.y)])});
        };
        cancel.onclick = () => done(null);
        dlg.oncancel = (e) => {e.preventDefault(); if (!drag) done(null);};
        dlg.showModal();
        draw();
        requestAnimationFrame(() => center(view));
    });
}
