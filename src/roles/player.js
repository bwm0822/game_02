import {ItemView,RoleView} from '../components/view.js'
import {COM_Inventory} from '../components/inventory.js'
import {COM_Anim} from '../components/anim.js'
import {COM_Action} from '../components/action.js'
import {COM_Nav} from '../components/nav.js'
import {COM_Sense} from '../components/sense.js'
import {COM_Stats} from '../components/stats.js'
import {COM_Disp} from '../components/disp.js'
import {COM_Ability} from '../components/ability.js'
import {COM_AbilityTree} from '../components/abilitytree.js'
import {COM_AbilitySlots} from '../components/abilityslots.js'
import {COM_Trade} from '../components/trade.js'
import {COM_Sleep} from '../components/sleep.js'

import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Record from '../infra/record.js'
import Role from './role.js'



export let dbg_hover_npc = false;   // 是否有 npc 被 hover
let player = null;

export function setPlayer(value) {player = value;}

export function getPlayer() {return player;}


export class Player extends Role
{

    get isPlayer() {return true;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    _loadData() {return Record.game.player;}

    _saveData(data) {Record.game.pos = this.pos; Record.game.player = data;}


    async _updateTime(dt) 
    {
        this.emit('onupdate', dt);
        this._send('refresh');
    }

    async _interact(ent, act) 
    {
        if(!act) {return;}
        if(ent) {this.face?.(ent.pos);}

        // return new Promise((resolve)=>{ent.emit(act, resolve, this);});
        await ent.aEmit(act,this);
    }

    _damage() {this._send('refresh');}

    _refresh() {this._send('refresh');}

    _ondead()
    {
        console.log('---- dead ----')
        this.ctx.sta(GM.ST.DEATH)
        this._unregisterTimeSystem();
        this._send('gameover');
    }

   
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    debug(on) {this._dbg=on;}
    dbgStep() {this._dbgRes?.();}
    async dbgWait() 
    {
        if(this._dbg)
        {
            console.log('-------------------- debug wait 0')
            await new Promise((res)=>{this._dbgRes=res;})
            console.log('-------------------- debug wait 1')
        }
    }

    init_prefab()
    {     
        if(!super.init_prefab()) {return;}

        this._registerTimeSystem();             // 註冊 TimeSystem

        this.bb.meta = DB.role(this.bb.id);     // 取得 roleD，放入 bb，view 元件會用到

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:true})
            .addCom(new COM_Inventory())
            .addCom(new COM_Anim())
            .addCom(new COM_Action())
            .addCom(new COM_Nav())
            .addCom(new COM_Sense())
            .addCom(new COM_Stats())

        // 載入
        this.load();
    }

    init_runtime(id)
    {   
        if(!super.init_prefab()) {return;}

        this._registerTimeSystem();    // 註冊 TimeSystem

        this.bb.id = id;
        this.bb.meta = DB.role(id);     // 取得 roleD，放入bb，view 元件會用到
        this.bb.isStatic = false;       // 設成 dynamic body，view 元件會參考
        this.bb.interactive = true;     // 設成 可互動，view 元件會參考

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:false})
            .addCom(new COM_Inventory())
            .addCom(new COM_Anim())
            .addCom(new COM_Action())
            .addCom(new COM_Nav())
            .addCom(new COM_Sense())
            .addCom(new COM_Stats())
            .addCom(new COM_Disp())
            .addCom(new COM_Ability())
            .addCom(new COM_AbilityTree())
            .addCom(new COM_AbilitySlots())
            .addCom(new COM_Trade(false))
            .addCom(new COM_Sleep())
 
        // 註冊 event
        this.on('ondead', this._ondead.bind(this));
        this.on('damage', this._damage.bind(this));
        this.on('refresh', this._refresh.bind(this));

        // options
        this._setAct(GM.PROFILE,true);
        this._setAct(GM.INV,true);

        return this;
    }

    load() {super.load(); this.equip?.();}

    // 跳過這一回合
    next() { this._resume();}

    isInteractive() {return true;}

    async useAbility(target, id)
    {
        if(await this.useAb?.(target, id))
        {
            this._refresh();
            this._resume();
        }
    }

    async act_attack()
    {
        const {bb, root} = this.ctx;
        if (root.inAttackRange?.(bb.ent)) {await this.attack?.(bb.ent);}
        else { await this.move?.(); }
        delete bb.path;
    }

    stop()
    {
        // this.emit('clearPath');
        this.bb.path.stop = true; 
    }

    cmd({pt, ent, act, path}={})
    {
        if(!this.isAlive) {return;}
        
        const {bb,sta} = this.ctx;

        if(sta()===GM.ST.ABILITY)
        {
            this.useAbility(ent);
        }
        else
        {
            bb.ent = ent;
            bb.act = act??ent?.act;
            if(path) { this.setPath?.(path); }
            else { this.findPath?.(pt??ent.pos); }
            this.updatePath?.();
            sta(GM.ST.MOVING);
            this._resume();
        }
    }


    async process()
    {
        // 解構賦值 (destructuring assignment)，
        // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
        // 讓後面程式可以直接取用，讓程式更方便、簡潔
        const {bb,sta} = this.ctx;

        // console.log(bb.path);
        if(!bb.path)
        {
            console.log('-------------------- pause 0')
            await this._pause();
            console.log('-------------------- pause 1')
        }
        
        if(bb.path)
        {
            await this.dbgWait();

            if(bb.act === 'attack')
            {
                await this.act_attack();
            }
            else
            {
                await this.move?.();
                if((bb.cACT.st==='reach')&&bb.ent)
                {
                    sta(GM.ST.ACTION)
                    await this._interact(bb.ent,bb.act);
                }
            }
        }

        if(bb.path) {sta(GM.ST.MOVING);}
        else if(sta()!==GM.ST.SLEEP) 
        {
            sta(GM.ST.IDLE);
            this.anim_idle?.(true);
        }
    }

}