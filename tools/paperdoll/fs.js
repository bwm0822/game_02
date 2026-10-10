// File System Access API：工作資料夾的 handle 存在 IndexedDB，Chrome 重開後只要重新授權
function idb()
{
    return new Promise((res, rej) => {
        const r = indexedDB.open('paperdoll', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}

async function kv(mode, fn)
{
    const db = await idb();
    return new Promise(res => {
        const q = fn(db.transaction('kv', mode).objectStore('kv'));
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(undefined);
    });
}

export const savedRoot = () => kv('readonly', s => s.get('root'));

export async function pickRoot()
{
    const h = await window.showDirectoryPicker({id: 'paperdoll', mode: 'readwrite'});
    await kv('readwrite', s => s.put(h, 'root'));
    return h;
}

export const hasPermission = async (h) => (await h.queryPermission({mode: 'readwrite'})) === 'granted';
export const askPermission = async (h) => (await h.requestPermission({mode: 'readwrite'})) === 'granted';

export async function listDir(dir)
{
    const dirs = [], files = [];
    for await (const h of dir.values()) (h.kind === 'directory' ? dirs : files).push(h);
    const byName = (a, b) => a.name.localeCompare(b.name);
    return {dirs: dirs.sort(byName), files: files.sort(byName)};
}

// path 是相對工作資料夾、用 / 分隔的路徑；找不到會 throw
export async function resolveDir(root, path)
{
    let dir = root;
    for (const seg of (path ?? '').split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(seg);
    return dir;
}

export async function resolveFile(root, path)
{
    const segs = path.split('/');
    const dir = await resolveDir(root, segs.slice(0, -1).join('/'));
    return {dir, file: await dir.getFileHandle(segs.at(-1))};
}

export async function tryFile(dir, name)
{
    try {return await dir.getFileHandle(name);}
    catch {return null;}
}

export async function writeFile(dir, name, blob)
{
    const fh = await dir.getFileHandle(name, {create: true});
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
}
