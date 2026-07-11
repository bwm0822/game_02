
// ── 工具函式 ──
export function toArray(str)
{
    if (!str) return [];
    return str.split(';')
                .map(s => s.trim())
                .filter(Boolean);
}