import {Projectile} from '../entity.js';


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : action
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view、anim 元件
//--------------------------------------------------

export class Action
{
    constructor(root)   
    {
        this._root = root;
        this._bind(root);
    }

    get tag() {return 'action';}  // 回傳元件的標籤

    get ent() {return this._root.ent;}
    get scene() {return this._root.scene;}
    get ctx() {return this._root.ctx;} // ctx 這個縮寫在程式裡很常見，它通常是 context 的縮寫，意思就是「上下文」或「語境」。

    _bind(root)
    {
        // 在上層綁定操作介面，提供給其他元件使用
    }

    _step(pos, duration, ease, {yoyo=false, onYoyo, onUpdate, onComplete}={})
    {
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this.ent,
                x: pos.x,
                y: pos.y,
                duration: duration,
                ease: ease,
                yoyo: yoyo,
                //delaycomplete: 1000,
                onYoyo: ()=>{onYoyo?.();onYoyo=null;},  // 讓 onYoyo 只觸發一次
                onUpdate: ()=>{onUpdate?.();},
                onComplete: (tween, targets, gameObject)=>{onComplete?.();resolve();}         
            });
        });
    }

    async _moveTo(pt,{duration=200,ease='expo.in'}={})
    {
        const {view, anim} = this.ctx;
        view?._faceTo(pt);
        view?._removeWeight();
        view?._addWeight(pt);
        anim?._idle(false);
        anim?._walk(duration/2);
        // await this._step(pt,duration,ease,{onUpdate:this._setLightPos.bind(this)});
        await this._step(pt, duration, ease);
        view?._updateDepth();
    }

    _attack_Melee(target, onHit)
    {
        let [pos,duration,ease] = [target.pos, 200, 'expo.in'];
        return this._step( pos, duration, ease, {yoyo: true, onYoyo: onHit} );  
    }

    _attack_Ranged(target, onHit)
    {
        return new Promise((resolve)=>{
                        new Projectile(this.scene, this.ent.x, this.ent.y, 'arrow', 0.25)
                            .shoot( target.pos.x, target.pos.y, 
                                async ()=>{onHit?.();resolve();});
                    })
    }
    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    async moveToward(target, {maxSteps=1}={})
    {
        const {nav,bb} = this.ctx;
        nav.findPath(target.pos)
        for(let i=0;i<maxSteps;i++)
        {
            if(bb.path.state===1 && bb.path.path.length>1)
            {
                await this._moveTo(bb.path.path[0])
                bb.path.path.splice(0,1);
            }
        }
        return true;
    }

    async attack(target)
    {
        const {view} = this.ctx;
        view?._faceTo(target.pos);
        let ranged=false;
        if(ranged) {await this._attack_Ranged(target);}
        else {await this._attack_Melee(target);}
        return true;
    }

    
}