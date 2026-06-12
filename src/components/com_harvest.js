import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import Pickup from '../items/pickup.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : 由 bb.tag 決定
// 功能 : 可採集的世界物件，採後進入耗盡狀態，定時重生
//  bb.act         : GM action key (e.g., GM.CHOP, GM.HARVEST) - 必填
//  bb.zone        : 互動標籤 - 必填
//  bb.tool        : 所需工具的 cat_sub (選填)
//  bb.chops       : 需要採集幾次 (預設 1)
//  bb.anim        : 動畫類型 'melee' | undefined
//  bb.harvest     : { id, count, drop } - 採集物品
//  bb.harvest_tex : 採集後的貼圖
//  bb.full_tex    : 重生後的貼圖
//  bb.respawn     : 重生時間 (遊戲分鐘，預設 60)
//--------------------------------------------------

export class COM_Harvest extends Com
{
    get tag() {return this._tag ?? '';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _restoreAct()
    {
        const {root, bb} = this.ctx;
        if(bb.tool)
        {
            const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.tool);
            root._setAct(bb.act, () =>
                (GM.player?.findEquip?.(hasTool) || GM.player?.findItem?.(hasTool))
                ? GM.EN : GM.DIS
            );
        }
        else
        {
            root._setAct(bb.act, () => GM.EN);
        }
    }

    _setHarvested(on)
    {
        const {root, bb} = this.ctx;
        this._harvested = on;

        if(on)
        {
            this._respawnAt = TimeSystem.timeAfter(bb.respawn ?? 60);
            root._delAct(bb.act);
            root.setZone(false, this.tag);
            if(bb.harvest_tex) {root.setShape?.(bb.harvest_tex);}
        }
        else
        {
            this._respawnAt = null;
            this._chopCur = this._chopHp;
            this._restoreAct();
            root.setZone(true, this.tag);
            if(bb.full_tex) {root.setShape?.(bb.full_tex);}
        }
    }

    async _onAct(taker)
    {
        const {scene, root, bb, send, ept} = this.ctx;

        if(bb.tool)
        {
            const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.tool);
            if(!taker.findEquip?.(hasTool) && !taker.findItem?.(hasTool))
            {
                send('msg', `需要 ${bb.tool} 才能採集`);
                return;
            }
        }

        this._chopCur--;
        if(bb.anim === 'melee') {await taker.anim_melee?.(root);}

        if(this._chopCur > 0)
        {
            send('msg', `砍了 ${this._chopHp - this._chopCur}/${this._chopHp} 下`);
            return;
        }

        if(bb.harvest)
        {
            const count = bb.harvest.count ?? 1;
            if(bb.harvest.drop)
            {
                const pos = root.pos;
                const p = ept(pos, {th:GM.W.EMPTY, random:true, includeP:false});
                new Pickup(scene, pos.x, pos.y - 32).init_runtime({id: bb.harvest.id, count}).falling(p);
            }
            else
            {
                taker.receive?.({id: bb.harvest.id, count});
            }
            send('msg', `獲得 ${bb.harvest.id} x${count}`);
        }

        this._setHarvested(true);
        root.save();
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const {bb} = this.ctx;
        this._tag = bb.zone;
        this._harvested = false;
        this._respawnAt = null;
        this._chopHp = bb.chops ?? 1;
        this._chopCur = this._chopHp;

        this._restoreAct();
        this.addRt('harvest', {get: () => this._harvested});
        root.on(bb.act, this._onAct.bind(this));
    }

    load(data)
    {
        if(!data) {return;}

        if(data.chopCur !== undefined) {this._chopCur = data.chopCur;}

        if(!data.harvested) {return;}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(data.respawnAt);

        if(now >= at) {return;}

        this._harvested = true;
        this._respawnAt = data.respawnAt;

        const {root, bb} = this.ctx;
        root._delAct(bb.act);
        root.setZone(false, this.tag);
        if(bb.harvest_tex) {root.setShape?.(bb.harvest_tex);}
    }

    save()
    {
        const partial = this._chopCur < this._chopHp && !this._harvested;

        if(!this._harvested && !partial) {return {};}

        if(this._harvested)
        {
            const now = TimeSystem.toTotalMinutes(TimeSystem.time);
            const at  = TimeSystem.toTotalMinutes(this._respawnAt);
            if(now >= at) {return {};}
            return {harvested: true, respawnAt: this._respawnAt};
        }

        return {chopCur: this._chopCur};
    }
}
