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
    project: null,      // {dir, path, name}：目前專案檔的位置
    projSig: null,      // 上次存／開專案時的內容，跟現在比對出有沒有沒存的修改
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
               visible: true, opacity: 1, locked: false};
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
               visible: true, opacity: 1, locked: false};
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
    if (S.mode.layer && S.mode.layer !== L) cancelMode();
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
    if (m.type === 'crop' && m.rect)
    {
        const {x0, y0, x1, y1} = cropRect(m.rect, L);
        g.strokeStyle = {keep: '#0f0', cut: '#f44', move: '#f0f', copy: '#0cf'}[cropHow()];
        poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => toWorld(L, x, y)));
    }
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

function setMode(type)
{
    cancelMode();
    const L = S.active;
    if (type !== 'move' && (!L || L.locked))
    {
        status('先選一個沒鎖定的圖層');
        type = 'move';
    }
    if (type === 'crop') S.mode = {type, layer: L, rect: null};
    else if (type === 'scale') S.mode = {type, layer: L, sx: 1, sy: 1, lock: $('scLock').checked, snap: hist.snap(L)};
    else if (type === 'alpha') {S.mode = {type, layer: L, t: +$('alT').value, preview: null}; updateAlpha();}
    else if (type === 'color') {S.mode = {type, layer: L, preview: null}; updateColor();}
    else if (type === 'warp') S.mode = warpStart(L);
    else S.mode = {type: 'move'};
    refreshAll();
}

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
        if (!m.rect) return;
        const {x0, y0, x1, y1} = cropRect(m.rect, L);
        if (x1 - x0 < 1 || y1 - y0 < 1) return;
        const how = cropHow(), w = x1 - x0, h = y1 - y0;
        const erase = () => pushOp(L, {type: 'erase', x: x0, y: y0, w, h});
        if (how === 'keep') {hist.record(L); applyCrop(L, x0, y0, w, h);}
        else if (how === 'cut') {hist.record(L); erase();}
        else
        {
            hist.push({group: [hist.snapList(S), hist.snap(L)]});
            const C = cloneAbove(L, `${L.name}-crop`);
            applyCrop(C, x0, y0, w, h);
            if (how === 'move') erase();
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
    else if (m.type === 'warp')
    {
        if (warpIsIdentity(m))
        {
            if (m.baseOps === m.snap.ops) History.restore(m.snap);
            else
            {
                hist.push(m.snap);
                Object.assign(L, {ops: m.baseOps, canvas: m.input, x: m.base.x, y: m.base.y});
            }
        }
        else
        {
            if (m.stale) updateWarp(m);
            hist.push(m.snap);
            L.ops = [...m.baseOps, warpOp(m)];
        }
    }
    else return;
    S.mode = {type: 'move'};
    refreshAll();
}

const cropHow = () => document.querySelector('[name=cropMode]:checked').value;

function cropRect(r, L)
{
    const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    const W = L.canvas.width, H = L.canvas.height;
    return {x0: cl(Math.min(r.ax, r.bx), W), y0: cl(Math.min(r.ay, r.by), H),
            x1: cl(Math.max(r.ax, r.bx), W), y1: cl(Math.max(r.ay, r.by), H)};
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

// 滴管只吸 RGB，填色的 alpha 不跟著變（不然吸到半透明邊緣會被改掉）
function pickColor(w)
{
    const m = S.mode, p = toLocal(m.layer, w.x, w.y);
    const px = PX.pixelAt(m.layer.canvas, p.x, p.y);
    if (!px) return;
    $('colRgb').value = '#' + px.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
    status(`吸取 rgba(${px.join(',')})`);
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
// 編輯中的網格點都在「變形前那張圖（input）」的座標；base 是 input 的中心點在世界座標的位置
// 最後一步就是 warp 時接著編輯同一張網格：拿掉它重播出 input，再從它的 bounds 反推變形前的 x/y

function warpStart(L)
{
    const m = {type: 'warp', layer: L, snap: hist.snap(L), sel: new Set()};
    const last = L.ops.at(-1);
    if (last?.type === 'warp')
    {
        m.baseOps = L.ops.slice(0, -1);
        m.input = PX.replay(L.src, m.baseOps);
        const b = PX.warpBounds(last);
        m.base = toWorld(L, L.ox * m.input.width - b.bx, L.oy * m.input.height - b.by, [1, 1]);
        Object.assign(m, {cols: last.cols, rows: last.rows, pts: last.pts.map(p => ({...p})), edited: true, stale: false});
    }
    else
    {
        Object.assign(m, {baseOps: L.ops, input: L.canvas, base: {x: L.x, y: L.y}});
        warpInit(m);
        m.stale = false;
    }
    return m;
}

function warpInit(m)
{
    const n = (id) => Math.min(12, Math.max(1, Math.round(+$(id).value || 1)));
    Object.assign(m, {cols: n('wpCols'), rows: n('wpRows'), sel: new Set(), edited: false, stale: true});
    m.pts = PX.warpGrid(m.cols, m.rows, m.input.width, m.input.height);
}

const warpOp = (m) => ({type: 'warp', cols: m.cols, rows: m.rows, pts: m.pts.map(p => ({x: p.x, y: p.y}))});

function warpIsIdentity(m)
{
    const grid = PX.warpGrid(m.cols, m.rows, m.input.width, m.input.height);
    return m.pts.every((p, k) => Math.abs(p.x - grid[k].x) < 1e-6 && Math.abs(p.y - grid[k].y) < 1e-6);
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

function updateWarp(m)
{
    m.stale = false;
    m.inputData ??= m.input.getContext('2d').getImageData(0, 0, m.input.width, m.input.height).data;
    const L = m.layer, r = PX.warp(m.input, warpOp(m), m.inputData);
    const p = warpWorld(m, {x: r.bx + L.ox * r.canvas.width, y: r.by + L.oy * r.canvas.height});
    Object.assign(L, {canvas: r.canvas, x: p.x, y: p.y});
}

function drawWarp(m, K)
{
    const P = (i, j) => warpWorld(m, m.pts[j * (m.cols + 1) + i]);
    g.strokeStyle = 'rgba(0,255,200,.8)';
    g.beginPath();
    for (let j = 0; j <= m.rows; j++)
        for (let i = 0; i <= m.cols; i++)
        {
            const p = P(i, j);
            if (i < m.cols) {const q = P(i + 1, j); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
            if (j < m.rows) {const q = P(i, j + 1); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
        }
    g.stroke();
    const r = 4 / K;
    m.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        g.fillStyle = m.sel.has(k) ? '#f0f' : '#fff';
        g.strokeStyle = '#000';
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
    if (drag?.type === 'band')
    {
        g.setLineDash([3 / K, 3 / K]);
        g.strokeStyle = '#f0f';
        g.strokeRect(drag.a.x, drag.a.y, drag.b.x - drag.a.x, drag.b.y - drag.a.y);
        g.setLineDash([]);
    }
}

function warpPointerDown(m, w, shift)
{
    const K = zoomK();
    let best = -1, bd = 8;
    m.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt), d = Math.hypot(p.x - w.x, p.y - w.y) * K;
        if (d < bd) {bd = d; best = k;}
    });
    if (best < 0)
    {
        if (shift) return {type: 'band', a: w, b: w};
        m.sel.clear();
        return null;
    }
    if (shift) m.sel.has(best) ? m.sel.delete(best) : m.sel.add(best);
    else if (!m.sel.has(best)) m.sel = new Set([best]);
    if (!m.sel.has(best)) return null;
    return {type: 'warp', start: warpLocal(m, w), orig: new Map([...m.sel].map(k => [k, {...m.pts[k]}]))};
}

function warpBandSelect(m, a, b)
{
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    m.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) m.sel.add(k);
    });
}

// 世界座標的位移轉成 input 座標（圖層有旋轉時方向要轉回去）
function warpNudge(m, dx, dy)
{
    const c = Math.cos(-m.layer.a * RAD), s = Math.sin(-m.layer.a * RAD);
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    for (const k of m.sel) m.pts[k] = {x: m.pts[k].x + lx, y: m.pts[k].y + ly};
    Object.assign(m, {edited: true, stale: true});
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
    if (m.type === 'crop')
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
    else if (m.type === 'warp')
    {
        drag = warpPointerDown(m, w, e.shiftKey);
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
    if (!drag) return;
    const w = screenToWorld(e);
    if (drag.type === 'pan')
    {
        S.view.px = drag.px + e.clientX - drag.sx;
        S.view.py = drag.py + e.clientY - drag.sy;
    }
    else if (drag.type === 'move')
    {
        drag.L.x = drag.x + Math.round(w.x - drag.wx);
        drag.L.y = drag.y + Math.round(w.y - drag.wy);
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
    else if (drag.type === 'handle') scaleByHandle(w, drag.corner);
    else if (drag.type === 'warp')
    {
        const m = S.mode, c = warpLocal(m, w), dx = c.x - drag.start.x, dy = c.y - drag.start.y;
        for (const [k, p] of drag.orig) m.pts[k] = {x: p.x + dx, y: p.y + dy};
        Object.assign(m, {edited: true, stale: true});
    }
    else if (drag.type === 'band') drag.b = w;
    refreshProps();
    refreshModePanel();
    dirty();
});

cv.addEventListener('pointerup', () => {
    const s = drag?.snap;
    if (s && (s.x !== s.layer.x || s.y !== s.layer.y || s.a !== s.layer.a)) hist.push(s);
    if (drag?.type === 'band') warpBandSelect(S.mode, drag.a, drag.b);
    drag = null;
    dirty();
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
    if (e.ctrlKey && e.key.toLowerCase() === 's')
    {
        e.preventDefault();
        if (!$('dlgSave').open) saveProject(false).catch(err => status(err.message));
        return;
    }
    if ($('dlgSave').open || e.target.matches('input')) return;
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
    if (e.key === 'Enter') applyMode();
    else if (e.key === 'Escape') cancelMode();
    const d = ARROWS[e.key], L = S.active;
    if (d && S.mode.type === 'warp' && S.mode.sel.size)
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

function undo()
{
    cancelMode();
    select(hist.undo() ?? S.active);
}

function redo()
{
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
    if (m.type === 'color') document.querySelectorAll('.colFillOnly').forEach(e => {e.hidden = colorHow() !== 'fill';});
    if (m.type === 'warp')
    {
        $('wpCols').value = m.cols;
        $('wpRows').value = m.rows;
        $('wpCols').disabled = $('wpRows').disabled = m.edited;
    }
    if (m.type === 'crop')
    {
        const r = m.rect && cropRect(m.rect, m.layer);
        $('cropInfo').textContent = r ? `${r.x0},${r.y0} → ${r.x1},${r.y1}（${r.x1 - r.x0}×${r.y1 - r.y0}）` : '';
    }
    if (m.type === 'scale')
    {
        const set = (id, v) => {if (document.activeElement !== $(id)) $(id).value = v;};
        set('scPct', round(m.sx * 100, 10));
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
        for (const f of files.filter(f => /\.png$/i.test(f.name) || isProj(f.name)))
        {
            const r = el('div', isProj(f.name) ? 'row file proj' : 'row file');
            r.textContent = f.name;
            r.style.paddingLeft = `${depth * 12 + 28}px`;
            r.onclick = () => opt.onFile(f, dir, path);
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

// bake：有半透明圖層時傳勾選框的文字，結果的 bake 是有沒有勾
function saveDialog(title, dir, path, name, ext = '.png', bake = null)
{
    const dlg = $('dlgSave');
    let sel = {dir, path};
    const showPath = () => {$('dlgPath').textContent = join(S.root.name, sel.path);};
    $('dlgTitle').textContent = title;
    $('dlgExt').textContent = ext;
    $('dlgBakeRow').hidden = !bake;
    $('dlgBakeLab').textContent = bake ?? '';
    $('dlgBake').checked = true;
    buildTree($('dlgTree'), {onDir: (d, p, row) => {
        sel = {dir: d, path: p};
        $('dlgTree').querySelectorAll('.sel').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        showPath();
    }});
    $('dlgName').value = name;
    showPath();
    dlg.returnValue = '';
    dlg.showModal();
    $('dlgName').select();
    return new Promise(res => dlg.addEventListener('close', async () => {
        let n = $('dlgName').value.trim();
        if (n.toLowerCase().endsWith(ext)) n = n.slice(0, -ext.length);
        if (dlg.returnValue !== 'ok' || !n) return res(null);
        if (await FS.tryFile(sel.dir, n + ext) && !confirm(`${join(sel.path, n)}${ext} 已存在，要覆蓋嗎？`)) return res(null);
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

function projectData()
{
    return {
        version: 1,
        settings: {scale: S.scale, applyScale: S.applyScale, showOrigin: $('showOrigin').checked, ref: {...S.ref},
                   trimT: trimT(), iconSize: +$('iconSize').value, autoTrim: $('autoTrim').checked},
        active: S.layers.indexOf(S.active),
        layers: S.layers.map(L => ({
            name: L.name, src: L.srcPath, srcW: L.src.width, srcH: L.src.height, path: L.path ?? '',
            ops: L.ops, x: L.x, y: L.y, a: L.a, ox: L.ox, oy: L.oy, visible: L.visible, opacity: L.opacity, locked: L.locked,
        })),
    };
}

const projectSig = () => JSON.stringify(projectData());
const isUnsaved = () => S.projSig ? projectSig() !== S.projSig : S.layers.length > 0;

function updateTitle()
{
    const name = S.project?.name ?? '（未命名專案）', mark = isUnsaved() ? ' *' : '';
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
}

async function saveProject(saveAs)
{
    if (!needRoot()) return;
    const loose = S.layers.filter(L => !L.srcPath);
    if (loose.length) return alert(`這些圖層是拖進來的，沒有原圖路徑，先「存檔…」存進工作資料夾：\n${loose.map(L => L.name).join('\n')}`);
    cancelMode();
    let target = !saveAs && S.project;
    if (!target)
    {
        const p = S.project;
        target = await saveDialog('存專案', p?.dir ?? S.root, p?.path ?? '', p?.name ?? 'project', PROJ_EXT);
        if (!target) return;
    }
    const sig = projectSig();
    await FS.writeFile(target.dir, target.name + PROJ_EXT, new Blob([JSON.stringify(projectData(), null, 2) + '\n']));
    S.project = target;
    S.projSig = sig;
    updateTitle();
    status(`已存專案 ${join(target.path, target.name + PROJ_EXT)}`);
}

async function openProject(fh, dir, path)
{
    if (isUnsaved() && !confirm('目前有沒存的修改，要放棄嗎？')) return;
    const data = await readJson(await fh.getFile());
    if (!data?.layers) return;
    cancelMode();
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
                     visible: d.visible, opacity: d.opacity, locked: d.locked});
    }
    hist.undos.length = hist.redos.length = 0;
    applySettings(data.settings ?? {});
    S.layers = layers;
    S.active = layers[data.active] ?? layers.at(-1) ?? null;
    S.project = {dir, path, name: fh.name.slice(0, -PROJ_EXT.length)};
    S.projSig = warns.length ? null : projectSig();
    refreshAll();
    fitView();
    status(`開啟專案 ${join(path, fh.name)}`);
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
$('btnSaveProj').onclick = () => saveProject(true).catch(e => status(e.message));
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
scaleInput('scPct', (m, v) => {m.sx = m.sy = v / 100;});
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
const warpReset = () => {
    if (S.mode.type !== 'warp') return;
    warpInit(S.mode);
    refreshModePanel();
    dirty();
};
$('wpCols').onchange = warpReset;
$('wpRows').onchange = warpReset;
$('wpReset').onclick = warpReset;
$('showOrigin').onchange = dirty;
document.querySelectorAll('[name=cropMode]').forEach(r => {r.onchange = dirty;});

$('alT').oninput = () => {
    $('alV').textContent = $('alT').value;
    if (S.mode.type === 'alpha') {S.mode.t = +$('alT').value; updateAlpha();}
};

const colorChanged = () => {
    $('colTV').textContent = $('colT').value;
    if (S.mode.type !== 'color') return;
    refreshModePanel();
    updateColor();
};
for (const id of ['colFill', 'colKey', 'colRgb', 'colA', 'colT']) $(id).oninput = colorChanged;

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
               setRoot, loadHandle, saveProject, openProject, isUnsaved, saveLayer, mergeDown, mergeVisible, removeLayer, duplicateLayer, pickColor};
