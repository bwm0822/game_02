
// ── 工具函式 ──
export function toArray(str)
{
    if (!str) return [];
    return String(str).split(';')
                .map(s => s.trim())
                .filter(Boolean);
}

// 表頭列第一格是 #（# 本身不是欄位），// 開頭的列是註解；回傳 [{header, rows:[obj]}]，每遇到一列表頭就開一張新表
// 每列額外帶 _row（xlsx 列號，報錯用）
export function splitTables(raw)
{
    const tables = [];
    let cur = null;
    raw.forEach((row, i) => {
        if (row.every(cell => cell === '')) return;
        const first = String(row[0] ?? '');
        if (first.startsWith('//')) return;
        if (first.startsWith('#'))
        {
            cur = {header: row.map(n => String(n).startsWith('#') ? '' : String(n)), rows: []};
            tables.push(cur);
        }
        else if (cur)
        {
            const obj = Object.fromEntries(
                cur.header.map((h, j) => [h, row[j] ?? '']).filter(([h]) => h !== '')
            );
            obj._row = i + 1;
            cur.rows.push(obj);
        }
    });
    return tables;
}

// ── 對話節點（dialog.xlsx 與 story.xlsx 的長對話節點共用） ──
export function buildChoice(row)
{
    const c = {
        labelKey: row.label_key,
        priority: Number(row.priority),
    };
    if (row.actions)      c.actions   = toArray(row.actions);
    if (row.next)         c.next      = row.next;
    if (row.condition)    c.condition = row.condition;
    return c;
}

export function buildTextKeys(text_keys_str)
{
    if (!text_keys_str) return {};
    const ret = {};
    toArray(text_keys_str).forEach((str)=>{
        const [cond, text] = str.includes(':') ? str.split(':').map(s => s.trim())
                                                : [true, str];
        ret[cond] = text;
    });
    return ret;
}

// next 有值、底下沒有 choice 列時，執行期沿用 next 節點的選項
export function buildNode(row)
{
    const node = {
        textKeys: buildTextKeys(row.text_keys),
        actions:  toArray(row.actions),
        choices:  [],
        posts:    []
    };
    if (row.next) node.next = row.next;
    return node;
}
