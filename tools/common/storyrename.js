// 改名時改同一個檔案裡的引用（story.json／dialog.json 來源格式，原地修改）；純函式
// 走訪每個可能引用到名稱的字串，f(kind, 值, npc) 回傳新值；kind：cond（條件）、act（一個指令）、next（節點 id）、text（storylet 的 text）、quality、journal
// npc：這個字串發生在哪個 NPC 身上（storylet 的 who、節點所屬；dialog.json 的 _common 是 COMMON）；回傳改了哪些地方（給確認框列）

const TOK = '[\\w.:*@-]';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 名稱當作獨立的字出現（wolf_hunt 不會改到 wolf_hunt.kills、@n_x、item:x:1）
export function replaceTok(s, from, to)
{
    return s.replace(new RegExp(`(^|[^\\w.:*@-])${esc(from)}(?!${TOK})`, 'g'), `$1${to}`);
}

function visitNode(n, npc, f, at, hits)
{
    const one = (kind, v, where) => {const w = f(kind, v, npc); if (w !== v) hits.push(`${where}：${v} → ${w}`); return w;};
    const arr = (a, where) => a?.map((x, i) => one('act', x, `${where}[${i}]`));
    if (n.texts)
    {
        const e = Object.entries(n.texts);
        for (const k of Object.keys(n.texts)) delete n.texts[k];
        for (const [k, v] of e) n.texts[k === 'true' ? k : one('cond', k, `${at}.texts`)] = v;
    }
    if (n.actions) n.actions = arr(n.actions, `${at}.actions`);
    if (n.posts) n.posts = arr(n.posts, `${at}.posts`);
    if (n.next) n.next = one('next', n.next, `${at}.next`);
    (n.choices ?? []).forEach((c, i) => {
        const w = `${at}.choices[${i}]`;
        if (c.condition) c.condition = one('cond', c.condition, `${w}.condition`);
        if (c.actions) c.actions = arr(c.actions, `${w}.actions`);
        if (c.next) c.next = one('next', c.next, `${w}.next`);
    });
}

// lines：story.json 的 lines（或任務分頁攤開的 {劇情線: ...}）
export function rewriteStory(lines, f)
{
    const hits = [];
    for (const [l, line] of Object.entries(lines))
    {
        const one = (kind, v, where, npc) => {const w = f(kind, v, npc); if (w !== v) hits.push(`${where}：${v} → ${w}`); return w;};
        for (const [id, t] of Object.entries(line.threads ?? {}))
        {
            if (t.quality) t.quality = one('quality', t.quality, `${l}.threads.${id}.quality`);
            for (const [v, d] of Object.entries(t.values ?? {})) if (d.journal) d.journal = one('journal', d.journal, `${l}.threads.${id}.values.${v}`);
        }
        (line.storylets ?? []).forEach((s, i) => {
            const at = `${l}.storylets[${i}] ${s.id}`;
            for (const k of ['requires', 'tease']) if (s[k]) s[k] = one('cond', s[k], `${at}.${k}`, s.who);
            if (s.effects) s.effects = s.effects.map((a, j) => one('act', a, `${at}.effects[${j}]`, s.who));
            if (s.text) s.text = one('text', s.text, `${at}.text`, s.who);
        });
        for (const [npc, ns] of Object.entries(line.nodes ?? {}))
            for (const [id, n] of Object.entries(ns)) visitNode(n, npc, f, `${l}.nodes.${npc}.${id}`, hits);
        for (const g of Object.keys(line.spawns ?? {})) if (line.spawns[g]) line.spawns[g] = one('cond', line.spawns[g], `${l}.spawns.${g}`);
    }
    return hits;
}

export function rewriteDialog(dialog, f)
{
    const hits = [];
    for (const [npc, d] of Object.entries(dialog))
    {
        const one = (kind, v, where) => {const w = f(kind, v, npc); if (w !== v) hits.push(`${where}：${v} → ${w}`); return w;};
        (d.entries ?? []).forEach((e, i) => {
            const at = `${npc}.entries[${i}]`;
            if (e.node) e.node = one('next', e.node, `${at}.node`);
            if (e.condition) e.condition = one('cond', e.condition, `${at}.condition`);
            if (e.actions) e.actions = e.actions.map((a, j) => one('act', a, `${at}.actions[${j}]`));
        });
        (d.lines ?? []).forEach((l, i) => {if (l.condition) l.condition = one('cond', l.condition, `${npc}.lines[${i}].condition`);});
        for (const [id, n] of Object.entries(d.nodes ?? {})) visitNode(n, npc, f, `${npc}.nodes.${id}`, hits);
        if (d.extend)
        {
            const e = Object.entries(d.extend);
            for (const k of Object.keys(d.extend)) delete d.extend[k];
            for (const [k, choices] of e)
            {
                visitNode({choices}, npc, f, `${npc}.extend.${k}`, hits);
                d.extend[one('next', k, `${npc}.extend`)] = choices;
            }
        }
    }
    return hits;
}

// quality 改名：條件、指令裡的名稱（scope=npc 的連 <npc>.名稱 一起）、thread.quality、日誌的 {名稱}
export function qualityRenamer(from, to, npcIds = [])
{
    const pairs = [[from, to], ...npcIds.map(n => [`${n}.${from}`, `${n}.${to}`])];
    const names = (s) => pairs.reduce((x, [a, b]) => replaceTok(x, a, b), s);
    return (kind, v) => {
        if (kind === 'quality') return v === from ? to : v;
        if (kind === 'journal') return v.replace(/\{([^}]+)\}/g, (m, n) => `{${names(n)}}`);
        if (kind === 'cond' || kind === 'act') return names(v);
        return v;
    };
}

// 節點改名：next／entry／extend、storylet 的 @節點、goto／approach 指令；inNpc(npc) 決定哪些 NPC 情境下的引用算數
export function nodeRenamer(from, to, inNpc)
{
    return (kind, v, npc) => {
        if (!inNpc(npc)) return v;
        if (kind === 'next') return v === from ? to : v;
        if (kind === 'text') return v === `@${from}` ? `@${to}` : v;
        if (kind === 'act') return v.replace(/^((?:.*?\s:\s+)?(?:goto|approach)\s+)(\S+)/, (m, p, id) => id === from ? p + to : m);
        return v;
    };
}
