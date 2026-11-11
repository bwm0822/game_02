// 地圖分頁：左樹（世界／室內／其他，徽章＝角色數、@群組數）、中間沒選＝世界縮圖總覽／選了＝地圖（角色照 role.json 合成、作息 point 淡色唯讀）、右欄圖層／群組＋角色清單＋選取的角色
// 地圖先讀專案資料夾、讀不到走 dev server（tools/common/mapview.js）；見 docs/map-tool.md
import {$, h, status} from '../common/dom.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import * as PZ from '../common/panzoom.js';
import * as PT from '../common/part.js';
import * as IC from '../common/icons.js';
import * as MV from '../common/mapview.js';
import {createFold} from '../common/fold.js';
import {createShowMenu} from '../common/showmenu.js';
import {resolveObject, joinPath} from '../../src/data/navgrid.js';
import {usersOf as pointUsers} from '../role/mapedit.js';
import {isRoleObj, roleObjs, placeOf, spriteOf, forgetSprites, SPRITE_HALF} from './roles.js';
import '../common/splitter.js';

const SEL_KEY = 'tools.map.sel', ONLY_KEY = 'tools.map.only';
const S = {
    assets: null,       // {dir: public/assets, json}
    roles: {}, items: {}, parts: {},
    spawns: {},         // 群組 → {line, cond}（story.json 劇情線的 spawns）
    world: [],          // main.world：[{name, x, y, w, h}]
    maps: [],           // [{name, cat: world|room|other}]
    sums: {},           // 地圖名 → {roles, groups: [名稱], err}
    sel: null,          // 選中的地圖
    pick: null,         // 選中的角色（物件 id）
    search: '',
    only: false,
};
try {S.sel = localStorage.getItem(SEL_KEY); S.only = localStorage.getItem(ONLY_KEY) === '1';} catch {}

const SHOW = createShowMenu('tools.map.show', [['points', '作息 point（淡色）', '#ffd24a'], ['names', '物件名稱', '#dddddd'],
    ['grid', '格子可走（紅＝擋住、黃＝慢）', '#ff7777']], {points: true});
const show = SHOW.show;
const F = createFold();
const refs = () => ({roles: S.roles, items: S.items, parts: S.parts});
const CATS = [['world', '世界'], ['room', '室內'], ['other', '其他']];
const KIND = {npc: 'NPC', monster: '怪物', animal: '動物', boss: '首領', rogue: '土匪', player: '玩家'};

// ---------- 讀取 ----------
// 殼給專案根目錄；無頭測試可以直接給 public/assets
async function setRoot(dir)
{
    let assets = dir, json = await FS.tryDir(dir, 'json');
    if (!json)
    {
        assets = await FS.tryDir(await FS.tryDir(dir, 'public') ?? dir, 'assets');
        json = assets && await FS.tryDir(assets, 'json');
    }
    if (!json || !await FS.tryFile(json, 'role.json')) throw new Error(`「${dir.name}」裡沒有 public/assets/json/role.json`);
    S.assets = {dir: assets, json};
    await reload();
}

MV.setReader(async (rel) => {
    if (!S.assets) return null;
    try {return JSON.parse(await (await (await FS.resolveFile(S.assets.dir, rel)).file.getFile()).text());}
    catch {return null;}
});

const readJsonFile = async (f, def) => {
    try {return JSON.parse(await FS.readText(S.assets.json, f));}
    catch {return def;}
};

async function loadRefs()
{
    S.roles = await readJsonFile('role.json', {});
    S.items = await readJsonFile('item.json', {});
    S.parts = await PT.readParts(S.assets.json).catch(() => ({}));
    forgetSprites();
}

async function loadSpawns()
{
    const story = await readJsonFile('story.json', {});
    S.spawns = {};
    for (const [line, l] of Object.entries(story.lines ?? {}))
        for (const [g, cond] of Object.entries(l.spawns ?? {})) S.spawns[g] = {line, cond};
}

// maps/ 底下的地圖（不含 _ 開頭的舊檔），名稱＝相對 maps/、不含 .json
async function listMaps()
{
    const out = [];
    const walk = async (dir, pre) => {
        const {dirs, files} = await FS.listDir(dir);
        for (const f of files) if (f.name.endsWith('.json') && !f.name.startsWith('_')) out.push(pre + f.name.slice(0, -5));
        for (const d of dirs) if (!d.name.startsWith('_') && !d.name.startsWith('.')) await walk(d, `${pre}${d.name}/`);
    };
    const maps = await FS.tryDir(S.assets.dir, 'maps');
    if (maps) await walk(maps, '');
    return out.sort();
}

async function loadWorld()
{
    const w = await MV.readJson('maps/main.world');
    S.world = (w?.maps ?? []).map(m => ({name: m.fileName.replace(/\.json$/, ''), x: m.x, y: m.y, w: m.width, h: m.height}));
}

function catOf(name, worldSet, worldBase)
{
    if (worldSet.has(name)) return 'world';
    return name.includes('/') && worldBase.has(name.split('/')[0]) ? 'room' : 'other';
}

// 徽章用：只讀地圖 json＋template，不烤圖
const tplCache = new Map();
async function summarize(name)
{
    const file = `maps/${name}.json`, map = await MV.readJson(file);
    if (!map) return {roles: 0, groups: [], err: '讀不到'};
    const dir = MV.dirOf(file);
    let roles = 0;
    const groups = [];
    for (const l of map.layers ?? [])
    {
        if (l.type !== 'objectgroup') continue;
        if (l.name.startsWith('@')) groups.push(l.name.slice(1));
        for (const raw of l.objects)
        {
            let tpl = null;
            if (raw.template)
            {
                const p = joinPath(dir, raw.template);
                if (!tplCache.has(p)) tplCache.set(p, MV.readJson(p));
                tpl = await tplCache.get(p);
            }
            if (isRoleObj(resolveObject(raw, tpl))) roles++;
        }
    }
    return {roles, groups};
}

async function resummarize(names)
{
    await Promise.all(names.map(async n => {S.sums[n] = await summarize(n);}));
}

async function reload()
{
    if (!S.assets) return;
    status('讀取中…');
    await loadRefs();
    await loadSpawns();
    await loadWorld();
    const names = await listMaps();
    const worldSet = new Set(S.world.map(w => w.name)), worldBase = new Set(S.world.map(w => w.name.split('/').at(-1)));
    S.maps = names.map(name => ({name, cat: catOf(name, worldSet, worldBase)}));
    S.sums = {};
    await resummarize(names);
    if (S.sel && !names.includes(S.sel)) S.sel = null;
    status(`${names.length} 張地圖`);
    render();
}

// ---------- 左欄 ----------
const hasStuff = (name) => !!(S.sums[name]?.roles || S.sums[name]?.groups.length);
const shortName = (name) => name.split('/').at(-1);

function badges(name)
{
    const s = S.sums[name];
    if (!s) return null;
    if (s.err) return h('span', {class: 'badges'}, h('span', {class: 'warn'}, `⚠ ${s.err}`));
    return h('span', {class: 'badges'},
        s.roles > 0 && h('span', {title: '角色數'}, `🐾${s.roles}`),
        s.groups.length > 0 && h('span', {class: 'grp', title: s.groups.map(g => `@${g}`).join(' ')}, `@${s.groups.length}`));
}

function selectMap(name)
{
    S.sel = S.sel === name ? null : name;
    S.pick = null;
    try {S.sel ? localStorage.setItem(SEL_KEY, S.sel) : localStorage.removeItem(SEL_KEY);} catch {}
    render();
}

function renderList()
{
    const q = S.search.trim().toLowerCase(), searching = !!q;
    const vis = S.maps.filter(m => (!q || m.name.toLowerCase().includes(q)) && (!S.only || hasStuff(m.name)));
    const gs = CATS.map(([k, t]) => [k, t, vis.filter(m => m.cat === k)]).filter(([, , l]) => l.length);
    const keys = gs.map(([k]) => k);
    const mine = gs.find(([, , l]) => l.some(m => m.name === S.sel))?.[0];
    if (mine && !searching) F.open(mine);
    $('list').replaceChildren(...gs.flatMap(([k, t, list]) => [
        F.head(k, `${t}（${list.length}）`, keys, () => render(), searching),
        ...F.folded(k, searching) ? [] : list.map(m => h('div', {class: 'item' + (m.name === S.sel ? ' sel' : '') + (hasStuff(m.name) ? '' : ' empty'),
            dataset: {map: m.name}, title: m.name, onclick: () => selectMap(m.name)},
            h('span', null, m.cat === 'room' ? m.name : shortName(m.name)), badges(m.name)))]));
}

// ---------- 中間：世界總覽 ----------
function worldEl()
{
    if (!S.world.length) return h('div', {class: 'dim'}, '沒有 main.world');
    const x0 = Math.min(...S.world.map(w => w.x)), y0 = Math.min(...S.world.map(w => w.y));
    const W = Math.max(...S.world.map(w => w.x + w.w)) - x0, H = Math.max(...S.world.map(w => w.y + w.h)) - y0;
    const pct = (v, t) => `${(v / t) * 100}%`;
    const box = h('div', {class: 'world', style: `aspect-ratio: ${W} / ${H}; max-width: calc((100vh - 70px) * ${W / H})`},
        S.world.map(w => {
            const s = S.sums[w.name];
            return h('div', {class: 'cell' + (hasStuff(w.name) ? ' has' : ''), dataset: {map: w.name}, title: w.name,
                style: `left:${pct(w.x - x0, W)};top:${pct(w.y - y0, H)};width:${pct(w.w, W)};height:${pct(w.h, H)}`,
                onclick: () => selectMap(w.name)},
                h('img', {src: `/assets/textures/minimap/${w.name}.png`, alt: '', loading: 'lazy', draggable: 'false'}),
                h('span', {class: 'lab'}, shortName(w.name)),
                h('span', {class: 'bd'}, s?.roles > 0 && h('span', null, `🐾${s.roles}`),
                    s?.groups.map(g => h('span', {class: 'grp'}, `@${g}`))));
        }));
    return [h('div', {class: 'wtitle'}, '世界總覽：點一格打開那張地圖（室內和其他地圖在左欄）'), box];
}

// ---------- 中間：地圖 ----------
const views = new Map();
const viewOf = (name) => {if (!views.has(name)) views.set(name, PZ.createView(`tools.preview.view.map.${name}`)); return views.get(name);};
const skipRoles = (o) => isRoleObj(o);

function draw(cv, st)
{
    const d = st.data, g = cv.getContext('2d');
    const {K} = st.pz.begin(g, (g, cw, ch) => {g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, cw, ch);});
    if (!d) return;
    g.imageSmoothingEnabled = false;
    g.translate(-d.W / 2, -d.H / 2);
    g.drawImage(d.bake, 0, 0);
    if (show.grid) MV.drawGrid(g, d);
    // 作息 point：淡色唯讀
    if (show.points)
    {
        for (const n of d.named.values())
        {
            if (n.type !== 'point') continue;
            const on = st.hover?.point === n.name;
            g.globalAlpha = on ? 1 : 0.35;
            g.strokeStyle = '#ffd24a';
            g.lineWidth = (on ? 2 : 1) / K;
            g.beginPath(); g.arc(n.cen.x, n.cen.y, 5, 0, Math.PI * 2); g.stroke();
        }
        g.globalAlpha = 1;
    }
    // 角色：照 root 的 y 排（下面的蓋上面）
    for (const it of st.roles)
    {
        const sp = st.sprites.get(it.rid);
        if (sp) g.drawImage(sp, it.at.cen.x - SPRITE_HALF, it.at.cen.y - SPRITE_HALF);
        else
        {
            g.fillStyle = 'rgba(255,80,80,0.6)';
            g.fillRect(it.at.cen.x - it.at.w / 2, it.at.cen.y - it.at.h / 2, it.at.w, it.at.h);
        }
    }
    for (const it of st.roles)
    {
        const sel = S.pick === it.o.id, on = st.hover?.role === it.o.id;
        if (!sel && !on) continue;
        const {cen, root, w, h: hh} = it.at, tw = d.map.tilewidth, th = d.map.tileheight;
        g.setLineDash(sel ? [] : [4 / K, 3 / K]);
        g.strokeStyle = sel ? '#4fc3f7' : '#ffffff';
        g.lineWidth = 2 / K;
        g.strokeRect(cen.x - w / 2, cen.y - hh / 2, w, hh);
        g.setLineDash([]);
        g.fillStyle = sel ? 'rgba(79,195,247,0.25)' : 'rgba(255,255,255,0.15)';
        g.fillRect(Math.floor(root.x / tw) * tw, Math.floor(root.y / th) * th, tw, th);
    }
    if (show.names)
    {
        g.font = `bold ${14 / K}px sans-serif`;
        g.textAlign = 'center';
        g.lineWidth = 3.5 / K;
        g.strokeStyle = 'rgba(0,0,0,0.85)';
        g.fillStyle = '#eee';
        for (const n of d.named.values())
        {
            if (n.type === 'point' && !show.points) continue;
            const y = n.type === 'point' ? n.cen.y - 12 / K : n.rect.y - 6 / K;
            g.strokeText(n.name, n.cen.x, y);
            g.fillText(n.name, n.cen.x, y);
        }
    }
    cv.dataset.drawn = st.roles.length;
}

function hitAt(st, p, K)
{
    for (let i = st.roles.length - 1; i >= 0; i--)
    {
        const {cen, w, h: hh} = st.roles[i].at;
        if (Math.abs(p.x - cen.x) <= w / 2 && Math.abs(p.y - cen.y) <= hh / 2) return {role: st.roles[i].o.id, it: st.roles[i]};
    }
    if (!show.points) return null;
    for (const n of st.data.named.values())
        if (n.type === 'point' && Math.hypot(p.x - n.cen.x, p.y - n.cen.y) <= Math.max(8, 8 / K)) return {point: n.name, n};
    return null;
}

async function loadMapState(st)
{
    const d = await MV.mapData(st.name, {skip: skipRoles, tag: 'map'});
    st.data = d;
    if (!d) return;
    st.roles = roleObjs(d).map(it => ({...it, at: placeOf(it.o, S.roles[it.rid])})).sort((a, b) => a.at.root.y - b.at.root.y);
    await Promise.all([...new Set(st.roles.map(it => it.rid))].map(async rid => st.sprites.set(rid, await spriteOf(rid, refs()))));
}

function mapEl(name)
{
    const view = viewOf(name);
    const cv = h('canvas');
    const tip = h('div', {class: 'tip', hidden: true});
    const msg = h('div', {class: 'msg dim', hidden: true});
    const st = {name, data: null, roles: [], sprites: new Map(), hover: null};
    cv.st = st;
    const redraw = () => draw(cv, st);
    st.pz = PZ.panzoom(cv, {frame: () => ({w: st.data?.W ?? 320, h: st.data?.H ?? 320}), redraw, view});
    const toMap = (e) => {const p = st.pz.toWorld(e); return {x: p.x + st.data.W / 2, y: p.y + st.data.H / 2};};
    const say = (e) => {
        const hit = st.hover;
        if (!hit) {tip.hidden = true; return;}
        const lines = [];
        if (hit.role)
        {
            const it = st.roles.find(x => x.o.id === hit.role), r = S.roles[it.rid];
            const tw = st.data.map.tilewidth, th = st.data.map.tileheight;
            lines.push(h('div', {class: 'tname'}, `${it.rid}${r?.lab ? ` ${r.lab}` : ''}`),
                h('div', {class: 'tsub'}, `${KIND[r?.kind] ?? r?.kind ?? '⚠ role.json 沒有'}・${it.layer}・格 ${Math.floor(it.at.root.x / tw)},${Math.floor(it.at.root.y / th)}`),
                h('div', {class: 'thint'}, '點＝選取'));
        }
        else
        {
            const users = pointUsers(S.roles, name, hit.point);
            lines.push(h('div', {class: 'tname'}, `${hit.point}（作息 point）`),
                h('div', {class: 'tsub'}, users.length ? users.map(u => `${u.id} ${u.i + 1}`).join('、') : '沒有作息用到'),
                h('div', {class: 'thint'}, users.length ? '點＝到角色分頁看作息（point 在角色分頁改）' : 'point 在角色分頁改'));
        }
        tip.replaceChildren(...lines);
        tip.hidden = false;
        if (!e) return;
        const box = cv.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
        tip.style.left = `${Math.max(0, x + 14 + tip.offsetWidth > box.width ? x - 14 - tip.offsetWidth : x + 14)}px`;
        tip.style.top = `${Math.max(0, y + 16 + tip.offsetHeight > box.height ? y - 10 - tip.offsetHeight : y + 16)}px`;
    };
    cv.addEventListener('pointermove', (e) => {
        if (!st.data || st.pz.panning) return;
        const hit = hitAt(st, toMap(e), st.pz.K);
        const key = hit ? (hit.role ?? `p:${hit.point}`) : null, was = st.hover ? (st.hover.role ?? `p:${st.hover.point}`) : null;
        st.hover = hit;
        cv.style.cursor = hit ? 'pointer' : '';
        say(e);
        if (key !== was) redraw();
    });
    cv.addEventListener('pointerleave', () => {if (st.hover) {st.hover = null; say(); redraw();}});
    cv.addEventListener('click', (e) => {
        if (!st.data) return;
        const hit = hitAt(st, toMap(e), st.pz.K);
        if (hit?.point)
        {
            const users = pointUsers(S.roles, name, hit.point);
            if (users.length) SH.gotoTab('role', [users[0].id]);
            return;
        }
        S.pick = hit?.role ?? null;
        redraw();
        renderRight();
    });
    loadMapState(st).then(() => {
        if (!st.data) {msg.textContent = `讀不到地圖 ${name}`; msg.hidden = false;}
        else if (!view.set) PZ.center(view);
        redraw();
        renderRight();
    });
    requestAnimationFrame(redraw);
    return h('div', {class: 'mv'},
        h('div', {class: 'opts'}, h('span', {class: 'name'}, name),
            h('button', {type: 'button', title: '回世界總覽', onclick: () => selectMap(name)}, '總覽'),
            h('span', {class: 'help', title: '滾輪縮放、按住中鍵拖曳平移；點角色選取；淡色圓點是作息 point（唯讀，點了跳到角色分頁）'}, '?')),
        h('div', {class: 'cvbox'}, cv, tip, msg),
        h('div', {class: 'opts'}, SHOW.showMenu(redraw), PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布')));
}

const mapSt = () => document.querySelector('#view canvas')?.st;

function renderView()
{
    $('view').replaceChildren(...[S.sel ? mapEl(S.sel) : worldEl()].flat());
}

// ---------- 右欄 ----------
function renderRight()
{
    const st = mapSt();
    if (!S.sel || !st?.data) {$('right').replaceChildren(); return;}
    const d = st.data, tw = d.map.tilewidth, th = d.map.tileheight;
    const groups = d.map.layers.filter(l => l.type === 'objectgroup' && l.name.startsWith('@')).map(l => l.name.slice(1));
    const count = (pred) => st.roles.filter(pred).length;
    const fixed = count(it => !it.layer.startsWith('@'));
    const layerRows = [
        h('div', {class: 'layer', dataset: {layer: ''}}, h('b', null, '常駐'), h('span', {class: 'dim'}, '（不屬於群組，一直都在）'), h('span', {class: 'n'}, String(fixed))),
        ...groups.map(g => {
            const sp = S.spawns[g];
            return h('div', {class: 'layer grp', dataset: {layer: `@${g}`}},
                h('div', null, h('b', null, `@${g}`), h('span', {class: 'dim'}, sp ? `　${sp.line}` : '　⚠ story.json 沒宣告'),
                    sp && h('span', {class: 'cond'}, sp.cond)),
                h('span', {class: 'n'}, String(count(it => it.layer === `@${g}`))));
        })];
    const roleRows = st.roles.map(it => h('div', {class: 'r' + (S.pick === it.o.id ? ' sel' : ''), dataset: {oid: it.o.id}, onclick: () => {S.pick = S.pick === it.o.id ? null : it.o.id; renderRight(); draw(document.querySelector('#view canvas'), st);}},
        IC.iconEl(S.roles[it.rid]?.icon, 20), h('span', null, it.rid), h('span', {class: 'where'}, `${it.layer.startsWith('@') ? it.layer : '常駐'}・${Math.floor(it.at.root.x / tw)},${Math.floor(it.at.root.y / th)}`)));
    const it = st.roles.find(x => x.o.id === S.pick);
    $('right').replaceChildren(
        h('div', {class: 'sec'}, '圖層／群組'), ...layerRows,
        h('div', {class: 'sec'}, '角色 ', h('span', {class: 'dim'}, `（${st.roles.length}）`)),
        h('div', {class: 'roles'}, roleRows.length ? roleRows : h('div', {class: 'dim'}, '這張地圖沒有角色')),
        it && pickedEl(it, tw, th));
}

function pickedEl(it, tw, th)
{
    const r = S.roles[it.rid], raw = it.o.raw;
    const fmt = raw.template ? `template ${raw.template.split('/').at(-1)}` : raw.gid != null ? '圖塊物件' : '點';
    const props = Object.entries(it.o.props).filter(([k]) => k !== 'id');
    return h('div', null,
        h('div', {class: 'sec'}, '選取的角色'),
        h('table', null,
            h('tr', null, h('td', {class: 'k'}, 'id'), h('td', null, it.rid, ' ', h('a', {class: 'go', title: '到角色分頁', onclick: () => SH.gotoTab('role', [it.rid])}, '↗'))),
            h('tr', null, h('td', {class: 'k'}, '名字'), h('td', null, r?.lab ?? h('span', {class: 'warn'}, '⚠ role.json 沒有'))),
            r && h('tr', null, h('td', {class: 'k'}, '種類'), h('td', null, KIND[r.kind] ?? r.kind ?? '')),
            h('tr', null, h('td', {class: 'k'}, '圖層'), h('td', null, it.layer)),
            h('tr', null, h('td', {class: 'k'}, '站的格子'), h('td', null, `${Math.floor(it.at.root.x / tw)}, ${Math.floor(it.at.root.y / th)}`)),
            h('tr', null, h('td', {class: 'k'}, '格式'), h('td', null, fmt)),
            h('tr', null, h('td', {class: 'k'}, '物件 id'), h('td', null, it.o.id)),
            ...props.map(([k, v]) => h('tr', null, h('td', {class: 'k'}, k), h('td', null, String(v))))));
}

function render()
{
    renderList();
    renderView();
    renderRight();
}

// ---------- 接線 ----------
$('search').oninput = (e) => {S.search = e.target.value; renderList();};
$('onlyRoles').checked = S.only;
$('onlyRoles').onchange = (e) => {
    S.only = e.target.checked;
    try {localStorage.setItem(ONLY_KEY, S.only ? '1' : '0');} catch {}
    renderList();
};
const act = (p) => p.catch(e => status(e.message));
SH.onSaved((file) => {
    if (!S.assets) return;
    if (['role.json', 'item.json', 'part.json'].includes(file)) act(loadRefs().then(render));
    else if (file === 'story.json') act(loadSpawns().then(renderRight));
    else if (file?.startsWith('maps/'))
    {
        const name = file.slice(5).replace(/\.json$/, '');
        MV.forget(name);
        act(resummarize([name]).then(render));
    }
});
IC.onReload(() => {forgetSprites(); render();});
SH.onGoto(([map, oid]) => {S.sel = map; S.pick = oid ?? null; render();});
SH.onProject((dir) => act(setRoot(dir)));
render();

// 給無頭測試用
window.__mt = {S, setRoot, reload, render, selectMap, mapSt, MV, PZ};
