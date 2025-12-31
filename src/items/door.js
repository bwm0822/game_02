import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {COM_Door} from '../components/door.js';
import {GameObject} from '../core/gameobject.js';

export class Door extends GameObject
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

        this.bb.interactive = true; // 設成 可互動，view 元件會參考

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new COM_Door() )

        // 載入
        this.load();

        // 提供給外界操作
    }

}