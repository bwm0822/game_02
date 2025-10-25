import {ItemView,RoleView} from '../components/view.js'
import {Inventory} from '../components/inventory.js'
import {Anim} from '../components/anim.js'
import {Action} from '../components/action.js'
import {Nav} from '../components/nav.js'
import {Sense} from '../components/sense.js'
import {Stats} from '../components/stats.js'
import {Disp} from '../components/disp.js'
import {Skill} from '../components/skill.js'
import {SkillTree} from '../components/skilltree.js'
import {SkillSlots} from '../components/skillslots.js'

import DB from '../db.js'
import Record from '../record.js'
import {Role} from './role.js';


export let dbg_hover_npc = false;   // 是否有 npc 被 hover
let player = null;

export function setPlayer(value) {player = value;}

export function getPlayer() {return player;}


export class Player extends Role
{

    get acts() {return ['profile','inv']}
    get act() {return this.acts[0];}

    // get total() {return this.bb.total;}
    get meta() {return this.bb.meta;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    _loadData() {return Record.data.player;}

    _saveData(data) {Record.data.pos = this.pos; Record.data.player = data;}


    async _updateTime(dt) 
    {
        this.emit('update', dt);
        this._send('refresh');
    }

    async _interact(ent, act) 
    {
        if(!act) {return;}
        if(ent) {this.emit('face',ent.pos);}

        return new Promise((resolve)=>{ent.emit(act, resolve, this);});
    }

    _damage() {this._send('refresh');}

    _refresh() {this._send('refresh');}

    _dead()
    {
        console.log('---- dead ----')
        this.isAlive = false;
        this._unregisterTimeManager();
        this._send('gameover');
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {     
        this._registerTimeManager()

        this.bb.meta = DB.role(this.bb.id);    // 取得roleD，放入bb，view 元件會用到

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:true})
            .addCom(new Inventory())
            .addCom(new Anim())
            .addCom(new Action())
            .addCom(new Nav())
            .addCom(new Sense())
            .addCom(new Stats())

        // 載入
        this.load();
    }

    init_runtime(id)
    {     
        // 註冊 TimeManager
        this._registerTimeManager()

        this.bb.id = id;
        this.bb.meta = DB.role(id);     // 取得 roleD，放入bb，view 元件會用到
        this.bb.isStatic = false;       // 設成 dynamic body，view 元件會參考
        this.bb.interactive = true;     // 設成 可互動，view 元件會參考

        // 加入元件
        this.addCom(new RoleView(this.scene),{modify:false})
            .addCom(new Inventory())
            .addCom(new Anim())
            .addCom(new Action())
            .addCom(new Nav())
            .addCom(new Sense())
            .addCom(new Stats())
            .addCom(new Disp())
            .addCom(new Skill())
            .addCom(new SkillTree())
            .addCom(new SkillSlots())
 
        // 註冊 event
        this.on('dead', this._dead.bind(this));
        this.on('damage', this._damage.bind(this));
        this.on('refresh', this._refresh.bind(this));

        return this;
    }

    load() {super.load(); this.equip?.();}

    // 跳過這一回合
    next() { this._resume();}

    async useSkill(target, id)
    {
        if(await this.aEmit('useSkill', target, id))
        {
            this._refresh();
            this._resume();
        }
    }

    async execute({pt,ent,act}={})
    {
        if(!this.isAlive) {return;}
        
        const {bb}= this.ctx;
        if(bb.skillSel) 
        {
            if(await this.aEmit('useSkill',ent))
            {
                this._refresh();
                this._resume();
            }
        }
        else
        {
            bb.ent = ent;
            bb.act = act??ent?.act;
            this.emit('findPath',pt??ent.pos);
            this._resume();
        }
    }

    isInteractive() {return true;}

    async process()
    {
        // 解構賦值 (destructuring assignment)，
        // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
        // 讓後面程式可以直接取用，讓程式更方便、簡潔
        const {bb} = this.ctx;

        if(!bb.path)
        {
            console.log('-------------------- pause 0')
            await this._pause();
            console.log('-------------------- pause 1')
        }
        
        if(bb.path)
        {
            if(bb.act === 'attack')
            {
                await this.attack();
            }
            else
            {
                await this.aEmit('move');
                if(bb.ent && bb.path?.path.length===1)
                {
                    delete bb.path;
                    await this._interact(bb.ent,bb.act);
                }
            }
        }
    }

    async attack()
    {
        const {bb, emit, aEmit} = this.ctx;
        if (emit('inAttackRange',bb.ent)) {await aEmit('attack',bb.ent);}
        else { await this.aEmit('move'); }
        delete bb.path;
    }


    
}