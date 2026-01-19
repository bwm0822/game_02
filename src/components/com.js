import {DEBUG} from '../core/setting.js'

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
    
    // 在 root 加入 get/set, ro 為 readonly
    addRt(name,{get,set,ro=false}={})
    {
        const{root}=this.ctx;
        if(get)
        {
            root.addP(name,{get:get,set:set,ro:ro});
        }
        else
        {
            const key='_'+name;
            root.addP(name,{get:()=>this[key],
                            set:(v)=>this[key]=v,
                            ro:ro});
        }
    }

    // 在 bb 加入 get/set, ro 為 readonly
    addBB(name,{ro=false}={})
    {
        const{root,bb}=this.ctx;
        const key='_'+name;
        root.addP(name,{src:bb,
                        get:()=>this[key],
                        set:(v)=>this[key]=v,
                        ro:ro}
                )
    }

    bind(root) 
    {
        this._root = root;
        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
    }
}




