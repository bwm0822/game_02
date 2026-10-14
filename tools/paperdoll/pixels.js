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

const OPS = {
    alpha: (c, op) => alphaClear(c, op.t),
    warp: (c, op) => warp(c, op).canvas,
    erase: (c, op) => erase(c, op),
    mask: (c, op) => mask(c, op),
    fill: (c, op) => fill(c, op),
    key: (c, op) => key(c, op),
    xform: (c, op) => xform(c, op),
    removeGreen: (c, op) => removeGreen(c, op.h1, op.h2, op.s1, op.s2, op.v1, op.v2, op.rgbThr),
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

export const toPng = (c) => new Promise(res => c.toBlob(res, 'image/png'));
