// icon／sprite 的四種寫法：sheet:格子（spritesheet）、atlas:frame、單張圖 key、emoji
// key 讀遊戲開機載的 textures.json（scripts/textures.js 產生），殼的「更新圖片清單」或 dev server 監看 textures/ 重產後會廣播，這裡跟著重讀
import {onSaved} from './shell.js';

export const SHEETS = {};      // key → {url, fw, fh, margin, space}
export const IMAGES = {};      // key → url
export const ATLASES = {};     // key → {url, frames: Map<name, {x, y, w, h}>}
export const TREE = {dirs: {}, files: []};   // textures/ 底下的資料夾結構，files: [{key, kind}]

const base = '/assets/';
let ver = 0;
async function loadList()
{
    const tex = await (await fetch(`${base}json/textures.json`, {cache: 'no-store'})).json();
    const atlases = await Promise.all(Object.entries(tex.atlas).map(async ([k, a]) => [k, a, await (await fetch(base + a.json, {cache: 'no-store'})).json()]));
    for (const o of [SHEETS, IMAGES, ATLASES]) for (const k in o) delete o[k];
    Object.assign(TREE, {dirs: {}, files: []});
    ver++;
    const url = (u) => `${base}${u}?v=${ver}`;
    const place = (u, key, kind) => {
        const dirs = u.split('/').slice(1, -1);
        let n = TREE;
        for (const d of dirs) n = n.dirs[d] ??= {dirs: {}, files: []};
        n.files.push({key, kind});
    };
    for (const [k, u] of Object.entries(tex.image)) {IMAGES[k] = url(u); place(u, k, 'image');}
    for (const [k, s] of Object.entries(tex.sheet)) {SHEETS[k] = {url: url(s.url), fw: s.w, fh: s.h, margin: s.margin, space: s.spacing}; place(s.url, k, 'sheet');}
    for (const [k, a, j] of atlases)
    {
        const list = Array.isArray(j.frames) ? j.frames : Object.entries(j.frames).map(([filename, f]) => ({filename, ...f}));
        ATLASES[k] = {url: url(a.url), frames: new Map(list.map(f => [String(f.filename), f.frame]))};
        place(a.url, k, 'atlas');
    }
}
await loadList();
onSaved((file) => {if (file === 'textures.json') loadList().then(() => {cache.clear();});});

const cache = new Map();       // url → {p: Promise<img|null>, img, failed}
function load(url)
{
    let c = cache.get(url);
    if (c) return c;
    c = {img: null, failed: false};
    c.p = new Promise(res => {
        const img = new Image();
        img.onload = () => {c.img = img; res(img);};
        img.onerror = () => {c.failed = true; res(null);};
        img.src = url;
    });
    cache.set(url, c);
    return c;
}

export const ready = Promise.all([...Object.values(SHEETS), ...Object.values(ATLASES)].map(s => s.url).concat(Object.values(IMAGES)).map(u => load(u).p));

// 跟 Phaser 的 spritesheet 一樣只扣一次 margin（tileset 才扣兩次）
function grid(s, img)
{
    const cols = Math.floor((img.width - s.margin + s.space) / (s.fw + s.space));
    const rows = Math.floor((img.height - s.margin + s.space) / (s.fh + s.space));
    return {cols, rows, count: cols * rows};
}

function frameRect(s, img, n)
{
    const {cols} = grid(s, img);
    return {x: s.margin + (n % cols) * (s.fw + s.space), y: s.margin + Math.floor(n / cols) * (s.fh + s.space), w: s.fw, h: s.fh};
}

// 選取畫面用：[{name, x, y, w, h}]
function rectsOf(key, img)
{
    if (ATLASES[key]) return [...ATLASES[key].frames].map(([name, f]) => ({name, ...f}));
    const s = SHEETS[key];
    return Array.from({length: grid(s, img).count}, (_, n) => ({name: String(n), ...frameRect(s, img, n)}));
}

const isText = (v) => !/^[\w\-./ ]+(:\w+)?$/.test(v);

export function resolve(v)
{
    if (!v) return {kind: 'none'};
    if (isText(v)) return {kind: 'text'};
    const [key, frame] = v.split(':');
    if (ATLASES[key]) return {kind: 'atlas', key, url: ATLASES[key].url, frame};
    if (frame !== undefined)
    {
        const s = SHEETS[key];
        return s ? {kind: 'sheet', key, url: s.url, sheet: s, frame: +frame} : {kind: 'unknown', key};
    }
    if (IMAGES[key]) return {kind: 'image', key, url: IMAGES[key]};
    return {kind: 'unknown', key};
}

// 圖裡的範圍；atlas frame 不存在回傳 null
function rectOf(r, img)
{
    if (r.kind === 'sheet') return frameRect(r.sheet, img, r.frame);
    if (r.kind === 'atlas') return ATLASES[r.key].frames.get(r.frame) ?? null;
    return {x: 0, y: 0, w: img.width, h: img.height};
}

// 檢查用；圖還沒載完就當作沒問題
export function check(v)
{
    const r = resolve(v);
    if (r.kind === 'none') return '沒有 icon';
    if (r.kind === 'unknown') return `textures.json 沒有「${r.key}」（新圖要按殼的「更新圖片清單」）`;
    if (r.kind === 'sheet')
    {
        const img = load(r.url).img;
        if (!Number.isInteger(r.frame) || r.frame < 0) return `格子編號「${v}」不是整數`;
        if (img && r.frame >= grid(r.sheet, img).count) return `${r.key} 只有 ${grid(r.sheet, img).count} 格，${r.frame} 超出範圍`;
    }
    if (r.kind === 'atlas')
    {
        if (r.frame === undefined) return `「${r.key}」是 atlas，要寫成 ${r.key}:frame`;
        if (!ATLASES[r.key].frames.has(r.frame)) return `${r.key} 沒有 frame「${r.frame}」`;
    }
    return '';
}

// 給 canvas 自己畫：{img, f: 圖裡的格子範圍}；不是圖或載入失敗回傳 null
export async function frameOf(v)
{
    const r = resolve(v);
    if (!r.url) return null;
    const img = await load(r.url).p;
    const f = img && rectOf(r, img);
    return f ? {img, f} : null;
}

// 等比縮放置中畫進 size×size 的 canvas；f 省略就畫整張
function fitCanvas(url, size, title, f0)
{
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    cv.className = 'ico';
    cv.title = title;
    load(url).p.then(img => {
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        const f = img && (f0 ? f0(img) : {x: 0, y: 0, w: img.width, h: img.height});
        if (!f) {g.fillStyle = '#a33'; g.fillRect(0, 0, size, size); return;}
        const k = Math.min(size / f.w, size / f.h);
        const w = f.w * k, h = f.h * k;
        g.drawImage(img, f.x, f.y, f.w, f.h, (size - w) / 2, (size - h) / 2, w, h);
    });
    return cv;
}

// 預覽元素：圖畫在 size×size 的 canvas 裡（等比縮放置中），emoji 用文字
export function iconEl(v, size = 32)
{
    const r = resolve(v);
    if (r.kind === 'text' || r.kind === 'none' || r.kind === 'unknown')
    {
        const s = document.createElement('span');
        s.className = 'ico ' + r.kind;
        s.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.7)}px`;
        s.textContent = r.kind === 'text' ? v : r.kind === 'none' ? '' : '?';
        s.title = v ?? '';
        return s;
    }
    return fitCanvas(r.url, size, v, (img) => rectOf(r, img));
}

// ---------- 選圖器 ----------
// 分頁是 textures/ 第一層資料夾，裡面像檔案總管：子資料夾點進去、sheet／atlas 點進去選格子
// 點圖只是選中（填進輸入框），按確定才回傳；取消回傳 null
export function pickIcon(cur)
{
    const dlg = document.getElementById('dlgIcon');
    const tabs = dlg.querySelector('.tabs'), body = dlg.querySelector('.body'), txt = dlg.querySelector('input'), info = dlg.querySelector('.info');
    let r = resolve(cur);
    txt.value = cur ?? '';

    const find = (key, n = TREE, path = []) => {
        if (n.files.some(f => f.key === key)) return path;
        for (const [d, c] of Object.entries(n.dirs)) {const p = find(key, c, [...path, d]); if (p) return p;}
        return null;
    };
    const top = Object.keys(TREE.dirs).sort();
    let path = (r.key && find(r.key)) || [top.includes('icons') ? 'icons' : top[0]];
    let open = r.kind === 'sheet' || r.kind === 'atlas' ? r.key : null;

    const choose = (v) => {txt.value = v; r = resolve(v);};
    const node = () => path.reduce((n, d) => n.dirs[d], TREE);
    const go = (p, o = null) => {path = p; open = o; show();};
    const cell = (icon, label, sel, onclick) => {
        const d = document.createElement('div');
        d.className = 'imgCell' + (sel ? ' sel' : '');
        d.append(icon, Object.assign(document.createElement('div'), {textContent: label}));
        d.onclick = onclick;
        return d;
    };
    const crumb = () => {
        const c = document.createElement('div');
        c.className = 'crumb';
        path.forEach((d, i) => {
            if (i) c.append(' / ');
            c.append(Object.assign(document.createElement('a'), {textContent: d, onclick: () => go(path.slice(0, i + 1))}));
        });
        if (open) c.append(' / ', Object.assign(document.createElement('b'), {textContent: open}));
        return c;
    };

    const showFolder = () => {
        const n = node();
        for (const d of Object.keys(n.dirs).sort())
        {
            const ico = Object.assign(document.createElement('span'), {className: 'ico', textContent: '📁'});
            ico.style.cssText = 'width:48px;height:48px;font-size:34px';
            body.append(cell(ico, d, false, () => go([...path, d])));
        }
        for (const f of [...n.files].sort((a, b) => a.key.localeCompare(b.key)))
        {
            if (f.kind === 'image') body.append(cell(iconEl(f.key, 48), f.key, f.key === r.key, (e) => {
                choose(f.key);
                for (const c of body.querySelectorAll('.imgCell.sel')) c.classList.remove('sel');
                e.currentTarget.classList.add('sel');
            }));
            else body.append(cell(fitCanvas((SHEETS[f.key] ?? ATLASES[f.key]).url, 48, f.key), `${f.key} ▦`, f.key === r.key, () => go(path, f.key)));
        }
    };

    const showFrames = () => {
        const key = open, url = (SHEETS[key] ?? ATLASES[key]).url;
        load(url).p.then(img => {
            if (open !== key) return;
            if (!img) return body.append('載入失敗：' + url);
            const rects = rectsOf(key, img);
            const k = Math.min(...rects.map(f => f.w)) <= 32 ? 2 : 1;
            const cv = document.createElement('canvas');
            cv.width = img.width * k; cv.height = img.height * k;
            const g = cv.getContext('2d');
            let sel = r.key === key ? rects.find(f => f.name === String(r.frame)) : null;
            let hover = null;
            const draw = () => {
                g.imageSmoothingEnabled = false;
                g.clearRect(0, 0, cv.width, cv.height);
                g.drawImage(img, 0, 0, cv.width, cv.height);
                g.lineWidth = 2;
                for (const [f, c] of [[sel, '#4a8be0'], [hover, '#fc8']]) if (f) {g.strokeStyle = c; g.strokeRect(f.x * k + 1, f.y * k + 1, f.w * k - 2, f.h * k - 2);}
            };
            const at = (e) => rects.find(f => e.offsetX / k >= f.x && e.offsetX / k < f.x + f.w && e.offsetY / k >= f.y && e.offsetY / k < f.y + f.h) ?? null;
            cv.onmousemove = (e) => {const f = at(e); if (f === hover) return; hover = f; info.textContent = f ? `${key}:${f.name}` : ''; draw();};
            cv.onmouseleave = () => {hover = null; info.textContent = ''; draw();};
            cv.onclick = (e) => {const f = at(e); if (f) {choose(`${key}:${f.name}`); sel = f; draw();}};
            draw();
            body.append(cv);
            sel && body.scrollTo(0, Math.max(0, sel.y * k - body.clientHeight / 2));
        });
    };

    const show = () => {
        tabs.replaceChildren(...top.map(d => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = d;
            b.classList.toggle('on', d === path[0]);
            b.onclick = () => go([d]);
            return b;
        }), crumb());
        body.replaceChildren();
        body.scrollTo(0, 0);
        info.textContent = '';
        open ? showFrames() : showFolder();
    };
    show();
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok' ? txt.value.trim() : null), {once: true}));
}
