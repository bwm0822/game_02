import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Lamp} from '../components/com_lamp.js';
import {GameObject} from '../core/gameobject.js';

export default class Lamp extends GameObject
{
    get occludeType() {return GM.OCCLUDE.DEVICE;}

    init_prefab()
    {
        if (!super.init_prefab()) {return;}

        this.bb.interactive = true;

        this.addCom(new ItemView(this.scene), {modify: true})
            .addCom(new COM_Lamp())

        this.load();
    }
}
