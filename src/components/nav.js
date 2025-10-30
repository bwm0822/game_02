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
    get scene() {return this._root.scene;}

    get map() {return this._root.scene.map;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _drawPath()
    {    
        if(!this._graph)
        {
            this._graph = this.scene.add.graphics();
            this._graph.name = 'path';
            this._graph.fillStyle(0xffffff);
            this._graph.setDepth(Infinity);
        }
        this._graph.clear();

        // if(dbg_hover_npc) {return;}    // DEBUG 用，如果有 NPC 被滑鼠指向，則不畫 player 的路徑，以免干擾 npc 路徑的顯示
        
        // path.pop(); //移除陣列最後一個元素
        this.bb.path?.pts.forEach((node)=>{
            let circle = new Phaser.Geom.Circle(node.x, node.y, 5);
            this._graph.fillStyle(0xffffff).fillCircleShape(circle);
        })
    }

    _getPath(eps)
    {
        let path = this.map.getPath(this.pos, eps);
        return path;
    }

    _findPath(ep)
    {
        console.log('findPath')
        let path = this.map.getPath(this.pos, [ep]);
        // path = {state:1, pts:[], pt:pt cost:cost}
        this.bb.path = path;
    }

    _clearPath()
    {
        console.log('clearPath')
        delete this.bb.path;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        // 在上層綁定操作介面，提供給外部件使用
        root.getPath = this._getPath.bind(this);
        
        // 註冊 event
        root.on('findPath', this._findPath.bind(this))
        root.on('clearPath', this._clearPath.bind(this))
        root.on('drawPath', this._drawPath.bind(this))

    }




}