import {RoleView} from '../components/view.js'
import {COM_Anim} from '../components/com_anim.js'
import {COM_Stats} from '../components/com_stats.js'
import {COM_Disp} from '../components/com_disp.js'
import {COM_Pickable} from '../components/com_pickable.js'
import {GameObject} from '../core/gameobject.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Role from './role.js'

//--------------------------------------------------
// 練習木樁：物品(device.class='dummy')放置後變成這個角色，拿取變回物品
// HP 歸 0 只倒地不移除，「恢復」補滿 HP、清狀態、站起來
//--------------------------------------------------
export default class Dummy extends Role
{
    // Role 把 uid===-1 存進 Record.game.roles[id](給玩家用)，木樁可以放很多個，要走 runtime 陣列
    _saveData(data) {GameObject.prototype._saveData.call(this, data);}

    _ondead()
    {
        this.clearEffs?.();
        this.setZone?.(true);   // RoleView 倒地時會關掉互動，木樁倒地還要能恢復/拿取
    }

    _restore()
    {
        const dead = !this.isAlive;
        const {states, [GM.HPMAX]:max} = this.total;
        this.clearEffs?.();
        if(states[GM.HP] < max) {this.heal?.(max - states[GM.HP]);}
        if(dead) {this.emit(GM.EVT.ONREVIVE);}
    }

    init_runtime(obj)
    {
        if(!super.init_prefab(obj.id)) {return;}

        const {bb} = this.ctx;
        bb.meta = DB.role(bb.id);
        bb.isStatic = false;
        bb.interactive = true;
        bb.noCombat = true;

        this.addCom(new RoleView(this.scene), {modify:false})
            .addCom(new COM_Anim())
            .addCom(new COM_Stats())
            .addCom(new COM_Disp(), {mute:true})
            .addCom(new COM_Pickable())

        this.on(GM.EVT.ONDEAD, this._ondead.bind(this));
        this.on(GM.RESTORE, this._restore.bind(this));

        this.load(obj);

        this._setAct(GM.OBSERVE, ()=>GM.EN);
        this._setAct(GM.ATTACK,()=>this.isAlive ? GM.EN : GM.HIDE);
        this._setAct(GM.RESTORE, ()=>{
            const {states, [GM.HPMAX]:max} = this.total;
            return states[GM.HP] < max || this.actives.length>0 ? GM.EN : GM.DIS;
        });

        if(!this.isAlive) {this.emit(GM.EVT.ONDEAD, null, true);}

        return this;
    }

    async process()
    {
        if(!this.isAlive) {return;}
        const {emit, aEmit} = this.ctx;
        await aEmit(GM.EVT.TURNSTART);
        emit(GM.EVT.TURNEND);
    }

    save() {super.save({class:'dummy'});}

    // 跟 RoleView._addPart 同樣的組法，view 會被 anchor 往回偏移，所以 y 要扣 anchor.y
    static ghost(scene, obj)
    {
        const meta = DB.role(obj.id);
        const sps = [meta.body, meta.head, meta.hand].filter(p=>p?.sprite).map(p=>{
            const [key, frame] = p.sprite.split(':');
            return scene.add.sprite(p.x??0, (p.y??0)-meta.anchor.y, key, frame)
                .setScale(p.scale).setOrigin(0.5,1).setAngle(p.a??0);
        });
        return scene.add.container(0, 0, sps);
    }
}
