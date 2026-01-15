import Com from './com.js'
import {GM} from '../core/setting.js'

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
        root.removeWeight?.();
        root.pos=bed.loc;
        root.pop?.('💤',{duration:-1,tween:true})
        sta(GM.ST.SLEEP)
        root._setAct(GM.WAKE, true);
        this._bed=bed;
    }

    _wake()
    {
        const{root,emit,sta,ept}=this.ctx;
        this._bed.setEmpty();
        root.pos=ept(this._bed.pts[0]);
        root.updateDepth?.();
        root.addWeight?.();
        root.pop?.()
        sta(GM.ST.IDLE);
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