import {h, ask, status} from '../common/dom.js';
import {str, isObj, replaceRaw, parseNum} from '../common/obj.js';
import {createDoc} from '../common/doc.js';
import {fieldInput, createForm} from '../common/form.js';
import {createViews, renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import * as JE from '../common/jsonedit.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SC from './schema.js';
import {previewEl} from '../role/preview.js';

const D = createDoc({
    file: 'item.json', noun: '道具',
    external: '可能是紙娃娃「存到 item.json」或手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs, renameRefs: (from, to) => {for (const it of Object.values(S.items)) for (const ref of SC.ITEM_REFS) ref.set(it, from, to);},
    onSaved: (file) => {
        if (file === 'fx.json') loadKeys(file).then(fx => {S.fx = fx; render();});
        if (file === 'anim.json') loadKeys(file).then(a => {S.anims = a; render();});
        if (file === 'role.json' || file === 'part.json') loadJson(file).then(o => {S[file === 'role.json' ? 'roles' : 'parts'] = o; render();});
        if (file === 'textures.json') render();
    },
});
const loadJson = (file) => fetch(`/assets/json/${file}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
const loadKeys = (file) => loadJson(file).then(Object.keys);
const {S, render, commit, set} = D;
Object.defineProperty(S, 'items', {get: () => S.data, set: (v) => {S.data = v;}});
S.fx = [];
S.anims = null;
S.roles = {};       // 唯讀：role.json、part.json（預覽的人偶）
S.parts = {};
const SEX_KEY = 'tools.item.sex';
S.sex = 'm';
try {if (localStorage.getItem(SEX_KEY) === 'f') S.sex = 'f';} catch {}
const F = createForm(D);
const V = createViews(D, {icon: id => S.items[id].icon, lab: id => S.items[id].lab, warns: id => validate(id)});

// ---------- 檢查 ----------
function checkVal(def, v, where, out)
{
    if (v === undefined) return;
    if (def.type === 'int' || def.type === 'num')
    {
        if (typeof v !== 'number') out.push(`${where} 不是數字：${str(v)}`);
        else if (def.type === 'int' && !Number.isInteger(v)) out.push(`${where} 應該是整數：${v}`);
    }
    else if (def.type === 'enum' && !def.options.includes(v)) out.push(`${where} 不認識的值：${v}`);
    else if (def.type === 'nums')
    {
        if (!isObj(v)) out.push(`${where} 應該是 {${def.keys.join(', ')}}：${str(v)}`);
        else for (const [c, n] of Object.entries(v))
        {
            if (!def.keys.includes(c)) out.push(`${where} 只能有 ${def.keys.join('／')}：${c}`);
            else if (typeof n !== 'number') out.push(`${where}.${c} 不是數字：${str(n)}`);
        }
    }
    else if (def.type === 'sprite') {const e = IC.check(v); if (e) out.push(`${where}：${e}`);}
    else if (def.type === 'itemref' && !S.items[v]) out.push(`${where} 指到不存在的道具：${v}`);
    else if (def.type === 'map' && isObj(v))
    {
        for (const [k, n] of Object.entries(v))
        {
            if (!S.items[k]) out.push(`${where} 指到不存在的道具：${k}`);
            if (!Number.isInteger(n)) out.push(`${where}.${k} 數量應該是整數：${str(n)}`);
        }
    }
}

function validate(id)
{
    const it = S.items[id], out = [];
    if (it.cat !== undefined || it.icon !== undefined)
    {
        if (!it.lab) out.push('沒有名稱 lab');
        const e = IC.check(it.icon);
        if (e) out.push(`icon：${e}`);
    }
    for (const [k, v] of Object.entries(it))
    {
        const def = SC.FIELDS[k];
        if (!def) continue;
        if (def.type === 'obj')
        {
            if (!isObj(v)) {out.push(`${k} 應該是物件`); continue;}
            for (const [f, d] of Object.entries(def.fields)) checkVal(d, v[f], `${k}.${f}`, out);
        }
        else if (def.type === 'effects')
        {
            if (!Array.isArray(v)) {out.push('effects 應該是陣列'); continue;}
            v.forEach((e, i) => {for (const [f, d] of Object.entries(SC.EFF_FIELDS)) checkVal(d, e[f], `effects[${i}].${f}`, out);});
        }
        else if (k !== 'icon') checkVal(def, v, k, out);
    }
    if (it.bb?.harvest?.id && !S.items[it.bb.harvest.id]) out.push(`bb.harvest.id 指到不存在的道具：${it.bb.harvest.id}`);
    if (it.anim && S.anims && !S.anims.includes(it.anim)) out.push(`anim 指到 anim.json 沒有的動畫：${it.anim}`);
    return out;
}

const validateAll = () => Object.keys(S.items).flatMap(id => validate(id).map(w => `${id}：${w}`));

// ---------- 新增 ----------
function add(id, cat)
{
    const err = D.idError(id);
    if (err) return status(err);
    const keys = Object.keys(S.items);
    const last = keys.findLastIndex(k => (S.items[k].cat ?? '') === (cat ?? ''));
    commit(() => {D.insertAt(last < 0 ? keys.length : last + 1, id, SC.template(cat)); S.sel = id;});
}

// item.json 裡引用到 id 的地方
function innerRefs(id)
{
    const out = [];
    for (const [k, it] of Object.entries(S.items))
        for (const r of SC.ITEM_REFS) if (r.get(it).includes(id)) out.push(`${k}.${r.path}`);
    return out;
}

async function askNew()
{
    const id = h('input', {size: 24}), cat = h('select', null, SC.CATS.map(c => h('option', {value: c}, `${SC.CAT_NAMES[c]}　${c}`)), h('option', {value: ''}, '（無分類）'));
    cat.value = S.items[S.sel]?.cat ?? 'CAT_ITEM';
    const p = ask('新道具', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '分類'), cat)], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim(), cat.value || undefined);
}

// ---------- 表單 ----------
function mapEditor(id, path, val)
{
    val = isObj(val) ? val : {};
    const k = path.join('.');
    const rekey = (from, to) => set(id, path, Object.fromEntries(Object.entries(val).map(([a, b]) => [a === from ? to : a, b]).filter(([a]) => a)));
    const blankId = h('input', {dataset: {k: `${k}.+`, combo: 'dl-items'}, placeholder: '加材料…',
        onchange: e => {const v = e.target.value.trim(); if (v && !(v in val)) set(id, [...path, v], 1);}});
    return h('div', {class: 'sub'},
        Object.entries(val).map(([mid, n]) => h('label', null,
            IC.iconEl(S.items[mid]?.icon, 20),
            h('input', {size: 12, dataset: {k: `${k}.${mid}#id`, combo: 'dl-items'}, value: mid, onchange: e => rekey(mid, e.target.value.trim())}),
            '×', h('input', {class: 'num', dataset: {k: `${k}.${mid}`}, value: n, onchange: e => set(id, [...path, mid], parseNum(e.target.value))}))),
        blankId);
}

function effCard(id, effs, i)
{
    const e = effs[i], path = ['effects', i];
    const move = (d) => commit(() => {const a = S.items[id].effects; [a[i], a[i + d]] = [a[i + d], a[i]];});
    const known = (k) => !!SC.EFF_FIELDS[k];
    return h('div', {class: 'card'},
        h('div', {class: 'bar'},
            h('span', {class: 'sum'}, SC.effSummary(e)),
            h('button', {type: 'button', title: '上移', disabled: i === 0, onclick: () => move(-1)}, '↑'),
            h('button', {type: 'button', title: '下移', disabled: i === effs.length - 1, onclick: () => move(1)}, '↓'),
            h('button', {type: 'button', title: '複製', onclick: () => commit(() => S.items[id].effects.splice(i + 1, 0, structuredClone(e)))}, '⧉'),
            h('button', {type: 'button', title: '刪除', onclick: () => delEff(id, i)}, '×')),
        h('div', {class: 'sub'},
            SC.effFields(e).map(f => h('label', null, h('span', {title: f}, SC.EFF_FIELDS[f].label),
                fieldInput(SC.EFF_FIELDS[f], e[f], v => set(id, [...path, f], v), `effects.${i}.${f}`)))),
        h('details', {open: Object.keys(e).some(k => !known(k))}, h('summary', {class: 'dim'}, '額外欄位（JSON）'),
            F.rawArea(e, known, v => commit(() => replaceRaw(S.items[id].effects[i], known, v)), `effects.${i}.#raw`)));
}

function addEff(id, eff = {type: 'mod'})
{
    S.open.effects = true;
    commit(() => {const it = S.items[id]; (it.effects ??= []).push(eff);});
}

function delEff(id, i)
{
    commit(() => {const it = S.items[id]; it.effects.splice(i, 1); if (!it.effects.length) delete it.effects;});
}

function fieldRow(id, it, k)
{
    const def = SC.FIELDS[k], v = it[k];
    const label = h('span', {class: 'k' + (v === undefined ? ' unset' : ''), title: k}, def.label);
    if (def.type === 'obj')
    {
        const known = (f) => !!def.fields[f];
        const o = isObj(v) ? v : {};
        const open = v !== undefined && F.isOpen(k, v);
        // 被 show 藏起來的子欄位用框裡的「加欄位」叫出來（記在 S.extra[id] 的 'equip.f' 這種 key），清空就藏回去
        const extra = S.extra[id] ?? new Set();
        const subs = Object.entries(def.fields).map(([f, d]) => [f, d, (d.show?.(it, o[f]) ?? true) || extra.has(`${k}.${f}`)]);
        const put = (f, val) => {if (val === undefined) extra.delete(`${k}.${f}`); set(id, [k, f], val);};
        const hidden = subs.filter(([, , on]) => !on);
        return h('div', {class: 'box'},
            F.boxBar(k, open, v !== undefined, h('span', {title: k}, def.label), v !== undefined && h('span', {class: 'dim'}, `（${Object.keys(o).length}）`), h('span', {class: 'grow'}),
                v === undefined ? h('button', {type: 'button', onclick: () => {S.open[k] = true; set(id, [k], {});}}, '建立')
                                : h('button', {type: 'button', onclick: () => set(id, [k], undefined)}, '移除')),
            open && h('div', {class: 'fields'},
                subs.filter(([, , on]) => on).map(([f, d]) => [
                    h('span', {class: 'k' + (o[f] === undefined ? ' unset' : ''), title: `${k}.${f}`}, d.label),
                    d.type === 'map' ? mapEditor(id, [k, f], o[f]) : fieldInput(d.hint ? {...d, hint: d.hint(o)} : d, o[f], val => put(f, val), `${k}.${f}`),
                ]),
                hidden.length && [h('span', {class: 'k unset'}, '加欄位'),
                    h('select', {dataset: {k: `${k}.#add`}, onchange: e => {(S.extra[id] ??= new Set()).add(`${k}.${e.target.value}`); render();}},
                        h('option', {value: ''}, '…'), hidden.map(([f, d]) => h('option', {value: f}, `${d.label}　${f}`)))],
                h('span', {class: 'k unset'}, '其他'),
                F.rawArea(o, known, raw => commit(() => {S.items[id][k] ??= {}; replaceRaw(S.items[id][k], known, raw);}), `${k}.#raw`)));
    }
    if (def.type === 'effects')
    {
        const effs = Array.isArray(v) ? v : [];
        const open = F.isOpen(k, effs);
        return h('div', {class: 'box'},
            F.boxBar(k, open, effs.length > 0, h('span', {title: k}, '效果'), h('span', {class: 'dim'}, `（${effs.length}）`), h('span', {class: 'grow'}),
                h('button', {type: 'button', onclick: () => addEff(id)}, '＋ 新增效果')),
            open && effs.map((_, i) => effCard(id, effs, i)));
    }
    return [label, fieldInput(def, v, val => set(id, [k], val), k)];
}

function otherBox(id, it, known)
{
    const raw = Object.fromEntries(Object.entries(it).filter(([k]) => !known(k)));
    const open = F.isOpen('#raw', raw), n = Object.keys(raw).length;
    return h('div', {class: 'box'},
        F.boxBar('#raw', open, n > 0, '其他欄位', h('span', {class: 'dim'}, `（${n}）原始 JSON，工具不認識的 key，例如 bb`)),
        open && F.rawArea(it, known, raw => commit(() => replaceRaw(S.items[id], known, raw)), '#raw'));
}

function renderForm()
{
    const id = S.sel, it = S.items[id];
    const view = document.getElementById('view');
    if (!it)
    {
        document.getElementById('right').replaceChildren();
        return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選道具）' : '先在上方選擇專案資料夾'));
    }
    const shown = [...new Set([...SC.shownFields(it), ...[...(S.extra[id] ?? [])].filter(k => SC.FIELDS[k])])];
    const rest = Object.keys(SC.FIELDS).filter(k => !shown.includes(k));
    const warns = [F.fullDraft(), ...validate(id)].filter(Boolean);
    const known = (k) => !!SC.FIELDS[k];
    view.replaceChildren(...[
        h('div', {class: 'head'},
            IC.iconEl(it.icon, 48),
            h('span', {class: 'bigid'}, id),
            D.dirty(id) && h('span', {class: 'dirty'}, '●'),
            h('span', {class: 'grow'}),
            F.modeBtn(),
            h('button', {type: 'button', onclick: () => D.askRename(id)}, '改名…'),
            h('button', {type: 'button', onclick: () => D.dup(id)}, '複製'),
            h('button', {type: 'button', onclick: () => D.remove(id)}, '刪除…')),
        warns.length && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
        S.json ? F.fullJson(id) : h('div', {class: 'fields'},
            shown.map(k => fieldRow(id, it, k)),
            rest.length && [h('span', {class: 'k unset'}, '加欄位'),
                h('select', {onchange: e => {
                    const k = e.target.value, def = SC.FIELDS[k];
                    if (def.type === 'obj') {S.open[k] = true; return set(id, [k], {});}
                    if (def.type === 'effects') return addEff(id);
                    (S.extra[id] ??= new Set()).add(k);
                    render();
                }}, h('option', {value: ''}, '…'), rest.map(k => h('option', {value: k}, `${SC.FIELDS[k].label}　${k}`)))],
            otherBox(id, it, known)),
    ].filter(Boolean));
    renderPreview(id, it);
}

// ---------- 預覽 ----------
// 人偶＝第一個這個性別的玩家角色（只拿長相，身上只穿這件）；沒有就光身體
const DOLL = {m: 'body-man', f: 'body-woman'};
const dollOf = (sx) => Object.entries(S.roles).find(([, r]) => r.kind === 'player' && (r.sex ?? 'm') === sx);

function renderPreview(id, it)
{
    const [rid, r] = dollOf(S.sex) ?? [];
    const doll = {...(r ?? {w: 32, h: 64, anchor: {x: 0, y: 16}, sex: S.sex, body: DOLL[S.sex]}), inv: {equips: [id]}};
    const note = !isObj(it.equip) ? h('span', {class: 'warn'}, '（沒有 equip，不能裝備）')
        : S.sex === 'f' && (isObj(it.equip.f) ? '，用女版 f' : '（沒有 f，用基準數字）');
    const sexBtn = (sx, name) => h('button', {type: 'button', class: S.sex === sx ? 'on' : '', dataset: {sex: sx}, onclick: () => setSex(sx)}, name);
    document.getElementById('right').replaceChildren(
        h('div', {class: 'cap'}, `套在 ${rid ?? DOLL[S.sex]}`, note),
        previewEl(doll, S.items, S.parts),
        h('div', {class: 'sexsw'}, sexBtn('m', '男'), sexBtn('f', '女')));
}

function setSex(sx)
{
    S.sex = sx;
    try {localStorage.setItem(SEX_KEY, sx);} catch {}
    render();
}

// ---------- 總覽表 ----------
function cellText(k, it)
{
    if (k === '#eff') return (it.effects ?? []).map(SC.effSummary).join('；');
    const v = it[k];
    if (v === undefined) return '';
    if (Array.isArray(v)) return v.join(', ');
    if (k === 'cat') return SC.CAT_NAMES[v] ?? v;
    if (typeof v === 'boolean') return v ? '✔' : '';
    return String(v);
}

function tableCell(id, c)
{
    const it = S.items[id];
    if (c === '#eff') return h('td', {class: 'eff', title: cellText(c, it)}, cellText(c, it));
    const def = SC.FIELDS[c];
    if (def.type === 'icon') return h('td', {class: 'edit', onclick: async () => {const v = await IC.pickIcon(it.icon); if (v !== null) set(id, ['icon'], v || undefined);}}, IC.iconEl(it[c], 24));
    if (def.type === 'bool') return h('td', null, h('input', {type: 'checkbox', checked: !!it[c], onchange: e => set(id, [c], e.target.checked || undefined)}));
    const num = def.type === 'int' || def.type === 'num';
    return h('td', {class: 'edit' + (num ? ' n' : ''), title: '雙擊編輯',
        ondblclick: e => V.editCell(e.currentTarget, fieldInput(def, it[c], v => set(id, [c], v), `table.${id}.${c}`))}, cellText(c, it));
}

// ---------- 畫面 ----------
function draw()
{
    const its = Object.values(S.items);
    const effs = its.flatMap(it => Array.isArray(it.effects) ? it.effects : []);
    renderDatalists({
        items: Object.keys(S.items),
        cat_sub: [...SC.FIELDS.cat_sub.suggest, ...its.flatMap(it => it.cat_sub ?? [])],
        class: [...SC.FIELDS.device.fields.class.suggest, ...its.map(it => it.device?.class)],
        key: [...SC.STATS, ...effs.map(e => e.key)],
        id: [...SC.EFF_FIELDS.id.suggest, ...S.fx, ...effs.map(e => e.id)],
        anim: S.anims ?? [],
    }, {items: o => S.items[o]?.lab});

    const ids = Object.keys(S.items);
    V.renderList([
        ...[...SC.CATS, ''].map(c => [n => c ? `${SC.CAT_NAMES[c]}（${n}）` : `無分類（${n}）`, ids.filter(id => (S.items[id].cat ?? '') === c), c]),
        ['不認識的分類', ids.filter(id => S.items[id].cat && !SC.CATS.includes(S.items[id].cat)), '#unknown'],
    ]);
    if (S.view === 'form') return renderForm();
    document.getElementById('right').replaceChildren();
    V.renderTable(SC.TABS, {
        inTab: (tab, id) => SC.inTab(tab, S.items[id]),
        sortKey: (id, col) => col === '#eff' ? (S.items[id].effects?.length ?? 0) : S.items[id][col],
        head: (c) => c === '#eff' ? ['效果'] : [SC.FIELDS[c].label, c],
        cell: tableCell,
    });
}

(async () => {
    [S.fx, S.anims, S.roles, S.parts] = await Promise.all([loadKeys('fx.json'), loadKeys('anim.json'), loadJson('role.json'), loadJson('part.json')]);
    render();
    IC.ready.then(render);
    D.listenGoto();
    D.start();
})();

// 給無頭測試用
window.__ie = {S, setAssets: D.setAssets, reload: D.reload, save: D.save, commit, set, undo: D.undo, redo: D.redo, add, dup: D.dup,
               rename: D.rename, remove: D.remove, addEff, delEff, scanRefs: D.scanRefs, innerRefs, validate, validateAll, render, IC, JE, setSex};
