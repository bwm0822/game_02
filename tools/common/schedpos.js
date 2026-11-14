// 作息時間游標：具名 NPC 某個時刻實際在哪、畫在地圖上（地圖分頁、角色分頁作息地圖共用）
import {h} from './dom.js';
import {edgeCost, mod, hhmm, patrolAt} from '../../src/data/schedplan.js';
import {bestPath} from '../../src/data/navgrid.js';
import {whereAt} from '../role/schedbar.js';
import {spotOf, gridOf} from './mapview.js';
import {SPRITE_HALF} from '../map/roles.js';

const keyMap = (k) => k.slice(0, k.indexOf(':')), keyName = (k) => k.slice(k.indexOf(':') + 1);

// p＝{plan, sch, segs}（buildPlan＋daySegs）；時刻 t 實際在哪（同遊戲：走路照 buildPlan 的路線、每段 edgeCost 分；巡邏照 patrolAt）
// {at（whereAt）, map, a, b, e, c}：在 map 這張圖的點 a（b＝正從 a 走往 b，走了 e／共 c 分；沒有＝站在 a）；穿過 port 那一分鐘算還在 a
export function posOf(p, t, edges)
{
    const at = whereAt(p.plan, p.sch, t, p.segs);
    if (!at) return null;
    const q = p.plan[at.i], s = p.sch[at.i];
    const stand = (map, a) => ({at, map, a, b: null, e: 0, c: 0});
    if (at.kind === 'walk')
    {
        const keys = [q.from, ...(q.path ?? [])];
        let e = mod(t - q.dep);
        for (let i = 1; i < keys.length; i++)
        {
            const a = keys[i - 1], b = keys[i], c = edgeCost(edges, a, b);
            if (e >= c) {e -= c; continue;}
            return keyMap(a) === keyMap(b) ? {at, map: keyMap(a), a: keyName(a), b: keyName(b), e, c} : stand(keyMap(a), keyName(a));
        }
        return stand(at.map, at.go);
    }
    if (s?.do === 'patrol')
    {
        const r = patrolAt(s, mod(t - q.arr), (a, b) => edgeCost(edges, `${s.map}:${a}`, `${s.map}:${b}`));
        if (r?.kind === 'walk') return {at, map: s.map, a: r.a, b: r.b, e: r.e, c: r.c};
        if (r) return stand(s.map, r.a);
    }
    return stand(at.map, at.go);
}

// 地圖 d 上 a 走往 b 走了 e 分的那一格中心（A* 格子路徑照比例取，快取在 cache.walks）；走不到＝兩點直線內插
export function walkCen(cache, d, pos)
{
    const a = spotOf(d, pos.a), b = spotOf(d, pos.b);
    if (!a || !b) return null;
    if (cache.walks?.data !== d) cache.walks = {data: d, map: new Map()};
    const key = `${pos.a}>${pos.b}`;
    let path = cache.walks.map.get(key);
    if (path === undefined)
    {
        path = null;
        for (const sp of a.tiles ?? [])
        {
            const ps = bestPath(gridOf(d), sp, b.tiles ?? []);
            if (ps && (!path || ps.length + 1 < path.length)) path = [sp, ...ps];
        }
        cache.walks.map.set(key, path);
    }
    const f = pos.c > 0 ? Math.min(1, pos.e / pos.c) : 0;
    if (!path?.length) return {x: a.cen.x + (b.cen.x - a.cen.x) * f, y: a.cen.y + (b.cen.y - a.cen.y) * f};
    const [tx, ty] = path[Math.round(f * (path.length - 1))], tw = d.map.tilewidth, th = d.map.tileheight;
    return {x: (tx + 0.5) * tw, y: (ty + 0.5) * th};
}

// plans＝{id: {plan, sch, segs}}；此刻實際在地圖 d（名稱 name）上的人：[{id, at, pos, n（站的點；走路中 cen＝路上那格）, k（同一點第幾個）}]
export function npcsOn(cache, d, name, plans, t, edges)
{
    const out = [];
    for (const [id, p] of Object.entries(plans ?? {}))
    {
        const pos = posOf(p, t, edges);
        if (!pos || pos.map !== name) continue;
        const n = spotOf(d, pos.a);
        if (!n) continue;
        const cen = pos.b ? walkCen(cache, d, pos) : null;
        out.push({id, at: pos.at, pos, n: cen ? {...n, cen} : n, spot: cen ? `${cen.x},${cen.y}` : n.name});
    }
    const slot = new Map();
    for (const x of out) {const k = slot.get(x.spot) ?? 0; slot.set(x.spot, k + 1); x.k = k;}
    return out;
}

// 站的位置（point 中心＝站的格子；走路中＝路上那格）減角色錨點，同一點好幾個往右排開 24px
export function npcCen(x, roles)
{
    const a = roles?.[x.id]?.anchor;
    return {x: x.n.cen.x - (a?.x ?? 0) + x.k * 24, y: x.n.cen.y - (a?.y ?? 0)};
}

// 滑鼠 p 底下的那個（框照角色 w/h）
export function npcAt(npcs, p, roles)
{
    for (const x of npcs ?? [])
    {
        const c = npcCen(x, roles), r = roles?.[x.id];
        if (Math.abs(p.x - c.x) <= (r?.w ?? 32) / 2 && Math.abs(p.y - c.y) <= (r?.h ?? 64) / 2) return x;
    }
    return null;
}

const BLUE = {line: '#4fc3f7', tag: 'rgba(20,60,90,0.9)'}, ORANGE = {line: '#ff9f43', tag: 'rgba(120,60,10,0.92)'};

// 畫：角色圖 0.8 不透明＋框（走路中虛線、標籤「id → 目的地」），下面名字；opt.sprites＝Map id → canvas、opt.hover＝滑過的 id、opt.mine＝橘色的 id
export function drawNpcs(g, K, npcs, roles, {sprites = new Map(), hover = null, mine = null} = {})
{
    for (const x of npcs ?? [])
    {
        const c = npcCen(x, roles), sp = sprites.get(x.id), r = roles?.[x.id], col = x.id === mine ? ORANGE : BLUE;
        g.globalAlpha = 0.8;
        if (sp) g.drawImage(sp, c.x - SPRITE_HALF, c.y - SPRITE_HALF);
        g.globalAlpha = 1;
        const on = hover === x.id;
        g.setLineDash(x.at.kind === 'walk' ? [4 / K, 3 / K] : []);
        g.strokeStyle = on ? '#fff' : col.line;
        g.lineWidth = (on ? 2 : 1) / K;
        g.strokeRect(c.x - (r?.w ?? 32) / 2, c.y - (r?.h ?? 64) / 2, r?.w ?? 32, r?.h ?? 64);
        g.setLineDash([]);
        const txt = x.at.kind === 'walk' ? `${x.id} → ${x.at.go}` : x.id;
        g.font = `${12 / K}px sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const tw = g.measureText(txt).width + 6 / K, ty = c.y + (r?.h ?? 64) / 2 + 8 / K;
        g.fillStyle = col.tag;
        g.fillRect(c.x - tw / 2, ty - 7 / K, tw, 14 / K);
        g.fillStyle = '#fff';
        g.fillText(txt, c.x, ty);
        g.textBaseline = 'alphabetic';
    }
}

// 時間軸 `[☐ 🕒 作息] [HH:MM] [══滑桿══]`（.timebar）：get()＝{t, on}、set(t, on)；k＝data-k 前綴（地圖分頁 'time'）；el.update()＝照 get() 重畫
const toMin = (s) => {const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;};
export function timeBarEl(get, set, {k = 'time', title = '', extra = null} = {})
{
    const chk = h('input', {type: 'checkbox', dataset: {k: `${k}On`}, checked: get().on, onchange: e => set(get().t, e.target.checked)});
    const inp = h('input', {class: 'num', size: 5, dataset: {k: `${k}T`}, value: hhmm(get().t), title: '↑↓＝±1 分（←→ 在這裡移游標；焦點在別處時 ←→＝整 10 分）',
        onchange: e => {const v = toMin(e.target.value); v === null ? (e.target.value = hhmm(get().t)) : set(v, true);}});
    const rng = h('input', {type: 'range', class: 'trange', min: 0, max: 1430, step: 10, value: get().t, dataset: {k: `${k}R`}, title: '拖＝10 分一格、←→＝上／下一個整 10 分、↑↓＝±1 分',
        oninput: e => set(+e.target.value, true)});
    const el = h('span', {class: 'timebar', title}, h('label', null, chk, '🕒 作息'), inp, rng, extra);
    el.update = () => {
        const {t, on} = get();
        chk.checked = on;
        if (document.activeElement !== inp) inp.value = hhmm(t);
        rng.value = t;
    };
    return el;
}

// 方向鍵調時間：↑↓＝±1 分；←→＝上一個／下一個整 10 分（已經整 10 分＝±10）；Shift 沒作用；HH:MM 欄（data-k 以 timeT 結尾）裡 ←→ 不處理（移文字游標）
// 回傳新的時間（分，可能超出 0～1439，呼叫端 mod）；不處理＝null
export function stepKey(e, t)
{
    const inp = /timeT$/.test(e.target?.dataset?.k ?? '');
    return e.key === 'ArrowUp' ? t + 1 : e.key === 'ArrowDown' ? t - 1
        : inp ? null : e.key === 'ArrowRight' ? (Math.floor(t / 10) + 1) * 10 : e.key === 'ArrowLeft' ? (Math.ceil(t / 10) - 1) * 10 : null;
}
