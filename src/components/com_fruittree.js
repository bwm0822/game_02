import Com from './com.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : fruittree
// 功能 : 可採集果實的果樹，採後進入耗盡狀態，定時重生
//  bb.meta.fruit        : 果實 item id
//  bb.meta.count        : 採集數量 (預設 1)
//  bb.meta.exhausted_tex: 耗盡時的貼圖 "key:frame"
//  bb.meta.full_tex     : 恢復時的貼圖 "key:frame"
//  bb.respawn           : 果實再生時間 (遊戲分鐘，預設 60)
//--------------------------------------------------

export class COM_FruitTree extends Com
{
    get tag() {return 'fruittree';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _harvest(taker)
    {
        const {bb, send, root} = this.ctx;

        if(bb.meta?.fruit)
        {
            const count = bb.meta.count ?? 1;
            taker.receive?.({id: bb.meta.fruit, count});
            send('msg', `採集了 ${bb.meta.fruit} x${count}`);
        }

        this._setExhausted(true);
        root.save();
    }

    _setExhausted(on)
    {
        const {root, bb} = this.ctx;
        this._exhausted = on;

        if(on)
        {
            this._respawnAt = TimeSystem.timeAfter(bb.respawn ?? 60);
            root._delAct(GM.HARVEST);
            root.setZone(false, this.tag);
            if(bb.meta?.exhausted_tex) {root.setTexture?.(bb.meta.exhausted_tex);}
        }
        else
        {
            this._respawnAt = null;
            root._setAct(GM.HARVEST, () => GM.EN);
            root.setZone(true, this.tag);
            if(bb.meta?.full_tex) {root.setTexture?.(bb.meta.full_tex);}
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        this._exhausted = false;
        this._respawnAt = null;

        root._setAct(GM.HARVEST, () => GM.EN);
        root.on(GM.HARVEST, this._harvest.bind(this));
    }

    load(data)
    {
        if(!data?.exhausted) {return;}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(data.respawnAt);

        if(now >= at) {return;}

        this._exhausted = true;
        this._respawnAt = data.respawnAt;

        const {root, bb} = this.ctx;
        root._delAct(GM.HARVEST);
        root.setZone(false, this.tag);
        if(bb.meta?.exhausted_tex) {root.setTexture?.(bb.meta.exhausted_tex);}
    }

    save()
    {
        if(!this._exhausted) {return {};}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(this._respawnAt);
        if(now >= at) {return {};}

        return {exhausted: true, respawnAt: this._respawnAt};
    }
}
