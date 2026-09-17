import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import Utility from '../core/utility.js'
import {computeHealing} from '../core/combat.js'
import HazardZone from '../items/hazardzone.js'
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

    // AREA scope 或 SUMMON tag(如召喚地面區域的技能)，都是「點擊位置決定作用範圍中心」，用虛線可點擊範圍+游標處實心作用範圍預覽
    _isAreaLike(ability)
    {
        return ability.scope===GM.AREA || ability.tag===GM.SUMMON;
    }

    // 依總格數 count 算出以中心為準的偏移範圍(start,end 皆為inclusive)；格數為偶數時，中心點偏向負向那格
    _axisRange(count)
    {
        const start = -Math.floor(count/2);
        return {start, end: start+count-1};
    }

    // 取得作用範圍的橫/縱總格數(w/h，不是半徑)：SUMMON 用 zoneW/zoneH，其餘(GROUP/AREA)用 w/h
    _resolveSize(ability)
    {
        if(ability.tag===GM.SUMMON)
        {
            return {w: ability.zoneW ?? 1, h: ability.zoneH ?? 1};
        }
        return {w: ability.w ?? 1, h: ability.h ?? 1};
    }

    _showRange(on, w, h, checkBlock, ability)
    {
        this._graphics?.clear();
        if(!on) {return;}
        if(!this._graphics) {this._graphics = this.scene.add.graphics();}

        if(!this._rangeGrid) {this._genRangeGrid(w, h, checkBlock);}

        const a = this._rangeGrid;
        const draw = ability && this._isAreaLike(ability) ? Utility.drawBlockDashed : Utility.drawBlock;   // AREA/SUMMON 用虛線無填滿，跟裡面的作用範圍預覽區分

        for(let y=0; y<h; y++)
        {
            for(let x=0; x<w; x++)
            {
                let rect = a[y][x];
                if(!rect.block)
                {
                    draw(this._graphics, rect);
                }
            }
        }

    }

    // 以自己為中心，產生 w x h 的施法範圍網格(存到 this._rangeGrid)：
    // 每格記錄世界座標、是否可通行/被遮蔽(block)，以及依鄰格開放與否算出的外框線標記(l/r/t/b)，
    // 讓 _showRange()(畫格線)、_isInRange()(判斷點擊/滑鼠位置是否在範圍內)可以共用同一份資料，不必每次重算
    _genRangeGrid(w, h, checkBlock)
    {
        const {start:xs} = this._axisRange(w);
        const {start:ys} = this._axisRange(h);
        const a = Array.from({ length: h }, () => Array(w));
        const [th,tw,th_2,tw_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];

        for(let xi=0; xi<w; xi++)
        {
            for(let yi=0; yi<h; yi++)
            {
                const px = this.x + (xs+xi)*tw;
                const py = this.y + (ys+yi)*th;
                const wei = this.scene.map.getWeight({x:px,y:py});
                const hits = checkBlock ? Utility.raycast(this.x,this.y,px,py,[this.scene.staGroup]) : [];
                const block = wei<=0 || hits.length>0;
                a[yi][xi] = {x:px-tw_2, y:py-th_2, width:tw, height:th, block:block};
            }
        }

        for(let xi=0; xi<w; xi++)
        {
            for(let yi=0; yi<h; yi++)
            {
                a[yi][xi].l = a[yi][xi-1]?.block===false ? false : true;
                a[yi][xi].r = a[yi][xi+1]?.block===false ? false : true;
                a[yi][xi].t = a[yi-1]?.[xi]?.block===false ? false : true;
                a[yi][xi].b = a[yi+1]?.[xi]?.block===false ? false : true;
            }
        }

        this._rangeGrid = a;
    }

    // group 技能爆炸中心固定是自己、範圍=w/h，所以顯示/點擊判定都改用 w/h，而非施法距離 range(range 一律對稱，換算成 2*range+1 格)
    _castRange(ability)
    {
        if(ability.scope===GM.GROUP) {return this._resolveSize(ability);}
        const count = 2*ability.range+1;
        return {w:count, h:count};
    }

    // 選擇技能
    _select(id)
    {
        if(!this._abilities[id]) {return false;}
        const ability = DB.ability(id);

        this._rangeGrid = null;   // 不同技能的 range/w/h 可能不同，強制重建網格，避免沿用上一個技能的舊網格尺寸
        const {w,h} = this._castRange(ability);
        this._showRange(true, w, h, false, ability);

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

    // 把世界座標對齊到地圖的絕對格線中心點(不是相對施法者自己，避免施法者本身沒對齊格子時連帶偏移)
    _snapToGrid(pos)
    {
        return this.scene.map.getPt(pos);
    }

    // AREA scope / SUMMON tag 技能專用：跟著游標顯示會被影響的範圍，不做遮蔽檢查，純視覺預覽
    _previewArea(pt)
    {
        if(!this._previewGraphics) {this._previewGraphics = this.scene.add.graphics();}
        this._previewGraphics.clear();

        if(!this._ability || !this._isAreaLike(this._ability)) {return;}
        if(!this._isInRange(pt)) {return;}

        let {w:pw, h:ph} = this._resolveSize(this._ability);
        const [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];
        const {x:cx, y:cy} = this._snapToGrid(pt);

        // 游標在自己左右方向(水平偏移>垂直偏移)時，w/h 對調，讓矩形範圍轉向跟指向方向垂直(跟 _use() 的 SUMMON 分支一致)
        if(Math.abs(cx-this.x) > Math.abs(cy-this.y)) {[pw,ph] = [ph,pw];}

        const {start:xs} = this._axisRange(pw);
        const {start:ys} = this._axisRange(ph);

        const a = Array.from({ length: ph }, () => Array(pw));
        for(let xi=0; xi<pw; xi++)
        {
            for(let yi=0; yi<ph; yi++)
            {
                const px = cx + (xs+xi)*w;
                const py = cy + (ys+yi)*h;
                a[yi][xi] = {x:px-w_2, y:py-h_2, width:w, height:h, block:false};
            }
        }
        for(let xi=0; xi<pw; xi++)
        {
            for(let yi=0; yi<ph; yi++)
            {
                a[yi][xi].l = a[yi][xi-1]?.block===false ? false : true;
                a[yi][xi].r = a[yi][xi+1]?.block===false ? false : true;
                a[yi][xi].t = a[yi-1]?.[xi]?.block===false ? false : true;
                a[yi][xi].b = a[yi+1]?.[xi]?.block===false ? false : true;
                Utility.drawBlock(this._previewGraphics, a[yi][xi]);
            }
        }
    }

    _isInRange(pos, checkBlock=true)
    {
        const {w:nW, h:nH} = this._castRange(this._ability);
        !this._rangeGrid && this._genRangeGrid(nW, nH, checkBlock);
        const a = this._rangeGrid;
        for(let x=0; x<nW; x++)
        {
            for(let y=0; y<nH; y++)
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
            const emptyTiles = this._emptyTiles;

            this._abilities[id]={skip:true, remain:ability.cd};
            this._showRange(false);
            this._clrAbility();   // 先歸零選取狀態(含 bb.sta)，避免攻擊動畫播放期間滑鼠移動還一直觸發範圍預覽

            await Promise.all([
                root.attack?.(targets, ability),               // 播放攻擊動畫, com_action.js
                emptyTiles?.length ? root.attackDecor?.(emptyTiles, ability) : null,   // carpet:true 時，空格也播放動畫(無傷害)
            ]);

            return true;
        }
        else if(this._ability.tag===GM.SUMMON)
        {
            const ability = this._ability;
            const pos = target ? target.pos : pt;
            if(!pos || !this._isInRange(pos)) {return false;}

            this._abilities[id]={skip:true, remain:ability.cd};
            this._showRange(false);
            this._clrAbility();

            if(ability.cast) {await root.fx?.({icon: ability.cast.img ?? ability.icon});}   // stage1: 施法動作
            const snapped = this._snapToGrid(pos);
            // 點擊位置在左右方向(水平偏移>垂直偏移)時，zoneW/zoneH 對調，讓矩形範圍轉向跟點擊方向垂直(不修改原始 ability 資料)
            const dx = Math.abs(snapped.x-this.x), dy = Math.abs(snapped.y-this.y);
            const zoneAbility = dx>dy ? {...ability, zoneW:ability.zoneH, zoneH:ability.zoneW} : ability;
            new HazardZone(this.scene, snapped.x, snapped.y).init_runtime(zoneAbility, root);

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
            const {w,h} = this._resolveSize(this._ability);
            return this._findTargets({x:this.x, y:this.y}, w, h, this._ability.checkBlock);
        }
        if(scope===GM.AREA)    // 以點擊位置(或點到的角色座標)為中心，且中心點需在施法距離內
        {
            const center = target ? target.pos : pt;
            if(!center || !this._isInRange(center)) {return null;}
            const {w,h} = this._resolveSize(this._ability);
            const targets = this._findTargets(center, w, h, this._ability.checkBlock, false);   // AREA 不排除自己，站在範圍內也會受傷
            this._emptyTiles = this._ability.carpet ? this._genEmptyTiles(center, w, h, targets) : null;
            return targets;
        }
        return null;
    }

    // carpet:true 的技能，算出範圍內沒有目標的空格座標，讓 _use() 也對空格播放動畫(地毯式轟炸的視覺效果)
    _genEmptyTiles(center, w, h, targets)
    {
        const {start:xs, end:xe} = this._axisRange(w);
        const {start:ys, end:ye} = this._axisRange(h);
        const [th,tw] = [GM.TILE_H, GM.TILE_W];
        const occupied = new Set(targets.map(t=>{
            const tx = Math.round((t.x-center.x)/tw);
            const ty = Math.round((t.y-center.y)/th);
            return `${tx},${ty}`;
        }));

        const tiles = [];
        for(let x=xs; x<=xe; x++)
        {
            for(let y=ys; y<=ye; y++)
            {
                if(occupied.has(`${x},${y}`)) {continue;}
                tiles.push({pos:{x:center.x+x*tw, y:center.y+y*th}});
            }
        }
        return tiles;
    }

    // 找出以 center 為中心、寬 w/高 h(格)矩形範圍內的所有目標(排除已死亡；excludeSelf 決定要不要排除施法者自己)
    // 距離判定為方格，跟施法範圍格線(_genRangeGrid)的判定方式一致，而非直線距離
    _findTargets(center, w, h, checkBlock=true, excludeSelf=true)
    {
        const {root} = this.ctx;
        const {start:xs, end:xe} = this._axisRange(w);
        const {start:ys, end:ye} = this._axisRange(h);

        return this.scene.roles.filter(role=>{
            if((excludeSelf && role===root) || !role.isAlive) {return false;}
            const ox = Math.round((role.x-center.x)/GM.TILE_W);
            const oy = Math.round((role.y-center.y)/GM.TILE_H);
            if(ox<xs || ox>xe || oy<ys || oy>ye) {return false;}
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
        root.isSelAreaLike = () => this._ability && this._isAreaLike(this._ability);   // 目前選取的技能是不是 AREA/SUMMON 這種靠 previewArea 顯示範圍的技能
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