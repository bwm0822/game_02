import {GameObject} from '../core/gameobject.js'
import {ZoneView} from '../components/view.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 地面危險區域(如火焰地帶)
// 功能 :
//  持續存在幾回合，範圍內的角色每回合都會被套用技能的 effects(如持續灼燒)
//  視覺/物理/地圖權重都交給 ZoneView(components/view.js) 處理，
//  本身只負責 TimeSystem 驅動的回合邏輯(掃描範圍、套效果、倒數銷毀)
//--------------------------------------------------

export default class HazardZone extends GameObject
{
    // ZoneView 有提供 setOcclude/getShapeRect(綁在 root 上)，但 occludeType 要 GameObject 自己定義(參考 Pickup 的做法)
    get occludeType() {return GM.OCCLUDE.NONE;}

    init_runtime(ability, caster)
    {
        if(!super.init_prefab()) {return;}

        this._ability = ability;
        this._caster = caster;
        this._radius = ability.zoneRadius ?? 0;
        this._remaining = ability.zoneDur ?? 1;

        const n = this._radius;
        this.bb.hasPhy = false;             // 不掛物理碰撞體，角色要能走進來才會生效
        this.bb.weight = 100;               // 路徑權重，讓 AI 盡量繞開但不是完全擋死
        this.bb.wid = (2*n+1)*GM.TILE_W;    // 範圍的整體寬高，_addGrid()/_addWeight() 靠這個算出要登記的地圖範圍
        this.bb.hei = (2*n+1)*GM.TILE_H;
        this.bb.radiusN = n;                // 給 ZoneView._addShape() 畫每一格用
        this.bb.zoneImg = ability.zoneImg;

        this.addCom(new ZoneView(this.scene), {modify:false});

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
            role.emit(GM.EVT.UNDERATK, this._caster?.id);   // 觸發好感度下降/AI 仇恨判定，跟一般攻擊命中一致
            role.addEffs?.(this._ability.effects, 'target', 'hit');
        });

        this._remaining -= 1;
        if(this._remaining<=0) {this._remove();}
    }

    _remove()
    {
        this.unregTS();   // 沒有這行，TimeSystem 會在銷毀後繼續呼叫 _updateTime()，此時 this.scene 已是 null
        super._remove();  // 會連帶 unbind ZoneView，自動還原地圖權重(View._remove() 已處理)
    }
}
