

// 簡單說：在這個 Evt 事件匯流排裡——
// Map 用來把「事件名稱 → 監聽者集合」對起來。
// map.get(k) 就拿到這個事件 k 的所有監聽函式集合。
// Set 用來存「不重複」的監聽函式。
// 它自動去重（同一個函式加兩次也只會有一份），而且增刪查都很快。

// 為何不用物件 + 陣列？
// Map vs 物件 {}
// Map 的 key 可以是任何型別（字串、Symbol、甚至物件），不會跟原型上的屬性衝突。
// 頻繁增刪鍵值時，Map 效能與語意都更直覺（set/get/has/delete）。

// Set vs 陣列 []
// Set 天然去重，不用自己檢查是否已經註冊過相同監聽。
// Set.delete(fn) 是平均 O(1)；陣列要先 indexOf 再 splice，通常 O(n)。


// 迷你事件中心
export class Evt 
{
    constructor(){ this.map = new Map(); }
    on(k, f) { if(!this.map.has(k)) this.map.set(k,new Set()); this.map.get(k).add(f); }
    off(k, f) { this.map.get(k)?.delete(f); }
    emit(k, ...a) 
    {
        let ret; 
        this.map.get(k)?.forEach(fn=>ret=fn(...a));
        return ret;
    }
    async aEmit(k, ...a) 
    {
        let promises=[];
        this.map.get(k)?.forEach(fn=>promises.push(fn(...a)));
        return Promise.all(promises);
    }
}
