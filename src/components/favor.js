import Com from './com.js'
import Utility from '../core/utility.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : favor
// 功能 : 提供好感度的功能
//--------------------------------------------------
export class COM_Favor extends Com
{

    get tag() {return 'favor';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _setFavor(id, value)
    {
        this._favor[id] = Utility.clamp(value, 0, 100);
    }

    _getFavor(id)
    {
        return this._favor[id] ?? 50;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.getFavor = this._getFavor.bind(this);   // 取得好感度
        root.setFavor = this._setFavor.bind(this);   // 設定好感度

        // 3.註冊(event)給其他元件或外部呼叫
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) {this._favor = data.favor || {};}   
    save() {return {favor:this._favor};}
}