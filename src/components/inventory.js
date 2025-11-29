import Com from './com.js'
import Utility from '../utility.js'
import DB from '../db.js'
import {Pickup} from '../items/pickup.js'
import AudioManager from '../audio.js'
import {GM} from '../setting.js'


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供儲存物品的功能
//--------------------------------------------------
export class COM_Storage extends Com
{
    constructor(capacity=-1)
    {
        super();
        this._storage = {capacity:capacity,items:[]}
    }

    get tag() {return 'inv';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}
    get storage() {return this._storage;}

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


    // _put(id, count)
    // {
    //     let cps = DB.item(id).cps ?? 1;

    //     let i = 0;
    //     let capacity = this._storage.capacity;
    //     let len = this._storage.items.length;
    //     let items = this._storage.items;
    //     while(count>0 && (capacity == -1 || i<capacity))
    //     {
    //         if(i<len)
    //         {
    //             if(Utility.isEmpty(items[i]))
    //             {
    //                 items[i]={id:id, count:Math.min(count,cps)}
    //                 count-=items[i].count

    //             }
    //             else if(items[i].id==id && items[i].count<cps)
    //             {
    //                 let sum = items[i].count+count;
    //                 items[i].count = Math.min(sum,cps)
    //                 count = sum-cps;
    //             }
    //         }
    //         else
    //         {
    //             let min = Math.min(count,cps);
    //             items.push({id:id, count:min});
    //             count-=min;
    //         }
    //         i++;
    //     }

    //     if(count>0)
    //     {
    //         let ent = {label:id.lab(),content:{id:id,count:count}}
    //         this._drop(ent)
    //     }
        
    // }

    _get(content)
    {
        let {id,count}=content;
        delete content.count;   // 從 content 移除 count 屬性
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
                    const cnt = Math.min(count,cps)
                    items[i]={...content,count:cnt};
                    count-=cnt;

                }
                else if(items[i].id==id && items[i].count<cps)
                {
                    const sum = items[i].count+count;
                    items[i]={...items[i],...content}
                    items[i].count = Math.min(sum,cps)
                    count = sum-cps;
                }
            }
            else    // 新的欄位
            {
                const cnt = Math.min(count,cps);
                items.push({...content,count:cnt});
                count-=cnt;
            }
            i++;
        }

        return count;
    }


    _take(content,i,isEquip)
    {
        const{bb,emit}=this.ctx;

        if(isEquip)
        {
            bb.equips[i]=content;
            emit('equip');
            return true;   
        }

        i = i??this._findEmpty();

        if(i!=-1)
        {
            this._storage.items[i]=content;
            return true;
        }
        else
        {  
            return false;
        }
    }

    _split(ent, cnt)
    {
        console.log('---- split')
        ent.content.count -= cnt;
        let split = {id:ent.content.id,count:cnt};
        let i = this._findEmpty();
        console.log(i)
        if(i!=-1) {
            this._storage.items[i]=split;
        }
        console.log( this._storage)
    }

    _transfer(ent)
    {
        // console.log(ent, this.root.target);
        const remain = this.root.target.get(ent.content);
        if(remain===0){ent.empty();}
        else {ent.count=remain;}
        return true;
    }

    _drop(ent)
    {
        console.log('drop',ent)
        let p = this.scene.map.getValidPoint(this.pos);
        let go = new Pickup(this.scene,this.pos.x,this.pos.y-32).init_runtime(ent.content);
        go.falling(p);
        AudioManager.drop();
        const {send}=this.ctx;
        send('msg',`${'_drop'.lab()} ${ent.dat['tw'].lab}`);
    }

    _open(target) // 提供給外界操作
    {
        const {send}=this.ctx;
        send('storage', this.root); 
        this.root.target=target;
        target.target=this.root;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 在上層綁定操作介面，提供給其他元件使用
        this.addP(root, 'storage', {target:this, key:'_storage'});
        root.get = this._get.bind(this);
        root.take = this._take.bind(this);
        root.split = this._split.bind(this);
        root.drop = this._drop.bind(this);
        root.transfer = this._transfer.bind(this);

        // 提供 操作的指令
        root._setAct(GM.OPEN, true);
        
        // 提供給外界操作
        root.on('take', this._take.bind(this));
        root.on(GM.OPEN, this._open.bind(this));
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) 
    {
        if(data) {this._storage = data.storage;}
        else
        {
            const {bb} = this.ctx;
            if(bb.storage) {this._storage = Utility.json2Storage(bb.storage);}
        }
    }
    save() {return {storage:this._storage};}

}



//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供裝備、儲存物品的功能
//--------------------------------------------------
export class COM_Inventory extends COM_Storage
{
    constructor(config)
    {
        super(config?.capacity??-1);
        this._equips = config?.equips??[];
        this._gold = config?.gold??0;
    }
   
    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    _receive(rewards)
    {
        rewards.forEach((reward)=>{
            switch(reward.type)
            {
                case 'gold': this._gold+=reward.count; break;
                case 'item': 
                    // this._put(reward.id, reward.count); 
                    let remain = this._get(reward);
                    if(remain)
                    {
                        reward.count=remain;
                        let ent = {dat:DB.item(reward.id),content:reward}
                        this._drop(ent)
                    }
                    break;
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

        // 移除 操作指令 GM.OPEN
        root._delAct(GM.OPEN);
        root.off(GM.OPEN, this._open.bind(this));

        // 在上層綁定操作介面，提供給外部使用
        this.addP(root, 'equips', {target:this, key:'_equips'});
        this.addP(root, 'gold', {target:this, key:'_gold'});
        root.equip = this._equip.bind(this);
        root.receive = this._receive.bind(this);

        // 共享資料 (有共享的資料，load()時，要用 Object.assign)
        root.bb.equips = this._equips;
        this.addP(root.bb, 'gold', {target:this, key:'_gold'});
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) 
    {
        super.load(data);
        if(data?.equips) {Object.assign(this._equips, data.equips);}
    }

    save() {return {storage:this._storage, equips:this._equips};}

}
