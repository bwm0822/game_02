import {RoleView} from '../components/view.js'
import {COM_Inventory} from '../components/com_inventory.js'
import {COM_Anim} from '../components/com_anim.js'
import {COM_Action} from '../components/com_action.js'
import {COM_Nav} from '../components/com_nav.js'
import {COM_Stats} from '../components/com_stats.js'
import {COM_Disp} from '../components/com_disp.js'
import {COM_Ability} from '../components/com_ability.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Role from './role.js'

//--------------------------------------------------
// 開發版 sandbox（場景分頁）的木偶：照 role.json 長相、穿裝備，沒有 AI／作息／感知、不進回合，只做場景分頁叫它做的事；不讀寫存檔
// equip＝場景裡覆寫的裝備 {CAT_WEAPON:'sword-1', CAT_HELMET:''}：有寫的格子換掉（''＝空著），沒寫的照 role.json 的 inv.equips
// 被打走真的傷害（數字、MISS、擊退），但扣血前先墊高，打完剛好是滿血，不會死；倒地／復活另外叫
//--------------------------------------------------
export default class Puppet extends Role
{
    _loadData() {return null;}
    _saveData() {}

    static equipsOf(meta, equip={})
    {
        const cats = Object.keys(equip).map(k=>GM.CAT[k.replace(/^CAT_/, '')]);
        const keep = (meta.inv?.equips ?? []).filter(e=>e && !cats.includes(DB.item(e.id ?? e)?.cat));
        return [...keep, ...Object.values(equip).filter(id=>id && DB.item(id))];
    }

    init_runtime({id, key, equip, face})
    {
        const meta = DB.role(id);
        if(!meta || !super.init_prefab(id)) {return null;}
        const {bb} = this.ctx;
        this.key = key;
        bb.meta = {...meta, inv:{...meta.inv, equips:Puppet.equipsOf(meta, equip)}};
        bb.isStatic = false;
        bb.interactive = false;
        bb.noCombat = true;     // 打它不會切到戰鬥模式

        this.addCom(new RoleView(this.scene), {modify:false})
            .addCom(new COM_Inventory())
            .addCom(new COM_Anim())
            .addCom(new COM_Action())
            .addCom(new COM_Nav())
            .addCom(new COM_Stats())
            .addCom(new COM_Disp())
            .addCom(new COM_Ability())

        const take = this.takeDamage;
        this.takeDamage = (dmg, attacker)=>{
            const t = this.total;
            if(dmg.amount<0 && t.states[GM.HP]>0) {t.states[GM.HP] = t[GM.HPMAX] - dmg.amount;}
            take(dmg, attacker);
        };

        this.equip?.();
        if(face) {this.face?.({x:this.x + (face==='l' ? -1 : 1), y:this.y});}
        return this;
    }

    die()
    {
        if(!this.isAlive) {return;}
        this.total.states[GM.HP] = 0;
        this.emit(GM.EVT.ONDEAD, null);
    }

    revive()
    {
        if(this.isAlive) {return;}
        const t = this.total;
        t.states[GM.HP] = t[GM.HPMAX];
        this.emit(GM.EVT.ONREVIVE);
    }

    dismiss() {this._remove();}     // 不能叫 remove()：Phaser Container 自己有 remove(child)
}
