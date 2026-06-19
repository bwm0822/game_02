import Com from './com.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'
import UiConfirm from '../ui/uiconfirm.js'
import DB from '../data/db.js'
const _tag = 'loot';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : lock
// 功能 :
//  可上鎖 / 解鎖
//  解鎖方式：持有對應鑰匙，或以 dex 撬鎖
//--------------------------------------------------

export class COM_Loot extends Com
{
    get tag() {return _tag;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _butcher(taker)
    {
        const {root,bb,send} = this.ctx;

        const cb = (e) => DB.item(e.id).cat_sub?.includes('sword');

        // 1. 檢查有無刀具
        if(!taker.findEquip?.(cb) && !taker.findItem?.(cb))
        {
            send('msg', '沒有刀具，無法解剖');
            return;
        }

        // 2. 獲得皮革/肉
        if(bb.meta.skin) 
        {
            taker.receive?.({id: bb.meta.skin, count: 1});
            send('msg', `${taker.id} 獲得 ${bb.meta.skin}`);
        }

        if(bb.meta.meat) 
        {
            taker.receive?.({id: bb.meta.meat, count: 1});
            send('msg', `${taker.id} 獲得 ${bb.meta.meat}`);
        }

        // 3. 關閉互動
        root._delAct(GM.BUTCHER);
        root.setZone(false, this.tag);
    }

    _ondead()
    {
        const {root,bb} = this.ctx;
        if(bb.meta.skin||bb.meta.meat) 
        {
            // 檢查有無解剖技能
            root._setAct(GM.BUTCHER, ()=>
                GM.player.findAb?.(GM.BUTCHER) ? GM.EN: GM.DIS);

            root.on(GM.BUTCHER, this._butcher.bind(this));

            // 開啟互動
            root.setZone(true, this.tag);
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
