import Com from './com.js'
import Utility from '../core/utility.js'
import AudioManager from '../manager/audio.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : door
// 功能 : 提供開門、關門的功能
//--------------------------------------------------
export class COM_Door extends Com
{
    constructor()
    {
        super();
        this._opened=false;
    }

    get tag() {return 'door';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}
    get opened() {return this._opened;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    async _open() 
    {
        if(!this._opened)
        {
            this._opened=true;
            const{bb,root}=this.ctx;
            root._delAct(GM.OPEN_DOOR);
            root._setAct(GM.CLOSE_DOOR, true);
            root.setTexture?.(bb.door_close);
            root.removeWeight?.();
            root.addWeight?.(undefined,GM.W.DOOR-1);
            AudioManager.doorOpen();
            await Utility.delay(200);
        }
    }

    async _close()
    {
        if(this._opened)
        {
            this._opened=false;
            const{bb,root}=this.ctx;
            root._delAct(GM.CLOSE_DOOR);
            root._setAct(GM.OPEN_DOOR, true);
            root.setTexture?.(bb.door_open);
            root.removeWeight?.(GM.W.DOOR-1);
            root.addWeight?.();
            AudioManager.doorClose();
            await Utility.delay(200);
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 1.提供 [外部操作的指令]
        root._setAct(GM.OPEN_DOOR, true);
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.OPEN_DOOR, this._open.bind(this));
        root.on(GM.CLOSE_DOOR, this._close.bind(this));
    }
}