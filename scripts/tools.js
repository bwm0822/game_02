
// ── 工具函式 ──
export function toArray(str)
{
    if (!str) return [];
    return str.split(';')
                .map(s => s.trim())
                .filter(Boolean);
}

// 表頭列第一格是 #（# 本身不是欄位），// 開頭的列是註解；回傳 [{header, rows:[obj]}]，每遇到一列表頭就開一張新表
export function splitTables(raw)
{
    const tables = [];
    let cur = null;
    for (const row of raw)
    {
        if (row.every(cell => cell === '')) continue;
        const first = String(row[0] ?? '');
        if (first.startsWith('//')) continue;
        if (first.startsWith('#'))
        {
            cur = {header: row.map(n => String(n).startsWith('#') ? '' : String(n)), rows: []};
            tables.push(cur);
        }
        else if (cur)
        {
            cur.rows.push(Object.fromEntries(
                cur.header.map((h, i) => [h, row[i] ?? '']).filter(([h]) => h !== '')
            ));
        }
    }
    return tables;
}