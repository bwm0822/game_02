import {GameObject} from '../core/gameobject.js'
import {ItemView,RoleView} from '../components/view.js'
import {Inventory} from '../components/inventory.js'
import {Anim} from '../components/anim.js'
import {Action} from '../components/action.js'
import {Nav} from '../components/nav.js'
import {AiBase, AIController} from '../components/ai/ai.js'
import {Sense} from '../components/sense.js'
import {Stats} from '../components/stats.js'
import DB from '../db.js'
import Record from '../record.js'
import TimeManager from '../time.js'


export let dbg_hover_npc = false;   // 是否有 npc 被 hover
let player = null;

export function setPlayer(value) {player = value;}

export function getPlayer() {return player;}


export class Player extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    get total() {return this.bb.total;}
    get meta() {return this.bb.meta;}
    get id() {return this.bb.id;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    _addToList() {this.scene.roles && this.scene.roles.push(this);}

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    _loadData() {return Record.data.player;}

    _saveData(data) {Record.data.pos = this.pos; Record.data.player = data;}

    _registerTimeManager()
    {
        this._updateTimeCallback = this._updateTime.bind(this); // 保存回调函数引用
        TimeManager.register(this._updateTimeCallback);
    }
    
    _unregisterTimeManager() {TimeManager.unregister(this._updateTimeCallback);}

    async _updateTime(dt) {this._send('refresh');}

    async _interact(ent, act) 
    {
        if(!act) {return;}
        if(ent) {this.emit('face',ent.pos);}

        return new Promise((resolve)=>{ent.emit(act, resolve, this);});
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {     
        this._addToList();

        this.bb.meta = DB.role(this.bb.id);    // 取得roleD，放入bb，view 元件會用到

        // 加入元件
        this.add(new RoleView(this.scene),{modify:true})
            .add(new Inventory())
            .add(new Anim())
            .add(new Action())
            .add(new Nav())
            .add(new Sense())
            .add(new Stats())

        // 載入
        this.load();
    }

    init_runtime(id)
    {     
        this._addToList();
        // 註冊 TimeManager
        this._registerTimeManager()

        this.bb.id = id;
        this.bb.meta = DB.role(id);    // 取得roleD，放入bb，view 元件會用到
        this.bb.isStatic = false;       // 設成 dynamic body，view 元件會參考
        this.bb.interactive = true;     // 設成 可互動，view 元件會參考

        // 加入元件
        this.add(new RoleView(this.scene),{modify:false})
            .add(new Inventory())
            .add(new Anim())
            .add(new Action())
            .add(new Nav())
            .add(new Sense())
            .add(new Stats())
 
        // 註冊 event
        this.on('dead', this.dead.bind(this));

        return this;
    }

    load() {super.load(); this.emit('equip');}

    // 跳過這一回合
    next() { this._resume();}

    execute({pt,ent,act}={})
    {
        const {bb}= this.ctx;
        bb.ent = ent;
        bb.act = act??ent?.act;
        this.emit('findPath',pt??ent.pos);
      
        this._resume();
    }

    isInteractive() {return true;}

    takeDamage(dmg, attacker)
    {
        const {emit} = this.ctx;
        emit('takeDamage', dmg);
        this._send('refresh')
    }

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

        console.log('--------------------- act',bb.act)
        
        if(bb.path)
        {
            if(bb.act === 'attack')
            {
                await this.attack();
            }
            else
            {
                await this.aEmit('move');
                console.log(bb.ent,bb.path?.path.length)
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

    dead()
    {
        console.log('---- dead ----')
    }
    
}