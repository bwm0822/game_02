import Com from './com.js'
import Utility from '../utility.js'
import DB from '../db.js'
import {Pickup} from '../items/pickup.js'
import AudioManager from '../audio.js'
import {GM} from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : door
// 功能 : 提供開門、關門的功能
//--------------------------------------------------
export class COM_Door extends Com
{
    get tag() {return 'door';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    async _open(role) 
    {
        const{bb,emit}=this.ctx;
        this.root._delAct(GM.OPEN_DOOR);
        this.root._setAct(GM.CLOSE_DOOR, true);
        emit('setTexture',bb.door_close);
        emit('removeWeight');
        emit('addWeight',undefined,GM.W.DOOR-1);
        AudioManager.doorOpen();
        await Utility.delay(500);
    }

    async _close()
    {
        const{bb,emit}=this.ctx;
        this.root._delAct(GM.CLOSE_DOOR);
        this.root._setAct(GM.OPEN_DOOR, true);
        emit('setTexture',bb.door_open);
        emit('removeWeight',GM.W.DOOR-1);
        emit('addWeight');
        AudioManager.doorClose();
        await Utility.delay(500);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 操作的指令
        root._setAct(GM.OPEN_DOOR, true);

        // 3.提供給外界操作
        root.on(GM.OPEN_DOOR, this._open.bind(this));
        root.on(GM.CLOSE_DOOR, this._close.bind(this));
    }
}