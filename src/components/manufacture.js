import Com from './com.js'
import Utility from '../utility.js'
import DB from '../db.js'
import {Pickup} from '../items/pickup.js'
import AudioManager from '../audio.js'
import {GM} from '../setting.js'


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : manu
// 功能 : 提供製造物品的功能
//--------------------------------------------------
export class COM_Manu extends Com
{
    constructor()
    {
        super();
        this._menu=['cook','salt_baked_fish'];
        this._storage = {capacity:-1,items:[]}; 
        this._output = null;
        this._cat = GM.CAT_FOOD;
    }

    get tag() {return 'manu';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}
    //
    get isFull() {return this._output?.count>0;}
    get sel() {return this._sel;}
    set sel(id) {
        this._sel = id;
        this._make = DB.item(id)?.make;
        this._output = {id:id,count:0};
    }

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _cook()
    {
        console.log('cook')
        const {send}=this.ctx;
        send('stove', this.root); 

    }

    check()
    {
        if(!this._sel) {return false}
        if(this.isFull) {return false;}
        if(this._sel=='cook') 
        {
            let found = this._storage.items.find(slot=>{
                return DB.item(slot?.id)?.cook
            })
            return found;
        }
        else
        {
            for(let [id,count] of Object.entries(this._make.items))
            {
                if(this.count(id)<count) {return false;}
            }
            return true;
        }
        
    }

    count(id)
    {
        let count = 0;
        this._storage.items.forEach(slot=>{
            if(slot?.id==id) {count+=slot.count;}
        })
        return count;
    }

    make()
    {
        if(this._sel==='cook') 
        {
            this._storage.items.forEach(slot=>{
                let cook = DB.item(slot?.id)?.cook;
                if(cook) {slot.id = cook.id;}
            })
        }
        else
        {
            for(let [id,count] of Object.entries(this._make.items))
            {
                for(let i=0;i<this._storage.items.length;i++)
                {
                    if(this._storage.items[i]?.id==id)
                    {
                        if(this._storage.items[i].count >= count)
                        {
                            this._storage.items[i].count -= count;
                            if(this._storage.items[i].count==0) {this._storage.items[i]=null;}
                            break;
                        }
                        else
                        {
                            count -= this._storage.items[i].count;
                            this._storage.items[i]=null;
                        }
                    }
                }
            }

            this._output.count++;
        }
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 操作的指令
        root._setAct(GM.COOK, true);

        // 2.在上層綁定操作介面，提供給其他元件使用
        this.addP(root,'menu',{getter:()=>this._menu});
        this.addP(root,'storage',{getter:()=>this._storage});
        this.addP(root,'output',{getter:()=>this._output,
                                setter:(val)=>this._output=val});
        this.addP(root,'sel',{getter:()=>this.sel,
                                setter:(val)=>this.sel=val});
        this.addP(root,'cat',{getter:()=>this._cat});
        root.check=this.check.bind(this);
        root.make=this.make.bind(this);

        // 3.提供給外界操作
        root.on(GM.COOK, this._cook.bind(this));
    }
}