// part.json（部位 pool）的改名／刪除：角色分頁的選圖器跟部位分頁共用；part.json 立刻寫並廣播
// role.json 的引用由呼叫端改（角色分頁進自己的 undo 再存檔，部位分頁直接寫檔）；程式碼（src/、tools/、scripts/）裡寫死的只列不改
import * as FS from './fs.js';
import * as SH from './shell.js';
import {h, ul, ask, status} from './dom.js';
import {ID_RE} from './doc.js';
import {ROLE_PARTS} from '../../src/core/equip.js';

const CODE_DIRS = ['src', 'tools', 'scripts'];

export const usersOf = (roles, pid) => Object.keys(roles).filter(rid => ROLE_PARTS.some(k => roles[rid][k] === pid));

// name 只給工具看，遊戲不讀、不翻譯；沒填顯示 id
export const nameOf = (parts, pid) => parts[pid]?.name ?? pid;

// 回傳改到的角色 id
export function renameRefs(roles, from, to)
{
    const out = [];
    for (const [rid, r] of Object.entries(roles))
        for (const k of ROLE_PARTS) if (r[k] === from) {r[k] = to; if (!out.includes(rid)) out.push(rid);}
    return out;
}

export const renameKey = (obj, from, to) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k === from ? to : k, v]));

export const readParts = async (json) => JSON.parse(await FS.readText(json, 'part.json'));

export async function writeParts(json, parts)
{
    await FS.writeFile(json, 'part.json', new Blob([JSON.stringify(parts, null, 2)]));
    SH.notifySaved('part.json');
    return parts;
}

// root 是專案根目錄（測試直接給 public/assets 時是 null，就不掃）；id 前後不能接英數字或減號，hair-wick 不會掃到 hair-wick2
async function scanCode(root, id)
{
    const re = new RegExp(`(^|[^\\w-])${id.replace(/-/g, '\\-')}([^\\w-]|$)`);
    const out = [];
    const walk = async (dir, path) => {
        for await (const fh of dir.values())
        {
            const p = `${path}/${fh.name}`;
            if (fh.kind === 'directory') await walk(fh, p);
            else if (/\.m?js$/.test(fh.name))
                (await (await fh.getFile()).text()).split('\n').forEach((l, i) => {if (re.test(l)) out.push(`${p} ${i + 1} 行：${l.trim().slice(0, 60)}`);});
        }
    };
    for (const d of CODE_DIRS)
    {
        const dh = root && await FS.tryDir(root, d);
        if (dh) await walk(dh, d);
    }
    return out;
}

// 問新 id、列出影響範圍再確認一次；回傳新 id，取消或不合法回傳 null（原因寫在 status）
export async function askRename(json, root, from, users)
{
    const fail = (msg) => {status(msg); return null;};
    const inp = h('input', {size: 24, value: from});
    const p = ask(`改名 ${from}`, [h('div', null, '新的 id（sprite 不變）：'), inp], [['ok', '下一步'], ['cancel', '取消']]);
    inp.select();
    if (await p !== 'ok') return null;
    const to = inp.value.trim(), parts = await readParts(json);
    if (to === from) return null;
    if (!ID_RE.test(to)) return fail('id 只能用英數字、底線、減號');
    if (parts[to]) return fail(`part.json 已經有 ${to}`);
    if (!parts[from]) return fail(`part.json 已經沒有 ${from}`);
    const code = await scanCode(root, from);
    if (await ask(`改名 ${from} → ${to}`, [
        h('div', null, `role.json 會一起改並存檔：${users.join('、') || '（沒有角色在用）'}`),
        code.length > 0 && [h('div', {class: 'title'}, '程式碼裡寫死的（不會改，要自己處理）'), ul(code)],
    ], [['ok', '改名'], ['cancel', '取消']]) !== 'ok') return null;
    return to;
}

// part.json 換 key（順序不變）；先廣播再寫檔，回傳新的 part.json
export async function rename(json, from, to)
{
    const parts = await readParts(json);
    SH.notifyPartRenamed(from, to);
    return writeParts(json, renameKey(parts, from, to));
}

// 有角色在用就擋；回傳要不要刪
export async function askDelete(pid, users)
{
    if (users.length)
    {
        await ask(`不能刪 ${pid}`, h('div', null, `還有角色在用：${users.join('、')}`), [['ok', '知道了']]);
        return false;
    }
    return await ask(`刪除 ${pid}`, h('div', null, 'PNG 不會刪，可以到「圖片」分頁搬到 .tbd'), [['ok', '刪除'], ['cancel', '取消']]) === 'ok';
}

export async function remove(json, pid)
{
    const parts = await readParts(json);
    delete parts[pid];
    return writeParts(json, parts);
}
