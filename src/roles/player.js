import {ItemView,RoleView} from '../components/view.js'
import {COM_Inventory} from '../components/com_inventory.js'
import {COM_Anim} from '../components/com_anim.js'
import {COM_Action} from '../components/com_action.js'
import {COM_Nav} from '../components/com_nav.js'
import {COM_Sense} from '../components/com_sense.js'
import {COM_Stats} from '../components/com_stats.js'
import {COM_Disp} from '../components/com_disp.js'
import {COM_Ability} from '../components/com_ability.js'
import {COM_AbilityTree} from '../components/com_abilitytree.js'
import {COM_AbilitySlots} from '../components/com_abilityslots.js'
import {COM_Trade} from '../components/com_trade.js'
import {COM_Sleep} from '../components/com_sleep.js'
import {COM_Cmd} from '../components/com_cmd.js'
import {COM_Light} from '../components/com_light.js'

import DB from '../data/db.js'
import {GM,GS} from '../core/setting.js'
import Record from '../infra/record.js'
import Role from './role.js'
import {T,dlog} from '../core/debug.js'
import Utility from '../core/utility.js'
import UiEffect from '../ui/uieffect.js'
import { UP } from 'phaser'
import Map from '../manager/map.js'


export class Player extends Role
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        GM.player = this;
    }

    get isPlayer() {return true;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    _loadData() {return Record.game.player;}

    _saveData(data) {Record.game.pos = this.pos; Record.game.player = data;}

    _updateTime() 
    {
        // this.emit(GM.EVT.UPDATETIME);
        super._updateTime()
        this._refresh();
    }

    _damage() {this._send('refresh');}

    _refresh() {this._send('refresh');}

    async _ondead()
    {
        dlog(T.PLAYER)('---- dead ----')
        this.ctx.bb.sta=GM.ST.DEATH;
        this.unregTS();
        await this.waitDying?.();
        await Utility.delay(500);
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
            dlog(T.PLAYER)('-------------------- debug wait 0')
            await new Promise((res)=>{this._dbgRes=res;})
            dlog(T.PLAYER)('-------------------- debug wait 1')
        }
    }

    init_prefab(id)
    {     
        if(!super.init_prefab(id)) {return;}
        // this._registerTimeSystem();             // 註冊 TimeSystem
        this.regTS();                               // 註冊 TimeSystem

        this.bb.meta = DB.role(this.bb.id);     // 取得 roleD，放入 bb，view 元件會用到

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:true})
            .addCom(new COM_Inventory())
            .addCom(new COM_Light())
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
        if(!super.init_prefab(id)) {return;}
        this.regTS();               // 註冊 TimeSystem

        // 設定 bb
        const{bb}=this.ctx;
        bb.meta = DB.role(bb.id);   // 取得 roleD，放入bb，view 元件會用到
        bb.isStatic = false;        // 設成 dynamic body，view 元件會參考
        bb.interactive = true;      // 設成 可互動，view 元件會參考

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:false})
            .addCom(new COM_Inventory())
            .addCom(new COM_Light())
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
            .addCom(new COM_Cmd())
 
        // 註冊 event
        this.on(GM.EVT.ONDEAD, this._ondead.bind(this));
        this.on(GM.EVT.DAMAGE, this._damage.bind(this));
        this.on(GM.EVT.REFRESH, this._refresh.bind(this));

        // options
        this._setAct(GM.PROFILE,()=>GM.EN);
        this._setAct(GM.INV,()=>GM.EN);

        return this;
    }

    load() {super.load(); this.equip?.();}

    // 跳過這一回合
    next() { this._resume();}

    isInteractive() {return true;}

    async useAbility(target, id, pt)
    {
        if(await this.useAb?.(target, id, pt))
        {
            this._refresh();
            this._resume();
        }
    }

    // async act_attack()
    // {
    //     const {bb, root} = this.ctx;
    //     if (root.inAttackRange?.(bb.ent)) {await this.attack?.(bb.ent);}
    //     else { await this.move?.(); }
    //     delete bb.path;
    // }

    stop()
    {
        // this.emit('clearPath');
        if(this.bb.path) {this.bb.path.stop = true;}
    }

    async process({skipTurnStart=false}={})
    {
        // 解構賦值 (destructuring assignment)，
        // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
        // 讓後面程式可以直接取用，讓程式更方便、簡潔
        const {bb,emit,aEmit} = this.ctx;
        if(!skipTurnStart)
        {
            if(GS.mode===GM.MODE.NORMAL) {emit(GM.EVT.TURNSTART);}
            else {await aEmit(GM.EVT.TURNSTART);}
        }
        this._refresh();

        // 被控制：打斷移動/互動，這回合不等輸入直接結束
        const ctrl = this.total.states.ctrl;
        if(ctrl)
        {
            this.stop();
            this._pending = null;
            bb.ent = null;
            bb.sta = GM.ST.IDLE;
        }

        // 走到目標那一步的時間要先結算(TimeSystem.inc)才互動，互動開的 UI 才會停在 _pause() 期間
        if(this._pending)
        {
            const {ent,act} = this._pending;
            this._pending = null;
            if(ent.scene && this.isAt(ent)) {await this.interact?.(ent,act);}
        }

        if(!ctrl && bb.sta!==GM.ST.MOVING)
        {
            dlog(T.PLAYER)('-------------------- pause 0')
            await this._pause();
            dlog(T.PLAYER)('-------------------- pause 1')
        }
        
        if(bb.sta===GM.ST.MOVING)
        {
            await this.dbgWait();
            await this.move?.();
            if(bb.cACT.st==='reach')
            {
                if(bb.ent) {this._pending = {ent:bb.ent, act:bb.act}; bb.ent = null;}
                bb.sta=GM.ST.IDLE;
            }
            else if(bb.cACT.st==='blocked')
            {
                console.log('path blocked');
                bb.sta=GM.ST.IDLE;
            }
            else if(bb.cACT.st==='stopped')
            {
                bb.ent = null;   // 玩家自己取消移動，不要互動、也不要留著舊目標
                bb.sta=GM.ST.IDLE;
            }
        }

        if(bb.sta===GM.ST.IDLE) {this.anim_idle?.(true);}

        emit(GM.EVT.TURNEND);
        this._refresh();
    }


    // async process({skipTurnStart=false}={})
    // {
    //     // 解構賦值 (destructuring assignment)，
    //     // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
    //     // 讓後面程式可以直接取用，讓程式更方便、簡潔
    //     const {bb,emit,aEmit} = this.ctx;
    //     if(!skipTurnStart)
    //     {
    //         if(GS.mode===GM.MODE.NORMAL) {emit(GM.EVT.TURNSTART);}
    //         else {await aEmit(GM.EVT.TURNSTART);}
    //     }
    //     this._refresh();

    //     // console.log(bb.path);
    //     if(!bb.path)
    //     {
    //         dlog(T.PLAYER)('-------------------- pause 0')
    //         await this._pause();
    //         dlog(T.PLAYER)('-------------------- pause 1')
    //     }

    //     console.log('path=',bb.path)
        
    //     if(bb.path)
    //     {
    //         await this.dbgWait();

    //         if(bb.act === GM.ATTACK)
    //         {
    //             await this.act_attack();
    //         }
    //         else
    //         {
    //             await this.move?.();
    //             if((bb.cACT.st==='reach')&&bb.ent)
    //             {
    //                 bb.sta=GM.ST.ACTION;
    //                 await this.interact?.(bb.ent,bb.act);
    //             }
    //         }
    //     }

    //     if(bb.path) {bb.sta=GM.ST.MOVING;}
    //     else if(bb.sta!==GM.ST.SLEEP) 
    //     {
    //         bb.sta=GM.ST.IDLE;
    //         this.anim_idle?.(true);
    //     }

    //     emit(GM.EVT.TURNEND);
    //     this._refresh();
    // }

}