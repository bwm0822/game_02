import DB from '../db.js'
import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {COM_Pickable} from '../components/pickable.js';
import {GameObject} from '../core/gameobject.js';


export class Pickup extends GameObject
{
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    
    init_prefab()
    {        
        if(!super.init_prefab()) {return;}

        this.bb.interactive = true; // 設成 可互動，view 元件會參考

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new COM_Pickable() )

        this.load();

        // 提供給外界操作

        return this;
    }

    init_runtime(content)
    {      
        // console.log('uid:',this.uid,'qid:',this.qid)
        this.bb.content = content;

        const dat = DB.item(content.id);
        this.bb.interactive = true;
        this.bb.wid = GM.TILE_W;
        this.bb.hei = GM.TILE_H;

        if(dat.drop)
        {
            let [key,frame] = dat.drop.sprite.split('/');
            this.bb.key = key;
            this.bb.frame = frame;
            this.bb.scl = dat.drop.scale;
        }
        else
        {
            let [key,frame] = dat.icon.split('/');
            this.bb.key = key;
            this.bb.frame = frame;
        }

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new COM_Pickable() )

        // 載入
        this.load();

        // 提供給外界操作

        return this;

    }



}