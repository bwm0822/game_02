import TimeSystem from '../systems/time.js'
import DB from '../data/db.js'
import Record from '../infra/record.js'
import NavGraph from '../core/navgraph.js'
import {Npc} from '../roles/npc.js'
import {T,dlog} from '../core/debug.js'

const DAY = 1440;
const mod = (m)=>((m % DAY) + DAY) % DAY;

//--------------------------------------------------
// 所有有作息 NPC 的「抽象狀態」(存在 Record.game.schedule[id])：
//  { i:目前執行的作息, node:最後到達的節點, path:[剩下要經過的節點], eta:到達 path[0] 的時間,
//    due:下一筆作息的出發時間, pos?:途中交棒的位置, t:最後處理的時間, dead? }
// 時間都是絕對分鐘(TimeSystem.toTotalMinutes)
// NPC 在玩家所在地圖有實體時，移動由實體(COM_Schedule)推進；沒有實體時由這裡依 eta 推進
//--------------------------------------------------
export default class ScheduleManager
{
    static scene;
    static plans = {};      // id -> [{key, dep, arr, do}]，dep/arr 是一天中的分鐘

    static get now() {return TimeSystem.toTotalMinutes(TimeSystem.time);}

    static init(scene)
    {
        this.scene = scene;
        this.plans = {};
        if(!Record.game.schedule) {Record.game.schedule = {};}

        for(const id of DB.roleIds())
        {
            const sch = DB.role(id).schedule;
            if(!sch?.length) {continue;}
            const plan = this._buildPlan(id, sch);
            if(plan) {this.plans[id] = plan;}
        }

        dlog(T.SCH)('---------------------- init', this.plans);
        this.update();
    }

    static update()
    {
        const now = this.now;
        for(const [id,plan] of Object.entries(this.plans))
        {
            let st = Record.game.schedule[id];
            if(!st || now < st.t || st.i >= plan.length || !NavGraph.has(st.node)) {st = this._rebuild(id, now);}
            if(st.dead) {continue;}

            let ent = this._entity(id);
            if(!ent && this._inScene(st)) {ent = this._spawn(id);}

            for(;;)
            {
                const arr = (!ent && st.path.length) ? st.eta : Infinity;
                const t = Math.min(st.due, arr);
                if(t > now) {break;}
                if(arr <= st.due) {this._advance(st);}
                else {this._depart(id, st, t);}
                if(!ent && this._inScene(st)) {ent = this._spawn(id);}
            }
            st.t = now;
        }
    }

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    // 把作息換算成出發時間；"@HH:MM" 是抵達時間，用上一筆目的地走過來的花費倒推
    static _buildPlan(id, sch)
    {
        const n = sch.length;
        const keys = sch.map(s=>`${s.map}:${s.go}`);
        const bad = keys.filter(k=>!NavGraph.has(k));
        if(bad.length) {console.warn(`[Schedule] ${id} 的作息目的地不在路網裡：${bad.join(', ')}`); return null;}

        const plan = sch.map((s,i)=>{
            const arrive = s.t.startsWith('@');
            const m = TimeSystem.str2Ticks(arrive ? s.t.slice(1) : s.t);
            const r = NavGraph.route(keys[(i-1+n)%n], keys[i]);
            if(!r) {console.warn(`[Schedule] ${id} 從 ${keys[(i-1+n)%n]} 走不到 ${keys[i]}`);}
            const cost = r?.cost ?? 0;
            return {key:keys[i], dep:arrive ? mod(m-cost) : m, arr:arrive ? m : mod(m+cost), do:s.do};
        });

        plan.forEach((p,i)=>{
            const pre = plan[(i-1+n)%n];
            if(n>1 && mod(p.dep-pre.dep) < mod(pre.arr-pre.dep))
            {
                console.warn(`[Schedule] ${id} 第 ${i} 筆作息排不下：要在 ${this._hhmm(p.dep)} 出發，但上一筆 ${this._hhmm(pre.arr)} 才到 ${pre.key}`);
            }
        });

        return plan;
    }

    static _hhmm(m) {return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}

    // 距離下一筆作息出發的分鐘數
    static _gap(plan, i) {return mod(plan[(i+1)%plan.length].dep - plan[i].dep) || DAY;}

    // 假設一切準時，推出 now 這個時間點 NPC 應該在哪(開局、存檔沒有狀態、時間倒退時用)
    static _rebuild(id, now)
    {
        const plan = this.plans[id];
        const old = Record.game.schedule[id];
        const n = plan.length;

        let i = 0, depAt = -Infinity;
        plan.forEach((p,k)=>{
            const at = now - mod(now - p.dep);
            if(at > depAt) {depAt = at; i = k;}
        });

        const from = plan[(i-1+n)%n].key;
        let node = from, t = depAt;
        const path = NavGraph.route(from, plan[i].key)?.path ?? [];
        while(path.length && t + NavGraph.cost(node, path[0]) <= now)
        {
            t += NavGraph.cost(node, path[0]);
            node = path.shift();
        }

        const st = {i, node, path, eta:path.length ? t + NavGraph.cost(node, path[0]) : null,
                    due:depAt + this._gap(plan, i), t:now};
        if(old?.dead || Record.game.roles?.[id]?.removed) {st.dead = true;}   // removed 是舊版存檔的死亡標記
        dlog(T.SCH)(`[rebuild] ${id}`, st);

        // 實體(COM_Schedule)每次都從 Record 讀，直接換掉物件沒關係
        Record.game.schedule[id] = st;
        return st;
    }

    static _depart(id, st, at)
    {
        const plan = this.plans[id];
        st.i = (st.i+1) % plan.length;
        const r = NavGraph.route(st.node, plan[st.i].key);
        if(!r) {console.warn(`[Schedule] ${id} 從 ${st.node} 走不到 ${plan[st.i].key}，留在原地`);}
        st.path = r?.path ?? [];
        delete st.pos;
        st.eta = st.path.length ? at + NavGraph.cost(st.node, st.path[0]) : null;
        st.due = at + this._gap(plan, st.i);
        dlog(T.SCH)(`[depart] ${id} -> ${plan[st.i].key}`, st.path);
    }

    static _advance(st)
    {
        st.node = st.path.shift();
        delete st.pos;
        st.eta = st.path.length ? st.eta + NavGraph.cost(st.node, st.path[0]) : null;
    }

    // NPC 在目前地圖，且不是正要穿過 port 離開
    static _inScene(st)
    {
        if(st.dead) {return false;}
        const map = NavGraph.mapOf(st.node);
        if(map !== this.scene.mapName) {return false;}
        return !st.path.length || NavGraph.mapOf(st.path[0]) === map;
    }

    static _entity(id) {return this.scene.roles.find(role=>role.id===id);}

    static _spawn(id)
    {
        dlog(T.SCH)(`[spawn] ${id}`);
        const npc = new Npc(this.scene);
        npc.init_runtime(id);
        return this._entity(id);
    }
}
