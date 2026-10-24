export function newCanvas(w, h)
{
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    // 第一次 getContext 決定屬性；這些 canvas 常被 getImageData，放 CPU 端讀取快很多
    c.getContext('2d', {willReadFrequently: true});
    return c;
}

export function fromImage(img)
{
    const c = newCanvas(img.width, img.height);
    c.getContext('2d').drawImage(img, 0, 0);
    return c;
}

export const clone = (src) => fromImage(src);

export function crop(src, x, y, w, h)
{
    const c = newCanvas(w, h);
    c.getContext('2d').drawImage(src, -x, -y);
    return c;
}

// alpha < t 的像素不算內容（AI 圖外圍常有 alpha 個位數的雜訊）
export function opaqueBounds(src, t = 1)
{
    const w = src.width, h = src.height;
    const d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++)
    {
        for (let x = 0; x < w; x++)
        {
            if (d[(y * w + x) * 4 + 3] < t) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            y1 = y;
        }
    }
    return x1 < 0 ? null : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
}

// alpha >= t 的像素依 8 方向相連分塊，回傳每塊編號（1 起，0＝透明）；
// erode > 0：先侵蝕 erode px（棋盤距離），把細細黏在一起的零件拆開，侵蝕後的核心各自分塊，再一圈圈同時長回原本的像素（先到先得）；
// 整塊被侵蝕光的照原本連通自成一塊
function labels(d, w, h, t, erode)
{
    const N = w * h, on = new Uint8Array(N);
    for (let i = 0; i < N; i++) on[i] = d[i * 4 + 3] >= t ? 1 : 0;
    let core = on;
    if (erode > 0)
    {
        const D = new Int32Array(N);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        {
            const i = y * w + x;
            if (!on[i]) continue;
            D[i] = 1 + Math.min(x ? D[i - 1] : 0, y ? D[i - w] : 0, x && y ? D[i - w - 1] : 0, y && x < w - 1 ? D[i - w + 1] : 0);
        }
        for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--)
        {
            const i = y * w + x;
            if (!on[i]) continue;
            const v = 1 + Math.min(x < w - 1 ? D[i + 1] : 0, y < h - 1 ? D[i + w] : 0, x < w - 1 && y < h - 1 ? D[i + w + 1] : 0, y < h - 1 && x ? D[i + w - 1] : 0);
            if (v < D[i]) D[i] = v;
        }
        core = new Uint8Array(N);
        for (let i = 0; i < N; i++) core[i] = D[i] > erode ? 1 : 0;
    }
    const lab = new Int32Array(N), queue = new Int32Array(N);
    let n = 0, qn = 0;
    const flood = (i, m) => {
        let top = qn;
        lab[i] = ++n;
        queue[qn++] = i;
        while (top < qn)
        {
            const j = queue[top++], x = j % w, y = (j - x) / w;
            for (let dy = -1; dy <= 1; dy++)
            {
                const ny = y + dy;
                if (ny < 0 || ny >= h) continue;
                for (let dx = -1; dx <= 1; dx++)
                {
                    const nx = x + dx, k = ny * w + nx;
                    if (nx < 0 || nx >= w || lab[k] || !m[k]) continue;
                    lab[k] = n;
                    queue[qn++] = k;
                }
            }
        }
    };
    for (let i = 0; i < N; i++) if (core[i] && !lab[i]) flood(i, core);
    if (core === on) return {lab, n};
    for (let top = 0; top < qn; top++)
    {
        const j = queue[top], x = j % w, y = (j - x) / w;
        for (let dy = -1; dy <= 1; dy++)
        {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let dx = -1; dx <= 1; dx++)
            {
                const nx = x + dx, k = ny * w + nx;
                if (nx < 0 || nx >= w || lab[k] || !on[k]) continue;
                lab[k] = lab[j];
                queue[qn++] = k;
            }
        }
    }
    for (let i = 0; i < N; i++) if (on[i] && !lab[i]) flood(i, on);
    return {lab, n};
}

// 分塊（見 labels），回傳每塊的像素數、外接矩形、重心、種子（塊裡的一個像素，給 keepBlobs 用）
export function blobs(src, t = 1, erode = 0)
{
    const w = src.width, h = src.height;
    const {lab, n} = labels(src.getContext('2d').getImageData(0, 0, w, h).data, w, h, t, erode);
    const out = Array.from({length: n}, () => ({n: 0, x: w, y: h, x1: -1, y1: -1, cx: 0, cy: 0, sx: -1, sy: -1}));
    for (let i = 0; i < w * h; i++)
    {
        if (!lab[i]) continue;
        const b = out[lab[i] - 1], x = i % w, y = (i - x) / w;
        if (b.sx < 0) Object.assign(b, {sx: x, sy: y});
        b.n++; b.cx += x; b.cy += y;
        if (x < b.x) b.x = x;
        if (x > b.x1) b.x1 = x;
        if (y < b.y) b.y = y;
        if (y > b.y1) b.y1 = y;
    }
    for (const b of out) {b.cx /= b.n; b.cy /= b.n;}
    return out;
}

// 只留種子 pts 所在的塊（分塊規則同 blobs，erode 也要一樣），其他像素清成透明
export function keepBlobs(src, {t, pts, erode = 0})
{
    const c = clone(src), w = c.width, h = c.height, g = c.getContext('2d');
    const img = g.getImageData(0, 0, w, h), d = img.data;
    const {lab} = labels(d, w, h, t, erode), keep = new Set();
    for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < w && y < h && lab[y * w + x]) keep.add(lab[y * w + x]);
    for (let i = 0; i < w * h; i++) if (!keep.has(lab[i])) d[i * 4 + 3] = 0;
    g.putImageData(img, 0, 0);
    return c;
}

function draw(src, w, h, smooth)
{
    const c = newCanvas(w, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = smooth;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    return c;
}

// xform：取輸入圖的 (sx,sy,sw,sh)（可以是小數）縮放成 w×h；裁切、縮放、trim 都是它
// 一次縮太多倍時 drawImage 會漏掉像素，平滑模式先每次縮一半，縮到剩兩倍以內
export function xform(src, {sx, sy, sw, sh, w, h, smooth})
{
    if (sw === w && sh === h && Number.isInteger(sx) && Number.isInteger(sy)) return crop(src, sx, sy, w, h);
    const x0 = Math.max(0, Math.floor(sx)), y0 = Math.max(0, Math.floor(sy));
    const x1 = Math.min(src.width, Math.ceil(sx + sw)), y1 = Math.min(src.height, Math.ceil(sy + sh));
    let cur = crop(src, x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
    let rx = sx - x0, ry = sy - y0, rw = sw, rh = sh;
    const smoothOn = smooth !== false;
    while (smoothOn && (rw / w > 2 || rh / h > 2))
    {
        const nw = rw / w > 2 ? Math.ceil(cur.width / 2) : cur.width;
        const nh = rh / h > 2 ? Math.ceil(cur.height / 2) : cur.height;
        const kx = nw / cur.width, ky = nh / cur.height;
        cur = draw(cur, nw, nh, true);
        rx *= kx; rw *= kx; ry *= ky; rh *= ky;
    }
    const c = newCanvas(w, h);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = smoothOn;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, rx, ry, rw, rh, 0, 0, c.width, c.height);
    return c;
}

// 先 a 後 b 的兩個 xform 合成一個：b 的範圍換算回 a 的輸入座標
export function compose(a, b)
{
    const fx = a.sw / a.w, fy = a.sh / a.h;
    return {type: 'xform', sx: a.sx + b.sx * fx, sy: a.sy + b.sy * fy, sw: b.sw * fx, sh: b.sh * fy,
            w: b.w, h: b.h, smooth: b.smooth ?? a.smooth};
}

// warp：輸入圖切成 cols×rows 格，pts 是每個格點變形後的位置（輸入圖座標，可超出原圖），
// 輸出圖 (0,0) 對應輸入座標 (bx,by)
export function warpBounds({pts})
{
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const bx = Math.floor(Math.min(...xs)), by = Math.floor(Math.min(...ys));
    return {bx, by, w: Math.max(1, Math.ceil(Math.max(...xs)) - bx), h: Math.max(1, Math.ceil(Math.max(...ys)) - by)};
}

export const warpGrid = (cols, rows, w, h) =>
    Array.from({length: (rows + 1) * (cols + 1)}, (_, k) => ({x: (k % (cols + 1)) * w / cols, y: Math.floor(k / (cols + 1)) * h / rows}));

// 每格拆兩個三角形，逐像素用重心座標反查原圖位置，再以預乘 alpha 的雙線性取樣（避免透明邊發黑）
// sd：拖曳時同一張 src 會一直重算，由呼叫端快取它的像素
export function warp(src, op, sd = src.getContext('2d').getImageData(0, 0, src.width, src.height).data)
{
    const {cols, rows, pts} = op, W = src.width, H = src.height;
    const B = warpBounds(op);
    const out = newCanvas(B.w, B.h);
    const og = out.getContext('2d');
    const img = og.createImageData(out.width, out.height), od = img.data;
    const ow = out.width, oh = out.height;

    // 重心座標 l1,l2 對 x 是線性的，原圖座標 = l1*sa + l2*sb + l3*sc 也是；逐像素只做加法
    const tri = (a, b, c, sa, sb, sc) => {
        const ax = a.x - B.bx, ay = a.y - B.by, bx = b.x - B.bx, by = b.y - B.by, cx = c.x - B.bx, cy = c.y - B.by;
        const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
        if (Math.abs(den) < 1e-9) return;
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(ow - 1, Math.ceil(Math.max(ax, bx, cx)));
        const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(oh - 1, Math.ceil(Math.max(ay, by, cy)));
        const d1x = (by - cy) / den, d2x = (cy - ay) / den;
        const dsx = d1x * (sa.x - sc.x) + d2x * (sb.x - sc.x), dsy = d1x * (sa.y - sc.y) + d2x * (sb.y - sc.y);
        const E = -1e-7;
        for (let y = y0; y <= y1; y++)
        {
            const py = y + 0.5, px = x0 + 0.5;
            let l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den;
            let l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den;
            let sx = l1 * sa.x + l2 * sb.x + (1 - l1 - l2) * sc.x - 0.5;
            let sy = l1 * sa.y + l2 * sb.y + (1 - l1 - l2) * sc.y - 0.5;
            for (let x = x0, o = (y * ow + x0) * 4; x <= x1; x++, o += 4, l1 += d1x, l2 += d2x, sx += dsx, sy += dsy)
            {
                if (l1 < E || l2 < E || 1 - l1 - l2 < E) continue;
                const fx0 = Math.floor(sx), fy0 = Math.floor(sy), fx = sx - fx0, fy = sy - fy0;
                let A = 0, R = 0, G = 0, Bl = 0;
                for (let k = 0; k < 4; k++)
                {
                    const tx = fx0 + (k & 1), ty = fy0 + (k >> 1);
                    if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
                    const wt = ((k & 1) ? fx : 1 - fx) * ((k >> 1) ? fy : 1 - fy);
                    const i = (ty * W + tx) * 4, al = sd[i + 3] * wt;
                    if (al <= 0) continue;
                    A += al; R += sd[i] * al; G += sd[i + 1] * al; Bl += sd[i + 2] * al;
                }
                if (A <= 0) continue;
                od[o] = R / A; od[o + 1] = G / A; od[o + 2] = Bl / A; od[o + 3] = A;
            }
        }
    };

    const src0 = warpGrid(cols, rows, W, H);
    const at = (arr, i, j) => arr[j * (cols + 1) + i];
    for (let j = 0; j < rows; j++)
    {
        for (let i = 0; i < cols; i++)
        {
            const d = [at(pts, i, j), at(pts, i + 1, j), at(pts, i + 1, j + 1), at(pts, i, j + 1)];
            const s = [at(src0, i, j), at(src0, i + 1, j), at(src0, i + 1, j + 1), at(src0, i, j + 1)];
            tri(d[0], d[1], d[2], s[0], s[1], s[2]);
            tri(d[0], d[2], d[3], s[0], s[2], s[3]);
        }
    }
    og.putImageData(img, 0, 0);
    return {canvas: out, bx: B.bx, by: B.by};
}

// 局部變形：frames 每個 {x,y,w,h,cols,rows,pts}，矩形和 pts 都是輸入圖座標（矩形是整數、在圖內）
// 輸出畫布涵蓋原圖和所有 pts，(0,0) 對應輸入座標 (bx,by)
export function warpFramesBounds(frames, W, H)
{
    let x0 = 0, y0 = 0, x1 = W, y1 = H;
    for (const p of frames.flatMap(f => f.pts))
    {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    const bx = Math.floor(x0), by = Math.floor(y0);
    return {bx, by, w: Math.ceil(x1) - bx, h: Math.ceil(y1) - by};
}

// 依序處理每個框：從目前結果取出框內、挖掉，再貼上框內變形後的圖（重疊的框吃前一個框的結果）
export function warpFrames(src, {frames})
{
    const B = warpFramesBounds(frames, src.width, src.height);
    const out = newCanvas(B.w, B.h), g = out.getContext('2d');
    g.drawImage(src, -B.bx, -B.by);
    for (const f of frames)
    {
        const x = f.x - B.bx, y = f.y - B.by;
        const r = warp(crop(out, x, y, f.w, f.h), {cols: f.cols, rows: f.rows, pts: f.pts.map(p => ({x: p.x - f.x, y: p.y - f.y}))});
        g.clearRect(x, y, f.w, f.h);
        g.drawImage(r.canvas, x + r.bx, y + r.by);
    }
    return {canvas: out, bx: B.bx, by: B.by};
}

const OPS = {
    alpha: (c, op) => alphaClear(c, op.t),
    warp: (c, op) => (op.frames ? warpFrames(c, op) : warp(c, op)).canvas,
    erase: (c, op) => erase(c, op),
    mask: (c, op) => mask(c, op),
    fill: (c, op) => fill(c, op),
    key: (c, op) => key(c, op),
    xform: (c, op) => xform(c, op),
    removeGreen: (c, op) => removeGreen(c, op.h1, op.h2, op.s1, op.s2, op.v1, op.v2, op.rgbThr),
    paint: (c, op) => paint(c, op),
    blobs: (c, op) => keepBlobs(c, op),
};

export function replay(src, ops)
{
    let c = src;
    for (const op of ops) c = OPS[op.type](c, op);
    return c;
}

export function erase(src, {x, y, w, h})
{
    const c = clone(src);
    c.getContext('2d').clearRect(x, y, w, h);
    return c;
}

// px：[[x,y,r,g,b,a]…]，那格直接換成這組 RGBA（不跟底下混色），圖外的略過
export function paint(src, {px})
{
    const c = clone(src), W = c.width, H = c.height;
    const ok = px.filter(([x, y]) => x >= 0 && y >= 0 && x < W && y < H);
    if (!ok.length) return c;
    const xs = ok.map(p => p[0]), ys = ok.map(p => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) + 1 - x0, h = Math.max(...ys) + 1 - y0;
    const g = c.getContext('2d'), img = g.getImageData(x0, y0, w, h);
    for (const [x, y, ...rgba] of ok) img.data.set(rgba, ((y - y0) * w + x - x0) * 4);
    g.putImageData(img, x0, y0);
    return c;
}

// keep：只留多邊形內（destination-in 會清掉整張畫布的多邊形外）；否則挖掉多邊形內
export function mask(src, {pts, keep})
{
    const c = clone(src), g = c.getContext('2d');
    g.globalCompositeOperation = keep ? 'destination-in' : 'destination-out';
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath();
    g.fill();
    return c;
}

// f(d, i)：i 是像素的 R 位置，就地改 d
function eachPixel(src, f)
{
    const c = clone(src);
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) f(d, i);
    g.putImageData(img, 0, 0);
    return c;
}

export const alphaClear = (src, t) => eachPixel(src, (d, i) => {
    if (d[i + 3] < t) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
});

// alpha >= t 的像素整組換成 (r,g,b,a)
export const fill = (src, {r, g, b, a, t}) => eachPixel(src, (d, i) => {
    if (d[i + 3] >= t) {d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;}
});

// RGB 完全相等的像素變透明；只比 RGB，alpha 已經是 0 的跳過
export const key = (src, {r, g, b}) => eachPixel(src, (d, i) => {
    if (d[i + 3] && d[i] === r && d[i + 1] === g && d[i + 2] === b) d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0;
});

// RGB to HSV 轉換
function rgbToHsv(r, g, b)
{
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    if (delta !== 0)
    {
        if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / delta + 2) / 6;
        else h = ((r - g) / delta + 4) / 6;
    }

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return {h: h * 180, s: s * 255, v: v * 255};
}

// 移除綠色背景：HSV + RGB 雙重判斷
export function removeGreen(src, h1, h2, s1, s2, v1, v2, rgbThr)
{
    const c = clone(src);
    const g = c.getContext('2d');
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;

    for (let i = 0; i < d.length; i += 4)
    {
        const r = d[i], g_val = d[i + 1], b = d[i + 2], a = d[i + 3];

        // RGB 判斷：G > R+rgbThr AND G > B+rgbThr
        const isGreenRGB = g_val > 100 && g_val > r + rgbThr && g_val > b + rgbThr;

        let isGreen = isGreenRGB;

        // HSV 判斷
        if (!isGreen && a > 200)
        {
            const hsv = rgbToHsv(r, g_val, b);
            isGreen = hsv.h >= h1 && hsv.h <= h2 &&
                      hsv.s >= s1 && hsv.s <= s2 &&
                      hsv.v >= v1 && hsv.v <= v2;
        }

        if (isGreen) d[i + 3] = 0;  // 設為透明
    }
    g.putImageData(img, 0, 0);
    return c;
}

export function pixelAt(src, x, y)
{
    if (x < 0 || y < 0 || x >= src.width || y >= src.height) return null;
    return [...src.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data];
}

export function fade(src, k)
{
    const c = newCanvas(src.width, src.height);
    const g = c.getContext('2d');
    g.globalAlpha = k;
    g.drawImage(src, 0, 0);
    return c;
}

export const alphaAt = (src, x, y) => pixelAt(src, x, y)?.[3] ?? 0;

// ---------- 前後片 ----------
// 從起點像素 (x,y) 往上、往左掃到輪廓線（alpha ≥ 128 且亮度 < c.lum）。上線當成「每一直行一個 y」往左右推、
// 左線當成「每一橫列一個 x」往上下推，所以路口岔出去的線（例如帽帶下緣往下接耳罩的邊）走不進去：
// 每一行只在預測位置（照前緣的斜率）附近找線段；線段突然變很長＝跟岔線併在一起，改用預測對得上的那一側邊緣
// 點取在線靠起點那側的邊上，所以線留給前片。往外走的（上線往右、左線往下）前片那側碰到透明或走到圖邊（裁到剛好的圖，外框貼著圖邊）就停、直直延伸出圖；
// 後片那側是開口（透明）時還要繼續沿線的外緣走，免得延伸線切過前片還沒走完的線，走進開口後線斷了也算走到外面；
// 往內走的（上線往左、左線往上）碰到另一條線（線段變很長）就停，兩端在轉角接起來
// 回傳後片（右下那塊）的多邊形 {pts: [{x,y}…]}，失敗回傳 {err}；魔術棒用 splitCut()

const SPLIT_ALPHA = 128;

// 輪廓線的顏色條件（不看 alpha）：亮度 < c.lum
export const lineTest = (c) => (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114 < c.lum;

// 魔術棒：1 淹水＝從起點 4 方向淹，碰到輪廓線或透明就停；2 閉運算＝R 膨脹 close px 再侵蝕回來（四周先補 close px，貼圖邊的不會被侵蝕掉），
// 填平寬 ≤ 2×close 的縫；3 往下射＝R 每一直行的下緣往下 drop 格內碰到透明（或圖邊），才把中間（線＋外緣的反鋸齒）收進來；
// 4 往右射＝同 3，從往下射之後的 R 每一橫列的右緣往右看 right 格（右下角的轉角才收得到）
// 回傳每格是哪一步收進來的（0＝沒有、1..4），失敗回傳 {err}
export function splitFlood(src, {x, y, c, close = 0, drop = 0, right = 0})
{
    const W = src.width, H = src.height, N = W * H, d = src.getContext('2d').getImageData(0, 0, W, H).data;
    const test = lineTest(c);
    const solid = (i) => d[i * 4 + 3] >= SPLIT_ALPHA;
    const open = (i) => solid(i) && !test(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    if (x < 0 || y < 0 || x >= W || y >= H || !solid(y * W + x)) return {err: '起點在透明的地方'};
    if (!open(y * W + x)) return {err: '起點在輪廓線上，拖到線圍起來的區域裡'};
    const R = new Uint8Array(N);
    fill4(W, H, y * W + x, open, R);

    if (close > 0)
    {
        const k = close, PW = W + 2 * k, PH = H + 2 * k;
        let a = new Uint8Array(PW * PH);
        for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) a[(Y + k) * PW + X + k] = R[Y * W + X] ? 1 : 0;
        // 方形結構元素，橫、直分開做；dil=true 取 max（膨脹），false 取 min（侵蝕，圖外當 0）
        const pass = (s, dil, horiz) => {
            const o = new Uint8Array(PW * PH);
            for (let Y = 0; Y < PH; Y++) for (let X = 0; X < PW; X++)
            {
                let v = dil ? 0 : 1;
                for (let t = -k; t <= k; t++)
                {
                    const nx = horiz ? X + t : X, ny = horiz ? Y : Y + t;
                    const p = nx >= 0 && ny >= 0 && nx < PW && ny < PH ? s[ny * PW + nx] : 0;
                    if (dil ? p : !p) {v = dil ? 1 : 0; break;}
                }
                o[Y * PW + X] = v;
            }
            return o;
        };
        a = pass(pass(pass(pass(a, true, true), true, false), false, true), false, false);
        for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++)
            if (a[(Y + k) * PW + X + k] && !R[Y * W + X]) R[Y * W + X] = 2;
    }

    // R 每一行的邊緣往外看 dist 格，碰到透明／圖邊就把中間（線＋外緣的反鋸齒）都收進來；at(a, t)：第 a 行、往外第 t 格
    const reach = (n, len, at, dist, label) => {
        const base = R.slice();
        for (let a = 0; a < n; a++) for (let t = 0; t < len; t++)
        {
            if (!base[at(a, t)] || (t + 1 < len && base[at(a, t + 1)])) continue;
            for (let u = 1; u <= dist; u++)
            {
                if (t + u < len && base[at(a, t + u)]) break;
                if (t + u >= len || !solid(at(a, t + u)))
                {
                    for (let v = t + 1; v < t + u; v++) if (!R[at(a, v)]) R[at(a, v)] = label;
                    break;
                }
            }
        }
    };
    if (drop > 0) reach(W, H, (X, Y) => Y * W + X, drop, 3);
    if (right > 0) reach(H, W, (Y, X) => Y * W + X, right, 4);
    return {R};
}

// 魔術棒的多邊形：splitFlood() 的結果取起點那一塊（4 連通），沿格子邊描外圈（裡面的洞一起挖）、RDP 簡化；失敗回傳 {err}
export function splitCut(src, o)
{
    const r = splitFlood(src, o);
    if (r.err) return r;
    const W = src.width, H = src.height, M = new Uint8Array(W * H);
    fill4(W, H, o.y * W + o.x, (i) => r.R[i] > 0, M);
    const s = M.indexOf(1), x0 = s % W, y0 = (s - x0) / W;
    const at = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H && M[Y * W + X] === 1;
    // 順時針走格子邊（區域在右手邊），從最上面一列最左邊那格的左上角往右出發；pts 只記轉彎的角
    const pts = [];
    let cx = x0, cy = y0, dx = 1, dy = 0;
    do
    {
        cx += dx; cy += dy;
        const rx = -dy, ry = dx;
        const ax = cx + Math.min(0, dx), ay = cy + Math.min(0, dy);
        const left = at(ax + Math.min(0, -rx), ay + Math.min(0, -ry)), right = at(ax + Math.min(0, rx), ay + Math.min(0, ry));
        const [ndx, ndy] = left ? [-rx, -ry] : right ? [dx, dy] : [rx, ry];
        if (ndx !== dx || ndy !== dy) pts.push({x: cx, y: cy});
        dx = ndx; dy = ndy;
    } while (cx !== x0 || cy !== y0 || dx !== 1 || dy !== 0);
    // 閉合的環頭尾同一點，RDP 的基準線長度是 0，所以從離起點最遠的那一點切成兩段各自簡化
    const p0 = pts[0], d2 = pts.map(p => (p.x - p0.x) ** 2 + (p.y - p0.y) ** 2), far = d2.indexOf(Math.max(...d2));
    const a = simplify(pts.slice(0, far + 1)), b = simplify([...pts.slice(far), p0]);
    return {pts: [...a, ...b.slice(1, -1)]};
}

function fill4(W, H, seed, ok, mark)
{
    const stack = new Int32Array(W * H);
    let top = 0;
    mark[seed] = 1;
    stack[top++] = seed;
    while (top)
    {
        const i = stack[--top], X = i % W;
        for (const j of [X > 0 ? i - 1 : -1, X < W - 1 ? i + 1 : -1, i - W, i + W])
            if (j >= 0 && j < W * H && !mark[j] && ok(j)) {mark[j] = 1; stack[top++] = j;}
    }
}

export function splitTrace(src, {x, y, c})
{
    const W = src.width, H = src.height, d = src.getContext('2d').getImageData(0, 0, W, H).data;
    const test = lineTest(c);
    const idx = (X, Y) => X < 0 || Y < 0 || X >= W || Y >= H ? -1 : (Y * W + X) * 4;
    const solid = (X, Y) => {const i = idx(X, Y); return i >= 0 && d[i + 3] >= SPLIT_ALPHA;};
    const line = (X, Y) => {const i = idx(X, Y); return i >= 0 && d[i + 3] >= SPLIT_ALPHA && test(d[i], d[i + 1], d[i + 2]);};
    if (!solid(x, y)) return {err: '起點在透明的地方'};
    if (line(x, y)) return {err: '起點在輪廓線上，拖到線圍起來的區域裡'};

    // 主軸 i 是往前推的方向、副軸 j 往大的那側是後片：上線 i=x、j=y，左線 i=y、j=x
    const T = {n: W, line: (i, j) => line(i, j), solid: (i, j) => solid(i, j), pt: (i, j) => ({x: i + 0.5, y: j})};
    const L = {n: H, line: (i, j) => line(j, i), solid: (i, j) => solid(j, i), pt: (i, j) => ({x: j, y: i + 0.5})};

    // 從起點沿副軸往小的方向掃到線：那條線在這一行的前緣 f、後緣 b
    const hit = (A, i, j, name) => {
        while (--j >= 0 && !A.line(i, j)) if (!A.solid(i, j)) return {err: `往${name}掃到透明，沒碰到輪廓線`};
        if (j < 0) return {err: `往${name}掃到圖邊，沒碰到輪廓線`};
        const b = j;
        while (j > 0 && A.line(i, j - 1)) j--;
        return {i, f: j, b, w: b - j + 1};
    };

    const trace = (A, h, dir, inward, guard) => {
        const K = Math.max(4, h.w * 2), R = Math.ceil(h.w / 2) + 2, gapMax = Math.max(2, h.w), long = h.w * 1.8 + 1;
        const fs = [h.f], pts = [A.pt(h.i, h.b + 1)];
        let f = h.f, b = h.b, gap = 0, end = 'edge', open = false;
        for (let i = h.i + dir; i >= 0 && i < A.n; i += dir)
        {
            if (guard?.(i)) {end = 'guard'; break;}
            const k = Math.min(K, fs.length - 1);
            const slope = k ? Math.max(-2, Math.min(2, (fs.at(-1) - fs.at(-1 - k)) / k)) : 0;
            const pf = f + slope, pb = b + slope;
            let best = null;
            for (let j = Math.floor(pf - R); j <= Math.ceil(pb + R); j++)
            {
                if (!A.line(i, j)) continue;
                let rf = j, rb = j;
                while (A.line(i, rf - 1)) rf--;
                while (A.line(i, rb + 1)) rb++;
                const ov = Math.min(rb, pb) - Math.max(rf, pf);
                if (!best || ov > best.ov) best = {rf, rb, ov};
                j = rb;
            }
            if (!best)
            {
                if (!A.solid(i, Math.round(pf))) {end = 'out'; break;}
                if (++gap > gapMax) {end = open ? 'out' : 'end'; break;}
                fs.push(f = pf);
                b = pb;
                continue;
            }
            gap = 0;
            const {rf, rb} = best;
            if (rb - rf + 1 <= long) {f = rf; b = rb;}
            else if (inward) {end = 'junction'; break;}
            else if (Math.abs(rf - pf) <= R) {f = rf; b = rf + h.w - 1;}
            else if (Math.abs(rb - pb) <= R) {b = rb; f = rb - h.w + 1;}
            else {f = pf; b = pb;}
            fs.push(f);
            pts.push(A.pt(i, b + 1));
            const fo = !A.solid(i, Math.floor(f) - 2), bo = !A.solid(i, Math.ceil(b) + 2);
            if (fo || (inward && bo)) {end = 'out'; break;}
            if (bo) open = true;
        }
        return {pts, end};
    };

    const up = hit(T, x, y, '上'), left = hit(L, y, x, '左');
    if (up.err || left.err) return {err: up.err ?? left.err};
    const out = (r) => r.end === 'out' || r.end === 'edge';
    const tr = trace(T, up, 1, false), ld = trace(L, left, 1, false);
    const broken = !out(tr) ? '上線往右' : !out(ld) ? '左線往下' : null;
    if (broken) return {err: `${broken}沒走到外面（線斷了），換個起點或調門檻`};
    const tl = trace(T, up, -1, true, i => i < left.f - left.w * 2);
    const lu = trace(L, left, -1, true, i => i < up.f - up.w * 2);

    const e = 2;
    const corner = {x: lu.pts.at(-1).x, y: tl.pts.at(-1).y};
    const te = {x: W + e, y: tr.pts.at(-1).y};
    const top = simplify([corner, ...[...tl.pts].reverse(), ...tr.pts.slice(1), te]);
    const le = {x: ld.pts.at(-1).x, y: H + e};
    const lft = simplify([le, ...[...ld.pts].reverse(), ...lu.pts.slice(1)]);
    return {pts: [...top, {x: W + e, y: H + e}, ...lft]};
}

// Ramer–Douglas–Peucker，tol 是圖片像素
function simplify(pts, tol = 0.75)
{
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length), stack = [[0, pts.length - 1]];
    keep[0] = keep[pts.length - 1] = 1;
    while (stack.length)
    {
        const [i0, i1] = stack.pop(), a = pts[i0], b = pts[i1];
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        let md = 0, mi = -1;
        for (let i = i0 + 1; i < i1; i++)
        {
            const dd = Math.abs((pts[i].x - a.x) * dy - (pts[i].y - a.y) * dx) / len;
            if (dd > md) {md = dd; mi = i;}
        }
        if (md > tol) {keep[mi] = 1; stack.push([i0, mi], [mi, i1]);}
    }
    return pts.filter((_, i) => keep[i]);
}

export const toPng = (c) => new Promise(res => c.toBlob(res, 'image/png'));
