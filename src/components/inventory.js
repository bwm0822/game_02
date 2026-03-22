import Com from './com.js'
import Utility from '../core/utility.js'
import DB from '../data/db.js'
import Pickup from '../items/pickup.js'
import AudioManager from '../manager/audio.js'
import {GM} from '../core/setting.js'
import {dlog} from '../core/debug.js'

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

    _remove(content)
    {
        const items = this._storage.items;
        const len = this._storage.items.length;
        let remain = content.count;
        for(let i=0;i<len;i++)
        {
            const itm = items[i];
            if(content.id&&itm?.id!==content.id){continue;}
            if(content.q&&itm?.q!==content.q){continue;}
            let cnt = Math.min(remain,itm.count);
            itm.count-=cnt;
            remain-=cnt;
            if(itm.count===0){items[i]=null;}
            if(remain==0) {break;}
        }

        return remain;
    }

    // 將 content 放到 storage，回傳剩餘的
    _put(content)
    {
        const id = content.id;
        const cps = DB.item(id).cps ?? 1;

        let remain = content.count;
        let i = 0;
        const capacity = this._storage.capacity;
        const len = this._storage.items.length;
        const items = this._storage.items;
        while(remain>0 && (capacity == -1 || i<capacity))
        {
            if(i<len)
            {
                if(Utility.isEmpty(items[i]))
                {
                    const cnt = Math.min(remain,cps)
                    items[i]={...content,count:cnt};
                    remain-=cnt;
                }
                else if(items[i].id==id && items[i].count<cps)
                {
                    const sum = items[i].count+remain;
                    items[i]={...items[i],...content}
                    items[i].count = Math.min(sum,cps)
                    remain = sum-cps;
                }
            }
            else    // 新的欄位
            {
                const cnt = Math.min(remain,cps);
                items.push({...content,count:cnt});
                remain-=cnt;
            }
            i++;
        }

        return remain;
    }

    // 接收content，i為slot的編號
    _receive(content,i,isEquip)
    {
        // type 1 : 將content置於編號為i的slot
        const{bb,root}=this.ctx;
        if(isEquip) // 置於裝備欄位
        {
            bb.equips[i]=content;
            root.equip?.();
            return 0;   // 回傳remian，為0
        }
        else if(i)  // 置於物品欄位
        {
            this._storage.items[i]=content;
            return 0;   // 回傳remian，為0
        }

        // type 2:從storage找空位，放置content
        return this._put(content);
    }


    // _take(content,i,isEquip)
    // {
    //     console.log('-------------- take',content)

    //     const{bb,root}=this.ctx;
    //     if(isEquip)
    //     {
    //         bb.equips[i]=content;
    //         root.equip?.();
    //         return true;   
    //     }

    //     i = i??this._findEmpty();

    //     if(i!=-1)
    //     {
    //         this._storage.items[i]=content;
            
    //         return true;
    //     }
    //     else
    //     {  
    //         return false;
    //     }
    // }

    _split(ent, cnt)
    {
        dlog()('---- split')
        ent.content.count -= cnt;
        let split = {id:ent.content.id,count:cnt};
        let i = this._findEmpty();
        dlog()(i)
        if(i!=-1) {
            this._storage.items[i]=split;
        }
        dlog()( this._storage)
    }

    _transfer(ent)
    {
        const remain = this.root.target.receive(ent.content);
        if(remain===0){ent.empty();}
        else {ent.count=remain;}
        return true;
    }

    _drop(ent)
    {
        let p = this.ctx.ept(this.pos,{th:GM.W.EMPTY,random:true,includeP:false});
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

    _close()    // 提供給外界操作( UiStorage.close()會呼叫到 )
    {
        this.root.target.target=null;
        this.root.target=null;
    }

    _query(dat)
    {
        let cnt=0;
        this._storage.items.forEach((itm)=>{
            if(!itm) {return;}
            if(dat.id&&itm.id!==dat.id) {return}
            if(dat.q&&itm.q!==dat.q) {return;}
            cnt+=itm.count;
        });
        return cnt;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        root._setAct(GM.OPEN, ()=>GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('storage');
        root.split = this._split.bind(this);
        root.drop = this._drop.bind(this);
        root.transfer = this._transfer.bind(this);
        root.close = this._close.bind(this);
        root.query = this._query.bind(this);
        root.remove = this._remove.bind(this);
        root.receive = this._receive.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
        // root.on('take', this._take.bind(this));
        // root.on('receive', this._take.bind(this));
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
    _reward(rewards)
    {
        rewards.forEach((reward)=>{
            switch(reward.type)
            {
                case 'gold': this._gold+=reward.count; break;
                case 'item': 
                    let remain = this._receive(reward);
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

    _equip() 
    {
        const {root}=this.ctx; 
        root.updateEquips?.();
        root.setDirty?.(); // 更新屬性
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 共享資料 (有共享的資料，load()時，要用 Object.assign)
        this.addBB('gold');
        this.addBB('equips');

        // 1.提供 [外部操作的指令]
        root._delAct(GM.OPEN);
        root.off(GM.OPEN, this._open.bind(this));

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('equips');
        this.addRt('gold');
        root.equip = this._equip.bind(this);
        root.reward = this._reward.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫

    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) 
    {
        super.load(data);
        if(data?.equips) {Object.assign(this._equips, data.equips);}
        if(data?.gold!==undefined) {this._gold=data.gold;}
    }

    save() {return {storage:this._storage, equips:this._equips, gold:this._gold};}

}
