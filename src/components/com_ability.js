import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'
import {computeHealing} from '../core/combat.js'
const _tag = 'ability';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : ability
// 功能 :
//  角色的技能
//--------------------------------------------------

export class COM_Ability extends Com
{
    get tag() {return _tag;}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get x() {return this._root.x;}
    get y() {return this._root.y;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _toObj(abilities)
    {
        if(!abilities) {return {};}
        return Object.fromEntries(
            abilities.map(ability => [ability, { skip: false, remain: 0 }])
        );
    }

    // 學習新技能
    _learn(id)
    {
        const {root}= this.ctx;
        this._abilities[id] = {remain:0};
        // this._ability = null;
        root.setDirty?.();  // 更新屬性
    }

    // _showRange(on, range, checkBlock)
    // {
    //     this._graphics?.clear();
    //     if(!on) {return;}
    //     if(!this._graphics) {this._graphics = this.scene.add.graphics();}

    //     let n = range;
    //     let rows = 2*n+1;
    //     let cols = 2*n+1;
    //     let a = Array.from({ length: rows }, () => Array(cols));
    //     let [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];

    //     for(let x=0; x<=2*n; x++)
    //     {
    //         for(let y=0; y<=2*n; y++)
    //         {
    //             let px = this.x + (x-n)*w;
    //             let py = this.y + (y-n)*h;
    //             let wei = this.scene.map.getWeight({x:px,y:py});
    //             let hits = checkBlock ? Utility.raycast(this.x,this.y,px,py,[this.scene.staGroup]) : [];
    //             let block = wei<=0 || hits.length>0;
    //             a[y][x] = {x:px-w_2, y:py-h_2, width:w, height:h, block:block};
    //         }
    //     }

    //     for(let x=0; x<=2*n; x++)
    //     {
    //         for(let y=0; y<=2*n; y++)
    //         {
    //             a[y][x].l = a[y][x-1]?.block===false ? false : true;
    //             a[y][x].r = a[y][x+1]?.block===false ? false : true;
    //             a[y][x].t = a[y-1]?.[x]?.block===false ? false : true;
    //             a[y][x].b = a[y+1]?.[x]?.block===false ? false : true;
    //         }
    //     }

    //     for(let y=0; y<=2*n; y++)
    //     {
    //         for(let x=0; x<=2*n; x++)
    //         {
    //             let rect = a[y][x];
    //             if(!rect.block)
    //             {
    //                 Utility.drawBlock(this._graphics, rect);
    //             }
    //         }
    //     }

    //     this.a=a;
    // }

    _showRange(on, range, checkBlock, scope)
    {
        this._graphics?.clear();
        if(!on) {return;}
        if(!this._graphics) {this._graphics = this.scene.add.graphics();}

        if(!this._rangeGrid) {this._genRangeGrid(range, checkBlock);}

        const n = range;
        const a = this._rangeGrid;
        const draw = scope===GM.AREA ? Utility.drawBlockDashed : Utility.drawBlock;   // AREA 用虛線無填滿，跟裡面的爆炸預覽區分

        for(let y=0; y<=2*n; y++)
        {
            for(let x=0; x<=2*n; x++)
            {
                let rect = a[y][x];
                if(!rect.block)
                {
                    draw(this._graphics, rect);
                }
            }
        }

    }

    // 以自己為中心，產生 (2*range+1)^2 的施法範圍網格(存到 this._rangeGrid)：
    // 每格記錄世界座標、是否可通行/被遮蔽(block)，以及依鄰格開放與否算出的外框線標記(l/r/t/b)，
    // 讓 _showRange()(畫格線)、_isInRange()(判斷點擊/滑鼠位置是否在範圍內)可以共用同一份資料，不必每次重算
    _genRangeGrid(range, checkBlock)
    {
        const n = range;
        const rows = 2*n+1;
        const cols = 2*n+1;
        const a = Array.from({ length: rows }, () => Array(cols));
        const [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                const px = this.x + (x-n)*w;
                const py = this.y + (y-n)*h;
                const wei = this.scene.map.getWeight({x:px,y:py});
                const hits = checkBlock ? Utility.raycast(this.x,this.y,px,py,[this.scene.staGroup]) : [];
                const block = wei<=0 || hits.length>0;
                a[y][x] = {x:px-w_2, y:py-h_2, width:w, height:h, block:block};
            }
        }

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                a[y][x].l = a[y][x-1]?.block===false ? false : true;
                a[y][x].r = a[y][x+1]?.block===false ? false : true;
                a[y][x].t = a[y-1]?.[x]?.block===false ? false : true;
                a[y][x].b = a[y+1]?.[x]?.block===false ? false : true;
            }
        }
        
        this._rangeGrid = a;
    }

    // group 技能爆炸中心固定是自己、範圍=radius，所以顯示/點擊判定都改用 radius，而非施法距離 range
    _castN(ability)
    {
        return ability.scope===GM.GROUP ? ability.radius : ability.range;
    }

    // 選擇技能
    _select(id)
    {
        if(!this._abilities[id]) {return false;}
        const ability = DB.ability(id);

        this._rangeGrid = null;   // 不同技能的 range/radius 可能不同，強制重建網格，避免沿用上一個技能的舊網格尺寸
        this._showRange(true, this._castN(ability), false, ability.scope);

        this._ability = ability;
        this._id = id;

        const {bb}=this.ctx;
        bb.sta=GM.ST.ABILITY;
    }

    // 取消選擇技能
    _unselect()
    {
        this._showRange(false);
        this._clrAbility();
    }

    _clrAbility()
    {
        this._previewGraphics?.clear();
        this._ability = null;
        this._id = null;

        const {bb}=this.ctx;
        bb.sta=GM.ST.IDLE;
    }

    // AREA 技能專用：跟著游標顯示會被炸到的範圍(radius)，不做遮蔽檢查，純視覺預覽
    _previewArea(pt)
    {
        if(!this._previewGraphics) {this._previewGraphics = this.scene.add.graphics();}
        this._previewGraphics.clear();

        if(this._ability?.scope!==GM.AREA) {return;}
        if(!this._isInRange(pt)) {return;}

        const n = this._ability.radius ?? 0;
        const [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];
        const cx = this.x + Math.round((pt.x-this.x)/w)*w;
        const cy = this.y + Math.round((pt.y-this.y)/h)*h;

        const rows = 2*n+1;
        const a = Array.from({ length: rows }, () => Array(rows));
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                const px = cx + (x-n)*w;
                const py = cy + (y-n)*h;
                a[y][x] = {x:px-w_2, y:py-h_2, width:w, height:h, block:false};
            }
        }
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                a[y][x].l = a[y][x-1]?.block===false ? false : true;
                a[y][x].r = a[y][x+1]?.block===false ? false : true;
                a[y][x].t = a[y-1]?.[x]?.block===false ? false : true;
                a[y][x].b = a[y+1]?.[x]?.block===false ? false : true;
                Utility.drawBlock(this._previewGraphics, a[y][x]);
            }
        }
    }

    _isInRange(pos, checkBlock=true)
    {
        const n = this._castN(this._ability);
        !this._rangeGrid && this._genRangeGrid(n, checkBlock);
        const a = this._rangeGrid;
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let rect = a[y][x];
                if( !rect.block && 
                    pos.x>=rect.x && pos.x<rect.x+rect.width &&
                    pos.y>=rect.y && pos.y<rect.y+rect.height)
                {
                    return true
                }
            }
        }
        return false;
    }

    _query(tag)
    {
        return Object.keys(this._abilities).filter(id => 
            DB.ability(id).tag===tag && 
            this._abilities[id].remain===0);
    }

    _find(id) {return this._abilities[id];}

    async _use(target, id, pt)
    {
        const {root} = this.ctx;

        if(id) {this._ability = DB.ability(id);}
        else {id = this._id;}

        if(this._ability.tag===GM.HEAL)
        {
            this._abilities[id]={skip:true, remain:this._ability.cd};
            const amount = computeHealing(target, this._ability);
            await   root.fx?.(this._ability);    // 播放技能動畫, com_disp.js
            root.heal?.(amount);                    // 治療量, com_stats.js
            this._clrAbility();
            return true;
        }
        else if(this._ability.tag===GM.ATK)
        {
            const ability = this._ability;
            const targets = this._resolveTargets(target, pt);
            if(!targets) {return false;}

            this._abilities[id]={skip:true, remain:ability.cd};
            this._showRange(false);
            this._clrAbility();   // 先歸零選取狀態(含 bb.sta)，避免攻擊動畫播放期間滑鼠移動還一直觸發範圍預覽

            await root.attack?.(targets, ability);   // 播放攻擊動畫, com_action.js

            return true;
        }
        return false;
    }

    // 依技能 scope(single/group/area) 解析出這次要打的目標清單；找不到有效目標回傳 null
    _resolveTargets(target, pt)
    {
        const scope = this._ability.scope ?? GM.SINGLE;

        if(scope===GM.SINGLE)
        {
            return (target && this._isInRange(target.pos)) ? [target] : null;
        }
        if(scope===GM.GROUP)   // 點擊只是確認手勢(需落在施法距離內)，爆炸中心永遠是自己，與點擊位置無關
        {
            const clickPos = target ? target.pos : pt;
            if(!clickPos || !this._isInRange(clickPos)) {return null;}
            return this._findTargets({x:this.x, y:this.y}, this._ability.radius, this._ability.checkBlock);
        }
        if(scope===GM.AREA)    // 以點擊位置(或點到的角色座標)為中心，且中心點需在施法距離內
        {
            const center = target ? target.pos : pt;
            if(!center || !this._isInRange(center)) {return null;}
            return this._findTargets(center, this._ability.radius, this._ability.checkBlock);
        }
        return null;
    }

    // 找出以 center 為圓心、radius(格)範圍內的所有目標(排除自己、排除已死亡)
    // 距離判定為方格(Chebyshev)，跟施法範圍格線(_genRangeGrid)的判定方式一致，而非直線距離
    _findTargets(center, radius, checkBlock=true)
    {
        const {root} = this.ctx;
        const n = radius??0;

        return this.scene.roles.filter(role=>{
            if(role===root || !role.isAlive) {return false;}
            const dx = Math.abs(role.x-center.x)/GM.TILE_W;
            const dy = Math.abs(role.y-center.y)/GM.TILE_H;
            if(Math.max(dx,dy) > n) {return false;}
            if(checkBlock!==false)
            {
                const hits = Utility.raycast(center.x, center.y, role.x, role.y, [this.scene.staGroup]);
                if(hits.length>0) {return false;}
            }
            return true;
        });
    }

    // 更新技能冷卻時間
    _turnStart()
    {
        Object.values(this._abilities).forEach(s=>{
            if(s.skip) {s.skip=false;}
            else if(s.remain>0) {s.remain--;}
        });
        this._rangeGrid=null;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        const {bb} = this.ctx;

        // 初始化技能資料
        this._abilities = this._toObj(bb.meta.abilities); // 可用的技能
        this._ability = null; // 當前選擇的技能
        this._id = null;
        
        // 共享資料 (有共享的資料，load()時，要用 Object.assign)
        bb.abilities = this._abilities;

        // 1.提供 [外部操作的指令]
        
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        this.addRt('abilities');    // abilities 屬性
        root.learnAbility = this._learn.bind(this);
        root.selectAbility = this._select.bind(this);
        root.unselectAbility = this._unselect.bind(this);
        root.isInRange = this._isInRange.bind(this);
        root.previewArea = this._previewArea.bind(this);
        // 內部使用
        root.useAb = this._use.bind(this);
        root.queryAb = this._query.bind(this);
        root.findAb = this._find.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.TURNSTART, this._turnStart.bind(this));

    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) { if(data?.[_tag]) {Object.assign(this._abilities, data[_tag]);} }
    save() {return {[_tag]:this._abilities};}
}