//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : nav
// 功能 : 
//  尋找路徑
//--------------------------------------------------

export class Nav
{
    constructor(root)
    {
        this._root = root;
        this._bind(root);
    }

    get tag() {return 'nav';}   // 回傳元件的標籤
    get pos() {return this._root.pos;}
    get bb() {return this._root.bb;}

    get map() {return this._root.scene.map;}

    _bind(root)
    {
        // 在上層綁定操作介面，提供給其他元件使用
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    findPath(ep)
    {
        let rst = this.map.getPath(this.pos, [ep]);
        this.bb.path = rst;
    }


}