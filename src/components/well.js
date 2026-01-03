import Com from './com.js'
import {GM} from '../setting.js'


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : well
// 功能 : 提供水井的功能=>喝水、裝水
//--------------------------------------------------
export class COM_Well extends Com
{

    get tag() {return 'well';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _drink(role) {role.drink?.();}
    _fill(role) {
        const{send}=this.ctx;
        send('fill');
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]
        root._setAct(GM.DRINK, true);
        root._setAct(GM.FILL, true);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.DRINK, this._drink.bind(this));
        root.on(GM.FILL, this._fill.bind(this));
    }
}