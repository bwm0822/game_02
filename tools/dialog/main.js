import {$, h, ask, status} from '../common/dom.js';
import {createDoc} from '../common/doc.js';
import {createViews, renderDatalists} from '../common/views.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SF from '../common/storyform.js';
import * as SH from '../common/shell.js';
import * as IC from '../common/icons.js';
import {checkStory} from '../../src/data/storycheck.js';
import {COMMON} from '../../src/data/storydata.js';

// dialog.json = {_common, <npc>: {entries, lines, nodes, extend}}（合併前），格式見 docs/story-architecture.md §6
const CONCEPTS = ['greet', 'underAtk', 'stolen'];

const D = createDoc({
    file: 'dialog.json', noun: '份對話',
    external: '可能是手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if (['story.json', 'role.json', 'item.json'].includes(file)) loadRefs().then(render);},
});
const {S, render, commit} = D;
S.refs = {roles: {}, items: {}, story: {}, dialog: {}, maps: []};
S.results = [];

const toPath = (r) => r.file === 'dialog.json' ? r.path : null;
const storyPath = ([top, k, ...rest]) => top === 'qualities' ? ['@qualities', k, ...rest] : [k, ...rest];
const issues = (id) => S.results.filter(r => toPath(r)?.[0] === id);
const validateAll = () => S.results.filter(r => r.file === 'dialog.json').map(r => `${r.path.join('.')}：${r.msg}`);
const roleLab = (id) => id === COMMON ? '所有 NPC 共用' : S.refs.roles[id]?.lab;

const V = createViews(D, {
    icon: id => id === COMMON ? '💬' : S.refs.roles[id]?.icon,
    lab: roleLab,
    warns: id => issues(id).map(r => r.msg),
});

// 節點的位置：NPC 自己的 → _common 的 → story.json 的長對話節點（跳到任務分頁）
function storyNode(npc, id)
{
    const l = Object.keys(S.refs.story.lines ?? {}).find(k => S.refs.story.lines[k].nodes?.[npc]?.[id]);
    return l && [l, 'nodes', npc, id];
}
const F = SF.createStoryForm(D, {
    mood: true,
    nodeLink: (npc, id) => {
        if (S.data[npc]?.nodes?.[id]) return () => SF.jumpTo(D, [npc, 'nodes', id]);
        if (S.data[COMMON]?.nodes?.[id]) return () => SF.jumpTo(D, [COMMON, 'nodes', id]);
        const p = storyNode(npc, id);
        return p && (() => SH.gotoTab('story', p));
    },
});
const {get, btn, row} = F;
const pendingGoto = SF.listenGoto(D);

// ---------- 新增 ----------
async function askNew()
{
    const ids = Object.keys(S.refs.roles).filter(id => !(id in S.data) && (S.refs.roles[id].unique || S.refs.roles[id].kind === 'npc'));
    const sel = h('select', null, ids.map(id => h('option', {value: id}, `${id}　${S.refs.roles[id].lab ?? ''}`)));
    if (!ids.length) return status('role.json 的 NPC 都已經有自己的對話了');
    const p = ask('NPC 自己的對話', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'NPC'), sel),
        h('div', {class: 'hint'}, '沒有自己對話的 NPC 整套用 _common；建立之後同名的節點、entry 用自己的，line 兩邊都會挑')], [['ok', '建立'], ['cancel', '取消']]);
    if (await p === 'ok') create(sel.value);
}

function create(id) {commit(() => {S.data[id] = {}; S.sel = id;});}

async function askId(title, hint, value = '')
{
    const id = h('input', {size: 20, value, dataset: {combo: `dl-nodes-${S.sel}`}});
    const p = ask(title, [id, hint && h('div', {class: 'hint'}, hint)], [['ok', '確定'], ['cancel', '取消']]);
    id.focus();
    return await p === 'ok' ? id.value.trim() : null;
}

async function addNode(npc)
{
    const nid = await askId('新節點', '節點 id（ASCII，習慣用 n_ 開頭）', 'n_');
    if (!nid) return;
    if (!/^[\x21-\x7e]+$/.test(nid)) return status('節點 id 要是 ASCII');
    if (S.data[npc].nodes?.[nid]) return status(`已經有 ${nid}`);
    S.open[SF.keyOf([npc, 'nodes', nid])] = true;
    commit(() => {(S.data[npc].nodes ??= {})[nid] = {texts: {true: ''}, choices: [{label: '', next: 'n_default'}]};});
}

// 把 _common 的節點複製一份到 NPC 自己身上（同名蓋過）
function override(npc, nid)
{
    S.open[SF.keyOf([npc, 'nodes', nid])] = true;
    commit(() => {(S.data[npc].nodes ??= {})[nid] = structuredClone(S.data[COMMON].nodes[nid]);});
}

async function addExtend(npc)
{
    const nid = await askId('加掛選項', '要掛到哪個節點底下（合併 _common 之後的節點都可以），不用複製整個節點');
    if (!nid) return;
    commit(() => {((S.data[npc].extend ??= {})[nid] ??= []).push({label: ''});});
}

// ---------- 表單 ----------
function section(title, hint, ...btns) {return h('div', {class: 'sec'}, title, h('span', {class: 'dim'}, hint), h('span', {class: 'grow'}), ...btns);}

function removeAt(path, i)
{
    commit(() => {
        const a = get(path);
        a.splice(i, 1);
        if (!a.length) delete get(path.slice(0, -1))[path.at(-1)];
    });
}

function entryRows(npc)
{
    const list = S.data[npc].entries ?? [], path = [npc, 'entries'];
    const add = () => commit(() => {(S.data[npc].entries ??= []).push({node: 'n_default', priority: 9});});
    const inherited = npc === COMMON ? [] : (S.data[COMMON]?.entries ?? []).filter(e => !list.some(m => m.node === e.node));
    return [
        section('入口', '（entry：開對話時依排序取第一個條件成立的；同節點的用自己的）', btn('新增入口', '＋ 入口', add)),
        h('div', {class: 'rows'},
            (list.length > 0 || inherited.length > 0) && h('div', {class: 'ehead'}, ['節點', '排序', '條件', '進入時', ''].map(t => h('span', null, t))),
            list.map((e, i) => {
                const p = [...path, i];
                return h('div', {class: 'erow', dataset: {k: SF.keyOf(p)}},
                    h('span', {class: 'cellrow'}, F.text([...p, 'node'], {size: 12, combo: `dl-nodes-${npc}`}), F.link(npc, e.node)),
                    F.num([...p, 'priority']),
                    F.cond([...p, 'condition']),
                    F.lines([...p, 'actions'], '（不做事）'),
                    btn('刪除', '×', () => removeAt(path, i)));
            }),
            inherited.map(e => h('div', {class: 'erow inh', title: '_common 的入口（沿用）'},
                h('span', {class: 'cellrow'}, e.node, F.link(npc, e.node)), h('span', null, e.priority ?? 0),
                h('span', null, e.condition ?? ''), h('span', null, (e.actions ?? []).join('; ')), h('span', {class: 'dim'}, '_common'))))];
}

function lineRows(npc)
{
    const list = S.data[npc].lines ?? [], path = [npc, 'lines'];
    const add = () => commit(() => {(S.data[npc].lines ??= []).push({concept: 'greet', text: ''});});
    const common = npc === COMMON ? 0 : (S.data[COMMON]?.lines ?? []).length;
    return [
        section('台詞', `（line：條件數最多的勝出，自己的 +1 分，同分隨機；text 用 / 分隔多句隨機挑${common ? `；另外沿用 _common 的 ${common} 句` : ''}）`, btn('新增台詞', '＋ 台詞', add)),
        h('div', {class: 'rows'},
            list.length > 0 && h('div', {class: 'lhead'}, ['情境', '條件', '台詞', ''].map(t => h('span', null, t))),
            list.map((l, i) => {
                const p = [...path, i];
                return h('div', {class: 'lrow', dataset: {k: SF.keyOf(p)}},
                    F.text([...p, 'concept'], {size: 10, combo: 'dl-concept'}),
                    F.cond([...p, 'condition']),
                    F.text([...p, 'text']),
                    btn('刪除', '×', () => removeAt(path, i)));
            }))];
}

function nodeSection(npc)
{
    const nodes = S.data[npc].nodes ?? {};
    const common = npc === COMMON ? [] : Object.keys(S.data[COMMON]?.nodes ?? {}).filter(id => !nodes[id]);
    return [
        section('節點', npc === COMMON ? '（所有 NPC 共用，NPC 自己有同名節點就用自己的）' : '（同名蓋過 _common 的）', btn('新增節點', '＋ 節點', () => addNode(npc))),
        common.length > 0 && h('div', {class: 'inhrow dim'}, '沿用 _common：', common.map(id => h('span', {class: 'chip'},
            h('a', {onclick: () => SF.jumpTo(D, [COMMON, 'nodes', id])}, id),
            btn(`複製一份到 ${npc} 覆寫`, '覆寫', () => override(npc, id))))),
        Object.keys(nodes).map(id => F.nodeCard([npc, 'nodes', id], npc, () => commit(() => {
            delete S.data[npc].nodes[id];
            if (!Object.keys(S.data[npc].nodes).length) delete S.data[npc].nodes;
        }))),
    ];
}

function extendSection(npc)
{
    const ext = S.data[npc].extend ?? {};
    return [
        section('加掛選項', '（extend：掛到某個節點底下的額外選項，不用複製整個節點）', btn('加掛選項', '＋ 加掛', () => addExtend(npc))),
        Object.keys(ext).map(nid => h('div', {class: 'card', dataset: {k: SF.keyOf([npc, 'extend', nid])}},
            h('div', {class: 'bar'}, h('b', null, nid), F.link(npc, nid), h('span', {class: 'grow'}),
                btn('刪除', '×', () => commit(() => {delete S.data[npc].extend[nid]; if (!Object.keys(S.data[npc].extend).length) delete S.data[npc].extend;}))),
            F.choicesBox([npc, 'extend', nid], npc))),
    ];
}

// story.json 裡 who 對到這個 NPC 的劇情卡、這個 NPC 的長對話節點（唯讀，點了跳到任務分頁）
function storySection(npc)
{
    const job = S.refs.roles[npc]?.job;
    const hit = (who) => who === npc || who === '*' || (job && who === `job:${job}`);
    const cards = [], nodes = [];
    for (const [l, line] of Object.entries(S.refs.story.lines ?? {}))
    {
        (line.storylets ?? []).forEach((s, i) => {if (s.who && hit(s.who)) cards.push({l, i, s});});
        for (const id of Object.keys(line.nodes?.[npc] ?? {})) nodes.push({l, id});
    }
    if (!cards.length && !nodes.length) return null;
    return [
        section('劇情', '（story.json，唯讀；點了跳到任務分頁）'),
        h('div', {class: 'rows'},
            cards.map(({l, i, s}) => h('div', {class: 'chk go', onclick: () => SH.gotoTab('story', [l, 'storylets', i])},
                h('span', {class: s.on ? 'badge ev' : 'badge'}, s.on ? `事件 ${s.on.join(',')}` : '對話'),
                h('b', null, s.id), s.who !== npc && h('span', {class: 'who'}, s.who),
                h('span', null, s.label ?? s.text ?? ''), h('span', {class: 'at'}, s.requires ?? ''), h('span', {class: 'dim'}, l))),
            nodes.map(({l, id}) => h('div', {class: 'chk go', onclick: () => SH.gotoTab('story', [l, 'nodes', npc, id])},
                h('span', {class: 'badge'}, '節點'), h('b', null, id), h('span', {class: 'dim'}, l))))];
}

function renderSheet(npc)
{
    return h('div', {class: 'form'},
        h('div', {class: 'head'},
            npc !== COMMON && IC.iconEl(S.refs.roles[npc]?.icon, 48),
            h('span', {class: 'bigid'}, npc),
            h('span', {class: 'dim'}, roleLab(npc) ?? ''),
            D.dirty(npc) && h('span', {class: 'dirty'}, '●'),
            h('span', {class: 'grow'}),
            npc !== COMMON && h('button', {type: 'button', onclick: () => D.remove(npc)}, '刪除…')),
        entryRows(npc), lineRows(npc), nodeSection(npc), extendSection(npc), storySection(npc));
}

// ---------- 畫面 ----------
function draw()
{
    S.results = checkStory({story: S.refs.story, dialog: S.data, roles: S.refs.roles, items: S.refs.items});
    S.lists = SF.storyLists(S.refs, S.refs.story, S.data);
    renderDatalists({...S.lists.lists, concept: [...CONCEPTS, ...Object.values(S.data).flatMap(d => (d.lines ?? []).map(l => l.concept))]}, S.lists.labels);
    const own = Object.keys(S.data).filter(id => id !== COMMON);
    const commonOnly = Object.keys(S.refs.roles).filter(id => S.refs.roles[id].unique && !(id in S.data));
    V.renderList([
        ['共用', [COMMON].filter(id => id in S.data), 'common'],
        [n => `NPC（${n}）`, own, 'npc'],
        [n => `只用 _common（${n}）`, commonOnly, 'only'],
    ]);
    SF.renderChecks(S, S.results, {toPath, onJump: p => SF.jumpTo(D, p),
        onOther: r => r.file === 'story.json' ? () => SH.gotoTab('story', storyPath(r.path)) : null});
    const view = $('view');
    if (S.view === 'table')
    {
        const cnt = (id, c) => {const d = S.data[id], v = d[c.slice(1)]; return Array.isArray(v) ? v.length : Object.keys(v ?? {}).length;};
        V.renderTable([{label: '對話', cols: ['#entries', '#lines', '#nodes', '#extend']}], {
            inTab: () => true,
            sortKey: cnt,
            head: (c) => [{'#entries': '入口', '#lines': '台詞', '#nodes': '節點', '#extend': '加掛'}[c]],
            cell: (id, c) => h('td', {class: 'n'}, cnt(id, c)),
        });
        return;
    }
    if (S.sel && !(S.sel in S.data) && S.refs.roles[S.sel])
        return view.replaceChildren(h('div', {class: 'form'},
            h('div', {class: 'head'}, h('span', {class: 'bigid'}, S.sel), h('span', {class: 'dim'}, roleLab(S.sel) ?? '')),
            h('p', {class: 'dim'}, `${S.sel} 是 unique NPC，沒有自己的對話，整套用 _common。`),
            btn('建立這個 NPC 自己的對話', `建立 ${S.sel} 自己的對話`, () => create(S.sel)),
            storySection(S.sel)));
    if (!S.data[S.sel]) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選 NPC）' : '先在上方選擇專案資料夾'));
    view.replaceChildren(renderSheet(S.sel));
    SF.markIssues(S.results, toPath);
    pendingGoto();
}

async function loadRefs() {S.refs = await SF.loadRefs();}

(async () => {
    await loadRefs();
    render();
    D.start();
})();

// 給無頭測試用
window.__dl = {S, D, F, setAssets: D.setAssets, reload: D.reload, save: D.save, commit, undo: D.undo, redo: D.redo, render, jumpTo: (p) => SF.jumpTo(D, p)};
