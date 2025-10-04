import {GM} from '../setting.js';
import DB from '../db.js';

let DEBUG = false; // 是否開啟 debug 模式
let DBG_TYPE = GM.DBG_ALL;


function debugDraw(type=DBG_TYPE,text)
{
    if(!this._dbgGraphics)
    {
        this._dbgGraphics = this.scene.add.graphics();
        this._dbgGraphics.setDepth(Infinity);
    }

    if(text && !this._dbgText)
    {
        this._dbgText = bbcText(this.scene,{text:'dbg'});
        this._dbgText.setDepth(Infinity);
        this._dbgText.setOrigin(0.5,1);
    }

    let draw_body = ()=>{
        if((type & GM.DBG_BODY)===0) {return;}
        if(this.body)
        {
            // body 的 x, y 是 body 的左上角
            // Phaser.Geom.Rectangle( left, top, w, h )
            this._dbgGraphics.lineStyle(6, 0x0000ff, 1);
            let rect = new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
            let circle = new Phaser.Geom.Circle(this.body.center.x,this.body.center.y,5);
            this._dbgGraphics.strokeRectShape(rect);
            this._dbgGraphics.strokeCircleShape(circle);
        } 
    }

    let draw_grid = ()=>{
        if((type & GM.DBG_GRID)===0) {return;}
        if(this._grid)
        {
            // grid 的 x, y 是 body 的中心點
            // Phaser.Geom.Rectangle( left, top, w, h )
            this._dbgGraphics.lineStyle(4, 0x00ff00, 1);
            let x = this.cen.x + this.min.x + this.gl;
            let y = this.cen.y + this.min.y + this.gt;
            let rect = new Phaser.Geom.Rectangle( x, y, this._grid.w, this._grid.h );
            this._dbgGraphics.strokeRectShape(rect);
        }
    }

    let draw_zone = ()=>{
        if((type & GM.DBG_ZONE)===0) {return;}
        if(this._zone)
        {
            // zone 的 x, y 是 zone 的中心點
            // Phaser.Geom.Rectangle( left, top, w, h )
            this._dbgGraphics.lineStyle(2, 0xff0000, 1);
            let p = {x:this.cen.x + this._zone.x - this._zone.width/2, 
                    y:this.cen.y + this._zone.y - this._zone.height/2}
            let rect = new Phaser.Geom.Rectangle(p.x,p.y,this._zone.width,this._zone.height); 
            this._dbgGraphics.strokeRectShape(rect);            
        }
    }

    let draw_pts = ()=>{
        if(type === GM.DBG_CLR) {return;}
        for(let p of this.pts)
        {
            this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
            let circle = new Phaser.Geom.Circle(p.x,p.y,2.5);
            this._dbgGraphics.strokeCircleShape(circle);
        }
        this._dbgGraphics.lineStyle(2, 0xffffff, 1);
        // let circle = new Phaser.Geom.Circle(this.pos.x,this.pos.y,5);
        let circle = new Phaser.Geom.Circle(this.anchor.x,this.anchor.y,5);
        this._dbgGraphics.strokeCircleShape(circle);
    }

    let clr = ()=>{
        this._dbgGraphics.clear();
        if(this._dbgText) {this._dbgText.text='';}
        this._dbgGraphics.lineStyle(2, 0xff0000, 1);
    }

    let show_text = (text)=>{
        if(type === GM.DBG_CLR) {return;}
        if(this._dbgText)
        {
            this._dbgText.x = this.x;
            this._dbgText.y = this.y-this.displayHeight*2/3;
            this._dbgText.setText(`[bgcolor=white][color=black]${text}\n${this.state}[/color][/bgcolor]`)
        }
    }


    clr();

    draw_body();
    draw_grid();
    draw_zone();
    draw_pts();
    show_text(text);
}

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : view
// 功能 :
//  負責處理跟 Phaser 相關的功能，
//  如 : 圖像顯示、互動、物理碰撞...等
//--------------------------------------------------
class View extends Phaser.GameObjects.Container
{
    constructor(root, modify)
    {
        super(root.scene);
        this.scene.add.existing(this);
        this._root = root;
        this._pGrids = [];          // grid 在地圖網格所佔據的點
        this._flipX = false;
        this._flipY = false;
        this._pts = null;
        // 以下參數一定要給值，_setData()時，才會 assign 相對應的值
        this.wid = 0;               // container 的寬
        this.hei = 0;               // container 的高
        this.interactive = false;    // 是否可以互動
        this.en_outline = true;     // 是否開啟 outline 的功能
        this.isStatic = true;       // true: static body, false: dynamic body
        this.isBlock = false;       // 是否會阻擋
        this.weight = 1000;
        this.bl=0, this.br=0, this.bt=0, this.bb=0;     // body 的 left, right, top, bottom，物理 body 方塊
        this.gl=0, this.gr=0, this.gt=0, this.gb=0;     // grid 的 left, right, top, bottom，地圖網格方塊
        this.zl=0, this.zr=0, this.zt=0, this.zb=0;     // zone 的 left, right, top, bottom，可互動的方塊，interactive=true 才有作用，
        this.anchorX = 0;           // 錨點與中心點的差距，(0,0)代表在中心點，(-w/2,-h/2) 代表在左上角
        this.anchorY = 0;           // 錨點與中心點的差距，(0,0)代表在中心點，(w/2,h/2) 代表在右下角 
        this.key = null;
        this.frame = null;

        this._init(modify);
    }

    get tag() {return 'view';}          // 回傳元件的標籤
    get ctx() {return this._root.ctx;}
    get ent() {return this._root.ent;}
    get pos() {return this._root.pos;}

    get anchor() {return this._root.pos;}          // 錨點的座標(world space)
    get cen()   {return {x:this.anchor.x+this.x,y:this.anchor.y+this.y}}    // 中心點的座標(world space)
    get posG() {return {x:this.cen.x+this._grid.x, y:this.cen.y+this._grid.y}} // grid 的中心點(world space)
    get pts() {return this._pts?this._pts.map((p)=>{return {x:p.x+this.cen.x,y:p.y+this.cen.y}}):[this.anchor]} 
    
    get min() {return {x:-this.wid/2, y:-this.hei/2};}  // view 的左上角座標
    get max() {return {x:this.wid/2, y:this.hei/2};}    // view 的右下角座標
 
    // _addPhysics 會用到，不然 body 的位置會有問題
    get displayWidth() {return this.wid;}
    get displayHeight() {return this.hei;}

    //--------------------------------------------------
    // outline
    //--------------------------------------------------
    _setOutline(on)
    {
        if(!this.en_outline) {return;}
        (this._shape ? this._outline_shape.bind(this) : this._outline_rect.bind(this))(on);
    }

    _outline_shape(on)
    {
        let shape = this._shape;

        if(!this._outline) {this._outline = this.scene.plugins.get('rexOutlinePipeline');}

        if(on) {this._outline.add(shape,{thickness:3, outlineColor:0xffffff});}
        else {this._outline.remove(shape);}
    }

    _outline_rect(on)
    {
        if(!this._rect)
        {
            let p = {x:this.cen.x + this._zone.x, y:this.cen.y + this._zone.y};
            this._rect = this.scene.add.rectangle(p.x, p.y, this._zone.width, this._zone.height, 0xffffff, 0.5);
            this._rect.setStrokeStyle(2, 0xffffff)
            this._rect.setDepth(Infinity);
        }

        if(on)
        {
            let p = {x:this.cen.x + this._zone.x, y:this.cen.y + this._zone.y};

            this._rect.x = p.x;
            this._rect.y = p.y;
        }

        this._rect.visible = on;
    }

    //--------------------------------------------------
    // faceTo
    //--------------------------------------------------
    _faceTo(pt)
    {
        if(pt.x===this.pos.x) {return;}
       
        if(this._shape) {this._shape.scaleX = (pt.x>this.pos.x) != this._faceR ? -1 : 1;}
    }

    //--------------------------------------------------
    // Z depth
    //--------------------------------------------------
    _updateDepth()
    {
        this._root.updateDepth();
        return this;
    }

    //--------------------------------------------------
    // 物理碰撞相關 (physics)
    //--------------------------------------------------
    _addPhysics()
    {
        // (body.x, body.y) 是 body 的左上角，body.center 才是中心點
        this.scene.physics.add.existing(this, this.isStatic);
        this.body.setSize(this.wid-this.bl-this.br, this.hei-this.bt-this.bb);
        if(this.isStatic) 
        {
            this.body.setOffset(this.anchor.x+this.bl, this.anchor.y+this.bt);
            this.isBlock && this.scene.staGroup.add(this);
        }
        else 
        {
            this.body.setOffset(this.min.x+this.bl, this.min.y+this.bt);
            this.isBlock && this.scene.dynGroup.add(this);
        }

        return this;
    }

    //--------------------------------------------------
    // 地圖網格 (weight)
    //--------------------------------------------------
    _addGrid()
    {
        this._grid = {};

        this._grid.w = this.wid - this.gl - this.gr;
        this._grid.h = this.hei - this.gt - this.gb;

        this._grid.x = (this.min.x + this.gl + this.max.x - this.gr)/2; 
        this._grid.y = (this.min.y + this.gt + this.max.y - this.gb)/2;

        return this;
    }

    _removeWeight(weight)
    {
        let wei = weight ?? this.weight;
        wei!=0 && this.scene.map.updateGrid(this.posG,-wei,this._grid.w,this._grid.h);

        return this;
    }

    _addWeight(pt,weight)
    {
        let wei = weight ?? this.weight;
        wei!=0 && this.scene.map.updateGrid(pt??this.posG,wei,this._grid.w,this._grid.h);

        return this;
    }

    //--------------------------------------------------
    // 設定 anchor
    //--------------------------------------------------
    _setAnchor(modify)
    {
        this.x = -this.anchorX;
        this.y = -this.anchorY;
        if(modify)
        {
            this._root.x += this.anchorX;
            this._root.y += this.anchorY;
        }
        return this;
    }

    //--------------------------------------------------
    // 與滑鼠互動
    //--------------------------------------------------
    _addListener()
    {
        if(!this.interactive) {return this;}

        // 產生 zone 方塊
        let cx = (this.min.x + this.zl + this.max.x - this.zr)/2;
        let cy = (this.min.y + this.zt + this.max.y - this.zb)/2;
        this._zone = this.scene.add.zone(cx, cy, this.wid-this.zl-this.zr, this.hei-this.zt-this.zb)
        this.add(this._zone)

        // 將 zone 方塊設成可互動的
        this._zone.setInteractive()
            .on('pointerover',()=>{
                // if(!Role.getPlayer().isInteractive(this)) {return;}
                this._setOutline(true);
                // this._send('over',this);
                this._root?.emit('over');
                if(DEBUG){debugDraw.bind(this)();}
            })
            .on('pointerout',()=>{
                // if(!Role.getPlayer().isInteractive(this)) {return;}
                this._setOutline(false);
                // this._send('out');
                this._root?.emit('out');
                if(DEBUG){debugDraw.bind(this)(GM.DBG_CLR);}
            })
            .on('pointerdown',(pointer)=>{
                // if(!Role.getPlayer().isInteractive(this)) {return;}
                if (pointer.rightButtonDown()) 
                {
                    this._root?.emit('down');
                    // this._rightButtonDown();
                }
            })

        return this;
    }

    //--------------------------------------------------
    // 初始化
    //--------------------------------------------------
    _init(modify)
    {
        this._setData()
            ._setAnchor(modify)
            ._addShape()
            ._addPhysics()
            ._addGrid()
            ._updateDepth()
            ._addWeight()
            ._addListener()

        // 將 view 掛在 ent 之下
        this.ent.add(this);
    }


    
    //--------------------------------------------------
    // public
    //--------------------------------------------------
    bind(root)
    {
        // 在上層綁定操作介面，提供給其他元件使用
        root.isTouch = this.isTouch;
    }

    isTouch() {return true;}

    //--------------------------------------------------
    // virtual method
    //--------------------------------------------------
    _setData()
    {
        const {bb} = this.ctx;
        // 從 bb 取得參數
        for(let key in bb)
        {
            if(this[key]!==undefined) {this[key]=bb[key];}
        }

        return this;
    }

    _addShape() {return this;}


}


export class ItemView extends View
{
    _addShape()
    {
        if(this.key)
        {
            let sp = this.scene.add.sprite(0,0,this.key,this.frame);
            sp.setPipeline('Light2D');
            sp.displayWidth = this.wid;
            sp.displayHeight = this.hei;
            // sp.flipX = this._tmp.flipX;
            // sp.flipY = this._tmp.flipY;
            this.add(sp);
            this._shape = sp;
        }

        return this;
    }
}


export class RoleView extends View
{
    
    //--------------------------------------------------
    // Local
    //--------------------------------------------------
    _setData()
    {
        this.roleD={};      // 新增 roleD
        super._setData();   // 從 bb 取得 roldD
        
        this._faceR = this.roleD.faceR;

        let b = this.roleD.b;
        let g = this.roleD.g;
        let z = this.roleD.z;

        if(b) {this.bl=b.l; this.br=b.r; this.bt=b.t; this.bb=b.b;}
        if(g) {this.gl=g.l; this.gr=g.r; this.gt=g.t; this.gb=g.b;}
        if(z) {this.zl=z.l; this.zr=z.r; this.zt=z.t; this.zb=z.b;}

        this.wid = this.roleD.w; 
        this.hei = this.roleD.h;
        this.anchorX = this.roleD.anchor.x;
        this.anchorY = this.roleD.anchor.y;

        return this;
    }

    _addShape()
    {
        const roleD = this.roleD;
        this._shape = this.scene.add.container(0,0);
        this.add(this._shape);
        if(roleD.body) {this._addPart(roleD.body, GM.PART_BODY);}
        if(roleD.head) {this._addPart(roleD.head, GM.PART_HEAD);}
        if(roleD.hand) {this._addPart(roleD.hand, GM.PART_HAND);}
        this._equips = []; 
        
        return this;
    }

    _addPart(part, type)
    {
        const _DEPTH = Object.freeze({
            [GM.PART_BODY] : 0,
            [GM.PART_HEAD] : 2,
            [GM.PART_HAND] : 5,
            [GM.CAT_HELMET] : 3,
            [GM.CAT_CHESTPLATE] : 1,
            [GM.CAT_GLOVES] : 6,
            [GM.CAT_BOOTS] : 1,
            [GM.CAT_WEAPON] :4,
        });

        let addSp = (sprite, depth)=>
        {
            if(!sprite) {return;}
            let [key,frame]=sprite.split('/');
            if(key)
            {
                let sp = this.scene.add.sprite(0,0,key,frame);
                sp.setScale(part.scale);
                sp.setPipeline('Light2D');
                sp.setOrigin(0.5,1);
                sp.x = part.x ?? 0;
                sp.y = part.y ?? 0;
                sp.angle = part.a ?? 0;
                sp.depth = depth;
                this._shape.add(sp);
                sps.push(sp);
            }
        }

        let sps = [];
        addSp(part.sprite, _DEPTH[type]);
        addSp(part.ext, 6);
        return sps;
    }

    _sortParts()
    {
        let children = this._shape.getAll().sort((a, b) => a.depth - b.depth);
        children.forEach(child => {this._shape.bringToTop(child);});
    }

    _addEquip(item)
    {
        if(!item.equip) {return;}
        let sps = this._addPart(item.equip, item.cat);
        this._sortParts();
        this._equips.push(...sps);
    }

    _removeEquips()
    {
        this._equips.forEach((equip)=>{equip.destroy();})
        this._equips = [];
    }

    //--------------------------------------------------
    // public
    //--------------------------------------------------
    bind(root)
    {
        super.bind(root);
        
        // 註冊 event
        root.on('equip', this.equip.bind(this));
        root.on('face', this._faceTo.bind(this));
        root.on('removeWeight', this._removeWeight.bind(this));
        root.on('addWeight', this._addWeight.bind(this));
        root.on('updateDepth', this._updateDepth.bind(this));
    }

    equip()
    {
        const {bb} = this.ctx;

        this._removeEquips();
        bb.equips.forEach((eq)=>{
            if(eq)
            {
                const dat = DB.item(eq.id);
                this._addEquip(dat);
            }
        })
    }
}






