import Com from './com.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : abilityslots
// 功能 :
//  角色的技能槽
//--------------------------------------------------

export class COM_AbilitySlots extends Com
{
    constructor()
    {
        super();
        this._slots = []; // 能力槽資料
    }

    get tag() {return 'abilityslots';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _setSlot(i, abilityId, from)
    {
        this._slots.find((id, i)=>{id===abilityId && (this._slots[i]=null);}); // 先清除重複的技能
        const tmp = this._slots[i];
        this._slots[i] = abilityId;
        tmp && from>=0 && (this._slots[from] = tmp); // 如果是交換位置，則把原本的技能放回去
    }

    _getSlot(i) {return this._slots[i];}

    _clearSlot(i) {this._slots[i] = null;}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.setSlot = this._setSlot.bind(this);
        root.getSlot = this._getSlot.bind(this);
        root.clearSlot = this._clearSlot.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) { if(data?.slots) {this._slots = data.slots;}}
    save() {return {slots:this._slots};}
}