import {GM, PART_DEPTH, ROLE_PART, NODE_DEPTH, NODE_DEPTH_ANIM, NODE_PIVOT, PART_NODE, BACK_NODE, nodeFor} from '../core/setting.js'
import {DEBUG,DBG} from '../core/debug.js'
import DB from '../data/db.js'
import {T,dlog} from '../core/debug.js'
import {uPic,uBbc,uImage} from '../ui/uicomponents.js'
import Utility from '../core/utility.js'
import FxCell, {zoneDelays} from '../core/fxcell.js'
import {playParticle} from '../core/particle.js'
import {setSpot} from '../core/spotlight.js'
import {thumbOf} from '../core/prefab.js'
import {equipFor, hiddenParts, weaponOf, handOf, ROLE_PARTS, WRISTS, pivotOf, atPivot, fromPivot, rigOf} from '../core/equip.js'
const _tag = 'view';
const ONE_TILE = {x:0, y:0, w:GM.TILE_W, h:GM.TILE_H, hw:GM.TILE_W/2, hh:GM.TILE_H/2};
// 單張圖道具量圖邊的欄位，照 _edgeBox() 的參數順序(左、右、寬、上、下、高)
const EDGE = {grid:['gl','gr','gw','gt','gb','gh'], zone:['zl','zr','zw','zt','zb','zh']};

function debugDraw(mode=DEBUG.mode,text)
{
    if(!DEBUG.enable)
    {
        this._dbgGraphics?.clear();
        if(this._dbgText) {this._dbgText.text='';}
        if(this._dbgPos) {this._dbgPos.text='';}
        return;
    }

    if(!this._dbgGraphics)
    {
        this._dbgGraphics = this.scene.add.graphics().setDepth(Infinity);
    }

    if(!this._dbgText)
    {
        this._dbgText = this.scene.add.text(0,0,'',
                {   
                    fontFamily:GM.FONT,
                    fontSize:'18px',
                    color:'#000',
                    // stroke:'#fff',
                    // strokeThickness:3,
                    backgroundColor: '#fff',
                    // padding: {x:0,y:0}    
                });
        this._dbgText.setDepth(Infinity);
        this._dbgText.setOrigin(0.5,1);
    }

    if(!this._dbgPos)
    {
        this._dbgPos = this.scene.add.text(0,0,'',
                {   
                    fontFamily:GM.FONT,
                    fontSize:'18px',
                    color:'#000',
                    // stroke:'#fff',
                    // strokeThickness:3,
                    backgroundColor: '#fff',
                    // padding: {x:0,y:0}    
                });
        this._dbgPos.setDepth(Infinity);
        this._dbgPos.setOrigin(0);
    }

    const draw_grid = ()=>{
        if((mode&DBG.MODE.GRID)===0) {return;}
        if(this._grid)
        {
            // grid 的 x, y 是 grid 的中心點(相對錨點)
            // Phaser.Geom.Rectangle( left, top, w, h )
            this._dbgGraphics.lineStyle(4, 0x00ff00, 1);
            const x = this.anchor.x + this._grid.x - this._grid.hw;
            const y = this.anchor.y + this._grid.y - this._grid.hh;
            const rect = new Phaser.Geom.Rectangle( x, y, this._grid.w, this._grid.h );
            this._dbgGraphics.strokeRectShape(rect);
            // 顯示 grid 中心點
            const circle = new Phaser.Geom.Circle(this.posG.x,this.posG.y,5);
            this._dbgGraphics.strokeCircleShape(circle);
        }
    }

    const draw_zone = ()=>{
        if((mode&DBG.MODE.ZONE)===0) {return;}
        if(this._zone)
        {
            // zone 的 x, y 是 zone 的中心點
            // Phaser.Geom.Rectangle( left, top, w, h )
            this._dbgGraphics.lineStyle(2, 0xff0000, 1);
            let p = {x:this.anchor.x + this._zone.x - this._zone.width/2,
                    y:this.anchor.y + this._zone.y - this._zone.height/2}
            let rect = new Phaser.Geom.Rectangle(p.x,p.y,this._zone.width,this._zone.height);
            this._dbgGraphics.strokeRectShape(rect);
        }
    }

    // 圖的範圍(rect)
    const draw_shape = ()=>{
        if((mode&DBG.MODE.SHAPE)===0) {return;}
        // Phaser.Geom.Rectangle( left, top, w, h )
        this._dbgGraphics.lineStyle(2, 0xffffff, 1);
        const rect = this._getShapeRect();
        const lb = {x:rect.x, y:rect.bottom}    // 左下角
        // 顯示外框及左下角
        const clb = new Phaser.Geom.Circle(lb.x,lb.y,5);
        const cc = new Phaser.Geom.Circle(rect.centerX,rect.centerY,5);
        this._dbgGraphics.strokeRectShape(rect);
        this._dbgGraphics.strokeCircleShape(clb);  
        this._dbgGraphics.strokeCircleShape(cc); 
        // 顯示左下角的座標
        this._dbgPos.x = lb.x;
        this._dbgPos.y = lb.y+5;
        this._dbgPos.setText(`(${lb.x},${lb.y})`)   
    }

    const draw_anchor = ()=>{
        if((mode&DBG.MODE.ANCHOR)===0) {return;}
        // 顯示錨點
        this._dbgGraphics.lineStyle(2, 0xff00ff, 1);
        this._dbgGraphics.strokeCircle(this.anchor.x,this.anchor.y,5);
    }

    const draw_pts = ()=>{
        if((mode&DBG.MODE.POINT)===0) {return;}
        // 顯示 pts
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this.root.getPts(GM.player).forEach(ep => { 
            this._dbgGraphics.strokeCircle(ep.x, ep.y, 10); });
    }

    const draw_sense=()=>{
        if((mode&DBG.MODE.SCESE)===0) {return;}
        const bb = this.root.senseBB?.(8);
        if(bb)
        {
            this._dbgGraphics.lineStyle(2, 0xffff00, 0.8);
            this._dbgGraphics.strokeRect(bb.x - bb.hw, bb.y - bb.hh, bb.hw * 2, bb.hh * 2);
        }
    }

    const clr = ()=>{
        this._dbgGraphics.clear();
        if(this._dbgText) {this._dbgText.text='';}
        if(this._dbgPos) {this._dbgPos.text='';}
        this._dbgGraphics.lineStyle(2, 0xff0000, 1);
    }

    const show_text = ()=>{
        if((mode&DBG.MODE.TEXT)===0) {return;}
        if(this._dbgText)
        {
            const rect = this._getShapeRect();
            this._dbgText.x = rect.centerX;
            this._dbgText.y = rect.y;
            this._dbgText.setText(text??this.root.bb.sta);
        }
    }

    clr();

    draw_grid();
    draw_zone();
    draw_anchor();
    draw_pts();
    draw_shape();
    show_text();
    draw_sense();
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
    constructor(scene)
    {
        super(scene);
        this.scene.add.existing(this);

        this._hover = false;

        // 以下參數一定要給值，_setData()時，才會 assign 相對應的值
        // 座標一律相對錨點(＝GameObject 的位置，view 本身放在錨點)
        this.wid = 0;               // 單張圖道具的圖片寬(Tiled 物件的寬)
        this.hei = 0;               // 單張圖道具的圖片高
        this.interactive = false;   // 是否可以互動
        this.en_outline = true;     // 是否開啟 outline 的功能
        this.isBlock = false;       // 是否擋視線/攻擊(登記到 map.blockGrid)
        this.weight = 1000;
        // 單張圖道具(Tiled／item.json)：量圖片矩形的邊，三選二，沒寫＝貼齊圖邊(都沒寫＝整張圖)
        this.gl=null, this.gr=null, this.gt=null, this.gb=null; this.gw=null; this.gh=null;   // grid：地圖網格方塊
        this.zl=null, this.zr=null, this.zt=null, this.zb=null; this.zw=null; this.zh=null;   // zone：可互動的方塊，interactive=true 才有作用
        this.al=null, this.ar=null, this.at=null, this.ab=null;   // 錨點到圖片左/右/上/下邊的距離(al 優先於 ar、at 優先於 ab)，沒寫的軸＝圖片中心

        this.key = null;            // sprite 的 key
        this.frame = null;          // sprite 的 frame
        this.scl = null;            // sprite 的 scl, 注意:變數名稱不可為 this.scale，會跟 Phaser.GameObjects.Container 相衝
        this.keepRatio = false;     // sprite 是否保持寬高比
        this.flipX = false;         // sprite 是否水平翻轉
        this.flipY = false;         // sprite 是否垂直翻轉
    }

    get tag() {return _tag;}          // 回傳元件的標籤
    get root() {return this._root;}
    get ctx() {return this._root.ctx;}
    get pos() {return this._root.pos;}

    // 錨點=gameobject的原點(world space)
    get anchor() {return this.pos;}
    // grid 的中心點(world space)；沒有 grid＝錨點
    get posG() {const g = this._grid, p = this.anchor; return g ? {x:p.x+g.x, y:p.y+g.y} : {x:p.x, y:p.y};}
    // grid的BBox=>{x,y,h,w,hh,hw}，x,y為BBox中心點(world space)；沒有 grid＝錨點那一格
    get gridBB() {return {...(this._grid ?? ONE_TILE),...this.posG}}
    // 圖的範圍(相對錨點 {x,y,w,h})：單張圖＝圖片矩形、prefab＝縮圖外框、角色＝部位合成的範圍；遮擋、點選、fx 對齊用
    get rect() {return this._img;}
    // 可互動方塊(相對錨點 {x,y,w,h})，沒有＝null
    get zoneBox() {return this._zoneBox;}
    // shape 靜止時的位置(相對錨點)，shape 的轉動都繞這點
    get pivot() {return {x:this._shape?.x ?? 0, y:this._shape?.y ?? 0};}

    // anim.js 會用到
    get shape() {return this._shape;}
    // 播武器動畫的節點＝拿武器的那隻手(equip.hand，空手＝前手)，空的(動物、沒手)不播
    get wrist() {const n = this._nodes?.[this._hand ?? 'wristF']; return n?.length ? n : null;}
    // 武器動畫在動 sp(手腕節點)時 on＝true 整組搬到 NODE_DEPTH_ANIM(沒有的節點不動)，收回後 on＝false 搬回
    liftWrist(sp, on)
    {
        const k = Object.keys(this._nodes ?? {}).find((k)=>this._nodes[k]===sp);
        if(!k || NODE_DEPTH_ANIM[k]===undefined || !sp.active) {return;}
        const d = on ? NODE_DEPTH_ANIM[k] : NODE_DEPTH[k];
        if(sp.depth===d) {return;}
        sp.setDepth(d);
        this._sortParts();
    }

    // 不拿武器的另一隻手(播 anim.json 的 otherKeys)，空的＝null
    get otherWrist() {const n = this._nodes?.[this._hand === 'wristB' ? 'wristF' : 'wristB']; return n?.length ? n : null;}
    get rig() {return this._rig;}
    get sprites() {const flat = (c)=>c.list ? c.list.flatMap(flat) : [c]; return this._shape ? flat(this._shape) : [];}   // shape→rig→支點節點，攤平

    //--------------------------------------------------
    // outline
    //--------------------------------------------------
    _setOutline(on)
    {
        this._hover = on;
        this._refreshOutline();
    }

    // 技能範圍內的目標(紅框)，優先於 hover(白框)
    _setTargeted(on)
    {
        if(this._targeted === on) {return;}
        this._targeted = on;
        this._refreshOutline();
    }

    // area-like 技能(火牆/範圍/扇形)選取中不顯示 hover 白框，範圍靠預覽跟紅框表示
    _refreshOutline()
    {
        if(!this.en_outline) {return;}
        const hover = this._hover && !GM.player?.isSelAreaLike?.();
        const color = this._targeted ? GM.COLOR.TARGET : hover ? GM.COLOR.WHITE : null;
        if(this._shape) {this._outline_shape(color);}
        else {this._outline_rect(color!==null);}
    }

    _outline_shape(color)
    {
        let shape = this._shape;

        if(!this._outline) {this._outline = this.scene.plugins.get('rexOutlinePipeline');}

        this._outline.remove(shape);
        if(color!==null) {this._outline.add(shape,{thickness:3, outlineColor:color});}
    }

    _outline_rect(on)
    {
        if(!this._zone) {return;}
        if(!this._rect)
        {
            let p = {x:this.anchor.x + this._zone.x, y:this.anchor.y + this._zone.y};
            this._rect = this.scene.add.rectangle(p.x, p.y, this._zone.width, this._zone.height, 0xffffff, 0.5);
            this._rect.setStrokeStyle(2, 0xffffff)
            this._rect.setDepth(Infinity);
        }

        if(on)
        {
            let p = {x:this.anchor.x + this._zone.x, y:this.anchor.y + this._zone.y};

            this._rect.x = p.x;
            this._rect.y = p.y;
        }

        this._rect.visible = on;
    }

    _setOcclude(on)
    {
        if(this._occluded === on) {return;}
        this._occluded = on;
        this._shape?.setAlpha(on ? 0.5 : 1.0);
    }

    _getShapeRect()
    {
        const r = this.rect, p = this.anchor;
        return new Phaser.Geom.Rectangle(p.x + r.x, p.y + r.y, r.w, r.h);
    }
    
    //--------------------------------------------------
    // faceTo
    //--------------------------------------------------
    _faceTo(pt)
    {
        const myX = this.pos.x;
        if(pt.x === myX) {return;}
        if(!this._shape) {return;}
        // _faceR: 原始圖像預設朝向，true=朝右，false=朝左
        // flip: 是否需要翻轉 —— 目標在右但預設朝左，或目標在左但預設朝右，才需要翻轉
        const flip = (pt.x > myX) !== this._faceR;
        const isFlipped = this._shape.scaleX < 0;
        // 只在方向改變時才動，*=-1 保留原有縮放比例，避免強制覆寫成 ±1
        if(flip !== isFlipped) {this._shape.scaleX *= -1;}
    }

    //--------------------------------------------------
    // Z depth
    //--------------------------------------------------
    _updateDepth(depth)
    {
        if(depth != null) {this._root.setDepth(depth);}
        else {this._root.updateDepth();}
        return this;
    }

    //--------------------------------------------------
    // 占地方塊(grid／zone)：相對錨點的 {x,y,w,h}，x,y＝左上角
    //--------------------------------------------------
    // a,b(邊界),size(寬/高) 三選二推算；a,b 都給時以 a,b 為準重算 size
    // 只有 1 個給的話：缺的邊界當 0，size 缺的話用剩下兩個推算
    _resolveAxis(a, b, size, total)
    {
        if(a!=null && b!=null) {}
        else if(a!=null) {b = (size!=null) ? total-a-size : 0;}
        else if(b!=null) {a = (size!=null) ? total-b-size : 0;}
        else {b = 0; a = (size!=null) ? total-b-size : 0;}

        size = total-a-b;
        return {a, b, size};
    }

    // 量圖片矩形(_img)的邊算出方塊(相對錨點)
    _edgeBox([l, r, w, t, b, h])
    {
        const img = this._img;
        const H = this._resolveAxis(l, r, w, img.w), V = this._resolveAxis(t, b, h, img.h);
        return {x:img.x+H.a, y:img.y+V.a, w:H.size, h:V.size};
    }

    _hasEdge(k) {return EDGE[k].some(f=>this[f]!=null);}

    // grid／zone 方塊：單張圖道具量圖邊(沒寫＝整張圖)；RoleView／prefab 覆寫(沒寫＝沒有)
    _box(k) {return this._edgeBox(EDGE[k].map(f=>this[f]));}

    //--------------------------------------------------
    // 地圖網格 (weight)：沒有 grid＝不佔格
    //--------------------------------------------------
    _addGrid()
    {
        const b = this._box('grid');
        this._grid = b ? {w:b.w, h:b.h, hw:b.w/2, hh:b.h/2, x:b.x+b.w/2, y:b.y+b.h/2} : null;
        return this;
    }

    _removeWeight(weight)
    {
        if(!this._grid) {return this;}
        const wei = weight ?? this.weight;
        wei!=0 && this.scene.map.updateGrid(this.posG,-wei,this._grid);
        this.isBlock && this.scene.map.updateBlock(this.posG,-1,this._grid);

        return this;
    }

    _addWeight(pt,weight)
    {
        if(!this._grid) {return this;}
        const wei = weight ?? this.weight;
        const p = pt?this._pos2posG(pt):this.posG;
        wei!=0 && this.scene.map.updateGrid(p,wei,this._grid);
        this.isBlock && this.scene.map.updateBlock(p,1,this._grid);

        return this;
    }

    // 已登記在地圖上時才呼叫(如門開關)，直接增減 blockGrid
    _setBlock(on)
    {
        if(this.isBlock === on) {return;}
        this.isBlock = on;
        this._grid && this.scene.map.updateBlock(this.posG,on?1:-1,this._grid);
    }

    //將 錨點 轉換成 grid的中心點 (world space)
    _pos2posG(p)
    {
        return {x:p.x+this._grid.x, y:p.y+this._grid.y};
    }

    //--------------------------------------------------
    // 設定 anchor：單張圖道具的錨點在圖片矩形(wid×hei)的哪裡(al/ar/at/ab 量邊，沒寫的軸＝中心)，
    // 算出圖片矩形相對錨點的位置；modify(Tiled 物件，位置＝圖片中心)把 root 挪到錨點
    //--------------------------------------------------
    _setAnchor(modify)
    {
        const w = this.wid, h = this.hei;
        const ax = this.al!=null ? this.al-w/2 : this.ar!=null ? w/2-this.ar : 0;
        const ay = this.at!=null ? this.at-h/2 : this.ab!=null ? h/2-this.ab : 0;
        this._img = {x:-ax-w/2, y:-ay-h/2, w, h};
        if(modify)
        {
            this._root.x += ax;
            this._root.y += ay;
        }
        return this;
    }

    //--------------------------------------------------
    // 與滑鼠互動
    //--------------------------------------------------
    _addListener()
    {
        if(!this.interactive) {return this;}

        // 產生 zone 方塊；沒有 zone＝點不到
        const z = this._zoneBox = this._box('zone');
        if(!z) {return this;}
        this._zone = this.scene.add.zone(z.x + z.w/2, z.y + z.h/2, z.w, z.h)
        this.add(this._zone)

        // 將 zone 方塊設成可互動的
        const {emit}=this.ctx;
        this._zone.setInteractive()
            .on('pointerover',()=>{
                this._setOutline(true);
                emit('over');
                if(DEBUG.enable){debugDraw.bind(this)();}
            })
            .on('pointerout',()=>{
                this._setOutline(false);
                emit('out');
                if(DEBUG.enable){debugDraw.bind(this)(0);}
            })
            .on('pointerdown',(pointer)=>{
                if (pointer.rightButtonDown()) 
                {
                    emit('down');
                    // this._rightButtonDown();
                }
            })

        return this;
    }

    _interact(on)
    {
        if(!this._zone) {return;}   // interactive=false 的物件沒有 zone
        if(on) { this._zone.setInteractive();}
        else {
            this._zone.disableInteractive();
            this._setOutline(false);
            this.ctx.emit('out');
            if(DEBUG.enable){debugDraw.bind(this)(0);}
        }
    }

    //--------------------------------------------------
    // 更新位置
    //--------------------------------------------------
    _updatePos(pos)
    {
        const{root}=this.ctx;
        this._removeWeight();
        root.pos=pos;
        this._addWeight();
        this._updateDepth();
    }

    //--------------------------------------------------
    // 移除 view
    //--------------------------------------------------
    _remove()
    {
        const{bb}=this.ctx;
        this._removeWeight();
        this.weight=0;  // 避免重複呼叫_remove()時，weight/block被remove兩次
        this.isBlock=false;
                        // ondead 會呼叫一次_remove()，
                        // GameObject._remove()時，com.unbind()又會呼叫一次

        // if(this._zone)
        // {
        //     this._zone.destroy();
        //     this._zone=null;
        //     if(this._hover)
        //     {
        //         this._outline_shape(false);
        //         this.ctx.emit('out');
        //     }
        // }

        if(this._dbgGraphics) {this._dbgGraphics.destroy();this._dbgGraphics=null;}
        if(this._dbgText) {this._dbgText.destroy();this._dbgText=null;}
        if(this._dbgPos) {this._dbgPos.destroy();this._dbgPos=null;}
    }

    // 死亡時，設定是否互動
    _setZone(en, tag)
    {
        this._en = this._en||0;
        this._en += en ? 1 : -1;
        // console.log('setZone',tag, en, this._en);
        this._interact(this._en>=0);
    }

    //--------------------------------------------------
    // 初始化
    //--------------------------------------------------
    _init(modify, depth, alpha)
    {
        this._setData()
            ._setAnchor(modify)
            ._addShape(alpha)
            ._addGrid()
            ._updateDepth(depth)
            ._addWeight()
            ._addListener()

        // 將 view 加到 gameobject
        this.root.add(this);
    }

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

    _addShape(alpha) {return this;}

    //--------------------------------------------------
    // public
    //--------------------------------------------------
    // isTouch() {return true;}

    bind(root, config)
    {
        this._root = root;

        // 初始化
        const {modify, depth, alpha} = config;
        this._init(modify, depth, alpha);

        // 算出 grid 所佔的 tile，尋路 會用到；沒有 grid＝1×1
        const{bb} = this.ctx;
        const g = this._grid ?? ONE_TILE;
        bb.tile = { tw : Math.ceil(g.w/GM.TILE_W),
                    th : Math.ceil(g.h/GM.TILE_H) };

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.addP('posG',{get:()=>this.posG});  // 在 root 新增 get，指向 posG
        root.addP('gridBB',{get:()=>this.gridBB});    // 在 root 新增 get，指向 gridBB
        root.isTouch = this.isTouch;
        root.setTargeted = this._setTargeted.bind(this);
        root.refreshOutline = this._refreshOutline.bind(this);
        // 給內部元件使用
        root.view = this;
        root.removeWeight = this._removeWeight.bind(this);
        root.addWeight = this._addWeight.bind(this);
        root.setBlock = this._setBlock.bind(this);
        root.updatePos = this._updatePos.bind(this);
        root.setZone = this._setZone.bind(this);
        // 給外部使用
        root.setOcclude = this._setOcclude.bind(this);
        root.getShapeRect = this._getShapeRect.bind(this);
        root.dbg = debugDraw.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
    }

    unbind() {this._remove();}
}


export class ItemView extends View
{
    constructor(scene)
    {
        super(scene);
        this.prefab = null;     // prefab.json 的 id(docs/prefab.md)：有就照零件建圖，不用 key/frame
        this.look = null;       // prefab 的狀態，沒給＝prefab 的 look
    }

    // prefab：圖的範圍＝縮圖外框、錨點＝prefab 的 (0,0)
    _setData()
    {
        super._setData();
        const pf = this._pf = this.prefab ? DB.prefab(this.prefab) : null;
        if(!pf) {return this;}
        const t = thumbOf(pf);
        this.wid = t.w;
        this.hei = t.h;
        this.look ??= pf.look ?? null;
        if(pf.acts && Object.keys(pf.acts).length) {this.interactive = true;}
        return this;
    }

    // prefab：Tiled 物件的位置＝縮圖中心(modify 把 root 挪到錨點)；runtime 生的(uid -1：放置道具、存檔重建、場景分頁)位置就是錨點，
    // 存檔記的也是錨點，重建時不能再挪一次
    _setAnchor(modify)
    {
        if(!this._pf) {return super._setAnchor(modify);}
        const t = thumbOf(this._pf);
        this._img = {x:t.x, y:t.y, w:t.w, h:t.h};
        if(modify && this.root.uid!==-1)
        {
            this._root.x -= t.x + t.w/2;
            this._root.y -= t.y + t.h/2;
        }
        return this;
    }

    // prefab 的方塊直接相對錨點、沒寫＝沒有；Tiled 物件有寫任何一個該組的量邊欄位(量縮圖外框)就整組蓋掉
    _box(k)
    {
        if(!this._pf || this._hasEdge(k)) {return super._box(k);}
        return this._pf[k] ?? null;
    }

    // prefab 的 acts：{動作 id: 狀態}，右鍵選單照 id 出按鈕(文字 id.lab())，目標狀態＝目前狀態的藏起來
    _bindActs(root)
    {
        for(const [act, look] of Object.entries(this._pf.acts ?? {}))
        {
            root._setAct(act, ()=>this.look===look ? GM.HIDE : GM.EN);
            root.on(act, ()=>this._setLook(look));
        }
        if(this._pf.defAct) {root._defAct = this._pf.defAct;}
    }

    _addShape(alpha)
    {
        // console.log('_addShape=',this.key,this.frame,this.wid,this.hei)

        if(this._pf)
        {
            this._buildPrefab();
            if(alpha!=null) {this._shape.setAlpha(alpha);}
        }
        else if(this.key)
        {
            if(Utility.isTexture(this.scene,this.key))
            {
                // frame 為 null(例如 image-collection tileset 沒有數字 frame)時不能拼成字串，
                // "key:null" 這種字串仍然會去查一個叫 "null" 的 frame，要整段省略掉才會落回 base frame
                const icon = (this.frame!=null) ? `${this.key}:${this.frame}` : this.key;
                const sp = uImage.call(this,this.scene,{icon:icon})
                sp.setPipeline('Light2D');
                if(this.scl) { sp.setScale(this.scl); }
                else if(this.keepRatio)
                {
                    const ratio = sp.width / sp.height;
                    if (this.wid / this.hei > ratio)
                    {
                        sp.displayHeight = this.hei;
                        sp.displayWidth = this.hei * ratio;
                    }
                    else
                    {
                        sp.displayWidth = this.wid;
                        sp.displayHeight = this.wid / ratio;
                    }
                }
                else
                {
                    sp.displayHeight = this.hei;
                    sp.displayWidth = this.wid;
                }
                // sp.flipX = this.flipX;
                // sp.flipY = this.flipY;
                this._shape = sp;
            }
            else
            {
                const scl=this.scl??1;
                const sp = uBbc.call(this,this.scene,{   
                                    text:this.key,
                                    fontSize:this.wid*scl,
                                })
                sp.setPipeline('Light2D');
                sp.setOrigin(0.5);
                this._shape = sp;
            }

            // 圖片中心＝圖片矩形的中心(相對錨點)
            const img = this._img;
            this._shape.setPosition(img.x + img.w/2, img.y + img.h/2);

            // set flipX
            if(this.flipX) {this._shape.scaleX *= -1;}

            if(alpha!=null) {this._shape.setAlpha(alpha);}
        }

        return this;
    }

    //--------------------------------------------------
    // prefab：png 零件在 _shape(放在錨點的 container)裡照 depth 排，粒子跟著 root、光源放在錨點＋x/y；
    // 零件有 look＝只在那個狀態出現，沒有＝永遠在；png 零件的 fx(fx.json)跑 spawn/idle/end tween(同 FxCell，動的是包圖的 holder)
    //--------------------------------------------------
    _buildPrefab()
    {
        const scene = this.scene;
        this._shape = scene.add.container(0, 0);
        this.add(this._shape);
        const parts = (this._pf.parts ?? []).map((p, i)=>({p, i}))
                        .sort((a, b)=>(a.p.depth ?? 0) - (b.p.depth ?? 0) || a.i - b.i);
        this._parts = [];
        for(const {p, i} of parts)
        {
            const e = {p, i, on:false};
            if(p.img)
            {
                const [key, frame] = p.img.split(':');
                if(!scene.textures.exists(key)) {dlog(T.WARN)(`prefab ${this.prefab}：沒有圖 ${p.img}`); continue;}
                const img = scene.add.image(0, 0, key, frame)
                    .setOrigin(p.ox ?? 0.5, p.oy ?? 1).setScale(p.sx ?? 1, p.sy ?? 1)
                    .setFlipX(!!p.flip).setAngle(p.angle ?? 0).setPipeline('Light2D');
                e.holder = scene.add.container(p.x ?? 0, p.y ?? 0, [img]).setVisible(false);
                e.fx = p.fx ? DB.fx(p.fx) : null;
                this._shape.add(e.holder);
            }
            else if(!p.particle && !p.light) {continue;}
            this._parts.push(e);
        }
        this._applyLook(false);
    }

    _applyLook(anim)
    {
        const look = this.look;
        if(look && !this._pf.parts?.some(p=>p.look===look)) {dlog(T.WARN)(`prefab ${this.prefab} 沒有狀態 ${look}`);}
        for(const e of this._parts ?? [])
        {
            const on = (!e.p.look || e.p.look===look) && !this._hideParts?.has(e.i);
            if(on===e.on) {continue;}
            e.on = on;
            if(e.holder) {this._imgOn(e, on, anim);}
            else if(e.p.particle) {this._particleOn(e, on);}
            else {this._lightOn(e, on);}
        }
    }

    _imgOn(e, on, anim)
    {
        const h = e.holder, fx = e.fx, tweens = this.scene.tweens;
        tweens.killTweensOf(h);
        if(on)
        {
            h.setPosition(e.p.x ?? 0, e.p.y ?? 0).setScale(1).setAlpha(1).setAngle(0).setVisible(true);
            const idle = ()=>{
                if(!fx?.idle) {return;}
                const {randDelay=0, ...tw} = fx.idle;
                tweens.add({...tw, targets:h, delay:Math.random()*randDelay});
            };
            if(anim && fx?.spawn)
            {
                const {stagger, from, ...tw} = fx.spawn;
                tweens.add({...tw, targets:h, onComplete:idle});
            }
            else {idle();}
        }
        else if(anim && fx?.end) {tweens.add({...fx.end, targets:h, onComplete:()=>h.setVisible(false)});}
        else {h.setVisible(false);}
    }

    _particleOn(e, on)
    {
        if(on) {e.em = playParticle(this.scene, DB.particle(e.p.particle), {target:this.root, ox:e.p.x ?? 0, oy:e.p.y ?? 0});}
        else {e.em?.stop(); e.em = null;}
    }

    _lightOn(e, on)
    {
        const lights = this.scene.lights;
        if(on)
        {
            const l = e.p.light, pos = this.root.pos;
            const color = Phaser.Display.Color.HexStringToColor(l.color ?? '#ffcc88').color;
            e.light = setSpot(lights.addLight(pos.x + (e.p.x ?? 0), pos.y + (e.p.y ?? 0), l.r ?? 120, color, l.i ?? GM.LIGHT), l);
        }
        else if(e.light) {lights.removeLight(e.light); e.light = null;}
    }

    _setLook(look)
    {
        if(!this._pf || look===this.look) {return;}
        this.look = look;
        this._applyLook(true);
    }

    // 藏掉 prefab.json 裡第幾個零件（場景分頁 sandbox 的零件 hide 模式用，不存檔）
    _setHiddenParts(idxs)
    {
        this._hideParts = new Set(idxs);
        if(this._pf) {this._applyLook(false);}
    }

    _updatePos(pos)
    {
        super._updatePos(pos);
        this._syncLights();
    }

    // 光源不在 container 裡：物件搬了(場景分頁拖曳也是)要跟上
    _syncLights()
    {
        const p = this.root.pos;
        this._parts?.forEach(e=>e.light && e.light.setPosition(p.x + (e.p.x ?? 0), p.y + (e.p.y ?? 0)));
    }

    _remove()
    {
        super._remove();
        this._parts?.forEach(e=>{
            if(e.holder) {this.scene?.tweens.killTweensOf(e.holder);}
            e.em?.stop();
            if(e.light) {this.scene?.lights.removeLight(e.light);}
        });
        this._parts = null;
    }

    _setTexture(key_frame)
    {
        if(this._pf) {return;}
        const[key,frame]=key_frame.split(':');
        this._shape.setTexture(key,frame);
    }

    // x,y＝origin 點相對錨點，沒寫＝圖片矩形的中心
    _setShape({sprite,x,y,scl,origin={x:0.5,y:0.5}}={})
    {
        if(this._pf) {return;}
        const[key,frame]=sprite.split(':');
        const img = this._img;
        this._shape.setTexture(key,frame);
        this._shape.setOrigin(origin.x,origin.y);
        if(scl!=null) {this._shape.setScale(scl);}
        this._shape.x = x ?? img.x + img.w/2;
        this._shape.y = y ?? img.y + img.h/2;
    }

    //--------------------------------------------------
    // public
    //--------------------------------------------------
    bind(root,config)
    {
        super.bind(root,config);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.setTexture = this._setTexture.bind(this);
        root.setShape = this._setShape.bind(this);
        root.setLook = this._setLook.bind(this);
        root.setHiddenParts = this._setHiddenParts.bind(this);
        root.getLook = ()=>this.look;
        if(this._pf) {this._bindActs(root);}

        // 3.註冊(event)給其他元件或外部呼叫
        // root.on('setTexture', this._setTexture.bind(this));

    }

    // prefab 的狀態跟著存檔；讀檔直接換狀態不播 fx
    load(data)
    {
        if(!this._pf || data?.look==null || data.look===this.look) {return;}
        this.look = data.look;
        this._applyLook(false);
    }

    save() {return this._pf ? {look:this.look} : undefined;}
}


// 跨多格顯示的區域類物件(如持續存在的地面法陣)：每一格各放一個 icon(emoji)，
// 不可走或 isBlocked 的格子不生成(牆、桌子)，地圖權重只登記有生成的格子
export class ZoneView extends View
{
    constructor(scene)
    {
        super(scene);
        this.zoneW = 1;   // 橫向總格數
        this.zoneH = 1;   // 縱向總格數
        this.zoneImg = null;   // 每格要顯示的 icon(emoji)
        this.zoneAnim = null;  // fx.json 的一筆 {img, cell, spawn, idle, tick, end}，spawn/idle/tick/end 是 Phaser tween 設定
        this.zoneSrc = null;   // 施法者位置(world)，spawn.from='near' 用
        this._cells = [];
    }

    // 格數為偶數時，中心點偏向負向那格(跟 com_ability.js 的 _axisRange 邏輯一致)
    // 單格的外觀/動畫交給 FxCell，這裡只負責多格排列(jitter)跟 spawn 的先後順序(stagger/from)
    // 每格直接放在 scene 上各自設 depth(該格中心 y+1，蓋過站在同一格的角色、被下一排的物件蓋住)
    _addShape()
    {
        const cw = this.zoneW ?? 1;
        const ch = this.zoneH ?? 1;
        const xs = -Math.floor(cw/2), xe = xs+cw-1;
        const ys = -Math.floor(ch/2), ye = ys+ch-1;
        const [w,h] = [GM.TILE_W, GM.TILE_H];
        const {jitter=0} = this.zoneAnim?.cell ?? {};
        const map = this.scene.map;
        const cen = this.anchor;
        for(let x=xs; x<=xe; x++)
        {
            for(let y=ys; y<=ye; y++)
            {
                const px = cen.x+x*w, py = cen.y+y*h;
                if(!map.isOpenGround(...map.worldToTile(px,py))) {continue;}
                const jx = Phaser.Math.FloatBetween(-jitter, jitter);
                const jy = Phaser.Math.FloatBetween(-jitter, jitter);
                const fx = this.zoneImg ? new FxCell(this.scene, null, this.zoneImg, this.zoneAnim, {x:px+jx, y:py+jy, size:w}) : null;   // 沒有 img＝只有粒子
                fx?.holder.setDepth(py+1);
                this._cells.push({gx:x, gy:y, fx});
            }
        }
        this._rect = {x:cen.x+(xs+xe)/2*w, y:cen.y+(ys+ye)/2*h, w:cw*w, h:ch*h};
        return this;
    }

    _remove()
    {
        super._remove();
        this._cells.forEach(c=>c.fx?.destroy());
        this._part?.stop(true);
    }

    // fx 的 particle：整片區域一個 emitter(條目寫的是每格的量，乘有生成的格數)
    _startParticle()
    {
        const def = DB.particle(this.zoneAnim?.particle);
        if(!def || this._part || !this._cells.length) {return;}
        const r = this._rect;
        this._part = playParticle(this.scene, def, {x:r.x, y:r.y, area:{w:r.w, h:r.h, cells:this._cells.length}});
    }

    _spawnDelays(stagger, from)
    {
        const src = this.zoneSrc;
        const dist = src && (c=>Phaser.Math.Distance.Between(src.x, src.y, this.root.x+c.gx*GM.TILE_W, this.root.y+c.gy*GM.TILE_H));
        return zoneDelays(this._cells, stagger, from, dist);
    }

    // 只登記有生成的格子(牆、桌子這類被跳過的格子不加權重，否則會變成可通行)
    _updateCellWeight(wei)
    {
        if(wei==0) {return;}
        const cen = this.anchor;
        const size = {w:GM.TILE_W, h:GM.TILE_H};
        this._cells.forEach(c=>{
            this.scene.map.updateGrid({x:cen.x+c.gx*GM.TILE_W, y:cen.y+c.gy*GM.TILE_H}, wei, size);
        });
    }

    _removeWeight(weight)
    {
        this._updateCellWeight(-(weight ?? this.weight));
        return this;
    }

    _addWeight(pt,weight)
    {
        this._updateCellWeight(weight ?? this.weight);
        return this;
    }

    _hasCell(gx, gy)
    {
        return this._cells.some(c=>c.gx===gx && c.gy===gy);
    }

    _playSpawn()
    {
        const {stagger=0, from='center'} = this.zoneAnim?.spawn ?? {};
        const delays = this._spawnDelays(stagger, from);
        return Promise.all(this._cells.map((c,i)=>c.fx?.spawn(delays[i]))).then(()=>this._startParticle());
    }

    // tickParticle：那一格噴一次
    _playTick(gx, gy)
    {
        const c = this._cells.find(c=>c.gx===gx && c.gy===gy);
        if(!c) {return;}
        c.fx?.tick();
        playParticle(this.scene, DB.particle(this.zoneAnim?.tickParticle), {x:this.anchor.x+gx*GM.TILE_W, y:this.anchor.y+gy*GM.TILE_H});
    }

    _playEnd()
    {
        this._part?.stop();
        return Promise.all(this._cells.map(c=>c.fx?.end()));
    }

    bind(root, config)
    {
        super.bind(root, config);
        root.playSpawn = this._playSpawn.bind(this);
        root.playTick = this._playTick.bind(this);
        root.playEnd = this._playEnd.bind(this);
        root.hasCell = this._hasCell.bind(this);
    }
}


export class RoleView extends View
{
    //--------------------------------------------------
    // Local
    //--------------------------------------------------
    _setData()
    {
        super._setData();

        // 從 bb.meta 取得參數
        this.meta = this.ctx.bb.meta??{};
        this._faceR = this.meta.faceR;

        return this;
    }

    // Tiled 的角色 tile 物件(位置＝物件中心，wid/hei＝物件大小)：錨點＝左下角那一格的中心；點物件(大小 0)＝點本身
    _setAnchor(modify)
    {
        if(modify && this.wid>0)
        {
            this._root.x += GM.TILE_W/2 - this.wid/2;
            this._root.y += this.hei/2 - GM.TILE_H/2;
        }
        this._img = {x:-GM.TILE_W/2, y:-GM.TILE_H/2, w:GM.TILE_W, h:GM.TILE_H};   // 建完部位再量(_measure)
        return this;
    }

    // role.json 的 grid／zone 直接相對錨點，沒寫＝沒有
    _box(k) {return this.meta[k] ?? null;}

    // 支點(相對錨點)：_shape 放在這裡，轉身、走路搖晃、倒地都繞它轉；rig 反向挪回來，部位照樣相對錨點
    get pivot() {return this._pivot ?? {x:0, y:0};}

    // 轉身時 shape 繞支點翻面，範圍跟著鏡射
    get rect()
    {
        const r = this._img, sh = this._shape;
        if(!sh || sh.scaleX>=0 || !this._pivot) {return r;}
        return {x:2*this._pivot.x - r.x - r.w, y:r.y, w:r.w, h:r.h};
    }

    // 量部位合成的範圍(相對錨點，不含武器、手上的工具)：建立跟換裝時量一次，量的時候 shape 暫時回到靜止姿勢、不翻面
    _measure()
    {
        const sh = this._shape;
        if(!sh) {return;}
        const keep = {x:sh.x, y:sh.y, a:sh.angle, sx:sh.scaleX, sy:sh.scaleY};
        const p = this.pivot;
        sh.setPosition(p.x, p.y).setAngle(0).setScale(1);
        const skip = new Set([...(this._weapon ?? []), ...(this._held ?? [])]);
        const o = this.parentContainer ? {x:this.parentContainer.x, y:this.parentContainer.y} : {x:0, y:0};
        let [l, t, r, b] = [Infinity, Infinity, -Infinity, -Infinity];
        for(const sp of this.sprites)
        {
            if(!sp.visible || skip.has(sp) || !sp.getBounds) {continue;}
            const bd = sp.getBounds();
            l = Math.min(l, bd.x); t = Math.min(t, bd.y); r = Math.max(r, bd.right); b = Math.max(b, bd.bottom);
        }
        sh.setPosition(keep.x, keep.y).setAngle(keep.a).setScale(keep.sx, keep.sy);
        if(l<r) {this._img = {x:l-o.x, y:t-o.y, w:r-l, h:b-t};}
    }

    _addShape()
    {
        const {bb}=this.ctx;
        const meta = this.meta;
        this._shape = this.scene.add.container(0,0);
        this.add(this._shape);
        const body = DB.rolePart(meta, 'body');
        const rig = rigOf(body);
        this._rig = this.scene.add.container(rig.x, rig.y).setAngle(rig.a);
        this._shape.add(this._rig);
        this._nodes = {};
        for(const k of Object.keys(NODE_DEPTH))
        {
            const p = pivotOf(body, NODE_PIVOT[k] ?? k);
            const node = this.scene.add.container(p.x, p.y).setDepth(NODE_DEPTH[k]).setAngle(p.a);
            node.pivot = p;
            this._rig.add(node);
            this._nodes[k] = node;
        }
        this._parts = {};
        for(const k of ROLE_PARTS)
        {
            const p = DB.rolePart(meta, k);
            this._parts[k] = !p ? [] : k==='body' ? this._addPart({...p, x:0, y:0, a:0}) : this._addPart(p, ROLE_PART[k]);
        }
        this._equips = [];
        this._sortParts();

        // 支點：x＝身體圖的中心(左右對稱翻面)、y＝部位合成範圍的中心(倒地時整個人置中)；先在 shape 原點＝錨點時量
        this._pivot = {x:0, y:0};
        this._measure();
        const bd = this._parts.body?.[0]?.getBounds(), r = this._img;
        this._pivot = {x:bd ? bd.centerX : 0, y:r.y + r.h/2};
        this._shape.setPosition(this._pivot.x, this._pivot.y);
        this._rig.setPosition(rig.x - this._pivot.x, rig.y - this._pivot.y);

        // set flipX
        if(this.flipX) {this._shape.scaleX *= -1;}

        return this;
    }

    // 掛在支點節點的部位：數字相對節點；頭髮後片進 neckB，照本體的節點擺、換算成 neckB 的座標；
    // 手套的 handB 用同一組數字直接相對 wristB(兩隻手各自對自己的手腕)
    _addPart(part, type=GM.PART.BODY, node=PART_NODE[type])
    {
        let addSp = (sprite, depth, n, p=part)=>
        {
            if(!sprite) {return;}
            let [key,frame]=sprite.split(':');
            if(key)
            {
                let sp = this.scene.add.sprite(0,0,key,frame);
                sp.setScale(p.scale);
                sp.setPipeline('Light2D');
                sp.setOrigin(p.ox ?? 0.5, p.oy ?? 1);
                sp.x = p.x ?? 0;
                sp.y = p.y ?? 0;
                sp.angle = p.a ?? 0;
                sp.depth = depth;
                this._deadTint != null && sp.setTint(this._deadTint);
                (n ?? this._rig ?? this._shape).add(sp);
                sps.push(sp);
            }
        }

        let sps = [];
        const n = this._nodes[node];
        const bn = this._nodes[BACK_NODE[type]];
        addSp(part.sprite, PART_DEPTH[type], n);
        addSp(part.ext, PART_DEPTH[GM.PART.EXT], n);
        if(bn) {addSp(part.back, PART_DEPTH[type], bn, fromPivot(atPivot(part, n?.pivot ?? pivotOf()), bn.pivot));}
        else {addSp(part.back, PART_DEPTH[GM.PART.BACK], n);}
        if(part.handB)
        {
            const rn = this._nodes.wristB;
            addSp(part.handB.sprite, PART_DEPTH[type], rn);
            addSp(part.handB.back, PART_DEPTH[GM.PART.BACK], rn);
        }
        return sps;
    }

    _sortParts()
    {
        for(const c of [this._shape, this._rig, ...Object.values(this._nodes)].filter(Boolean))
        {
            c.getAll().sort((a, b) => a.depth - b.depth).forEach(child => {c.bringToTop(child);});
        }
    }

    _addEquip(item)
    {
        if(!item.equip) {return;}
        let sps = this._addPart(equipFor(item.equip, this.meta.sex, item.sex), item.cat, nodeFor(item.cat, item.equip));
        this._sortParts();
        this._equips.push(...sps);
        if(item.cat===GM.CAT.WEAPON) {this._weapon = sps;}
    }

    _removeEquips()
    {
        this._equips.forEach((equip)=>{equip.destroy();})
        this._equips = [];
        this._weapon = null;
    }

    // 手腕節點照 body 支點＋手上那把東西(held＝它的 equip)的位移；節點正在播動畫(不在舊的靜止姿勢)只換 pivot，收回時才過去
    _placeWrists(held)
    {
        const body = DB.rolePart(this.meta, 'body');
        const wrap = (a)=>((a % 360) + 540) % 360 - 180;
        for(const k of WRISTS)
        {
            const n = this._nodes?.[k];
            if(!n) {continue;}
            const [o, p] = [n.pivot, pivotOf(body, k, held)];
            const still = Math.abs(n.x - o.x) < 1e-6 && Math.abs(n.y - o.y) < 1e-6 && Math.abs(wrap(n.angle - o.a)) < 1e-6;
            n.pivot = p;
            if(still) {n.setPosition(p.x, p.y).setAngle(p.a);}
        }
    }

    // 暫時把背包裡的工具拿在手上(蓋過原本的武器，不動裝備欄)，回傳放下用的函式
    _hold(id)
    {
        if(!DB.item(id)?.equip) {return ()=>{};}
        const tok = {};
        this._holdTok = tok;
        this._holdId = id;
        this._updateEquips();
        return ()=>{
            if(this._holdTok!==tok) {return;}
            this._holdTok = this._holdId = null;
            this._updateEquips();
        };
    }

    _remove()
    {
        super._remove();
        // 移除 parts
        this._shape.getAll().forEach((child)=>{child.destroy();});
        this._rig = null;
        this._nodes = {};
    }

   
    _fadout()
    {
        this._alpha = this.alpha??1;
        this._shape.setAlpha(this._alpha);
        this.alpha*=0.9;
    }

    _updateEquips()
    {
        const {bb} = this.ctx;
        if(this._isCorpse) {return;}

        this._removeEquips();
        const dats = (bb.equips ?? []).filter(Boolean).map(eq=>DB.item(eq.id??eq));
        const held = this._holdId ? DB.item(this._holdId) : null;
        const inHand = held ? held.equip : weaponOf(dats, GM.CAT);
        this._hand = handOf(inHand);
        this._placeWrists(inHand);
        dats.forEach((dat)=>{this._addEquip(dat);});
        this._held = null;
        if(held)
        {
            this._weapon?.forEach((sp)=>{sp.setVisible(false);});
            this._held = this._addPart(equipFor(held.equip, this.meta.sex, held.sex), held.cat, this._hand);
            this._equips.push(...this._held);
            this._sortParts();
        }
        const hide = hiddenParts(dats, GM.CAT, DB.rolePart(this.meta, 'hat'));
        for(const [k, sps] of Object.entries(this._parts)) {sps.forEach((sp)=>{sp.setVisible(!hide.has(k));});}
        this._measure();
    }

    _isFaceRight() {return (this._shape.scaleX < 0) !== this._faceR;}

    // 往背對攻擊者的方向倒(+1:頭朝右)；沒有攻擊者時往面向的反方向倒
    _fallDir(attacker)
    {
        const x = this.pos.x;
        if(attacker && attacker.pos.x !== x) {return attacker.pos.x < x ? 1 : -1;}
        return this._isFaceRight() ? -1 : 1;
    }

    _tintDead(t)
    {
        const g = Math.round(255 - t*(255-0x88));
        this._deadTint = (g<<16)|(g<<8)|g;
        this.sprites.forEach(sp=>sp.setTint?.(this._deadTint));
    }

    // shape 的原點是支點(身體中心)，以它為支點轉，再移到 grid 中心，屍體就會置中躺在自己那格
    _fall(attacker, instant)
    {
        const shape = this._shape;
        const angle = (this.meta.fall ?? 90) * this._fallDir(attacker);
        const y = this._grid ? this._grid.y : this.pivot.y;
        if(instant)
        {
            shape.setAngle(angle).setY(y);
            this._tintDead(1);
            return Promise.resolve();
        }
        return new Promise((resolve)=>{
            this.scene.tweens.chain({
                targets: shape,
                tweens: [
                    {angle, y, duration:100, ease:'quad.in', onUpdate:(tw)=>this._tintDead(tw.progress)},
                    {y:y-3, duration:60, ease:'quad.out', yoyo:true},
                ],
                onComplete: ()=>resolve(),
            });
        });
    }

    async _die(attacker, instant)
    {
        const {root} = this.ctx;
        if(!instant) {await root.wait?.();}
        root.setDepth(root.y - GM.TILE_H/2);
        if(this.meta.corpse)
        {
            this._remove();
            this._isCorpse = true;
            this._shape.setPosition(0, 0).setAngle(0);     // 屍體圖相對錨點
            this._addPart(this.meta.corpse);
        }
        else
        {
            super._remove();
            await this._fall(attacker, instant);
        }
    }

    _ondead(attacker, instant=false)
    {
        this._alive = {weight:this.weight, isBlock:this.isBlock};   // _die() 的 View._remove() 會把 weight/isBlock 歸零，復活時要還原
        this._setZone(false, this.tag);
        this._dying = this._die(attacker, instant);
    }

    // 只支援沒有 corpse 的角色(_die 走 _fall 那條)；互動區不動，由呼叫端在倒地時自己 setZone(true)
    async _revive()
    {
        await this._dying;
        this._dying = null;
        this._deadTint = null;
        this.sprites.forEach(sp=>sp.clearTint?.());
        this._shape.setAngle(0).setPosition(this.pivot.x, this.pivot.y);
        ({weight:this.weight, isBlock:this.isBlock} = this._alive);
        this._addWeight();
        this._updateDepth();
    }

    //--------------------------------------------------
    // public
    //--------------------------------------------------
    bind(root, config)
    {
        super.bind(root, config);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.face = this._faceTo.bind(this);
        root.faceDir = ()=>this._shape ? (this._isFaceRight() ? 1 : -1) : 0;
        root.fadout = this._fadout.bind(this);
        root.waitDying = ()=>this._dying ?? Promise.resolve();
        root.hold = this._hold.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
        root.on(GM.EVT.ONREVIVE, this._revive.bind(this));
        root.on(GM.EVT.UPDATEEQUIP, this._updateEquips.bind(this))
    }
    
}






