import DB from '../db.js'
import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {Pickable} from '../components/pickable.js';
import {GameObject} from '../core/gameobject.js';


export class Pickup extends GameObject
{
    // get acts() {return [GM.TAKE]}
    // get act() {return this.acts[0];}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    
    init_prefab()
    {        
        if(this._isRemoved()) {return;}

        this.bb.interactive = true;

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )
            .addCom( new Pickable() )

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
            .addCom( new Pickable() )

        // 載入
        this.load();

        // 提供給外界操作

        return this;

    }



}