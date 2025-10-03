import {GameObject} from '../core/gameobject.js';
import {ItemView,RoleView} from '../components/view.js';
import {Inventory} from '../components/inventory.js';
import {Anim} from '../components/anim.js';
import {Action} from '../components/action.js';
import {Nav} from '../components/nav.js';
import {AiBase, AIController} from '../components/ai/ai.js';
import {Sense} from '../components/sense.js';
import DB from '../db.js'


export class Man extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    _addToList() {this.scene.roles && this.scene.roles.push(this);}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {     
        this._addToList();

        // 取得roleD，放入bbd，view元件會用到
        console.log(this.bb)
        this.bb.roleD = DB.role(this.bb.id);

        // 加入元件
        this.add(new RoleView(this, true))
            .add(new Inventory(this))
            .add(new Anim(this))
            .add(new Action(this))
            .add(new Nav(this))
            .add(new AIController(this))
            .add(new Sense(this))

        // 載入
        this.load();
    }

    async process()
    {
        // 解構賦值 (destructuring assignment)，
        // 它的作用就是：從物件 ctx 中直接取出需要的屬性，變成同名變數，
        // 讓後面程式可以直接取用，讓程式更方便、簡潔
        const {ai} = this.ctx;  

        await ai?.think();
    }







    
}