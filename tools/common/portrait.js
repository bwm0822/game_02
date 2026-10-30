// 由頭髮產生頭像：部位（{sprite, scale, x, y, a, ox, oy}，女角已套 f）照遊戲擺放疊起來，裁到不透明範圍，等比塞進 size×size 的 fill%（可以超過 100，超出裁掉）
// 用 PNG 原尺寸畫：scale 最小的那張 1:1，其他照 scale 比例放大，位置照遊戲單位換算，才不會糊
import * as IC from './icons.js';

const ALPHA_T = 16;

function opaqueBounds(cv)
{
    const {width: w, height: h} = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
        if (d[(y * w + x) * 4 + 3] >= ALPHA_T) {x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);}
    return x1 < 0 ? null : {x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
}

const canvas = (w, h) => Object.assign(document.createElement('canvas'), {width: Math.max(1, w), height: Math.max(1, h)});

// 圖讀不到或全透明回 null
export async function portraitOf(parts, {size, fill})
{
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    const ps = parts.map((p, i) => ({p, fr: frames[i]})).filter(o => o.fr);
    if (!ps.length) return null;
    const k = 1 / Math.min(...ps.map(({p}) => p.scale ?? 1));
    // 每張圖轉完角度後的四角，算整張的外框
    const place = ps.map(({p, fr}) => {
        const s = (p.scale ?? 1) * k, w = fr.f.w * s, h = fr.f.h * s, r = (p.a ?? 0) * Math.PI / 180;
        const px = (p.x ?? 0) * k, py = (p.y ?? 0) * k, lx = -(p.ox ?? 0.5) * w, ly = -(p.oy ?? 1) * h;
        const pts = [[lx, ly], [lx + w, ly], [lx, ly + h], [lx + w, ly + h]]
            .map(([x, y]) => [px + x * Math.cos(r) - y * Math.sin(r), py + x * Math.sin(r) + y * Math.cos(r)]);
        return {fr, w, h, r, px, py, lx, ly, pts};
    });
    const all = place.flatMap(o => o.pts);
    const x0 = Math.floor(Math.min(...all.map(([x]) => x))), y0 = Math.floor(Math.min(...all.map(([, y]) => y)));
    const big = canvas(Math.ceil(Math.max(...all.map(([x]) => x))) - x0, Math.ceil(Math.max(...all.map(([, y]) => y))) - y0);
    const g = big.getContext('2d');
    g.imageSmoothingQuality = 'high';
    for (const {fr, w, h, r, px, py, lx, ly} of place)
    {
        g.save();
        g.translate(px - x0, py - y0);
        g.rotate(r);
        g.drawImage(fr.img, fr.f.x, fr.f.y, fr.f.w, fr.f.h, lx, ly, w, h);
        g.restore();
    }
    const b = opaqueBounds(big);
    if (!b) return null;
    const s = fill / 100 * Math.min(size / b.w, size / b.h), w = Math.max(1, Math.round(b.w * s)), h = Math.max(1, Math.round(b.h * s));
    const out = canvas(size, size), o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(big, b.x, b.y, b.w, b.h, Math.floor((size - w) / 2), Math.floor((size - h) / 2), w, h);
    return out;
}

export const toPng = (cv) => new Promise(res => cv.toBlob(res, 'image/png'));
