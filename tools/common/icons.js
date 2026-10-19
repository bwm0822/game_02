// icon／sprite 的三種寫法：sheet:格子（spritesheet）、單張圖 key、emoji
// key 讀遊戲開機載的 textures.json（scripts/textures.js 產生），殼的「更新圖片清單」重產後會廣播，這裡跟著重讀
import {onSaved} from './shell.js';

export const SHEETS = {};      // key → {url, fw, fh, margin, space}
export const IMAGES = {};      // key → url
export const ATLASES = new Set();

const base = '/assets/';
async function loadList()
{
    const tex = await (await fetch(`${base}json/textures.json`, {cache: 'no-store'})).json();
    for (const o of [SHEETS, IMAGES]) for (const k in o) delete o[k];
    ATLASES.clear();
    for (const [k, url] of Object.entries(tex.image)) IMAGES[k] = base + url;
    for (const [k, s] of Object.entries(tex.sheet)) SHEETS[k] = {url: base + s.url, fw: s.w, fh: s.h, margin: s.margin, space: s.spacing};
    for (const k of Object.keys(tex.atlas)) ATLASES.add(k);
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

export const ready = Promise.all([...Object.values(SHEETS).map(s => s.url), ...Object.values(IMAGES)].map(u => load(u).p));

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

const isText = (v) => !/^[\w\-./ ]+(:\w+)?$/.test(v);

export function resolve(v)
{
    if (!v) return {kind: 'none'};
    if (isText(v)) return {kind: 'text'};
    const [key, frame] = v.split(':');
    if (frame !== undefined)
    {
        if (ATLASES.has(key)) return {kind: 'atlas'};
        const s = SHEETS[key];
        return s ? {kind: 'sheet', key, sheet: s, frame: +frame} : {kind: 'unknown', key};
    }
    if (IMAGES[key]) return {kind: 'image', url: IMAGES[key]};
    return {kind: 'unknown', key};
}

// 檢查用；圖還沒載完就當作沒問題
export function check(v)
{
    const r = resolve(v);
    if (r.kind === 'none') return '沒有 icon';
    if (r.kind === 'unknown') return `textures.json 沒有「${r.key}」（新圖要按殼的「更新圖片清單」）`;
    if (r.kind === 'sheet')
    {
        const img = load(r.sheet.url).img;
        if (!Number.isInteger(r.frame) || r.frame < 0) return `格子編號「${v}」不是整數`;
        if (img && r.frame >= grid(r.sheet, img).count) return `${r.key} 只有 ${grid(r.sheet, img).count} 格，${r.frame} 超出範圍`;
    }
    return '';
}

// 給 canvas 自己畫：{img, f: 圖裡的格子範圍}；不是圖或載入失敗回傳 null
export async function frameOf(v)
{
    const r = resolve(v);
    if (r.kind !== 'sheet' && r.kind !== 'image') return null;
    const img = await load(r.kind === 'sheet' ? r.sheet.url : r.url).p;
    if (!img) return null;
    return {img, f: r.kind === 'sheet' ? frameRect(r.sheet, img, r.frame) : {x: 0, y: 0, w: img.width, h: img.height}};
}

// 預覽元素：圖畫在 size×size 的 canvas 裡（等比縮放置中），emoji 用文字
export function iconEl(v, size = 32)
{
    const r = resolve(v);
    if (r.kind === 'text' || r.kind === 'atlas' || r.kind === 'none' || r.kind === 'unknown')
    {
        const s = document.createElement('span');
        s.className = 'ico ' + r.kind;
        s.style.cssText = `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.7)}px`;
        s.textContent = r.kind === 'text' ? v : r.kind === 'none' ? '' : '?';
        s.title = v ?? '';
        return s;
    }
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    cv.className = 'ico';
    cv.title = v;
    const url = r.kind === 'sheet' ? r.sheet.url : r.url;
    load(url).p.then(img => {
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        if (!img) {g.fillStyle = '#a33'; g.fillRect(0, 0, size, size); return;}
        const f = r.kind === 'sheet' ? frameRect(r.sheet, img, r.frame) : {x: 0, y: 0, w: img.width, h: img.height};
        const k = Math.min(size / f.w, size / f.h);
        const w = f.w * k, h = f.h * k;
        g.drawImage(img, f.x, f.y, f.w, f.h, (size - w) / 2, (size - h) / 2, w, h);
    });
    return cv;
}

// ---------- 選圖器 ----------
// 回傳選到的字串；取消回傳 null
export function pickIcon(cur)
{
    const dlg = document.getElementById('dlgIcon');
    const tabs = dlg.querySelector('.tabs'), body = dlg.querySelector('.body'), txt = dlg.querySelector('input'), info = dlg.querySelector('.info');
    const r = resolve(cur);
    txt.value = cur ?? '';
    let tab = r.kind === 'sheet' ? r.key : r.kind === 'image' ? '#image' : Object.keys(SHEETS).includes('icons') ? 'icons' : Object.keys(SHEETS)[0];

    const choose = (v) => {txt.value = v; dlg.close('ok');};
    const show = () => {
        tabs.replaceChildren(...[...Object.keys(SHEETS), '#image'].map(k => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = k === '#image' ? '單張圖' : k;
            b.classList.toggle('on', k === tab);
            b.onclick = () => {tab = k; show();};
            return b;
        }));
        body.replaceChildren();
        if (tab === '#image')
        {
            for (const key of Object.keys(IMAGES))
            {
                const d = document.createElement('div');
                d.className = 'imgCell' + (key === cur ? ' sel' : '');
                d.append(iconEl(key, 48), Object.assign(document.createElement('div'), {textContent: key}));
                d.onclick = () => choose(key);
                body.append(d);
            }
            return;
        }
        const s = SHEETS[tab];
        load(s.url).p.then(img => {
            if (!img) return body.append('載入失敗：' + s.url);
            const k = s.fw <= 32 ? 2 : 1;
            const cv = document.createElement('canvas');
            cv.width = img.width * k; cv.height = img.height * k;
            const g = cv.getContext('2d');
            g.imageSmoothingEnabled = false;
            g.drawImage(img, 0, 0, cv.width, cv.height);
            if (r.kind === 'sheet' && r.key === tab)
            {
                const f = frameRect(s, img, r.frame);
                g.strokeStyle = '#4a8be0'; g.lineWidth = 2;
                g.strokeRect(f.x * k + 1, f.y * k + 1, f.w * k - 2, f.h * k - 2);
            }
            const at = (e) => {
                const {cols, rows} = grid(s, img);
                const c = Math.floor((e.offsetX / k - s.margin) / (s.fw + s.space)), rw = Math.floor((e.offsetY / k - s.margin) / (s.fh + s.space));
                return c >= 0 && rw >= 0 && c < cols && rw < rows ? rw * cols + c : -1;
            };
            cv.onmousemove = (e) => {const n = at(e); info.textContent = n < 0 ? '' : `${tab}:${n}`;};
            cv.onclick = (e) => {const n = at(e); if (n >= 0) choose(`${tab}:${n}`);};
            body.append(cv);
        });
    };
    show();
    dlg.showModal();
    return new Promise(res => dlg.addEventListener('close', () => res(dlg.returnValue === 'ok' ? txt.value.trim() : null), {once: true}));
}
