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
    }

    get tag() {return 'nav';}   // 回傳元件的標籤
    get pos() {return this._root.pos;}
    get bb() {return this._root.bb;}

    get map() {return this._root.scene.map;}



    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        // 在上層綁定操作介面，提供給外部件使用
        
        // 註冊 event
        root.on('findPath', this.findPath.bind(this))
    }

    findPath(ep)
    {
        let rst = this.map.getPath(this.pos, [ep]);
        // rst = {state:1,path:[]}
        this.bb.path = rst;
    }


}