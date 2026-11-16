// 場景分頁：iframe 跑遊戲本身（開發版 /?sandbox，src/scenes/Sandbox.js），左欄場景清單＋場景裡的東西、右欄屬性，tools/scenes.json 立刻寫檔＋undo；見 docs/scene-tool.md
// 跟 sandbox 的訊息都帶 sb 欄位：→ load {scene}／grid {on}／home／select {key}／hide {keys}
//                               ← ready（剛開好、還沒載場景）／loaded {map}／error {msg}／select {key}／move {key,tx,ty}／ctx {tx,ty,key,cx,cy}／key {key,ctrl,shift,alt}
import '../common/splitter.js';
import {$, h, status, ask} from '../common/dom.js';
import * as SH from '../common/shell.js';
import * as FS from '../common/fs.js';
import * as IC from '../common/icons.js';
import {KINDS, KIND_NAMES} from '../role/schema.js';
import * as ST from './store.js';

const LS = {sel: 'tools.scene.sel', grid: 'tools.scene.grid', role: 'tools.scene.lastRole', particle: 'tools.scene.lastParticle',
            anchor: 'tools.scene.anchor', sizeLock: 'tools.scene.sizeLock', exportMode: 'tools.scene.exportMode', exportDir: 'tools.scene.exportDir'};
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};
const SLOTS = [['CAT_WEAPON', '武器'], ['CAT_HELMET', '頭盔'], ['CAT_CHESTPLATE', '護甲'], ['CAT_GLOVES', '手套'], ['CAT_BOOTS', '靴子']];
// 這些檔改了 sandbox 的 DB 就舊了：整個重開
const GAME_FILES = ['role.json', 'item.json', 'part.json', 'anim.json', 'fx.json', 'particle.json', 'ability.json', 'local.json', 'textures.json'];

const S = {
    root: null,
    data: {},
    sel: ls.get(LS.sel) || null,    // 場景名
    pick: null,                     // 場景裡選中的角色 key
    hidden: new Set(),              // 👁 暫藏（只在這次開著時）
    undo: [],
    redo: [],
    ready: false,                   // sandbox 開好了
    grid: ls.get(LS.grid) !== '0',
    anchor: ls.get(LS.anchor) !== '0',
    refs: {roles: {}, items: {}, abilities: {}, fx: {}, particles: {}},
    act: 'attack',                  // 動作下拉：attack／walk／ab:<技能 id>
    arm: null,                      // 指定目標中 {key, kind, id}
    maps: ['sandbox'],              // 底圖下拉
    playing: false,                 // ▶ 時間在走
    liveTime: null,                 // 拖滑桿／播放中的時間（還沒寫檔）
    q: Promise.resolve(),
};

const frame = $('game');
const toGame = (msg) => S.ready && frame.contentWindow?.postMessage(msg, '*');
const scene = () => S.data[S.sel];
const roles = () => scene()?.roles ?? [];
const roleOf = (key) => roles().find(r => r.key === key);

// 寫檔一個接一個，不會兩次讀到同一份
const queue = (fn) => (S.q = S.q.then(fn).catch(e => status(e.message)));

// ---------- 編輯（立刻寫檔＋undo） ----------
function commit(fn, sel, pick)
{
    return queue(async () => {
        const r = await ST.edit(fn);
        if (!r) return;
        S.undo.push({before: r.before, after: r.after, sel: [S.sel, sel === undefined ? S.sel : sel], pick: [S.pick, pick === undefined ? S.pick : pick]});
        S.redo = [];
        S.data = r.data;
        if (sel !== undefined) select(sel, false);
        if (pick !== undefined) S.pick = pick;
        refresh();
    });
}

// 改目前場景：fn(場景)；場景被別處刪了就擋
const editScene = (fn, pick) => {
    const name = S.sel;
    if (name === null) {status('先選或新增一個場景'); return Promise.resolve();}
    return commit(d => {
        if (!(name in d)) throw new Error(`找不到場景「${name}」`);
        return fn(d[name]);
    }, undefined, pick);
};

const step = (from, to, i) => queue(async () => {
    const u = from.pop();
    if (!u) return;
    try {S.data = await ST.restore(i === 0 ? u.after : u.before, i === 0 ? u.before : u.after);}
    catch (e) {from.push(u); throw e;}
    to.push(u);
    select(u.sel[i] in S.data ? u.sel[i] : null, false);
    S.pick = u.pick[i];
    refresh();
});
const undo = () => step(S.undo, S.redo, 0);
const redo = () => step(S.redo, S.undo, 1);

// ---------- 場景清單 ----------
const uniq = (base) => {let n = base; for (let i = 2; n in S.data; i++) n = `${base}${i}`; return n;};

function nameError(name, from)
{
    if (!name) return '名稱不能空白';
    if (name !== from && name in S.data) return `已經有「${name}」`;
}

async function askName(title, value)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, h('label', null, '名稱 ', inp), [['ok', '確定'], ['cancel', '取消']]);
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

async function addScene(name)
{
    name ??= await askName('新場景', uniq('場景'));
    if (name === null) return;
    const err = nameError(name);
    if (err) return status(err);
    await commit(d => {d[name] = ST.newScene();}, name, null);
}

async function dupScene(from, name)
{
    name ??= await askName(`複製 ${from}`, uniq(`${from}-複製`));
    if (name === null) return;
    const err = nameError(name);
    if (err) return status(err);
    await commit(d => {
        if (!(from in d)) throw new Error(`找不到「${from}」`);
        d[name] = structuredClone(d[from]);
    }, name, null);
}

async function renameScene(from, to)
{
    to ??= await askName(`改名 ${from}`, from);
    if (to === null || to === from) return;
    const err = nameError(to, from);
    if (err) return status(err);
    await commit(d => {
        if (!(from in d)) throw new Error(`找不到「${from}」`);
        ST.renameKey(d, from, to);
    }, S.sel === from ? to : S.sel);
}

async function deleteScene(name, sure)
{
    if (!sure && await ask('刪除場景', `「${name}」會從 scenes.json 拿掉（可以復原）`, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    await commit(d => {delete d[name];}, S.sel === name ? null : S.sel, S.sel === name ? null : S.pick);
}

function select(name, sync = true)
{
    if (name !== S.sel) {S.pick = null; S.hidden.clear();}
    S.sel = name;
    ls.set(LS.sel, name ?? '');
    if (sync) refresh();
}

// ---------- 角色 ----------
const roleKey = () => {let i = 1; while (roleOf(`r${i}`)) i++; return `r${i}`;};
const roleLab = (id) => S.refs.roles[id]?.lab ?? '';

function addRole(id, tx, ty)
{
    if (!S.refs.roles[id]) {status(`role.json 沒有 ${id}`); return Promise.resolve();}
    ls.set(LS.role, id);
    const key = roleKey();
    return editScene(sc => {(sc.roles ??= []).push({key, id, tx, ty});}, key);
}

// patch 的值 undefined＝拿掉那個欄位
function setRole(key, patch)
{
    return editScene(sc => {
        const r = sc.roles?.find(x => x.key === key);
        if (!r) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete r[k]; else r[k] = v;}
    });
}

function setEquip(key, cat, v)
{
    return editScene(sc => {
        const r = sc.roles?.find(x => x.key === key);
        if (!r) throw new Error(`場景裡沒有 ${key}`);
        const eq = {...r.equip};
        if (v === undefined) delete eq[cat]; else eq[cat] = v;
        if (Object.keys(eq).length) r.equip = eq; else delete r.equip;
    });
}

const deleteRole = (key) => deleteObj(key);

// ---------- 擺設 ----------
const props = () => scene()?.props ?? [];
const propOf = (key) => props().find(p => p.key === key);
const propKey = () => {let i = 1; while (propOf(`p${i}`)) i++; return `p${i}`;};
const isProp = (key) => /^p\d+$/.test(key ?? '');
const FILE = 'file:';
const LIGHT = {r: 120, color: '#ffcc88', i: 1, y: -16};

function addProp(img, x, y)
{
    const key = propKey();
    return editScene(sc => {(sc.props ??= []).push({key, img, x, y});}, key);
}

// patch 的值 undefined＝拿掉那個欄位
function setProp(key, patch)
{
    return editScene(sc => {
        const p = sc.props?.find(x => x.key === key);
        if (!p) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete p[k]; else p[k] = v;}
    });
}

// ---------- 粒子發射點 ----------
const emitters = () => scene()?.particles ?? [];
const emOf = (key) => emitters().find(e => e.key === key);
const isEm = (key) => /^e\d+$/.test(key ?? '');
const emKey = () => {let i = 1; while (emOf(`e${i}`)) i++; return `e${i}`;};
const listOf = (key) => (isProp(key) ? 'props' : isEm(key) ? 'particles' : 'roles');

function addEmitter(id, x, y)
{
    const key = emKey();
    return editScene(sc => {(sc.particles ??= []).push({key, id, x, y});}, key);
}

function setEmitter(key, patch)
{
    return editScene(sc => {
        const e = sc.particles?.find(x => x.key === key);
        if (!e) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete e[k]; else e[k] = v;}
    });
}

async function askId(title, ids, cur)
{
    const sel = h('select', {size: 14, style: 'width: 100%'}, ids.map(id => h('option', {value: id}, id)));
    sel.value = cur ?? ids[0] ?? '';
    sel.ondblclick = () => $('dlgAsk').close('ok');
    const p = ask(title, sel, [['ok', '確定'], ['cancel', '取消']]);
    sel.focus();
    return await p === 'ok' && sel.value ? sel.value : null;
}

async function placeEmitter(x, y)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const id = await askId('放粒子（particle.json）', Object.keys(S.refs.particles), ls.get(LS.particle));
    if (!id) return;
    ls.set(LS.particle, id);
    await addEmitter(id, x, y);
}

function emPanel(e)
{
    const idSel = h('select', {dataset: {k: 'id'}, onchange: () => setEmitter(e.key, {id: idSel.value})}, Object.keys(S.refs.particles).map(id => h('option', {value: id}, id)));
    if (!S.refs.particles[e.id]) idSel.append(h('option', {value: e.id}, `⚠ ${e.id}`));
    idSel.value = e.id;
    // 換跟隨對象：位置換算成相對／絕對，畫面上不動
    const fol = h('select', {dataset: {k: 'follow'}, onchange: () => {
        const from = roleOf(e.follow), to = roleOf(fol.value);
        const abs = from ? {x: from.tx * 32 + 16 + e.x, y: from.ty * 32 + 16 + e.y} : {x: e.x, y: e.y};
        const rel = to ? {x: abs.x - (to.tx * 32 + 16), y: abs.y - (to.ty * 32 + 16)} : abs;
        setEmitter(e.key, {follow: fol.value || undefined, ...rel});
    }}, h('option', {value: ''}, '（不跟）'), roles().map(r => h('option', {value: r.key}, `${r.key}　${r.id}`)));
    fol.value = e.follow ?? '';
    const n = (k, step, ph) => h('input', {type: 'number', step, value: e[k] ?? '', placeholder: ph, class: 'n', dataset: {k},
        onchange: (ev) => setEmitter(e.key, {[k]: ev.target.value === '' ? undefined : +ev.target.value})});
    const burst = S.refs.particles[e.id]?.mode === 'burst';
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    return [
        h('div', {class: 'sec'}, `粒子 ${e.key}`),
        h('table', {class: 'props'},
            row('粒子', idSel),
            row(e.follow ? '位置（相對角色）' : '位置', n('x', 1), ' ', n('y', 1)),
            row('跟著', fol),
            burst && row('每幾 ms 噴', n('every', 100, '1000'))),
        h('div', {class: 'hint dim'}, '畫面上的橘色菱形＝發射點：拖曳移動、Shift 吸 16px；方向鍵 1px、Shift＋方向鍵一格'),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(e.key)}, '刪除（Del）')),
    ];
}

// 角色身上的狀態特效（fx.json），存在角色的 fx 陣列；tick 是表演
function fxPanel(r)
{
    const ids = Object.keys(S.refs.fx).filter(id => !(r.fx ?? []).includes(id));
    const add = h('select', {dataset: {k: 'fxAdd'}}, h('option', {value: ''}, '＋ 加狀態特效…'), ids.map(id => h('option', {value: id}, id)));
    add.onchange = () => add.value && setRole(r.key, {fx: [...(r.fx ?? []), add.value]});
    return h('div', null,
        h('div', {class: 'sec'}, '狀態特效', h('span', {class: 'dim'}, '（fx.json，常駐、存檔）')),
        ...(r.fx ?? []).map(id => h('div', {class: 'row2', dataset: {fx: id}},
            h('span', {class: S.refs.fx[id] ? '' : 'warn'}, id), h('span', {class: 'grow'}),
            h('button', {title: '播一次 tick（DOT 扣血那下）', onclick: () => toGame({sb: 'fxTick', key: r.key, id})}, 'tick'),
            h('button', {title: '播 end 收掉、從場景拿掉', onclick: () => setRole(r.key, {fx: r.fx.filter(x => x !== id).length ? r.fx.filter(x => x !== id) : undefined})}, '解除'))),
        add);
}

function deleteObj(key)
{
    const list = listOf(key);
    return editScene(sc => {
        const i = sc[list]?.findIndex(x => x.key === key) ?? -1;
        if (i < 0) return false;
        sc[list].splice(i, 1);
        if (!sc[list].length) delete sc[list];
    }, S.pick === key ? null : S.pick);
}

// 外部 png：專案裡的直接記路徑；專案外的先複製到 images/scene/
async function pickFile()
{
    if (!S.root) {status('先在上方選擇專案資料夾'); return null;}
    let fh;
    try {[fh] = await showOpenFilePicker({types: [{description: 'PNG', accept: {'image/png': ['.png']}}]});}
    catch {return null;}
    const path = await S.root.resolve(fh);
    if (path) return FILE + path.join('/');
    const dir = await FS.resolveDir(S.root, 'images/scene').catch(() => null)
        ?? await (await S.root.getDirectoryHandle('images', {create: true})).getDirectoryHandle('scene', {create: true});
    let name = fh.name;
    for (let i = 2; await FS.tryFile(dir, name); i++) name = fh.name.replace(/\.png$/i, `-${i}.png`);
    await FS.writeFile(dir, name, await fh.getFile());
    status(`複製到 images/scene/${name}`);
    return `${FILE}images/scene/${name}`;
}

async function askImg(cur)
{
    const v = await ask('擺設的圖', h('div', {class: 'hint'}, 'textures 的圖（遊戲已經有的）或專案裡任一張 png（還沒放進 textures/ 也行；專案外的會複製到 images/scene/）'),
        [['tex', 'textures 圖…'], ['file', '外部 png…'], ['cancel', '取消']]);
    if (v === 'tex') return IC.pickIcon(cur?.startsWith(FILE) ? '' : cur);
    if (v === 'file') return pickFile();
    return null;
}

async function placeProp(x, y)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const img = await askImg();
    if (img) await addProp(img, x, y);
}

function imgEl(img, size)
{
    if (img?.startsWith(FILE)) return h('img', {src: `/${img.slice(FILE.length).replace(/^public\//, '')}`, style: `max-width:${size}px; max-height:${size}px`});
    return IC.iconEl(img, size);
}

// ---------- 擺設大小：畫面＝原圖 × pct%（只有 file: 圖）× sx／sy；pct 是「存檔…」烤圖用、sx/sy 是擺放，兩個不互相換算 ----------
const isFile = (img) => !!img?.startsWith(FILE);
const fileUrl = (img) => `/${img.slice(FILE.length).replace(/^public\//, '')}`;
const pctOf = (p) => (isFile(p.img) ? (p.pct ?? 100) / 100 : 1);
const r4 = (v) => Math.round(v * 10000) / 10000;
const one = (v) => (v === 1 ? undefined : v);
const sizes = {};       // img → {w, h}｜null（載不到）
const freeRatio = new Set();    // sx===sy 卻要分開改的擺設（只在這次開著時）
const sizeLock = () => (ls.get(LS.sizeLock) === 'scale' ? 'scale' : 'pct');

const loadImg = (url) => new Promise(res => {const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url;});

function srcSize(img)
{
    if (img in sizes) return sizes[img];
    sizes[img] = undefined;
    (isFile(img) ? loadImg(fileUrl(img)).then(i => i && {w: i.naturalWidth, h: i.naturalHeight}) : IC.frameOf(img).then(r => r && {w: r.f.w, h: r.f.h}))
        .then(s => {sizes[img] = s ?? null; if (propOf(S.pick)?.img === img) renderRight();});
    return undefined;
}

function sizeRows(p, row)
{
    const sx = p.sx ?? 1, sy = p.sy ?? 1, k = pctOf(p), src = srcSize(p.img);
    const linked = sx === sy && !freeRatio.has(p.key);
    const inp = (v, step, k2, onchange, ph) => h('input', {type: 'number', step, value: v ?? '', placeholder: ph, class: 'n', dataset: {k: k2}, onchange: (e) => {
        const n = +e.target.value;
        if (e.target.value === '' || !(n > 0)) return renderRight();
        onchange(n);
    }});
    const setS = (a, b) => setProp(p.key, {sx: one(r4(a)), sy: one(r4(b))});
    const setPct = (v) => setProp(p.key, {pct: r4(v) === 100 ? undefined : r4(v)});
    const byPct = () => sizeLock() === 'scale' && isFile(p.img);
    const setW = (w) => {
        if (byPct()) return setPct(w / (src.w * sx) * 100);
        const v = w / (src.w * k);
        return linked ? setS(v, v) : setS(v, sy);
    };
    const setH = (hh) => {
        if (byPct()) return setPct(hh / (src.h * sy) * 100);
        const v = hh / (src.h * k);
        return linked ? setS(v, v) : setS(sx, v);
    };
    const ratio = h('label', {title: '勾著＝sx 跟 sy 一樣，只有一格'}, h('input', {type: 'checkbox', checked: linked, dataset: {k: 'ratio'}, onchange: (e) => {
        if (e.target.checked) {freeRatio.delete(p.key); if (sx !== sy) return setS(sx, sx);}
        else freeRatio.add(p.key);
        toGame(selMsg());
        renderRight();
    }}), ' 等比');
    const lock = isFile(p.img) && h('select', {title: '改寬高（面板或畫面上拉）時誰吃下變化', dataset: {k: 'lock'}, onchange: (e) => {ls.set(LS.sizeLock, e.target.value); toGame(selMsg()); renderRight();}},
        h('option', {value: 'pct'}, '%'), h('option', {value: 'scale'}, 'scale'));
    if (lock) lock.value = sizeLock();
    const dim = (k2, t) => h('span', {class: 'dim', dataset: {k: k2}}, t);
    const wh = (a, b) => `${Math.max(1, Math.round(a))}×${Math.max(1, Math.round(b))}`;
    return [
        isFile(p.img) && row('%', h('span', {title: '存檔時烤成原圖的幾 %'}, inp(p.pct, 1, 'pct', setPct, '100')), ' ', src && dim('srcDim', `原圖 ${src.w}×${src.h}`)),
        row('scale', linked ? inp(p.sx, 0.05, 'sx', (n) => setS(n, n), '1') : [inp(p.sx, 0.05, 'sx', (n) => setS(n, sy), '1'), ' × ', inp(p.sy, 0.05, 'sy', (n) => setS(sx, n), '1')], ' ', ratio, ' ',
            src && (isFile(p.img) ? dim('bakedDim', `縮放後 ${wh(src.w * k, src.h * k)}`) : dim('srcDim', `原圖 ${src.w}×${src.h}`))),
        row('寬高', src ? [inp(Math.round(src.w * k * sx), 1, 'w', setW), ' × ', inp(Math.round(src.h * k * sy), 1, 'h', setH), ' px', lock && [' 鎖 ', lock]] : h('span', {class: 'dim'}, src === null ? '讀不到圖的大小' : '…')),
    ];
}

// 把 file: 圖縮成 pct% 另存一份 PNG（場景不動）；path＝相對專案的資料夾；回傳 {path, w, h} 或丟錯
async function bakeProp(key, path, name)
{
    const p = propOf(key);
    if (!p || !isFile(p.img)) throw new Error('只有外部 png 的擺設能存檔');
    name = name.trim().replace(/\.png$/i, '');
    if (!name) throw new Error('檔名不能空白');
    if (/[\\/:*?"<>|]/.test(name)) throw new Error(`檔名不能有 \\ / : * ? " < > |`);
    const dir = await FS.resolveDir(S.root, path);
    if (await FS.tryFile(dir, `${name}.png`)) throw new Error(`${path}/${name}.png 已經有了，換個檔名`);
    const inTex = path === TEX || path.startsWith(`${TEX}/`);
    if (inTex)
    {
        const hit = await findTexKey(await FS.resolveDir(S.root, TEX), name);
        if (hit) throw new Error(`textures/${hit}.png 已經有了（texture key 不能撞名），換個檔名`);
    }
    const img = await loadImg(fileUrl(p.img));
    if (!img) throw new Error(`讀不到 ${p.img.slice(FILE.length)}`);
    const k = (p.pct ?? 100) / 100, w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = Object.assign(document.createElement('canvas'), {width: w, height: hh});
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, hh);
    await FS.writeFile(dir, `${name}.png`, await new Promise(res => cv.toBlob(res, 'image/png')));
    if (inTex) await updateTextures();
    return {path: `${path}/${name}.png`, w, h: hh};
}

const TEX = 'public/assets/textures';
const TEX_SKIP = ['.tbd', 'minimap'];

// textures/ 底下有沒有同名的 key（大小寫不分）；回傳相對 textures/ 的路徑（不含 .png）
async function findTexKey(dir, name, pre = '')
{
    const {dirs, files} = await FS.listDir(dir);
    const f = files.find(x => x.name.toLowerCase() === `${name.toLowerCase()}.png`);
    if (f) return pre + f.name.slice(0, -4);
    for (const d of dirs)
    {
        if (!pre && TEX_SKIP.includes(d.name)) continue;
        const r = await findTexKey(d, name, `${pre}${d.name}/`);
        if (r) return r;
    }
    return null;
}

async function updateTextures()
{
    try
    {
        const r = await (await fetch('/__tools/textures', {method: 'POST'})).json();
        if (r.ok) SH.notifySaved('textures.json');
        else status(`圖片清單沒更新：${r.errors.join('；')}`);
    }
    catch (e) {status(`圖片清單沒更新：${e.message}`);}
}

// 資料夾樹（懶載入）：root＝相對專案的根，cur＝預設選的資料夾；回傳 {el, get()}
function folderTree(root, cur, onPick)
{
    const skip = (rel, n) => n.startsWith('.') || n === 'node_modules' || (rel === TEX && TEX_SKIP.includes(n));
    let sel = null;
    const node = (path, label, depth) => {
        const kids = h('div', {hidden: true});
        const tw = h('span', {class: 'tw'}, '▸');
        const line = h('div', {class: 'fold', dataset: {path}, style: `padding-left:${depth * 14}px`}, tw, h('span', null, `📁 ${label}`));
        let loaded = false;
        const open = async (on) => {
            if (on && !loaded)
            {
                loaded = true;
                const {dirs} = await FS.listDir(await FS.resolveDir(S.root, path));
                kids.replaceChildren(...dirs.filter(d => !skip(path, d.name)).map(d => node(`${path ? `${path}/` : ''}${d.name}`, d.name, depth + 1)));
            }
            kids.hidden = !on;
            tw.textContent = on ? '▾' : '▸';
        };
        line.onclick = (e) => {
            if (e.target === tw) return open(kids.hidden);
            sel?.classList.remove('sel');
            (sel = line).classList.add('sel');
            onPick(path);
        };
        line.open = open;
        return h('div', null, line, kids);
    };
    const top = node(root, root || S.root.name, 0);
    const el = h('div', {class: 'folders'}, top);
    // 一路展開到 cur、選起來
    (async () => {
        let n = top;
        const segs = cur.slice(root.length).split('/').filter(Boolean);
        for (let i = 0; ; i++)
        {
            const line = n.firstChild;
            await line.open(true);
            const next = i < segs.length && [...n.lastChild.children].find(c => c.firstChild.dataset.path.split('/').pop() === segs[i]);
            if (!next) {line.click(); line.scrollIntoView({block: 'nearest'}); return;}
            n = next;
        }
    })().catch(() => {});
    return {el};
}

async function exportProp(p)
{
    if (!S.root) return status('先在上方選擇專案資料夾');
    const src = p.img.slice(FILE.length), home = src.split('/').slice(0, -1).join('/');
    const base = src.split('/').pop().replace(/\.png$/i, '');
    let mode = ls.get(LS.exportMode) === 'home' ? 'home' : 'tex', path = '';
    const box = h('div', {class: 'treebox'}), shown = h('div', {class: 'dim', style: 'word-break: break-all'});
    const name = h('input', {size: 28, value: `${base}-copy`});
    const build = () => {
        const cur = mode === 'tex' ? (ls.get(LS.exportDir)?.startsWith(TEX) ? ls.get(LS.exportDir) : TEX) : home;
        path = cur;
        shown.textContent = path;
        box.replaceChildren(folderTree(mode === 'tex' ? TEX : '', cur, (v) => {path = v; shown.textContent = v;}).el);
    };
    const radio = (v, t) => h('label', null, h('input', {type: 'radio', name: 'exMode', value: v, checked: mode === v, onchange: () => {mode = v; ls.set(LS.exportMode, v); build();}}), t);
    build();
    const k = (p.pct ?? 100) / 100, img = await loadImg(fileUrl(p.img));
    if (!img) return status(`讀不到 ${src}`);
    const p0 = ask(`存檔：烤成 ${p.pct ?? 100}%（${Math.max(1, Math.round(img.naturalWidth * k))}×${Math.max(1, Math.round(img.naturalHeight * k))}）`, [
        h('div', {class: 'row2'}, radio('tex', '存到 textures'), ' ', radio('home', '存到原始路徑')),
        box, shown,
        h('label', null, '檔名 ', name, '.png'),
        h('div', {class: 'hint dim'}, '場景不會改（擺設還是用原圖）；存進 textures/ 會自動更新圖片清單'),
    ], [['ok', '存檔'], ['cancel', '取消']]);
    name.select();
    if (await p0 !== 'ok') return;
    if (mode === 'tex') ls.set(LS.exportDir, path);
    try
    {
        const r = await bakeProp(p.key, path, name.value);
        status(`已存 ${r.path}（${r.w}×${r.h}）`);
    }
    catch (e) {status(e.message);}
}

function propPanel(p)
{
    const put = (k, conv = Number) => (e) => {
        const v = e.target.type === 'checkbox' ? e.target.checked || undefined : e.target.value === '' ? undefined : conv(e.target.value);
        return setProp(p.key, {[k]: v});
    };
    const n = (k, step, ph) => h('input', {type: 'number', step, value: p[k] ?? '', placeholder: ph, class: 'n', dataset: {k}, onchange: put(k)});
    const l = p.light;
    const putL = (k, conv = Number) => (e) => setProp(p.key, {light: {...l, [k]: e.target.value === '' ? undefined : conv(e.target.value)}});
    const ln = (k, step, ph) => h('input', {type: 'number', step, value: l?.[k] ?? '', placeholder: ph, class: 'n', dataset: {k: `light.${k}`}, onchange: putL(k)});
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    return [
        h('div', {class: 'sec'}, `擺設 ${p.key}`),
        h('div', {class: 'row2'}, imgEl(p.img, 64), h('span', {class: 'dim', style: 'word-break: break-all'}, p.img),
            h('button', {onclick: async () => {const v = await askImg(p.img); if (v) setProp(p.key, {img: v, pct: isFile(v) ? p.pct : undefined});}}, '換圖…'),
            isFile(p.img) && h('button', {title: '把原圖縮成 % 另存一份 PNG（場景不動）', onclick: () => exportProp(p)}, '存檔…')),
        h('table', {class: 'props'},
            row('位置', n('x', 1), ' ', n('y', 1)),
            ...sizeRows(p, row),
            row('翻轉', h('input', {type: 'checkbox', checked: !!p.flip, dataset: {k: 'flip'}, onchange: put('flip')})),
            row('角度', n('angle', 1, '0')),
            row('錨點', n('ox', 0.05, '0.5'), ' ', n('oy', 0.05, '1')),
            row('深度', n('depth', 1, '0'), h('span', {class: 'dim'}, ' 加在 y 上')),
            row('發光', h('input', {type: 'checkbox', checked: !!l, dataset: {k: 'light'}, onchange: (e) => setProp(p.key, {light: e.target.checked ? {...LIGHT} : undefined})})),
            l && row('半徑／強度', ln('r', 10, '100'), ' ', ln('i', 0.1, '1')),
            l && row('顏色', h('input', {type: 'color', value: l.color ?? '#ffcc88', dataset: {k: 'light.color'}, onchange: putL('color', String)})),
            l && row('光的位移', ln('x', 1, '0'), ' ', ln('y', 1, '0'))),
        h('div', {class: 'hint dim'}, '拖曳移動、按住 Shift 錨點吸 16px；方向鍵 1px、Shift＋方向鍵一格'),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(p.key)}, '刪除（Del）')),
    ];
}

function nudge(dx, dy)
{
    const p = propOf(S.pick), e = emOf(S.pick);
    if (p) setProp(p.key, {x: p.x + dx, y: p.y + dy});
    else if (e) setEmitter(e.key, {x: e.x + dx, y: e.y + dy});
}

// 選取＋畫面上拉擺設大小要的面板狀態（鎖、等比）
function selMsg()
{
    const p = propOf(S.pick);
    return {sb: 'select', key: S.pick, lock: sizeLock(), ratio: !p || ((p.sx ?? 1) === (p.sy ?? 1) && !freeRatio.has(p.key))};
}

function pickRole(key)
{
    if (S.arm && S.arm.key !== key) {S.arm = null; toGame({sb: 'arm', act: null});}
    S.pick = key;
    toGame(selMsg());
    renderTree();
    renderRight();
}

function toggleHide(key)
{
    if (S.hidden.has(key)) S.hidden.delete(key); else S.hidden.add(key);
    toGame({sb: 'hide', keys: [...S.hidden]});
    renderTree();
}

// role.json 照 kind → grp 分組的下拉
function roleSelect(value, size)
{
    const sel = h('select', {size});
    const groups = {};
    for (const [id, r] of Object.entries(S.refs.roles))
    {
        const g = `${KIND_NAMES[r.kind] ?? r.kind ?? '其他'}${r.grp ? `／${r.grp}` : ''}`;
        (groups[g] ??= {kind: KINDS.indexOf(r.kind), ids: []}).ids.push(id);
    }
    for (const [g, {ids}] of Object.entries(groups).sort((a, b) => (a[1].kind < 0 ? 99 : a[1].kind) - (b[1].kind < 0 ? 99 : b[1].kind)))
        sel.append(h('optgroup', {label: g}, ids.map(id => h('option', {value: id}, `${id}　${roleLab(id)}`))));
    sel.value = value ?? '';
    return sel;
}

async function askRole(title)
{
    const sel = roleSelect(ls.get(LS.role) ?? Object.keys(S.refs.roles)[0], 14);
    const q = h('input', {placeholder: '搜尋 id／名字', oninput: () => {
        const s = q.value.trim().toLowerCase();
        for (const o of sel.options) o.hidden = !!s && !`${o.value} ${o.textContent}`.toLowerCase().includes(s);
    }});
    sel.ondblclick = () => $('dlgAsk').close('ok');
    const p = ask(title, [q, h('div', null, sel)], [['ok', '放置'], ['cancel', '取消']]);
    sel.style.width = '100%';
    q.focus();
    return await p === 'ok' && sel.value ? sel.value : null;
}

async function placeAt(tx, ty)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const id = await askRole(`放角色（${tx}, ${ty}）`);
    if (id) await addRole(id, tx, ty);
}

// ---------- 畫面 ----------
function menu(e, items)
{
    e.preventDefault?.();
    document.querySelector('.ctxmenu')?.remove();
    const m = h('div', {class: 'ctxmenu'}, items.map(([t, fn]) => h('button', {onclick: () => {m.remove(); fn();}}, t)));
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
    m.style.top = `${Math.min(e.clientY, innerHeight - r.height - 4)}px`;
}
addEventListener('pointerdown', (e) => {if (!e.target.closest('.ctxmenu')) document.querySelector('.ctxmenu')?.remove();});

function renderList()
{
    $('list').replaceChildren(...Object.keys(S.data).map(name => h('div', {
        class: `item${name === S.sel ? ' sel' : ''}`, dataset: {name},
        onclick: () => select(name === S.sel ? null : name),
        ondblclick: () => renameScene(name),
        oncontextmenu: (e) => menu(e, [['改名…', () => renameScene(name)], ['複製…', () => dupScene(name)], ['刪除', () => deleteScene(name)]]),
    }, h('span', {class: 'id'}, name), h('span', {class: 'lab'}, S.data[name].map ?? ''))));
    if (!Object.keys(S.data).length) $('list').append(h('div', {class: 'dim'}, S.root ? '還沒有場景，按 ＋ 新增' : '先在上方選擇專案資料夾'));
}

function renderTree()
{
    const box = $('tree');
    box.hidden = S.sel === null;
    if (box.hidden) return box.replaceChildren();
    box.replaceChildren(
        h('div', {class: 'row2'}, h('span', {class: 'sec grow'}, `角色（${roles().length}）`),
            h('button', {title: '放角色（放在地圖中間；也可以在畫面上右鍵）', onclick: () => placeAt(...S.center)}, '＋')),
        ...roles().map(r => h('div', {
            class: `item${r.key === S.pick ? ' sel' : ''}${S.hidden.has(r.key) ? ' hid' : ''}`, dataset: {key: r.key},
            onclick: () => pickRole(r.key === S.pick ? null : r.key),
            oncontextmenu: (e) => menu(e, [['刪除', () => deleteRole(r.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(r.key);}}, S.hidden.has(r.key) ? '◌' : '👁'),
           h('span', {class: 'id'}, r.id), h('span', {class: 'lab'}, roleLab(r.id)), h('span', {class: 'mark dim'}, `${r.tx},${r.ty}`))),
        h('div', {class: 'row2'}, h('span', {class: 'sec grow'}, `擺設（${props().length}）`),
            h('button', {title: '放擺設（放在地圖中間；也可以在畫面上右鍵）', onclick: () => placeProp(S.center[0] * 32 + 16, S.center[1] * 32 + 32)}, '＋')),
        ...props().map(p => h('div', {
            class: `item${p.key === S.pick ? ' sel' : ''}${S.hidden.has(p.key) ? ' hid' : ''}`, dataset: {key: p.key},
            onclick: () => pickRole(p.key === S.pick ? null : p.key),
            oncontextmenu: (e) => menu(e, [['刪除', () => deleteObj(p.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(p.key);}}, S.hidden.has(p.key) ? '◌' : '👁'),
           imgEl(p.img, 20), h('span', {class: 'id'}, p.img.startsWith(FILE) ? p.img.split('/').pop() : p.img), h('span', {class: 'mark dim'}, `${p.x},${p.y}`))),
        h('div', {class: 'row2'}, h('span', {class: 'sec grow'}, `粒子（${emitters().length}）`),
            h('button', {title: '放粒子發射點（放在地圖中間；也可以在畫面上右鍵）', onclick: () => placeEmitter(S.center[0] * 32 + 16, S.center[1] * 32 + 16)}, '＋')),
        ...emitters().map(e => h('div', {
            class: `item${e.key === S.pick ? ' sel' : ''}${S.hidden.has(e.key) ? ' hid' : ''}`, dataset: {key: e.key},
            onclick: () => pickRole(e.key === S.pick ? null : e.key),
            oncontextmenu: (ev) => menu(ev, [['刪除', () => deleteObj(e.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(e.key);}}, S.hidden.has(e.key) ? '◌' : '👁'),
           h('span', {class: S.refs.particles[e.id] ? 'id' : 'id warn'}, e.id), e.follow && h('span', {class: 'lab'}, `→ ${roleOf(e.follow)?.id ?? e.follow}`), h('span', {class: 'mark dim'}, `${e.x},${e.y}`))),
    );
}

const num = (value, onchange) => h('input', {type: 'number', step: 1, value, class: 'n', onchange});

function equipSelect(r, cat)
{
    const meta = S.refs.roles[r.id] ?? {}, sex = meta.sex ?? 'm';
    const orig = (meta.inv?.equips ?? []).map(e => e?.id ?? e).find(id => S.refs.items[id]?.cat === cat);
    const ids = Object.entries(S.refs.items).filter(([, it]) => it.cat === cat && it.equip && (!it.sex || it.sex === sex)).map(([id]) => id);
    const v = r.equip && cat in r.equip ? r.equip[cat] : '__orig';
    const sel = h('select', {dataset: {cat}, onchange: () => setEquip(r.key, cat, sel.value === '__orig' ? undefined : sel.value)},
        h('option', {value: '__orig'}, `（原本：${orig ?? '空'}）`), h('option', {value: ''}, '（空）'),
        ids.map(id => h('option', {value: id}, id)));
    if (v && !ids.includes(v)) sel.append(h('option', {value: v}, `⚠ ${v}`));
    sel.value = v;
    return sel;
}

function renderRight()
{
    const r = roleOf(S.pick), box = $('right');
    if (propOf(S.pick)) return box.replaceChildren(...propPanel(propOf(S.pick)));
    if (emOf(S.pick)) return box.replaceChildren(...emPanel(emOf(S.pick)));
    if (!r) return box.replaceChildren(h('span', {class: 'dim'}, S.sel === null ? '' : '點畫面上的角色、或左邊清單選一個；右鍵畫面放角色'));
    const idSel = roleSelect(r.id);
    idSel.onchange = () => setRole(r.key, {id: idSel.value});
    const face = h('select', {onchange: () => setRole(r.key, {face: face.value || undefined})},
        h('option', {value: ''}, '（預設）'), h('option', {value: 'l'}, '左'), h('option', {value: 'r'}, '右'));
    face.value = r.face ?? '';
    box.replaceChildren(
        h('div', {class: 'sec'}, `角色 ${r.key}`, S.refs.roles[r.id] ? null : h('span', {class: 'warn'}, `　role.json 沒有 ${r.id}`)),
        h('table', {class: 'props'},
            h('tr', null, h('td', {class: 'k'}, '角色'), h('td', null, idSel)),
            h('tr', null, h('td', {class: 'k'}, '格子'), h('td', null,
                num(r.tx, (e) => setRole(r.key, {tx: +e.target.value})), ' ', num(r.ty, (e) => setRole(r.key, {ty: +e.target.value})))),
            h('tr', null, h('td', {class: 'k'}, '面向'), h('td', null, face))),
        h('div', {class: 'sec'}, '裝備', h('span', {class: 'dim'}, '（只改這個場景，不寫回 role.json）')),
        h('table', {class: 'props'}, SLOTS.map(([cat, name]) => h('tr', null, h('td', {class: 'k'}, name), h('td', null, equipSelect(r, cat))))),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteRole(r.key)}, '刪除（Del）')),
        fxPanel(r),
        actPanel(r),
    );
}

// ---------- 動作（表演：不寫檔、不進 undo；「重置」回到場景檔的樣子） ----------
const actOf = (v, key) => v === 'attack' || v === 'walk' ? {key, kind: v} : {key, kind: 'ability', id: v.slice(3)};

function arm(on)
{
    S.arm = on ? actOf(S.act, S.pick) : null;
    toGame({sb: 'arm', act: S.arm});
    renderRight();
}

function actPanel(r)
{
    const sel = h('select', {dataset: {k: 'act'}, onchange: () => {S.act = sel.value; if (S.arm) arm(true);}},
        h('option', {value: 'attack'}, '普攻（照武器）'), h('option', {value: 'walk'}, '走路'),
        h('optgroup', {label: '技能（不管學沒學、忽略 MP／冷卻／射程）'}, Object.keys(S.refs.abilities).map(id => h('option', {value: `ab:${id}`}, id))));
    sel.value = S.act;
    const armed = S.arm?.key === r.key;
    const send = (sb) => () => toGame({sb, key: r.key});
    return h('div', null,
        h('div', {class: 'sec'}, '動作', h('span', {class: 'dim'}, '（表演，不存檔；工具列「重置」回原樣）')),
        h('div', {class: 'row2'}, sel, h('button', {class: armed ? 'on' : '', dataset: {k: 'arm'}, title: '按下後點畫面上的角色或格子當目標（右鍵／Esc 取消）', onclick: () => arm(!armed)}, armed ? '🎯 取消' : '🎯 指定目標')),
        armed && h('div', {class: 'hint'}, '點畫面上的角色或格子；右鍵／Esc 取消；空白鍵重播上一個動作'),
        h('div', {class: 'row2 acts'}, h('button', {onclick: send('hit')}, '被打'), h('button', {onclick: send('die')}, '倒地'), h('button', {onclick: send('revive')}, '復活')),
    );
}

function refresh()
{
    if (S.sel !== null && !(S.sel in S.data)) select(null, false);
    if (S.pick && !roleOf(S.pick) && !propOf(S.pick) && !emOf(S.pick)) S.pick = null;
    renderList();
    renderTree();
    renderRight();
    $('sceneName').textContent = S.sel ?? '（沒選場景：空白 sandbox）';
    $('btnUndo').disabled = !S.undo.length;
    $('btnRedo').disabled = !S.redo.length;
    renderBar();
    syncGame();
}

const cur = () => scene() ?? ST.newScene();

// ---------- 底圖、日夜 ----------
const DEFAULT_TIME = '08:00';
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const mins = (t) => {const [h, m] = t.split(':').map(Number); return h * 60 + m;};

// 場景最上層的欄位：v undefined＝拿掉
const setField = (k, v) => editScene(sc => {if (v === undefined) delete sc[k]; else sc[k] = v;});

function renderBar()
{
    const sc = scene(), off = !sc;
    const sel = $('selMap');
    const map = cur().map;
    sel.replaceChildren(...S.maps.map(m => h('option', {value: m}, m)));
    if (!S.maps.includes(map)) sel.append(h('option', {value: map}, `⚠ ${map}`));
    sel.value = map;
    sel.disabled = off;
    const t = S.liveTime ?? sc?.time ?? DEFAULT_TIME;
    $('rngTime').value = mins(t);
    $('lblTime').textContent = t;
    $('btnPlay').textContent = S.playing ? '⏸' : '▶';
    $('chkAmb').checked = !!sc?.ambient;
    if (sc?.ambient) $('clrAmb').value = sc.ambient;
    for (const id of ['rngTime', 'btnPlay', 'chkAmb', 'clrAmb']) $(id).disabled = off;
}

const playMsg = () => ({sb: 'play', speed: S.playing ? +$('selSpeed').value : 0});

async function setPlaying(on)
{
    if (on === S.playing) return;
    S.playing = on;
    toGame(playMsg());
    if (!on && S.liveTime) {const t = S.liveTime; S.liveTime = null; await setField('time', t === DEFAULT_TIME ? undefined : t);}
    renderBar();
}

// 底圖清單：maps/ 底下所有 .json（相對 maps/、不含 .json）
async function scanMaps(assets)
{
    const out = [];
    const walk = async (dir, pre) => {
        const {dirs, files} = await FS.listDir(dir);
        for (const f of files) if (f.name.endsWith('.json')) out.push(pre + f.name.slice(0, -5));
        for (const d of dirs) await walk(d, `${pre}${d.name}/`);
    };
    const dir = assets && await FS.tryDir(assets, 'maps');
    if (dir) await walk(dir, '');
    return out.sort((a, b) => (a === 'sandbox' ? -1 : b === 'sandbox' ? 1 : a.localeCompare(b)));
}

function syncGame()
{
    toGame({sb: 'grid', on: S.grid});
    toGame({sb: 'anchor', on: S.anchor});
    toGame(playMsg());
    toGame(selMsg());
    toGame({sb: 'hide', keys: [...S.hidden]});
    toGame({sb: 'load', scene: cur()});
}

// ---------- sandbox ----------
function onKey(k)
{
    if (k.ctrl && k.key.toLowerCase() === 'z' && !k.shift) undo();
    else if (k.ctrl && (k.key.toLowerCase() === 'y' || (k.key.toLowerCase() === 'z' && k.shift))) redo();
    else if (k.key === 'Delete' && S.pick) deleteObj(S.pick);
    else if (k.key.startsWith('Arrow') && (propOf(S.pick) || emOf(S.pick)))
    {
        const d = k.shift ? 32 : 1;
        nudge({ArrowLeft: -d, ArrowRight: d}[k.key] ?? 0, {ArrowUp: -d, ArrowDown: d}[k.key] ?? 0);
    }
    else if (k.key === ' ') toGame({sb: 'replay'});
    else if (k.key === 'Escape' && S.arm) arm(false);
    else return false;
    return true;
}

addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow || !e.data?.sb) return;
    const m = e.data;
    if (m.sb === 'ready') {S.ready = true; syncGame();}
    else if (m.sb === 'loaded') S.center = [Math.floor(m.w / 2), Math.floor(m.h / 2)];
    else if (m.sb === 'error') status(m.msg);
    else if (m.sb === 'select') pickRole(m.key);
    else if (m.sb === 'disarm') {S.arm = null; renderRight();}
    else if (m.sb === 'time' && S.playing) {S.liveTime = m.t; renderBar();}
    else if (m.sb === 'move') setRole(m.key, {tx: m.tx, ty: m.ty}).then(syncGame);
    else if (m.sb === 'moveProp') setProp(m.key, {x: m.x, y: m.y}).then(syncGame);
    else if (m.sb === 'resizeProp')
    {
        const {x, y, sx, sy, pct} = m.patch;
        setProp(m.key, {x, y, ...('pct' in m.patch ? {pct: pct === 100 ? undefined : pct} : {sx: one(sx), sy: one(sy)})}).then(syncGame);
    }
    else if (m.sb === 'moveEmitter') setEmitter(m.key, {x: m.x, y: m.y}).then(syncGame);
    else if (m.sb === 'key') onKey(m);
    else if (m.sb === 'ctx')
    {
        const b = frame.getBoundingClientRect(), at = {clientX: b.left + m.cx, clientY: b.top + m.cy};
        const items = [[`在這裡放角色…（${m.tx}, ${m.ty}）`, () => placeAt(m.tx, m.ty)], ['在這裡放擺設…', () => placeProp(m.wx, m.wy)], ['在這裡放粒子…', () => placeEmitter(m.wx, m.wy)]];
        if (m.key) items.push([`刪除 ${roleOf(m.key)?.id ?? m.key}`, () => deleteObj(m.key)]);
        if (S.sel === null) return status('先選或新增一個場景');
        menu(at, items);
    }
});

function reloadGame()
{
    S.ready = false;
    frame.src = '/?sandbox=1';
}

// ---------- 事件 ----------
$('btnNew').onclick = () => addScene();
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('chkGrid').checked = S.grid;
$('chkGrid').onchange = () => {S.grid = $('chkGrid').checked; ls.set(LS.grid, S.grid ? '1' : '0'); toGame({sb: 'grid', on: S.grid});};
$('chkAnchor').checked = S.anchor;
$('chkAnchor').onchange = () => {S.anchor = $('chkAnchor').checked; ls.set(LS.anchor, S.anchor ? '1' : '0'); toGame({sb: 'anchor', on: S.anchor});};
$('btnHome').onclick = () => toGame({sb: 'home'});
$('btnReload').onclick = reloadGame;
$('btnReset').onclick = () => toGame({sb: 'reset'});
$('selMap').onchange = () => setField('map', $('selMap').value);
$('rngTime').oninput = () => {
    S.liveTime = hhmm(+$('rngTime').value);
    $('lblTime').textContent = S.liveTime;
    toGame({sb: 'time', t: S.liveTime});
};
$('rngTime').onchange = async () => {
    const t = hhmm(+$('rngTime').value);
    if (S.playing) {S.liveTime = t; return;}
    S.liveTime = null;
    await setField('time', t === DEFAULT_TIME ? undefined : t);
};
$('btnPlay').onclick = () => setPlaying(!S.playing);
$('selSpeed').onchange = () => toGame(playMsg());
$('chkAmb').onchange = () => setField('ambient', $('chkAmb').checked ? $('clrAmb').value : undefined);
$('clrAmb').oninput = () => $('chkAmb').checked && toGame({sb: 'ambient', color: $('clrAmb').value});
$('clrAmb').onchange = () => $('chkAmb').checked && setField('ambient', $('clrAmb').value);
addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, dialog')) return;
    if (onKey({key: e.key, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey})) e.preventDefault();
});

async function loadRefs()
{
    const json = await FS.tryDir(await FS.tryDir(await FS.tryDir(S.root, 'public'), 'assets'), 'json');
    const read = async (name) => {const fh = json && await FS.tryFile(json, name); return fh ? JSON.parse(await (await fh.getFile()).text()) : {};};
    S.refs = {roles: await read('role.json'), items: await read('item.json'), abilities: await read('ability.json'),
              fx: await read('fx.json'), particles: await read('particle.json')};
    S.maps = await scanMaps(await FS.tryDir(await FS.tryDir(S.root, 'public'), 'assets'));
}

async function setProject(root)
{
    S.root = root;
    S.undo = [];
    S.redo = [];
    try {await loadRefs();}
    catch (e) {status(`role.json／item.json 讀不了：${e.message}`);}
    try {S.data = await ST.load(root);}
    catch (e) {S.data = {}; status(`${ST.FILE} 讀不了：${e.message}`);}
    refresh();
}
SH.onProject(setProject);
SH.onSaved((file) => {
    if (!S.root) return;
    if (file === ST.FILE) queue(async () => {S.data = await ST.read(); refresh();});
    else if (GAME_FILES.includes(file))
    {
        if (['role.json', 'item.json', 'ability.json', 'fx.json', 'particle.json'].includes(file)) queue(async () => {await loadRefs(); refresh();});
        reloadGame();
    }
});
S.center = [12, 8];
frame.src = '/?sandbox=1';
refresh();

// 給無頭測試用
window.__sc = {S, setProject, addScene, dupScene, renameScene, deleteScene, select, undo, redo, addRole, setRole, setEquip, deleteRole, pickRole, toggleHide, arm, toGame, addProp, setProp, deleteObj, nudge, bakeProp, srcSize, addEmitter, setEmitter, setField, setPlaying,
               flush: () => S.q};
