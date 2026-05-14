import Com from './com.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'
import UiConfirm from '../ui/uiconfirm.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : lock
// 功能 :
//  可上鎖 / 解鎖
//  解鎖方式：持有對應鑰匙，或以 dex 撬鎖
//--------------------------------------------------

export class COM_Loot extends Com
{
    get tag() {return 'loot';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _ondead()
    {
        const {root,bb} = this.ctx;
        if(bb.meta.skin||bb.meta.meat) 
        {
            root._setAct(GM.BUTCHER, ()=>GM.EN);
        }
    }
    

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const {bb} = this.ctx;
        if(!bb.meta.skin&&!bb.meta.meat) {return;}

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

    load(data)
    {
      
    }

    // save() { return {locked: this._locked}; }
}
