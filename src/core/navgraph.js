import DB from '../data/db.js'

//--------------------------------------------------
// 跨地圖路網查詢(資料由 scripts/navgraph.js 產生)
// 節點 key = "地圖:物件名稱"，例如 "m_04x05/trump-inn-f1:door"
//--------------------------------------------------
export default class NavGraph
{
    static _routes = new Map();

    static mapOf(key) {return key.slice(0, key.indexOf(':'));}
    static nameOf(key) {return key.slice(key.indexOf(':')+1);}
    static has(key) {return !!DB.navgraph()?.nodes[key];}

    // 相鄰兩節點的花費(分鐘)，不相鄰回傳 Infinity
    static cost(from, to) {return DB.navgraph()?.edges[from]?.find(e=>e.to===to)?.cost ?? Infinity;}

    // 最短路線：{path:[不含起點的節點...], cost}，到不了回傳 null
    static route(from, to)
    {
        const id = `${from}>${to}`;
        if(!this._routes.has(id)) {this._routes.set(id, this._dijkstra(from, to));}
        const r = this._routes.get(id);
        return r && {path:[...r.path], cost:r.cost};
    }

    static _dijkstra(from, to)
    {
        if(from===to) {return {path:[], cost:0};}
        const edges = DB.navgraph()?.edges ?? {};
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
}
