// 編輯 public/assets/json/<file> 一份 {id: 資料} 的共用核心：選資料夾、讀寫、undo、存檔前三方合併、新增／複製／改名／刪除、掃引用
// 頁面要有的元素：btnAssets btnReauth assetsName btnReload btnSave dirty btnUndo btnRedo btnForm btnTable status search btnNew view dlgAsk
import * as FS from './fs.js';
import {$, h, ul, ask, status} from './dom.js';
import {str, setAt, merge3} from './obj.js';

const ID_RE = /^[A-Za-z0-9_-]+$/;

// opt: {app, file, noun, external, draw, validateAll, onNew, innerRefs(id), renameRefs(from, to)}
export function createDoc(opt)
{
    const DIRS = FS.dirStore(opt.app);
    const S = {
        assets: null,           // {dir: public/assets, json: public/assets/json}
        pending: null,          // 還沒授權的 handle
        data: {},
        saved: {},              // 上次讀檔／存檔的內容，判斷哪些改過
        diskText: null,         // 上次讀檔／存檔時硬碟上的原文，存檔前比對有沒有被別人改過
        sel: null,
        view: 'form',
        tab: 0,
        sort: null,             // {col, dir}
        search: '',
        extra: {},              // id → Set：使用者用「加欄位」叫出來、還沒填值的欄位
        // 只留目前選的這筆（換一筆就清）：JSON 框有錯沒套用的原文（data-k → {text, msg}）、手動開關過的框（key → bool）
        drafts: {}, open: {}, formOf: null,
        hist: [], hi: -1,
    };

    function render()
    {
        const focus = document.activeElement?.dataset?.k;
        if (S.formOf !== S.sel) {S.drafts = {}; S.open = {}; S.formOf = S.sel;}
        opt.draw();
        $('btnForm').classList.toggle('on', S.view === 'form');
        $('btnTable').classList.toggle('on', S.view === 'table');
        $('btnUndo').disabled = S.hi <= 0;
        $('btnRedo').disabled = S.hi >= S.hist.length - 1;
        $('btnSave').disabled = $('btnReload').disabled = $('btnNew').disabled = !S.assets;
        $('dirty').hidden = !isDirty();
        if (focus) document.querySelector(`[data-k="${CSS.escape(focus)}"]`)?.focus();
    }

    // ---------- 歷史 ----------
    function commit(fn)
    {
        const before = S.sel, prev = str(S.data);
        fn();
        const now = str(S.data);
        if (now !== prev)
        {
            S.hist.length = S.hi + 1;
            S.hist.push({data: now, before, after: S.sel});
            if (S.hist.length > 300) S.hist.shift();
            S.hi = S.hist.length - 1;
        }
        render();
    }

    function undo()
    {
        if (S.hi <= 0) return;
        S.sel = S.hist[S.hi].before;
        S.data = JSON.parse(S.hist[--S.hi].data);
        render();
    }

    function redo()
    {
        if (S.hi >= S.hist.length - 1) return;
        const e = S.hist[++S.hi];
        S.data = JSON.parse(e.data);
        S.sel = e.after;
        render();
    }

    const set = (id, path, value) => commit(() => setAt(S.data[id], path, value));

    // ---------- 讀寫 ----------
    async function setAssets(dir)
    {
        const json = await FS.tryDir(dir, 'json');
        if (!json || !await FS.tryFile(json, opt.file)) throw new Error(`「${dir.name}」裡沒有 json/${opt.file}，要選遊戲的 public/assets`);
        S.assets = {dir, json};
        S.pending = null;
        $('btnReauth').hidden = true;
        $('assetsName').textContent = dir.name;
        $('assetsName').classList.remove('dim');
        await reload();
    }

    async function reload()
    {
        const text = await FS.readText(S.assets.json, opt.file);
        S.diskText = text;
        S.saved = JSON.parse(text);
        S.data = JSON.parse(text);
        S.extra = {};
        S.drafts = {};
        S.hist = [{data: str(S.data), before: S.sel, after: S.sel}];
        S.hi = 0;
        if (!S.data[S.sel]) S.sel = Object.keys(S.data)[0] ?? null;
        status(`讀入 ${Object.keys(S.data).length} 個${opt.noun}`);
        render();
    }

    const isDirty = () => str(S.data) !== str(S.saved);
    const dirty = (id) => str(S.data[id]) !== str(S.saved[id]);

    async function save()
    {
        if (!S.assets) return status('先選擇遊戲資料夾');
        const disk = await FS.readText(S.assets.json, opt.file);
        if (disk !== S.diskText)
        {
            const m = merge3(JSON.parse(S.diskText), S.data, JSON.parse(disk));
            const r = await ask(`${opt.file} 在讀進來之後被改過了`, [
                h('div', null, opt.external),
                m.external.length && h('div', null, `外部改了：${m.external.join('、')}`),
                m.conflict.length && h('div', {class: 'warn'}, `兩邊都改了（合併時以這裡的為準）：${m.conflict.join('、')}`),
            ], [['merge', '合併後存檔'], ['overwrite', '直接覆蓋'], ['cancel', '取消']]);
            if (r !== 'merge' && r !== 'overwrite') return status('取消存檔');
            if (r === 'merge') commit(() => {S.data = m.data;});
        }
        const warns = [...Object.entries(S.drafts).map(([k, d]) => `${S.sel}：JSON 有錯還沒套用（${k}）${d.msg}`), ...opt.validateAll()];
        if (warns.length)
        {
            const r = await ask(`有 ${warns.length} 個問題`, ul(warns), [['save', '仍然存檔'], ['cancel', '取消']]);
            if (r !== 'save') return status('取消存檔');
        }
        const text = JSON.stringify(S.data, null, 2);
        await FS.writeFile(S.assets.json, opt.file, new Blob([text]));
        S.diskText = text;
        S.saved = JSON.parse(text);
        status(`已存檔 ${new Date().toLocaleTimeString()}`);
        render();
    }

    // ---------- 新增／複製／改名／刪除 ----------
    function idError(id)
    {
        if (!id) return '不能是空的';
        if (!ID_RE.test(id)) return '只能用英數字、底線、減號';
        if (S.data[id]) return `「${id}」已經有了`;
        return '';
    }

    function insertAt(index, id, value)
    {
        const e = Object.entries(S.data);
        e.splice(index, 0, [id, value]);
        S.data = Object.fromEntries(e);
    }

    function dup(id)
    {
        let n = `${id}_copy`;
        for (let i = 2; S.data[n]; i++) n = `${id}_copy${i}`;
        commit(() => {insertAt(Object.keys(S.data).indexOf(id) + 1, n, structuredClone(S.data[id])); S.sel = n;});
    }

    // public/assets 底下其他 json 引用到 id 的地方（字串值或 key 裡有這個 id 當作獨立單字）
    async function scanRefs(id)
    {
        const re = new RegExp(`(^|[^\\w])${id.replace(/[-]/g, '\\-')}([^\\w]|$)`);
        const out = [];
        const walk = async (dir, path) => {
            for await (const fh of dir.values())
            {
                const p = path ? `${path}/${fh.name}` : fh.name;
                if (fh.kind === 'directory') {await walk(fh, p); continue;}
                if (!/\.(json|world|tmj|tsj)$/.test(fh.name) || p === `json/${opt.file}`) continue;
                const text = await (await fh.getFile()).text();
                if (!re.test(text)) continue;
                let data;
                try {data = JSON.parse(text);} catch {out.push({file: p, path: '（不是 JSON）'}); continue;}
                const hits = [];
                const visit = (v, at) => {
                    if (hits.length >= 10) return;
                    if (typeof v === 'string') {if (re.test(v)) hits.push(`${at}＝${v.length > 40 ? v.slice(0, 40) + '…' : v}`);}
                    else if (v && typeof v === 'object')
                        for (const [k, c] of Object.entries(v))
                        {
                            const sub = Array.isArray(v) ? `${at}[${k}]` : at ? `${at}.${k}` : k;
                            if (!Array.isArray(v) && re.test(k)) hits.push(`${sub}（key）`);
                            visit(c, sub);
                        }
                };
                visit(data, '');
                for (const x of hits) out.push({file: p, path: x});
            }
        };
        await walk(S.assets.dir, '');
        return out;
    }

    const refList = (refs) => refs.length ? ul(refs.map(r => `${r.file}：${r.path}`)) : h('div', {class: 'dim'}, '（沒有）');
    const innerList = (refs) => refs.length ? ul(refs) : h('div', {class: 'dim'}, '（沒有）');

    async function rename(from, to)
    {
        if (from === to) return;
        const err = idError(to);
        if (err) return status(err);
        const inner = opt.innerRefs(from), outer = await scanRefs(from);
        const r = await ask(`改名 ${from} → ${to}`, [
            h('div', {class: 'title'}, `${opt.file} 裡會一起改的`),
            innerList(inner),
            h('div', {class: 'title'}, '其他檔案（不會改，要自己處理；很多是 xlsx 轉出來的）'),
            refList(outer),
        ], [['ok', '改名'], ['cancel', '取消']]);
        if (r !== 'ok') return;
        commit(() => {
            S.data = Object.fromEntries(Object.entries(S.data).map(([k, v]) => [k === from ? to : k, v]));
            opt.renameRefs(from, to);
            if (S.extra[from]) {S.extra[to] = S.extra[from]; delete S.extra[from];}
            S.sel = to;
        });
        status(`已改名 ${from} → ${to}${outer.length ? `，其他檔案還有 ${outer.length} 處引用` : ''}`);
    }

    async function remove(id)
    {
        const inner = opt.innerRefs(id), outer = await scanRefs(id);
        const r = await ask(`刪除 ${id}`, [
            h('div', {class: 'title'}, `${opt.file} 裡還在引用的（不會跟著改）`),
            innerList(inner),
            h('div', {class: 'title'}, '其他檔案'),
            refList(outer),
        ], [['ok', '刪除'], ['cancel', '取消']]);
        if (r !== 'ok') return;
        const keys = Object.keys(S.data), i = keys.indexOf(id);
        commit(() => {
            delete S.data[id];
            S.sel = keys[i + 1] ?? keys[i - 1] ?? null;
        });
    }

    async function askRename(from)
    {
        const to = h('input', {size: 24, value: from});
        const p = ask(`改名 ${from}`, [h('div', null, '新的 id：'), to], [['ok', '下一步'], ['cancel', '取消']]);
        to.select();
        if (await p === 'ok') await rename(from, to.value.trim());
    }

    // ---------- 事件 ----------
    $('btnAssets').onclick = async () => {
        try {await setAssets(await DIRS.pick('assets'));}
        catch (e) {if (e.name !== 'AbortError') status(e.message);}
    };
    $('btnReauth').onclick = async () => {
        if (S.pending && await FS.askPermission(S.pending)) setAssets(S.pending).catch(e => status(e.message));
    };
    $('btnReload').onclick = async () => {
        if (isDirty() && await ask('重新讀取', '還沒存檔的修改會不見', [['ok', '重新讀取'], ['cancel', '取消']]) !== 'ok') return;
        reload();
    };
    $('btnSave').onclick = save;
    $('btnUndo').onclick = undo;
    $('btnRedo').onclick = redo;
    $('btnForm').onclick = () => {S.view = 'form'; render();};
    $('btnTable').onclick = () => {S.view = 'table'; render();};
    $('btnNew').onclick = () => opt.onNew();
    $('search').oninput = (e) => {S.search = e.target.value; render();};

    addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        // 先失焦讓正在打的欄位觸發 change 套用
        if (e.ctrlKey && k === 's') {e.preventDefault(); document.activeElement?.blur(); save(); return;}
        if (e.target.matches?.('input, textarea, select') || document.querySelector('dialog[open]')) return;
        if (e.ctrlKey && k === 'z' && !e.shiftKey) {e.preventDefault(); undo();}
        if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); redo();}
    });
    addEventListener('beforeunload', (e) => {if (isDirty()) e.preventDefault();});

    // 上次選的資料夾還有權限就直接讀，沒有就顯示「重新授權」
    async function start()
    {
        const dir = await DIRS.saved('assets');
        if (dir && await FS.hasPermission(dir)) await setAssets(dir).catch(e => status(e.message));
        else if (dir)
        {
            S.pending = dir;
            $('btnReauth').textContent = `重新授權「${dir.name}」`;
            $('btnReauth').hidden = false;
        }
    }

    return {S, render, commit, undo, redo, set, setAssets, reload, save, isDirty, dirty,
            idError, insertAt, dup, scanRefs, rename, remove, askRename, start};
}
