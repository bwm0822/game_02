import DB from '../data/db.js'
import {route} from '../data/schedplan.js'

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

    static _dijkstra(from, to) {return route(DB.navgraph()?.edges ?? {}, from, to);}
}
