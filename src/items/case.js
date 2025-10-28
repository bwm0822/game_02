import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {Storage} from '../components/inventory.js';
import {GameObject} from '../core/gameobject.js';
import { Pickable } from '../components/pickable.js';

export class Box extends GameObject
{
    get acts() {return [GM.OPEN]}
    get act() {return this.acts[0];}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _open()
    {
        this._send('storage', this); 
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    init_prefab()
    {      
        // console.log('uid:',this.uid,'qid:',this.qid)

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:true} )
            .addCom( new Storage() )

        console.log('----------------- bb=',this.bb)

        // 載入
        this.load();

        // 提供給外界操作
        this.on('open', (resolve)=>{this._open(); resolve?.();})

    }

}