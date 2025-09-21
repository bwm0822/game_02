import {ItemView,RoleView} from '../components/view.js';
import {Inv} from '../components/inventory.js';
import {GameObject} from '../core/gameobject.js';
import DB from '../db.js'


export class Man extends GameObject
{
    get acts() {return ['open']}
    get act() {return this.acts[0];}

    init_prefab()
    {     
        this._bb.roleD = DB.role(this._bb.id);

        // 加入元件
        this.add(new RoleView(this,true))
            .add(new Inv(this))


        this.load();

        this._addToList();
    }







    
}