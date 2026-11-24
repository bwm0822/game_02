import {h, ask, status} from '../common/dom.js';
import {str, isObj, getAt} from '../common/obj.js';
import {createDoc} from '../common/doc.js';
import {createForm} from '../common/form.js';
import {createViews, renderDatalists} from '../common/views.js';
import * as IC from '../common/icons.js';
import * as SH from '../common/shell.js';
import '../common/combo.js';
import '../common/splitter.js';
import {BUILTIN} from '../../src/core/particle.js';
import * as SC from './schema.js';
import {createPForm, pIcon, validateDef, isBurst, easeNames} from './pform.js';
import {previewEl, PV} from './preview.js';

const REF_FILES = ['ability.json', 'item.json', 'fx.json', 'prefab.json'];
const TAB_OF = {'ability.json': 'ability', 'item.json': 'item', 'fx.json': 'fx', 'prefab.json': 'scene'};
const TAB_NAME = {ability: '能力', item: '道具', fx: '特效', scene: '場景（prefab）'};
const REF_KEYS = ['particle', 'tickParticle'];

// 改名只動 particle.json 的 key；確認框列出其他檔案的引用（doc.js 掃 assets），不跟著改
const D = createDoc({
    file: 'particle.json', noun: '粒子',
    external: '可能是手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if ([...REF_FILES, 'role.json', 'part.json'].includes(file)) loadRefs().then(render);},
    // 道具拿在手上用的（item.json 的 equip.particle）：刪除擋、改名只列
    ext: {
        title: '拿在手上的道具（equip.particle，不會改，要自己處理）',
        blockDelete: '有道具拿在手上用它（item.json 的 equip.particle）：先到道具分頁或場景分頁換掉',
        refs: async (id) => {
            const lines = Object.entries(S.ext.items ?? {}).filter(([, it]) => it?.equip?.particle?.particle === id).map(([k]) => `道具 ${k}`);
            return {lines, n: lines.length, data: null};
        },
        rename: () => status('拿在手上的道具還指著舊 id：到道具分頁或場景分頁改'),
    },
});
const {S, render, commit, set} = D;
S.refs = {};    // 粒子 id → [{tab, id, at}]
S.ext = {roles: {}, items: {}, parts: {}};
const F = createForm(D);
const PF = createPForm({S, F, set, commit, render});

const V = createViews(D, {icon: id => S.data[id]?.img, lab: id => labOf(id), warns: id => validate(id),
    item: (el, id) => {const img = S.data[id]?.img; if (BUILTIN.includes(img)) el.querySelector('.ico')?.replaceWith(pIcon(img, 20));}});

const refsOf = (id) => S.refs[id] ?? [];
const missing = () => Object.keys(S.refs).filter(id => !S.data[id]);
const isUnused = (id) => !refsOf(id).length;
const labOf = (id) => S.data[id] ? (isBurst(S.data[id]) ? '一次噴' : '持續') : '缺粒子';

const validate = (id) => validateDef(S.data[id]);
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
    const p = ask('新粒子', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id),
        h('div', {class: 'hint'}, '下拉是有人引用、還沒有的粒子 id')], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p === 'ok') add(id.value.trim());
}

// ---------- 表單 ----------
function refsEl(id)
{
    const refs = refsOf(id);
    return h('div', {class: 'refs'}, h('span', null, '用到的：'),
        refs.length ? refs.map(r => r.tab ? h('a', {class: 'go', title: `跳到${TAB_NAME[r.tab]}分頁（${r.at}）`, onclick: () => SH.gotoTab(r.tab, [r.id])}, `${TAB_NAME[r.tab]} ${r.id}・${r.at} ↗`)
                                          : h('span', {title: 'Tiled 的自訂屬性 particle（到 Tiled 改）'}, `${r.id}・${r.at}`))
                    : h('span', {class: 'dim'}, '（還沒有人用）'));
}

function renderForm()
{
    const id = S.sel, p = S.data[id];
    const view = document.getElementById('view');
    if (!p && id && S.refs[id])
        return view.replaceChildren(h('div', {class: 'head'}, h('span', {class: 'bigid'}, id), h('span', {class: 'dim'}, '缺粒子：引用到了但 particle.json 沒有，遊戲不會噴')),
            refsEl(id), h('button', {type: 'button', onclick: () => add(id)}, '用範本建立'));
    if (!p) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選粒子）' : '先在上方選擇專案資料夾'));
    view.replaceChildren(h('div', {class: 'split'},
        h('div', {class: 'form'},
            h('div', {class: 'head'},
                pIcon(p.img ?? 'p-dot', 48),
                h('span', {class: 'bigid'}, id),
                D.dirty(id) && h('span', {class: 'dirty'}, '●'),
                h('span', {class: 'grow'}),
                F.modeBtn(),
                h('button', {type: 'button', onclick: () => D.askRename(id)}, '改名…'),
                h('button', {type: 'button', onclick: () => D.dup(id)}, '複製'),
                h('button', {type: 'button', onclick: () => D.remove(id)}, '刪除…')),
            refsEl(id),
            h('div', {class: 'pform'}, PF.body(id, p))),
        previewEl(id, p, S.ext)));
}

// ---------- 總覽表 ----------
function cellText(c, p, id)
{
    if (c === 'mode') return isBurst(p) ? '一次噴' : '持續';
    if (c === '#amount') return isBurst(p) ? `${p.count ?? 10} 顆` : p.duration ? `${p.duration}ms` : '到停';
    if (c === '#refs') return refsOf(id).map(r => r.id).join(', ');
    const v = getAt(p, c.split('.'));
    return v === undefined ? '' : typeof v === 'object' ? str(v) : String(v);
}

function tableCell(id, c)
{
    const p = S.data[id];
    if (c === 'img') return h('td', null, pIcon(p.img ?? 'p-dot', 24));
    return h('td', null, cellText(c, p, id));
}

const HEAD = {'img': ['圖'], 'mode': ['模式'], '#amount': ['量／時間'], 'lifespan': ['壽命'], 'blendMode': ['混合'], '#refs': ['用到的']};

// ---------- 畫面 ----------
function draw()
{
    // 拿到專案資料夾後補掃地圖
    if (S.assets && S.refsFor !== S.assets) {S.refsFor = S.assets; S.refsP = loadRefs().then(render);}
    const ids = Object.keys(S.data), miss = missing();
    renderDatalists({missing: miss, eases: easeNames()});
    V.renderList([
        [n => `粒子（${n}）`, ids.filter(id => !isUnused(id)), 'used'],
        [n => `未使用（${n}）`, ids.filter(isUnused), 'unused'],
        [n => `缺粒子（${n}）`, miss, 'missing'],
    ]);
    for (const el of document.querySelectorAll('#list .item'))
        el.classList.toggle('ghost', !S.data[el.dataset.id] || isUnused(el.dataset.id));
    if (S.view === 'form') return renderForm();
    V.renderTable(SC.TABS, {
        inTab: () => true,
        sortKey: (id, c) => cellText(c, S.data[id], id),
        head: (c) => HEAD[c],
        cell: tableCell,
    });
}

// 往下找 particle／tickParticle 字串；at＝路徑（cast.particle、travel.particle…）
export function collectRefs(data, tab, out)
{
    const walk = (v, owner, path) => {
        if (Array.isArray(v)) return v.forEach((x, i) => walk(x, owner, `${path}[${i}]`));
        if (!isObj(v)) return;
        for (const [k, x] of Object.entries(v))
        {
            const at = path ? `${path}.${k}` : k;
            if (REF_KEYS.includes(k) && typeof x === 'string' && x) (out[x] ??= []).push({tab, id: owner, at});
            else walk(x, owner, at);
        }
    };
    for (const [id, v] of Object.entries(data)) walk(v, id, '');
}

// Tiled 的自訂屬性 particle（地圖本身＝環境粒子、物件＝那個物件噴）：{name: 'particle', value}；at＝物件名稱／id，地圖本身是「地圖」
export function collectTiled(data, file, out)
{
    const visit = (v, at) => {
        if (Array.isArray(v)) return v.forEach(x => visit(x, at));
        if (!isObj(v)) return;
        const here = v === data ? '地圖' : v.name || (v.id !== undefined ? `#${v.id}` : at);
        if (Array.isArray(v.properties))
            for (const p of v.properties)
                if (p?.name === 'particle' && typeof p.value === 'string' && p.value) (out[p.value] ??= []).push({tab: null, id: file, at: here});
        for (const [k, x] of Object.entries(v)) if (k !== 'properties') visit(x, here);
    };
    visit(data, '');
}

async function walk(dir, path, fn)
{
    for await (const fh of dir.values())
    {
        const p = `${path}/${fh.name}`;
        if (fh.kind === 'directory') await walk(fh, p, fn);
        else await fn(fh, p);
    }
}

// 地圖／template 要有專案資料夾才掃得到（dev server 沒有清單）
async function tiledRefs(refs)
{
    const assets = S.assets?.dir;
    if (!assets) return;
    for (const [dir, ext] of [['maps', '.json'], ['templates', '.tj']])
    {
        let d = null;
        try {d = await assets.getDirectoryHandle(dir);} catch {continue;}
        await walk(d, dir, async (fh, p) => {
            if (!fh.name.endsWith(ext)) return;
            try {collectTiled(JSON.parse(await (await fh.getFile()).text()), p, refs);} catch {}
        });
    }
}

async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const refs = {};
    for (const f of REF_FILES) collectRefs(await get(f), TAB_OF[f], refs);
    await tiledRefs(refs);
    const [roles, items, parts] = await Promise.all([get('role.json'), get('item.json'), get('part.json')]);
    S.refs = refs;
    S.refsFor = S.assets;
    Object.assign(S.ext, {roles, items, parts});
}

(async () => {
    await loadRefs();
    render();
    IC.ready.then(render);
    D.listenGoto();
    D.start();
})();

PV.onZone = (k, z) => S.sel && S.data[S.sel] && set(S.sel, [k], z);

// 給無頭測試用
window.__pt = {S, D, add, validate, validateAll, missing, isUnused, render, loadRefs, collectRefs, collectTiled, SC, PV};
