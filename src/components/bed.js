import Com from './com.js'
import Utility from '../utility.js'
import DB from '../db.js'
import {Pickup} from '../items/pickup.js'
import AudioManager from '../audio.js'
import {GM} from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : bed
// 功能 : 提供休息的功能
//--------------------------------------------------
export class COM_Bed extends Com
{
    constructor()
    {
        super();
        this._user=null;
    }

    get tag() {return 'bed';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _rest(user) 
    {
        const{root}=this.ctx;
        user.sleepAt?.(root);
        root.add(user);
        root.ent.bringToTop(this._blanket);
        root.interact(false);
        this._user=user;
    }

    _setEmpty()
    {
        const{root}=this.ctx;
        root.remove(this._user);
        root.interact(true);
        this._user=null;
    }

    _addBlanket()
    {
        const{bb}=this.ctx;
        if(bb.blanket) {this._blanket = this.root.addSprite(bb.blanket);}
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        this._addBlanket();

        const {bb}=this.ctx;

        const loc={x:bb.sleepX|0,y:bb.sleepY|0}
        
        // 1.提供 [外部操作的指令]
        root._setAct(GM.REST, true);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addP(root,'loc',{getter:()=>loc});
        root.setEmpty = this._setEmpty.bind(this);
 
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.REST, this._rest.bind(this));
    }
}