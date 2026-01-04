import Com from './com.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/timesystem.js'

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

        const found = this._sch.find((sh)=>{return TimeSystem.inRange(sh.t);})
        console.log(this._sch)
        console.log(found)
        const{scene}=this.ctx;
        console.log(scene.gos)

        return found;
    }




    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const{bb}=this.ctx;
        this._sch=bb.meta.schedule;
        if(!this._sch) {return;}
        this._findSch()
        // console.log(this._sch)
        
        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        
    }
}