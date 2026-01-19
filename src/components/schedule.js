import Com from './com.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : schedule
// 功能 : 規劃角色的行程
//--------------------------------------------------
export class COM_Schedule extends Com
{
    get tag() {return 'schedule';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _toGos(p)
    {
        const{scene}=this.ctx;
        return p.split('~').map(id=>scene.gos[id]);
    }

    _findRoutine()
    {
        const{bb,scene}=this.ctx;
        const found = bb.meta.schedule
                        .filter(routine=>routine.map===scene.mapName)
                        .find(routine=>TimeSystem.inRange(routine.t))
        return found;
    }

    _init()
    {
        const{root,sta,ept}=this.ctx;

        const rou = this._findRoutine();    // 取得 作息
        const gos = this._toGos(rou.p);     // 取得 作息中的起訖點
        const sp = ept(gos[0].pts[0]);      // 取得起點(空地)

        if(gos.length===1) 
        {
            if(gos[0].act===GM.REST) {gos[0].emit(GM.REST, root);}
            else {root.updatePos?.(sp);}
            // if(gos[0].act) {sta(GM.ST.ACTION);}
        }
        else
        {
            // 1. 取得路徑
            const path = root.getPath?.(sp, gos[1].pts);
            
            // 2. 取得啟始時間
            const ts = rou.t.split('~')[0];
            
            // 3. 計算時間差
            const td = TimeSystem.ticks - TimeSystem.time2Ticks(ts);

            // 4. 計算位置
            const i = Math.min(td, path?.pts.length-1);

            // 5. 更新位置
            const pt = i===0 ? sp : path?.pts[i-1];
            root.updatePos?.(pt);
        }
    }

    async _update()
    {
        const{root,bb}=this.ctx;
        // console.log(`${root.id} ----> schedule`);

        const found = this._findRoutine();

        if(found && (found!==bb.routine))
        {
            bb.routine = found;                     // 紀錄目前的 routine
            bb.go = null;                           // 清除目前目標點
            root.clearPath?.();                     // 清除路徑 
            if(bb.sta===GM.ST.SLEEP) {root.wake?.();}
        }

        if(bb.sta===GM.ST.SLEEP) {return;}

        if(!bb.go) {bb.go=this._toGos(bb.routine.p).at(-1);}

        if(root.isAt(bb.go)) 
        {
            if(bb.go.act==='enter') {root.exit();}
            else if(bb.go.act) {bb.go.emit(bb.go.act, root);}
        }
        else
        {
            if(bb.path) {await root.cmd_move();} 
            else {root.findPath?.(bb.go.pts);}
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const{bb}=this.ctx;

        // 如果沒有 schedule，就離開
        if(!bb.meta.schedule) {return;}
        
        // 死亡時，會參考到
        bb.hasSchedule = true;   

        // 初始化
        this._init();
        
        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.updateSch = (this._update.bind(this));

        // 3.註冊(event)給其他元件或外部呼叫
        
        
    }
}