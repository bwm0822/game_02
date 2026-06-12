import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Harvest} from '../components/com_harvest.js';
import {GameObject} from '../core/gameobject.js';
import DB from '../data/db.js';

export default class Tree extends GameObject
{
    get occludeType() {return this.harvest ? GM.OCCLUDE.NONE : GM.OCCLUDE.SOLID;}

    init_prefab()
    {
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;
        const dat=DB.item(this.id);
        Object.assign(this.bb, dat.bb);

        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Harvest());

        this.load();
    }
}
