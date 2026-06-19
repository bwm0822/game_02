import Com from './com.js'
import DB from '../data/db.js'
import Record from '../infra/record.js'
import {GM} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import {dlog} from '../core/debug.js'
const _tag = 'pick';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : pick
// 功能 : 
//  提供拾取功能
//--------------------------------------------------

export class COM_Pickable extends Com
{
    get tag() {return _tag;}   // 回傳元件的標籤
    get content() {return this._content;}                   // gameObject 的內容
    get label() {return this._dat[Record.setting.lang].lab;}   // gameObject 的名稱
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    
    _pickupBy(taker)  // 提供給外界操作
    { 
        const {emit,send}=this.ctx;
        
        emit(GM.EVT.ONPICKUP, this.content);    // 通知各元件，物品即將被拾取，
                                                // 讓它們有機會在 record 上寫入狀態，
                                                // 以便放置時還原
                                                
        const remain = taker.receive(this.content);
        send(GM.EVT.REFRESH);   // 要在 emit('remove')之前執行，否則會出錯，
                                // 因為 emit('remove')會將 this.scene 設成 null
        if(remain===0)
        {       
            send('msg',`${'pickup'.lab()} ${this.label}`)
            emit('out');
            emit('remove');
        } 
        else
        {
            this.content.count-=remain;
            send('msg','_space_full'.lab());
        }  
        
        QuestManager.notify({cat:GM.INV})
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root)

        const {bb} = this.ctx;
        if(bb.content)
        {
            delete bb.content.x;
            delete bb.content.y;
            delete bb.content.angle;
            this._content = bb.content;
        }
        else
        {
            this._content = {id:bb.id,count:bb.count??1};
            bb.q && (this._content.q=bb.q);
            
        }
        
        this._dat = DB.item(this._content.id);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.PICKUP, ()=>GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('content');
        
        // 3.註冊(event)給其他元件或外部呼叫
        // 外部
        root.on(GM.PICKUP, this._pickupBy.bind(this));
    }

    save() {return {...this.pos, ...this._content};}




}