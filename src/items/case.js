import {GM} from '../core/setting.js'
import {ItemView} from '../components/view.js'
import {COM_Storage} from '../components/inventory.js'
import {COM_Lock} from '../components/lock.js'
import {GameObject} from '../core/gameobject.js'
import Utility from '../core/utility.js'

export default class Case extends GameObject
{

    get occludeType() {return GM.OCCLUDE.DEVICE;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {      
        if(!super.init_prefab()) {return;}

        // 設成 可互動，view 元件會參考此屬性決定是否顯示互動提示
        this.bb.interactive = true; 

        // 加入元件
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new COM_Storage() )
            .addCom( new COM_Lock(), {enable:!!this.bb.lock} );

        // 載入
        this.load();

        // 提供給外界操作
    }

}