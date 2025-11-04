import Com from './com.js'
import {GM} from '../setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : nav
// 功能 : 
//  尋找路徑
//--------------------------------------------------

export class Nav extends Com
{
    get tag() {return 'nav';}   // 回傳元件的標籤
    get pos() {return this._root.pos;}
    get bb() {return this._root.bb;}
    get scene() {return this._root.scene;}

    get map() {return this._root.scene.map;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _drawPath(path,{color=0xffffff,alpha=1,size=5}={})
    {    
        if(!this._graph)
        {
            this._graph = this.scene.add.graphics();
            this._graph.name = 'path';
            this._graph.fillStyle(0xffffff);
            this._graph.setDepth(Infinity);
        }
        this._graph.clear();

        if(!path || path.state===GM.PATH_NONE) {return;}  

        let len = path.skipLast ? path.pts.length-1 : path.pts.length;
        path.pts.forEach((node,i)=>{
            if(i<len)
            {
                let circle = new Phaser.Geom.Circle(node.x, node.y, size);
                this._graph.fillStyle(color,alpha).fillCircleShape(circle);
            }
        })
    }

    _updatePath()
    {
        this._drawPath(this.bb.path);
    }

    _updateDebugPath()
    {
        this._drawPath(this.bb.path,{alpha:0.5,size:10});
    }

    _showPath(eps)
    {
        let path = this.map.getPath(this.pos, eps);
        if(path)
        {
            path.skipLast=true;
            this._drawPath(path);
        }
        return path;
    }

    _findPath(ep)
    {
        // path = {state:NONE/BLK/OK, pts:[], pt:pt cost:cost, skipLastPt}
        let path = this.map.getPath(this.pos, [ep]);
        path.skipLast = !!this.bb.ent;
        this.bb.path = path;
    }

    _setPath(path)
    {
        this.bb.path = path;
        this.bb.path.skipLast = !!this.bb.ent;
    }

    _clearPath() {delete this.bb.path;}

    // 檢查下一個點是否被阻擋
    _checkPath()
    {
        const pt = this.bb.path?.pts[0];
        if(pt)
        {
            let w = this.scene.map.getWeight(pt);
            // 被阻擋，就清除路徑 
            if(w > GM.W_BLOCK) {this._clearPath(); return false;}
        }
        return true;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        // 在上層綁定操作介面，提供給外部件使用
        // root.getPath = this._getPath.bind(this);
        root.showPath = this._showPath.bind(this);
        
        // 註冊 event
        root.on('findPath', this._findPath.bind(this))
        root.on('clearPath', this._clearPath.bind(this))
        root.on('updatePath', this._updatePath.bind(this))
        root.on('updateDebugPath', this._updateDebugPath.bind(this))
        root.on('setPath', this._setPath.bind(this))
        root.on('checkPath', this._checkPath.bind(this))

    }




}