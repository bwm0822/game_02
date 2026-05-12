import Com from './com.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'
import UiConfirm from '../ui/uiconfirm.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : lock
// 功能 :
//  可上鎖 / 解鎖
//  解鎖方式：持有對應鑰匙，或以 dex 撬鎖
//--------------------------------------------------

export class COM_Lock extends Com
{
    get tag() {return 'lock';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    async _unlockBy(opener)
    {
        const {bb, send} = this.ctx;
        const keyid = this._dat.keyid;

        if(keyid && opener.queryItem?.({id: keyid}).length>0)
        {
            this._doUnlock(opener.id);
            return;
        }

        if(opener.queryAb?.('lockpick').length===0)
        {
            send('msg', '缺少開鎖技能');
            return;
        }

        const tool = opener.findItem?.({id: 'lockpick'});
        if(!tool)
        {
            send('msg', '缺少開鎖工具');
            return;
        }

        const rate = this._pickRate(opener);
        const confirmed = await UiConfirm.msg(`用開鎖工具開鎖？\n成功率 ${rate}%`);
        if(!confirmed) {return;}

        if(Utility.roll(rate))
        {
            this._doUnlock(opener.id);
        }
        else
        {
            send('msg', `${opener.id} 開鎖失敗`);
            if(--tool.times<=0) 
            {
                opener.removeItem?.(tool);
                send('msg', '開鎖工具損壞了');
            }
        }
    }

    _lockBy(locker)
    {
        const {send} = this.ctx;
        this._locked = true;
        send('msg', `${locker.id} 上鎖`);
    }

    _doUnlock(id)
    {
        const {send} = this.ctx;
        this._locked = false;
        send('msg', `${id} 開鎖`);
    }

    // 撬鎖成功率：dex 越高越好，diff 越高越難，上限 90%
    _pickRate(ent)
    {
        const dex  = ent.total?.dex ?? 1;
        const diff = this._dat.diff;
        return Math.min(Math.floor(dex * 50 / diff), 90);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 從bb.lock讀取設定，並存入this._dat，供內部使用
        const {bb} = this.ctx;
        if(bb.lock) {this._dat = JSON.parse(bb.lock);}
        this._dat = {diff:5, keyid:'key_0000', ...this._dat};

        // 1.提供 [外部操作的指令]
        root._setAct(GM.UNLOCK, ()=>this._locked?GM.EN:GM.HIDE);
        root._setAct(GM.LOCK, ()=>this._locked?GM.HIDE:GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.isLocked = () => this._locked;

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.UNLOCK, this._unlockBy.bind(this));
        root.on(GM.LOCK, this._lockBy.bind(this));
    }

    load(data)
    {
        if(data) {this._locked = data.locked;}
        else {this._locked = true;}
    }

    save() { return {locked: this._locked}; }
}
