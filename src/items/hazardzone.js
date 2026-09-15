import {GameObject} from '../core/gameobject.js'
import {Pic} from '../ui/uicomponents.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 地面危險區域(如火焰地帶)
// 功能 :
//  持續存在幾回合，範圍內的角色每回合都會被套用技能的 effects(如持續灼燒)
//  不擋路、不掛物理碰撞體，純粹是 TimeSystem 驅動的邏輯物件+視覺
//--------------------------------------------------

export default class HazardZone extends GameObject
{
    // 沒有 View 元件，但 GameScene._checkOcclusion() 會對 scene.gos 裡的每個物件呼叫 setOcclude()，需自行滿足這個介面
    get occludeType() {return GM.OCCLUDE.NONE;}
    setOcclude() {}

    init_runtime(ability)
    {
        if(!super.init_prefab()) {return;}

        this.bb.weight = 0;   // 不擋路，角色要能站進來才會生效

        this._ability = ability;
        this._radius = ability.zoneRadius ?? 0;
        this._remaining = ability.zoneDur ?? 1;

        const n = this._radius;
        const [w,h] = [GM.TILE_W, GM.TILE_H];
        for(let x=-n; x<=n; x++)
        {
            for(let y=-n; y<=n; y++)
            {
                if(Math.max(Math.abs(x),Math.abs(y)) > n) {continue;}
                this.add(new Pic(this.scene, w, h, {icon:ability.zoneImg, x:x*w, y:y*h}));
            }
        }

        this.regTS();

        return this;
    }

    _updateTime()
    {
        super._updateTime();

        const n = this._radius;
        this.scene.roles.forEach(role=>{
            if(!role.isAlive) {return;}
            const dx = Math.abs(role.x-this.x)/GM.TILE_W;
            const dy = Math.abs(role.y-this.y)/GM.TILE_H;
            if(Math.max(dx,dy) > n) {return;}
            role.addEffs?.(this._ability.effects, 'target', 'hit');
        });

        this._remaining -= 1;
        if(this._remaining<=0) {this._remove();}
    }

    _remove()
    {
        this.unregTS();   // 沒有這行，TimeSystem 會在銷毀後繼續呼叫 _updateTime()，此時 this.scene 已是 null
        super._remove();
    }
}
