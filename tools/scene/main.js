// 場景分頁：iframe 跑遊戲本身（開發版 /?sandbox，src/scenes/Sandbox.js），左欄場景清單＋場景裡的東西、右欄屬性，tools/scenes.json 立刻寫檔＋undo；見 docs/scene-tool.md
// 跟 sandbox 的訊息都帶 sb 欄位：→ load {scene}／grid {on}／home／select {key}／hide {keys}／icons {light,particle}
//                               ← ready（剛開好、還沒載場景）／loaded {map}／error {msg}／select {key}／move {key,tx,ty}／ctx {tx,ty,key,cx,cy}／key {key,ctrl,shift,alt}
import '../common/splitter.js';
import '../common/combo.js';
import {$, h, status, ask} from '../common/dom.js';
import * as SH from '../common/shell.js';
import * as FS from '../common/fs.js';
import * as IC from '../common/icons.js';
import * as H from '../common/hist.js';
import {str, setAt} from '../common/obj.js';
import {createForm} from '../common/form.js';
import {renderDatalists} from '../common/views.js';
import {KINDS, KIND_NAMES} from '../role/schema.js';
import {createPForm, easeNames} from '../particle/pform.js';
import * as ST from './store.js';
import * as TL from './tiled.js';

const LS = {sel: 'tools.scene.sel', grid: 'tools.scene.grid', role: 'tools.scene.lastRole', particle: 'tools.scene.lastParticle', prefab: 'tools.scene.lastPrefab', fold: 'tools.scene.fold',
            anchor: 'tools.scene.anchor', lightIcon: 'tools.scene.lightIcon', particleIcon: 'tools.scene.particleIcon', sizeLock: 'tools.scene.sizeLock', exportMode: 'tools.scene.exportMode', exportDir: 'tools.scene.exportDir'};
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
    prefabs: {},                    // prefab.json（docs/prefab.md）
    sel: ls.get(LS.sel) || null,    // 場景名
    pick: null,                     // 場景裡選中的角色 key
    hidden: new Set(),              // 👁 暫藏（只在這次開著時）
    undo: [],
    redo: [],
    ready: false,                   // sandbox 開好了
    grid: ls.get(LS.grid) !== '0',
    anchor: ls.get(LS.anchor) !== '0',
    lightIcon: ls.get(LS.lightIcon) !== '0',
    particleIcon: ls.get(LS.particleIcon) !== '0',
    refs: {roles: {}, items: {}, abilities: {}, fx: {}, particles: {}, local: {}},
    edit: null,                     // 編輯 prefab 中 {id, key, look}
    act: 'attack',                  // 動作下拉：attack／walk／ab:<技能 id>
    arm: null,                      // 指定目標中 {key, kind, id}
    maps: ['sandbox'],              // 底圖下拉
    playing: false,                 // ▶ 時間在走
    liveTime: null,                 // 拖滑桿／播放中的時間（還沒寫檔）
    q: Promise.resolve(),
};

const frame = $('game');
const toGame = (msg) => S.ready && frame.contentWindow?.postMessage(msg, '*');
const realScene = () => S.data[S.sel];
// 編輯 prefab 時＝那筆 prefab 攤開成的假場景（零件＝擺設／發射點／光源，見 editView），其他時候＝目前場景
const scene = () => (S.edit ? editView() : realScene());
const roles = () => scene()?.roles ?? [];
const roleOf = (key) => roles().find(r => r.key === key);

// 寫檔一個接一個，不會兩次讀到同一份
const queue = (fn) => (S.q = S.q.then(fn).catch(e => status(e.message)));

// ---------- 編輯（立刻寫檔＋undo） ----------
// files：要一起改的檔（預設只有 scenes.json；有 prefab.json 時 fn(scenes, prefabs)），多檔一筆 undo
function commit(fn, sel, pick, files)
{
    return queue(async () => {
        const r = await ST.edit(fn, files);
        if (!r) return;
        // 數值欄連按 ↑↓ 併成一步（hist.js）：只有同一個檔、接得上才併
        const last = S.undo.at(-1), one = (u) => Object.keys(u).length === 1 && Object.keys(u)[0];
        const f = one(r.files);
        if (H.take() && last && f && one(last.files) === f && last.files[f].after === r.files[f].before) last.files[f].after = r.files[f].after;
        else S.undo.push({files: r.files, sel: [S.sel, sel === undefined ? S.sel : sel], pick: [S.pick, pick === undefined ? S.pick : pick]});
        S.redo = [];
        gotData(r.data);
        if (sel !== undefined) select(sel, false);
        if (pick !== undefined) S.pick = pick;
        refresh();
    });
}

function gotData(data)
{
    if (data[ST.FILE]) S.data = data[ST.FILE];
    if (data[ST.PREFAB]) S.prefabs = data[ST.PREFAB];
    // particle.json 是組成 prefab 時寫的：sandbox 的 DB 舊了，整個重開
    if (data[ST.PARTICLE]) {S.refs.particles = data[ST.PARTICLE]; reloadGame();}
}

// 改目前場景：fn(場景)；場景被別處刪了就擋；編輯 prefab 時改的是零件（editParts）
const editScene = (fn, pick) => (S.edit ? editParts(fn, pick) : editRealScene(fn, pick));
const editRealScene = (fn, pick) => {
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
    try {gotData(await ST.restore(u.files, i === 0));}
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
    if (name !== S.sel) {S.pick = null; S.hidden.clear(); S.edit = null;}
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
const listOf = (key) => (isProp(key) ? 'props' : isEm(key) ? 'particles' : isLight(key) ? 'lights' : isInst(key) ? 'prefabs' : 'roles');

// ---------- prefab（docs/prefab.md）：prefab 庫＝prefab.json 全部；場景裡的實例 {key, prefab, x, y（錨點）, look?} ----------
const insts = () => scene()?.prefabs ?? [];
const instOf = (key) => insts().find(o => o.key === key);
const isInst = (key) => /^f\d+$/.test(key ?? '');
const instKey = (sc = realScene()) => {let i = 1; while ((sc?.prefabs ?? []).some(o => o.key === `f${i}`)) i++; return `f${i}`;};
const PREFAB_FILES = [ST.FILE, ST.PREFAB];
// 狀態清單：預設 look＋零件的 look＋acts 切到的
const looksOf = (pf) => [...new Set([pf?.look, ...(pf?.parts ?? []).map(p => p.look), ...Object.values(pf?.acts ?? {})].filter(Boolean))];
const pfIcon = (id, size) => {
    const img = S.prefabs[id]?.parts?.find(p => p.img)?.img;
    return img ? imgEl(img, size) : h('span', {class: 'dim', style: `display:inline-block; width:${size}px; text-align:center`}, '◇');
};

function addInst(prefab, x, y)
{
    if (S.sel === null) {status('先選或新增一個場景'); return Promise.resolve();}
    if (!S.prefabs[prefab]) {status(`prefab.json 沒有 ${prefab}`); return Promise.resolve();}
    if (S.edit) {status('編輯 prefab 中，先按上方「離開」'); return Promise.resolve();}
    ls.set(LS.prefab, prefab);
    const key = instKey();
    return editRealScene(sc => {(sc.prefabs ??= []).push({key, prefab, x, y});}, key);
}

function setInst(key, patch)
{
    return editRealScene(sc => {
        const o = sc.prefabs?.find(x => x.key === key);
        if (!o) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete o[k]; else o[k] = v;}
    });
}

async function placeInst(x, y)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const ids = Object.keys(S.prefabs);
    if (!ids.length) return status('prefab 庫是空的，先按 prefab 庫的 ＋ 新增');
    const id = await askId('放 prefab（prefab.json）', ids, ls.get(LS.prefab));
    if (id) await addInst(id, x, y);
}

const PREFAB_ID = /^[A-Za-z0-9_-]+$/;
function prefabIdError(id)
{
    if (!id) return 'id 不能空白';
    if (!PREFAB_ID.test(id)) return 'id 只能用英數字、_、-';
    if (id in S.prefabs) return `已經有 prefab「${id}」`;
}

// 新增空白 prefab；有選場景就在畫面中間放一個實例、選起來
async function newPrefab(id)
{
    if (!S.root) return status('先在上方選擇專案資料夾');
    if (S.edit) return status('編輯 prefab 中，先按上方「離開」');
    if (id === undefined)
    {
        let n = 'prefab';
        for (let i = 2; n in S.prefabs; i++) n = `prefab${i}`;
        id = await askName('新 prefab（id：英數字、_、-）', n);
    }
    if (id === null) return;
    const err = prefabIdError(id);
    if (err) return status(err);
    const name = S.sel, key = name !== null ? instKey() : null;
    const [x, y] = [S.center[0] * 32 + 16, S.center[1] * 32 + 32];
    await commit((scenes, pf) => {
        if (id in pf) throw new Error(`已經有 prefab「${id}」`);
        pf[id] = {};
        if (key && name in scenes) (scenes[name].prefabs ??= []).push({key, prefab: id, x, y});
    }, undefined, key ?? undefined, PREFAB_FILES);
    ls.set(LS.prefab, id);
    if (key && instOf(key)) enterEdit(key);
}

// 用到這個 prefab 的實例：[[場景名, 個數]]
const prefabUses = (id) => Object.entries(S.data).map(([n, sc]) => [n, (sc.prefabs ?? []).filter(o => o.prefab === id).length]).filter(([, c]) => c);

async function deletePrefab(id, sure)
{
    const used = TL.usedBy(await TL.prefabRefs(S.root, id), id);
    if (used.length) return status(`prefab ${id} 還有地圖在用，不能刪：${used.join('；')}`);
    const uses = prefabUses(id);
    const msg = uses.length ? `會從 prefab.json 拿掉，場景裡的實例一起刪：${uses.map(([n, c]) => `${n}（${c}）`).join('、')}（可以復原）` : '會從 prefab.json 拿掉（可以復原）';
    if (!sure && await ask(`刪除 prefab ${id}`, msg, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    await commit((scenes, pf) => {
        delete pf[id];
        for (const sc of Object.values(scenes))
        {
            if (!sc.prefabs) continue;
            sc.prefabs = sc.prefabs.filter(o => o.prefab !== id);
            if (!sc.prefabs.length) delete sc.prefabs;
        }
    }, undefined, instOf(S.pick)?.prefab === id ? null : S.pick, PREFAB_FILES);
    if (S.prefabs[id]) return;
    try {await TL.dropPrefab(S.root, id); await updateTextures();}
    catch (e) {status(`Tiled 的縮圖／template 沒刪完：${e.message}`);}
}

// ---------- 編輯 prefab（S.edit＝{id, key（實例）, look（狀態篩選，null＝全部）}） ----------
// 零件攤開成假場景：png＝擺設 p<n>、粒子＝發射點 e<n>、光源 l<n>，座標＝實例錨點＋零件 x/y；篩掉的標 _off（key 照全部零件排，不會撞）
const LIGHT_KEYS = ['r', 'color', 'i', 'dir', 'arc', 'soft'];
const KINDS3 = ['props', 'particles', 'lights'];

function toSyn(pf, ax, ay, sc)
{
    const syn = {map: sc?.map ?? 'sandbox', props: [], particles: [], lights: []};
    if (sc?.time) syn.time = sc.time;
    if (sc?.ambient) syn.ambient = sc.ambient;
    const n = {p: 0, e: 0, l: 0};
    for (const p of pf?.parts ?? [])
    {
        const {x = 0, y = 0, img, particle, light, ...rest} = p;
        const at = {x: ax + x, y: ay + y};
        if (img) syn.props.push({key: `p${++n.p}`, img, ...at, ...rest});
        else if (particle) syn.particles.push({key: `e${++n.e}`, id: particle, ...at, ...rest});
        else if (light) syn.lights.push({key: `l${++n.l}`, ...at, ...light, ...rest});
    }
    return syn;
}

function fromSyn(syn, ax, ay)
{
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const rel = (o) => clean({x: o.x - ax || undefined, y: o.y - ay || undefined});
    const out = [];
    for (const {key, _off, x, y, img, ...p} of syn.props ?? []) out.push(clean({img, ...rel({x, y}), ...p}));
    for (const {key, _off, x, y, id, follow, def, every, ...p} of syn.particles ?? []) out.push(clean({particle: id, ...rel({x, y}), ...p}));
    for (const {key, _off, x, y, follow, ...l} of syn.lights ?? [])
    {
        const light = clean(Object.fromEntries(LIGHT_KEYS.map(k => [k, l[k]])));
        out.push(clean({light, ...rel({x, y}), ...Object.fromEntries(Object.entries(l).filter(([k]) => !LIGHT_KEYS.includes(k)))}));
    }
    return out;
}

function editView()
{
    const sc = realScene(), inst = sc?.prefabs?.find(o => o.key === S.edit.key);
    const syn = toSyn(S.prefabs[S.edit.id], inst?.x ?? 0, inst?.y ?? 0, sc);
    const f = S.edit.look;
    if (f != null) for (const k of KINDS3) for (const o of syn[k]) if (o.look && o.look !== f) o._off = true;
    return syn;
}

// 改零件：fn(假場景)；新加的零件標成目前篩選的狀態
function editParts(fn, pick)
{
    const {id, key, look} = S.edit, name = S.sel;
    return commit((scenes, pfs) => {
        const pf = pfs[id], inst = scenes[name]?.prefabs?.find(o => o.key === key);
        if (!pf || !inst) throw new Error(`找不到正在編輯的 prefab ${id}`);
        const syn = toSyn(pf, inst.x, inst.y, scenes[name]);
        const had = new Set(KINDS3.flatMap(k => syn[k].map(o => o.key)));
        if (fn(syn) === false) return false;
        if (look) for (const k of KINDS3) for (const o of syn[k] ?? []) if (!had.has(o.key) && !o.look) o.look = look;
        const parts = fromSyn(syn, inst.x, inst.y);
        if (parts.length) pf.parts = parts; else delete pf.parts;
    }, undefined, pick, PREFAB_FILES);
}

// 送給 sandbox 的場景：編輯中＝場景本身（key 前面加 x、鎖住變暗、不含正在編的實例）＋零件（篩掉的不送）
function gameScene()
{
    if (!S.edit) return cur();
    const real = realScene() ?? ST.newScene(), syn = scene();
    const X = (list) => (list ?? []).map(o => ({...o, key: `x${o.key}`, ...(o.follow && {follow: `x${o.follow}`})}));
    const live = (list) => list.filter(o => !o._off).map(({_off, ...o}) => o);
    const out = {...syn, roles: X(real.roles), prefabs: X(real.prefabs?.filter(o => o.key !== S.edit.key))};
    for (const k of KINDS3) out[k] = [...X(real[k]), ...live(syn[k])];
    out.locked = [...out.roles, ...out.prefabs, ...KINDS3.flatMap(k => X(real[k]))].map(o => o.key);
    const inst = real.prefabs?.find(o => o.key === S.edit.key), pf = S.prefabs[S.edit.id] ?? {};
    out.edit = {anchor: {x: inst?.x ?? 0, y: inst?.y ?? 0}, boxes: Object.fromEntries(BOXES.map(([k]) => [k, pf[k] ?? null]))};
    return out;
}

// 拖錨點十字：零件、占地方塊、縮圖外框反向挪（畫面上不動），實例搬到新錨點；別的場景同一個 prefab 的實例錨點不動、圖會挪
function moveAnchor(x, y)
{
    const {id, key} = S.edit, name = S.sel;
    return commit((scenes, pfs) => {
        const pf = pfs[id], inst = scenes[name]?.prefabs?.find(o => o.key === key);
        if (!pf || !inst) throw new Error(`找不到正在編輯的 prefab ${id}`);
        const dx = x - inst.x, dy = y - inst.y;
        if (!dx && !dy) return false;
        for (const p of pf.parts ?? [])
        {
            const nx = (p.x ?? 0) - dx, ny = (p.y ?? 0) - dy;
            if (nx) p.x = nx; else delete p.x;
            if (ny) p.y = ny; else delete p.y;
        }
        for (const k of [...BOXES.map(([b]) => b), 'thumb']) if (pf[k]) {pf[k].x -= dx; pf[k].y -= dy;}
        inst.x = x;
        inst.y = y;
    }, undefined, undefined, PREFAB_FILES);
}

function enterEdit(key)
{
    const o = instOf(key);
    if (!o || !S.prefabs[o.prefab]) return status('找不到這個 prefab');
    if (S.arm) {S.arm = null; toGame({sb: 'arm', act: null});}
    S.edit = {id: o.prefab, key, look: null};
    S.pick = null;
    S.hidden.clear();
    refresh();
}

async function exitEdit()
{
    if (!S.edit) return;
    const {key} = S.edit;
    try {await finishEdit();}
    catch (e) {status(`prefab 收尾失敗：${e.message}`);}
    S.edit = null;
    S.pick = instOf(key) ? key : null;
    refresh();
}

// 圖的原始大小（file: 圖＝原圖，不含 pct）
async function imgSize(img)
{
    if (isFile(img)) {const i = await loadImg(fileUrl(img)); return i && {w: i.naturalWidth, h: i.naturalHeight};}
    const r = await IC.frameOf(img);
    return r && {w: r.f.w, h: r.f.h};
}

// 縮圖外框：預設狀態看得到的 png 零件（不算角度）聯集，相對錨點；沒有＝null
async function thumbFor(pf)
{
    let box = null;
    for (const p of pf.parts ?? [])
    {
        if (!p.img || (p.look && p.look !== pf.look)) continue;
        const s = await imgSize(p.img);
        if (!s) continue;
        const k = isFile(p.img) ? (p.pct ?? 100) / 100 : 1;
        const w = s.w * k * Math.abs(p.sx ?? 1), hh = s.h * k * Math.abs(p.sy ?? 1);
        const l = (p.x ?? 0) - (p.ox ?? 0.5) * w, t = (p.y ?? 0) - (p.oy ?? 1) * hh;
        box = box ? {l: Math.min(box.l, l), t: Math.min(box.t, t), r: Math.max(box.r, l + w), b: Math.max(box.b, t + hh)} : {l, t, r: l + w, b: t + hh};
    }
    if (!box) return null;
    const x = Math.floor(box.l), y = Math.floor(box.t);
    return {x, y, w: Math.ceil(box.r) - x, h: Math.ceil(box.b) - y};
}

// 收尾（離開編輯／組成時）：算縮圖外框；file: 圖照 pct 烤進 textures/prefabs/<id>/<id>-<檔名>.png、改寫成 texture key
async function finishEdit(id = S.edit?.id)
{
    const pf = S.prefabs[id];
    if (!pf) return;
    const thumb = await thumbFor(pf);
    // Tiled 用的縮圖／tsj／template（烤圖前合成：file: 圖直接讀原圖）
    await TL.syncPrefab(S.root, id, {...pf, thumb: thumb ?? undefined});
    const baked = {};
    const files = [...new Set((pf.parts ?? []).filter(p => p.img && isFile(p.img)).map(p => `${p.pct ?? 100}|${p.img}`))];
    if (files.length)
    {
        const dir = `${TEX}/prefabs/${id}`;
        await mkdirs(dir);
        const taken = new Set();
        for (const f of files)
        {
            const [pct, img] = [Number(f.split('|')[0]), f.slice(f.indexOf('|') + 1)];
            const base = `${id}-${img.split('/').pop().replace(/\.png$/i, '')}`.replace(/[\\/:*?"<>|\s]+/g, '_');
            let name = base;
            for (let i = 2; taken.has(name.toLowerCase()) || await findTexKey(await FS.resolveDir(S.root, TEX), name); i++) name = `${base}-${i}`;
            taken.add(name.toLowerCase());
            await bakeImg(img, pct, dir, name);
            baked[f] = name;
        }
    }
    await updateTextures();
    await commit((s, pfs) => {
        const p = pfs[id];
        if (!p) return false;
        for (const part of p.parts ?? [])
        {
            const k = part.img && isFile(part.img) && baked[`${part.pct ?? 100}|${part.img}`];
            if (k) {part.img = k; delete part.pct;}
        }
        if (thumb) p.thumb = thumb; else delete p.thumb;
    }, undefined, undefined, PREFAB_FILES);
    if (files.length) reloadGame();
}

async function mkdirs(path)
{
    let d = S.root;
    for (const seg of path.split('/')) d = await d.getDirectoryHandle(seg, {create: true});
    return d;
}

// file: 圖縮成 pct% 存成 <dir>/<name>.png
async function bakeImg(img, pct, dir, name)
{
    const i = await loadImg(fileUrl(img));
    if (!i) throw new Error(`讀不到 ${img.slice(FILE.length)}`);
    const k = pct / 100, w = Math.max(1, Math.round(i.naturalWidth * k)), hh = Math.max(1, Math.round(i.naturalHeight * k));
    const cv = Object.assign(document.createElement('canvas'), {width: w, height: hh});
    const g = cv.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(i, 0, 0, w, hh);
    await FS.writeFile(await FS.resolveDir(S.root, dir), `${name}.png`, await new Promise(res => cv.toBlob(res, 'image/png')));
}

// prefab 本身的欄位（look／acts／defAct／占地方塊）：patch 值 undefined＝拿掉
function setPf(patch)
{
    const id = S.edit.id;
    return commit((s, pfs) => {
        const pf = pfs[id];
        if (!pf) throw new Error(`prefab.json 沒有 ${id}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete pf[k]; else pf[k] = v;}
    }, undefined, undefined, PREFAB_FILES);
}

// 狀態下拉：''＝沒有（零件：永遠出現）＋現有狀態＋「新狀態…」
function lookSelect(value, set, none = '（永遠出現）')
{
    const looks = looksOf(S.prefabs[S.edit.id]);
    const sel = h('select', {dataset: {k: 'look'}, onchange: async () => {
        if (sel.value !== '__new') return set(sel.value || undefined);
        const v = (await askName('新狀態（英數字、_、-）', ''))?.trim();
        if (!v) return renderRight();
        if (!PREFAB_ID.test(v)) {status('狀態名只能用英數字、_、-'); return renderRight();}
        set(v);
    }}, h('option', {value: ''}, none), looks.map(v => h('option', {value: v}, v)), h('option', {value: '__new'}, '＋ 新狀態…'));
    if (value && !looks.includes(value)) sel.insertBefore(h('option', {value}, value), sel.lastChild);
    sel.value = value ?? '';
    return sel;
}

// png 零件掛的 fx.json（idle 等 tween；sandbox 的編輯畫面不播，離開編輯後的實例才播）
function fxSelect(value, set)
{
    const sel = h('select', {dataset: {k: 'fx'}, onchange: () => set(sel.value || undefined)},
        h('option', {value: ''}, '（沒有）'), Object.keys(S.refs.fx).map(id => h('option', {value: id}, id)));
    if (value && !S.refs.fx[value]) sel.append(h('option', {value}, `⚠ ${value}`));
    sel.value = value ?? '';
    return sel;
}

const BOXES = [['body', '碰撞（body）'], ['grid', '占格（grid）'], ['zone', '可點（zone）']];

function prefabPanel()
{
    const id = S.edit.id, pf = S.prefabs[id] ?? {};
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const acts = Object.entries(pf.acts ?? {});
    const setActs = (list) => setPf({acts: list.length ? Object.fromEntries(list) : undefined, ...(pf.defAct && !list.some(([a]) => a === pf.defAct) && {defAct: undefined})});
    const actRow = ([a, v], i) => h('tr', {dataset: {act: a}},
        h('td', null, h('input', {size: 10, value: a, dataset: {k: `act${i}`}, onchange: (e) => {
            const n = e.target.value.trim();
            if (!PREFAB_ID.test(n)) {status('動作 id 只能用英數字、_、-'); return renderRight();}
            setActs(acts.map((x, j) => (j === i ? [n, x[1]] : x)));
        }}), S.refs.local[a] ? null : h('span', {class: 'warn', title: 'local.json 沒有這個 key：遊戲選單會顯示紅字（到文字分頁補）'}, ' ⚠')),
        h('td', null, '→ ', lookSelect(v, (nv) => setActs(acts.map((x, j) => (j === i ? [a, nv ?? ''] : x))), '（選狀態）')),
        h('td', null, h('button', {title: '拿掉這個動作', onclick: () => setActs(acts.filter((_, j) => j !== i))}, '✕')));
    const defSel = h('select', {dataset: {k: 'defAct'}, onchange: () => setPf({defAct: defSel.value || undefined})},
        h('option', {value: ''}, '（沒有：照遊戲預設）'), acts.map(([a]) => h('option', {value: a}, a)));
    defSel.value = pf.defAct ?? '';
    const boxRow = ([k, name]) => {
        const b = pf[k];
        const n = (f) => h('input', {type: 'number', step: 1, value: b?.[f] ?? '', class: 'n', dataset: {k: `${k}.${f}`}, disabled: !b,
            onchange: (e) => e.target.value !== '' && setPf({[k]: {...b, [f]: +e.target.value}})});
        return row(name, h('input', {type: 'checkbox', checked: !!b, dataset: {k: `${k}.on`}, title: '沒勾＝照 ItemView 預設（整個縮圖框）',
            onchange: (e) => setPf({[k]: e.target.checked ? {x: -16, y: -32, w: 32, h: 32} : undefined})}), ' ', n('x'), n('y'), ' ', n('w'), '×', n('h'));
    };
    const t = pf.thumb;
    return [
        h('div', {class: 'sec'}, `prefab ${id}`),
        h('table', {class: 'props'},
            row('預設狀態', lookSelect(pf.look, (v) => setPf({look: v}), '（沒有）')),
            row('左鍵動作', defSel)),
        h('div', {class: 'sec'}, '右鍵動作', h('span', {class: 'dim'}, '（動作 id → 切到的狀態；選單文字＝local.json 的 id）')),
        h('table', {class: 'props'}, acts.map(actRow)),
        h('div', {class: 'row2'}, h('button', {dataset: {k: 'addAct'}, onclick: () => {
            let n = 'turn_on';
            for (let i = 2; acts.some(([a]) => a === n); i++) n = `act${i}`;
            setActs([...acts, [n, pf.look ?? '']]);
        }}, '＋ 動作'), acts.some(([a]) => !S.refs.local[a]) && h('button', {onclick: () => SH.gotoTab('local')}, '↗ 文字分頁')),
        h('div', {class: 'sec'}, '占地方塊', h('span', {class: 'dim'}, '（相對錨點的左上角＋寬高；Tiled 物件有寫就蓋掉）')),
        h('table', {class: 'props'}, BOXES.map(boxRow)),
        h('div', {class: 'hint dim'}, t ? `縮圖外框 ${t.x},${t.y} ${t.w}×${t.h}（離開編輯時照預設狀態的 png 自動算）` : '縮圖外框：離開編輯時照預設狀態的 png 自動算'),
        h('div', {class: 'hint dim'}, '點畫面上的零件編輯；右鍵放擺設／粒子／光源（新零件標成上方篩選的狀態）；'
            + '橘色十字＝錨點，拖它改錨點（零件不動、整個 prefab 的原點換位置，別處的實例圖會挪）；方塊左上把手移動、右下把手改大小，Shift 吸 16px'),
    ];
}

// ---------- 改名／複製 prefab ----------
// 改名連帶改所有場景的實例（地圖／template／道具的引用在之後的步驟補）
async function renamePrefab(from, to)
{
    to ??= await askName(`改名 prefab ${from}`, from);
    if (to === null || to === from) return;
    const err = prefabIdError(to);
    if (err) return status(err);
    await commit((scenes, pf) => {
        if (!(from in pf)) throw new Error(`prefab.json 沒有 ${from}`);
        ST.renameKey(pf, from, to);
        for (const sc of Object.values(scenes)) for (const o of sc.prefabs ?? []) if (o.prefab === from) o.prefab = to;
    }, undefined, undefined, PREFAB_FILES);
    if (S.edit?.id === from) {S.edit.id = to; refresh();}
    if (ls.get(LS.prefab) === from) ls.set(LS.prefab, to);
    if (!S.prefabs[to]) return;
    // 地圖／template／縮圖／tsj 跟著改（不進 undo）
    try
    {
        const done = await TL.renamePrefab(S.root, from, to);
        for (const rel of done.filter(r => r.startsWith('maps/'))) SH.notifySaved(rel);
        await updateTextures();
        if (done.length) status(`連帶改了：${done.join('、')}`);
    }
    catch (e) {status(`地圖／template 沒改完：${e.message}`);}
}

async function dupPrefab(from, to)
{
    if (to === undefined)
    {
        let n = `${from}-copy`;
        for (let i = 2; n in S.prefabs; i++) n = `${from}-copy${i}`;
        to = await askName(`複製 prefab ${from}`, n);
    }
    if (to === null) return;
    const err = prefabIdError(to);
    if (err) return status(err);
    await commit((scenes, pf) => {
        if (!(from in pf)) throw new Error(`prefab.json 沒有 ${from}`);
        pf[to] = structuredClone(pf[from]);
    }, undefined, undefined, PREFAB_FILES);
    if (!S.prefabs[to]) return;
    try {await TL.syncPrefab(S.root, to, S.prefabs[to]); await updateTextures();}
    catch (e) {status(`Tiled 的縮圖／template 沒產生：${e.message}`);}
}

// ---------- 組成 prefab：場景裡挑擺設／粒子／光源 → prefab.json 一筆＋原地換成一個實例 ----------
// 錨點＝第一個勾的擺設（沒有就第一個勾的東西）；跟著角色／擺設的粒子／光源先換成絕對位置；
// 發射點有自己那份（def）的要另存成 particle.json 的新 id 或覆寫原 id（prefab 只能參照）；最後照「離開編輯」收尾（烤圖、縮圖外框）
async function composePrefab(start, opt)
{
    if (S.sel === null) return status('先選或新增一個場景');
    if (S.edit) return status('編輯 prefab 中，先按上方「離開」');
    const sc = realScene();
    const all = [...props().map(o => ['props', o, `擺設 ${o.key}　${propName(o)}`]), ...emitters().map(o => ['particles', o, `粒子 ${o.key}　${o.id}${o.def ? ' ✎' : ''}`]),
                 ...lights().map(o => ['lights', o, `光源 ${o.key}`])];
    if (!all.length) return status('場景裡沒有擺設／粒子／光源可以組');
    let pick, id, defs;
    if (opt) ({keys: pick, id, defs = {}} = opt);
    else
    {
        let n = 'prefab';
        for (let i = 2; n in S.prefabs; i++) n = `prefab${i}`;
        const idInp = h('input', {size: 20, value: n});
        const checks = all.map(([, o, t]) => h('label', {style: 'display:block'}, h('input', {type: 'checkbox', value: o.key, checked: o.key === start || o.follow === start}), ' ', t));
        const defRows = all.filter(([k, o]) => k === 'particles' && o.def).map(([, o]) => {
            const mode = h('select', null, h('option', {value: 'new'}, '另存成新 id'), h('option', {value: 'over'}, `覆寫 ${o.id}`));
            const inp = h('input', {size: 16, value: `${n}-${o.id}`});
            mode.onchange = () => {inp.disabled = mode.value === 'over';};
            return {key: o.key, el: h('div', {class: 'row2'}, `${o.key}（${o.id} ✎）`, mode, inp), get: () => (mode.value === 'over' ? o.id : inp.value.trim())};
        });
        const p = ask('組成 prefab', [
            h('label', null, 'id ', idInp, h('span', {class: 'dim'}, '　英數字、_、-')),
            h('div', {class: 'dim', style: 'margin-top:6px'}, '要組進去的東西（錨點＝第一個勾的擺設）'),
            h('div', {class: 'treebox', style: 'height:auto; max-height:260px; padding:4px'}, checks),
            defRows.length && h('div', {class: 'dim', style: 'margin-top:6px'}, '有自己改過內容（✎）的粒子：prefab 只能參照 particle.json'),
            defRows.map(r => r.el),
        ], [['ok', '組成'], ['cancel', '取消']]);
        idInp.select();
        if (await p !== 'ok') return;
        id = idInp.value.trim();
        pick = checks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
        defs = Object.fromEntries(defRows.map(r => [r.key, r.get()]));
    }
    const err = prefabIdError(id);
    if (err) return status(err);
    const chosen = all.filter(([, o]) => pick.includes(o.key));
    if (!chosen.length) return status('至少勾一個');
    for (const [, o] of chosen.filter(([k, o]) => k === 'particles' && o.def))
    {
        const v = defs[o.key];
        if (!PREFAB_ID.test(v ?? '')) return status(`${o.key} 的粒子 id「${v ?? ''}」只能用英數字、_、-`);
        if (v !== o.id && S.refs.particles[v]) return status(`particle.json 已經有 ${v}（要蓋掉原本的請選「覆寫 ${o.id}」）`);
    }
    const abs = (o) => {const b = o.follow ? followBase(sc, o.follow) : null; return {x: (b?.x ?? 0) + o.x, y: (b?.y ?? 0) + o.y};};
    const first = chosen.find(([k]) => k === 'props') ?? chosen[0];
    const anchor = abs(first[1]);
    const name = S.sel, key = instKey();
    const syn = {props: [], particles: [], lights: []};
    for (const [k, o] of chosen)
    {
        const {follow, every, def, ...rest} = o;
        syn[k].push({...rest, ...abs(o), ...(k === 'particles' && def && {id: defs[o.key]})});
    }
    const parts = fromSyn(syn, anchor.x, anchor.y);
    const newDefs = chosen.filter(([k, o]) => k === 'particles' && o.def).map(([, o]) => [defs[o.key], o.def]);
    const files = newDefs.length ? [...PREFAB_FILES, ST.PARTICLE] : PREFAB_FILES;
    await commit((scenes, pf, particles) => {
        if (id in pf) throw new Error(`已經有 prefab「${id}」`);
        const s = scenes[name];
        if (!s) throw new Error(`找不到場景「${name}」`);
        pf[id] = {parts};
        for (const [pid, d] of newDefs) particles[pid] = structuredClone(d);
        const gone = new Set(pick);
        // 沒勾、卻跟著被組走的擺設：換成絕對位置
        for (const o of [...(s.particles ?? []), ...(s.lights ?? [])].filter(o => !gone.has(o.key) && gone.has(o.follow)))
        {
            const b = followBase(s, o.follow);
            o.x += b?.x ?? 0;
            o.y += b?.y ?? 0;
            delete o.follow;
        }
        for (const k of KINDS3)
        {
            if (!s[k]) continue;
            s[k] = s[k].filter(o => !gone.has(o.key));
            if (!s[k].length) delete s[k];
        }
        (s.prefabs ??= []).push({key, prefab: id, x: anchor.x, y: anchor.y});
    }, undefined, key, files);
    if (!S.prefabs[id]) return;
    const n0 = S.undo.length;
    try {await finishEdit(id);}
    catch (e) {status(`prefab 收尾失敗：${e.message}`);}
    mergeUndo(n0);
    S.pick = key;
    refresh();
}

// 把 n0 之後多出來的那一步併進前一步（組成＋收尾＝一筆 undo）
function mergeUndo(n0)
{
    if (S.undo.length !== n0 + 1 || n0 < 1) return;
    const b = S.undo.pop(), a = S.undo.at(-1);
    for (const [f, t] of Object.entries(b.files)) a.files[f] = a.files[f] ? {before: a.files[f].before, after: t.after} : t;
}

function instPanel(o)
{
    const pf = S.prefabs[o.prefab];
    const n = (k) => h('input', {type: 'number', step: 1, value: o[k], class: 'n', dataset: {k}, onchange: (e) => e.target.value !== '' && setInst(o.key, {[k]: +e.target.value})});
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const idSel = h('select', {dataset: {k: 'prefab'}, onchange: () => setInst(o.key, {prefab: idSel.value, look: undefined})},
        Object.keys(S.prefabs).map(id => h('option', {value: id}, id)));
    if (!pf) idSel.append(h('option', {value: o.prefab}, `⚠ ${o.prefab}`));
    idSel.value = o.prefab;
    const looks = looksOf(pf);
    const look = h('select', {dataset: {k: 'look'}, onchange: () => setInst(o.key, {look: look.value || undefined})},
        h('option', {value: ''}, `（預設${pf?.look ? `：${pf.look}` : ''}）`), looks.map(v => h('option', {value: v}, v)));
    if (o.look && !looks.includes(o.look)) look.append(h('option', {value: o.look}, `⚠ ${o.look}`));
    look.value = o.look ?? '';
    return [
        h('div', {class: 'sec'}, `prefab ${o.key}`, pf ? null : h('span', {class: 'warn'}, `　prefab.json 沒有 ${o.prefab}`)),
        h('div', {class: 'row2'}, pfIcon(o.prefab, 48)),
        h('table', {class: 'props'},
            row('prefab', idSel),
            row('錨點', n('x'), ' ', n('y')),
            row('狀態', look)),
        h('div', {class: 'hint dim'}, '狀態只改這個實例的初始狀態（存在場景裡）；拖曳移動、Shift 吸 16px；方向鍵 1px、Shift＋方向鍵一格'),
        h('div', {class: 'acts row2'}, pf && h('button', {dataset: {k: 'editPrefab'}, title: '在這個位置攤開零件編輯 prefab.json 的這一筆', onclick: () => enterEdit(o.key)}, '✎ 編輯 prefab'),
            h('button', {onclick: () => deleteObj(o.key)}, '刪除（Del）')),
    ];
}

// ---------- 光源 ----------
const lights = () => scene()?.lights ?? [];
const lightOf = (key) => lights().find(l => l.key === key);
const isLight = (key) => /^l\d+$/.test(key ?? '');
const lightKey = () => {let i = 1; while (lightOf(`l${i}`)) i++; return `l${i}`;};
const LIGHT = {r: 120, color: '#ffcc88'};

function addLight(x, y)
{
    if (S.sel === null) {status('先選或新增一個場景'); return Promise.resolve();}
    const key = lightKey();
    return editScene(sc => {(sc.lights ??= []).push({key, x, y, ...LIGHT});}, key);
}

function setLight(key, patch)
{
    return editScene(sc => {
        const l = sc.lights?.find(x => x.key === key);
        if (!l) throw new Error(`場景裡沒有 ${key}`);
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete l[k]; else l[k] = v;}
    });
}

// ---------- follow（粒子、光源）：角色＝格子中心、擺設＝錨點 ----------
function followBase(sc, key)
{
    const r = sc?.roles?.find(x => x.key === key);
    if (r) return {x: r.tx * 32 + 16, y: r.ty * 32 + 16};
    const p = sc?.props?.find(x => x.key === key);
    return p ? {x: p.x, y: p.y} : null;
}

// 換跟隨對象：位置換算成相對新對象／絕對，畫面上不動
function refollow(o, to)
{
    const from = followBase(scene(), o.follow), b = followBase(scene(), to);
    const x = (from?.x ?? 0) + o.x, y = (from?.y ?? 0) + o.y;
    return {follow: to || undefined, x: x - (b?.x ?? 0), y: y - (b?.y ?? 0)};
}

const propName = (p) => (p.img.startsWith(FILE) ? p.img.split('/').pop() : p.img);
const followName = (key) => roleOf(key)?.id ?? (propOf(key) && propName(propOf(key))) ?? key;

function followSelect(o, set)
{
    const sel = h('select', {dataset: {k: 'follow'}, onchange: () => set(refollow(o, sel.value))},
        h('option', {value: ''}, '（不跟）'),
        roles().length && h('optgroup', {label: '角色'}, roles().map(r => h('option', {value: r.key}, `${r.key}　${r.id}`))),
        props().length && h('optgroup', {label: '擺設'}, props().map(p => h('option', {value: p.key}, `${p.key}　${propName(p)}`))));
    if (o.follow && !followBase(scene(), o.follow)) sel.append(h('option', {value: o.follow}, `⚠ ${o.follow}`));
    sel.value = o.follow ?? '';
    return sel;
}

function lightPanel(l)
{
    const n = (k, step, ph, disabled = false) => h('input', {type: 'number', step, value: l[k] ?? '', placeholder: ph, class: 'n', dataset: {k}, disabled,
        onchange: (e) => setLight(l.key, {[k]: e.target.value === '' ? undefined : +e.target.value})});
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const point = !(l.arc > 0 && l.arc < 360);
    return [
        h('div', {class: 'sec'}, `光源 ${l.key}`),
        h('table', {class: 'props'},
            row(l.follow ? `位置（相對 ${followName(l.follow)}）` : '位置', n('x', 1), ' ', n('y', 1)),
            row('半徑', n('r', 10, '120')),
            row('光錐', n('arc', 5, '點光源'), '°'),
            row('方向', n('dir', 15, '0', point), '°'),
            row('柔和', n('soft', 0.05, '0.2', point)),
            row('顏色', h('input', {type: 'color', value: l.color ?? '#ffcc88', dataset: {k: 'color'}, onchange: (e) => setLight(l.key, {color: e.target.value})})),
            row('強度', n('i', 0.1, '1')),
            S.edit ? row('狀態', lookSelect(l.look, (v) => setLight(l.key, {look: v}))) : row('跟著', followSelect(l, (patch) => setLight(l.key, patch)))),
        h('div', {class: 'hint dim'}, '強度空白＝1（同遊戲 GM.LIGHT；日夜由 shader 處理：天越亮燈越加不上去、白天看不出來）；光錐空白或 ≥360＝點光源，方向 0＝右、順時針，柔和＝錐邊淡出比例（0～1）；跟著角色時寫的是角色朝右的樣子，朝左自動鏡像；'
            + '拖圓點移動、拖虛線上的把手改半徑（聚光燈：中線末端的把手連方向一起改、弧兩端的把手改光錐；Shift 吸 16px／15°）；方向鍵 1px、Shift＋方向鍵一格'),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(l.key)}, '刪除（Del）')),
    ];
}

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

// ---------- 發射點自己那份粒子（def）：沒有＝照 particle.json 的 id；表單第一次改或按「複製」才整筆拷進來，之後跟 particle.json 脫鉤 ----------
const defOf = (e) => e?.def ?? S.refs.particles[e?.id];

// 粒子表單（tools/particle/pform.js）的假 doc：data 只放選中那個發射點，commit 完寫回場景（立刻寫檔＋場景 undo）
const PS = {data: {}, open: {}, json: false, drafts: {}, extra: {}, of: null};
function pCommit(fn)
{
    const key = PS.of, e = emOf(key), cur = defOf(e);
    if (!cur) return;
    PS.data[key] = structuredClone(cur);
    fn();
    if (str(PS.data[key]) === str(cur)) return renderRight();
    return setEmitter(key, {def: PS.data[key]});
}
const PFF = createForm({S: PS, render: () => renderRight(), commit: pCommit});
const PF = createPForm({S: PS, F: PFF, set: (id, path, v) => pCommit(() => setAt(PS.data[id], path, v)), commit: pCommit, render: () => renderRight()});

// 換粒子＝丟掉自己那份；自己那份改過（跟來源不一樣）先問
async function changeEmitterId(e, id)
{
    if (id === e.id && !e.def) return;
    if (e.def && str(e.def) !== str(S.refs.particles[e.id]))
    {
        const ok = await ask('換粒子', `${e.key} 有自己改過的粒子內容，換成 ${id} 會丟掉，確定？`, [['ok', '換'], ['cancel', '取消']]) === 'ok';
        if (!ok) return renderRight();
    }
    await setEmitter(e.key, {id, def: undefined});
}

function emPanel(e)
{
    const idSel = h('select', {dataset: {k: 'id'}, onchange: () => changeEmitterId(e, idSel.value)}, Object.keys(S.refs.particles).map(id => h('option', {value: id}, id)));
    if (!S.refs.particles[e.id]) idSel.append(h('option', {value: e.id}, `⚠ ${e.id}`));
    idSel.value = e.id;
    const fol = followSelect(e, (patch) => setEmitter(e.key, patch));
    const n = (k, step, ph) => h('input', {type: 'number', step, value: e[k] ?? '', placeholder: ph, class: 'n', dataset: {k},
        onchange: (ev) => setEmitter(e.key, {[k]: ev.target.value === '' ? undefined : +ev.target.value})});
    const def = defOf(e), base = S.refs.particles[e.id];
    if (PS.of !== e.key) {PS.of = e.key; PS.drafts = {};}
    PS.data = {[e.key]: def};
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    // prefab 的粒子只能參照 particle.json：不跟、沒有自己那份，內容到粒子分頁改
    if (S.edit) return [
        h('div', {class: 'sec'}, `粒子 ${e.key}`),
        h('table', {class: 'props'},
            row('粒子', idSel),
            row('位置', n('x', 1), ' ', n('y', 1)),
            row('狀態', lookSelect(e.look, (v) => setEmitter(e.key, {look: v})))),
        h('div', {class: 'hint dim'}, 'prefab 的粒子參照 particle.json，內容到粒子分頁改（所有用到的地方一起變）'),
        h('div', {class: 'acts row2'}, h('button', {onclick: () => SH.gotoTab('particle', [e.id])}, '↗ 粒子分頁'), h('button', {onclick: () => deleteObj(e.key)}, '刪除（Del）')),
    ];
    return [
        h('div', {class: 'sec'}, `粒子 ${e.key}`),
        h('table', {class: 'props'},
            row('粒子', idSel),
            row(e.follow ? `位置（相對 ${followName(e.follow)}）` : '位置', n('x', 1), ' ', n('y', 1)),
            row('跟著', fol),
            def?.mode === 'burst' && row('每幾 ms 噴', n('every', 100, '1000'))),
        h('div', {class: 'hint dim'}, '畫面上的橘色菱形＝發射點：拖曳移動、Shift 吸 16px；方向鍵 1px、Shift＋方向鍵一格；emitZone 綠框／deathZone 紅虛線：點框選取、拖本體或白色把手（Shift 吸 4px）'),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(e.key)}, '刪除（Del）')),
        h('div', {class: 'sec'}, '粒子內容',
            h('span', {class: 'dim', dataset: {k: 'defState'}}, e.def ? `　自訂（從 ${e.id} 複製，只存在這個發射點）` : def ? '　用 particle.json（改了就複製一份到這個發射點）' : '')),
        !def ? h('div', {class: 'warn'}, `particle.json 沒有 ${e.id}`) : h('div', null,
            h('div', {class: 'row2'},
                !e.def && h('button', {dataset: {k: 'copyDef'}, title: '把 particle.json 這筆整筆複製到這個發射點，之後跟 particle.json 脫鉤', onclick: () => setEmitter(e.key, {def: structuredClone(base)})}, '複製'),
                e.def && h('button', {dataset: {k: 'dropDef'}, title: '丟掉這個發射點自己那份，回到用 particle.json 的 ' + e.id, onclick: () => setEmitter(e.key, {def: undefined})}, '丟掉自訂'),
                h('span', {class: 'grow'}), PFF.modeBtn()),
            h('div', {class: 'pform'}, PF.body(e.key, def))),
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
        // 跟著它的粒子／光源改成不跟、位置換成絕對（同一筆 undo）
        const b = followBase(sc, key);
        for (const o of [...(sc.particles ?? []), ...(sc.lights ?? [])].filter(o => o.follow === key))
        {
            o.x += b?.x ?? 0;
            o.y += b?.y ?? 0;
            delete o.follow;
        }
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

const bakeName = (name) => name.trim().replace(/\.png$/i, '');

// 把 file: 圖縮成 pct% 另存一份 PNG（場景不動）；path＝相對專案的資料夾；回傳 {path, w, h} 或丟錯
// overwrite＝同資料夾同名檔可以蓋掉（呼叫端先問過）；擺設自己的原圖一律不能蓋
async function bakeProp(key, path, name, overwrite = false)
{
    const p = propOf(key);
    if (!p || !isFile(p.img)) throw new Error('只有外部 png 的擺設能存檔');
    name = bakeName(name);
    if (!name) throw new Error('檔名不能空白');
    if (/[\\/:*?"<>|]/.test(name)) throw new Error(`檔名不能有 \\ / : * ? " < > |`);
    const out = `${path ? `${path}/` : ''}${name}.png`;
    if (out.toLowerCase() === p.img.slice(FILE.length).toLowerCase()) throw new Error('不能覆蓋擺設正在用的原圖，換個檔名');
    const dir = await FS.resolveDir(S.root, path);
    if (!overwrite && await FS.tryFile(dir, `${name}.png`)) throw new Error(`${out} 已經有了，換個檔名`);
    const inTex = path === TEX || path.startsWith(`${TEX}/`);
    if (inTex)
    {
        const hit = await findTexKey(await FS.resolveDir(S.root, TEX), name);
        if (hit && hit.toLowerCase() !== out.slice(TEX.length + 1, -4).toLowerCase()) throw new Error(`textures/${hit}.png 已經有了（texture key 不能撞名），換個檔名`);
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
    return {path: out, w, h: hh};
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
        if (r.ok) {SH.notifySaved('textures.json'); await IC.reloadList();}
        else status(`圖片清單沒更新：${r.errors.join('；')}`);
    }
    catch (e) {status(`圖片清單沒更新：${e.message}`);}
}

// 資料夾樹（懶載入，資料夾後面列 .png）：root＝相對專案的根，cur＝預設選的資料夾，self＝標灰的檔（擺設的原圖）；
// 點資料夾 onPick(path)、點檔案 onPick(所在資料夾, 檔名不含 .png)
function folderTree(root, cur, onPick, self = '')
{
    const skip = (rel, n) => n.startsWith('.') || n === 'node_modules' || (rel === TEX && TEX_SKIP.includes(n));
    let sel = null;
    const select = (line) => {
        sel?.classList.remove('sel');
        (sel = line).classList.add('sel');
    };
    const file = (path, f, depth) => {
        const rel = `${path ? `${path}/` : ''}${f.name}`;
        const mine = rel.toLowerCase() === self.toLowerCase();
        const line = h('div', {class: `fold file${mine ? ' dim' : ''}`, dataset: {file: rel}, title: mine ? '擺設正在用的原圖（不能覆蓋）' : '', style: `padding-left:${depth * 14}px`},
            h('span', {class: 'tw'}), h('span', null, `🖼 ${f.name}`));
        line.onclick = () => {select(line); onPick(path, f.name.slice(0, -4));};
        return line;
    };
    const node = (path, label, depth) => {
        const kids = h('div', {hidden: true});
        const tw = h('span', {class: 'tw'}, '▸');
        const line = h('div', {class: 'fold', dataset: {path}, style: `padding-left:${depth * 14}px`}, tw, h('span', null, `📁 ${label}`));
        let loaded = false;
        const open = async (on) => {
            if (on && !loaded)
            {
                loaded = true;
                const {dirs, files} = await FS.listDir(await FS.resolveDir(S.root, path));
                kids.replaceChildren(
                    ...dirs.filter(d => !skip(path, d.name)).map(d => node(`${path ? `${path}/` : ''}${d.name}`, d.name, depth + 1)),
                    ...files.filter(f => /\.png$/i.test(f.name)).map(f => file(path, f, depth + 1)));
            }
            kids.hidden = !on;
            tw.textContent = on ? '▾' : '▸';
        };
        line.onclick = (e) => {
            if (e.target === tw) return open(kids.hidden);
            select(line);
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
            const next = i < segs.length && [...n.lastChild.children].find(c => c.firstChild.dataset.path?.split('/').pop() === segs[i]);
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
    const defName = (m) => (m === 'tex' ? base : `${base}-copy`);
    const name = h('input', {size: 28, value: defName(mode)});
    const build = () => {
        const cur = mode === 'tex' ? (ls.get(LS.exportDir)?.startsWith(TEX) ? ls.get(LS.exportDir) : TEX) : home;
        path = cur;
        shown.textContent = path;
        box.replaceChildren(folderTree(mode === 'tex' ? TEX : '', cur, (v, f) => {
            path = v;
            shown.textContent = v;
            if (f != null) name.value = f;
        }, src).el);
    };
    const radio = (v, t) => h('label', null, h('input', {type: 'radio', name: 'exMode', value: v, checked: mode === v, onchange: () => {
        if (name.value === defName(mode)) name.value = defName(v);
        mode = v;
        ls.set(LS.exportMode, v);
        build();
    }}), t);
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
        const n = bakeName(name.value), out = `${path ? `${path}/` : ''}${n}.png`;
        const dup = n && out.toLowerCase() !== src.toLowerCase() && !/[\\/:*?"<>|]/.test(n) && await FS.tryFile(await FS.resolveDir(S.root, path), `${n}.png`);
        if (dup && !confirm(`${out} 已存在，要覆蓋嗎？`)) return;
        const r = await bakeProp(p.key, path, name.value, !!dup);
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
            S.edit ? row('深度', n('depth', 1, '0'), h('span', {class: 'dim'}, ' prefab 裡的前後（大的在前）')) : row('深度', n('depth', 1, '0'), h('span', {class: 'dim'}, ' 加在 y 上')),
            S.edit && row('狀態', lookSelect(p.look, (v) => setProp(p.key, {look: v}))),
            S.edit && row('特效', fxSelect(p.fx, (v) => setProp(p.key, {fx: v})))),
        h('div', {class: 'hint dim'}, '拖曳移動、按住 Shift 錨點吸 16px；方向鍵 1px、Shift＋方向鍵一格'),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(p.key)}, '刪除（Del）')),
    ];
}

function nudge(dx, dy)
{
    const p = propOf(S.pick), e = emOf(S.pick), l = lightOf(S.pick), f = instOf(S.pick);
    if (p) setProp(p.key, {x: p.x + dx, y: p.y + dy});
    else if (f) setInst(f.key, {x: f.x + dx, y: f.y + dy});
    else if (e) setEmitter(e.key, {x: e.x + dx, y: e.y + dy});
    else if (l) setLight(l.key, {x: l.x + dx, y: l.y + dy});
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
    if (S.edit) return status('prefab 裡不能放角色');
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

// ---------- 左欄每段都能摺疊（點標題；摺起來的段名記 localStorage） ----------
const foldSet = () => {try {return new Set(JSON.parse(ls.get(LS.fold) ?? '[]'));} catch {return new Set();}};
const isFolded = (k) => foldSet().has(k);

function toggleFold(k)
{
    const s = foldSet();
    if (s.has(k)) s.delete(k); else s.add(k);
    ls.set(LS.fold, JSON.stringify([...s]));
    renderLib();
    renderList();
    renderTree();
}

function secHead(k, title, btn)
{
    const f = isFolded(k), t = () => toggleFold(k);
    return h('div', {class: 'row2 head', dataset: {fold: k}},
        h('span', {class: 'tw', onclick: t}, f ? '▸' : '▾'), h('span', {class: 'sec grow', onclick: t}, title), btn);
}

// prefab 庫：prefab.json 全部；拖進遊戲畫面＝放實例（sandbox 收 drop），右鍵刪除
function renderLib()
{
    const ids = Object.keys(S.prefabs);
    $('lib').replaceChildren(
        secHead('lib', `prefab 庫（${ids.length}）`, h('button', {id: 'btnNewPrefab', title: '新增空白 prefab（有選場景就在畫面中間放一個）', onclick: () => newPrefab()}, '＋')),
        ...(isFolded('lib') ? [] : ids.map(id => h('div', {
            class: 'item', draggable: 'true', dataset: {prefab: id}, title: '拖進遊戲畫面放一個',
            ondragstart: (e) => {e.dataTransfer.setData('application/x-prefab', id); e.dataTransfer.effectAllowed = 'copy';},
            oncontextmenu: (e) => menu(e, [['改名…', () => renamePrefab(id)], ['複製…', () => dupPrefab(id)], ['刪除', () => deletePrefab(id)]]),
        }, pfIcon(id, 20), h('span', {class: 'id'}, id), h('span', {class: 'lab dim'}, `${prefabUses(id).reduce((n, [, c]) => n + c, 0) || ''}`)))),
        !isFolded('lib') && !ids.length && h('div', {class: 'dim'}, S.root ? '還沒有 prefab，按 ＋ 新增' : ''));
}

function renderList()
{
    $('scenesHead').replaceChildren(secHead('scenes', '場景', h('button', {id: 'btnNew', title: '新增場景', onclick: () => addScene()}, '＋')));
    if (isFolded('scenes')) return $('list').replaceChildren();
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
    const plus = (title, fn) => h('button', {title: `${title}（放在地圖中間；也可以在畫面上右鍵）`, onclick: fn}, '＋');
    const sec = (k, title, btn, rows) => [secHead(k, title, btn), ...(isFolded(k) ? [] : rows())];
    const eye = (key) => h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(key);}}, S.hidden.has(key) ? '◌' : '👁');
    const cls = (key) => `item${key === S.pick ? ' sel' : ''}${S.hidden.has(key) ? ' hid' : ''}`;
    const vis = (list) => list.filter(o => !o._off);
    const ed = !!S.edit;
    box.replaceChildren(
        ed && h('div', {class: 'dim'}, `prefab ${S.edit.id} 的零件`),
        ...(ed ? [] : sec('roles', `角色（${roles().length}）`, plus('放角色', () => placeAt(...S.center)), () => roles().map(r => h('div', {
            class: `item${r.key === S.pick ? ' sel' : ''}${S.hidden.has(r.key) ? ' hid' : ''}`, dataset: {key: r.key},
            onclick: () => pickRole(r.key === S.pick ? null : r.key),
            oncontextmenu: (e) => menu(e, [['刪除', () => deleteRole(r.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(r.key);}}, S.hidden.has(r.key) ? '◌' : '👁'),
           h('span', {class: 'id'}, r.id), h('span', {class: 'lab'}, roleLab(r.id)), h('span', {class: 'mark dim'}, `${r.tx},${r.ty}`))))),
        ...sec('props', `${ed ? 'png' : '擺設'}（${vis(props()).length}）`, plus('放擺設', () => placeProp(S.center[0] * 32 + 16, S.center[1] * 32 + 32)), () => vis(props()).map(p => h('div', {
            class: `item${p.key === S.pick ? ' sel' : ''}${S.hidden.has(p.key) ? ' hid' : ''}`, dataset: {key: p.key},
            onclick: () => pickRole(p.key === S.pick ? null : p.key),
            oncontextmenu: (e) => menu(e, [...(ed ? [] : [['組成 prefab…', () => composePrefab(p.key)]]), ['刪除', () => deleteObj(p.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(p.key);}}, S.hidden.has(p.key) ? '◌' : '👁'),
           imgEl(p.img, 20), h('span', {class: 'id'}, p.img.startsWith(FILE) ? p.img.split('/').pop() : p.img), h('span', {class: 'mark dim'}, `${p.x},${p.y}`)))),
        ...sec('particles', `粒子（${vis(emitters()).length}）`, plus('放粒子發射點', () => placeEmitter(S.center[0] * 32 + 16, S.center[1] * 32 + 16)), () => vis(emitters()).map(e => h('div', {
            class: `item${e.key === S.pick ? ' sel' : ''}${S.hidden.has(e.key) ? ' hid' : ''}`, dataset: {key: e.key},
            onclick: () => pickRole(e.key === S.pick ? null : e.key),
            oncontextmenu: (ev) => menu(ev, [...(ed ? [] : [['組成 prefab…', () => composePrefab(e.key)]]), ['刪除', () => deleteObj(e.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(e.key);}}, S.hidden.has(e.key) ? '◌' : '👁'),
           h('span', {class: defOf(e) ? 'id' : 'id warn', title: e.def ? '自訂（發射點自己那份）' : ''}, e.def ? `${e.id} ✎` : e.id), e.follow && h('span', {class: 'lab'}, `→ ${followName(e.follow)}`), h('span', {class: 'mark dim'}, `${e.x},${e.y}`)))),
        ...sec('lights', `光源（${vis(lights()).length}）`, plus('放光源', () => addLight(S.center[0] * 32 + 16, S.center[1] * 32 + 16)), () => vis(lights()).map(l => h('div', {
            class: `item${l.key === S.pick ? ' sel' : ''}${S.hidden.has(l.key) ? ' hid' : ''}`, dataset: {key: l.key},
            onclick: () => pickRole(l.key === S.pick ? null : l.key),
            oncontextmenu: (ev) => menu(ev, [...(ed ? [] : [['組成 prefab…', () => composePrefab(l.key)]]), ['刪除', () => deleteObj(l.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(l.key);}}, S.hidden.has(l.key) ? '◌' : '👁'),
           h('span', {class: 'swatch', style: `background:${l.color ?? '#ffcc88'}`}), h('span', {class: 'id'}, l.key),
           l.follow && h('span', {class: 'lab'}, `→ ${followName(l.follow)}`), h('span', {class: 'mark dim'}, `${l.x},${l.y}`)))),
        ...(ed ? [] : sec('prefabs', `prefab（${insts().length}）`, plus('放 prefab', () => placeInst(S.center[0] * 32 + 16, S.center[1] * 32 + 32)), () => insts().map(o => h('div', {
            class: cls(o.key), dataset: {key: o.key},
            onclick: () => pickRole(o.key === S.pick ? null : o.key),
            oncontextmenu: (ev) => menu(ev, [['✎ 編輯 prefab', () => enterEdit(o.key)], ['刪除', () => deleteObj(o.key)]]),
        }, eye(o.key), pfIcon(o.prefab, 20), h('span', {class: S.prefabs[o.prefab] ? 'id' : 'id warn'}, o.prefab),
           o.look && h('span', {class: 'lab'}, o.look), h('span', {class: 'mark dim'}, `${o.x},${o.y}`))))),
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

// 重畫後把焦點還給同一個 data-k 的欄位（粒子表單連按 ↑↓ 才接得上）
function renderRight()
{
    const box = $('right'), a = document.activeElement;
    const focus = box.contains(a) ? a.dataset?.k : null;
    drawRight();
    if (focus) box.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

function drawRight()
{
    const r = roleOf(S.pick), box = $('right');
    if (propOf(S.pick)) return box.replaceChildren(...propPanel(propOf(S.pick)));
    if (emOf(S.pick)) return box.replaceChildren(...emPanel(emOf(S.pick)));
    if (lightOf(S.pick)) return box.replaceChildren(...lightPanel(lightOf(S.pick)));
    if (instOf(S.pick)) return box.replaceChildren(...instPanel(instOf(S.pick)));
    if (S.edit) return box.replaceChildren(...prefabPanel());
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
    if (S.edit && (!S.prefabs[S.edit.id] || !realScene()?.prefabs?.some(o => o.key === S.edit.key && o.prefab === S.edit.id))) S.edit = null;
    if (S.pick &&!roleOf(S.pick) && !propOf(S.pick) && !emOf(S.pick) && !lightOf(S.pick) && !instOf(S.pick)) S.pick = null;
    renderLib();
    renderList();
    renderTree();
    renderRight();
    $('sceneName').textContent = S.sel ?? '（沒選場景：空白 sandbox）';
    $('btnUndo').disabled = !S.undo.length;
    $('btnRedo').disabled = !S.redo.length;
    renderBar();
    renderEditBar();
    syncGame();
}

function renderEditBar()
{
    const bar = $('editBar');
    bar.hidden = !S.edit;
    if (!S.edit) return bar.replaceChildren();
    const looks = looksOf(S.prefabs[S.edit.id]);
    const f = h('select', {dataset: {k: 'editLook'}, title: '只顯示這個狀態的零件（＋沒標狀態的）；新放的零件標成這個狀態', onchange: () => {
        S.edit.look = f.value === '__all' ? null : f.value;
        refresh();
    }}, h('option', {value: '__all'}, '全部'), looks.map(v => h('option', {value: v}, v)));
    f.value = S.edit.look ?? '__all';
    bar.replaceChildren(h('span', null, '✎ 正在編輯 prefab ', h('b', null, S.edit.id)), h('label', null, '狀態 ', f),
        h('span', {class: 'dim'}, '改了直接寫 prefab.json；其他東西變暗、點不到'), h('span', {class: 'grow'}),
        h('button', {dataset: {k: 'exitEdit'}, title: '離開編輯（算縮圖外框、外部 png 烤進 textures/prefabs/）；Esc 也可以', onclick: () => exitEdit()}, '離開'));
}

const cur = () => scene() ?? ST.newScene();

// ---------- 底圖、日夜 ----------
const DEFAULT_TIME = '08:00';
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const mins = (t) => {const [h, m] = t.split(':').map(Number); return h * 60 + m;};

// 場景最上層的欄位：v undefined＝拿掉（編輯 prefab 時也是改場景本身）
const setField = (k, v) => editRealScene(sc => {if (v === undefined) delete sc[k]; else sc[k] = v;});

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

const iconsMsg = () => ({sb: 'icons', light: S.lightIcon, particle: S.particleIcon});

function syncGame()
{
    toGame({sb: 'grid', on: S.grid});
    toGame({sb: 'anchor', on: S.anchor});
    toGame(iconsMsg());
    toGame(playMsg());
    toGame(selMsg());
    toGame({sb: 'hide', keys: [...S.hidden]});
    toGame({sb: 'load', scene: gameScene(), prefabs: S.prefabs});
}

// ---------- sandbox ----------
function onKey(k)
{
    if (k.ctrl && k.key.toLowerCase() === 'z' && !k.shift) undo();
    else if (k.ctrl && (k.key.toLowerCase() === 'y' || (k.key.toLowerCase() === 'z' && k.shift))) redo();
    else if (k.key === 'Delete' && S.pick) deleteObj(S.pick);
    else if (k.key.startsWith('Arrow') && (propOf(S.pick) || emOf(S.pick) || lightOf(S.pick) || instOf(S.pick)))
    {
        const d = k.shift ? 32 : 1;
        nudge({ArrowLeft: -d, ArrowRight: d}[k.key] ?? 0, {ArrowUp: -d, ArrowDown: d}[k.key] ?? 0);
    }
    else if (k.key === ' ') toGame({sb: 'replay'});
    else if (k.key === 'Escape' && S.arm) arm(false);
    else if (k.key === 'Escape' && S.edit) exitEdit();
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
    else if (m.sb === 'moveInst') setInst(m.key, {x: m.x, y: m.y}).then(syncGame);
    else if (m.sb === 'moveAnchor' && S.edit) moveAnchor(m.x, m.y).then(syncGame);
    else if (m.sb === 'editBox' && S.edit) setPf({[m.k]: m.box}).then(syncGame);
    else if (m.sb === 'dropPrefab')
    {
        if (S.sel === null) return status('先選或新增一個場景');
        addInst(m.id, m.wx, m.wy);
    }
    else if (m.sb === 'zone')
    {
        // 拖 zone＝改粒子內容：寫進發射點自己那份（還沒有就先整筆複製）
        const cur = defOf(emOf(m.key));
        if (cur) setEmitter(m.key, {def: {...structuredClone(cur), [m.k]: m.z}}).then(syncGame);
    }
    else if (m.sb === 'moveLight') setLight(m.key, {x: m.x, y: m.y}).then(syncGame);
    else if (m.sb === 'radiusLight') setLight(m.key, {r: m.r, ...(m.dir !== undefined && {dir: m.dir})}).then(syncGame);
    else if (m.sb === 'arcLight') setLight(m.key, {arc: m.arc}).then(syncGame);
    else if (m.sb === 'key') onKey(m);
    else if (m.sb === 'ctx')
    {
        const b = frame.getBoundingClientRect(), at = {clientX: b.left + m.cx, clientY: b.top + m.cy};
        const items = S.edit
            ? [['在這裡放 png…', () => placeProp(m.wx, m.wy)], ['在這裡放粒子…', () => placeEmitter(m.wx, m.wy)], ['在這裡放光源', () => addLight(m.wx, m.wy)]]
            : [[`在這裡放角色…（${m.tx}, ${m.ty}）`, () => placeAt(m.tx, m.ty)], ['在這裡放擺設…', () => placeProp(m.wx, m.wy)], ['在這裡放粒子…', () => placeEmitter(m.wx, m.wy)], ['在這裡放光源', () => addLight(m.wx, m.wy)], ['在這裡放 prefab…', () => placeInst(m.wx, m.wy)]];
        if (m.key && isInst(m.key) && !S.edit) items.push(['✎ 編輯 prefab', () => enterEdit(m.key)]);
        if (m.key && (isProp(m.key) || isEm(m.key) || isLight(m.key)) && !S.edit) items.push(['組成 prefab…', () => composePrefab(m.key)]);
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
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('chkGrid').checked = S.grid;
$('chkGrid').onchange = () => {S.grid = $('chkGrid').checked; ls.set(LS.grid, S.grid ? '1' : '0'); toGame({sb: 'grid', on: S.grid});};
$('chkAnchor').checked = S.anchor;
$('chkAnchor').onchange = () => {S.anchor = $('chkAnchor').checked; ls.set(LS.anchor, S.anchor ? '1' : '0'); toGame({sb: 'anchor', on: S.anchor});};
for (const k of ['lightIcon', 'particleIcon'])
{
    const el = $('chk' + k[0].toUpperCase() + k.slice(1));
    el.checked = S[k];
    el.onchange = () => {S[k] = el.checked; ls.set(LS[k], S[k] ? '1' : '0'); toGame(iconsMsg());};
}
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
              fx: await read('fx.json'), particles: await read('particle.json'), local: await read('local.json')};
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
    try {S.prefabs = await ST.read(ST.PREFAB);}
    catch (e) {S.prefabs = {}; status(`${ST.PREFAB} 讀不了：${e.message}`);}
    refresh();
}
SH.onProject(setProject);
// 別的分頁 ↗ 跳過來（粒子／特效／圖片分頁的 prefab 引用）：選第一個放了這個 prefab 的場景、選起那個實例
SH.onGoto(([id] = []) => {
    if (!id) return;
    const name = Object.keys(S.data).find(n => S.data[n].prefabs?.some(o => o.prefab === id));
    if (name === undefined) return status(`prefab ${id} 還沒放在任何場景（從左上 prefab 庫拖進畫面）`);
    if (S.edit) S.edit = null;
    select(name, false);
    S.pick = S.data[name].prefabs.find(o => o.prefab === id).key;
    refresh();
});
SH.onSaved((file) => {
    if (!S.root) return;
    if (file === ST.FILE) queue(async () => {S.data = await ST.read(); refresh();});
    else if (file === ST.PREFAB) queue(async () => {S.prefabs = await ST.read(ST.PREFAB); refresh();});
    else if (GAME_FILES.includes(file))
    {
        if (['role.json', 'item.json', 'ability.json', 'fx.json', 'particle.json', 'local.json'].includes(file)) queue(async () => {await loadRefs(); refresh();});
        reloadGame();
    }
});
S.center = [12, 8];
renderDatalists({eases: easeNames()});
frame.src = '/?sandbox=1';
refresh();

// 給無頭測試用
window.__sc = {S, setProject, addScene, dupScene, renameScene, deleteScene, select, undo, redo, addRole, setRole, setEquip, deleteRole, pickRole, toggleHide, arm, toGame, addProp, setProp, deleteObj, nudge, bakeProp, folderTree, exportProp: (key) => exportProp(propOf(key)), srcSize, addLight, setLight, addEmitter, setEmitter, setField, setPlaying,
               addInst, setInst, newPrefab, deletePrefab, toggleFold, enterEdit, exitEdit, setPf, composePrefab, renamePrefab, dupPrefab, moveAnchor,
               flush: () => S.q};
