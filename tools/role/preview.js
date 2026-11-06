// 靜態合成預覽：照 RoleView 的規則畫（view 中心 = 錨點 −anchor；部件在 view 中心 +(x,y)、origin (ox??0.5, oy??1)、依 depth 疊）
// 框：物理 b（紅）、佔格 g（綠）、互動區 z（藍），算法同 View._resolveAxis
import {h} from '../common/dom.js';
import {isObj} from '../common/obj.js';
import * as IC from '../common/icons.js';
import * as HD from '../common/handles.js';
import {show, showMenu} from '../common/showmenu.js';
import * as PZ from '../common/panzoom.js';
import {hidden, hideChecks} from '../common/headhide.js';
import {DEPTH, BACK_DEPTH, NODE, CAT} from './schema.js';
import {equipFor, partFor, hiddenParts, weaponOf, ROLE_PARTS, PIVOTS, pivotOf, atPivot, fromPivot, rigOf, flatPart} from '../../src/core/equip.js';

const P = {equips: true, flip: false, bg: null};   // 開關跨角色保留；bg null＝棋盤格；view／錨點／框／支點看 showmenu.js 的 show；倍率／位置看 panzoom.js
const COLOR = {b: '#ff5555', g: '#55dd55', z: '#5599ff'};
export const BG = ['#1b1c1f', '#222428'];   // 棋盤格兩色
const BG_KEY = 'tools.preview.bg';
try {P.bg = localStorage.getItem(BG_KEY);} catch {}

// 同頁可能有好幾張預覽（部位分頁的男／女版），換底色全部一起重畫
const redraws = new WeakMap();      // .pv 元素 → redraw
export const redrawAll = () => {for (const pv of document.querySelectorAll('.pv')) redraws.get(pv)?.();};
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
// 掛在支點上的（NODE）數字相對 body 的支點、其他相對 rig（body 的 x/y/a），p 是換回 shape 座標的副本
// 角色的部位是 part.json 的 id（parts＝part.json）
export function partsOf(r, items, parts)
{
    const out = [];
    const body = partFor(parts, r, 'body');
    const equips = P.equips ? (r.inv?.equips ?? []).map(e => items[isObj(e) ? e.id : e]).filter(it => it?.equip) : [];
    const held = weaponOf(equips, CAT);
    const add = (p, k) => {
        if (!isObj(p)) return;
        if (k !== 'body') p = flatPart(p, body, NODE[k], held);
        if (p.sprite) out.push({p, k, sprite: p.sprite, d: DEPTH[k] ?? 0});
        if (p.ext) out.push({p, k, sprite: p.ext, d: DEPTH.ext});
        if (p.back) out.push({p, k, sprite: p.back, d: BACK_DEPTH[k] ?? DEPTH.back});
    };
    const hide = hiddenParts(equips, CAT, partFor(parts, r, 'hat'));
    for (const k of ROLE_PARTS) if (!hide.has(k)) add(partFor(parts, r, k), k);
    for (const it of equips) add(equipFor(it.equip, r.sex, it.sex), it.cat);
    return out.sort((a, b) => a.d - b.d);
}

// 置中要裝下的範圍（世界單位，以 view 中心為中心）
export const frameOf = (r) => ({w: Math.max(r.w ?? 32, 64) + 48, h: Math.max(r.h ?? 64, 64) + 48});

// 底色：純色或棋盤格（螢幕座標，格子大小不跟著縮放）
export function fillBg(g, cw, ch, bg)
{
    g.fillStyle = bg ?? BG[0]; g.fillRect(0, 0, cw, ch);
    if (bg) return;
    g.fillStyle = BG[1];
    for (let y = 0; y < ch; y += 12) for (let x = (y / 12) % 2 * 12; x < cw; x += 24) g.fillRect(x, y, 12, 12);
}

async function draw(cv, r, items, pdb, st)
{
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const parts = partsOf(r, items, pdb).filter(pt => st.noHide || !hidden(pt.k));
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    if (!cv.isConnected) return;
    const g = cv.getContext('2d');
    const {K, o} = st.pz.begin(g, (g, cw, ch) => fillBg(g, cw, ch, P.bg));
    g.imageSmoothingEnabled = false;

    const vc = {x: 0, y: 0}, root = {x: ax, y: ay};
    if (show.view)
    {
        g.lineWidth = 1 / K;
        g.setLineDash([3 / K, 3 / K]);
        g.strokeStyle = '#888';
        g.strokeRect(vc.x - w / 2, vc.y - hh / 2, w, hh);
        g.setLineDash([]);
    }

    let n = 0;
    parts.forEach((pt, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {p} = pt, {img, f} = fr;
        g.save();
        g.globalAlpha = st?.alpha?.(pt.k) ?? 1;
        g.translate(vc.x, vc.y);
        if (P.flip) g.scale(-1, 1);
        g.translate(p.x ?? 0, p.y ?? 0);
        g.rotate((p.a ?? 0) * Math.PI / 180);
        g.scale(p.scale ?? 1, p.scale ?? 1);
        g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
        g.restore();
        n++;
    });

    // 可拖的 body 支點十字（opt.pivots，有勾顯示的）：滑過／拖著變粗
    if (st?.pivots)
    {
        const body = partFor(pdb, r, 'body'), rig = rigOf(body), pts = Object.fromEntries(PIVOTS.map(k => [k, atPivot(pivotOf(body, k), rig)]));
        g.save();
        g.translate(vc.x, vc.y);
        if (P.flip) g.scale(-1, 1);
        for (const k of PIVOTS) if (show[k]) HD.drawCross(g, k, pts[k], 1 / K, {on: st.live?.k === k});
        g.restore();
        // vc：畫布上的原點換成世界單位（clientX = rc.left + (vc.x + x) * K，同以前畫布從左上角開始畫）
        st.geo = {vc: {x: o.x / K, y: o.y / K}, K, flip: P.flip, pts, rig};
    }

    for (const k of ['g', 'z', 'b'])
    {
        if (!show[k] || !isObj(r[k])) continue;
        const x = axis(r[k].l, r[k].r, w), y = axis(r[k].t, r[k].b, hh);
        g.strokeStyle = COLOR[k];
        g.lineWidth = 2 / K;
        g.strokeRect(vc.x - w / 2 + x.a, vc.y - hh / 2 + y.a, x.size, y.size);
    }

    if (show.anchor)
    {
        g.strokeStyle = '#ffd700';
        g.lineWidth = 2 / K;
        g.beginPath();
        g.moveTo(root.x - 4, root.y); g.lineTo(root.x + 4, root.y);
        g.moveTo(root.x, root.y - 4); g.lineTo(root.x, root.y + 4);
        g.stroke();
    }
    cv.dataset.drawn = n;
}

// opt.pivots＝{set(k, vals), done()}：畫 body 的三個支點十字，拖十字改 x/y、拖白點轉 a（Shift 吸 15°），vals 是 rig 座標（同 body 條目上的支點）；
// 拖的時候一直呼叫 set（呼叫端改記憶體裡的資料），放開呼叫 done（呼叫端寫檔）
const SNAP = 15;
const r1 = (v) => Math.round(v * 10) / 10;
function editable(cv, st, redraw)
{
    const ed = st.pivots;
    const toLocal = (e) => {
        const {x, y} = st.pz.toWorld(e);
        return {x: st.geo.flip ? -x : x, y};
    };
    // {rot: 白點？, k: 支點}；白點優先；沒勾顯示的不能拖
    const hit = (l) => {
        const g = st.geo, near = (p) => Math.hypot(l.x - p.x, l.y - p.y) <= 8 / g.K, keys = PIVOTS.filter(k => show[k]);
        const k = keys.find(k => near(HD.crossHandle(g.pts[k])));
        if (k) return {rot: true, k};
        const m = keys.find(k => near(g.pts[k]));
        return m ? {rot: false, k: m} : null;
    };
    cv.onpointerdown = (e) => {
        if (!st.geo || e.button !== 0) return;
        const l = toLocal(e), h = hit(l);
        if (!h) return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        const o = {...st.geo.pts[h.k]};
        st.drag = {...h, l, o, a0: Math.atan2(l.y - o.y, l.x - o.x)};
    };
    cv.onpointermove = (e) => {
        if (!st.geo || st.pz.panning) return;
        const l = toLocal(e), d = st.drag;
        if (d)
        {
            if (!d.rot)
            {
                const p = fromPivot({x: d.o.x + l.x - d.l.x, y: d.o.y + l.y - d.l.y}, st.geo.rig);
                ed.set(d.k, {x: r1(p.x), y: r1(p.y)});
            }
            else
            {
                const a = d.o.a - st.geo.rig.a + HD.turnDeg(d.o, d.a0, l);
                ed.set(d.k, {a: e.shiftKey ? Math.round(a / SNAP) * SNAP : r1(a)});
            }
            return redraw();
        }
        const h = hit(l);
        cv.style.cursor = !h ? '' : h.rot ? HD.ROT_CURSOR : 'move';
        if (JSON.stringify(h) !== JSON.stringify(st.live)) {st.live = h; redraw();}
    };
    cv.onpointerup = () => {
        if (!st.drag) return;
        st.drag = null;
        ed.done();
    };
    cv.onpointerleave = () => {
        cv.style.cursor = '';
        if (st.drag || !st.live) return;
        st.live = null;
        redraw();
    };
}

// opt.alpha(k)：部位 kind／裝備 cat → 透明度，每次重畫都問（呼叫端改了值叫 redrawAll）；opt.noHide：不放藏頭／頭髮的勾選、全部照畫（部位分頁：人偶只有身體＋那一筆）
// 畫布鋪滿 .cvbox，縮放平移見 panzoom.js（同頁的預覽共用一組 view）
export function previewEl(r, items, parts, opt = {})
{
    const cv = h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）\n滾輪縮放、按住中鍵拖曳平移'});
    const st = {pivots: opt.pivots, alpha: opt.alpha, noHide: opt.noHide, live: null, drag: null, geo: null};
    const redraw = () => draw(cv, r, items, parts, st);
    st.pz = PZ.panzoom(cv, {frame: () => frameOf(r), redraw});
    if (opt.pivots) editable(cv, st, redraw);
    cv.st = st;     // 無頭測試讀幾何
    const check = (k, text, color) => h('label', {style: color && `color:${color}`},
        h('input', {type: 'checkbox', checked: P[k], onchange: e => {P[k] = e.target.checked; redraw();}}), text);
    requestAnimationFrame(redraw);
    const pv = h('div', {class: 'pv'},
        h('div', {class: 'cvbox'}, cv),
        h('div', {class: 'opts'},
            showMenu(() => redrawAll(), opt.pivots ? [] : PIVOTS),
            check('equips', '裝備'), check('flip', '翻面'), !opt.noHide && hideChecks(() => redrawAll()),
            PZ.zoomField(), PZ.centerBtn(),
            h('input', {type: 'color', class: 'bg', title: '背景色', value: P.bg ?? BG[0], oninput: e => setBg(e.target.value), onchange: e => setBg(e.target.value, true)}),
            h('button', {type: 'button', class: 'bgchk', title: '背景改回棋盤格', disabled: !P.bg, onclick: () => setBg(null, true)}, '棋盤格')));
    redraws.set(pv, redraw);
    return pv;
}
