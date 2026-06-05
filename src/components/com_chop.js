import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import Pickup from '../items/pickup.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : tree
// 功能 : 可砍伐的樹木，砍後留下樹根，定時重生
//  bb.wood         : 木材 item id
//  bb.count        : 掉落數量 (預設 1)
//  bb.tool         : 所需工具的 cat_sub (選填；不填則無工具需求)
//  bb.chops        : 需要砍幾次 (預設 3)
//  bb.harvest_tex : 樹根貼圖 "key:frame"
//  bb.full_tex     : 重生後的貼圖 "key:frame"
//  bb.respawn      : 重生時間 (遊戲分鐘，預設 120)
//--------------------------------------------------

export class COM_Chop extends Com
{
    get tag() {return 'tree';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    async _chop(taker)
    {
        const {bb, send} = this.ctx;

        if(bb.tool)
        {
            const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.tool);
            if(!taker.findEquip?.(hasTool) && !taker.findItem?.(hasTool))
            {
                send('msg', `需要 ${bb.tool} 才能砍伐`);
                return;
            }
        }

        this._chopCur--;
        await taker.anim_melee?.(this.ctx.root);

        if(this._chopCur > 0)
        {
            send('msg', `砍了 ${this._chopHp - this._chopCur}/${this._chopHp} 下`);
            this.ctx.root.save();
            return;
        }

        if(bb.harvest)
        {
            const count = bb.harvest.count ?? 1;
            if(bb.harvest.drop)
            {
                const {root} = this.ctx;
                const pos = root.pos;
                const p = this.ctx.ept(pos, {th:GM.W.EMPTY, random:true, includeP:false});
                new Pickup(root.scene, pos.x, pos.y - 32).init_runtime({id: bb.harvest.id, count}).falling(p);
            }
            else
            {
                taker.receive?.({id: bb.harvest.id, count});
            }
            send('msg', `獲得 ${bb.harvest.id} x${count}`);
        }

        this._setHarvest(true);
        this.ctx.root.save();
    }

    _setHarvest(on)
     {
        const {root, bb} = this.ctx;
        this._harvest = on;

        if(on)
        {
            this._respawnAt = TimeSystem.timeAfter(bb.respawn ?? 120);
            root._delAct(GM.CHOP);
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

        const {bb} = this.ctx;
        this._harvest = false;
        this._respawnAt = null;
        this._chopHp = bb.chops ?? 3;
        this._chopCur = this._chopHp;
        // 1.提供 [外部操作的指令]
        this._restoreAct();
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('harvest', {get: () => this._harvest});
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.CHOP, this._chop.bind(this));
    }

    load(data)
    {
        if(!data) {return;}

        if(data.chopCur !== undefined) {this._chopCur = data.chopCur;}

        if(!data.harvest) {return;}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(data.respawnAt);

        if(now >= at) {return;}

        this._harvest = true;
        this._respawnAt = data.respawnAt;

        const {root, bb} = this.ctx;
        root._delAct(GM.CHOP);
        root.setZone(false, this.tag);
        if(bb.harvest_tex) {root.setShape?.(bb.harvest_tex);}
    }

    save()
    {
        const partial = this._chopCur < this._chopHp && !this._harvest;

        if(!this._harvest && !partial) {return {};}

        if(this._harvest)
        {
            const now = TimeSystem.toTotalMinutes(TimeSystem.time);
            const at  = TimeSystem.toTotalMinutes(this._respawnAt);
            if(now >= at) {return {};}
            return {harvest: true, respawnAt: this._respawnAt};
        }

        return {chopCur: this._chopCur};
    }
}
