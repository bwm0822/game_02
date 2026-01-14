import {RoleView} from '../components/view.js'
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
import {COM_Sleep} from '../components/sleep.js'
import {COM_Schedule} from '../components/schedule.js'
import {COM_Favor} from '../components/favor.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Role from './role.js'
import QuestManager from '../manager/quest.js'


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
        const {emit, root}=this.ctx;

        if(!this.isAlive) 
        { 
            if(this._latency--<=0) {this._remove();}
            else {root.fadout?.();}
        }
        else
        {
            // await this.aEmit('process', dt);  // await 等待事件處理完成，才繼續往下執行
            // await aEmit('update', dt);
            emit('onupdate', dt);
        }
    }

    _remove()
    {
        this._unregisterTimeSystem();
        if(this.ctx.sta()===GM.ST.DEATH)
        {
            // 死亡時，若是 schedule，則標記為 removed
            if(this.bb.hasSchedule) {{this._saveData({removed:true})}}
        }
        
        super._remove();
    }

    _ondead()
    {
        this.ctx.sta(GM.ST.DEATH)
        this._latency = 5;
        QuestManager.notify({type: GM.KILL, id: this.id});
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab(modify=true)
    {     
        if(!super.init_prefab()) {return;}

        this._registerTimeSystem();         // 註冊 TimeSystem

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
            .addCom(new COM_Sleep())
            .addCom(new COM_Schedule())
            .addCom(new COM_Favor())

        // 綁定 API
        this.exit = this._remove.bind(this);
            
        // 註冊 event
        this.on('ondead', this._ondead.bind(this));

        // 載入
        this.load();
        this.equip?.();

        // option
        this._setAct(GM.ATTACK,true);

        // 檢查是否死亡
        if(!this.isAlive) {this.emit('ondead');}
        
    }

    init_runtime(id)
    {
        this.bb.id = id;                // 將 id 存到 bb.id
        this.init_prefab(false); 
    }

    async cmd_move()
    {
        await this.move?.();
        
        const{bb,sta}=this.ctx;

        if(bb.cACT.st==='reach')
        {
            if(bb.go&&bb.go.act) {sta(GM.ST.ACTION);}
            else {sta(GM.ST.IDLE);}
        }
        else if(bb.cACT.st==='blocked')
        {
            await this.checkBlock();
        }
        else
        {
            this.closeDoorIfNeed();
        }
    }

    async process()
    {
        if(!this.isAlive) {return;}

        await this.think?.();
    }


    async process_old()
    {
        if(!this.isAlive) {return;}

        await this.think?.();

        const{bb,sta,root}=this.ctx;

        if(bb.path)
        {
            // return;
            console.log('------------------ process move');
            await this.move?.();
            if(bb.cACT.st==='reach')
            {
                if(bb.go&&bb.go.act) {sta(GM.ST.ACTION);}
                else {sta(GM.ST.IDLE);}
            }
            else if(bb.cACT.st==='blocked')
            {
                await root.checkBlock();
            }
            else
            {
                root.closeDoorIfNeed();
            }
        }
        else
        {
            if(sta()!==GM.ST.SLEEP) {this.anim_idle?.(true);}
            if(sta()===GM.ST.ACTION)
            {
                if(bb.go.act==='enter')
                {
                    this._remove();
                    return;
                }
                else
                {
                    sta(GM.ST.IDLE);
                    bb.go.emit(bb.go.act, this);
                }
            }
        }



        // if(sta()!==GM.ST.MOVING)
        // {
        //     if(this.bb.path) {this.clearPath?.();}
        //     if(sta()!==GM.ST.SLEEP) {this.anim_idle?.(true);}
        // }


        if(_dbg) {this.updateDebugPath?.();}
    }
    
}