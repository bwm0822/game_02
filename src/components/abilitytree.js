import Com from './com.js'
import DB from '../db.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : abilitytree
// 功能 :
//  角色的技能樹
//--------------------------------------------------

export class COM_AbilityTree extends Com
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

        // 1.提供 [外部操作的指令]
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addP(root, 'abTree', {target:this, key:'_abTree'});
        
        // 3.註冊(event)給其他元件或外部呼叫
        

    }
}