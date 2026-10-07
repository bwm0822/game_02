import Record from '../infra/record.js'
import DB from '../data/db.js'
import {T,dlog} from '../core/debug.js'

//--------------------------------------------------
// quality 庫：唯一的劇情狀態（Record.game.q），設計見 docs/story-architecture.md §2
//  - 名稱一律用完整名稱存取（karen.好感、狼患），resolve() 負責把 _xxx / scope=npc 的短名稱補上 NPC 前綴
//  - 值等於宣告的 default 時直接刪掉，不存在就回傳 default（沒宣告的是 0）
//--------------------------------------------------
export default class Quality
{
    static _listeners = [];

    static get store() {return Record.game.q ??= {};}

    static resolve(name, npc)
    {
        if(name.includes('.')) {return name;}
        if(name.startsWith('_') || this.decl(name)?.scope === 'npc')
        {
            if(npc) {return `${npc}.${name}`;}
            dlog(T.WARN)(`[Q] ${name} 需要 NPC 前綴，但目前沒有 NPC 情境`);
        }
        return name;
    }

    static decl(full)
    {
        const qs = DB.qualities();
        if(qs[full]) {return qs[full];}
        const dot = full.indexOf('.');
        if(dot > 0)
        {
            const sub = qs[full.slice(dot+1)];
            if(sub?.scope === 'npc') {return sub;}
            return qs[`${full.slice(0,dot)}.*`];
        }
        return undefined;
    }

    static default(full) {return this.decl(full)?.default ?? 0;}

    static get(full) {return this.store[full] ?? this.default(full);}

    static set(full, v)
    {
        const old = this.get(full);
        if(v === this.default(full)) {delete this.store[full];}
        else {this.store[full] = v;}
        if(old === v) {return;}
        dlog(T.STORY)(`[Q] ${full}: ${old} → ${v}`);
        this._listeners.forEach(fn=>fn(full, v, old));
    }

    static add(full, n) {this.set(full, Number(this.get(full)) + n);}

    static onChange(fn) {this._listeners.push(fn);}
}
