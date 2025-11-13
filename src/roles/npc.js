import {ItemView,RoleView} from '../components/view.js'
import {COM_Inventory} from '../components/inventory.js'
import {COM_Anim} from '../components/anim.js'
import {COM_Action} from '../components/action.js'
import {COM_Nav} from '../components/nav.js'
import {COM_AI} from '../components/ai/ai.js'
import {COM_Sense} from '../components/sense.js'
import {COM_Disp} from '../components/disp.js'
import {COM_Talk} from '../components/talk.js'
import {COM_Trade} from '../components/trade.js'
import {COM_Stats} from '../components/stats.js'
import DB from '../db.js'
import {GM} from '../setting.js';
import {Role} from './role.js';
import QuestManager from '../quest.js'

let _dbg = true;

export class Npc extends Role
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this._setAct(GM.OBSERVE,true);
    }

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
        // 死亡時，若是 schedule，則標記為 removed
        if(this.schedule) {{this._saveData({removed:true})}}
        super._remove();
    }

    _dead()
    {
        this._latency = 5;
        QuestManager.notify({type: GM.KILL, id: this.id});
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab(modify=true)
    {     
        if(!super.init_prefab()) {return;}

        this._registerTimeManager();

        this.bb.meta = DB.role(this.bb.id); // 取得roleD，放入bb.meta，view元件會用到
        this.bb.isStatic = false;           // 設成 dynamic body，view 元件會參考
        this.bb.interactive = true;         // 設成 可互動，view 元件會參考

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:modify})
            .addCom(new COM_Inventory(this.bb.meta))
            .addCom(new COM_Anim())
            .addCom(new COM_Action())
            .addCom(new COM_Nav())
            .addCom(new COM_AI())
            .addCom(new COM_Sense())
            .addCom(new COM_Stats())
            .addCom(new COM_Disp())
            .addCom(new COM_Talk())
            .addCom(new COM_Trade())

        // 註冊 event
        this.on('dead', this._dead.bind(this));

        // 載入
        this.load();
        this.equip?.();

        //
        this._setAct(GM.ATTACK,true);

        // 檢查是否死亡
        if(!this.isAlive) {this.emit('dead');}
    }

    init_runtime(id, schedule=false)
    {
        this.bb.id = id;                // 將 id 存到 bb.id
        this.schedule = schedule;
        this.init_prefab(false); 
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