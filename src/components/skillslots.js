import DB from '../db.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : skillslots
// 功能 :
//  角色的技能槽
//--------------------------------------------------

export class SkillSlots
{
    constructor()
    {
        this._slots = []; // 技能槽資料
    }

    get tag() {return 'skillslots';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _setSlot(i, skillId, from)
    {
        this._slots.find((id, i)=>{id===skillId && (this._slots[i]=null);}); // 先清除重複的技能
        const tmp = this._slots[i];
        this._slots[i] = skillId;
        tmp && from>=0 && (this._slots[from] = tmp); // 如果是交換位置，則把原本的技能放回去
    }

    _getSlot(i)
    {
        return this._slots[i];
    }

    _clearSlot(i)
    {
        this._slots[i] = null;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        // 在上層綁定操作介面，提供給其他元件使用
        root.setSlot = this._setSlot.bind(this);
        root.getSlot = this._getSlot.bind(this);
        root.clearSlot = this._clearSlot.bind(this);
        
        // 註冊 event
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) { if(data?.slots) {this._slots = data.slots;}}
    save() {return {slots:this._slots};}
}