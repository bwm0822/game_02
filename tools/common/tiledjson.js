// 照 Tiled 存檔的排版輸出 JSON（地圖 *.json），讓工具改地圖時 git diff 只多出改的那幾行
// 規則：最外層 `{ ` 接第一個 key、其他 key 縮排 1；物件裡的 key 縮排＝`{` 的縮排 +1；物件陣列的元素縮排＝那個 key 的縮排 +7，
// 元素之間 `}, ` 換行、最後一個 `}]`；字串的 / 跳脫成 \/、非 ASCII 寫成 \uXXXX；換行照原檔（CRLF／LF）
// 專案裡 Tiled 存的地圖讀進來再寫出去一字不差（測試 roundtrip 全部地圖）；手改過排版的那幾行會被整理成 Tiled 的樣子，資料不變

const str = (s) => JSON.stringify(s).replace(/\//g, '\\/').replace(/[\u0080-￿]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const prim = (v) => (typeof v === 'string' ? str(v) : JSON.stringify(v));
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function val(v, ind, eol)
{
    if (Array.isArray(v))
    {
        if (!v.length) return '[]';
        if (v.every(isObj)) return `[${eol}${v.map(o => ' '.repeat(ind + 7) + obj(o, ind + 7, eol)).join(`, ${eol}`)}]`;
        return `[${v.map(x => val(x, ind, eol)).join(', ')}]`;
    }
    if (isObj(v)) return obj(v, ind + 7, eol);
    return prim(v);
}

function obj(o, ind, eol)
{
    const keys = Object.keys(o);
    if (!keys.length) return '{}';
    const lines = keys.map(k => `${' '.repeat(ind + 1)}${str(k)}:${val(o[k], ind + 1, eol)}`);
    return `{${eol}${lines.join(`,${eol}`)}${eol}${' '.repeat(ind)}}`;
}

export const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

export function stringify(data, eol = '\n')
{
    const keys = Object.keys(data);
    return `{ ${keys.map((k, i) => `${i ? ' ' : ''}${str(k)}:${val(data[k], 1, eol)}`).join(`,${eol}`)}${eol}}`;
}

// 原檔照這套規則能不能一字不差寫回去
export function roundtrip(text)
{
    try {return stringify(JSON.parse(text), eolOf(text)) === text;}
    catch {return false;}
}
