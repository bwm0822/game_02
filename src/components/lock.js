import Com from './com.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : lock
// 功能 :
//  可上鎖 / 解鎖
//  解鎖方式：持有對應鑰匙，或以 dex 撬鎖
//--------------------------------------------------

export class COM_Lock extends Com
{
    constructor()
    {
        super();
        this._locked = true;
    }

    get tag() {return 'lock';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _unlockBy(opener)
    {
        const {bb, send} = this.ctx;
        const keyId = bb.keyId;

        if(keyId && opener.query?.({id: keyId}) > 0)
        {
            this._doUnlock(opener.id);
        }
        else if(Utility.roll(this._pickRate(opener)))
        {
            this._doUnlock(opener.id);
        }
        else
        {
            send('msg', `${opener.id} 撬鎖失敗`);
        }
    }

    _lockBy(locker)
    {
        const {send} = this.ctx;
        this._locked = true;
        send('msg', `${locker.id} 上鎖`);
        this.root._delAct(GM.LOCK);
        this.root._setAct(GM.UNLOCK, ()=>GM.EN);
    }

    _doUnlock(id)
    {
        const {send} = this.ctx;
        this._locked = false;
        send('msg', `${id} 解鎖`);
        this.root._delAct(GM.UNLOCK);
        this.root._setAct(GM.LOCK, ()=>GM.EN);
    }

    // 撬鎖成功率（dex 越高成功率越高，上限 90）
    _pickRate(ent)
    {
        const dex = ent.total?.dex ?? 1;
        // return Math.min(Math.floor(dex * 0.5), 90);
        return 100;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.UNLOCK, ()=>GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.isLocked = () => this._locked;
        root.pickRate = this._pickRate.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.UNLOCK, this._unlockBy.bind(this));
        root.on(GM.LOCK, this._lockBy.bind(this));
    }
}
