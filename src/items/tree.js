import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Tree} from '../components/com_tree.js';
import {GameObject} from '../core/gameobject.js';

export default class Tree extends GameObject
{
    get occludeType() {return GM.OCCLUDE.SOLID;}

    init_prefab()
    {
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;

        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Tree());

        this.load();
    }
}
