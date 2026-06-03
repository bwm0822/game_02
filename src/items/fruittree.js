import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_FruitTree} from '../components/com_fruittree.js';
import {GameObject} from '../core/gameobject.js';

export default class FruitTree extends GameObject
{
    get occludeType() {return GM.OCCLUDE.SOLID;}

    init_prefab()
    {
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;

        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_FruitTree());

        this.load();
    }
}
