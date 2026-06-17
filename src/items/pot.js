import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Manu} from '../components/com_manufacture.js';
import {COM_Pickable} from '../components/com_pickable.js';
import {GameObject} from '../core/gameobject.js';
import DB from '../data/db.js';

export default class Pot extends GameObject
{
    get occludeType() {return GM.OCCLUDE.DEVICE;}

    init_prefab()
    {
        if(!super.init_prefab()) {return;}
        this.bb.interactive = true;
        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Manu())
            .addCom(new COM_Pickable())
        this.load();
    }

    init_runtime(obj)
    {
        if(!super.init_prefab()) {return;}
        this._rtId = obj.id;
        this.bb.interactive = true;
        this.bb.id = obj.id;
        const itemDat = DB.item(obj.id);
        const bbDat = DB.item(itemDat?.device?.id);
        if(bbDat?.bb) {Object.assign(this.bb, bbDat.bb);}
        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Manu())
            .addCom(new COM_Pickable())
        this.load(obj);
    }

    save() {super.save({...this.pos, class:'pot', id:this._rtId});}
}
