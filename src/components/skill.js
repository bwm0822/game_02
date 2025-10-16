import DB from '../db.js';
import {GM} from '../setting.js';
import Utility from '../utility.js';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : skill
// 功能 :
//  角色的技能
//--------------------------------------------------

export class Skill
{
    constructor()
    {
        this._skills = {}; // 技能
        this._range = 0;    // 技能範圍
    }

    get tag() {return 'skill';}   // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get ctx() {return this._root.ctx;}
    get x() {return this._root.x;}
    get y() {return this._root.y;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _learn(id)
    {
        this._skills[id] = {remain:0};
        this._skill = null;
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

    _select(id)
    {
        if(!this._skills[id]) {return false;}
        const skill = DB.skill(id);
        this._showRange(true, skill.range, false);
        const {bb}=this.ctx;
        bb.skillSel = id;
        this._skill = skill;
        this._range  = skill.range;
    }

    _unselect()
    {
        const {bb}=this.ctx;
        this._showRange(false);
        bb.skillSel = undefined;
        this._range  = 0;
    }

    _isInRange(pos)
    {
        let n = this._range;
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

    async _useSkill(ent)
    {
        const {emit,aEmit} = this.ctx;
        if(ent && this._isInRange(ent.pos))
        {
            this._unselect();
            await aEmit('attack', ent, this._skill);
            return true;
        } 

        return false;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;

        // 在上層綁定操作介面，提供給其他元件使用
        root.prop('skills', this, '_skills');
        root.learnSkill = this._learn.bind(this);
        root.selectSkill = this._select.bind(this);
        root.unselectSkill = this._unselect.bind(this);
        
        // 註冊 event
        root.on('useSkill', this._useSkill.bind(this));
    }

    //------------------------------------------------------
    // 提供 載入、儲存的功能，上層會呼叫
    //------------------------------------------------------
    load(data) { if(data.skills) {Object.assign(this._skills, data.skills);}}
    save() {return {skills:this._skills};}
}