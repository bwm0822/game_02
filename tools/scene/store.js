// tools/scenes.json（進 git，遊戲不讀）＝{<場景名>: 場景}：每次改都現讀硬碟 → 改 → 寫回，回傳前後全文給 undo（同地圖分頁的 edit.js）
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';

export const FILE = 'scenes.json';
export const EMPTY = '{}\n';
export const newScene = () => ({map: 'sandbox'});

let dir = null;
const serialize = (data) => JSON.stringify(data, null, 2) + '\n';

export async function load(root)
{
    dir = await root.getDirectoryHandle('tools', {create: true});
    return read();
}

async function readText()
{
    const fh = await FS.tryFile(dir, FILE);
    return fh ? await (await fh.getFile()).text() : EMPTY;
}

export const read = async () => JSON.parse(await readText());

async function write(text)
{
    await FS.writeFile(dir, FILE, new Blob([text]));
    SH.notifySaved(FILE);
}

// fn(data) 改；回傳 false＝不寫；throw Error＝不寫；寫了回傳 {before, after, data}，沒變回傳 null
export async function edit(fn)
{
    const before = await readText();
    const data = JSON.parse(before);
    if (fn(data) === false) return null;
    const after = serialize(data);
    if (after === before) return null;
    await write(after);
    return {before, after, data};
}

// undo／redo：硬碟現在要等於 expect（不然是別處改過，不蓋）
export async function restore(expect, text)
{
    if (await readText() !== expect) throw new Error(`${FILE} 之後在別處改過了，不能復原這一步`);
    await write(text);
    return JSON.parse(text);
}

// 改 key 保留順序
export function renameKey(obj, from, to)
{
    const e = Object.entries(obj);
    for (const k of Object.keys(obj)) delete obj[k];
    for (const [k, v] of e) obj[k === from ? to : k] = v;
}
