// Phaser 預覽：直接跑遊戲的 FxCell／attachCell／bodyTween（src/core/fxcell.js），角色照角色編輯器的合成規則（partsOf）畫成一張貼圖當 view.shape
// root(角色位置) → view(在 -anchor) → shape(view 中心)，跟 RoleView 一樣，cell.align／body 的支點才會跟遊戲一致
import Phaser from 'phaser';
import BBCodeTextPlugin from 'phaser3-rex-plugins/plugins/bbcodetext-plugin.js';
import {attachCell, bodyTween} from '../../src/core/fxcell.js';
import {h} from '../common/dom.js';
import * as IC from '../common/icons.js';
import {partsOf} from '../role/preview.js';

const W = 160, H = 140, ZOOM = 2, ROLE_CV = 160;
const P = {role: null, auto: true, speed: 1};
try {P.role = localStorage.getItem('tools.fx.role');} catch {}

const st = {
    el: null, scene: null, ready: null,
    root: null, view: null, base: null,
    fx: null, key: null, roleKey: null, run: 0,
    cur: null,              // 常駐中的 {cell, body}
    flashes: new Set(),     // flash 型、正在播的 cell
    imgs: new Map(),        // fx.img → 載進 Phaser 的貼圖 key（emoji 不用）
    ext: null,
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms / P.speed));

function createGame()
{
    let done;
    st.ready = new Promise(res => {done = res;});
    const box = h('div', {class: 'stage'});
    new Phaser.Game({
        type: Phaser.CANVAS, width: W, height: H, zoom: ZOOM, pixelArt: true, parent: box,
        backgroundColor: '#1b1c1f', banner: false, audio: {noAudio: true},
        plugins: {global: [{key: 'rexBBCodeTextPlugin', plugin: BBCodeTextPlugin, start: true}]},
        scene: {create() {st.scene = this; done();}},
    });
    return box;
}

async function roleCanvas(r, items)
{
    const parts = partsOf(r, items);
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

async function buildRole()
{
    const {scene} = st, r = st.ext.roles[P.role];
    stop();
    st.root?.destroy();
    st.root = null;
    if (!r) return;
    const key = `role-${P.role}-${Date.now()}`;
    scene.textures.addCanvas(key, await roleCanvas(r, st.ext.items));
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const root = scene.add.container(W / 2, H - 24);
    const view = scene.add.container(-ax, -ay);
    const shape = scene.add.image(0, 0, key);
    view.add(shape);
    root.add(view);
    const g = scene.add.graphics();
    g.lineStyle(1, 0x444444).lineBetween(-W / 2, 0, W / 2, 0);
    g.lineStyle(1, 0x555555).strokeRect(-ax - w / 2, -ay - hh / 2, w, hh);
    root.addAt(g, 0);
    Object.assign(view, {shape, max: {x: w / 2, y: hh / 2}, Min: {x: -ax - w / 2, y: -ay - hh / 2}, Max: {x: -ax + w / 2, y: -ay + hh / 2}});
    root.view = view;
    Object.assign(st, {root, view, base: {x: shape.x, y: shape.y}, roleKey: P.role});
}

// 圖（不是 emoji）切成一張貼圖給 Pic 用；同一個值只切一次
async function imgKey(img)
{
    const r = IC.resolve(img);
    if (!r.url) return img;
    if (st.imgs.has(img)) return st.imgs.get(img);
    const fr = await IC.frameOf(img);
    if (!fr) return img;
    const cv = document.createElement('canvas');
    cv.width = fr.f.w; cv.height = fr.f.h;
    cv.getContext('2d').drawImage(fr.img, fr.f.x, fr.f.y, fr.f.w, fr.f.h, 0, 0, fr.f.w, fr.f.h);
    const key = `fximg-${st.imgs.size}`;
    st.scene.textures.addCanvas(key, cv);
    st.imgs.set(img, key);
    return key;
}

// ---------- 播放（跟 com_disp 的 _fxOn／_fxTick／_fxOff／_fxFlash 一樣） ----------
const isFlash = () => !!st.fx?.cell?.flash;

function flash()
{
    const cell = attachCell(st.scene, st.root, {...st.fx, idle: null});
    st.flashes.add(cell);
    return cell.spawn().then(() => cell.tick()).then(() => cell.end()).then(() => {st.flashes.delete(cell); cell.destroy();});
}

function on()
{
    if (!st.fx || !st.root || st.cur) return;
    if (isFlash()) {flash(); return;}
    const cell = attachCell(st.scene, st.root, st.fx);
    cell.spawn();
    const body = st.fx.body ? bodyTween(st.scene, st.view, cell.holder, st.fx.body) : null;
    st.cur = {cell, body};
}

function tick()
{
    if (st.cur) st.cur.cell.tick();
    else if (isFlash() && st.root) flash();
}

function resetBody(body)
{
    if (!body) return;
    body.tween.stop();
    st.view.shape.setAngle(0).setPosition(st.base.x, st.base.y);
}

function off()
{
    const c = st.cur;
    if (!c) return;
    st.cur = null;
    c.cell.end().then(() => c.cell.destroy());
    resetBody(c.body);
}

// 立刻清掉所有特效，不播 end
function stop()
{
    st.run++;
    if (st.cur) {st.cur.cell.destroy(); resetBody(st.cur.body); st.cur = null;}
    for (const c of st.flashes) c.destroy();
    st.flashes.clear();
}

// 上身 → 每秒 tick 一次共 3 次 → 解除 → 停一下再來（時間跟著速度倍率）
async function loop(run)
{
    while (run === st.run)
    {
        on();
        for (let i = 0; i < 3; i++)
        {
            await sleep(1000);
            if (run !== st.run) return;
            tick();
        }
        await sleep(1000);
        if (run !== st.run) return;
        off();
        await sleep(1000);
    }
}

function replay()
{
    stop();
    if (!st.fx || !st.root) return;
    st.scene.tweens.timeScale = P.speed;
    if (P.auto) loop(st.run);
    else on();
}

const manual = (fn) => () => {if (P.auto) {P.auto = false; syncCtl();} st.run++; fn();};

function syncCtl()
{
    const auto = st.el?.querySelector('input[data-auto]');
    if (auto) auto.checked = P.auto;
}

function controls(roles)
{
    const sel = h('select', {title: '套在哪個角色上', onchange: async e => {
        P.role = e.target.value;
        try {localStorage.setItem('tools.fx.role', P.role);} catch {}
        await buildRole();
        replay();
    }}, Object.entries(roles).map(([id, r]) => h('option', {value: id, selected: id === P.role}, `${id}　${r.lab ?? ''}`)));
    return h('div', {class: 'opts'},
        sel,
        h('span', {class: 'grow'}),
        h('button', {type: 'button', title: 'spawn → idle（閃一下的特效：spawn → tick → end）', onclick: manual(on)}, '上身'),
        h('button', {type: 'button', title: 'tick（DOT/HOT 扣血那一下）', onclick: manual(tick)}, 'tick'),
        h('button', {type: 'button', title: 'end', onclick: manual(off)}, '解除'),
        h('button', {type: 'button', onclick: replay}, '重播'),
        h('label', null, h('input', {type: 'checkbox', checked: P.auto, dataset: {auto: ''}, onchange: e => {P.auto = e.target.checked; replay();}}), '自動循環'),
        h('select', {title: '速度', onchange: e => {P.speed = +e.target.value; replay();}},
            [1, 0.5, 0.25].map(s => h('option', {value: s, selected: s === P.speed}, `${s}×`))));
}

// 每次重繪呼叫；預覽元素只建一次（搬進新的表單裡，Phaser 畫布不重建），fx 或角色變了才重播
export function previewEl(id, fx, ext)
{
    st.ext = ext;
    if (!P.role || !ext.roles[P.role]) P.role = Object.keys(ext.roles).find(k => ext.roles[k].kind === 'monster') ?? Object.keys(ext.roles)[0] ?? null;
    if (!st.el) st.el = h('div', {class: 'pv'}, createGame(), controls(ext.roles));
    const key = JSON.stringify([id, fx]);
    if (key !== st.key)
    {
        st.key = key;
        st.ready.then(async () => {
            if (st.roleKey !== P.role) await buildRole();
            const img = fx && await imgKey(fx.img);
            if (key !== st.key) return;
            st.fx = fx && {...structuredClone(fx), img};
            replay();
        });
    }
    return st.el;
}

export const PV = {st, P, on, tick, off, replay, stop};
