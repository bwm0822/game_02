import Com from './com.js'
import { GM } from '../core/setting.js'
import Utility from '../core/utility.js'
import {T,dlog} from '../core/debug.js'

const dist2 = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
};
const withinTiles = (a, b, tiles=5) => {
  const dx = Math.abs((a.x - b.x) / GM.TILE_W);
  const dy = Math.abs((a.y - b.y) / GM.TILE_H);
  return dx <= tiles && dy <= tiles;
};
const rnd = (min, max) => Math.random() * (max - min) + min;
const choose = arr => arr[Math.floor(Math.random() * arr.length)];

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : sense
// 功能 : 
//  偵測敵人
//--------------------------------------------------
export class COM_Sense extends Com
{
    get tag() {return 'sense';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}
    
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    // ---- 感知 ----
    _sensePlayer({maxTiles=8, needSight=true}={}) 
    {
        const {bb,root,fav} = this.ctx;
        const player = GM.player;
        let _isSensePalyer=true;    // 是否感知到 player

        // if (!player || !player.isAlive) {return null;}
        if(bb.sta===GM.ST.SLEEP)
        {
            bb.sensePlayer = null;
            return null;
        }

        if (!withinTiles(this.pos, player.pos, maxTiles)) 
        {
            _isSensePalyer=false;
        }

        if (needSight && !this._canSee(player)) 
        {
            _isSensePalyer=false;
        }

        if(bb.sensePlayer && !_isSensePalyer)
        {
            bb.sensePlayer = null;
            if(fav()<=GM.FAV.HATE) {root.pop?.('❓');}
        }
        else if(!bb.sensePlayer && _isSensePalyer)
        {
            bb.sensePlayer = player;
            if(fav()<=GM.FAV.HATE)
            {
                const s=needSight ? '👁️‍🗨️' : '‼️';
                root.pop?.(s)
            }
        }

        dlog(T.AI,bb.id)("_isSensePalyer=",_isSensePalyer)

        return _isSensePalyer ? player : null;
    }

    _canSee(target)
    {
        const hits = Utility.raycast(this.pos.x, this.pos.y, target.x, target.y, [this.scene.staGroup]);
        return hits.length === 0;
    }

    _inAttackRange(target)
    {
        // let maxTiles=1;
        const {root}=this.ctx;
        const total = root.total;
        return withinTiles(this.pos, target.pos, total.range);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root) 
    {
        super.bind(root);

        // 0. bb
        this.ctx.bb.sensePlayer = null;

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.sensePlayer = this._sensePlayer.bind(this);
        root.canSee = this._canSee.bind(this);
        root.inAttackRange = this._inAttackRange.bind(this);
        // 3.註冊(event)給其他元件或外部呼叫
    }

    




}