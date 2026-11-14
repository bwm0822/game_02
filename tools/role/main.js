import {$, h, ask, status} from '../common/dom.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import * as ST from '../common/settings.js';
import {portraitOf, toPng} from '../common/portrait.js';
import {str, isObj, getAt, setAt, replaceRaw, parseNum} from '../common/obj.js';
import {createDoc, ID_RE} from '../common/doc.js';
import {fieldInput, createForm} from '../common/form.js';
import {createViews, renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import * as JE from '../common/jsonedit.js';
import * as PT from '../common/part.js';
import {pickItem} from '../common/itempick.js';
import {timePick} from '../common/timepick.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SC from './schema.js';
import {previewEl} from './preview.js';
import * as SM from './schedmap.js';
import * as PZ from '../common/panzoom.js';
import * as SP from '../../src/data/schedplan.js';
import {bestPath} from '../../src/data/navgrid.js';
import * as ME from '../common/pointedit.js';
import * as MR from '../common/maproles.js';
import * as SB from './schedbar.js';
import * as GT from './gantt.js';
import * as SE from './schedit.js';
import {clashes} from './occupy.js';
import {ROLE_PARTS, partFor, sexOk} from '../../src/core/equip.js';

const ALL = '#all';

// role.json 裡沒有角色互相引用的欄位，改名只動 key
const D = createDoc({
    file: 'role.json', noun: '角色',
    external: '可能是紙娃娃「存到 role.json」或手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    // 地圖上的角色物件（屬性 id）跟 template：改名連帶改並立刻寫（role.json 也跟著存，免得地圖指到還沒存的新 id），刪除有人用就擋
    ext: {
        title: '地圖／template 裡會一起改的（立刻寫檔，role.json 也一起存）',
        blockDelete: '還有地圖／template 用到這個角色，先到地圖分頁換掉或刪掉：',
        refs: async (id) => {
            if (!S.assets) return null;
            const data = await MR.roleRefs(S.assets.dir, id);
            return {data, lines: MR.refLines(data), n: MR.refCount(data)};
        },
        rename: async (from, to, data) => {
            let files;
            try {files = await MR.renameRoleRefs(S.assets.dir, data, from, to);}
            catch (e) {status(`地圖沒改完：${e.message}`); return;}
            await D.save();
            for (const f of files) {SH.notifySaved(f); if (f.startsWith('maps/')) forgetMap(f.slice(5).replace(/\.json$/, ''));}
            status(`已改名 ${from} → ${to}：role.json 跟 ${files.join('、')} 都寫好了`);
        },
    },
    onSaved: (file) => {
        if (file === 'item.json' || file === 'part.json' || file === 'local.json') loadRefs().then(render);
        // 地圖分頁寫了地圖：丟掉烤好的圖重讀
        else if (file?.startsWith('maps/')) {forgetMap(file.slice(5).replace(/\.json$/, '')); if (S.rtab === 'sched') renderRight();}
    },
});
const {S, render, commit, set} = D;
IC.onReload(render);
S.ext = {items: {}, abilities: {}, maps: {}, parts: {}, local: {}, nav: {nodes: {}, edges: {}}};    // 唯讀參考資料：item.json、ability.json、part.json、local.json、navgraph.json 的「地圖 → 物件名稱」
S.grp = ALL;                                     // 總覽表 kind 分頁的子分類篩選（ALL＝全部、''＝無子分類），換分頁重置
S.grpTab = 0;
S.grpNew = {};                                   // 新增還沒有角色的子分類（kind → [名稱]），只在記憶體
S.secOpen = {};                                  // 表單段落開關（段名 → bool，預設收合；記在頁面，換角色保持）
S.rtab = 'look';                                 // 右欄：look＝外觀預覽、sched＝作息地圖（記在 localStorage）
try {if (localStorage.getItem('tools.role.rtab') === 'sched') S.rtab = 'sched';} catch {}
const F = createForm(D);
const V = createViews(D, {icon: id => S.data[id].icon, lab: id => S.data[id].lab, warns: id => validate(id),
                          item: (el, id) => {el.onpointerdown = (e) => dragRole(e, id);}});

const idOf = (e) => (isObj(e) ? e.id : e);

// ---------- 檢查 ----------
function checkVal(def, v, where, out)
{
    if (v === undefined) return;
    const t = def.type;
    if (t === 'int' || t === 'num')
    {
        if (typeof v !== 'number') out.push(`${where} 不是數字：${str(v)}`);
        else if (t === 'int' && !Number.isInteger(v)) out.push(`${where} 應該是整數：${v}`);
    }
    else if (t === 'bool' && typeof v !== 'boolean') out.push(`${where} 應該是 true/false：${str(v)}`);
    else if (t === 'enum' && !def.options.includes(v)) out.push(`${where} 不認識的值：${v}`);
    else if (t === 'sprite' || t === 'icon') {const e = IC.check(v); if (e) out.push(`${where}：${e}`);}
    else if (t === 'itemref' && !S.ext.items[v]) out.push(`${where} 指到不存在的道具：${v}`);
    else if (def.part && !S.ext.parts[v]) out.push(`${where} 指到 part.json 沒有的部位：${v}`);
    else if (def.part && S.ext.parts[v].kind !== where) out.push(`${where} 指到的部位是 ${S.ext.parts[v].kind}：${v}`);
    else if (t === 'tags')
    {
        if (!Array.isArray(v)) out.push(`${where} 應該是陣列`);
        else if (where === 'abilities') for (const a of v) if (!S.ext.abilities[a]) out.push(`abilities 沒有這個技能：${a}`);
    }
}

const SEX_NAMES = {m: '限男', f: '限女'};
const sexName = (sx) => ((sx ?? 'm') === 'f' ? '女' : '男');

function checkInv(inv, out, sex)
{
    if (!isObj(inv)) return out.push('inv 應該是物件');
    const st = inv.storage;
    if (st !== undefined)
    {
        if (!isObj(st)) out.push('inv.storage 應該是物件');
        else
        {
            checkVal({type: 'int'}, st.capacity, 'inv.storage.capacity', out);
            const items = st.items ?? [];
            if (!Array.isArray(items)) out.push('inv.storage.items 應該是陣列');
            else
            {
                items.forEach((e, i) => {if (!S.ext.items[idOf(e)]) out.push(`物品欄第 ${i + 1} 格指到不存在的道具：${idOf(e)}`);});
                if (st.capacity >= 0 && items.length > st.capacity) out.push(`物品欄放了 ${items.length} 格，超過容量 ${st.capacity}`);
            }
        }
    }
    if (inv.equips !== undefined)
    {
        if (!Array.isArray(inv.equips)) out.push('inv.equips 應該是陣列');
        else inv.equips.forEach(e => {
            const it = S.ext.items[idOf(e)];
            if (!it) out.push(`裝備指到不存在的道具：${idOf(e)}`);
            else if (!it.equip) out.push(`裝備 ${idOf(e)} 在 item.json 沒有裝備圖 equip`);
            else if (!sexOk(it, sex)) out.push(`裝備 ${idOf(e)} ${SEX_NAMES[it.sex] ?? it.sex}，但角色是${sexName(sex)}`);
        });
    }
}

function checkSchedule(list, out)
{
    if (!Array.isArray(list)) return out.push('schedule 應該是陣列');
    const nav = Object.keys(S.ext.maps).length > 0;
    list.forEach((s, i) => {
        const at = `作息 ${i + 1}`;
        if (!/^@?\d\d:\d\d$/.test(s.t ?? '')) out.push(`${at} 時間要寫 HH:MM（出發）或 @HH:MM（抵達）：${s.t ?? '（沒填）'}`);
        const xy = s.at !== undefined;
        if (xy && !(Array.isArray(s.at) && s.at.length === 2 && s.at.every(Number.isInteger))) out.push(`${at} 格子 at 要寫 [x, y]（整數）：${JSON.stringify(s.at)}`);
        if (xy && s.go !== undefined) out.push(`${at} 目的地 go 跟格子 at 只能寫一個`);
        if (!nav) return;
        const names = S.ext.maps[s.map];
        if (!names) out.push(`${at} 路網沒有地圖 ${s.map ?? '（沒填）'}（新地圖要重跑 scripts/navgraph.js）`);
        else if (!xy && !names.includes(s.go)) out.push(`${at} ${s.map} 沒有物件 ${s.go ?? '（沒填）'}`);
        if (s.do === 'patrol')
        {
            if (!s.route?.length) out.push(`${at} 巡邏沒有 route`);
            else if (names) for (const p of s.route) if (!names.includes(p)) out.push(`${at} 巡邏路點 ${p} 不在 ${s.map}`);
        }
        checkVal({type: 'int'}, s.wait, `${at} 停留`, out);
        if (s.type !== undefined && Object.keys(S.ext.local).length && !SC.schTypes(S.ext.local).includes(s.type)) out.push(`${at} 類型 ${s.type} 不在 local.json（sch.${s.type}）`);
    });
}

// keys：跟 out 一一對應的欄位 key（段落標題標 ⚠ 用）
function validate(id, keys = [])
{
    const r = S.data[id], out = [];
    const tag = (k) => {while (keys.length < out.length) keys.push(k);};
    if (!r.lab) out.push('沒有名稱 lab');
    tag('lab');
    for (const k of SC.REQUIRED) {if (r[k] === undefined) out.push(`沒有 ${k}（遊戲畫角色會出錯）`); tag(k);}
    if (r.kind && !SC.KINDS.includes(r.kind)) out.push(`不認識的分類 kind：${r.kind}`);
    tag('kind');
    if (r.loc !== undefined) out.push('loc 已經改名成 grp（子分類）');
    tag('grp');
    if (r.style !== undefined && !(r.style in SC.STYLES)) out.push(`性格 style「${r.style}」在 com_ai.js 的 wTBL 裡沒有（遊戲會當成 ${SC.STYLE_DEFAULT}）`);
    tag('style');
    for (const [k, v] of Object.entries(r))
    {
        const def = SC.FIELDS[k];
        if (!def || k === 'style') continue;
        if (def.type === 'obj')
        {
            if (!isObj(v)) out.push(`${k} 應該是物件`);
            else for (const [f, d] of Object.entries(def.fields)) checkVal(d, v[f], `${k}.${f}`, out);
        }
        else if (def.type === 'inv') checkInv(v, out, r.sex);
        else if (def.type === 'part' && S.ext.parts[v] && !sexOk(S.ext.parts[v], r.sex)) out.push(`${def.label} ${v} ${SEX_NAMES[S.ext.parts[v].sex] ?? S.ext.parts[v].sex}，但角色是${sexName(r.sex)}`);
        else if (def.type === 'schedule') checkSchedule(v, out);
        else checkVal(def, v, k, out);
        tag(k);
    }
    return out;
}

const validateAll = () => Object.keys(S.data).flatMap(id => validate(id).map(w => `${id}：${w}`));

// ---------- 子分類 grp（只給工具分組，遊戲不讀）----------
// 清單從角色身上收集（照第一次出現的順序），再接上新增還沒有角色的
const kindOf = (r) => r.kind ?? '';
function grpsOf(kind)
{
    const gs = SC.grpsIn(S.data, kind);
    return [...gs, ...(S.grpNew[kind] ?? []).filter(g => !gs.includes(g))];
}
const grpUsers = (kind, g) => Object.keys(S.data).filter(id => kindOf(S.data[id]) === kind && S.data[id].grp === g);
const dropNew = (kind, g) => {S.grpNew[kind] = (S.grpNew[kind] ?? []).filter(x => x !== g);};

// 沒有 grp 的話插在 kind 後面（key 順序跟手寫的一致），要在 commit 裡呼叫
function putGrp(r, g)
{
    if (!g) return void delete r.grp;
    if ('grp' in r) return void (r.grp = g);
    const e = Object.entries(r), i = e.findIndex(([k]) => k === 'kind');
    e.splice(i + 1, 0, ['grp', g]);
    for (const k of Object.keys(r)) delete r[k];
    Object.assign(r, Object.fromEntries(e));
}

const setGrp = (id, g) => commit(() => putGrp(S.data[id], g?.trim() || undefined));

// 改 kind 時子分類清掉，免得掛在別的 kind 底下
const setKind = (id, kind) => commit(() => {setAt(S.data[id], ['kind'], kind); putGrp(S.data[id], undefined);});

function grpNameError(kind, g)
{
    if (!g) return '不能是空的';
    if (grpsOf(kind).includes(g)) return `「${g}」已經有了`;
    return '';
}

async function askGrp(title, value, okLabel)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, [h('div', null, '名稱：'), inp], [['ok', okLabel], ['cancel', '取消']]);
    inp.focus();
    inp.select();
    return await p === 'ok' ? inp.value.trim() : null;
}

async function newGrp(kind, name)
{
    const g = name ?? await askGrp(`新增子分類（${SC.KIND_NAMES[kind] ?? (kind || '無分類')}）`, '', '新增');
    if (g === null) return;
    const err = grpNameError(kind, g);
    if (err) return status(err);
    (S.grpNew[kind] ??= []).push(g);
    render();
}

// 改成同 kind 已有的名字＝問要不要合併
async function renameGrp(kind, from, name)
{
    const to = name ?? await askGrp(`子分類改名：${from}`, from, '改名');
    if (to === null || to === from) return;
    if (!to) return status('不能是空的');
    const users = grpUsers(kind, from);
    if (grpsOf(kind).includes(to)
        && await ask(`合併到「${to}」？`, h('div', null, `「${from}」的 ${users.length} 個角色會移到「${to}」`), [['ok', '合併'], ['cancel', '取消']]) !== 'ok') return;
    const i = (S.grpNew[kind] ?? []).indexOf(from);
    if (i >= 0)
    {
        if (grpsOf(kind).includes(to)) dropNew(kind, from);
        else S.grpNew[kind][i] = to;
    }
    if (users.length) commit(() => users.forEach(id => putGrp(S.data[id], to)));
    else render();
    status(`子分類 ${from} → ${to}`);
}

async function removeGrp(kind, g)
{
    const users = grpUsers(kind, g);
    if (users.length && await ask(`刪除子分類「${g}」？`, h('div', null, `${users.length} 個角色會移回「${SC.KIND_NAMES[kind] ?? (kind || '無分類')}」底下（角色不會刪掉）`),
        [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    dropNew(kind, g);
    if (users.length) commit(() => users.forEach(id => putGrp(S.data[id], undefined)));
    else render();
    status(`已刪除子分類 ${g}`);
}

// ---------- 右鍵選單 ----------
const closeMenu = () => {for (const m of document.querySelectorAll('.ctxmenu')) m.remove();};
addEventListener('pointerdown', (e) => {if (!e.target.closest?.('.ctxmenu, .tpick-pop')) closeMenu();});
addEventListener('keydown', (e) => {if (e.key === 'Escape') {closeMenu(); if (S.pick) {S.pick = null; renderRight();}}});

// items: [[文字, fn, 反灰的原因（有＝不能按，滑過看原因）, 子選單 items]]，'-'＝分隔線，DOM 元素原樣放，falsy 略過；有子選單的滑過展開在右邊
function menu(e, items)
{
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    menuAt(e.clientX, e.clientY, items, 0);
}

function menuAt(x, y, items, lv, flipX = null)
{
    const el = h('div', {class: 'ctxmenu', dataset: {lv}, style: `left:${x}px;top:${y}px`},
        items.filter(Boolean).map(it => {
            if (it === '-') return h('hr');
            if (it instanceof Node)
            {
                it.addEventListener('mouseenter', () => {
                    for (const m of document.querySelectorAll('.ctxmenu')) if (+m.dataset.lv > lv) m.remove();
                    for (const o of el.querySelectorAll('button.open')) o.classList.remove('open');
                });
                return it;
            }
            const sub = it[3]?.filter(Boolean);
            const b = h('button', {type: 'button', class: sub ? 'sub' : '', disabled: !!it[2] || (sub && !sub.length), title: it[2] || null,
                onclick: () => {if (!sub) {closeMenu(); it[1]?.();}}}, it[0]);
            b.onmouseenter = () => {
                for (const m of document.querySelectorAll('.ctxmenu')) if (+m.dataset.lv > lv) m.remove();
                for (const o of el.querySelectorAll('button.open')) o.classList.remove('open');
                if (!sub?.length || b.disabled) return;
                b.classList.add('open');
                const rc = b.getBoundingClientRect(), box = el.getBoundingClientRect();
                menuAt(box.right, rc.top - 4, sub, lv + 1, box.left);
            };
            return b;
        }));
    document.body.append(el);
    // 放不下：子選單翻到母選單左邊（flipX＝母選單左緣），再不行貼齊畫面；太高就在選單裡捲動
    const rc = el.getBoundingClientRect();
    if (rc.right > innerWidth) el.style.left = `${Math.max(0, flipX !== null && flipX - rc.width >= 0 ? flipX - rc.width : innerWidth - rc.width)}px`;
    if (rc.bottom > innerHeight) el.style.top = `${Math.max(0, innerHeight - rc.height)}px`;
    return el;
}

// ---------- 拖角色到子分類 ----------
// 拖到同 kind 的子分類標題＝改 grp、拖到 kind 標題＝清掉；別的 kind 擋（改 kind 要去表單）
// 沒拖動（< 4px）當作點一下；拖過的話吃掉接著來的 click
function dropTarget(x, y)
{
    const el = document.elementFromPoint(x, y)?.closest('#list .group[data-kind]');
    return el && {el, kind: el.dataset.kind, grp: el.dataset.grp};
}

function dragRole(e, id)
{
    if (e.button !== 0) return;
    const src = e.currentTarget, sx = e.clientX, sy = e.clientY;
    let moved = false, ghost = null, hot = null;
    const unmark = () => {hot?.classList.remove('drop', 'bad'); hot = null;};
    if (e.isTrusted) src.setPointerCapture(e.pointerId);
    src.onpointermove = (ev) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        unmark();
        const tgt = dropTarget(ev.clientX, ev.clientY);
        if (tgt) (hot = tgt.el).classList.add(tgt.kind === kindOf(S.data[id]) ? 'drop' : 'bad');
        if (!ghost) document.body.append(ghost = h('div', {class: 'ghost'}, IC.iconEl(S.data[id].icon, 24), h('span', null, id)));
        ghost.style.left = `${ev.clientX + 12}px`;
        ghost.style.top = `${ev.clientY + 12}px`;
    };
    src.onpointerup = (ev) => {
        src.onpointermove = src.onpointerup = null;
        ghost?.remove();
        unmark();
        if (!moved) return;
        const eat = (c) => {c.preventDefault(); c.stopPropagation();};
        const stop = () => removeEventListener('click', eat, {capture: true});
        addEventListener('click', eat, {capture: true, once: true});
        addEventListener('pointerdown', stop, {capture: true, once: true});
        setTimeout(stop, 300);
        dropRole(id, dropTarget(ev.clientX, ev.clientY));
    };
}

function dropRole(id, tgt)
{
    if (!tgt) return;
    const r = S.data[id];
    if (tgt.kind !== kindOf(r)) return status(`${id} 是「${SC.KIND_NAMES[kindOf(r)] ?? (kindOf(r) || '無分類')}」，不能拖到別的分類；要改 kind 請到表單改`);
    if ((r.grp ?? '') === (tgt.grp ?? '')) return;
    setGrp(id, tgt.grp);
}

// ---------- 新增 ----------
// 有子分類的話排在同子分類最後，沒有的話排在同 kind 最後
function add(id, kind, sex, grp)
{
    const err = D.idError(id);
    if (err) return status(err);
    const keys = Object.keys(S.data);
    const same = (k) => kindOf(S.data[k]) === (kind ?? '');
    const at = grp ? keys.findLastIndex(k => same(k) && S.data[k].grp === grp) : -1;
    const last = at >= 0 ? at : keys.findLastIndex(same);
    commit(() => {
        const r = SC.template(kind, sex);
        if (grp) putGrp(r, grp);
        D.insertAt(last < 0 ? keys.length : last + 1, id, r);
        S.sel = id;
    });
}

// 標準身體跟著換，專屬身體跟其他部位不動
function setSex(id, sex)
{
    commit(() => {
        const r = S.data[id];
        setAt(r, ['sex'], sex);
        if (SC.isStdBody(r.body)) r.body = SC.stdBody(sex);
    });
}

async function askNew()
{
    const cur = S.data[S.sel];
    const id = h('input', {size: 24}), kind = h('select', null, SC.KINDS.map(k => h('option', {value: k}, `${SC.KIND_NAMES[k]}　${k}`)));
    kind.value = cur?.kind ?? 'npc';
    const sexLab = h('span', {class: 'k'}, '性別'), sex = h('select', {dataset: {k: 'newSex'}}, h('option', {value: ''}, '男'), h('option', {value: 'f'}, '女'));
    // 子分類預設跟目前選的角色一樣（同 kind 才帶）
    const grp = h('input', {size: 24, dataset: {k: 'newGrp', combo: 'dl-newGrp'}});
    const sync = () => {
        sexLab.hidden = sex.hidden = !SC.HUMAN_KINDS.includes(kind.value);
        grp.value = cur && kindOf(cur) === kind.value ? cur.grp ?? '' : '';
        renderDatalists({newGrp: grpsOf(kind.value)});
    };
    kind.onchange = sync;
    sync();
    const p = ask('新角色', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '分類'), kind,
            h('span', {class: 'k'}, '子分類'), grp, sexLab, sex),
        h('div', {class: 'hint'}, '依分類套範本；要照現有角色改的話，選那個角色按「複製」')], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    const ok = await p === 'ok';
    render();
    if (ok) add(id.value.trim(), kind.value, sex.value, grp.value.trim() || undefined);
}

// ---------- 表單：一般欄位 ----------
function objBox(id, k, def, v)
{
    const known = (f) => !!def.fields[f];
    const o = isObj(v) ? v : {};
    const open = v !== undefined && F.isOpen(k, v);
    const sprite = def.fields.sprite && o.sprite;
    return h('div', {class: 'box'},
        F.boxBar(k, open, v !== undefined, h('span', {title: k}, def.label),
            sprite ? IC.iconEl(sprite, 20) : null,
            v !== undefined && h('span', {class: 'dim'}, Object.entries(o).filter(([, x]) => typeof x !== 'object').map(([a, x]) => `${a}:${x}`).join('  ')),
            h('span', {class: 'grow'}),
            v === undefined ? h('button', {type: 'button', onclick: () => {S.open[k] = true; set(id, [k], {});}}, '建立')
                            : h('button', {type: 'button', onclick: () => set(id, [k], undefined)}, '移除')),
        open && h('div', {class: 'fields'},
            Object.entries(def.fields).map(([f, d]) => [
                h('span', {class: 'k' + (o[f] === undefined ? ' unset' : ''), title: `${k}.${f}`}, d.label),
                fieldInput(d, o[f], val => set(id, [k, f], val), `${k}.${f}`),
            ]),
            h('span', {class: 'k unset'}, '其他'),
            F.rawArea(o, known, raw => commit(() => {S.data[id][k] ??= {}; replaceRaw(S.data[id][k], known, raw);}), `${k}.#raw`)));
}

function fieldRow(id, r, k)
{
    const def = SC.FIELDS[k], v = r[k];
    if (def.type === 'obj') return objBox(id, k, def, v);
    if (def.type === 'inv') return invBox(id, v);
    if (def.type === 'schedule') return schedBox(id, v);
    const lab = h('span', {class: 'k' + (v === undefined ? ' unset' : ''), title: k}, def.label);
    if (def.type === 'part') return [lab, F.withDrop(partField(id, k, v), id, k, v)];
    const inp = fieldInput(def, v, val => (k === 'sex' ? setSex(id, val) : k === 'grp' ? setGrp(id, val) : k === 'kind' ? setKind(id, val) : set(id, [k], val)), k);
    if (k === 'icon') inp.append(h('button', {type: 'button', disabled: !canPortrait(r), title: '頭＋頭髮照遊戲擺放疊起來，存成 textures/roles/portraits/portrait-<id>.png',
        onclick: () => genPortrait(id).catch(e => status(e.message))}, '由頭+髮產生'));
    return [lab, F.withDrop(inp, id, k, v)];
}

// ---------- 表單：部位（part.json 的 id） ----------
// pool 選圖器照 kind 列條目：點一下選、「無」清掉；右鍵條目改名（連帶改 role.json 的引用、存檔）／刪除（有角色在用就擋）
const partUsers = (pid) => PT.usersOf(S.data, pid);

function partField(id, k, v)
{
    const p = S.ext.parts[v], sex = S.data[id].sex;
    return h('span', {class: 'iconField'},
        IC.iconEl(p?.sprite, 32),
        h('input', {dataset: {k, combo: `dl-${k}`}, value: v ?? '', onchange: e => set(id, [k], e.target.value.trim() || undefined)}),
        h('button', {type: 'button', onclick: async () => {const r = await pickPart(k, v, sex); if (r !== null) set(id, [k], r || undefined);}}, '選…'),
        p && !sexOk(p, sex) && h('span', {class: 'warn', title: `${SEX_NAMES[p.sex] ?? p.sex}，但角色是${sexName(sex)}`}, '⚠'));
}

// 回傳選到的 id，''＝無，null＝取消；只列 sex 符合角色的（目前選的不符也留著、標 ⚠）
function pickPart(kind, cur, sex)
{
    const dlg = $('dlgPart');
    let done;
    const pick = (v) => {done = v; dlg.close();};
    const draw = () => {
        const ids = Object.keys(S.ext.parts).filter(pid => S.ext.parts[pid].kind === kind && (sexOk(S.ext.parts[pid], sex) || pid === cur));
        const tile = (pid, icon, lab, title) => h('div', {class: 'tile' + ((cur ?? '') === pid ? ' sel' : ''), dataset: {id: pid}, title,
            onclick: () => pick(pid), oncontextmenu: pid ? (e) => {e.preventDefault(); partMenu(pid).then(draw);} : null}, icon, h('div', {class: 'lab'}, lab));
        dlg.querySelector('.title').textContent = `選擇${SC.FIELDS[kind].label}（part.json，右鍵改名／刪除）`;
        dlg.querySelector('.tiles').replaceChildren(
            tile('', IC.iconEl(null, 48), '無', '清掉'),
            ...ids.map(pid => {
                const n = partUsers(pid).length, p = S.ext.parts[pid], bad = !sexOk(p, sex), name = PT.nameOf(S.ext.parts, pid);
                return tile(pid, IC.iconEl(p.sprite, 48), bad ? `⚠ ${name}` : name,
                    `${pid}${bad ? `（${SEX_NAMES[p.sex] ?? p.sex}，但角色是${sexName(sex)}）` : ''}${n ? `（${n} 個角色在用：${partUsers(pid).join('、')}）` : '（沒有角色在用）'}`);
            }));
    };
    draw();
    dlg.onclick = (e) => {if (e.target === dlg) dlg.close();};
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(done ?? null), {once: true}));
}

async function partMenu(pid)
{
    const r = await ask(pid, h('div', {class: 'dim'}, `${partUsers(pid).length} 個角色在用`), [['rename', '改名…'], ['delete', '刪除…'], ['cancel', '取消']]);
    if (r === 'rename') await renamePart(pid);
    if (r === 'delete') await deletePart(pid);
}

// part.json 立刻寫；role.json 的引用一起改（一步 undo）然後存檔，兩邊才不會對不上
async function renamePart(from)
{
    const users = partUsers(from), to = await PT.askRename(S.assets.json, S.assets.root, from, users);
    if (!to) return;
    S.ext.parts = await PT.rename(S.assets.json, from, to);
    if (users.length)
    {
        commit(() => PT.renameRefs(S.data, from, to));
        await D.save();
    }
    status(`已改名 ${from} → ${to}${users.length ? `（${users.join('、')}）` : ''}`);
}

async function deletePart(pid)
{
    if (!await PT.askDelete(pid, partUsers(pid))) return;
    S.ext.parts = await PT.remove(S.assets.json, pid);
    status(`已刪除 ${pid}`);
}

// 部位分頁改名會直接寫 role.json：還沒存的話先在記憶體跟著改，存檔合併時才不會被舊 id 蓋回去（沒改過的會因為存檔通知重讀）
SH.onPartRenamed((from, to) => {if (D.isDirty()) commit(() => PT.renameRefs(S.data, from, to));});

// ---------- 由頭+髮產生頭像 ----------
const PORTRAIT_DIR = ['textures', 'roles', 'portraits'];
const headParts = (r) => ['head', 'hair'].map(k => partFor(S.ext.parts, r, k)).filter(p => p?.sprite);
const canPortrait = (r) => headParts(r).length > 0;

async function genPortrait(id)
{
    const r = S.data[id], name = `portrait-${id}`;
    const url = IC.IMAGES[name];
    if (url && !url.includes(`/${PORTRAIT_DIR.join('/')}/`)) return status(`textures 別的資料夾已經有 ${name}，換不了`);
    const c = await portraitOf(headParts(r), ST.get('portrait'));
    if (!c) return status('頭／頭髮的圖讀不到或是全透明');
    let dir = S.assets.dir;
    for (const seg of PORTRAIT_DIR) dir = await dir.getDirectoryHandle(seg, {create: true});
    if (r.icon !== name && await FS.tryFile(dir, `${name}.png`)
        && await ask(`覆蓋 ${name}.png`, h('div', null, `textures/${PORTRAIT_DIR.slice(1).join('/')}/${name}.png 已經有了`), [['ok', '覆蓋'], ['cancel', '取消']]) !== 'ok') return;
    await FS.writeFile(dir, `${name}.png`, await toPng(c));
    set(id, ['icon'], name);
    status(`已產生 ${PORTRAIT_DIR.slice(1).join('/')}/${name}.png，icon 改成 ${name}（圖片清單會自動更新）`);
}

// ---------- 表單：物品欄 ----------
// 存檔保留原寫法：字串就留字串（數量改成不是 1 才變 {id, count}），物件就留物件
function ensureArr(r, path)
{
    let o = r;
    for (const k of path.slice(0, -1)) o = isObj(o[k]) ? o[k] : (o[k] = {});
    return Array.isArray(o[path.at(-1)]) ? o[path.at(-1)] : (o[path.at(-1)] = []);
}

// combo：輸入框的建議清單（裝備是 dl-equips，只列有 equip、sex 符合角色的）；穿著不符的標紅
function itemCell(id, path, i, e, withCount, combo)
{
    const obj = isObj(e), iid = idOf(e), n = obj ? e.count ?? 1 : 1, it = S.ext.items[iid];
    const k = `${path.join('.')}.${i}`;
    const put = (fn) => commit(() => fn(getAt(S.data[id], path)));
    const wrong = combo === 'equips' && it && !sexOk(it, S.data[id].sex);
    return h('div', {class: 'cell' + (it && !wrong ? '' : ' bad'),
            title: !it ? `不存在的道具：${iid}` : wrong ? `${iid}　${SEX_NAMES[it.sex] ?? it.sex}，但角色是${sexName(S.data[id].sex)}` : `${iid}　${it.lab ?? ''}`},
        h('span', {class: 'pick', title: '換成別的道具…', dataset: {k: `${k}#pick`},
            onclick: () => pickItem(S.ext.items, {title: '換成…', multi: false, filter: itemFilter(id, combo), count: itemCount(id, path),
                onPick: v => put(a => {if (obj) a[i].id = v; else a[i] = v;})})}, IC.iconEl(it?.icon, 28)),
        h('input', {size: 10, dataset: {k, combo: `dl-${combo}`}, value: iid ?? '',
            onchange: ev => {const v = ev.target.value.trim(); put(a => {if (!v) a.splice(i, 1); else if (obj) a[i].id = v; else a[i] = v;});}}),
        withCount && h('input', {class: 'cnt', title: '數量', dataset: {k: `${k}#n`}, value: n,
            onchange: ev => {const c = parseNum(ev.target.value) ?? 1; put(a => {if (obj) a[i].count = c; else if (c !== 1) a[i] = {id: iid, count: c};});}}),
        h('button', {type: 'button', title: '移除', onclick: () => put(a => a.splice(i, 1))}, '×'));
}

function cells(id, list, path, withCount, combo = 'items')
{
    return h('div', {class: 'cells'},
        list.map((e, i) => itemCell(id, path, i, e, withCount, combo)),
        h('button', {type: 'button', class: 'add', title: '加道具…', dataset: {k: `${path.join('.')}.+`},
            onclick: () => pickItem(S.ext.items, {title: withCount ? '加道具' : '加裝備', filter: itemFilter(id, combo), count: itemCount(id, path),
                onPick: v => commit(() => addItem(ensureArr(S.data[id], path), v, withCount))})}, '＋'));
}

// 裝備只列有 equip、sex 符合角色的
const itemFilter = (id, combo) => (combo === 'equips' ? (_, it) => isObj(it.equip) && sexOk(it, S.data[id].sex) : () => true);
const itemCount = (id, path) => (iid) => (getAt(S.data[id], path) ?? []).reduce((n, e) => n + (idOf(e) === iid ? (isObj(e) ? e.count ?? 1 : 1) : 0), 0);

// 有數量的（道具）已經有就 +1，字串變 {id, count}；裝備照樣多一格
function addItem(a, iid, withCount)
{
    const i = withCount ? a.findIndex(e => idOf(e) === iid) : -1;
    if (i < 0) a.push(iid);
    else if (isObj(a[i])) a[i].count = (a[i].count ?? 1) + 1;
    else a[i] = {id: iid, count: 2};
}

function invBox(id, v)
{
    const inv = isObj(v) ? v : {}, st = isObj(inv.storage) ? inv.storage : {};
    const items = Array.isArray(st.items) ? st.items : [], equips = Array.isArray(inv.equips) ? inv.equips : [];
    const open = v !== undefined && (S.open.inv ??= true);
    const knownInv = (k) => k === 'storage' || k === 'equips', knownSt = (k) => k === 'capacity' || k === 'items';
    return h('div', {class: 'box'},
        F.boxBar('inv', open, v !== undefined, h('span', {title: 'inv'}, '物品欄'),
            v !== undefined && h('span', {class: 'dim'}, `（道具 ${items.length}、裝備 ${equips.length}）`), h('span', {class: 'grow'}),
            v === undefined ? h('button', {type: 'button', onclick: () => {S.open.inv = true; set(id, ['inv'], {storage: {capacity: -1, items: []}});}}, '建立')
                            : h('button', {type: 'button', onclick: () => set(id, ['inv'], undefined)}, '移除')),
        open && h('div', {class: 'fields'},
            h('span', {class: 'k' + (st.capacity === undefined ? ' unset' : ''), title: 'inv.storage.capacity'}, '容量'),
            h('span', null, fieldInput({type: 'int'}, st.capacity, val => set(id, ['inv', 'storage', 'capacity'], val), 'inv.storage.capacity'), h('span', {class: 'dim'}, '　-1 = 無限')),
            h('span', {class: 'k', title: 'inv.storage.items'}, '道具'), cells(id, items, ['inv', 'storage', 'items'], true),
            h('span', {class: 'k', title: 'inv.equips'}, '裝備'), cells(id, equips, ['inv', 'equips'], false, 'equips'),
            h('span', {class: 'k unset'}, '其他'),
            F.rawArea(inv, knownInv, raw => commit(() => {S.data[id].inv ??= {}; replaceRaw(S.data[id].inv, knownInv, raw);}), 'inv.#raw'),
            isObj(inv.storage) && [h('span', {class: 'k unset'}, 'storage 其他'),
                F.rawArea(st, knownSt, raw => commit(() => replaceRaw(S.data[id].inv.storage, knownSt, raw)), 'inv.storage.#raw')]));
}

// ---------- 表單：作息 ----------
// 選中的那筆（時序條反白、下面顯示它的卡片、右欄地圖畫它的路線）：換角色＝沒選（-1）
const schSel = (id) => {
    const n = S.data[id]?.schedule?.length ?? 0;
    return !n || S.schSel?.id !== id ? -1 : Math.min(S.schSel.i, n - 1);
};
// 不重畫左邊表單（點的可能是卡片裡的按鈕／輸入框），只換反白、重畫右欄
// 打開角色的表單、作息段、選第 i 張卡片、右欄切到作息地圖（總覽甘特圖點一段、地圖分頁點作息點跳過來）
function openSch(id, i)
{
    if (!S.data[id]?.schedule?.[i]) {S.sel = id; S.view = 'form'; render(); return;}
    Object.assign(S, {sel: id, view: 'form', schSel: {id, i}, schMulti: null, rtab: 'sched'});
    try {localStorage.setItem('tools.role.rtab', 'sched');} catch {}
    S.secOpen['作息'] = true;
    S.open.schedule = true;
    SM.focusSch(S.data[id].schedule[i]);
    render();
    document.querySelector(`#view .card[data-sch="${i}"]`)?.scrollIntoView({block: 'nearest'});
}

// 多選（Shift＋點）：S.schMulti＝{id, s, len, n}，從第 s 筆起連續 len 筆；筆數變了（undo、刪除…）就失效＝null
// multiSel＝反白用（總覽 Shift＋點第一下只有一筆也反白）；schMulti＝真的多選（≥2 筆）
const multiSel = (id) => {
    const m = S.schMulti, n = S.data[id]?.schedule?.length ?? 0;
    return m?.id === id && m.n === n && n ? SE.rangeIdx(n, m.s, m.len) : null;
};
const schMulti = (id) => {const x = multiSel(id); return x?.length >= 2 ? x : null;};

function pickSch(id, i, shift)
{
    const a = schSel(id), n = S.data[id].schedule?.length ?? 0;
    if (!shift || a < 0 || a === i || n < 2) return selectSch(id, i);
    S.schMulti = {id, n, a, ...SE.pickRange(n, a, i)};
    SB.markSel(document.getElementById('view'), schMulti(id));
    document.querySelector('#view .schslot')?.replaceChildren(schSlot(id));
}

// 總覽 Shift＋點：錨點＝這列第一次 Shift＋點的那段（S.schMulti.a），換列重來
function ganttMulti(id, i)
{
    const n = S.data[id].schedule?.length ?? 0, m = S.schMulti;
    const a = m?.id === id && m.n === n ? m.a : i;
    S.schMulti = {id, n, a, ...(a === i ? {s: i, len: 1} : SE.pickRange(n, a, i))};
    render();
}

function selectSch(id, i)
{
    if (S.schSel?.id === id && S.schSel.i === i && !S.schMulti) return;
    S.schSel = {id, i};
    S.schMulti = null;
    if (S.routeEdit && !editingRoute(id, i)) {S.routeEdit = null; for (const b of document.querySelectorAll('#view .routebtn.on')) {b.classList.remove('on'); b.textContent = '✎ 編輯路線';}}
    SM.focusSch(S.data[id].schedule[i]);
    SB.markSel(document.getElementById('view'), i);
    document.querySelector('#view .schslot')?.replaceChildren(schSlot(id));
    renderRight();
}
// ---------- 作息地圖右鍵：新增目的地／改目的地（dest＝{go: 物件名稱} 或 {at: [tx, ty]}） ----------
// 換目的地：go／at 互換時新的 key 放在舊的位置，key 順序不亂
function putDest(s, map, dest)
{
    const [k, v] = dest.at ? ['at', dest.at] : ['go', dest.go], drop = k === 'at' ? 'go' : 'at';
    const out = {};
    for (const [a, b] of Object.entries(s)) out[a === drop ? k : a] = a === drop ? v : b;
    out.map = map;
    out[k] = v;
    for (const a of Object.keys(s)) delete s[a];
    Object.assign(s, out);
}

function setDest(id, i, map, dest)
{
    S.secOpen['作息'] = true;
    S.open.schedule = true;
    commit(() => putDest(S.data[id].schedule[i], map, dest));
}

const toMin = (v) => {const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;};

const destName = (map, dest) => (dest.at ? `${map} 格 ${dest.at.join(',')}` : `${map}／${dest.go}`);

// 在 t（抵達）插入新目的地，停 1 小時後回原處（SE.insertAt）；同一時間擋下
function insertSch(id, t, map, dest)
{
    const a = Array.isArray(S.data[id].schedule) ? S.data[id].schedule : [];
    const pl = planOf(id), m = SP.mod(t);
    const same = a.findIndex((_, k) => pl.plan?.[k]?.arr === m);
    if (same >= 0) return status(`已經有一筆是 ${SP.hhmm(m)} 抵達`);
    const at = a.length ? SE.stayAt(SB.daySegs(pl.plan, a, pl.warns), m, a.length) : -1;
    S.secOpen['作息'] = true;
    S.open.schedule = true;
    let k = -1;
    commit(() => {
        k = SE.insertAt(ensureArr(S.data[id], ['schedule']), pl.plan, at, m, map, dest);
        S.schSel = {id, i: k};
        SM.focusSch(S.data[id].schedule[k]);
    });
    const two = S.data[id].schedule.length - a.length > 1;
    const sameD = at >= 0 && SE.sameDest(S.data[id].schedule[at], {map, ...dest});
    status(`插入：${SP.hhmm(m)} 抵達 ${destName(map, dest)}${two ? `，${SP.hhmm(SP.mod(m + SE.STAY))} 回原處` : sameD ? '（剩不到一小時，等於分割）' : ''}`);
}

// 地圖右鍵「新增目的地…」：問抵達時間（預設選中那筆抵達 +1 小時，沒選＝08:00）再插入
async function addDest(id, map, dest)
{
    const plan = planOf(id).plan, i = schSel(id);
    const def = i >= 0 && plan?.[i] ? SP.hhmm(SP.mod(plan[i].arr + 60)) : '08:00';
    let val = def;
    if (await ask('新增目的地', [h('div', null, destName(map, dest)), h('label', null, '抵達時間 ', timePick('arriveAt', def, v => {val = v;}))], [['ok', '確定'], ['cancel', '取消']]) !== 'ok') return;
    insertSch(id, toMin(val), map, dest);
}

// 分層目的地子選單：世界圖 ▸ 點／🏠 室內圖 ▸ 點；最後「在地圖上選…」；cur＝目前那筆（打 ✔）
function destMenu(fn, onPickMode, cur = null)
{
    const on = (m, n) => cur && cur.map === m && cur.go === n;
    const has = (m) => cur && cur.map === m;
    const pts = (m, names) => names.map(n => [`${on(m, n) ? '✔ ' : ''}${n}`, () => fn(m, {go: n})]);
    const tree = SE.destTree(navAll());
    return [
        ...tree.map(w => [`${has(w.map) || w.rooms.some(r => has(r.map)) ? '✔ ' : ''}${w.map.split('/').at(-1)}`, null, '', [
            ...pts(w.map, w.names),
            w.names.length && w.rooms.length && '-',
            ...w.rooms.map(r => [`${has(r.map) ? '✔ ' : ''}🏠 ${r.map.split('/').at(-1)}`, null, '', pts(r.map, r.names)]),
        ]]),
        '-',
        [`🗺 在地圖上選…`, onPickMode],
    ];
}

function typeMenu(id, i)
{
    const cur = S.data[id].schedule[i]?.type;
    return [
        ...SC.schTypes(S.ext.local).map(t => [`${t === cur ? '✔ ' : ''}${SC.typeName(S.ext.local, t)}`, () => set(id, ['schedule', i, 'type'], t)]),
        [`${cur ? '' : '✔ '}（無）`, () => set(id, ['schedule', i, 'type'], undefined)],
        '-',
        ['＋ 新類型…', () => newType(id, i)],
    ];
}

// 進「在地圖上選」：右欄切到作息地圖，點了 fn(map, dest)
function pickOnMap(id, text, fn)
{
    S.pick = {id, text, fn};
    if (S.rtab !== 'sched') {S.rtab = 'sched'; try {localStorage.setItem('tools.role.rtab', 'sched');} catch {}}
    if (S.view === 'form' && S.sel === id) return renderRight();
    Object.assign(S, {sel: id, view: 'form', schMulti: null});
    S.secOpen['作息'] = true;
    S.open.schedule = true;
    render();
}

// 時序條右鍵：t＝那裡的分鐘；gantt＝總覽那列（不選取、不跳頁，只有「在地圖上選」進表單）
function barMenu(e, id, t, gantt = false)
{
    const a = S.data[id].schedule ?? [];
    const pl = planOf(id), segs = a.length ? SB.daySegs(pl.plan, a, pl.warns) : [];
    const ins = Math.round(t / SE.SNAP) * SE.SNAP;
    const hit = segs ? SE.entryAt(segs, t) : -1;
    const multi = schMulti(id);
    if (gantt && S.schMulti && !multi?.includes(hit)) {S.schMulti = null; render();}
    if (multi && multi.includes(hit)) return menu(e, [
        [`合併 ${multi.length} 筆`, null, '', mergeMenu(id, multi)],
        [`刪除 ${multi.length} 筆`, () => delRange(id, multi)],
    ]);
    const insert = (m, d) => insertSch(id, ins, m, d);
    const change = (m, d) => setDest(id, hit, m, d);
    const sp = a.length && segs ? SE.splitCheck(segs, ins) : {why: a.length ? '作息資料有問題，先修好' : '沒有作息'};
    menu(e, [
        [`插入作息（${SP.hhmm(SP.mod(ins))} 抵達）`, null, segs ? '' : '作息資料有問題，先修好', destMenu(insert, () => pickOnMap(id, `插入 ${SP.hhmm(SP.mod(ins))} 抵達的目的地`, insert))],
        a.length > 0 && [`分割（${SP.hhmm(SP.mod(ins))}）`, () => splitSch(id, sp.i, ins), sp.why ?? ''],
        hit >= 0 && ['改目的地', null, '', destMenu(change, () => pickOnMap(id, '改目的地', change))],
        hit >= 0 && ['類型', null, '', typeMenu(id, hit)],
        hit >= 0 && stayRow(id, hit, !pl.plan?.[hit] ? '作息資料有問題，先修好' : a.length < 2 ? '只有一筆＝整天' : ''),
        hit >= 0 && '-',
        hit >= 0 && ['刪除這筆', () => delSch(id, hit)],
    ]);
    if (!gantt && hit >= 0 && (schSel(id) !== hit || S.schMulti)) selectSch(id, hit);
}

// 分割：t 那段停留切成兩筆同目的地，選新的那筆
function splitSch(id, i, t)
{
    commit(() => {S.schSel = {id, i: SE.splitAt(S.data[id].schedule, i, t)};});
    status(`分割：${SP.hhmm(SP.mod(t))} 起另成一筆`);
}

// 合併子選單：每筆一行（同內容去重），選了留它的目的地／do／type／route
function mergeMenu(id, idx)
{
    const a = S.data[id].schedule, seen = new Set();
    return idx.map(k => {
        const {t, ...rest} = a[k], key = JSON.stringify(rest);
        if (seen.has(key)) return null;
        seen.add(key);
        return [`${schLabel(id, k)} 抵達 ${destName(a[k].map, a[k])}${a[k].do ? ` ${a[k].do}` : ''}`, () => mergeSch(id, k)];
    });
}

function mergeSch(id, keep)
{
    const m = S.schMulti, n = m.len;
    commit(() => {
        S.schSel = {id, i: SE.mergeRange(S.data[id].schedule, m.s, m.len, keep)};
        S.schMulti = null;
    });
    status(`合併 ${n} 筆`);
}

function delRange(id, idx)
{
    const m = S.schMulti;
    commit(() => {
        const a = S.data[id].schedule;
        const k = SE.removeRange(a, m.s, m.len);
        if (!a.length) delete S.data[id].schedule;
        S.schSel = {id, i: k};
        S.schMulti = null;
    });
    status(`刪除 ${idx.length} 筆`);
}

// 刪除：時間交給前一段，前後同目的地合併
function delSch(id, i)
{
    commit(() => {
        const a = S.data[id].schedule;
        const k = SE.removeAt(a, i);
        if (!a.length) delete S.data[id].schedule;
        S.schSel = {id, i: k};
    });
}

// 拖分界線：第 j 筆的時間照原本型別平移
function shiftSch(id, js, delta)
{
    commit(() => {
        for (const j of js)
        {
            const s = S.data[id].schedule[j];
            s.t = SE.shiftT(s.t, delta);
        }
    });
}

async function newType(id, i)
{
    const idIn = h('input', {size: 14, dataset: {k: 'typeId'}, placeholder: 'ASCII，例如 pray'});
    const nameIn = h('input', {size: 10, dataset: {k: 'typeName'}, placeholder: '中文，例如 禱告'});
    if (await ask('新類型（寫進 local.json 的 sch.<id>）', [h('label', null, 'id ', idIn), ' ', h('label', null, '名稱 ', nameIn)], [['ok', '新增'], ['cancel', '取消']]) !== 'ok') return;
    const tid = idIn.value.trim(), lab = nameIn.value.trim();
    if (!/^[a-z][a-z0-9_-]*$/.test(tid)) return status('id 只能小寫英數 _ -，英文字母開頭');
    if (!lab) return status('要填名稱');
    if (SC.schTypes(S.ext.local).includes(tid)) return status(`已經有 ${tid}`);
    try
    {
        const local = JSON.parse(await FS.readText(S.assets.json, 'local.json'));
        local[`sch.${tid}`] = {lab, grp: 'sched'};
        await FS.writeFile(S.assets.json, 'local.json', new Blob([JSON.stringify(local, null, 2)]));
        SH.notifySaved('local.json');
        S.ext.local = local;
    }
    catch (e) {return status(`local.json 寫不進去：${e.message}`);}
    set(id, ['schedule', i, 'type'], tid);
    status(`新類型 ${tid}（${lab}）寫進 local.json`);
}

// x＝schedMapEl 給的 {name, type, door, tile, blocked, inNav, enter}
async function mapMenu(e, id, map, x)
{
    const dn = x.door?.o.name;
    const point = x.type === 'point' ? [['改名…', () => renamePoint(map, x.name)], ['刪除…', () => deletePoint(map, x.name)]]
        : dn ? [[`改名 ${dn}…`, () => renamePoint(map, dn)]] : null;
    if (S.routeEdit) return point && menu(e, point);
    const obj = x.name ?? x.door?.o.name, i = schSel(id);
    const dest = obj ? {go: obj} : {at: x.tile};
    const why = !x.inNav ? '這張圖不在路網裡（先更新路網）' : !obj && x.blocked ? '這格走不到' : '';
    const d = await SM.mapData(map);
    menu(e, [
        x.enter && ['進入', x.enter],
        x.enter && '-',
        ['新增目的地…', () => addDest(id, map, dest), why],
        i >= 0 && [`改成選中那筆（${schLabel(id, i)}）的目的地`, () => setDest(id, i, map, dest), why],
        !obj && ['新增 point…', () => newPoint(id, map, x.tile[0] * d.map.tilewidth, x.tile[1] * d.map.tileheight, d)],
        point && '-', ...(point || []),
    ]);
}

// ---------- 作息地圖：改 point（寫 Tiled 地圖）、路網過期 ----------
// 地圖先讀專案資料夾（剛寫的、測試的假資料夾），讀不到才走 dev server
SM.setReader(async (rel) => {
    if (!S.assets) return null;
    try {return JSON.parse(await (await (await FS.resolveFile(S.assets.dir, rel)).file.getFile()).text());}
    catch {return null;}
});
S.stale = null;                                  // 比 navgraph.json 新的地圖
S.navMsg = '';                                   // 上次「更新路網」的結果
let staleBusy = false;
async function checkStale()
{
    if (staleBusy || !S.assets) return;
    staleBusy = true;
    try
    {
        const st = await ME.staleMaps(S.assets.dir, Object.keys(S.ext.maps));
        if (JSON.stringify(st) !== JSON.stringify(S.stale)) {S.stale = st; renderRight();}
    }
    finally {staleBusy = false;}
}

const writeMap = (map, fn, msg) => writeMaps([map], d => fn(d[map]), msg);

// fn({地圖: data})，全部改好才一起寫
async function writeMaps(maps, fn, msg)
{
    let done;
    try {done = await ME.editMaps(S.assets.dir, maps, fn);}
    catch (e) {status(e.message); return false;}
    if (done === false) return false;
    for (const m of done) {forgetMap(m); SH.notifySaved(`maps/${m}.json`);}
    status(`${msg}：已寫入 ${done.map(m => `maps/${m}.json`).join('、')}（Tiled 開著這張圖的話要重新載入，不然 Tiled 存檔會蓋掉）`);
    await checkStale();
    renderRight();
    return true;
}

async function askPointName(title, value, taken)
{
    const inp = h('input', {size: 24, value});
    const p = ask(title, h('label', null, '名稱 ', inp), [['ok', '確定'], ['cancel', '取消']]);
    inp.select();
    if (await p !== 'ok') return null;
    const v = inp.value.trim();
    if (!ID_RE.test(v)) {status(`名稱只能用英數、- 和 _：${v}`); return null;}
    if (taken.has(v)) {status(`這張圖已經有 ${v}`); return null;}
    return v;
}

// 新增 point（預設 <角色id>-p<n>，不碰作息）；編輯巡邏路線中＝加進路線
async function newPoint(id, map, x, y, d)
{
    let n = 1;
    while (d.named.has(`${id}-p${n}`)) n++;
    const name = await askPointName(`在 ${map} 新增 point`, `${id}-p${n}`, d.named);
    if (!name || !await writeMap(map, data => ME.addPoint(data, map, name, x, y), `新增 ${name}`)) return;
    if (S.routeEdit?.id === id) routeAdd(id, map, name);
}

const movePoint = (map, name, x, y) => writeMap(map, data => ME.movePoint(data, name, x, y), `移動 ${name}`);

async function renamePoint(map, from)
{
    const d = await SM.mapData(map);
    const users = ME.usersOf(S.data, map, from);
    const refs = await ME.portsTo(await ME.listMaps(S.assets.dir), ME.portsReader(S.assets.dir), map, from);
    const also = [refs.length && ME.portsText(refs), users.length && `role.json：${ME.usersText(users)}`].filter(Boolean);
    const to = await askPointName(`改名 ${from}${also.length ? `（一起改：${also.join('；')}）` : ''}`, from, new Set([...d.named.keys()].filter(k => k !== from)));
    if (!to || to === from) return;
    if (!await writeMaps([...new Set([map, ...refs.map(r => r.map)])], files => ME.renameNamed((m) => files[m], map, from, to, refs), `改名 ${from} → ${to}`)) return;
    if (!users.length) return;
    commit(() => ME.renameRefs(S.data, map, from, to));
    await D.save();
    status(`改名 ${from} → ${to}：地圖跟 role.json（${[...new Set(users.map(u => u.id))].join('、')}）都寫好了`);
}

async function deletePoint(map, name)
{
    const users = ME.usersOf(S.data, map, name);
    if (users.length)
    {
        await ask(`不能刪 ${name}`, h('div', null, `還有作息用到它：${ME.usersText(users)}`), [['ok', '知道了']]);
        return;
    }
    if (await ask(`刪除 ${name}？`, h('div', null, `從 ${map} 刪掉這個 point`), [['ok', '刪除'], ['cancel', '取消']]) !== 'ok') return;
    await writeMap(map, data => ME.deletePoint(data, name), `刪除 ${name}`);
}

async function updateNav()
{
    status('路網更新中…');
    S.navMsg = (await ME.updateNavgraph()).msg;
    status(S.navMsg.split('\n')[0]);
    await loadRefs();
    S.stale = null;
    await checkStale();
    render();
}

// ---------- 巡邏路線 ----------
S.routeEdit = null;                              // 編輯中的巡邏 {id, i, mark?}，mark＝標記的第幾次（新點插在它前面）
const editingRoute = (id, i) => S.routeEdit?.id === id && S.routeEdit.i === i;
function toggleRouteEdit(id, i)
{
    if (editingRoute(id, i)) S.routeEdit = null;
    else
    {
        S.routeEdit = {id, i};
        S.schSel = {id, i};
        S.rtab = 'sched';
        const m = S.data[id].schedule[i].map;
        if (m) SM.setMap(m);
    }
    render();
}
addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !S.routeEdit || document.querySelector('dialog[open]')) return;
    if (routeMark() != null) {S.routeEdit.mark = null; return renderRight();}
    S.routeEdit = null;
    render();
});

// 標記超出 route（undo、外部改檔）就當沒標
function routeMark()
{
    const re = S.routeEdit, m = re?.mark;
    if (m == null) return null;
    if (m < (S.data[re.id]?.schedule?.[re.i]?.route?.length ?? 0)) return m;
    re.mark = null;
    return null;
}

function routeToggleMark(idx)
{
    if (!S.routeEdit) return;
    S.routeEdit.mark = routeMark() === idx ? null : idx;
    renderRight();
}

function routeAdd(id, map, name)
{
    const i = S.routeEdit?.i, s = S.data[id].schedule[i];
    if (map !== s.map) return status(`巡邏路線只能用 ${s.map} 的點`);
    const m = routeMark();
    if (m != null) S.routeEdit.mark = m + 1;
    commit(() => {
        const a = S.data[id].schedule[i], rt = [...(a.route ?? [])];
        rt.splice(m ?? rt.length, 0, name);
        a.route = rt;
    });
}

function routeDel(id, idx)
{
    const i = S.routeEdit?.i, m = routeMark();
    if (m != null) S.routeEdit.mark = idx === m ? null : idx < m ? m - 1 : m;
    commit(() => {
        const a = S.data[id].schedule[i], rt = (a.route ?? []).filter((_, k) => k !== idx);
        a.route = rt.length ? rt : undefined;
    });
}

// 一圈／一趟多久（同遊戲 COM_Schedule._initPatrol：每點停 wait＋走到下一點；一趟的終點不算停）
function patrolInfo(s)
{
    if (!(s.route ?? []).length) return null;
    const {pts, repeat} = SP.patrolTrip(s), wait = s.wait ?? 0, k = (n) => `${s.map}:${n}`;
    const legs = SP.patrolLegs(s).map(([a, b]) => [a, b, SP.edgeCost(navAll().edges, k(a), k(b))]);
    const bad = legs.find(l => l[2] === Infinity);
    if (bad) return h('div', {class: 'times bad'}, `巡邏：${bad[0]} 走不到 ${bad[1]}（路網）`);
    const walk = legs.reduce((a, l) => a + l[2], 0), stops = repeat ? pts.length : pts.length - 1;
    const sum = `${hm(walk + wait * stops)}（走 ${hm(walk)}＋停 ${stops}×${wait}）`;
    return h('div', {class: 'times patrol'}, repeat ? `巡邏一圈 ${sum}` : `巡邏一趟 ${sum}，之後停在 ${SP.patrolEnd(s)}`);
}

function hm(n)
{
    const hr = Math.floor(n / 60), m = n % 60;
    return hr ? (m ? `${hr} 小時 ${m} 分` : `${hr} 小時`) : `${m} 分`;
}

// ---------- 作息格子 at：navgraph.json 還沒有的，先在記憶體補節點跟 walk 邊（算法同 scripts/navgraph.js），按「更新路網」才寫進去 ----------
S.atNav = {nodes: {}, edges: {}};
let atBusy = false, navMemo = null;
function resetAt() {S.atNav = {nodes: {}, edges: {}}; navMemo = null;}
// 地圖改了：丟掉烤好的圖，補的格子邊也重算
function forgetMap(m) {SM.forget(m); resetAt();}
// 所有角色作息裡、navgraph.json 沒有的格子 key
function atMissing()
{
    const out = new Set();
    for (const r of Object.values(S.data ?? {}))
        for (const s of Array.isArray(r?.schedule) ? r.schedule : [])
            if (Array.isArray(s?.at) && s.map && !S.ext.nav.nodes[SP.schKey(s)]) out.add(SP.schKey(s));
    return [...out];
}
// 路網＋補上的格子（給 buildPlan）
function navAll()
{
    if (!Object.keys(S.atNav.nodes).length) return S.ext.nav;
    if (navMemo?.base === S.ext.nav) return navMemo.nav;
    const edges = {...S.ext.nav.edges};
    for (const [k, list] of Object.entries(S.atNav.edges)) edges[k] = [...(edges[k] ?? []), ...list];
    navMemo = {base: S.ext.nav, nav: {nodes: {...S.ext.nav.nodes, ...S.atNav.nodes}, edges}};
    return navMemo.nav;
}
async function addAtNode(key)
{
    const i = key.indexOf(':'), map = key.slice(0, i), d = await SM.mapData(map);
    const n = d && SM.spotOf(d, key.slice(i + 1));
    if (!n) return false;
    const grid = SM.gridOf(d), pre = `${map}:`;
    const others = [...Object.keys(S.ext.nav.nodes), ...Object.keys(S.atNav.nodes)].filter(k => k.startsWith(pre) && k !== key);
    const add = (a, b, cost) => (S.atNav.edges[a] ??= []).push({to: b, cost, type: 'walk'});
    for (const k of others)
    {
        const tiles = SM.spotOf(d, k.slice(pre.length))?.tiles;
        if (!tiles) continue;
        const cost = Math.min(...tiles.map(sp => bestPath(grid, sp, n.tiles)?.length ?? Infinity));
        if (cost === Infinity) continue;
        add(key, k, cost);
        add(k, key, cost);
    }
    S.atNav.nodes[key] = {};
    navMemo = null;
    return true;
}
async function fillAt()
{
    if (atBusy) return;
    atBusy = true;
    let added = false;
    try {for (const k of atMissing()) if (!S.atNav.nodes[k] && await addAtNode(k)) added = true;}
    finally {atBusy = false;}
    if (added) render();
}

// 時刻表（跟遊戲 ScheduleManager 同一支 buildPlan）
const planOf = (id) => {
    if (!Array.isArray(S.data[id]?.schedule) || !S.data[id].schedule.every(s => typeof s.t === 'string')) return {plan: null, warns: []};
    if (S.data[id].schedule.some(s => Array.isArray(s.at) && !navAll().nodes[SP.schKey(s)])) fillAt();
    const nav = navAll();
    return SP.buildPlan(S.data[id].schedule, nav.edges, nav.nodes);
};

// 全部有作息的角色 [{id, sch, segs}]（占用時間圖、相衝）
const occAll = () => Object.entries(S.data).filter(([, x]) => Array.isArray(x.schedule) && x.schedule.length)
    .map(([o, x]) => {const pl = planOf(o); return {id: o, sch: x.schedule, segs: SB.daySegs(pl.plan, x.schedule, pl.warns)};});

// 第 i 筆停幾分（下一筆排不下＝0）；只有一筆／排不出時刻表＝null
const stayOf = (pl, i) => {
    const n = pl.plan?.length ?? 0, a = pl.plan?.[i], b = pl.plan?.[(i + 1) % n];
    if (!a || !b || n < 2) return null;
    return pl.warns.some(w => w.i === (i + 1) % n && w.kind === 'late') ? 0 : SP.mod(b.dep - a.arr);
};

// 第 i 筆改成「停 m 分」＝下一筆照原型別平移（每次照當下的時刻表算差值，滾輪連續寫也對）
// 夾在 [MIN_STAY, 下一筆也至少停 MIN_STAY]（同拖分界線的 dragRange），夾到了寫狀態列
function stayTo(id, i, m)
{
    const pl = planOf(id), now = stayOf(pl, i);
    if (now === null) return;
    const j = (i + 1) % pl.plan.length, r = SE.dragRange(pl.plan, j);
    const max = Math.max(SE.MIN_STAY, now + (r?.[1] ?? 0));
    const v = Math.max(SE.MIN_STAY, Math.min(max, m));
    if (v !== now) set(id, ['schedule', j, 't'], SE.shiftT(S.data[id].schedule[j].t, v - now));
    if (v < m) status(`最多待到 ${SP.hhmm(SP.mod(pl.plan[i].arr + max))}（下一筆至少停 ${SE.MIN_STAY} 分）`);
    else if (v > m) status(`最少待 ${SE.MIN_STAY} 分`);
}

// 右鍵選單的「待多久 [HH 時 MM 分]」：點時／分＝timePick，選了就寫（stayTo），選單不關、數字照寫完的重畫
function stayRow(id, i, why)
{
    const row = h('div', {class: 'ctxrow' + (why ? ' dis' : ''), title: why || null});
    const draw = () => {
        const cur = why ? null : stayOf(planOf(id), i);
        row.replaceChildren('待多久', cur === null ? h('span', null, '-- 時 -- 分') :
            timePick('stayMenu', SP.hhmm(cur), v => {stayTo(id, i, SE.toMin(v)); draw();}, {unit: true}));
    };
    draw();
    return row;
}

// 卡片第一行：走：[出發]（N 分）　待：[抵達] ~ [訖]（停多久）；三個時間都能點來改
//   出發＝這筆改成出發型、抵達＝這筆改成 @ 抵達型、訖＝下一筆照原型別平移；排不出時刻表＝只有一個時間欄（照原型別寫）
function schTimes(id, i, pl, s)
{
    const p = pl.plan?.[i], k = `schedule.${i}`, t = s.t ?? '';
    const put = (v) => set(id, ['schedule', i, 't'], v);
    if (!p)
    {
        const key = SP.schKey(s), miss = SP.destOf(s) && pl.warns.some(w => w.kind === 'node' && w.keys?.includes(key));
        return h('div', {class: 'times' + (miss ? ' bad' : '')},
            '時間：', timePick(`${k}.t`, t.replace(/^@/, ''), v => put(`${t.startsWith('@') ? '@' : ''}${v}`)), t.startsWith('@') ? '（抵達）' : t ? '（出發）' : '',
            miss && h('div', null, `⚠ 路網裡沒有 ${key}（新加的點要按右欄的「更新路網」）`));
    }
    const n = pl.plan.length, j = (i + 1) % n, nx = pl.plan[j];
    const late = pl.warns.find(w => w.i === i && w.kind === 'late'), lateNx = pl.warns.find(w => w.i === j && w.kind === 'late');
    const pre = pl.plan[(i - 1 + n) % n];
    const stay = stayOf(pl, i);
    const endPick = (v) => {const a = planOf(id).plan?.[i]; if (a) stayTo(id, i, SP.mod(SE.toMin(v) - a.arr));};
    const stayPick = (v) => stayTo(id, i, SE.toMin(v));
    return h('div', {class: 'times' + (late || !p.path || lateNx ? ' bad' : '')},
        h('span', {class: 'tw'}, '走：', p.path ? [timePick(`${k}.dep`, SP.hhmm(p.dep), v => put(v)), `（${SB.dur(p.cost)}）`] : `從 ${p.from} 走不到`),
        h('span', {class: 'ts'}, '待：', timePick(`${k}.t`, SP.hhmm(p.arr), v => put(`@${v}`)), ' ~ ',
            n === 1 ? '整天' : [timePick(`${k}.end`, SP.hhmm(nx.dep), endPick), '（', timePick(`${k}.stay`, SP.hhmm(stay), stayPick, {unit: true}), '）']),
        late && h('div', {class: 'tlate'}, `排不下：晚 ${late.late} 分（上一筆 ${SP.hhmm(pre.arr)} 才到）`),
        lateNx && h('div', {class: 'tlate'}, `下一筆排不下：晚 ${lateNx.late} 分`));
}

// 目的地按鈕：點了開跟插入一樣的分層選單（同時改 map＋go／at）
function destBtn(id, i, s)
{
    const room = s.map && !s.map.startsWith('m/');
    const name = Array.isArray(s.at) ? `格子 ${s.at.join(',')}` : s.go ?? '?';
    const ok = !!S.ext.maps[s.map] && (Array.isArray(s.at) || S.ext.maps[s.map].includes(s.go));
    const change = (m, d) => setDest(id, i, m, d);
    return h('button', {type: 'button', class: 'destbtn' + (ok ? '' : ' bad'), dataset: {k: `schedule.${i}.dest`}, title: `${s.map ?? '（沒有地圖）'}／${name}`,
        onclick: (e) => menu(e, destMenu(change, () => pickOnMap(id, '改目的地', change), {map: s.map, go: s.go}))},
        `${ok ? '' : '⚠ '}${room ? '🏠 ' : ''}${s.map?.split('/').at(-1) ?? '?'} ▸ ${name}`);
}

function schCard(id, list, i, pl)
{
    const s = list[i], path = ['schedule', i], k = `schedule.${i}`;
    const put = (f, v) => set(id, [...path, f], v);
    const known = (f) => SC.SCH_FIELDS.includes(f);
    const nav = `dl-nav-${s.map}`;
    const types = SC.schTypes(S.ext.local);
    return h('div', {class: 'card sel', dataset: {sch: i}},
        h('div', {class: 'bar'},
            h('span', {class: 'sum'}, `${s.type ? `${SC.typeName(S.ext.local, s.type)}：` : ''}${SC.schSummary(s)}`),
            h('button', {type: 'button', title: '刪除（時間交給前一段，前後同目的地會合併）', onclick: () => delSch(id, i)}, '×')),
        schTimes(id, i, pl, s),
        s.do === 'patrol' && patrolInfo(s),
        h('div', {class: 'sub'},
            h('label', {title: 'map＋go／at'}, '目的地', destBtn(id, i, s)),
            h('label', {title: 'type（只是標籤，時序條上顯示）'}, '類型', h('select', {dataset: {k: `${k}.type`}, onchange: e => {
                if (e.target.value === '#new') {e.target.value = s.type ?? ''; newType(id, i); return;}
                put('type', e.target.value || undefined);
            }},
                h('option', {value: '', selected: !s.type}, '（無）'),
                types.map(t => h('option', {value: t, selected: t === s.type}, SC.typeName(S.ext.local, t))),
                s.type && !types.includes(s.type) && h('option', {value: s.type, selected: true}, `⚠ ${s.type}`),
                h('option', {value: '#new'}, '＋ 新類型…'))),
            h('label', {title: 'do'}, '活動', h('select', {dataset: {k: `${k}.do`}, onchange: e => put('do', e.target.value || undefined)},
                Object.entries(SC.DO_NAMES).map(([v, n]) => h('option', {value: v, selected: v === (s.do ?? '')}, n)),
                s.do && !(s.do in SC.DO_NAMES) && h('option', {value: s.do, selected: true}, s.do))),
            s.do === 'patrol' && [
                h('button', {type: 'button', class: 'routebtn' + (editingRoute(id, i) ? ' on' : ''), title: '在右欄地圖上點選路點（Esc 結束）',
                    onclick: (e) => {e.stopPropagation(); toggleRouteEdit(id, i);}}, editingRoute(id, i) ? '✔ 完成' : '✎ 編輯路線'),
                h('label', {title: 'route（依序走的路點，怎麼走看「模式」）'}, '路線', h('input', {size: 40, dataset: {k: `${k}.route`, combo: nav, tags: ''},
                    value: (s.route ?? []).join(', '),
                    onchange: e => {const a = e.target.value.split(',').map(x => x.trim()).filter(Boolean); put('route', a.length ? a : undefined);}})),
                h('label', {title: 'mode（沒寫＝多次循環；多次＝重複到這筆結束，一次／單向走完停在終點、下一筆從終點出發）'}, '模式',
                    h('select', {dataset: {k: `${k}.mode`}, onchange: e => put('mode', e.target.value === 'loop' ? undefined : e.target.value)},
                        Object.entries(SC.MODE_NAMES).map(([v, n]) => h('option', {value: v, selected: v === SP.patrolMode(s)}, n)),
                        s.mode && !(s.mode in SC.MODE_NAMES) && h('option', {value: s.mode, selected: true}, `⚠ ${s.mode}`))),
                h('label', {title: 'wait（每個路點停幾回合）'}, '停留', h('input', {class: 'num', dataset: {k: `${k}.wait`}, value: s.wait ?? '',
                    onchange: e => put('wait', parseNum(e.target.value))})),
            ]),
        h('details', {open: Object.keys(s).some(f => !known(f))}, h('summary', {class: 'dim'}, '額外欄位（JSON）'),
            F.rawArea(s, known, raw => commit(() => replaceRaw(S.data[id].schedule[i], known, raw)), `${k}.#raw`)));
}

// 小「＋」：沒作息＝08:00 抵達第一個點；有＝選中那筆（沒選＝最後一筆）抵達 +1 小時，插入同一張圖的第一個點
function addSch(id)
{
    S.open.schedule = true;
    const a = S.data[id].schedule ?? [], pl = planOf(id);
    const i = schSel(id) >= 0 ? schSel(id) : a.length - 1;
    const map = a[i]?.map ?? Object.keys(S.ext.maps)[0];
    const t = pl.plan?.[i] ? pl.plan[i].arr + 60 : 8 * 60;
    insertSch(id, Math.round(t / SE.SNAP) * SE.SNAP, map, {go: S.ext.maps[map]?.[0]});
}

const schLabel = (id, i) => {
    const s = S.data[id].schedule?.[i], p = planOf(id).plan?.[i];
    return s ? `${s.type ? `${SC.typeName(S.ext.local, s.type)} ` : ''}${p ? SP.hhmm(p.arr) : s.t}` : '';
};

function schSlot(id)
{
    const list = S.data[id].schedule ?? [], i = schSel(id), multi = schMulti(id);
    if (multi)
    {
        const pl = planOf(id), segs = SB.daySegs(pl.plan, list, pl.warns);
        const stay = (k) => segs?.find(g => g.kind === 'stay' && g.i === k);
        const first = stay(multi[0]), last = stay(multi.at(-1));
        const span = first && last ? `（${SP.hhmm(first.s)}～${SP.hhmm(SP.mod(last.s + last.len))}）` : '';
        return h('div', {class: 'schhint'}, `已選 ${multi.length} 筆${span}　右鍵合併／刪除；點一下（不按 Shift）回到單選`);
    }
    return i < 0 ? h('div', {class: 'schhint dim'}, list.length ? '點時序條上的一段來編輯' : '在時序條上按右鍵插入作息')
        : schCard(id, list, i, planOf(id));
}

function schedBox(id, v)
{
    const list = Array.isArray(v) ? v : [];
    const open = (v !== undefined || kindOf(S.data[id]) === 'npc') && (S.open.schedule ??= true);
    const nav = navAll();
    return h('div', {class: 'box'},
        F.boxBar('schedule', open, list.length > 0, h('span', {title: 'schedule'}, '作息'), h('span', {class: 'dim'}, `（${list.length}）右鍵時序條插入／改；拖段的邊緣改時間（Shift＝1 分）`),
            h('span', {class: 'grow'}),
            h('button', {type: 'button', title: '在選中那筆後面插入（沒選＝08:00）', onclick: () => addSch(id)}, '＋'),
            v !== undefined && h('button', {type: 'button', onclick: () => set(id, ['schedule'], undefined)}, '移除')),
        open && (() => {
            const pl = planOf(id);
            let others = null;
            const clash = (sch, segs) => clashes([...(others ??= occAll().filter(e => e.id !== id)), {id, sch, segs}]).get(id) ?? [];
            return [SB.dayBarEl(pl.plan, list, pl.warns, {sel: schSel(id), multi: schMulti(id), typeName: s => SC.typeName(S.ext.local, s?.type), clash,
                onPick: (i, shift) => pickSch(id, i, shift),
                onMenu: (e, t) => barMenu(e, id, t),
                planOf: (sch) => SP.buildPlan(sch, nav.edges, nav.nodes),
                onShift: (j, d) => shiftSch(id, j, d)}),
                h('div', {class: 'schslot'}, schSlot(id))];
        })());
}

// ---------- 表單 ----------
function otherBox(id, r)
{
    const known = (k) => !!SC.FIELDS[k];
    const raw = Object.fromEntries(Object.entries(r).filter(([k]) => !known(k)));
    const open = S.open['#raw'] ??= false, n = Object.keys(raw).length;
    return h('div', {class: 'box'},
        F.boxBar('#raw', open, n > 0, '其他欄位', h('span', {class: 'dim'}, `（${n}）原始 JSON，遊戲沒在讀或工具不認識的 key，例如 stats、states`)),
        open && F.rawArea(r, known, raw => commit(() => replaceRaw(S.data[id], known, raw)), '#raw'));
}

function rightTabs()
{
    const tab = (k, text) => h('button', {type: 'button', class: S.rtab === k ? 'on' : '', dataset: {rtab: k}, onclick: () => {
        S.rtab = k;
        try {localStorage.setItem('tools.role.rtab', k);} catch {}
        render();
    }}, text);
    return h('div', {class: 'rtabs'}, tab('look', '外觀'), tab('sched', '作息'));
}

function renderRight()
{
    const id = S.sel, r = S.data[id];
    if (!r || S.view !== 'form') return;
    if (S.rtab === 'sched') checkStale();
    document.getElementById('right').replaceChildren(rightTabs(), S.rtab === 'sched'
        ? SM.schedMapEl(r, Object.keys(S.ext.maps), renderRight, {plan: planOf(id).plan, sel: schSel(id), edges: navAll().edges,
            onNew: (m, x, y, d) => newPoint(id, m, x, y, d), onMove: movePoint, onMenu: (e, m, x) => mapMenu(e, id, m, x),
            stale: S.stale, atStale: atMissing().length, onUpdate: updateNav, navMsg: S.navMsg,
            patrol: r.schedule?.[schSel(id)]?.do === 'patrol' ? r.schedule[schSel(id)] : null, editRoute: editingRoute(id, schSel(id)),
            onRouteAdd: (m, n) => routeAdd(id, m, n), onRouteDel: (k) => routeDel(id, k), routeMark: routeMark(), onRouteMark: routeToggleMark,
            pick: S.pick?.id === id ? S.pick.text : null, onPick: (m, x) => {const fn = S.pick?.fn; S.pick = null; fn?.(m, x.name ? {go: x.name} : {at: x.tile}); renderRight();},
            id, occ: occAll,
            others: Object.entries(S.data).filter(([o]) => o !== id).flatMap(([o, x]) => (Array.isArray(x.schedule) ? x.schedule.map((s, i) => ({id: o, i, s})) : []))})
        : previewEl(r, S.ext.items, S.ext.parts));
}

function renderForm()
{
    const id = S.sel, r = S.data[id];
    const view = document.getElementById('view'), right = document.getElementById('right');
    if (!r)
    {
        right.replaceChildren();
        return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選角色）' : '先在上方選擇專案資料夾'));
    }
    const shown = new Set([...SC.shownFields(r), ...(S.extra[id] ?? [])]);
    const rest = Object.keys(SC.FIELDS).filter(k => !shown.has(k));
    const wkeys = [], warns = validate(id, wkeys), draft = F.fullDraft();
    const secs = SC.SECTIONS.map(sec => ({...sec, keys: sec.keys.filter(k => shown.has(k))})).filter(sec => sec.keys.length > 0);
    const allOpen = (v) => {for (const sec of SC.SECTIONS) S.secOpen[sec.title] = v; render();};
    renderRight();
    view.replaceChildren(
        h('div', {class: 'form'},
            h('div', {class: 'head'},
                IC.iconEl(r.icon, 48),
                h('span', {class: 'bigid'}, id),
                h('span', {class: 'dim'}, r.lab ?? ''),
                D.dirty(id) && h('span', {class: 'dirty'}, '●'),
                h('span', {class: 'grow'}),
                !S.json && [h('button', {type: 'button', onclick: () => allOpen(true)}, '全部展開'),
                            h('button', {type: 'button', onclick: () => allOpen(false)}, '全部收合')],
                F.modeBtn(),
                h('button', {type: 'button', onclick: () => D.askRename(id)}, '改名…'),
                h('button', {type: 'button', onclick: () => D.dup(id)}, '複製'),
                h('button', {type: 'button', onclick: () => D.remove(id)}, '刪除…')),
            (warns.length > 0 || draft) && h('ul', {class: 'warns'}, [draft, ...warns].filter(Boolean).map(w => h('li', null, w))),
            S.json ? F.fullJson(id) : h('div', {class: 'fields'},
                secs.map(sec => {
                    const open = !!S.secOpen[sec.title], n = sec.keys.filter(k => r[k] !== undefined).length;
                    const bad = wkeys.some(k => sec.keys.includes(k));
                    return [h('div', {class: 'sec fold' + (bad ? ' bad' : ''), onclick: () => {S.secOpen[sec.title] = !open; render();}},
                                h('span', {class: 'arrow'}, open ? '▼' : '▶'), `${sec.title}（${n}）`, bad && h('span', {title: '這段有檢查警告'}, ' ⚠')),
                            open && sec.keys.map(k => fieldRow(id, r, k))];
                }),
                rest.length > 0 && [h('div', {class: 'sec'}, ''), h('span', {class: 'k unset'}, '加欄位'),
                    h('select', {onchange: e => {
                        const k = e.target.value, def = SC.FIELDS[k];
                        const sec = SC.SECTIONS.find(s => s.keys.includes(k));
                        if (sec) S.secOpen[sec.title] = true;
                        if (def.type === 'obj') {S.open[k] = true; return set(id, [k], {});}
                        if (def.type === 'inv') {S.open.inv = true; return set(id, ['inv'], {storage: {capacity: -1, items: []}});}
                        if (def.type === 'schedule') return addSch(id);
                        (S.extra[id] ??= new Set()).add(k);
                        render();
                    }}, h('option', {value: ''}, '…'), rest.map(k => h('option', {value: k}, `${SC.FIELDS[k].label}　${k}`)))],
                otherBox(id, r))));
}

// ---------- 總覽表 ----------
function cellText(c, r)
{
    if (c === '#sch') return r.schedule?.length ? String(r.schedule.length) : '';
    if (c === '#equips') return (r.inv?.equips ?? []).map(idOf).join(', ');
    const v = getAt(r, c.split('.'));
    if (v === undefined) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (c === 'kind') return SC.KIND_NAMES[v] ?? v;
    if (typeof v === 'boolean') return v ? '✔' : '';
    return String(v);
}

function tableCell(id, c)
{
    const r = S.data[id], path = c.split('.');
    if (c.startsWith('#')) return h('td', {class: c === '#sch' ? 'n' : ''}, cellText(c, r));
    const def = SC.colDef(c);
    if (def.type === 'icon') return h('td', {class: 'edit', onclick: async () => {const v = await IC.pickIcon(r.icon); if (v !== null) set(id, ['icon'], v || undefined);}}, IC.iconEl(r.icon, 24));
    if (def.type === 'bool') return h('td', null, h('input', {type: 'checkbox', checked: !!getAt(r, path), onchange: e => set(id, path, e.target.checked || undefined)}));
    const num = def.type === 'int' || def.type === 'num';
    return h('td', {class: 'edit' + (num ? ' n' : ''), title: '雙擊編輯',
        ondblclick: e => V.editCell(e.currentTarget, fieldInput(def, getAt(r, path), v => (c === 'grp' ? setGrp(id, v) : c === 'kind' ? setKind(id, v) : set(id, path, v)), `table.${id}.${path.at(-1)}`))}, cellText(c, r));
}

const inTab = (tab, id) => {
    const r = S.data[id];
    return (!tab.kind || r.kind === tab.kind) && (!tab.kind || S.grp === ALL || (r.grp ?? '') === S.grp);
};

// kind 標題：右鍵新增子分類；子分類標題：右鍵改名／刪除；兩種都能放角色
function groupHead(kind, g)
{
    return (el) => {
        el.dataset.kind = kind;
        if (g !== undefined) el.dataset.grp = g;
        el.oncontextmenu = (e) => menu(e, g === undefined ? [['新增子分類…', () => newGrp(kind)]]
            : [['改名…', () => renameGrp(kind, g)], ['刪除…', () => removeGrp(kind, g)]]);
    };
}

// ---------- 畫面 ----------
function draw()
{
    const rs = Object.values(S.data), ids = Object.keys(S.data);
    // 部位、裝備的建議只列 sex 符合目前這個角色的；子分類只列同 kind 的
    const sex = S.data[S.sel]?.sex;
    renderDatalists({
        items: Object.keys(S.ext.items),
        equips: Object.keys(S.ext.items).filter(i => S.ext.items[i].equip && sexOk(S.ext.items[i], sex)),
        abilities: Object.keys(S.ext.abilities),
        job: [...SC.JOBS, ...rs.map(r => r.job)],
        grp: S.data[S.sel] ? grpsOf(kindOf(S.data[S.sel])) : [],
        maps: Object.keys(S.ext.maps),
        ...Object.fromEntries(ROLE_PARTS.map(k => [k, Object.keys(S.ext.parts).filter(id => S.ext.parts[id].kind === k && sexOk(S.ext.parts[id], sex))])),
        ...Object.fromEntries(Object.entries(S.ext.maps).map(([m, names]) => [`nav-${m}`, names])),
    }, {items: o => S.ext.items[o]?.lab, equips: o => S.ext.items[o]?.lab, abilities: o => S.ext.abilities[o]?.lab});

    V.renderList(SC.roleTree(S.data, ids, {grpsOf, keep: true, head: groupHead}));
    if (S.view === 'form') return renderForm();
    document.getElementById('right').replaceChildren();
    if (S.grpTab !== S.tab) {S.grpTab = S.tab; S.grp = ALL;}
    const tabKind = SC.TABS[S.tab].kind, tab = SC.TABS[S.tab];
    V.renderTable(SC.TABS, {
        inTab,
        sortKey: (id, c) => c === '#sch' ? (S.data[id].schedule?.length ?? 0) : c === '#equips' ? cellText(c, S.data[id]) : getAt(S.data[id], c.split('.')),
        head: (c) => c === '#sch' ? ['作息'] : c === '#equips' ? ['裝備'] : [SC.colDef(c).label, c],
        cell: tableCell,
    });
    if (tab.gantt) document.querySelector('#view table.grid').replaceWith(GT.ganttEl({
        ids: Object.keys(S.data).filter(id => inTab(tab, id) && V.matchSearch(id)), data: S.data, planOf, rerender: render,
        onRole: (id) => {S.sel = id; S.view = 'form'; render();},
        onSeg: openSch,
        typeName: s => SC.typeName(S.ext.local, s?.type),
        planFor: (sch) => {const nav = navAll(); return SP.buildPlan(sch, nav.edges, nav.nodes);},
        onShift: shiftSch,
        occ: occAll,
        onMenu: (e, id, t) => barMenu(e, id, t, true),
        onMulti: ganttMulti,
        multiOf: multiSel,
    }));
    if (tabKind)
        document.querySelector('#view .tabs').append(h('select', {title: '子分類', dataset: {k: 'grpFilter'}, onchange: e => {S.grp = e.target.value; render();}},
            [[ALL, '全部子分類'], ['', '（無子分類）'], ...grpsOf(tabKind).map(g => [g, g])].map(([v, t]) => h('option', {value: v, selected: v === S.grp}, t))));
}

async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const [items, abilities, nav, parts, local] = await Promise.all([get('item.json'), get('ability.json'), get('navgraph.json'), get('part.json'), get('local.json')]);
    const maps = {};
    for (const key of Object.keys(nav.nodes ?? {}))
    {
        const i = key.indexOf(':'), names = (maps[key.slice(0, i)] ??= []);
        if (!SP.parseAt(key.slice(i + 1))) names.push(key.slice(i + 1));
    }
    Object.assign(S.ext, {items, abilities, maps, parts, local, nav: {nodes: nav.nodes ?? {}, edges: nav.edges ?? {}}});
    resetAt();
}

(async () => {
    await loadRefs();
    render();
    IC.ready.then(render);
    SH.onGoto(([id, k, i]) => {if (k === 'schedule') openSch(id, i); else {S.sel = id; S.view = 'form'; render();}});
    D.start(async (dir) => {
        await ST.load(dir).catch(e => status(`tools/settings.json 讀不到：${e.message}`));
        await D.setAssets(dir);
    });
})();

// 給無頭測試用
window.__re = {S, SM, PZ, SP, SE, ME, SB, GT, openSch, updateNav, checkStale, renamePoint, deletePoint, toggleRouteEdit, setAssets: D.setAssets, reload: D.reload, save: D.save, commit, set, undo: D.undo, redo: D.redo, add, askNew, dup: D.dup,
               rename: D.rename, remove: D.remove, addSch, scanRefs: D.scanRefs, validate, validateAll, render, IC, JE, SC,
               pickPart, renamePart, deletePart, genPortrait, loadRefs, grpsOf, newGrp, renameGrp, removeGrp, dropRole, setGrp, setKind, ALL};
