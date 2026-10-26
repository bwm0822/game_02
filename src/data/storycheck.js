// story.json / dialog.json 的靜態檢查（scripts/story.js 跟任務／對話工具共用，純函式）
// 輸入是手寫來源格式；回傳 [{level:'error'|'warn', file, path:[json 路徑], msg}]
// maps：[{file, layers:[圖層名稱]}]，沒給就不檢查 @群組 圖層（工具端讀不到地圖）；items（item.json）沒給就不檢查道具 id
import {flattenStory, mergeDialog, COMMON} from './storydata.js'

// 條件裡由查詢方提供的情境事實，不是 quality
const FACTS = ['time', 'hour', 'map', 'hp', 'job', 'style', 'trade', 'dead', 'true', 'false'];
export const EVENTS = ['kill', 'item', 'enter', 'time', 'quality', 'see'];
// script.js 自己處理的＋交給呼叫方（COM_Talk／uidialog／Story）的
export const OPS = ['give', 'take', 'count', 'stop', 'trade', 'close', 'goto', 'approach'];

export function condNames(expr)
{
    if (!expr || expr === true) return [];
    return String(expr).split(/&&|\|\|/)
        .map(s => s.trim().replace(/^!/, '').split(/>=|<=|!=|==|=|>|</)[0].trim())
        .filter(Boolean);
}

// 跟 src/systems/script.js 的 COND_PREFIX/ASSIGN 同一套規則
export function parseAction(action)
{
    const names = [];
    const m0 = action.match(/^(.*?)\s+:\s+(.*)$/);
    let cmd = action.trim();
    if (m0)
    {
        names.push(...condNames(m0[1]));
        cmd = m0[2].trim();
    }
    const m = cmd.match(/^(\S+?)(?:=(\S*)|([+-])(\d+(?:\.\d+)?))$/);
    if (m) {names.push(m[1]); return {names};}
    const [op, ...args] = cmd.split(/\s+/);
    if (['count', 'stop'].includes(op) && args[0]) names.push(args[0]);
    return {names, op, args};
}

export function checkStory({story, dialog, roles, items, maps})
{
    const out = [];
    const flat = flattenStory(story);
    const merged = mergeDialog(dialog, roles);
    const qualities = story?.qualities ?? {};
    const roleIds = new Set(Object.keys(roles ?? {}));
    const moods = new Set(Object.values(merged).flatMap(d => Object.values(d.nodes).map(n => n.mood).filter(Boolean)));
    const err  = (at, msg) => out.push({level: 'error', ...at, msg});
    const warn = (at, msg) => out.push({level: 'warn', ...at, msg});
    const sub  = (at, ...keys) => ({file: at.file, path: [...at.path, ...keys]});

    // 識別字一律 ASCII，中文只能出現在顯示文字（docs/i18n-architecture.md §5）
    const checkId = (kind, id, at) => {if (!/^[\x21-\x7e]+$/.test(id)) err(at, `${kind}「${id}」必須是 ASCII`);};

    const isDeclared = name => {
        if (qualities[name]) return true;
        if (Object.keys(qualities).some(k => k.endsWith('.*') && name.startsWith(k.slice(0, -1)))) return true;
        const dot = name.indexOf('.');
        if (dot > 0 && roleIds.has(name.slice(0, dot)))
        {
            const rest = name.slice(dot + 1);
            return rest.startsWith('_') || qualities[rest]?.scope === 'npc';
        }
        return false;
    };

    const checkItem = (id, at) => {if (items && id && !items[id]) err(at, `沒有道具「${id}」`);};

    const checkName = (name, at) => {
        checkId('quality', name, at);
        if (name.startsWith('item:')) return checkItem(name.split(':')[1], at);
        if (name.startsWith('_')) return;
        if (FACTS.includes(name) || /^-?\d+(\.\d+)?$/.test(name) || name === 'gold') return;
        if (!isDeclared(name)) err(at, `未宣告的 quality「${name}」`);
    };
    const checkCond = (expr, at) => condNames(expr).forEach(n => checkName(n, at));

    const nodeExists = (npc, id) => !!(flat.nodes[npc]?.[id] || merged[npc]?.nodes?.[id]);
    const checkNode = (npc, id, at) => {if (id && !nodeExists(npc, id)) err(at, `${npc} 沒有節點「${id}」`);};

    // npcs：這段動作可能發生在哪些 NPC 身上（goto 要檢查節點存在）；null = 不在對話中
    const checkActions = (actions, at, npcs) => (actions ?? []).forEach((a, i) => {
        const {names, op, args} = parseAction(a);
        names.forEach(n => checkName(n, sub(at, i)));
        if (op && !OPS.includes(op)) err(sub(at, i), `認不得的指令「${op}」`);
        if (op === 'give' || op === 'take') checkItem(args[0], sub(at, i));
        if ((op === 'goto' || op === 'approach') && npcs) npcs.forEach(npc => checkNode(npc, args[0], sub(at, i)));
    });

    const checkChoices = (npc, choices, at) => (choices ?? []).forEach((c, i) => {
        const w = sub(at, i);
        checkCond(c.condition, sub(w, 'condition'));
        checkActions(c.actions, sub(w, 'actions'), [npc]);
        checkNode(npc, c.next, sub(w, 'next'));
    });

    const checkNodes = (npc, nodes, at) => {
        for (const [id, node] of Object.entries(nodes ?? {}))
        {
            const w = sub(at, id);
            checkId('節點', id, w);
            Object.keys(node.texts ?? {}).forEach(c => checkCond(c, sub(w, 'texts', c)));
            checkActions(node.actions, sub(w, 'actions'), [npc]);
            checkActions(node.posts, sub(w, 'posts'), [npc]);
            checkNode(npc, node.next, sub(w, 'next'));
            checkChoices(npc, node.choices, sub(w, 'choices'));
        }
    };

    // ── dialog.json ──
    for (const [npc, d] of Object.entries(dialog ?? {}))
    {
        const at = {file: 'dialog.json', path: [npc]};
        if (npc !== COMMON && !roleIds.has(npc)) warn(at, `「${npc}」不是 NPC id`);
        (d.lines ?? []).forEach((l, i) => checkCond(l.condition, sub(at, 'lines', i, 'condition')));
        (d.entries ?? []).forEach((e, i) => {
            const w = sub(at, 'entries', i);
            checkCond(e.condition, sub(w, 'condition'));
            checkActions(e.actions, sub(w, 'actions'), [npc]);
            if (!nodeExists(npc, e.node)) err(sub(w, 'node'), `${npc} 沒有節點「${e.node}」`);
        });
        checkNodes(npc, d.nodes, sub(at, 'nodes'));
        for (const [nodeId, choices] of Object.entries(d.extend ?? {}))
        {
            const w = sub(at, 'extend', nodeId);
            if (!merged[npc]?.nodes?.[nodeId]) warn(w, `找不到節點「${nodeId}」，extend 的選項不會出現`);
            checkChoices(npc, choices, w);
        }
    }

    // ── story.json ──
    // who 對得上的 NPC id 清單；寫錯回傳 null
    const whoNpcs = who => {
        if (who === '*') return [...roleIds];
        if (who.startsWith('job:'))
        {
            const job = who.slice(4);
            const ids = Object.entries(roles).filter(([, r]) => r.job === job).map(([id]) => id);
            return ids.length ? ids : null;
        }
        return roleIds.has(who) ? [who] : null;
    };

    for (const name of Object.keys(qualities)) checkId('quality', name, {file: 'story.json', path: ['qualities', name]});
    const seen = {thread: {}, spawn: {}, node: {}, card: {}};
    const dup = (kind, key, line, at, msg) => {
        if (seen[kind][key] && seen[kind][key] !== line) err(at, `${msg}重複（另一個在劇情線 ${seen[kind][key]}）`);
        else if (seen[kind][key]) err(at, `${msg}重複`);
        seen[kind][key] = line;
    };
    for (const [line, l] of Object.entries(story?.lines ?? {}))
    {
        const at = {file: 'story.json', path: ['lines', line]};
        checkId('劇情線', line, at);
        for (const [npc, nodes] of Object.entries(l.nodes ?? {}))
        {
            const w = sub(at, 'nodes', npc);
            if (!roleIds.has(npc)) err(w, `節點的 who「${npc}」不是 NPC id`);
            Object.keys(nodes).forEach(id => dup('node', `${npc}|${id}`, line, sub(w, id), `${npc} 的節點 ${id} `));
            checkNodes(npc, nodes, w);
        }
        for (const [id, t] of Object.entries(l.threads ?? {}))
        {
            const w = sub(at, 'threads', id);
            checkId('thread', id, w);
            dup('thread', id, line, w, `thread ${id} `);
            checkName(t.quality, sub(w, 'quality'));
            for (const [v, d] of Object.entries(t.values ?? {}))
                for (const [, n] of String(d.journal ?? '').matchAll(/\{([^}]+)\}/g)) checkName(n, sub(w, 'values', v, 'journal'));
        }
        for (const [g, req] of Object.entries(l.spawns ?? {}))
        {
            const w = sub(at, 'spawns', g);
            checkId('spawn 群組', g, w);
            dup('spawn', g, line, w, `spawn 群組 ${g} `);
            checkCond(req, w);
        }
        (l.storylets ?? []).forEach((s, i) => {
            const w = sub(at, 'storylets', i);
            checkId('storylet', s.id, sub(w, 'id'));
            dup('card', `${s.id}|${s.who ?? ''}`, line, w, `storylet ${s.id}（who ${s.who ?? '空白'}）`);
            let npcs = null;
            if (s.who)
            {
                npcs = whoNpcs(s.who);
                if (!npcs) err(sub(w, 'who'), `who「${s.who}」對不到任何 NPC`);
            }
            if (!s.who && !s.on) err(w, `storylet ${s.id} 沒有 who 也沒有 on`);
            if (!s.on && !s.label) err(sub(w, 'label'), `對話卡 ${s.id} 沒有 label`);
            if (s.mood && s.on) err(sub(w, 'mood'), `事件卡不能填 mood`);
            if (s.mood && !moods.has(s.mood)) err(sub(w, 'mood'), `dialog.json 沒有節點收 mood「${s.mood}」的卡`);
            (s.on ?? []).forEach((e, j) => {if (!EVENTS.includes(e)) err(sub(w, 'on', j), `認不得的事件「${e}」`);});
            checkCond(s.requires, sub(w, 'requires'));
            checkCond(s.tease, sub(w, 'tease'));
            checkActions(s.effects, sub(w, 'effects'), s.on ? null : npcs);
            (s.effects ?? []).forEach((a, j) => {
                const {op, args} = parseAction(a);
                if (op !== 'approach') return;
                const wa = sub(w, 'effects', j);
                if (!s.on?.includes('see')) err(wa, `approach 只能用在 on=see 的事件卡`);
                else if (!s.who) err(wa, `approach 的卡要填 who`);
                else npcs?.forEach(npc => checkNode(npc, args[0], wa));
            });
            if (s.text?.startsWith('@'))
            {
                if (s.on) err(sub(w, 'text'), `事件卡的 text 不能跳節點`);
                else npcs?.forEach(npc => checkNode(npc, s.text.slice(1), sub(w, 'text')));
            }
        });
    }

    // ── 地圖 @群組 圖層 ──
    if (maps)
    {
        const used = new Set();
        for (const {file, layers} of maps)
        {
            for (const name of layers)
            {
                const at = {file, path: [name]};
                if (name.startsWith('#')) err(at, `條件圖層改用 @群組，條件寫在 story.json 的 spawns`);
                if (!name.startsWith('@')) continue;
                const g = name.slice(1);
                if (!(g in flat.spawns)) err(at, `story.json 沒有宣告 spawn 群組「${g}」`);
                used.add(g);
            }
        }
        for (const [line, l] of Object.entries(story?.lines ?? {}))
            for (const g of Object.keys(l.spawns ?? {}))
                if (!used.has(g)) warn({file: 'story.json', path: ['lines', line, 'spawns', g]}, `spawn 群組「${g}」沒有任何地圖用到`);
    }
    return out;
}
