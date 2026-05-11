import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import {ItemView} from '../components/view.js'
import {COM_Pickable} from '../components/pickable.js'
import {GameObject} from '../core/gameobject.js'


export default class Pickup extends GameObject
{
    get occludeType() {return GM.OCCLUDE.DROP;}
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    
    init_prefab()
    {        
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true; // 設成 可互動，view 元件會參考
        this.bb.weight = 0;

        // 加入元件
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new COM_Pickable() )

        this.load();

        // 提供給外界操作

        return this;
    }

    init_runtime(content)
    {      
        if(!super.init_prefab()) {return;}
        // console.log('uid:',this.uid,'qid:',this.qid)
        this.bb.content = content;
        this.bb.weight = 0;
        this.bb.occludeType = GM.OCCLUDE.DROP;

        const dat = DB.item(content.id);
        this.bb.interactive = true;
        this.bb.wid = GM.TILE_W;
        this.bb.hei = GM.TILE_H;

        const icon = dat.drop?.sprite??dat.icon;
        const [key,frame] = dat.icon.split(':');
        this.bb.key = key;
        this.bb.frame = frame;
        if(dat.drop?.scale) {this.bb.scl=dat.drop.scale;}

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new COM_Pickable() )

        // 載入
        this.load();

        // 提供給外界操作

        return this;

    }



}