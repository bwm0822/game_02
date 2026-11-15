import {RoleView} from '../components/view.js'
import {COM_Inventory} from '../components/com_inventory.js'
import {COM_Anim} from '../components/com_anim.js'
import {COM_Stats} from '../components/com_stats.js'
import {COM_Disp} from '../components/com_disp.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Role from './role.js'

//--------------------------------------------------
// 開發版 sandbox（場景分頁）的木偶：照 role.json 長相、穿裝備，沒有 AI／作息／感知、不進回合，只做場景分頁叫它做的事；不讀寫存檔
// equip＝場景裡覆寫的裝備 {CAT_WEAPON:'sword-1', CAT_HELMET:''}：有寫的格子換掉（''＝空著），沒寫的照 role.json 的 inv.equips
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

        this.addCom(new RoleView(this.scene), {modify:false})
            .addCom(new COM_Inventory())
            .addCom(new COM_Anim())
            .addCom(new COM_Stats())
            .addCom(new COM_Disp())

        this.equip?.();
        if(face) {this.face?.({x:this.x + (face==='l' ? -1 : 1), y:this.y});}
        return this;
    }

    dismiss() {this._remove();}     // 不能叫 remove()：Phaser Container 自己有 remove(child)
}
