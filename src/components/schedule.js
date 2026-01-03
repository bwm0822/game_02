import Com from './com.js'
import {GM} from '../core/setting.js'

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
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    


    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        
    }
}