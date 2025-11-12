import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {COM_Storage} from '../components/inventory.js';
import {GameObject} from '../core/gameobject.js';

export class Box extends GameObject
{

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {      
        if(!super.init_prefab()) {return;}

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new COM_Storage() )

        // 載入
        this.load();

        // 提供給外界操作
    }

}