// 工具在 /tools/ 殼的 iframe 裡跑：專案資料夾由殼選好傳進來，存檔用 BroadcastChannel 通知其他分頁
export const inShell = window.parent !== window;

const chan = new BroadcastChannel('tools');

// fn(專案根目錄 handle)；殼重選資料夾時會再呼叫一次
export function onProject(fn)
{
    addEventListener('message', (e) => {if (e.source === window.parent && e.data?.type === 'project') fn(e.data.dir);});
    if (inShell) window.parent.postMessage({type: 'ready'}, '*');
    else document.body.prepend(Object.assign(document.createElement('div'), {
        style: 'padding: 6px 8px; background: #5a4a1e; color: #fc8',
        innerHTML: '這個工具要從 <a href="/tools/" style="color: #9cf">/tools/</a> 開，才會有專案資料夾',
    }));
}

// file：public/assets/json 底下的檔名（item.json、role.json）
export const notifySaved = (file) => chan.postMessage({type: 'saved', file});
export const onSaved = (fn) => chan.addEventListener('message', (e) => {if (e.data?.type === 'saved') fn(e.data.file);});

// 跳到別的分頁的某個地方：殼切過去，再把 path 交給那個工具（還沒載入的等它 ready）
export const gotoTab = (tab, path) => {if (inShell) window.parent.postMessage({type: 'goto', tab, path}, '*');};
export const onGoto = (fn) => addEventListener('message', (e) => {if (e.source === window.parent && e.data?.type === 'goto') fn(e.data.path);});

let last = null;
export function setDirty(dirty)
{
    if (!inShell || dirty === last) return;
    last = dirty;
    window.parent.postMessage({type: 'dirty', dirty}, '*');
}
