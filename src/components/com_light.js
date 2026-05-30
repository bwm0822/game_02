import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : light
// 功能 : 管理角色的光源（火把等裝備）
// 注意 : 需在 COM_Inventory 之後 addCom，才能正確 wrap root.equip
//--------------------------------------------------
export class COM_Light extends Com
{
    get tag() {return 'light';}
    get scene() {return this._root.scene;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _updateLight()
    {
        const {root} = this.ctx;

        if (this._light)
        {
            this.scene.lights.removeLight(this._light);
            this._light = null;
            this.scene.events.off('update', this._onUpdate);
            root.off(GM.EVT.UPDATETIME, this._onUpdateTime);
        }

        const equipped = root.findEquip?.(eq => DB.item(eq.id)?.light);
        if (!equipped) {return;}

        const {color = 0xffaa00, radius = 300} = DB.item(equipped.id).light;
        const amb = this.scene.lights.ambientColor;
        this._light = this.scene.lights.addLight(root.x, root.y, radius, color, GM.LIGHT - amb.r);
        this.scene.events.on('update', this._onUpdate);
        root.on(GM.EVT.UPDATETIME, this._onUpdateTime);
    }

    _updateIntensity()
    {
        if (!this._light) {return;}
        const amb = this.scene.lights.ambientColor;
        this._light.intensity = GM.LIGHT - amb.r;
    }

    _updatePos()
    {
        if (!this._light) {return;}
        this._light.x = this._root.x;
        this._light.y = this._root.y;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;

        // wrap root.equip（COM_Inventory 的 _equip 已在此之前設定）
        // const prev = root.equip;
        // root.equip = () => {prev?.(); this._updateLight();}

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
        this._onUpdateEquip = this._updateLight.bind(this);
        root.on(GM.EVT.UPDATEEQUIP, this._onUpdateEquip);
        // 同步位置（裝備時才 on，卸下時 off）
        this._onUpdate = this._updatePos.bind(this);
        this._onUpdateTime = this._updateIntensity.bind(this);
        
    }

    unbind()
    {
        this._root.off(GM.EVT.UPDATEEQUIP, this._onUpdateEquip);
        if (this._light)
        {
            this.scene.lights.removeLight(this._light);
            this._light = null;
            this.scene.events.off('update', this._onUpdate);
            this._root.off(GM.EVT.UPDATETIME, this._onUpdateTime);
        }
    }
}
