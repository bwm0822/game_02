import Com from './com.js'
import DB from '../db.js'
import Record from '../record.js'
import {GM} from '../setting.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : pick
// 功能 : 
//  提供拾取功能
//--------------------------------------------------

export class Pickable extends Com
{
    get tag() {return 'pick';}   // 回傳元件的標籤
    get content() {return this._content;}                   // gameObject 的內容
    get label() {return this._dat[Record.data.lang].lab;}   // gameObject 的名稱
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _pickup(taker)  // 提供給外界操作
    {
        if(taker.take(this))
        {
            const {emit,send}=this.ctx;
            send('msg',`${'_pickup'.lab()} ${this.label}`)
            emit('out');
            emit('refresh');
            emit('remove');
        }   
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root)

        // act
        root._setAct(GM.TAKE, true);


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

        // 在上層綁定操作介面，提供給外部件使用
        this.addP(root, 'content', {target:this, key:'_content'})
        
        // 註冊 event
        // 提供給外界操作
        root.on(GM.TAKE, (taker)=>{this._pickup(taker);})
    }

    save() {return {...this.pos,...this._content};}




}