import {h, ask, status} from '../common/dom.js';
import {str, isObj, getAt, replaceRaw, parseNum} from '../common/obj.js';
import {createDoc} from '../common/doc.js';
import {fieldInput, createForm} from '../common/form.js';
import {createViews, renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import * as JE from '../common/jsonedit.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SC from './schema.js';
import {previewEl} from './preview.js';

// role.json 裡沒有角色互相引用的欄位，改名只動 key
const D = createDoc({
    file: 'role.json', noun: '角色',
    external: '可能是紙娃娃「存到 role.json」或手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if (file === 'item.json') loadRefs().then(render);},
});
const {S, render, commit, set} = D;
S.ext = {items: {}, abilities: {}, maps: {}};    // 唯讀參考資料：item.json、ability.json、navgraph.json 的「地圖 → 物件名稱」
S.loc = '';                                      // 總覽表 NPC 頁的地點篩選
const F = createForm(D);
const V = createViews(D, {icon: id => S.data[id].icon, lab: id => S.data[id].lab, warns: id => validate(id)});

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
    else if (t === 'tags')
    {
        if (!Array.isArray(v)) out.push(`${where} 應該是陣列`);
        else if (where === 'abilities') for (const a of v) if (!S.ext.abilities[a]) out.push(`abilities 沒有這個技能：${a}`);
    }
}

function checkInv(inv, out)
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
        if (!nav) return;
        const names = S.ext.maps[s.map];
        if (!names) out.push(`${at} 路網沒有地圖 ${s.map ?? '（沒填）'}（新地圖要重跑 scripts/navgraph.js）`);
        else if (!names.includes(s.go)) out.push(`${at} ${s.map} 沒有物件 ${s.go ?? '（沒填）'}`);
        if (s.do === 'patrol')
        {
            if (!s.route?.length) out.push(`${at} 巡邏沒有 route`);
            else if (names) for (const p of s.route) if (!names.includes(p)) out.push(`${at} 巡邏路點 ${p} 不在 ${s.map}`);
        }
        checkVal({type: 'int'}, s.wait, `${at} 停留`, out);
    });
}

function validate(id)
{
    const r = S.data[id], out = [];
    if (!r.lab) out.push('沒有名稱 lab');
    for (const k of SC.REQUIRED) if (r[k] === undefined) out.push(`沒有 ${k}（遊戲畫角色會出錯）`);
    if (r.kind && !SC.KINDS.includes(r.kind)) out.push(`不認識的分類 kind：${r.kind}`);
    if (r.style !== undefined && !(r.style in SC.STYLES)) out.push(`性格 style「${r.style}」在 com_ai.js 的 wTBL 裡沒有（遊戲會當成 ${SC.STYLE_DEFAULT}）`);
    for (const [k, v] of Object.entries(r))
    {
        const def = SC.FIELDS[k];
        if (!def || k === 'style') continue;
        if (def.type === 'obj')
        {
            if (!isObj(v)) {out.push(`${k} 應該是物件`); continue;}
            for (const [f, d] of Object.entries(def.fields)) checkVal(d, v[f], `${k}.${f}`, out);
        }
        else if (def.type === 'inv') checkInv(v, out);
        else if (def.type === 'schedule') checkSchedule(v, out);
        else checkVal(def, v, k, out);
    }
    return out;
}

const validateAll = () => Object.keys(S.data).flatMap(id => validate(id).map(w => `${id}：${w}`));

// ---------- 新增 ----------
function add(id, kind)
{
    const err = D.idError(id);
    if (err) return status(err);
    const keys = Object.keys(S.data);
    const last = keys.findLastIndex(k => (S.data[k].kind ?? '') === (kind ?? ''));
    commit(() => {D.insertAt(last < 0 ? keys.length : last + 1, id, SC.template(kind)); S.sel = id;});
}

async function askNew()
{
    const id = h('input', {size: 24}), kind = h('select', null, SC.KINDS.map(k => h('option', {value: k}, `${SC.KIND_NAMES[k]}　${k}`)));
    kind.value = S.data[S.sel]?.kind ?? 'npc';
    const p = ask('新角色', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '分類'), kind),
        h('div', {class: 'hint'}, '依分類套範本；要照現有角色改的話，選那個角色按「複製」')], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim(), kind.value);
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
    return [h('span', {class: 'k' + (v === undefined ? ' unset' : ''), title: k}, def.label), fieldInput(def, v, val => set(id, [k], val), k)];
}

// ---------- 表單：物品欄 ----------
// 存檔保留原寫法：字串就留字串（數量改成不是 1 才變 {id, count}），物件就留物件
function ensureArr(r, path)
{
    let o = r;
    for (const k of path.slice(0, -1)) o = isObj(o[k]) ? o[k] : (o[k] = {});
    return Array.isArray(o[path.at(-1)]) ? o[path.at(-1)] : (o[path.at(-1)] = []);
}

function itemCell(id, path, i, e, withCount)
{
    const obj = isObj(e), iid = idOf(e), n = obj ? e.count ?? 1 : 1, it = S.ext.items[iid];
    const k = `${path.join('.')}.${i}`;
    const put = (fn) => commit(() => fn(getAt(S.data[id], path)));
    return h('div', {class: 'cell' + (it ? '' : ' bad'), title: it ? `${iid}　${it.lab ?? ''}` : `不存在的道具：${iid}`},
        IC.iconEl(it?.icon, 28),
        h('input', {size: 10, dataset: {k, combo: 'dl-items'}, value: iid ?? '',
            onchange: ev => {const v = ev.target.value.trim(); put(a => {if (!v) a.splice(i, 1); else if (obj) a[i].id = v; else a[i] = v;});}}),
        withCount && h('input', {class: 'cnt', title: '數量', dataset: {k: `${k}#n`}, value: n,
            onchange: ev => {const c = parseNum(ev.target.value) ?? 1; put(a => {if (obj) a[i].count = c; else if (c !== 1) a[i] = {id: iid, count: c};});}}),
        h('button', {type: 'button', title: '移除', onclick: () => put(a => a.splice(i, 1))}, '×'));
}

function cells(id, list, path, withCount)
{
    return h('div', {class: 'cells'},
        list.map((e, i) => itemCell(id, path, i, e, withCount)),
        h('input', {class: 'add', size: 12, placeholder: '＋ 加道具', dataset: {k: `${path.join('.')}.+`, combo: 'dl-items'},
            onchange: e => {const v = e.target.value.trim(); if (v) commit(() => ensureArr(S.data[id], path).push(v));}}));
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
            h('span', {class: 'k', title: 'inv.equips'}, '裝備'), cells(id, equips, ['inv', 'equips'], false),
            h('span', {class: 'k unset'}, '其他'),
            F.rawArea(inv, knownInv, raw => commit(() => {S.data[id].inv ??= {}; replaceRaw(S.data[id].inv, knownInv, raw);}), 'inv.#raw'),
            isObj(inv.storage) && [h('span', {class: 'k unset'}, 'storage 其他'),
                F.rawArea(st, knownSt, raw => commit(() => replaceRaw(S.data[id].inv.storage, knownSt, raw)), 'inv.storage.#raw')]));
}

// ---------- 表單：作息 ----------
function schCard(id, list, i)
{
    const s = list[i], path = ['schedule', i], k = `schedule.${i}`;
    const t = s.t ?? '', arrive = t.startsWith('@'), hhmm = t.replace(/^@/, '');
    const move = (d) => commit(() => {const a = S.data[id].schedule; [a[i], a[i + d]] = [a[i + d], a[i]];});
    const put = (f, v) => set(id, [...path, f], v);
    const known = (f) => SC.SCH_FIELDS.includes(f);
    const nav = `dl-nav-${s.map}`;
    return h('div', {class: 'card'},
        h('div', {class: 'bar'},
            h('span', {class: 'sum'}, `${i + 1}. ${SC.schSummary(s)}`),
            h('button', {type: 'button', title: '上移', disabled: i === 0, onclick: () => move(-1)}, '↑'),
            h('button', {type: 'button', title: '下移', disabled: i === list.length - 1, onclick: () => move(1)}, '↓'),
            h('button', {type: 'button', title: '複製', onclick: () => commit(() => S.data[id].schedule.splice(i + 1, 0, structuredClone(s)))}, '⧉'),
            h('button', {type: 'button', title: '刪除', onclick: () => commit(() => S.data[id].schedule.splice(i, 1))}, '×')),
        h('div', {class: 'sub'},
            h('label', {title: 't'}, '時間',
                h('select', {dataset: {k: `${k}.t#mode`}, onchange: e => put('t', `${e.target.value}${hhmm}`)},
                    h('option', {value: '', selected: !arrive}, '出發'), h('option', {value: '@', selected: arrive}, '抵達')),
                h('input', {class: 'num', placeholder: 'HH:MM', dataset: {k: `${k}.t`}, value: hhmm,
                    onchange: e => put('t', `${arrive ? '@' : ''}${e.target.value.trim()}`)})),
            h('label', {title: 'map'}, '地圖', h('input', {size: 22, dataset: {k: `${k}.map`, combo: 'dl-maps'}, value: s.map ?? '',
                onchange: e => put('map', e.target.value.trim() || undefined)})),
            h('label', {title: 'go'}, '目的地', h('input', {size: 14, dataset: {k: `${k}.go`, combo: nav}, value: s.go ?? '',
                onchange: e => put('go', e.target.value.trim() || undefined)})),
            h('label', {title: 'do'}, '活動', h('select', {dataset: {k: `${k}.do`}, onchange: e => put('do', e.target.value || undefined)},
                Object.entries(SC.DO_NAMES).map(([v, n]) => h('option', {value: v, selected: v === (s.do ?? '')}, n)),
                s.do && !(s.do in SC.DO_NAMES) && h('option', {value: s.do, selected: true}, s.do))),
            s.do === 'patrol' && [
                h('label', {title: 'route（依序循環，要來回就重複寫）'}, '路線', h('input', {size: 40, dataset: {k: `${k}.route`, combo: nav, tags: ''},
                    value: (s.route ?? []).join(', '),
                    onchange: e => {const a = e.target.value.split(',').map(x => x.trim()).filter(Boolean); put('route', a.length ? a : undefined);}})),
                h('label', {title: 'wait（每個路點停幾回合）'}, '停留', h('input', {class: 'num', dataset: {k: `${k}.wait`}, value: s.wait ?? '',
                    onchange: e => put('wait', parseNum(e.target.value))})),
            ]),
        h('details', {open: Object.keys(s).some(f => !known(f))}, h('summary', {class: 'dim'}, '額外欄位（JSON）'),
            F.rawArea(s, known, raw => commit(() => replaceRaw(S.data[id].schedule[i], known, raw)), `${k}.#raw`)));
}

function addSch(id)
{
    S.open.schedule = true;
    commit(() => {
        const a = ensureArr(S.data[id], ['schedule']), last = a.at(-1);
        const map = last?.map ?? Object.keys(S.ext.maps)[0];
        a.push({t: '@08:00', go: S.ext.maps[map]?.[0], map});
    });
}

function schedBox(id, v)
{
    const list = Array.isArray(v) ? v : [];
    const open = v !== undefined && (S.open.schedule ??= true);
    return h('div', {class: 'box'},
        F.boxBar('schedule', open, list.length > 0, h('span', {title: 'schedule'}, '作息'), h('span', {class: 'dim'}, `（${list.length}）依序循環，第一筆的上一筆是最後一筆`),
            h('span', {class: 'grow'}),
            h('button', {type: 'button', onclick: () => addSch(id)}, '＋ 新增'),
            v !== undefined && h('button', {type: 'button', onclick: () => set(id, ['schedule'], undefined)}, '移除')),
        open && list.map((_, i) => schCard(id, list, i)));
}

// ---------- 表單 ----------
function otherBox(id, r)
{
    const known = (k) => !!SC.FIELDS[k];
    const raw = Object.fromEntries(Object.entries(r).filter(([k]) => !known(k)));
    const open = F.isOpen('#raw', raw), n = Object.keys(raw).length;
    return h('div', {class: 'box'},
        F.boxBar('#raw', open, n > 0, '其他欄位', h('span', {class: 'dim'}, `（${n}）原始 JSON，遊戲沒在讀或工具不認識的 key，例如 stats、states`)),
        open && F.rawArea(r, known, raw => commit(() => replaceRaw(S.data[id], known, raw)), '#raw'));
}

function renderForm()
{
    const id = S.sel, r = S.data[id];
    const view = document.getElementById('view');
    if (!r) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選角色）' : '先在上方選擇專案資料夾'));
    const shown = new Set([...SC.shownFields(r), ...(S.extra[id] ?? [])]);
    const rest = Object.keys(SC.FIELDS).filter(k => !shown.has(k));
    const warns = validate(id);
    view.replaceChildren(h('div', {class: 'split'},
        h('div', {class: 'form'},
            h('div', {class: 'head'},
                IC.iconEl(r.icon, 48),
                h('span', {class: 'bigid'}, id),
                h('span', {class: 'dim'}, r.lab ?? ''),
                D.dirty(id) && h('span', {class: 'dirty'}, '●'),
                h('span', {class: 'grow'}),
                h('button', {type: 'button', onclick: () => D.askRename(id)}, '改名…'),
                h('button', {type: 'button', onclick: () => D.dup(id)}, '複製'),
                h('button', {type: 'button', onclick: () => D.remove(id)}, '刪除…')),
            warns.length > 0 && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
            h('div', {class: 'fields'},
                SC.SECTIONS.map(sec => {
                    const keys = sec.keys.filter(k => shown.has(k));
                    return keys.length > 0 && [h('div', {class: 'sec'}, sec.title), keys.map(k => fieldRow(id, r, k))];
                }),
                rest.length > 0 && [h('div', {class: 'sec'}, ''), h('span', {class: 'k unset'}, '加欄位'),
                    h('select', {onchange: e => {
                        const k = e.target.value, def = SC.FIELDS[k];
                        if (def.type === 'obj') {S.open[k] = true; return set(id, [k], {});}
                        if (def.type === 'inv') {S.open.inv = true; return set(id, ['inv'], {storage: {capacity: -1, items: []}});}
                        if (def.type === 'schedule') return addSch(id);
                        (S.extra[id] ??= new Set()).add(k);
                        render();
                    }}, h('option', {value: ''}, '…'), rest.map(k => h('option', {value: k}, `${SC.FIELDS[k].label}　${k}`)))],
                otherBox(id, r))),
        previewEl(r, S.ext.items)));
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
        ondblclick: e => V.editCell(e.currentTarget, fieldInput(def, getAt(r, path), v => set(id, path, v), `table.${id}.${path.at(-1)}`))}, cellText(c, r));
}

const inTab = (tab, id) => {
    const r = S.data[id];
    return (!tab.kind || r.kind === tab.kind) && (tab.kind !== 'npc' || !S.loc || (r.loc ?? '') === S.loc);
};

// ---------- 畫面 ----------
function draw()
{
    const rs = Object.values(S.data), ids = Object.keys(S.data);
    const locs = [...new Set(rs.filter(r => r.kind === 'npc').map(r => r.loc ?? ''))];
    renderDatalists({
        items: Object.keys(S.ext.items),
        abilities: Object.keys(S.ext.abilities),
        job: [...SC.JOBS, ...rs.map(r => r.job)],
        loc: rs.map(r => r.loc),
        maps: Object.keys(S.ext.maps),
        ...Object.fromEntries(Object.entries(S.ext.maps).map(([m, names]) => [`nav-${m}`, names])),
    }, {items: o => S.ext.items[o]?.lab, abilities: o => S.ext.abilities[o]?.lab});

    const kindOf = (id) => S.data[id].kind ?? '';
    V.renderList([
        ...[...SC.KINDS, ''].flatMap(k => {
            const ks = ids.filter(id => kindOf(id) === k);
            if (k !== 'npc') return [[n => `${k ? SC.KIND_NAMES[k] : '無分類'}（${n}）`, ks, k]];
            return locs.map(l => [n => `NPC・${l || '無地點'}（${n}）`, ks.filter(id => (S.data[id].loc ?? '') === l), `npc:${l}`]);
        }),
        ['不認識的分類', ids.filter(id => kindOf(id) && !SC.KINDS.includes(kindOf(id))), '#unknown'],
    ]);
    if (S.view === 'form') return renderForm();
    V.renderTable(SC.TABS, {
        inTab,
        sortKey: (id, c) => c === '#sch' ? (S.data[id].schedule?.length ?? 0) : c === '#equips' ? cellText(c, S.data[id]) : getAt(S.data[id], c.split('.')),
        head: (c) => c === '#sch' ? ['作息'] : c === '#equips' ? ['裝備'] : [SC.colDef(c).label, c],
        cell: tableCell,
    });
    if (SC.TABS[S.tab].kind === 'npc')
        document.querySelector('#view .tabs').append(h('select', {title: '地點', onchange: e => {S.loc = e.target.value; render();}},
            h('option', {value: ''}, '全部地點'), locs.map(l => h('option', {value: l, selected: l === S.loc}, l || '（無地點）'))));
}

async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const [items, abilities, nav] = await Promise.all([get('item.json'), get('ability.json'), get('navgraph.json')]);
    const maps = {};
    for (const key of Object.keys(nav.nodes ?? {}))
    {
        const i = key.indexOf(':');
        (maps[key.slice(0, i)] ??= []).push(key.slice(i + 1));
    }
    Object.assign(S.ext, {items, abilities, maps});
}

(async () => {
    await loadRefs();
    render();
    IC.ready.then(render);
    D.start();
})();

// 給無頭測試用
window.__re = {S, setAssets: D.setAssets, reload: D.reload, save: D.save, commit, set, undo: D.undo, redo: D.redo, add, dup: D.dup,
               rename: D.rename, remove: D.remove, addSch, scanRefs: D.scanRefs, validate, validateAll, render, IC, JE, SC};
