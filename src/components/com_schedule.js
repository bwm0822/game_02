import Com from './com.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import Record from '../infra/record.js'
import NavGraph from '../core/navgraph.js'
import {parseAt, patrolTrip} from '../data/schedplan.js'
import {T,dlog} from '../core/debug.js'
const _tag = 'schedule';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : schedule
// 功能 : NPC 在玩家所在地圖時，照抽象狀態(Record.game.schedule[id]，由 ScheduleManager 維護)走路線、
//        到達節點時回寫狀態；要穿過 port 到別張圖時把自己移除，交回 ScheduleManager 在背景推進
//--------------------------------------------------
export class COM_Schedule extends Com
{
    get tag() {return _tag;}   // 回傳元件的標籤

    // 每次都從 Record 讀：ScheduleManager 重建狀態時會整個換掉物件
    get st() {return Record.game.schedule?.[this.ctx.bb.id];}

    get now() {return TimeSystem.toTotalMinutes(TimeSystem.time);}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    // at 目的地(格子)沒有物件，給一個只有 getPts 的替身；同一格回傳同一個，bb.go 比較才不會一直換
    _spot(key, at)
    {
        const{scene}=this.ctx;
        this._spots ??= {};
        return this._spots[key] ??= {getPts:()=>[scene.map.tileToWorld(at[0], at[1])], emit(){}};
    }

    _go(key)
    {
        const{scene}=this.ctx;
        if(NavGraph.mapOf(key)!==scene.mapName) {return null;}
        const at = parseAt(NavGraph.nameOf(key));
        if(at) {return this._spot(key, at);}
        const go = scene.named[NavGraph.nameOf(key)];
        if(!go) {console.warn(`[COM_Schedule] ${this.ctx.bb.id} 的作息節點 ${key} 不在地圖上，navgraph.json 可能過期了`);}
        return go;
    }

    // 抵達目的地後的活動：作息有寫 do 就用 do(idle=站著)，沒寫就用目的地物件預設的 act
    _doAct(go)
    {
        const{root,bb}=this.ctx;
        const act = bb.meta.schedule[this.st.i]?.do ?? go.act;
        // ENTER 是玩家切換場景用的(COM_Port 會送 'scene')，NPC 過 port 走的是路網，不能觸發
        if(act && act!=='idle' && act!==GM.ENTER) {go.emit(act, root);}
    }

    get _sh() {return this.ctx.bb.meta.schedule[this.st.i];}

    get _patrolling() {return !this.st.path.length && this._sh?.do==='patrol';}

    // 從 from 往 to 走了 taken 步的位置
    _walkPos(from, to, taken)
    {
        const{root,ept}=this.ctx;
        const sp = ept(from);
        if(taken<=0) {return sp;}
        const path = root.getPath?.(sp, to.getPts(root));
        const pts = path?.pts ?? [];
        return pts.length ? pts[Math.min(taken, pts.length)-1] : sp;
    }

    // 巡邏：抵達入口(go)後，依 patrolTrip() 的路點走（模式見 schedplan.js），每個路點停 wait 回合；一次／單向走完停在終點(_pi===pts.length)
    // 實體化時依「抵達入口後經過的時間」推算走到哪；之後被拖住就晚到，不重新推算
    _initPatrol()
    {
        const{root}=this.ctx;
        const st = this.st, sh = this._sh;
        const {pts, repeat} = patrolTrip(sh);
        const keys = pts.map(name=>`${sh.map}:${name}`);
        const wait = sh.wait ?? 0;
        const n = keys.length;
        const cost = (a,b)=>a===b ? 0 : NavGraph.cost(a,b);
        const nextOf = (i)=>repeat ? (i+1)%n : i+1;
        this._pi = 0;
        this._wait = 0;
        this._patrolI = st.i;

        const entry = this._go(st.node);
        const first = this._go(keys[0]);
        if(!entry || !first) {return;}

        let e = Math.max(0, this.now - (st.at ?? this.now));
        const c0 = cost(st.node, keys[0]);
        if(e < c0) {root.updatePos?.(this._walkPos(entry.getPts(root)[0], first, e)); return;}
        e -= c0;

        if(repeat)
        {
            const loop = keys.reduce((sum,k,i)=>sum + wait + cost(k, keys[(i+1)%n]), 0);
            if(loop>0 && loop<Infinity) {e %= loop;}
        }

        for(let i=0;i<n;i++)
        {
            const cur = this._go(keys[i]);
            if(!cur) {return;}
            const j = nextOf(i);
            if(j>=n) {this._pi = n; root.updatePos?.(this._walkPos(cur.getPts(root)[0], cur, 0)); return;}
            const nxt = this._go(keys[j]);
            if(!nxt) {return;}
            this._pi = j;
            if(e < wait)
            {
                this._wait = wait - e;
                root.updatePos?.(this._walkPos(cur.getPts(root)[0], nxt, 0));
                return;
            }
            e -= wait;
            const c = cost(keys[i], keys[j]);
            if(e < c) {root.updatePos?.(this._walkPos(cur.getPts(root)[0], nxt, e)); return;}
            e -= c;
        }
    }

    async _patrol()
    {
        const{root,bb}=this.ctx;
        const sh = this._sh;
        const {pts, repeat} = patrolTrip(sh);
        if(this._patrolI!==this.st.i) {this._pi = 0; this._wait = 0; this._patrolI = this.st.i;}
        this._key = null;

        if(this._pi>=pts.length) {return;}
        if(this._wait>0) {this._wait--; return;}

        const go = this._go(`${sh.map}:${pts[this._pi]}`);
        if(!go) {return;}
        if(bb.go!==go) {bb.go = go; root.clearPath?.();}

        if(root.isAt(go))
        {
            this._wait = sh.wait ?? 0;
            this._pi = repeat ? (this._pi+1) % pts.length : this._pi+1;
            root.clearPath?.();
        }
        else if(bb.path) {await root.cmd_move();}
        else {root.findPath?.({ent:go});}
    }

    // 實體化時的位置：停留中 → 目的地；移動中 → 從起點(或上次交棒的位置)往下一個節點走了幾步
    _init()
    {
        const{root,ept}=this.ctx;
        const st = this.st;
        const node = this._go(st.node);

        if(!st.path.length)
        {
            if(!node) {return;}
            if(this._patrolling) {this._initPatrol(); return;}
            root.updatePos?.(ept(node.getPts(root)[0]));
            this._doAct(node);
            return;
        }

        const next = this._go(st.path[0]);
        if(!next) {return;}
        const sp = ept(st.pos ?? node?.getPts(root)[0] ?? next.getPts(root)[0]);
        const path = root.getPath?.(sp, next.getPts(root));
        const total = path?.pts?.length ?? 0;
        const taken = Math.max(0, Math.min(total, total - (st.eta - this.now)));
        root.updatePos?.(taken===0 ? sp : path.pts[taken-1]);
    }

    async _update()
    {
        const{root,bb}=this.ctx;
        const st = this.st;
        if(!st || st.dead) {return;}
        dlog(T.SCH,root.id)('updateSch', st);

        if(st.path.length && bb.sta===GM.ST.SLEEP) {root.wake?.();}
        if(bb.sta===GM.ST.SLEEP) {return;}
        if(this._patrolling) {await this._patrol(); return;}

        const key = st.path[0] ?? st.node;
        if(key!==this._key || !bb.go)       // 其他行為(例如攻擊)會清掉 bb.go
        {
            this._key = key;
            bb.go = this._go(key);
            root.clearPath?.();
        }
        if(!bb.go) {return;}

        if(root.isAt(bb.go))
        {
            if(!st.path.length) {this._doAct(bb.go); return;}

            st.node = st.path.shift();
            delete st.pos;
            if(!st.path.length) {st.at = this.now;}
            const next = st.path[0];
            if(next && NavGraph.mapOf(next)!==NavGraph.mapOf(st.node))
            {
                st.eta = this.now + NavGraph.cost(st.node, next);
                root.exit();
            }
        }
        else
        {
            if(bb.path) {await root.cmd_move();}
            else {root.findPath?.({ent:bb.go});}
        }
    }

    _ondead()
    {
        const st = this.st;
        if(st) {st.dead = true;}
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const{bb}=this.ctx;

        // 如果沒有 schedule，就離開
        if(!bb.meta.schedule || !this.st) {return;}

        // 初始化
        this._init();

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.updateSch = this._update.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

    // 玩家離開地圖時 NPC 還在路上：記下位置跟剩下的步數，交給 ScheduleManager 在背景接著走
    save()
    {
        const{root}=this.ctx;
        const st = this.st;
        if(!st || st.dead || !st.path.length) {return;}
        const next = this._go(st.path[0]);
        if(!next) {return;}
        const path = root.getPath?.(root.pos, next.getPts(root));
        st.pos = root.pos;
        st.eta = this.now + (path?.pts?.length ?? 0);
    }
}
