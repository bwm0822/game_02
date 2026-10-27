// 試穿：選紙娃娃型角色、五格各挑一件裝備（只是試穿，不寫回 inv.equips），用數字調 body/head/hand 跟裝備 equip 的擺放
// 動畫模式編 anim.json（全武器共用的武器動畫）：畫布拖武器／旋轉把手／支點，時間軸拖影格／ready／hit
// 同時編 role.json、item.json、anim.json：undo 三份一起記，存檔各自比對外部修改、三方合併；動畫數學跟遊戲共用 src/core/pose.js
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import '../common/splitter.js';
import {$, h, ask, status} from '../common/dom.js';
import {str, isObj, getAt, setAt, parseNum, merge3} from '../common/obj.js';
import * as IC from '../common/icons.js';
import {createFold} from '../common/fold.js';
import {DEPTH, KINDS, KIND_NAMES} from '../role/schema.js';
import {EASE, dirTo, animTrack, poseAt as trackPose, trackEnd, weaponAnim as animOf} from '../../src/core/pose.js';

const FILES = ['role.json', 'item.json', 'anim.json'];
const PARTS = [['body', '身體'], ['head', '頭'], ['hair', '頭髮'], ['hand', '手']];
// 空格剪影同遊戲 setting.js 的 CAT2ICON
const SLOTS = [['CAT_WEAPON', '武器', 'icons:80'], ['CAT_HELMET', '頭盔', 'icons:113'], ['CAT_CHESTPLATE', '護甲', 'icons:119'], ['CAT_GLOVES', '手套', 'icons:128'], ['CAT_BOOTS', '靴子', 'icons:130']];
const NUMS = [['scale', '1'], ['x', '0'], ['y', '0'], ['a', '0'], ['ox', '0.5'], ['oy', '1']];
const ZOOMS = [1, 2, 3, 4, 6, 'game'];
const FRAME_COLOR = {b: '#ff5555', g: '#55dd55', z: '#5599ff'};
// 預覽播放時 ready 停一下（模擬前撲）、hold 停一下（模擬等箭飛）
const PAUSE = {ready: 100, hold: 300};
const SNAP = 15;

const S = {
    json: null,                 // public/assets/json
    doc: Object.fromEntries(FILES.map(f => [f, {data: {}, saved: {}, diskText: null}])),
    hist: [], hi: -1,
    rid: null,
    slots: {},                  // cat → item id
    cur: 'CAT_WEAPON',          // 選中的格子，下方面板顯示它
    zoom: 3, view: true, anchor: true, b: true, g: false, z: false, flip: false,
    mode: 'fit',                // fit 擺放／anim 動畫
    aid: null, ms: 0, key: -1,  // 編輯中的動畫、時間軸位置(ms)、選中的影格(ms 剛好在影格上才有)
    target: 0,                  // 目標方向（度，0＝右、90＝下）
};

const F = createFold();

const roles = () => S.doc['role.json'].data;
const items = () => S.doc['item.json'].data;
const anims = () => S.doc['anim.json'].data;
const role = () => roles()[S.rid];
const anim = () => anims()[S.aid];
const isDoll = (r) => isObj(r.head) || isObj(r.hand);
const dirtyOf = (f) => str(S.doc[f].data) !== str(S.doc[f].saved);
const isDirty = () => FILES.some(dirtyOf);
const weapon = () => items()[S.slots.CAT_WEAPON]?.equip;
const r1 = (v) => Math.round(v * 10) / 10;
const rad = (d) => d * Math.PI / 180;

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
    if (!json) throw new Error(`「${dir.name}」裡沒有 public/assets/json`);
    for (const f of FILES) if (!await FS.tryFile(json, f)) throw new Error(`「${dir.name}」裡沒有 public/assets/json/${f}`);
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
    recenter();
    S.cur = 'CAT_WEAPON';
    for (const e of role()?.inv?.equips ?? [])
    {
        const id = isObj(e) ? e.id : e, it = items()[id];
        if (it?.equip && SLOTS.some(([c]) => c === it.cat)) S.slots[it.cat] = id;
    }
    weaponAnim();
    render();
}

function setSlot(cat, id)
{
    if (id) S.slots[cat] = id;
    else delete S.slots[cat];
    if (cat === 'CAT_WEAPON') weaponAnim();
    render();
}

// 換武器時動畫切到那把武器的普攻動畫（同遊戲 pose.js 的 weaponAnim）；空手或指到不存在的動畫就切到（無）
function weaponAnim()
{
    const wid = S.slots.CAT_WEAPON, a = wid ? animOf(items()[wid]) : null;
    if (a && !anims()[a]) status(`${wid} 的 anim ${a} 不存在`);
    const aid = anims()[a] ? a : null;
    if (aid !== S.aid) {S.aid = aid; setMs(0);}
}

const emptyIcon = (cat, size) => {
    const el = IC.iconEl(SLOTS.find(([c]) => c === cat)[2], size);
    el.classList.add('empty');
    return el;
};
const slotIcon = (cat, size) => S.slots[cat] ? IC.iconEl(items()[S.slots[cat]].icon, size) : emptyIcon(cat, size);

// 點格子：選中並跳出挑選視窗；點 icon 就穿上並關窗，點窗外或 Esc 不改
function pickEquip(cat)
{
    S.cur = cat;
    render();
    const dlg = $('dlgEquip'), name = SLOTS.find(([c]) => c === cat)[1];
    const opts = Object.keys(items()).filter(i => items()[i].cat === cat && isObj(items()[i].equip));
    const tile = (id, icon, lab) => h('div', {class: 'tile' + ((S.slots[cat] ?? '') === id ? ' sel' : ''), dataset: {id}, title: id || '卸下',
        onclick: () => {dlg.close(); setSlot(cat, id);}}, icon, h('div', {class: 'lab'}, lab));
    dlg.replaceChildren(
        h('div', {class: 'title'}, `選擇${name}`),
        h('div', {class: 'tiles'},
            tile('', emptyIcon(cat, 40), '卸下'),
            opts.map(i => tile(i, IC.iconEl(items()[i].icon, 40), items()[i].lab ?? i))));
    dlg.onclick = (e) => {if (e.target === dlg) dlg.close();};
    dlg.showModal();
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
    // 摺起來的組裡不留選取（同 views.js 的 renderList）
    const mine = groups.find(([, g]) => g.includes(S.rid))?.[0];
    if (mine !== undefined) F.open(mine);
    const onToggle = () => (mine !== undefined && F.folded(mine) ? select(null) : render());
    const keys = groups.map(([k]) => k);
    $('list').replaceChildren(...groups.map(([k, g]) => [
        F.head(k, `${KIND_NAMES[k] ?? '無分類'}（${g.length}）`, keys, onToggle),
        F.folded(k) ? [] : g.map(id => h('div', {class: 'item' + (id === S.rid ? ' sel' : ''), onclick: () => select(id === S.rid ? null : id)},
            IC.iconEl(roles()[id].icon, 24),
            h('span', {class: 'id'}, id),
            h('span', {class: 'lab'}, roles()[id].lab ?? ''),
            str(roles()[id]) !== str(saved[id]) && h('span', {class: 'mark dirty'}, '●'))),
    ]).flat(Infinity));
}

// file 裡 id 那筆的 path；空字串＝刪 key（遊戲用預設值），req 的欄位不能清空；after 在同一筆 undo 裡跑
function numInput(file, id, path, ph, {req, after} = {})
{
    const k = `${file}|${id}|${path.join('.')}`, v = getAt(S.doc[file].data[id], path);
    return h('input', {type: 'number', step: 'any', class: 'num', value: v ?? '', placeholder: ph, dataset: {k},
        onchange: (e) => {
            const n = parseNum(e.target.value);
            if (typeof n === 'string') {status(`${path.join('.')} 要是數字`); return render();}
            if (req && n === undefined) {status(`${path.join('.')} 不能空白`); return render();}
            commit(() => {setAt(S.doc[file].data[id], path, n); after?.(n);});
        }});
}

const numCells = (file, id, base) => NUMS.map(([k, ph]) => h('td', null, numInput(file, id, [...base, k], ph)));
const head = (first) => h('tr', null, h('th', null, first), h('th', null, '圖／道具'), NUMS.map(([k]) => h('th', null, k)));

function drawView()
{
    const r = role();
    if (!r) return $('view').replaceChildren(h('div', {class: 'dim'}, S.json ? '沒有紙娃娃型角色（要有 head 或 hand）' : '先在上方選擇專案資料夾'));
    const tab = (m, text) => h('button', {class: 'tab' + (S.mode === m ? ' sel' : ''), dataset: {mode: m}, onclick: () => {S.mode = m; playing++; recenter(); render();}}, text);
    const slots = h('div', {class: 'slots'}, SLOTS.map(([cat, name]) =>
        h('div', {class: 'slot' + (cat === S.cur ? ' sel' : ''), dataset: {cat}, title: S.slots[cat] ? `${name}：${S.slots[cat]}` : name,
            onclick: () => pickEquip(cat)}, slotIcon(cat, 40))));
    $('view').replaceChildren(h('div', null,
        h('div', {class: 'tabs'}, tab('fit', '擺放'), tab('anim', '動畫')),
        h('div', {class: 'head'}, IC.iconEl(r.icon, 48), h('span', {class: 'bigid'}, S.rid), h('span', {class: 'dim'}, r.lab ?? '')),
        S.mode === 'anim' ? animView(slots) : fitView(r, slots)));
}

function fitView(r, slots)
{
    const partRows = PARTS.filter(([k]) => isObj(r[k])).map(([k, name]) => h('tr', null,
        h('td', {class: 'k'}, name),
        h('td', null, h('span', {class: 'sprite'}, r[k].sprite ?? ''), k === 'hair' && hairHidden() && h('span', {class: 'dim hidden-hair'}, '（目前被頭盔隱藏）')),
        numCells('role.json', S.rid, [k])));
    const id = S.slots[S.cur], it = items()[id], name = SLOTS.find(([c]) => c === S.cur)[1];
    return [
        h('div', {class: 'title'}, '角色部件（role.json）'),
        h('table', {class: 'fit'}, head('部件'), partRows),
        h('div', {class: 'title'}, '裝備（item.json，全角色共用；換裝只是試穿，不會寫回角色）'),
        slots,
        h('div', {class: 'equipname'}, h('span', {class: 'k'}, name),
            id ? [h('span', {class: 'bigid'}, id), h('span', {class: 'dim'}, it.lab ?? '')] : h('span', {class: 'dim'}, '（空）')),
        id && h('table', {class: 'fit'}, h('tr', null, NUMS.map(([k]) => h('th', null, k))), h('tr', null, numCells('item.json', id, ['equip']))),
        id && h('label', {class: 'hidehair'}, h('input', {type: 'checkbox', checked: !!it.equip?.hideHair, dataset: {k: `item.json|${id}|equip.hideHair`},
            onchange: (e) => commit(() => setAt(S.doc['item.json'].data[id], ['equip', 'hideHair'], e.target.checked || undefined))}), '藏頭髮'),
    ];
}

// ---------- 動畫 ----------
const restOf = (eq) => ({x: eq.x ?? 0, y: eq.y ?? 0, angle: eq.a ?? 0});
const facing = () => S.mode === 'anim' ? Math.cos(rad(S.target)) < 0 : S.flip;
const dirOf = () => dirTo(Math.cos(rad(S.target)), Math.sin(rad(S.target)), facing() ? -1 : 1);
const rotOf = (an = anim()) => an?.follow ? dirOf() : 0;

function trackOf(eq = weapon(), an = anim())
{
    if (!eq || !an?.keys?.length) return null;
    const rest = restOf(eq);
    return animTrack(an, rest, rest, dirOf());
}

// 遊戲裡 ready、hold 會停住等程式，預覽各停 PAUSE 毫秒；e 是播放經過的真實時間，回傳時間軸 ms
function playLen(an, tr) {return trackEnd(tr) + (an.ready ? PAUSE.ready : 0) + (an.hold ? PAUSE.hold : 0);}
function playMs(an, tr, e)
{
    const marks = [[an.ready, PAUSE.ready], [an.hold ? tr.end : 0, PAUSE.hold]].filter(([t]) => t).sort((a, b) => a[0] - b[0]);
    let ms = e;
    for (const [t, pause] of marks)
    {
        if (ms <= t) break;
        ms = Math.max(t, ms - pause);
    }
    return Math.min(ms, trackEnd(tr));
}

function setMs(ms)
{
    S.ms = ms;
    S.key = anim()?.keys.findIndex(k => k.t === ms) ?? -1;
}

// 畫面上（已轉向）的位移／位置換回影格座標：follow 的動畫要反轉 dir
function unrotVec(an, dx, dy)
{
    const r = -rad(rotOf(an)), [c, s] = [Math.cos(r), Math.sin(r)];
    return [dx * c - dy * s, dx * s + dy * c];
}
function unrotPt(an, p)
{
    const pv = an.pivot ?? {x: 0, y: 0}, [dx, dy] = unrotVec(an, p.x - pv.x, p.y - pv.y);
    return {x: pv.x + dx, y: pv.y + dy};
}

// 選了 #i 插在它跟前一格中間，沒選接在最後一格後面半個收回段；姿勢取該時間的補間
function addKey()
{
    const an = anim(), eq = weapon();
    if (!an || !eq) return;
    const {keys} = an, i = S.key, last = keys.at(-1);
    const ms = i >= 0 ? Math.round(((keys[i - 1]?.t ?? 0) + keys[i].t) / 2)
        : last ? last.t + Math.round(an.back ? an.back / 2 : 100) : 100;
    if (keys.some(k => k.t === ms) || ms <= 0) {status(`#${i + 1} 跟前一格間隔太小，插不進去`); return render();}
    const tr = trackOf(), p = tr ? trackPose(tr, ms) : restOf(eq), q = unrotPt(an, p);
    commit(() => {
        an.keys.push({t: ms, x: r1(q.x), y: r1(q.y), a: r1(p.angle - rotOf(an)), ease: 'Quad.Out'});
        an.keys.sort((a, b) => a.t - b.t);
        setMs(ms);
    });
}

function pickKey(i)
{
    if (i === S.key) S.key = -1;
    else setMs(anim().keys[i].t);
    render();
}

function delKey(i)
{
    commit(() => {anim().keys.splice(i, 1); setMs(S.ms);});
}

function newAnim(copy)
{
    const base = copy ? `${S.aid}_copy` : 'anim';
    let id = base, n = 1;
    while (anims()[id]) id = `${base}_${++n}`;
    const r = weapon() ? restOf(weapon()) : {x: 0, y: 0, angle: 0};
    commit(() => {
        anims()[id] = copy ? structuredClone(anim()) : {follow: false, pivot: {x: 0, y: 0}, hit: 200, back: 150, keys: [{t: 200, x: r.x, y: r.y, a: r.angle, ease: 'Quad.Out'}]};
        S.aid = id;
        setMs(0);
    });
}

function renameAnim(to)
{
    to = to.trim();
    if (to === S.aid) return;
    if (!/^[A-Za-z0-9_]+$/.test(to)) {status('動畫名稱只能用英數字跟底線'); return render();}
    if (anims()[to]) {status(`已經有 ${to}`); return render();}
    const from = S.aid, d = S.doc['anim.json'], users = animUsers(from);
    commit(() => {
        d.data = Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k === from ? to : k, v]));
        for (const id of users) items()[id].anim = to;
        S.aid = to;
    });
    status(`${from} 改名成 ${to}${users.length ? `，道具 ${users.join('、')} 的 anim 一起改了` : ''}：技能 anim、com_action.js 的預設（chop／sweep／aim）用到的要自己改`);
}

const animUsers = (aid) => Object.keys(items()).filter(id => items()[id].anim === aid);

async function delAnim()
{
    const users = animUsers(S.aid);
    const msg = `${users.length ? `道具 ${users.join('、')} 的 anim 會清掉、普攻變回預設動畫；` : ''}技能 anim 或 pose.js 預設（DEFAULT_ANIM）用到它的會播不出來`;
    if (await ask(`刪除動畫 ${S.aid}`, msg, [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    commit(() => {
        delete anims()[S.aid];
        for (const id of users) delete items()[id].anim;
        S.aid = null;
        setMs(0);
    });
}

function animView(slots)
{
    const wid = S.slots.CAT_WEAPON, an = anim(), F = 'anim.json';
    const check = (k, text, title) => h('label', {title}, h('input', {type: 'checkbox', checked: !!an[k], dataset: {k: `${F}|${S.aid}|${k}`},
        onchange: (e) => commit(() => setAt(an, [k], e.target.checked || undefined))}), text);
    const sel = (opts, v, onchange) => h('select', {onchange}, opts.map(([o, t]) => h('option', {value: o, selected: o === v}, t)));
    const keyRow = (k, i) => h('tr', {class: i === S.key ? 'sel' : '', onclick: (e) => {if (e.target.matches('input, select, button')) return; pickKey(i);}},
        h('td', {class: 'k'}, `#${i + 1}`),
        h('td', null, numInput(F, S.aid, ['keys', i, 't'], '', {req: true, after: (n) => {an.keys.sort((a, b) => a.t - b.t); setMs(n);}})),
        ['x', 'y', 'a'].map(f => h('td', null, numInput(F, S.aid, ['keys', i, f], '', {req: true}))),
        h('td', null, sel(Object.keys(EASE).map(e => [e, e]), k.ease ?? 'Linear', (e) => commit(() => {k.ease = e.target.value;}))),
        h('td', null, sel([['line', '直線'], ['arc', '弧線']], k.path ?? 'line', (e) => commit(() => setAt(k, ['path'], e.target.value === 'arc' ? 'arc' : undefined)))),
        h('td', null, h('button', {title: '刪除影格', onclick: () => delKey(i)}, '✕')));
    return [
        slots,
        h('div', {class: 'equipname'}, h('span', {class: 'k'}, '武器'),
            wid ? [h('span', {class: 'bigid'}, wid), h('span', {class: 'dim'}, items()[wid].lab ?? '')] : h('span', {class: 'dim'}, '（空，穿上武器才能預覽）')),
        wid && h('table', {class: 'fit'}, h('tr', null, NUMS.map(([k]) => h('th', null, k))), h('tr', null, numCells('item.json', wid, ['equip']))),
        h('div', {class: 'title'}, '動畫（anim.json，全武器共用；影格 x/y＝武器原點 ox/oy 在角色上的位置，a＝圖片角度）'),
        h('div', {class: 'animbar'},
            sel([['', '（無）'], ...Object.keys(anims()).map(k => [k, k])], an ? S.aid : '', (e) => {S.aid = e.target.value || null; setMs(0); playing++; render();}),
            h('button', {onclick: () => newAnim(false)}, '新增'),
            an && h('button', {onclick: () => newAnim(true)}, '複製'),
            an && h('button', {onclick: delAnim}, '刪除'),
            an && h('label', null, '名稱', h('input', {type: 'text', class: 'aid', value: S.aid, dataset: {k: 'aid'}, onchange: (e) => renameAnim(e.target.value)}))),
        an && [
            h('div', {class: 'animprops'},
                check('follow', '轉向目標', '以「目標在正右方」來擺，播放時整組繞支點轉到目標方向'),
                check('hold', '舉著等', '播完最後一格停住，等程式叫收回（遠程等箭命中）'),
                h('label', null, '支點 x', numInput(F, S.aid, ['pivot', 'x'], '0')),
                h('label', null, 'y', numInput(F, S.aid, ['pivot', 'y'], '0')),
                h('label', {title: '播到這裡停住，等程式做身體位移（前撲／衝刺）'}, 'ready', numInput(F, S.aid, ['ready'], '0')),
                h('label', {title: '命中／放箭時刻'}, 'hit', numInput(F, S.aid, ['hit'], `${an.keys.at(-1)?.t ?? 0}`)),
                h('label', {title: '最後一格收回靜止的時間'}, 'back', numInput(F, S.aid, ['back'], '0'))),
            h('table', {class: 'fit keys'},
                h('tr', null, ['', 't (ms)', 'x', 'y', 'a', 'ease', 'path', ''].map(t => h('th', null, t))),
                an.keys.map(keyRow)),
            h('button', {onclick: addKey, title: '選了影格插在它跟前一格中間、沒選接在最後；姿勢取該時間的補間'}, S.key >= 0 ? `＋ 插在 #${S.key + 1} 之前` : '＋ 新增影格（最後）'),
            h('div', {class: 'hint'}, '畫布：拖武器＝移位置、拖白點＝轉角度（Shift 吸 15°）、拖藍點＝支點；只能改選中的影格（時間軸 ◆ 或表格列，再點一次或 Esc 取消選取）。虛線＝原點軌跡、半透明＝其他影格。角度照數字補間，-90→90 是順時針掃 180°；弧線繞支點、方向跟角度變化同向。'),
        ],
    ];
}

// ---------- 預覽 ----------
const scaleOf = () => S.zoom === 'game' ? Math.min(screen.width / 1024, screen.height / 768) : S.zoom;

const hairHidden = () => SLOTS.some(([cat]) => items()[S.slots[cat]]?.equip?.hideHair);

function partsOf(r)
{
    const out = [];
    const add = (p, d, isWeapon) => {
        if (!isObj(p)) return;
        if (p.sprite) out.push({p, sprite: p.sprite, d: d ?? 0, isWeapon});
        if (p.ext) out.push({p, sprite: p.ext, d: DEPTH.ext});
        if (p.back) out.push({p, sprite: p.back, d: DEPTH.back});
    };
    for (const [k] of PARTS) if (k !== 'hair' || !hairHidden()) add(r[k], DEPTH[k]);
    for (const [cat] of SLOTS) add(items()[S.slots[cat]]?.equip, DEPTH[cat], cat === 'CAT_WEAPON');
    return out.sort((a, b) => a.d - b.d);
}

// 武器 sprite 本地座標的旋轉把手：原點往圖片中心方向延伸兩倍（原點就在中心時朝上）
function handleOf(p, f, pose)
{
    const s = p.scale ?? 1;
    let [hx, hy] = [(0.5 - (p.ox ?? 0.5)) * f.w * s * 2, (0.5 - (p.oy ?? 1)) * f.h * s * 2];
    if (Math.hypot(hx, hy) < 4) [hx, hy] = [0, -f.h * s * 0.75];
    const r = rad(pose.angle), [c, sn] = [Math.cos(r), Math.sin(r)];
    return {x: pose.x + hx * c - hy * sn, y: pose.y + hx * sn + hy * c};
}

function inSprite(p, f, pose, lx, ly)
{
    const s = p.scale ?? 1, r = -rad(pose.angle), [dx, dy] = [lx - pose.x, ly - pose.y];
    const [u, v] = [(dx * Math.cos(r) - dy * Math.sin(r)) / s + (p.ox ?? 0.5) * f.w, (dx * Math.sin(r) + dy * Math.cos(r)) / s + (p.oy ?? 1) * f.h];
    return u >= 0 && u <= f.w && v >= 0 && v <= f.h;
}

// 畫布區每次重繪都是新的元素：照記下的位置捲回去；換倍率／角色／分頁時改成置中（角色在畫布正中央）
let scroll = {x: 0, y: 0}, centerNext = true;
const recenter = () => {centerNext = true;};
function placeScroll(st)
{
    if (centerNext)
    {
        centerNext = false;
        scroll = {x: (st.scrollWidth - st.clientWidth) / 2, y: (st.scrollHeight - st.clientHeight) / 2};
    }
    st.scrollLeft = scroll.x;
    st.scrollTop = scroll.y;
}

let geo = null;             // 最後一次畫的幾何，給畫布拖拉 hit-test
let drawing = 0;
async function drawPreview()
{
    const cv = $('pv').querySelector('canvas'), r = role();
    if (!cv || !r) return;
    const token = ++drawing;
    const isAnim = S.mode === 'anim', pad = isAnim ? 112 : 48;
    const w = r.w ?? 32, hh = r.h ?? 64, ax = r.anchor?.x ?? 0, ay = r.anchor?.y ?? 0;
    const W = Math.max(w, 64) + pad, H = Math.max(hh, 64) + pad, K = scaleOf(), dpr = devicePixelRatio || 1;
    const parts = partsOf(r);
    const frames = await Promise.all(parts.map(p => IC.frameOf(p.sprite)));
    if (token !== drawing) return;
    cv.width = Math.round(W * K * dpr); cv.height = Math.round(H * K * dpr);
    cv.style.width = `${W * K}px`; cv.style.height = `${H * K}px`;
    placeScroll(cv.parentElement);
    const g = cv.getContext('2d'), px = 1 / K, flip = facing();
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

    const tr = isAnim ? trackOf() : null;
    const local = (fn) => {g.save(); g.translate(vc.x, vc.y); if (flip) g.scale(-1, 1); fn(); g.restore();};
    const drawSp = (p, img, f, {x = 0, y = 0, a = 0}) => local(() => {
        g.translate(x, y);
        g.rotate(rad(a));
        g.scale(p.scale ?? 1, p.scale ?? 1);
        g.drawImage(img, f.x, f.y, f.w, f.h, -(p.ox ?? 0.5) * f.w, -(p.oy ?? 1) * f.h, f.w, f.h);
    });
    let n = 0, wp = null;
    parts.forEach((pt, i) => {
        const fr = frames[i];
        if (!fr) return;
        const {p} = pt;
        let pose = {x: p.x ?? 0, y: p.y ?? 0, a: p.a ?? 0};
        if (tr && pt.isWeapon)
        {
            const q = trackPose(tr, S.ms);
            pose = {x: q.x, y: q.y, a: q.angle};
            wp = {p, ...fr, pose: q};
        }
        drawSp(p, fr.img, fr.f, pose);
        n++;
    });

    if (tr && wp)
    {
        g.globalAlpha = 0.3;
        tr.frames.slice(1, -1).forEach(k => {if (k.t !== S.ms) drawSp(wp.p, wp.img, wp.f, {x: k.x, y: k.y, a: k.angle});});
        g.globalAlpha = 1;
        const total = trackEnd(tr), hd = handleOf(wp.p, wp.f, wp.pose), pv = tr.pivot;
        local(() => {
            g.lineWidth = px;
            g.setLineDash([2 * px, 2 * px]);
            g.strokeStyle = '#ffcc66';
            g.beginPath();
            for (let ms = 0; ms <= total; ms += Math.max(1, total / 120))
            {
                const q = trackPose(tr, ms);
                ms ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y);
            }
            g.stroke();
            g.setLineDash([]);
            const dot = (x, y, color, rr) => {g.fillStyle = color; g.beginPath(); g.arc(x, y, rr * px, 0, Math.PI * 2); g.fill();};
            if (S.key >= 0)
            {
                g.strokeStyle = '#fff';
                g.beginPath(); g.moveTo(wp.pose.x, wp.pose.y); g.lineTo(hd.x, hd.y); g.stroke();
                dot(hd.x, hd.y, '#fff', 4);
                dot(wp.pose.x, wp.pose.y, '#ffcc66', 3);
            }
            dot(pv.x, pv.y, '#4da3ff', 4);
        });
        geo = {vc, K, flip, wp, hd, pv};
    }
    else geo = null;

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

// ---------- 畫布拖拉 ----------
// 拖的時候直接改資料、放開時還原再 commit 一次，undo 只記一筆
function toLocal(e)
{
    const rc = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rc.left) / geo.K - geo.vc.x, y = (e.clientY - rc.top) / geo.K - geo.vc.y;
    return {x: geo.flip ? -x : x, y};
}

let drag = null;
function onDown(e)
{
    const an = anim();
    if (!geo || !an) return;
    const l = toLocal(e), near = (p, r) => Math.hypot(l.x - p.x, l.y - p.y) <= r / geo.K;
    const {wp} = geo, key = an.keys[S.key];
    let kind = null;
    if (key && near(geo.hd, 10)) kind = 'rot';
    else if (near(geo.pv, 8)) kind = 'pivot';
    else if (inSprite(wp.p, wp.f, wp.pose, l.x, l.y)) kind = 'move';
    if (!kind) return;
    if (kind !== 'pivot' && !key) return status('先選一個影格（時間軸 ◆ 或表格列），或按「新增影格」');
    if (e.isTrusted) e.currentTarget.setPointerCapture(e.pointerId);
    drag = {kind, l, an, key, orig: structuredClone(kind === 'pivot' ? an.pivot ?? {x: 0, y: 0} : key),
        a0: Math.atan2(l.y - wp.pose.y, l.x - wp.pose.x), o: {x: wp.pose.x, y: wp.pose.y}};
}

function onMove(e)
{
    if (!drag) return;
    const l = toLocal(e), {kind, an, key, orig} = drag, [dx, dy] = [l.x - drag.l.x, l.y - drag.l.y];
    if (kind === 'pivot') an.pivot = {x: r1(orig.x + dx), y: r1(orig.y + dy)};
    else if (kind === 'move')
    {
        const [ux, uy] = unrotVec(an, dx, dy);
        Object.assign(key, {x: r1(orig.x + ux), y: r1(orig.y + uy)});
    }
    else
    {
        const da = (Math.atan2(l.y - drag.o.y, l.x - drag.o.x) - drag.a0) * 180 / Math.PI;
        const a = orig.a + shortestDeg(da);
        key.a = e.shiftKey ? Math.round(a / SNAP) * SNAP : r1(a);
    }
    drawPreview();
}

const shortestDeg = (d) => d - Math.floor((d + 180) / 360) * 360;

function onUp()
{
    if (!drag) return;
    const {kind, an, key, orig} = drag;
    drag = null;
    if (kind === 'pivot')
    {
        const v = an.pivot;
        an.pivot = orig;
        commit(() => {an.pivot = v;});
    }
    else
    {
        const v = {x: key.x, y: key.y, a: key.a};
        Object.assign(key, orig);
        commit(() => Object.assign(key, v));
    }
}

// ---------- 時間軸 ----------
function timeline(tr)
{
    const an = anim(), total = trackEnd(tr) || 1, pct = (t) => `${t / total * 100}%`;
    const mark = (cls, t, text, title, onset) => h('div', {class: `mark ${cls}`, style: `left:${pct(t)}`, title,
        onpointerdown: (e) => {
            e.stopPropagation();
            const bar = e.currentTarget.parentElement, rc = bar.getBoundingClientRect(), el = e.currentTarget;
            el.setPointerCapture(e.pointerId);
            const at = (ev) => Math.round(Math.min(1, Math.max(0, (ev.clientX - rc.left) / rc.width)) * total);
            let v = t;
            el.onpointermove = (ev) => {v = onset.clamp(at(ev)); el.style.left = pct(v); el.title = `${title} ${v} ms`;};
            el.onpointerup = () => {el.onpointermove = el.onpointerup = null; v === t ? onset.click?.() : onset.set(v);};
        }}, text);
    const keys = an.keys.map((k, i) => mark('key' + (i === S.key ? ' sel' : ''), k.t, '◆', `影格 #${i + 1}`, {
        clamp: (v) => Math.min(an.keys[i + 1]?.t - 1 || total, Math.max((an.keys[i - 1]?.t ?? 0) + 1, v)),
        set: (v) => commit(() => {k.t = v; setMs(v);}),
        click: () => pickKey(i),
    }));
    const flag = (k, text, title) => an[k] != null && mark(k, an[k], text, title, {
        clamp: (v) => Math.min(tr.end, v),
        set: (v) => commit(() => {an[k] = v;}),
    });
    return h('div', {class: 'timeline', onpointerdown: (e) => {
        const rc = e.currentTarget.getBoundingClientRect();
        setMs(Math.round(Math.min(1, Math.max(0, (e.clientX - rc.left) / rc.width)) * total));
        playing++;
        render();
    }},
        h('div', {class: 'back', style: `left:${pct(tr.end)}`, title: '收回'}),
        keys, flag('ready', 'R', 'ready'), flag('hit', 'H', 'hit'),
        h('div', {class: 'playhead', style: `left:${pct(S.ms)}`}));
}

let playing = 0;
function play()
{
    const an = anim(), tr = trackOf();
    if (!tr) return;
    const len = playLen(an, tr), total = trackEnd(tr), t0 = performance.now(), id = ++playing;
    const step = (now) => {
        if (id !== playing) return;
        const e = Math.min(len, now - t0);
        setMs(playMs(an, tr, e));
        const range = $('pv').querySelector('input[type=range]'), head = $('pv').querySelector('.playhead');
        if (range) range.value = S.ms;
        if (head) head.style.left = `${S.ms / total * 100}%`;
        drawPreview();
        if (e < len) requestAnimationFrame(step);
        else render();
    };
    requestAnimationFrame(step);
}

function drawPv()
{
    if (!role()) return $('pv').replaceChildren();
    const isAnim = S.mode === 'anim', tr = isAnim ? trackOf() : null;
    const check = (k, text, color, disabled) => h('label', {style: color && `color:${color}`},
        h('input', {type: 'checkbox', checked: S[k], disabled, onchange: e => {S[k] = e.target.checked; drawPreview();}}), text);
    const cv = h('canvas', {title: '虛線：view（w×h）　黃十字：錨點（角色位置）', onpointerdown: onDown, onpointermove: onMove, onpointerup: onUp});
    const total = tr ? trackEnd(tr) : 0;
    $('pv').replaceChildren(
        h('div', {class: 'stage', onscroll: e => {scroll = {x: e.target.scrollLeft, y: e.target.scrollTop};}}, cv),
        h('div', {class: 'ctrl'},
        h('div', {class: 'opts'},
            check('view', '虛線 view', '#aaa'), check('anchor', '錨點', '#ffd700'),
            check('b', '物理 b', FRAME_COLOR.b), check('g', '佔格 g', FRAME_COLOR.g), check('z', '互動 z', FRAME_COLOR.z),
            check('flip', '翻面', null, isAnim),
            h('select', {title: '「遊戲」＝全螢幕玩時的大小（1024×768 FIT 到螢幕）', onchange: e => {S.zoom = e.target.value === 'game' ? 'game' : +e.target.value; recenter(); drawPreview();}},
                ZOOMS.map(z => h('option', {value: z, selected: z === S.zoom}, z === 'game' ? '遊戲' : `×${z}`)))),
        isAnim && h('div', {class: 'opts anim'},
            tr ? [
                timeline(tr),
                h('input', {type: 'range', min: 0, max: total, step: 1, value: S.ms, oninput: e => {
                    playing++;
                    const v = +e.target.value, k = anim().keys.find(k => Math.abs(k.t - v) <= total / 100);
                    setMs(k ? k.t : v);
                    render();
                }}),
                h('span', {class: 'ms'}, `${Math.round(S.ms)} / ${total} ms`),
                h('button', {onclick: play, title: `ready 停 ${PAUSE.ready}ms 模擬前撲、舉著等停 ${PAUSE.hold}ms`}, '▶ 播放'),
            ] : h('span', {class: 'dim'}, !weapon() ? '穿上武器才能預覽' : anim() ? '這個動畫還沒有影格' : '沒有選動畫'),
            h('label', {title: '0＝右、90＝下、180＝左；面向跟著目標翻，轉向目標的動畫整組繞支點轉'}, '目標角度',
                h('input', {type: 'number', step: 'any', class: 'num', value: S.target, onchange: e => {S.target = +e.target.value || 0; render();}})))));
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
    if (k === 'escape' && S.mode === 'anim' && S.key >= 0) {S.key = -1; render();}
    if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
    if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
});
SH.onSaved((file) => onSaved(file).catch(e => status(e.message)));
SH.onProject(dir => setRoot(dir).catch(e => status(e.message)));
render();

// 給無頭測試用
window.__fit = {S, IC, setRoot, reload, save, undo, redo, commit, select, setSlot, pickEquip, drawPreview, render,
    trackOf, setMs, addKey, pickKey, delKey, newAnim, renameAnim, delAnim, play, playMs, get geo() {return geo;}};
