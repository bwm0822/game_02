import Com from './com.js'
import {GM} from '../setting.js';
import TimeManager from '../time'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : port
// 功能 : 
//  提供傳送門功能
//--------------------------------------------------
export class COM_Port extends Com
{
    get tag() {return 'port';}  // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _enter()
    {
        TimeManager.inc();
        const {bb,send}=this.ctx;
        send('scene',{map:bb.map, port:bb.port, ambient:bb.ambient});
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.ENTER, true);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        // 外部
        root.on(GM.ENTER, this._enter.bind(this));
    }
}