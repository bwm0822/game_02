import {ItemView,RoleView} from '../components/view.js'
import {Inventory} from '../components/inventory.js'
import {Anim} from '../components/anim.js'
import {Action} from '../components/action.js'
import {Nav} from '../components/nav.js'
import {AIController} from '../components/ai/ai.js'
import {Sense} from '../components/sense.js';
import {Disp} from '../components/disp.js'
import DB from '../db.js'
import {Stats} from '../components/stats.js'
import {GM} from '../setting.js';
import {Role} from './role.js';

let _dbg = true;

export class Npc extends Role
{

    get acts() {return [GM.ATTACK,GM.OBSERVE]}
    get act() {return this.acts[0];}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    async _updateTime(dt) 
    {
        const {emit, aEmit}=this.ctx;

        if(!this.isAlive) 
        { 
            if(this._latency--<=0) {this._remove();}
            else {emit('fadout');}
        }
        else
        {
            // await this.aEmit('process', dt);  // await 等待事件處理完成，才繼續往下執行
            await aEmit('update', dt);
        }
    }

    _remove()
    {
        this._unregisterTimeManager();
        super._remove();
    }

    _dead()
    {
        this.isAlive = false;
        this._latency = 5;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {     
        if(this._isRemoved()) {return;}

        this._registerTimeManager();

        // 取得roleD，放入bb，view元件會用到
        this.bb.meta = DB.role(this.bb.id);

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:true})
            .addCom(new Inventory(this.bb.meta))
            .addCom(new Anim())
            .addCom(new Action())
            .addCom(new Nav())
            .addCom(new AIController())
            .addCom(new Sense())
            .addCom(new Stats())
            .addCom(new Disp())

        // 註冊 event
        this.on('dead', this._dead.bind(this));

        // 載入
        this.load();
        this.equip?.();
    }

    async process()
    {
        if(!this.isAlive) {return;}

        await this.aEmit('think');

        if(this.state!==GM.ST_MOVING && this.bb.path)
        {
            this.emit('clearPath');
        }

        if(_dbg) {this.emit('updateDebugPath');}
    }
    
}