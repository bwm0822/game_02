import Com from './com.js'

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : anim
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view 元件
//--------------------------------------------------

export class COM_Anim extends Com
{
    get tag() {return 'anim';}  // 回傳元件的標籤
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
                        targets: view,
                        y: {from:-view.anchorY, to:-view.anchorY-1.5},
                        // ease:'sin.out',
                        duration: 500,
                        yoyo: true,
                        loop:-1,     
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
            targets: view,
            y: {from:-view.anchorY, to:-view.anchorY-10},
            ease:'quint.in',
            duration: duration,
            yoyo: true,  
        });
    }

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
    }
}