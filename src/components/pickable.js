import Com from './com.js'
import DB from '../data/db.js'
import Record from '../record.js'
import {GM} from '../core/setting.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : pick
// 功能 : 
//  提供拾取功能
//--------------------------------------------------

export class COM_Pickable extends Com
{
    get tag() {return 'pick';}   // 回傳元件的標籤
    get content() {return this._content;}                   // gameObject 的內容
    get label() {return this._dat[Record.setting.lang].lab;}   // gameObject 的名稱
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _pickup(taker)  // 提供給外界操作
    {
        if(taker.take(this.content))
        {
            const {emit,send}=this.ctx;
            send('msg',`${'_pickup'.lab()} ${this.label}`)
            emit('out');
            emit('refresh');
            emit('remove');
        } 
        else
        {
            send('msg','_space_full'.lab());
        }  
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
        }
        
        this._dat = DB.item(this._content.id);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.PICKUP, true);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addP(root, 'content', {target:this, key:'_content'});
        
        // 3.註冊(event)給其他元件或外部呼叫
        // 外部
        root.on(GM.PICKUP, this._pickup.bind(this));
    }

    save() {return {...this.pos,...this._content};}




}