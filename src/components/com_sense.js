import Com from './com.js'
import { GM } from '../core/setting.js'
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

const FOV_COS = Math.cos(120 * Math.PI / 180);
const DBG_ON = 0xff0000, DBG_OFF = 0xdddddd;

const rnd =(min, max) => Math.random() * (max - min) + min;
const choose = arr => arr[Math.floor(Math.random() * arr.length)];
const _tag = 'sense';
//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : sense
// 功能 : 
//  偵測敵人
//--------------------------------------------------
export class COM_Sense extends Com
{
    get tag() {return _tag;}  // 回傳元件的標籤
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
    // 看：maxTiles 內、不在背後死角、有視線；聽：hearTiles 內，不管方向跟牆
    _sensePlayer({maxTiles=8, hearTiles=2}={})
    {
        const {bb,root,fav} = this.ctx;
        const player = GM.player;

        this._senseRange = maxTiles;
        this._hearRange = hearTiles;
        this._dbgKey = null;

        if(bb.sta===GM.ST.SLEEP)
        {
            this._see = this._hear = false;
            bb.sensePlayer = null;
            return null;
        }

        const inSight = checkBB(root, player, maxTiles);
        const hear = checkBB(root, player, hearTiles);
        let see = inSight && this._canSee(player);
        if(hear && !see)
        {
            root.face?.(player.pos);
            see = inSight && this._canSee(player);
        }
        const sensed = see || hear;
        this._see = see;
        this._hear = hear;

        if(bb.sensePlayer && !sensed)
        {
            bb.sensePlayer = null;
            if(fav()<=GM.FAV.HATE) {root.pop?.('❓');}
        }
        else if(!bb.sensePlayer && sensed)
        {
            bb.sensePlayer = player;
            if(fav()<=GM.FAV.HATE) {root.pop?.(see ? '👁️‍🗨️' : '‼️');}
        }

        dlog(T.AI,bb.id)("see=",see,"hear=",hear)

        return sensed ? player : null;
    }

    // 只能左右轉，背後 ±60 度是死角
    _inFov(target)
    {
        const f = this.root.faceDir?.();
        if(!f) {return true;}
        const p = this.pos, t = target.pos ?? target;
        const dx = t.x - p.x, dy = t.y - p.y;
        const d = Math.hypot(dx, dy);
        if(d === 0) {return true;}
        return f*dx/d >= FOV_COS;
    }

    _canSee(target)
    {
        return this._inFov(target) && this.scene.map.los(this.pos, target, {roles:false});
    }

    _inAttackRange(target)
    {
        const {root} = this.ctx;
        const range = root.total.range;
        return checkBB(root,target,range);
    }

    // ---- debug：顯示視覺(看得到的格子)跟聽覺範圍(方框)，感知到紅色、沒有灰色 ----
    _setDbg(on)
    {
        if(on === !!this._dbgGfx) {return;}
        if(on)
        {
            this._dbgGfx = this.scene.add.graphics().setDepth(Infinity);
            this._dbgKey = null;
            this._dbgUpdate = this._drawDbg.bind(this);
            this.scene.events.on('update', this._dbgUpdate);
        }
        else
        {
            this.scene?.events.off('update', this._dbgUpdate);
            this._dbgGfx.destroy();
            this._dbgGfx = null;
        }
    }

    _drawDbg()
    {
        const {root,scene} = this;
        if(!DEBUG.enable) {this._setDbg(false); return;}
        if(!root.isAlive) {this._dbgGfx.clear(); this._dbgKey = null; return;}

        const map = scene.map;
        const c = root.gridBB;
        const [tx,ty] = map.worldToTile(c.x, c.y);
        const key = `${tx},${ty},${root.faceDir?.()},${this._see},${this._hear}`;
        if(key === this._dbgKey) {return;}
        this._dbgKey = key;

        const g = this._dbgGfx.clear();
        const TW = GM.TILE_W, TH = GM.TILE_H;

        const sb = this._senseBB(this._senseRange);
        const [x0,y0] = map.worldToTile(sb.x - sb.hw, sb.y - sb.hh);
        const [x1,y1] = map.worldToTile(sb.x + sb.hw, sb.y + sb.hh);
        g.fillStyle(this._see ? DBG_ON : DBG_OFF, 0.25);
        for(let y=y0; y<=y1; y++)
        {
            for(let x=x0; x<=x1; x++)
            {
                const p = map.tileToWorld(x, y);
                if(Math.abs(p.x - sb.x) >= sb.hw + TW/2 || Math.abs(p.y - sb.y) >= sb.hh + TH/2) {continue;}
                if(!this._canSee(p)) {continue;}
                g.fillRect(p.x - TW/2 + 1, p.y - TH/2 + 1, TW - 2, TH - 2);
            }
        }

        const hb = this._senseBB(this._hearRange);
        g.lineStyle(3, this._hear ? DBG_ON : DBG_OFF, 1);
        g.strokeRect(hb.x - hb.hw, hb.y - hb.hh, hb.hw*2, hb.hh*2);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 0. bb
        this.ctx.bb.sensePlayer = null;
        this.ctx.bb.lastKnownPos = null;
        this._senseRange = 8;
        this._hearRange = 2;

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.sensePlayer = this._sensePlayer.bind(this);
        root.canSee = this._canSee.bind(this);
        root.inAttackRange = this._inAttackRange.bind(this);
        root.senseBB = this._senseBB.bind(this);
        root.dbgSense = (on)=>{ if(on!==undefined) {this._setDbg(on);} return !!this._dbgGfx; };
        // 3.註冊(event)給其他元件或外部呼叫
    }

    unbind()
    {
        if(this._dbgGfx) {this._setDbg(false);}
    }
}