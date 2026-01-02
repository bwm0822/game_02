import Com from './com.js'
import Utility from '../utility.js'
import DB from '../db.js'
import {Pickup} from '../items/pickup.js'
import AudioManager from '../audio.js'
import {GM} from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : sleep
// 功能 : 提供角色睡覺/休息的能力
//--------------------------------------------------
export class COM_Sleep extends Com
{
    constructor() 
    {
        super();
        this._bed;
    }

    get tag() {return 'sleep';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _sleepAt(bed) 
    {
        const{root,emit,sta}=this.ctx;
        emit('removeWeight')
        root.setPosition(bed.loc.x,bed.loc.y)
        sta(GM.ST.SLEEP)
        emit(GM.REST)
        root._setAct(GM.WAKE, true);
        this._bed=bed;
    }

    async _wake()
    {
        const{root,emit,sta}=this.ctx;
        const bed = this._bed;
        bed.setEmpty();
        root.setPosition(bed.pts[0].x,bed.pts[0].y)
        emit('addWeight')
        sta(GM.ST.IDLE);
        emit(GM.WAKE)
        root._delAct(GM.WAKE);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]
        // root._setAct(GM.REST, true);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.sleepAt = this._sleepAt.bind(this);
        root.wake = this._wake.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        
    }
}