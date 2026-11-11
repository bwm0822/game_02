// 作息的路線／時刻表（純函式）：遊戲的 NavGraph／ScheduleManager 跟角色分頁的作息地圖共用，算法改這裡
// edges＝navgraph.json 的 edges（{key: [{to, cost, type}]}），時間都是一天內的分鐘（0～1439）

export const DAY = 1440;
export const mod = (m) => ((m % DAY) + DAY) % DAY;
export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = (s) => {const [h, m] = s.split(':'); return parseInt(h, 10) * 60 + parseInt(m, 10);};

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
// 回傳 {plan, warns}：plan＝null（資料有問題，遊戲不排）或 [{key, dep, arr, cost, from, path, do}]（path 不含起點 from，走不到＝null）
// warns＝[{i, kind, msg}]，kind：node／patrol／route（走不到）／late（排不下，late＝差幾分鐘）
export function buildPlan(sch, edges, nodes)
{
    const n = sch.length, warns = [];
    const keys = sch.map(s=>`${s.map}:${s.go}`);
    const bad = keys.filter(k=>!nodes[k]);
    if(bad.length) {warns.push({kind:'node', msg:`作息目的地不在路網裡：${bad.join(', ')}`, keys:bad}); return {plan:null, warns};}
    for(const s of sch.filter(s=>s.do==='patrol'))
    {
        const rt = (s.route ?? []).map(name=>`${s.map}:${name}`);
        if(!rt.length) {warns.push({kind:'patrol', msg:'巡邏沒有 route'}); return {plan:null, warns};}
        const broken = rt.filter((k,i)=>edgeCost(edges, k, rt[(i+1)%rt.length])===Infinity && k!==rt[(i+1)%rt.length]);
        if(broken.length) {warns.push({kind:'patrol', msg:`巡邏路點不在路網裡或走不到下一點：${broken.join(', ')}`}); return {plan:null, warns};}
    }

    const plan = sch.map((s,i)=>{
        const arrive = s.t.startsWith('@');
        const m = toMin(arrive ? s.t.slice(1) : s.t);
        const from = keys[(i-1+n)%n];
        const r = route(edges, from, keys[i]);
        if(!r) {warns.push({i, kind:'route', msg:`從 ${from} 走不到 ${keys[i]}`});}
        const cost = r?.cost ?? 0;
        return {key:keys[i], dep:arrive ? mod(m-cost) : m, arr:arrive ? m : mod(m+cost), cost, from, path:r?.path ?? null, do:s.do};
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
