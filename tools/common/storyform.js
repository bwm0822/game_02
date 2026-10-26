// 任務／對話工具共用：唯讀參考資料、條件／指令的自動完成選項、輸入框、節點編輯器、欄位標紅、檢查面板
// 欄位的 data-k 一律是資料路徑的 keyOf()（[紀錄 id, ...json 路徑]），檢查結果靠它找到要標紅、要跳過去的欄位
import {$, h, status} from './dom.js';
import {getAt, parseNum} from './obj.js';
import {mergeDialog, COMMON} from '../../src/data/storydata.js';
import {EVENTS, OPS} from '../../src/data/storycheck.js';

export const keyOf = (path) => JSON.stringify(path);

// ---------- 唯讀參考資料（走 dev server） ----------
export async function loadRefs()
{
    const get = (f) => fetch(`/assets/json/${f}`, {cache: 'no-store'}).then(r => r.json()).catch(() => ({}));
    const [roles, items, story, dialog, nav] = await Promise.all(['role.json', 'item.json', 'story.json', 'dialog.json', 'navgraph.json'].map(get));
    const maps = [...new Set(Object.keys(nav.nodes ?? {}).map(k => k.slice(0, k.indexOf(':'))))];
    return {roles, items, story, dialog, maps};
}

const FACTS = ['time=night', 'time=day', 'hour>=', 'map=', 'hp<', 'job=', 'style=', 'trade', 'dead='];

// story：story.json 來源格式；dialog：dialog.json 來源格式（兩個分頁各自用自己正在編的那份）
export function storyLists(refs, story, dialog)
{
    const merged = mergeDialog(dialog, refs.roles);
    const npcs = Object.keys(merged).filter(id => id !== COMMON);
    const nodes = {};
    for (const [npc, d] of Object.entries(merged)) nodes[npc] = new Set(Object.keys(d.nodes));
    for (const l of Object.values(story.lines ?? {}))
        for (const [npc, ns] of Object.entries(l.nodes ?? {})) for (const id of Object.keys(ns)) (nodes[npc] ??= new Set()).add(id);
    const q = Object.keys(story.qualities ?? {}).filter(k => !k.includes('*'));
    const itemIds = Object.keys(refs.items);
    const kills = Object.keys(refs.roles).filter(id => !refs.roles[id].unique);
    const cond = [...q, ...npcs.map(n => `${n}.favor`), ...FACTS, ...itemIds.map(i => `item:${i}:1`), ...kills.map(id => `kill.${id}`)];
    const allNodes = [...new Set(Object.values(nodes).flatMap(s => [...s]))];
    const lists = {
        q, cond,
        eff: [...OPS.map(o => ['trade', 'close'].includes(o) ? o : `${o} `), 'gold+', ...cond, ...itemIds, ...allNodes, ...kills.map(id => `kill:${id}`)],
        who: [...npcs, ...new Set(Object.values(refs.roles).map(r => r.job).filter(Boolean).map(j => `job:${j}`)), '*'],
        events: EVENTS,
        maps: refs.maps,
        npcs,
        mood: [...new Set(Object.values(merged).flatMap(d => Object.values(d.nodes).map(n => n.mood).filter(Boolean)))],
        ...Object.fromEntries(Object.entries(nodes).map(([npc, s]) => [`nodes-${npc}`, [...s]])),
    };
    const lab = (o) => refs.items[o]?.lab ?? refs.roles[o]?.lab ?? refs.items[o.split(/[: ]/)[1]]?.lab;
    return {lists, labels: {cond: lab, eff: lab, who: lab, npcs: lab}, npcs, nodes};
}

// ---------- 輸入框＋節點編輯器 ----------
// opt: {nodeLink(npc, id) → 跳過去的函式或 null, other(npc, id) → 不在這份檔案時的說明文字, mood: 顯示 cards/mood 欄}
export function createStoryForm(D, opt = {})
{
    const {S, commit, render} = D;
    const get = (path) => getAt(S.data, path);
    // 不像 setAt 會把變空的物件往上刪（節點刪到剩 {} 也要留著）
    const put = (path, v) => commit(() => {
        const o = get(path.slice(0, -1));
        if (v === undefined) delete o[path.at(-1)];
        else o[path.at(-1)] = v;
    });
    const renameKey = (path, to) => {
        const parent = get(path.slice(0, -1)), from = path.at(-1);
        if (!to || to === from) return render();
        if (to in parent) {status(`「${to}」已經有了`); return render();}
        commit(() => {
            const e = Object.entries(parent);
            for (const k of Object.keys(parent)) delete parent[k];
            for (const [k, v] of e) parent[k === from ? to : k] = v;
        });
    };
    const isOpen = (path, def = false) => S.open[keyOf(path)] ?? def;
    const toggle = (path, def) => {S.open[keyOf(path)] = !isOpen(path, def); render();};

    const text = (path, {size, ph, combo, cls} = {}) => h('input', {size, placeholder: ph, class: cls, dataset: {k: keyOf(path), ...(combo && {combo})}, value: get(path) ?? '',
        onchange: e => put(path, e.target.value.trim() || undefined)});
    const area = (path, ph) => h('textarea', {rows: 2, placeholder: ph, dataset: {k: keyOf(path)}, value: get(path) ?? '',
        onchange: e => put(path, e.target.value.trim() || undefined)});
    const cond = (path, ph = '（永遠成立）') => h('input', {class: 'expr', placeholder: ph, dataset: {k: keyOf(path), combo: 'dl-cond', expr: ''}, value: get(path) ?? '',
        onchange: e => put(path, e.target.value.trim() || undefined)});
    // 指令陣列：一行一個
    const lines = (path, ph = '一行一個指令') => {
        const v = get(path) ?? [];
        return h('textarea', {class: 'expr', rows: Math.max(1, v.length), placeholder: ph, dataset: {k: keyOf(path), combo: 'dl-eff', expr: ''}, value: v.join('\n'),
            onchange: e => {const a = e.target.value.split('\n').map(s => s.trim()).filter(Boolean); put(path, a.length ? a : undefined);}});
    };
    const num = (path) => h('input', {class: 'num', dataset: {k: keyOf(path)}, value: get(path) ?? '', onchange: e => put(path, parseNum(e.target.value))});
    const keyInput = (path, size = 16) => h('input', {size, class: 'key', dataset: {k: keyOf([...path, '#id'])}, value: path.at(-1),
        onchange: e => renameKey(path, e.target.value.trim())});
    const btn = (title, label, fn, disabled) => h('button', {type: 'button', title, disabled, onclick: e => {e.stopPropagation(); fn();}}, label);
    const row = (k, title, ...el) => [h('span', {class: 'k', title}, k), h('div', {class: 'cellrow'}, ...el)];

    // 指到節點的欄位旁邊：同檔案的節點給「→」按鈕，別的檔案的顯示在哪
    function link(npc, id)
    {
        if (!id) return null;
        const go = opt.nodeLink?.(npc, id);
        if (go) return btn(`跳到 ${npc} 的 ${id}`, '→', go);
        const where = opt.other?.(npc, id);
        return where && h('span', {class: 'dim'}, where);
    }

    function move(arrPath, i, d) {commit(() => {const a = get(arrPath); [a[i], a[i + d]] = [a[i + d], a[i]];});}

    // texts：{條件: 台詞}，true = 無條件
    function textsBox(path)
    {
        const t = get(path) ?? {};
        const setCond = (from, to) => {
            to = to.trim() || 'true';
            if (to === from) return;
            if (to in t) {status(`已經有條件「${to}」的台詞`); return render();}
            commit(() => {
                const o = get(path), e = Object.entries(o);
                for (const k of Object.keys(o)) delete o[k];
                for (const [k, v] of e) o[k === from ? to : k] = v;
            });
        };
        const add = () => commit(() => {
            const o = get(path) ?? (get(path.slice(0, -1))[path.at(-1)] = {});
            let k = 'true';
            for (let i = 2; k in o; i++) k = `cond${i}`;
            o[k] = '';
        });
        return h('div', {class: 'rows'},
            Object.entries(t).map(([c, v]) => h('div', {class: 'trow'},
                h('input', {class: 'expr cond', placeholder: '（無條件）', dataset: {k: keyOf([...path, c]), combo: 'dl-cond', expr: ''}, value: c === 'true' ? '' : c,
                    onchange: e => setCond(c, e.target.value)}),
                h('textarea', {rows: 1, dataset: {k: keyOf([...path, c, '#v'])}, value: v, onchange: e => put([...path, c], e.target.value)}),
                btn('刪除這句', '×', () => commit(() => {delete get(path)[c]; if (!Object.keys(get(path)).length) delete get(path.slice(0, -1))[path.at(-1)];})))),
            h('div', null, btn('加一句台詞（不同條件不同台詞，條件依序比，第一個成立的勝出）', '＋ 台詞', add)));
    }

    function choicesBox(path, npc)
    {
        const list = get(path) ?? [];
        const add = () => commit(() => {(get(path.slice(0, -1))[path.at(-1)] ??= []).push({label: ''});});
        return h('div', {class: 'rows'},
            list.length > 0 && h('div', {class: 'chead'}, ['選項文字', '出現條件', '選了做什麼', '接著到', '排序', ''].map(t => h('span', null, t))),
            list.map((c, i) => {
                const p = [...path, i];
                return h('div', {class: 'crow', dataset: {k: keyOf(p)}},
                    text([...p, 'label'], {ph: '選項文字'}),
                    cond([...p, 'condition']),
                    lines([...p, 'actions'], '（不做事）'),
                    h('span', {class: 'cellrow'}, text([...p, 'next'], {size: 12, combo: `dl-nodes-${npc}`, ph: '（停在這）'}), link(npc, c.next)),
                    num([...p, 'priority']),
                    h('span', {class: 'btns'},
                        btn('上移', '↑', () => move(path, i, -1), i === 0),
                        btn('下移', '↓', () => move(path, i, 1), i === list.length - 1),
                        btn('刪除', '×', () => commit(() => {get(path).splice(i, 1); if (!get(path).length) delete get(path.slice(0, -1))[path.at(-1)];}))));
            }),
            h('div', null, btn('加選項', '＋ 選項', add)));
    }

    const firstText = (n) => Object.values(n.texts ?? {})[0] ?? '';

    // path：指到節點本身（[..., 節點 id]）；npc：這個節點屬於誰（_common 也算一個）
    function nodeCard(path, npc, onDelete)
    {
        const n = get(path), open = isOpen(path);
        const ext = opt.mood || n.cards !== undefined || n.mood !== undefined;
        return h('div', {class: 'card node', dataset: {k: keyOf(path)}},
            h('div', {class: 'bar fold', onclick: e => {if (!e.target.closest('button, input')) toggle(path);}},
                h('span', {class: 'arrow'}, open ? '▼' : '▶'),
                keyInput(path),
                h('span', {class: 'sum'}, firstText(n), n.choices?.length ? h('span', {class: 'dim'}, `　[ ${n.choices.length} 個選項 ]`) : n.next && h('span', {class: 'dim'}, `　→ ${n.next}`)),
                btn('刪除節點', '×', onDelete)),
            open && h('div', {class: 'fields'},
                h('span', {class: 'k', title: 'texts'}, '台詞'), textsBox([...path, 'texts']),
                ...row('進入時', 'actions：進到這個節點時執行', lines([...path, 'actions'], '（不做事）')),
                ...row('沿用', 'next：沒有自己的選項時，顯示完台詞沿用這個節點的選項',
                    text([...path, 'next'], {size: 16, combo: `dl-nodes-${npc}`, ph: '（不沿用）'}), link(npc, n.next)),
                h('span', {class: 'k', title: 'choices'}, '選項'), choicesBox([...path, 'choices'], npc),
                ...row('離開時', 'posts：離開這個節點時執行', lines([...path, 'posts'], '（不做事）')),
                ext && [
                    ...row('插卡', 'cards：劇情對話卡插進這個節點時的排序（沒填就不插；entry 節點預設 30）', num([...path, 'cards'])),
                    ...row('mood', 'mood：只收 storylet 的 mood 欄相同的卡', text([...path, 'mood'], {size: 12, combo: 'dl-mood'})),
                ]));
    }

    return {get, put, renameKey, isOpen, toggle, text, area, cond, lines, num, keyInput, btn, row, link, move, nodeCard};
}

// ---------- 檢查結果 ----------
// toPath(r)：檢查結果 → 資料路徑（不是這個分頁的檔案就回 null）；欄位找不到就往上一層找（effects 的第 j 行標在整個 effects 框）
export function markIssues(results, toPath)
{
    for (const r of results)
    {
        const p = toPath(r);
        if (!p) continue;
        for (let n = p.length; n > 0; n--)
        {
            const el = document.querySelector(`#view [data-k="${CSS.escape(keyOf(p.slice(0, n)))}"]`);
            if (!el) continue;
            el.classList.add(r.level === 'error' ? 'bad' : 'warnf');
            el.title = [el.title, r.msg].filter(Boolean).join('\n');
            break;
        }
    }
}

// 打開路徑上每一層收合的框，再捲過去
export function jumpTo(D, path)
{
    const {S, render} = D;
    S.sel = path[0];
    S.view = 'form';
    render();
    for (let n = 2; n <= path.length; n++) S.open[keyOf(path.slice(0, n))] = true;
    render();
    for (let n = path.length; n > 0; n--)
    {
        const el = document.querySelector(`#view [data-k="${CSS.escape(keyOf(path.slice(0, n)))}"]`);
        if (!el) continue;
        el.scrollIntoView({block: 'center'});
        el.focus?.();
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 1200);
        return;
    }
}

// 頁面底部的檢查面板；canJump(r) 為 false 的（別的檔案）只列不跳
export function renderChecks(S, results, {toPath, onJump})
{
    const errs = results.filter(r => r.level === 'error').length, warns = results.length - errs;
    const open = S.checksOpen ??= true;
    $('checks').replaceChildren(
        h('div', {class: 'bar', onclick: () => {S.checksOpen = !open; renderChecks(S, results, {toPath, onJump});}},
            h('span', {class: 'arrow'}, open ? '▼' : '▶'),
            results.length ? h('span', {class: errs ? 'err' : 'warn'}, `檢查：${errs} 個錯誤、${warns} 個警告`) : h('span', {class: 'ok'}, '檢查：沒有問題')),
        open && results.length > 0 && h('div', {class: 'list'}, results.map(r => {
            const p = toPath(r);
            return h('div', {class: 'chk ' + r.level + (p ? ' go' : ''), onclick: p && (() => onJump(p))},
                h('span', {class: 'lv'}, r.level === 'error' ? '✘' : '⚠'),
                h('span', {class: 'at'}, `${r.file} ${r.path.join('.')}`),
                h('span', null, r.msg));
        })));
}
