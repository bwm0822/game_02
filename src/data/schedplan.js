// 作息的路線／時刻表（純函式）：遊戲的 NavGraph／ScheduleManager 跟角色分頁的作息地圖共用，算法改這裡
// edges＝navgraph.json 的 edges（{key: [{to, cost, type}]}），時間都是一天內的分鐘（0～1439）

export const DAY = 1440;
export const mod = (m) => ((m % DAY) + DAY) % DAY;
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => {const [h, m] = s.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10);};

// 作息目的地的路網 key：go＝具名物件 "地圖:名稱"；at:[tx,ty]＝地圖上的格子 "地圖:@tx,ty"
export const atName = (at) => `@${at[0]},${at[1]}`;
export const destOf = (s) => (s?.at ? atName(s.at) : s?.go);
export const schKey = (s) => `${s.map}:${destOf(s)}`;
export const parseAt = (name) => {const m = /^@(-?\d+),(-?\d+)$/.exec(name ?? ''); return m ? [+m[1], +m[2]] : null;};

// 巡邏模式：oneway 單向／back1 一次原路來回／back 多次原路來回／loop1 一次循環／loop 多次循環（預設）；多次＝重複到這筆作息結束
export const PATROL_MODES = ['oneway', 'back1', 'back', 'loop1', 'loop'];
export const patrolMode = (s) => (PATROL_MODES.includes(s?.mode) ? s.mode : 'loop');

// 巡邏實際依序經過的路點名稱：{pts, repeat}；repeat＝最後一點接回 pts[0] 一直繞，否則走到 pts 最後一點停住
// 原路來回折返點只經過一次（p1 p2 p3 p2 …）；一次的模式最後補回 p1
export function patrolTrip(s)
{
    const rt = (s?.route ?? []).filter(Boolean), m = patrolMode(s);
    const back = rt.length > 1 && (m === 'back' || m === 'back1') ? [...rt, ...rt.slice(1, -1).reverse()] : rt;
    if (m === 'loop' || m === 'back') return {pts: back, repeat: true};
    if (m === 'oneway' || rt.length < 2) return {pts: rt, repeat: false};
    return {pts: [...back, rt[0]], repeat: false};
}

// 有終點的巡邏（一次／單向）跑完停在哪個路點（名稱）；多次的回傳 null（停在哪說不準，照舊從入口算）
export function patrolEnd(s)
{
    if (s?.do !== 'patrol') return null;
    const {pts, repeat} = patrolTrip(s);
    return repeat ? null : pts.at(-1) ?? null;
}

// 這筆作息結束後從哪個節點出發去下一筆：有終點的巡邏＝終點，其他＝目的地
export const endKey = (s) => {const e = patrolEnd(s); return e ? `${s.map}:${e}` : schKey(s);};

// 巡邏要走的每一段 [a, b]（名稱，a≠b）
export function patrolLegs(s)
{
    const {pts, repeat} = patrolTrip(s), out = [];
    const n = pts.length;
    for (let i = 0; i < (repeat ? n : n - 1); i++)
    {
        const a = pts[i], b = pts[(i + 1) % n];
        if (a !== b) out.push([a, b]);
    }
    return out;
}

// 最短路線：{path:[不含起點的節點...], cost}，到不了回傳 null
export function route(edges, from, to)
{
    if(from===to) {return {path:[], cost:0};}
    const dist = {[from]:0};
    const prev = {};
    const open = new Set([from]);

    while(open.size)
    {
        let cur = null;
        for(const k of open) {if(cur===null || dist[k]<dist[cur]) {cur=k;}}
        open.delete(cur);
        if(cur===to) {break;}
        for(const e of edges[cur] ?? [])
        {
            const d = dist[cur] + e.cost;
            if(d < (dist[e.to] ?? Infinity)) {dist[e.to]=d; prev[e.to]=cur; open.add(e.to);}
        }
    }

    if(dist[to]===undefined) {return null;}
    const path = [];
    for(let k=to; k!==from; k=prev[k]) {path.unshift(k);}
    return {path, cost:dist[to]};
}

export const edgeCost = (edges, from, to) => edges[from]?.find(e=>e.to===to)?.cost ?? Infinity;

// 作息 → 時刻表；"@HH:MM" 是抵達時間，用上一筆目的地走過來的花費倒推
// 回傳 {plan, warns}：plan＝null（資料有問題，遊戲不排）或 [{key, end, dep, arr, cost, from, path, do}]（path 不含起點 from，走不到＝null；from＝上一筆的 endKey()）
// warns＝[{i, kind, msg}]，kind：node／patrol／route（走不到）／late（排不下，late＝差幾分鐘）
export function buildPlan(sch, edges, nodes)
{
    const n = sch.length, warns = [];
    const keys = sch.map(schKey);
    const bad = keys.filter(k=>!nodes[k]);
    if(bad.length) {warns.push({kind:'node', msg:`作息目的地不在路網裡：${bad.join(', ')}`, keys:bad}); return {plan:null, warns};}
    for(const s of sch.filter(s=>s.do==='patrol'))
    {
        if(!(s.route ?? []).length) {warns.push({kind:'patrol', msg:'巡邏沒有 route'}); return {plan:null, warns};}
        const k = (name)=>`${s.map}:${name}`;
        const broken = patrolLegs(s).filter(([a,b])=>edgeCost(edges, k(a), k(b))===Infinity).map(([a])=>k(a));
        if(broken.length) {warns.push({kind:'patrol', msg:`巡邏路點不在路網裡或走不到下一點：${broken.join(', ')}`}); return {plan:null, warns};}
        const end = patrolEnd(s);
        if(end && !nodes[k(end)]) {warns.push({kind:'patrol', msg:`巡邏終點不在路網裡：${k(end)}`}); return {plan:null, warns};}
    }

    const plan = sch.map((s,i)=>{
        const arrive = s.t.startsWith('@');
        const m = toMin(arrive ? s.t.slice(1) : s.t);
        const from = endKey(sch[(i-1+n)%n]);
        const r = route(edges, from, keys[i]);
        if(!r) {warns.push({i, kind:'route', msg:`從 ${from} 走不到 ${keys[i]}`});}
        const cost = r?.cost ?? 0;
        return {key:keys[i], end:endKey(s), dep:arrive ? mod(m-cost) : m, arr:arrive ? m : mod(m+cost), cost, from, path:r?.path ?? null, do:s.do};
    });

    plan.forEach((p,i)=>{
        const pre = plan[(i-1+n)%n];
        const late = mod(pre.arr-pre.dep) - mod(p.dep-pre.dep);
        if(n>1 && late>0)
        {
            warns.push({i, kind:'late', late, msg:`第 ${i} 筆作息排不下：要在 ${hhmm(p.dep)} 出發，但上一筆 ${hhmm(pre.arr)} 才到 ${pre.key}`});
        }
    });

    return {plan, warns};
}
