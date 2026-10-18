// File System Access API：資料夾 handle 存在 IndexedDB（每個工具一個 db），Chrome 重開後只要重新授權
function idb(app)
{
    return new Promise((res, rej) => {
        const r = indexedDB.open(app, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    });
}

async function kv(app, mode, fn)
{
    const db = await idb(app);
    return new Promise(res => {
        const q = fn(db.transaction('kv', mode).objectStore('kv'));
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(undefined);
    });
}

// dirStore('paperdoll').pick('root')：選資料夾並記住；.saved('root')：上次選的
export function dirStore(app)
{
    return {
        saved: (key) => kv(app, 'readonly', s => s.get(key)),
        async pick(key)
        {
            const h = await window.showDirectoryPicker({id: `${app}-${key}`, mode: 'readwrite'});
            await kv(app, 'readwrite', s => s.put(h, key));
            return h;
        },
    };
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

export async function tryDir(dir, name)
{
    try {return await dir.getDirectoryHandle(name);}
    catch {return null;}
}

export async function readText(dir, name)
{
    return (await (await dir.getFileHandle(name)).getFile()).text();
}

export async function writeFile(dir, name, blob)
{
    const fh = await dir.getFileHandle(name, {create: true});
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
}
