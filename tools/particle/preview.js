// Phaser 預覽：直接跑遊戲的 playParticle（src/core/particle.js）；情境：原地／拖尾（一個點沿弧線飛）／角色身上（照 partsOf 合成）／區域（w×h 格）
// emitZone（綠）／deathZone（紅虛線）畫在發射點上，點選後拖本體／把手改（PV.onZone 寫回）；滾輪縮放、中鍵平移（P.view）
import Phaser from 'phaser';
import {playParticle, BUILTIN} from '../../src/core/particle.js';
import {GM} from '../../src/core/setting.js';
import {h} from '../common/dom.js';
import * as IC from '../common/icons.js';
import {roleCanvas, addRole, imgTexture, stageSize, resizeStage, panelWidth} from '../common/pvstage.js';
import {resizeRight} from '../common/splitter.js';
import * as SC from './schema.js';

const W = 240, H = 180, ZOOM = 2, ZMIN = 0.1, ZMAX = 20;
export const SCENES = [['point', '原地'], ['trail', '拖尾'], ['role', '角色身上'], ['zone', '區域']];
const BGS = [['#1b1c1f', '暗'], ['#3d5a32', '草地'], ['#8a8a8a', '灰'], ['#e8e8e8', '亮']];
const ZCOLOR = {emitZone: 0x44dd66, deathZone: 0xff5555};
const P = {scene: 'point', role: null, auto: true, speed: 1, bg: BGS[0][0], zw: 3, zh: 1, zbox: true, view: null};
try {Object.assign(P, JSON.parse(localStorage.getItem('tools.particle.pv') ?? '{}'));} catch {}
const keep = () => {try {localStorage.setItem('tools.particle.pv', JSON.stringify(P));} catch {}};

const st = {
    el: null, scene: null, ready: null, key: null,
    def: null,              // 目前播的條目（img 換成 Phaser 貼圖 key）
    fx: null,               // 播放中的 ParticleFx
    run: 0,
    role: null, roleKey: null,
    mover: null, moverTw: null,
    grid: null,
    imgs: new Map(),
    ext: null, info: null, roleSel: null,
    zg: null,               // zone 框的 graphics
    zsel: null,             // 選中的 zone（'emitZone'／'deathZone'）
    drag: null,             // {k, z0, shape, part, p0, cur}
    pan: null,
};

const PV = {st, P, play: () => play(), halt: () => halt(), stop: () => stop(), replay: () => replay(), onZone: null};

function createGame()
{
    let done;
    st.ready = new Promise(res => {done = res;});
    const box = h('div', {class: 'stage'});
    box.addEventListener('wheel', onWheel, {passive: false});
    box.addEventListener('mousedown', e => {if (e.button === 1) e.preventDefault();});
    st.game = new Phaser.Game({
        type: Phaser.AUTO, width: W, height: H, zoom: ZOOM, parent: box,
        backgroundColor: P.bg, banner: false, audio: {noAudio: true},
        scene: {create() {
            st.scene = this;
            st.zg = this.add.graphics().setDepth(1e9);
            this.time.addEvent({delay: 200, loop: true, callback: showInfo});
            this.events.on('update', drawZones);
            this.input.on('pointerdown', onDown);
            this.input.on('pointermove', onMove);
            this.input.on('pointerup', onUp);
            this.input.on('pointerupoutside', onUp);
            fit();
            applyView();
            done();
        }},
    });
    return box;
}

// 欄寬（st.pw）→ 畫布尺寸：世界座標不動（發射點還是 W/2,H/2），畫布變大＝看到更多；高度留給下面的控制列
function fit()
{
    if (!st.scene || !st.el || !st.pw) return;
    const view = st.el.isConnected && document.getElementById('view');
    const maxH = view ? view.clientHeight - (st.el.offsetHeight - st.game.scale.height * ZOOM) - 40 : Infinity;
    const [gw, gh] = stageSize(st.el, st.pw, W, H, ZOOM, maxH);
    if (resizeStage(st.game, gw, gh)) applyView();
}

// ---------- 鏡頭：P.view＝{zoom, cx, cy}（畫面中心的世界座標），null＝預設（區域情境自動放得下格子）----------
function defaultView()
{
    if (P.scene !== 'zone') return {zoom: 1, cx: W / 2, cy: H / 2};
    const cam = st.scene.cameras.main;
    return {zoom: Math.min(1, (cam.width - 8) / (P.zw * GM.TILE_W), (cam.height - 8) / (P.zh * GM.TILE_H)), cx: W / 2, cy: H / 2};
}

function applyView()
{
    const v = P.view ?? defaultView(), cam = st.scene?.cameras.main;
    cam?.setZoom(v.zoom).centerOn(v.cx, v.cy);
}

function saveView()
{
    const cam = st.scene.cameras.main;
    P.view = {zoom: cam.zoom, cx: cam.scrollX + cam.width / 2, cy: cam.scrollY + cam.height / 2};
    keep();
}

function resetView()
{
    P.view = null;
    applyView();
    keep();
}

// 以游標為中心縮放（鏡頭繞畫面中心縮：世界＝scroll＋半寬＋(螢幕－半寬)/zoom）
function onWheel(e)
{
    if (!st.scene) return;
    e.preventDefault();
    const cam = st.scene.cameras.main, r = e.currentTarget.querySelector('canvas').getBoundingClientRect();
    const hw = cam.width / 2, hh = cam.height / 2;
    const gx = (e.clientX - r.left) * cam.width / r.width, gy = (e.clientY - r.top) * cam.height / r.height;
    const wx = cam.scrollX + hw + (gx - hw) / cam.zoom, wy = cam.scrollY + hh + (gy - hh) / cam.zoom;
    const z = Math.max(ZMIN, Math.min(ZMAX, cam.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    cam.setZoom(z).setScroll(wx - hw - (gx - hw) / z, wy - hh - (gy - hh) / z);
    saveView();
}

// ---------- zone 框 ----------
function origin()
{
    const d = st.def ?? {};
    const b = P.scene === 'trail' && st.mover ? st.mover : P.scene === 'role' && st.role ? st.role.root : {x: W / 2, y: P.scene === 'role' ? H - 30 : H / 2};
    return {x: b.x + (d.x ?? 0), y: b.y + (d.y ?? 0)};
}

const canDrag = (k) => P.scene === 'point' || P.scene === 'role' || (P.scene === 'zone' && k === 'deathZone');

// 要畫的 zone：區域情境的 emitZone 被技能的格子蓋掉不畫；拖曳中用草稿
function shownZones()
{
    if (!st.def || !P.zbox) return [];
    return ['emitZone', 'deathZone'].filter(k => st.def[k] !== undefined && !(k === 'emitZone' && P.scene === 'zone')).map(k => {
        const z = st.drag?.k === k && st.drag.cur ? st.drag.cur : st.def[k];
        return {k, z, edit: SC.zoneEditable(k, z) && canDrag(k)};
    });
}

function dashLine(g, x1, y1, x2, y2, d)
{
    const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.floor(L / d));
    for (let i = 0; i < n; i += 2) g.lineBetween(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, x1 + (x2 - x1) * Math.min(n, i + 1) / n, y1 + (y2 - y1) * Math.min(n, i + 1) / n);
}

function drawShape(g, shape, s, o, dash)
{
    if (shape === 'circle')
    {
        const cx = o.x + (s.x ?? 0), cy = o.y + (s.y ?? 0);
        if (!dash) return g.strokeCircle(cx, cy, s.r);
        const n = Math.max(12, Math.round(s.r * 2 * Math.PI / dash) & ~1);
        for (let i = 0; i < n; i += 2) g.beginPath().arc(cx, cy, s.r, i / n * Math.PI * 2, (i + 1) / n * Math.PI * 2).strokePath();
        return;
    }
    if (shape === 'line') return dash ? dashLine(g, o.x + s.x1, o.y + s.y1, o.x + s.x2, o.y + s.y2, dash) : g.lineBetween(o.x + s.x1, o.y + s.y1, o.x + s.x2, o.y + s.y2);
    const {x, y, w, h} = SC.rectOf(s), [l, t] = [o.x + x, o.y + y];
    if (!dash) return g.strokeRect(l, t, w, h);
    dashLine(g, l, t, l + w, t, dash); dashLine(g, l + w, t, l + w, t + h, dash);
    dashLine(g, l + w, t + h, l, t + h, dash); dashLine(g, l, t + h, l, t, dash);
}

function drawZones()
{
    const g = st.zg;
    if (!g) return;
    g.clear();
    const zoom = st.scene.cameras.main.zoom, o = origin();
    for (const {k, z, edit} of shownZones())
    {
        g.lineStyle(1 / zoom, ZCOLOR[k], k === st.zsel ? 1 : 0.7);
        for (const one of [z].flat())
        {
            const shape = SC.shapeOf(one?.source);
            if (shape) drawShape(g, shape, one.source, o, k === 'deathZone' ? 3 / zoom : 0);
        }
        if (!edit || k !== st.zsel) continue;
        const hs = 4 / zoom;
        for (const p of SC.handlesOf(SC.shapeOf(z.source), z.source))
        {
            g.fillStyle(0xffffff).fillRect(o.x + p.x - hs / 2, o.y + p.y - hs / 2, hs, hs);
            g.lineStyle(1 / zoom, ZCOLOR[k]).strokeRect(o.x + p.x - hs / 2, o.y + p.y - hs / 2, hs, hs);
        }
    }
}

// 游標底下的東西：選中那個的把手優先，再來是框（疊在一起挑面積小的）
function hitAt(p)
{
    const zoom = st.scene.cameras.main.zoom, o = origin(), lx = p.worldX - o.x, ly = p.worldY - o.y, tol = 4 / zoom;
    const zs = shownZones().filter(z => z.edit);
    const sel = zs.find(z => z.k === st.zsel);
    if (sel)
    {
        const hd = SC.handlesOf(SC.shapeOf(sel.z.source), sel.z.source).find(q => Math.abs(q.x - lx) <= tol && Math.abs(q.y - ly) <= tol);
        if (hd) return {k: sel.k, z: sel.z, part: hd.id, l: {x: lx, y: ly}};
    }
    const hits = zs.filter(({z}) => SC.hitZone(SC.shapeOf(z.source), z.source, lx, ly, tol))
        .sort((a, b) => SC.zoneArea(SC.shapeOf(a.z.source), a.z.source) - SC.zoneArea(SC.shapeOf(b.z.source), b.z.source));
    return hits[0] ? {k: hits[0].k, z: hits[0].z, part: 'move', l: {x: lx, y: ly}} : {l: {x: lx, y: ly}};
}

const CURSOR = {move: 'move', r: 'ew-resize', p1: 'crosshair', p2: 'crosshair', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize'};
const setCursor = (c) => {const cv = st.el?.querySelector('canvas'); if (cv) cv.style.cursor = c;};

function onDown(p)
{
    if (p.button === 1) {st.pan = {x: p.x, y: p.y}; setCursor('grabbing'); return;}
    if (p.button !== 0) return;
    const hit = hitAt(p);
    st.zsel = hit.k ?? null;
    st.drag = hit.k ? {k: hit.k, z0: structuredClone(hit.z), shape: SC.shapeOf(hit.z.source), part: hit.part, p0: hit.l, cur: null} : null;
}

function onMove(p)
{
    if (st.pan)
    {
        const cam = st.scene.cameras.main;
        cam.setScroll(cam.scrollX - (p.x - st.pan.x) / cam.zoom, cam.scrollY - (p.y - st.pan.y) / cam.zoom);
        st.pan = {x: p.x, y: p.y};
        return;
    }
    const d = st.drag;
    if (!d) {const hit = hitAt(p); setCursor(hit.part ? CURSOR[hit.part] ?? 'move' : ''); return;}
    const o = origin(), l = {x: p.worldX - o.x, y: p.worldY - o.y};
    d.cur = {...d.z0, source: SC.dragZone(d.shape, d.z0.source, d.part, d.p0, l, p.event?.shiftKey ? 4 : 1)};
}

function onUp()
{
    if (st.pan) {st.pan = null; setCursor(''); saveView(); return;}
    const d = st.drag;
    st.drag = null;
    if (d?.cur && JSON.stringify(d.cur) !== JSON.stringify(d.z0)) PV.onZone?.(d.k, d.cur);
}

function showInfo()
{
    if (st.info) st.info.textContent = st.fx?.emitter ? `粒子 ${st.fx.alive}${st.fx.emitter.emitting ? '' : '（停止發射）'}` : '（沒在播）';
}

async function buildRole()
{
    const {scene} = st, r = st.ext.roles[P.role];
    st.role?.root.destroy();
    st.role = null;
    st.roleKey = P.role;
    if (!r) return;
    const seq = st.buildSeq = (st.buildSeq ?? 0) + 1;
    const cv = await roleCanvas(r, st.ext.items, st.ext.parts);
    if (seq !== st.buildSeq) return;
    const key = `prole-${P.role}-${seq}`;
    scene.textures.addCanvas(key, cv);
    st.role = addRole(scene, r, key, W / 2, H - 30, 4000);
}

function setStage()
{
    const s = st.scene;
    s.cameras.main.setBackgroundColor(P.bg);
    st.role?.root.setVisible(P.scene === 'role');
    st.moverTw?.remove();
    st.mover?.destroy();
    st.mover = st.moverTw = null;
    st.grid?.destroy();
    st.grid = null;
    if (st.roleSel) st.roleSel.disabled = P.scene !== 'role';
    st.el?.querySelectorAll('[data-zone]').forEach(e => {e.disabled = P.scene !== 'zone';});
    if (P.scene === 'trail')
    {
        const m = st.mover = s.add.circle(30, H / 2, 3, 0xffffff).setDepth(10);
        const c = {t: 0};
        st.moverTw = s.tweens.add({targets: c, t: 1, duration: 1400, repeat: -1, repeatDelay: 300, timeScale: P.speed,
            onUpdate: () => {const half = s.cameras.main.width / 2 - 30; m.x = W / 2 - half + 2 * half * c.t; m.y = H / 2 + 20 - 50 * Math.sin(c.t * Math.PI);}});
    }
    if (P.scene === 'zone')
    {
        const g = st.grid = s.add.graphics().setDepth(-1);
        const [tw, th] = [GM.TILE_W, GM.TILE_H], x0 = W / 2 - P.zw * tw / 2, y0 = H / 2 - P.zh * th / 2;
        g.lineStyle(1, 0x666666);
        for (let i = 0; i < P.zw; i++) for (let j = 0; j < P.zh; j++) g.strokeRect(x0 + i * tw, y0 + j * th, tw, th);
    }
    applyView();
}

function opts()
{
    if (P.scene === 'trail') return {target: st.mover};
    if (P.scene === 'role') return st.role ? {target: st.role.root} : {x: W / 2, y: H - 30};
    if (P.scene === 'zone') return {x: W / 2, y: H / 2, area: {w: P.zw * GM.TILE_W, h: P.zh * GM.TILE_H, cells: P.zw * P.zh}};
    return {x: W / 2, y: H / 2};
}

// 立刻清掉
function stop()
{
    st.run++;
    st.fx?.stop(true);
    st.fx = null;
}

function play()
{
    stop();
    if (!st.scene || !st.def) return;
    const run = st.run;
    const fx = st.fx = playParticle(st.scene, st.def, opts());
    if (!fx) return;
    fx.emitter.timeScale = P.speed;
    fx.done.then(() => {
        if (run !== st.run || !P.auto) return;
        st.scene.time.delayedCall(400 / P.speed, () => {if (run === st.run) play();});
    });
}

// 停止發射，剩下的飄完（自動重播也會接著來）
const halt = () => st.fx?.stop();

function replay()
{
    if (!st.scene) return;
    setStage();
    play();
}

function controls(roles)
{
    const pick = (list, cur, f, title) => h('select', {title, onchange: e => {f(e.target.value); keep(); replay();}},
        list.map(([v, n]) => h('option', {value: v, selected: v === cur}, n)));
    st.roleSel = h('select', {title: '角色身上：套在哪個角色', onchange: async e => {P.role = e.target.value; keep(); await buildRole(); replay();}},
        Object.entries(roles).map(([id, r]) => h('option', {value: id, selected: id === P.role}, `${id}　${r.lab ?? ''}`)));
    const zn = (k) => h('input', {type: 'number', class: 'num', min: 1, max: 20, value: P[k], dataset: {zone: k}, title: k === 'zw' ? '區域寬（格）' : '區域高（格）',
        onchange: e => {P[k] = Math.max(1, Math.min(20, Math.round(+e.target.value || 1))); P.view = null; keep(); replay();}});
    st.info = h('span', {class: 'dim info'});
    return [
        h('div', {class: 'opts'},
            pick(SCENES, P.scene, v => {P.scene = v; P.view = null;}, '情境'),
            st.roleSel,
            h('span', {class: 'zn'}, zn('zw'), '×', zn('zh')),
            pick(BGS, P.bg, v => {P.bg = v;}, '底色'),
            h('label', {title: 'emitZone 綠框、deathZone 紅虛線；點框選取，拖本體移動、拖白色把手改大小（Shift 吸 4px）'},
                h('input', {type: 'checkbox', checked: P.zbox, dataset: {zbox: ''}, onchange: e => {P.zbox = e.target.checked; keep();}}), 'zone 框'),
            h('button', {type: 'button', title: '縮放回預設（滾輪縮放、中鍵拖曳平移）', onclick: resetView}, '置中')),
        h('div', {class: 'opts'},
            h('button', {type: 'button', onclick: play, title: '從頭播'}, '播放'),
            h('button', {type: 'button', onclick: halt, title: '停止發射，剩下的飄完（跟遊戲的 stop() 一樣）'}, '停止'),
            h('button', {type: 'button', onclick: () => {P.auto = false; syncAuto(); stop();}, title: '立刻清掉（stop(true)）'}, '清除'),
            h('label', null, h('input', {type: 'checkbox', checked: P.auto, dataset: {auto: ''}, onchange: e => {P.auto = e.target.checked; keep(); if (P.auto && !st.fx) play();}}), '自動重播'),
            pick([1, 0.5, 0.25].map(s => [String(s), `${s}×`]), String(P.speed), v => {P.speed = +v;}, '速度'),
            st.info),
    ];
}

const syncAuto = () => {const a = st.el?.querySelector('input[data-auto]'); if (a) a.checked = P.auto;};

// 圖：內建形狀跟 emoji 交給 particle.js；textures 的圖切成單張貼圖（key:frame 也一樣）
async function texOf(img)
{
    if (!img || BUILTIN.includes(img)) return img;
    return IC.resolve(img).url ? imgTexture(st.scene, img, st.imgs, 'pimg') : img;
}

// 每次重繪呼叫；預覽元素只建一次（畫布不重建），條目變了才重播
export function previewEl(id, def, ext)
{
    st.ext = ext;
    if (!P.role || !ext.roles[P.role]) P.role = Object.keys(ext.roles).find(k => ext.roles[k].kind === 'player') ?? Object.keys(ext.roles)[0] ?? null;
    if (!st.el)
    {
        st.el = h('div', {class: 'pv'}, createGame(), ...controls(ext.roles));
        resizeRight(st.el, panelWidth(W, ZOOM), w => {st.pw = w; fit();});
    }
    requestAnimationFrame(fit);
    const key = JSON.stringify([id, def]);
    if (key !== st.key)
    {
        st.key = key;
        st.ready.then(async () => {
            if (st.roleKey !== P.role) await buildRole();
            const img = def && await texOf(def.img);
            if (key !== st.key) return;
            st.def = def && {...structuredClone(def), img};
            replay();
        });
    }
    return st.el;
}

export {PV};
