import Utility from '../utility.js';
import DB from '../db.js';

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

    get storage() {return this._storage;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _findEmpty()
    {
        let capacity = this.storage.capacity;
        let count = this.storage.items.length;
        let foundIndex = this.storage.items.findIndex(slot=>Utility.isEmpty(slot))
        let i = foundIndex!=-1 ? foundIndex 
                            : capacity==-1 || count<capacity ? count 
                                                                : -1;
        return i;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        
        // 在上層綁定操作介面，提供給其他元件使用
        root.storage = this.storage;
        root.put = this.put.bind(this);
        root.take = this.take.bind(this);
        root.split = this.split.bind(this);
        root.drop = this.drop.bind(this);
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) {Object.assign(this._storage, data.storage);}
    save() {return {storage:this._storage};}


    put(id, count)
    {
        let cps = DB.item(id).cps ?? 1;

        let i = 0;
        let capacity = this.storage.capacity;
        let len = this.storage.items.length;
        let items = this.storage.items;
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
            let ent = {label:id.lab(),itm:{id:id,count:count}}
            this.drop(ent)
        }
        
    }


    take(ent, i)
    {
        !i && (i = this._findEmpty());

        if(i!=-1)
        {
            this.storage.items[i]=ent.itm;
            return true;
        }
        else
        {  
            this._send('msg','_space_full'.lab());
            return false;
        }
    }

    split(ent, cnt)
    {
        console.log('---- split')
        ent.itm.count -= cnt;
        let split = {id:ent.itm.id,count:cnt};
        let i = this._findEmpty();
        console.log(i)
        if(i!=-1) {
            this.storage.items[i]=split;
        }
        console.log( this.storage)
    }

    drop()
    {
        console.log('drop')
    }

}



//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供裝備、儲存物品的功能
//--------------------------------------------------
export class Inventory extends Storage
{
    constructor(root, capacity=-1)
    {
        super(root, capacity);
        this._equips = [];
        this._gold = 0;
    }

    
    get ctx() {return this._root.ctx;}
    get equips() {return this._equips;}

    get gold() {return this._gold;}
    set gold(value) {this._gold = value;}
    
   
    //------------------------------------------------------
    // Local
    //------------------------------------------------------

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 在上層綁定操作介面，提供給外部使用
        root.inv = this; 

        root.prop('gold', this, '_gold')

        // 共享裝備資料
        root.bb.equips = this.equips;
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) 
    {
        Object.assign(this._storage, data.storage); 
        Object.assign(this._equips, data.equips);
    }

    save() {return {storage:this._storage, equips:this._equips};}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    equip() 
    {
        const {emit}=this.ctx; 
        emit('equip');
    }

    getEquipped() { return this.equips.filter(Boolean); }
}
