import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : tree
// 功能 : 可砍伐的樹木，砍後留下樹根，定時重生
//  bb.meta.wood      : 木材 item id
//  bb.meta.count     : 掉落數量 (預設 1)
//  bb.meta.tool      : 所需工具的 cat_sub (選填；不填則無工具需求)
//  bb.meta.stump_tex : 樹根貼圖 "key:frame"
//  bb.meta.full_tex  : 重生後的貼圖 "key:frame"
//  bb.respawn        : 重生時間 (遊戲分鐘，預設 120)
//--------------------------------------------------

export class COM_Tree extends Com
{
    get tag() {return 'tree';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _chop(taker)
    {
        const {bb, send} = this.ctx;

        if(bb.meta?.tool)
        {
            const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.meta.tool);
            if(!taker.findEquip?.(hasTool) && !taker.findItem?.(hasTool))
            {
                send('msg', `需要 ${bb.meta.tool} 才能砍伐`);
                return;
            }
        }

        if(bb.meta?.wood)
        {
            const count = bb.meta.count ?? 1;
            taker.receive?.({id: bb.meta.wood, count});
            send('msg', `獲得 ${bb.meta.wood} x${count}`);
        }

        this._setStump(true);
        this.ctx.root.save();
    }

    _setStump(on)
    {
        const {root, bb} = this.ctx;
        this._stump = on;

        if(on)
        {
            this._respawnAt = TimeSystem.timeAfter(bb.respawn ?? 120);
            root._delAct(GM.CHOP);
            root.setZone(false, this.tag);
            if(bb.meta?.stump_tex) {root.setTexture?.(bb.meta.stump_tex);}
        }
        else
        {
            this._respawnAt = null;
            this._restoreAct();
            root.setZone(true, this.tag);
            if(bb.meta?.full_tex) {root.setTexture?.(bb.meta.full_tex);}
        }
    }

    _restoreAct()
    {
        const {root, bb} = this.ctx;
        if(bb.meta?.tool)
        {
            const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.meta.tool);
            root._setAct(GM.CHOP, () =>
                (GM.player?.findEquip?.(hasTool) || GM.player?.findItem?.(hasTool))
                ? GM.EN : GM.DIS
            );
        }
        else
        {
            root._setAct(GM.CHOP, () => GM.EN);
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        this._stump = false;
        this._respawnAt = null;

        this._restoreAct();
        root.on(GM.CHOP, this._chop.bind(this));
    }

    load(data)
    {
        if(!data?.stump) {return;}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(data.respawnAt);

        if(now >= at) {return;}

        this._stump = true;
        this._respawnAt = data.respawnAt;

        const {root, bb} = this.ctx;
        root._delAct(GM.CHOP);
        root.setZone(false, this.tag);
        if(bb.meta?.stump_tex) {root.setTexture?.(bb.meta.stump_tex);}
    }

    save()
    {
        if(!this._stump) {return {};}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(this._respawnAt);
        if(now >= at) {return {};}

        return {stump: true, respawnAt: this._respawnAt};
    }
}
