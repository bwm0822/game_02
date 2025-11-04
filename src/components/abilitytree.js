import Com from './com.js'
import DB from '../db.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : abilitytree
// 功能 :
//  角色的技能樹
//--------------------------------------------------

export class AbilityTree extends Com
{
    constructor()
    {
        super();
        this._abTree = {}; // 技能樹資料
    }

    get tag() {return 'abilitytree';}   // 回傳元件的標籤

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        this._abTree = DB.abTree;
        
        // 在上層綁定操作介面，提供給其他元件使用
        root.prop('abTree', {target:this, key:'_abTree'});
        
        // 註冊 event
        

    }
}