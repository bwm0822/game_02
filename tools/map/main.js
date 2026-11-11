// 地圖分頁：左樹（世界／室內／其他，徽章＝角色數、@群組數）、中間沒選＝世界縮圖總覽／選了＝地圖（角色照 role.json 合成、作息 point 淡色唯讀）、右欄圖層／群組＋角色清單＋選取的角色
// 地圖先讀專案資料夾、讀不到走 dev server（tools/common/mapview.js）；見 docs/map-tool.md
import {$, h, ask, status} from '../common/dom.js';
import * as ED from './edit.js';
import * as FS from '../common/fs.js';
import * as SH from '../common/shell.js';
import * as PZ from '../common/panzoom.js';
import * as PT from '../common/part.js';
import * as IC from '../common/icons.js';
import * as MV from '../common/mapview.js';
import {createFold} from '../common/fold.js';
import {createShowMenu} from '../common/showmenu.js';
import {renderDatalists} from '../common/views.js';
import {storyLists} from '../common/storyform.js';
import '../common/combo.js';
import {checkStory} from '../../src/data/storycheck.js';
import {resolveObject, joinPath} from '../../src/data/navgrid.js';
import {usersOf as pointUsers} from '../role/mapedit.js';
import {isRoleObj, roleObjs, placeOf, spriteOf, forgetSprites, SPRITE_HALF} from './roles.js';
import {roleIssues, checkMapRoles} from '../../src/data/mapcheck.js';
import {buildPlan, hhmm, mod} from '../../src/data/schedplan.js';
import {daySegs, whereAt} from '../role/schedbar.js';
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
    tpls: {},           // 角色 id → {path, object}（templates/ 裡 type npc 的）
    place: null,        // 調色盤選中的角色（放置模式）
    target: '',         // 放到哪層：''＝常駐（roles 層）、'@群組'
    kindTab: 'all',     // 調色盤的種類分頁
    psearch: '',
    hist: [], hi: 0,    // undo：[{map, before, after, msg}]（地圖全文），hi＝下一筆要放的位置
};
const KIND_KEY = 'tools.map.kind';
try {S.sel = localStorage.getItem(SEL_KEY); S.only = localStorage.getItem(ONLY_KEY) === '1'; S.kindTab = localStorage.getItem(KIND_KEY) || 'all';} catch {}

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
    const nav = await readJsonFile('navgraph.json', {nodes: {}, edges: {}});
    // 有作息的角色的時刻表（同遊戲 ScheduleManager 的 buildPlan），時間游標用
    S.plans = {};
    for (const [id, r] of Object.entries(S.roles))
    {
        const sch = Array.isArray(r.schedule) ? r.schedule : [];
        if (!sch.length) continue;
        const plan = buildPlan(sch, nav.edges ?? {}, nav.nodes ?? {}).plan;
        if (plan) S.plans[id] = {sch, plan, segs: daySegs(plan, sch)};
    }
    forgetSprites();
}

// ---------- 時間游標：具名 NPC 這個時刻在這張圖的哪裡 ----------
const TIME_KEY = 'tools.map.time', T_KEY = 'tools.map.t';
S.timeOn = false;
S.t = 8 * 60;
try {S.timeOn = localStorage.getItem(TIME_KEY) === '1'; S.t = mod(+(localStorage.getItem(T_KEY) ?? 480) || 0);} catch {}
const toMin = (s) => {const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;};

// [{id, at（whereAt）, n（具名物件）}]：停在這張圖的點、或正走向這張圖的點（走路中）；同一點好幾個人照順序排開
function npcsAt(st)
{
    if (!S.timeOn || !st.data) return [];
    const out = [];
    for (const [id, p] of Object.entries(S.plans ?? {}))
    {
        const at = whereAt(p.plan, p.sch, S.t, p.segs);
        if (!at || at.map !== st.name) continue;
        const n = st.data.named.get(at.go);
        if (n) out.push({id, at, n});
    }
    const slot = new Map();
    for (const x of out) {const k = slot.get(x.n.name) ?? 0; slot.set(x.n.name, k + 1); x.k = k;}
    return out;
}

function setTime(t, on = S.timeOn)
{
    S.t = mod(Math.round(t));
    S.timeOn = on;
    try {localStorage.setItem(T_KEY, String(S.t)); localStorage.setItem(TIME_KEY, on ? '1' : '0');} catch {}
    const st = mapSt();
    if (!st) return;
    st.npcs = npcsAt(st);
    Promise.all(st.npcs.filter(x => !st.sprites.has(x.id)).map(async x => st.sprites.set(x.id, await spriteOf(x.id, refs())))).then(() => st.redraw());
    st.updateTime?.();
    st.redraw();
}

// story.json 的 spawns＋條件檢查（同任務分頁的 checkStory）＋條件自動完成的 dl-cond
async function loadSpawns()
{
    const story = await readJsonFile('story.json', {}), dialog = await readJsonFile('dialog.json', {});
    S.lines = Object.keys(story.lines ?? {});
    S.spawns = {};
    for (const [line, l] of Object.entries(story.lines ?? {}))
        for (const [g, cond] of Object.entries(l.spawns ?? {})) S.spawns[g] = {line, cond, errs: []};
    for (const r of checkStory({story, dialog, roles: S.roles, items: S.items}))
    {
        const [top, line, k, g] = r.path ?? [];
        if (r.file === 'story.json' && top === 'lines' && k === 'spawns' && S.spawns[g]?.line === line) S.spawns[g].errs.push(r.msg);
    }
    const {lists, labels} = storyLists({roles: S.roles, items: S.items}, story, dialog);
    renderDatalists({cond: lists.cond}, {cond: labels.cond});
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

// 徽章用：只讀地圖 json＋template，不烤圖；issues＝不用格子就能查的問題（角色不存在、具名 NPC…），擋路格要打開地圖才算
const tplCache = new Map();
async function summarize(name)
{
    const file = `maps/${name}.json`, map = await MV.readJson(file);
    if (!map) return {roles: 0, groups: [], issues: [], err: '讀不到'};
    const dir = MV.dirOf(file);
    let roles = 0;
    const groups = [], issues = [];
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
            const o = resolveObject(raw, tpl);
            if (!isRoleObj(o)) continue;
            roles++;
            for (const x of roleIssues(String(o.props.id), S.roles)) issues.push(x.msg);
        }
    }
    return {roles, groups, issues};
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
    S.tpls = await ED.scanTemplates(S.assets.dir);
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
        s.groups.length > 0 && h('span', {class: 'grp', title: s.groups.map(g => `@${g}`).join(' ')}, `@${s.groups.length}`),
        s.issues.length > 0 && h('span', {class: 'warn', title: s.issues.join('\n')}, `⚠${s.issues.length}`));
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
const tileOfPt = (d, p) => [Math.floor(p.x / d.map.tilewidth), Math.floor(p.y / d.map.tileheight)];
const rootTile = (d, it) => tileOfPt(d, it.at.root);
const inMap = (d, [tx, ty]) => tx >= 0 && ty >= 0 && tx < d.map.width && ty < d.map.height;

// 角色 rid 站在格子 tile 時的 view 中心
function cenAt(d, rid, [tx, ty])
{
    const a = S.roles[rid]?.anchor;
    return {x: tx * d.map.tilewidth + d.map.tilewidth / 2 - (a?.x ?? 0), y: ty * d.map.tileheight + d.map.tileheight / 2 - (a?.y ?? 0)};
}

// 半透明的角色＋格子框（放置模式滑過、拖曳中）
function drawGhost(g, d, K, rid, tile, sprites)
{
    const tw = d.map.tilewidth, th = d.map.tileheight, c = cenAt(d, rid, tile), sp = sprites.get(rid);
    g.globalAlpha = 0.6;
    if (sp) g.drawImage(sp, c.x - SPRITE_HALF, c.y - SPRITE_HALF);
    g.globalAlpha = 1;
    g.setLineDash([4 / K, 3 / K]);
    g.strokeStyle = '#7ddc5a';
    g.lineWidth = 2 / K;
    g.strokeRect(tile[0] * tw, tile[1] * th, tw, th);
    g.setLineDash([]);
}

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
    // 角色：照 root 的 y 排（下面的蓋上面）；拖著的那隻變淡
    for (const it of st.roles)
    {
        const sp = st.sprites.get(it.rid);
        g.globalAlpha = st.drag?.moved && st.drag.it === it ? 0.3 : 1;
        if (sp) g.drawImage(sp, it.at.cen.x - SPRITE_HALF, it.at.cen.y - SPRITE_HALF);
        else
        {
            g.fillStyle = 'rgba(255,80,80,0.6)';
            g.fillRect(it.at.cen.x - it.at.w / 2, it.at.cen.y - it.at.h / 2, it.at.w, it.at.h);
        }
    }
    g.globalAlpha = 1;
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
    // 時間游標：具名 NPC（作息）半透明畫在點上，下面藍底名字（走路中虛線框＋→）
    for (const x of st.npcs ?? [])
    {
        const c = npcCen(x), sp = st.sprites.get(x.id), r = S.roles[x.id];
        g.globalAlpha = x.at.kind === 'walk' ? 0.45 : 0.8;
        if (sp) g.drawImage(sp, c.x - SPRITE_HALF, c.y - SPRITE_HALF);
        g.globalAlpha = 1;
        const on = st.hover?.npc === x.id;
        g.setLineDash(x.at.kind === 'walk' ? [4 / K, 3 / K] : []);
        g.strokeStyle = on ? '#fff' : '#4fc3f7';
        g.lineWidth = (on ? 2 : 1) / K;
        g.strokeRect(c.x - (r?.w ?? 32) / 2, c.y - (r?.h ?? 64) / 2, r?.w ?? 32, r?.h ?? 64);
        g.setLineDash([]);
        const txt = `${x.at.kind === 'walk' ? '→' : ''}${x.id}`;
        g.font = `${12 / K}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const tw = g.measureText(txt).width + 6 / K, ty = c.y + (r?.h ?? 64) / 2 + 8 / K;
        g.fillStyle = 'rgba(20,60,90,0.9)';
        g.fillRect(c.x - tw / 2, ty - 7 / K, tw, 14 / K);
        g.fillStyle = '#fff';
        g.fillText(txt, c.x, ty);
        g.textBaseline = 'alphabetic';
    }
    // ⚠：有錯紅、只有警告黃（大小固定在螢幕 px）
    g.font = `bold ${12 / K}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const it of st.roles)
    {
        const xs = st.issues?.get(it.o.id);
        if (!xs) continue;
        const x = it.at.cen.x + it.at.w / 2, y = it.at.cen.y - it.at.h / 2, r = 7 / K;
        g.fillStyle = xs.some(i => i.level === 'error') ? '#e53935' : '#f0b400';
        g.strokeStyle = '#000';
        g.lineWidth = 1 / K;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
        g.fillStyle = '#000';
        g.fillText('!', x, y + 0.5 / K);
    }
    g.textBaseline = 'alphabetic';
    if (st.drag?.moved) drawGhost(g, d, K, st.drag.it.rid, st.drag.tile, st.sprites);
    else if (S.place && st.ghost) drawGhost(g, d, K, S.place, st.ghost, st.sprites);
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

// 時間游標的 NPC 站在點上（point 中心＝站的格子），同一點好幾個往右排開
function npcCen(x)
{
    const a = S.roles[x.id]?.anchor;
    return {x: x.n.cen.x - (a?.x ?? 0) + x.k * 24, y: x.n.cen.y - (a?.y ?? 0)};
}

function hitAt(st, p, K)
{
    for (let i = st.roles.length - 1; i >= 0; i--)
    {
        const {cen, w, h: hh} = st.roles[i].at;
        if (Math.abs(p.x - cen.x) <= w / 2 && Math.abs(p.y - cen.y) <= hh / 2) return {role: st.roles[i].o.id, it: st.roles[i]};
    }
    for (const x of st.npcs ?? [])
    {
        const c = npcCen(x), r = S.roles[x.id];
        if (Math.abs(p.x - c.x) <= (r?.w ?? 32) / 2 && Math.abs(p.y - c.y) <= (r?.h ?? 64) / 2) return {npc: x.id, x};
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
    st.all = roleObjs(d).map(it => ({...it, at: placeOf(it.o, S.roles[it.rid])})).sort((a, b) => a.at.root.y - b.at.root.y);
    applyHide(st);
    st.issues = new Map();
    for (const x of checkMapRoles(d, S.roles, MV.gridOf(d))) (st.issues.get(x.oid) ?? st.issues.set(x.oid, []).get(x.oid)).push(x);
    st.npcs = npcsAt(st);
    const rids = new Set([...st.all.map(it => it.rid), ...st.npcs.map(x => x.id)]);
    if (S.place) rids.add(S.place);
    await Promise.all([...rids].map(async rid => st.sprites.set(rid, await spriteOf(rid, refs()))));
}

function mapEl(name)
{
    const view = viewOf(name);
    const cv = h('canvas');
    const tip = h('div', {class: 'tip', hidden: true});
    const msg = h('div', {class: 'msg dim', hidden: true});
    const st = {name, data: null, roles: [], sprites: new Map(), hover: null, ghost: null, drag: null};
    cv.st = st;
    const redraw = () => draw(cv, st);
    st.redraw = redraw;
    st.pz = PZ.panzoom(cv, {frame: () => ({w: st.data?.W ?? 320, h: st.data?.H ?? 320}), redraw, view});
    const toMap = (e) => {const p = st.pz.toWorld(e); return {x: p.x + st.data.W / 2, y: p.y + st.data.H / 2};};
    const say = (e) => {
        const hit = st.hover;
        if (!hit || S.place || st.drag?.moved) {tip.hidden = true; return;}
        const lines = [];
        if (hit.role)
        {
            const it = hit.it, r = S.roles[it.rid], [tx, ty] = rootTile(st.data, it);
            lines.push(h('div', {class: 'tname'}, `${it.rid}${r?.lab ? ` ${r.lab}` : ''}`),
                h('div', {class: 'tsub'}, `${KIND[r?.kind] ?? r?.kind ?? '⚠ role.json 沒有'}・${it.layer}・格 ${tx},${ty}`),
                ...(st.issues?.get(it.o.id) ?? []).map(x => h('div', {class: 'twarn'}, `⚠ ${x.msg}`)),
                h('div', {class: 'thint'}, '點＝選取、拖＝移動、右鍵＝選單'));
        }
        else if (hit.npc)
        {
            const {at} = hit.x, r = S.roles[hit.npc];
            lines.push(h('div', {class: 'tname'}, `${hit.npc}${r?.lab ? ` ${r.lab}` : ''}（作息）`),
                h('div', {class: 'tsub'}, `${hhmm(S.t)} ${at.kind === 'walk' ? '正走去' : '在'} ${at.go}（第 ${at.i + 1} 筆）`),
                h('div', {class: 'thint'}, '點＝到角色分頁看作息'));
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
    // 拖角色（左鍵按在角色上、移超過 4px 才算拖）：整格移動，放開寫檔；拖過就吃掉接著的 click
    cv.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || !st.data || S.place) return;
        const hit = hitAt(st, toMap(e), st.pz.K);
        if (!hit?.role) return;
        if (e.isTrusted) cv.setPointerCapture(e.pointerId);
        const from = rootTile(st.data, hit.it);
        st.drag = {it: hit.it, sx: e.clientX, sy: e.clientY, at: tileOfPt(st.data, toMap(e)), from, tile: from, moved: false};
    });
    cv.addEventListener('pointerup', () => {
        const dr = st.drag;
        st.drag = null;
        if (!dr?.moved) return;
        st.swallow = true;
        setTimeout(() => {st.swallow = false;}, 0);
        redraw();
        act(moveRole(name, dr.it, dr.tile[0] - dr.from[0], dr.tile[1] - dr.from[1]));
    });
    cv.addEventListener('pointermove', (e) => {
        if (!st.data || st.pz.panning) return;
        const p = toMap(e), dr = st.drag;
        if (dr)
        {
            if (!dr.moved && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) < 4) return;
            dr.moved = true;
            const t = tileOfPt(st.data, p), to = [dr.from[0] + t[0] - dr.at[0], dr.from[1] + t[1] - dr.at[1]];
            if (inMap(st.data, to)) dr.tile = to;
            cv.style.cursor = 'grabbing';
            tip.hidden = true;
            return redraw();
        }
        if (S.place)
        {
            const t = tileOfPt(st.data, p), was = st.ghost;
            st.ghost = inMap(st.data, t) ? t : null;
            cv.style.cursor = 'crosshair';
            tip.hidden = true;
            if (String(was) !== String(st.ghost)) redraw();
            return;
        }
        const hit = hitAt(st, p, st.pz.K);
        const keyOf = (x) => (x ? (x.role ?? (x.npc ? `n:${x.npc}` : `p:${x.point}`)) : null);
        const key = keyOf(hit), was = keyOf(st.hover);
        st.hover = hit;
        cv.style.cursor = hit?.role ? 'grab' : hit ? 'pointer' : '';
        say(e);
        if (key !== was) redraw();
    });
    cv.addEventListener('pointerleave', () => {if (st.hover || st.ghost) {st.hover = st.ghost = null; say(); redraw();}});
    cv.addEventListener('click', (e) => {
        if (!st.data || st.swallow) return;
        const p = toMap(e);
        if (S.place)
        {
            const t = tileOfPt(st.data, p);
            if (inMap(st.data, t)) act(placeRole(name, S.place, t, e.shiftKey));
            return;
        }
        const hit = hitAt(st, p, st.pz.K);
        if (hit?.npc) {SH.gotoTab('role', [hit.npc]); return;}
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
    cv.addEventListener('contextmenu', (e) => {
        if (!st.data) return;
        if (S.place) {e.preventDefault(); setPlace(null); return;}
        const hit = hitAt(st, toMap(e), st.pz.K);
        if (!hit?.role) return;
        S.pick = hit.role;
        redraw();
        renderRight();
        roleMenu(e, st, hit.it);
    });
    loadMapState(st).then(() => {
        if (!st.data) {msg.textContent = `讀不到地圖 ${name}`; msg.hidden = false;}
        else if (!view.set) PZ.center(view);
        st.updateTime?.();
        redraw();
        renderRight();
    });
    requestAnimationFrame(redraw);
    const placing = h('div', {class: 'placing', hidden: true});
    st.updatePlacing = () => {
        placing.hidden = !S.place;
        placing.textContent = S.place ? `放 ${S.place} 到「${layerLabel(st.data ? targetOn(st.data) : S.target)}」：點格子＝放一個、Shift＋點＝連放、右鍵／Esc＝結束` : '';
        if (!S.place) {st.ghost = null; cv.style.cursor = '';}
        redraw();
    };
    st.updatePlacing();
    return h('div', {class: 'mv'},
        h('div', {class: 'opts'}, h('span', {class: 'name'}, name),
            h('button', {type: 'button', title: '回世界總覽', onclick: () => selectMap(name)}, '總覽'),
            h('span', {class: 'help', title: '滾輪縮放、按住中鍵拖曳平移；點角色選取、拖曳移動、Del 刪除、右鍵選單；右欄調色盤點一個角色再點地圖放置；淡色圓點是作息 point（唯讀，點了跳到角色分頁）'}, '?')),
        placing,
        h('div', {class: 'cvbox'}, cv, tip, msg),
        h('div', {class: 'opts'}, SHOW.showMenu(redraw), PZ.zoomField(view), PZ.centerBtn(view, '整張地圖放回中央、倍率剛好裝滿畫布')),
        timeBar(st));
}

// 🕒 時間游標：勾了才畫具名 NPC；時間可打 HH:MM 或拖滑桿（10 分一格），記住
function timeBar(st)
{
    const chk = h('input', {type: 'checkbox', dataset: {k: 'timeOn'}, checked: S.timeOn, onchange: e => setTime(S.t, e.target.checked)});
    const inp = h('input', {class: 'num', size: 5, dataset: {k: 'timeT'}, value: hhmm(S.t), onchange: e => {const v = toMin(e.target.value); v === null ? (e.target.value = hhmm(S.t)) : setTime(v, true);}});
    const rng = h('input', {type: 'range', class: 'trange', min: 0, max: 1430, step: 10, value: S.t, dataset: {k: 'timeR'}, oninput: e => setTime(+e.target.value, true)});
    const cnt = h('span', {class: 'dim'});
    st.updateTime = () => {
        chk.checked = S.timeOn;
        if (document.activeElement !== inp) inp.value = hhmm(S.t);
        rng.value = S.t;
        cnt.textContent = S.timeOn ? `這張圖 ${(st.npcs ?? []).filter(x => x.at.kind === 'stay').length} 人${(st.npcs ?? []).some(x => x.at.kind === 'walk') ? `、${st.npcs.filter(x => x.at.kind === 'walk').length} 人走過來` : ''}` : '';
    };
    st.updateTime();
    return h('div', {class: 'opts timebar', title: '照 role.json 的作息（同遊戲 ScheduleManager）算具名 NPC 這個時刻在哪；淡的虛線框＝正走去那個點'},
        h('label', null, chk, '🕒 作息'), inp, rng, cnt);
}

const mapSt = () => document.querySelector('#view canvas')?.st;

function renderView()
{
    $('view').replaceChildren(...[S.sel ? mapEl(S.sel) : worldEl()].flat());
}

// ---------- 右鍵選單 ----------
const closeMenu = () => document.querySelector('.ctxmenu')?.remove();
addEventListener('pointerdown', (e) => {if (!e.target.closest?.('.ctxmenu')) closeMenu();});

function menu(e, items)
{
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    document.body.append(h('div', {class: 'ctxmenu', style: `left:${e.clientX}px;top:${e.clientY}px`},
        items.map(it => (it ? h('button', {type: 'button', disabled: !it[1], onclick: () => {closeMenu(); it[1]();}}, it[0]) : h('hr')))));
}

const layersOf = (d) => ['', ...d.map.layers.filter(l => l.type === 'objectgroup' && l.name.startsWith('@')).map(l => l.name)];
const layerLabel = (l) => l || '常駐';
// 角色實際所在的層算哪一組：@ 開頭＝那個群組，其他（roles、舊圖層）＝常駐
const groupOf = (layer) => (layer.startsWith('@') ? layer : '');

function roleMenu(e, st, it)
{
    const cur = groupOf(it.layer);
    menu(e, [
        ...layersOf(st.data).filter(l => l !== cur).map(l => [`移到「${layerLabel(l)}」`, () => act(setLayer(st.name, it, l))]),
        null,
        ['刪除（Del）', () => act(deleteRole(st.name, it))],
        [`↗ 到角色分頁看 ${it.rid}`, () => SH.gotoTab('role', [it.rid])],
    ]);
}

// ---------- 寫地圖、undo ----------
const tplOf = (rid) => S.tpls[rid] ?? null;
const isNamed = (rid) => S.roles[rid]?.kind === 'npc';
const NAMED_WARN = '⚠ 具名 NPC 是作息產生的，地圖上再放一個遊戲裡可能出現兩個';

const mapOfRel = (rel) => (rel.startsWith('maps/') ? rel.slice(5).replace(/\.json$/, '') : null);

// 寫完：地圖丟掉快取、重算徽章；story.json 重讀 spawns；每個檔都廣播（file＝相對 public/assets/json，地圖是 maps/…）
async function afterWrite(rels, text)
{
    const maps = rels.map(mapOfRel).filter(Boolean);
    for (const m of maps) MV.forget(m);
    for (const rel of rels) SH.notifySaved(rel.startsWith('json/') ? rel.slice(5) : rel);
    if (rels.includes(STORY)) await loadSpawns();
    await resummarize(maps);
    status(text);
    render();
}

const STORY = 'json/story.json';
// 改好幾個檔（rels：相對 assets；地圖用 ED.mapFile(名稱)）：fn({rel: data})；寫了記一筆 undo（map＝復原時切過去的地圖）
async function writeFiles(rels, fn, msg, warn = '', map = S.sel)
{
    let r;
    try {r = await ED.editFiles(S.assets.dir, rels, fn);}
    catch (e) {status(e.message); return false;}
    if (!r) return false;
    S.hist.length = S.hi;
    S.hist.push({map, files: r, msg});
    S.hi++;
    const where = r.map(f => f.rel.replace(/^json\//, '')).join('、');
    await afterWrite(r.map(f => f.rel), `${msg}：已寫入 ${where}${r.some(f => f.rel.startsWith('maps/')) ? '（Tiled 開著這張圖要重新載入）' : ''}${warn ? `　${warn}` : ''}`);
    return true;
}

// fn(data) 改一張地圖
const write = (map, fn, msg, warn = '') => writeFiles([ED.mapFile(map)], d => fn(d[ED.mapFile(map)]), msg, warn, map);

async function step(x, back)
{
    await ED.restore(S.assets.dir, x.files.map(f => ({rel: f.rel, expect: back ? f.after : f.before, text: back ? f.before : f.after})));
    S.hi += back ? -1 : 1;
    if (x.map && S.sel !== x.map) selectMap(x.map);
    await afterWrite(x.files.map(f => f.rel), `${back ? '復原' : '重做'}：${x.msg}`);
}
const undo = () => (S.hi ? step(S.hist[S.hi - 1], true) : null);
const redo = () => (S.hi < S.hist.length ? step(S.hist[S.hi], false) : null);

// 現在的目標層這張圖沒有（換了地圖）就回常駐
const targetOn = (d) => (layersOf(d).includes(S.target) ? S.target : '');

async function placeRole(map, rid, tile, keep)
{
    const st = mapSt(), target = targetOn(st.data);
    let id;
    const ok = await write(map, data => {id = ED.placeRole(data, map, target, rid, tile, S.roles[rid], tplOf(rid));},
        `放 ${rid} 到「${layerLabel(target)}」格 ${tile.join(',')}`, isNamed(rid) ? NAMED_WARN : '');
    if (!ok) return;
    S.pick = id;
    if (!keep) S.place = null;
    render();
}

const moveRole = (map, it, dx, dy) => write(map, data => ED.moveRole(data, it.o.id, dx, dy), `移動 ${it.rid}`);

async function deleteRole(map, it)
{
    if (await write(map, data => ED.deleteRole(data, it.o.id), `刪除 ${it.rid}`)) {S.pick = null; render();}
}

const setLayer = (map, it, layer) => write(map, data => ED.setLayer(data, it.o.id, layer), `${it.rid} 移到「${layerLabel(layer)}」`);

async function replaceRole(map, it, rid)
{
    if (!S.roles[rid] || rid === it.rid) return;
    await write(map, data => ED.replaceRole(data, map, it.o.id, rid, rootTile(mapSt().data, it), S.roles[rid], tplOf(rid)),
        `${it.rid} 換成 ${rid}`, isNamed(rid) ? NAMED_WARN : '');
}

const setProp = (map, it, name, type, value) => write(map, data => ED.setProp(data, it.o.id, name, type, value),
    value === undefined ? `${it.rid} 拿掉 ${name}` : `${it.rid} ${name}＝${value}`);

function setPlace(rid)
{
    S.place = S.place === rid ? null : rid;
    if (S.place) S.pick = null;
    const st = mapSt();
    if (S.place && st && !st.sprites.has(S.place)) spriteOf(S.place, refs()).then(sp => {st.sprites.set(S.place, sp); st.redraw();});
    st?.updatePlacing();
    renderRight();
}

// ---------- @群組（地圖任務） ----------
const GID_RE = /^[A-Za-z0-9_-]+$/;
const HIDE_KEY = 'tools.map.hide';
S.hide = new Set();         // 👁 關掉的群組（只影響工具畫面）
try {S.hide = new Set(JSON.parse(localStorage.getItem(HIDE_KEY)) ?? []);} catch {}
const LINE_KEY = 'tools.map.line';
const mapsWithGroup = (g) => S.maps.map(m => m.name).filter(n => S.sums[n]?.groups.includes(g));

function toggleHide(g)
{
    S.hide.has(g) ? S.hide.delete(g) : S.hide.add(g);
    try {localStorage.setItem(HIDE_KEY, JSON.stringify([...S.hide]));} catch {}
    const st = mapSt();
    if (st?.data) applyHide(st);
    renderRight();
    st?.redraw();
}

// 新增：沒宣告過＝選劇情線＋寫條件（地圖＋story.json 一起寫）；已經宣告過（別張圖在用）＝共用它的條件，只加圖層
async function newGroup()
{
    const map = S.sel, st = mapSt();
    if (!st?.data) return;
    let lastLine = null;
    try {lastLine = localStorage.getItem(LINE_KEY);} catch {}
    const name = h('input', {size: 20, placeholder: '英數字，例如 wolves'});
    const line = h('select', null, S.lines.map(l => h('option', {value: l, selected: l === lastLine}, l)));
    const cond = h('input', {class: 'expr', size: 34, placeholder: '出現條件，例如 wolf_hunt && wolf_hunt<9', dataset: {combo: 'dl-cond', expr: ''}});
    const hint = h('div', {class: 'hint'});
    const sync = () => {
        const sp = S.spawns[name.value.trim()];
        line.disabled = cond.disabled = !!sp;
        if (sp) {line.value = sp.line; cond.value = sp.cond;}
        hint.textContent = sp ? `已經有這個群組（${sp.line}，用在 ${mapsWithGroup(name.value.trim()).join('、') || '沒有地圖'}）：共用它的條件，只在這張圖加圖層`
            : '群組名稱全域唯一，也是存檔的命名空間；條件只在進地圖時判斷';
    };
    name.oninput = sync;
    sync();
    const p = ask(`在 ${map} 新增 @群組`, [h('div', {class: 'fields'},
        h('span', {class: 'k'}, '名稱'), h('span', null, '@', name),
        h('span', {class: 'k'}, '劇情線'), line,
        h('span', {class: 'k'}, '條件'), cond), hint], [['ok', '新增'], ['cancel', '取消']]);
    name.focus();
    if (await p !== 'ok') return;
    const g = name.value.trim(), sp = S.spawns[g];
    if (!GID_RE.test(g)) return status(`群組名稱只能用英數、- 和 _：${g}`);
    if (st.data.map.layers.some(l => l.name === `@${g}`)) return status(`${map} 已經有 @${g}`);
    if (!sp && !line.value) return status('story.json 沒有劇情線，先到任務分頁建一條');
    try {localStorage.setItem(LINE_KEY, line.value);} catch {}
    const mf = ED.mapFile(map);
    const ok = await writeFiles(sp ? [mf] : [mf, STORY], d => {
        ED.addGroupLayer(d[mf], g);
        if (!sp) (d[STORY].lines[line.value].spawns ??= {})[g] = cond.value.trim();
    }, sp ? `${map} 加 @${g}（共用 ${sp.line} 的條件）` : `新群組 @${g}（${line.value}）`);
    if (ok) {S.target = `@${g}`; renderRight(); mapSt()?.updatePlacing();}
}

async function setCond(g, cond)
{
    const sp = S.spawns[g];
    if (!sp || sp.cond === cond) return;
    await writeFiles([STORY], d => {d[STORY].lines[sp.line].spawns[g] = cond;}, `@${g} 的條件`);
}

// 改名：所有用到的地圖的 @圖層＋story.json 的 spawns key（存檔命名空間跟著換，舊存檔裡這組的狀態對不上）
async function renameGroup(from)
{
    const name = h('input', {size: 20, value: from});
    const used = mapsWithGroup(from);
    const p = ask(`改名 @${from}`, [h('div', {class: 'fields'}, h('span', {class: 'k'}, '新名稱'), h('span', null, '@', name)),
        h('div', {class: 'hint'}, `會一起改：${[...used.map(m => `maps/${m}.json`), S.spawns[from] && 'story.json'].filter(Boolean).join('、')}`),
        h('div', {class: 'warn'}, '⚠ 群組名稱也是存檔的命名空間：舊存檔裡這組的狀態（殺了幾隻、撿走什麼）會對不上，進地圖時當成全新的')],
        [['ok', '改名'], ['cancel', '取消']]);
    name.select();
    if (await p !== 'ok') return;
    const to = name.value.trim();
    if (to === from) return;
    if (!GID_RE.test(to)) return status(`群組名稱只能用英數、- 和 _：${to}`);
    if (S.spawns[to] || mapsWithGroup(to).length) return status(`已經有 @${to}`);
    const rels = [...used.map(ED.mapFile), ...(S.spawns[from] ? [STORY] : [])];
    const ok = await writeFiles(rels, d => {
        for (const m of used) ED.renameGroupLayer(d[ED.mapFile(m)], from, to);
        if (S.spawns[from]) ED.renameKey(d[STORY].lines[S.spawns[from].line].spawns, from, to);
    }, `@${from} 改名 @${to}`);
    if (!ok) return;
    if (S.target === `@${from}`) S.target = `@${to}`;
    if (S.hide.delete(from)) {S.hide.add(to); try {localStorage.setItem(HIDE_KEY, JSON.stringify([...S.hide]));} catch {}}
    render();
}

// 刪除：這張圖的圖層（連裡面的角色）；是最後一張用到的地圖就問要不要連 spawns 一起刪
async function deleteGroup(g)
{
    const map = S.sel, st = mapSt(), n = st.roles.filter(it => it.layer === `@${g}`).length;
    const others = mapsWithGroup(g).filter(m => m !== map), sp = S.spawns[g];
    const body = [h('div', null, `從 ${map} 刪掉 @${g} 圖層${n ? `，連同裡面 ${n} 個角色` : ''}`),
        others.length ? h('div', {class: 'hint'}, `${others.join('、')} 也在用，story.json 的條件留著`)
            : sp && h('div', {class: 'hint'}, `這是最後一張用到 @${g} 的地圖；story.json（${sp.line}）的條件也要刪嗎？`)];
    const btns = !others.length && sp ? [['all', '連條件一起刪'], ['layer', '只刪圖層'], ['cancel', '取消']] : [['layer', '刪除'], ['cancel', '取消']];
    const v = await ask(`刪除 @${g}？`, body, btns);
    if (v !== 'all' && v !== 'layer') return;
    const mf = ED.mapFile(map), withStory = v === 'all';
    const ok = await writeFiles(withStory ? [mf, STORY] : [mf], d => {
        ED.deleteGroupLayer(d[mf], g);
        if (withStory) delete d[STORY].lines[sp.line].spawns[g];
    }, `刪除 ${map} 的 @${g}${withStory ? '＋條件' : ''}`);
    if (ok && S.target === `@${g}`) {S.target = ''; renderRight();}
}

function groupMenu(e, g)
{
    menu(e, [['改名…', () => act(renameGroup(g))], ['刪除…', () => act(deleteGroup(g))],
        S.spawns[g] && [`↗ 到任務分頁（${S.spawns[g].line}）`, () => SH.gotoTab('story', [S.spawns[g].line, 'spawns', g])]].filter(Boolean));
}

// 👁 關掉的群組：角色不畫、點不到
function applyHide(st)
{
    st.roles = st.all.filter(it => !(it.layer.startsWith('@') && S.hide.has(it.layer.slice(1))));
}

// ---------- 右欄 ----------
function renderRight()
{
    const st = mapSt();
    if (!S.sel) {$('right').replaceChildren(); return;}
    if (!st?.data) return;      // 地圖還在讀（寫完重畫）：右欄先留著，讀完會再畫
    const d = st.data, target = targetOn(d);
    const count = (g) => st.all.filter(it => groupOf(it.layer) === g).length;
    const pickLayer = (l) => {S.target = l; renderRight(); st.updatePlacing();};
    const layerRows = layersOf(d).map(l => {
        if (!l) return h('div', {class: 'layer' + (l === target ? ' on' : ''), dataset: {layer: ''}, title: '點＝放角色放到這一層', onclick: () => pickLayer('')},
            h('div', {class: 'lhead'}, h('b', null, '常駐'), h('span', {class: 'dim'}, '（一直都在；寫在 roles 層）'), h('span', {class: 'n'}, String(count('')))));
        const g = l.slice(1), sp = S.spawns[g], hid = S.hide.has(g);
        const stop = (e) => e.stopPropagation();
        const cond = sp && h('input', {class: 'expr cond', placeholder: '（一直出現）', value: sp.cond, dataset: {combo: 'dl-cond', expr: '', k: `cond-${g}`},
            title: `story.json 的 ${sp.line}.spawns.${g}：只在進地圖時判斷`, onclick: stop,
            onchange: e => act(setCond(g, e.target.value.trim()))});
        return h('div', {class: 'layer grp' + (l === target ? ' on' : '') + (hid ? ' hid' : ''), dataset: {layer: l}, title: '點＝放角色放到這一層；右鍵＝改名／刪除',
            onclick: () => pickLayer(l), oncontextmenu: (e) => groupMenu(e, g)},
            h('div', {class: 'lhead'},
                h('button', {type: 'button', class: 'eye', title: hid ? '顯示這組（只影響工具畫面）' : '藏起這組（只影響工具畫面，預覽劇情不同階段）', dataset: {eye: g},
                    onclick: e => {stop(e); toggleHide(g);}}, hid ? '◌' : '👁'),
                h('b', null, l),
                sp ? h('a', {class: 'go', title: '到任務分頁', onclick: e => {stop(e); SH.gotoTab('story', [sp.line, 'spawns', g]);}}, `↗ ${sp.line}`)
                    : h('span', {class: 'warn'}, '⚠ story.json 沒宣告'),
                h('span', {class: 'n'}, String(count(l)))),
            cond, ...(sp?.errs ?? []).map(m => h('div', {class: 'warn small'}, `⚠ ${m}`)));
    });
    const roleRows = st.all.map(it => {
        const [tx, ty] = rootTile(d, it), hid = !st.roles.includes(it);
        return h('div', {class: 'r' + (S.pick === it.o.id ? ' sel' : '') + (hid ? ' hid' : ''), dataset: {oid: it.o.id},
            onclick: () => {S.pick = S.pick === it.o.id ? null : it.o.id; renderRight(); st.redraw();},
            oncontextmenu: (e) => roleMenu(e, st, it)},
            IC.iconEl(S.roles[it.rid]?.icon, 20), h('span', null, it.rid),
            st.issues?.has(it.o.id) && h('span', {class: 'warn', title: st.issues.get(it.o.id).map(x => x.msg).join('\n')}, '⚠'),
            h('span', {class: 'where'}, `${layerLabel(groupOf(it.layer))}・${tx},${ty}`));
    });
    const it = st.all.find(x => x.o.id === S.pick);
    $('right').replaceChildren(
        h('div', {class: 'sec'}, '圖層／群組 ', h('span', {class: 'dim'}, '（點一層＝放到這裡）')), ...layerRows,
        h('div', null, h('button', {type: 'button', class: 'newgrp', onclick: () => act(newGroup())}, '＋ 新群組（地圖任務）…')),
        paletteEl(),
        it && pickedEl(it, d),
        h('div', {class: 'sec'}, '角色 ', h('span', {class: 'dim'}, `（${st.all.length}）`)),
        h('div', {class: 'roles'}, roleRows.length ? roleRows : h('div', {class: 'dim'}, '這張地圖沒有角色')));
}

const KIND_TABS = [['all', '全部'], ['animal', '動物'], ['monster', '怪物'], ['boss', '首領'], ['rogue', '土匪'], ['npc', 'NPC'], ['', '其他']];
const placeable = () => Object.keys(S.roles).filter(rid => S.roles[rid]?.kind !== 'player');
const kindKey = (rid) => (KIND_TABS.some(([k]) => k && k === S.roles[rid].kind) ? S.roles[rid].kind : '');

function paletteEl()
{
    const q = S.psearch.trim().toLowerCase();
    const all = placeable(), tabs = KIND_TABS.filter(([k]) => k === 'all' || all.some(rid => kindKey(rid) === k));
    if (!tabs.some(([k]) => k === S.kindTab)) S.kindTab = 'all';
    const list = all.filter(rid => (S.kindTab === 'all' || kindKey(rid) === S.kindTab)
        && (!q || rid.toLowerCase().includes(q) || String(S.roles[rid].lab ?? '').toLowerCase().includes(q)));
    const search = h('input', {class: 'psearch', placeholder: '搜尋角色', value: S.psearch,
        oninput: e => {S.psearch = e.target.value; const p = e.target.selectionStart; renderRight(); const n = document.querySelector('#right .psearch'); n.focus(); n.setSelectionRange(p, p);}});
    return h('div', {class: 'palette'},
        h('div', {class: 'sec'}, '放角色 ', h('span', {class: 'dim'}, S.place ? `（放 ${S.place} 中，右鍵／Esc 結束）` : '（點一個，再點地圖）')),
        h('div', {class: 'ktabs'}, tabs.map(([k, t]) => h('button', {type: 'button', class: k === S.kindTab ? 'on' : '', dataset: {kind: k},
            onclick: () => {S.kindTab = k; try {localStorage.setItem(KIND_KEY, k);} catch {} renderRight();}}, t))),
        search,
        h('div', {class: 'pcells'}, list.map(rid => h('div', {class: 'pcell' + (rid === S.place ? ' on' : ''), dataset: {rid},
            title: `${rid}${S.roles[rid].lab ? ` ${S.roles[rid].lab}` : ''}${S.tpls[rid] ? `\ntemplate：${S.tpls[rid].path}` : '\n沒有 template，寫成點物件'}${isNamed(rid) ? `\n${NAMED_WARN}` : ''}`,
            onclick: () => setPlace(rid)},
            IC.iconEl(S.roles[rid].icon, 32), h('span', {class: 'k'}, rid), isNamed(rid) && h('span', {class: 'warn mark'}, '⚠')))));
}

const PTYPES = ['string', 'int', 'float', 'bool'];
const parseProp = (type, v) => (type === 'int' ? parseInt(v, 10) : type === 'float' ? parseFloat(v) : type === 'bool' ? v === 'true' : v);
const propOk = (type, v) => (type === 'int' || type === 'float' ? Number.isFinite(v) : true);

function pickedEl(it, d)
{
    const map = mapSt().name, r = S.roles[it.rid], raw = it.o.raw, [tx, ty] = rootTile(d, it);
    const fmt = raw.template ? `template ${raw.template.split('/').at(-1)}` : raw.gid != null ? '圖塊物件' : '點物件';
    const own = (raw.properties ?? []).filter(p => p.name !== 'id');
    const tplProps = Object.entries(it.o.props).filter(([k]) => k !== 'id' && !own.some(p => p.name === k));
    const idSel = h('select', {dataset: {k: 'rid'}, onchange: e => act(replaceRole(map, it, e.target.value))},
        !S.roles[it.rid] && h('option', {value: it.rid, selected: true}, `${it.rid}（role.json 沒有）`),
        placeable().map(rid => h('option', {value: rid, selected: rid === it.rid}, `${rid}${S.roles[rid].lab ? ` ${S.roles[rid].lab}` : ''}`)));
    const resp = own.find(p => p.name === 'respawn') ?? (it.o.props.respawn != null ? {value: it.o.props.respawn, tpl: true} : null);
    const respIn = h('input', {type: 'number', class: 'num', min: 0, step: 1, value: resp?.value ?? '', placeholder: '不重生', dataset: {k: 'respawn'},
        title: '被殺之後隔多少遊戲分鐘重生，空白＝不重生（gameobject.js）',
        onchange: e => {
            const v = e.target.value.trim();
            act(setProp(map, it, 'respawn', 'int', v === '' ? undefined : parseInt(v, 10)));
        }});
    const propRow = (p) => h('tr', {dataset: {prop: p.name}}, h('td', {class: 'k'}, p.name),
        h('td', null, h('input', {class: 'pv', value: String(p.value), title: p.type ?? 'string',
            onchange: e => {
                const v = parseProp(p.type ?? 'string', e.target.value);
                if (!propOk(p.type, v)) {status(`${p.name} 要是數字`); e.target.value = String(p.value); return;}
                act(setProp(map, it, p.name, p.type ?? 'string', v));
            }}),
            h('button', {type: 'button', class: 'del', title: '拿掉這個屬性', onclick: () => act(setProp(map, it, p.name, p.type ?? 'string', undefined))}, '✕')));
    const nName = h('input', {class: 'pn', placeholder: '名稱', size: 8}), nType = h('select', null, PTYPES.map(t => h('option', {value: t}, t)));
    const nVal = h('input', {class: 'pv', placeholder: '值', size: 8});
    const addProp = () => {
        const n = nName.value.trim(), v = parseProp(nType.value, nVal.value);
        if (!n || n === 'id') return status('屬性名稱不能空白，也不能是 id（換角色用上面的下拉）');
        if (!propOk(nType.value, v)) return status(`${n} 要是數字`);
        act(setProp(map, it, n, nType.value, v));
    };
    return h('div', {class: 'picked'},
        h('div', {class: 'sec'}, '選取的角色 ', h('a', {class: 'go', title: '到角色分頁', onclick: () => SH.gotoTab('role', [it.rid])}, `↗ ${it.rid}`)),
        h('table', null,
            h('tr', null, h('td', {class: 'k'}, '角色'), h('td', null, idSel,
                (mapSt().issues?.get(it.o.id) ?? []).map(x => h('div', {class: 'warn issue'}, `⚠ ${x.msg}`)))),
            r && h('tr', null, h('td', {class: 'k'}, '種類'), h('td', null, KIND[r.kind] ?? r.kind ?? '')),
            h('tr', null, h('td', {class: 'k'}, '圖層'), h('td', null, h('select', {dataset: {k: 'layer'}, onchange: e => act(setLayer(map, it, e.target.value))},
                layersOf(d).map(l => h('option', {value: l, selected: l === groupOf(it.layer)}, layerLabel(l)))),
                groupOf(it.layer) !== it.layer && it.layer !== ED.ROLES_LAYER && h('span', {class: 'dim'}, ` 在 ${it.layer} 層`))),
            h('tr', null, h('td', {class: 'k'}, '站的格子'), h('td', null, `${tx}, ${ty}`, h('span', {class: 'dim'}, '（拖曳移動）'))),
            h('tr', null, h('td', {class: 'k'}, '格式'), h('td', null, fmt, h('span', {class: 'dim'}, `　物件 id ${it.o.id}`))),
            h('tr', null, h('td', {class: 'k'}, '重生（分）'), h('td', null, respIn, resp?.tpl && h('span', {class: 'dim'}, ' template 的'))),
            ...own.filter(p => p.name !== 'respawn').map(propRow),
            ...tplProps.filter(([k]) => k !== 'respawn').map(([k, v]) => h('tr', {class: 'dim'}, h('td', {class: 'k'}, k), h('td', null, `${v}（template 的）`))),
            h('tr', null, h('td', {class: 'k'}, '加屬性'), h('td', {class: 'addprop'}, nName, nType, nVal, h('button', {type: 'button', onclick: addProp}, '加')))),
        h('div', {class: 'acts'}, h('button', {type: 'button', class: 'danger', onclick: () => act(deleteRole(map, it))}, '刪除（Del）')));
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
const act = (p) => Promise.resolve(p).catch(e => status(e.message));
$('btnUndo').onclick = () => act(undo());
$('btnRedo').onclick = () => act(redo());
const TYPING = 'input:not([type=checkbox]), textarea, select';
addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {closeMenu(); if (S.place) setPlace(null); return;}
    if (e.target.matches?.(TYPING)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) {e.preventDefault(); act(undo());}
    else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) {e.preventDefault(); act(redo());}
    else if (e.key === 'Delete' && S.pick != null)
    {
        const st = mapSt(), it = st?.all.find(x => x.o.id === S.pick);
        if (it) {e.preventDefault(); act(deleteRole(st.name, it));}
    }
});
SH.onSaved((file) => {
    if (!S.assets) return;
    if (file === 'role.json') act(loadRefs().then(() => resummarize(S.maps.map(m => m.name))).then(render));
    else if (['item.json', 'part.json'].includes(file)) act(loadRefs().then(render));
    else if (file === 'story.json') act(loadSpawns().then(renderRight));
    // template 改了（角色分頁改名）：快取全丟、整個重讀
    else if (file?.startsWith('templates/')) {tplCache.clear(); MV.forget(); act(reload());}
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
window.__mt = {S, setRoot, reload, render, selectMap, mapSt, setPlace, placeRole, moveRole, deleteRole, setLayer, replaceRole, setProp, undo, redo, newGroup, setCond, renameGroup, deleteGroup, toggleHide, setTime, MV, PZ, ED};
