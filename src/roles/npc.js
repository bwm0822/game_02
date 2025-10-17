import {ItemView,RoleView} from '../components/view.js'
import {Inventory} from '../components/inventory.js'
import {Anim} from '../components/anim.js'
import {Action} from '../components/action.js'
import {Nav} from '../components/nav.js'
import {AiBase, AIController} from '../components/ai/ai.js'
import {Sense} from '../components/sense.js';
import {Disp} from '../components/disp.js'
import DB from '../db.js'
import {Stats} from '../components/stats.js'
import {GM} from '../setting.js';
import {Role} from './role.js';


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
        this._removeFromList();
        this._unregisterTimeManager();
        this._ent.destroy();
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
        this._addToList();
        this._registerTimeManager();

        // 取得roleD，放入bb，view元件會用到
        this.bb.meta = DB.role(this.bb.id);

        // 加入元件
        this.add(new RoleView(this.scene),{modify:true})
            .add(new Inventory(this.bb.meta))
            .add(new Anim())
            .add(new Action())
            .add(new Nav())
            .add(new AIController())
            .add(new Sense())
            .add(new Stats())
            .add(new Disp())

        // 註冊 event
        this.on('dead', this._dead.bind(this));

        // 載入
        this.load();
        this.emit('equip');
    }

    async process()
    {
        if(!this.isAlive) {return;}

        await this.aEmit('think');
    }
    
}