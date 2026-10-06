import Com from './com.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import Record from '../infra/record.js'
import NavGraph from '../core/navgraph.js'
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
    _go(key)
    {
        const{scene}=this.ctx;
        if(NavGraph.mapOf(key)!==scene.mapName) {return null;}
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

    // 實體化時的位置：停留中 → 目的地；移動中 → 從起點(或上次交棒的位置)往下一個節點走了幾步
    _init()
    {
        const{root,ept}=this.ctx;
        const st = this.st;
        const node = this._go(st.node);

        if(!st.path.length)
        {
            if(!node) {return;}
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
