export const str = (v) => JSON.stringify(v);
export const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function getAt(obj, path)
{
    return path.reduce((o, k) => o?.[k], obj);
}

// value 是 undefined 就刪 key，刪完往上把變空的物件也刪掉（陣列裡的元素不刪）
export function setAt(obj, path, value)
{
    const chain = [obj];
    for (const k of path.slice(0, -1))
    {
        const cur = chain.at(-1);
        if (value === undefined && cur[k] === undefined) return;
        if (cur[k] === undefined || typeof cur[k] !== 'object') cur[k] = {};
        chain.push(cur[k]);
    }
    const last = path.at(-1);
    if (value !== undefined) {chain.at(-1)[last] = value; return;}
    delete chain.at(-1)[last];
    for (let i = chain.length - 1; i > 0; i--)
    {
        const o = chain[i];
        if (!isObj(o) || Object.keys(o).length || Array.isArray(chain[i - 1])) break;
        delete chain[i - 1][path[i - 1]];
    }
}

// 換掉物件裡「不認識」的那些 key，認識的照原位置保留
export function replaceRaw(obj, isKnown, raw)
{
    const out = {};
    for (const k of Object.keys(obj))
    {
        if (isKnown(k)) out[k] = obj[k];
        else if (k in raw) out[k] = raw[k];
    }
    for (const k of Object.keys(raw)) if (!(k in out)) out[k] = raw[k];
    for (const k of Object.keys(obj)) delete obj[k];
    Object.assign(obj, out);
}

export function parseNum(s)
{
    s = s.trim();
    if (s === '') return undefined;
    const n = Number(s);
    return Number.isNaN(n) ? s : n;
}

// 第一層的三方合併：只有一邊改的取那一邊，兩邊都改的以我的為準
export function merge3(base, mine, theirs)
{
    const out = {}, external = [], conflict = [];
    for (const id of new Set([...Object.keys(mine), ...Object.keys(theirs), ...Object.keys(base)]))
    {
        const b = str(base[id]), m = str(mine[id]), t = str(theirs[id]);
        let v = mine[id];
        if (m === b) {v = theirs[id]; if (t !== b) external.push(id);}
        else if (t !== b && t !== m) conflict.push(id);
        if (v !== undefined) out[id] = v;
    }
    return {data: out, external, conflict};
}
