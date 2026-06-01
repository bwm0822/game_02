import Com from './com.js'
import {GM} from '../core/setting.js'

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : lamp
// 功能 : 管理靜態光源（燈、燭台等地圖物件）的開關
// bb 參數:
//   lamp_on  : string  開燈時的 texture "key:frame"（可選）
//   lamp_off : string  關燈時的 texture "key:frame"（可選）
//   color    : number  光源顏色，預設 0xffaa00
//   radius   : number  光源半徑，預設 200
//   lit      : bool    初始狀態是否點亮，預設 false
//--------------------------------------------------
export class COM_Lamp extends Com
{
    get tag() {return 'lamp';}
    get scene() {return this._root.scene;}

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _turnOn()
    {
        if (this._lit) {return;}
        this._lit = true;
        const {root, bb} = this.ctx;

        const color = bb.color ?? 0xffaa00;
        const radius = bb.radius ?? 200;
        const pos = root.pos;
        this._light = this.scene.lights.addLight(pos.x, pos.y, radius, color, this._calcIntensity());

        root.on(GM.EVT.UPDATETIME, this._onUpdateTime);

        if (bb.lamp_on) {root.setTexture?.(bb.lamp_on);}
    }

    _turnOff()
    {
        if (!this._lit) {return;}
        this._lit = false;
        const {root, bb} = this.ctx;

        if (this._light)
        {
            this.scene.lights.removeLight(this._light);
            this._light = null;
            root.off(GM.EVT.UPDATETIME, this._onUpdateTime);
        }

        if (bb.lamp_off) {root.setTexture?.(bb.lamp_off);}
    }

    _calcIntensity()
    {
        const amb = this.scene.lights.ambientColor;
        return Math.max(0, GM.LIGHT - amb.r);
    }

    _syncIntensity()
    {
        if (!this._light) {return;}
        this._light.intensity = this._calcIntensity();
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);
        const {bb} = this.ctx;

        // 0.初始化
        this._lit = false;
        this._light = null;
        this._onUpdateTime = this._syncIntensity.bind(this);
        if (bb.lit) {this._turnOn();}

        // 1.提供 [外部操作的指令]
        root._setAct(GM.TURN_ON,  () => this._lit ? GM.HIDE : GM.EN);
        root._setAct(GM.TURN_OFF, () => this._lit ? GM.EN  : GM.HIDE);

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.TURN_ON,  this._turnOn.bind(this));
        root.on(GM.TURN_OFF, this._turnOff.bind(this));


    }

    unbind()
    {
        if (this._light)
        {
            this.scene.lights.removeLight(this._light);
            this._light = null;
            this._root.off(GM.EVT.UPDATETIME, this._onUpdateTime);
        }
    }
}
