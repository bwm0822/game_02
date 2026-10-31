// 靜態合成預覽：照 RoleView 的規則畫（view 中心 = 錨點 −anchor；部件在 view 中心 +(x,y)、origin (ox??0.5, oy??1)、依 depth 疊）
// 框：物理 b（紅）、佔格 g（綠）、互動區 z（藍），算法同 View._resolveAxis
import {h} from '../common/dom.js';
import {isObj} from '../common/obj.js';
import * as IC from '../common/icons.js';
import {DEPTH, BACK_DEPTH, NODE, CAT} from './schema.js';
import {equipFor, partFor, hiddenParts, ROLE_PARTS, pivotOf, atPivot} from '../../src/core/equip.js';

const P = {zoom: 3, b: true, g: false, z: false, equips: true, flip: false, bg: null};   // 開關跨角色保留；bg null＝棋盤格
const COLOR = {b: '#ff5555', g: '#55dd55', z: '#5599ff'};
const BG = ['#1b1c1f', '#222428'];   // 棋盤格兩色
const BG_KEY = 'tools.preview.bg';
try {P.bg = localStorage.getItem(BG_KEY);} catch {}

// 同頁可能有好幾張預覽（部位分頁的男／女版），換底色全部一起重畫
const redraws = new WeakMap();      // .pv 元素 → redraw
function setBg(c, store)
{
    P.bg = c;
    if (store) try {c ? localStorage.setItem(BG_KEY, c) : localStorage.removeItem(BG_KEY);} catch {}
    for (const pv of document.querySelectorAll('.pv'))
    {
        pv.querySelector('input.bg').value = c ?? BG[0];
        pv.querySelector('.bgchk').disabled = !c;
        redraws.get(pv)?.();
    }
}

function axis(a, b, total)
{
    a ??= 0; b ??= 0;
    return {a, size: total - a - b};
}

// 回傳要畫的部件，照遊戲的順序（部位、裝備）再依 depth 穩定排序；被裝備藏掉的部位（hiddenParts）不畫
// 掛在支點上的（NODE）數字相對 body 的支點，p 是加回支點後的副本
// 角色的部位是 part.json 的 id（parts＝part.json）
export function partsOf(r, items, parts)
{
    const out = [];
    const body = partFor(parts, r, 'body');
    const add = (p, k) => {
        if (!isObj(p)) return;
        p = atPivot(p, pivotOf(body, NODE[k]));
        if (p.sprite) out.push({p, sprite: p.sprite, d: DEPTH[k] ?? 0});
        if (p.ext) out.push({p, sprite: p.ext, d: DEPTH.ext});
        if (p.back) out.push({p, sprite: p.back, d: BACK_DEPTH[k] ?? DEPTH.back});
    };
    const equips = P.equips ? (r.inv?.equips ?? []).map(e => items[isObj(e) ? e.id : e]).filter(it => it?.equip) : [];
    const hide = hiddenParts(equips, CAT);
    for (const k of ROLE_PARTS) if (!hide.has(k)) add(partFor(parts, r, k), k);
    for (const it of equips) add(equipFor(it.equip, r.sex), it.cat);
    return out.sort((a, b) => a.d - b.d);
}

async function draw(cv, r, items, pdb)
{
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const W = Math.max(w, 64) + 48, H = Math.max(hh, 64) + 48, K = P.zoom;
    const parts = partsOf(r, items, pdb);
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    cv.width = W * K; cv.height = H * K;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.scale(K, K);
    g.fillStyle = P.bg ?? BG[0]; g.fillRect(0, 0, W, H);
    g.fillStyle = BG[1];
    if (!P.bg) for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 * 8; x < W; x += 16) g.fillRect(x, y, 8, 8);

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

export function previewEl(r, items, parts)
{
    const cv = h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）'});
    const redraw = () => draw(cv, r, items, parts);
    const check = (k, text, color) => h('label', {style: color && `color:${color}`},
        h('input', {type: 'checkbox', checked: P[k], onchange: e => {P[k] = e.target.checked; redraw();}}), text);
    redraw();
    // 畫布包一層：版面想讓畫布自己捲、選項固定在下面時（部位分頁）捲這層
    const pv = h('div', {class: 'pv'},
        h('div', {class: 'cvbox'}, cv),
        h('div', {class: 'opts'},
            check('b', '物理 b', COLOR.b), check('g', '佔格 g', COLOR.g), check('z', '互動 z', COLOR.z),
            check('equips', '裝備'), check('flip', '翻面'),
            h('select', {onchange: e => {P.zoom = +e.target.value; redraw();}},
                [2, 3, 4, 6].map(z => h('option', {value: z, selected: z === P.zoom}, `×${z}`))),
            h('input', {type: 'color', class: 'bg', title: '背景色', value: P.bg ?? BG[0], oninput: e => setBg(e.target.value), onchange: e => setBg(e.target.value, true)}),
            h('button', {type: 'button', class: 'bgchk', title: '背景改回棋盤格', disabled: !P.bg, onclick: () => setBg(null, true)}, '棋盤格')));
    redraws.set(pv, redraw);
    return pv;
}
