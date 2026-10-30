import {History} from './history.js';
import * as PX from './pixels.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import {KINDS, KIND_NAMES} from '../role/schema.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {const e = document.createElement(tag); if (cls) e.className = cls; return e;};
const RAD = Math.PI / 180;
const round = (v, n = 1000) => Math.round(v * n) / n;
const join = (path, name) => path ? `${path}/${name}` : name;

const cv = $('cv'), g = cv.getContext('2d');

// 世界座標 = 遊戲單位；每層畫面大小 = 像素 × L.scale（自動零件的 L.scale 就是 equip.scale）
const LAYER_SCALE = 0.25;
const S = {
    root: null,             // 工作資料夾：專案的 images/
    assets: null,           // 遊戲的 public/assets：{dir, json, roles}
    projSig: null,      // 上次存／開專案時整個畫布的內容，跟現在比對出有沒有沒存的修改
    layers: [],
    active: null,
    ref: {tw: 32, th: 32, rw: 32, rh: 64, ax: 0, ay: 16},
    doll: {sex: 'm', hair: true},
    view: {zoom: 2, px: 0, py: 0},
    mode: {type: 'move'},
    keys: new Set(),
};
const hist = new History();
let uid = 0;

const zoomK = () => S.view.zoom;
const status = (msg) => {$('status').textContent = msg;};

// ---------- 座標轉換 ----------

const modeScale = (L) => S.mode.type === 'scale' && S.mode.layer === L ? [S.mode.sx, S.mode.sy]
                       : editSp()?.view === L ? editSp().vk : [1, 1];
const layerImg = (L) => S.mode.layer === L && S.mode.preview ? S.mode.preview : L.canvas;

function toWorld(L, px, py, [sx, sy] = modeScale(L))
{
    const img = layerImg(L), k = L.scale;
    const dx = (px - L.ox * img.width) * sx * k, dy = (py - L.oy * img.height) * sy * k;
    const c = Math.cos(L.a * RAD), s = Math.sin(L.a * RAD);
    return {x: L.x + dx * c - dy * s, y: L.y + dx * s + dy * c};
}

function toLocal(L, wx, wy, [sx, sy] = modeScale(L))
{
    const img = layerImg(L), k = L.scale;
    const dx = wx - L.x, dy = wy - L.y;
    const c = Math.cos(-L.a * RAD), s = Math.sin(-L.a * RAD);
    return {x: (dx * c - dy * s) / sx / k + L.ox * img.width, y: (dx * s + dy * c) / sy / k + L.oy * img.height};
}

function screenToWorld(e)
{
    const r = cv.getBoundingClientRect(), K = zoomK();
    return {x: (e.clientX - r.left - S.view.px) / K, y: (e.clientY - r.top - S.view.py) / K};
}

const corners = (L) => {
    const {width: w, height: h} = layerImg(L);
    return [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y]) => toWorld(L, x, y));
};

// ---------- 圖層 ----------

function addLayer(img, name, dir, path)
{
    const src = PX.fromImage(img);
    const L = {id: ++uid, name, dir, path, src, ops: [], canvas: src, x: 0, y: 0, a: 0, ox: 0.5, oy: 1, scale: LAYER_SCALE,
               visible: true, opacity: 1, locked: false, save: true, proj: S.active?.proj ?? null};
    S.layers.push(L);
    select(L);
    status(`載入 ${name}.png`);
    return L;
}

function removeLayer(L)
{
    const m = S.mode;
    if (m.type === 'auto' && m.parts)
    {
        if (m.src === L) m.src = null;
        m.parts = m.parts.filter(p => p.C !== L);
        if (!m.parts.length) cancelMode();
        else
        {
            const drop = (list) => list.map(s => {const d = History.drop(s, L, true); return d && {...s, ...d};}).filter(Boolean);
            Object.assign(m, {snap: History.drop(m.snap, L, true), hist: drop(m.hist), fut: drop(m.fut)});
        }
    }
    else if (m.type === 'split' && (m.F === L || m.B === L)) m[m.F === L ? 'F' : 'B'] = null;
    else if (m.layer === L) cancelMode();
    S.layers.splice(S.layers.indexOf(L), 1);
    hist.forget(L, true);
    if (S.active === L) S.active = S.layers.at(-1) ?? null;
    refreshAll();
}

// 合成一張新圖層放在最底層的位置；中心點的世界座標沿用最底層的，旋轉烘進像素
function mergeLayers(layers)
{
    cancelMode();
    const base = layers[0];
    const bake = layers.some(L => L.opacity < 1) && confirm('有半透明圖層，要烘入不透明度嗎？（取消＝照 100% 合併）');
    const {big, minX, minY, k} = flatten(layers, bake);
    hist.push(hist.snapList(S));
    const L = {id: ++uid, name: `${base.name}-merged`, dir: base.dir, path: base.path, src: big, ops: [], canvas: big,
               x: base.x, y: base.y, a: 0, ox: (base.x - minX) / k / big.width, oy: (base.y - minY) / k / big.height, scale: k,
               visible: true, opacity: 1, locked: false, save: true, proj: base.proj};
    const i = S.layers.indexOf(base);
    S.layers = S.layers.filter(M => !layers.includes(M));
    S.layers.splice(i, 0, L);
    select(L);
    status(`合併 ${layers.length} 個圖層 → ${L.name}`);
}

// ops 跟 canvas 都不會被就地修改，直接共用參照；複本不算自動拆出的零件，也不帶人偶標記（同部位只能一層）
function cloneAbove(L, name, below = false)
{
    const {auto, autoSrc, splitSrc, tag, ...rest} = L;
    const C = {...rest, id: ++uid, name};
    S.layers.splice(S.layers.indexOf(L) + (below ? 0 : 1), 0, C);
    return C;
}

function toBottom(L)
{
    S.layers.splice(S.layers.indexOf(L), 1);
    S.layers.unshift(L);
    return L;
}

function duplicateLayer()
{
    const L = S.active;
    if (!L) return status('先選一個圖層');
    cancelMode();
    hist.push(hist.snapList(S));
    const C = cloneAbove(L, `${L.name}-copy`);
    select(C);
    status(`複製圖層 ${L.name} → ${C.name}`);
}

function mergeDown()
{
    const L = S.active, below = S.layers[S.layers.indexOf(L) - 1];
    if (!L || !below) return status('向下合併需要選取的圖層下面還有一層');
    if (!L.visible || !below.visible) return status('向下合併需要兩層都顯示');
    if (L.locked || below.locked) return status('有鎖定的圖層，不能合併');
    mergeLayers([below, L]);
}

function mergeVisible()
{
    const layers = S.layers.filter(L => L.visible && !L.locked);
    if (layers.length < 2) return status('顯示中、沒鎖定的圖層不到兩層');
    mergeLayers(layers);
}

function closeAll()
{
    if (!S.layers.length) return;
    if (isUnsaved() && !confirm('目前有沒存的修改，要放棄嗎？')) return;
    cancelMode();
    hist.undos.length = hist.redos.length = 0;
    Object.assign(S, {layers: [], active: null, projSig: null});
    refreshAll();
    status('已關閉');
}

// ---------- 參考人偶：圖層標成 男／女 的 髮／頭／身體（tag＝m-hair…），切換時批次改顯示（跟 👁 一樣不進 undo） ----------

const DOLL_SEX = {m: '男', f: '女'}, DOLL_PART = {hair: '髮', head: '頭', body: '身體'};
const dollBadge = (tag) => {const [s, p] = tag.split('-'); return (s === 'm' ? '♂' : '♀') + DOLL_PART[p][0];};

// 自動護具零件的標示：看 auto.key 算、只顯示；前後片沒有 auto，從原頭盔層找
const ARMOR_BADGE = {helmet: ['盔', '頭盔'], armor: ['甲', '胸甲'], boots: ['靴', '靴子']};

function armorBadge(L)
{
    const g = splitNew(L), b = ARMOR_BADGE[(g?.O ?? L).auto?.key];
    if (!b) return null;
    const [s, n] = L === g?.F ? ['前', '（前片）'] : L === g?.B ? ['後', '（後片）'] : ['', ''];
    return Object.assign(el('span', 'tag armor'), {textContent: b[0] + s, title: `自動護具：${b[1]}${n}`});
}

function setTag(L, tag)
{
    for (const M of S.layers) if (M.tag === tag) delete M.tag;
    if (tag) L.tag = tag;
    else delete L.tag;
    refreshAll();
}

function dollShow()
{
    for (const L of S.layers)
    {
        if (!L.tag) continue;
        const [s, p] = L.tag.split('-');
        L.visible = s === S.doll.sex && (p !== 'hair' || S.doll.hair);
    }
}

// 換性別也換自動護具用的那組數字：拆過就照新那組重新擺放（有變才記一步模式內 undo，連性別一起退）
function setDoll(d)
{
    const m = S.mode, parts = d.sex && d.sex !== S.doll.sex && m.type === 'auto' ? (m.parts ?? []).filter(p => p.P.kind === 'armor') : [];
    const before = parts.length && autoState(m);
    Object.assign(S.doll, d);
    dollShow();
    autoSet(S.auto);
    const diff = parts.filter(p => !autoSame(p.P, autoCfg(p.P), autoRow(p)));
    if (diff.length) autoStep(m, before);
    for (const p of diff) autoApply(m, p, autoCfg(p.P), false);
    refreshAll();
}

function tagMenu(e, L)
{
    e.preventDefault();
    const items = Object.entries(DOLL_SEX).flatMap(([s, sn]) => Object.entries(DOLL_PART).map(([p, pn]) =>
        [`${L.tag === `${s}-${p}` ? '✔ ' : ''}${sn}：${pn}`, () => setTag(L, `${s}-${p}`)]));
    ctxMenu(e.clientX, e.clientY, L.tag ? [...items, ['取消標記', () => setTag(L, null)]] : items);
}

function select(L)
{
    const m = S.mode;
    if (m.type === 'auto' ? !autoKeeps(m, L) : m.layer && m.layer !== L) leaveMode();
    S.active = L;
    refreshAll();
}

function pick(w, only = null)
{
    for (let i = S.layers.length - 1; i >= 0; i--)
    {
        const L = S.layers[i];
        if (!L.visible || L.locked || (only && !only.includes(L))) continue;
        const p = toLocal(L, w.x, w.y, [1, 1]);
        if (PX.alphaAt(L.canvas, p.x, p.y) > 0) return L;
    }
    return null;
}

// 畫面永遠是「原圖 + 依序重播 ops」；相鄰的 xform（裁切／縮放／trim）合成一步，從原圖只取樣一次
function pushOp(L, op)
{
    const last = L.ops.at(-1);
    if (op.type === 'xform' && last?.type === 'xform') L.ops = [...L.ops.slice(0, -1), PX.compose(last, op)];
    else if (op.type === 'alpha' && last?.type === 'alpha') L.ops = [...L.ops.slice(0, -1), {type: 'alpha', t: Math.max(last.t, op.t)}];
    else L.ops = [...L.ops, op];
    L.canvas = PX.replay(L.src, L.ops);
}

// 裁切後讓內容留在原地：新圖的中心點對應舊圖的 (x + ox*w, y + oy*h)
function applyCrop(L, x, y, w, h)
{
    const p = toWorld(L, x + L.ox * w, y + L.oy * h, [1, 1]);
    pushOp(L, {type: 'xform', sx: x, sy: y, sw: w, sh: h, w, h});
    Object.assign(L, {x: p.x, y: p.y});
}

const trimT = () => Math.min(255, Math.max(1, Math.round(+$('trimT').value || 1)));

function trimLayer(L)
{
    const b = PX.opaqueBounds(L.canvas, trimT());
    if (!b || (b.w === L.canvas.width && b.h === L.canvas.height)) return false;
    hist.record(L);
    applyCrop(L, b.x, b.y, b.w, b.h);
    return true;
}

// ---------- 自動模式 ----------
// 整張 AI 原圖（綠底、零件各在一個象限）拆成零件圖層：清除透明 → 移除綠色 → 只留自己的塊 → 裁到零件的範圍 → 縮放
// 零件可能跨過中線，所以不切象限：去綠後分連通塊，依重心歸到象限，零件範圍＝它所有塊的外接矩形；
// 範圍會跟別的塊重疊（左上戴頭盔的頭，下巴伸進護甲的範圍），所以裁切前先清掉不是自己的塊（左上沒人認領，整塊丟掉）
// 左上的頭盔常跟護甲黏成一塊（重心落到左上，護甲整個被丟掉）：四個象限湊不齊就逐步加侵蝕量重分（最多 AUTO_ERODE px），侵蝕量記在 blobs 步驟上
// 數字記在 localStorage，也跟著專案設定存讀；x/y 是遊戲單位
// kind：'armor'（護具，上面那套）／'weapon'（透明底的單把武器：清除透明 → 去雜點 → 裁到剛好 → 縮放，只有一個零件，多調 a/ox/oy）
//       'head'（透明底、左光頭右頭髮、臉是綠洞：去綠後照重心在中線左右分，只有一邊有塊就全當頭；兩個零件各自 存檔%，連動（headLink）時頭髮跟頭一樣，另外合成頭像 portrait）

const GREEN = {h1: 45, h2: 85, s1: 60, s2: 255, v1: 20, v2: 255, rgbThr: 40};
const AUTO_ALPHA = 32;
const AUTO_NOISE = 0.01;    // 比最大塊的 1% 還小的塊當雜點
const AUTO_ERODE = 12;
const AUTO_PARTS = [
    {key: 'helmet', kind: 'armor', name: '頭盔', quad: '右上', qx: 1, qy: 0},
    {key: 'armor', kind: 'armor', name: '護甲', quad: '左下', qx: 0, qy: 1},
    {key: 'boots', kind: 'armor', name: '靴子', quad: '右下', qx: 1, qy: 1},
    {key: 'weapon', kind: 'weapon', name: '武器'},
    {key: 'head', kind: 'head', name: '頭', side: 0},
    {key: 'hair', kind: 'head', name: '頭髮', side: 1},
];
const AUTO_KINDS = ['armor', 'weapon', 'head'];
// pct＝存檔%（原圖縮成幾 % 烤成 PNG），scale＝遊戲的 equip.scale／role 的 head.scale…；畫面大小＝原圖 × pct% × scale，兩個不互相換算
const AUTO_F = {armor: ['pct', 'scale', 'x', 'y'], weapon: ['pct', 'scale', 'x', 'y', 'a', 'ox', 'oy'], head: ['pct', 'scale', 'x', 'y']};
const AUTO_FF = ['scale', 'x', 'y'];
const AUTO_DEF = {helmet: {pct: 28, scale: 0.25, x: -1.75, y: -0.25}, armor: {pct: 20, scale: 0.25, x: 0.25, y: 26.5}, boots: {pct: 20, scale: 0.25, x: 1.5, y: 33},
                  weapon: {pct: 10, scale: 0.25, x: -13, y: 18, a: 0, ox: 0.5, oy: 0.85}, head: {pct: 18, scale: 0.25, x: -2, y: 4}, hair: {pct: 18, scale: 0.25, x: -1, y: 2}};
const AUTO_PORTRAIT = {size: 100, fill: 100};
const PT_F = ['size', 'fill'];
// 舊格式 {w, h, fill}：w 當 size、fill 重設
const ptFrom = (p) => p && 'w' in p ? {size: p.w, fill: AUTO_PORTRAIT.fill} : {...AUTO_PORTRAIT, ...p};
const AUTO_KEY = 'paperdoll.auto';
// 武器數字照分類各存一組（S.auto.weapon[cls]），cls 是目前的分類；分類從名字第一個 -／_ 前面猜，猜不到歸 default
// 分類的內建預設＝AUTO_DEF.weapon 蓋上 WCLS 第三欄；舊格式 weapon 直接放數字：複製到每個分類
const WCLS = [
    ['sword', '劍', {pct: 12, x: -6, y: 17, a: 60}],
    ['axe', '斧', {pct: 12, x: -6, y: 17, a: 60, ox: 0.3}],
    ['hammer', '錘', {x: -6, y: 17, a: 60}],
    ['dagger', '匕首', {x: 0, y: 16, a: 70, oy: 0.75}],
    ['staff', '法杖', {pct: 15, x: -6, y: 17, a: 60, oy: 0.7}],
    ['bow', '弓', {pct: 12, x: 5, y: 17, a: 60, ox: 0.7, oy: 0.5}],
    ['default', '預設', {}],
];
const wclsOk = (c) => WCLS.some(([k]) => k === c) ? c : 'default';
const wclsOf = (name) => wclsOk(name?.split(/[-_]/)[0]);
const wclsDef = (c) => ({...AUTO_DEF.weapon, ...WCLS.find(([k]) => k === c)[2]});
const wclsFrom = (w) => Object.fromEntries(WCLS.map(([k]) => [k, {...wclsDef(k), ...(w && 'pct' in w ? w : w?.[k])}]));
// split：'none'／'split'（拆前後片）／'cut'（挖除）；舊的 true/false 照轉
const AUTO_SPLIT = {true: 'split', false: 'none'};
const autoFrom = (v) => ({...Object.fromEntries(AUTO_PARTS.map(P => [P.key, {...AUTO_DEF[P.key], ...v?.[P.key]}])), weapon: wclsFrom(v?.weapon), cls: wclsOk(v?.cls),
                          split: AUTO_SPLIT[v?.split] ?? v?.split ?? 'split', kind: AUTO_KINDS.includes(v?.kind) ? v.kind : 'armor',
                          portrait: ptFrom(v?.portrait), headLink: v?.headLink ?? true, saveF: !!v?.saveF,
                          f: Object.fromEntries(AUTO_PARTS.filter(P => P.kind === 'armor').map(P => [P.key, femaleFrom(P, v)]))});
// 舊格式沒有 scale（當時固定 0.25）；女版以前有自己的 pct，換成同一張 PNG 的 scale＝0.25 × 女pct ÷ 男pct
function femaleFrom(P, v)
{
    const d = AUTO_DEF[P.key], o = v?.f?.[P.key], pct = v?.[P.key]?.pct ?? d.pct;
    return {scale: o?.scale ?? round(d.scale * (o?.pct ?? pct) / pct, 10000), x: o?.x ?? d.x, y: o?.y ?? d.y};
}
const autoParts = (kind) => AUTO_PARTS.filter(P => P.kind === kind);
const pickKeys = (o, ks) => Object.fromEntries(ks.map(k => [k, o[k]]));
// 護具分男女兩組：S.auto.helmet… 是男版、S.auto.f.helmet… 是女版（只有 scale/x/y，存檔% 跟男版共用，PNG 只有一張），照 header 的 男｜女（S.doll.sex）選用
const autoFemale = (P) => P.kind === 'armor' && S.doll.sex === 'f';
const autoCfg = (P, a = S.auto) => P.kind === 'weapon' ? a.weapon[a.cls] : autoFemale(P) ? {...a[P.key], ...a.f[P.key]} : a[P.key];
const autoWith = (a, P, row) => P.kind === 'weapon' ? {...a, weapon: {...a.weapon, [a.cls]: row}}
                              : autoFemale(P) ? {...a, [P.key]: {...a[P.key], pct: row.pct}, f: {...a.f, [P.key]: pickKeys(row, AUTO_FF)}} : {...a, [P.key]: row};

function autoLoad()
{
    try {return JSON.parse(localStorage.getItem(AUTO_KEY));}
    catch {return null;}
}

function autoSet(v)
{
    S.auto = autoFrom(v);
    try {localStorage.setItem(AUTO_KEY, JSON.stringify(S.auto));}
    catch {}
    for (const P of AUTO_PARTS) for (const f of AUTO_F[P.kind]) $(`au-${P.key}-${f}`).value = autoCfg(P)[f];
    for (const f of PT_F) $(`au-pt-${f}`).value = S.auto.portrait[f];
    $('au-link').checked = S.auto.headLink;
    $('auSexL').textContent = S.doll.sex === 'f' ? '♀女版' : '♂男版';
    $('auFemale').checked = S.auto.saveF;
    $('auCls').value = S.auto.cls;
    document.querySelector(`[name=auHow][value=${S.auto.split}]`).checked = true;
    document.querySelector(`[name=auKind][value=${S.auto.kind}]`).checked = true;
}

// 拆出的零件記 auto = {key, gid}、原圖記 autoSrc = gid；裁切、縮小分兩步，存檔% 記在縮小的 xform 上（pct），
// 之後的裁切／縮放會跟它合成一步、pct 就不見了，所以零件步驟是 [...去綠, blobs, xform(裁切), xform(pct), ...paint] 才能再調（舊專案沒有 blobs）
// 零件拆了前後片時，前後片跟著零件搬、改 存檔% 一起重播、一起進模式內的 undo
const autoGid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function autoBase(C)
{
    let i = C.ops.length - 1;
    while (C.ops[i]?.type === 'paint') i--;
    const s = C.ops[i], c = C.ops[i - 1], k = C.ops[i - 2]?.type === 'blobs' ? 3 : 2;
    const g = C.ops[i - k]?.type === (C.auto?.key === 'weapon' ? 'alpha' : 'removeGreen');
    return s?.type === 'xform' && s.pct && c?.type === 'xform' && !c.pct && g ? i : -1;
}

const autoKeep = (C) => {const o = C.ops[autoBase(C) - 2]; return o?.type === 'blobs' ? o : null;};

function autoGroup(L)
{
    const gid = L.auto?.gid ?? L.autoSrc;
    const parts = gid ? S.layers.filter(C => C.auto?.gid === gid) : [];
    return parts.length ? {gid, parts, src: S.layers.find(M => M.autoSrc === gid) ?? null} : null;
}

const autoLayers = (parts) => parts.flatMap(p => linked(p.C));
const autoSnap = (parts) => ({group: [hist.snapList(S), ...autoLayers(parts).map(L => hist.snap(L, true))]});
const AUTO_STEPS = 50;
const autoRow = ({P, C}) => ({pct: C.ops[autoBase(C)].pct, scale: round(C.scale, 10000), x: round(C.x), y: round(C.y),
                              ...(P.kind === 'weapon' && {a: round(C.a, 10), ox: C.ox, oy: C.oy})});
const autoSame = (P, a, b) => AUTO_F[P.kind].every(f => a[f] === b[f]);

function autoScale(T, part, pct)
{
    const {C, box, keep} = part, k = pct / 100;
    const crop = {type: 'xform', ...box, w: box.sw, h: box.sh};
    const op = {type: 'xform', sx: 0, sy: 0, sw: box.sw, sh: box.sh, w: Math.max(1, Math.round(box.sw * k)), h: Math.max(1, Math.round(box.sh * k)), smooth: true, pct};
    const ops = [...(keep ? [keep] : []), crop, op];
    Object.assign(C, {ops: [...T.ops, ...ops], canvas: PX.replay(T.canvas, ops)});
    splitSync(C, T);
}

function autoShift(C, x, y)
{
    const dx = x - C.x, dy = y - C.y;
    for (const L of linked(C)) Object.assign(L, {x: L.x + dx, y: L.y + dy});
}

function autoPlace({P, C}, {scale, x, y, a, ox, oy})
{
    if (P.kind === 'weapon') Object.assign(C, {a, ox, oy});
    for (const L of linked(C)) L.scale = scale;
    autoShift(C, x, y);
}

// 模式內的步驟：每個動作（改一個數字、拖一次、按一下方向鍵、改一下頭盔切線）記零件（含前後片、圖層清單）改之前的樣子和切線；
// 離開時還有步驟才記一筆全域 undo
const autoState = (m) => ({group: m.parts ? [hist.snapList(S), ...autoLayers(m.parts).map(L => hist.snap(L, true))] : [], sp: m.sp && splitState(m.sp), cls: S.auto.cls, link: S.auto.headLink,
                           sex: S.doll.sex});

function autoStep(m, s = autoState(m))
{
    m.hist.push(s);
    if (m.hist.length > AUTO_STEPS) m.hist.shift();
    m.fut = [];
}

function autoUndo(m, from, to)
{
    const s = from.pop();
    if (!s) return false;
    to.push(autoState(m));
    History.restore(s);
    if (s.sp && m.sp)
    {
        Object.assign(m.sp, s.sp);
        spSet(m.sp);
        autoSet({...S.auto, split: m.sp.cut ? 'cut' : 'split'});
    }
    if (s.sex !== S.doll.sex)
    {
        S.doll.sex = s.sex;
        dollShow();
        autoSet(S.auto);
    }
    if (!m.parts) return true;
    for (const p of m.parts) if (p.P.kind === 'weapon') p.C.auto = {...p.C.auto, cls: s.cls};
    autoSet(m.parts.reduce((a, p) => autoWith(a, p.P, autoRow(p)), {...S.auto, cls: s.cls, headLink: s.link}));
    return true;
}

// 頭盔的切線（sp，欄位同前後片模式）只在拆之前、選了前後片／挖除時有，畫在原圖頭盔那塊上；拆完就不再顯示，要調去前後片模式
// 追線在裁切後、縮小前的圖（sp.img）上做
function autoSpView(m)
{
    const sp = m.sp, img = sp.img, L = m.layer, box = m.plan.find(b => b.P.key === 'helmet').box;
    Object.assign(sp, {vk: [1, 1], view: {canvas: img, get x() {return L.x;}, get y() {return L.y;}, get a() {return L.a;}, get scale() {return L.scale;},
                                           get ox() {return (L.ox * L.canvas.width - box.sx) / img.width;},
                                           get oy() {return (L.oy * L.canvas.height - box.sy) / img.height;}}});
}

const autoHelmet = (m) => m.parts?.find(p => p.P.key === 'helmet')?.C ?? null;

// 拆之前切換 不拆／前後片／挖除：不拆就不追頭盔切線；前後片跟挖除互換記一步、重新追線
function autoSpSync(m)
{
    if (m.type !== 'auto' || m.parts) return;
    const hb = S.auto.split !== 'none' && m.plan.find(b => b.P.key === 'helmet');
    if (!hb) m.sp = null;
    else if (!m.sp) autoSpNew(m, hb);
    else if (m.sp.cut !== (S.auto.split === 'cut'))
    {
        const p = spPreset(!m.sp.cut);
        spChange({...p, c: spCrit(p.method)});
        spSet(m.sp);
    }
}

// 去綠、依象限分好零件的範圍；進模式時就算，頭盔的切線要用
function autoPlan(L, kind)
{
    const T = {src: L.src, ops: L.ops};
    pushOp(T, {type: 'alpha', t: AUTO_ALPHA});
    const split = (erode) => {
        const all = PX.blobs(T.canvas, trimT(), erode), big = Math.max(0, ...all.map(b => b.n));
        return all.filter(b => b.n >= big * AUTO_NOISE);
    };
    const part = (P, mine, erode) => {
        const x0 = Math.min(...mine.map(b => b.x)), y0 = Math.min(...mine.map(b => b.y));
        return {P, box: {sx: x0, sy: y0, sw: Math.max(...mine.map(b => b.x1)) + 1 - x0, sh: Math.max(...mine.map(b => b.y1)) + 1 - y0},
                keep: {type: 'blobs', t: trimT(), pts: mine.map(b => [b.sx, b.sy]), ...(erode ? {erode} : {})}};
    };
    if (kind === 'weapon')
    {
        const blobs = split(0);
        return {T, plan: blobs.length ? [part(autoParts(kind)[0], blobs, 0)] : [], skipped: []};
    }
    pushOp(T, {type: 'removeGreen', ...GREEN});
    const W = T.canvas.width, H = T.canvas.height;
    if (kind === 'head')
    {
        const blobs = split(0), left = (b) => b.cx < W / 2, both = blobs.some(left) && !blobs.every(left);
        const plan = [], skipped = [];
        // 頭髮先建，疊在頭上面
        for (const P of autoParts(kind).reverse())
        {
            const mine = blobs.filter(b => both ? left(b) === (P.side === 0) : P.side === 0);
            if (!mine.length) {skipped.push(P.name); continue;}
            plan.push(part(P, mine, 0));
        }
        return {T, plan, skipped};
    }
    const quad = (b, qx, qy) => (b.cx >= W / 2) === !!qx && (b.cy >= H / 2) === !!qy;
    let blobs = split(0), erode = 0;
    for (let k = 1; k <= AUTO_ERODE && ![0, 1].every(qx => [0, 1].every(qy => blobs.some(b => quad(b, qx, qy)))); k++)
    {
        const bs = split(k);
        if ([0, 1].every(qx => [0, 1].every(qy => bs.some(b => quad(b, qx, qy))))) [blobs, erode] = [bs, k];
    }
    const plan = [], skipped = [];
    for (const P of autoParts(kind))
    {
        const mine = blobs.filter(b => quad(b, P.qx, P.qy));
        if (!mine.length) {skipped.push(P.name); continue;}
        plan.push(part(P, mine, erode));
    }
    return {T, plan, skipped};
}

function autoSpNew(m, {box, keep})
{
    const p = spPreset(S.auto.split === 'cut'), c = spCrit(p.method);
    m.sp = {img: PX.replay(m.T.canvas, [keep, {type: 'xform', ...box, w: box.sw, h: box.sh}]), c,
            close: S.sp.close, down: S.sp.down, drop: S.sp.drop, right: S.sp.right, reach: S.sp.reach, ...p, mark: null, poly: null, err: null};
    spSet(m.sp);
    autoSpView(m);
    m.sp.start = splitDefStart(m.sp.view, c);
    splitRun(m.sp);
}

// 拆完後改數字直接套到零件：存檔% 變了才從去綠圖重新取樣（有 paint 要先問），scale／x／y 只改擺放
function autoApply(m, part, row, step = true)
{
    const cur = autoRow(part);
    if (autoSame(part.P, row, cur)) return;
    if (row.pct !== cur.pct && hasPaint(part.C) && !confirm(`${part.C.name} 有像素修補，改存檔% 要清除修補，要清除嗎？`)) return;
    if (step) autoStep(m);
    if (row.pct !== cur.pct)
    {
        m.T.canvas ??= PX.replay(m.T.src, m.T.ops);
        autoScale(m.T, part, row.pct);
    }
    autoPlace(part, row);
    autoSave(part);
}

// 畫布拖曳／方向鍵搬零件：一次拖曳只在第一次真的移動時記步驟，拖完（每按一次方向鍵）寫回全域預設
function autoMove(m, part, x, y, step = true)
{
    const {C} = part;
    if (x === C.x && y === C.y) return false;
    if (step) autoStep(m);
    autoShift(C, x, y);
    return true;
}

// 武器的支點／角度：x/y（手的位置）不動，圖跟著動
function autoPose(m, part, v, step = true)
{
    const {C} = part;
    if (Object.keys(v).every(k => v[k] === C[k])) return false;
    if (step) autoStep(m);
    Object.assign(C, v);
    return true;
}

const autoWeapon = (m) => m.type === 'auto' && m.parts?.find(p => p.P.kind === 'weapon') || null;
const autoSave = (part) => autoSet(autoWith(S.auto, part.P, autoRow(part)));

// 沒拆過：先算好零件範圍（勾了拆前後片就追頭盔切線），只調數字和切線，確定才拆；拆過（選原圖或零件）：直接進調整，去綠圖從零件自己的步驟反推
function autoEnter(L)
{
    const g = autoGroup(splitNew(L)?.O ?? L);
    if (!g)
    {
        if (hasPaint(L)) return alert('這層有像素修補，縮放／變形會讓修補對不上；要先到「像素」模式按「清除修補」'), null;
        const kind = S.auto.kind, {T, plan, skipped} = autoPlan(L, kind);
        if (kind === 'weapon') autoSet({...S.auto, cls: wclsOf(L.name)});
        const m = {type: 'auto', kind, layer: L, parts: null, T, plan, skipped, sp: null, hist: [], fut: []};
        autoSpSync(m);
        return m;
    }
    const bad = g.parts.filter(C => autoBase(C) < 0);
    if (bad.length) return status(`${bad.map(C => C.name).join('、')} 拆完後改過（或是舊格式），不能再自動調整；要重拆先取消自動`), null;
    const C0 = g.parts[0], kind = AUTO_PARTS.find(P => P.key === C0.auto.key).kind;
    const T = {src: C0.src, ops: C0.ops.slice(0, autoBase(C0) - (autoKeep(C0) ? 2 : 1)), canvas: null};
    const parts = autoParts(kind).map(P => g.parts.find(C => C.auto.key === P.key)).filter(Boolean).map(C => {
        const {sx, sy, sw, sh} = C.ops[autoBase(C) - 1];
        return {P: AUTO_PARTS.find(P => P.key === C.auto.key), C, box: {sx, sy, sw, sh}, keep: autoKeep(C)};
    });
    autoSet({...S.auto, kind, ...(kind === 'weapon' && {cls: wclsOk(C0.auto.cls ?? wclsOf(C0.name))})});
    const m = {type: 'auto', kind, layer: null, gid: g.gid, src: g.src, T, parts, sp: null, snap: autoSnap(parts), hist: [], fut: []};
    status(`調整 ${parts.map(p => p.C.name).join('、')}`);
    return m;
}

// 照進模式時算好的範圍，每個零件複製一層疊在原圖上（由下往上 靴子、護甲、頭盔），原圖隱藏；
// 頭盔有切線就一起拆成前後片（選前片），之後不再顯示切線；記一筆 undo，留在模式裡繼續調
function autoSplit(m)
{
    const L = m.layer, {T, plan, skipped} = m;
    if (!plan.length) return status(`${m.kind === 'weapon' ? '清除透明' : '去綠'}之後找不到零件`);
    const undo = {group: [hist.snapList(S), hist.snap(L, true)]};
    const gid = L.autoSrc ?? autoGid();
    const parts = plan.map(({P, box, keep}) => {
        const C = cloneAbove(L, P.kind === 'weapon' ? L.name : `${L.name}-${P.key}`);
        Object.assign(C, {a: 0, ox: 0.5, oy: 1, visible: true, opacity: 1, auto: {key: P.key, gid, ...(P.kind === 'weapon' && {cls: S.auto.cls})}});
        const part = {P, C, box, keep};
        autoScale(T, part, autoCfg(P).pct);
        autoPlace(part, autoCfg(P));
        return part;
    });
    L.autoSrc = gid;
    L.visible = false;
    S.active = parts[0].C;
    hist.push(undo);
    Object.assign(m, {layer: null, gid, src: L, parts, hist: [], fut: []});
    const H = autoHelmet(m);
    if (H && m.sp?.poly) S.active = splitBuild(H, m.sp, H.splitSrc ?? autoGid());
    autoStack(parts);
    const sp = H && m.sp && !m.sp.poly ? `；頭盔沒拆前後片：${m.sp.err}` : '';
    m.sp = null;
    m.snap = autoSnap(parts);
    const skip = !skipped.length ? '' : m.kind === 'head' ? '；只有一邊有東西，全部當頭、沒有頭髮' : `；${skipped.join('、')} 的象限是空的，略過`;
    status(`自動拆出 ${parts.map(p => p.C.name).join('、')}${skip}${sp}`);
}

// 原頭盔層放在前片正上方；有標記成頭的參考人偶就照遊戲深度（PART_DEPTH）插進去：頭盔（前片）在最高的頭／髮上面，後片、護甲、靴子由上往下接在最低的頭下面
function autoStack(parts)
{
    const C = (k) => parts.find(p => p.P.key === k)?.C, H = C('helmet'), g = H && splitNew(H);
    if (g?.F)
    {
        S.layers.splice(S.layers.indexOf(H), 1);
        S.layers.splice(S.layers.indexOf(g.F) + 1, 0, H);
    }
    const doll = S.layers.filter(L => /-(head|hair)$/.test(L.tag ?? '')), head = doll.find(L => L.tag.endsWith('-head'));
    if (!head) return;
    const top = H ? [g?.F, H].filter(Boolean) : [], below = [C('boots'), C('armor'), g?.B].filter(Boolean);
    S.layers = S.layers.filter(L => !top.includes(L) && !below.includes(L));
    S.layers.splice(S.layers.indexOf(head), 0, ...below);
    S.layers.splice(S.layers.indexOf(doll.at(-1)) + 1, 0, ...top);
}

// 取消自動：刪掉這組零件、原圖重新顯示，記一筆 undo；還沒拆就只是離開
function autoRevoke()
{
    const m = S.mode;
    if (m.type !== 'auto' || !m.parts) return cancelMode();
    const parts = S.layers.filter(C => C.auto?.gid === m.gid).flatMap(linked), src = m.src;
    if (m.hist.length) hist.push(m.snap);
    hist.push({group: [hist.snapList(S), ...(src ? [hist.snap(src, true)] : [])]});
    S.layers = S.layers.filter(C => !parts.includes(C));
    if (src) src.visible = true;
    S.active = src ?? S.layers.at(-1) ?? null;
    S.mode = {type: 'move'};
    status(`取消自動，刪掉 ${parts.map(C => C.name).join('、')}`);
    refreshAll();
}

function autoKeeps(m, L)
{
    if (!m.parts) return L === m.layer;
    return L === m.src || !!autoPart(m, L);
}

const autoPart = (m, L) => m.parts?.find(p => linked(p.C).includes(L)) ?? null;

// 自動拆出的零件（或它的前後片）：縮放模式拉它改的是存檔%（重烤），等比
function autoOwner(L)
{
    const g = autoGroup(splitNew(L)?.O ?? L);
    return g?.parts.find(C => linked(C).includes(L) && autoBase(C) >= 0) ?? null;
}

// 縮放模式按確定：借自動模式套數字（存檔%×k，連動時頭髮跟著，拖過的位移換成 x/y），整次一筆 undo
function autoRescale(L, k, dx, dy)
{
    const m = autoEnter(autoOwner(L));
    if (!m) return;
    const part = autoPart(m, L), row = autoRow(part), pct = round(row.pct * k, 100);
    const peers = part.P.kind === 'head' && S.auto.headLink ? m.parts.filter(p => p.P.kind === 'head') : [part];
    autoApplyAll(m, peers.map(p => [p, {...autoRow(p), pct, ...(p === part && {x: round(row.x + dx), y: round(row.y + dy)})}]));
    if (m.hist.length) hist.push(m.snap);
    status(`${part.C.name} 存檔% ${row.pct} → ${autoRow(part).pct}`);
}

// ---------- 前後片 ----------
// 頭盔拆成三層：原圖 X（隱藏、步驟不動，記 splitSrc = gid）、蓋住頭的前片 X-front（原圖步驟＋mask 挖掉）、
// 被頭蓋住的後片 X-back（＋mask keep），前片疊在原圖上面、後片放到最底層，三層同尺寸、擺放連動（linked()）
// PX.splitTrace() 從起點追輪廓線產生後片多邊形，可以拖頂點／點邊加點，拖起點或改門檻就重算覆蓋
// mask 插在原圖步驟的 splitAt()：一般接在最後；自動零件插在縮小（xform pct）前面，追線在縮小前的圖上做，改 存檔% 前後片跟著重播
// 存成（前後片／挖除 cut）跟切割方法（method：沿線 trace＝PX.splitTrace()、魔術棒 wand＝PX.splitCut()）分開，多邊形都是「從前片拿掉的那塊」
// mask 帶 split = {gid, x, y, c, cut, method, close, down, drop, right, reach, mark, w, h, n}（起點、線的條件、挖除、切割方法、閉運算、往下射／往右射（勾選、X px）、
// 手畫標記（行程編碼）、追線那張圖的尺寸、mask 後面原本跟著幾步），
// 靠 gid 認一組，跟著 ops 存進專案；c 只有 t 的舊資料當只勾亮度；舊格式（前片就是原圖，split 沒有 w）不認
// 挖除（cut）：多邊形那塊挖成透明，只有原圖＋前片、沒有後片；舊挖除的 over 不用了

const SPLIT_KEY = 'paperdoll.split';
const SPLIT_STEPS = 50;
const splitIdx = (L) => L.ops.findIndex(o => o.type === 'mask' && o.split);
const splitOp = (L) => L.ops[splitIdx(L)] ?? null;
const splitAt = (O) => O.auto && autoBase(O) >= 0 ? autoBase(O) : O.ops.length;
const splitOld = (g) => [g.F, g.B].some(M => M && !('w' in splitOp(M).split));
const splitOwn = (M) => M.ops.length - splitIdx(M) - 1 !== splitOp(M).split.n;

// 原圖被刪掉時只剩前後片（照樣能存）；前後片都沒了就不算一組
function splitGroup(L)
{
    const gid = L.splitSrc ?? splitOp(L)?.split.gid;
    if (!gid) return null;
    const find = (keep) => S.layers.find(M => {const o = splitOp(M); return o?.split.gid === gid && !!o.keep === keep;}) ?? null;
    const F = find(false), B = find(true);
    return F || B ? {gid, O: S.layers.find(M => M.splitSrc === gid) ?? null, F, B, cut: !!splitOp(F ?? B).split.cut} : null;
}

const splitNew = (L) => {const g = splitGroup(L); return g && !splitOld(g) ? g : null;};

const linked = (L) => {
    const g = splitNew(L);
    return g ? [L, ...[g.O, g.F, g.B].filter(M => M && M !== L)] : [L];
};

// 照原圖現在的步驟重新產生前後片（mask 不動）；base = {ops, canvas} 是原圖步驟的前段已經算好的圖，從它接著重播
function splitSync(O, base = null)
{
    const g = splitNew(O);
    if (!g) return;
    const at = splitAt(O);
    for (const M of [g.F, g.B].filter(Boolean))
    {
        const o = splitOp(M);
        M.ops = [...O.ops.slice(0, at), {...o, split: {...o.split, n: O.ops.length - at}}, ...O.ops.slice(at)];
        M.canvas = base?.canvas ? PX.replay(base.canvas, M.ops.slice(base.ops.length)) : PX.replay(M.src, M.ops);
    }
}

// 線的亮度門檻、挖除、閉運算、往下射是前後片跟自動共用的設定（S.sp），記在 localStorage
// 切線（前後片模式本身、自動模式的 mode.sp）自己帶一份 c = {lum}、cut、method、close、down、drop、right、reach，undo 跟著退
const SP_LUM = 24, SP_CLOSE = 10, SP_DROP = 20, SP_REACH = 20;

// 切換存成時帶的切法（單向，之後可以手動改）：前後片＝沿線，挖除＝魔術棒＋往下射、不往右射
const spPreset = (cut) => cut ? {cut, method: 'wand', down: true, right: false} : {cut, method: 'trace'};

// 亮度門檻依切割方法各存一份 lum = {trace, wand}；舊設定的 lum 是單一數字或 {on, v}、更舊的只有 paperdoll.splitT，兩種方法都用它
function spLoad()
{
    let v = null, t = null;
    try {v = JSON.parse(localStorage.getItem(SPLIT_KEY)); t = +localStorage.getItem('paperdoll.splitT');}
    catch {}
    const old = typeof v?.lum === 'number' ? v.lum : v?.lum?.v ?? (t || SP_LUM);
    const lum = {trace: v?.lum?.trace ?? old, wand: v?.lum?.wand ?? old};
    return {cut: !!v?.cut, method: v?.method ?? (v?.cut ? 'wand' : 'trace'), close: v?.close ?? SP_CLOSE, down: v?.down ?? true, drop: v?.drop ?? SP_DROP,
            right: !!v?.right, reach: v?.reach ?? SP_REACH, lum};
}

const spCrit = (method = S.sp.method) => ({lum: S.sp.lum[method]});
// 舊資料：只有門檻 t、或 c 裡亮度沒勾（當時只勾 RGB）就用預設亮度
const spOf = (o) => ({lum: o.c?.lum ?? o.t ?? SP_LUM});

// 把切線（或只給設定）寫回共用設定跟面板；cut 只有前後片模式的切線才寫回（自動的挖除記在 S.auto）
function spSet(sp = null, cut = false)
{
    if (sp) Object.assign(S.sp, {lum: {...S.sp.lum, [sp.method]: sp.c.lum}, method: sp.method, close: sp.close, down: sp.down, drop: sp.drop,
                                 right: sp.right, reach: sp.reach, ...(cut && {cut: sp.cut})});
    try {localStorage.setItem(SPLIT_KEY, JSON.stringify(S.sp));}
    catch {}
    $('sp-lum').value = $('sp-lum-v').textContent = S.sp.lum[S.sp.method];
    $('sp-close').value = S.sp.close;
    $('sp-down').checked = S.sp.down;
    $('sp-drop').value = S.sp.drop;
    $('sp-right').checked = S.sp.right;
    $('sp-reach').value = S.sp.reach;
}

// 色塊：游標底下追線那張圖的顏色（透明＝空的），游標不在圖上就清空
function spSwatch(px = null)
{
    const e = $('spSwatch'), show = px && px[3] > 0;
    e.classList.toggle('empty', !show);
    e.style.background = show ? `rgb(${px.slice(0, 3).join(',')})` : '';
    $('spRgba').textContent = px ? `(${px.join(',')})` : '—';
}

// 選三層哪一層都進來調原圖；模式裡顯示原圖、藏起前後片。追線那張圖（m.img）是原圖跑到 splitAt() 的樣子，
// 畫面上照原圖的擺放、縮 m.vk 倍畫（m.view 是借原圖擺放的假圖層，toWorld/toLocal 用它）
function splitStart(L)
{
    const g = splitGroup(L);
    if (g && splitOld(g)) return status('舊格式的前後片（前片就是原圖），要重拆請先 undo 或刪掉前後片'), null;
    const O = g ? g.O : L;
    if (!O) return status(`${L.name} 的原圖被刪掉了，不能再調前後片`), null;
    if (O.locked) return status(`${O.name} 鎖定中`), null;
    const own = [g?.F, g?.B].find(M => M && splitOwn(M));
    if (own) return status(`${own.name} 拆完後又加了步驟，不能再調前後片；要重拆先 undo`), null;
    const at = splitAt(O), img = at < O.ops.length ? PX.replay(O.src, O.ops.slice(0, at)) : O.canvas;
    const view = {canvas: img, get x() {return O.x;}, get y() {return O.y;}, get a() {return O.a;}, get ox() {return O.ox;}, get oy() {return O.oy;},
                  get scale() {return O.scale;}};
    const m = {type: 'split', layer: O, view, img, vk: [O.canvas.width / img.width, O.canvas.height / img.height],
               F: g?.F ?? null, B: g?.B ?? null, gid: g?.gid ?? null, hist: [], fut: [], changed: false, poly: null, err: null};
    const o = g && splitOp(g.F ?? g.B);
    if (o && o.split.w === img.width && o.split.h === img.height)
    {
        Object.assign(m, {start: {x: o.split.x, y: o.split.y}, c: spOf(o.split), cut: g.cut,
                          method: o.split.method ?? (g.cut && o.split.close != null ? 'wand' : 'trace'), close: o.split.close ?? SP_CLOSE, down: o.split.down ?? true, drop: o.split.drop ?? SP_DROP,
                          right: !!o.split.right, reach: o.split.reach ?? SP_REACH, mark: o.split.mark ? PX.markUnpack(o.split.mark, img.width * img.height) : null,
                          poly: {pts: o.pts.map(([x, y]) => ({x, y})), closed: true}});
        spSet(m, true);
        status(`接著調 ${O.name} 的${g.cut ? '挖除' : '前後片'}`);
        return m;
    }
    Object.assign(m, {c: spCrit(), cut: g ? g.cut : S.sp.cut, method: S.sp.method, close: S.sp.close, down: S.sp.down, drop: S.sp.drop, right: S.sp.right, reach: S.sp.reach, mark: null});
    m.start = splitDefStart(view, m.c);
    splitRun(m);
    if (o) status(`${O.name} 的尺寸變了，前後片重新追線`);
    return m;
}

// 不透明範圍正中央那一直行上，中央所在（落在線上就取線下面）那段線圍起來的區域的中點，離上下的線都遠一點
function splitDefStart(L, c)
{
    const b = PX.opaqueBounds(L.canvas, trimT()) ?? {x: 0, y: 0, w: L.canvas.width, h: L.canvas.height};
    const x = Math.floor(b.x + b.w / 2), y0 = Math.floor(b.y + b.h / 2), y1 = b.y + b.h;
    const px = (y) => PX.pixelAt(L.canvas, x, y) ?? [0, 0, 0, 0];
    const test = PX.lineTest(c);
    const inside = (y) => {const [r, gg, bl, a] = px(y); return a >= 128 && !test(r, gg, bl);};
    let a = y0;
    while (a < y1 && !inside(a)) a++;
    if (a >= y1) return {x, y: y0};
    let e = a;
    while (a > b.y && inside(a - 1)) a--;
    while (e + 1 < y1 && inside(e + 1)) e++;
    return {x, y: Math.floor((a + e) / 2)};
}

function splitRun(m)
{
    const r = m.method === 'wand' ? PX.splitCut(m.img, {...m.start, c: m.c, close: m.close, drop: m.down ? m.drop : 0, right: m.right ? m.reach : 0, mark: m.mark})
                                  : PX.splitTrace(m.img, {...m.start, c: m.c, mark: m.mark});
    m.err = r.err ?? null;
    m.poly = r.pts ? {pts: r.pts, closed: true} : null;
}

// mark 是寫入時才複製（一筆畫線換一個新陣列），所以步驟裡直接放參照
const splitState = (m) => ({poly: m.poly && {...m.poly}, start: m.start, c: m.c, cut: m.cut, method: m.method, close: m.close, down: m.down, drop: m.drop, right: m.right, reach: m.reach,
                            mark: m.mark, err: m.err});

// 改線的條件／挖除／閉運算／往下射：重新追線；rec＝這次拖曳滑桿已經記過一步
function spChange(patch, rec = false)
{
    const m = S.mode, sp = editSp();
    if (!sp) return;
    if (!rec || !m.tRec) spCommit(m, spBefore(m));
    if (rec) m.tRec = true;
    Object.assign(sp, patch);
    splitRun(sp);
    refreshModePanel();
    dirty();
}

function spHover(e)
{
    const sp = editSp(), w = screenToWorld(e), p = toLocal(sp.view, w.x, w.y);
    spSwatch(PX.pixelAt(sp.img, p.x, p.y));
}

// -／+：按住連續調，整段跟拖滑桿一樣只記一步
function spStep(d)
{
    const k = S.sp.method, v = Math.max(0, Math.min(256, S.sp.lum[k] + d));
    if (v === S.sp.lum[k]) return;
    S.sp.lum = {...S.sp.lum, [k]: v};
    $('sp-lum').value = $('sp-lum-v').textContent = v;
    spChange({c: spCrit()}, true);
}

function splitStep(m, s = splitState(m))
{
    m.hist.push(s);
    if (m.hist.length > SPLIT_STEPS) m.hist.shift();
    m.fut = [];
    m.changed = true;
}

function splitUndo(m, from, to)
{
    const s = from.pop();
    if (!s) return false;
    to.push(splitState(m));
    Object.assign(m, s, {changed: true});
    spSet(m, true);
    return true;
}

const splitStartHit = (m, w) => {
    const p = toWorld(m.view, m.start.x + 0.5, m.start.y + 0.5);
    return Math.hypot(p.x - w.x, p.y - w.y) * zoomK() < 10;
};

// 切線的編輯共用給前後片模式（sp 就是 mode）跟自動模式（sp 是 mode.sp，只在拆之前有）
const editSp = () => S.mode.type === 'split' ? S.mode : S.mode.type === 'auto' ? S.mode.sp : null;
const spBefore = (m) => m.type === 'split' ? splitState(m) : autoState(m);
const spCommit = (m, before) => m.type === 'split' ? splitStep(m, before) : autoStep(m, before);

// 自動模式只在點到起點、頂點、邊時才改切線，其他是拖零件
function spHit(sp, w)
{
    if (splitStartHit(sp, w)) return true;
    if (!sp.poly) return false;
    const p = toLocal(sp.view, w.x, w.y);
    return polyVertexHit(sp.poly, p) >= 0 || !!polyEdgeHit(sp.poly, p);
}

function splitMoveStart(m, w)
{
    const sp = editSp(), p = toLocal(sp.view, w.x, w.y);
    const start = {x: Math.floor(p.x), y: Math.floor(p.y)};
    if (start.x === sp.start.x && start.y === sp.start.y) return;
    if (drag.before) {spCommit(m, drag.before); drag.before = null;}
    sp.start = start;
    splitRun(sp);
}

function spDelPt(m, i)
{
    const sp = editSp(), P = sp.poly;
    if (P.pts.length <= 3) return status('多邊形最少要 3 點');
    spCommit(m, spBefore(m));
    sp.poly = {...P, pts: P.pts.filter((_, k) => k !== i), vert: null, edge: null};
}

// ---------- 畫線標記 ----------
// 在追線那張圖（sp.img）上塗標記蓋過亮度條件，不改圖片；一筆（按下到放開）一步，放開才重新追線
const spPaintOn = () => $('spPaint').checked;
const spN = () => Math.min(8, Math.max(1, Math.round(+$('spSize').value || 1)));
const markCount = (mark) => mark ? mark.reduce((n, k) => n + (k ? 1 : 0), 0) : 0;

function spMarkDown(m, w, e)
{
    const sp = editSp();
    const d = {type: 'spMark', v: e.button === 2 ? 0 : e.shiftKey ? PX.MARK_OFF : PX.MARK_ON, before: spBefore(m), own: false, changed: false,
               p: toLocal(sp.view, w.x, w.y)};
    spMarkStamp(m, sp, d, d.p);
    return d;
}

function spMarkStamp(m, sp, d, p)
{
    const W = sp.img.width, H = sp.img.height, n = spN(), b = brushAt(p, n);
    const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(W, b.x + n), y1 = Math.min(H, b.y + n);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++)
    {
        const i = y * W + x;
        if ((sp.mark?.[i] ?? 0) === d.v) continue;
        if (!d.own) {sp.mark = sp.mark?.slice() ?? new Uint8Array(W * H); d.own = true;}
        if (!d.changed) {spCommit(m, d.before); d.changed = true;}
        sp.mark[i] = d.v;
        sp.markCv = null;
    }
}

function spMarkLine(m, sp, d, a, b)
{
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let i = 1; i <= n; i++) spMarkStamp(m, sp, d, {x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n});
}

function spMarkUp(d)
{
    const sp = editSp();
    if (!d.changed || !sp) return;
    if (!markCount(sp.mark)) sp.mark = null;
    splitRun(sp);
    refreshModePanel();
}

function spMarkClear()
{
    const m = S.mode, sp = editSp();
    if (!sp?.mark) return;
    spCommit(m, spBefore(m));
    sp.mark = null;
    splitRun(sp);
    refreshModePanel();
    dirty();
}

function drawMark(sp, K)
{
    const L = sp.view, W = sp.img.width, H = sp.img.height, cur = spPaintOn() && sp.cursor;
    if (!sp.mark && !cur) return;
    g.save();
    g.translate(L.x, L.y);
    g.rotate(L.a * RAD);
    g.scale(sp.vk[0] * L.scale, sp.vk[1] * L.scale);
    g.translate(-L.ox * W, -L.oy * H);
    if (sp.mark)
    {
        if (sp.markCv?.src !== sp.mark)
        {
            const img = new ImageData(W, H);
            sp.mark.forEach((k, i) => {if (k) img.data.set(k === PX.MARK_ON ? [255, 0, 255, 220] : [0, 255, 255, 220], i * 4);});
            const c = PX.newCanvas(W, H);
            c.getContext('2d').putImageData(img, 0, 0);
            sp.markCv = {src: sp.mark, cv: c};
        }
        g.imageSmoothingEnabled = false;
        g.drawImage(sp.markCv.cv, 0, 0);
    }
    if (cur)
    {
        const n = spN(), b = brushAt(sp.cursor, n);
        g.strokeStyle = S.keys.has('shift') ? '#0ff' : '#f0f';
        g.lineWidth = 2 / K / sp.vk[0] / L.scale;
        g.strokeRect(b.x, b.y, n, n);
    }
    g.restore();
}

// 前後片照原圖現在的步驟重新產生（缺的那張複製原圖補上：前片疊在原圖上、後片放到最底層），擺放、不透明度跟原圖一樣；原圖隱藏，回傳前片
// 挖除只做前片，原本有後片就刪掉
// splitSrc 不進快照，所以 undo／撤掉後也留著（前後片都沒了就不算一組），再拆沿用它的 gid
function splitBuild(O, sp, gid)
{
    const g = splitNew(O), at = splitAt(O);
    const split = {gid, x: sp.start.x, y: sp.start.y, c: sp.c, ...(sp.cut && {cut: true}), method: sp.method,
                   ...(sp.method === 'wand' && {close: sp.close, down: sp.down, drop: sp.drop, right: sp.right, reach: sp.reach}),
                   ...(sp.mark && {mark: PX.markPack(sp.mark)}), w: sp.img.width, h: sp.img.height, n: O.ops.length - at};
    const pts = sp.poly.pts.map(p => [round(p.x, 100), round(p.y, 100)]);
    const F = g?.F ?? cloneAbove(O, `${O.name}-front`);
    if (sp.cut && g?.B) S.layers = S.layers.filter(M => M !== g.B);
    const B = sp.cut ? null : g?.B ?? toBottom(cloneAbove(O, `${O.name}-back`));
    const {x, y, a, ox, oy, scale, opacity} = O;
    for (const [M, keep] of [[F, false], [B, true]].filter(([M]) => M))
    {
        const mask = {type: 'mask', pts, keep, split};
        Object.assign(M, {x, y, a, ox, oy, scale, opacity, visible: true, ops: [...O.ops.slice(0, at), mask, ...O.ops.slice(at)],
                          canvas: PX.replay(sp.img, [mask, ...O.ops.slice(at)])});
    }
    O.splitSrc = gid;
    O.visible = false;
    return F;
}

// 記一筆群組 undo、選前片
function splitApply(m)
{
    const O = m.layer;
    hist.push({group: [hist.snapList(S), hist.snap(O, true), ...[m.F, m.B].filter(Boolean).map(M => hist.snap(M, true))]});
    const F = S.active = splitBuild(O, m, m.gid ?? O.splitSrc ?? autoGid());
    status(m.cut ? `${O.name} 挖除 → ${F.name}` : `${O.name} 拆成 ${F.name}＋${splitNew(O).B.name}`);
}

// 撤掉：刪掉前後片、原圖重新顯示並選取，記一筆 undo
function splitRevoke()
{
    const m = S.mode, O = m.layer;
    if (m.type !== 'split' || !m.gid) return;
    hist.push({group: [hist.snapList(S), hist.snap(O, true)]});
    S.layers = S.layers.filter(L => L !== m.F && L !== m.B);
    O.visible = true;
    S.active = O;
    S.mode = {type: 'move'};
    status(`撤掉 ${O.name} 的前後片`);
    refreshAll();
}

function drawSplit(m, K)
{
    const L = m.view;
    drawMark(m, K);
    if (m.poly)
    {
        g.fillStyle = 'rgba(255,0,255,.3)';
        g.beginPath();
        m.poly.pts.forEach((p, i) => {const w = toWorld(L, p.x, p.y); i ? g.lineTo(w.x, w.y) : g.moveTo(w.x, w.y);});
        g.closePath();
        g.fill();
        g.strokeStyle = '#f0f';
        drawPolyEdit(m.poly, L, K);
    }
    drawCross(toWorld(L, m.start.x + 0.5, m.start.y + 0.5), K, '#0ff');
}

function drawCross(c, K, color)
{
    const r = 8 / K;
    g.strokeStyle = color;
    g.lineWidth = 2 / K;
    g.beginPath();
    g.moveTo(c.x - r, c.y); g.lineTo(c.x + r, c.y);
    g.moveTo(c.x, c.y - r); g.lineTo(c.x, c.y + r);
    g.stroke();
    g.beginPath();
    g.arc(c.x, c.y, r / 2, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 1 / K;
}

function setOrigin(L, ox, oy)
{
    const p = toWorld(L, ox * L.canvas.width, oy * L.canvas.height, [1, 1]);
    Object.assign(L, {ox, oy, x: p.x, y: p.y});
}

// ---------- 繪製 ----------

let raf = 0;
function dirty() {if (!raf) raf = requestAnimationFrame(render);}

function render()
{
    raf = 0;
    if (S.mode.type === 'warp' && S.mode.stale) updateWarp(S.mode);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w || cv.height !== h) {cv.width = w; cv.height = h;}
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    const K = zoomK();
    const view = () => g.setTransform(K, 0, 0, K, S.view.px, S.view.py);
    const m = S.mode, split = m.type === 'split';
    for (const L of S.layers)
    {
        if (split ? L !== m.layer && (!L.visible || L === m.F || L === m.B) : !L.visible) continue;
        const [sx, sy] = modeScale(L), img = layerImg(L);
        g.imageSmoothingEnabled = K * L.scale * Math.min(sx, sy) < 1;
        view();
        g.translate(L.x, L.y);
        g.rotate(L.a * RAD);
        g.scale(sx * L.scale, sy * L.scale);
        g.globalAlpha = L.opacity;
        g.drawImage(img, -L.ox * img.width, -L.oy * img.height);
        g.globalAlpha = 1;
    }
    view();
    g.lineWidth = 1 / K;
    drawRefs(K);
    drawOrigins(K);
    drawOverlay(K);
    updateTitle();
}

function drawOrigins(K)
{
    if (!$('showOrigin').checked) return;
    const r = 6 / K;
    for (const L of S.layers)
    {
        if (!L.visible) continue;
        g.strokeStyle = L === S.active ? '#ff0' : '#f90';
        g.beginPath();
        g.moveTo(L.x - r, L.y); g.lineTo(L.x + r, L.y);
        g.moveTo(L.x, L.y - r); g.lineTo(L.x, L.y + r);
        g.stroke();
        g.beginPath();
        g.arc(L.x, L.y, r / 2, 0, Math.PI * 2);
        g.stroke();
    }
}

function poly(pts)
{
    g.beginPath();
    pts.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    g.closePath();
    g.stroke();
}

function drawRefs(K)
{
    const r = S.ref;
    const x0 = -S.view.px / K, y0 = -S.view.py / K, W = cv.width / K, H = cv.height / K;
    g.strokeStyle = 'rgba(255,80,80,.8)';
    g.beginPath();
    g.moveTo(x0, 0); g.lineTo(x0 + W, 0);
    g.moveTo(0, y0); g.lineTo(0, y0 + H);
    g.stroke();

    g.setLineDash([4 / K, 4 / K]);
    g.strokeStyle = 'rgba(255,255,255,.6)';
    g.strokeRect(-r.rw / 2, -r.rh / 2, r.rw, r.rh);
    g.setLineDash([]);

    g.strokeStyle = 'rgba(80,220,255,.9)';
    g.strokeRect(r.ax - r.tw / 2, r.ay - r.th / 2, r.tw, r.th);
    g.beginPath();
    g.arc(r.ax, r.ay, 4 / K, 0, Math.PI * 2);
    g.stroke();
}

function drawOverlay(K)
{
    const L = S.active;
    if (!L) return;
    g.setLineDash([3 / K, 3 / K]);
    g.strokeStyle = 'rgba(255,220,0,.8)';
    poly(corners(L));
    g.setLineDash([]);

    const m = S.mode;
    if (m.type === 'warp') drawWarp(m, K);
    if (m.type === 'crop') drawCrop(m, L, K);
    if (m.type === 'pixel') drawPixel(m, L, K);
    if (m.type === 'split') drawSplit(m, K);
    if (m.type === 'auto' && m.sp) drawSplit(m.sp, K);
    const wp = autoWeapon(m);
    if (wp) drawCross(wp.C, K, '#f90');
    if (m.type === 'scale')
    {
        g.fillStyle = '#fff';
        g.strokeStyle = '#000';
        for (const p of corners(L))
        {
            g.fillRect(p.x - 4 / K, p.y - 4 / K, 8 / K, 8 / K);
            g.strokeRect(p.x - 4 / K, p.y - 4 / K, 8 / K, 8 / K);
        }
    }
}

function fitView()
{
    const r = S.ref;
    const pts = [{x: -r.rw / 2, y: -r.rh / 2}, {x: r.rw / 2, y: r.rh / 2},
                 ...S.layers.filter(L => L.visible).flatMap(corners)];
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const K = Math.min(cv.clientWidth / (maxX - minX), cv.clientHeight / (maxY - minY)) * 0.85;
    S.view.zoom = K;
    S.view.px = cv.clientWidth / 2 - (minX + maxX) / 2 * K;
    S.view.py = cv.clientHeight / 2 - (minY + maxY) / 2 * K;
    dirty();
}

// ---------- 模式：移動 / 裁切 / 縮放 / 清除透明 / 顏色 ----------

// 切換圖層／模式時，變形有沒套用的修改先問
function leaveMode()
{
    const m = S.mode;
    if (m.type === 'warp' && m.changed && confirm('有未套用的變形框，要套用嗎？（取消＝放棄）')) applyMode();
    else if (m.type === 'pixel' && m.changed && confirm('有未套用的像素修補，要套用嗎？（取消＝放棄）')) applyMode();
    else if (m.type === 'split' && m.changed && m.poly && confirm('有未套用的前後片，要套用嗎？（取消＝放棄）')) applyMode();
    else cancelMode();
}

function setMode(type)
{
    leaveMode();
    const L = S.active;
    if (type !== 'move' && (!L || L.locked))
    {
        status('先選一個沒鎖定的圖層');
        type = 'move';
    }
    else if (type === 'pixel' && !L.visible)
    {
        status('選取的圖層隱藏中，先打開顯示');
        type = 'move';
    }
    else if ((type === 'scale' && !autoOwner(L) || type === 'warp') && hasPaint(L))
    {
        alert('這層有像素修補，縮放／變形會讓修補對不上；要先到「像素」模式按「清除修補」');
        type = 'move';
    }
    if (type === 'crop') S.mode = {type, layer: L, rect: null, poly: null};
    else if (type === 'scale') S.mode = {type, layer: L, sx: 1, sy: 1, k: srcScale(L), lock: !!autoOwner(L) || $('scLock').checked, snap: hist.snap(L)};
    else if (type === 'alpha') {S.mode = {type, layer: L, t: +$('alT').value, preview: null}; updateAlpha();}
    else if (type === 'color') {S.mode = {type, layer: L, preview: null}; updateColor();}
    else if (type === 'removeGreen') {
        S.mode = {type, layer: L, ...GREEN, preview: null};
        updateRemoveGreen();
    }
    else if (type === 'warp') S.mode = warpStart(L);
    else if (type === 'auto') S.mode = autoEnter(L) ?? {type: 'move'};
    else if (type === 'pixel') S.mode = pixelStart(L);
    else if (type === 'split') S.mode = splitStart(L) ?? {type: 'move'};
    else if (type === 'icon') S.mode = {type, layer: L};
    else S.mode = {type: 'move'};
    refreshAll();
}

// 目前的圖相對原圖縮了多少（只看 xform，裁切不算縮放）；縮放面板的 % 以原圖為 100
const srcScale = (L) => L.ops.reduce((k, o) => o.type === 'xform' ? k * o.w / o.sw : k, 1);

function cancelMode()
{
    const m = S.mode;
    if (m.type === 'move') return;
    if (m.type === 'scale' || m.type === 'warp') History.restore(m.snap);
    if (m.type === 'auto' && m.hist?.length) hist.push(m.snap);
    S.mode = {type: 'move'};
    refreshAll();
}

function applyMode()
{
    const m = S.mode, L = m.layer;
    if (m.type === 'crop')
    {
        const sel = cropSel(m);
        if (!sel) return;
        const how = cropHow();
        if (how === 'keep') {hist.record(L); sel.keep(L);}
        else if (how === 'cut') {hist.record(L); sel.cut(L);}
        else
        {
            hist.push({group: [hist.snapList(S), hist.snap(L)]});
            const C = cloneAbove(L, L.name);
            sel.keep(C);
            if (how === 'move') sel.cut(L);
            S.active = C;
        }
    }
    else if (m.type === 'scale' && autoOwner(L))
    {
        const dx = L.x - m.snap.x, dy = L.y - m.snap.y;
        History.restore(m.snap);
        autoRescale(L, m.sx, dx, dy);
    }
    else if (m.type === 'scale')
    {
        const W = L.canvas.width, H = L.canvas.height;
        const w = Math.max(1, Math.round(W * m.sx)), h = Math.max(1, Math.round(H * m.sy));
        if (w !== W || h !== H)
        {
            hist.push(m.snap);
            pushOp(L, {type: 'xform', sx: 0, sy: 0, sw: W, sh: H, w, h, smooth: $('scSmooth').checked});
        }
        else if (L.x !== m.snap.x || L.y !== m.snap.y) hist.push(m.snap);
    }
    else if (m.type === 'alpha')
    {
        hist.record(L);
        pushOp(L, {type: 'alpha', t: m.t});
    }
    else if (m.type === 'color')
    {
        hist.record(L);
        pushOp(L, colorOp());
    }
    else if (m.type === 'removeGreen')
    {
        hist.record(L);
        pushOp(L, {type: 'removeGreen', h1: m.h1, h2: m.h2, s1: m.s1, s2: m.s2, v1: m.v1, v2: m.v2, rgbThr: m.rgbThr});
    }
    else if (m.type === 'warp')
    {
        const frames = warpKept(m.frames);
        if (!m.changed) History.restore(m.snap);
        else
        {
            if (m.stale) updateWarp(m);
            L.ops = frames.length ? [...m.baseOps, warpOp(frames)] : m.baseOps;
        }
        if (L.ops !== m.snap.ops || L.canvas !== m.snap.canvas) hist.push(m.snap);
    }
    else if (m.type === 'pixel')
    {
        if (m.changed)
        {
            const px = pixelList(m);
            Object.assign(L, px.length ? {ops: [...m.baseOps, {type: 'paint', px}], canvas: PX.paint(m.base, {px})} : {ops: m.baseOps, canvas: m.base});
            hist.push(m.snap);
        }
    }
    else if (m.type === 'auto')
    {
        if (!m.parts) autoSplit(m);
        return refreshAll();
    }
    else if (m.type === 'split')
    {
        if (!m.poly) return status(m.err ?? '還沒有後片的範圍');
        splitApply(m);
    }
    else return;
    S.mode = {type: 'move'};
    refreshAll();
}

const cropHow = () => document.querySelector('[name=cropMode]:checked').value;
const cropShape = () => document.querySelector('[name=cropShape]:checked').value;

function cropRect(r, L)
{
    const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    const W = L.canvas.width, H = L.canvas.height;
    return {x0: cl(Math.min(r.ax, r.bx), W), y0: cl(Math.min(r.ay, r.by), H),
            x1: cl(Math.max(r.ax, r.bx), W), y1: cl(Math.max(r.ay, r.by), H)};
}

// 外接矩形往外取整，限制在圖內（頂點可以點在圖外）
function polyRect(pts, L)
{
    const cl = (v, max) => Math.min(max, Math.max(0, v));
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return {x0: cl(Math.floor(Math.min(...xs)), L.canvas.width), y0: cl(Math.floor(Math.min(...ys)), L.canvas.height),
            x1: cl(Math.ceil(Math.max(...xs)), L.canvas.width), y1: cl(Math.ceil(Math.max(...ys)), L.canvas.height)};
}

// 目前的選取範圍：keep(T) 只留範圍內並裁到外接矩形，cut(T) 挖掉範圍內
function cropSel(m)
{
    const L = m.layer;
    if (cropShape() === 'rect')
    {
        if (!m.rect) return null;
        const {x0, y0, x1, y1} = cropRect(m.rect, L), w = x1 - x0, h = y1 - y0;
        if (w < 1 || h < 1) return null;
        return {keep: T => applyCrop(T, x0, y0, w, h), cut: T => pushOp(T, {type: 'erase', x: x0, y: y0, w, h})};
    }
    if (!m.poly?.closed) return null;
    const pts = m.poly.pts.map(p => [round(p.x, 100), round(p.y, 100)]);
    const {x0, y0, x1, y1} = polyRect(pts, L);
    if (x1 - x0 < 1 || y1 - y0 < 1) return null;
    return {keep: T => {pushOp(T, {type: 'mask', pts, keep: true}); applyCrop(T, x0, y0, x1 - x0, y1 - y0);},
            cut: T => pushOp(T, {type: 'mask', pts, keep: false})};
}

// ---------- 多邊形裁切（頂點存圖層本地座標；本地距離＝世界距離 ÷ scale；前後片的本地座標是縮小前的，還要除 vk） ----------

const polyTol = () => {const sp = editSp(); return 8 / zoomK() / (sp?.vk?.[0] ?? 1) / (sp?.view ?? S.mode.layer).scale;};
const polyLayer = (m) => m.view ?? m.layer;

// Shift：從 from 出發的方向鎖在 45° 的倍數
function snap45(from, p)
{
    const d = Math.hypot(p.x - from.x, p.y - from.y), a = Math.round(Math.atan2(p.y - from.y, p.x - from.x) / (Math.PI / 4)) * Math.PI / 4;
    return {x: from.x + d * Math.cos(a), y: from.y + d * Math.sin(a)};
}

function polyEdgeHit(P, p)
{
    const n = P.pts.length;
    let best = null;
    for (let i = 0; i < n; i++)
    {
        const a = P.pts[i], b = P.pts[(i + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
        const t = len2 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
        const q = {x: a.x + t * dx, y: a.y + t * dy}, d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < polyTol() && (!best || d < best.d)) best = {i, q, d};
    }
    return best;
}

const polyVertexHit = (P, p) => P.pts.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) < polyTol());
const polyNearFirst = (P, p) => P.pts.length >= 3 && Math.hypot(P.pts[0].x - p.x, P.pts[0].y - p.y) < polyTol();

function polyPointerDown(m, e)
{
    const w = screenToWorld(e), raw = toLocal(polyLayer(m), w.x, w.y), P = m.poly;
    if (!P) {m.poly = {pts: [raw], closed: false, cursor: raw}; return null;}
    if (!P.closed)
    {
        if (e.detail >= 2) P.closed = P.pts.length >= 3;
        else if (polyNearFirst(P, raw)) P.closed = true;
        else P.pts = [...P.pts, e.shiftKey ? snap45(P.pts.at(-1), raw) : raw];
        return null;
    }
    const i = polyVertexHit(P, raw);
    if (i >= 0) return {type: 'polyPt', i};
    const hit = polyEdgeHit(P, raw);
    if (!hit) return null;
    P.pts = [...P.pts.slice(0, hit.i + 1), hit.q, ...P.pts.slice(hit.i + 1)];
    P.edge = null;
    return {type: 'polyPt', i: hit.i + 1};
}

function polyDrag(m, e, i)
{
    const P = m.poly, w = screenToWorld(e), raw = toLocal(polyLayer(m), w.x, w.y);
    const prev = P.pts[(i - 1 + P.pts.length) % P.pts.length];
    P.pts = P.pts.map((v, k) => k === i ? (e.shiftKey ? snap45(prev, raw) : raw) : v);
}

function polyHover(m, e)
{
    const P = m.poly, w = screenToWorld(e), raw = toLocal(polyLayer(m), w.x, w.y);
    if (!P.closed) P.cursor = e.shiftKey && P.pts.length ? snap45(P.pts.at(-1), raw) : raw;
    else
    {
        const v = polyVertexHit(P, raw);
        P.vert = v >= 0 ? v : null;
        P.edge = v < 0 ? polyEdgeHit(P, raw)?.i ?? null : null;
    }
}

// Backspace：刪最後一點；已閉合就先解開閉合
function polyBack(m)
{
    const P = m.poly;
    if (P.closed) P.closed = false;
    else if (P.pts.length > 1) P.pts = P.pts.slice(0, -1);
    else m.poly = null;
}

function drawCrop(m, L, K)
{
    g.strokeStyle = {keep: '#0f0', cut: '#f44', move: '#f0f', copy: '#0cf'}[cropHow()];
    if (cropShape() === 'rect')
    {
        if (!m.rect) return;
        const {x0, y0, x1, y1} = cropRect(m.rect, L);
        poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => toWorld(L, x, y)));
        return;
    }
    if (m.poly) drawPolyEdit(m.poly, L, K);
}

function drawPolyEdit(P, L, K)
{
    const wp = P.pts.map(p => toWorld(L, p.x, p.y));
    if (P.closed)
    {
        poly(wp);
        if (P.edge != null)
        {
            const a = wp[P.edge], b = wp[(P.edge + 1) % wp.length];
            g.lineWidth = 3 / K;
            g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            g.lineWidth = 1 / K;
        }
    }
    else
    {
        const c = toWorld(L, P.cursor.x, P.cursor.y);
        g.beginPath();
        [...wp, c].forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
        g.stroke();
    }
    g.fillStyle = '#fff';
    wp.forEach((p, i) => {
        const r = ((i === 0 && !P.closed && polyNearFirst(P, P.cursor)) || (P.closed && i === P.vert) ? 6 : 3) / K;
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
}

function updateAlpha()
{
    const m = S.mode;
    m.preview = PX.alphaClear(m.layer.canvas, m.t);
    dirty();
}

const colorHow = () => document.querySelector('[name=colorMode]:checked').value;
const byte = (id, min) => Math.min(255, Math.max(min, Math.round(+$(id).value || 0)));

function colorOp()
{
    const v = parseInt($('colRgb').value.slice(1), 16);
    const rgb = {r: v >> 16, g: (v >> 8) & 255, b: v & 255};
    return colorHow() === 'fill' ? {type: 'fill', ...rgb, a: byte('colA', 0), t: byte('colT', 1)} : {type: 'key', ...rgb};
}

function updateColor()
{
    const m = S.mode, op = colorOp();
    m.preview = op.type === 'fill' ? PX.fill(m.layer.canvas, op) : PX.key(m.layer.canvas, op);
    dirty();
}

function updateRemoveGreen()
{
    const m = S.mode;
    m.h1 = +$('rgH1').value || 45;
    m.h2 = +$('rgH2').value || 85;
    m.s1 = +$('rgS1').value || 60;
    m.s2 = +$('rgS2').value || 255;
    m.v1 = +$('rgV1').value || 20;
    m.v2 = +$('rgV2').value || 255;
    m.rgbThr = +$('rgRgbThr').value || 40;
    m.preview = PX.removeGreen(m.layer.canvas, m.h1, m.h2, m.s1, m.s2, m.v1, m.v2, m.rgbThr);
    dirty();
}

// 滴管只吸 RGB，填色的 alpha 不跟著變（不然吸到半透明邊緣會被改掉）
function pickColor(w)
{
    const m = S.mode, p = toLocal(m.layer, w.x, w.y);
    const px = PX.pixelAt(m.layer.canvas, p.x, p.y);
    if (!px) return;
    setRgb(px);
    updateColor();
}

// 把手位置投影到「未旋轉、以中心點為原點」的座標，跟角落原本的位置比出倍率
function scaleByHandle(w, [cx, cy])
{
    const m = S.mode, L = m.layer;
    const c = {x: (cx - L.ox) * L.canvas.width * L.scale, y: (cy - L.oy) * L.canvas.height * L.scale};
    const r = -L.a * RAD, dx = w.x - L.x, dy = w.y - L.y;
    const mx = dx * Math.cos(r) - dy * Math.sin(r), my = dx * Math.sin(r) + dy * Math.cos(r);
    if (m.lock)
    {
        const d = c.x * c.x + c.y * c.y;
        if (d) m.sx = m.sy = Math.max(0.01, (mx * c.x + my * c.y) / d);
    }
    else
    {
        if (c.x) m.sx = Math.max(0.01, mx / c.x);
        if (c.y) m.sy = Math.max(0.01, my / c.y);
    }
}

// ---------- 變形 ----------
// 框的矩形和網格點都在「變形前那張圖（input）」的座標；base 是 input 的中心點在世界座標的位置
// 最後一步就是 warp 時接著編輯同一組框：拿掉它重播出 input，再從它的 bounds 反推變形前的 x/y
// changed：這次進模式後有動過，切換圖層／模式時才要問

const wpN = (id) => Math.min(12, Math.max(1, Math.round(+$(id).value || 1)));
const warpCur = (m) => m.frames[m.cur] ?? null;
const warpGridOf = (f) => PX.warpGrid(f.cols, f.rows, f.w, f.h).map(p => ({x: p.x + f.x, y: p.y + f.y}));

function warpIsIdentity(f)
{
    const grid = warpGridOf(f);
    return f.pts.every((p, k) => Math.abs(p.x - grid[k].x) < 1e-6 && Math.abs(p.y - grid[k].y) < 1e-6);
}

const warpCopy = ({x, y, w, h, cols, rows, pts}) => ({x, y, w, h, cols, rows, pts: pts.map(p => ({x: p.x, y: p.y}))});

// 每個框有自己的步驟 hist（改之前的樣子）跟 fut（redo），hist 跟著框寫進 op，確定後、存專案再開都還能退
// 沒變形也沒步驟的框不寫
const WARP_HIST = 50;
const warpOp = (frames) => ({type: 'warp', frames: frames.map(f => f.hist.length ? {...warpCopy(f), hist: f.hist.map(warpCopy)} : warpCopy(f))});
const warpKept = (frames) => frames.filter(f => f.hist.length || !warpIsIdentity(f));
const warpFrame = (g) => ({...warpCopy(g), hist: (g.hist ?? []).map(warpCopy), fut: [], sel: new Set(), edited: !warpIsIdentity(g)});

function warpRecord(m)
{
    const f = warpCur(m);
    f.hist.push(warpCopy(f));
    if (f.hist.length > WARP_HIST) f.hist.shift();
    f.fut.length = 0;
    m.frameRedo.length = 0;
    m.changed = true;
}

function warpSetGeom(f, s)
{
    Object.assign(f, warpCopy(s));
    f.sel.clear();
    f.edited = !warpIsIdentity(f);
}

// Ctrl+Z：退目前這框；這框退到剛拉出來的樣子再按就拿掉它；一個框都沒有時依序救回 Delete 掉的框
function warpUndo(m)
{
    const f = warpCur(m);
    if (f?.hist.length)
    {
        f.fut.push(warpCopy(f));
        warpSetGeom(f, f.hist.pop());
    }
    else if (f)
    {
        m.frameRedo.push({add: f, i: m.cur});
        m.frames.splice(m.cur, 1);
        m.cur = m.frames.length - 1;
    }
    else if (m.deleted.length)
    {
        const {f: g, i} = m.deleted.pop();
        m.frames.splice(i, 0, g);
        m.cur = m.frames.indexOf(g);
        m.frameRedo.push({del: g});
    }
    else return false;
    m.changed = m.stale = true;
    return true;
}

function warpRedo(m)
{
    const f = warpCur(m), r = m.frameRedo.at(-1);
    if (f?.fut.length)
    {
        f.hist.push(warpCopy(f));
        warpSetGeom(f, f.fut.pop());
    }
    else if (r?.add)
    {
        m.frameRedo.pop();
        m.frames.splice(r.i, 0, r.add);
        m.cur = m.frames.indexOf(r.add);
    }
    else if (r?.del)
    {
        m.frameRedo.pop();
        const i = m.frames.indexOf(r.del);
        m.frames.splice(i, 1);
        m.deleted.push({f: r.del, i});
        m.cur = m.frames.length - 1;
    }
    else return false;
    m.changed = m.stale = true;
    return true;
}

function warpStart(L)
{
    const m = {type: 'warp', layer: L, snap: hist.snap(L), deleted: [], frameRedo: [], frames: [], cur: -1, stale: false, changed: false};
    const last = L.ops.at(-1);
    if (last?.type !== 'warp')
    {
        Object.assign(m, {baseOps: L.ops, input: L.canvas, base: {x: L.x, y: L.y}});
        return m;
    }
    m.baseOps = L.ops.slice(0, -1);
    m.input = PX.replay(L.src, m.baseOps);
    const W = m.input.width, H = m.input.height;
    const frames = last.frames ?? [{x: 0, y: 0, w: W, h: H, cols: last.cols, rows: last.rows, pts: last.pts}];
    const b = last.frames ? PX.warpFramesBounds(frames, W, H) : PX.warpBounds(last);
    m.base = toWorld(L, L.ox * W - b.bx, L.oy * H - b.by, [1, 1]);
    m.frames = frames.map(warpFrame);
    m.cur = m.frames.length - 1;
    return m;
}

function warpAddFrame(m, r)
{
    const f = warpFrame({...r, cols: wpN('wpCols'), rows: wpN('wpRows'), pts: []});
    f.pts = warpGridOf(f);
    f.edited = false;
    m.frames.push(f);
    m.cur = m.frames.length - 1;
    m.frameRedo.length = 0;
    m.changed = m.stale = true;
    return f;
}

function warpDeleteFrame(m)
{
    if (!warpCur(m)) return;
    m.deleted.push({f: warpCur(m), i: m.cur});
    m.frames.splice(m.cur, 1);
    m.cur = m.frames.length - 1;
    m.frameRedo.length = 0;
    m.changed = m.stale = true;
}

// 世界座標拖出來的範圍換成 input 座標的整數矩形，限制在圖內
function warpRectFrom(m, a, b)
{
    const p = warpLocal(m, a), q = warpLocal(m, b), W = m.input.width, H = m.input.height;
    const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
    const x0 = cl(Math.min(p.x, q.x), W), x1 = cl(Math.max(p.x, q.x), W);
    const y0 = cl(Math.min(p.y, q.y), H), y1 = cl(Math.max(p.y, q.y), H);
    return x1 - x0 >= 2 && y1 - y0 >= 2 ? {x: x0, y: y0, w: x1 - x0, h: y1 - y0} : null;
}

const warpRectPts = (m, r) => [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => warpWorld(m, {x: r.x + u * r.w, y: r.y + v * r.h}));

// 調整大小的把手放在框外 10 螢幕 px，避開剛好在框邊上的網格點；sx/sy：-1 動左／上邊、1 動右／下邊
const HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];

function warpHandles(m, f, K)
{
    const a = m.layer.a * RAD, c = Math.cos(a), s = Math.sin(a), d = 10 / K;
    return HANDLES.map(([sx, sy]) => {
        const p = warpWorld(m, {x: f.x + (sx + 1) / 2 * f.w, y: f.y + (sy + 1) / 2 * f.h});
        const n = Math.hypot(sx, sy), ux = sx / n * d, uy = sy / n * d;
        return {sx, sy, x: p.x + ux * c - uy * s, y: p.y + ux * s + uy * c};
    });
}

function warpHit(m, w)
{
    const f = warpCur(m), K = zoomK();
    if (!f) return null;
    let best = -1, bd = 8;
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt), d = Math.hypot(p.x - w.x, p.y - w.y) * K;
        if (d < bd) {bd = d; best = k;}
    });
    if (best >= 0) return {pt: best};
    const h = warpHandles(m, f, K).find(h => Math.hypot(h.x - w.x, h.y - w.y) * K < 7);
    return h ? {handle: h} : null;
}

// 點一下（沒拖）：點在框裡就切到那個框，重疊時從上面往下輪；點空白取消選點
function warpClick(m, w)
{
    const p = warpLocal(m, w);
    const hits = m.frames.map((_, i) => i).reverse().filter(i => {
        const f = m.frames[i];
        return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
    });
    const i = hits[(hits.indexOf(m.cur) + 1) % hits.length];
    if (hits.length && i !== m.cur) m.cur = i;
    else warpCur(m)?.sel.clear();
}

function warpWorld(m, p)
{
    const L = m.layer, c = Math.cos(L.a * RAD), s = Math.sin(L.a * RAD);
    const dx = (p.x - L.ox * m.input.width) * L.scale, dy = (p.y - L.oy * m.input.height) * L.scale;
    return {x: m.base.x + dx * c - dy * s, y: m.base.y + dx * s + dy * c};
}

function warpLocal(m, w)
{
    const L = m.layer, c = Math.cos(-L.a * RAD), s = Math.sin(-L.a * RAD);
    const dx = (w.x - m.base.x) / L.scale, dy = (w.y - m.base.y) / L.scale;
    return {x: dx * c - dy * s + L.ox * m.input.width, y: dx * s + dy * c + L.oy * m.input.height};
}

// 預覽就是最後結果：直接改圖層的 canvas／x／y
function updateWarp(m)
{
    m.stale = false;
    const L = m.layer, frames = m.frames.filter(f => !warpIsIdentity(f));
    if (!frames.length) return Object.assign(L, {canvas: m.input, x: m.base.x, y: m.base.y});
    const r = PX.warpFrames(m.input, warpOp(frames));
    const p = warpWorld(m, {x: r.bx + L.ox * r.canvas.width, y: r.by + L.oy * r.canvas.height});
    Object.assign(L, {canvas: r.canvas, x: p.x, y: p.y});
}

function drawWarpFrame(m, f, K, cur)
{
    g.setLineDash([4 / K, 4 / K]);
    g.strokeStyle = cur ? '#fff' : 'rgba(215,215,215,.95)';
    poly(warpRectPts(m, f));
    g.setLineDash([]);

    const P = (i, j) => warpWorld(m, f.pts[j * (f.cols + 1) + i]);
    g.strokeStyle = cur ? 'rgba(0,255,200,.8)' : 'rgba(200,200,200,.8)';
    g.beginPath();
    for (let j = 0; j <= f.rows; j++)
        for (let i = 0; i <= f.cols; i++)
        {
            const p = P(i, j);
            if (i < f.cols) {const q = P(i + 1, j); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
            if (j < f.rows) {const q = P(i, j + 1); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y);}
        }
    g.stroke();
    if (!cur) return;

    const r = 4 / K;
    g.strokeStyle = '#000';
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        g.fillStyle = f.sel.has(k) ? '#f0f' : '#fff';
        g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        g.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
    });
    const h = 3 / K;
    g.strokeStyle = '#fff';
    for (const p of warpHandles(m, f, K)) g.strokeRect(p.x - h, p.y - h, h * 2, h * 2);
}

function drawWarp(m, K)
{
    m.frames.forEach((f, i) => {if (i !== m.cur) drawWarpFrame(m, f, K, false);});
    if (warpCur(m)) drawWarpFrame(m, warpCur(m), K, true);
    const r = drag?.type === 'warpNew' && warpRectFrom(m, drag.a, drag.b);
    if (r)
    {
        g.setLineDash([4 / K, 4 / K]);
        g.strokeStyle = '#fff';
        poly(warpRectPts(m, r));
        g.setLineDash([]);
    }
    if (drag?.type === 'band')
    {
        g.setLineDash([3 / K, 3 / K]);
        g.strokeStyle = drag.add ? '#f0f' : '#f80';
        g.strokeRect(drag.a.x, drag.a.y, drag.b.x - drag.a.x, drag.b.y - drag.a.y);
        g.setLineDash([]);
    }
}

// 點：Ctrl 取消選、Shift 加選；把手：調框大小；其他地方 Shift／Ctrl 拖曳框選點，不然拖出新的框（沒拖就是點一下）
function warpPointerDown(m, w, e)
{
    const f = warpCur(m), hit = warpHit(m, w), ctrl = e.ctrlKey || e.metaKey;
    if (hit?.pt !== undefined)
    {
        const k = hit.pt;
        if (ctrl) {f.sel.delete(k); return null;}
        if (e.shiftKey) f.sel.add(k);
        else if (!f.sel.has(k)) f.sel = new Set([k]);
        return {type: 'warpPt', f, w0: w, orig: new Map([...f.sel].map(k => [k, f.pts[k]]))};
    }
    if (hit?.handle) return {type: 'warpSize', f, h: hit.handle, p0: warpLocal(m, w), r0: {x: f.x, y: f.y, w: f.w, h: f.h}, pts0: f.pts};
    if (f && (e.shiftKey || ctrl)) return {type: 'band', a: w, b: w, add: !ctrl};
    return {type: 'warpNew', a: w, b: w};
}

// 按住 Shift 時鎖在先拖動的方向，放開再按才重新決定；一開始就按著的話以按下滑鼠的位置為起點（lock 還是 undefined）
function shiftLock(e, dx, dy)
{
    if (!e.shiftKey) {drag.lock = null; return [dx, dy];}
    const k = drag.lock ??= drag.lock === undefined ? {dx: 0, dy: 0, axis: null} : {dx, dy, axis: null};
    const mx = Math.abs(dx - k.dx), my = Math.abs(dy - k.dy);
    if (!k.axis && Math.max(mx, my) >= 2) k.axis = mx >= my ? 'x' : 'y';
    return [k.axis === 'x' ? dx : k.dx, k.axis === 'y' ? dy : k.dy];
}

function warpPointerMove(m, e, w)
{
    if (drag.type === 'warpNew') {drag.b = w; return;}
    if (!drag.recorded) {warpRecord(m); drag.recorded = true;}
    const f = drag.f;
    if (drag.type === 'warpPt')
    {
        const [dx, dy] = shiftLock(e, w.x - drag.w0.x, w.y - drag.w0.y);
        const c = Math.cos(-m.layer.a * RAD) / m.layer.scale, s = Math.sin(-m.layer.a * RAD) / m.layer.scale;
        const lx = dx * c - dy * s, ly = dx * s + dy * c;
        for (const [k, p] of drag.orig) f.pts[k] = {x: p.x + lx, y: p.y + ly};
        f.edited = true;
    }
    else if (drag.type === 'warpSize')
    {
        // 點跟著框等比例移動，已經做的變形保留
        const p = warpLocal(m, w), {r0, h} = drag, W = m.input.width, H = m.input.height;
        const cl = (v, max) => Math.min(max, Math.max(0, Math.round(v)));
        let x0 = r0.x, x1 = r0.x + r0.w, y0 = r0.y, y1 = r0.y + r0.h;
        if (h.sx < 0) x0 = Math.min(cl(x0 + p.x - drag.p0.x, W), x1 - 2);
        if (h.sx > 0) x1 = Math.max(cl(x1 + p.x - drag.p0.x, W), x0 + 2);
        if (h.sy < 0) y0 = Math.min(cl(y0 + p.y - drag.p0.y, H), y1 - 2);
        if (h.sy > 0) y1 = Math.max(cl(y1 + p.y - drag.p0.y, H), y0 + 2);
        Object.assign(f, {x: x0, y: y0, w: x1 - x0, h: y1 - y0});
        f.pts = drag.pts0.map(q => ({x: x0 + (q.x - r0.x) * f.w / r0.w, y: y0 + (q.y - r0.y) * f.h / r0.h}));
    }
    m.changed = m.stale = true;
}

function warpPointerUp(m)
{
    if (drag.type === 'band') warpBandSelect(m, drag.a, drag.b, drag.add);
    if (drag.type !== 'warpNew') return;
    if (Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) * zoomK() < 4) return warpClick(m, drag.a);
    const r = warpRectFrom(m, drag.a, drag.b);
    if (r) warpAddFrame(m, r);
}

function warpBandSelect(m, a, b, add)
{
    const f = warpCur(m);
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    f.pts.forEach((pt, k) => {
        const p = warpWorld(m, pt);
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) add ? f.sel.add(k) : f.sel.delete(k);
    });
}

// 世界座標的位移轉成 input 座標（圖層有旋轉時方向要轉回去）
function warpNudge(m, dx, dy)
{
    const f = warpCur(m), c = Math.cos(-m.layer.a * RAD) / m.layer.scale, s = Math.sin(-m.layer.a * RAD) / m.layer.scale;
    const lx = dx * c - dy * s, ly = dx * s + dy * c;
    warpRecord(m);
    for (const k of f.sel) f.pts[k] = {x: f.pts[k].x + lx, y: f.pts[k].y + ly};
    f.edited = m.changed = m.stale = true;
}

function warpCursor(m, w)
{
    const h = warpHit(m, w);
    if (h?.pt !== undefined) return 'move';
    if (!h) return 'crosshair';
    const {sx, sy} = h.handle;
    return !sx ? 'ns-resize' : !sy ? 'ew-resize' : sx === sy ? 'nwse-resize' : 'nesw-resize';
}

// ---------- 像素 ----------
// 修補記成一步 paint（座標是前面步驟跑完那張圖的像素）；最後一步就是 paint 時拿掉它接著編輯，筆畫併進同一步
// 畫在 m.preview 上（每筆只 putImageData 筆刷範圍），m.map（y*W+x → rgba）是要寫進 op 的內容
// 有 paint 的圖層不能再縮放／變形（座標會對不上），要先清除修補

const PIXEL_HIST = 50;
const PIXEL_GRID = 8;
const pxN = () => Math.min(8, Math.max(1, Math.round(+$('pxSize').value || 1)));
const pxTool = () => document.querySelector('[name=pxTool]:checked').value;
const hasPaint = (L) => L.ops.some(o => o.type === 'paint');

function pxColor()
{
    if (pxTool() === 'erase') return [0, 0, 0, 0];
    const v = parseInt($('pxRgb').value.slice(1), 16);
    return [v >> 16, (v >> 8) & 255, v & 255, byte('pxA', 0)];
}

function pixelStart(L)
{
    const last = L.ops.at(-1), resume = last?.type === 'paint';
    const baseOps = resume ? L.ops.slice(0, -1) : L.ops;
    const base = resume ? PX.replay(L.src, baseOps) : L.canvas;
    const m = {type: 'pixel', layer: L, snap: hist.snap(L), baseOps, base, map: new Map(), hist: [], fut: [], changed: false, cursor: null};
    if (resume) for (const [x, y, ...c] of last.px) m.map.set(y * base.width + x, c);
    pixelRebuild(m);
    return m;
}

function pixelList(m)
{
    const W = m.base.width;
    return [...m.map].sort((a, b) => a[0] - b[0]).map(([k, c]) => [k % W, Math.floor(k / W), ...c]);
}

const pixelRebuild = (m) => {m.preview = PX.paint(m.base, {px: pixelList(m)});};

// 筆刷左上角：n 是偶數時中心落在格線上
const brushAt = (p, n) => ({x: Math.floor(p.x - (n - 1) / 2), y: Math.floor(p.y - (n - 1) / 2)});

function pixelStamp(m, p)
{
    const n = pxN(), W = m.base.width, H = m.base.height, b = brushAt(p, n);
    const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(W, b.x + n), y1 = Math.min(H, b.y + n);
    if (x1 <= x0 || y1 <= y0) return;
    // 一筆真的畫到圖上才記進模式內的 undo
    if (m.before)
    {
        m.hist.push(m.before);
        if (m.hist.length > PIXEL_HIST) m.hist.shift();
        m.fut.length = 0;
        m.before = null;
    }
    const c = pxColor(), img = new ImageData(x1 - x0, y1 - y0);
    for (let i = 0; i < img.data.length; i += 4) img.data.set(c, i);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m.map.set(y * W + x, c);
    m.preview.getContext('2d').putImageData(img, x0, y0);
    m.changed = true;
}

// 拖很快時兩次 pointermove 之間補點，線才不會斷
function pixelLine(m, a, b)
{
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let i = 1; i <= n; i++) pixelStamp(m, {x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n});
}

function pixelDown(m, w, e)
{
    const p = toLocal(m.layer, w.x, w.y);
    if (e.altKey)
    {
        const px = PX.pixelAt(m.preview, p.x, p.y);
        if (px) {setRgb(px); $('pxA').value = px[3];}
        return null;
    }
    m.before = new Map(m.map);
    pixelStamp(m, p);
    m.cursor = p;
    return {type: 'paint', p};
}

function pixelUndo(m, from, to)
{
    if (!from.length) return false;
    to.push(m.map);
    m.map = from.pop();
    m.changed = true;
    pixelRebuild(m);
    return true;
}

// 拿掉這層所有 paint，記一筆 undo；模式裡還沒確定的筆畫一起丟掉
function pixelClear()
{
    const m = S.mode, L = m.layer;
    if (m.type !== 'pixel') return;
    const ops = L.ops.filter(o => o.type !== 'paint');
    if (ops.length !== L.ops.length)
    {
        hist.record(L);
        Object.assign(L, {ops, canvas: PX.replay(L.src, ops)});
        status(`清除 ${L.name} 的像素修補`);
    }
    S.mode = pixelStart(L);
    refreshAll();
}

function drawPixel(m, L, K)
{
    const W = m.preview.width, H = m.preview.height;
    g.save();
    g.translate(L.x, L.y);
    g.rotate(L.a * RAD);
    g.scale(L.scale, L.scale);
    g.translate(-L.ox * W, -L.oy * H);
    K *= L.scale;
    g.lineWidth = 1 / K;
    if (K >= PIXEL_GRID)
    {
        g.strokeStyle = 'rgba(255,255,255,.15)';
        g.beginPath();
        for (let x = 0; x <= W; x++) {g.moveTo(x, 0); g.lineTo(x, H);}
        for (let y = 0; y <= H; y++) {g.moveTo(0, y); g.lineTo(W, y);}
        g.stroke();
    }
    if (m.cursor)
    {
        const n = pxN(), b = brushAt(m.cursor, n);
        g.strokeStyle = pxTool() === 'erase' ? '#fff' : $('pxRgb').value;
        g.lineWidth = 2 / K;
        g.strokeRect(b.x, b.y, n, n);
    }
    g.restore();
}

const PIXEL_KEYS = {
    b: () => {$('pxPen').checked = true;},
    e: () => {$('pxErase').checked = true;},
    '[': () => {$('pxSize').value = pxN() - 1 || 1;},
    ']': () => {$('pxSize').value = Math.min(8, pxN() + 1);},
};

const SPMARK_KEYS = {
    b: () => spPaintSet(!spPaintOn()),
    '[': () => {$('spSize').value = spN() - 1 || 1;},
    ']': () => {$('spSize').value = Math.min(8, spN() + 1);},
};

// 開畫線時頂點／邊不能改，清掉滑鼠停留的標示
function spPaintSet(on)
{
    $('spPaint').checked = on;
    const sp = editSp();
    if (sp?.poly) sp.poly.vert = sp.poly.edge = null;
    if (sp && !on) sp.cursor = null;
}

// 鉛筆跟填色／去色共用色票
function setRgb(px)
{
    $('colRgb').value = $('pxRgb').value = '#' + px.slice(0, 3).map(v => v.toString(16).padStart(2, '0')).join('');
    status(`吸取 rgba(${px.join(',')})`);
}

// ---------- 滑鼠 / 鍵盤 ----------

let drag = null;
// 拖曳、方向鍵以 0.25 遊戲單位為一格（scale 0.25 的圖剛好 1 像素）
const STEP = 0.25;
const onStep = (v) => Math.round(v / STEP) * STEP;

cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    const w = screenToWorld(e), m = S.mode, L = S.active;
    if (e.button === 1)
    {
        e.preventDefault();
        drag = {type: 'pan', sx: e.clientX, sy: e.clientY, px: S.view.px, py: S.view.py};
        return;
    }
    if ((e.button === 0 || e.button === 2) && editSp() && spPaintOn())
    {
        drag = spMarkDown(m, w, e);
        refreshModePanel();
        dirty();
        return;
    }
    if (e.button !== 0) return;
    if (m.type === 'crop' && cropShape() === 'poly')
    {
        drag = polyPointerDown(m, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'crop')
    {
        const p = toLocal(L, w.x, w.y);
        m.rect = {ax: p.x, ay: p.y, bx: p.x, by: p.y};
        drag = {type: 'crop'};
    }
    else if (m.type === 'scale')
    {
        const i = corners(L).findIndex(c => Math.hypot(c.x - w.x, c.y - w.y) * zoomK() < 8);
        drag = i >= 0 ? {type: 'handle', corner: [[0, 0], [1, 0], [1, 1], [0, 1]][i]}
                      : {type: 'move', G: [{M: L, x: L.x, y: L.y}], wx: w.x, wy: w.y};
    }
    else if (m.type === 'color') pickColor(w);
    else if (m.type === 'pixel')
    {
        drag = pixelDown(m, w, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'warp')
    {
        drag = warpPointerDown(m, w, e);
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'split' || (m.type === 'auto' && m.sp && spHit(m.sp, w)))
    {
        const sp = editSp(), before = spBefore(m), pts = sp.poly?.pts;
        if (e.altKey)
        {
            const i = sp.poly ? polyVertexHit(sp.poly, toLocal(sp.view, w.x, w.y)) : -1;
            if (i >= 0) spDelPt(m, i);
        }
        else if (splitStartHit(sp, w)) drag = {type: 'splitStart', before};
        else if (sp.poly)
        {
            drag = polyPointerDown(sp, e);
            if (sp.poly.pts !== pts) spCommit(m, before);
            else if (drag) drag.before = before;
        }
        refreshModePanel();
        dirty();
    }
    else if (m.type === 'auto' && m.parts)
    {
        const wp = autoWeapon(m), C = wp?.C;
        if (C && !C.locked && C.visible && (S.keys.has('r') || Math.hypot(w.x - C.x, w.y - C.y) * zoomK() <= 8))
        {
            if (C !== L) select(C);
            drag = S.keys.has('r') ? {type: 'autoPose', part: wp, a0: C.a, ang0: Math.atan2(w.y - C.y, w.x - C.x)}
                                   : {type: 'autoPose', part: wp, wx: w.x, wy: w.y, ox: C.ox, oy: C.oy};
            return;
        }
        const hit = pick(w, autoLayers(m.parts));
        if (!hit) return;
        if (hit !== L) select(hit);
        drag = {type: 'autoMove', part: autoPart(m, hit), wx: w.x, wy: w.y, x: hit.x, y: hit.y};
    }
    else if (m.type === 'move')
    {
        if (S.keys.has('r') && L && !L.locked)
        {
            const G = linked(L);
            drag = {type: 'rotate', L, G, snap: {group: G.map(M => hist.snap(M))}, a0: L.a, ang0: Math.atan2(w.y - L.y, w.x - L.x)};
            return;
        }
        const hit = pick(w);
        if (!hit) return;
        if (hit !== L) select(hit);
        const G = linked(hit);
        drag = {type: 'move', G: G.map(M => ({M, x: M.x, y: M.y})), snap: {group: G.map(M => hist.snap(M))}, wx: w.x, wy: w.y};
    }
});

cv.addEventListener('pointermove', e => {
    if (!drag)
    {
        const hp = S.mode.type === 'crop' ? S.mode : editSp();
        if (hp?.poly && !(hp === editSp() && spPaintOn())) {polyHover(hp, e); dirty();}
        if (editSp() && spPaintOn()) {const sp = editSp(), w = screenToWorld(e); sp.cursor = toLocal(sp.view, w.x, w.y); dirty();}
        if (S.mode.type === 'warp') cv.style.cursor = warpCursor(S.mode, screenToWorld(e));
        if (S.mode.type === 'pixel') {const w = screenToWorld(e); S.mode.cursor = toLocal(S.mode.layer, w.x, w.y); dirty();}
        if (editSp()) spHover(e);
        return;
    }
    const w = screenToWorld(e);
    if (drag.type === 'pan')
    {
        S.view.px = drag.px + e.clientX - drag.sx;
        S.view.py = drag.py + e.clientY - drag.sy;
    }
    else if (drag.type === 'move')
    {
        const [dx, dy] = shiftLock(e, onStep(w.x - drag.wx), onStep(w.y - drag.wy));
        for (const p of drag.G) Object.assign(p.M, {x: p.x + dx, y: p.y + dy});
    }
    else if (drag.type === 'autoMove')
    {
        const [dx, dy] = shiftLock(e, onStep(w.x - drag.wx), onStep(w.y - drag.wy));
        if (autoMove(S.mode, drag.part, drag.x + dx, drag.y + dy, !drag.moved)) drag.moved = true;
    }
    else if (drag.type === 'autoPose')
    {
        const C = drag.part.C;
        let v;
        if (drag.ang0 !== undefined) v = {a: dragAngle(e, w, C, drag)};
        else
        {
            // 世界位移轉成圖層本地位移，支點反向移動＝圖跟著游標走、x/y 不動
            const [dx, dy] = shiftLock(e, onStep(w.x - drag.wx), onStep(w.y - drag.wy));
            const c = Math.cos(C.a * RAD) / C.scale, s = Math.sin(C.a * RAD) / C.scale;
            v = {ox: round(drag.ox - (dx * c + dy * s) / C.canvas.width, 10000), oy: round(drag.oy - (dy * c - dx * s) / C.canvas.height, 10000)};
        }
        if (autoPose(S.mode, drag.part, v, !drag.moved)) drag.moved = true;
    }
    else if (drag.type === 'rotate')
    {
        const a = dragAngle(e, w, drag.L, drag);
        for (const M of drag.G) M.a = a;
    }
    else if (drag.type === 'crop')
    {
        const p = toLocal(S.active, w.x, w.y);
        Object.assign(S.mode.rect, {bx: p.x, by: p.y});
    }
    else if (drag.type === 'polyPt')
    {
        if (drag.before) {spCommit(S.mode, drag.before); drag.before = null;}
        polyDrag(S.mode.type === 'crop' ? S.mode : editSp(), e, drag.i);
    }
    else if (drag.type === 'splitStart') splitMoveStart(S.mode, w);
    else if (drag.type === 'spMark')
    {
        const sp = editSp(), p = toLocal(sp.view, w.x, w.y);
        spMarkLine(S.mode, sp, drag, drag.p, p);
        drag.p = sp.cursor = p;
    }
    else if (drag.type === 'handle') scaleByHandle(w, drag.corner);
    else if (drag.type === 'band') drag.b = w;
    else if (drag.type === 'paint')
    {
        const p = toLocal(S.mode.layer, w.x, w.y);
        pixelLine(S.mode, drag.p, p);
        drag.p = S.mode.cursor = p;
    }
    else if (S.mode.type === 'warp') warpPointerMove(S.mode, e, w);
    refreshProps();
    refreshModePanel();
    dirty();
});

cv.addEventListener('pointerup', () => {
    const s = drag?.snap, s0 = s?.group?.[0];
    if (s0 && (s0.x !== s0.layer.x || s0.y !== s0.layer.y || s0.a !== s0.layer.a)) hist.push(s);
    if (drag && S.mode.type === 'warp') {warpPointerUp(S.mode); refreshModePanel();}
    if (drag?.type === 'autoMove' || drag?.type === 'autoPose') autoSave(drag.part);
    if (drag?.type === 'spMark') spMarkUp(drag);
    drag = null;
    dirty();
});

function dragAngle(e, w, L, {a0, ang0})
{
    let a = a0 + (Math.atan2(w.y - L.y, w.x - L.x) - ang0) / RAD;
    a = e.shiftKey ? Math.round(a / 15) * 15 : round(a, 10);
    return ((a + 180) % 360 + 360) % 360 - 180;
}

cv.addEventListener('pointerleave', () => {
    if (S.mode.type === 'pixel' && !drag) {S.mode.cursor = null; dirty();}
    if (editSp() && !drag) {editSp().cursor = null; dirty();}
});

cv.addEventListener('contextmenu', e => {if (editSp() && spPaintOn()) e.preventDefault();});

// 中鍵拖曳平移時，擋掉 Chrome 的中鍵自動捲動
cv.addEventListener('mousedown', e => {if (e.button === 1) e.preventDefault();});

cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const f = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    S.view.px = mx - (mx - S.view.px) * f;
    S.view.py = my - (my - S.view.py) * f;
    S.view.zoom *= f;
    dirty();
}, {passive: false});

const ARROWS = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

window.addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]') || e.target.matches('input')) return;
    const key = e.key.toLowerCase();
    S.keys.add(key);
    if (e.ctrlKey && (key === 'z' || key === 'y'))
    {
        e.preventDefault();
        (key === 'y' || e.shiftKey) ? redo() : undo();
        return;
    }
    if (e.ctrlKey && key === 'j')
    {
        e.preventDefault();
        duplicateLayer();
        return;
    }
    if (e.ctrlKey && key === 'e')
    {
        e.preventDefault();
        e.shiftKey ? mergeVisible() : mergeDown();
        return;
    }
    const m = S.mode;
    if (e.key === 'Enter') applyMode();
    else if (e.key === 'Escape' && m.type === 'crop' && (m.rect || m.poly)) {m.rect = m.poly = null; refreshModePanel(); dirty();}
    else if (e.key === 'Escape') {clearPick(); cancelMode();}
    else if (e.key === 'Backspace' && m.type === 'crop' && m.poly) {polyBack(m); refreshModePanel(); dirty();}
    else if ((e.key === 'Delete' || e.key === 'Backspace') && m.type === 'warp') {warpDeleteFrame(m); refreshModePanel(); dirty();}
    else if (m.type === 'pixel' && !e.ctrlKey && !e.altKey && PIXEL_KEYS[key]) {PIXEL_KEYS[key](); refreshModePanel(); dirty();}
    else if ((e.key === 'Delete' || e.key === 'Backspace') && editSp()?.poly?.vert != null && !spPaintOn()) {spDelPt(m, editSp().poly.vert); refreshModePanel(); dirty();}
    else if (editSp() && !e.ctrlKey && !e.altKey && SPMARK_KEYS[key]) {SPMARK_KEYS[key](); refreshModePanel(); dirty();}
    if ((m.type === 'pixel' || editSp()) && e.key === 'Alt') e.preventDefault();
    const d = ARROWS[e.key], L = S.active;
    const part = m.type === 'auto' && L?.visible && !L.locked ? autoPart(m, L) : null;
    if (d && part)
    {
        e.preventDefault();
        const step = STEP * (e.shiftKey ? 10 : 1);
        autoMove(m, part, round(L.x + d[0] * step), round(L.y + d[1] * step));
        autoSave(part);
        refreshProps();
        dirty();
    }
    else if (d && S.mode.type === 'warp' && warpCur(S.mode)?.sel.size)
    {
        e.preventDefault();
        const step = STEP * (e.shiftKey ? 10 : 1);
        warpNudge(S.mode, d[0] * step, d[1] * step);
        refreshModePanel();
        dirty();
    }
    else if (d && L && !L.locked && (S.mode.type === 'move' || S.mode.type === 'scale'))
    {
        e.preventDefault();
        const step = STEP * (e.shiftKey ? 10 : 1), G = S.mode.type === 'move' ? linked(L) : [L];
        if (S.mode.type === 'move') hist.push({group: G.map(M => hist.snap(M))});
        for (const M of G) Object.assign(M, {x: round(M.x + d[0] * step), y: round(M.y + d[1] * step)});
        refreshProps();
        dirty();
    }
});
window.addEventListener('keyup', e => S.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => S.keys.clear());

// 變形模式裡只退框的步驟（每框各自的），退到底就停住；要退更早的操作先離開變形
function undo()
{
    const m = S.mode;
    if (m.type === 'warp')
    {
        if (!warpUndo(m)) status('變形沒有步驟可以退了；要退更早的操作請先離開變形');
        return refreshAll();
    }
    if (m.type === 'pixel')
    {
        if (!pixelUndo(m, m.hist, m.fut)) status('像素沒有筆畫可以退了；要退更早的操作請先離開像素模式');
        return refreshAll();
    }
    if (m.type === 'auto')
    {
        if (!autoUndo(m, m.hist, m.fut)) status('自動沒有步驟可以退了；要退更早的操作請先離開自動模式');
        return refreshAll();
    }
    if (m.type === 'split')
    {
        if (!splitUndo(m, m.hist, m.fut)) status('前後片沒有步驟可以退了；要退更早的操作請先離開前後片模式');
        return refreshAll();
    }
    cancelMode();
    select(hist.undo() ?? S.active);
}

function redo()
{
    const m = S.mode;
    if (m.type === 'warp')
    {
        warpRedo(m);
        return refreshAll();
    }
    if (m.type === 'pixel')
    {
        pixelUndo(m, m.fut, m.hist);
        return refreshAll();
    }
    if (m.type === 'auto')
    {
        autoUndo(m, m.fut, m.hist);
        return refreshAll();
    }
    if (m.type === 'split')
    {
        splitUndo(m, m.fut, m.hist);
        return refreshAll();
    }
    cancelMode();
    select(hist.redo() ?? S.active);
}

// ---------- UI 同步 ----------

function refreshAll()
{
    refreshLayers();
    refreshProps();
    refreshModePanel();
    dirty();
}

let dragRow = null;

function refreshLayers()
{
    const box = $('layers');
    box.innerHTML = '';
    $('btnSaveProj').disabled = !S.layers.some(L => L.save);
    $('btnClose').disabled = !S.layers.length;
    const tagged = S.layers.some(L => L.tag);
    for (const s of Object.keys(DOLL_SEX))
    {
        const b = $(s === 'm' ? 'dollM' : 'dollF');
        b.classList.toggle('on', S.doll.sex === s);
    }
    $('dollHair').disabled = !tagged;
    $('dollHair').checked = S.doll.hair;
    if (!S.layers.length) box.innerHTML = '<div class="dim">（從左邊點 PNG，或拖檔案進畫布）</div>';
    for (const L of [...S.layers].reverse())
    {
        const row = el('div', 'layer' + (L === S.active ? ' sel' : ''));
        const ico = (txt, on, title, fn) => {
            const b = el('span', 'ico' + (on ? '' : ' off'));
            Object.assign(b, {textContent: txt, title});
            b.onclick = (ev) => {ev.stopPropagation(); fn();};
            return b;
        };
        const name = el('span', 'name');
        name.textContent = `${L.name} (${L.canvas.width}×${L.canvas.height})`;
        name.title = join(L.path ?? '', L.name);
        row.append(
            ico('💾', L.save, `專案：${L.proj?.name ?? '（無）'}（點一下切換要不要存進專案）`, () => {L.save = !L.save; refreshAll();}),
            ico('👁', L.visible, '顯示／隱藏', () => {L.visible = !L.visible; refreshAll();}),
            ico(L.locked ? '🔒' : '🔓', L.locked, '鎖定', () => {L.locked = !L.locked; if (L.locked && S.mode.layer === L) cancelMode(); refreshAll();}),
            ...(L.tag ? [Object.assign(el('span', 'tag ' + L.tag.split('-')[0]), {textContent: dollBadge(L.tag), title: '參考人偶（右鍵改標記）'})] : []),
            ...[armorBadge(L)].filter(Boolean),
            name,
            ico('✕', true, '刪除圖層', () => {if (confirm(`刪除圖層 ${L.name}？`)) removeLayer(L);}),
        );
        row.onclick = () => select(L);
        row.oncontextmenu = (e) => tagMenu(e, L);
        row.draggable = true;
        row.ondragstart = () => {dragRow = L;};
        row.ondragend = () => {dragRow = null;};
        row.ondragover = (ev) => {if (dragRow) {ev.preventDefault(); row.classList.add('drop');}};
        row.ondragleave = () => row.classList.remove('drop');
        row.ondrop = (ev) => {
            ev.preventDefault();
            row.classList.remove('drop');
            if (!dragRow || dragRow === L) return;
            S.layers.splice(S.layers.indexOf(dragRow), 1);
            S.layers.splice(S.layers.indexOf(L) + 1, 0, dragRow);
            refreshAll();
        };
        box.append(row);
    }
}

const PROP_IDS = ['pX', 'pY', 'pS', 'pA', 'pOx', 'pOy', 'pOp', 'btnSave'];

function refreshProps()
{
    const L = S.active;
    PROP_IDS.forEach(id => {$(id).disabled = !L;});
    $('pName').textContent = L ? `${join(L.path ?? '', L.name)}.png　原圖 ${L.src.width}×${L.src.height} → ${L.canvas.width}×${L.canvas.height}（${L.ops.length} 步）`
                               : '（沒有選取圖層）';
    if (!L) return;
    const set = (id, v) => {if (document.activeElement !== $(id)) $(id).value = v;};
    set('pX', round(L.x));
    set('pY', round(L.y));
    set('pS', round(L.scale, 10000));
    set('pA', round(L.a, 10));
    set('pOx', L.ox);
    set('pOy', L.oy);
    set('pOp', Math.round(L.opacity * 100));
}

// 拆完後面板顯示這組零件的實際值，沒有零件的那行反灰
function refreshAuto(m)
{
    $('modeAuto').querySelector('.ok').disabled = !!m.parts;
    document.querySelectorAll('[name=auHow]').forEach(r => {r.disabled = !!m.parts;});
    document.querySelectorAll('[name=auKind]').forEach(r => {r.disabled = !!m.parts; r.checked = r.value === m.kind;});
    const head = m.kind === 'head';
    for (const [k, ids] of [['armor', ['auTable', 'auSplit', 'auHintArmor']], ['weapon', ['auWeapon', 'auHintWeapon', 'auClsL']],
                            ['head', ['auHead', 'auHintHead', 'auPortrait']]])
        for (const id of ids) $(id).hidden = m.kind !== k;
    $('auCls').value = S.auto.cls;
    $('auSpInfo').textContent = m.sp ? spInfo(m.sp) : '';
    $('auItem').textContent = head ? '存到 role…' : '存到 item…';
    $('auLoad').textContent = head ? '載入 role' : '載入 item';
    $('auItem').disabled = !m.parts || !S.assets;
    $('auItem').title = !S.assets ? '先在上方選擇專案資料夾' : m.parts ? '' : '拆完才能存';
    $('auLoad').disabled = $('auFemale').disabled = $('auItem').disabled;
    $('auFemaleL').hidden = m.kind !== 'armor';
    $('auLoad').title = !S.assets ? '先在上方選擇專案資料夾' : !m.parts ? '拆完才能載入'
                      : head ? '照 id＝原圖名（或 head.sprite）找角色，載入擺放（存檔% 不動）' : '照 equip.sprite 找 item，載入擺放（存檔% 不動）';
    for (const P of autoParts(m.kind))
    {
        const part = m.parts?.find(p => p.P === P), row = part ? autoRow(part) : autoCfg(P);
        for (const f of AUTO_F[P.kind])
        {
            const inp = $(`au-${P.key}-${f}`);
            inp.value = row[f];
            inp.disabled = !!m.parts && !part || P.key === 'hair' && AUTO_LINK.includes(f) && S.auto.headLink;
        }
        if (P.key === 'hair') $('au-link').disabled = !!m.parts && !part;
    }
    if (head) autoPortrait(m);
}

function autoPortrait(m)
{
    const pv = $('auPtPreview'), o = S.auto.portrait, c = m.parts && portraitOf(m.parts);
    pv.width = pv.height = o.size;
    if (c) pv.getContext('2d').drawImage(c, 0, 0);
    $('auPtInfo').textContent = !m.parts ? '拆完才有預覽' : c ? `頭像 ${o.size}×${o.size}` : '沒有不透明的像素';
}

const spInfo = (sp) => (sp.err ?? `${sp.cut ? '挖除' : '後片'} ${sp.poly.pts.length} 點`) + `，起點 ${sp.start.x},${sp.start.y}`
                       + (sp.mark ? `，標記 ${markCount(sp.mark)} px` : '');

// 切割方法、線的條件那塊前後片跟自動共用，搬到顯示中的面板；沒有切線時反灰，閉運算／往下射／往右射只在魔術棒時出現
function refreshSpCtl(m)
{
    const sp = editSp(), box = m.type === 'split' ? $('modeSplit') : $('auSplit');
    if ($('spCtl').parentNode !== box) box.insertBefore($('spCtl'), box.querySelector('.spAfter'));
    $('spCtl').querySelectorAll('input, button').forEach(e => {e.disabled = !sp;});
    $('spMarkClear').disabled = !sp?.mark;
    const method = sp?.method ?? S.sp.method;
    document.querySelector(`[name=spMethod][value=${method}]`).checked = true;
    $('spCutRow').hidden = method !== 'wand';
    if (!sp) spSwatch();
    if (m.type === 'split') document.querySelector(`[name=spHow][value=${m.cut ? 'cut' : 'split'}]`).checked = true;
}

function refreshModePanel()
{
    const m = S.mode;
    if (m.type === 'split' || m.type === 'auto') refreshSpCtl(m);
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m.type));
    $('modeCrop').hidden = m.type !== 'crop';
    $('modeScale').hidden = m.type !== 'scale';
    $('modeAlpha').hidden = m.type !== 'alpha';
    $('modeColor').hidden = m.type !== 'color';
    $('modeWarp').hidden = m.type !== 'warp';
    $('modeRemoveGreen').hidden = m.type !== 'removeGreen';
    $('modeAuto').hidden = m.type !== 'auto';
    if (m.type === 'auto') refreshAuto(m);
    $('modePixel').hidden = m.type !== 'pixel';
    $('modeSplit').hidden = m.type !== 'split';
    $('modeIcon').hidden = m.type !== 'icon';
    if (m.type === 'icon') iconPreview(m);
    if (m.type === 'split')
    {
        $('spRevoke').disabled = !m.gid;
        $('modeSplit').querySelector('.ok').disabled = !m.poly;
        $('spInfo').textContent = spInfo(m) + `，可退 ${m.hist.length} 步`;
    }
    if (m.type === 'pixel') $('pxInfo').textContent = `修補 ${m.map.size} 像素，可退 ${m.hist.length} 筆`;
    if (m.type === 'removeGreen' && m.preview) {
        $('rgH1').value = m.h1;
        $('rgH2').value = m.h2;
        $('rgS1').value = m.s1;
        $('rgS2').value = m.s2;
        $('rgV1').value = m.v1;
        $('rgV2').value = m.v2;
        $('rgRgbThr').value = m.rgbThr;
    }
    if (m.type === 'color') document.querySelectorAll('.colFillOnly').forEach(e => {e.hidden = colorHow() !== 'fill';});
    if (m.type !== 'warp') cv.style.cursor = m.type === 'pixel' || (editSp() && spPaintOn()) ? 'crosshair' : '';
    if (m.type === 'warp')
    {
        const f = warpCur(m);
        if (f) {$('wpCols').value = f.cols; $('wpRows').value = f.rows;}
        $('wpCols').disabled = $('wpRows').disabled = !!f?.edited;
        $('wpDelete').disabled = $('wpReset').disabled = !f;
        $('wpInfo').textContent = f ? `框 ${m.cur + 1}／${m.frames.length}　${f.w}×${f.h}，選 ${f.sel.size} 點，可退 ${f.hist.length} 步` : '還沒有變形框：在圖層上拖曳拉一個';
    }
    if (m.type === 'crop')
    {
        const isPoly = cropShape() === 'poly', P = m.poly;
        $('cropHint').textContent = isPoly
            ? '單擊加點，點第一點或雙擊閉合；Backspace 倒退、Shift 鎖 45°；閉合後拖頂點、點邊加點；Esc 清掉重畫'
            : '在圖層上拖曳框選範圍';
        const r = isPoly ? P?.closed && polyRect(P.pts.map(p => [p.x, p.y]), m.layer) : m.rect && cropRect(m.rect, m.layer);
        const pts = isPoly && P ? `${P.pts.length} 點${P.closed ? '' : '（未閉合）'}　` : '';
        $('cropInfo').textContent = pts + (r ? `${r.x0},${r.y0} → ${r.x1},${r.y1}（${r.x1 - r.x0}×${r.y1 - r.y0}）` : '');
    }
    if (m.type === 'scale')
    {
        const set = (id, v) => {if (document.activeElement !== $(id)) $(id).value = v;};
        set('scPct', round(m.sx * m.k * 100, 10));
        set('scW', Math.round(m.layer.canvas.width * m.sx));
        set('scH', Math.round(m.layer.canvas.height * m.sy));
    }
}

// ---------- 檔案 ----------

const PROJ_EXT = '.pdproj.json';
const isProj = (name) => name.toLowerCase().endsWith(PROJ_EXT);

const treeOpt = {
    onFile: (fh, dir, path) => (isProj(fh.name) ? openProject(fh, dir, path) : loadHandle(fh, dir, path)).catch(e => status(e.message)),
    // 一般位置的「刪除」是移到 .tbd（保留相對路徑），.tbd 裡才真的刪、可以搬回原位
    menu: (e, f) => ctxMenu(e.clientX, e.clientY, [
        ['改名', () => startRename(f)],
        ...(inDir(f.path, TBD)
            ? [['刪除', () => deleteFile(f).catch(err => status(err.message))], ['搬回原位', () => fileBack(f).catch(err => status(err.message))]]
            : [[`移到 ${TBD}`, () => fileToTbd(f).catch(err => status(err.message))]]),
        // 右鍵在已選的列上＝整批，在沒選的列上＝只有那一張
        ...(/\.png$/i.test(f.fh.name) ? [['批次存武器到 item…', () => saveBatch(picked.has(f.row) ? [...picked].map(r => r.file) : [f]).catch(err => status(err.message))]] : []),
    ]),
    // 根節點、.tbd 本身只能新增資料夾
    dirMenu: (e, w) => ctxMenu(e.clientX, e.clientY, [
        ['新增資料夾', () => startNewDir(w).catch(err => status(err.message))],
        ...(!w.dataset.path || sameSrc(w.dataset.path, TBD) ? [] : [
            ['改名', () => startRenameDir(w)],
            ...(inDir(w.dataset.path, TBD)
                ? [['刪除', () => deleteDir(w).catch(err => status(err.message))], ['搬回原位', () => dirBack(w).catch(err => status(err.message))]]
                : [[`移到 ${TBD}`, () => dirToTbd(w).catch(err => status(err.message))]]),
        ]),
    ]),
    move: true,
};

// 主清單多選：Ctrl+點切換、Shift+點從上次點的那列選到這列（同資料夾才算範圍），一般點照舊開圖並清掉選取
const picked = new Set();
let pickAnchor = null, dragFiles = null, dragDir = null;

function clearPick()
{
    picked.forEach(r => r.classList.remove('picked'));
    picked.clear();
}

function setPick(r, on)
{
    r.classList.toggle('picked', on);
    on ? picked.add(r) : picked.delete(r);
}

// 回傳 true 表示是選取操作、不開圖
function pickClick(e, r)
{
    const anchor = pickAnchor;
    pickAnchor = r;
    if (e.shiftKey && anchor?.isConnected && anchor.parentElement === r.parentElement)
    {
        const rows = [...r.parentElement.children].filter(x => x.classList.contains('file'));
        const [i, j] = [rows.indexOf(anchor), rows.indexOf(r)].sort((a, b) => a - b);
        rows.slice(i, j + 1).forEach(x => setPick(x, true));
        return true;
    }
    if (e.ctrlKey || e.shiftKey)
    {
        setPick(r, !picked.has(r));
        return true;
    }
    clearPick();
    return false;
}

function buildTree(box, opt)
{
    box.innerHTML = '';
    if (opt.move) clearPick();
    if (S.root) box.append(treeNode(S.root, S.root.name, '', 0, opt, true));
}

// 縮圖裁掉透明邊再縮；快取依路徑，lastModified 變了就重產
const THUMB = 32;
const thumbs = new Map();
const thumbIO = new IntersectionObserver(es => {
    for (const e of es.filter(e => e.isIntersecting))
    {
        thumbIO.unobserve(e.target);
        drawThumb(e.target).catch(() => {});
    }
});

async function thumbOf(fh, key)
{
    const file = await fh.getFile(), hit = thumbs.get(key);
    if (hit?.mod === file.lastModified) return hit.cv;
    const src = PX.fromImage(await createImageBitmap(file));
    const b = PX.opaqueBounds(src, AUTO_ALPHA) ?? {x: 0, y: 0, w: src.width, h: src.height};
    const k = THUMB / Math.max(b.w, b.h), w = b.w * k, h = b.h * k;
    const cv = PX.newCanvas(THUMB, THUMB), g = cv.getContext('2d');
    g.imageSmoothingEnabled = k < 1;
    g.drawImage(src, b.x, b.y, b.w, b.h, (THUMB - w) / 2, (THUMB - h) / 2, w, h);
    thumbs.set(key, {mod: file.lastModified, cv});
    return cv;
}

async function drawThumb(c)
{
    const t = await thumbOf(c.fh, c.key), g = c.getContext('2d');
    g.clearRect(0, 0, THUMB, THUMB);
    g.drawImage(t, 0, 0);
    c.loaded = true;
}

// images/ 有變動（vite dev 監看推 'tools:images'，見 vite/config.dev.mjs）：重列列過的那些資料夾、重畫縮圖；畫布上的圖層不動
async function imagesChanged({dirs = [], changed = []})
{
    const want = new Set(dirs.map(d => d.toLowerCase()));
    const boxes = [$('tree'), ...($('dlgSave').open ? [$('dlgTree')] : [])];
    const nodes = boxes.flatMap(b => [...b.querySelectorAll('.tdir')]).filter(w => want.has(w.dataset.path.toLowerCase()));
    await Promise.all(nodes.map(w => w.reload().catch(() => {})));
    if (changed.length) await refreshThumbs();
}
import.meta.hot?.on('tools:images', (r) => imagesChanged(r).catch(e => status(e.message)));

const refreshThumbs = () => Promise.all([...document.querySelectorAll('.tree canvas.thumb')].filter(c => c.loaded).map(drawThumb));

// 資料夾節點（.tdir）掛 reload()：列過的才重列，子資料夾節點沿用（保留它們的展開狀態），檔案列重建
function treeNode(dir, label, path, depth, opt, open)
{
    const wrap = el('div', 'tdir'), row = el('div', 'row dir'), kids = el('div');
    Object.assign(wrap.dataset, {path, name: dir.name});
    Object.assign(wrap, {fsDir: dir, depth});
    row.style.paddingLeft = `${depth * 12 + 4}px`;
    row.title = label;
    let listing = null, expanded = false;
    const list = async () => {
        const {dirs, files} = await FS.listDir(dir);
        const old = new Map([...kids.children].filter(k => k.classList.contains('tdir')).map(k => [k.dataset.name, k]));
        const out = dirs.filter(d => !opt.skip?.(path, d.name)).map(d => old.get(d.name) ?? treeNode(d, d.name, join(path, d.name), depth + 1, opt, false));
        kids.replaceChildren(...out);
        if (!opt.onFile) return;
        const show = opt.filter ?? (n => /\.png$/i.test(n) || isProj(n));
        for (const f of files.filter(f => show(f.name)))
        {
            const r = el('div', isProj(f.name) ? 'row file proj' : 'row file'), name = el('span', 'name');
            const thumb = /\.png$/i.test(f.name) ? el('canvas', 'thumb') : el('span', 'thumb');
            if (thumb instanceof HTMLCanvasElement)
            {
                Object.assign(thumb, {width: THUMB, height: THUMB, fh: f, key: join(path, f.name)});
                thumbIO.observe(thumb);
            }
            else thumb.textContent = '🧩';
            name.textContent = r.title = f.name;
            r.append(thumb, name);
            r.style.paddingLeft = `${depth * 12 + 28}px`;
            r.file = {fh: f, dir, path, node: wrap};
            r.onclick = opt.move ? (e) => pickClick(e, r) || opt.onFile(f, dir, path, r) : () => opt.onFile(f, dir, path, r);
            if (opt.menu) r.oncontextmenu = (e) => {e.preventDefault(); opt.menu(e, {...r.file, row: r});};
            if (opt.move)
            {
                r.draggable = true;
                r.ondragstart = (e) => {
                    dragFiles = picked.has(r) ? [...picked] : [r];
                    e.dataTransfer.effectAllowed = 'move';
                };
                r.ondragend = () => {dragFiles = null;};
            }
            kids.append(r);
        }
    };
    if (opt.move)
    {
        // 資料夾列也能拖（根節點、.tbd 本身不行），一次一個
        if (path && !sameSrc(path, TBD))
        {
            row.draggable = true;
            row.ondragstart = (e) => {
                dragDir = wrap;
                e.dataTransfer.effectAllowed = 'move';
            };
            row.ondragend = () => {dragDir = null;};
        }
        row.ondragover = (e) => {if (dragFiles || dragDir) {e.preventDefault(); row.classList.add('drop');}};
        row.ondragleave = () => row.classList.remove('drop');
        row.ondrop = (e) => {
            e.preventDefault();
            row.classList.remove('drop');
            const rows = dragFiles, w = dragDir;
            dragFiles = dragDir = null;
            if (rows) moveFiles(rows.map(x => x.file), {dir, path, node: wrap}).catch(err => status(err.message));
            else if (w) moveDir(w, wrap).catch(err => status(err.message));
        };
    }
    // listing 是列目錄的 promise：剛展開還沒列完時 expand() 也要等到它
    wrap.reload = () => {
        if (!listing) return Promise.resolve();
        if (opt.move) clearPick();
        return listing = list();
    };
    const toggle = (force) => {
        expanded = force ?? !expanded;
        row.textContent = `${expanded ? '▾' : '▸'} ${label}`;
        kids.hidden = !expanded;
        return expanded ? listing ??= list() : Promise.resolve();
    };
    row.onclick = () => {opt.onDir?.(dir, path, row); toggle();};
    if (opt.dirMenu) row.oncontextmenu = (e) => {e.preventDefault(); opt.dirMenu(e, wrap);};
    wrap.expand = () => toggle(true);
    wrap.append(row, kids);
    toggle(open);
    return wrap;
}

async function readJson(file)
{
    try {return JSON.parse(await file.text());}
    catch {status(`${file.name} 不是合法的 JSON，略過`); return null;}
}

async function loadHandle(fh, dir, path)
{
    addLayer(await createImageBitmap(await fh.getFile()), fh.name.replace(/\.png$/i, ''), dir, path).srcPath = join(path, fh.name);
}

// ---------- 檔案樹右鍵：改名／刪除 ----------

function ctxMenu(x, y, items)
{
    document.querySelector('.ctx')?.close();
    const box = el('div', 'ctx');
    const close = box.close = () => {box.remove(); removeEventListener('pointerdown', away, true); removeEventListener('keydown', esc, true);};
    const away = (e) => {if (!box.contains(e.target)) close();};
    const esc = (e) => {if (e.key === 'Escape') {e.stopPropagation(); close();}};
    for (const [label, fn] of items)
    {
        const it = el('div');
        it.textContent = label;
        it.onclick = () => {close(); fn();};
        box.append(it);
    }
    document.body.append(box);
    const r = box.getBoundingClientRect();
    box.style.left = `${Math.min(x, innerWidth - r.width)}px`;
    box.style.top = `${Math.min(y, innerHeight - r.height)}px`;
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', esc, true);
}

// png 連同載入時會讀的同名 .json（擺放資料）一起處理；副檔名保留原本的大小寫
function fileParts(name)
{
    const proj = isProj(name), base = proj ? name.slice(0, -PROJ_EXT.length) : name.replace(/\.png$/i, '');
    return {proj, base, ext: name.slice(base.length)};
}

async function findProjects(dir = S.root, path = '')
{
    const {dirs, files} = await FS.listDir(dir);
    const own = await Promise.all(files.filter(f => isProj(f.name)).map(async f => ({dir, path, name: f.name, data: await readJson(await f.getFile())})));
    const sub = await Promise.all(dirs.map(d => findProjects(d, join(path, d.name))));
    return [...own.filter(p => p.data?.layers), ...sub.flat()];
}

const sameSrc = (a, b) => a?.toLowerCase() === b.toLowerCase();
const projectsUsing = async (src) => (await findProjects()).filter(p => p.data.layers.some(d => sameSrc(d.src, src)));

async function deleteFile({fh, dir, path, node})
{
    const {proj, base} = fileParts(fh.name), key = join(path, fh.name);
    const side = proj ? null : await FS.tryFile(dir, `${base}.json`);
    const users = proj ? [] : await projectsUsing(key);
    const msg = [`刪除 ${key}？（不會進回收桶，救不回來）`,
                 ...(side ? [`也會刪除 ${base}.json`] : []),
                 ...(users.length ? [`這些專案會用到它：${users.map(p => join(p.path, p.name)).join('、')}`] : [])];
    if (!confirm(msg.join('\n'))) return;
    await FS.removeFile(dir, fh.name);
    if (side) await FS.removeFile(dir, side.name);
    forgetFile(path, fh.name);
    await pruneTbd(path);
    await reloadUp(path);
    status(`已刪除 ${key}${side ? `、${base}.json` : ''}`);
}

// 檔案不在原位了（刪掉或移到 .tbd）：開著的圖層脫鉤，原圖是它的清掉 srcPath、專案檔是它的 proj 清掉（標未存）
function forgetFile(path, name)
{
    const {proj, base} = fileParts(name), key = join(path, name);
    thumbs.delete(key);
    if (proj)
    {
        const own = projLayers(projKey(path, base));
        own.forEach(L => {L.proj = null;});
        if (own.length) S.projSig = null;
    }
    else S.layers.filter(L => sameSrc(L.srcPath, key)).forEach(L => {delete L.srcPath;});
}

// 資料夾不在原位了：同上，另外存檔位置在裡面的回到工作資料夾
function forgetDir(from)
{
    for (const k of [...thumbs.keys()]) if (inDir(k, from)) thumbs.delete(k);
    for (const L of S.layers)
    {
        if (inDir(L.srcPath, from)) delete L.srcPath;
        if (inDir(L.path, from)) Object.assign(L, {dir: null, path: ''});
        if (L.proj && inDir(L.proj.path, from)) {L.proj = null; S.projSig = null;}
    }
}

// ---------- .tbd：一般位置的刪除是搬進來（保留相對路徑），撞名合併／覆蓋；.tbd 裡真的刪、搬回原位（原位有同名就不搬） ----------

const TBD = '.tbd';
const tbdPath = (path) => join(TBD, path);
const backPath = (path) => path.slice(TBD.length + 1);
const parentOf = (path) => path.split('/').slice(0, -1).join('/');
const tryResolve = (path) => FS.resolveDir(S.root, path).catch(() => null);

// 由上往下重列 path 跟它所有的上層（新建的中間資料夾才會出現）；列過的才重列，被上層重列拿掉的（清掉的空資料夾）跳過
async function reloadUp(path)
{
    const want = new Set([''].concat(path.split('/').filter(Boolean).map((_, i, a) => a.slice(0, i + 1).join('/'))));
    const nodes = [...$('tree').querySelectorAll('.tdir')].filter(w => want.has(w.dataset.path));
    for (const w of nodes) if (w.isConnected) await w.reload();
    refreshAll();
    updateTitle();
}

// .tbd 裡搬走／刪掉東西後，往上清掉空的資料夾（.tbd 本身留著）
async function pruneTbd(path)
{
    for (let p = path; inDir(p, TBD) && !sameSrc(p, TBD); p = parentOf(p))
    {
        const d = await tryResolve(p), ls = d && await FS.listDir(d);
        if (!d || ls.dirs.length + ls.files.length) return;
        await (await tryResolve(parentOf(p))).removeEntry(p.split('/').at(-1));
    }
}

const usersMsg = (users) => users.length ? [`這些專案會用到，會變成找不到原圖：${users.map(p => join(p.path, p.name)).join('、')}`] : [];

// png 連同名 .json；有專案用到、或 .tbd 裡同名會被覆蓋才問
async function fileToTbd({fh, dir, path})
{
    const {proj, base} = fileParts(fh.name), key = join(path, fh.name), toPath = tbdPath(path);
    const side = proj ? null : await FS.tryFile(dir, `${base}.json`);
    const names = [fh.name, ...(side ? [side.name] : [])];
    const old = await tryResolve(toPath);
    const over = old ? (await Promise.all(names.map(async n => await FS.tryFile(old, n) && join(toPath, n)))).filter(Boolean) : [];
    const users = proj ? [] : await projectsUsing(key);
    const msg = [...(over.length ? [`會覆蓋 ${over.join('、')}`] : []), ...usersMsg(users)];
    if (msg.length && !confirm(`移到 ${toPath}？\n${msg.join('\n')}`)) return;
    const to = await mkDir(S.root, toPath);
    for (const n of names) await FS.moveFile(dir, n, to);
    forgetFile(path, fh.name);
    await reloadUp(path);
    await reloadUp(toPath);
    status(`已移到 ${join(toPath, fh.name)}${side ? `（連同 ${side.name}）` : ''}`);
}

// 兩邊都有的檔案（.tbd 裡會被覆蓋的），路徑相對工作資料夾
async function overlap(from, to, path, out = [])
{
    for await (const h of from.values())
    {
        const p = join(path, h.name);
        if (h.kind === 'directory') {const d = await FS.tryDir(to, h.name); if (d) await overlap(h, d, p, out);}
        else if (await FS.tryFile(to, h.name)) out.push(p);
    }
    return out;
}

// 整棵合併進 .tbd 的同一個位置（建新的／複製／刪舊的，同改名）；複製失敗舊的不動
async function dirToTbd(w)
{
    const from = w.dataset.path, up = w.parentElement.closest('.tdir'), toPath = tbdPath(from);
    const old = await tryResolve(toPath);
    const over = old ? await overlap(w.fsDir, old, toPath) : [];
    const users = (await findProjects()).filter(p => !inDir(p.path, from) && p.data.layers.some(d => inDir(d.src, from)));
    const msg = [...(over.length ? [`會覆蓋 ${over.length} 個檔案：${over.slice(0, 10).join('、')}${over.length > 10 ? '…' : ''}`] : []), ...usersMsg(users)];
    if (msg.length && !confirm(`移到 ${toPath}？\n${msg.join('\n')}`)) return;
    try {await FS.copyDir(w.fsDir, await mkDir(S.root, toPath));}
    catch (e) {return status(`複製到 ${toPath} 失敗，${from} 沒有動：${e.message}`);}
    let left = '';
    try {await up.fsDir.removeEntry(w.dataset.name, {recursive: true});}
    catch (e) {left = `；${from} 刪不掉（${e.message}），要自己刪`;}
    forgetDir(from);
    await reloadUp(up.dataset.path);
    await reloadUp(parentOf(toPath));
    status(`已移到 ${toPath}${left}`);
}

// 不碰引用：專案檔沒改過，搬回來重開就好
async function fileBack({fh, dir, path})
{
    const {proj, base} = fileParts(fh.name), toPath = backPath(path);
    const side = proj ? null : await FS.tryFile(dir, `${base}.json`);
    const names = [fh.name, ...(side ? [side.name] : [])];
    const old = await tryResolve(toPath);
    const clash = old ? (await Promise.all(names.map(async n => await FS.tryFile(old, n) && join(toPath, n)))).filter(Boolean) : [];
    if (clash.length) return status(`${clash.join('、')} 已經存在，沒有搬回`);
    const to = await mkDir(S.root, toPath);
    for (const n of names) await FS.moveFile(dir, n, to);
    thumbs.delete(join(path, fh.name));
    await pruneTbd(path);
    await reloadUp(path);
    await reloadUp(toPath);
    status(`已搬回 ${join(toPath, fh.name)}${side ? `（連同 ${side.name}）` : ''}`);
}

async function dirBack(w)
{
    const from = w.dataset.path, up = w.parentElement.closest('.tdir'), toPath = backPath(from), toUp = parentOf(toPath);
    const parent = await tryResolve(toUp);
    if (parent && await dirHas(parent, w.dataset.name)) return status(`${toPath} 已經存在，沒有搬回`);
    try {await FS.copyDir(w.fsDir, await mkDir(await mkDir(S.root, toUp), w.dataset.name));}
    catch (e)
    {
        await (await tryResolve(toUp))?.removeEntry(w.dataset.name, {recursive: true}).catch(() => {});
        return status(`複製到 ${toPath} 失敗，沒有搬回：${e.message}`);
    }
    let left = '';
    try {await up.fsDir.removeEntry(w.dataset.name, {recursive: true});}
    catch (e) {left = `；${from} 刪不掉（${e.message}），要自己刪`;}
    for (const k of [...thumbs.keys()]) if (inDir(k, from)) thumbs.delete(k);
    await pruneTbd(up.dataset.path);
    await reloadUp(up.dataset.path);
    await reloadUp(toUp);
    status(`已搬回 ${toPath}${left}`);
}

function startRename({fh, dir, path, row, node})
{
    const {base} = fileParts(fh.name), name = row.querySelector('.name');
    const inp = el('input');
    inp.value = base;
    name.replaceWith(inp);
    inp.focus();
    inp.select();
    let done = false;
    const end = (go) => {
        if (done) return;
        done = true;
        inp.replaceWith(name);
        if (go) renameFile({fh, dir, path, node}, inp.value.trim()).catch(e => status(e.message));
    };
    inp.onclick = (e) => e.stopPropagation();
    inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') end(true);
        else if (e.key === 'Escape') end(false);
    };
    inp.onblur = () => end(false);
}

// ---------- 資料夾：新增／刪除空的 ----------

// 在資料夾節點（展開）最上面插一列輸入框，Enter 建立、Esc／失焦取消；在存檔對話框的 form 裡，Enter／Esc 要擋掉送出和關閉
async function startNewDir(w, done)
{
    await w.expand();
    const r = el('div', 'row dir'), inp = el('input');
    r.style.paddingLeft = `${(w.depth + 1) * 12 + 4}px`;
    r.append('📁 ', inp);
    w.lastChild.prepend(r);
    inp.value = '新資料夾';
    inp.focus();
    inp.select();
    let ended = false;
    const end = async (go) => {
        if (ended) return;
        ended = true;
        r.remove();
        const name = inp.value.trim();
        if (!go || !await createDir(w, name)) return;
        await w.reload();
        const k = [...w.lastChild.children].find(x => x.classList.contains('tdir') && x.dataset.name === name);
        if (k) done?.(k);
    };
    inp.onclick = (e) => e.stopPropagation();
    inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') e.preventDefault();
        if (e.key === 'Enter') end(true).catch(err => status(err.message));
        else if (e.key === 'Escape') end(false);
    };
    inp.onblur = () => end(false);
}

const badDirName = (name) => !name || /[\\/:*?"<>|]/.test(name) || /^\.+$/.test(name);
const dirHas = async (dir, name) => {const {dirs, files} = await FS.listDir(dir); return [...dirs, ...files].some(h => h.name.toLowerCase() === name.toLowerCase());};

async function createDir(w, name)
{
    const at = join(w.dataset.path, name);
    if (badDirName(name)) return status(`資料夾名稱不合法：「${name}」`), false;
    if (await dirHas(w.fsDir, name)) return status(`${at} 已經存在，沒有新增`), false;
    await w.fsDir.getDirectoryHandle(name, {create: true});
    status(`已新增資料夾 ${at}`);
    return true;
}

// 路徑 p 等於 dir 或在它底下（不分大小寫）
const inDir = (p, dir) => typeof p === 'string' && (p.toLowerCase() === dir.toLowerCase() || p.toLowerCase().startsWith(`${dir.toLowerCase()}/`));

async function countFiles(dir)
{
    let n = 0;
    for await (const h of dir.values()) n += h.kind === 'directory' ? await countFiles(h) : 1;
    return n;
}

// 只在 .tbd 裡：每次都 confirm（檔案數、資料夾外面用到裡面圖的專案），整棵刪，開著的圖層脫鉤（forgetDir）
async function deleteDir(w)
{
    const from = w.dataset.path, up = w.parentElement.closest('.tdir');
    const n = await countFiles(w.fsDir);
    const users = (await findProjects()).filter(p => !inDir(p.path, from) && p.data.layers.some(d => inDir(d.src, from)));
    const msg = [`刪除資料夾 ${from}？裡面有 ${n} 個檔案（含子資料夾），不會進回收桶，救不回來`,
                 ...(users.length ? [`這些專案會用到裡面的圖：${users.map(p => join(p.path, p.name)).join('、')}`] : [])];
    if (!confirm(msg.join('\n'))) return;
    await up.fsDir.removeEntry(w.dataset.name, {recursive: true});
    forgetDir(from);
    await pruneTbd(up.dataset.path);
    await reloadUp(up.dataset.path);
    status(`已刪除資料夾 ${from}`);
}

// 原地編輯資料夾列（保留 ▸／▾），Enter 改名、Esc／失焦取消
function startRenameDir(w)
{
    const row = w.firstChild, text = row.textContent, inp = el('input');
    inp.value = w.dataset.name;
    row.replaceChildren(text.slice(0, 2), inp);
    inp.focus();
    inp.select();
    let ended = false;
    const end = (go) => {
        if (ended) return;
        ended = true;
        row.textContent = text;
        if (go) renameDir(w, inp.value.trim()).catch(e => status(e.message));
    };
    inp.onclick = (e) => e.stopPropagation();
    inp.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') end(true);
        else if (e.key === 'Escape') end(false);
    };
    inp.onblur = () => end(false);
}

async function renameDir(w, to)
{
    const name = w.dataset.name, from = w.dataset.path, up = w.parentElement.closest('.tdir'), dest = join(up.dataset.path, to);
    if (to === name) return;
    if (badDirName(to)) return status(`資料夾名稱不合法：「${to}」`);
    if (to.toLowerCase() === name.toLowerCase()) return status('只改大小寫不支援（Windows 檔案系統分不出來）');
    if (await dirHas(up.fsDir, to)) return status(`${dest} 已經存在，沒有改名`);
    const r = await relocateDir(w, up, to);
    status(r.err ? `${r.err}，沒有改名` : `已改名 ${from} → ${dest}${r.msg}`);
}

// 拖資料夾列到別的資料夾列上：不能拖進自己（或底下）、原本就在那裡的不動、目的地有同名就拒絕；引用同改名
async function moveDir(w, to)
{
    const from = w.dataset.path, up = w.parentElement.closest('.tdir'), dest = join(to.dataset.path, w.dataset.name);
    if (inDir(to.dataset.path, from)) return status(`${from} 不能搬進自己裡面`);
    if (sameSrc(up.dataset.path, to.dataset.path)) return;
    if (await dirHas(to.fsDir, w.dataset.name)) return status(`${dest} 已經存在，沒有移動`);
    const r = await relocateDir(w, to, w.dataset.name);
    status(r.err ? `${r.err}，沒有移動` : `已移動 ${from} 到 ${to.dataset.path || S.root.name}${r.msg}`);
}

// FS Access 沒有搬資料夾：在 to 底下建 name → 整棵複製 → 刪舊的；複製失敗就刪掉複製一半的、舊的不動，刪舊的失敗就留著兩份、引用照樣改成新的
// 引用：所有專案的 src／path、開著的圖層 srcPath／path／dir、專案歸屬 proj.path／dir（舊的 handle 失效，重新 resolve）
async function relocateDir(w, to, name)
{
    const from = w.dataset.path, up = w.parentElement.closest('.tdir'), dest = join(to.dataset.path, name);
    try {await FS.copyDir(w.fsDir, await to.fsDir.getDirectoryHandle(name, {create: true}));}
    catch (e)
    {
        await to.fsDir.removeEntry(name, {recursive: true}).catch(() => {});
        return {err: `複製到 ${dest} 失敗（${e.message}）`};
    }
    let left = '';
    try {await up.fsDir.removeEntry(w.dataset.name, {recursive: true});}
    catch (e) {left = `；舊的 ${from} 刪不掉（${e.message}），要自己刪`;}

    const moved = (p) => inDir(p, from) ? dest + p.slice(from.length) : null;
    const wasClean = !isUnsaved(), fixed = [];
    for (const p of await findProjects())
    {
        let hit = false;
        for (const d of p.data.layers)
            for (const k of ['src', 'path'])
            {
                const n = moved(d[k]);
                if (n !== null) {d[k] = n; hit = true;}
            }
        if (!hit) continue;
        await FS.writeFile(p.dir, p.name, new Blob([JSON.stringify(p.data, null, 2) + '\n']));
        fixed.push(join(p.path, p.name));
    }
    for (const L of S.layers)
    {
        const s = moved(L.srcPath), p = moved(L.path);
        if (s !== null) L.srcPath = s;
        if (p !== null) Object.assign(L, {path: p, dir: await FS.resolveDir(S.root, p)});
    }
    for (const P of projects())
    {
        const p = moved(P.path);
        if (p !== null) Object.assign(P, {path: p, dir: await FS.resolveDir(S.root, p)});
    }
    for (const k of [...thumbs.keys()]) if (moved(k) !== null) thumbs.delete(k);
    if (wasClean && S.projSig) S.projSig = projectSig();
    for (const n of new Set([up, to])) if (n.isConnected) await n.reload();
    refreshAll();
    updateTitle();
    return {msg: `${fixed.length ? `；更新了專案 ${fixed.join('、')}` : ''}${left}`};
}

// 照路徑一層層展開，回傳那個資料夾節點
async function treeDir(box, path, w = box.querySelector('.tdir'))
{
    for (const seg of path.split('/').filter(Boolean))
    {
        if (!w) break;
        await w.expand();
        w = [...w.lastChild.children].find(k => k.classList.contains('tdir') && k.dataset.name === seg);
    }
    return w ?? null;
}

async function renameFile({fh, dir, path, node}, to)
{
    const {proj, base, ext} = fileParts(fh.name);
    if (to === base) return;
    if (!to || /[\\/:*?"<>|]/.test(to)) return status(`檔名不合法：「${to}」`);
    if (to.toLowerCase() === base.toLowerCase()) return status('只改大小寫不支援（Windows 檔案系統分不出來）');
    const side = proj ? null : await FS.tryFile(dir, `${base}.json`);
    const clash = [to + ext, ...(side ? [`${to}.json`] : [])];
    for (const n of clash) if (await FS.tryFile(dir, n)) return status(`${join(path, n)} 已經存在，沒有改名`);
    const from = join(path, fh.name), dest = join(path, to + ext);
    const wasClean = !isUnsaved();
    await FS.renameFile(dir, fh.name, to + ext);
    if (side) await FS.renameFile(dir, side.name, `${to}.json`);
    thumbs.delete(from);
    const fixed = [];
    if (proj) projLayers(projKey(path, base)).forEach(L => {L.proj.name = to;});
    else
    {
        for (const p of await projectsUsing(from))
        {
            p.data.layers.forEach(d => {if (sameSrc(d.src, from)) d.src = dest;});
            await FS.writeFile(p.dir, p.name, new Blob([JSON.stringify(p.data, null, 2) + '\n']));
            fixed.push(join(p.path, p.name));
        }
        const open = S.layers.filter(L => sameSrc(L.srcPath, from));
        open.forEach(L => {L.srcPath = dest;});
        if (wasClean && S.projSig) S.projSig = projectSig();
        open.filter(L => L.name === base).forEach(L => {L.name = to;});
    }
    await node.reload();
    refreshAll();
    updateTitle();
    status(`已改名 ${from} → ${dest}${side ? `（連同 ${to}.json）` : ''}${fixed.length ? `；更新了專案 ${fixed.join('、')}` : ''}`);
}

// 整批先檢查撞名（目的地已有、或彼此同名，含 png 的同名 .json，大小寫不分），有任何一個就整批不搬
async function moveFiles(files, to)
{
    files = files.filter(f => f.path.toLowerCase() !== to.path.toLowerCase());
    if (!files.length) return;
    const where = to.path || S.root.name;
    const plan = await Promise.all(files.map(async f => {
        const {proj, base} = fileParts(f.fh.name);
        const side = proj ? null : await FS.tryFile(f.dir, `${base}.json`);
        return {...f, proj, base, names: [f.fh.name, ...(side ? [side.name] : [])]};
    }));
    const taken = new Set((await FS.listDir(to.dir)).files.map(h => h.name.toLowerCase())), clash = [];
    for (const n of plan.flatMap(p => p.names))
    {
        if (taken.has(n.toLowerCase())) clash.push(n);
        taken.add(n.toLowerCase());
    }
    if (clash.length) return status(`${where} 撞名，沒有移動：${clash.join('、')}`);
    const wasClean = !isUnsaved(), done = [];
    let err = null;
    for (const p of plan)
    {
        let n = p.names[0];
        try
        {
            await FS.moveFile(p.dir, n, to.dir);
            done.push(p);
            for (n of p.names.slice(1)) await FS.moveFile(p.dir, n, to.dir);
        }
        catch (e) {err = `移動 ${join(p.path, n)} 失敗：${e.message}`; break;}
    }
    const srcs = new Map();
    for (const p of done)
    {
        const from = join(p.path, p.fh.name);
        thumbs.delete(from);
        if (p.proj) projLayers(projKey(p.path, p.base)).forEach(L => {Object.assign(L.proj, {dir: to.dir, path: to.path});});
        else srcs.set(from.toLowerCase(), join(to.path, p.fh.name));
    }
    const fixed = [];
    if (srcs.size)
    {
        for (const p of await findProjects())
        {
            const hits = p.data.layers.filter(d => srcs.has(d.src?.toLowerCase()));
            if (!hits.length) continue;
            hits.forEach(d => {d.src = srcs.get(d.src.toLowerCase());});
            await FS.writeFile(p.dir, p.name, new Blob([JSON.stringify(p.data, null, 2) + '\n']));
            fixed.push(join(p.path, p.name));
        }
        S.layers.filter(L => srcs.has(L.srcPath?.toLowerCase())).forEach(L => {L.srcPath = srcs.get(L.srcPath.toLowerCase());});
        if (wasClean && S.projSig) S.projSig = projectSig();
    }
    await Promise.all([...new Set([...done.map(p => p.node), to.node])].map(n => n.reload()));
    refreshAll();
    updateTitle();
    const msg = done.length ? `已移動 ${done.map(p => p.fh.name).join('、')} 到 ${where}${fixed.length ? `；更新了專案 ${fixed.join('、')}` : ''}` : '';
    status(err ? `${err}${msg ? `；${msg}` : ''}` : msg);
}

async function setRoot(h)
{
    S.root = h;
    buildTree($('tree'), treeOpt);
}

function needRoot()
{
    if (!S.root) status('先在上方選擇專案資料夾（工作資料夾是裡面的 images/）');
    return !!S.root;
}

// bake：有半透明圖層時傳勾選框的文字，結果的 bake 是有沒有勾；note(path, name)：覆蓋確認時多加的文字
// tex：樹多一個 public/assets/textures 根（不列 .tbd、minimap），選它的話結果的 tex 是 true、path 相對 textures/；
// 存進去的檔名不能跟 textures/ 別的資料夾的 key 撞名，撞了提示後對話框留著讓你改
function saveDialog(title, dir, path, name, ext = '.png', bake = null, note = null, tex = false)
{
    const dlg = $('dlgSave'), box = $('dlgTree');
    let sel = {dir, path, tex: false};
    const selDir = () => !sel.tex ? sel.path : sel.path ? `textures/${sel.path}` : 'textures';
    const showPath = () => {$('dlgPath').textContent = join(sel.tex ? 'textures' : S.root.name, sel.path);};
    $('dlgTitle').textContent = title;
    $('dlgExt').textContent = ext;
    $('dlgBakeRow').hidden = !bake;
    $('dlgBakeLab').textContent = bake ?? '';
    $('dlgBake').checked = true;
    const curName = () => {
        const n = $('dlgName').value.trim();
        return n.toLowerCase().endsWith(ext) ? n.slice(0, -ext.length) : n;
    };
    let texRoot = null;
    const pick = (d, p, row) => {
        sel = {dir: d, path: p, tex: !!texRoot?.contains(row)};
        box.querySelectorAll('.sel').forEach(r => r.classList.remove('sel'));
        row.classList.add('sel');
        showPath();
    };
    const opt = {
        onDir: pick,
        filter: (n) => n.toLowerCase().endsWith(ext),
        onFile: (f, d, p, row) => {pick(d, p, row); $('dlgName').value = f.name.slice(0, -ext.length);},
    };
    buildTree(box, opt);
    if (tex && S.assets)
    {
        texRoot = treeNode(S.assets.tex, 'textures', '', 0, {...opt, skip: (p, n) => !p && TEX_SKIP.includes(n)}, false);
        box.append(texRoot);
    }
    // 建在目前的目的地底下，建好就選它
    $('dlgNewDir').onclick = () => treeDir(box, sel.path, sel.tex ? texRoot : undefined)
        .then(w => w && startNewDir(w, k => {pick(k.fsDir,k.dataset.path, k.firstChild); $('dlgName').focus();}))
        .catch(e => status(e.message));
    $('dlgName').value = name;
    showPath();
    dlg.returnValue = '';
    dlg.showModal();
    $('dlgName').select();
    return new Promise(res => {
        const onClose = async () => {
            const n = curName();
            if (dlg.returnValue !== 'ok' || !n) return res(null);
            if (sel.tex)
            {
                const hit = [...await texKeys()].find(([k]) => k.toLowerCase() === n.toLowerCase());
                if (hit && hit[1].toLowerCase() !== sel.path.toLowerCase())
                {
                    alert(`textures/${join(hit[1], hit[0])}.png 已經有了（texture key 不能撞名），換個檔名`);
                    dlg.returnValue = '';
                    dlg.showModal();
                    $('dlgName').select();
                    return dlg.addEventListener('close', onClose, {once: true});
                }
            }
            const bk = !!bake && $('dlgBake').checked;
            const shown = join(selDir(), n);
            if (await FS.tryFile(sel.dir, n + ext) && !confirm(`${shown}${ext} 已存在，要覆蓋嗎？${note?.(sel.path, n) ?? ''}`)) return res(null);
            res({...sel, name: n, bake: bk});
        };
        dlg.addEventListener('close', onClose, {once: true});
    });
}

const placeOf = (L) => ({x: round(L.x), y: round(L.y), a: round(L.a, 10), scale: round(L.scale, 10000), ox: L.ox, oy: L.oy});

// ---------- icon ----------
// size×size、順時針轉 a 度、內容佔 fill%；icon 模式的設定存 localStorage，自動模式存武器 icon 固定用 ICON_AUTO

const ICON_KEY = 'paperdoll.icon';
const ICON_AUTO = {size: 100, a: 45, fill: 90};

function iconLoad()
{
    let v = null;
    try {v = JSON.parse(localStorage.getItem(ICON_KEY));}
    catch {}
    return {...ICON_AUTO, ...v};
}

function iconSet(v)
{
    S.icon = v;
    try {localStorage.setItem(ICON_KEY, JSON.stringify(v));}
    catch {}
}

// 自動零件從縮小前的圖轉，不然是把縮成 10% 的 equip 圖再放大
function iconSrc(L)
{
    const i = L.auto ? autoBase(L) : -1;
    return i < 0 ? L.canvas : PX.replay(L.src, L.ops.slice(0, i));
}

// 給 w／h 就是長方形，內容等比塞進 w×h 的 fill%；fill 可以超過 100，超出框的部分裁掉
function iconOf(c, {size, w = size, h = size, a, fill})
{
    // cos(90°) 不是剛好 0，不扣一點會多出一格、整張圖偏半格糊掉
    const r = a * Math.PI / 180, cs = Math.abs(Math.cos(r)), sn = Math.abs(Math.sin(r)), dim = (v) => Math.ceil(v - 1e-6);
    const rot = PX.newCanvas(dim(c.width * cs + c.height * sn), dim(c.width * sn + c.height * cs));
    const g = rot.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.translate(rot.width / 2, rot.height / 2);
    g.rotate(r);
    g.drawImage(c, -c.width / 2, -c.height / 2);
    const b = PX.opaqueBounds(rot, trimT());
    if (!b) return null;
    const k = fill / 100 * Math.min(w / b.w, h / b.h);
    const fit = PX.xform(rot, {sx: b.x, sy: b.y, sw: b.w, sh: b.h, w: Math.max(1, Math.round(b.w * k)), h: Math.max(1, Math.round(b.h * k))});
    const out = PX.newCanvas(w, h);
    out.getContext('2d').drawImage(fit, Math.floor((w - fit.width) / 2), Math.floor((h - fit.height) / 2));
    return out;
}

// 頭像：頭、頭髮縮小前的圖照目前擺放疊起來（x/y 照 存檔%×scale 放大回原圖尺寸），再照 尺寸×尺寸×% 等比置中；
// 縮小前的圖只跟零件的步驟有關，照 ops 快取（拖曳時不重播）
const preCache = new WeakMap();
function preOf(C)
{
    const h = preCache.get(C);
    if (h?.ops === C.ops) return h.c;
    const c = iconSrc(C);
    preCache.set(C, {ops: C.ops, c});
    return c;
}

function portraitOf(parts, o = S.auto.portrait, bake = false)
{
    const ps = autoParts('head').map(P => parts.find(p => p.P === P)).filter(Boolean);
    if (!ps.length) return null;
    // 原圖 1 像素在畫面上是 存檔%×scale 個遊戲單位，頭、頭髮可以不同：以最大的為基準（那個用縮小前的圖），其他照比例縮小，大小、位置才跟畫面上一致
    const unit = (C) => C.ops[autoBase(C)].pct / 100 * C.scale, top = Math.max(...ps.map(({C}) => unit(C)));
    const ims = ps.map(({C}) => {
        const src = preOf(C), f = bake ? PX.fade(src, C.opacity) : src, r = unit(C) / top;
        const c = PX.xform(f, {sx: 0, sy: 0, sw: f.width, sh: f.height, w: Math.max(1, Math.round(f.width * r)), h: Math.max(1, Math.round(f.height * r))});
        return {c, x: C.x / top - C.ox * c.width, y: C.y / top - C.oy * c.height};
    });
    const x0 = Math.min(...ims.map(i => i.x)), y0 = Math.min(...ims.map(i => i.y));
    const cv = PX.newCanvas(Math.ceil(Math.max(...ims.map(i => i.x + i.c.width)) - x0), Math.ceil(Math.max(...ims.map(i => i.y + i.c.height)) - y0));
    const g = cv.getContext('2d');
    for (const i of ims) g.drawImage(i.c, Math.round(i.x - x0), Math.round(i.y - y0));
    return iconOf(cv, {...o, a: 0});
}

// 來源圖照圖層目前的 canvas 快取，圖層在模式裡被改（undo）就重取
function iconPreview(m)
{
    if (m.canvas !== m.layer.canvas) Object.assign(m, {canvas: m.layer.canvas, src: iconSrc(m.layer)});
    const c = iconOf(m.src, S.icon), pv = $('icPreview');
    pv.width = pv.height = S.icon.size;
    if (c) pv.getContext('2d').drawImage(c, 0, 0);
    $('icInfo').textContent = c ? `${S.icon.size}×${S.icon.size}，來源 ${m.src.width}×${m.src.height}${m.src !== m.layer.canvas ? '（縮小前）' : ''}` : '沒有不透明的像素';
    $('icSave').disabled = !c;
}

async function saveIcon()
{
    const m = S.mode;
    if (m.type !== 'icon' || !needRoot()) return;
    const L = m.layer, o = {...S.icon};
    const bake = L.opacity < 1 ? `烘入不透明度（目前 ${Math.round(L.opacity * 100)}%）` : null;
    const r = await saveDialog(`存 icon（${o.size}×${o.size}）`, L.dir ?? S.root, L.dir ? L.path : '', `${L.name}-icon`, '.png', bake, null, true);
    if (!r) return;
    const c = iconOf(r.bake ? PX.fade(m.src, L.opacity) : m.src, o);
    if (!c) return status('沒有不透明的像素');
    await FS.writeFile(r.dir, `${r.name}.png`, await PX.toPng(c));
    refreshThumbs();
    status(`${r.tex ? '已匯出 textures/' : '已存 '}${join(r.path, r.name)}.png`);
}

// ---------- 遊戲資料 ----------
// 遊戲的 public/assets：自動零件的 PNG 寫進 textures/ 底下、擺放寫進 json/item.json 的 equip

// h：專案根目錄，或直接給 public/assets（無頭測試）
async function setAssets(h)
{
    const dir = await FS.tryDir(await FS.tryDir(h, 'public'), 'assets') ?? h;
    const json = await FS.tryDir(dir, 'json'), tex = await FS.tryDir(dir, 'textures');
    if (!json || !tex || !await FS.tryFile(json, 'item.json')) throw new Error(`「${h.name}」裡沒有 public/assets/json/item.json 和 textures/`);
    S.assets = {dir, json, tex};
    return S.assets;
}

async function mkDir(root, path)
{
    let d = root;
    for (const seg of path.split('/').filter(Boolean)) d = await d.getDirectoryHandle(seg, {create: true});
    return d;
}

const readGameJson = async (name) => JSON.parse(await (await (await S.assets.json.getFileHandle(name)).getFile()).text());

// 拆了前後片的 item：sprite 是「X-front」、back 是「X-back」、icon 是完整的原圖 X
const splitBase = (s) => s?.replace(/-front$/, '');
const splitPng = (L, bake) => bake ? PX.fade(L.canvas, L.opacity) : L.canvas;

// 一組前後片能不能存：兩片都要在（挖除只要前片）、三層同尺寸同位置（原圖改過尺寸要先重進前後片模式）
function splitMismatch(g)
{
    if (!g.F || (!g.B && !g.cut)) return `前後片缺了 ${g.F ? '後片' : '前片'}，要重拆先到「前後片」按確定`;
    const [A, ...rest] = [g.O, g.F, g.B].filter(Boolean);
    for (const M of rest)
    {
        if (A.canvas.width !== M.canvas.width || A.canvas.height !== M.canvas.height)
            return `${A.name} 跟 ${M.name} 尺寸不一樣${A === g.O ? '（原圖改過，先到「前後片」按確定更新）' : ''}`;
        const k = ['x', 'y', 'a', 'ox', 'oy', 'scale'].find(k => Math.abs(A[k] - M[k]) > 1e-6);
        if (k) return `${A.name} 跟 ${M.name} 的位置不一樣（${k}）`;
    }
    return '';
}

// 掉在地上的樣子：sprite 是完整原圖（拆了前後片也不用 -front）、scale 跟 equip 一樣；沒有就補，其他 key 保留
const dropOf = (it) => it.drop ??= {sprite: splitBase(it.equip.sprite)};
const dropScale = (it) => {dropOf(it).scale = it.equip.scale;};

// sprite 換成 name（拆了就是 name-front＋back，挖除只有 name-front）；有給 icon 就換成它；drop.sprite 一律換成 name
function setSplit(it, name, g, icon)
{
    const e = it.equip;
    e.sprite = g ? `${name}-front` : name;
    if (g && !g.cut) e.back = `${name}-back`;
    else delete e.back;
    if (icon) it.icon = icon;
    dropOf(it).sprite = name;
}

function writeEquip(e, L)
{
    const o = placeOf(L);
    Object.assign(e, {scale: o.scale, x: o.x, y: o.y});
    for (const [k, def] of [['a', 0], ['ox', 0.5], ['oy', 1]])
    {
        if (o[k] === def) delete e[k];
        else e[k] = o[k];
    }
}

async function saveLayer()
{
    const L = S.active;
    if (!L || !needRoot()) return;
    cancelMode();
    const bake = L.opacity < 1 ? `烘入不透明度（目前 ${Math.round(L.opacity * 100)}%）` : null;
    const output = await FS.tryDir(S.root, 'output');
    const [dir, path] = output ? [output, 'output'] : [L.dir ?? S.root, L.dir ? L.path : ''];
    const r = await saveDialog(`存檔：${L.name}`, dir, path, `${L.name}-copy`, '.png', bake, null, true);
    if (!r) return;
    const out = r.bake ? PX.fade(L.canvas, L.opacity) : L.canvas;
    await FS.writeFile(r.dir, `${r.name}.png`, await PX.toPng(out));
    // 存進 textures/ 是匯出成品：圖層的原圖／位置都不動
    if (r.tex) return status(`已匯出 textures/${join(r.path, r.name)}.png`);
    refreshThumbs();
    Object.assign(L, {dir: r.dir, path: r.path});
    // 拖進來的圖（沒有原圖路徑）或覆蓋了自己的原圖：改以剛存的檔當原圖，步驟歸零（舊 undo 對不上新原圖，一起清掉）
    // 新原圖已經烘了不透明度，opacity 要歸 1，不然會乘兩次
    const saved = join(r.path, `${r.name}.png`);
    if (!L.srcPath || L.srcPath === saved)
    {
        hist.forget(L);
        Object.assign(L, {src: out, canvas: out, ops: [], srcPath: saved});
        if (r.bake) L.opacity = 1;
    }
    refreshProps();
    dirty();
    status(`已存 ${saved}`);
}

// ---------- 自動零件存到 item.json ----------
// 每個零件一列：選同 cat 的 item 或新增，可改 png 檔名、各自勾要不要更新圖（PNG＋sprite）／更新設定（scale/x/y/a/ox/oy＋drop.scale）

const ITEM_CAT = {helmet: 'CAT_HELMET', armor: 'CAT_CHESTPLATE', boots: 'CAT_BOOTS', weapon: 'CAT_WEAPON'};
const ITEM_PRE = {helmet: 'helmet', armor: 'chest', boots: 'boots'};
const itemDir = (P) => P.kind === 'weapon' ? 'weapons' : 'equips';
// 武器的 icon 是另外產的斜擺圖 <名>-icon（ICON_AUTO），護具的 icon 就是完整的原圖
const iconKey = (r) => r.P.kind === 'weapon' ? `${r.name}-icon` : r.name;
const TEX_SKIP = ['.tbd', 'minimap'];

// texture key → 所在資料夾（相對 textures/）；不讀 textures.json，因為新圖可能還沒更新清單
async function texKeys(dir = S.assets.tex, path = '', out = new Map())
{
    for await (const h of dir.values())
    {
        if (h.kind === 'directory') {if (path || !TEX_SKIP.includes(h.name)) await texKeys(h, join(path, h.name), out);}
        else if (/\.png$/i.test(h.name)) out.set(h.name.slice(0, -4), path);
    }
    return out;
}

function nextItemId(items, pre)
{
    const n = Math.max(0, ...Object.keys(items).map(id => +(id.match(new RegExp(`^${pre}_(\\d+)$`))?.[1] ?? 0)));
    return `${pre}_${String(n + 1).padStart(2, '0')}`;
}

// 填 r.err（擋存檔）、r.warn（提示）、r.ask（覆蓋別人的圖，存檔時 confirm）；回傳要處理的列
function itemCheck(rows, items, keys)
{
    const act = rows.filter(r => r.on && (r.png || r.place || r.icon));
    const idOf = (r) => r.id ?? r.newId;
    for (const r of rows) Object.assign(r, {err: '', warn: '', ask: '', dropF: false});
    for (const r of act)
    {
        const err = (s) => {r.err ||= s;};
        r.dropF = r.P.kind === 'armor' && !S.auto.saveF && !!items[r.id]?.equip?.f;
        const old = r.id ? splitBase(items[r.id]?.equip?.sprite) : null;
        if (r.id && !items[r.id]) err(`item.json 裡已經沒有 ${r.id}`);
        if (!r.id)
        {
            if (!r.newId) err('要填 id');
            else if (items[r.newId]) err(`id ${r.newId} 已經有了`);
            if (!r.lab) err('要填 lab');
        }
        if (act.filter(o => idOf(o) === idOf(r)).length > 1) err('跟別列是同一個 item');
        if (!r.name) err('要填檔名');
        else if (/[\\/:*?"<>|]/.test(r.name)) err('檔名不能有 \\ / : * ? " < > |');
        const ik = iconKey(r);
        if (r.icon && ik !== r.name && keys.has(ik) && keys.get(ik) !== itemDir(r.P)) err(`textures/${join(keys.get(ik), ik)}.png 已經有了，換個檔名`);
        if (!r.png) continue;
        if (act.filter(o => o.png && o.name === r.name).length > 1) err('跟別列檔名重複');
        const g = splitNew(r.part.C);
        if (g) err(splitMismatch(g));
        const home = itemDir(r.P);
        for (const n of g ? [`${r.name}-front`, ...(g.cut ? [] : [`${r.name}-back`])] : [])
            if (keys.has(n) && keys.get(n) !== home) err(`textures/${join(keys.get(n), n)}.png 已經有了，換個檔名`);
        const users = Object.keys(items).filter(id => id !== r.id && splitBase(items[id].equip?.sprite) === r.name);
        const dir = keys.get(r.name), also = users.length ? `（${users.join('、')} 也用這張）` : '';
        if (r.name === old)
        {
            if (users.length) r.warn = `另外 ${users.join('、')} 也用這張圖`;
            continue;
        }
        if (old) r.warn = `sprite：${old} → ${r.name}`;
        if (dir === undefined) continue;
        if (dir !== home) err(`textures/${join(dir, r.name)}.png 已經有了，換個檔名`);
        else r.ask = `${home}/${r.name}.png${also}`;
    }
    return act;
}

function insertAfter(obj, after, id, val)
{
    const out = {};
    for (const [k, v] of Object.entries(obj))
    {
        out[k] = v;
        if (k === after) out[id] = val;
    }
    out[id] = val;
    return out;
}

// 武器多認 id＝圖層名（新武器還沒有 equip）
const itemMatch = (items, P, name) => Object.keys(items).find(id => items[id].cat === ITEM_CAT[P.key] && splitBase(items[id].equip?.sprite) === name)
    ?? (P.kind === 'weapon' && items[name]?.cat === ITEM_CAT[P.key] ? name : null);

function itemDialog(parts, items, keys)
{
    const dlg = $('dlgItems');
    // 新增的武器 id 沒有流水號，要自己填
    const rows = autoParts(parts[0].P.kind).map(P => {
        const part = parts.find(p => p.P === P), name = part?.C.name ?? '';
        return {P, part, on: !!part, id: itemMatch(items, P, name), name, png: true, place: true, icon: true, newId: ITEM_PRE[P.key] ? nextItemId(items, ITEM_PRE[P.key]) : '', lab: ''};
    });
    const reset = (r) => {
        r.name = (r.id && splitBase(items[r.id].equip?.sprite)) || r.part.C.name;
        r.png = r.place = r.icon = true;
    };
    // 選了 <部位>-<系>-<階> 的 id：沒手動選過、有零件的其他列帶到同系同階
    const follow = (r) => {
        const rest = r.id?.match(/^(helmet|armor|boots)-(.+)$/)?.[2];
        if (!rest) return;
        for (const o of rows)
        {
            const id = `${o.P.key}-${rest}`;
            if (o === r || o.manual || !o.part || items[id]?.cat !== ITEM_CAT[o.P.key]) continue;
            o.id = id;
            reset(o);
            sync(o);
        }
    };
    const refresh = () => {
        const act = itemCheck(rows, items, keys);
        for (const r of rows)
        {
            const k = r.P.key, live = r.on && !!r.part;
            for (const f of ['sel', 'name', 'png', 'place', 'icon', 'id', 'lab']) $(`di-${k}-${f}`).disabled = !live;
            if (live && !r.id) $(`di-${k}-png`).disabled = $(`di-${k}-place`).disabled = $(`di-${k}-icon`).disabled = true;
            if (live && r.id && !r.png) $(`di-${k}-name`).disabled = true;
            $(`di-${k}-new`).hidden = !!r.id;
            const msg = $(`di-${k}-msg`);
            msg.className = r.err ? 'err' : 'warn';
            msg.textContent = !live ? '' : r.err || [r.warn, r.ask && `會覆蓋 ${r.ask}`, r.dropF && '會移除女版（沒勾「女版」）'].filter(Boolean).join('；');
        }
        $('diOk').disabled = !act.length || act.some(r => r.err);
    };
    // 結構變了（換 item、切 PNG）才把 r 寫回輸入框，打字時不動
    const sync = (r) => {
        const k = r.P.key;
        $(`di-${k}-sel`).value = r.id ?? '';
        $(`di-${k}-name`).value = r.name;
        $(`di-${k}-png`).checked = r.png;
        $(`di-${k}-place`).checked = r.place;
        $(`di-${k}-icon`).checked = r.icon;
        $(`di-${k}-on`).checked = r.on;
    };
    $('diRows').replaceChildren(...rows.map(r => {
        const k = r.P.key, row = el('div', 'irow' + (r.part ? '' : ' off'));
        const inp = (f, type, lab, cls) => {
            const i = Object.assign(el('input', cls), {id: `di-${k}-${f}`, ...(type && {type})});
            const l = el('label');
            l.append(...(type === 'checkbox' ? [i, ` ${lab}`] : [`${lab} `, i]));
            return [l, i];
        };
        const thumb = el('canvas');
        thumb.width = thumb.height = 48;
        if (r.part)
        {
            const c = r.part.C.canvas, s = Math.min(48 / c.width, 48 / c.height);
            thumb.getContext('2d').drawImage(c, (48 - c.width * s) / 2, (48 - c.height * s) / 2, c.width * s, c.height * s);
        }
        const [onL, on] = inp('on', 'checkbox', r.P.name);
        on.disabled = !r.part;
        const sel = Object.assign(el('select'), {id: `di-${k}-sel`});
        sel.append(Object.assign(el('option'), {value: '', textContent: '＋新增'}),
                   ...Object.keys(items).filter(id => items[id].cat === ITEM_CAT[k])
                       .map(id => Object.assign(el('option'), {value: id, textContent: `${id} ${items[id].lab ?? ''}（${items[id].equip?.sprite ?? '沒有 sprite'}）`})));
        const [nameL, name] = inp('name', null, '檔名');
        const [pngL, png] = inp('png', 'checkbox', '更新圖');
        const [placeL, place] = inp('place', 'checkbox', '更新設定');
        const [iconL, icon] = inp('icon', 'checkbox', '更新ICON');
        const [idL, id] = inp('id', null, 'id');
        const [labL, lab] = inp('lab', null, 'lab');
        id.value = r.newId;
        const nw = Object.assign(el('div', 'line'), {id: `di-${k}-new`});
        nw.append(idL, labL);
        const msg = Object.assign(el('div'), {id: `di-${k}-msg`});
        const head = el('div', 'line'), line = el('div', 'line'), body = el('div', 'body');
        head.append(onL, sel);
        line.append(nameL, pngL, placeL, iconL);
        body.append(head, line, nw, msg);
        row.append(thumb, body);
        on.onchange = () => {r.on = on.checked; refresh();};
        sel.onchange = () => {r.id = sel.value || null; r.manual = true; reset(r); sync(r); follow(r); refresh();};
        name.oninput = () => {r.name = name.value.trim(); refresh();};
        png.onchange = () => {
            r.png = png.checked;
            if (!r.png) r.name = splitBase(items[r.id].equip?.sprite) ?? r.name;
            sync(r);
            refresh();
        };
        place.onchange = () => {r.place = place.checked; refresh();};
        icon.onchange = () => {r.icon = icon.checked; refresh();};
        id.oninput = () => {r.newId = id.value.trim(); refresh();};
        lab.oninput = () => {r.lab = lab.value.trim(); refresh();};
        return row;
    }));
    rows.forEach(sync);
    const fade = parts.some(p => p.C.opacity < 1);
    $('diBakeRow').hidden = !fade;
    $('diBake').checked = true;
    refresh();
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => {
        res(dlg.returnValue === 'ok' ? {rows, bake: fade && $('diBake').checked} : null);
    }, {once: true}));
}

// 每個零件照 itemMatch() 找 item，載入擺放（scale/x/y，武器多 a/ox/oy；沒寫的 key 是預設值，沒有 scale 就不動）；
// 整次一步模式內 undo、寫回全域預設，一個都沒對到（或都沒變）不記
async function loadItems()
{
    const m = S.mode;
    if (m.type !== 'auto' || !m.parts || !S.assets) return;
    const items = await readGameJson('item.json');
    const rows = [], hit = [], miss = [], warn = [];
    for (const part of m.parts)
    {
        const id = itemMatch(items, part.P, part.C.name), e0 = id && items[id].equip;
        if (!e0) {miss.push(part.C.name); continue;}
        const e = autoFemale(part.P) && e0.f ? {...e0, ...e0.f} : e0, cur = autoRow(part);
        hit.push(`${part.C.name} ← ${id}`);
        rows.push([part, {...cur, scale: e.scale ?? cur.scale, x: e.x ?? 0, y: e.y ?? 0,
                          ...(part.P.kind === 'weapon' && {a: e.a ?? 0, ox: e.ox ?? 0.5, oy: e.oy ?? 1})}]);
    }
    if (!hit.length) return status(`${miss.join('、')} 找不到對應的 item`);
    autoApplyAll(m, rows);
    status([`載入 ${hit.join('、')}`, miss.length && `${miss.join('、')} 找不到 item`, warn.length && `注意：${warn.join('、')}`].filter(Boolean).join('；'));
    refreshAll();
}

// rows = [[part, row]]：有變的才套，整次一步模式內 undo
function autoApplyAll(m, rows)
{
    const diff = rows.filter(([part, row]) => !autoSame(part.P, row, autoRow(part)));
    if (diff.length) autoStep(m);
    for (const [part, row] of diff) autoApply(m, part, row, false);
}

// 一定存男版：女模式下先照男版數字重擺（PNG 男女共用一張，不用重烤），存完復原；勾「女版」另寫 equip.f，沒勾就刪掉 equip.f
async function saveItems()
{
    const m = S.mode;
    if (m.type !== 'auto' || !m.parts || !S.assets) return;
    const back = autoMale(m);
    try
    {
        const d = await itemDialog(m.parts, await readGameJson('item.json'), await texKeys());
        if (d) await commitItems(d.rows, d.bake);
    }
    finally
    {
        if (back) {back(); refreshAll();}
    }
}

// 回傳復原用的函式；不用換（不是女模式）回 null
function autoMale(m)
{
    const parts = m.parts.filter(p => autoFemale(p.P));
    if (!parts.length) return null;
    const s = autoState(m);
    for (const p of parts) autoPlace(p, S.auto[p.P.key]);
    return () => History.restore(s);
}

const femaleOf = (P) => pickKeys(S.auto.f[P.key], AUTO_FF);

// 存檔時重讀 item.json、重掃 textures/ 再檢查一次（對話框開著時別的分頁可能改過）；all：換 sprite、共用圖（warn）也一起 confirm
async function commitItems(rows, bake, all = false)
{
    const A = S.assets, tag = (r) => r.tag ?? r.P.name;
    let items = await readGameJson('item.json');
    const keys = await texKeys(), act = itemCheck(rows, items, keys);
    const bad = act.filter(r => r.err);
    if (bad.length) return alert(`沒有存檔：\n${bad.map(r => `${tag(r)}：${r.err}`).join('\n')}`);
    const ask = act.filter(r => r.ask || all && r.warn || r.dropF)
        .map(r => `${tag(r)}：${[all ? r.warn : '', r.ask && (all ? `會覆蓋 ${r.ask}` : r.ask), r.dropF && '會移除女版'].filter(Boolean).join('；')}`);
    if (ask.length && !confirm(`${all || act.some(r => r.dropF) ? '請確認' : '會覆蓋'}：\n${ask.join('\n')}\n要繼續嗎？`)) return;
    const done = [], fresh = [];
    for (const r of act)
    {
        const {C} = r.part, g = splitNew(C), ik = iconKey(r);
        const put = async (dir, name, c) => {
            if (!keys.has(name)) fresh.push(name);
            await FS.writeFile(await mkDir(A.tex, dir), `${name}.png`, await PX.toPng(c));
        };
        if (r.png)
        {
            const dir = keys.get(r.name) ?? itemDir(r.P);
            await put(dir, r.name, splitPng(C, bake));
            if (g)
            {
                await put(dir, `${r.name}-front`, splitPng(g.F, bake));
                if (!g.cut) await put(dir, `${r.name}-back`, splitPng(g.B, bake));
            }
        }
        if (r.icon && ik !== r.name)
        {
            const src = iconSrc(C), c = iconOf(bake ? PX.fade(src, C.opacity) : src, ICON_AUTO);
            if (c) await put(itemDir(r.P), ik, c);
        }
        if (!r.id)
        {
            const equip = {sprite: g ? `${r.name}-front` : r.name};
            writeEquip(equip, C);
            if (g && !g.cut) equip.back = `${r.name}-back`;
            if (r.P.key === 'helmet') equip.hideHair = true;
            if (r.P.kind === 'armor' && S.auto.saveF) equip.f = femaleOf(r.P);
            const cat = ITEM_CAT[r.P.key], last = Object.keys(items).filter(id => items[id].cat === cat).at(-1);
            items = insertAfter(items, last, r.newId, {cat, icon: ik, lab: r.lab, equip, drop: {sprite: r.name, scale: equip.scale}});
            done.push(`新增 ${r.newId}`);
            continue;
        }
        const it = items[r.id], e = it.equip ??= {};
        if (r.png) setSplit(it, r.name, g, r.icon && ik);
        else if (r.icon) it.icon = ik;
        if (r.place) {writeEquip(e, C); dropScale(it);}
        if (r.P.kind === 'armor')
        {
            delete e.f;
            if (S.auto.saveF) e.f = femaleOf(r.P);
        }
        done.push(r.id);
    }
    await FS.writeFile(A.json, 'item.json', new Blob([JSON.stringify(items, null, 2)]));
    SH.notifySaved('item.json');
    status(`已存 item.json：${done.join('、')}${fresh.length ? `；新圖 ${fresh.join('、')} 要按上方「更新圖片清單」遊戲才載得到` : ''}`);
}

// ---------- 頭像存到 role.json ----------
// 可以選任何現有角色（不新增角色，沒有 head／hair 就新增那一項）：頭、頭髮寫 textures/roles/parts（head／hair 的 sprite、scale、x、y），
// 頭像另外合成寫 roles/portraits（icon）；檔名預設 head-<id>／hair-<id>／portrait-<id>，不照舊 sprite（常有好幾個角色共用一顆頭）
// 存過的角色記在零件的 auto.role，之後存／載入先看它

const ROLE_DIR = {head: 'roles/parts', hair: 'roles/parts', portrait: 'roles/portraits'};
const headBase = (parts) => parts[0].C.name.replace(/-(head|hair)$/, '');
// auto.role，再來 id＝原圖名，再看 head.sprite＝head-<原圖名>
function roleMatch(roles, parts)
{
    const rem = parts.find(p => p.C.auto?.role)?.C.auto.role, name = headBase(parts);
    if (roles[rem]) return rem;
    return (roles[name] ? name : Object.keys(roles).find(id => roles[id].head?.sprite === `head-${name}`)) ?? null;
}
const roleOld = (role, k) => k === 'portrait' ? role?.icon : role?.[k]?.sprite;
// body 不是 body-* 的（整張圖、sheet 格子）頭已經畫在身上，再疊 head 會兩顆頭
const roleBodyOdd = (role) => role?.body?.sprite && !role.body.sprite.startsWith('body-') ? role.body.sprite : null;

// 填 R.err、r.err（擋存檔）、r.warn（提示）、r.ask（覆蓋到圖，存檔時 confirm）；回傳要處理的列
function roleCheck(R, roles, keys)
{
    const act = R.rows.filter(r => r.on && (r.png || r.place));
    const role = roles[R.id];
    R.err = !R.id ? '要選角色' : !role ? `role.json 裡已經沒有 ${R.id}` : '';
    const odd = roleBodyOdd(role);
    R.warn = odd ? `body 是 ${odd}，不是紙娃娃身體（body-*），存了會疊兩顆頭` : '';
    for (const r of R.rows) Object.assign(r, {err: '', warn: '', ask: ''});
    if (!role) return act;
    for (const r of act)
    {
        const err = (s) => {r.err ||= s;};
        const old = roleOld(role, r.key), home = ROLE_DIR[r.key];
        if (!r.png && !old) err(`${R.id} 沒有 ${r.key}，要勾更新圖`);
        if (!r.png) continue;
        if (!r.name) err('要填檔名');
        else if (/[\\/:*?"<>|]/.test(r.name)) err('檔名不能有 \\ / : * ? " < > |');
        if (act.filter(o => o.png && o.name === r.name).length > 1) err('跟別列檔名重複');
        const dir = keys.get(r.name);
        if (dir !== undefined && dir !== home) err(`textures/${join(dir, r.name)}.png 已經有了，換個檔名`);
        if (r.name !== old && old) r.warn = `${r.key === 'portrait' ? 'icon' : 'sprite'}：${old} → ${r.name}`;
        const users = Object.keys(roles).filter(id => ['head', 'hair', 'portrait'].some(k => !(id === R.id && k === r.key) && roleOld(roles[id], k) === r.name));
        if (dir === home && (r.name !== old || users.length)) r.ask = `${home}/${r.name}.png${users.length ? `（${users.join('、')} 也用這張）` : ''}`;
    }
    return act;
}

function roleDialog(parts, roles, keys)
{
    const dlg = $('dlgRole'), pt = portraitOf(parts);
    const rows = [...autoParts('head').map(P => ({key: P.key, tag: P.name, part: parts.find(p => p.P === P)})), {key: 'portrait', tag: '頭像', part: null}];
    const R = {id: roleMatch(roles, parts), rows};
    const avail = (r) => r.key === 'portrait' || !!r.part;
    // 換角色：檔名回到 <部位>-<id>、勾勾全勾；角色沒有這個部位就一定要更新圖
    const reset = () => {
        for (const r of rows) Object.assign(r, {on: avail(r), name: R.id ? `${r.key}-${R.id}` : '', png: true, place: r.key !== 'portrait'});
    };
    const refresh = () => {
        const act = roleCheck(R, roles, keys);
        $('drMsg').className = R.err ? 'err' : 'warn';
        $('drMsg').textContent = R.err || R.warn;
        for (const r of rows)
        {
            const k = r.key, live = r.on && avail(r) && !!R.id, has = !!roleOld(roles[R.id], k);
            $(`dr-${k}-on`).disabled = !avail(r) || !R.id;
            $(`dr-${k}-name`).disabled = !live || !r.png;
            $(`dr-${k}-png`).disabled = !live || !has;
            if ($(`dr-${k}-place`)) $(`dr-${k}-place`).disabled = !live;
            const msg = $(`dr-${k}-msg`);
            msg.className = r.err ? 'err' : 'warn';
            msg.textContent = !live ? '' : r.err || [r.warn, r.ask && `會覆蓋 ${r.ask}`].filter(Boolean).join('；');
        }
        $('drOk').disabled = !!R.err || !act.length || act.some(r => r.err);
    };
    const sync = () => {
        $('drRole').value = R.id ?? '';
        for (const r of rows)
        {
            const k = r.key;
            $(`dr-${k}-on`).checked = r.on;
            $(`dr-${k}-name`).value = r.name;
            $(`dr-${k}-png`).checked = r.png;
            if ($(`dr-${k}-place`)) $(`dr-${k}-place`).checked = r.place;
        }
    };
    const sel = $('drRole');
    const opt = (id) => {
        const r = roles[id], head = r.head ? r.head.sprite ?? '沒有 sprite' : '沒有 head';
        return Object.assign(el('option'), {value: id, textContent: `${roleBodyOdd(r) ? '⚠ ' : ''}${id} ${r.lab ?? ''}（${head}）`});
    };
    const kindOf = (id) => KINDS.includes(roles[id].kind) ? roles[id].kind : '';
    const groups = [...KINDS, ''].map(k => {
        const ids = Object.keys(roles).filter(id => kindOf(id) === k);
        if (!ids.length) return null;
        const g = Object.assign(el('optgroup'), {label: KIND_NAMES[k] ?? '其他'});
        g.append(...ids.map(opt));
        return g;
    }).filter(Boolean);
    sel.replaceChildren(Object.assign(el('option'), {value: '', textContent: '（請選擇）'}), ...groups);
    sel.onchange = () => {R.id = sel.value || null; reset(); sync(); refresh();};
    $('drRows').replaceChildren(...rows.map(r => {
        const k = r.key, row = el('div', 'irow' + (avail(r) ? '' : ' off'));
        const inp = (f, type, lab) => {
            const i = Object.assign(el('input'), {id: `dr-${k}-${f}`, ...(type && {type})});
            const l = el('label');
            l.append(...(type === 'checkbox' ? [i, ` ${lab}`] : [`${lab} `, i]));
            return [l, i];
        };
        const thumb = el('canvas');
        thumb.width = thumb.height = 48;
        const c = r.part?.C.canvas ?? (k === 'portrait' ? pt : null);
        if (c) fitDraw(thumb, c, true);
        const [onL, on] = inp('on', 'checkbox', r.tag);
        const [nameL, name] = inp('name', null, '檔名');
        const [pngL, png] = inp('png', 'checkbox', k === 'portrait' ? '更新頭像' : '更新圖');
        const msg = Object.assign(el('div'), {id: `dr-${k}-msg`});
        const line = el('div', 'line'), body = el('div', 'body');
        line.append(onL, nameL, pngL);
        if (k !== 'portrait')
        {
            const [placeL, place] = inp('place', 'checkbox', '更新設定');
            line.append(placeL);
            place.onchange = () => {r.place = place.checked; refresh();};
        }
        body.append(line, msg);
        row.append(thumb, body);
        on.onchange = () => {r.on = on.checked; refresh();};
        name.oninput = () => {r.name = name.value.trim(); refresh();};
        png.onchange = () => {
            r.png = png.checked;
            r.name = r.png ? `${k}-${R.id}` : roleOld(roles[R.id], k) ?? r.name;
            sync();
            refresh();
        };
        return row;
    }));
    reset();
    sync();
    const fade = parts.some(p => p.C.opacity < 1);
    $('drBakeRow').hidden = !fade;
    $('drBake').checked = true;
    refresh();
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => {
        res(dlg.returnValue === 'ok' ? {R, bake: fade && $('drBake').checked} : null);
    }, {once: true}));
}

async function saveRole()
{
    const m = S.mode;
    if (m.type !== 'auto' || !m.parts || !S.assets) return;
    const d = await roleDialog(m.parts, await readGameJson('role.json'), await texKeys());
    if (d) await commitRole(m.parts, d.R, d.bake);
}

// 存檔時重讀 role.json、重掃 textures/ 再檢查一次
async function commitRole(parts, R, bake)
{
    const A = S.assets, roles = await readGameJson('role.json');
    const keys = await texKeys(), act = roleCheck(R, roles, keys);
    const bad = [R.err && `角色：${R.err}`, ...act.filter(r => r.err).map(r => `${r.tag}：${r.err}`)].filter(Boolean);
    if (bad.length) return alert(`沒有存檔：\n${bad.join('\n')}`);
    const ask = act.filter(r => r.ask).map(r => `${r.tag}：會覆蓋 ${r.ask}`);
    if (ask.length && !confirm(`會覆蓋：\n${ask.join('\n')}\n要繼續嗎？`)) return;
    const role = roles[R.id], done = [], fresh = [];
    const put = async (k, name, c) => {
        if (!keys.has(name)) fresh.push(name);
        await FS.writeFile(await mkDir(A.tex, ROLE_DIR[k]), `${name}.png`, await PX.toPng(c));
    };
    for (const r of act)
    {
        if (r.key === 'portrait')
        {
            const c = portraitOf(parts, S.auto.portrait, bake);
            if (!c) continue;
            await put(r.key, r.name, c);
            role.icon = r.name;
            done.push('icon');
            continue;
        }
        const {C} = r.part, o = role[r.key] ??= {};
        if (r.png)
        {
            await put(r.key, r.name, splitPng(C, bake));
            o.sprite = r.name;
        }
        if (r.place)
        {
            const s = placeOf(C);
            Object.assign(o, {scale: s.scale, x: s.x, y: s.y});
        }
        done.push(r.key);
    }
    await FS.writeFile(A.json, 'role.json', new Blob([JSON.stringify(roles, null, 2)]));
    SH.notifySaved('role.json');
    for (const p of parts) p.C.auto = {...p.C.auto, role: R.id};
    status(`已存 role.json：${R.id} 的 ${done.join('、')}${fresh.length ? `；新圖 ${fresh.join('、')} 要按上方「更新圖片清單」遊戲才載得到` : ''}`);
}

// 照 roleMatch() 找角色，把 head／hair 的 x/y 套回零件（存檔% 不動），角色沒有 hair 就只套頭
async function loadRole()
{
    const m = S.mode;
    if (m.type !== 'auto' || !m.parts || !S.assets) return;
    const roles = await readGameJson('role.json'), base = headBase(m.parts), id = roleMatch(roles, m.parts);
    if (!id) return status(`找不到 ${base} 對應的角色（存過的角色、id＝${base} 或 head.sprite＝head-${base}）`);
    const rows = [], hit = [], warn = [];
    for (const P of autoParts('head'))
    {
        const part = m.parts.find(p => p.P === P), e = roles[id][P.key];
        if (!part || !e) continue;
        hit.push(part.P.key);
        const cur = autoRow(part);
        rows.push([part, {...cur, scale: e.scale ?? cur.scale, x: e.x ?? 0, y: e.y ?? 0}]);
    }
    if (!hit.length) return status(`${id} 沒有 head／hair`);
    autoApplyAll(m, rows);
    status([`載入 ${id} 的 ${hit.join('、')}`, warn.length && `注意：${warn.join('、')}`].filter(Boolean).join('；'));
    refreshAll();
}

// ---------- 批次存武器 ----------
// 檔案樹多選 PNG 右鍵：不建圖層，每張照自動武器的步驟算、套全域預設的 scale/x/y/a/ox/oy，一次存進 item.json
// 每列只選 item（對不到預設不處理）；更新圖／ICON 整批一組、檔名固定是原圖名，更新設定每列各自勾（對到 item 的列才有）

const batchP = () => autoParts('weapon')[0];
const BT_W = 48;

// 假圖層：給 itemCheck／commitItems 跟自動零件一樣的欄位（src、ops、canvas、擺放、auto）
function batchPart(src, name, cls)
{
    const C = {name, src, ops: [], canvas: src, x: 0, y: 0, a: 0, ox: 0.5, oy: 1, scale: LAYER_SCALE, opacity: 1, auto: {key: batchP().key}};
    const {T, plan} = autoPlan(C, 'weapon');
    if (!plan.length) return null;
    const part = {...plan[0], C, T};
    autoScale(T, part, S.auto.weapon[cls].pct);
    autoPlace(part, S.auto.weapon[cls]);
    return part;
}

const clsOpts = (sel) => sel.replaceChildren(...WCLS.map(([value, lab]) => Object.assign(el('option'), {value, textContent: `${lab} ${value}`})));

// 成品照實際像素畫（太大才等比縮小），icon 縮進框裡
function fitDraw(cv, c, up = false)
{
    const g = cv.getContext('2d'), s = Math.min(up ? Infinity : 1, cv.width / c.width, cv.height / c.height);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(c, (cv.width - c.width * s) / 2, (cv.height - c.height * s) / 2, c.width * s, c.height * s);
}

function batchDialog(rows, items, keys)
{
    const dlg = $('dlgBatch'), G = {png: true, icon: true}, top = $('bt-place');
    // 新增強制三個都做；更新設定每列各自勾（上面那個是全選，有勾有不勾就半勾）；沒勾更新圖時檔名＝原本的 sprite（只重產 icon）
    const apply = (r) => {
        r.on = !!r.part && r.sel !== '-';
        r.id = r.on && r.sel || null;
        r.png = !r.id || G.png;
        r.place = !r.id || r.upd;
        r.icon = !r.id || G.icon;
        r.name = r.png ? r.file : splitBase(items[r.id].equip?.sprite) ?? r.file;
    };
    const refresh = () => {
        rows.forEach(apply);
        const act = itemCheck(rows, items, keys), ids = rows.filter(r => r.id), n = ids.filter(r => r.upd).length;
        Object.assign(top, {disabled: !ids.length, checked: !ids.length || n === ids.length, indeterminate: n > 0 && n < ids.length});
        for (const r of rows)
        {
            const e = r.el;
            e.row.classList.toggle('off', !r.on);
            e.updL.hidden = !r.id;
            e.upd.checked = r.upd;
            e.nw.hidden = !r.on || !!r.id;
            e.ic.classList.toggle('dim', !r.icon);
            e.msg.className = r.err || !r.part ? 'err' : 'warn';
            e.msg.textContent = !r.part ? '清除透明之後找不到武器' : !r.on ? '' : r.err || [r.warn, r.ask && `會覆蓋 ${r.ask}`].filter(Boolean).join('；');
        }
        $('btOk').disabled = !act.length || act.some(r => r.err);
    };
    const place = (r, scale) => {
        const w = S.auto.weapon[r.cls];
        if (scale)
        {
            autoScale(r.part.T, r.part, w.pct);
            fitDraw(r.el.pic, r.part.C.canvas);
        }
        autoPlace(r.part, w);
    };
    const opts = [['-', '不處理'], ['', '＋新增'],
                  ...Object.keys(items).filter(id => items[id].cat === ITEM_CAT[batchP().key])
                      .map(id => [id, `${id} ${items[id].lab ?? ''}（${items[id].equip?.sprite ?? '沒有 sprite'}）`])];
    $('btRows').replaceChildren(...rows.map(r => {
        const row = el('div', 'irow'), body = el('div', 'body');
        const pic = Object.assign(el('canvas', 'tall'), {width: BT_W, height: BT_W * 2});
        const ic = Object.assign(el('canvas'), {width: BT_W, height: BT_W});
        const sel = el('select'), cls = el('select');
        sel.append(...opts.map(([value, textContent]) => Object.assign(el('option'), {value, textContent})));
        sel.value = r.sel;
        sel.disabled = !r.part;
        clsOpts(cls);
        cls.value = r.cls;
        cls.disabled = !r.part;
        const box = (lab, type) => {
            const i = Object.assign(el('input'), type && {type}), l = el('label');
            l.append(...(type ? [i, ` ${lab}`] : [`${lab} `, i]));
            return [l, i];
        };
        const [updL, upd] = box('更新設定', 'checkbox');
        const [idL, id] = box('id'), [labL, lab] = box('lab');
        const head = el('div', 'line'), nw = el('div', 'line'), msg = el('div');
        head.append(Object.assign(el('span'), {textContent: r.tag}), cls, sel, updL);
        nw.append(idL, labL);
        body.append(head, nw, msg);
        row.append(pic, ic, body);
        r.el = {row, pic, ic, upd, updL, nw, msg};
        if (r.part)
        {
            fitDraw(pic, r.part.C.canvas);
            const c = iconOf(iconSrc(r.part.C), ICON_AUTO);
            if (c) fitDraw(ic, c, true);
        }
        cls.onchange = () => {r.cls = cls.value; place(r, true); refresh();};
        sel.onchange = () => {r.sel = sel.value; refresh();};
        upd.onchange = () => {r.upd = upd.checked; refresh();};
        id.oninput = () => {r.newId = id.value.trim(); refresh();};
        lab.oninput = () => {r.lab = lab.value.trim(); refresh();};
        return row;
    }));
    for (const f of ['png', 'icon'])
    {
        $(`bt-${f}`).checked = G[f];
        $(`bt-${f}`).onchange = () => {G[f] = $(`bt-${f}`).checked; refresh();};
    }
    top.onchange = () => {for (const r of rows) r.upd = top.checked; refresh();};
    // 數字跟自動面板共用全域預設，上面的分類選要改哪一組（預設第一列的分類），只重算同分類的列；
    // 存檔% 變了才重算成品（icon 用縮小前的圖，不用重算）
    let ecls = rows.find(r => r.part)?.cls ?? 'default';
    const nums = () => {for (const f of AUTO_F.weapon) $(`bt-${f}`).value = S.auto.weapon[ecls][f];};
    clsOpts($('bt-cls'));
    $('bt-cls').value = ecls;
    $('bt-cls').onchange = () => {ecls = $('bt-cls').value; nums();};
    nums();
    for (const f of AUTO_F.weapon)
    {
        const inp = $(`bt-${f}`);
        inp.onchange = () => {
            const v = +inp.value, old = S.auto.weapon[ecls][f];
            if (!Number.isFinite(v) || AUTO_LINK.includes(f) && !(v > 0) || v === old) return void (inp.value = old);
            autoSet({...S.auto, weapon: {...S.auto.weapon, [ecls]: {...S.auto.weapon[ecls], [f]: v}}});
            for (const r of rows.filter(r => r.part && r.cls === ecls)) place(r, f === 'pct');
            refresh();
        };
    }
    $('btTitle').textContent = `批次存武器到 item.json（${rows.length} 張）`;
    refresh();
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok'), {once: true}));
}

// fs：檔案樹列的 file（{fh, path}）
async function saveBatch(fs)
{
    if (!S.assets) return status('先在上方選擇專案資料夾（要有 public/assets/json/item.json）');
    const files = fs.filter(x => /\.png$/i.test(x.fh.name))
        .sort((a, b) => join(a.path, a.fh.name).localeCompare(join(b.path, b.fh.name)));
    if (!files.length) return status('沒有選到 PNG');
    const items = await readGameJson('item.json'), rows = [];
    for (const x of files)
    {
        const file = x.fh.name.replace(/\.png$/i, '');
        const cls = wclsOf(file), part = batchPart(PX.fromImage(await createImageBitmap(await x.fh.getFile())), file, cls);
        rows.push({P: batchP(), tag: join(x.path, x.fh.name), file, cls, part, sel: part && itemMatch(items, batchP(), file) || '-', upd: true, newId: '', lab: ''});
    }
    if (await batchDialog(rows, items, await texKeys())) await commitItems(rows, false, true);
}

// ---------- 專案 ----------
// 只記原圖路徑（相對工作資料夾）＋步驟清單，開啟時從原圖重播；undo 紀錄不存
// 圖層的 proj 只在開專案時設定，存專案只是把 💾 打勾的圖層寫出去，不改歸屬

function projectData(layers)
{
    return {
        version: 1,
        settings: {showOrigin: $('showOrigin').checked, ref: {...S.ref}, trimT: trimT(), auto: S.auto, doll: {...S.doll}},
        active: layers.indexOf(S.active),
        layers: layers.map(L => ({
            name: L.name, src: L.srcPath, srcW: L.src.width, srcH: L.src.height, path: L.path ?? '',
            ops: L.ops, x: L.x, y: L.y, a: L.a, ox: L.ox, oy: L.oy, scale: L.scale, visible: L.visible, opacity: L.opacity, locked: L.locked,
            ...(L.auto && {auto: L.auto}), ...(L.autoSrc && {autoSrc: L.autoSrc}), ...(L.splitSrc && {splitSrc: L.splitSrc}), ...(L.tag && {tag: L.tag}),
        })),
    };
}

const projectSig = () => JSON.stringify(projectData(S.layers));
const isUnsaved = () => S.projSig ? projectSig() !== S.projSig : S.layers.length > 0;
const projKey = (path, name) => join(path, name).toLowerCase();
const projects = () => [...new Set(S.layers.map(L => L.proj).filter(Boolean))];
const projLayers = (key) => S.layers.filter(L => L.proj && projKey(L.proj.path, L.proj.name) === key);

function updateTitle()
{
    const name = projects().map(p => p.name).join(' + ') || '（未命名）', mark = isUnsaved() ? ' *' : '';
    $('projName').textContent = name + mark;
    SH.setDirty(!!mark);
    document.title = `${name}${mark} — 紙娃娃編輯器`;
}

function applySettings(s)
{
    Object.assign(S.ref, s.ref);
    $('showOrigin').checked = s.showOrigin ?? true;
    for (const id of Object.keys(S.ref)) $(id).value = S.ref[id];
    if (s.trimT) $('trimT').value = s.trimT;
    if (s.doll) Object.assign(S.doll, s.doll);
    autoSet(s.auto ?? S.auto);
}

async function saveProject()
{
    if (!needRoot()) return;
    const layers = S.layers.filter(L => L.save);
    if (!layers.length) return status('沒有 💾 打勾的圖層');
    const loose = layers.filter(L => !L.srcPath);
    if (loose.length) return alert(`這些圖層是拖進來的，沒有原圖路徑，先「存檔…」存進工作資料夾：\n${loose.map(L => L.name).join('\n')}`);
    cancelMode();
    const ps = projects(), p = ps.length === 1 ? ps[0] : null;
    const differs = (path, name) => {
        const own = projLayers(projKey(path, name));
        return own.length !== layers.length || own.some(L => !L.save) ? '\n（💾 打勾的圖層跟原專案的圖層不同）' : '';
    };
    const target = await saveDialog(`存專案（${layers.length} 個圖層）`, p?.dir ?? S.root, p?.path ?? '', p?.name ?? 'project', PROJ_EXT, null, differs);
    if (!target) return;
    await FS.writeFile(target.dir, target.name + PROJ_EXT, new Blob([JSON.stringify(projectData(layers), null, 2) + '\n']));
    S.projSig = projectSig();
    updateTitle();
    status(`已存專案 ${join(target.path, target.name + PROJ_EXT)}`);
}

function askOpen(name)
{
    const dlg = $('dlgOpen');
    $('dlgOpenTitle').textContent = `開啟專案 ${name}`;
    dlg.returnValue = '';
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue), {once: true}));
}

async function openProject(fh, dir, path)
{
    const name = fh.name.slice(0, -PROJ_EXT.length);
    const how = S.layers.length ? await askOpen(join(path, fh.name)) : 'replace';
    if (how !== 'add' && how !== 'replace') return;
    const add = how === 'add';
    if (add && projLayers(projKey(path, name)).length) return status(`${name} 已經開著了`);
    if (!add && isUnsaved() && !confirm('目前有沒存的修改，要放棄嗎？')) return;
    const data = await readJson(await fh.getFile());
    if (!data?.layers) return;
    cancelMode();
    const wasClean = !isUnsaved(), proj = {dir, path, name};
    // 舊專案：世界座標是像素、全域 settings.scale 換算成遊戲單位；每層填當時的 scale，位置大小不變
    const s0 = data.settings?.scale ?? LAYER_SCALE;
    const layers = [], warns = [];
    for (const d of data.layers)
    {
        let src, srcDir;
        try
        {
            const r = await FS.resolveFile(S.root, d.src);
            srcDir = r.dir;
            src = PX.fromImage(await createImageBitmap(await r.file.getFile()));
        }
        catch {warns.push(`${d.name}：找不到原圖 ${d.src}，略過這層`); continue;}
        if (src.width !== d.srcW || src.height !== d.srcH)
            warns.push(`${d.name}：原圖尺寸變了（${d.srcW}×${d.srcH} → ${src.width}×${src.height}），結果可能不對`);
        const saveDir = await FS.resolveDir(S.root, d.path).catch(() => srcDir);
        const k = d.scale === undefined ? s0 : 1;
        layers.push({id: ++uid, name: d.name, dir: saveDir, path: d.path, srcPath: d.src, src, ops: d.ops,
                     canvas: PX.replay(src, d.ops), x: d.x * k, y: d.y * k, a: d.a, ox: d.ox, oy: d.oy, scale: d.scale ?? s0,
                     visible: d.visible, opacity: d.opacity, locked: d.locked, save: true, proj,
                     ...(d.auto && {auto: d.auto}), ...(d.autoSrc && {autoSrc: d.autoSrc}), ...(d.splitSrc && {splitSrc: d.splitSrc})});
        const had = add && S.layers.some(L => L.tag === d.tag) || layers.some(L => L.tag === d.tag);
        if (d.tag && had) warns.push(`${d.name}：人偶標記 ${dollBadge(d.tag)} 已經有別層了，拿掉這層的標記`);
        else if (d.tag) layers.at(-1).tag = d.tag;
    }
    const lossy = warns.length > 0;
    if (add)
    {
        hist.push(hist.snapList(S));
        S.layers = [...S.layers, ...layers];
        S.active = layers[data.active] ?? layers.at(-1) ?? S.active;
    }
    else
    {
        hist.undos.length = hist.redos.length = 0;
        applySettings(data.settings ?? {});
        S.layers = layers;
        S.active = layers[data.active] ?? layers.at(-1) ?? null;
    }
    S.projSig = (!add || wasClean) && !lossy ? projectSig() : null;
    refreshAll();
    if (!add) fitView();
    status(`${add ? '加入' : '開啟'}專案 ${join(path, fh.name)}`);
    if (warns.length) alert(warns.join('\n'));
}

// 合成圖的 scale 取最小的那層（像素最密），那層照原尺寸畫、不失真
function flatten(layers, bake)
{
    const k = Math.min(...layers.map(L => L.scale));
    const pts = layers.flatMap(corners);
    const xs = pts.map(p => p.x / k), ys = pts.map(p => p.y / k);
    const minX = Math.floor(Math.min(...xs)), minY = Math.floor(Math.min(...ys));
    const big = PX.newCanvas(Math.ceil(Math.max(...xs)) - minX, Math.ceil(Math.max(...ys)) - minY);
    const bg = big.getContext('2d');
    bg.imageSmoothingQuality = 'high';
    for (const L of layers)
    {
        bg.setTransform(1, 0, 0, 1, -minX, -minY);
        bg.translate(L.x / k, L.y / k);
        bg.rotate(L.a * RAD);
        bg.scale(L.scale / k, L.scale / k);
        bg.globalAlpha = bake ? L.opacity : 1;
        bg.drawImage(L.canvas, -L.ox * L.canvas.width, -L.oy * L.canvas.height);
    }
    return {big, minX: minX * k, minY: minY * k, k};
}


// ---------- 綁定 ----------

$('btnRefresh').onclick = () => {thumbs.clear(); buildTree($('tree'), treeOpt);};
$('btnSaveProj').onclick = () => saveProject().catch(e => status(e.message));
$('btnClose').onclick = closeAll;
$('dollM').onclick = () => setDoll({sex: 'm'});
$('dollF').onclick = () => setDoll({sex: 'f'});
$('dollHair').onchange = () => setDoll({hair: $('dollHair').checked});
$('btnDup').onclick = duplicateLayer;
$('btnMergeDown').onclick = mergeDown;
$('btnMergeVisible').onclick = mergeVisible;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
$('btnFit').onclick = fitView;
$('btnSave').onclick = () => saveLayer().catch(e => status(e.message));
$('btnTrim').onclick = () => {
    const L = S.active;
    if (!L || L.locked) return status('先選一個沒鎖定的圖層');
    cancelMode();
    if (!trimLayer(L)) status('四周沒有透明邊可以裁');
    refreshAll();
};

document.querySelectorAll('[data-mode]').forEach(b => {b.onclick = () => setMode(b.dataset.mode);});
document.querySelectorAll('.mode .ok').forEach(b => {b.onclick = applyMode;});
document.querySelectorAll('.mode .cancel').forEach(b => {b.onclick = cancelMode;});

for (const id of Object.keys(S.ref)) $(id).oninput = () => {S.ref[id] = +$(id).value || 0; dirty();};

const onProp = (id, fn) => {
    $(id).onchange = () => {
        const L = S.active, v = +$(id).value;
        if (!L || !Number.isFinite(v)) return refreshProps();
        const G = linked(L);
        hist.push({group: G.map(M => hist.snap(M))});
        for (const M of G) fn(M, v);
        refreshAll();
    };
};
onProp('pX', (L, v) => {L.x = v;});
onProp('pY', (L, v) => {L.y = v;});
onProp('pS', (L, v) => {if (v > 0) L.scale = v;});
onProp('pA', (L, v) => {L.a = v;});
onProp('pOx', (L, v) => setOrigin(L, v, L.oy));
onProp('pOy', (L, v) => setOrigin(L, L.ox, v));
$('pOp').oninput = () => {if (S.active) {S.active.opacity = $('pOp').value / 100; dirty();}};

const scaleInput = (id, fn) => {
    $(id).oninput = () => {
        const m = S.mode, v = +$(id).value;
        if (m.type !== 'scale' || !(v > 0)) return;
        fn(m, v);
        if (m.lock) m.sy = m.sx;
        refreshModePanel();
        dirty();
    };
};
scaleInput('scPct', (m, v) => {m.sx = m.sy = v / 100 / m.k;});
scaleInput('scW', (m, v) => {m.sx = v / m.layer.canvas.width;});
scaleInput('scH', (m, v) => {m.sy = v / m.layer.canvas.height; if (m.lock) m.sx = m.sy;});
$('scLock').onchange = () => {
    const m = S.mode;
    if (m.type !== 'scale') return;
    m.lock = $('scLock').checked;
    if (m.lock) m.sy = m.sx;
    refreshModePanel();
    dirty();
};
const warpButton = (fn) => () => {
    const m = S.mode;
    if (m.type !== 'warp' || !warpCur(m)) return;
    fn(m, warpCur(m));
    refreshAll();
};
const warpRegrid = warpButton((m, f) => {
    warpRecord(m);
    Object.assign(f, {cols: wpN('wpCols'), rows: wpN('wpRows'), sel: new Set(), edited: false});
    f.pts = warpGridOf(f);
    m.changed = m.stale = true;
});
$('wpCols').onchange = warpRegrid;
$('wpRows').onchange = warpRegrid;
$('wpReset').onclick = warpRegrid;
$('wpDelete').onclick = warpButton(warpDeleteFrame);
window.addEventListener('beforeunload', e => {if (['warp', 'pixel', 'split'].includes(S.mode.type) && S.mode.changed) e.preventDefault();});
// 拖滑桿的一整段只記一步
S.sp = spLoad();
$('sp-lum').oninput = () => {
    S.sp.lum = {...S.sp.lum, [S.sp.method]: +$('sp-lum').value};
    $('sp-lum-v').textContent = $('sp-lum').value;
    spChange({c: spCrit()}, true);
};
$('sp-lum').onchange = () => {
    spSet();
    S.mode.tRec = false;
};
spSet();
for (const k of ['down', 'right']) $(`sp-${k}`).onchange = () => {
    S.sp[k] = $(`sp-${k}`).checked;
    spSet();
    spChange({[k]: S.sp[k]});
};
for (const [k, max] of [['close', 30], ['drop', 50], ['reach', 50]]) $(`sp-${k}`).onchange = () => {
    S.sp[k] = Math.max(0, Math.min(max, Math.round(+$(`sp-${k}`).value) || 0));
    spSet();
    spChange({[k]: S.sp[k]});
};
document.querySelectorAll('[name=spMethod]').forEach(r => {r.onchange = () => {
    S.sp.method = r.value;
    spSet();
    spChange({method: S.sp.method, c: spCrit()});
};});
document.querySelectorAll('[name=spHow]').forEach(r => {r.onchange = () => {
    const p = spPreset(r.value === 'cut');
    Object.assign(S.sp, p);
    spSet();
    spChange({...p, c: spCrit()});
};});
for (const b of document.querySelectorAll('.spStep'))
{
    let t = null;
    const go = (ms) => {spStep(+b.dataset.d); t = setTimeout(() => go(60), ms);};
    b.onpointerdown = (e) => {if (e.button === 0 && t == null) go(400);};
    b.onpointerup = b.onpointerleave = b.onpointercancel = () => {
        if (t == null) return;
        clearTimeout(t);
        t = null;
        spSet();
        S.mode.tRec = false;
    };
}
cv.addEventListener('pointerleave', () => spSwatch());
$('spPaint').onchange = () => {$('spPaint').blur(); spPaintSet(spPaintOn()); refreshModePanel(); dirty();};
$('spSize').oninput = dirty;
$('spMarkClear').onclick = spMarkClear;
$('spRevoke').onclick = splitRevoke;
$('pxClear').onclick = pixelClear;
$('pxRgb').oninput = () => {$('colRgb').value = $('pxRgb').value; dirty();};
for (const id of ['pxPen', 'pxErase', 'pxSize']) $(id).oninput = dirty;
$('showOrigin').onchange = dirty;
document.querySelectorAll('[name=cropMode]').forEach(r => {r.onchange = dirty;});
document.querySelectorAll('[name=cropShape]').forEach(r => {r.onchange = () => {
    if (S.mode.type === 'crop') S.mode.rect = S.mode.poly = null;
    refreshModePanel();
    dirty();
};});

$('alT').oninput = () => {
    $('alV').textContent = $('alT').value;
    if (S.mode.type === 'alpha') {S.mode.t = +$('alT').value; updateAlpha();}
};

const colorChanged = () => {
    $('colTV').textContent = $('colT').value;
    $('pxRgb').value = $('colRgb').value;
    if (S.mode.type !== 'color') return;
    refreshModePanel();
    updateColor();
};
for (const id of ['colFill', 'colKey', 'colRgb', 'colA', 'colT']) $(id).oninput = colorChanged;

const removeGreenChanged = () => {
    if (S.mode.type !== 'removeGreen') return;
    refreshModePanel();
    updateRemoveGreen();
};
for (const id of ['rgH1', 'rgH2', 'rgS1', 'rgS2', 'rgV1', 'rgV2', 'rgRgbThr']) $(id).oninput = removeGreenChanged;

const dimSpans = (ts) => ts.map(t => Object.assign(el('span', 'dim'), {textContent: t}));
$('auTable').append(Object.assign(el('span', 'sexL'), {id: 'auSexL', title: '照 header 的 男｜女 切換'}), ...dimSpans(['象限', '存檔%', 'scale', 'x', 'y']));
$('auWeapon').append(...dimSpans(['', '存檔%', 'scale', 'x', 'y', 'a', 'ox', 'oy']));
$('auHead').append(...dimSpans(['', '存檔%', 'scale', '', 'x', 'y']));
const AUTO_BOX = {armor: 'auTable', weapon: 'auWeapon', head: 'auHead'};
const AUTO_LINK = ['pct', 'scale'];
const linkBox = Object.assign(el('label'), {title: '跟頭連動：頭髮的存檔%、scale 跟頭一樣，只能改頭那格'});
linkBox.append(Object.assign(el('input'), {type: 'checkbox', id: 'au-link'}), '🔗');
for (const P of AUTO_PARTS)
{
    const box = $(AUTO_BOX[P.kind]);
    box.append(Object.assign(el('span'), {textContent: P.name}), ...dimSpans(P.quad ? [P.quad] : []));
    for (const f of AUTO_F[P.kind])
    {
        const inp = Object.assign(el('input'), {type: 'number', id: `au-${P.key}-${f}`, step: f === 'pct' ? 1 : f === 'scale' ? 0.01 : 'any'});
        // 連動時改頭的存檔%／scale，頭髮設成一樣的值
        inp.onchange = () => {
            const v = +inp.value, m = S.mode, ok = Number.isFinite(v) && (!AUTO_LINK.includes(f) || v > 0);
            const peers = P.key === 'head' && AUTO_LINK.includes(f) && S.auto.headLink ? autoParts('head') : [P];
            const parts = peers.map(Q => m.parts?.find(p => p.P === Q)).filter(Boolean);
            if (ok && parts.length) autoApplyAll(m, parts.map(part => [part, {...autoRow(part), [f]: v}]));
            else autoSet(ok ? peers.reduce((a, Q) => autoWith(a, Q, {...autoCfg(Q, a), [f]: v}), S.auto) : S.auto);
            refreshAll();
        };
        box.append(inp);
        if (P.kind === 'head' && f === 'scale') box.append(P.key === 'hair' ? linkBox : el('span'));
    }
}
// 打開連動：頭髮對齊頭的存檔%、scale，拆過就記一步（連開關一起退）；有修補不清除就不打開
$('au-link').onchange = () => {
    const on = $('au-link').checked, m = S.mode, [H, R] = autoParts('head');
    const head = m.parts?.find(p => p.P === H), hair = m.parts?.find(p => p.P === R);
    if (!on || !head || !hair) autoSet({...S.auto, headLink: on, ...(on && {hair: {...S.auto.hair, ...pickKeys(S.auto.head, AUTO_LINK)}})});
    else
    {
        const same = () => AUTO_LINK.every(f => autoRow(hair)[f] === autoRow(head)[f]);
        if (!same())
        {
            autoStep(m);
            autoApply(m, hair, {...autoRow(hair), ...pickKeys(autoRow(head), AUTO_LINK)}, false);
            if (!same()) m.hist.pop();
        }
        autoSet({...S.auto, headLink: same()});
    }
    refreshAll();
};
for (const f of PT_F)
{
    $(`au-pt-${f}`).onchange = () => {
        const v = Math.round(+$(`au-pt-${f}`).value);
        if (Number.isFinite(v) && v >= 1 && (f !== 'fill' || v <= 400)) autoSet({...S.auto, portrait: {...S.auto.portrait, [f]: v}});
        else autoSet(S.auto);
        refreshAll();
    };
}
clsOpts($('auCls'));
autoSet(autoLoad());
// 換分類：拆過就把那組數字套到武器上（記一步），沒拆只換顯示的數字
$('auCls').onchange = () => {
    const m = S.mode, part = autoWeapon(m), cls = $('auCls').value;
    if (part) autoStep(m);
    autoSet({...S.auto, cls});
    if (part)
    {
        part.C.auto = {...part.C.auto, cls};
        autoApply(m, part, autoCfg(part.P), false);
    }
    refreshAll();
};
// 武器只還原目前分類，護具只還原護具目前性別那組（連頭盔拆法；女版的存檔% 跟男版共用，不動），頭像只還原頭像（連尺寸/%）
$('auReset').onclick = () => {
    const m = S.mode, kind = S.auto.kind, weapon = kind === 'weapon';
    const def = (P) => weapon ? wclsDef(S.auto.cls) : autoFemale(P) ? {...AUTO_DEF[P.key], pct: S.auto[P.key].pct} : AUTO_DEF[P.key];
    for (const part of m.parts ?? []) autoApply(m, part, def(part.P));
    autoSet(weapon ? autoWith(S.auto, batchP(), def(batchP()))
                   : {...autoParts(kind).reduce((a, P) => autoWith(a, P, def(P)), S.auto),
                      ...(kind === 'head' ? {portrait: AUTO_PORTRAIT, headLink: true} : {split: undefined})});
    autoSpSync(m);
    refreshAll();
};
// 還沒拆才能切：照新的種類重算零件範圍
document.querySelectorAll('[name=auKind]').forEach(r => {r.onchange = () => {
    autoSet({...S.auto, kind: r.value});
    const m = S.mode;
    if (m.type === 'auto' && !m.parts) S.mode = autoEnter(m.layer) ?? {type: 'move'};
    refreshAll();
};});
document.querySelectorAll('[name=auHow]').forEach(r => {r.onchange = () => {
    autoSet({...S.auto, split: r.value});
    autoSpSync(S.mode);
    refreshAll();
};});
$('auCancel').onclick = autoRevoke;
$('auLeave').onclick = cancelMode;
$('auFemale').onchange = () => autoSet({...S.auto, saveF: $('auFemale').checked});
$('auItem').onclick =() => (S.mode.kind === 'head' ? saveRole() : saveItems()).catch(e => status(e.message));
$('auLoad').onclick = () => (S.mode.kind === 'head' ? loadRole() : loadItems()).catch(e => status(e.message));

S.icon = iconLoad();
for (const [id, f, ok] of [['icSize', 'size', v => v >= 1], ['icA', 'a', () => true], ['icFill', 'fill', v => v > 0 && v <= 100]])
{
    $(id).value = S.icon[f];
    $(id).onchange = () => {
        const v = f === 'a' ? +$(id).value : Math.round(+$(id).value);
        if (Number.isFinite(v) && ok(v)) iconSet({...S.icon, [f]: v});
        $(id).value = S.icon[f];
        refreshModePanel();
    };
}
$('icSave').onclick = () => saveIcon().catch(e => status(e.message));

$('stage').addEventListener('dragover', e => e.preventDefault());
$('stage').addEventListener('drop', async e => {
    e.preventDefault();
    for (const f of [...e.dataTransfer.files].filter(f => /\.png$/i.test(f.name)))
        addLayer(await createImageBitmap(f), f.name.replace(/\.png$/i, ''), null, null);
});

new ResizeObserver(dirty).observe(cv);

// 側欄分隔線：拖曳改寬、雙擊回預設，寬度記在 localStorage
function splitter(bar, panel, key, def, sign)
{
    const set = (w) => {panel.style.width = `${Math.min(600, Math.max(150, w))}px`;};
    try {set(Number(localStorage.getItem(key)) || def);}
    catch {set(def);}
    const keep = () => {
        try {localStorage.setItem(key, panel.offsetWidth);}
        catch {}
    };
    bar.onpointerdown = (e) => {
        const x0 = e.clientX, w0 = panel.offsetWidth;
        bar.setPointerCapture(e.pointerId);
        bar.onpointermove = (e) => set(w0 + sign * (e.clientX - x0));
        bar.onpointerup = () => {bar.onpointermove = bar.onpointerup = null; keep();};
    };
    bar.ondblclick = () => {set(def); keep();};
}
splitter($('splitL'), $('left'), 'paperdoll.leftW', 230, 1);
splitter($('splitR'), $('right'), 'paperdoll.rightW', 290, -1);

(async () => {
    S.view.px = cv.clientWidth / 2;
    S.view.py = cv.clientHeight / 2;
    refreshAll();
    SH.onProject(async (dir) => {
        await setAssets(dir).catch(e => status(e.message));
        const img = await FS.tryDir(dir, 'images');
        if (img) setRoot(img);
        else status(`「${dir.name}」裡沒有 images/（紙娃娃的工作資料夾）`);
    });
})();

// 給無頭測試用
window.__pd = {S, hist, addLayer, select, setMode, applyMode, cancelMode, trimLayer, setOrigin, placeOf, undo, redo, toWorld, toLocal,
               setRoot, loadHandle, saveProject, openProject, isUnsaved, saveLayer, mergeDown, mergeVisible, removeLayer, duplicateLayer, pickColor,
               warpAddFrame, autoSet, autoFrom, autoRevoke, setAssets, saveItems, loadItems, refreshThumbs, splitRevoke, splitGroup, splitRun, imagesChanged,
               deleteFile, renameFile, moveFiles, spStep, saveIcon, saveBatch, saveRole, loadRole, closeAll, setTag, setDoll, projectData};
