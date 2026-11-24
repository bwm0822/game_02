// tools/scenes.json（進 git，遊戲不讀）＝{<場景名>: 場景}＋public/assets/json/prefab.json（docs/prefab.md）：
// 每次改都現讀硬碟 → 改 → 寫回，回傳各檔前後全文給 undo（同地圖分頁的 edit.js）；多檔一起改＝一筆 undo
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';

export const FILE = 'scenes.json';
export const PREFAB = 'prefab.json';
export const PARTICLE = 'particle.json';    // prefab 草稿儲存／組成時寫（粒子分頁存的格式：結尾沒有換行）
export const ITEM = 'item.json';            // 道具實例的手上 prefab／粒子（equip.prefab／equip.particle）草稿儲存時寫（道具分頁的格式：結尾沒有換行）
export const EMPTY = '{}\n';
export const newScene = () => ({map: 'sandbox'});

const PATHS = {[FILE]: 'tools', [PREFAB]: 'public/assets/json', [PARTICLE]: 'public/assets/json', [ITEM]: 'public/assets/json'};
let root = null;
const serialize = (data, file) => JSON.stringify(data, null, 2) + (file === PARTICLE || file === ITEM ? '' : '\n');

export async function load(r)
{
    root = r;
    return read();
}

// create＝寫檔時一路建資料夾；讀的時候沒有資料夾＝null
async function dirOf(file, create = false)
{
    let d = root;
    for (const seg of PATHS[file].split('/'))
    {
        d = create ? await d.getDirectoryHandle(seg, {create: true}) : await FS.tryDir(d, seg);
        if (!d) return null;
    }
    return d;
}

async function readText(file = FILE)
{
    const dir = await dirOf(file);
    const fh = dir && await FS.tryFile(dir, file);
    return fh ? await (await fh.getFile()).text() : EMPTY;
}

export const read = async (file = FILE) => JSON.parse(await readText(file));

async function write(file, text)
{
    await FS.writeFile(await dirOf(file, true), file, new Blob([text]));
    SH.notifySaved(file);
}

// fn(scenes, prefabs?) 改（files 列出要讀的檔，預設只有 scenes.json）；回傳 false 或 throw＝不寫
// 寫了回傳 {files: {檔名: {before, after}}（只列有變的）, data: {檔名: 物件}}，都沒變回傳 null
export async function edit(fn, files = [FILE])
{
    const before = {}, data = {};
    for (const f of files) {before[f] = await readText(f); data[f] = JSON.parse(before[f]);}
    if (fn(...files.map(f => data[f])) === false) return null;
    const out = {};
    for (const f of files)
    {
        const after = serialize(data[f], f);
        if (after !== before[f]) out[f] = {before: before[f], after};
    }
    if (!Object.keys(out).length) return null;
    for (const [f, {after}] of Object.entries(out)) await write(f, after);
    return {files: out, data};
}

// undo／redo：files＝{檔名: {before, after}}，back＝true 回到 before；硬碟現在要等於另一邊（不然是別處改過，不蓋）
export async function restore(files, back)
{
    for (const [f, t] of Object.entries(files))
    {
        if (await readText(f) !== (back ? t.after : t.before)) throw new Error(`${f} 之後在別處改過了，不能復原這一步`);
    }
    const data = {};
    for (const [f, t] of Object.entries(files))
    {
        const text = back ? t.before : t.after;
        await write(f, text);
        data[f] = JSON.parse(text);
    }
    return data;
}

// 改 key 保留順序
export function renameKey(obj, from, to)
{
    const e = Object.entries(obj);
    for (const k of Object.keys(obj)) delete obj[k];
    for (const [k, v] of e) obj[k === from ? to : k] = v;
}
