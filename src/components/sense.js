import { GM } from '../setting.js';
import * as Role from '../role.js';
import Utility from '../utility.js';


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
export class Sense
{
    constructor(root)   
    {
        this._root = root;
        this._bind(root);
    }

    get tag() {return 'sense';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get pos() {return this._root.pos;}

    _bind(root) {}


    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    // ---- 感知 ----
    sensePlayer(maxTiles=8, needSight=true) 
    {
        // const player = this.role.scene?.roles?.find(r => r.isPlayer);
        const player = Role.getPlayer();
        if (!player || !player.isAlive) {return null;}
        if (!withinTiles(this.pos, player.pos, maxTiles)) {return null;}
        if (needSight) 
        {
            const hits = Utility.raycast(this.pos.x, this.pos.y, player.x, player.y, [this.scene.staGroup]);
            if (hits.length > 0) {return null;}
        }
        return player;
    }

    canSee(target)
    {
        const hits = Utility.raycast(this.pos.x, this.pos.y, target.x, target.y, [this.scene.staGroup]);
        return hits.length === 0;
    }

    inAttackRange(target)
    {
        let maxTiles=1;
        return withinTiles(this.pos, target.pos, maxTiles);
    }




}