import {History} from './history.js';
import * as PX from './pixels.js';
import * as FS from './fs.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {const e = document.createElement(tag); if (cls) e.className = cls; return e;};
const RAD = Math.PI / 180;
const round = (v, n = 1000) => Math.round(v * n) / n;
const join = (path, name) => path ? `${path}/${name}` : name;

const cv = $('cv'), g = cv.getContext('2d');

// 世界座標 = 圖片像素；遊戲單位 = 世界座標 × scale
const S = {
    root: null,
    pendingRoot: null,
    projSig: null,      // 上次存／開專案時整個畫布的內容，跟現在比對出有沒有沒存的修改
    layers: [],
    active: null,
    scale: 0.25,
    applyScale: false,
    ref: {tw: 32, th: 32, rw: 32, rh: 64, ax: 0, ay: 16},
    view: {zoom: 0.5, px: 0, py: 0},
    mode: {type: 'move'},
    keys: new Set(),
};
const hist = new History();
let uid = 0;

const unit = () => S.applyScale ? S.scale : 1;
const zoomK = () => S.view.zoom * unit();
const status = (msg) => {$('status').textContent = msg;};

// ---------- 座標轉換 ----------

const modeScale = (L) => S.mode.type === 'scale' && S.mode.layer === L ? [S.mode.sx, S.mode.sy] : [1, 1];
const layerImg = (L) => S.mode.layer === L && S.mode.preview ? S.mode.preview : L.canvas;

function toWorld(L, px, py, [sx, sy] = modeScale(L))
{
    const img = layerImg(L);
    const dx = (px - L.ox * img.width) * sx, dy = (py - L.oy * img.height) * sy;
    const c = Math.cos(L.a * RAD), s = Math.sin(L.a * RAD);
    return {x: L.x + dx * c - dy * s, y: L.y + dx * s + dy * c};
}

function toLocal(L, wx, wy, [sx, sy] = modeScale(L))
{
    const img = layerImg(L);
    const dx = wx - L.x, dy = wy - L.y;
    const c = Math.cos(-L.a * RAD), s = Math.sin(-L.a * RAD);
    return {x: (dx * c - dy * s) / sx + L.ox * img.width, y: (dx * s + dy * c) / sy + L.oy * img.height};
}

function screenToWorld(e)
{
    const r = cv.getBoundingClientRect(), K = zoomK();
    return {x: (e.clientX - r.left - S.view.px) / K, y: (e.clientY - r.top - S.view.py) / K};
}

const corners = (L) => {
    const {width: w, height: h} = layerImg(L);
    return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => toWorld(L, x, y));
};

// ---------- 圖層 ----------

function addLayer(img, name, dir, path, meta)
{
    const src = PX.fromImage(img);
    const L = {id: ++uid, name, dir, path, src, ops: [], canvas: src, x: 0, y: 0, a: 0, ox: 0.5, oy: 1,
               visible: true, opacity: 1, locked: false, save: true, proj: S.active?.proj ?? null};
    if (meta)
    {
        const f = meta.scale || S.scale;
        Object.assign(L, {x: (meta.x ?? 0) / f, y: (meta.y ?? 0) / f, a: meta.a ?? 0, ox: meta.ox ?? 0.5, oy: meta.oy ?? 1});
    }
    S.layers.push(L);
    select(L);
    status(`載入 ${name}.png${meta ? '（套用同名 .json）' : ''}`);
    return L;
}

function removeLayer(L)
{
    if (S.mode.layer === L) cancelMode();
    S.layers.splice(S.layers.indexOf(L), 1);
    hist.forget(L, true);
    if (S.active === L) S.active = S.layers.at(-1) ?? null;
    refreshAll();
}

// 合成一張新圖層放在最底層的位置；中心點的世界座標沿用最底層的，旋轉烘進像素
function mergeLayers(layers)
{
    cancelMode();
    const base = layers[0];
    const bake = layers.some(L => L.opacity < 1) && confirm('有半透明圖層，要烘入不透明度嗎？（取消＝照 100% 合併）');
    const {big, minX, minY} = flatten(layers, bake);
    hist.push(hist.snapList(S));
    const L = {id: ++uid, name: `${base.name}-merged`, dir: base.dir, path: base.path, src: big, ops: [], canvas: big,
               x: base.x, y: base.y, a: 0, ox: (base.x - minX) / big.width, oy: (base.y - minY) / big.height,
               visible: true, opacity: 1, locked: false, save: true, proj: base.proj};
    const i = S.layers.indexOf(base);
    S.layers = S.layers.filter(M => !layers.includes(M));
    S.layers.splice(i, 0, L);
    select(L);
    status(`合併 ${layers.length} 個圖層 → ${L.name}`);
}

// ops 跟 canvas 都不會被就地修改，直接共用參照
function cloneAbove(L, name)
{
    const C = {...L, id: ++uid, name};
    S.layers.splice(S.layers.indexOf(L) + 1, 0, C);
    return C;
}

function duplicateLayer()
{
    const L = S.active;
    if (!L) return status('先選一個圖層');
    cancelMode();
    hist.push(hist.snapList(S));
    const C = cloneAbove(L, `${L.name}-copy`);
    select(C);
    status(`複製圖層 ${L.name} → ${C.name}`);
}

function mergeDown()
{
    const L = S.active, below = S.layers[S.layers.indexOf(L) - 1];
    if (!L || !below) return status('向下合併需要選取的圖層下面還有一層');
    if (!L.visible || !below.visible) return status('向下合併需要兩層都顯示');
    if (L.locked || below.locked) return status('有鎖定的圖層，不能合併');
    mergeLayers([below, L]);
}

function mergeVisible()
{
    const layers = S.layers.filter(L => L.visible && !L.locked);
    if (layers.length < 2) return status('顯示中、沒鎖定的圖層不到兩層');
    mergeLayers(layers);
}

function select(L)
{
    if (S.mode.layer && S.mode.layer !== L) leaveMode();
    S.active = L;
    refreshAll();
}

function pick(w)
{
    for (let i = S.layers.length - 1; i >= 0; i--)
    {
        const L = S.layers[i];
        if (!L.visible || L.locked) continue;
        const p = toLocal(L, w.x, w.y, [1, 1]);
        if (PX.alphaAt(L.canvas, p.x, p.y) > 0) return L;
    }
    return null;
}

// 畫面永遠是「原圖 + 依序重播 ops」；相鄰的 xform（裁切／縮放／trim）合成一步，從原圖只取樣一次
function pushOp(L, op)
{
    const last = L.ops.at(-1);
    if (op.type === 'xform' && last?.type === 'xform') L.ops = [...L.ops.slice(0, -1), PX.compose(last, op)];
    else if (op.type === 'alpha' && last?.type === 'alpha') L.ops = [...L.ops.slice(0, -1), {type: 'alpha', t: Math.max(last.t, op.t)}];
    else L.ops = [...L.ops, op];
    L.canvas = PX.replay(L.src, L.ops);
}

// 裁切後讓內容留在原地：新圖的中心點對應舊圖的 (x + ox*w, y + oy*h)
function applyCrop(L, x, y, w, h)
{
    const p = toWorld(L, x + L.ox * w, y + L.oy * h, [1, 1]);
    pushOp(L, {type: 'xform', sx: x, sy: y, sw: w, sh: h, w, h});
    Object.assign(L, {x: p.x, y: p.y});
}

const trimT = () => Math.min(255, Math.max(1, Math.round(+$('trimT').value || 1)));

function trimLayer(L)
{
    const b = PX.opaqueBounds(L.canvas, trimT());
    if (!b || (b.w === L.canvas.width && b.h === L.canvas.height)) return false;
    hist.record(L);
    applyCrop(L, b.x, b.y, b.w, b.h);
    return true;
}

// ---------- 自動模式 ----------
// 整張 AI 原圖（綠底、零件各在一個象限）拆成零件圖層：清除透明 → 移除綠色 → 裁到零件的範圍 → 縮放
// 零件可能跨過中線，所以不切象限：去綠後分連通塊，依重心歸到象限，零件範圍＝它所有塊的外接矩形
// 數字記在 localStorage，也跟著專案設定存讀；x/y 是遊戲單位

const GREEN = {h1: 45, h2: 85, s1: 60, s2: 255, v1: 20, v2: 255, rgbThr: 40};
const AUTO_ALPHA = 32;
const AUTO_NOISE = 0.01;    // 比最大塊的 1% 還小的塊當雜點
const AUTO_PARTS = [
    {key: 'helmet', name: '頭盔', quad: '左上', qx: 0, qy: 0},
    {key: 'armor', name: '護甲', quad: '左下', qx: 0, qy: 1},
    {key: 'boots', name: '靴子', quad: '右下', qx: 1, qy: 1},
];
const AUTO_DEF = {helmet: {pct: 22, x: -2, y: 2}, armor: {pct: 20, x: 0.25, y: 27}, boots: {pct: 20, x: 1.5, y: 33}};
const AUTO_KEY = 'paperdoll.auto';
const autoFrom = (v) => Object.fromEntries(AUTO_PARTS.map(P => [P.key, {...AUTO_DEF[P.key], ...v?.[P.key]}]));

function autoLoad()
{
    try {return JSON.parse(localStorage.getItem(AUTO_KEY));}
    catch {return null;}
}

function autoSet(v)
{
    S.auto = autoFrom(v);
    try {localStorage.setItem(AUTO_KEY, JSON.stringify(S.auto));}
    catch {}
    for (const P of AUTO_PARTS) for (const f of ['pct', 'x', 'y']) $(`au-${P.key}-${f}`).value = S.auto[P.key][f];
}

function autoScale(T, {P, C, box})
{
    const k = S.auto[P.key].pct / 100;
    const op = {type: 'xform', ...box, w: Math.max(1, Math.round(box.sw * k)), h: Math.max(1, Math.round(box.sh * k)), smooth: true};
    Object.assign(C, {ops: [...T.ops, op], canvas: PX.xform(T.canvas, op)});
}

const autoPlace = ({P, C}) => Object.assign(C, {x: S.auto[P.key].x / S.scale, y: S.auto[P.key].y / S.scale});

// 按確定才去綠、切好，每個零件複製一層疊在原圖上（由下往上 靴子、護甲、頭盔），原圖隱藏；整段一筆 undo
function autoSplit(L)
{
    const T = {src: L.src, ops: L.ops};
    pushOp(T, {type: 'alpha', t: AUTO_ALPHA});
    pushOp(T, {type: 'removeGreen', ...GREEN});
    const W = T.canvas.width, H = T.canvas.height;
    const all = PX.blobs(T.canvas, trimT()), big = Math.max(0, ...all.map(b => b.n));
    const blobs = all.filter(b => b.n >= big * AUTO_NOISE);
    const undo = {group: [hist.snapList(S), hist.snap(L, true)]};
    const parts = [], skipped = [];
    for (const P of AUTO_PARTS)
    {
        const mine = blobs.filter(b => (b.cx >= W / 2) === !!P.qx && (b.cy >= H / 2) === !!P.qy);
        if (!mine.length) {skipped.push(P.name); continue;}
        const x0 = Math.min(...mine.map(b => b.x)), y0 = Math.min(...mine.map(b => b.y));
        const box = {sx: x0, sy: y0, sw: Math.max(...mine.map(b => b.x1)) + 1 - x0, sh: Math.max(...mine.map(b => b.y1)) + 1 - y0};
        const C = cloneAbove(L, `${L.name}-${P.key}`);
        Object.assign(C, {a: 0, ox: 0.5, oy: 1, visible: true, opacity: 1});
        const part = {P, C, box};
        autoScale(T, part);
        autoPlace(part);
        parts.push(part);
    }
    if (!parts.length) return status('去綠之後找不到零件');
    L.visible = false;
    S.active = parts[0].C;
    hist.push(undo);
    status(`自動拆出 ${parts.map(p => p.C.name).join('、')}${skipped.length ? `；${skipped.join('、')} 的象限是空的，略過` : ''}`);
}

function setOrigin(L, ox, oy)
{
    const p = toWorld(L, ox * L.canvas.width, oy * L.canvas.height, [1, 1]);
    Object.assign(L, {ox, oy, x: p.x, y: p.y});
}

// ---------- 繪製 ----------

let raf = 0;
function dirty() {if (!raf) raf = requestAnimationFrame(render);}

function render()
{
    raf = 0;
    if (S.mode.type === 'warp' && S.mode.stale) updateWarp(S.mode);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) {cv.width = w; cv.height = h;}
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const K = zoomK();
    const view = () => g.setTransform(K, 0, 0, K, S.view.px, S.view.py);
    g.imageSmoothingEnabled = K < 1;
    for (const L of S.layers)
    {
        if (!L.visible) continue;
        const [sx, sy] = modeScale(L), img = layerImg(L);
        view();
        g.translate(L.x, L.y);
        g.rotate(L.a * RAD);
        g.scale(sx, sy);
        g.globalAlpha = L.opacity;
        g.drawImage(img, -L.ox * img.width, -L.oy * img.height);
        g.globalAlpha = 1;
    }
    view();
    g.lineWidth = 1 / K;
    drawRefs(K);
    drawOrigins(K);
    drawOverlay(K);
    updateTitle();
}

function drawOrigins(K)
{
    if (!$('showOrigin').checked) return;
    const r = 6 / K;
    for (const L of S.layers)
    {
        if (!L.visible) continue;
        g.strokeStyle = L === S.active ? '#ff0' : '#f90';
        g.beginPath();
        g.moveTo(L.x - r, L.y); g.lineTo(L.x + r, L.y);
        g.moveTo(L.x, L.y - r); g.lineTo(L.x, L.y + r);
        g.stroke();
        g.beginPath();
        g.arc(L.x, L.y, r / 2, 0, Math.PI * 2);
        g.stroke();
    }
}

function poly(pts)
{
    g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    g.closePath();
    g.stroke();
}

// 參考框的數字是顯示單位：沒勾 scale 時就是圖片像素，勾了是遊戲像素
function drawRefs(K)
{
    const r = S.ref, s = unit();
    const x0 = -S.view.px / K, y0 = -S.view.py / K, W = cv.width / K, H = cv.height / K;
    g.strokeStyle = 'rgba(255,80,80,.8)';
    g.beginPath();
    g.moveTo(x0, 0); g.lineTo(x0 + W, 0);
    g.moveTo(0, y0); g.lineTo(0, y0 + H);
    g.stroke();

    g.setLineDash([4 / K, 4 / K]);
    g.strokeStyle = 'rgba(255,255,255,.6)';
    g.strokeRect(-r.rw / 2 / s, -r.rh / 2 / s, r.rw / s, r.rh / s);
    g.setLineDash([]);

    g.strokeStyle = 'rgba(80,220,255,.9)';
    g.strokeRect((r.ax - r.tw / 2) / s, (r.ay - r.th / 2) / s, r.tw / s, r.th / s);
    g.beginPath();
    g.arc(r.ax / s, r.ay / s, 4 / K, 0, Math.PI * 2);
    g.stroke();
}

function drawOverlay(K)
{
    const L = S.active;
    if (!L) return;
    g.setLineDash([3 / K, 3 / K]);
    g.strokeStyle = 'rgba(255,220,0,.8)';
    poly(corners(L));
    g.setLineDash([]);

    const m = S.mode;
    if (m.type === 'warp') drawWarp(m, K);
    if (m.type === 'crop') drawCrop(m, L, K);
    if (m.type === 'pixel') drawPixel(m, L, K);
    if (m.type === 'scale')
    {
        g.fillStyle = '#fff';
        g.strokeStyle = '#000';
        for (const p of corners(L))
        {
            g.fillRect(p.x - 4 / K, p.y - 4 / K, 8 / K, 8 / K);
            g.strokeRect(p.x - 4 / K, p.y - 4 / K, 8 / K, 8 / K);
        }
    }
}

function fitView()
{
    const r = S.ref, s = unit();
    const pts = [{x: -r.rw / 2 / s, y: -r.rh / 2 / s}, {x: r.rw / 2 / s, y: r.rh / 2 / s},
                 ...S.layers.filter(L => L.visible).flatMap(corners)];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const K = Math.min(cv.clientWidth / (maxX - minX), cv.clientHeight / (maxY - minY)) * 0.85;
    S.view.zoom = K / unit();
    S.view.px = cv.clientWidth / 2 - (minX + maxX) / 2 * K;
    S.view.py = cv.clientHeight / 2 - (minY + maxY) / 2 * K;
    dirty();
}

// ---------- 模式：移動 / 裁切 / 縮放 / 清除透明 / 顏色 ----------

// 切換圖層／模式時，變形有沒套用的修改先問
function leaveMode()
{
    const m = S.mode;
    if (m.type === 'warp' && m.changed && confirm('有未套用的變形框，要套用嗎？（取消＝放棄）')) applyMode();
    else if (m.type === 'pixel' && m.changed && confirm('有未套用的像素修補，要套用嗎？（取消＝放棄）')) applyMode();
    else cancelMode();
}

function setMode(type)
{
    leaveMode();
    const L = S.active;
    if (type !== 'move' && (!L || L.locked))
    {
        status('先選一個沒鎖定的圖層');
        type = 'move';
    }
    else if (type === 'pixel' && !L.visible)
    {
        status('選取的圖層隱藏中，先打開顯示');
        type = 'move';
    }
    else if ((type === 'scale' || type === 'warp' || type === 'auto') && hasPaint(L))
    {
        alert('這層有像素修補，縮放／變形會讓修補對不上；要先到「像素」模式按「清除修補」');
        type = 'move';
    }
    if (type === 'crop') S.mode = {type, layer: L, rect: null, poly: null};
    else if (type === 'scale') S.mode = {type, layer: L, sx: 1, sy: 1, k: srcScale(L), lock: $('scLock').checked, snap: hist.snap(L)};
    else if (type === 'alpha') {S.mode = {type, layer: L, t: +$('alT').value, preview: null}; updateAlpha();}
    else if (type === 'color') {S.mode = {type, layer: L, preview: null}; updateColor();}
    else if (type === 'removeGreen') {
        S.mode = {type, layer: L, ...GREEN, preview: null};
        updateRemoveGreen();
    }
    else if (type === 'warp') S.mode = warpStart(L);
    else if (type === 'auto') S.mode = {type, layer: L};
    else if (type === 'pixel') S.mode = pixelStart(L);
    else S.mode = {type: 'move'};
    refreshAll();
}

// 目前的圖相對原圖縮了多少（只看 xform，裁切不算縮放）；縮放面板的 % 以原圖為 100
const srcScale = (L) => L.ops.reduce((k, o) => o.type === 'xform' ? k * o.w / o.sw : k, 1);

function cancelMode()
{
    const m = S.mode;
    if (m.type === 'move') return;
    if (m.type === 'scale' || m.type === 'warp') History.restore(m.snap);
    S.mode = {type: 'move'};
    refreshAll();
}

function applyMode()
{
    const m = S.mode, L = m.layer;
    if (m.type === 'crop')
    {
        const sel = cropSel(m);
        if (!sel) return;
        const how = cropHow();
        if (how === 'keep') {hist.record(L); sel.keep(L);}
        else if (how === 'cut') {hist.record(L); sel.cut(L);}
        else
        {
            hist.push({group: [hist.snapList(S), hist.snap(L)]});
            const C = cloneAbove(L, L.name);
            sel.keep(C);
            if (how === 'move') sel.cut(L);
            S.active = C;
        }
    }
    else if (m.type === 'scale')
    {
        const W = L.canvas.width, H = L.canvas.height;
        const w = Math.max(1, Math.round(W * m.sx)), h = Math.max(1, Math.round(H * m.sy));
        if (w !== W || h !== H)
        {
            hist.push(m.snap);
            pushOp(L, {type: 'xform', sx: 0, sy: 0, sw: W, sh: H, w, h, smooth: $('scSmooth').checked});
        }
        else if (L.x !== m.snap.x || L.y !== m.snap.y) hist.push(m.snap);
    }
    else if (m.type === 'alpha')
    {
        hist.record(L);
        pushOp(L, {type: 'alpha', t: m.t});
    }
    else if (m.type === 'color')
    {
        hist.record(L);
        pushOp(L, colorOp());
    }
    else if (m.type === 'removeGreen')
    {
        hist.record(L);
        pushOp(L, {type: 'removeGreen', h1: m.h1, h2: m.h2, s1: m.s1, s2: m.s2, v1: m.v1, v2: m.v2, rgbThr: m.rgbThr});
    }
    else if (m.type === 'warp')
    {
        const frames = warpKept(m.frames);
        if (!m.changed) History.restore(m.snap);
        else
        {
            if (m.stale) updateWarp(m);
            L.ops = frames.length ? [...m.baseOps, warpOp(frames)] : m.baseOps;
        }
        if (L.ops !== m.snap.ops || L.canvas !== m.snap.canvas) hist.push(m.snap);
    }
    else if (m.type === 'pixel')
    {
        if (m.changed)
        {
            const px = pixelList(m);
            Object.assign(L, px.length ? {ops: [...m.baseOps, {type: 'paint', px}], canvas: PX.paint(m.base, {px})} : {ops: m.baseOps, canvas: m.base});
            hist.push(m.snap);
        }
    }
    else if (m.type === 'auto') autoSplit(L);
    else return;
    S.mode = {type: 'move'};
    refreshAll();
}

const cropHow = () => document.querySelector('[name=cropMode]:checked').value;
const cropShape = () => document.querySelector('[name=cropShape]:checked').value;

function cropRect(r, L)
{
    const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    const W = L.canvas.width, H = L.canvas.height;
    return {x0: cl(Math.min(r.ax, r.bx), W), y0: cl(Math.min(r.ay, r.by), H),
            x1: cl(Math.max(r.ax, r.bx), W), y1: cl(Math.max(r.ay, r.by), H)};
}

// 外接矩形往外取整，限制在圖內（頂點可以點在圖外）
function polyRect(pts, L)
{
    const cl = (v, max) => Math.min(max, Math.max(0, v));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return {x0: cl(Math.floor(Math.min(...xs)), L.canvas.width), y0: cl(Math.floor(Math.min(...ys)), L.canvas.height),
            x1: cl(Math.ceil(Math.max(...xs)), L.canvas.width), y1: cl(Math.ceil(Math.max(...ys)), L.canvas.height)};
}

// 目前的選取範圍：keep(T) 只留範圍內並裁到外接矩形，cut(T) 挖掉範圍內
function cropSel(m)
{
    const L = m.layer;
    if (cropShape() === 'rect')
    {
        if (!m.rect) return null;
        const {x0, y0, x1, y1} = cropRect(m.rect, L), w = x1 - x0, h = y1 - y0;
        if (w < 1 || h < 1) return null;
        return {keep: T => applyCrop(T, x0, y0, w, h), cut: T => pushOp(T, {type: 'erase', x: x0, y: y0, w, h})};
    }
    if (!m.poly?.closed) return null;
    const pts = m.poly.pts.map(p => [round(p.x, 100), round(p.y, 100)]);
    const {x0, y0, x1, y1} = polyRect(pts, L);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return {keep: T => {pushOp(T, {type: 'mask', pts, keep: true}); applyCrop(T, x0, y0, x1 - x0, y1 - y0);},
            cut: T => pushOp(T, {type: 'mask', pts, keep: false})};
}

// ---------- 多邊形裁切（頂點存圖層本地座標；裁切模式下圖層沒縮放，本地距離＝世界距離） ----------

const polyTol = () => 8 / zoomK();

// Shift：從 from 出發的方向鎖在 45° 的倍數
function snap45(from, p)
{
    const d = Math.hypot(p.x - from.x, p.y - from.y), a = Math.round(Math.atan2(p.y - from.y, p.x - from.x) / (Math.PI / 4)) * Math.PI / 4;
    return {x: from.x + d * Math.cos(a), y: from.y + d * Math.sin(a)};
}

function polyEdgeHit(P, p)
{
    const n = P.pts.length;
    let best = null;
    for (let i = 0; i < n; i++)
    {
        const a = P.pts[i], b = P.pts[(i + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
        const t = len2 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
        const q = {x: a.x + t * dx, y: a.y + t * dy}, d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < polyTol() && (!best || d < best.d)) best = {i, q, d};
    }
    return best;
}

const polyVertexHit = (P, p) => P.pts.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) < polyTol());
const polyNearFirst = (P, p) => P.pts.length >= 3 && Math.hypot(P.pts[0].x - p.x, P.pts[0].y - p.y) < polyTol();

function polyPointerDown(m, e)
{
    const w = screenToWorld(e), raw = toLocal(m.layer, w.x, w.y), P = m.poly;
    if (!P) {m.poly = {pts: [raw], closed: false, cursor: raw}; return null;}
    if (!P.closed)
    {
        if (e.detail >= 2) P.closed = P.pts.length >= 3;
        else if (polyNearFirst(P, raw)) P.closed = true;
        else P.pts = [...P.pts, e.shiftKey ? snap45(P.pts.at(-1), raw) : raw];
        return null;
    }
    const i = polyVertexHit(P, raw);
    if (i >= 0) return {type: 'polyPt', i};
    const hit = polyEdgeHit(P, raw);
    if (!hit) return null;
    P.pts = [...P.pts.slice(0, hit.i + 1), hit.q, ...P.pts.slice(hit.i + 1)];
    P.edge = null;
    return {type: 'polyPt', i: hit.i + 1};
}

function polyDrag(m, e, i)
{
    const P = m.poly, w = screenToWorld(e), raw = toLocal(m.layer, w.x, w.y);
    const prev = P.pts[(i - 1 + P.pts.length) % P.pts.length];
    P.pts = P.pts.map((v, k) => k === i ? (e.shiftKey ? snap45(prev, raw) : raw) : v);
}

function polyHover(m, e)
{
    const P = m.poly, w = screenToWorld(e), raw = toLocal(m.layer, w.x, w.y);
    if (!P.closed) P.cursor = e.shiftKey && P.pts.length ? snap45(P.pts.at(-1), raw) : raw;
    else P.edge = polyVertexHit(P, raw) < 0 ? polyEdgeHit(P, raw)?.i ?? null : null;
}

// Backspace：刪最後一點；已閉合就先解開閉合
function polyBack(m)
{
    const P = m.poly;
    if (P.closed) P.closed = false;
    else if (P.pts.length > 1) P.pts = P.pts.slice(0, -1);
    else m.poly = null;
}

function drawCrop(m, L, K)
{
    g.strokeStyle = {keep: '#0f0', cut: '#f44', move: '#f0f', copy: '#0cf'}[cropHow()];
    if (cropShape() === 'rect')
    {
        if (!m.rect) return;
        const {x0, y0, x1, y1} = cropRect(m.rect, L);
        poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => toWorld(L, x, y)));
        return;
    }
    const P = m.poly;
    if (!P) return;
    const wp = P.pts.map(p => toWorld(L, p.x, p.y));
    if (P.closed)
    {
        poly(wp);
        if (P.edge != null)
        {
            const a = wp[P.edge], b = wp[(P.edge + 1) % wp.length];
            g.lineWidth = 3 / K;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            g.lineWidth = 1 / K;
        }
    }
    else
    {
        const c = toWorld(L, P.cursor.x, P.cursor.y);
        g.beginPath();
        [...wp, c].forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
        g.stroke();
    }
    g.fillStyle = '#fff';
    wp.forEach((p, i) => {
        const r = (i === 0 && !P.closed && polyNearFirst(P, P.cursor) ? 6 : 3) / K;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
}

function updateAlpha()
{
    const m = S.mode;
    m.preview = PX.alphaClear(m.layer.canvas, m.t);
    dirty();
}

const colorHow = () => document.querySelector('[name=colorMode]:checked').value;
const byte = (id, min) => Math.min(255, Math.max(min, Math.round(+$(id).value || 0)));

function colorOp()
{
    const v = parseInt($('colRgb').value.slice(1), 16);
    const rgb = {r: v >> 16, g: (v >> 8) & 255, b: v & 255};
    return colorHow() === 'fill' ? {type: 'fill', ...rgb, a: byte('colA', 0), t: byte('colT', 1)} : {type: 'key', ...rgb};
}

function updateColor()
{
    const m = S.mode, op = colorOp();
    m.preview = op.type === 'fill' ? PX.fill(m.layer.canvas, op) : PX.key(m.layer.canvas, op);
    dirty();
}

function updateRemoveGreen()
{
    const m = S.mode;
    m.h1 = +$('rgH1').value || 45;
    m.h2 = +$('rgH2').value || 85;
    m.s1 = +$('rgS1').value || 60;
    m.s2 = +$('rgS2').value || 255;
    m.v1 = +$('rgV1').value || 20;
    m.v2 = +$('rgV2').value || 255;
    m.rgbThr = +$('rgRgbThr').value || 40;
    m.preview = PX.removeGreen(m.layer.canvas, m.h1, m.h2, m.s1, m.s2, m.v1, m.v2, m.rgbThr);
    dirty();
}

// 滴管只吸 RGB，填色的 alpha 不跟著變（不然吸到半透明邊緣會被改掉）
function pickColor(w)
{
    const m = S.mode, p = toLocal(m.layer, w.x, w.y);
    const px = PX.pixelAt(m.layer.canvas, p.x, p.y);
    if (!px) return;
    setRgb(px);
    updateColor();
}

// 把手位置投影到「未旋轉、以中心點為原點」的座標，跟角落原本的位置比出倍率
function scaleByHandle(w, [cx, cy])
{
    const m = S.mode, L = m.layer;
    const c = {x: (cx - L.ox) * L.canvas.width, y: (cy - L.oy) * L.canvas.height};
    const r = -L.a * RAD, dx = w.x - L.x, dy = w.y - L.y;
    const mx = dx * Math.cos(r) - dy * Math.sin(r), my = dx * Math.sin(r) + dy * Math.cos(r);
    if (m.lock)
    {
        const d = c.x * c.x + c.y * c.y;
        if (d) m.sx = m.sy = Math.max(0.01, (mx * c.x + my * c.y) / d);
    }
    else
    {
        if (c.x) m.sx = Math.max(0.01, mx / c.x);
        if (c.y) m.sy = Math.max(0.01, my / c.y);
    }
}

// ---------- 變形 ----------
// 框的矩形和網格點都在「變形前那張圖（input）」的座標；base 是 input 的中心點在世界座標的位置
// 最後一步就是 warp 時接著編輯同一組框：拿掉它重播出 input，再從它的 bounds 反推變形前的 x/y
// changed：這次進模式後有動過，切換圖層／模式時才要問

const wpN = (id) => Math.min(12, Math.max(1, Math.round(+$(id).value || 1)));
const warpCur = (m) => m.frames[m.cur] ?? null;
const warpGridOf = (f) => PX.warpGrid(f.cols, f.rows, f.w, f.h).map(p => ({x: p.x + f.x, y: p.y + f.y}));

function warpIsIdentity(f)
{
    const grid = warpGridOf(f);
    return f.pts.every((p, k) => Math.abs(p.x - grid[k].x) < 1e-6 && Math.abs(p.y - grid[k].y) < 1e-6);
}

const warpCopy = ({x, y, w, h, cols, rows, pts}) => ({x, y, w, h, cols, rows, pts: pts.map(p => ({x: p.x, y: p.y}))});

// 每個框有自己的步驟 hist（改之前的樣子）跟 fut（redo），hist 跟著框寫進 op，確定後、存專案再開都還能退
// 沒變形也沒步驟的框不寫
const WARP_HIST = 50;
const warpOp = (frames) => ({type: 'warp', frames: frames.map(f => f.hist.length ? {...warpCopy(f), hist: f.hist.map(warpCopy)} : warpCopy(f))});
const warpKept = (frames) => frames.filter(f => f.hist.length || !warpIsIdentity(f));
const warpFrame = (g) => ({...warpCopy(g), hist: (g.hist ?? []).map(warpCopy), fut: [], sel: new Set(), edited: !warpIsIdentity(g)});

function warpRecord(m)
{
    const f = warpCur(m);
    f.hist.push(warpCopy(f));
    if (f.hist.length > WARP_HIST) f.hist.shift();
    f.fut.length = 0;
    m.frameRedo.length = 0;
    m.changed = true;
}

function warpSetGeom(f, s)
{
    Object.assign(f, warpCopy(s));
    f.sel.clear();
    f.edited = !warpIsIdentity(f);
}

// Ctrl+Z：退目前這框；這框退到剛拉出來的樣子再按就拿掉它；一個框都沒有時依序救回 Delete 掉的框
function warpUndo(m)
{
    const f = warpCur(m);
    if (f?.hist.length)
    {
        f.fut.push(warpCopy(f));
        warpSetGeom(f, f.hist.pop());
    }
    else if (f)
    {
        m.frameRedo.push({add: f, i: m.cur});
        m.frames.splice(m.cur, 1);
        m.cur = m.frames.length - 1;
    }
    else if (m.deleted.length)
    {
        const {f: g, i} = m.deleted.pop();
        m.frames.splice(i, 0, g);
        m.cur = m.frames.indexOf(g);
        m.frameRedo.push({del: g});
    }
    else return false;
    m.changed = m.stale = true;
    return true;
}

function warpRedo(m)
{
    const f = warpCur(m), r = m.frameRedo.at(-1);
    if (f?.fut.length)
    {
        f.hist.push(warpCopy(f));
        warpSetGeom(f, f.fut.pop());
    }
    else if (r?.add)
    {
        m.frameRedo.pop();
        m.frames.splice(r.i, 0, r.add);
        m.cur = m.frames.indexOf(r.add);
    }
    else if (r?.del)
    {
        m.frameRedo.pop();
        const i = m.frames.indexOf(r.del);
        m.frames.splice(i, 1);
        m.deleted.push({f: r.del, i});
        m.cur = m.frames.length - 1;
    }
    else return false;
    m.changed = m.stale = true;
    return true;
}

function warpStart(L)
{
    const m = {type: 'warp', layer: L, snap: hist.snap(L), deleted: [], frameRedo: [], frames: [], cur: -1, stale: false, changed: false};
    const last = L.ops.at(-1);
    if (last?.type !== 'warp')
    {
        Object.assign(m, {baseOps: L.ops, input: L.canvas, base: {x: L.x, y: L.y}});
        return m;
    }
    m.baseOps = L.ops.slice(0, -1);
    m.input = PX.replay(L.src, m.baseOps);
    const W = m.input.width, H = m.input.height;
    const frames = last.frames ?? [{x: 0, y: 0, w: W, h: H, cols: last.cols, rows: last.rows, pts: last.pts}];
    const b = last.frames ? PX.warpFramesBounds(frames, W, H) : PX.warpBounds(last);
    m.base = toWorld(L, L.ox * W - b.bx, L.oy * H - b.by, [1, 1]);
    m.frames = frames.map(warpFrame);
    m.cur = m.frames.length - 1;
    return m;
}

function warpAddFrame(m, r)
{
    const f = warpFrame({...r, cols: wpN('wpCols'), rows: wpN('wpRows'), pts: []});
    f.pts = warpGridOf(f);
    f.edited = false;
    m.frames.push(f);
    m.cur = m.frames.length - 1;
    m.frameRedo.length = 0;
    m.changed = m.stale = true;
    return f;
}

function warpDeleteFrame(m)
{
    if (!warpCur(m)) return;
    m.deleted.push({f: warpCur(m), i: m.cur});
    m.frames.splice(m.cur, 1);
    m.cur = m.frames.length - 1;
    m.frameRedo.length = 0;
    m.changed = m.stale = true;
}

// 世界座標拖出來的範圍換成 input 座標的整數矩形，限制在圖內
function warpRectFrom(m, a, b)
{
    const p = warpLocal(m, a), q = warpLocal(m, b), W = m.input.width, H = m.input.height;
    const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    const x0 = cl(Math.min(p.x, q.x), W), x1 = cl(Math.max(p.x, q.x), W);
    const y0 = cl(Math.min(p.y, q.y), H), y1 = cl(Math.max(p.y, q.y), H);
    return x1 - x0 >= 2 && y1 - y0 >= 2 ? {x: x0, y: y0, w: x1 - x0, h: y1 - y0} : null;
}

const warpRectPts = (m, r) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => warpWorld(m, {x: r.x + u * r.w, y: r.y + v * r.h}));

// 調整大小的把手放在框外 10 螢幕 px，避開剛好在框邊上的網格點；sx/sy：-1 動左／上邊、1 動右／下邊
const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

function warpHandles(m, f, K)
{
    const a = m.layer.a * RAD, c = Math.cos(a), s = Math.sin(a), d = 10 / K;
    return HANDLES.map(([sx, sy]) => {
        const p = warpWorld(m, {x: f.x + (sx + 1) / 2 * f.w, y: f.y + (sy + 1) / 2 * f.h});
        const n = Math.hypot(sx, sy), ux = sx / n * d, uy = sy / n * d;
        return {sx, sy, x: p.x + ux * c - uy * s, y: p.y + ux * s + uy * c};
    });
}

function warpHit(m, w)
{
    const f = warpCur(m), K = zoomK();
    if (!f) return null;
    let best = -1, bd = 8;
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt), d = Math.hypot(p.x - w.x, p.y - w.y) * K;
        if (d < bd) {bd = d; best = k;}
    });
    if (best >= 0) return {pt: best};
    const h = warpHandles(m, f, K).find(h => Math.hypot(h.x - w.x, h.y - w.y) * K < 7);
    return h ? {handle: h} : null;
}

// 點一下（沒拖）：點在框裡就切到那個框，重疊時從上面往下輪；點空白取消選點
function warpClick(m, w)
{
    const p = warpLocal(m, w);
    const hits = m.frames.map((_, i) => i).reverse().filter(i => {
        const f = m.frames[i];
        return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
    });
    const i = hits[(hits.indexOf(m.cur) + 1) % hits.length];
    if (hits.length && i !== m.cur) m.cur = i;
    else warpCur(m)?.sel.clear();
}

function warpWorld(m, p)
{
    const L = m.layer, c = Math.cos(L.a * RAD), s = Math.sin(L.a * RAD);
    const dx = p.x - L.ox * m.input.width, dy = p.y - L.oy * m.input.height;
    return {x: m.base.x + dx * c - dy * s, y: m.base.y + dx * s + dy * c};
}

function warpLocal(m, w)
{
    const L = m.layer, c = Math.cos(-L.a * RAD), s = Math.sin(-L.a * RAD);
    const dx = w.x - m.base.x, dy = w.y - m.base.y;
    return {x: dx * c - dy * s + L.ox * m.input.width, y: dx * s + dy * c + L.oy * m.input.height};
}

// 預覽就是最後結果：直接改圖層的 canvas／x／y
function updateWarp(m)
{
    m.stale = false;
    const L = m.layer, frames = m.frames.filter(f => !warpIsIdentity(f));
    if (!frames.length) return Object.assign(L, {canvas: m.input, x: m.base.x, y: m.base.y});
    const r = PX.warpFrames(m.input, warpOp(frames));
    const p = warpWorld(m, {x: r.bx + L.ox * r.canvas.width, y: r.by + L.oy * r.canvas.height});
    Object.assign(L, {canvas: r.canvas, x: p.x, y: p.y});
}

function drawWarpFrame(m, f, K, cur)
{
    g.setLineDash([4 / K, 4 / K]);
    g.strokeStyle = cur ? '#fff' : 'rgba(215,215,215,.95)';
    poly(warpRectPts(m, f));
    g.setLineDash([]);

    const P = (i, j) => warpWorld(m, f.pts[j * (f.cols + 1) + i]);
    g.strokeStyle = cur ? 'rgba(0,255,200,.8)' : 'rgba(200,200,200,.8)';
    g.beginPath();
    for (let j = 0; j <= f.rows; j++)
        for (let i = 0; i <= f.cols; i++)
        {
            const p = P(i, j);
            if (i < f.cols) {const q = P(i + 1, j); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
            if (j < f.rows) {const q = P(i, j + 1); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
        }
    g.stroke();
    if (!cur) return;

    const r = 4 / K;
    g.strokeStyle = '#000';
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        g.fillStyle = f.sel.has(k) ? '#f0f' : '#fff';
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
    const h = 3 / K;
    g.strokeStyle = '#fff';
    for (const p of warpHandles(m, f, K)) g.strokeRect(p.x - h, p.y - h, h * 2, h * 2);
}

function drawWarp(m, K)
{
    m.frames.forEach((f, i) => {if (i !== m.cur) drawWarpFrame(m, f, K, false);});
    if (warpCur(m)) drawWarpFrame(m, warpCur(m), K, true);
    const r = drag?.type === 'warpNew' && warpRectFrom(m, drag.a, drag.b);
    if (r)
    {
        g.setLineDash([4 / K, 4 / K]);
        g.strokeStyle = '#fff';
        poly(warpRectPts(m, r));
        g.setLineDash([]);
    }
    if (drag?.type === 'band')
    {
        g.setLineDash([3 / K, 3 / K]);
        g.strokeStyle = drag.add ? '#f0f' : '#f80';
        g.strokeRect(drag.a.x, drag.a.y, drag.b.x - drag.a.x, drag.b.y - drag.a.y);
        g.setLineDash([]);
    }
}

// 點：Ctrl 取消選、Shift 加選；把手：調框大小；其他地方 Shift／Ctrl 拖曳框選點，不然拖出新的框（沒拖就是點一下）
function warpPointerDown(m, w, e)
{
    const f = warpCur(m), hit = warpHit(m, w), ctrl = e.ctrlKey || e.metaKey;
    if (hit?.pt !== undefined)
    {
        const k = hit.pt;
        if (ctrl) {f.sel.delete(k); return null;}
        if (e.shiftKey) f.sel.add(k);
        else if (!f.sel.has(k)) f.sel = new Set([k]);
        return {type: 'warpPt', f, w0: w, orig: new Map([...f.sel].map(k => [k, f.pts[k]]))};
    }
    if (hit?.handle) return {type: 'warpSize', f, h: hit.handle, p0: warpLocal(m, w), r0: {x: f.x, y: f.y, w: f.w, h: f.h}, pts0: f.pts};
    if (f && (e.shiftKey || ctrl)) return {type: 'band', a: w, b: w, add: !ctrl};
    return {type: 'warpNew', a: w, b: w};
}

// 按住 Shift 時鎖在先拖動的方向，放開再按才重新決定；一開始就按著的話以按下滑鼠的位置為起點（lock 還是 undefined）
function shiftLock(e, dx, dy)
{
    if (!e.shiftKey) {drag.lock = null; return [dx, dy];}
    const k = drag.lock ??= drag.lock === undefined ? {dx: 0, dy: 0, axis: null} : {dx, dy, axis: null};
    const mx = Math.abs(dx - k.dx), my = Math.abs(dy - k.dy);
    if (!k.axis && Math.max(mx, my) >= 2) k.axis = mx >= my ? 'x' : 'y';
    return [k.axis === 'x' ? dx : k.dx, k.axis === 'y' ? dy : k.dy];
}

function warpPointerMove(m, e, w)
{
    if (drag.type === 'warpNew') {drag.b = w; return;}
    if (!drag.recorded) {warpRecord(m); drag.recorded = true;}
    const f = drag.f;
    if (drag.type === 'warpPt')
    {
        const [dx, dy] = shiftLock(e, w.x - drag.w0.x, w.y - drag.w0.y);
        const c = Math.cos(-m.layer.a * RAD), s = Math.sin(-m.layer.a * RAD);
        const lx = dx * c - dy * s, ly = dx * s + dy * c;
        for (const [k, p] of drag.orig) f.pts[k] = {x: p.x + lx, y: p.y + ly};
        f.edited = true;
    }
    else if (drag.type === 'warpSize')
    {
        // 點跟著框等比例移動，已經做的變形保留
        const p = warpLocal(m, w), {r0, h} = drag, W = m.input.width, H = m.input.height;
        const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
        let x0 = r0.x, x1 = r0.x + r0.w, y0 = r0.y, y1 = r0.y + r0.h;
        if (h.sx < 0) x0 = Math.min(cl(x0 + p.x - drag.p0.x, W), x1 - 2);
        if (h.sx > 0) x1 = Math.max(cl(x1 + p.x - drag.p0.x, W), x0 + 2);
        if (h.sy < 0) y0 = Math.min(cl(y0 + p.y - drag.p0.y, H), y1 - 2);
        if (h.sy > 0) y1 = Math.max(cl(y1 + p.y - drag.p0.y, H), y0 + 2);
        Object.assign(f, {x: x0, y: y0, w: x1 - x0, h: y1 - y0});
        f.pts = drag.pts0.map(q => ({x: x0 + (q.x - r0.x) * f.w / r0.w, y: y0 + (q.y - r0.y) * f.h / r0.h}));
    }
    m.changed = m.stale = true;
}

function warpPointerUp(m)
{
    if (drag.type === 'band') warpBandSelect(m, drag.a, drag.b, drag.add);
    if (drag.type !== 'warpNew') return;
    if (Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) * zoomK() < 4) return warpClick(m, drag.a);
    const r = warpRectFrom(m, drag.a, drag.b);
    if (r) warpAddFrame(m, r);
}

function warpBandSelect(m, a, b, add)
{
    const f = warpCur(m);
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) add ? f.sel.add(k) : f.sel.delete(k);
    });
}

// 世界座標的位移轉成 input 座標（圖層有旋轉時方向要轉回去）
function warpNudge(m, dx, dy)
{
    const f = warpCur(m), c = Math.cos(-m.layer.a * RAD), s = Math.sin(-m.layer.a * RAD);
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    warpRecord(m);
    for (const k of f.sel) f.pts[k] = {x: f.pts[k].x + lx, y: f.pts[k].y + ly};
    f.edited = m.changed = m.stale = true;
}

function warpCursor(m, w)
{
    const h = warpHit(m, w);
    if (h?.pt !== undefined) return 'move';
    if (!h) return 'crosshair';
    const {sx, sy} = h.handle;
    return !sx ? 'ns-resize' : !sy ? 'ew-resize' : sx === sy ? 'nwse-resize' : 'nesw-resize';
}

// ---------- 像素 ----------
// 修補記成一步 paint（座標是前面步驟跑完那張圖的像素）；最後一步就是 paint 時拿掉它接著編輯，筆畫併進同一步
// 畫在 m.preview 上（每筆只 putImageData 筆刷範圍），m.map（y*W+x → rgba）是要寫進 op 的內容
// 有 paint 的圖層不能再縮放／變形（座標會對不上），要先清除修補

const PIXEL_HIST = 50;
const PIXEL_GRID = 8;
const pxN = () => Math.min(8, Math.max(1, Math.round(+$('pxSize').value || 1)));
const pxTool = () => document.querySelector('[name=pxTool]:checked').value;
const hasPaint = (L) => L.ops.some(o => o.type === 'paint');

function pxColor()
{
    if (pxTool() === 'erase') return [0, 0, 0, 0];
    const v = parseInt($('pxRgb').value.slice(1), 16);
    return [v >> 16, (v >> 8) & 255, v & 255, byte('pxA', 0)];
}

function pixelStart(L)
{
    const last = L.ops.at(-1), resume = last?.type === 'paint';
    const baseOps = resume ? L.ops.slice(0, -1) : L.ops;
    const base = resume ? PX.replay(L.src, baseOps) : L.canvas;
    const m = {type: 'pixel', layer: L, snap: hist.snap(L), baseOps, base, map: new Map(), hist: [], fut: [], changed: false, cursor: null};
    if (resume) for (const [x, y, ...c] of last.px) m.map.set(y * base.width + x, c);
    pixelRebuild(m);
    return m;
}

function pixelList(m)
{
    const W = m.base.width;
    return [...m.map].sort((a, b) => a[0] - b[0]).map(([k, c]) => [k % W, Math.floor(k / W), ...c]);
}

const pixelRebuild = (m) => {m.preview = PX.paint(m.base, {px: pixelList(m)});};

// 筆刷左上角：n 是偶數時中心落在格線上
const brushAt = (p, n) => ({x: Math.floor(p.x - (n - 1) / 2), y: Math.floor(p.y - (n - 1) / 2)});

function pixelStamp(m, p)
{
    const n = pxN(), W = m.base.width, H = m.base.height, b = brushAt(p, n);
    const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(W, b.x + n), y1 = Math.min(H, b.y + n);
    if (x1 <= x0 || y1 <= y0) return;
    // 一筆真的畫到圖上才記進模式內的 undo
    if (m.before)
    {
        m.hist.push(m.before);
        if (m.hist.length > PIXEL_HIST) m.hist.shift();
        m.fut.length = 0;
        m.before = null;
    }
    const c = pxColor(), img = new ImageData(x1 - x0, y1 - y0);
    for (let i = 0; i < img.data.length; i += 4) img.data.set(c, i);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.map.set(y * W + x, c);
    m.preview.getContext('2d').putImageData(img, x0, y0);
    m.changed = true;
}

// 拖很快時兩次 pointermove 之間補點，線才不會斷
function pixelLine(m, a, b)
{
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let i = 1; i <= n; i++) pixelStamp(m, {x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n});
}

function pixelDown(m, w, e)
{
    const p = toLocal(m.layer, w.x, w.y);
    if (e.altKey)
    {
        const px = PX.pixelAt(m.preview, p.x, p.y);
        if (px) {setRgb(px); $('pxA').value = px[3];}
        return null;
    }
    m.before = new Map(m.map);
    pixelStamp(m, p);
    m.cursor = p;
    return {type: 'paint', p};
}

function pixelUndo(m, from, to)
{
    if (!from.length) return false;
    to.push(m.map);
    m.map = from.pop();
    m.changed = true;
    pixelRebuild(m);
    return true;
}

// 拿掉這層所有 paint，記一筆 undo；模式裡還沒確定的筆畫一起丟掉
function pixelClear()
{
    const m = S.mode, L = m.layer;
    if (m.type !== 'pixel') return;
    const ops = L.ops.filter(o => o.type !== 'paint');
    if (ops.length !== L.ops.length)
    {
        hist.record(L);
        Object.assign(L, {ops, canvas: PX.replay(L.src, ops)});
        status(`清除 ${L.name} 的像素修補`);
    }
    S.mode = pixelStart(L);
    refreshAll();
}

function drawPixel(m, L, K)
{
    const W = m.preview.width, H = m.preview.height;
    g.save();
    g.translate(L.x, L.y);
    g.rotate(L.a * RAD);
    g.translate(-L.ox * W, -L.oy * H);
    if (K >= PIXEL_GRID)
    {
        g.strokeStyle = 'rgba(255,255,255,.15)';
        g.beginPath();
        for (let x = 0; x <= W; x++) {g.moveTo(x, 0); g.lineTo(x, H);}
        for (let y = 0; y <= H; y++) {g.moveTo(0, y); g.lineTo(W, y);}
        g.stroke();
    }
    if (m.cursor)
    {
        const n = pxN(), b = brushAt(m.cursor, n);
        g.strokeStyle = pxTool() === 'erase' ? '#fff' : $('pxRgb').value;
        g.lineWidth = 2 / K;
        g.strokeRect(b.x, b.y, n, n);
    }
    g.restore();
}

const PIXEL_KEYS = {
    b: () => {$('pxPen').checked = true;},
    e: () => {$('pxErase').checked = true;},
    '[': () => {$('pxSize').value = pxN() - 1 || 1;},
    ']': () => {$('pxSize').value = Math.min(8, pxN() + 1);},
};

// 鉛筆跟填色／去色共用色票
function setRgb(px)
{
    $('colRgb').value = $('pxRgb').value = '#' + px.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
    status(`吸取 rgba(${px.join(',')})`);
}

// ---------- 滑鼠 / 鍵盤 ----------

let drag = null;

cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const w = screenToWorld(e), m = S.mode, L = S.active;
    if (e.button === 1)
    {
        e.preventDefault();
        drag = {type: 'pan', sx: e.clientX, sy: e.clientY, px: S.view.px, py: S.view.py};
        return;
    }
    if (e.button !== 0) return;
    if (m.type === 'crop' && cropShape() === 'poly')
    {
        drag = polyPointerDown(m, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'crop')
    {
        const p = toLocal(L, w.x, w.y);
        m.rect = {ax: p.x, ay: p.y, bx: p.x, by: p.y};
        drag = {type: 'crop'};
    }
    else if (m.type === 'scale')
    {
        const i = corners(L).findIndex(c => Math.hypot(c.x - w.x, c.y - w.y) * zoomK() < 8);
        drag = i >= 0 ? {type: 'handle', corner: [[0, 0], [1, 0], [1, 1], [0, 1]][i]}
                      : {type: 'move', L, wx: w.x, wy: w.y, x: L.x, y: L.y};
    }
    else if (m.type === 'color') pickColor(w);
    else if (m.type === 'pixel')
    {
        drag = pixelDown(m, w, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'warp')
    {
        drag = warpPointerDown(m, w, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'move')
    {
        if (S.keys.has('r') && L && !L.locked)
        {
            drag = {type: 'rotate', L, snap: hist.snap(L), a0: L.a, ang0: Math.atan2(w.y - L.y, w.x - L.x)};
            return;
        }
        const hit = pick(w);
        if (!hit) return;
        if (hit !== L) select(hit);
        drag = {type: 'move', L: hit, snap: hist.snap(hit), wx: w.x, wy: w.y, x: hit.x, y: hit.y};
    }
});

cv.addEventListener('pointermove', e => {
    if (!drag)
    {
        if (S.mode.type === 'crop' && S.mode.poly) {polyHover(S.mode, e); dirty();}
        if (S.mode.type === 'warp') cv.style.cursor = warpCursor(S.mode, screenToWorld(e));
        if (S.mode.type === 'pixel') {const w = screenToWorld(e); S.mode.cursor = toLocal(S.mode.layer, w.x, w.y); dirty();}
        return;
    }
    const w = screenToWorld(e);
    if (drag.type === 'pan')
    {
        S.view.px = drag.px + e.clientX - drag.sx;
        S.view.py = drag.py + e.clientY - drag.sy;
    }
    else if (drag.type === 'move')
    {
        const [dx, dy] = shiftLock(e, Math.round(w.x - drag.wx), Math.round(w.y - drag.wy));
        drag.L.x = drag.x + dx;
        drag.L.y = drag.y + dy;
    }
    else if (drag.type === 'rotate')
    {
        let a = drag.a0 + (Math.atan2(w.y - drag.L.y, w.x - drag.L.x) - drag.ang0) / RAD;
        a = e.shiftKey ? Math.round(a / 15) * 15 : round(a, 10);
        drag.L.a = ((a + 180) % 360 + 360) % 360 - 180;
    }
    else if (drag.type === 'crop')
    {
        const p = toLocal(S.active, w.x, w.y);
        Object.assign(S.mode.rect, {bx: p.x, by: p.y});
    }
    else if (drag.type === 'polyPt') polyDrag(S.mode, e, drag.i);
    else if (drag.type === 'handle') scaleByHandle(w, drag.corner);
    else if (drag.type === 'band') drag.b = w;
    else if (drag.type === 'paint')
    {
        const p = toLocal(S.mode.layer, w.x, w.y);
        pixelLine(S.mode, drag.p, p);
        drag.p = S.mode.cursor = p;
    }
    else if (S.mode.type === 'warp') warpPointerMove(S.mode, e, w);
    refreshProps();
    refreshModePanel();
    dirty();
});

cv.addEventListener('pointerup', () => {
    const s = drag?.snap;
    if (s && (s.x !== s.layer.x || s.y !== s.layer.y || s.a !== s.layer.a)) hist.push(s);
    if (drag && S.mode.type === 'warp') {warpPointerUp(S.mode); refreshModePanel();}
    drag = null;
    dirty();
});

cv.addEventListener('pointerleave', () => {
    if (S.mode.type === 'pixel' && !drag) {S.mode.cursor = null; dirty();}
});

// 中鍵拖曳平移時，擋掉 Chrome 的中鍵自動捲動
cv.addEventListener('mousedown', e => {if (e.button === 1) e.preventDefault();});

cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    S.view.px = mx - (mx - S.view.px) * f;
    S.view.py = my - (my - S.view.py) * f;
    S.view.zoom *= f;
    dirty();
}, {passive: false});

const ARROWS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.matches('input')) return;
    const key = e.key.toLowerCase();
    S.keys.add(key);
    if (e.ctrlKey && (key === 'z' || key === 'y'))
    {
        e.preventDefault();
        (key === 'y' || e.shiftKey) ? redo() : undo();
        return;
    }
    if (e.ctrlKey && key === 'j')
    {
        e.preventDefault();
        duplicateLayer();
        return;
    }
    if (e.ctrlKey && key === 'e')
    {
        e.preventDefault();
        e.shiftKey ? mergeVisible() : mergeDown();
        return;
    }
    const m = S.mode;
    if (e.key === 'Enter') applyMode();
    else if (e.key === 'Escape' && m.type === 'crop' && (m.rect || m.poly)) {m.rect = m.poly = null; refreshModePanel(); dirty();}
    else if (e.key === 'Escape') cancelMode();
    else if (e.key === 'Backspace' && m.type === 'crop' && m.poly) {polyBack(m); refreshModePanel(); dirty();}
    else if ((e.key === 'Delete' || e.key === 'Backspace') && m.type === 'warp') {warpDeleteFrame(m); refreshModePanel(); dirty();}
    else if (m.type === 'pixel' && !e.ctrlKey && !e.altKey && PIXEL_KEYS[key]) {PIXEL_KEYS[key](); refreshModePanel(); dirty();}
    if (m.type === 'pixel' && e.key === 'Alt') e.preventDefault();
    const d = ARROWS[e.key], L = S.active;
    if (d && S.mode.type === 'warp' && warpCur(S.mode)?.sel.size)
    {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        warpNudge(S.mode, d[0] * step, d[1] * step);
        refreshModePanel();
        dirty();
    }
    else if (d && L && !L.locked && (S.mode.type === 'move' || S.mode.type === 'scale'))
    {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (S.mode.type === 'move') hist.record(L);
        L.x += d[0] * step;
        L.y += d[1] * step;
        refreshProps();
        dirty();
    }
});
window.addEventListener('keyup', e => S.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => S.keys.clear());

// 變形模式裡只退框的步驟（每框各自的），退到底就停住；要退更早的操作先離開變形
function undo()
{
    const m = S.mode;
    if (m.type === 'warp')
    {
        if (!warpUndo(m)) status('變形沒有步驟可以退了；要退更早的操作請先離開變形');
        return refreshAll();
    }
    if (m.type === 'pixel')
    {
        if (!pixelUndo(m, m.hist, m.fut)) status('像素沒有筆畫可以退了；要退更早的操作請先離開像素模式');
        return refreshAll();
    }
    cancelMode();
    select(hist.undo() ?? S.active);
}

function redo()
{
    const m = S.mode;
    if (m.type === 'warp')
    {
        warpRedo(m);
        return refreshAll();
    }
    if (m.type === 'pixel')
    {
        pixelUndo(m, m.fut, m.hist);
        return refreshAll();
    }
    cancelMode();
    select(hist.redo() ?? S.active);
}

// ---------- UI 同步 ----------

function refreshAll()
{
    refreshLayers();
    refreshProps();
    refreshModePanel();
    dirty();
}

let dragRow = null;

function refreshLayers()
{
    const box = $('layers');
    box.innerHTML = '';
    $('btnSaveProj').disabled = !S.layers.some(L => L.save);
    if (!S.layers.length) box.innerHTML = '<div class="dim">（從左邊點 PNG，或拖檔案進畫布）</div>';
    for (const L of [...S.layers].reverse())
    {
        const row = el('div', 'layer' + (L === S.active ? ' sel' : ''));
        const ico = (txt, on, title, fn) => {
            const b = el('span', 'ico' + (on ? '' : ' off'));
            Object.assign(b, {textContent: txt, title});
            b.onclick = (ev) => {ev.stopPropagation(); fn();};
            return b;
        };
        const name = el('span', 'name');
        name.textContent = `${L.name} (${L.canvas.width}×${L.canvas.height})`;
        name.title = join(L.path ?? '', L.name);
        row.append(
            ico('💾', L.save, `專案：${L.proj?.name ?? '（無）'}（點一下切換要不要存進專案）`, () => {L.save = !L.save; refreshAll();}),
            ico('👁', L.visible, '顯示／隱藏', () => {L.visible = !L.visible; refreshAll();}),
            ico(L.locked ? '🔒' : '🔓', L.locked, '鎖定', () => {L.locked = !L.locked; if (L.locked && S.mode.layer === L) cancelMode(); refreshAll();}),
            name,
            ico('✕', true, '刪除圖層', () => {if (confirm(`刪除圖層 ${L.name}？`)) removeLayer(L);}),
        );
        row.onclick = () => select(L);
        row.draggable = true;
        row.ondragstart = () => {dragRow = L;};
        row.ondragend = () => {dragRow = null;};
        row.ondragover = (ev) => {if (dragRow) {ev.preventDefault(); row.classList.add('drop');}};
        row.ondragleave = () => row.classList.remove('drop');
        row.ondrop = (ev) => {
            ev.preventDefault();
            row.classList.remove('drop');
            if (!dragRow || dragRow === L) return;
            S.layers.splice(S.layers.indexOf(dragRow), 1);
            S.layers.splice(S.layers.indexOf(L) + 1, 0, dragRow);
            refreshAll();
        };
        box.append(row);
    }
}

const PROP_IDS = ['pX', 'pY', 'pA', 'pOx', 'pOy', 'pOp', 'btnSave'];

function refreshProps()
{
    const L = S.active;
    PROP_IDS.forEach(id => {$(id).disabled = !L;});
    $('pName').textContent = L ? `${join(L.path ?? '', L.name)}.png　原圖 ${L.src.width}×${L.src.height} → ${L.canvas.width}×${L.canvas.height}（${L.ops.length} 步）`
                               : '（沒有選取圖層）';
    if (!L) return;
    const u = unit();
    const set = (id, v) => {if (document.activeElement !== $(id)) $(id).value = v;};
    set('pX', round(L.x * u));
    set('pY', round(L.y * u));
    set('pA', round(L.a, 10));
    set('pOx', L.ox);
    set('pOy', L.oy);
    set('pOp', Math.round(L.opacity * 100));
}

function refreshModePanel()
{
    const m = S.mode;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m.type));
    $('modeCrop').hidden = m.type !== 'crop';
    $('modeScale').hidden = m.type !== 'scale';
    $('modeAlpha').hidden = m.type !== 'alpha';
    $('modeColor').hidden = m.type !== 'color';
    $('modeWarp').hidden = m.type !== 'warp';
    $('modeRemoveGreen').hidden = m.type !== 'removeGreen';
    $('modeAuto').hidden = m.type !== 'auto';
    $('modePixel').hidden = m.type !== 'pixel';
    if (m.type === 'pixel') $('pxInfo').textContent = `修補 ${m.map.size} 像素，可退 ${m.hist.length} 筆`;
    if (m.type === 'removeGreen' && m.preview) {
        $('rgH1').value = m.h1;
        $('rgH2').value = m.h2;
        $('rgS1').value = m.s1;
        $('rgS2').value = m.s2;
        $('rgV1').value = m.v1;
        $('rgV2').value = m.v2;
        $('rgRgbThr').value = m.rgbThr;
    }
    if (m.type === 'color') document.querySelectorAll('.colFillOnly').forEach(e => {e.hidden = colorHow() !== 'fill';});
    if (m.type !== 'warp') cv.style.cursor = m.type === 'pixel' ? 'crosshair' : '';
    if (m.type === 'warp')
    {
        const f = warpCur(m);
        if (f) {$('wpCols').value = f.cols; $('wpRows').value = f.rows;}
        $('wpCols').disabled = $('wpRows').disabled = !!f?.edited;
        $('wpDelete').disabled = $('wpReset').disabled = !f;
        $('wpInfo').textContent = f ? `框 ${m.cur + 1}／${m.frames.length}　${f.w}×${f.h}，選 ${f.sel.size} 點，可退 ${f.hist.length} 步` : '還沒有變形框：在圖層上拖曳拉一個';
    }
    if (m.type === 'crop')
    {
        const isPoly = cropShape() === 'poly', P = m.poly;
        $('cropHint').textContent = isPoly
            ? '單擊加點，點第一點或雙擊閉合；Backspace 倒退、Shift 鎖 45°；閉合後拖頂點、點邊加點；Esc 清掉重畫'
            : '在圖層上拖曳框選範圍';
        const r = isPoly ? P?.closed && polyRect(P.pts.map(p => [p.x, p.y]), m.layer) : m.rect && cropRect(m.rect, m.layer);
        const pts = isPoly && P ? `${P.pts.length} 點${P.closed ? '' : '（未閉合）'}　` : '';
        $('cropInfo').textContent = pts + (r ? `${r.x0},${r.y0} → ${r.x1},${r.y1}（${r.x1 - r.x0}×${r.y1 - r.y0}）` : '');
    }
    if (m.type === 'scale')
    {
        const set = (id, v) => {if (document.activeElement !== $(id)) $(id).value = v;};
        set('scPct', round(m.sx * m.k * 100, 10));
        set('scW', Math.round(m.layer.canvas.width * m.sx));
        set('scH', Math.round(m.layer.canvas.height * m.sy));
    }
}

// ---------- 檔案 ----------

const PROJ_EXT = '.pdproj.json';
const isProj = (name) => name.toLowerCase().endsWith(PROJ_EXT);

const treeOpt = {onFile: (fh, dir, path) => (isProj(fh.name) ? openProject(fh, dir, path) : loadHandle(fh, dir, path)).catch(e => status(e.message))};

function buildTree(box, opt)
{
    box.innerHTML = '';
    if (S.root) box.append(treeNode(S.root, S.root.name, '', 0, opt, true));
}

function treeNode(dir, label, path, depth, opt, open)
{
    const wrap = el('div'), row = el('div', 'row dir'), kids = el('div');
    row.style.paddingLeft = `${depth * 12 + 4}px`;
    let loaded = false, expanded = false;
    const toggle = async (force) => {
        expanded = force ?? !expanded;
        row.textContent = `${expanded ? '▾' : '▸'} ${label}`;
        kids.hidden = !expanded;
        if (!expanded || loaded) return;
        loaded = true;
        const {dirs, files} = await FS.listDir(dir);
        for (const d of dirs) kids.append(treeNode(d, d.name, join(path, d.name), depth + 1, opt, false));
        if (!opt.onFile) return;
        const show = opt.filter ?? (n => /\.png$/i.test(n) || isProj(n));
        for (const f of files.filter(f => show(f.name)))
        {
            const r = el('div', isProj(f.name) ? 'row file proj' : 'row file');
            r.textContent = f.name;
            r.style.paddingLeft = `${depth * 12 + 28}px`;
            r.onclick = () => opt.onFile(f, dir, path, r);
            kids.append(r);
        }
    };
    row.onclick = () => {opt.onDir?.(dir, path, row); toggle();};
    wrap.append(row, kids);
    toggle(open);
    return wrap;
}

async function readJson(file)
{
    try {return JSON.parse(await file.text());}
    catch {status(`${file.name} 不是合法的 JSON，略過`); return null;}
}

async function loadHandle(fh, dir, path)
{
    const base = fh.name.replace(/\.png$/i, '');
    const jh = await FS.tryFile(dir, `${base}.json`);
    const meta = jh ? await readJson(await jh.getFile()) : null;
    addLayer(await createImageBitmap(await fh.getFile()), base, dir, path, meta).srcPath = join(path, fh.name);
}

async function setRoot(h)
{
    S.root = h;
    S.pendingRoot = null;
    $('btnReauth').hidden = true;
    $('rootName').textContent = h.name;
    $('rootName').classList.remove('dim');
    buildTree($('tree'), treeOpt);
}

function needRoot()
{
    if (!S.root) status('先選擇工作資料夾');
    return !!S.root;
}

// bake：有半透明圖層時傳勾選框的文字，結果的 bake 是有沒有勾；note(path, name)：覆蓋確認時多加的文字
function saveDialog(title, dir, path, name, ext = '.png', bake = null, note = null)
{
    const dlg = $('dlgSave');
    let sel = {dir, path};
    const showPath = () => {$('dlgPath').textContent = join(S.root.name, sel.path);};
    $('dlgTitle').textContent = title;
    $('dlgExt').textContent = ext;
    $('dlgBakeRow').hidden = !bake;
    $('dlgBakeLab').textContent = bake ?? '';
    $('dlgBake').checked = true;
    const pick = (d, p, row) => {
        sel = {dir: d, path: p};
        $('dlgTree').querySelectorAll('.sel').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        showPath();
    };
    buildTree($('dlgTree'), {
        onDir: pick,
        filter: (n) => n.toLowerCase().endsWith(ext),
        onFile: (f, d, p, row) => {pick(d, p, row); $('dlgName').value = f.name.slice(0, -ext.length);},
    });
    $('dlgName').value = name;
    showPath();
    dlg.returnValue = '';
    dlg.showModal();
    $('dlgName').select();
    return new Promise(res => dlg.addEventListener('close', async () => {
        let n = $('dlgName').value.trim();
        if (n.toLowerCase().endsWith(ext)) n = n.slice(0, -ext.length);
        if (dlg.returnValue !== 'ok' || !n) return res(null);
        if (await FS.tryFile(sel.dir, n + ext) && !confirm(`${join(sel.path, n)}${ext} 已存在，要覆蓋嗎？${note?.(sel.path, n) ?? ''}`)) return res(null);
        res({...sel, name: n, bake: !!bake && $('dlgBake').checked});
    }, {once: true}));
}

function sidecar(L, name)
{
    const s = S.scale;
    const o = {x: round(L.x * s), y: round(L.y * s), a: round(L.a), scale: s, ox: L.ox, oy: L.oy};
    const cell = {sprite: name, scale: s, x: o.x, y: o.y};
    if (o.a) cell.a = o.a;
    if (o.ox !== 0.5) cell.ox = o.ox;
    if (o.oy !== 1) cell.oy = o.oy;
    o.xlsx = JSON.stringify(cell).slice(1, -1);
    return o;
}

async function saveLayer()
{
    const L = S.active;
    if (!L || !needRoot()) return;
    cancelMode();
    if ($('autoTrim').checked && trimLayer(L)) refreshAll();
    const bake = L.opacity < 1 ? `烘入不透明度（目前 ${Math.round(L.opacity * 100)}%）` : null;
    const r = await saveDialog(`存檔：${L.name}`, L.dir ?? S.root, L.dir ? L.path : '', `${L.name}-copy`, '.png', bake);
    if (!r) return;
    const out = r.bake ? PX.fade(L.canvas, L.opacity) : L.canvas;
    await FS.writeFile(r.dir, `${r.name}.png`, await PX.toPng(out));
    await FS.writeFile(r.dir, `${r.name}.json`, new Blob([JSON.stringify(sidecar(L, r.name), null, 2) + '\n']));
    Object.assign(L, {dir: r.dir, path: r.path});
    // 拖進來的圖（沒有原圖路徑）或覆蓋了自己的原圖：改以剛存的檔當原圖，步驟歸零（舊 undo 對不上新原圖，一起清掉）
    // 新原圖已經烘了不透明度，opacity 要歸 1，不然會乘兩次
    const saved = join(r.path, `${r.name}.png`);
    if (!L.srcPath || L.srcPath === saved)
    {
        hist.forget(L);
        Object.assign(L, {src: out, canvas: out, ops: [], srcPath: saved});
        if (r.bake) L.opacity = 1;
    }
    refreshProps();
    dirty();
    status(`已存 ${saved}／.json`);
}

// ---------- 專案 ----------
// 只記原圖路徑（相對工作資料夾）＋步驟清單，開啟時從原圖重播；undo 紀錄不存
// 圖層的 proj 只在開專案時設定，存專案只是把 💾 打勾的圖層寫出去，不改歸屬

function projectData(layers)
{
    return {
        version: 1,
        settings: {scale: S.scale, applyScale: S.applyScale, showOrigin: $('showOrigin').checked, ref: {...S.ref},
                   trimT: trimT(), iconSize: +$('iconSize').value, autoTrim: $('autoTrim').checked, auto: S.auto},
        active: layers.indexOf(S.active),
        layers: layers.map(L => ({
            name: L.name, src: L.srcPath, srcW: L.src.width, srcH: L.src.height, path: L.path ?? '',
            ops: L.ops, x: L.x, y: L.y, a: L.a, ox: L.ox, oy: L.oy, visible: L.visible, opacity: L.opacity, locked: L.locked,
        })),
    };
}

const projectSig = () => JSON.stringify(projectData(S.layers));
const isUnsaved = () => S.projSig ? projectSig() !== S.projSig : S.layers.length > 0;
const projKey = (path, name) => join(path, name).toLowerCase();
const projects = () => [...new Set(S.layers.map(L => L.proj).filter(Boolean))];
const projLayers = (key) => S.layers.filter(L => L.proj && projKey(L.proj.path, L.proj.name) === key);

function updateTitle()
{
    const name = projects().map(p => p.name).join(' + ') || '（未命名）', mark = isUnsaved() ? ' *' : '';
    $('projName').textContent = name + mark;
    document.title = `${name}${mark} — 紙娃娃編輯器`;
}

function applySettings(s)
{
    S.scale = s.scale ?? 0.25;
    S.applyScale = !!s.applyScale;
    Object.assign(S.ref, s.ref);
    $('scale').value = S.scale;
    $('applyScale').checked = S.applyScale;
    $('showOrigin').checked = s.showOrigin ?? true;
    for (const id of Object.keys(S.ref)) $(id).value = S.ref[id];
    if (s.trimT) $('trimT').value = s.trimT;
    if (s.iconSize) $('iconSize').value = s.iconSize;
    $('autoTrim').checked = !!s.autoTrim;
    if (s.auto) autoSet(s.auto);
}

async function saveProject()
{
    if (!needRoot()) return;
    const layers = S.layers.filter(L => L.save);
    if (!layers.length) return status('沒有 💾 打勾的圖層');
    const loose = layers.filter(L => !L.srcPath);
    if (loose.length) return alert(`這些圖層是拖進來的，沒有原圖路徑，先「存檔…」存進工作資料夾：\n${loose.map(L => L.name).join('\n')}`);
    cancelMode();
    const ps = projects(), p = ps.length === 1 ? ps[0] : null;
    const differs = (path, name) => {
        const own = projLayers(projKey(path, name));
        return own.length !== layers.length || own.some(L => !L.save) ? '\n（💾 打勾的圖層跟原專案的圖層不同）' : '';
    };
    const target = await saveDialog(`存專案（${layers.length} 個圖層）`, p?.dir ?? S.root, p?.path ?? '', p?.name ?? 'project', PROJ_EXT, null, differs);
    if (!target) return;
    await FS.writeFile(target.dir, target.name + PROJ_EXT, new Blob([JSON.stringify(projectData(layers), null, 2) + '\n']));
    S.projSig = projectSig();
    updateTitle();
    status(`已存專案 ${join(target.path, target.name + PROJ_EXT)}`);
}

function askOpen(name)
{
    const dlg = $('dlgOpen');
    $('dlgOpenTitle').textContent = `開啟專案 ${name}`;
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue), {once: true}));
}

async function openProject(fh, dir, path)
{
    const name = fh.name.slice(0, -PROJ_EXT.length);
    const how = S.layers.length ? await askOpen(join(path, fh.name)) : 'replace';
    if (how !== 'add' && how !== 'replace') return;
    const add = how === 'add';
    if (add && projLayers(projKey(path, name)).length) return status(`${name} 已經開著了`);
    if (!add && isUnsaved() && !confirm('目前有沒存的修改，要放棄嗎？')) return;
    const data = await readJson(await fh.getFile());
    if (!data?.layers) return;
    cancelMode();
    const wasClean = !isUnsaved(), proj = {dir, path, name};
    const layers = [], warns = [];
    for (const d of data.layers)
    {
        let src, srcDir;
        try
        {
            const r = await FS.resolveFile(S.root, d.src);
            srcDir = r.dir;
            src = PX.fromImage(await createImageBitmap(await r.file.getFile()));
        }
        catch {warns.push(`${d.name}：找不到原圖 ${d.src}，略過這層`); continue;}
        if (src.width !== d.srcW || src.height !== d.srcH)
            warns.push(`${d.name}：原圖尺寸變了（${d.srcW}×${d.srcH} → ${src.width}×${src.height}），結果可能不對`);
        const saveDir = await FS.resolveDir(S.root, d.path).catch(() => srcDir);
        layers.push({id: ++uid, name: d.name, dir: saveDir, path: d.path, srcPath: d.src, src, ops: d.ops,
                     canvas: PX.replay(src, d.ops), x: d.x, y: d.y, a: d.a, ox: d.ox, oy: d.oy,
                     visible: d.visible, opacity: d.opacity, locked: d.locked, save: true, proj});
    }
    const lossy = warns.length > 0;
    if (add)
    {
        const scale = data.settings?.scale ?? 0.25;
        if (scale !== S.scale) warns.unshift(`${name} 的 scale 是 ${scale}，沿用目前的 ${S.scale}（疊圖對位與匯出數字會跟原本不同）`);
        hist.push(hist.snapList(S));
        S.layers = [...S.layers, ...layers];
        S.active = layers[data.active] ?? layers.at(-1) ?? S.active;
    }
    else
    {
        hist.undos.length = hist.redos.length = 0;
        applySettings(data.settings ?? {});
        S.layers = layers;
        S.active = layers[data.active] ?? layers.at(-1) ?? null;
    }
    S.projSig = (!add || wasClean) && !lossy ? projectSig() : null;
    refreshAll();
    if (!add) fitView();
    status(`${add ? '加入' : '開啟'}專案 ${join(path, fh.name)}`);
    if (warns.length) alert(warns.join('\n'));
}

function flatten(layers, bake)
{
    const pts = layers.flatMap(corners);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.floor(Math.min(...xs)), minY = Math.floor(Math.min(...ys));
    const big = PX.newCanvas(Math.ceil(Math.max(...xs)) - minX, Math.ceil(Math.max(...ys)) - minY);
    const bg = big.getContext('2d');
    bg.imageSmoothingQuality = 'high';
    for (const L of layers)
    {
        bg.setTransform(1, 0, 0, 1, -minX, -minY);
        bg.translate(L.x, L.y);
        bg.rotate(L.a * RAD);
        bg.globalAlpha = bake ? L.opacity : 1;
        bg.drawImage(L.canvas, -L.ox * L.canvas.width, -L.oy * L.canvas.height);
    }
    return {big, minX, minY};
}

function iconCanvas(N, bake = false)
{
    const {big} = flatten(S.layers.filter(L => L.visible), bake);
    const b = PX.opaqueBounds(big, trimT());
    if (!b) return null;
    const f = Math.min(N / b.w, N / b.h);
    const fit = PX.xform(big, {sx: b.x, sy: b.y, sw: b.w, sh: b.h, w: Math.max(1, Math.round(b.w * f)), h: Math.max(1, Math.round(b.h * f))});
    const out = PX.newCanvas(N, N);
    out.getContext('2d').drawImage(fit, Math.floor((N - fit.width) / 2), Math.floor((N - fit.height) / 2));
    return out;
}

async function exportIcon()
{
    if (!needRoot()) return;
    cancelMode();
    const N = Math.max(1, Math.round(+$('iconSize').value || 32));
    const solid = S.layers.some(L => L.visible) && iconCanvas(N);
    if (!solid) return status('沒有可匯出的不透明像素');
    const L = S.active ?? S.layers.at(-1);
    const bake = S.layers.some(L => L.visible && L.opacity < 1) ? '烘入不透明度（有半透明圖層）' : null;
    const r = await saveDialog(`匯出 icon（${N}×${N}）`, L.dir ?? S.root, L.dir ? L.path : '', `icon-${L.name}`, '.png', bake);
    if (!r) return;
    const icon = r.bake ? iconCanvas(N, true) : solid;
    if (!icon) return status('沒有可匯出的不透明像素');
    await FS.writeFile(r.dir, `${r.name}.png`, await PX.toPng(icon));
    status(`已匯出 ${join(r.path, r.name)}.png`);
}

// ---------- 綁定 ----------

$('btnRoot').onclick = async () => {
    try {await setRoot(await FS.pickRoot());}
    catch (e) {if (e.name !== 'AbortError') status(e.message);}
};
$('btnReauth').onclick = async () => {
    if (S.pendingRoot && await FS.askPermission(S.pendingRoot)) setRoot(S.pendingRoot);
};
$('btnRefresh').onclick = () => buildTree($('tree'), treeOpt);
$('btnSaveProj').onclick = () => saveProject().catch(e => status(e.message));
$('btnDup').onclick = duplicateLayer;
$('btnMergeDown').onclick = mergeDown;
$('btnMergeVisible').onclick = mergeVisible;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnFit').onclick = fitView;
$('btnIcon').onclick = () => exportIcon().catch(e => status(e.message));
$('btnSave').onclick = () => saveLayer().catch(e => status(e.message));
$('btnTrim').onclick = () => {
    const L = S.active;
    if (!L || L.locked) return status('先選一個沒鎖定的圖層');
    cancelMode();
    if (!trimLayer(L)) status('四周沒有透明邊可以裁');
    refreshAll();
};

document.querySelectorAll('[data-mode]').forEach(b => {b.onclick = () => setMode(b.dataset.mode);});
document.querySelectorAll('.mode .ok').forEach(b => {b.onclick = applyMode;});
document.querySelectorAll('.mode .cancel').forEach(b => {b.onclick = cancelMode;});

$('scale').onchange = () => {
    const v = +$('scale').value;
    S.scale = v > 0 ? v : 0.25;
    refreshProps();
    dirty();
};
$('applyScale').onchange = () => {
    S.applyScale = $('applyScale').checked;
    refreshProps();
    dirty();
};
for (const id of Object.keys(S.ref)) $(id).oninput = () => {S.ref[id] = +$(id).value || 0; dirty();};

const onProp = (id, fn) => {
    $(id).onchange = () => {
        const L = S.active, v = +$(id).value;
        if (!L || !Number.isFinite(v)) return refreshProps();
        hist.record(L);
        fn(L, v);
        refreshAll();
    };
};
onProp('pX', (L, v) => {L.x = v / unit();});
onProp('pY', (L, v) => {L.y = v / unit();});
onProp('pA', (L, v) => {L.a = v;});
onProp('pOx', (L, v) => setOrigin(L, v, L.oy));
onProp('pOy', (L, v) => setOrigin(L, L.ox, v));
$('pOp').oninput = () => {if (S.active) {S.active.opacity = $('pOp').value / 100; dirty();}};

const scaleInput = (id, fn) => {
    $(id).oninput = () => {
        const m = S.mode, v = +$(id).value;
        if (m.type !== 'scale' || !(v > 0)) return;
        fn(m, v);
        if (m.lock) m.sy = m.sx;
        refreshModePanel();
        dirty();
    };
};
scaleInput('scPct', (m, v) => {m.sx = m.sy = v / 100 / m.k;});
scaleInput('scW', (m, v) => {m.sx = v / m.layer.canvas.width;});
scaleInput('scH', (m, v) => {m.sy = v / m.layer.canvas.height; if (m.lock) m.sx = m.sy;});
$('scLock').onchange = () => {
    const m = S.mode;
    if (m.type !== 'scale') return;
    m.lock = $('scLock').checked;
    if (m.lock) m.sy = m.sx;
    refreshModePanel();
    dirty();
};
const warpButton = (fn) => () => {
    const m = S.mode;
    if (m.type !== 'warp' || !warpCur(m)) return;
    fn(m, warpCur(m));
    refreshAll();
};
const warpRegrid = warpButton((m, f) => {
    warpRecord(m);
    Object.assign(f, {cols: wpN('wpCols'), rows: wpN('wpRows'), sel: new Set(), edited: false});
    f.pts = warpGridOf(f);
    m.changed = m.stale = true;
});
$('wpCols').onchange = warpRegrid;
$('wpRows').onchange = warpRegrid;
$('wpReset').onclick = warpRegrid;
$('wpDelete').onclick = warpButton(warpDeleteFrame);
window.addEventListener('beforeunload', e => {if ((S.mode.type === 'warp' || S.mode.type === 'pixel') && S.mode.changed) e.preventDefault();});
$('pxClear').onclick = pixelClear;
$('pxRgb').oninput = () => {$('colRgb').value = $('pxRgb').value; dirty();};
for (const id of ['pxPen', 'pxErase', 'pxSize']) $(id).oninput = dirty;
$('showOrigin').onchange = dirty;
document.querySelectorAll('[name=cropMode]').forEach(r => {r.onchange = dirty;});
document.querySelectorAll('[name=cropShape]').forEach(r => {r.onchange = () => {
    if (S.mode.type === 'crop') S.mode.rect = S.mode.poly = null;
    refreshModePanel();
    dirty();
};});

$('alT').oninput = () => {
    $('alV').textContent = $('alT').value;
    if (S.mode.type === 'alpha') {S.mode.t = +$('alT').value; updateAlpha();}
};

const colorChanged = () => {
    $('colTV').textContent = $('colT').value;
    $('pxRgb').value = $('colRgb').value;
    if (S.mode.type !== 'color') return;
    refreshModePanel();
    updateColor();
};
for (const id of ['colFill', 'colKey', 'colRgb', 'colA', 'colT']) $(id).oninput = colorChanged;

const removeGreenChanged = () => {
    if (S.mode.type !== 'removeGreen') return;
    refreshModePanel();
    updateRemoveGreen();
};
for (const id of ['rgH1', 'rgH2', 'rgS1', 'rgS2', 'rgV1', 'rgV2', 'rgRgbThr']) $(id).oninput = removeGreenChanged;

$('auTable').append(...['', '象限', 'scale%', 'x', 'y'].map(t => Object.assign(el('span', 'dim'), {textContent: t})));
for (const P of AUTO_PARTS)
{
    $('auTable').append(Object.assign(el('span'), {textContent: P.name}), Object.assign(el('span', 'dim'), {textContent: P.quad}));
    for (const f of ['pct', 'x', 'y'])
    {
        const inp = Object.assign(el('input'), {type: 'number', id: `au-${P.key}-${f}`, step: f === 'pct' ? 1 : 'any'});
        inp.onchange = () => {
            const v = +inp.value;
            const ok = Number.isFinite(v) && (f !== 'pct' || v > 0);
            autoSet(ok ? {...S.auto, [P.key]: {...S.auto[P.key], [f]: v}} : S.auto);
        };
        $('auTable').append(inp);
    }
}
autoSet(autoLoad());
$('auReset').onclick = () => autoSet(null);

$('stage').addEventListener('dragover', e => e.preventDefault());
$('stage').addEventListener('drop', async e => {
    e.preventDefault();
    const files = [...e.dataTransfer.files];
    const jsons = new Map(files.filter(f => /\.json$/i.test(f.name)).map(f => [f.name.replace(/\.json$/i, ''), f]));
    for (const f of files.filter(f => /\.png$/i.test(f.name)))
    {
        const base = f.name.replace(/\.png$/i, '');
        const jf = jsons.get(base);
        addLayer(await createImageBitmap(f), base, null, null, jf ? await readJson(jf) : null);
    }
});

new ResizeObserver(dirty).observe(cv);

(async () => {
    S.view.px = cv.clientWidth / 2;
    S.view.py = cv.clientHeight / 2;
    refreshAll();
    const h = await FS.savedRoot();
    if (!h) return;
    if (await FS.hasPermission(h)) return setRoot(h);
    S.pendingRoot = h;
    $('btnReauth').textContent = `重新授權「${h.name}」`;
    $('btnReauth').hidden = false;
})();

// 給無頭測試用
window.__pd = {S, hist, addLayer, select, setMode, applyMode, cancelMode, trimLayer, setOrigin, iconCanvas, sidecar, undo, redo, toWorld,
               setRoot, loadHandle, saveProject, openProject, isUnsaved, saveLayer, mergeDown, mergeVisible, removeLayer, duplicateLayer, pickColor,
               warpAddFrame, autoSet};
