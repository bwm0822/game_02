// 只讀：用瀏覽器內建的 DecompressionStream 解 zip，找出 xlsx 裡符合條件的儲存格文字跟工作表名稱（掃引用用，不需要套件）
const td = new TextDecoder();

function unzip(buf)
{
    const v = new DataView(buf);
    let e = buf.byteLength - 22;
    while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('不是 zip');
    const files = new Map();
    let p = v.getUint32(e + 16, true);
    for (let i = v.getUint16(e + 10, true); i > 0; i--)
    {
        const nl = v.getUint16(p + 28, true);
        files.set(td.decode(new Uint8Array(buf, p + 46, nl)),
            {method: v.getUint16(p + 10, true), size: v.getUint32(p + 20, true), off: v.getUint32(p + 42, true)});
        p += 46 + nl + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
    }
    return async (name) => {
        const z = files.get(name);
        if (!z) return '';
        const data = new Uint8Array(buf, z.off + 30 + v.getUint16(z.off + 26, true) + v.getUint16(z.off + 28, true), z.size);
        if (z.method === 0) return td.decode(data);
        return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
    };
}

const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
const unxml = (s) => s.replace(/&(\w+|#x[0-9a-f]+|#\d+);/gi, (m, e) =>
    ENT[e] ?? (e[0] !== '#' ? m : String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : +e.slice(1))));
const texts = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(m => unxml(m[1])).join('');
const attr = (tag, k) => tag.match(new RegExp(`\\s${k}="([^"]*)"`))?.[1];
const short = (s) => (s.length > 40 ? s.slice(0, 40) + '…' : s).replace(/\s+/g, ' ');

// 回傳 ['工作表!A1＝內容', '工作表（工作表名稱）', …]，最多 max 筆
export async function findText(blob, test, max = 10)
{
    const read = unzip(await blob.arrayBuffer());
    const shared = [...(await read('xl/sharedStrings.xml')).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
    const target = Object.fromEntries([...(await read('xl/_rels/workbook.xml.rels')).matchAll(/<Relationship\b[^>]*>/g)]
        .map(([tag]) => [attr(tag, 'Id'), attr(tag, 'Target')]));
    const hits = [];
    for (const [tag] of (await read('xl/workbook.xml')).matchAll(/<sheet\b[^>]*>/g))
    {
        const name = unxml(attr(tag, 'name') ?? ''), t = target[attr(tag, 'r:id')] ?? '';
        if (test(name)) hits.push(`${name}（工作表名稱）`);
        const xml = await read(t.startsWith('/') ? t.slice(1) : `xl/${t}`);
        for (const [, head, body = ''] of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g))
        {
            const type = attr(head, 't');
            const s = type === 's' ? shared[+body.match(/<v>(\d+)<\/v>/)?.[1]]
                    : type === 'inlineStr' ? texts(body)
                    : type === 'str' ? unxml(body.match(/<v>([^<]*)<\/v>/)?.[1] ?? '') : null;
            if (s && test(s)) hits.push(`${name}!${attr(head, 'r')}＝${short(s)}`);
            if (hits.length >= max) return hits;
        }
    }
    return hits;
}
