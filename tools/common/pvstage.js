// 工具的 Phaser 預覽共用（特效、粒子分頁）：角色照角色編輯器的 partsOf() 合成一張貼圖，root／view／shape 的關係跟 RoleView 一樣；textures 的圖切成單張貼圖
import * as IC from './icons.js';
import {partsOf} from '../role/preview.js';

const ROLE_CV = 160;

export async function roleCanvas(r, items, pdb)
{
    const parts = partsOf(r, items, pdb);
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    const cv = document.createElement('canvas');
    cv.width = cv.height = ROLE_CV;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    parts.forEach(({p}, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {img, f} = fr;
        g.save();
        g.translate(ROLE_CV / 2 + (p.x ?? 0), ROLE_CV / 2 + (p.y ?? 0));
        g.rotate((p.a ?? 0) * Math.PI / 180);
        g.scale(p.scale ?? 1, p.scale ?? 1);
        g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
        g.restore();
    });
    return cv;
}

// root 在 (x, y)＝角色腳底；灰線是地面（寬 ground）、灰框是 view（w×h）；view 帶 shape／max／Min／Max（fxcell 的 attachCell、bodyTween 要用）
export function addRole(scene, r, texKey, x, y, ground)
{
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const root = scene.add.container(x, y);
    const view = scene.add.container(-ax, -ay);
    const shape = scene.add.image(0, 0, texKey);
    view.add(shape);
    root.add(view);
    const g = scene.add.graphics();
    g.lineStyle(1, 0x444444).lineBetween(-ground / 2, 0, ground / 2, 0);
    g.lineStyle(1, 0x555555).strokeRect(-ax - w / 2, -ay - hh / 2, w, hh);
    root.addAt(g, 0);
    Object.assign(view, {shape, max: {x: w / 2, y: hh / 2}, Min: {x: -ax - w / 2, y: -ay - hh / 2}, Max: {x: -ax + w / 2, y: -ay + hh / 2}});
    root.view = view;
    return {root, view, base: {x: shape.x, y: shape.y}};
}

// textures 的圖（不是 emoji）切成一張貼圖；同一個值只切一次（cache：Map 值→key）；不是圖回傳原值
export async function imgTexture(scene, img, cache, prefix)
{
    const r = IC.resolve(img);
    if (!r.url) return img;
    if (cache.has(img)) return cache.get(img);
    const fr = await IC.frameOf(img);
    if (!fr) return img;
    const cv = document.createElement('canvas');
    cv.width = fr.f.w; cv.height = fr.f.h;
    cv.getContext('2d').drawImage(fr.img, fr.f.x, fr.f.y, fr.f.w, fr.f.h, 0, 0, fr.f.w, fr.f.h);
    const key = `${prefix}-${cache.size}`;
    scene.textures.addCanvas(key, cv);
    cache.set(img, key);
    return key;
}
