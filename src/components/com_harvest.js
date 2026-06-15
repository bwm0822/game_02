import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import TimeSystem from '../systems/time.js'
import Pickup from '../items/pickup.js'
import Record from '../infra/record.js'
import AudioManager from '../manager/audio.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 功能 : 可採集的世界物件，採後進入耗盡狀態，定時重生
//  三種類型由 bb.act 與 bb.harvest_tex 決定：
//    tree     (GM.CHOP)    : 砍 bb.chopCnt 次，每次播動畫，最後掉落物品
//    apple    (GM.HARVEST) : 摘 bb.harvest.count 次，每次得 1 個，摘完換 harvest_tex
//    mushroom (GM.HARVEST) : 摘 bb.harvest.count 次，每次得 1 個，摘完消失（無 harvest_tex）
//  bb.act         : GM.CHOP | GM.HARVEST - 必填
//  bb.tool        : 所需工具的 cat_sub (選填)
//  bb.chopCnt     : chop 模式需砍幾次才能完成 (預設 1)
//  bb.harvest     : { id, count } - 採集物品；pick 模式 count = 可摘次數
//  bb.harvest_tex : 耗盡後的貼圖（無此欄位 + pick 模式 = 消失）
//  bb.full_tex    : 重生後的貼圖
//  bb.respawn     : 重生時間 (遊戲分鐘，預設 60)
//--------------------------------------------------
function _lab(id) {return DB.item(id)?.[Record.setting.lang]?.lab || id;}

export class COM_Harvest extends Com
{
    get tag() {return 'harvest';}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------


    _restoreAct()
    {
        const {root, bb} = this.ctx;
        root._setAct(bb.act, () => GM.EN);
    }

    _setHarvested(on)
    {
        const {root, bb} = this.ctx;
        this._harvested = on;
        const isPick = bb.act === GM.HARVEST;

        if(on)
        {
            this._respawnAt = TimeSystem.timeAfter(bb.respawn ?? 60);
            root._delAct(bb.act);
            root.setZone(false, this.tag);
            if(bb.harvest_tex)  {root.setShape?.(bb.harvest_tex);}
            else if(isPick)     {root.setVisible(false);}
        }
        else
        {
            this._respawnAt = null;
            this._cur = this._hp;
            this._restoreAct();
            root.setZone(true, this.tag);
            if(bb.full_tex)     {root.setShape?.(bb.full_tex);}
            else if(isPick)     {root.setVisible(true);}
        }
    }

    async _onAct(taker)
    {
        const {scene, root, bb, send, ept} = this.ctx;

        if(bb.act === GM.CHOP)
        {
            if(bb.tool)
            {
                const hasTool = (e) => DB.item(e.id)?.cat_sub?.includes(bb.tool);
                if(!taker.findEquip?.(hasTool) && !taker.findItem?.(hasTool))
                {
                    send('msg', `需要 ${bb.tool} 才能採集`);
                    return;
                }
            }
            this._cur--;
            AudioManager.chop();
            await taker.anim_melee?.(root);
            if(this._cur > 0)
            {
                send('msg', `砍了 ${this._hp - this._cur}/${this._hp} 下`);
                return;
            }
            if(bb.harvest)
            {
                const {id, count = 1} = bb.harvest;
                const pos = root.pos;
                const p = ept(pos, {th:GM.W.EMPTY, random:true, includeP:false});
                new Pickup(scene, pos.x, pos.y - 32).init_runtime({id, count}).falling(p);
                send('msg', `掉落 ${_lab(id)} x${count}`);
            }
        }
        else // GM.HARVEST (pick)
        {
            this._cur--;
            AudioManager.harvest();
            if(bb.harvest)
            {
                taker.receive?.({id: bb.harvest.id, count: 1});
                send('msg', `獲得 ${_lab(bb.harvest.id)}`);
            }
            if(this._cur > 0) {return;}
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
        this._harvested = false;
        this._respawnAt = null;
        this._hp = bb.act === GM.CHOP
            ? (bb.chopCnt ?? 1)
            : (bb.harvest?.count ?? 1);
        this._cur = this._hp;

        this._restoreAct();
        this.addRt('harvest', {get: () => this._harvested});
        root.on(bb.act, this._onAct.bind(this));
    }

    load(data)
    {
        if(!data) {return;}

        if(data.cur !== undefined) {this._cur = data.cur;}

        if(!data.harvested) {return;}

        const now = TimeSystem.toTotalMinutes(TimeSystem.time);
        const at  = TimeSystem.toTotalMinutes(data.respawnAt);

        if(now >= at) {return;}

        this._harvested = true;
        this._respawnAt = data.respawnAt;

        const {root, bb} = this.ctx;
        const isPick = bb.act === GM.HARVEST;
        root._delAct(bb.act);
        root.setZone(false, this.tag);
        if(bb.harvest_tex)  {root.setShape?.(bb.harvest_tex);}
        else if(isPick)     {root.setVisible(false);}
    }

    save()
    {
        const partial = this._cur < this._hp && !this._harvested;

        if(!this._harvested && !partial) {return {};}

        if(this._harvested)
        {
            const now = TimeSystem.toTotalMinutes(TimeSystem.time);
            const at  = TimeSystem.toTotalMinutes(this._respawnAt);
            if(now >= at) {return {};}
            return {harvested: true, respawnAt: this._respawnAt};
        }

        return {cur: this._cur};
    }
}
