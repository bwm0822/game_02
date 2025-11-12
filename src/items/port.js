import {GameObject} from '../core/gameobject.js';
import {ItemView} from '../components/view.js';
import {Com_Port} from '../components/port.js';

export class Port extends GameObject
{
    init_prefab()
    {      
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true;     // 設成 可互動，view 元件會參考

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new Com_Port() )

        // 載入
        this.load();

        // 提供給外界操作
    }
}