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
    // 加入 add prop
    // addP_old(src, name, {target, key, getter, setter}={}) 
    // { 
    //     Object.defineProperty(src, name, { 
    //         get: getter ? () => getter() : () => target[key], 
    //         set: setter ? v => setter(v) : v => { target[key] = v; }, 
    //         enumerable: true, 
    //         configurable: true }); 
    // }

    addP(src, name, {target, key, get, set}={}) 
    { 
        Object.defineProperty(src, name, { 
            get: get ?? function(){return target[key]}, 
            set: set ?? function(v){target[key]=v; }, 
            enumerable: true, 
            configurable: true }); 
    }

    addRt(name,{get,set,ro=false}={})
    {
        if(!get)
        {
            const key='_'+name;
            Object.defineProperty(this.root, name, { 
                get: ()=>{return this[key]}, 
                set: (v)=>{ if(ro) {this.warn('root',name);return;}
                            this[key]=v;
                            this.log('root',name,v);
                        }, 
                enumerable: true, 
                configurable: true }); 
        }
        else
        {
            Object.defineProperty(this.root, name, { 
                get: get, 
                set: (v)=>{set?.(v); this.log('root',name,v);}, 
                enumerable: true, 
                configurable: true }); 
        }
    }

    addBB(name,{ro=false}={})
    {
        const key='_'+name;
        Object.defineProperty(this.ctx.bb, name, { 
            get: ()=>this[key], 
            set: (v)=>{ if(ro) {this.warn('bb',name);return;}
                        this[key]=v;
                        this.log('bb',name,v);
                    }, 
            enumerable: true, 
            configurable: true }); 
    }

    // debug 用
    warn(src, name)
    {
        if(!DEBUG.log) {return;}
        console.warn(`[${src}.${name}] is readonly, ignore set`);
    }

    log(src, name, v)
    {
        if(!DEBUG.log) {return;}
        // DEBUG.filter 為空陣列或包含name時為 true
        const pass = (DEBUG.filter.length === 0 || 
                        DEBUG.filter.includes(name));
        if(pass) {console.log(`---- [${this.root.id}] ${src}.${name} = ${v}`);}          
    }

    bind(root) 
    {
        this._root = root;
        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
    }
}




