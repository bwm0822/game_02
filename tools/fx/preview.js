// Phaser 預覽：直接跑遊戲的 FxCell／attachCell／bodyTween（src/core/fxcell.js），角色照角色編輯器的合成規則（partsOf）畫成一張貼圖當 view.shape
// root(角色位置) → view(在 -anchor) → shape(view 中心)，跟 RoleView 一樣，cell.align／body 的支點才會跟遊戲一致
// 區域特效（技能 zoneFx 引用的）不放角色，照 ZoneView 排 w×h 格，spawn 先後用 zoneDelays，tick 隨機挑一格（遊戲是角色站的那格）
import Phaser from 'phaser';
import BBCodeTextPlugin from 'phaser3-rex-plugins/plugins/bbcodetext-plugin.js';
import FxCell, {attachCell, bodyTween, zoneDelays, cellPos} from '../../src/core/fxcell.js';
import {playParticle, BUILTIN} from '../../src/core/particle.js';
import {GM} from '../../src/core/setting.js';
import * as IC from '../common/icons.js';
import {h} from '../common/dom.js';
import {roleCanvas, addRole, imgTexture} from '../common/pvstage.js';

const W = 160, H = 140, ZOOM = 2;
const P = {role: null, auto: true, speed: 1};
try {P.role = localStorage.getItem('tools.fx.role');} catch {}

const st = {
    el: null, scene: null, ready: null,
    root: null, view: null, base: null,
    fx: null, key: null, roleKey: null, run: 0,
    zone: null,             // 區域特效的格數 {w, h, by}；null 是效果特效
    zcells: null,           // 區域：生成中的 [{gx, gy, fx}]
    sel: null,              // 角色下拉
    cur: null,              // 常駐中的 {cell, body, part}（沒 img 的 cell 是 null）
    flashes: new Set(),     // flash 型、正在播的 cell
    imgs: new Map(),        // fx.img → 載進 Phaser 的貼圖 key（emoji 不用）
    pdefs: {},              // particle／tickParticle → particle.json 那筆（img 換成貼圖 key）
    zpart: null,            // 區域：整片的粒子
    bursts: new Set(),      // 播出去還沒銷毀的粒子（常駐、區域、tick 都算）
    ext: null,
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms / P.speed));

function createGame()
{
    let done;
    st.ready = new Promise(res => {done = res;});
    const box = h('div', {class: 'stage'});
    // AUTO（WebGL）：粒子的 tint／ADD 跟遊戲一樣
    new Phaser.Game({
        type: Phaser.AUTO, width: W, height: H, zoom: ZOOM, pixelArt: true, parent: box,
        backgroundColor: '#1b1c1f', banner: false, audio: {noAudio: true},
        plugins: {global: [{key: 'rexBBCodeTextPlugin', plugin: BBCodeTextPlugin, start: true}]},
        scene: {create() {st.scene = this; done();}},
    });
    return box;
}

async function buildRole()
{
    const {scene} = st, r = st.ext.roles[P.role];
    stop();
    st.root?.destroy();
    st.root = null;
    if (!r) return;
    // 連續呼叫時（換特效／換角色）只留最後一次，不然 await 期間會各建一份、key 撞名
    const seq = st.buildSeq = (st.buildSeq ?? 0) + 1;
    const cv = await roleCanvas(r, st.ext.items, st.ext.parts);
    if (seq !== st.buildSeq) return;
    const key = `role-${P.role}-${seq}`;
    scene.textures.addCanvas(key, cv);
    Object.assign(st, addRole(scene, r, key, W / 2, H - 24, W), {roleKey: P.role});
}

// 圖（不是 emoji）切成一張貼圖給 Pic 用
const imgKey = (img) => imgTexture(st.scene, img, st.imgs, 'fximg');

// 粒子條目：textures 的圖切成貼圖（內建形狀、emoji 交給 particle.js）
async function particleDef(id)
{
    const def = id && st.ext.particles?.[id];
    if (!def) return null;
    const img = def.img && !BUILTIN.includes(def.img) && IC.resolve(def.img).url ? await imgKey(def.img) : def.img;
    return {...structuredClone(def), img};
}

// ---------- 播放（跟 com_disp 的 _fxOn／_fxTick／_fxOff／_fxFlash、ZoneView 一樣） ----------
const isFlash = () => !!st.fx?.cell?.flash;

// 所有播出去的粒子都記著（解除後還在飄的也算），stop() 才清得掉
function track(p)
{
    if (!p) return p;
    st.bursts.add(p);
    p.done.then(() => st.bursts.delete(p));
    return p;
}

const burst = (def, opts) => track(def && playParticle(st.scene, def, opts));
const onRole = (def) => {const {x, y} = cellPos(st.root, st.fx); return burst(def, {target: st.root, ox: x, oy: y});};

function flash()
{
    const cell = attachCell(st.scene, st.root, {...st.fx, idle: null});
    st.flashes.add(cell);
    return cell.spawn().then(() => cell.tick()).then(() => cell.end()).then(() => {st.flashes.delete(cell); cell.destroy();});
}

function zoneOn()
{
    if (st.zcells) return;
    const {w: cw, h: ch} = st.zone, [tw, th] = [GM.TILE_W, GM.TILE_H];
    const xs = -Math.floor(cw / 2), ys = -Math.floor(ch / 2);
    const {jitter = 0} = st.fx.cell ?? {};
    const cells = [];
    for (let x = xs; x < xs + cw; x++)
        for (let y = ys; y < ys + ch; y++)
        {
            const px = W / 2 + x * tw, py = H / 2 + y * th;
            const fx = st.fx.img ? new FxCell(st.scene, null, st.fx.img, st.fx,
                {x: px + Phaser.Math.FloatBetween(-jitter, jitter), y: py + Phaser.Math.FloatBetween(-jitter, jitter), size: tw}) : null;
            fx?.holder.setDepth(py + 1);
            cells.push({gx: x, gy: y, fx});
        }
    // near：施法者當作站在區域左邊兩格
    const src = {x: W / 2 + (xs - 2) * tw, y: H / 2};
    const {stagger = 0, from = 'center'} = st.fx.spawn ?? {};
    const delays = zoneDelays(cells, stagger, from, c => Phaser.Math.Distance.Between(src.x, src.y, W / 2 + c.gx * tw, H / 2 + c.gy * th));
    const run = st.run;
    Promise.all(cells.map((c, i) => c.fx?.spawn(delays[i]))).then(() => {
        if (run !== st.run || st.zcells !== cells || !st.pdefs.particle) return;
        st.zpart = burst(st.pdefs.particle,
            {x: W / 2 + (2 * xs + cw - 1) / 2 * tw, y: H / 2 + (2 * ys + ch - 1) / 2 * th, area: {w: cw * tw, h: ch * th, cells: cells.length}});
    });
    st.zcells = cells;
}

function zoneOff()
{
    const cells = st.zcells;
    st.zcells = null;
    st.zpart?.stop();
    st.zpart = null;
    Promise.all(cells.map(c => c.fx?.end())).then(() => cells.forEach(c => c.fx?.destroy()));
}

// 區域不放角色，鏡頭縮到整片放得下
function layout()
{
    const cam = st.scene.cameras.main, z = st.zone;
    st.root?.setVisible(!z);
    cam.setZoom(z ? Math.min(1, (W - 8) / (z.w * GM.TILE_W), (H - 8) / (z.h * GM.TILE_H)) : 1).centerOn(W / 2, H / 2);
    if (st.sel) st.sel.disabled = !!z;
}

function on()
{
    if (st.zone) {if (st.fx) zoneOn(); return;}
    if (!st.fx || !st.root || st.cur) return;
    const part = onRole(st.pdefs.particle);
    if (isFlash())
    {
        if (st.fx.img) flash();
        if (part) st.cur = {cell: null, body: null, part};
        return;
    }
    const cell = st.fx.img ? attachCell(st.scene, st.root, st.fx) : null;
    cell?.spawn();
    const body = st.fx.body ? bodyTween(st.scene, st.view, cell?.holder, st.fx.body) : null;
    st.cur = {cell, body, part};
}

function tick()
{
    if (st.zcells)
    {
        const c = Phaser.Utils.Array.GetRandom(st.zcells);
        c.fx?.tick();
        burst(st.pdefs.tickParticle, {x: W / 2 + c.gx * GM.TILE_W, y: H / 2 + c.gy * GM.TILE_H});
        return;
    }
    if (!st.root || !st.fx) return;
    st.cur?.cell?.tick();
    if (isFlash() && st.fx.img) flash();
    const {x, y} = cellPos(st.root, st.fx);
    burst(st.pdefs.tickParticle, {target: st.root, ox: x, oy: y});
}

function resetBody(body)
{
    if (!body) return;
    body.tween.stop();
    st.view.shape.setAngle(0).setPosition(st.base.x, st.base.y);
}

function off()
{
    if (st.zcells) return zoneOff();
    const c = st.cur;
    if (!c) return;
    st.cur = null;
    c.cell?.end().then(() => c.cell.destroy());
    c.part?.stop();
    resetBody(c.body);
}

// 立刻清掉所有特效，不播 end
function stop()
{
    st.run++;
    if (st.cur) {st.cur.cell?.destroy(); st.cur.part?.stop(true); resetBody(st.cur.body); st.cur = null;}
    for (const c of st.flashes) c.destroy();
    st.flashes.clear();
    st.zcells?.forEach(c => c.fx?.destroy());
    st.zcells = null;
    st.zpart?.stop(true);
    st.zpart = null;
    for (const p of st.bursts) p.stop(true);
    st.bursts.clear();
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
    if (!st.scene) return;
    layout();
    if (!st.fx || (!st.zone && !st.root)) return;
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
    const sel = st.sel = h('select', {title: '套在哪個角色上（區域特效不用）', onchange: async e => {
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
// zone：區域特效的格數 {w, h, by}，效果特效給 null
export function previewEl(id, fx, ext, zone = null)
{
    st.ext = ext;
    if (!P.role || !ext.roles[P.role]) P.role = Object.keys(ext.roles).find(k => ext.roles[k].kind === 'monster') ?? Object.keys(ext.roles)[0] ?? null;
    if (!st.el) st.el = h('div', {class: 'pv'}, createGame(), controls(ext.roles), h('div', {class: 'zinfo dim'}));
    st.el.querySelector('.zinfo').textContent = zone ? `區域 ${zone.w}×${zone.h}（照 ${zone.by} 的 zoneW×zoneH）` : '';
    const key = JSON.stringify([id, fx, zone, fx && [ext.particles?.[fx.particle], ext.particles?.[fx.tickParticle]]]);
    if (key !== st.key)
    {
        st.key = key;
        st.ready.then(async () => {
            if (st.roleKey !== P.role) await buildRole();
            const img = fx?.img && await imgKey(fx.img);
            const [particle, tickParticle] = fx ? await Promise.all([particleDef(fx.particle), particleDef(fx.tickParticle)]) : [null, null];
            if (key !== st.key) return;
            st.pdefs = {particle, tickParticle};
            st.fx = fx && {...structuredClone(fx), img};
            st.zone = zone;
            replay();
        });
    }
    return st.el;
}

export const PV = {st, P, on, tick, off, replay, stop};
