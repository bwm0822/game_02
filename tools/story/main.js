import {$, h, ask, status} from '../common/dom.js';
import {createDoc} from '../common/doc.js';
import {createViews, renderDatalists} from '../common/views.js';
import '../common/combo.js';
import '../common/splitter.js';
import * as SF from '../common/storyform.js';
import * as SH from '../common/shell.js';
import {checkStory} from '../../src/data/storycheck.js';

// story.json = {qualities, lines:{<劇情線>: {...}}}；編輯時攤成 {@qualities, <劇情線>...}，undo／合併以劇情線為單位
const Q = '@qualities';
const decode = (j) => ({[Q]: j.qualities ?? {}, ...j.lines});
const encode = (d) => {const {[Q]: qualities, ...lines} = d; return {qualities, lines};};

const D = createDoc({
    file: 'story.json', noun: '筆',
    external: '可能是手動改的。',
    draw, validateAll: () => validateAll(), onNew: () => askNew(),
    innerRefs: () => [], renameRefs: () => {},
    onSaved: (file) => {if (['dialog.json', 'role.json', 'item.json'].includes(file)) loadRefs().then(render);},
    decode, encode,
});
const {S, render, commit} = D;
S.refs = {roles: {}, items: {}, story: {}, dialog: {}, maps: []};
S.results = [];

const toPath = (r) => {
    if (r.file !== 'story.json') return null;
    const [top, k, ...rest] = r.path;
    return top === 'qualities' ? [Q, k, ...rest] : [k, ...rest];
};
const issues = (id) => S.results.filter(r => toPath(r)?.[0] === id);
const validateAll = () => S.results.filter(r => r.file === 'story.json').map(r => `${r.path.join('.')}：${r.msg}`);

const V = createViews(D, {
    icon: id => id === Q ? '🏷' : '📜',
    lab: id => id === Q ? 'quality 宣告' : S.data[id].title,
    warns: id => issues(id).map(r => r.msg),
});

// 節點在哪條劇情線；不在 story.json 的話，看是 dialog.json 裡 NPC 自己的還是 _common 的，跳到對話分頁
function nodeLine(npc, id) {return Object.keys(S.data).find(l => l !== Q && S.data[l].nodes?.[npc]?.[id]);}
function dialogPath(npc, id)
{
    const d = S.refs.dialog;
    if (d[npc]?.nodes?.[id]) return [npc, 'nodes', id];
    if (d._common?.nodes?.[id]) return ['_common', 'nodes', id];
    return null;
}
const F = SF.createStoryForm(D, {
    nodeLink: (npc, id) => {
        const l = nodeLine(npc, id);
        if (l) return () => SF.jumpTo(D, [l, 'nodes', npc, id]);
        const p = dialogPath(npc, id);
        return p && (() => SH.gotoTab('dialog', p));
    },
});
const pendingGoto = SF.listenGoto(D);
const {get, btn, row} = F;

// ---------- 新增 ----------
async function askNew()
{
    const id = h('input', {size: 24, placeholder: '英數字，例如 wolf_hunt'}), title = h('input', {size: 24, placeholder: '中文標題，只給工具看'});
    const p = ask('新劇情線', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'id'), id, h('span', {class: 'k'}, '標題'), title)], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p !== 'ok') return;
    const err = D.idError(id.value.trim());
    if (err) return status(err);
    commit(() => {S.data[id.value.trim()] = {title: title.value.trim() || id.value.trim(), threads: {}, storylets: [], nodes: {}, spawns: {}}; S.sel = id.value.trim();});
}

function uniq(obj, base) {let k = base; for (let i = 2; k in obj; i++) k = `${base}${i}`; return k;}

async function askNode(line)
{
    const npc = h('select', null, S.lists.npcs.map(n => h('option', {value: n}, n))), id = h('input', {size: 20, value: 'n_'});
    const p = ask('新節點', [h('div', {class: 'fields'}, h('span', {class: 'k'}, 'NPC'), npc, h('span', {class: 'k'}, '節點 id'), id),
        h('div', {class: 'hint'}, '對話卡的 text 填 @節點id 就會跳進來')], [['ok', '新增'], ['cancel', '取消']]);
    id.focus();
    if (await p !== 'ok') return;
    const nid = id.value.trim();
    if (!/^[\x21-\x7e]+$/.test(nid)) return status('節點 id 要是 ASCII');
    if (S.data[line].nodes?.[npc.value]?.[nid]) return status(`${npc.value} 已經有 ${nid}`);
    S.open[SF.keyOf([line, 'nodes', npc.value, nid])] = true;
    commit(() => {((S.data[line].nodes ??= {})[npc.value] ??= {})[nid] = {texts: {true: ''}, choices: [{label: '', next: 'n_default'}]};});
}

// ---------- 表單：quality 宣告 ----------
function renderQualities()
{
    const qs = S.data[Q];
    const add = async () => {
        const name = h('input', {size: 24});
        const p = ask('新 quality', [h('div', null, '名稱（英數字，可以有 . 跟結尾的 .* 萬用字元）：'), name], [['ok', '新增'], ['cancel', '取消']]);
        name.focus();
        if (await p !== 'ok') return;
        const n = name.value.trim();
        if (!n || n in qs) return status(n ? `「${n}」已經有了` : '不能是空的');
        commit(() => {S.data[Q][n] = {scope: 'global', default: 0, show: false, label: n};});
    };
    return h('div', null,
        h('div', {class: 'head'}, h('span', {class: 'bigid'}, 'quality 宣告'), h('span', {class: 'dim'}, '條件／效果用到的名稱都要先宣告（_ 開頭的 NPC 私有旗標免宣告）'),
            h('span', {class: 'grow'}), btn('新增 quality', '＋ quality', add)),
        h('table', {class: 'grid'},
            h('thead', null, h('tr', null, ['名稱', 'scope', '預設', 'show', '顯示名稱', ''].map(t => h('th', null, t)))),
            h('tbody', null, Object.entries(qs).map(([n, q]) => {
                const p = [Q, n];
                return h('tr', {dataset: {k: SF.keyOf(p)}},
                    h('td', null, n),
                    h('td', null, h('select', {dataset: {k: SF.keyOf([...p, 'scope'])}, onchange: e => F.put([...p, 'scope'], e.target.value)},
                        ['global', 'npc'].map(s => h('option', {value: s, selected: q.scope === s}, s)))),
                    h('td', null, F.num([...p, 'default'])),
                    h('td', null, h('input', {type: 'checkbox', checked: !!q.show, onchange: e => F.put([...p, 'show'], e.target.checked)})),
                    h('td', null, F.text([...p, 'label'], {size: 16})),
                    h('td', null, btn('刪除', '×', () => commit(() => {delete S.data[Q][n];}))));
            }))));
}

// ---------- 表單：劇情線 ----------
function section(title, hint, ...btns) {return h('div', {class: 'sec'}, title, h('span', {class: 'dim'}, hint), h('span', {class: 'grow'}), ...btns);}

function threadBox(line, tid)
{
    const p = [line, 'threads', tid], t = get(p), open = F.isOpen(p, true);
    const values = t.values ?? {};
    const vs = Object.keys(values).map(Number);
    const addV = () => commit(() => {(get(p).values ??= {})[vs.length ? Math.max(...vs) + 1 : 1] = {journal: ''};});
    const setV = (from, to) => {
        const n = parseInt(to, 10);
        if (!Number.isInteger(n) || String(n) === from) return render();
        F.renameKey([...p, 'values', from], String(n));
    };
    return h('div', {class: 'box', dataset: {k: SF.keyOf(p)}},
        h('div', {class: 'bar fold', onclick: e => {if (!e.target.closest('button, input')) F.toggle(p, true);}},
            h('span', {class: 'arrow'}, open ? '▼' : '▶'), 'thread', F.keyInput(p), h('span', {class: 'dim'}, t.title ?? ''), h('span', {class: 'grow'}),
            btn('刪除 thread', '×', () => commit(() => {delete S.data[line].threads[tid];}))),
        open && h('div', {class: 'fields'},
            ...row('標題', 'title', F.text([...p, 'title'], {size: 30})),
            ...row('說明', 'desc', F.area([...p, 'desc'])),
            ...row('quality', 'quality：這個值每換一次（而且下面有對應的值），日誌就多一行', F.text([...p, 'quality'], {size: 20, combo: 'dl-q'})),
            h('span', {class: 'k', title: 'values'}, '日誌'),
            h('div', {class: 'rows'},
                h('table', {class: 'grid vals'},
                    h('thead', null, h('tr', null, ['值', '日誌（{quality} 佔位符）', '地圖', '結束', '獎勵提示', ''].map(x => h('th', null, x)))),
                    h('tbody', null, Object.entries(values).map(([v, d]) => {
                        const vp = [...p, 'values', v];
                        return h('tr', {dataset: {k: SF.keyOf(vp)}},
                            h('td', null, h('input', {class: 'num', value: v, dataset: {k: SF.keyOf([...vp, '#id'])}, onchange: e => setV(v, e.target.value)})),
                            h('td', null, F.text([...vp, 'journal'], {size: 40})),
                            h('td', null, F.text([...vp, 'pos'], {size: 12, combo: 'dl-maps'})),
                            h('td', null, h('input', {type: 'checkbox', checked: !!d.end, onchange: e => F.put([...vp, 'end'], e.target.checked || undefined)})),
                            h('td', null, F.text([...vp, 'reward'], {size: 16})),
                            h('td', null, btn('刪除', '×', () => commit(() => {delete get(p).values[v];}))));
                    }))),
                h('div', null, btn('加一個值', '＋ 值', addV)))));
}

function letSummary(s)
{
    const kind = s.on ? h('span', {class: 'badge ev'}, `事件 ${s.on.join(',')}`) : h('span', {class: 'badge'}, '對話');
    return [kind, s.who && h('span', {class: 'who'}, s.who), h('span', {class: 'dim'}, s.label ?? s.text ?? '')];
}

function letCard(line, i, n)
{
    const p = [line, 'storylets', i], s = get(p), open = F.isOpen(p);
    const arr = [line, 'storylets'];
    const jump = s.text?.startsWith('@') && s.who && F.link(s.who, s.text.slice(1));
    return h('div', {class: 'card', dataset: {k: SF.keyOf(p)}},
        h('div', {class: 'bar fold', onclick: e => {if (!e.target.closest('button')) F.toggle(p);}},
            h('span', {class: 'arrow'}, open ? '▼' : '▶'), h('b', null, s.id), ...letSummary(s), h('span', {class: 'grow'}),
            btn('上移', '↑', () => F.move(arr, i, -1), i === 0),
            btn('下移', '↓', () => F.move(arr, i, 1), i === n - 1),
            btn('複製', '⧉', () => commit(() => S.data[line].storylets.splice(i + 1, 0, {...structuredClone(s), id: `${s.id}_copy`}))),
            btn('刪除', '×', () => commit(() => S.data[line].storylets.splice(i, 1)))),
        open && h('div', {class: 'fields'},
            ...row('id', 'id', F.text([...p, 'id'], {size: 20})),
            ...row('who', 'who：NPC id／job:職業／*；有 who 沒 on＝對話卡', F.text([...p, 'who'], {size: 16, combo: 'dl-who'})),
            ...row('on', 'on：事件（有就是事件卡），逗號分隔', h('input', {size: 24, placeholder: '（對話卡不填）', dataset: {k: SF.keyOf([...p, 'on']), combo: 'dl-events', tags: ''},
                value: (s.on ?? []).join(', '),
                onchange: e => {const a = e.target.value.split(',').map(x => x.trim()).filter(Boolean); F.put([...p, 'on'], a.length ? a : undefined);}})),
            ...row('tease', 'tease：成立但 requires 不成立時顯示灰色選項＋hint', F.cond([...p, 'tease'], '（不顯示灰色選項）')),
            ...row('requires', 'requires：出現／觸發條件', F.cond([...p, 'requires'])),
            !s.on && [
                ...row('label', 'label：選項文字', F.text([...p, 'label'], {size: 30})),
                ...row('hint', 'hint：灰色選項的提示', F.text([...p, 'hint'], {size: 30})),
            ],
            ...row('text', 'text：一句話，或 @節點id 跳進長對話；事件卡的 text 是畫面提示（see 卡冒在 NPC 頭上）', F.text([...p, 'text'], {size: 50, ph: '（不說話）'}), jump),
            ...row('effects', 'effects：一行一個指令', F.lines([...p, 'effects'], '（不做事）')),
            !s.on && row('mood', 'mood：空白＝一般；cold＝只在 NPC 冷淡（n_cold）時出現', F.text([...p, 'mood'], {size: 12, combo: 'dl-mood'}))));
}

function spawnRows(line)
{
    const sp = S.data[line].spawns ?? {};
    return h('table', {class: 'grid'},
        h('tbody', null, Object.keys(sp).map(g => {
            const p = [line, 'spawns', g];
            return h('tr', null,
                h('td', null, '@', F.keyInput(p, 14)),
                h('td', null, F.cond(p, '（一直出現）')),
                h('td', null, btn('刪除', '×', () => commit(() => {delete S.data[line].spawns[g];}))));
        })));
}

function renderLine(line)
{
    const l = S.data[line];
    const lets = l.storylets ?? [];
    const addLet = (ev) => commit(() => {
        const ids = new Set(lets.map(s => s.id)), id = uniq(Object.fromEntries([...ids].map(x => [x, 1])), `${line}_${ev ? 'ev' : 'talk'}`);
        S.open[SF.keyOf([line, 'storylets', lets.length])] = true;
        (S.data[line].storylets ??= []).push(ev ? {id, on: ['quality'], requires: '', effects: []} : {id, who: '', requires: '', label: '', text: ''});
    });
    const addThread = () => commit(() => {const t = S.data[line].threads ??= {}; t[uniq(t, line)] = {title: '', desc: '', quality: line, values: {1: {journal: ''}}};});
    const addSpawn = () => commit(() => {const sp = S.data[line].spawns ??= {}; sp[uniq(sp, line)] = '';});
    return h('div', {class: 'form'},
        h('div', {class: 'head'},
            h('span', {class: 'bigid'}, line),
            F.text([line, 'title'], {size: 20, ph: '標題'}),
            D.dirty(line) && h('span', {class: 'dirty'}, '●'),
            h('span', {class: 'grow'}),
            h('button', {type: 'button', onclick: () => D.askRename(line)}, '改名…'),
            h('button', {type: 'button', onclick: () => D.dup(line)}, '複製'),
            h('button', {type: 'button', onclick: () => D.remove(line)}, '刪除…')),
        section('任務日誌', '（thread：把 quality 翻成「現在該做什麼」）', btn('新增 thread', '＋ thread', addThread)),
        Object.keys(l.threads ?? {}).map(tid => threadBox(line, tid)),
        section('劇情卡', '（storylet：對話卡在跟 NPC 對話時變成選項，事件卡在事件發生時觸發）', btn('新增對話卡', '＋ 對話卡', () => addLet(false)), btn('新增事件卡', '＋ 事件卡', () => addLet(true))),
        lets.map((_, i) => letCard(line, i, lets.length)),
        section('長對話節點', '（對話卡的 text 填 @節點id 跳進來）', btn('新增節點', '＋ 節點', () => askNode(line))),
        Object.entries(l.nodes ?? {}).map(([npc, ns]) => [
            h('div', {class: 'npc'}, npc),
            Object.keys(ns).map(id => F.nodeCard([line, 'nodes', npc, id], npc, () => commit(() => {
                delete S.data[line].nodes[npc][id];
                if (!Object.keys(S.data[line].nodes[npc]).length) delete S.data[line].nodes[npc];
            }))),
        ]),
        section('spawn', '（地圖 @群組 圖層的出現條件，進地圖時判斷）', btn('新增 spawn 群組', '＋ spawn', addSpawn)),
        spawnRows(line));
}

// ---------- 畫面 ----------
function draw()
{
    const story = encode(S.data);
    S.results = checkStory({story, dialog: S.refs.dialog, roles: S.refs.roles, items: S.refs.items});
    S.lists = SF.storyLists(S.refs, story, S.refs.dialog);
    renderDatalists(S.lists.lists, S.lists.labels);
    const lines = Object.keys(S.data).filter(id => id !== Q);
    V.renderList([['宣告', [Q].filter(id => id in S.data), 'q'], [n => `劇情線（${n}）`, lines, 'lines']]);
    SF.renderChecks(S, S.results, {toPath, onJump: p => SF.jumpTo(D, p),
        onOther: r => r.file === 'dialog.json' ? () => SH.gotoTab('dialog', r.path) : null});
    const view = $('view');
    if (S.view === 'table')
    {
        V.renderTable([{label: '劇情線', cols: ['title', '#threads', '#lets', '#nodes', '#spawns']}], {
            inTab: (_, id) => id !== Q,
            sortKey: (id, c) => cell(id, c),
            head: (c) => [{title: '標題', '#threads': 'thread', '#lets': '劇情卡', '#nodes': '節點', '#spawns': 'spawn'}[c]],
            cell: (id, c) => h('td', {class: c === 'title' ? '' : 'n'}, cell(id, c)),
        });
        return;
    }
    if (!S.data[S.sel]) return view.replaceChildren(h('div', {class: 'dim'}, S.assets ? '（沒有選劇情線）' : '先在上方選擇專案資料夾'));
    view.replaceChildren(S.sel === Q ? renderQualities() : renderLine(S.sel));
    SF.markIssues(S.results, toPath);
    pendingGoto();
}

function cell(id, c)
{
    const l = S.data[id];
    if (c === 'title') return l.title ?? '';
    const n = c === '#threads' ? Object.keys(l.threads ?? {}).length : c === '#lets' ? (l.storylets ?? []).length
        : c === '#spawns' ? Object.keys(l.spawns ?? {}).length : Object.values(l.nodes ?? {}).reduce((s, ns) => s + Object.keys(ns).length, 0);
    return n;
}

async function loadRefs() {S.refs = await SF.loadRefs();}

(async () => {
    await loadRefs();
    render();
    D.start();
})();

// 給無頭測試用
window.__st = {S, D, F, setAssets: D.setAssets, reload: D.reload, save: D.save, commit, undo: D.undo, redo: D.redo, render, jumpTo: (p) => SF.jumpTo(D, p), encode, Q};
