// 地圖上的角色物件：type npc＋屬性 id（template 裡寫的也算），位置照 Phaser createFromObjects＋RoleView 的錨點
// 外觀照角色分頁的合成預覽（partsOf），每個角色烤一張小圖快取
import {partsOf} from '../role/preview.js';
import * as IC from '../common/icons.js';
import {isRoleObj} from '../../src/data/mapcheck.js';
export {isRoleObj, placeOf} from '../../src/data/mapcheck.js';

// 地圖裡的角色：[{o（navgrid 解析過的物件）, layer（圖層名）, rid}]
export function roleObjs(d)
{
    const byRaw = new Map(d.objs.map(o => [o.raw, o]));
    const out = [];
    for (const l of d.map.layers)
    {
        if (l.type !== 'objectgroup') continue;
        for (const raw of l.objects)
        {
            const o = byRaw.get(raw);
            if (o && isRoleObj(o)) out.push({o, layer: l.name, rid: String(o.props.id)});
        }
    }
    return out;
}

const SZ = 256;
const cache = new Map();    // rid → Promise<canvas|null>（view 中心在 (SZ/2, SZ/2)）
export const forgetSprites = () => cache.clear();

export function spriteOf(rid, refs)
{
    if (cache.has(rid)) return cache.get(rid);
    const p = (async () => {
        const r = refs.roles[rid];
        if (!r) return null;
        const parts = partsOf(r, refs.items, refs.parts);
        const frames = await Promise.all(parts.map(pt => IC.frameOf(pt.sprite)));
        const cv = document.createElement('canvas');
        cv.width = cv.height = SZ;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        parts.forEach((pt, i) => {
            const fr = frames[i];
            if (!fr) return;
            const {p} = pt, {img, f} = fr;
            g.save();
            g.translate(SZ / 2 + (p.x ?? 0), SZ / 2 + (p.y ?? 0));
            g.rotate((p.a ?? 0) * Math.PI / 180);
            g.scale(p.scale ?? 1, p.scale ?? 1);
            g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
            g.restore();
        });
        return cv;
    })();
    cache.set(rid, p);
    return p;
}
export const SPRITE_HALF = SZ / 2;
