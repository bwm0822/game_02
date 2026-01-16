import Com from './com.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : nav
// 功能 : 
//  尋找路徑
//--------------------------------------------------

export class COM_Nav extends Com
{
    get tag() {return 'nav';}   // 回傳元件的標籤
    get pos() {return this._root.pos;}
    get bb() {return this._root.bb;}
    get scene() {return this._root.scene;}

    get map() {return this._root.scene.map;}
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _drawPath(path,{drawLast,color=0xffffff,alpha=1,size=5}={})
    {    
        if(!this._graph)
        {
            this._graph = this.scene.add.graphics();
            this._graph.name = 'path';
            this._graph.fillStyle(0xffffff);
            this._graph.setDepth(Infinity);
        }
        this._graph.clear();

        if(!path || path.state===GM.PATH_NONE || !path.pts) {return;}  

        let len = (drawLast??path.drawLast) ? path.pts.length : path.pts.length-1;
        path.pts.forEach((node,i)=>{
            if(i<len)
            {
                let circle = new Phaser.Geom.Circle(node.x, node.y, size);
                this._graph.fillStyle(color,alpha).fillCircleShape(circle);
            }
        })
    }

    _hidePath()
    {
        if(!this._graph)
        {
            this._graph = this.scene.add.graphics();
            this._graph.name = 'path';
            this._graph.fillStyle(0xffffff);
            this._graph.setDepth(Infinity);
        }
        this._graph.clear();
    }

    _updatePath()
    {
        this._drawPath(this.bb.path);
    }

    _updateDebugPath()
    {
        this._drawPath(this.bb.path,{alpha:0.5,size:10});
    }

    _showPath(eps,drawLast)
    {
        const path = this.map.getPath(this.pos, eps);
        if(path)
        {
            this._drawPath(path,{drawLast:drawLast});
        }
        return path;
    }

    _findPath(eps)
    {
        // path 的格式 = { state:NONE/BLK/OK, pts:[], ep:ep cost:cost }
        const path = this.map.getPath(this.pos, eps);
        this.bb.path = path;
    }

    _getPath(sp, eps)
    {
        // path 的格式 = { state:NONE/BLK/OK, pts:[], ep:ep cost:cost }
        return this.map.getPath(sp, eps);
    }

    _setPath(path)
    {
        // console.log(`${this.root.id} ---- _setPath`);
        this.bb.path = path;
    }

    _clearPath() 
    {
        // console.log(`${this.root.id} ---- _clearPath`);
        delete this.bb.path;
    }

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

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 外部
        root.showPath = this._showPath.bind(this);
        root.hidePath = this._hidePath.bind(this);
        // 其他元件
        root.findPath=this._findPath.bind(this);
        root.clearPath=this._clearPath.bind(this);
        root.updatePath=this._updatePath.bind(this);
        root.updateDebugPath=this._updateDebugPath.bind(this);
        root.setPath=this._setPath.bind(this);
        root.checkPath=this._checkPath.bind(this);
        root.getPath=this._getPath.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫

    }




}