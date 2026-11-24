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
import * as PSC from '../particle/schema.js';
import * as ST from './store.js';
import * as TL from './tiled.js';
import {cutDialog, cutMask, cutPiece} from './cut.js';
import {thumbOf, thumbBoxImgs} from '../../src/core/prefab.js';
import {scan} from '../texture/scan.js';

const LS = {sel: 'tools.scene.sel', grid: 'tools.scene.grid', role: 'tools.scene.lastRole', particle: 'tools.scene.lastParticle', prefab: 'tools.scene.lastPrefab', fold: 'tools.scene.fold',
            anchor: 'tools.scene.anchor', lightIcon: 'tools.scene.lightIcon', particleIcon: 'tools.scene.particleIcon', sizeLock: 'tools.scene.sizeLock', exportMode: 'tools.scene.exportMode', exportDir: 'tools.scene.exportDir'};
const ls = {
    get: (k) => {try {return localStorage.getItem(k);} catch {return null;}},
    set: (k, v) => {try {localStorage.setItem(k, v);} catch { /* 私密視窗 */ }},
};
const SLOTS = [['CAT_WEAPON', '武器'], ['CAT_HELMET', '頭盔'], ['CAT_CHESTPLATE', '護甲'], ['CAT_GLOVES', '手套'], ['CAT_BOOTS', '靴子'], ['CAT_EQUIP', '道具']];
// 這些檔改了 sandbox 的 DB 就舊了：整個重開
// （particle.json 不用：load 訊息帶整份，DB._particleDB 直接換）
const GAME_FILES = ['role.json', 'item.json', 'part.json', 'anim.json', 'fx.json', 'ability.json', 'local.json', 'textures.json'];

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
    part: null,                     // 選中 prefab 實例時右欄展開的零件（prefab.parts 的 index）
    psel: null,                     // 選中 prefab 實例時右鍵選取的方塊／零件 {key, boxes, parts}（pselOf()）
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
// files：要一起改的檔（預設只有 scenes.json；有 prefab.json 時 fn(scenes, prefabs)），多檔一筆 undo
// 會換場景／選別的東西的編輯：有 prefab 草稿先問 儲存／放棄／取消
async function commit(fn, sel, pick, files)
{
    if (S.draft && ((pick !== undefined && pick !== S.draft.key) || (sel !== undefined && sel !== S.sel)) && !await leaveDraft()) return;
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
        if (r.files[ST.ITEM]) reloadGame();
        if (sel !== undefined) select(sel, false);
        if (pick !== undefined) S.pick = pick;
        refresh();
    });
}

function gotData(data)
{
    if (data[ST.FILE]) S.data = data[ST.FILE];
    if (data[ST.PREFAB]) S.prefabs = data[ST.PREFAB];
    // particle.json（prefab 草稿儲存／組成寫的）：sandbox 不重開，load 訊息會帶整份（particlesMsg）
    if (data[ST.PARTICLE]) S.refs.particles = data[ST.PARTICLE];
    // item.json（道具實例的手上草稿儲存寫的）：sandbox 的道具資料舊了，呼叫端寫了就重開
    if (data[ST.ITEM]) S.refs.items = data[ST.ITEM];
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

// u.fops＝這一步搬過的檔（prefab 的圖改名／刪除）[{from, to}]：先確定搬得動、退 json、再搬檔
const step = (from, to, i) => queue(async () => {
    const u = from.pop();
    if (!u) return;
    const ops = u.fops && (i === 0 ? [...u.fops].reverse().map(o => ({from: o.to, to: o.from})) : u.fops);
    try
    {
        for (const o of ops ?? []) await checkMove(o.from, o.to);
        gotData(await ST.restore(u.files, i === 0));
        for (const o of ops ?? []) await moveTex(o.from, o.to);
    }
    catch (e) {from.push(u); throw e;}
    to.push(u);
    select(u.sel[i] in S.data ? u.sel[i] : null, false);
    S.pick = u.pick[i];
    if (ops) {await updateTextures(); reloadGame();}
    else if (u.files[ST.ITEM]) reloadGame();
    refresh();
});
// 有 prefab 草稿時退／重做的是草稿裡的步驟
const undo = () => (S.draft ? draftStep('undo', 'redo') : step(S.undo, S.redo, 0));
const redo = () => (S.draft ? draftStep('redo', 'undo') : step(S.redo, S.undo, 1));

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
    if (name !== S.sel) {S.pick = null; S.part = null; clearSel(); S.hidden.clear();}
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
const listOf = (key) => (isProp(key) ? 'props' : isEm(key) ? 'particles' : isLight(key) ? 'lights' : isInst(key) ? 'prefabs' : isItemInst(key) ? 'items' : 'roles');

// ---------- 道具實例 {key: 'i<n>', item, x, y（錨點＝握點）}：直立的 equip.sprite＋手上的零件 equip.parts（docs/scene-tool.md） ----------
// 分頁裡當成 prefab 實例用（instOf() 回傳帶 prefab＝@<道具>＝equip.parts 合成的 prefab，零件只有粒子／光源），
//  sandbox 收到的是 @item:<道具>＝那筆的零件＋最後墊一張道具圖（零件 index 不變）
const itemInsts = () => scene()?.items ?? [];
const isItemInst = (key) => /^i\d+$/.test(key ?? '');
const itemInstKey = (sc = scene()) => {let i = 1; while ((sc?.items ?? []).some(o => o.key === `i${i}`)) i++; return `i${i}`;};
const isHandItem = (it) => !!it?.equip && (it.cat === 'CAT_WEAPON' || it.cat === 'CAT_EQUIP');
const handItemIds = () => Object.keys(S.refs.items).filter(id => isHandItem(S.refs.items[id]));
const SYN = '@';
const isSyn = (id) => !!id?.startsWith(SYN);
// equip.parts ⇄ 合成 prefab（沒有＝空的）
const eqToPf = (e) => (e?.parts?.length ? {parts: structuredClone(e.parts)} : {});
// 草稿管的是哪個道具的手上（@<道具> 的草稿）
const draftItem = (d) => (d && isSyn(d.id) ? d.id.slice(SYN.length) : null);
// 道具的 equip（照草稿：@ 草稿的零件換成 equip.parts，沒零件＝拿掉）
function itemEquip(id)
{
    const e = S.refs.items[id]?.equip, d = S.draft;
    if (!e || draftItem(d) !== id) return e;
    const {parts, ...out} = e;
    if (d.pf?.parts?.length) out.parts = structuredClone(d.pf.parts);
    return out;
}
const eqParts = (e) => str(e?.parts ?? null);
const pidBase = (id) => (isSyn(id) ? id.slice(SYN.length) : id);
const itemPfId = (id) => `${SYN}${id}`;
const synPf = (id) => eqToPf(S.refs.items[id.slice(SYN.length)]?.equip);
const itemSandboxId = (id) => `@item:${id}`;
// sandbox 的道具實例：錨點＝握點、零件照自己的座標，最後墊道具圖；under 的 local 粒子排在道具圖後面（零件 depth），不 local 的 ItemView 看 under
function itemSandboxPf(id)
{
    const e = itemEquip(id) ?? {}, pf = pfOf(itemPfId(id)) ?? {};
    const ref = e.sprite && {img: e.sprite, ...(e.ox !== undefined && {ox: e.ox}), ...(e.oy !== undefined && {oy: e.oy}),
        sx: e.scale ?? 1, sy: e.scale ?? 1, depth: -1e4};
    return {parts: [...(pf.parts ?? []).map(p => (p.under ? {...p, depth: -2e4} : p)), ...(ref ? [ref] : [])]};
}
// 送 sandbox 的場景：道具實例接在 prefab 實例後面
const sceneMsg = (sc) => (sc.items?.length ? {...sc, prefabs: [...(sc.prefabs ?? []), ...sc.items.map(o => ({key: o.key, prefab: itemSandboxId(o.item), x: o.x, y: o.y}))]} : sc);

function addItemInst(item, x, y)
{
    if (S.sel === null) {status('先選或新增一個場景'); return Promise.resolve();}
    if (!isHandItem(S.refs.items[item])) {status(`${item} 不是拿在手上的道具（要有 equip 的武器／CAT_EQUIP）`); return Promise.resolve();}
    const key = itemInstKey();
    return editScene(sc => {(sc.items ??= []).push({key, item, x, y});}, key);
}

// ---------- prefab（docs/prefab.md）：prefab 庫＝prefab.json 全部；場景裡的實例 {key, prefab, x, y（錨點）, look?} ----------
const insts = () => scene()?.prefabs ?? [];
const instOf = (key) => {
    if (isItemInst(key)) {const o = itemInsts().find(x => x.key === key); return o && {...o, prefab: itemPfId(o.item)};}
    return insts().find(o => o.key === key);
};
const isInst = (key) => /^f\d+$/.test(key ?? '');
const instKey = (sc = scene()) => {let i = 1; while ((sc?.prefabs ?? []).some(o => o.key === `f${i}`)) i++; return `f${i}`;};
const PREFAB_FILES = [ST.FILE, ST.PREFAB];
// 狀態清單：預設 look＋零件的 look＋acts 切到的
const looksOf = (pf) => [...new Set([pf?.look, ...(pf?.parts ?? []).map(p => p.look), ...Object.values(pf?.acts ?? {})].filter(Boolean))];
// prefab 庫的圖示＝Tiled 縮圖 prefab-<id>.png；有草稿＝照草稿即時合成（同 renderThumb）
const pfIcon = (id, size) => {
    const d = S.draft?.id === id ? S.draft : null;
    if (!d) return IC.iconEl(TL.thumbKey(id), size);
    const cv = h('canvas', {width: size, height: size, style: `width:${size}px; height:${size}px; vertical-align:middle`});
    TL.renderThumb({...d.pf, thumb: d.thumb ?? undefined}).then(src => {
        const k = Math.min(size / src.width, size / src.height);
        const w = src.width * k, hh = src.height * k;
        cv.getContext('2d').drawImage(src, (size - w) / 2, (size - hh) / 2, w, hh);
    });
    return cv;
};

function addInst(prefab, x, y)
{
    if (S.sel === null) {status('先選或新增一個場景'); return Promise.resolve();}
    if (!S.prefabs[prefab]) {status(`prefab.json 沒有 ${prefab}`); return Promise.resolve();}
    ls.set(LS.prefab, prefab);
    const key = instKey();
    return editScene(sc => {(sc.prefabs ??= []).push({key, prefab, x, y});}, key);
}

async function setInst(key, patch)
{
    if (('prefab' in patch || 'item' in patch) && S.draft?.key === key && !await leaveDraft()) return renderRight();
    return editScene(sc => {
        const o = sc[listOf(key)]?.find(x => x.key === key);
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
}

// prefab 庫點一下：選目前場景第一個用它的實例、鏡頭移過去
function pickPrefab(id)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const o = insts().find(x => x.prefab === id);
    if (!o) return status(`這個場景還沒放 ${id}（拖進畫面放一個）`);
    pickRole(o.key);
    toGame({sb: 'focus', key: o.key});
}

// 用到這個 prefab 的實例：[[場景名, 個數]]
const prefabUses = (id) => Object.entries(S.data).map(([n, sc]) => [n, (sc.prefabs ?? []).filter(o => o.prefab === id).length]).filter(([, c]) => c);
async function deletePrefab(id, sure)
{
    if (S.draft?.id === id && !await leaveDraft()) return;
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

// ---------- prefab 內容（選中實例時右欄：prefab 欄位＋零件清單；docs/prefab.md） ----------
const LIGHT_KEYS = ['r', 'color', 'i', 'dir', 'arc', 'soft'];
const KINDS3 = ['props', 'particles', 'lights'];

// 組成 prefab：場景的擺設／發射點／光源（絕對座標）→ 零件（相對錨點 ax, ay）
function fromSyn(syn, ax, ay)
{
    const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    const rel = (o) => clean({x: o.x - ax || undefined, y: o.y - ay || undefined});
    const out = [];
    for (const {key, x, y, img, ...p} of syn.props ?? []) out.push(clean({img, ...rel({x, y}), ...p}));
    for (const {key, x, y, id, follow, def, every, ...p} of syn.particles ?? []) out.push(clean({particle: id, ...rel({x, y}), ...p}));
    for (const {key, x, y, follow, ...l} of syn.lights ?? [])
    {
        const light = clean(Object.fromEntries(LIGHT_KEYS.map(k => [k, l[k]])));
        out.push(clean({light, ...rel({x, y}), ...Object.fromEntries(Object.entries(l).filter(([k]) => !LIGHT_KEYS.includes(k)))}));
    }
    return out;
}

// ---------- 草稿：改 prefab 內容只動記憶體（sandbox 照草稿畫），按儲存才寫 prefab.json ----------
// S.draft＝{id, key（選中的實例）, base（開始時 prefab.json 那筆的 JSON，偵測別處改過）, pf, thumb（即時算的縮圖外框）,
//          ps（粒子副本 {particle id: def}：零件的粒子內容改的是這裡，儲存才寫 particle.json）, pbase（各粒子第一次碰時 particle.json 那筆的 JSON）,
//          undo, redo（{pf, ps, part}）}
const pfOf = (id) => (S.draft && S.draft.id === id ? S.draft.pf : isSyn(id) ? synPf(id) : S.prefabs[id]);
const draftOf = (id) => (S.draft?.id === id ? S.draft : null);
// 粒子內容：草稿裡有副本用副本
const pDef = (pid) => (pid && S.draft && pid in S.draft.ps ? S.draft.ps[pid] : S.refs.particles[pid]);
// 草稿裡還有零件在用的粒子副本（[新增] 後又換掉／刪掉零件的不算，儲存時不寫）
const livePs = (d) => Object.entries(d?.ps ?? {}).filter(([pid]) => d.pf?.parts?.some(p => p.particle === pid));
const particleIds = () => [...new Set([...Object.keys(S.refs.particles), ...livePs(S.draft).map(([pid]) => pid)])];
// 送給 sandbox 的 particle.json：草稿的粒子副本蓋上去
const particlesMsg = () => (S.draft && Object.keys(S.draft.ps).length ? {...S.refs.particles, ...S.draft.ps} : S.refs.particles);

// 送給 sandbox 的 prefab.json：草稿那筆換成草稿（點選範圍用即時算的縮圖外框）
function prefabsMsg()
{
    const d = S.draft, out = {...S.prefabs};
    if (d && !isSyn(d.id))
    {
        const pf = {...d.pf};
        if (d.thumb) pf.thumb = d.thumb; else delete pf.thumb;
        out[d.id] = pf;
    }
    for (const id of new Set(itemInsts().map(o => o.item))) out[itemSandboxId(id)] = itemSandboxPf(id);
    return out;
}

// 硬碟上那筆（@<道具>＝item.json 的 equip.parts 合成）
const diskPf = (id) => (isSyn(id) ? synPf(id) : S.prefabs[id]);
// 新草稿；ibase＝那時 item.json 的 equip.parts（@<道具> 的，偵測別處改過）
function newDraft(id, src)
{
    const iid = isSyn(id) ? id.slice(SYN.length) : null;
    return {id, key: S.pick, base: str(diskPf(id)), pf: structuredClone(src), ps: {}, pbase: {}, thumb: src?.thumb ?? null, undo: [], redo: [],
            ...(iid && {ibase: eqParts(S.refs.items[iid]?.equip)})};
}

// 改 prefab 內容：fn(那筆 prefab 的副本, 粒子副本 {id: def})，回傳 false＝沒改；第一次改才開始草稿
function editPf(id, fn)
{
    const src = pfOf(id);
    if (!src) {status(`prefab.json 沒有 ${id}`); return Promise.resolve();}
    const ps0 = draftOf(id)?.ps ?? {};
    const next = structuredClone(src), ps = structuredClone(ps0);
    if (fn(next, ps) === false || (str(next) === str(src) && str(ps) === str(ps0))) {renderRight(); return Promise.resolve();}
    S.draft ??= newDraft(id, src);
    const d = S.draft;
    for (const pid of Object.keys(ps)) if (!(pid in d.pbase)) d.pbase[pid] = str(S.refs.particles[pid] ?? null);
    if (!(H.take() && d.undo.length)) d.undo.push({pf: d.pf ?? structuredClone(src), ps: d.ps, part: S.part});
    d.redo = [];
    d.pf = next;
    d.ps = ps;
    liveThumb();
    refresh();
    return Promise.resolve();
}

// 草稿的縮圖外框（算圖大小要等）：算完還是同一份草稿才套
async function liveThumb()
{
    const d = S.draft, pf = d?.pf;
    if (!d) return;
    const t = await thumbFor(pf);
    if (S.draft !== d || d.pf !== pf || str(t) === str(d.thumb)) return;
    d.thumb = t;
    syncGame();
    renderLib();
}

function draftStep(from, to)
{
    const d = S.draft, u = d[from].pop();
    if (!u) return status('草稿最早的一步了（再往前要先儲存或放棄）');
    d[to].push({pf: d.pf, ps: d.ps, part: S.part});
    ({pf: d.pf, ps: d.ps, part: S.part} = u);
    liveThumb();
    refresh();
}

// 儲存：prefab.json 寫草稿（粒子副本寫進 particle.json，只寫碰過的 id），收尾（縮圖外框、Tiled、file: 圖烤進 textures）併成同一筆 undo；
//  失敗留著草稿、回傳 false
async function saveDraft()
{
    const d = S.draft;
    if (!d) return true;
    const ps = livePs(d), syn = isSyn(d.id), iid = draftItem(d), eq = iid && itemEquip(iid);
    const files = [...PREFAB_FILES, ...(ps.length ? [ST.PARTICLE] : []), ...(iid ? [ST.ITEM] : [])];
    await commit((...args) => {
        const [, pfs] = args, particles = args[files.indexOf(ST.PARTICLE)], items = args[files.indexOf(ST.ITEM)];
        if (!syn)
        {
            if (!(d.id in pfs)) throw new Error(`prefab.json 沒有 ${d.id}`);
            pfs[d.id] = structuredClone(d.pf);
        }
        for (const [pid, def] of ps) particles[pid] = structuredClone(def);
        // 道具的手上：equip.parts（沒零件＝拿掉）
        if (iid)
        {
            const e = items[iid]?.equip;
            if (!e) throw new Error(`item.json 沒有 ${iid} 的 equip`);
            if (eq.parts) e.parts = structuredClone(eq.parts); else delete e.parts;
        }
    }, undefined, undefined, files);
    if ((!syn && str(S.prefabs[d.id]) !== str(d.pf)) || ps.some(([pid, def]) => str(S.refs.particles[pid]) !== str(def)) ||
        (iid && eqParts(S.refs.items[iid]?.equip) !== eqParts(eq))) return false;
    S.draft = null;
    if (!syn)
    {
        const n0 = S.undo.length;
        try {await finishEdit(d.id);}
        catch (e) {status(`prefab 收尾失敗：${e.message}`);}
        mergeUndo(n0);
    }
    refresh();
    return true;
}

function dropDraft()
{
    S.draft = null;
    refresh();
}

// 要離開草稿（取消選取、換場景、換 prefab、刪掉…）：問 儲存／放棄／取消，回傳 true＝可以繼續
async function leaveDraft()
{
    if (!S.draft) return true;
    const iid = draftItem(S.draft), what = iid ? `道具 ${iid} 的手上` : `prefab ${S.draft.id}`;
    const v = await ask('還沒存', `${what} 改了還沒存`, [['save', '儲存'], ['drop', '放棄'], ['cancel', '取消']]);
    if (v === 'save') return saveDraft();
    if (v === 'drop') {dropDraft(); return true;}
    return false;
}

// 別處改了草稿那筆 prefab 或草稿碰過的粒子（prefab.json／particle.json 廣播）：一起問 保留草稿／用新的
async function draftConflict()
{
    const d = S.draft;
    if (!d) return;
    const iid = draftItem(d), syn = isSyn(d.id);
    const pfChanged = !syn && str(S.prefabs[d.id]) !== d.base;
    const itemChanged = !!iid && eqParts(S.refs.items[iid]?.equip) !== d.ibase;
    const pids = livePs(d).map(([pid]) => pid).filter(pid => str(S.refs.particles[pid] ?? null) !== d.pbase[pid]);
    if (!pfChanged && !itemChanged && !pids.length) return;
    if (!syn && !S.prefabs[d.id]) {status(`prefab ${d.id} 在別處被刪了，草稿丟掉`); return dropDraft();}
    if (iid && !S.refs.items[iid]?.equip) {status(`道具 ${iid} 在別處被刪了，草稿丟掉`); return dropDraft();}
    const what = [pfChanged && `prefab ${d.id}`, itemChanged && `道具 ${iid} 的手上`, ...pids.map(pid => `粒子 ${pid}`)].filter(Boolean).join('、');
    const v = await ask('在別處改了', `${what} 在別處改過了（你還有沒存的草稿）`, [['keep', '保留我的草稿'], ['theirs', '放棄草稿用新的']]);
    if (S.draft !== d) return;
    if (v === 'theirs') return dropDraft();
    if (!syn) d.base = str(S.prefabs[d.id]);
    if (iid) d.ibase = eqParts(S.refs.items[iid]?.equip);
    for (const pid of pids) d.pbase[pid] = str(S.refs.particles[pid] ?? null);
}

// 零件欄位：patch 值 undefined＝拿掉；光源的 r/color/… 寫進 light
function setPart(id, i, patch)
{
    return editPf(id, pf => {
        const p = pf.parts?.[i];
        if (!p) throw new Error(`prefab ${id} 沒有第 ${i + 1} 個零件`);
        for (const [k, v] of Object.entries(patch))
        {
            const o = p.light && LIGHT_KEYS.includes(k) ? p.light : p;
            if (v === undefined) delete o[k]; else o[k] = v;
        }
    });
}

// 新的粒子 id（particle.json＋草稿副本都沒有）：預設 <base>-<n> 最小空號；問到的不合法／撞名＝null
const NEW_PARTICLE = '[新增]';
function particleIdError(pid)
{
    if (!pid) return 'id 不能空白';
    if (!PREFAB_ID.test(pid)) return 'id 只能用英數字、_、-';
    if (particleIds().includes(pid)) return `已經有粒子「${pid}」`;
}
const freePid = (base, num) => {
    const ids = particleIds();
    if (!num && !ids.includes(base)) return base;
    let i = num ? 1 : 2;
    while (ids.includes(`${base}-${i}`)) i++;
    return `${base}-${i}`;
};
async function askParticleId(title, def, pid)
{
    pid ??= await askName(title, def);
    if (pid === null) return null;
    const err = particleIdError(pid);
    if (err) {status(err); return null;}
    return pid;
}

// 加零件（放在錨點、永遠出現）：kind＝png／particle／light，v＝圖／粒子 id（沒給就問；粒子 NEW_PARTICLE＝範本，再問新 id＝pid）
async function addPart(id, kind, v, pid)
{
    if (kind === 'png') v ??= await askImg();
    else if (kind === 'particle') v ??= await askId('加粒子（[新增]＝新建一筆 particle.json，存 prefab 時一起寫）', particleIds(), ls.get(LS.particle), [NEW_PARTICLE]);
    if (kind !== 'light' && !v) return;
    if (kind === 'particle' && v === NEW_PARTICLE)
    {
        v = await askParticleId('新粒子 id', freePid(pidBase(id), true), pid);
        if (!v) return;
        pid = v;
    }
    else pid = null;
    if (kind === 'particle') ls.set(LS.particle, v);
    const part = kind === 'png' ? {img: v} : kind === 'particle' ? {particle: v} : {light: {...LIGHT}};
    S.part = pfOf(id)?.parts?.length ?? 0;
    if (isFolded('right.parts')) toggleFold('right.parts');
    await editPf(id, (pf, ps) => {
        (pf.parts ??= []).push(part);
        if (pid) ps[pid] = PSC.template();
    });
}

function movePart(id, i, d)
{
    const n = pfOf(id)?.parts?.length ?? 0;
    if (i + d < 0 || i + d >= n) return Promise.resolve();
    if (S.part === i) S.part = i + d;
    else if (S.part === i + d) S.part = i;
    remapSel(j => (j === i ? i + d : j === i + d ? i : j));
    return editPf(id, pf => {const a = pf.parts; [a[i], a[i + d]] = [a[i + d], a[i]];});
}

// 刪零件（可以好幾個，一筆 undo）
function delParts(id, idxs)
{
    const del = new Set(idxs);
    if (!del.size) return Promise.resolve();
    const shift = (j) => (del.has(j) ? null : j - idxs.filter(k => k < j).length);
    S.part = S.part === null ? null : shift(S.part);
    remapSel(shift);
    return editPf(id, pf => {
        if (!pf.parts?.some((_, j) => del.has(j))) return false;
        pf.parts = pf.parts.filter((_, j) => !del.has(j));
        if (!pf.parts.length) delete pf.parts;
    });
}
const delPart = (id, i) => delParts(id, [i]);

function openPart(i)
{
    S.part = i;
    if (i !== null && isFolded('right.parts')) toggleFold('right.parts');
    toGame(inspectMsg());
    renderRight();
}

// 選中的實例在 sandbox 畫選取的方塊、選取的零件外框（照草稿）
function inspectMsg()
{
    const o = instOf(S.pick), pf = o && pfOf(o.prefab);
    if (!pf) return {sb: 'inspect', inspect: null};
    const s = pselOf();
    // 道具實例：手上的東西沒有占地方塊
    return {sb: 'inspect', inspect: {key: o.key, boxes: Object.fromEntries(BOXES.map(([k]) => [k, (!o.item && pf[k]) || null])),
        boxSel: o.item ? [] : s.boxes.filter(k => pf[k]), partSel: selParts(), part: S.part}};
}

// 選取的零件（停用的不算）
const selParts = () => {
    const o = instOf(S.pick), parts = o && pfOf(o.prefab)?.parts;
    return parts ? pselOf().parts.filter(i => parts[i] && !parts[i].off) : [];
};

// 選取的零件一起移（草稿，連按併一步 undo）；moves＝[{i, x, y}]（sandbox 拖曳放開）
function moveParts(id, moves)
{
    return editPf(id, pf => {
        for (const {i, x, y} of moves)
        {
            const p = pf.parts?.[i];
            if (!p) continue;
            if (x) p.x = x; else delete p.x;
            if (y) p.y = y; else delete p.y;
        }
    });
}
function nudgeParts(dx, dy)
{
    const o = instOf(S.pick), parts = o && pfOf(o.prefab)?.parts;
    if (!parts) return;
    H.arrow('part.nudge');
    return moveParts(o.prefab, selParts().map(i => ({i, x: (parts[i].x ?? 0) + dx, y: (parts[i].y ?? 0) + dy})));
}

// 圖的原始大小（file: 圖＝原圖，不含 pct）
async function imgSize(img)
{
    if (isFile(img)) {const i = await loadImg(fileUrl(img)); return i && {w: i.naturalWidth, h: i.naturalHeight};}
    const r = await IC.frameOf(img);
    return r && {w: r.f.w, h: r.f.h};
}

// 縮圖外框：所有狀態的 png 零件（停用的不算）旋轉後的外接框聯集，相對錨點；沒有＝null（畫法同 tiled.js 的 renderThumb）
async function thumbFor(pf)
{
    let box = null;
    for (const p of thumbBoxImgs(pf))
    {
        const s = await imgSize(p.img);
        if (!s) continue;
        const k = isFile(p.img) ? (p.pct ?? 100) / 100 : 1;
        const kx = (p.flip ? -1 : 1) * (p.sx ?? 1) * k, ky = (p.sy ?? 1) * k;
        const a = (p.angle ?? 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
        const ox = p.ox ?? 0.5, oy = p.oy ?? 1;
        for (const [u, v] of [[-ox, -oy], [1 - ox, -oy], [-ox, 1 - oy], [1 - ox, 1 - oy]])
        {
            const lx = u * s.w * kx, ly = v * s.h * ky;
            const x = (p.x ?? 0) + lx * cos - ly * sin, y = (p.y ?? 0) + lx * sin + ly * cos;
            box = box ? {l: Math.min(box.l, x), t: Math.min(box.t, y), r: Math.max(box.r, x), b: Math.max(box.b, y)} : {l: x, t: y, r: x, b: y};
        }
    }
    if (!box) return null;
    const q = (v) => Math.round(v * 1e6) / 1e6;     // 轉 90° 之類的浮點誤差不要多算一格
    const x = Math.floor(q(box.l)), y = Math.floor(q(box.t));
    return {x, y, w: Math.ceil(q(box.r)) - x, h: Math.ceil(q(box.b)) - y};
}

// 收尾（改了 prefab 內容／組成時）：算縮圖外框；file: 圖照 pct 烤進 textures/prefabs/<id>/<id>-<檔名>.png、改寫成 texture key
async function finishEdit(id)
{
    const pf = S.prefabs[id];
    if (!pf) return '';
    const thumb = await thumbFor(pf);
    const warn = await thumbShift(id, thumbOf(pf), thumbOf({thumb}));
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
            // prefab-* 是 Tiled 縮圖（tiled.js 的 thumbKey）專用，烤圖不能進這個命名空間
            const base = `${id}-${img.split('/').pop().replace(/\.png$/i, '')}`.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^prefab-/i, 'prefab_');
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
    if (warn) status(warn);
    return warn;
}

// 縮圖範圍變了而且有地圖在用：Tiled 物件的左下角不動，錨點跟著偏（只提示，不改地圖）
async function thumbShift(id, t0, t1)
{
    if (str(t0) === str(t1)) return '';
    const used = TL.usedBy(await TL.prefabRefs(S.root, id), id);
    if (!used.length) return '';
    const dx = t0.x - t1.x, dy = (t0.y + t0.h) - (t1.y + t1.h);
    return `⚠ ${id} 的縮圖範圍變了，地圖上的物件錨點會偏 (${dx}, ${dy})，要到 Tiled 重新擺：${used.join('；')}`;
}

// 重產縮圖（零件的 png 在別處改了、手改 prefab.json 之後）：ids 沒給＝全部；一筆 undo
async function regenThumbs(ids = Object.keys(S.prefabs))
{
    if (S.draft && ids.includes(S.draft.id) && !await leaveDraft()) return;
    const n0 = S.undo.length, warns = [];
    for (const id of ids)
    {
        try {const w = await finishEdit(id); if (w) warns.push(w);}
        catch (e) {warns.push(`${id} 重產失敗：${e.message}`);}
    }
    while (S.undo.length > n0 + 1) mergeUndo(S.undo.length - 1);
    renderLib();
    status(warns.length ? warns.join('　') : `重產了 ${ids.length} 個 prefab 的縮圖`);
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
function setPf(id, patch)
{
    return editPf(id, pf => {
        for (const [k, v] of Object.entries(patch)) {if (v === undefined) delete pf[k]; else pf[k] = v;}
    });
}

// 狀態下拉：''＝沒有（零件：永遠出現）＋現有狀態＋「新狀態…」
function lookSelect(id, value, set, none = '（永遠出現）')
{
    const looks = looksOf(pfOf(id));
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

// png 零件掛的 fx.json（idle 等 tween）
function fxSelect(value, set)
{
    const sel = h('select', {dataset: {k: 'fx'}, onchange: () => set(sel.value || undefined)},
        h('option', {value: ''}, '（沒有）'), Object.keys(S.refs.fx).map(id => h('option', {value: id}, id)));
    if (value && !S.refs.fx[value]) sel.append(h('option', {value}, `⚠ ${value}`));
    sel.value = value ?? '';
    return sel;
}

const BOXES = [['grid', '占格（grid）'], ['zone', '可點（zone）']];
// 有右鍵動作卻沒有 zone＝遊戲裡點不到
const noZone = (pf) => !pf?.zone && Object.keys(pf?.acts ?? {}).length > 0;

// 選取（右欄右鍵切換，可多選；只在記憶體、只作用在選中的實例，換實例／取消選取／換場景清掉）：
//  選取的方塊才在 sandbox 畫＋4 邊把手，選取的零件才有外框、點得到、拖得動（所有選取的一起動）、吃方向鍵／Del；
//  停用（off）的零件不能選。S.psel＝{key（實例）, boxes: [k…], parts: [i…]}
const pselOf = () => (S.psel?.key === S.pick && instOf(S.pick) ? S.psel : {key: S.pick, boxes: [], parts: []});
const clearSel = () => {S.psel = null;};
function editSel(fn)
{
    const s = pselOf();
    S.psel = {key: s.key, boxes: [...s.boxes], parts: [...s.parts]};
    fn(S.psel);
    toGame(inspectMsg());
    renderRight();
}
const toggle = (a, v) => (a.includes(v) ? a.filter(x => x !== v) : [...a, v]);
function toggleBoxSel(k)
{
    if (!pfOf(instOf(S.pick)?.prefab)?.[k]) return;
    editSel(s => {s.boxes = toggle(s.boxes, k);});
}
function togglePartSel(i)
{
    if (pfOf(instOf(S.pick)?.prefab)?.parts?.[i]?.off) return;
    editSel(s => {s.parts = toggle(s.parts, i);});
}
// 零件順序變了（↑↓／✕）：選取跟著搬；map(i)＝新 index，null＝拿掉
const remapSel = (map) => {if (S.psel) S.psel.parts = S.psel.parts.map(map).filter(i => i !== null);};

// 零件勾選＝作用：沒勾寫 off:true（草稿），遊戲跟 sandbox 都不建；停用時順便取消選取
function setPartOn(id, i, on)
{
    if (!on && S.psel) S.psel.parts = S.psel.parts.filter(j => j !== i);
    return setPart(id, i, {off: on ? undefined : true});
}

// sandbox 拖選取的方塊／零件中：右欄欄位直接跟著變＋黃框（不寫草稿，放開才照 box／moveParts 寫）；
//  開始時自動打開屬性區／展開零件、捲到看得見；end＝拿掉黃框
const LIVE_SIDE = {l: ['x', 'w'], r: ['w'], t: ['y', 'h'], b: ['h']};

function dragLive(m)
{
    if (m.key !== S.pick) return;
    const q = (sel) => document.querySelector(`#right ${sel}`);
    if (m.end) {document.querySelectorAll('#right input.live').forEach(e => e.classList.remove('live')); return;}
    let cells;
    if (m.k)
    {
        if (m.start && isFolded('right.props')) toggleFold('right.props');
        cells = ['x', 'y', 'w', 'h'].map(f => [q(`[data-k="${m.k}.${f}"]`), m.box[f], LIVE_SIDE[m.side]?.includes(f)]);
    }
    else
    {
        if (m.start && S.part !== m.part) openPart(m.part);
        cells = Object.entries(m.light ?? {x: m.x, y: m.y}).map(([f, v]) => [q(`.partform [data-k="${f}"]`), v, true]);
    }
    for (const [el, v, live] of cells)
    {
        if (!el) continue;
        el.value = v;
        el.classList.toggle('live', live);
    }
    if (m.start) cells.find(([el, , live]) => el && live)?.[0].scrollIntoView({block: 'nearest'});}


function prefabPanel(id)
{
    const pf = pfOf(id) ?? {};
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const acts = Object.entries(pf.acts ?? {});
    const setPf1 = (patch) => setPf(id, patch);
    const setActs = (list) => setPf1({acts: list.length ? Object.fromEntries(list) : undefined, ...(pf.defAct && !list.some(([a]) => a === pf.defAct) && {defAct: undefined})});
    const actRow = ([a, v], i) => h('tr', {dataset: {act: a}},
        h('td', null, h('input', {size: 10, value: a, dataset: {k: `act${i}`}, onchange: (e) => {
            const n = e.target.value.trim();
            if (!PREFAB_ID.test(n)) {status('動作 id 只能用英數字、_、-'); return renderRight();}
            setActs(acts.map((x, j) => (j === i ? [n, x[1]] : x)));
        }}), S.refs.local[a] ? null : h('span', {class: 'warn', title: 'local.json 沒有這個 key：遊戲選單會顯示紅字（到文字分頁補）'}, ' ⚠')),
        h('td', null, '→ ', lookSelect(id, v, (nv) => setActs(acts.map((x, j) => (j === i ? [a, nv ?? ''] : x))), '（選狀態）')),
        h('td', null, h('button', {title: '拿掉這個動作', onclick: () => setActs(acts.filter((_, j) => j !== i))}, '✕')));
    const defSel = h('select', {dataset: {k: 'defAct'}, onchange: () => setPf1({defAct: defSel.value || undefined})},
        h('option', {value: ''}, '（沒有：照遊戲預設）'), acts.map(([a]) => h('option', {value: a}, a)));
    defSel.value = pf.defAct ?? '';
    const boxRow = ([k, name]) => {
        const b = pf[k];
        const n = (f) => h('input', {type: 'number', step: 1, value: b?.[f] ?? '', class: 'n', dataset: {k: `${k}.${f}`}, disabled: !b,
            onchange: (e) => e.target.value !== '' && setPf1({[k]: {...b, [f]: +e.target.value}})});
        const on = h('input', {type: 'checkbox', checked: !!b, dataset: {k: `${k}.on`}, title: '沒勾＝沒有（沒 grid＝不佔格、沒 zone＝點不到）',
            onchange: (e) => setPf1({[k]: e.target.checked ? {x: -16, y: -32, w: 32, h: 32} : undefined})});
        const zw = k === 'zone' && noZone(pf) && h('span', {class: 'warn', title: '有右鍵動作卻沒有 zone：遊戲裡點不到'}, ' ⚠');
        const picked = !!b && pselOf().boxes.includes(k);
        // 點數字欄／勾選框不算選取
        return h('tr', {class: picked ? 'picked' : '', dataset: {box: k}, title: b ? '左鍵：選取（sandbox 畫出來、拖四邊改大小），再點取消，可多選' : '',
            onclick: (e) => {if (!e.target.closest('input')) toggleBoxSel(k);}},
            h('td', {class: 'k'}, on, ' ', name, zw),
            h('td', null, n('x'), n('y'), ' ', n('w'), '×', n('h')));
    };
    const d = draftOf(id), t = d ? d.thumb : pf.thumb;
    const warn = (acts.some(([a]) => !S.refs.local[a]) || noZone(pf)) && h('span', {class: 'warn', title: '有動作 id 不在 local.json，或有右鍵動作卻沒有 zone'}, ' ⚠');
    return [
        ...foldSec('right.props', ['屬性', warn], () => [
            h('table', {class: 'props'},
                row('預設狀態', lookSelect(id, pf.look, (v) => setPf1({look: v}), '（沒有）')),
                row('左鍵動作', defSel)),
            h('div', {class: 'sec'}, '右鍵動作', h('span', {class: 'dim'}, '（動作 id → 切到的狀態；選單文字＝local.json 的 id）')),
            h('table', {class: 'props'}, acts.map(actRow)),
            h('div', {class: 'row2'}, h('button', {dataset: {k: 'addAct'}, onclick: () => {
                let n = 'turn_on';
                for (let i = 2; acts.some(([a]) => a === n); i++) n = `act${i}`;
                setActs([...acts, [n, pf.look ?? '']]);
            }}, '＋ 動作'), warn && h('button', {onclick: () => SH.gotoTab('local')}, '↗ 文字分頁')),
            h('div', {class: 'sec'}, '占地方塊', h('span', {class: 'dim'}, '（相對錨點的左上角＋寬高；沒勾＝沒有；Tiled 物件有寫量邊的 gl/zt… 就蓋掉）')),
            h('table', {class: 'props'}, BOXES.map(boxRow)),
            h('div', {class: 'dim'}, t ? `縮圖外框 ${t.x},${t.y} ${t.w}×${t.h}（照預設狀態的 png 自動算）` : '縮圖外框：照預設狀態的 png 自動算'),
        ]),
    ];
}

// 零件自己的粒子（{def}）已不支援：遊戲不畫，列 ⚠、表單只能換成 particle.json 的 id
const isParticle = (p) => !!(p.particle || p.def);
const oldDef = (p) => !!p.def && !p.particle;
const partName = (p) => (p.img ? propName(p) : oldDef(p) ? '⚠ 零件自己的粒子（已不支援）' : p.particle ?? `光源 r${p.light?.r ?? ''}`);

// 用到這個粒子 id 的地方（prefab 照草稿、能力／道具／特效）：['prefab forge', …]，同一筆用幾次列幾次
function particleUsers(pid)
{
    const out = [];
    const walk = (v, who) => {
        if (Array.isArray(v)) return v.forEach(x => walk(x, who));
        if (!v || typeof v !== 'object') return;
        for (const [k, x] of Object.entries(v)) {if ((k === 'particle' || k === 'tickParticle') && x === pid) out.push(who); else walk(x, who);}
    };
    const pfs = S.draft && !isSyn(S.draft.id) ? {...S.prefabs, [S.draft.id]: S.draft.pf} : S.prefabs, iid = draftItem(S.draft);
    const items = iid ? {...S.refs.items, [iid]: {...S.refs.items[iid], equip: itemEquip(iid)}} : S.refs.items;
    for (const [tab, data] of [['prefab', pfs], ['能力', S.refs.abilities], ['道具', items], ['特效', S.refs.fx]])
        for (const [o, v] of Object.entries(data ?? {})) walk(v, `${tab} ${o}`);
    return out;
}
const partIcon = (p) => (p.img ? imgEl(p.img, 20) : isParticle(p) ? h('span', null, '🔥') : h('span', {title: `光色 ${p.light?.color ?? '#ffcc88'}`}, '💡'));

// 零件清單：一列一個，點一下在下面展開表單（一次一個）；不屬於這個實例目前狀態的標灰
function partsPanel(o)
{
    const id = o.prefab, pf = pfOf(id) ?? {}, parts = pf.parts ?? [], look = o.look ?? pf.look;
    const btn = (t, title, fn) => h('button', {title, onclick: (e) => {e.stopPropagation(); fn();}}, t);
    const add = (k, kind, t) => h('button', {dataset: {k}, onclick: () => addPart(id, kind)}, t);
    return foldSec('right.parts', `${o.item ? '手上零件' : '零件'}（${parts.length}）`, () => [
        ...parts.flatMap((p, i) => [
            h('div', {class: `part${(p.look && p.look !== look) || p.off ? ' off' : ''}${pselOf().parts.includes(i) && !p.off ? ' picked' : ''}`, dataset: {part: i},
                title: '左鍵：選取（sandbox 外框、拖曳、方向鍵、Del），再點取消，可多選；右鍵：展開／收起表單',
                onclick: () => togglePartSel(i), oncontextmenu: (e) => {e.preventDefault(); openPart(i === S.part ? null : i);}},
                h('input', {type: 'checkbox', checked: !p.off, dataset: {k: `part${i}.on`}, title: '作用：沒勾＝停用（off，遊戲跟 sandbox 都不建，資料留著）',
                    onclick: (e) => e.stopPropagation(), onchange: (e) => setPartOn(id, i, e.target.checked)}),
                partIcon(p), h('span', {class: 'id'}, partName(p)), p.look && h('span', {class: 'lab'}, p.look), h('span', {class: 'grow'}),
                btn('↑', '往前（同深度時畫在下面）', () => movePart(id, i, -1)), btn('↓', '往後', () => movePart(id, i, 1)), btn('✕', '拿掉這個零件', () => delPart(id, i))),
            i === S.part && h('div', {class: 'partform'},
                !oldDef(p) && h('div', {class: 'row2'}, h('button', {dataset: {k: 'toScene'}, title: '從 prefab 拿掉，變成場景的擺設／發射點／光源（位置不動；狀態／特效不帶過去；立刻寫檔）',
                    onclick: () => partsToScene(o.key, [i])}, '移到場景')),
                ...partRows(id, i, p)),
        ]),
    ], [!o.item && add('addPng', 'png', '＋png'), add('addParticle', 'particle', '＋粒子'), add('addLight', 'light', '＋光源')].filter(Boolean));
}

// 道具手上的零件（@<道具>＝equip.parts）：粒子不出深度、狀態，多一個 under；光源不出狀態
function partRows(id, i, p)
{
    const lite = isSyn(id);
    const set = (patch) => setPart(id, i, patch);
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const n = (k, step, ph, src = p) => h('input', {type: 'number', step, value: src[k] ?? '', placeholder: ph, class: 'n', dataset: {k},
        onchange: (e) => set({[k]: e.target.value === '' ? undefined : +e.target.value})});
    const pos = row('位置', n('x', 1, '0'), ' ', n('y', 1, '0'));
    const look = row('狀態', lookSelect(id, p.look, (v) => set({look: v})));
    if (p.img) return [
        h('div', {class: 'row2'}, imgEl(p.img, 48), h('span', {class: 'dim', style: 'word-break: break-all'}, p.img),
            h('button', {onclick: async () => {const v = await askImg(p.img); if (v) set({img: v, pct: isFile(v) ? p.pct : undefined});}}, '換圖…'),
            canCut(p) && h('button', {dataset: {k: 'cut'}, title: '手繪圈出後片，切成前片＋後片兩個零件（PNG 立刻寫進 textures/，零件改在草稿）', onclick: () => cutPart(id, i)}, '切前後片…')),
        h('table', {class: 'props'},
            pos,
            ...sizeRows(p, row, set, `${id}#${i}`),
            row('翻轉', h('input', {type: 'checkbox', checked: !!p.flip, dataset: {k: 'flip'}, onchange: (e) => set({flip: e.target.checked || undefined})})),
            row('角度', n('angle', 1, '0')),
            row('錨點', n('ox', 0.05, '0.5'), ' ', n('oy', 0.05, '1')),
            row('深度', n('depth', 1, '0'), h('span', {class: 'dim'}, ' prefab 裡的前後（大的在前）')),
            look,
            row('特效', fxSelect(p.fx, (v) => set({fx: v})))),
    ];
    if (isParticle(p))
    {
        const pid = p.particle, def = pDef(pid), k = `${id}#${i}`;
        const idSel = h('select', {dataset: {k: 'particle'}, onchange: () => changePartParticle(id, i, idSel.value)}, [NEW_PARTICLE, ...particleIds()].map(v => h('option', {value: v}, v)));
        if (pid && !def) idSel.append(h('option', {value: pid}, `⚠ ${pid}`));
        if (oldDef(p)) idSel.append(h('option', {value: ''}, '⚠ 零件自己的（選一個 id）'));
        idSel.value = pid ?? '';
        if (oldDef(p)) return [h('div', {class: 'warn', dataset: {k: 'oldDef'}}, '零件自己的粒子已不支援（遊戲不畫）：選一個 particle.json 的 id，或 [新增] 一筆'),
            h('table', {class: 'props'}, row('粒子', idSel), pos, look)];
        if (PQ.key !== k) {PQ.key = k; PQ.drafts = {};}
        PQ.of = [id, i];
        PQ.data = {[k]: def};
        const users = particleUsers(pid), dirty = S.draft?.id === id && pid in S.draft.ps;
        return [
            h('table', {class: 'props'},
                row('粒子', idSel, ' ', S.refs.particles[pid] && h('button', {title: '到粒子分頁（草稿裡改的要先存 prefab）', onclick: () => SH.gotoTab('particle', [pid])}, '↗'),
                    h('span', {class: 'dim'}, ' x '), n('x', 1, '0'), h('span', {class: 'dim'}, ' y '), n('y', 1, '0')),
                !lite && row('深度', Object.assign(n('depth', 1, '0'), {disabled: !def?.local}),
                    h('span', {class: 'dim', dataset: {k: 'depthNote'}}, def?.local ? ' 跟 png 一起排（大的在前），下面的「深度」不管'
                        : ' 勾 local 才能排進零件；沒勾＝整個在 prefab 前面（下面「深度」選目標底下＝後面）')),
                lite && row('後面', h('input', {type: 'checkbox', checked: !!p.under, dataset: {k: 'under'}, onchange: (e) => set({under: e.target.checked || undefined})}),
                    h('span', {class: 'dim'}, def?.local ? ' 畫在道具後面' : ' 畫在手（整個手腕節點）後面')),
                !lite && look),
            ...foldSec('right.partParticle',
                h('span', {dataset: {k: 'defState'}}, `粒子內容：${pid}`,
                    !S.refs.particles[pid] ? h('span', {class: 'dim'}, '（新的，存 prefab 時寫進 particle.json）') : dirty ? h('span', {class: 'warn'}, ' ●') : null,
                    users.length > 1 && h('span', {class: 'warn', dataset: {k: 'shared'}, title: `改了這些地方一起變：\n${users.join('\n')}`}, ` 共用 ${users.length} 處`)),
                () => [!def ? h('div', {class: 'warn'}, `particle.json 沒有 ${pid}`) : h('div', {class: 'pform'}, PP.body(k, def))],
                def && [h('button', {dataset: {k: 'forkParticle'}, title: '把目前的內容複製成新的粒子 id，這個零件改用它（不影響共用的地方）', onclick: (e) => {e.stopPropagation(); forkPartParticle(id, i);}}, '另存新 id…'), PPF.modeBtn()]),
        ];
    }
    const l = p.light ?? {}, point = !(l.arc > 0 && l.arc < 360);
    return [
        h('table', {class: 'props'},
            pos,
            row('半徑', n('r', 10, '120', l)),
            row('光錐', n('arc', 5, '點光源', l), '°'),
            row('方向', Object.assign(n('dir', 15, '0', l), {disabled: point}), '°'),
            row('柔和', Object.assign(n('soft', 0.05, '0.2', l), {disabled: point})),
            row('顏色', h('input', {type: 'color', value: l.color ?? '#ffcc88', dataset: {k: 'color'}, onchange: (e) => set({color: e.target.value})})),
            row('強度', n('i', 0.1, '1', l)),
            !lite && look),
        h('div', {class: 'hint dim'}, '選取時 sandbox 畫範圍＋藍色把手：拖把手改半徑（聚光燈：中線末端的把手連方向一起改、弧兩端的把手改光錐；Shift 吸 16px／15°）'),
    ];
}

// ---------- 改名／複製 prefab ----------
// 改名連帶改所有場景的實例（地圖／template／道具的引用在之後的步驟補）
async function renamePrefab(from, to)
{
    if (S.draft?.id === from && !await leaveDraft()) return;
    to ??= await askName(`改名 prefab ${from}`, from);
    if (to === null || to === from) return;
    const err = prefabIdError(to);
    if (err) return status(err);
    await commit((scenes, pf) => {
        if (!(from in pf)) throw new Error(`prefab.json 沒有 ${from}`);
        ST.renameKey(pf, from, to);
        for (const sc of Object.values(scenes)) for (const o of sc.prefabs ?? []) if (o.prefab === from) o.prefab = to;
    }, undefined, undefined, PREFAB_FILES);
    if (ls.get(LS.prefab) === from) ls.set(LS.prefab, to);
    if (!S.prefabs[to]) return;
    if (isFolded(libOpen(from))) {toggleFold(libOpen(from)); toggleFold(libOpen(to));}
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
// 發射點有自己那份（def ✎）的寫進 particle.json：另存新 id（預設 <prefab>-<原 id>）或覆寫原 id；最後收尾（烤圖、縮圖外框）
// opt（測試用）＝{keys, id, particles?: {發射點 key: {mode: 'new'|'over', id?}}}，沒給的 ✎ 照預設另存新 id
async function composePrefab(start, opt)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const sc = scene();
    const all = [...props().map(o => ['props', o, `擺設 ${o.key}　${propName(o)}`]), ...emitters().map(o => ['particles', o, `粒子 ${o.key}　${o.id}${o.def ? ' ✎' : ''}`]),
                 ...lights().map(o => ['lights', o, `光源 ${o.key}`])];
    if (!all.length) return status('場景裡沒有擺設／粒子／光源可以組');
    const own = emitters().filter(o => o.def);
    const defPid = (pfId, o) => freePid(`${pfId}-${o.id}`);
    let pick, id, pmode = {};
    if (opt) ({keys: pick, id, particles: pmode = {}} = opt);
    else
    {
        let n = 'prefab';
        for (let i = 2; n in S.prefabs; i++) n = `prefab${i}`;
        const idInp = h('input', {size: 20, value: n});
        const checks = all.map(([, o, t]) => h('label', {style: 'display:block'}, h('input', {type: 'checkbox', value: o.key, checked: o.key === start || o.follow === start}), ' ', t));
        // ✎ 的發射點：每個一列，另存新 id（跟著 prefab id 改預設，手改過就不動）／覆寫原 id
        const rows = own.map(o => {
            const inp = h('input', {size: 20, value: defPid(n, o), dataset: {k: `pid.${o.key}`}});
            const users = particleUsers(o.id).length;
            const sel = h('select', {dataset: {k: `pmode.${o.key}`}, onchange: () => {inp.disabled = sel.value === 'over';}},
                h('option', {value: 'new'}, '另存新 id'), h('option', {value: 'over'}, `覆寫 ${o.id}${users ? `（共用 ${users} 處）` : ''}`));
            return {o, inp, sel, el: h('div', {class: 'row2'}, `${o.key}（${o.id} ✎）`, sel, inp)};
        });
        let last = n;
        idInp.oninput = () => {
            const v = idInp.value.trim();
            for (const r of rows) if (r.inp.value === defPid(last, r.o)) r.inp.value = defPid(v, r.o);
            last = v;
        };
        const p = ask('組成 prefab', [
            h('label', null, 'id ', idInp, h('span', {class: 'dim'}, '　英數字、_、-')),
            h('div', {class: 'dim', style: 'margin-top:6px'}, '要組進去的東西（錨點＝第一個勾的擺設；✎＝自己改過的粒子，要存進 particle.json）'),
            h('div', {class: 'treebox', style: 'height:auto; max-height:260px; padding:4px'}, checks),
            rows.length ? h('div', {class: 'dim', style: 'margin-top:6px'}, '✎ 的粒子（有勾到才用）：') : null,
            ...rows.map(r => r.el),
        ], [['ok', '組成'], ['cancel', '取消']]);
        idInp.select();
        if (await p !== 'ok') return;
        id = idInp.value.trim();
        pick = checks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
        pmode = Object.fromEntries(rows.map(r => [r.o.key, {mode: r.sel.value, id: r.inp.value.trim()}]));
    }
    const err = prefabIdError(id);
    if (err) return status(err);
    const chosen = all.filter(([, o]) => pick.includes(o.key));
    if (!chosen.length) return status('至少勾一個');
    // ✎ 的發射點 → particle.json 的 id（另存的不能撞名、彼此也不能重複）
    const writes = {}, pidOf = {};
    for (const [k, o] of chosen)
    {
        if (k !== 'particles' || !o.def) continue;
        const m = pmode[o.key] ?? {mode: 'new'};
        const pid = m.mode === 'over' ? o.id : (m.id || defPid(id, o));
        if (m.mode !== 'over')
        {
            const perr = particleIdError(pid) ?? (pid in writes ? `粒子 id「${pid}」重複了` : null);
            if (perr) return status(perr);
        }
        writes[pid] = structuredClone(o.def);
        pidOf[o.key] = pid;
    }
    const first = chosen.find(([k]) => k === 'props') ?? chosen[0];
    const anchor = absPos(sc, first[1]);
    const name = S.sel, key = instKey();
    const parts = toParts(sc, chosen, anchor.x, anchor.y, pidOf);
    const pw = Object.entries(writes);
    await commit((scenes, pf, particles) => {
        if (id in pf) throw new Error(`已經有 prefab「${id}」`);
        for (const [pid, def] of pw) particles[pid] = def;
        const s = scenes[name];
        if (!s) throw new Error(`找不到場景「${name}」`);
        pf[id] = {parts};
        dropFromScene(s, new Set(pick));
        (s.prefabs ??= []).push({key, prefab: id, x: anchor.x, y: anchor.y});
    }, undefined, key, pw.length ? [...PREFAB_FILES, ST.PARTICLE] : PREFAB_FILES);
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

// 場景裡東西的絕對位置（跟著角色／擺設的換算掉）
const absPos = (sc, o) => {const b = o.follow ? followBase(sc, o.follow) : null; return {x: (b?.x ?? 0) + o.x, y: (b?.y ?? 0) + o.y};};

// chosen＝[[list, 場景的東西]] → 零件（相對 ax, ay）；pidOf＝✎ 發射點 key → 寫進 particle.json 的 id
function toParts(sc, chosen, ax, ay, pidOf)
{
    const syn = {props: [], particles: [], lights: []};
    for (const [k, o] of chosen)
    {
        const {follow, every, ...rest} = o;
        syn[k].push({...rest, ...absPos(sc, o), ...(pidOf[o.key] && {id: pidOf[o.key], def: undefined})});
    }
    return fromSyn(syn, ax, ay);
}

// 從場景拿掉 gone（key 的 Set）；沒拿掉、卻跟著被拿走的擺設的換成絕對位置
function dropFromScene(s, gone)
{
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
}

// ---------- 加到 prefab：擺設／粒子／光源（擺設連跟著它的）加進場景裡某個實例的 prefab，位置換成相對它的錨點（docs/prefab.md） ----------
// 立刻寫 prefab.json＋scenes.json（✎ 的發射點自動另存 <prefab>-<原 id> 進 particle.json），收尾併成一筆 undo；有草稿先問
async function addToPrefab(start, fkey)
{
    if (S.draft && !await leaveDraft()) return;
    const sc = scene(), o = instOf(fkey), id = o?.prefab;
    if (!o) return status(`場景裡沒有 ${fkey}`);
    if (!S.prefabs[id]) return status(`prefab.json 沒有 ${id}`);
    const all = [...props().map(x => ['props', x]), ...emitters().map(x => ['particles', x]), ...lights().map(x => ['lights', x])];
    const chosen = all.filter(([, x]) => x.key === start || (isProp(start) && x.follow === start));
    if (!chosen.length) return status(`場景裡沒有 ${start}`);
    const writes = {}, pidOf = {};
    for (const [, x] of chosen.filter(([k, x]) => k === 'particles' && x.def))
    {
        const base = `${id}-${x.id}`, ids = particleIds();
        let pid = base;
        for (let i = 2; ids.includes(pid) || pid in writes; i++) pid = `${base}-${i}`;
        writes[pid] = structuredClone(x.def);
        pidOf[x.key] = pid;
    }
    const parts = toParts(sc, chosen, o.x, o.y, pidOf);
    const pw = Object.entries(writes), name = S.sel, n0 = S.prefabs[id].parts?.length ?? 0;
    await commit((scenes, pf, particles) => {
        const s = scenes[name], p = pf[id];
        if (!s?.prefabs?.some(x => x.key === fkey)) throw new Error(`場景裡沒有 ${fkey}`);
        if (!p) throw new Error(`prefab.json 沒有 ${id}`);
        for (const [pid, def] of pw) particles[pid] = def;
        dropFromScene(s, new Set(chosen.map(([, x]) => x.key)));
        (p.parts ??= []).push(...parts);
    }, undefined, fkey, pw.length ? [...PREFAB_FILES, ST.PARTICLE] : PREFAB_FILES);
    if ((S.prefabs[id]?.parts?.length ?? 0) !== n0 + parts.length) return;
    const u0 = S.undo.length;
    let warn = '';
    try {warn = await finishEdit(id);}
    catch (e) {status(`prefab 收尾失敗：${e.message}`);}
    mergeUndo(u0);
    S.pick = fkey;
    S.part = null;
    S.psel = {key: fkey, boxes: [], parts: parts.map((_, j) => n0 + j)};
    if (isFolded('right.parts')) toggleFold('right.parts');
    refresh();
    status(`加到 ${fkey}（${id}）：${chosen.map(([, x]) => x.key).join('、')}` + (pw.length ? `；粒子另存成 ${pw.map(([pid]) => pid).join('、')}` : '') + (warn ? `　${warn}` : ''));
}

// 右鍵選單的「加到 prefab ▸」：子選單列場景裡的實例
function addToItems(key, at)
{
    if (!insts().length) return [['加到 prefab（場景裡沒有實例）', null]];
    return [['加到 prefab ▸', () => menu(at, insts().map(o => [`${o.key}　${o.prefab}`, () => addToPrefab(key, o.key)]))]];
}

// ---------- 加到道具：發射點／光源 → 道具的 equip.parts 加一筆（從場景搬走，位置相對道具實例的錨點＝握點，✎ 發射點另存 <道具>-<原 id>）；
//            follow 丟掉；立刻寫 item.json＋scenes.json（＋particle.json）一筆 undo、有草稿先問 ----------
async function addToItem(key, ikey)
{
    if (S.draft && !await leaveDraft()) return;
    const sc = scene(), io = itemInsts().find(x => x.key === ikey), id = io?.item;
    if (!io) return status(`場景裡沒有 ${ikey}`);
    if (!S.refs.items[id]?.equip) return status(`item.json 沒有 ${id} 的 equip`);
    const e = emOf(key), l = !e && lightOf(key);
    if (!e && !l) return status(`${key} 不是發射點或光源`);
    let pid = e?.id, write = null;
    if (e?.def)
    {
        const base = `${id}-${e.id}`, ids = particleIds();
        pid = base;
        for (let i = 2; ids.includes(pid); i++) pid = `${base}-${i}`;
        write = structuredClone(e.def);
    }
    const [raw] = toParts(sc, [[e ? 'particles' : 'lights', e ?? l]], io.x, io.y, e?.def ? {[key]: pid} : {});
    const part = Object.fromEntries(Object.entries(raw).filter(([k]) => ['particle', 'light', 'x', 'y'].includes(k)));
    const name = S.sel, files = [ST.FILE, ST.ITEM, ...(write ? [ST.PARTICLE] : [])];
    await commit((scenes, items, particles) => {
        const s = scenes[name], eq = items[id]?.equip;
        if (!s?.items?.some(o => o.key === ikey)) throw new Error(`場景裡沒有 ${ikey}`);
        if (!eq) throw new Error(`item.json 沒有 ${id} 的 equip`);
        if (!s[e ? 'particles' : 'lights']?.some(o => o.key === key)) throw new Error(`場景裡沒有 ${key}`);
        if (write) particles[pid] = write;
        (eq.parts ??= []).push(part);
        dropFromScene(s, new Set([key]));
    }, undefined, ikey, files);
    status(`加到道具 ${id}：${e ? `粒子 ${pid}${write ? `（${e.id} ✎ 另存）` : ''}` : '光源'}`);
}

// 右鍵選單的「加到道具 ▸」（發射點、光源）：子選單列場景裡的道具實例
function toItemMenu(key, at)
{
    if (!isEm(key) && !isLight(key)) return [];
    if (!itemInsts().length) return [['加到道具（場景裡沒有道具實例）', null]];
    return [['加到道具 ▸', () => menu(at, itemInsts().map(o => [`${o.key}　${o.item}`, () => addToItem(key, o.key)]))]];
}

// ---------- 移到場景：prefab（或道具實例的 equip.parts）的零件搬成場景的擺設／發射點／光源（絕對位置＝實例錨點＋零件 x/y），拿掉它們（docs/prefab.md） ----------
// 場景沒有的 look／off／fx／under 丟掉（狀態列提示）；立刻寫 prefab.json（道具＝item.json）＋scenes.json，收尾併成一筆 undo；有草稿先問；選起新的第一個
async function partsToScene(fkey, idxs)
{
    idxs = [...new Set(idxs)].sort((a, b) => a - b);
    const o0 = instOf(fkey), id = o0?.prefab;
    if (!o0) return status(`場景裡沒有 ${fkey}`);
    const want = idxs.map(i => str(pfOf(id)?.parts?.[i]));
    if (!idxs.length || want.includes(undefined)) return;
    if (S.draft && !await leaveDraft()) return;
    const iid = isSyn(id) ? id.slice(SYN.length) : null, o = instOf(fkey), pf = iid ? (S.refs.items[iid]?.equip && diskPf(id)) : S.prefabs[id];
    if (!o || o.prefab !== id || !pf) return status(`${fkey} 不見了`);
    // 放棄草稿後零件可能不一樣了：不一樣就不搬
    if (idxs.some((i, j) => str(pf.parts?.[i]) !== want[j])) return status(`${id} 的零件變了（草稿放棄了），沒有移`);
    const sc = scene(), taken = new Set(), dropped = [];
    const free = (pre, list) => {let i = 1; while (taken.has(`${pre}${i}`) || (sc?.[list] ?? []).some(x => x.key === `${pre}${i}`)) i++; taken.add(`${pre}${i}`); return `${pre}${i}`;};
    const adds = idxs.filter(i => !oldDef(pf.parts[i])).map(i => {
        const {x, y, look, off, fx, under, img, particle, def, light, ...rest} = pf.parts[i];
        const lost = [look && `狀態 ${look}`, off && '停用', fx && `特效 ${fx}`, under && '後面'].filter(Boolean);
        if (lost.length) dropped.push(`零件 ${i + 1}：${lost.join('、')}`);
        const pos = {x: o.x + (x ?? 0), y: o.y + (y ?? 0)};
        if (img) return [i, 'props', {key: free('p', 'props'), img, ...pos, ...rest}];
        if (particle) return [i, 'particles', {key: free('e', 'particles'), id: particle, ...pos, ...rest}];
        return [i, 'lights', {key: free('l', 'lights'), ...pos, ...LIGHT, ...light, ...rest}];
    });
    if (!adds.length) return status('零件自己的粒子（已不支援）不能移');
    const name = S.sel, gone = new Set(adds.map(([i]) => i));
    await commit((scenes, pfs) => {
        const s = scenes[name], p = iid ? pfs[iid]?.equip : pfs[id];
        if (!s) throw new Error(`找不到場景「${name}」`);
        if (!p || idxs.some((i, j) => str(p.parts?.[i]) !== want[j])) throw new Error(`${id} 的零件在別處改了，沒有移`);
        p.parts = p.parts.filter((_, i) => !gone.has(i));
        if (!p.parts.length) delete p.parts;
        for (const [, k, x] of adds) (s[k] ??= []).push(x);
    }, undefined, adds[0][2].key, iid ? [ST.FILE, ST.ITEM] : PREFAB_FILES);
    const left = (iid ? diskPf(id) : S.prefabs[id])?.parts;
    if ((left?.length ?? 0) === pf.parts.length) return;
    const u0 = S.undo.length;
    let warn = '';
    if (!iid)
    {
        try {warn = await finishEdit(id);}
        catch (e) {status(`prefab 收尾失敗：${e.message}`);}
    }
    mergeUndo(u0);
    S.pick = adds[0][2].key;
    refresh();
    status(`${id} 的 ${adds.length} 個零件移到場景：${adds.map(([, , x]) => x.key).join('、')}` + (left ? '' : `（${id} 沒有零件了）`) +
           (dropped.length ? `；場景沒有、沒帶過去：${dropped.join('；')}` : '') + (warn ? `　${warn}` : ''));
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
    const look = h('select', {dataset: {k: 'instLook'}, onchange: () => setInst(o.key, {look: look.value || undefined})},
        h('option', {value: ''}, `（預設${pf?.look ? `：${pf.look}` : ''}）`), looks.map(v => h('option', {value: v}, v)));
    if (o.look && !looks.includes(o.look)) look.append(h('option', {value: o.look}, `⚠ ${o.look}`));
    look.value = o.look ?? '';
    // 有草稿＝標題列右邊「● 未存［儲存］［放棄］」（摺著也在）
    const d = draftOf(o.prefab);
    const draft = d && h('span', {class: 'draft', dataset: {k: 'draft'}}, h('span', {class: 'warn'}, '● 未存 '),
        h('button', {dataset: {k: 'saveDraft'}, title: '寫進 prefab.json（Ctrl+S）', onclick: () => saveDraft()}, '儲存'), ' ',
        h('button', {dataset: {k: 'dropDraft'}, title: '丟掉沒存的改動', onclick: () => dropDraft()}, '放棄'));
    return foldSec('right.inst', [`實例 ${o.key}`, pf ? null : h('span', {class: 'warn'}, `　prefab.json 沒有 ${o.prefab}`)], () => [
        h('div', {class: 'row2'}, pfIcon(o.prefab, 48)),
        h('table', {class: 'props'},
            row('prefab', idSel),
            row('位置', n('x'), ' ', n('y')),
            row('狀態', look)),
        h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(o.key)}, '刪除實例（Del）')),
    ], draft || null);
}

// 道具實例：換道具、位置（立刻寫 scenes.json）＋手上零件（草稿）
function itemPanel(o)
{
    const it = S.refs.items[o.item];
    const n = (k) => h('input', {type: 'number', step: 1, value: o[k], class: 'n', dataset: {k}, onchange: (e) => e.target.value !== '' && setInst(o.key, {[k]: +e.target.value})});
    const row = (k, ...v) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, ...v));
    const idSel = h('select', {dataset: {k: 'item'}, onchange: () => setInst(o.key, {item: idSel.value})}, handItemIds().map(id => h('option', {value: id}, id)));
    if (!isHandItem(it)) idSel.append(h('option', {value: o.item}, `⚠ ${o.item}`));
    idSel.value = o.item;
    const d = draftOf(o.prefab);
    const draft = d && h('span', {class: 'draft', dataset: {k: 'draft'}}, h('span', {class: 'warn'}, '● 未存 '),
        h('button', {dataset: {k: 'saveDraft'}, title: '寫進 item.json（＋particle.json）（Ctrl+S）', onclick: () => saveDraft()}, '儲存'), ' ',
        h('button', {dataset: {k: 'dropDraft'}, title: '丟掉沒存的改動', onclick: () => dropDraft()}, '放棄'));
    return [
        ...foldSec('right.inst', [`道具 ${o.key}`, isHandItem(it) ? null : h('span', {class: 'warn'}, `　item.json 沒有拿在手上的 ${o.item}`)], () => [
            h('div', {class: 'row2'}, IC.iconEl(it?.icon, 48), h('span', {class: 'dim'}, '錨點＝握點；道具畫直立的 equip.sprite')),
            h('table', {class: 'props'},
                row('道具', idSel),
                row('位置', n('x'), ' ', n('y'))),
            h('div', {class: 'acts'}, h('button', {onclick: () => deleteObj(o.key)}, '刪除實例（Del）')),
        ], draft || null),
        ...(isHandItem(it) ? [partsPanel(o)] : []),
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
            row('跟著', followSelect(l, (patch) => setLight(l.key, patch)))),
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

async function askId(title, ids, cur, top = [])
{
    const sel = h('select', {size: 14, style: 'width: 100%'}, [...top, ...ids].map(id => h('option', {value: id}, id)));
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

// prefab 粒子零件的表單：改的是那個 particle id 的草稿副本（S.draft.ps），儲存 prefab 才寫 particle.json（共用的地方一起變）
const PQ = {data: {}, open: {}, json: false, drafts: {}, extra: {}, of: null, key: null};
const partPid = (id, i) => pfOf(id)?.parts?.[i]?.particle;
function ppCommit(fn)
{
    const [id, i] = PQ.of ?? [], k = PQ.key, pid = partPid(id, i), cur = pDef(pid);
    if (!cur) return;
    PQ.data[k] = structuredClone(cur);
    fn();
    if (str(PQ.data[k]) === str(cur)) return renderRight();
    return editPf(id, (pf, ps) => {ps[pid] = PQ.data[k];});
}
const PPF = createForm({S: PQ, render: () => renderRight(), commit: ppCommit});
const PP = createPForm({S: PQ, F: PPF, set: (k, path, v) => ppCommit(() => setAt(PQ.data[k], path, v)), commit: ppCommit, render: () => renderRight()});

// 零件換粒子：[新增]＝問新 id、範本放進草稿副本；舊的 {def} 換掉時拿掉
async function changePartParticle(id, i, v, pid)
{
    if (!v) return renderRight();
    if (v === NEW_PARTICLE)
    {
        v = await askParticleId('新粒子 id', freePid(pidBase(id), true), pid);
        if (!v) return renderRight();
        return editPf(id, (pf, ps) => {
            ps[v] = PSC.template();
            pf.parts[i].particle = v;
            delete pf.parts[i].def;
        });
    }
    await setPart(id, i, {particle: v, def: undefined});
}

// 另存新 id：目前內容（含草稿改的）複製成新 id，這個零件改用它；預設 <prefab>-<原 id>
async function forkPartParticle(id, i, nid)
{
    const pid = partPid(id, i), cur = pDef(pid);
    if (!cur) return;
    nid = await askParticleId(`另存 ${pid} 成新 id`, freePid(`${pidBase(id)}-${pid}`), nid);
    if (!nid) return renderRight();
    return editPf(id, (pf, ps) => {
        ps[nid] = structuredClone(cur);
        pf.parts[i].particle = nid;
    });
}

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
    if (v === 'tex') return IC.pickIcon(cur?.startsWith(FILE) ? '' : cur, {menu: texMenu});
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
        .then(s => {sizes[img] = s ?? null; if (propOf(S.pick)?.img === img || instOf(S.pick)) renderRight();});
    return undefined;
}

// set(patch)＝寫回（擺設＝setProp、prefab 零件＝setPart），fkey＝記「不等比」用的 key
function sizeRows(p, row, set = (patch) => setProp(p.key, patch), fkey = p.key)
{
    const sx = p.sx ?? 1, sy = p.sy ?? 1, k = pctOf(p), src = srcSize(p.img);
    const linked = sx === sy && !freeRatio.has(fkey);
    const inp = (v, step, k2, onchange, ph) => h('input', {type: 'number', step, value: v ?? '', placeholder: ph, class: 'n', dataset: {k: k2}, onchange: (e) => {
        const n = +e.target.value;
        if (e.target.value === '' || !(n > 0)) return renderRight();
        onchange(n);
    }});
    const setS = (a, b) => set({sx: one(r4(a)), sy: one(r4(b))});
    const setPct = (v) => set({pct: r4(v) === 100 ? undefined : r4(v)});
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
        if (e.target.checked) {freeRatio.delete(fkey); if (sx !== sy) return setS(sx, sx);}
        else freeRatio.add(fkey);
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

// ---------- prefab 的圖（textures/prefabs/<id>/ 的單張圖）：選圖器右鍵改名／刪除（docs/prefab.md） ----------
// prefabs/ 底下直接放的是 Tiled 縮圖 prefab-<id>.png（tiled.js 管），不算；改名＝prefab.json／scenes.json／草稿的引用一起改，
// 別處有引用就擋；刪除＝搬到 textures/.tbd/（有引用就擋）；檔案動作記在 undo 那一步的 fops
const PF_TEX = `${TEX}/prefabs/`;
const IMG_FIELDS = new Set(['icon', 'sprite', 'back', 'img']);
const pfTexDir = (key) => {
    const d = IC.IMAGES[key] && !IC.SHEETS[key] && !IC.ATLASES[key] && texDirOf(key);
    return d?.startsWith(PF_TEX) ? d : null;
};
const splitPath = (p) => [p.slice(0, p.lastIndexOf('/')), p.slice(p.lastIndexOf('/') + 1)];

// obj 裡放圖欄位（IMG_FIELDS）的值是 key（key:frame 也算）的位置：['props.0.img', …]
function imgRefs(obj, key, at = [], out = [])
{
    if (!obj || typeof obj !== 'object') return out;
    for (const [k, v] of Object.entries(obj))
    {
        const p = [...at, k];
        if (typeof v === 'string') {if (!Array.isArray(obj) && IMG_FIELDS.has(k) && v.split(':')[0] === key) out.push(p.join('.'));}
        else imgRefs(v, key, p, out);
    }
    return out;
}

function swapImg(pf, from, to)
{
    for (const p of pf?.parts ?? []) if (p.img === from) p.img = to;
}

function swapDraft(d, from, to)
{
    for (const s of [d, ...d.undo, ...d.redo]) swapImg(s.pf, from, to);
    const b = JSON.parse(d.base ?? 'null');
    if (b) {swapImg(b, from, to); d.base = str(b);}
}

// 引用：auto＝改名會跟著改的（prefab 零件、場景擺設、草稿零件），block＝別處（改名、刪除都擋）
async function texRefs(key)
{
    const auto = [], block = [];
    const {uses, paths} = await scan(S.root);
    for (const l of uses.get(key) ?? []) (/^prefab\.json：[^.]+\.parts\.\d+\.img$/.test(l.text) ? auto : block).push(l.text);
    const rel = `${pfTexDir(key).slice('public/assets/'.length)}/${key}.png`;
    for (const l of paths.get(rel) ?? []) block.push(l.text);
    for (const [name, sc] of Object.entries(S.data))
        for (const p of imgRefs(sc, key)) (/^props\.\d+\.img$/.test(p) ? auto : block).push(`scenes.json：${name} ${p}`);
    const d = S.draft;
    if (d)
    {
        if ([d, ...d.undo, ...d.redo].some(s => s.pf?.parts?.some(p => p.img === key))) auto.push(`prefab ${d.id} 的草稿（含草稿的 undo 紀錄）`);
        for (const p of imgRefs(d.ps, key)) block.push(`prefab ${d.id} 草稿的粒子 ${p}`);
    }
    return {auto, block};
}

const refsList = (list) => h('ul', null, list.slice(0, 20).map(t => h('li', null, t)), list.length > 20 && h('li', {class: 'dim'}, `…還有 ${list.length - 20} 處`));

async function checkMove(from, to)
{
    const [fd, fn] = splitPath(from), [td, tn] = splitPath(to);
    const src = await FS.resolveDir(S.root, fd).catch(() => null);
    if (!src || !await FS.tryFile(src, fn)) throw new Error(`${from} 不見了`);
    const dst = await FS.resolveDir(S.root, td).catch(() => null);
    if (dst && await FS.tryFile(dst, tn)) throw new Error(`${to} 已經存在`);
}

async function moveTex(from, to)
{
    await checkMove(from, to);
    const [fd, fn] = splitPath(from), [td, tn] = splitPath(to);
    const src = await FS.resolveDir(S.root, fd);
    await FS.writeFile(await mkdirs(td), tn, await (await src.getFileHandle(fn)).getFile());
    await src.removeEntry(fn);
}

function texNameError(name, from)
{
    if (!name) return '檔名不能空白';
    if (/[\\/:*?"<>|\s]/.test(name)) return '檔名不能有空白或 \\ / : * ? " < > |';
    if (/^prefab-/i.test(name)) return 'prefab- 開頭是 Tiled 縮圖專用的';
    if (name === from) return '';
    if (name.toLowerCase() === from.toLowerCase()) return '只差大小寫不支援';
    const hit = [IC.IMAGES, IC.SHEETS, IC.ATLASES].flatMap(o => Object.keys(o)).find(k => k.toLowerCase() === name.toLowerCase());
    if (hit) return `textures 已經有 ${hit}（texture key 不能撞名）`;
    return '';
}

async function askTexName(from)
{
    const inp = h('input', {size: 28, value: from, dataset: {k: 'texName'}}), err = h('div', {style: 'color: #f88; min-height: 1.4em'});
    const p = ask(`改名 ${from}`, [h('div', {class: 'dim'}, '改 png 檔名＝改 texture key；prefab.json、scenes.json、草稿的引用一起改（可以 undo）'),
        h('label', null, '檔名 ', inp, '.png'), err], [['ok', '確定'], ['cancel', '取消']]);
    const ok = $('dlgAsk').querySelector('.buttons button[value=ok]');
    const check = () => {err.textContent = texNameError(inp.value.trim(), from); ok.disabled = !!err.textContent;};
    inp.oninput = check;
    check();
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

async function blocked(key, list, verb)
{
    if (!list.length) return false;
    await ask(`${key} 不能${verb}`, [h('div', null, '這些地方還在用：'), refsList(list)], [['ok', '知道了']]);
    return true;
}

// 回傳 {to}｜null
async function renameTex(key, to)
{
    const dir = pfTexDir(key);
    if (!dir || !S.root) return null;
    status(`找 ${key} 的引用…`);
    const refs = await texRefs(key);
    status('');
    if (await blocked(key, refs.block, '改名')) return null;
    to ??= await askTexName(key);
    if (to === null || to === key) return null;
    const err = texNameError(to, key);
    if (err) return status(err), null;
    let done = false;
    await queue(async () => {
        const hit = await findTexKey(await FS.resolveDir(S.root, TEX), to);
        if (hit) throw new Error(`textures/${hit}.png 已經有了（texture key 不能撞名）`);
        const from = `${dir}/${key}.png`, dest = `${dir}/${to}.png`;
        await moveTex(from, dest);
        let r;
        try
        {
            r = await ST.edit((scenes, pfs) => {
                for (const sc of Object.values(scenes)) for (const p of sc.props ?? []) if (p.img === key) p.img = to;
                for (const pf of Object.values(pfs)) swapImg(pf, key, to);
            }, PREFAB_FILES);
        }
        catch (e) {await moveTex(dest, from); throw e;}
        S.undo.push({files: r?.files ?? {}, sel: [S.sel, S.sel], pick: [S.pick, S.pick], fops: [{from, to: dest}]});
        S.redo = [];
        if (r) gotData(r.data);
        if (S.draft) swapDraft(S.draft, key, to);
        await updateTextures();
        reloadGame();
        refresh();
        status(`${key} 改名成 ${to}` + (refs.auto.length ? `（引用 ${refs.auto.length} 處一起改）` : ''));
        done = true;
    });
    return done ? {to} : null;
}

// 回傳 {gone}｜null
async function deleteTex(key, sure)
{
    const dir = pfTexDir(key);
    if (!dir || !S.root) return null;
    status(`找 ${key} 的引用…`);
    const refs = await texRefs(key);
    status('');
    if (await blocked(key, [...refs.auto, ...refs.block], '刪除')) return null;
    const dest = `${TEX}/.tbd/${dir.slice(TEX.length + 1)}/${key}.png`;
    if (!sure && await ask(`刪除 ${key}`, `搬到 ${dest.slice('public/assets/'.length)}（可以 undo，圖片分頁也能搬回原位）`, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return null;
    let done = false;
    await queue(async () => {
        const from = `${dir}/${key}.png`;
        await moveTex(from, dest);
        S.undo.push({files: {}, sel: [S.sel, S.sel], pick: [S.pick, S.pick], fops: [{from, to: dest}]});
        S.redo = [];
        await updateTextures();
        status(`${key} 搬到 .tbd/`);
        done = true;
    });
    return done ? {gone: true} : null;
}

// 選圖器（場景分頁的「textures 圖…」）右鍵
function texMenu(key, e)
{
    if (!pfTexDir(key)) return null;
    return new Promise(res => menu(e, [['改名…', async () => res(await renameTex(key))], ['刪除（搬到 .tbd）', async () => res(await deleteTex(key))]], $('dlgIcon')));
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

// ---------- 切前後片（docs/scene-tool.md）：只有手繪、圈的＝後片、1px 對齊；兩張跟（縮好的）原圖同尺寸的 PNG 進 textures/，
// 原擺設變前片（img 換新 key、拿掉 pct）、後片是新擺設插在前面、其他欄位照抄；兩個是獨立的擺設 ----------
const canCut = (p) => !!p && (isFile(p.img) || !!IC.IMAGES[p.img]);
const texDirOf = (key) => {
    const u = IC.IMAGES[key];
    return u && `public${decodeURI(new URL(u, location.href).pathname).split('/').slice(0, -1).join('/')}`;
};
const texRel = (path, n) => (path === TEX ? n : `${path.slice(TEX.length + 1)}/${n}`);
const cutNames = (base) => [`${base}-front`, `${base}-back`];

// 要切的圖：file: 圖先照 pct 縮好（跟「存檔…」烤出來的一樣），頂點對齊的是縮好後的像素
async function cutSrc(p)
{
    const url = isFile(p.img) ? fileUrl(p.img) : IC.IMAGES[p.img];
    const img = url && await loadImg(url);
    if (!img) return null;
    const k = pctOf(p), w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
    const c = Object.assign(document.createElement('canvas'), {width: w, height: hh}), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, hh);
    return c;
}

// 檔名檢查：texture key 不能撞到別的資料夾、不能是原圖；同資料夾已經有＝問覆蓋
async function cutCheck(dir, base, srcImg)
{
    if (!base) return '檔名不能空白';
    if (/[\\/:*?"<>|]/.test(base)) return '檔名不能有 \\ / : * ? " < > |';
    const root = await mkdirs(TEX), have = [];
    for (const n of cutNames(base))
    {
        if (n.toLowerCase() === srcImg.toLowerCase()) return `${n} 是原圖，換個檔名`;
        const hit = await findTexKey(root, n);
        if (hit && hit.toLowerCase() !== texRel(dir, n).toLowerCase()) return `textures/${hit}.png 已經有了（texture key 不能撞名），換個檔名`;
        if (hit) have.push(`${n}.png`);
    }
    if (have.length && !confirm(`${have.join('、')} 已經有了，要覆蓋嗎？`)) return '換個檔名，或確定覆蓋';
    return null;
}

// 開對話框切 o（擺設或 prefab 的 png 零件）、寫兩張 PNG：textures 圖存原資料夾、file: 圖存 fileDir；回傳 {F, B, dir, over（蓋掉既有檔）}｜null
async function runCut(o, what, fileDir)
{
    if (!S.root) return status('先在上方選擇專案資料夾'), null;
    if (!canCut(o)) return status('只能切單張圖（sheet／atlas 的格子不行）'), null;
    const src = await cutSrc(o);
    if (!src) return status(`讀不到 ${o.img}`), null;
    const dir = isFile(o.img) ? fileDir : texDirOf(o.img) ?? TEX;
    const name = h('input', {size: 24, value: propName(o).replace(/\.png$/i, ''), dataset: {k: 'cutName'}});
    const side = h('div', {class: 'cutsave'}, h('div', {class: 'dim', style: 'word-break: break-all'}, `存到 ${dir}/`),
        h('label', null, '檔名 ', name, h('span', {class: 'dim'}, ' -front／-back.png')));
    const base = () => bakeName(name.value);
    const r = await cutDialog({src, title: `切前後片：${what}${pctOf(o) !== 1 ? `（照 ${o.pct}% 縮好再切）` : ''}`, side,
                               check: () => cutCheck(dir, base(), o.img)});
    if (!r) return null;
    const M = cutMask(src.width, src.height, r.pts), [F, B] = cutNames(base());
    let over = false;
    try
    {
        const out = await mkdirs(dir);
        for (const [n, keep] of [[F, 0], [B, 1]])
        {
            over ||= !!await FS.tryFile(out, `${n}.png`);
            await FS.writeFile(out, `${n}.png`, await new Promise(res => cutPiece(src, M, keep).toBlob(res, 'image/png')));
        }
    }
    catch (e) {return status(`寫不了 PNG：${e.message}`), null;}
    await updateTextures();
    return {F, B, dir, over};
}

// 蓋掉既有的圖＝同 key 換內容，sandbox 要重開才會換
const cutSync = (r) => (r.over ? reloadGame() : toGame({sb: 'textures'}));

async function cutProp(key)
{
    const p = propOf(key);
    if (!p) return;
    const r = await runCut(p, propName(p), `${TEX}/props`);
    if (!r) return;
    await editScene(sc => {
        const i = sc.props?.findIndex(x => x.key === key) ?? -1;
        if (i < 0) throw new Error(`場景裡沒有 ${key}`);
        const q = sc.props[i];
        let n = 1;
        while (sc.props.some(x => x.key === `p${n}`)) n++;
        q.img = r.F;
        delete q.pct;
        const {key: _k, img: _i, ...rest} = q;
        sc.props.splice(i, 0, {key: `p${n}`, img: r.B, ...rest});
    }, key);
    cutSync(r);
    status(`${key} 切成 ${r.F}＋${r.B}（${r.dir}）`);
}

// prefab png 零件（草稿）：原零件留原位變前片、後片插在前面、其他欄位全部照抄；file: 圖存 textures/prefabs/<id>/
async function cutPart(id, i)
{
    const p = pfOf(id)?.parts?.[i];
    if (!p?.img) return;
    const r = await runCut(p, `${id} 零件 ${i + 1}（${propName(p)}）`, `${TEX}/prefabs/${id}`);
    if (!r) return;
    if (pfOf(id)?.parts?.[i]?.img !== p.img) return status(`${id} 零件 ${i + 1} 已經變了，沒有改零件（PNG 已寫）`);
    const sh = (j) => (j >= i ? j + 1 : j);
    S.part = S.part === null ? null : sh(S.part);
    remapSel(sh);
    await editPf(id, pf => {
        const q = pf.parts[i];
        q.img = r.F;
        delete q.pct;
        const {img: _i, ...rest} = q;
        pf.parts.splice(i, 0, {img: r.B, ...structuredClone(rest)});
    });
    cutSync(r);
    status(`${id} 零件 ${i + 1} 切成 ${r.F}＋${r.B}（${r.dir}，存 prefab 才寫進 prefab.json）`);
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
            isFile(p.img) && h('button', {title: '把原圖縮成 % 另存一份 PNG（場景不動）', onclick: () => exportProp(p)}, '存檔…'),
            canCut(p) && h('button', {dataset: {k: 'cut'}, title: '手繪圈出後片，切成前片＋後片兩個擺設（兩張 PNG 進 textures/）', onclick: () => cutProp(p.key)}, '切前後片…')),
        h('table', {class: 'props'},
            row('位置', n('x', 1), ' ', n('y', 1)),
            ...sizeRows(p, row),
            row('翻轉', h('input', {type: 'checkbox', checked: !!p.flip, dataset: {k: 'flip'}, onchange: put('flip')})),
            row('角度', n('angle', 1, '0')),
            row('錨點', n('ox', 0.05, '0.5'), ' ', n('oy', 0.05, '1')),
            row('深度', n('depth', 1, '0'), h('span', {class: 'dim'}, ' 加在 y 上'))),
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
    if (S.draft && key !== S.draft.key) {leaveDraft().then(ok => (ok ? pickRole(key) : toGame(selMsg()))); return;}
    if (S.arm && S.arm.key !== key) {S.arm = null; toGame({sb: 'arm', act: null});}
    if (key !== S.pick) {S.part = null; clearSel();}
    S.pick = key;
    toGame(selMsg());
    toGame(inspectMsg());
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
// parent：開著的 modal dialog 裡要掛在 dialog 上（body 會被蓋在下面）
function menu(e, items, parent = document.body)
{
    e.preventDefault?.();
    document.querySelector('.ctxmenu')?.remove();
    // fn＝null：反灰
    const m = h('div', {class: 'ctxmenu'}, items.map(([t, fn]) => h('button', {type: 'button', disabled: !fn, onclick: () => {m.remove(); fn();}}, t)));
    parent.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
    m.style.top = `${Math.min(e.clientY, innerHeight - r.height - 4)}px`;
}
addEventListener('pointerdown', (e) => {if (!e.target.closest('.ctxmenu')) document.querySelector('.ctxmenu')?.remove();});
addEventListener('contextmenu', (e) => {if (!e.target.closest('input, textarea, select')) e.preventDefault();});

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
    renderRight();
}

function secHead(k, title, ...btns)
{
    const f = isFolded(k), t = () => toggleFold(k);
    return h('div', {class: 'row2 head', dataset: {fold: k}},
        h('span', {class: 'tw', onclick: t}, f ? '▸' : '▾'), h('span', {class: 'sec grow', onclick: t}, title), ...btns);
}

// 右欄可摺的一段（實例／屬性／零件），摺起來只剩標題
const foldSec = (k, title, rows, btn) => [secHead(k, title, btn), ...(isFolded(k) ? [] : rows())];

// prefab 庫：prefab.json 全部；拖進遊戲畫面＝放實例（sandbox 收 drop），右鍵刪除
function renderLib()
{
    const ids = Object.keys(S.prefabs);
    const cur = instOf(S.pick), psel = pselOf().parts;
    // 零件列（照草稿）：點一下＝選實例＋選取並展開這個零件，右鍵＝移到場景
    const partRow = (id, p, i) => h('div', {
        class: `item libpart${p.off ? ' off' : ''}${cur?.prefab === id && psel.includes(i) && !p.off ? ' sel' : ''}`, dataset: {prefab: id, part: i},
        title: '點一下：選場景裡用它的實例、選取並展開這個零件；右鍵：移到場景',
        onclick: () => pickLibPart(id, i),
        oncontextmenu: (e) => menu(e, oldDef(p) ? [['移到場景（零件自己的粒子不能移）', null]] : [['移到場景', () => libPartToScene(id, i)]]),
    }, partIcon(p), h('span', {class: 'id'}, partName(p)), p.look && h('span', {class: 'lab'}, p.look));
    $('lib').replaceChildren(
        secHead('lib', `prefab 庫（${ids.length}）`,
            h('button', {id: 'btnRegenThumbs', title: '全部重產縮圖（零件的 png 在別處改了、手改 prefab.json 之後）', onclick: () => regenThumbs()}, '⟳'),
            h('button', {id: 'btnNewPrefab', title: '新增空白 prefab（有選場景就在畫面中間放一個）', onclick: () => newPrefab()}, '＋')),
        ...(isFolded('lib') ? [] : ids.flatMap(id => {
            const open = isFolded(libOpen(id)), parts = pfOf(id)?.parts ?? [];
            return [h('div', {
                class: `item${cur?.prefab === id ? ' sel' : ''}`, draggable: 'true', dataset: {prefab: id}, title: '點一下選這個場景裡用它的實例；拖進遊戲畫面放一個；▸ 展開零件',
                onclick: () => pickPrefab(id),
                ondragstart: (e) => {e.dataTransfer.setData('application/x-prefab', id); e.dataTransfer.effectAllowed = 'copy';},
                oncontextmenu: (e) => menu(e, [['改名…', () => renamePrefab(id)], ['複製…', () => dupPrefab(id)], ['重產縮圖', () => regenThumbs([id])], ['刪除', () => deletePrefab(id)]]),
            }, h('span', {class: 'tw', dataset: {k: 'libOpen'}, title: open ? '收起零件' : '展開零件', onclick: (e) => {e.stopPropagation(); toggleFold(libOpen(id));}}, open ? '▾' : '▸'),
               pfIcon(id, 20), h('span', {class: 'id'}, id), S.draft?.id === id && h('span', {class: 'warn', title: '有沒存的草稿'}, '●'),
               h('span', {class: 'lab dim'}, `${prefabUses(id).reduce((n, [, c]) => n + c, 0) || ''}`)),
                ...(open ? (parts.length ? parts.map((p, i) => partRow(id, p, i)) : [h('div', {class: 'libpart dim'}, '（沒有零件）')]) : [])];
        })),
        ...(!isFolded('lib') && !ids.length ? [h('div', {class: 'dim'}, S.root ? '還沒有 prefab，按 ＋ 新增' : '')] : []));
    renderItemLib();
}

// 道具庫：拿在手上的道具（有 equip 的武器／CAT_EQUIP）；拖進畫面＝放道具實例、點一下＝選場景裡第一個
const ITEM_DRAG = 'item:';
// 手上零件數（停用的不算）：🔥 粒子 💡 光源
const handOf1 = (id) => {
    const ps = (itemEquip(id)?.parts ?? []).filter(p => !p.off), np = ps.filter(p => p.particle).length, nl = ps.filter(p => p.light).length;
    return [np && `🔥${np}`, nl && `💡${nl}`].filter(Boolean).join(' ');
};
function renderItemLib()
{
    const ids = handItemIds(), cur = itemInsts().find(o => o.key === S.pick);
    $('itemLib').replaceChildren(
        secHead('itemLib', `道具（${ids.length}）`),
        ...(isFolded('itemLib') ? [] : ids.map(id => h('div', {
            class: `item${cur?.item === id ? ' sel' : ''}`, draggable: 'true', dataset: {item: id}, title: '點一下選這個場景裡的道具實例；拖進遊戲畫面放一個（編手上的粒子／光源）',
            onclick: () => pickItem(id),
            ondragstart: (e) => {e.dataTransfer.setData('application/x-prefab', ITEM_DRAG + id); e.dataTransfer.effectAllowed = 'copy';},
        }, IC.iconEl(S.refs.items[id].icon, 20), h('span', {class: 'id'}, id), h('span', {class: 'lab dim'}, handOf1(id))))));
}

async function gotoItem(id)
{
    const name = Object.keys(S.data).find(n => S.data[n].items?.some(o => o.item === id));
    if (name !== undefined)
    {
        select(name, false);
        S.pick = S.data[name].items.find(o => o.item === id).key;
        refresh();
        return toGame({sb: 'focus', key: S.pick});
    }
    if (S.sel === null)
    {
        const first = Object.keys(S.data)[0];
        if (first === undefined) return status('還沒有場景，先新增一個');
        select(first, false);
    }
    await addItemInst(id, S.center[0] * 32 + 16, S.center[1] * 32 + 16);
}

function pickItem(id)
{
    if (S.sel === null) return status('先選或新增一個場景');
    const o = itemInsts().find(x => x.item === id);
    if (!o) return status(`這個場景還沒放 ${id}（拖進畫面放一個）`);
    pickRole(o.key);
    toGame({sb: 'focus', key: o.key});
}

// 左欄 prefab 展開的記號（跟摺疊記在同一份 tools.scene.fold，有＝展開）
const libOpen = (id) => `libOpen:${id}`;

// 左欄零件列要動的實例：選中的實例是這個 prefab 就用它，不然場景裡第一個
function libInst(id)
{
    if (S.sel === null) return status('先選或新增一個場景'), null;
    const o = instOf(S.pick)?.prefab === id ? instOf(S.pick) : insts().find(x => x.prefab === id);
    if (!o) status(`這個場景還沒放 ${id}（拖進畫面放一個）`);
    return o ?? null;
}

async function pickLibPart(id, i)
{
    const o = libInst(id);
    if (!o) return;
    if (S.pick !== o.key)
    {
        if (S.draft && !await leaveDraft()) return;
        pickRole(o.key);
        toGame({sb: 'focus', key: o.key});
    }
    if (!pfOf(id)?.parts?.[i]) return;
    if (!pfOf(id).parts[i].off) S.psel = {key: o.key, boxes: [], parts: [i]};
    openPart(i);
    renderLib();
}

function libPartToScene(id, i)
{
    const o = libInst(id);
    return o && partsToScene(o.key, [i]);
}

function renderList()
{
    $('scenesHead').replaceChildren(secHead('scenes', '場景', h('button', {id: 'btnNew', title: '新增場景', onclick: () => addScene()}, '＋')));
    if (isFolded('scenes')) return $('list').replaceChildren();
    $('list').replaceChildren(...Object.keys(S.data).map(name => h('div', {
        class: `item${name === S.sel ? ' sel' : ''}`, dataset: {name},
        onclick: async () => {if (await leaveDraft()) select(name === S.sel ? null : name);},
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
    box.replaceChildren(
        ...sec('roles', `角色（${roles().length}）`, plus('放角色', () => placeAt(...S.center)), () => roles().map(r => h('div', {
            class: `item${r.key === S.pick ? ' sel' : ''}${S.hidden.has(r.key) ? ' hid' : ''}`, dataset: {key: r.key},
            onclick: () => pickRole(r.key === S.pick ? null : r.key),
            oncontextmenu: (e) => menu(e, [['刪除', () => deleteRole(r.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(r.key);}}, S.hidden.has(r.key) ? '◌' : '👁'),
           h('span', {class: 'id'}, r.id), h('span', {class: 'lab'}, roleLab(r.id)), h('span', {class: 'mark dim'}, `${r.tx},${r.ty}`)))),
        ...sec('props', `擺設（${props().length}）`, plus('放擺設', () => placeProp(S.center[0] * 32 + 16, S.center[1] * 32 + 32)), () => props().map(p => h('div', {
            class: `item${p.key === S.pick ? ' sel' : ''}${S.hidden.has(p.key) ? ' hid' : ''}`, dataset: {key: p.key},
            onclick: () => pickRole(p.key === S.pick ? null : p.key),
            oncontextmenu: (e) => menu(e, [...(canCut(p) ? [['切前後片…', () => cutProp(p.key)]] : []), ['組成 prefab…', () => composePrefab(p.key)], ...addToItems(p.key, e), ['刪除', () => deleteObj(p.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (e) => {e.stopPropagation(); toggleHide(p.key);}}, S.hidden.has(p.key) ? '◌' : '👁'),
           imgEl(p.img, 20), h('span', {class: 'id'}, p.img.startsWith(FILE) ? p.img.split('/').pop() : p.img), h('span', {class: 'mark dim'}, `${p.x},${p.y}`)))),
        ...sec('particles', `粒子（${emitters().length}）`, plus('放粒子發射點', () => placeEmitter(S.center[0] * 32 + 16, S.center[1] * 32 + 16)), () => emitters().map(e => h('div', {
            class: `item${e.key === S.pick ? ' sel' : ''}${S.hidden.has(e.key) ? ' hid' : ''}`, dataset: {key: e.key},
            onclick: () => pickRole(e.key === S.pick ? null : e.key),
            oncontextmenu: (ev) => menu(ev, [['組成 prefab…', () => composePrefab(e.key)], ...addToItems(e.key, ev), ...toItemMenu(e.key, ev), ['刪除', () => deleteObj(e.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(e.key);}}, S.hidden.has(e.key) ? '◌' : '👁'),
           h('span', {class: defOf(e) ? 'id' : 'id warn', title: e.def ? '自訂（發射點自己那份）' : ''}, e.def ? `${e.id} ✎` : e.id), e.follow && h('span', {class: 'lab'}, `→ ${followName(e.follow)}`), h('span', {class: 'mark dim'}, `${e.x},${e.y}`)))),
        ...sec('lights', `光源（${lights().length}）`, plus('放光源', () => addLight(S.center[0] * 32 + 16, S.center[1] * 32 + 16)), () => lights().map(l => h('div', {
            class: `item${l.key === S.pick ? ' sel' : ''}${S.hidden.has(l.key) ? ' hid' : ''}`, dataset: {key: l.key},
            onclick: () => pickRole(l.key === S.pick ? null : l.key),
            oncontextmenu: (ev) => menu(ev, [['組成 prefab…', () => composePrefab(l.key)], ...addToItems(l.key, ev), ...toItemMenu(l.key, ev), ['刪除', () => deleteObj(l.key)]]),
        }, h('button', {class: 'eye', title: '暫時藏起來（不存檔）', onclick: (ev) => {ev.stopPropagation(); toggleHide(l.key);}}, S.hidden.has(l.key) ? '◌' : '👁'),
           h('span', {title: `光色 ${l.color ?? '#ffcc88'}`}, '💡'), h('span', {class: 'id'}, l.key),
           l.follow && h('span', {class: 'lab'}, `→ ${followName(l.follow)}`), h('span', {class: 'mark dim'}, `${l.x},${l.y}`)))),
        ...sec('prefabs', `prefab（${insts().length}）`, plus('放 prefab', () => placeInst(S.center[0] * 32 + 16, S.center[1] * 32 + 32)), () => insts().map(o => h('div', {
            class: cls(o.key), dataset: {key: o.key},
            onclick: () => pickRole(o.key === S.pick ? null : o.key),
            oncontextmenu: (ev) => menu(ev, [...toItemMenu(o.key, ev), ['刪除', () => deleteObj(o.key)]]),
        }, eye(o.key), pfIcon(o.prefab, 20), h('span', {class: S.prefabs[o.prefab] ? 'id' : 'id warn'}, o.prefab),
           o.look && h('span', {class: 'lab'}, o.look), h('span', {class: 'mark dim'}, `${o.x},${o.y}`)))),
        ...sec('items', `道具（${itemInsts().length}）`, null, () => itemInsts().map(o => h('div', {
            class: cls(o.key), dataset: {key: o.key},
            onclick: () => pickRole(o.key === S.pick ? null : o.key),
            oncontextmenu: (ev) => menu(ev, [['刪除', () => deleteObj(o.key)]]),
        }, eye(o.key), IC.iconEl(S.refs.items[o.item]?.icon, 20), h('span', {class: isHandItem(S.refs.items[o.item]) ? 'id' : 'id warn'}, o.item),
           h('span', {class: 'lab dim'}, handOf1(o.item)), h('span', {class: 'mark dim'}, `${o.x},${o.y}`)))),
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

// 展開的零件換了（收起→展開、換一個、↑↓ 搬動、換實例）才捲一次右欄：列＋表單都看得到就不動，
//  底部超出捲到剛好看到底，比視窗高就讓那一列貼頂；改數字等重畫不捲（scrolledPart＝上次捲過的 實例#index）
let scrolledPart = null;
function scrollOpened(o)
{
    const k = S.part === null ? null : `${o.key}#${S.part}`;
    if (k === scrolledPart) return;
    scrolledPart = k;
    const box = $('right'), row = k && box.querySelector(`.part[data-part="${S.part}"]`);
    if (!row) return;
    const form = row.nextElementSibling?.classList.contains('partform') ? row.nextElementSibling : row;
    const y0 = box.getBoundingClientRect().top - box.scrollTop;
    const top = row.getBoundingClientRect().top - y0, bot = form.getBoundingClientRect().bottom - y0, view = box.clientHeight;
    if (bot - top > view || top < box.scrollTop) box.scrollTop = top;
    else if (bot > box.scrollTop + view) box.scrollTop = bot - view;
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
    const r = roleOf(S.pick);
    // replaceChildren 不像 h() 會濾掉 `cond && …` 留下的 false
    const put = (...kids) => $('right').replaceChildren(...kids.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false));
    if (propOf(S.pick)) return put(propPanel(propOf(S.pick)));
    if (emOf(S.pick)) return put(emPanel(emOf(S.pick)));
    if (lightOf(S.pick)) return put(lightPanel(lightOf(S.pick)));
    const o = instOf(S.pick);
    if (o?.item) return put(itemPanel(o));
    if (o)
    {
        put(instPanel(o), pfOf(o.prefab) ? [prefabPanel(o.prefab), partsPanel(o)] : []);
        return scrollOpened(o);
    }
    if (!r) return put(h('span', {class: 'dim'}, S.sel === null ? '' : '點畫面上的角色、或左邊清單選一個；右鍵畫面放角色'));
    const idSel = roleSelect(r.id);
    idSel.onchange = () => setRole(r.key, {id: idSel.value});
    const face = h('select', {onchange: () => setRole(r.key, {face: face.value || undefined})},
        h('option', {value: ''}, '（預設）'), h('option', {value: 'l'}, '左'), h('option', {value: 'r'}, '右'));
    face.value = r.face ?? '';
    put(
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
    if (S.pick &&!roleOf(S.pick) && !propOf(S.pick) && !emOf(S.pick) && !lightOf(S.pick) && !instOf(S.pick)) S.pick = null;
    if (S.draft && (S.pick !== S.draft.key || instOf(S.pick)?.prefab !== S.draft.id)) {status(`prefab ${S.draft.id} 的實例不見了，草稿丟掉`); S.draft = null;}
    if (S.part !== null && !(S.part < (pfOf(instOf(S.pick)?.prefab)?.parts?.length ?? 0))) S.part = null;
    renderLib();
    renderList();
    renderTree();
    renderRight();
    $('sceneName').textContent = S.sel ?? '（沒選場景：空白 sandbox）';
    $('btnUndo').disabled = !(S.draft ?? S).undo.length;
    $('btnRedo').disabled = !(S.draft ?? S).redo.length;
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

const iconsMsg = () => ({sb: 'icons', light: S.lightIcon, particle: S.particleIcon});

function syncGame()
{
    toGame({sb: 'grid', on: S.grid});
    toGame({sb: 'anchor', on: S.anchor});
    toGame(iconsMsg());
    toGame(playMsg());
    toGame(selMsg());
    toGame({sb: 'hide', keys: [...S.hidden]});
    const iid = draftItem(S.draft);
    toGame({sb: 'load', scene: sceneMsg(cur()), prefabs: prefabsMsg(), particles: particlesMsg(), items: iid ? {[iid]: itemEquip(iid)} : {}});
    toGame(inspectMsg());
}

// ---------- sandbox ----------
function onKey(k)
{
    if (k.ctrl && k.key.toLowerCase() === 's') saveDraft();
    else if (k.ctrl && k.key.toLowerCase() === 'z' && !k.shift) undo();
    else if (k.ctrl && (k.key.toLowerCase() === 'y' || (k.key.toLowerCase() === 'z' && k.shift))) redo();
    // 有選取的零件：Del／方向鍵作用在所有選取的零件（草稿）；Esc 一層一層退：收零件 → 清選取 → 取消選取實例
    else if (k.key === 'Delete' && selParts().length) delParts(instOf(S.pick).prefab, selParts());
    else if (k.key === 'Delete' && S.pick) deleteObj(S.pick);
    else if (k.key.startsWith('Arrow') && (propOf(S.pick) || emOf(S.pick) || lightOf(S.pick) || instOf(S.pick)))
    {
        const d = k.shift ? 32 : 1, dx = {ArrowLeft: -d, ArrowRight: d}[k.key] ?? 0, dy = {ArrowUp: -d, ArrowDown: d}[k.key] ?? 0;
        if (selParts().length) nudgeParts(dx, dy);
        else nudge(dx, dy);
    }
    else if (k.key === ' ') toGame({sb: 'replay'});
    else if (k.key === 'Escape' && S.arm) arm(false);
    else if (k.key === 'Escape' && S.part !== null) openPart(null);
    else if (k.key === 'Escape' && (pselOf().parts.length || pselOf().boxes.length)) editSel(s => {s.boxes = []; s.parts = [];});
    else if (k.key === 'Escape' && S.pick) pickRole(null);
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
    else if (m.sb === 'part' && m.key === S.pick) openPart(m.i);
    else if (m.sb === 'moveParts' && instOf(m.key)) moveParts(instOf(m.key).prefab, m.moves);
    else if (m.sb === 'partLight' && instOf(m.key) && pfOf(instOf(m.key).prefab)?.parts?.[m.i]?.light) setPart(instOf(m.key).prefab, m.i, m.patch);
    else if (m.sb === 'dragLive') dragLive(m);
    else if (m.sb === 'box' && instOf(m.key) && BOXES.some(([k]) => k === m.k)) setPf(instOf(m.key).prefab, {[m.k]: m.box});
    else if (m.sb === 'moveInst')
    {
        setInst(m.key, {x: m.x, y: m.y}).then(syncGame);
    }
    else if (m.sb === 'dropPrefab')
    {
        if (S.sel === null) return status('先選或新增一個場景');
        if (m.id.startsWith(ITEM_DRAG)) addItemInst(m.id.slice(ITEM_DRAG.length), m.wx, m.wy);
        else addInst(m.id, m.wx, m.wy);
    }
    else if (m.sb === 'zone')
    {
        // 拖 zone＝改粒子內容：寫進發射點自己那份（還沒有就先整筆複製）
        const cur = defOf(emOf(m.key));
        if (cur) setEmitter(m.key, {def: {...structuredClone(cur), [m.k]: m.z}}).then(syncGame);
    }
    else if (m.sb === 'partZone' && instOf(m.key))
    {
        // 拖 prefab 粒子零件的 zone＝改那個粒子 id 的草稿副本
        const id = instOf(m.key).prefab, pid = partPid(id, m.i), cur = pDef(pid);
        if (cur) editPf(id, (pf, ps) => {ps[pid] = {...structuredClone(cur), [m.k]: m.z};});
    }
    else if (m.sb === 'moveLight') setLight(m.key, {x: m.x, y: m.y}).then(syncGame);
    else if (m.sb === 'radiusLight') setLight(m.key, {r: m.r, ...(m.dir !== undefined && {dir: m.dir})}).then(syncGame);
    else if (m.sb === 'arcLight') setLight(m.key, {arc: m.arc}).then(syncGame);
    else if (m.sb === 'key') onKey(m);
    else if (m.sb === 'ctx')
    {
        const b = frame.getBoundingClientRect(), at = {clientX: b.left + m.cx, clientY: b.top + m.cy};
        const items = [[`在這裡放角色…（${m.tx}, ${m.ty}）`, () => placeAt(m.tx, m.ty)], ['在這裡放擺設…', () => placeProp(m.wx, m.wy)], ['在這裡放粒子…', () => placeEmitter(m.wx, m.wy)],
                       ['在這裡放光源', () => addLight(m.wx, m.wy)], ['在這裡放 prefab…', () => placeInst(m.wx, m.wy)]];
        if (canCut(propOf(m.key))) items.push(['切前後片…', () => cutProp(m.key)]);
        if (m.key && (isProp(m.key) || isEm(m.key) || isLight(m.key))) items.push(['組成 prefab…', () => composePrefab(m.key)], ...addToItems(m.key, at));
        if (m.key) items.push(...toItemMenu(m.key, at));
        // 選取的零件上按右鍵：所有選取的一起移
        if (m.part !== null && m.part !== undefined && m.part < (pfOf(instOf(S.pick)?.prefab)?.parts?.length ?? 0))
        {
            const idxs = selParts().includes(m.part) ? selParts() : [m.part];
            items.unshift([`移到場景（${idxs.length > 1 ? `選取的 ${idxs.length} 個零件` : `零件 ${m.part + 1}`}）`, () => partsToScene(S.pick, idxs)]);
        }
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
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.target.closest('dialog'))
    {
        e.preventDefault();
        document.activeElement?.blur();
        saveDraft();
        return;
    }
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

// 排進寫檔佇列：讀完之前的編輯會等（store 的 root 還沒設好）
function setProject(root)
{
    S.root = root;
    S.draft = null;
    return queue(async () => {
        S.undo = [];
        S.redo = [];
        try {await loadRefs();}
        catch (e) {status(`role.json／item.json 讀不了：${e.message}`);}
        try {S.data = await ST.load(root);}
        catch (e) {S.data = {}; status(`${ST.FILE} 讀不了：${e.message}`);}
        try {S.prefabs = await ST.read(ST.PREFAB);}
        catch (e) {S.prefabs = {}; status(`${ST.PREFAB} 讀不了：${e.message}`);}
        refresh();
    });
}
SH.onProject(setProject);
// 別的分頁 ↗ 跳過來（粒子／特效／圖片分頁的 prefab 引用）：選第一個放了這個 prefab 的場景、選起那個實例
SH.onGoto(async ([id] = []) => {
    if (!id || !await leaveDraft()) return;
    // 道具分頁「↗ 場景」：item:<道具>＝選第一個放了它的場景的道具實例；都沒有就放在目前場景（沒選＝第一個）中間
    if (id.startsWith(ITEM_DRAG)) return gotoItem(id.slice(ITEM_DRAG.length));
    const name = Object.keys(S.data).find(n => S.data[n].prefabs?.some(o => o.prefab === id));
    if (name === undefined) return status(`prefab ${id} 還沒放在任何場景（從左上 prefab 庫拖進畫面）`);
    select(name, false);
    S.pick = S.data[name].prefabs.find(o => o.prefab === id).key;
    refresh();
});
IC.onReload(() => renderLib());     // 縮圖 prefab-<id>.png 重產後換新圖（icons.js 的 url 帶版本）
SH.onSaved((file) => {
    if (!S.root) return;
    if (file === ST.FILE) queue(async () => {S.data = await ST.read(); refresh();});
    else if (file === ST.PREFAB) queue(async () => {S.prefabs = await ST.read(ST.PREFAB); refresh();}).then(draftConflict);
    // particle.json：load 訊息帶整份給 sandbox，不重開；草稿碰過的粒子被改了要問
    else if (file === ST.PARTICLE) queue(async () => {await loadRefs(); refresh();}).then(draftConflict);
    else if (GAME_FILES.includes(file))
    {
        if (['role.json', 'item.json', 'ability.json', 'fx.json', 'local.json'].includes(file)) queue(async () => {await loadRefs(); refresh();}).then(() => file === 'item.json' && draftConflict());
        // 加了圖（包括「存檔…」存進 textures/）：sandbox 自己補載新 key，不重開；同 key 換內容要按重開
        if (file === 'textures.json') toGame({sb: 'textures'});
        else reloadGame();
    }
});
S.center = [12, 8];
renderDatalists({eases: easeNames()});
frame.src = '/?sandbox=1';
refresh();

// 給無頭測試用
window.__sc = {S, setProject, addScene, dupScene, renameScene, deleteScene, select, undo, redo, addRole, setRole, setEquip, deleteRole, pickRole, toggleHide, arm, toGame, addProp, setProp, deleteObj, nudge, bakeProp, folderTree, exportProp: (key) => exportProp(propOf(key)), srcSize, addLight, setLight, addEmitter, setEmitter, setField, setPlaying,
               addInst, setInst, newPrefab, deletePrefab, toggleFold, setPf, setPart, addPart, movePart, delPart, delParts, openPart, moveParts, setPartOn, toggleBoxSel, togglePartSel, pselOf, pickPrefab, saveDraft, dropDraft, changePartParticle, forkPartParticle, particleUsers, pDef, composePrefab, renamePrefab, dupPrefab, cutProp, cutPart,
               renameTex, deleteTex, texMenu, addToPrefab, partsToScene, pickLibPart, libPartToScene, thumbFor, regenThumbs, addItemInst, pickItem, instOf, itemEquip, addToItem, TL, IC, flush: () => S.q};
