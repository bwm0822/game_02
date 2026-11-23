// 擺設切前後片的對話框（只有手繪）：頂點吸整數像素、圈起來的＝後片；1px 對齊＝像素中心在多邊形內才算後片，不反鋸齒，兩張疊回去＝原圖
// 見 docs/scene-tool.md「切前後片」
import {h} from '../common/dom.js';
import {panzoom, createView, zoomField, centerBtn, center} from '../common/panzoom.js';

const LS_PV = 'tools.scene.cutPreview';
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};
const GRID_K = 8;           // 放大到幾倍以上畫像素格線
const TINT = [60, 130, 255, 0.55];
const view = createView('tools.scene.cutView');

// 後片的像素：掃描線，像素中心 (x+.5, y+.5) 在多邊形內（奇偶規則）＝1
export function cutMask(W, H, pts)
{
    const M = new Uint8Array(W * H), n = pts.length;
    for (let y = 0; y < H; y++)
    {
        const cy = y + 0.5, xs = [];
        for (let i = 0; i < n; i++)
        {
            const a = pts[i], b = pts[(i + 1) % n];
            if ((a[1] <= cy) !== (b[1] <= cy)) xs.push(a[0] + (cy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2)
        {
            const x0 = Math.max(0, Math.ceil(xs[k] - 0.5)), x1 = Math.min(W, Math.ceil(xs[k + 1] - 0.5));
            for (let x = x0; x < x1; x++) M[y * W + x] = 1;
        }
    }
    return M;
}

// keep＝1：只留後片（mask 內）；keep＝0：只留前片
export function cutPiece(src, M, keep)
{
    const W = src.width, H = src.height;
    const c = Object.assign(document.createElement('canvas'), {width: W, height: H}), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < W * H; i++) if (M[i] !== keep) d[i * 4 + 3] = 0;
    g.putImageData(img, 0, 0);
    return c;
}

// 原圖＋後片染藍（只染不透明的像素）
function tinted(src, M)
{
    const W = src.width, H = src.height;
    const c = Object.assign(document.createElement('canvas'), {width: W, height: H}), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const img = g.getImageData(0, 0, W, H), d = img.data, [r, gg, b, a] = TINT;
    for (let i = 0; i < W * H; i++)
    {
        if (!M[i] || !d[i * 4 + 3]) continue;
        d[i * 4] += (r - d[i * 4]) * a;
        d[i * 4 + 1] += (gg - d[i * 4 + 1]) * a;
        d[i * 4 + 2] += (b - d[i * 4 + 2]) * a;
    }
    g.putImageData(img, 0, 0);
    return c;
}

// Shift：從 from 出發的方向鎖在 45° 的倍數（游標投影到那條線上）
function snap45(from, p)
{
    const dx = p.x - from.x, dy = p.y - from.y, a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4;
    const c = Math.cos(a), s = Math.sin(a), t = dx * c + dy * s;
    return {x: from.x + t * c, y: from.y + t * s};
}
const grid = (p) => ({x: Math.round(p.x), y: Math.round(p.y)});

let dlg = null;

// src：要切的圖（canvas，已經照 pct 縮好）；side：右欄下方的元素（檔名）；check：async () => 錯誤字串｜null
// → {pts: [[x,y]…]（整數像素）}｜null（取消）
export function cutDialog({src, title, side, check})
{
    dlg ??= document.body.appendChild(h('dialog', {id: 'dlgCut'}));
    const W = src.width, H = src.height;
    const S = {P: null, err: null};
    let pv = ['src', 'front', 'back'].includes(ls.get(LS_PV)) ? ls.get(LS_PV) : 'src';
    const undo = [], redo = [];
    const snap = () => S.P && {...S.P, pts: S.P.pts.map(p => ({...p}))};
    const commit = (before = snap()) => {undo.push(before); redo.length = 0;};
    const cv = h('canvas', {class: 'cutcv'}), g = cv.getContext('2d');
    const msg = h('span', {class: 'cutmsg'});
    const tol = () => 8 / pz.K;
    const pts2 = () => S.P.pts.map(p => [p.x, p.y]);

    // 預覽：多邊形變了才重算
    let pvKey = null, pvCv = null;
    const pvImg = () => {
        if (!S.P?.closed) return src;
        const key = `${pv}|${JSON.stringify(pts2())}`;
        if (key === pvKey) return pvCv;
        const M = cutMask(W, H, pts2());
        pvKey = key;
        return (pvCv = pv === 'front' ? cutPiece(src, M, 0) : pv === 'back' ? cutPiece(src, M, 1) : tinted(src, M));
    };

    const draw = () => {
        const {K, cw, ch, o} = pz.begin(g, (gg, w, hh) => {gg.fillStyle = '#202226'; gg.fillRect(0, 0, w, hh);});
        g.translate(-W / 2, -H / 2);
        g.imageSmoothingEnabled = K < 2;
        g.drawImage(pvImg(), 0, 0);
        g.lineWidth = 1 / K;
        if (K >= GRID_K)
        {
            // 只畫看得到的那段
            const x0 = Math.max(0, Math.floor(-o.x / K + W / 2)), x1 = Math.min(W, Math.ceil((cw - o.x) / K + W / 2));
            const y0 = Math.max(0, Math.floor(-o.y / K + H / 2)), y1 = Math.min(H, Math.ceil((ch - o.y) / K + H / 2));
            g.strokeStyle = 'rgba(255,255,255,.12)';
            g.beginPath();
            for (let x = x0; x <= x1; x++) {g.moveTo(x, y0); g.lineTo(x, y1);}
            for (let y = y0; y <= y1; y++) {g.moveTo(x0, y); g.lineTo(x1, y);}
            g.stroke();
        }
        g.setLineDash([4 / K, 4 / K]);
        g.strokeStyle = 'rgba(255,255,255,.35)';
        g.strokeRect(0, 0, W, H);
        g.setLineDash([]);
        const P = S.P;
        if (P)
        {
            g.strokeStyle = '#4af';
            g.lineWidth = 1.5 / K;
            g.beginPath();
            [...P.pts, ...(!P.closed && P.cursor ? [P.cursor] : [])].forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
            if (P.closed) g.closePath();
            g.stroke();
            if (P.closed && P.edge != null)
            {
                const a = P.pts[P.edge], b = P.pts[(P.edge + 1) % P.pts.length];
                g.lineWidth = 3 / K;
                g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            }
            g.lineWidth = 1 / K;
            g.fillStyle = '#fff';
            g.strokeStyle = '#000';
            P.pts.forEach((p, i) => {
                const r = (i === P.vert || (i === 0 && !P.closed && P.cursor && nearFirst(P.cursor)) ? 5 : 3) / K;
                g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
                g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
            });
        }
        msg.textContent = S.err ?? (P?.closed ? `後片 ${P.pts.length} 點` : P ? '還沒閉合（點第一點或雙擊）' : '點頂點圍出後片');
    };
    const pz = panzoom(cv, {frame: () => ({w: W * 1.1, h: H * 1.1}), redraw: draw, view});

    const raw = (e) => {const p = pz.toWorld(e); return {x: p.x + W / 2, y: p.y + H / 2};};
    const nearFirst = (p) => S.P.pts.length >= 3 && Math.hypot(S.P.pts[0].x - p.x, S.P.pts[0].y - p.y) < tol();
    const vertexAt = (p) => S.P.pts.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) < tol());
    const edgeAt = (p) => {
        const n = S.P.pts.length;
        let best = null;
        for (let i = 0; i < n; i++)
        {
            const a = S.P.pts[i], b = S.P.pts[(i + 1) % n], dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
            const t = len2 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
            const q = {x: a.x + t * dx, y: a.y + t * dy}, d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d < tol() && (!best || d < best.d)) best = {i, q, d};
        }
        return best;
    };
    // 新頂點：Shift 從 from 鎖 45°，再吸整數像素
    const place = (p, from, e) => grid(e.shiftKey && from ? snap45(from, p) : p);

    let drag = null;
    cv.onpointerdown = (e) => {
        if (e.button !== 0) return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        const p = raw(e), P = S.P;
        S.err = null;
        if (!P) {commit(); S.P = {pts: [grid(p)], closed: false, cursor: grid(p)};}
        else if (!P.closed)
        {
            commit();
            if ((e.detail >= 2 && P.pts.length >= 3) || nearFirst(p)) P.closed = true;
            else P.pts.push(place(p, P.pts.at(-1), e));
        }
        else
        {
            const i = vertexAt(p);
            if (i >= 0) drag = {i, before: snap()};
            else
            {
                const hit = edgeAt(p);
                if (hit)
                {
                    commit();
                    P.pts.splice(hit.i + 1, 0, grid(hit.q));
                    P.edge = null;
                    drag = {i: hit.i + 1};
                }
            }
        }
        draw();
    };
    cv.onpointermove = (e) => {
        if (pz.panning || !S.P) return;
        const p = raw(e), P = S.P;
        if (drag)
        {
            if (drag.before) {commit(drag.before); drag.before = null;}
            const n = P.pts.length, q = place(p, P.pts[(drag.i - 1 + n) % n], e);
            if (q.x === P.pts[drag.i].x && q.y === P.pts[drag.i].y) return;
            P.pts[drag.i] = q;
        }
        else if (!P.closed) {P.cursor = place(p, P.pts.at(-1), e); const v = vertexAt(p); P.vert = v >= 0 ? v : null;}
        else {const v = vertexAt(p); P.vert = v >= 0 ? v : null; P.edge = v < 0 ? edgeAt(p)?.i ?? null : null;}
        draw();
    };
    cv.onpointerup = () => {drag = null;};

    const step = (from, to) => {
        if (!from.length) return;
        to.push(snap());
        S.P = from.pop();
        S.err = null;
        draw();
    };
    dlg.onkeydown = (e) => {
        if (e.target.matches('input, select, textarea')) return;
        const k = e.key.toLowerCase(), P = S.P;
        if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'y')) {e.preventDefault(); (k === 'y' || e.shiftKey) ? step(redo, undo) : step(undo, redo);}
        else if (!P || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
        // 指著頂點＝刪那點；沒指著：Backspace（沒閉合時 Del 也一樣）退最後一點，已閉合先解開
        else if (P.vert != null)
        {
            e.preventDefault();
            if (P.closed && P.pts.length <= 3) {S.err = '多邊形最少要 3 點'; return draw();}
            commit();
            P.pts.splice(P.vert, 1);
            P.vert = null;
            if (!P.pts.length) S.P = null;
            draw();
        }
        else if (e.key === 'Backspace' || !P.closed)
        {
            e.preventDefault();
            commit();
            if (P.closed) P.closed = false;
            else if (P.pts.length > 1) P.pts.pop();
            else S.P = null;
            draw();
        }
    };

    const radio = (v, t) => h('label', null, h('input', {type: 'radio', name: 'cutPv', value: v, checked: pv === v, onchange: () => {pv = v; ls.set(LS_PV, v); draw();}}), t);
    const ok = h('button', {type: 'button'}, '確定');
    const cancel = h('button', {type: 'button'}, '取消');
    dlg.replaceChildren(
        h('div', {class: 'title'}, title),
        h('div', {class: 'cutbody'},
            h('div', {class: 'cutview'}, cv),
            h('div', {class: 'cutside'},
                h('div', {class: 'row2'}, '看 ', radio('src', '原圖＋後片'), radio('front', '前片'), radio('back', '後片')),
                h('div', {class: 'row2'}, zoomField(view), centerBtn(view, '圖放回中央、倍率剛好裝滿'), h('span', {class: 'dim'}, `${W}×${H}`)),
                h('div', {class: 'hint'}, '圈起來的＝後片（藍色），其餘＝前片；頂點吸整數像素，像素中心在圈內才算後片（兩張疊回去＝原圖）。',
                    `點頂點、點第一點或雙擊閉合、Shift 鎖 45°；閉合後拖頂點、點邊插點；指著頂點按 Del 刪點、Backspace 退一點；Ctrl+Z／Y 復原；滾輪縮放（×${GRID_K} 以上有像素格線）、中鍵平移`),
                side)),
        h('div', {class: 'row2 buttons'}, msg, h('span', {class: 'grow'}), ok, cancel));

    // 無頭測試用：狀態＋像素座標換成滑鼠座標
    dlg.__cut = {S, src, toClient: (x, y) => {
        const rc = cv.getBoundingClientRect(), o = pz.o;
        return {clientX: rc.left + o.x + (x - W / 2) * pz.K, clientY: rc.top + o.y + (y - H / 2) * pz.K};
    }};
    return new Promise(res => {
        const done = (v) => {
            dlg.onkeydown = null;
            dlg.close();
            res(v);
        };
        ok.onclick = async () => {
            if (!S.P?.closed) {S.err = S.P ? '多邊形還沒閉合' : '還沒圈後片'; return draw();}
            const err = await check?.();
            if (err) {S.err = err; return draw();}
            done({pts: pts2()});
        };
        cancel.onclick = () => done(null);
        dlg.oncancel = (e) => {e.preventDefault(); if (!drag) done(null);};
        dlg.showModal();
        draw();
        requestAnimationFrame(() => center(view));
    });
}
