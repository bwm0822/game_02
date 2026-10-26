import {h, ask, status} from '../common/dom.js';
import {str, isObj, getAt, replaceRaw, parseNum} from '../common/obj.js';
import {createDoc} from '../common/doc.js';
import {fieldInput, createForm} from '../common/form.js';
import {createViews, renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SC from './schema.js';
import {previewEl, PV} from './preview.js';

// fx 的 id 就是效果 id，改名只列出 ability／item 的引用（doc.js 掃 assets），不跟著改
const D = createDoc({
    file: 'fx.json', noun: '特效',
    external: '可能是手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if (['ability.json', 'item.json', 'role.json'].includes(file)) loadRefs().then(render);},
});
const {S, render, commit, set} = D;
S.refs = {};    // 效果 id → [{tab: 'ability'|'item', id, type}]，type:'action' 是瞬間效果不播特效，不收
S.ext = {roles: {}, items: {}};     // 預覽用的唯讀參考資料
const F = createForm(D);
const V = createViews(D, {icon: id => S.data[id]?.img, lab: id => labOf(id), warns: id => validate(id)});

const refsOf = (id) => S.refs[id] ?? [];
const missing = () => Object.keys(S.refs).filter(id => !S.data[id]);
const isUnused = (id) => !refsOf(id).length;
const labOf = (id) => S.data[id] ? [...new Set(refsOf(id).map(r => r.type))].join(' ') : '缺特效';

// ---------- 檢查 ----------
function validate(id)
{
    const fx = S.data[id], out = [];
    if (!fx) return out;
    if (!fx.img) out.push('沒有圖 img');
    else {const e = IC.check(fx.img); if (e) out.push(`img：${e}`);}
    const cell = fx.cell;
    if (cell !== undefined && !isObj(cell)) out.push('cell 應該是物件');
    else if (cell)
        for (const [k, v] of Object.entries(cell))
        {
            const def = SC.CELL[k];
            if (!def) continue;
            if (def.type === 'num' && typeof v !== 'number') out.push(`cell.${k} 不是數字：${str(v)}`);
            if (def.type === 'range' && typeof v !== 'number' && !(Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number')))
                out.push(`cell.${k} 要是數字或 [min, max]：${str(v)}`);
            if (def.type === 'enum' && !def.options.includes(v)) out.push(`cell.${k} 不認識的值：${v}`);
            if (def.type === 'bool' && typeof v !== 'boolean') out.push(`cell.${k} 應該是 true/false`);
            if (def.type === 'flip' && v !== true && v !== false && v !== 'random') out.push(`cell.${k} 要是 true／false／"random"`);
        }
    for (const {k} of SC.STAGES) if (fx[k] !== undefined && !isObj(fx[k])) out.push(`${k} 應該是物件（Phaser tween 設定）`);
    if (cell?.flash && fx.idle) out.push('閃一下的特效不會播 idle');
    if (cell?.flash && fx.body) out.push('閃一下的特效不會套 body');
    if (isObj(fx.body))
    {
        const other = Object.keys(fx.body).filter(k => !/^(angle|duration|ease|yoyo|repeat|delay|hold|repeatDelay)$/.test(k));
        if (other.length) out.push(`body 只支援 angle，其他屬性會亂動角色：${other.join(', ')}`);
    }
    return out;
}

const validateAll = () => Object.keys(S.data).flatMap(id => validate(id).map(w => `${id}：${w}`));

// ---------- 新增 ----------
function add(id)
{
    const err = D.idError(id);
    if (err) return status(err);
    commit(() => {S.data[id] = SC.template(); S.sel = id;});
}

async function askNew(def = '')
{
    const id = h('input', {size: 24, value: def, dataset: {combo: 'dl-missing'}});
    const p = ask('新特效', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id),
        h('div', {class: 'hint'}, 'id 要跟效果（ability／item 的 effects）的 id 一樣；下拉是還沒有特效的效果')], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim());
}

// ---------- 表單 ----------
function cellInput(id, k, def, v)
{
    const put = (val) => set(id, ['cell', k], val);
    const data = {k: `cell.${k}`};
    if (def.type === 'range')
        return h('input', {dataset: data, value: Array.isArray(v) ? v.join(', ') : v ?? '', onchange: e => {
            const a = e.target.value.split(',').map(s => parseNum(s)).filter(n => n !== undefined);
            put(a.length === 0 ? undefined : a.length === 1 ? a[0] : a.slice(0, 2));
        }});
    if (def.type === 'flip')
    {
        const cur = v === 'random' ? 'random' : v ? 'true' : '';
        return h('select', {dataset: data, onchange: e => put({'': undefined, true: true, random: 'random'}[e.target.value])},
            [['', '不翻'], ['true', '翻面'], ['random', '隨機']].map(([o, n]) => h('option', {value: o, selected: o === cur}, n)));
    }
    return fieldInput(def, v, put, `cell.${k}`);
}

function cellBox(id, fx)
{
    const c = isObj(fx.cell) ? fx.cell : {};
    const known = (k) => !!SC.CELL[k];
    const open = S.open.cell ??= true;
    return h('div', {class: 'box'},
        F.boxBar('cell', open, true, h('span', {title: 'cell'}, '格子'),
            h('span', {class: 'dim'}, Object.entries(c).map(([a, x]) => `${a}:${str(x)}`).join('  '))),
        open && h('div', {class: 'fields'},
            Object.entries(SC.CELL).map(([k, d]) => [
                h('span', {class: 'k' + (c[k] === undefined ? ' unset' : ''), title: `cell.${k}`}, d.label),
                h('span', {class: 'iconField'}, cellInput(id, k, d, c[k]), d.hint && h('span', {class: 'dim'}, d.hint)),
            ]),
            h('span', {class: 'k unset'}, '其他'),
            F.rawArea(c, known, raw => commit(() => {S.data[id].cell ??= {}; replaceRaw(S.data[id].cell, known, raw); if (!Object.keys(S.data[id].cell).length) delete S.data[id].cell;}), 'cell.#raw')));
}

function stageBox(id, fx, {k, label, hint})
{
    const v = fx[k], open = v !== undefined && (S.open[k] ??= true);
    const sum = isObj(v) ? Object.entries(v).filter(([, x]) => typeof x !== 'object').map(([a, x]) => `${a}:${x}`).join('  ') : '';
    return h('div', {class: 'box'},
        F.boxBar(k, open, v !== undefined, h('span', {title: k}, label), h('span', {class: 'hint'}, hint),
            h('span', {class: 'grow'}), h('span', {class: 'dim'}, sum),
            v === undefined ? h('button', {type: 'button', onclick: () => {S.open[k] = true; set(id, [k], k === 'body' ? {angle: {from: -8, to: 8}, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.InOut'} : {duration: 200});}}, '建立')
                            : h('button', {type: 'button', onclick: () => set(id, [k], undefined)}, '移除')),
        open && F.rawArea(v, () => false, raw => set(id, [k], isObj(raw) && Object.keys(raw).length ? raw : undefined), `${k}.#raw`));
}

function otherBox(id, fx)
{
    const known = (k) => SC.TOP.has(k);
    const raw = Object.fromEntries(Object.entries(fx).filter(([k]) => !known(k)));
    const n = Object.keys(raw).length;
    if (!n) return null;
    const open = F.isOpen('#raw', raw);
    return h('div', {class: 'box'},
        F.boxBar('#raw', open, true, '其他欄位', h('span', {class: 'dim'}, `（${n}）遊戲沒在讀的 key`)),
        open && F.rawArea(fx, known, raw => commit(() => replaceRaw(S.data[id], known, raw)), '#raw'));
}

function refsEl(id)
{
    const refs = refsOf(id);
    return h('div', {class: 'refs'}, h('span', null, '用到的：'),
        refs.length ? refs.map(r => h('span', {title: `${r.tab}.json 的 effects（type: ${r.type}）`}, `${r.tab === 'ability' ? '能力' : '道具'} ${r.id}`))
                    : h('span', {class: 'dim'}, '（沒有效果用這個 id，遊戲不會播）'));
}

function renderForm()
{
    const id = S.sel, fx = S.data[id];
    const view = document.getElementById('view');
    if (!fx && id && S.refs[id])
        return view.replaceChildren(h('div', {class: 'head'}, h('span', {class: 'bigid'}, id), h('span', {class: 'dim'}, '缺特效：遊戲裡這個效果不會顯示')),
            refsEl(id), h('button', {type: 'button', onclick: () => add(id)}, '用範本建立'));
    if (!fx) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選特效）' : '先在上方選擇專案資料夾'));
    const warns = validate(id);
    view.replaceChildren(h('div', {class: 'split'},
        h('div', {class: 'form'},
            h('div', {class: 'head'},
                IC.iconEl(fx.img, 48),
                h('span', {class: 'bigid'}, id),
                D.dirty(id) && h('span', {class: 'dirty'}, '●'),
                h('span', {class: 'grow'}),
                h('button', {type: 'button', onclick: () => D.askRename(id)}, '改名…'),
                h('button', {type: 'button', onclick: () => D.dup(id)}, '複製'),
                h('button', {type: 'button', onclick: () => D.remove(id)}, '刪除…')),
            refsEl(id),
            warns.length > 0 && h('ul', {class: 'warns'}, warns.map(w => h('li', null, w))),
            h('div', {class: 'fields'},
                h('span', {class: 'k' + (fx.img === undefined ? ' unset' : ''), title: 'img'}, '圖'),
                fieldInput({type: 'icon'}, fx.img, v => set(id, ['img'], v), 'img'),
                cellBox(id, fx),
                SC.STAGES.map(st => stageBox(id, fx, st)),
                otherBox(id, fx))),
        previewEl(id, fx, S.ext)));
}

// ---------- 總覽表 ----------
function cellText(c, fx, id)
{
    if (c === '#stages') return SC.STAGES.filter(s => fx[s.k] !== undefined).map(s => s.k).join(' ');
    if (c === '#refs') return refsOf(id).map(r => r.id).join(', ');
    const v = getAt(fx, c.split('.'));
    if (typeof v === 'boolean') return v ? '✔' : '';
    return v === undefined ? '' : String(v);
}

function tableCell(id, c)
{
    const fx = S.data[id];
    if (c === 'img') return h('td', {class: 'edit', onclick: async () => {const v = await IC.pickIcon(fx.img); if (v !== null) set(id, ['img'], v || undefined);}}, IC.iconEl(fx.img, 24));
    return h('td', {class: c === 'cell.size' ? 'n' : ''}, cellText(c, fx, id));
}

const HEAD = {'img': ['圖'], 'cell.size': ['大小', 'cell.size'], 'cell.align': ['基準', 'cell.align'], 'cell.flash': ['閃', 'cell.flash'], '#stages': ['階段'], '#refs': ['用到的']};

// ---------- 畫面 ----------
function draw()
{
    const ids = Object.keys(S.data), miss = missing();
    renderDatalists({missing: miss});
    V.renderList([
        [n => `特效（${n}）`, ids.filter(id => !isUnused(id)), 'used'],
        [n => `未使用（${n}）`, ids.filter(isUnused), 'unused'],
        [n => `缺特效（${n}）`, miss, 'missing'],
    ]);
    for (const el of document.querySelectorAll('#list .item'))
        el.classList.toggle('ghost', !S.data[el.dataset.id] || isUnused(el.dataset.id));
    if (S.view === 'form') return renderForm();
    V.renderTable(SC.TABS, {
        inTab: () => true,
        sortKey: (id, c) => c.startsWith('#') || c === 'img' ? cellText(c, S.data[id], id) : getAt(S.data[id], c.split('.')),
        head: (c) => HEAD[c],
        cell: tableCell,
    });
}

// 每個 ability／item 往下找所有 effects 陣列（技能的 hits[].effects、道具的 effects…）
function collectRefs(data, tab, out)
{
    const walk = (v, owner) => {
        if (Array.isArray(v)) return v.forEach(x => walk(x, owner));
        if (!isObj(v)) return;
        if (Array.isArray(v.effects))
            for (const e of v.effects)
                if (isObj(e) && typeof e.id === 'string' && e.type !== 'action')
                {
                    const list = out[e.id] ??= [];
                    if (!list.some(r => r.tab === tab && r.id === owner)) list.push({tab, id: owner, type: e.type ?? ''});
                }
        for (const x of Object.values(v)) walk(x, owner);
    };
    for (const [id, v] of Object.entries(data)) walk(v, id);
}

async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const [abilities, items, roles] = await Promise.all([get('ability.json'), get('item.json'), get('role.json')]);
    const refs = {};
    collectRefs(abilities, 'ability', refs);
    collectRefs(items, 'item', refs);
    S.refs = refs;
    Object.assign(S.ext, {roles, items});
}

(async () => {
    await loadRefs();
    render();
    IC.ready.then(render);
    D.listenGoto();
    D.start();
})();

// 給無頭測試用
window.__fx = {S, D, add, validate, validateAll, missing, isUnused, render, loadRefs, SC, PV};
