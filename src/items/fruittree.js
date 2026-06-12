import {GM} from '../core/setting.js';
import {ItemView} from '../components/view.js';
import {COM_Harvest} from '../components/com_harvest.js';
import {GameObject} from '../core/gameobject.js';

export default class FruitTree extends GameObject
{
    get occludeType() {return GM.OCCLUDE.SOLID;}

    init_prefab()
    {
        if(!super.init_prefab()) {return;}

        const {bb} = this;
        const {meta} = bb;
        if(meta)
        {
            bb.act      = GM.HARVEST;
            bb.zone     = 'fruittree';
            if(meta.fruit)        {bb.harvest     = {id: meta.fruit, count: meta.count ?? 1};}
            if(meta.exhausted_tex){bb.harvest_tex = meta.exhausted_tex;}
            if(meta.full_tex)     {bb.full_tex    = meta.full_tex;}
        }

        bb.interactive = true;
        this.addCom(new ItemView(this.scene), {modify:true})
            .addCom(new COM_Harvest());

        this.load();
    }
}
