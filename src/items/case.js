import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {Storage} from '../components/inventory.js';
import {GameObject} from '../core/gameobject.js';

export class Box extends GameObject
{
    get acts() {return [GM.OPEN]}
    get act() {return this.acts[0];}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {      
        // console.log('uid:',this.uid,'qid:',this.qid)

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new Storage() )

        // 載入
        this.load();

        // 提供給外界操作
    }

}