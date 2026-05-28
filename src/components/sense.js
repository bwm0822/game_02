import Com from './com.js'
import { GM } from '../core/setting.js'
import Utility from '../core/utility.js'
import {T,dlog,DEBUG} from '../core/debug.js'

const dist2 = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
}

const withinTiles = (a, b, tiles=5) => {
  const dx = Math.abs((a.x - b.x) / GM.TILE_W);
  const dy = Math.abs((a.y - b.y) / GM.TILE_H);
  return dx <= tiles && dy <= tiles;
}

const checkBB = (source, target, range) => {
    const sb = source.senseBB(range);
    const tb = target.gridBB;
    return Math.abs(sb.x - tb.x) < sb.hw + tb.hw &&
            Math.abs(sb.y - tb.y) < sb.hh + tb.hh;
}

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
    get root() {return this._root;}
    
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _senseBB(range)
    {
        const {root}=this.ctx;
        const bb = root.gridBB;
        const hw = bb.hw + range * GM.TILE_W;
        const hh = bb.hh + range * GM.TILE_H;
        return {x:bb.x, y:bb.y, hw, hh}
    }

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

        if (!checkBB(root, player, maxTiles)) 
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

        this._senseRange = maxTiles;

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
        const {root} = this.ctx;
        const range = root.total.range;
        return checkBB(root,target,range);
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
        root.senseBB = this._senseBB.bind(this);
        // 3.註冊(event)給其他元件或外部呼叫
    }



}