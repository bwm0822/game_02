import DB from '../db.js';
import {GM} from '../setting.js';
import Utility from '../utility.js';
import {computeHealing} from '../core/combat.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : ability
// 功能 :
//  角色的技能
//--------------------------------------------------

export class Ability
{
    constructor()
    {
        this._abilities = {}; // 可用的技能
        this._ability = null; // 當前選擇的技能
        this._idSel = null;
    }

    get tag() {return 'ability';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get ctx() {return this._root.ctx;}
    get x() {return this._root.x;}
    get y() {return this._root.y;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    // 學習新技能
    _learn(id)
    {
        const {emit}= this.ctx;
        this._abilities[id] = {remain:0};
        // this._ability = null;
        emit('dirty');  // 更新屬性
    }

    _showRange(on, range, checkBlock)
    {
        this._graphics?.clear();
        if(!on) {return;}
        if(!this._graphics) {this._graphics = this.scene.add.graphics();}

        let n = range;
        let rows = 2*n+1;
        let cols = 2*n+1;
        let a = Array.from({ length: rows }, () => Array(cols));
        let [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let px = this.x + (x-n)*w;
                let py = this.y + (y-n)*h;
                let wei = this.scene.map.getWeight({x:px,y:py});
                let hits = checkBlock ? Utility.raycast(this.x,this.y,px,py,[this.scene.staGroup]) : [];
                let block = wei<=0 || hits.length>0;
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

        for(let y=0; y<=2*n; y++)
        {
            for(let x=0; x<=2*n; x++)
            {
                let rect = a[y][x];
                if(!rect.block)
                {
                    Utility.drawBlock(this._graphics, rect);
                }
            }
        }

        this.a=a;
    }

    // 選擇技能
    _select(id)
    {
        if(!this._abilities[id]) {return false;}
        const ability = DB.ability(id);
        this._showRange(true, ability.range, false);

        this._ability = ability;
        this._idSel = id;

        const {sta}=this.ctx;
        sta(GM.ST_ABILITY);
    }

    // 取消選擇技能
    _unselect()
    {
        this._showRange(false);
        this._clrAbility();
    }

    _clrAbility()
    {
        this._ability = null;
        this._idSel = null;

        const {sta}=this.ctx;
        sta(GM.ST_IDLE);
    }

    _isInRange(pos)
    {
        let n = this._ability.range;
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let rect = this.a[y][x];
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

    async _useAbility(target, id)
    {
        const {bb,emit,aEmit} = this.ctx;
        if(id) {this._ability = DB.ability(id);}
        
        if(this._ability.type===GM.ACTIVE) 
        {
            this._abilities[id]={skip:true, remain:this._ability.cd};
            const amount = computeHealing(target, this._ability);
            emit('heal', amount);
            this._clrAbility();
            return true;
        }
        else if(target && this._isInRange(target.pos))
        {
            this._abilities[this._idSel]={skip:true, remain:this._ability.cd};
            this._showRange(false);
            await aEmit('attack', target, this._ability);
            this._clrAbility();
            return true;
        } 

        return false;
    }

    // 更新技能冷卻時間
    _update(dt)
    {
        Object.values(this._abilities).forEach(s=>{
            if(s.skip) {s.skip=false; dt--;}
            if(dt>0 && s.remain>0) 
            {
                s.remain -= dt;
                if(s.remain<0) {s.remain=0;}
            }
        });
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        
        // 在上層綁定操作介面，提供給其他元件使用
        root.prop('abilities', this, '_abilities');
        root.learnAbility = this._learn.bind(this);
        root.selectAbility = this._select.bind(this);
        root.unselectAbility = this._unselect.bind(this);
        root.isInRange = this._isInRange.bind(this);
        
        // 註冊 event
        root.on('useAbility', this._useAbility.bind(this));
        root.on('update', this._update.bind(this));

        // 共享資料 (有共享的資料，load()時，要用 Object.assign)
        root.bb.abilities = this._abilities;
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) { if(data?.abilities) {Object.assign(this._abilities,data.abilities);} }
    save() {return {abilities:this._abilities};}
}