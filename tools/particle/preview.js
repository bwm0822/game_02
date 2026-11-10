// Phaser 預覽：直接跑遊戲的 playParticle（src/core/particle.js）；情境：原地／拖尾（一個點沿弧線飛）／角色身上（照 partsOf 合成）／區域（w×h 格）
import Phaser from 'phaser';
import {playParticle, BUILTIN} from '../../src/core/particle.js';
import {GM} from '../../src/core/setting.js';
import {h} from '../common/dom.js';
import * as IC from '../common/icons.js';
import {roleCanvas, addRole, imgTexture} from '../common/pvstage.js';

const W = 240, H = 180, ZOOM = 2;
export const SCENES = [['point', '原地'], ['trail', '拖尾'], ['role', '角色身上'], ['zone', '區域']];
const BGS = [['#1b1c1f', '暗'], ['#3d5a32', '草地'], ['#8a8a8a', '灰'], ['#e8e8e8', '亮']];
const P = {scene: 'point', role: null, auto: true, speed: 1, bg: BGS[0][0], zw: 3, zh: 1};
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
};

function createGame()
{
    let done;
    st.ready = new Promise(res => {done = res;});
    const box = h('div', {class: 'stage'});
    new Phaser.Game({
        type: Phaser.AUTO, width: W, height: H, zoom: ZOOM, parent: box,
        backgroundColor: P.bg, banner: false, audio: {noAudio: true},
        scene: {create() {st.scene = this; this.time.addEvent({delay: 200, loop: true, callback: showInfo}); done();}},
    });
    return box;
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
    st.role = addRole(scene, r, key, W / 2, H - 30, W);
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
            onUpdate: () => {m.x = 30 + (W - 60) * c.t; m.y = H / 2 + 20 - 50 * Math.sin(c.t * Math.PI);}});
    }
    if (P.scene === 'zone')
    {
        const g = st.grid = s.add.graphics().setDepth(-1);
        const [tw, th] = [GM.TILE_W, GM.TILE_H], x0 = W / 2 - P.zw * tw / 2, y0 = H / 2 - P.zh * th / 2;
        g.lineStyle(1, 0x666666);
        for (let i = 0; i < P.zw; i++) for (let j = 0; j < P.zh; j++) g.strokeRect(x0 + i * tw, y0 + j * th, tw, th);
        const z = Math.min(1, (W - 8) / (P.zw * tw), (H - 8) / (P.zh * th));
        s.cameras.main.setZoom(z).centerOn(W / 2, H / 2);
    }
    else s.cameras.main.setZoom(1).centerOn(W / 2, H / 2);
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
        onchange: e => {P[k] = Math.max(1, Math.min(20, Math.round(+e.target.value || 1))); keep(); replay();}});
    st.info = h('span', {class: 'dim info'});
    return [
        h('div', {class: 'opts'},
            pick(SCENES, P.scene, v => {P.scene = v;}, '情境'),
            st.roleSel,
            h('span', {class: 'zn'}, zn('zw'), '×', zn('zh')),
            pick(BGS, P.bg, v => {P.bg = v;}, '底色')),
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
    if (!st.el) st.el = h('div', {class: 'pv'}, createGame(), ...controls(ext.roles));
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

export const PV = {st, P, play, halt, stop, replay};
