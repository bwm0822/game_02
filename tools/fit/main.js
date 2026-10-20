// 試穿：選紙娃娃型角色、五格各挑一件裝備（只是試穿，不寫回 inv.equips），用數字調 body/head/hand 跟裝備 equip 的擺放（含武器 aim/swing）
// 同時編 role.json、item.json：undo 兩份一起記，存檔各自比對外部修改、三方合併；武器姿勢跟遊戲共用 src/core/pose.js
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import {$, h, ask, status} from '../common/dom.js';
import {str, isObj, getAt, setAt, parseNum, merge3} from '../common/obj.js';
import * as IC from '../common/icons.js';
import {DEPTH, KINDS, KIND_NAMES} from '../role/schema.js';
import {AIM, dirTo, aimPose, gripAt, swingPose} from '../../src/core/pose.js';

const FILES = ['role.json', 'item.json'];
const PARTS = [['body', '身體'], ['head', '頭'], ['hand', '手']];
const SLOTS = [['CAT_HELMET', '頭盔'], ['CAT_CHESTPLATE', '護甲'], ['CAT_GLOVES', '手套'], ['CAT_BOOTS', '靴子'], ['CAT_WEAPON', '武器']];
const NUMS = [['scale', '1'], ['x', '0'], ['y', '0'], ['a', '0'], ['ox', '0.5'], ['oy', '1']];
const WEAPON = [[['aim'], '瞄準 aim'], [['swing', 'aim'], '揮砍 aim'], [['swing', 'grip', 'x'], '握把 x'], [['swing', 'grip', 'y'], '握把 y']];
const ZOOMS = [1, 2, 3, 4, 6, 'game'];
const FRAME_COLOR = {b: '#ff5555', g: '#55dd55', z: '#5599ff'};
// 遊戲裡的串法見 com_action.js：raise→strike→收回、sweepRaise→sweep→收回、aim→收回（中間的 lunge 不演）
const POSES = {
    aim: {label: '瞄準', steps: [true, false]},
    chop: {label: '下劈', steps: ['raise', 'strike', null]},
    sweep: {label: '橫掃', steps: ['sweepRaise', 'sweep', null]},
};
const EASE = {'quad.out': t => t * (2 - t), 'cubic.in': t => t * t * t};

const S = {
    json: null,                 // public/assets/json
    doc: Object.fromEntries(FILES.map(f => [f, {data: {}, saved: {}, diskText: null}])),
    hist: [], hi: -1,
    rid: null,
    slots: {},                  // cat → item id
    zoom: 3, view: true, anchor: true, b: true, g: false, z: false, flip: false,
    pose: '', t: 0, target: 0,  // target：目標方向（度，0＝右、90＝下）
};

const roles = () => S.doc['role.json'].data;
const items = () => S.doc['item.json'].data;
const role = () => roles()[S.rid];
const isDoll = (r) => isObj(r.head) || isObj(r.hand);
const dirtyOf = (f) => str(S.doc[f].data) !== str(S.doc[f].saved);
const isDirty = () => FILES.some(dirtyOf);
const weapon = () => items()[S.slots.CAT_WEAPON]?.equip;

// ---------- 歷史 ----------
const snap = () => FILES.map(f => str(S.doc[f].data));

function resetHist()
{
    S.hist = [snap()];
    S.hi = 0;
}

function commit(fn)
{
    const prev = str(snap());
    fn();
    const now = snap();
    if (str(now) !== prev)
    {
        S.hist.length = S.hi + 1;
        S.hist.push(now);
        if (S.hist.length > 300) S.hist.shift();
        S.hi = S.hist.length - 1;
    }
    render();
}

function restore(i)
{
    S.hi = i;
    FILES.forEach((f, k) => {S.doc[f].data = JSON.parse(S.hist[i][k]);});
    render();
}
const undo = () => S.hi > 0 && restore(S.hi - 1);
const redo = () => S.hi < S.hist.length - 1 && restore(S.hi + 1);

// ---------- 讀寫 ----------
// 殼給專案根目錄；無頭測試可以直接給 public/assets
async function setRoot(dir)
{
    let json = await FS.tryDir(dir, 'json');
    if (!json) json = await FS.tryDir(await FS.tryDir(await FS.tryDir(dir, 'public') ?? dir, 'assets'), 'json');
    if (!json || !await FS.tryFile(json, 'role.json') || !await FS.tryFile(json, 'item.json'))
        throw new Error(`「${dir.name}」裡沒有 public/assets/json/role.json、item.json`);
    S.json = json;
    for (const f of FILES) await load(f);
    resetHist();
    if (!role() || !isDoll(role())) select(Object.keys(roles()).find(id => isDoll(roles()[id])) ?? null);
    else render();
    status('');
}

async function load(file)
{
    const text = await FS.readText(S.json, file);
    Object.assign(S.doc[file], {diskText: text, saved: JSON.parse(text), data: JSON.parse(text)});
}

async function reload()
{
    if (isDirty() && await ask('重新讀取', '還沒存檔的修改會不見', [['ok', '重新讀取'], ['cancel', '取消']]) !== 'ok') return;
    for (const f of FILES) await load(f);
    resetHist();
    select(S.rid);
}

async function save()
{
    if (!S.json) return status('先在上方選擇專案資料夾');
    const done = [];
    for (const file of FILES)
    {
        const d = S.doc[file];
        if (!dirtyOf(file)) continue;
        const disk = await FS.readText(S.json, file);
        if (disk !== d.diskText)
        {
            const m = merge3(JSON.parse(d.diskText), d.data, JSON.parse(disk));
            const r = await ask(`${file} 在讀進來之後被改過了`, [
                m.external.length && h('div', null, `外部改了：${m.external.join('、')}`),
                m.conflict.length && h('div', {class: 'warn'}, `兩邊都改了（合併時以這裡的為準）：${m.conflict.join('、')}`),
            ], [['merge', '合併後存檔'], ['overwrite', '直接覆蓋'], ['cancel', '取消']]);
            if (r !== 'merge' && r !== 'overwrite') {status('取消存檔'); render(); return;}
            if (r === 'merge') commit(() => {d.data = m.data;});
        }
        const text = JSON.stringify(d.data, null, 2);
        await FS.writeFile(S.json, file, new Blob([text]));
        d.diskText = text;
        d.saved = JSON.parse(text);
        SH.notifySaved(file);
        done.push(file);
    }
    status(done.length ? `已存 ${done.join('、')}　${new Date().toLocaleTimeString()}` : '沒有修改');
    render();
}

// 別的分頁存了檔：沒改過就重讀（undo 紀錄從現在重算），改過就只提示（存檔時會合併）
async function onSaved(file)
{
    if (file === 'textures.json') return drawPreview();
    if (!FILES.includes(file) || !S.json) return;
    if (dirtyOf(file)) return status(`${file} 在別的分頁存過了，存檔時會合併`);
    await load(file);
    resetHist();
    select(S.rid);
    status(`${file} 在別的分頁存過了，已重讀`);
}

// ---------- 選角色、換裝 ----------
function select(rid)
{
    S.rid = rid;
    S.slots = {};
    for (const e of role()?.inv?.equips ?? [])
    {
        const id = isObj(e) ? e.id : e, it = items()[id];
        if (it?.equip && SLOTS.some(([c]) => c === it.cat)) S.slots[it.cat] = id;
    }
    render();
}

function setSlot(cat, id)
{
    if (id) S.slots[cat] = id;
    else delete S.slots[cat];
    render();
}

// ---------- 畫面 ----------
function render()
{
    const focus = document.activeElement?.dataset?.k;
    drawList();
    drawView();
    drawPv();
    $('btnUndo').disabled = S.hi <= 0;
    $('btnRedo').disabled = S.hi >= S.hist.length - 1;
    $('btnSave').disabled = $('btnReload').disabled = !S.json;
    $('dirty').hidden = !isDirty();
    SH.setDirty(isDirty());
    if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
}

function drawList()
{
    const ids = Object.keys(roles()).filter(id => isDoll(roles()[id]));
    const saved = S.doc['role.json'].saved;
    const groups = [...KINDS, ''].map(k => [k, ids.filter(id => (roles()[id].kind ?? '') === k)]).filter(([, g]) => g.length);
    $('list').replaceChildren(...groups.map(([k, g]) => [
        h('div', {class: 'group'}, KIND_NAMES[k] ?? '無分類'),
        g.map(id => h('div', {class: 'item' + (id === S.rid ? ' sel' : ''), onclick: () => select(id)},
            IC.iconEl(roles()[id].icon, 24),
            h('span', {class: 'id'}, id),
            h('span', {class: 'lab'}, roles()[id].lab ?? ''),
            str(roles()[id]) !== str(saved[id]) && h('span', {class: 'mark dirty'}, '●'))),
    ]).flat(Infinity));
}

// file 裡 id 那筆的 path；空字串＝刪 key（遊戲用預設值）
function numInput(file, id, path, ph)
{
    const k = `${file}|${id}|${path.join('.')}`, v = getAt(S.doc[file].data[id], path);
    return h('input', {type: 'number', step: 'any', class: 'num', value: v ?? '', placeholder: ph, dataset: {k},
        onchange: (e) => {
            const n = parseNum(e.target.value);
            if (typeof n === 'string') {status(`${path.join('.')} 要是數字`); return render();}
            commit(() => setAt(S.doc[file].data[id], path, n));
        }});
}

const numCells = (file, id, base) => NUMS.map(([k, ph]) => h('td', null, numInput(file, id, [...base, k], ph)));
const head = (first) => h('tr', null, h('th', null, first), h('th', null, '圖／道具'), NUMS.map(([k]) => h('th', null, k)));

function drawView()
{
    const r = role();
    if (!r) return $('view').replaceChildren(h('div', {class: 'dim'}, S.json ? '沒有紙娃娃型角色（要有 head 或 hand）' : '先在上方選擇專案資料夾'));
    const partRows = PARTS.filter(([k]) => isObj(r[k])).map(([k, name]) => h('tr', null,
        h('td', {class: 'k'}, name), h('td', null, h('span', {class: 'sprite'}, r[k].sprite ?? '')), numCells('role.json', S.rid, [k])));
    const slotRows = SLOTS.map(([cat, name]) => {
        const id = S.slots[cat];
        const opts = Object.keys(items()).filter(i => items()[i].cat === cat && isObj(items()[i].equip));
        const sel = h('select', {onchange: (e) => setSlot(cat, e.target.value)},
            h('option', {value: ''}, '（空）'),
            opts.map(i => h('option', {value: i, selected: i === id}, `${i}　${items()[i].lab ?? ''}`)));
        return h('tr', null, h('td', {class: 'k'}, name), h('td', null, sel),
            id ? numCells('item.json', id, ['equip']) : NUMS.map(() => h('td')));
    });
    const wid = S.slots.CAT_WEAPON;
    $('view').replaceChildren(h('div', null,
        h('div', {class: 'head'}, IC.iconEl(r.icon, 48), h('span', {class: 'bigid'}, S.rid), h('span', {class: 'dim'}, r.lab ?? '')),
        h('div', {class: 'title'}, '角色部件（role.json）'),
        h('table', {class: 'fit'}, head('部件'), partRows),
        h('div', {class: 'title'}, '裝備（item.json，全角色共用；換裝只是試穿，不會寫回角色）'),
        h('table', {class: 'fit'}, head('格子'), slotRows),
        wid && [
            h('div', {class: 'title'}, `武器動畫（${wid}）`),
            h('div', {class: 'hint'}, '瞄準 aim：圖片原生朝向（度），有它才會瞄準；揮砍要 aim 跟握把 x/y 都填，握把是圖格內像素座標（左上為原點）'),
            h('table', {class: 'fit'}, h('tr', null, WEAPON.map(([, l]) => h('th', null, l))),
                h('tr', null, WEAPON.map(([p]) => h('td', null, numInput('item.json', wid, ['equip', ...p], ''))))),
        ]));
}

// ---------- 武器姿勢 ----------
const num = (v) => typeof v === 'number';
function poseOk(key, eq = weapon())
{
    if (!eq) return false;
    if (key === 'aim') return num(eq.aim);
    return num(eq.swing?.aim) && num(eq.swing?.grip?.x) && num(eq.swing?.grip?.y);
}

const facing = () => S.pose ? Math.cos(S.target * Math.PI / 180) < 0 : S.flip;

function spOf(p, f)
{
    const s = p.scale ?? 1;
    return {x: p.x ?? 0, y: p.y ?? 0, angle: p.a ?? 0, width: f.w, height: f.h, originX: p.ox ?? 0.5, originY: p.oy ?? 1, scaleX: s, scaleY: s, displayHeight: f.h * s};
}

// 照遊戲的串法從頭推到第 ms 毫秒的姿勢；ms＝Infinity 時 total 是整段長度
function poseAt(eq, f, ms)
{
    const sp = spOf(eq, f);
    const r = S.target * Math.PI / 180;
    const dir = dirTo(Math.cos(r), Math.sin(r), facing() ? -1 : 1);
    const aimBase = {x: sp.x, y: sp.y, angle: sp.angle};
    const swBase = S.pose !== 'aim' ? {g: gripAt(sp, eq.swing.grip), angle: sp.angle} : null;
    let total = 0;
    for (const step of POSES[S.pose].steps)
    {
        const {pose, duration, ease} = S.pose === 'aim'
            ? {pose: aimPose(sp, aimBase, eq.aim, step ? dir : null), ...AIM}
            : swingPose(step, sp, eq.swing, swBase, dir);
        if (ms < total + duration) return {...pose(EASE[ease](Math.max(0, ms - total) / duration)), total};
        Object.assign(sp, pose(1));
        total += duration;
    }
    return {x: sp.x, y: sp.y, angle: sp.angle, total};
}

// ---------- 預覽 ----------
const scaleOf = () => S.zoom === 'game' ? Math.min(screen.width / 1024, screen.height / 768) : S.zoom;

function partsOf(r)
{
    const out = [];
    const add = (p, d, isWeapon) => {
        if (!isObj(p)) return;
        if (p.sprite) out.push({p, sprite: p.sprite, d: d ?? 0, isWeapon});
        if (p.ext) out.push({p, sprite: p.ext, d: DEPTH.ext});
    };
    for (const [k] of PARTS) add(r[k], DEPTH[k]);
    for (const [cat] of SLOTS) add(items()[S.slots[cat]]?.equip, DEPTH[cat], cat === 'CAT_WEAPON');
    return out.sort((a, b) => a.d - b.d);
}

let drawing = 0;
async function drawPreview()
{
    const cv = $('pv').querySelector('canvas'), r = role();
    if (!cv || !r) return;
    const token = ++drawing;
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const W = Math.max(w, 64) + 48, H = Math.max(hh, 64) + 48, K = scaleOf(), dpr = devicePixelRatio || 1;
    const parts = partsOf(r);
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    if (token !== drawing) return;
    cv.width = Math.round(W * K * dpr); cv.height = Math.round(H * K * dpr);
    cv.style.width = `${W * K}px`; cv.style.height = `${H * K}px`;
    const g = cv.getContext('2d'), px = 1 / K;
    g.setTransform(K * dpr, 0, 0, K * dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#222428';
    for (let y = 0; y < H; y += 8) for (let x = (y / 8) % 2 * 8; x < W; x += 16) g.fillRect(x, y, 8, 8);

    const vc = {x: W / 2, y: H / 2}, root = {x: vc.x + ax, y: vc.y + ay};
    if (S.view)
    {
        g.lineWidth = px;
        g.setLineDash([3 * px, 3 * px]);
        g.strokeStyle = '#888';
        g.strokeRect(vc.x - w / 2, vc.y - hh / 2, w, hh);
        g.setLineDash([]);
    }

    const posed = S.pose && poseOk(S.pose);
    let n = 0;
    parts.forEach((pt, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {p} = pt, {img, f} = fr;
        let {x = 0, y = 0, a = 0} = p;
        if (posed && pt.isWeapon)
        {
            const q = poseAt(p, f, S.t * poseAt(p, f, Infinity).total);
            [x, y, a] = [q.x, q.y, q.angle];
        }
        g.save();
        g.translate(vc.x, vc.y);
        if (facing()) g.scale(-1, 1);
        g.translate(x, y);
        g.rotate(a * Math.PI / 180);
        g.scale(p.scale ?? 1, p.scale ?? 1);
        g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
        g.restore();
        n++;
    });

    for (const k of ['g', 'z', 'b'])
    {
        if (!S[k] || !isObj(r[k])) continue;
        const l = r[k].l ?? 0, rr = r[k].r ?? 0, t = r[k].t ?? 0, b = r[k].b ?? 0;
        g.strokeStyle = FRAME_COLOR[k];
        g.lineWidth = 2 * px;
        g.strokeRect(vc.x - w / 2 + l, vc.y - hh / 2 + t, w - l - rr, hh - t - b);
    }

    if (S.anchor)
    {
        g.strokeStyle = '#ffd700';
        g.lineWidth = 2 * px;
        g.beginPath();
        g.moveTo(root.x - 4, root.y); g.lineTo(root.x + 4, root.y);
        g.moveTo(root.x, root.y - 4); g.lineTo(root.x, root.y + 4);
        g.stroke();
    }
    cv.dataset.drawn = n;
}

let playing = 0;
function play()
{
    const eq = weapon();
    const fr = eq && IC.frameOf(eq.sprite);
    if (!fr) return;
    fr.then(x => {
        if (!x) return;
        const total = poseAt(eq, x.f, Infinity).total, t0 = performance.now(), id = ++playing;
        const step = (now) => {
            if (id !== playing) return;
            S.t = Math.min(1, (now - t0) / total);
            $('pv').querySelector('input[type=range]').value = S.t;
            drawPreview();
            if (S.t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

function drawPv()
{
    if (!role()) return $('pv').replaceChildren();
    if (S.pose && !poseOk(S.pose)) S.pose = '';
    const check = (k, text, color, disabled) => h('label', {style: color && `color:${color}`},
        h('input', {type: 'checkbox', checked: S[k], disabled, onchange: e => {S[k] = e.target.checked; drawPreview();}}), text);
    const opt = (k, text) => h('option', {value: k, selected: k === S.pose, disabled: k && !poseOk(k)}, text);
    $('pv').replaceChildren(
        h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）'}),
        h('div', {class: 'opts'},
            check('view', '虛線 view', '#aaa'), check('anchor', '錨點', '#ffd700'),
            check('b', '物理 b', FRAME_COLOR.b), check('g', '佔格 g', FRAME_COLOR.g), check('z', '互動 z', FRAME_COLOR.z),
            check('flip', '翻面', null, !!S.pose),
            h('select', {title: '「遊戲」＝全螢幕玩時的大小（1024×768 FIT 到螢幕）', onchange: e => {S.zoom = e.target.value === 'game' ? 'game' : +e.target.value; drawPreview();}},
                ZOOMS.map(z => h('option', {value: z, selected: z === S.zoom}, z === 'game' ? '遊戲' : `×${z}`)))),
        h('div', {class: 'opts'},
            h('select', {title: '武器姿勢（照遊戲的串法；缺 aim／swing 的反灰）', onchange: e => {S.pose = e.target.value; S.t = 0; playing++; drawPv(); drawPreview();}},
                opt('', '靜止'), Object.entries(POSES).map(([k, p]) => opt(k, p.label))),
            S.pose && [
                h('input', {type: 'range', min: 0, max: 1, step: 0.01, value: S.t, oninput: e => {playing++; S.t = +e.target.value; drawPreview();}}),
                h('button', {onclick: play}, '▶ 播放'),
                h('label', {title: '0＝右、90＝下、180＝左；面向跟著目標翻'}, '目標角度',
                    h('input', {type: 'number', step: 'any', class: 'num', value: S.target, onchange: e => {S.target = +e.target.value || 0; drawPv(); drawPreview();}})),
            ]));
    drawPreview();
}

// ---------- 事件 ----------
$('btnReload').onclick = reload;
$('btnSave').onclick = save;
$('btnUndo').onclick = undo;
$('btnRedo').onclick = redo;
addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
    if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});
SH.onSaved((file) => onSaved(file).catch(e => status(e.message)));
SH.onProject(dir => setRoot(dir).catch(e => status(e.message)));
render();

// 給無頭測試用
window.__fit = {S, IC, setRoot, reload, save, undo, redo, commit, select, setSlot, poseOk, poseAt, drawPreview, render};
