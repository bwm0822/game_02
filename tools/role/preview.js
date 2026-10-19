// 靜態合成預覽：照 RoleView 的規則畫（view 中心 = 錨點 −anchor；部件在 view 中心 +(x,y)、origin (ox??0.5, oy??1)、依 depth 疊）
// 框：物理 b（紅）、佔格 g（綠）、互動區 z（藍），算法同 View._resolveAxis
import {h} from '../common/dom.js';
import {isObj} from '../common/obj.js';
import * as IC from '../common/icons.js';
import {DEPTH} from './schema.js';

const P = {zoom: 3, b: true, g: false, z: false, equips: true, flip: false};   // 開關跨角色保留
const COLOR = {b: '#ff5555', g: '#55dd55', z: '#5599ff'};

function axis(a, b, total)
{
    a ??= 0; b ??= 0;
    return {a, size: total - a - b};
}

// 回傳要畫的部件，照遊戲的順序（body、head、hand、裝備）再依 depth 穩定排序
export function partsOf(r, items)
{
    const out = [];
    const add = (p, d) => {
        if (!isObj(p)) return;
        if (p.sprite) out.push({p, sprite: p.sprite, d: d ?? 0});
        if (p.ext) out.push({p, sprite: p.ext, d: DEPTH.ext});
    };
    add(r.body, DEPTH.body); add(r.head, DEPTH.head); add(r.hand, DEPTH.hand);
    if (P.equips)
        for (const e of r.inv?.equips ?? [])
        {
            const it = items[isObj(e) ? e.id : e];
            if (it?.equip) add(it.equip, DEPTH[it.cat]);
        }
    return out.sort((a, b) => a.d - b.d);
}

async function draw(cv, r, items)
{
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const W = Math.max(w, 64) + 48, H = Math.max(hh, 64) + 48, K = P.zoom;
    const parts = partsOf(r, items);
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(K, K);
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#222428';
    for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 * 8; x < W; x += 16) g.fillRect(x, y, 8, 8);

    const vc = {x: W / 2, y: H / 2}, root = {x: vc.x + ax, y: vc.y + ay};
    g.lineWidth = 1 / K;
    g.setLineDash([3 / K, 3 / K]);
    g.strokeStyle = '#888';
    g.strokeRect(vc.x - w / 2, vc.y - hh / 2, w, hh);
    g.setLineDash([]);

    let n = 0;
    parts.forEach((pt, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {p} = pt, {img, f} = fr;
        g.save();
        g.translate(vc.x, vc.y);
        if (P.flip) g.scale(-1, 1);
        g.translate(p.x ?? 0, p.y ?? 0);
        g.rotate((p.a ?? 0) * Math.PI / 180);
        g.scale(p.scale ?? 1, p.scale ?? 1);
        g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
        g.restore();
        n++;
    });

    for (const k of ['g', 'z', 'b'])
    {
        if (!P[k] || !isObj(r[k])) continue;
        const x = axis(r[k].l, r[k].r, w), y = axis(r[k].t, r[k].b, hh);
        g.strokeStyle = COLOR[k];
        g.lineWidth = 2 / K;
        g.strokeRect(vc.x - w / 2 + x.a, vc.y - hh / 2 + y.a, x.size, y.size);
    }

    g.strokeStyle = '#ffd700';
    g.lineWidth = 2 / K;
    g.beginPath();
    g.moveTo(root.x - 4, root.y); g.lineTo(root.x + 4, root.y);
    g.moveTo(root.x, root.y - 4); g.lineTo(root.x, root.y + 4);
    g.stroke();
    cv.dataset.drawn = n;
}

export function previewEl(r, items)
{
    const cv = h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）'});
    const redraw = () => draw(cv, r, items);
    const check = (k, text, color) => h('label', {style: color && `color:${color}`},
        h('input', {type: 'checkbox', checked: P[k], onchange: e => {P[k] = e.target.checked; redraw();}}), text);
    redraw();
    return h('div', {class: 'pv'},
        cv,
        h('div', {class: 'opts'},
            check('b', '物理 b', COLOR.b), check('g', '佔格 g', COLOR.g), check('z', '互動 z', COLOR.z),
            check('equips', '裝備'), check('flip', '翻面'),
            h('select', {onchange: e => {P.zoom = +e.target.value; redraw();}},
                [2, 3, 4, 6].map(z => h('option', {value: z, selected: z === P.zoom}, `×${z}`)))));
}
