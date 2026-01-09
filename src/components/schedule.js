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
    constructor()
    {
        super();
    }

    get tag() {return 'schedule';}   // 回傳元件的標籤
    // get pos() {return this._root.pos;}

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

    _setInitPos()
    {
        const{root,bb,sta,ept}=this.ctx;

        const gos = this._toGos(bb.routine.p);

        const sp = ept(gos[0].pts[0]);  // 取得起始點(空地)

        if(gos.length===1) 
        {
            root.updatePos?.(sp);
            if(gos[0].act) {sta(GM.ST.ACTION);}
        }
        else
        {
            // 1. 取得路徑
            const path = root.getPath?.(sp, gos[1].pts);
            
            // 2. 取得啟始時間
            const ts = bb.routine.t.split('~')[0];
            
            // 3. 計算時間差
            const td = TimeSystem.ticks - TimeSystem.time2Ticks(ts);

            // 4. 計算位置
            const i = Math.min(td, path?.pts.length-1);

            // 5. 更新位置
            const pt = i===0 ? sp : path?.pts[i-1];
            root.updatePos?.(pt);
            path?.pts.splice(0,i);
            if(path?.pts.length>0) {root.setPath?.(path);}
            else if(gos[1].act) {sta(GM.ST.ACTION);}
        }

        return gos.at(-1); // 設定 bb.go
    }

    _update()
    {
        const{root,bb,sta}=this.ctx;

        const found = this._findRoutine();

        if(found && (found!==bb.routine))
        {
            bb.routine = found;
            bb.go = this._toGos(found.p).at(-1);
        }

        console.log(sta())

        if(sta()!==GM.ST.SLEEP)
        {
            root.cmd()   
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

        // 取得 作息
        bb.routine = this._findRoutine();

        // 設定 初始位置
        bb.go = this._setInitPos();


        
        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        root.on('onupdate', this._update.bind(this));
        
        
    }
}