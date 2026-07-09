import Com from './com.js'
import Utility from '../core/utility.js'
import DB from '../data/db.js'
import Pickup from '../items/pickup.js'
import AudioManager from '../manager/audio.js'
import {GM} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'
import QuestManager from '../manager/quest.js'
const _tag = 'inv';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供儲存物品的功能
//--------------------------------------------------
export class COM_Storage extends Com
{
    get tag() {return _tag;}   // 回傳元件的標籤
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
            if(content.id&&itm?.id!==content.id) {continue;}
            if(content.q&&itm?.q!==content.q) {continue;}
            let cnt = Math.min(remain,itm.count);
            itm.count-=cnt;
            remain-=cnt;
            if(itm.count===0) {items[i]=null;}
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
                    remain = Math.max(0, sum-cps);
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

        QuestManager.onCollect('put');
        return remain;
    }

    // 接收content，i為slot的編號, isEquip為是否放在裝備欄位，回傳剩餘的
    _receive(content,i,isEquip)
    {
        const{bb,root}=this.ctx;
        if(isEquip||i) // 置於裝備或背包欄位
        {
            // case 1 : slot 置換
            // i 或 isEquip有值，代表是 slot，將 content 置於編號為i的slot

            if(isEquip) // 置於裝備欄位
            {
                bb.equips[i]=content;
                root.equip?.();
            }
            else        // 置於背包欄位
            {
                this._storage.items[i]=content;
            }

            QuestManager.onCollect('receive');

            return 0;   // 回傳remian，為0
        }
        else
        {
            // case 2
            // 從 storage 找空位，放置content
           
            return this._put(content);
        }

        
    }

    _split(ent, cnt)
    {
        dlog(T.UI)('---- split')
        ent.content.count -= cnt;
        let split = {id:ent.content.id,count:cnt};
        let i = this._findEmpty();
        dlog(T.UI)(i)
        if(i!=-1) {this._storage.items[i]=split;}
        dlog(T.UI)( this._storage)
    }

    _transfer(ent)
    {
        const remain = this.root.info.target.receive(ent.content);
        if(remain===0){ent.empty();}
        else {ent.count=remain;}
        return true;
    }

    _drop(ent)
    {
        let p = this.ctx.ept(this.pos,{th:GM.W.EMPTY,random:true,includeP:false});
        let go = new Pickup(this.scene,this.pos.x,this.pos.y-32).init_runtime(ent.content);
        go.falling(p);
        const {send}=this.ctx;
        send('msg',`${'drop'.lab()} ${ent.label}`);
        ent.empty();
        AudioManager.drop();
        QuestManager.onCollect('drop');
    }

    _open(target) // 提供給外界操作
    {
        const {send}=this.ctx;
        send('storage', this.root); 
        this.root.info.target=target;
        target.info.target=this.root;
    }

    _close()    // 提供給外界操作( UiStorage.close()會呼叫到 )
    {
        this.root.info.target.info={}
        this.root.info={};
    }

    _query(cb) { return this._storage.items.filter((itm) => itm && cb(itm)); }

    _find(cb) { return this._storage.items.find((itm) => itm && cb(itm)); }

    _delete(itm)
    {
        const index = this._storage.items.indexOf(itm);
        if (index > -1) {
            this._storage.items.splice(index, 1);
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 初始化資料
        const{bb}=this.ctx;
        if(bb.storage) {this._storage = Utility.json2Storage(bb.storage);}
        else {this._storage = {capacity:-1,items:[]};}

        // 1.提供 [外部操作的指令]
        root._setAct(GM.OPEN, ()=>root.isLocked?.() ? GM.HIDE : GM.EN);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('storage');
        root.split = this._split.bind(this);
        root.drop = this._drop.bind(this);
        root.transfer = this._transfer.bind(this);
        root.close = this._close.bind(this);
        root.queryItem = this._query.bind(this);
        root.findItem = this._find.bind(this);
        root.removeItem = this._delete.bind(this);
        // 上層root已經有remove()了，如果綁定了root.remove，就會被誤認為是COM_Storage的remove，導致錯誤
        // root.remove = this._remove.bind(this);
        root.receive = this._receive.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.OPEN, this._open.bind(this));
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data)
    {
        const d = data?.[_tag];
        if(d) {this._storage = d.storage;}
    }
    save() {return {[_tag]:{storage:this._storage}};}

}



//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : inv
// 功能 : 提供裝備、儲存物品的功能
//--------------------------------------------------
export class COM_Inventory extends COM_Storage
{   
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
        const {root,emit}=this.ctx;
        root.setDirty?.(); // 更新屬性
        emit(GM.EVT.UPDATEEQUIP);
    }

    _updateTime()
    {
        const {root,emit} = this.ctx;
        let changed = false;
        this._equips.forEach((content, i) => {
            if (!content) {return;}
            const dat = DB.item(content.id);
            if (!dat?.[GM.ENDURANCE]) {return;}
            if (content[GM.ENDURANCE] === undefined) {content[GM.ENDURANCE] = dat[GM.ENDURANCE];}
            if (--content[GM.ENDURANCE] <= 0) 
            {
                this._equips[i] = null;
                changed = true;
            }
        });
        if (changed) {emit(GM.EVT.UPDATEEQUIP);}
    }

    _queryEquip(cb) { return this._equips.filter((itm) => itm && cb(itm)); }

    _findEquip(cb) { return this._equips.find((itm) => itm && cb(itm)); }

    _ondead()
    {
        const {root}=this.ctx;
        root._setAct(GM.OPEN, ()=>GM.EN);
        // 開啟互動
        root.setZone(true, this.tag);
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const{bb}=this.ctx;

        // 初始化資料
        Object.assign(this._storage,Utility.toStorage(bb.meta?.storage));
        this._equips = bb.meta?.equips??[];
        this._gold = bb.meta?.gold??0;

        // 共享資料 (有共享的資料，load()時，要用 Object.assign)
        this.addBB('gold');
        this.addBB('equips');

        // 1.提供 [外部操作的指令]
        root._delAct(GM.OPEN);
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('equips');
        this.addRt('gold');
        root.equip = this._equip.bind(this);
        root.reward = this._reward.bind(this);
        root.queryEquip = this._queryEquip.bind(this);
        root.findEquip = this._findEquip.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.UPDATETIME, this._updateTime.bind(this));
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data)
    {
        super.load(data);
        const d = data?.[_tag];
        if(d?.equips) {Object.assign(this._equips, d.equips);}
        if(d?.gold!==undefined) {this._gold=d.gold;}
    }

    save()
    {
        return {[_tag]:{storage:this._storage,
                equips:this._equips,
                gold:this._gold}};
    }

}
