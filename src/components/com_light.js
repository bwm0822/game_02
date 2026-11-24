import Com from './com.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
const _tag = 'light';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : light
// 功能 : 管理角色的光源（火把等裝備）
// 注意 : 需在 COM_Inventory 之後 addCom，才能正確 wrap root.equip
//--------------------------------------------------
export class COM_Light extends Com
{
    get tag() {return _tag;}
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
        }

        // 有 equip.prefab 的（如火把）光由 prefab 的光源零件畫在道具上（view.js 的 _addEquipPrefab），這裡不另外開
        const equipped = root.findEquip?.(eq => DB.item(eq.id)?.light && !DB.item(eq.id).equip?.prefab);
        if (!equipped) {return;}

        const {color = 0xffaa00, radius = 300} = DB.item(equipped.id).light;
        this._light = this.scene.lights.addLight(root.x, root.y, radius, color, GM.LIGHT);
        this.scene.events.on('update', this._onUpdate);
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

        // 0.初始化
        this._onUpdateEquip = this._updateLight.bind(this);
        // 同步位置（裝備時才 on，卸下時 off）
        this._onUpdate = this._updatePos.bind(this);

        // 1.提供 [外部操作的指令]
        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.UPDATEEQUIP, this._onUpdateEquip);

        
    }

    unbind()
    {
        this._root.off(GM.EVT.UPDATEEQUIP, this._onUpdateEquip);
        if (this._light)
        {
            this.scene.lights.removeLight(this._light);
            this._light = null;
            this.scene.events.off('update', this._onUpdate);
        }
    }
}
