import {GameObject} from '../core/gameobject.js';
import {ItemView,RoleView} from '../components/view.js';
import {Inventory} from '../components/inventory.js';
import {Anim} from '../components/anim.js';
import {Action} from '../components/action.js';
import {Nav} from '../components/nav.js';
import {AiBase, AIController} from '../components/ai/ai.js';
import {Sense} from '../components/sense.js';
import {Stats} from '../components/stats.js';
import DB from '../db.js'

export let dbg_hover_npc = false;   // 是否有 npc 被 hover
let player = null;

export function setPlayer(value) {player = value;}

export function getPlayer() {return player;}


export class Role extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    _addToList() {this.scene.roles && this.scene.roles.push(this);}

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}
    _resume() {this._resolve?.();this._resolve=null;}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {     
        this._addToList();

        this.bb.roleD = DB.role(this.bb.id);    // 取得roleD，放入bbd，view 元件會用到

        // 加入元件
        this.add(new RoleView(this, true))
            .add(new Inventory(this))
            .add(new Anim(this))
            .add(new Action(this))
            .add(new Nav(this))
            .add(new Sense(this))
            .add(new Stats(this))

        // 載入
        this.load();
    }

    init_runtime(id)
    {     
        this._addToList();

        this.bb.roleD = DB.role(id);    // 取得roleD，放入bb，view 元件會用到
        this.bb.isStatic = false;       // 設成 dynamic body，view 元件會參考
        this.bb.interactive = true;     // 設成 可互動，view 元件會參考

        // 加入元件
        this.add(new RoleView(this, false))
            .add(new Inventory(this))
            .add(new Anim(this))
            .add(new Action(this))
            .add(new Nav(this))
            .add(new Sense(this))
            .add(new Stats(this))

        return this;
    }

    load() {}

    // 跳過這一回合
    next() { this._resume();}

    execute({pt,ent,act}={})
    {
        const {bb, nav} = this.ctx;
        bb.ent = ent;
        bb.act = act;
        nav.findPath(pt??ent.pos);
      
        this._resume();
    }

    isInteractive() {return true;}

    interact(ent, act) 
    {
        if(!act) {return;}
        const {view} = this.ctx;
        if(ent) {view._faceTo(ent.pos);}

        return new Promise((resolve)=>{ent.emit(act, resolve, this._role);});
    }

    async process()
    {
        // 解構賦值 (destructuring assignment)，
        // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
        // 讓後面程式可以直接取用，讓程式更方便、簡潔
        const {bb, action} = this.ctx;

        if(!bb.path)
        {
            console.log('-------------------- pause 0')
            await this._pause();
            console.log('-------------------- pause 1')
        }
        
        if(bb.path)
        {
            await action.move();
            console.log(bb.ent,bb.path?.path.length)
            if(bb.ent && bb.path?.path.length===1)
            {
                delete bb.path;
                await this.interact(bb.ent,bb.act);
            }
        }
    }







    
}