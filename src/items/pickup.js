import DB from '../db.js';
import {GM} from '../setting.js';
import {ItemView} from '../components/view.js';
import {GameObject} from '../core/gameobject.js';
import Record from '../record.js';

export class Pickup extends GameObject
{
    get acts() {return [GM.TAKE]}
    get act() {return this.acts[0];}
    get content() {return this._content;}
    get lang() {return Record.data.lang;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _pickup(taker)
    {
        if(taker.take(this))
        {
            this._send('msg',`${'_pickup'.lab()} ${this._dat[this.lang].lab}`)
            this._send('out');
            this._send('refresh');
            this._remove();
        }   
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    save() {super.save({...this.pos,...this._content})}
    
    init_prefab()
    {
        if(this._isRemoved()) {return;}

        this._content = {id:this.bb.id, count:this.bb.count??1}
        this._dat = DB.item(this.bb.id);
        this.bb.interactive = true;

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )

        this.load();

        // 提供給外界操作
        this.on(GM.TAKE, (resolve,taker)=>{this._pickup(taker); resolve?.();})

        return this;
    }

    init_runtime({id,count}={})
    {      
        // console.log('uid:',this.uid,'qid:',this.qid)
        console.log(id,count)
        this._content = {id:id,count:count??1};

        const dat = DB.item(id);
        this._dat = dat;
        this.bb.interactive = true;
        this.bb.wid = GM.TILE_W;
        this.bb.hei = GM.TILE_H;

        if(dat.drop)
        {
            let [key,frame] = dat.drop.sprite.split('/');
            this.bb.key = key;
            this.bb.frame = frame;
            this.scale = dat.drop.scale;
        }
        else
        {
            let [key,frame] = dat.icon.split('/');
            this.bb.key = key;
            this.bb.frame = frame;
        }

        // 加入元件  
        this.addCom( new ItemView(this.scene), {modify:false} )

        // 載入
        this.load();

        // 提供給外界操作
        this.on(GM.TAKE, (resolve,taker)=>{this._pickup(taker); resolve?.();})

        return this;

    }



}