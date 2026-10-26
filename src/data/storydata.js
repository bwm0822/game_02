// story.json / dialog.json 是手寫來源檔，載入時轉成執行期格式；DB.load 跟 scripts/lang.js 共用（純函式，不能 import Phaser）
// 格式見 docs/story-architecture.md §5、§6

export const COMMON = '_common';

// ctx 是翻譯情境（docs/i18n-architecture.md §15）：節點自己帶；選項只有跟節點不同來源時（extend）才帶
function node(n, ctx)
{
    const choices = (n.choices ?? []).map(c => ({priority: 0, ...c}));
    return {...n, ctx, texts: n.texts ?? {}, actions: n.actions ?? [], choices: sortChoices(choices), posts: n.posts ?? []};
}

function sortChoices(choices) {return choices.sort((a, b) => (a.priority || 0) - (b.priority || 0));}

// {qualities, lines:{<line>:{title, threads, storylets, nodes, spawns}}} → {qualities, threads, storylets, nodes, spawns}
export function flattenStory(src)
{
    src = structuredClone(src ?? {});
    const out = {qualities: src.qualities ?? {}, threads: {}, storylets: [], nodes: {}, spawns: {}};
    for (const l of Object.values(src.lines ?? {}))
    {
        for (const [id, t] of Object.entries(l.threads ?? {})) out.threads[id] = {id, ...t};
        out.storylets.push(...(l.storylets ?? []));
        for (const [npc, ns] of Object.entries(l.nodes ?? {}))
            for (const [id, n] of Object.entries(ns)) (out.nodes[npc] ??= {})[id] = node(n, `story.node.${id}`);
        Object.assign(out.spawns, l.spawns);
    }
    return out;
}

function readSheet(id, d = {})
{
    return {
        entries: (d.entries ?? []).map(({node: nodeId, priority, ...rest}) => ({nodeId, order: priority ?? 0, ...rest})),
        lines: (d.lines ?? []).map(l => ({...l, ctx: `line.${id}.${l.concept}`})),
        nodes: Object.fromEntries(Object.entries(d.nodes ?? {}).map(([nid, n]) => [nid, node(n, `dlg.${id}.${nid}`)])),
        extend: Object.entries(d.extend ?? {}).map(([nodeId, choices]) => ({nodeId, choices, from: id})),
    };
}

// own 蓋過 common：同名節點用自己的、同 nodeId 的 entry 用自己的；line 兩邊都留，自己的標 own（挑選時 +1 分）
// extend：掛到（合併後的）某個節點底下的額外選項，不用複製整個節點
function merge(id, own, common)
{
    const nodes = structuredClone({...common.nodes, ...own.nodes});
    for (const {nodeId, choices, from} of [...common.extend, ...own.extend])
    {
        const n = nodes[nodeId];
        if (!n) continue;
        const ctx = `dlg.${from}.${nodeId}`;
        n.choices.push(...choices.map(c => ({priority: 0, ...c, ...(ctx === n.ctx ? {} : {ctx})})));
        sortChoices(n.choices);
    }
    const mine = new Set(own.entries.map(e => e.nodeId));
    const entries = [...common.entries.filter(e => !mine.has(e.nodeId)), ...own.entries].sort((a, b) => a.order - b.order);
    const lines = [...own.lines.map(l => ({...l, own: true})), ...common.lines];
    return {id, entries, nodes, lines};
}

// {_common, <npc>:{entries, lines, nodes, extend}} → 每個能對話的 NPC 一份合併好的資料
// 能對話 = dialog.json 有自己 key 的 + role.json 標 unique 的；_common key 是合併前的共用資料，給沒有對話的角色查 line
export function mergeDialog(src, roles)
{
    src = structuredClone(src ?? {});
    const empty = readSheet('');
    const common = readSheet(COMMON, src[COMMON]);
    const out = {[COMMON]: merge(COMMON, empty, common)};
    const ids = new Set([...Object.keys(src), ...Object.keys(roles ?? {}).filter(id => roles[id].unique)]);
    ids.delete(COMMON);
    for (const id of ids) out[id] = merge(id, readSheet(id, src[id]), common);
    return out;
}
