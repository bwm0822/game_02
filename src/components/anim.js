//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : anim
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view 元件
//--------------------------------------------------

export class Anim
{
    get tag() {return 'anim';}  // 回傳元件的標籤
    get scene() {return this._root.scene;}
    get ctx() {return this._root.ctx;}


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _idle(on)
    {
        const {emit} = this.ctx;
        const view = emit('view')
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
        const {emit} = this.ctx;
        const view = emit('view')
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
        this._root = root;
        // 在上層綁定操作介面，提供給其他元件使用
        // 註冊 event
        root.on('idle', this._idle.bind(this));
        root.on('walk', this._walk.bind(this));
    }
}