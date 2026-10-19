// 工具殼：分頁切換各工具的 iframe（第一次點才載入），專案資料夾在這裡選一次、傳給每個工具
import * as FS from './common/fs.js';
import {$, status} from './common/dom.js';
import {notifySaved} from './common/shell.js';

const DIRS = FS.dirStore('tools');
const TABS = ['item', 'role', 'paperdoll'];
const S = {
    dir: null,
    pending: null,
    tab: null,
    frames: {},         // tab → iframe
    dirty: {},          // tab → bool
};

const tabOf = (win) => TABS.find(t => S.frames[t]?.contentWindow === win);
const send = (tab) => S.dir && S.frames[tab]?.contentWindow.postMessage({type: 'project', dir: S.dir}, '*');

async function setProject(dir)
{
    const json = await FS.tryDir(await FS.tryDir(await FS.tryDir(dir, 'public'), 'assets'), 'json');
    if (!json || !await FS.tryFile(json, 'item.json')) throw new Error(`「${dir.name}」裡沒有 public/assets/json/item.json，要選 game_02 專案根目錄`);
    S.dir = dir;
    S.pending = null;
    $('btnReauth').hidden = true;
    $('projectName').textContent = dir.name;
    $('projectName').classList.remove('dim');
    status('');
    for (const t of TABS) send(t);
}

function show(tab)
{
    if (!TABS.includes(tab)) tab = TABS[0];
    S.tab = tab;
    if (!S.frames[tab])
        $('frames').append(S.frames[tab] = Object.assign(document.createElement('iframe'), {src: `./${tab}/`}));
    for (const t of TABS)
    {
        if (S.frames[t]) S.frames[t].hidden = t !== tab;
        document.querySelector(`[data-tab="${t}"]`).classList.toggle('on', t === tab);
    }
    if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
    S.frames[tab].focus();
}

addEventListener('message', (e) => {
    const tab = tabOf(e.source);
    if (!tab) return;
    if (e.data?.type === 'ready') send(tab);
    else if (e.data?.type === 'dirty')
    {
        S.dirty[tab] = e.data.dirty;
        document.querySelector(`[data-tab="${tab}"]`).classList.toggle('dirty', e.data.dirty);
    }
});

for (const b of document.querySelectorAll('#tabs button')) b.onclick = () => show(b.dataset.tab);
addEventListener('hashchange', () => show(location.hash.slice(1)));
addEventListener('beforeunload', (e) => {if (Object.values(S.dirty).some(Boolean)) e.preventDefault();});

$('btnProject').onclick = async () => {
    try {await setProject(await DIRS.pick('root'));}
    catch (e) {if (e.name !== 'AbortError') status(e.message);}
};
// 不用專案資料夾：dev server 跑 scripts/textures.js（vite/config.dev.mjs）
$('btnTextures').onclick = async () => {
    status('更新圖片清單中…');
    try
    {
        const r = await (await fetch('/__tools/textures', {method: 'POST'})).json();
        if (r.ok) {notifySaved('textures.json'); status(`圖片清單已更新：${r.count}`);}
        else status(`圖片清單沒更新：${r.errors.join('；')}`);
    }
    catch (e) {status(`圖片清單沒更新：${e.message}`);}
};
$('btnReauth').onclick = async () => {
    if (S.pending && await FS.askPermission(S.pending)) setProject(S.pending).catch(e => status(e.message));
};

(async () => {
    show(location.hash.slice(1));
    const dir = await DIRS.saved('root');
    if (dir && await FS.hasPermission(dir)) await setProject(dir).catch(e => status(e.message));
    else if (dir)
    {
        S.pending = dir;
        $('btnReauth').textContent = `重新授權「${dir.name}」`;
        $('btnReauth').hidden = false;
    }
})();

// 給無頭測試用
window.__tools = {S, setProject, show};
