import Utility from '../utility.js';
import DB from '../db.js';
import {Pickup} from '../items/pickup.js';
import AudioManager from '../audio.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供儲存物品的功能
//--------------------------------------------------
export class Storage
{
    constructor(capacity=-1)
    {
        this._storage = {capacity:capacity,items:[]}
    }

    get tag() {return 'inv';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}
    get ctx() {return this._root.ctx;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _findEmpty()
    {
        let capacity = this._storage.capacity;
        let count = this._storage.items.length;
        let foundIndex = this._storage.items.findIndex(slot=>Utility.isEmpty(slot))
        let i = foundIndex!=-1 ? foundIndex 
                            : capacity==-1 || count<capacity ? count 
                                                                : -1;
        return i;
    }


    _put(id, count)
    {
        let cps = DB.item(id).cps ?? 1;

        let i = 0;
        let capacity = this._storage.capacity;
        let len = this._storage.items.length;
        let items = this._storage.items;
        while(count>0 && (capacity == -1 || i<capacity))
        {
            if(i<len)
            {
                if(Utility.isEmpty(items[i]))
                {
                    items[i]={id:id, count:Math.min(count,cps)}
                    count-=items[i].count

                }
                else if(items[i].id==id && items[i].count<cps)
                {
                    let sum = items[i].count+count;
                    items[i].count = Math.min(sum,cps)
                    count = sum-cps;
                }
            }
            else
            {
                let min = Math.min(count,cps);
                items.push({id:id, count:min});
                count-=min;
            }
            i++;
        }

        if(count>0)
        {
            let ent = {label:id.lab(),content:{id:id,count:count}}
            this._drop(ent)
        }
        
    }


    _take(ent, i)
    {
        // console.log("take",ent,i);

        !i && (i = this._findEmpty());

        if(i!=-1)
        {
            console.log(i,ent.content)
            this._storage.items[i]=ent.content;
            return true;
        }
        else
        {  
            this._send('msg','_space_full'.lab());
            return false;
        }
    }

    _split(ent, cnt)
    {
        console.log('---- split')
        ent.itm.count -= cnt;
        let split = {id:ent.itm.id,count:cnt};
        let i = this._findEmpty();
        console.log(i)
        if(i!=-1) {
            this._storage.items[i]=split;
        }
        console.log( this._storage)
    }

    _drop(ent)
    {
        console.log('drop',ent)
        let p = this.scene.map.getValidPoint(this.pos);
        let go = new Pickup(this.scene,this.pos.x,this.pos.y-32).init_runtime(ent.content);
        go.falling(p);
        AudioManager.drop();
        // this._send('msg',`${'_drop'.lab()} ${ent.itm.id.lab()}`);
        const {emit}=this.ctx;
        emit('msg',`${'_drop'.lab()} ${ent.dat['tw'].lab}`);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        
        // 在上層綁定操作介面，提供給其他元件使用
        root.prop('storage', this, '_storage');
        root.put = this._put.bind(this);
        root.take = this._take.bind(this);
        root.split = this._split.bind(this);
        root.drop = this._drop.bind(this);
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) {Object.assign(this._storage, data.storage);}
    save() {return {storage:this._storage};}


    

}



//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供裝備、儲存物品的功能
//--------------------------------------------------
export class Inventory extends Storage
{
    constructor(config={capacity:-1,equips:[],gold:0})
    {
        super(config.capacity);
        this._equips = config.equips;
        this._gold = config.gold;
    }

    get ctx() {return this._root.ctx;}
   
    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    _receive(rewards)
    {
        rewards.forEach((reward)=>{
            switch(reward.type)
            {
                case 'gold': this._gold+=reward.count; break;
                case 'item': this._put(reward.id, reward.count); break;
            }
        })       
    }

    // _getEquipped() { return this._equips.filter(Boolean); }

    _equip() 
    {
        const {emit}=this.ctx; 
        emit('equip');
        emit('dirty'); // 更新屬性
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 在上層綁定操作介面，提供給外部使用
        root.prop('equips', this, '_equips');
        root.prop('gold', this, '_gold');
        root.equip = this._equip.bind(this);
        root.receive = this._receive.bind(this);

        // 共享裝備資料
        root.bb.equips = this._equips;
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) 
    {
        if(data.storage) {Object.assign(this._storage, data.storage); }
        if(data.equips) {Object.assign(this._equips, data.equips);}
    }

    save() {return {storage:this._storage, equips:this._equips};}

}
