//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : nav
// 功能 : 
//  尋找路徑
//--------------------------------------------------

export class Nav
{
    get tag() {return 'nav';}   // 回傳元件的標籤
    get pos() {return this._root.pos;}
    get bb() {return this._root.bb;}

    get map() {return this._root.scene.map;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _findPath(ep)
    {
        let rst = this.map.getPath(this.pos, [ep]);
        // rst = {state:1,path:[]}
        this.bb.path = rst;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        // 在上層綁定操作介面，提供給外部件使用
        
        // 註冊 event
        root.on('findPath', this._findPath.bind(this))
    }




}