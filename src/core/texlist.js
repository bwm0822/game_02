// textures.json（scripts/textures.js 產生）排進 loader（路徑相對 assets/）；skip(key) 為 true 的不排，回傳排了幾個
// Preloader 全部排；sandbox 收到清單更新只補沒載過的
export function queueTextures(load, tex, skip = () => false)
{
    let n = 0;
    for (const [k, url] of Object.entries(tex.image ?? {})) {if (!skip(k)) {load.image(k, url); n++;}}
    for (const [k, s] of Object.entries(tex.sheet ?? {})) {if (!skip(k)) {load.spritesheet(k, s.url, {frameWidth: s.w, frameHeight: s.h, margin: s.margin, spacing: s.spacing}); n++;}}
    for (const [k, a] of Object.entries(tex.atlas ?? {})) {if (!skip(k)) {load.atlas(k, a.url, a.json); n++;}}
    return n;
}
