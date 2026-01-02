//--------------------------------------------------
// 類別 : 基本元件(component) 
// 功能 :
//  1. 所有元件都繼承此類別
//  2. 提供 addP
//--------------------------------------------------

export default class Com
{
    get root() {return this._root;}
    get ctx() {return this._root.ctx;}

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    // 加入 add prop
    addP(src, name, {target, key, getter, setter}={}) 
    { 
        Object.defineProperty(src, name, { 
            get: getter ? () => getter() : () => target[key], 
            set: setter ? v => setter(v) : v => { target[key] = v; }, 
            enumerable: true, 
            configurable: true }); 
    }

    bind(root) 
    {
        this._root = root;
        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
    }
}