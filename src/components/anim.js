//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : anim
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view 元件
//--------------------------------------------------

export class Anim
{
    constructor(root)   
    {
        this._root = root;
        this._bind(root);
    }

    get tag() {return 'anim';}  // 回傳元件的標籤

    get scene() {return this._root.scene;}
    get view() {return this._root.coms.view}

    _bind(root)
    {
        // 在上層綁定操作介面，提供給其他元件使用
    }

    //--------------------------------------------------
    // 提供上層使用
    //--------------------------------------------------
    _idle(on)
    {
        if(!this.view){return;}   // 判斷 this.view ，以避免在地圖上出錯
        if(on)   
        {
            if(!this._twIdle)
            {
                this._twIdle = this.scene.tweens.add({
                        targets: this.view,
                        y: {from:-this.view.anchorY, to:-this.view.anchorY-1.5},
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
        this.scene.tweens.add({
            targets: this.view,
            y: {from:-this.view.anchorY, to:-this.view.anchorY-10},
            ease:'quint.in',
            duration: duration,
            yoyo: true,  
        });
    }
}