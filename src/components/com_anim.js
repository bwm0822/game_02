import Com from './com.js'
import {GM} from '../core/setting.js'
const _tag = 'anim';

//--------------------------------------------------
// 類別 : 元件(component)
// 標籤 : anim
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view 元件
//--------------------------------------------------

export class COM_Anim extends Com
{
    get tag() {return _tag;}  // 回傳元件的標籤
    get scene() {return this._root.scene;}


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _idle(on)
    {
        const {root} = this.ctx;
        const view = root.view;
        if(!view) {return;}   // 判斷 this.view ，以避免在地圖上出錯
        if(on)
        {
            if(!this._twIdle)
            {
                this._twIdle = this.scene.tweens.add({
                        targets: view.shape,
                        scaleY: {from:1, to:1.05},
                        ease: 'sine.inOut',
                        duration: 600,
                        yoyo: true,
                        loop: -1,
                    });
            }
        }
        else
        {
            if(this._twIdle) {this._twIdle.stop(); this._twIdle=null;}
        }
    }

    _walk(duration)
    {
        const {root} = this.ctx;
        const view = root.view;
        this.scene.tweens.add({
            targets: view.shape,
            angle: {from: -10, to: 10},
            ease: 'sine.inOut',
            duration: duration,
            yoyo: true,
            onComplete: () => { view.shape.angle = 0; },
        });
    }

    _ondead() { this._idle(false); }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.anim_idle = this._idle.bind(this);
        root.anim_walk = this._walk.bind(this);

        // 3.註冊(event)給其他元件或外部呼叫
        root.on(GM.EVT.ONDEAD, this._ondead.bind(this));
    }

}