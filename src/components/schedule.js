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
        this._sch;
    }

    get tag() {return 'schedule';}   // 回傳元件的標籤
    // get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _findSch()
    {
        const{scene}=this.ctx;
        const found = this._schs
                        .filter(sch=>sch.map===scene.mapName)
                        .find(sch=>TimeSystem.inRange(sch.t))
        return found;
    }

    _setPos(sch,gos)
    {
        if(gos.length===1) {return;}

        console.log('------ set pos',sch)
        
        const{root,bb}=this.ctx;

        // 1. 取得路徑
        console.log(gos[0].pos, gos[1].pts)
        const path = root.getPath?.(gos[0].pos, gos[1].pts);
        
        // 2. 取得啟始時間
        const ts = sch.t.split('~')[0];
        
        // 3. 計算時間差
        const td = TimeSystem.ticks - TimeSystem.time2Ticks(ts);

        // 4. 計算位置
        const i = Math.min(td, path?.pts.length-1);

        // 5. 更新位置
        const pt = i===0 ? gos[0].pos : path?.pts[i-1];
        console.log(i,pt,path.pts)
        root.updatePos?.(pt);
        path?.pts.splice(0,i);
        if(path?.pts.length>0) 
        {
            // sta(GM.ST.MOVING);
            bb.go=gos[1];
            root.setPath?.(path);
        }
    }

    _toGos(p)
    {
        const{scene}=this.ctx;
        return p.split('~').map(id=>scene.gos[id])
    }

    _update()
    {
        console.log('upd')
        const{root,bb}=this.ctx;
        const found = this._findSch();

        if(found && (found!==this._cur))
        {
            this._cur = found;
            bb.go = this._toGos(this._cur.p).at(-1);
        }

        if(!root.isAt(bb.go))
        {
            if(!bb.path)
            {
                bb.path = root.getPath?.(root.pos, bb.go.pts);
            }
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const{bb}=this.ctx;

        this._schs=bb.meta.schedule;
        if(!this._schs) {return;}

        bb.isSchedule=true;   // 死亡時，會參考到

        // 1. 行程
        this._cur = this._findSch();
        console.log(this._cur)
        // 2. 取得 起始、目標 地點
        const gos=this._toGos(this._cur.p)
        bb.go=gos.at(-1);
        // 2. 設定 位置
        this._setPos(this._cur,gos);
        
        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        if(this._schs) {root.on('onupdate', this._update.bind(this));}
        
    }
}