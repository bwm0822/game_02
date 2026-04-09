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
import {COM_Cmd} from '../components/cmd.js'

import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Record from '../infra/record.js'
import Role from './role.js'
import {T,dlog} from '../core/debug.js'

export class MPlayer extends Role
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        GM.player = this;
    }

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _loadData() {return Record.game.player;}
    _saveData(data) {Record.game.pos = this.pos; Record.game.player = data;}

    async _updateTime(dt) 
    {
        while(dt>0)
        {
            this.emit('turnstart');
            dt--;
        }
        this._send('refresh');
    }

    async _interact(ent, act) 
    {
        if(!act) {return;}
        if(ent) {this.face?.(ent.pos);}
        await ent.aEmit(act,this);
    }

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------

    init_runtime(id)
    {   
        if(!super.init_prefab(id)) {return;}
        this._registerTimeSystem(); // 註冊 TimeSystem
        
        // 設定 bb
        const{bb}=this.ctx;
        bb.meta = DB.role(bb.id);   // 取得 roleD，放入bb，view 元件會用到
        bb.isStatic = false;        // 設成 dynamic body，view 元件會參考
        bb.interactive = false;     // 設成 可互動，view 元件會參考
        // 取得 圖像
        const [key,frame] = 'buffs:20'.split(':');
        bb.key = key;
        bb.frame = frame;
        bb.wid = 32;
        bb.hei = 32;
        dlog(T.PLAYER)(key,frame);

        // 加入元件
        this.addCom(new ItemView(this.scene),{modify:false})
            .addCom(new COM_Inventory())
            // .addCom(new COM_Anim())
            .addCom(new COM_Action())
            .addCom(new COM_Nav())
            // .addCom(new COM_Sense())
            .addCom(new COM_Stats())
            // .addCom(new COM_Disp())
            .addCom(new COM_Ability())
            // .addCom(new COM_AbilityTree())
            .addCom(new COM_AbilitySlots())
            // .addCom(new COM_Trade(false))
            // .addCom(new COM_Sleep())
            .addCom(new COM_Cmd())
    
        // 註冊 event
        // this.on('ondead', this._ondead.bind(this));
        // this.on('damage', this._damage.bind(this));
        // this.on('refresh', this._refresh.bind(this));

        return this;
    }

    async process()
    {
        const {bb} = this.ctx;

        // console.log(bb.path);
        if(!bb.path)
        {
            dlog(T.PLAYER)('-------------------- pause 0')
            await this._pause();
            dlog(T.PLAYER)('-------------------- pause 1')
        }
        
        if(bb.path)
        {
            await this.move?.();
            if((bb.cACT.st==='reach')&&bb.ent)
            {
                bb.sta=GM.ST.ACTION;
                await this._interact(bb.ent,bb.act);
            }
        }

        if(bb.path) {bb.sta=GM.ST.MOVING;}
        else {bb.sta=GM.ST.IDLE;}
    }
}