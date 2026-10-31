// 靜態合成預覽：照 RoleView 的規則畫（view 中心 = 錨點 −anchor；部件在 view 中心 +(x,y)、origin (ox??0.5, oy??1)、依 depth 疊）
// 框：物理 b（紅）、佔格 g（綠）、互動區 z（藍），算法同 View._resolveAxis
import {h} from '../common/dom.js';
import {isObj} from '../common/obj.js';
import * as IC from '../common/icons.js';
import * as HD from '../common/handles.js';
import {DEPTH, BACK_DEPTH, NODE, CAT} from './schema.js';
import {equipFor, partFor, hiddenParts, weaponOf, ROLE_PARTS, pivotOf, atPivot} from '../../src/core/equip.js';

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
    const equips = P.equips ? (r.inv?.equips ?? []).map(e => items[isObj(e) ? e.id : e]).filter(it => it?.equip) : [];
    const held = weaponOf(equips, CAT);
    // k＝部位 kind 或裝備 cat、raw＝加回支點前的數字、pv＝支點（部位分頁拖拉用）
    const add = (raw, k) => {
        if (!isObj(raw)) return;
        const pv = pivotOf(body, NODE[k], held), p = atPivot(raw, pv), o = {p, k, raw, pv};
        if (p.sprite) out.push({...o, sprite: p.sprite, d: DEPTH[k] ?? 0, main: true});
        if (p.ext) out.push({...o, sprite: p.ext, d: DEPTH.ext});
        if (p.back) out.push({...o, sprite: p.back, d: BACK_DEPTH[k] ?? DEPTH.back});
    };
    const hide = hiddenParts(equips, CAT);
    for (const k of ROLE_PARTS) if (!hide.has(k)) add(partFor(parts, r, k), k);
    for (const it of equips) add(equipFor(it.equip, r.sex), it.cat);
    return out.sort((a, b) => a.d - b.d);
}

async function draw(cv, r, items, pdb, st)
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
    const its = [];
    parts.forEach((pt, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {p} = pt, {img, f} = fr;
        its.push({...pt, f});
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

    // 可拖的部件（edit.k）：外框＋旋轉把手，滑過／拖著變粗
    if (st?.edit)
    {
        const mine = its.filter(it => it.k === st.edit.k), main = mine.find(it => it.main) ?? mine[0];
        const ph = main && HD.partHandle(main.p, main.f, 10 / K);
        g.save();
        g.translate(vc.x, vc.y);
        if (P.flip) g.scale(-1, 1);
        HD.drawSel(g, mine, ph, 1 / K, {thick: st.live === 'move', rotOn: st.live === 'rot'});
        g.restore();
        st.geo = {vc, K, flip: P.flip, mine, main, ph};
    }

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

// opt.edit＝{k, set(vals), done()}：畫布上 kind／cat 是 k 的部件可以拖（x/y，數字相對支點）、拖白點轉 a（Shift 吸 15°）；
// 拖的時候一直呼叫 set（呼叫端改記憶體裡的資料），放開呼叫 done（呼叫端寫檔）
const SNAP = 15;
const r1 = (v) => Math.round(v * 10) / 10;
function editable(cv, st, redraw)
{
    const ed = st.edit;
    const toLocal = (e) => {
        const g = st.geo, rc = cv.getBoundingClientRect(), x = (e.clientX - rc.left) / g.K - g.vc.x, y = (e.clientY - rc.top) / g.K - g.vc.y;
        return {x: g.flip ? -x : x, y};
    };
    const hit = (l) => {
        const g = st.geo;
        if (!g?.main) return null;
        if (g.ph && Math.hypot(l.x - g.ph.x, l.y - g.ph.y) <= 8 / g.K) return 'rot';
        return g.mine.some(it => HD.inPart(it.p, it.f, l.x, l.y)) ? 'move' : null;
    };
    cv.onpointerdown = (e) => {
        if (!st.geo) return;
        const l = toLocal(e), kind = hit(l);
        if (!kind) return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        const m = st.geo.main, o = {x: m.p.x ?? 0, y: m.p.y ?? 0};
        st.drag = {kind, l, raw: {...m.raw}, pv: m.pv, o, a0: Math.atan2(l.y - o.y, l.x - o.x)};
    };
    cv.onpointermove = (e) => {
        if (!st.geo) return;
        const l = toLocal(e), d = st.drag;
        if (d)
        {
            if (d.kind === 'move')
            {
                const [rx, ry] = HD.unpivot(l.x - d.l.x, l.y - d.l.y, d.pv);
                ed.set({x: r1((d.raw.x ?? 0) + rx), y: r1((d.raw.y ?? 0) + ry)});
            }
            else
            {
                const a = (d.raw.a ?? 0) + HD.turnDeg(d.o, d.a0, l);
                ed.set({a: e.shiftKey ? Math.round(a / SNAP) * SNAP : r1(a)});
            }
            return redraw();
        }
        const kind = hit(l);
        cv.style.cursor = kind === 'rot' ? HD.ROT_CURSOR : kind ? 'move' : '';
        if (kind !== st.live) {st.live = kind; redraw();}
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

export function previewEl(r, items, parts, opt = {})
{
    const cv = h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）'});
    const st = {edit: opt.edit, live: null, drag: null, geo: null};
    const redraw = () => draw(cv, r, items, parts, st);
    if (opt.edit) editable(cv, st, redraw);
    cv.st = st;     // 無頭測試讀幾何
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
