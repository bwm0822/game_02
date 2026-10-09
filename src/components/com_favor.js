import Com from './com.js'
import Utility from '../core/utility.js'
import { GM } from '../core/setting.js'
import {T,dlog} from '../core/debug.js'
import Quality from '../systems/quality.js'
const _tag = 'favor';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : favor
// 功能 : 提供好感度的功能
//--------------------------------------------------
export class COM_Favor extends Com
{

    get tag() {return _tag;}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    // unique NPC 對玩家的好感度存在 quality 庫(<npcId>.favor)，劇情才讀得到；其餘(生物、對其他 NPC)存在自己身上
    _qName(id)
    {
        const {bb} = this.ctx;
        return bb.meta?.unique && id === GM.player?.id ? `${bb.id}.favor` : null;
    }

    _setFavor(id, value)
    {
        value = Utility.clamp(value, 0, 100);
        const q = this._qName(id);
        if(q) {Quality.set(q, value);}
        else {this._favors[id] = value;}
    }

    _addFavor(id, value)
    {
        if(!id) {return;}
        this._setFavor(id, this._getFavor(id)+value);
    }

    _getFavor(id)
    {
        const q = this._qName(id);
        return q ? Quality.get(q) : this._favors[id] ?? GM.FAV.NEUTRAL;
    }

    _turnStart()
    {
        // 每回合增加 0.1 好感度直到 50 為止
        const ids = Object.keys(this._favors);
        if(this._qName(GM.player?.id)) {ids.push(GM.player.id);}
        for(const id of ids)
        {
            const v = this._getFavor(id);
            if(v<GM.FAV.NEUTRAL) {this._setFavor(id, Math.min(v+0.1, GM.FAV.NEUTRAL));}
        }
    }

    _updateFav(id)
    {
        this._addFavor(id, -50);  // 受攻擊，降低好感度
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.getFavor = this._getFavor.bind(this);      // 取得好感度
        root.setFavor = this._setFavor.bind(this);      // 設定好感度
        root.addFavor = this._addFavor.bind(this);      // 更新好感度

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.TURNSTART, this._turnStart.bind(this) );
        root.on(GM.EVT.UNDERATK, this._updateFav.bind(this) );
        root.on(GM.EVT.STOLEN, this._updateFav.bind(this) );
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) {this._favors = data?.[_tag] || {};}
    save() {return {[_tag]:this._favors};}
}