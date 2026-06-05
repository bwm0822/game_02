import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Chop} from '../components/com_chop.js';
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
        console.log(dat)
        Object.assign(this.bb, dat.bb);
        console.log('bb=',this.bb)
        

        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Chop());

        this.load();
    }
}
