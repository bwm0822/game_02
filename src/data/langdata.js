// 翻譯檔 public/assets/lang/<lang>.json 是手寫來源檔：{_meta, _shared:{原文:{t,r}}, <情境>:{原文:{t,r}}}（r = ''/mt/ok）
// 只存有譯文的列；new / orphan / error / 建議都是即時算。Lang.load、scripts/lang.js、tools/lang 共用（純函式，不能 import Phaser）
// 設計見 docs/i18n-architecture.md §11

export const SHARED = '_shared';
export const META = '_meta';
export const SHARED_MIN = 3;        // 同一句出現在幾個情境以上，就列成 shared 候選
export const DEFAULT_META = {en: {font: 'Arial, sans-serif'}};

const key = (ctx, src) => `${ctx}\u0000${src}`;

// data = {local, item, role, ability, dialog(mergeDialog 後), story(flattenStory 後)}；回傳 [{ctx, src}]，依出現順序不重複
export function extract(data)
{
    const out = new Map();
    const add = (ctx, src) => {
        if (typeof src !== 'string' || !src.trim()) return;
        out.set(key(ctx, src), {ctx, src});
    };
    for (const [id, v] of Object.entries(data.local)) {add(`ui.${id}`, v.lab); add(`ui.${id}`, v.des);}
    for (const dom of ['item', 'role', 'ability'])
        for (const [id, v] of Object.entries(data[dom])) {add(`${dom}.${id}`, v.lab); add(`${dom}.${id}`, v.des);}

    const nodes = list => {
        for (const n of list)
        {
            for (const t of typeof n.texts === 'object' ? Object.values(n.texts) : [n.texts]) add(n.ctx, t);
            for (const c of n.choices ?? []) add(c.ctx ?? n.ctx, c.label);
        }
    };
    for (const d of Object.values(data.dialog))
    {
        nodes(Object.values(d.nodes ?? {}));
        for (const l of d.lines ?? []) add(l.ctx, l.text);
    }
    const story = data.story;
    for (const npc of Object.values(story.nodes)) nodes(Object.values(npc));
    for (const s of story.storylets)
    {
        const ctx = `story.let.${s.id}`;
        add(ctx, s.label); add(ctx, s.hint);
        if (!s.text?.startsWith('@')) add(ctx, s.text);
    }
    for (const t of Object.values(story.threads))
    {
        const ctx = `story.thread.${t.id}`;
        add(ctx, t.title); add(ctx, t.desc);
        for (const v of Object.values(t.values)) {add(ctx, v.journal); add(ctx, v.reward);}
    }
    return [...out.values()];
}

// 佔位符與 BBCode 要跟原文一致；回傳 '' 或錯誤原因
const TOKEN = /\{#?[^{}]+\}|\[\/?[a-z]+(?:=[^\]]*)?\]/gi;
const tokens = s => (s.match(TOKEN) ?? []).sort();
export function verify(src, dst)
{
    const a = tokens(src), b = tokens(dst);
    const miss = a.filter(t => !b.includes(t)), extra = b.filter(t => !a.includes(t));
    if (!miss.length && !extra.length) return '';
    return [miss.length && `少 ${miss.join(' ')}`, extra.length && `多 ${extra.join(' ')}`].filter(Boolean).join('，');
}

// 執行期查表 {情境:{原文:譯文}}；佔位符不合的譯文不收（退回原文）
export function compile(file)
{
    const tbl = {};
    for (const [ctx, rows] of Object.entries(file ?? {}))
    {
        if (ctx === META) continue;
        for (const [src, v] of Object.entries(rows))
            if (v?.t && !verify(src, v.t)) (tbl[ctx] ??= {})[src] = v.t;
    }
    return tbl;
}

// 抽出的原文 + 翻譯檔 → 每列狀態
//   check：'' 可用 / 'new' 沒譯文 / 'orphan' 原文已不存在 / 'error' 佔位符不合（err 是原因）
//   shared：被 _shared 蓋到時的譯文；hints：同情境 orphan 的舊譯文（建議）
export function analyze(file, entries)
{
    file ??= {};
    const ctxCount = {};
    for (const e of entries) (ctxCount[e.src] ??= new Set()).add(e.ctx);
    const sharedSrc = new Set(Object.keys(ctxCount).filter(s => ctxCount[s].size >= SHARED_MIN));
    for (const src of Object.keys(file[SHARED] ?? {})) if (ctxCount[src]) sharedSrc.add(src);

    const all = [...entries, ...[...sharedSrc].map(src => ({ctx: SHARED, src}))];
    const alive = new Set(all.map(e => key(e.ctx, e.src)));
    const sharedOk = {};
    for (const [src, v] of Object.entries(file[SHARED] ?? {})) if (v?.t && !verify(src, v.t)) sharedOk[src] = v.t;

    const orphans = [];
    for (const [ctx, rows] of Object.entries(file))
    {
        if (ctx === META) continue;
        for (const [src, v] of Object.entries(rows))
            if (!alive.has(key(ctx, src))) orphans.push({ctx, src, t: v?.t ?? '', r: v?.r ?? '', check: 'orphan', err: '', shared: '', hints: []});
    }
    const orphanBy = {};
    for (const o of orphans) if (o.t) (orphanBy[o.ctx] ??= []).push(o);

    const rows = all.map(e => {
        const v = file[e.ctx]?.[e.src];
        const row = {ctx: e.ctx, src: e.src, t: v?.t ?? '', r: v?.r ?? '', check: '', err: '', shared: '', hints: []};
        if (e.ctx === SHARED) row.uses = ctxCount[e.src].size;
        if (row.t) {row.err = verify(e.src, row.t); if (row.err) row.check = 'error';}
        else if (e.ctx !== SHARED && sharedOk[e.src]) row.shared = sharedOk[e.src];
        else
        {
            row.check = 'new';
            row.hints = orphanBy[e.ctx] ?? [];
        }
        return row;
    });
    rows.push(...orphans);

    const stat = {ok: 0, new: 0, orphan: 0, error: 0};
    for (const r of rows) stat[r.check || 'ok']++;
    return {rows, stat};
}
