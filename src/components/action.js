import {Projectile} from '../entity.js'
import {computeDamage} from '../core/combat.js'
import {GM} from '../setting.js'


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : action
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view、anim 元件
//--------------------------------------------------

export class Action
{

    get tag() {return 'action';}  // 回傳元件的標籤

    get ent() {return this._root.ent;}
    get scene() {return this._root.scene;}
    get ctx() {return this._root.ctx;} // ctx 這個縮寫在程式裡很常見，它通常是 context 的縮寫，意思就是「上下文」或「語境」。


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
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
        if(!pt) {return;}
        const {emit}=this.ctx
        emit('face',pt);
        emit('removeWeight');
        emit('addWeight',pt);
        emit('idle',false);
        emit('walk',duration/2);
        // await this._step(pt,duration,ease,{onUpdate:this._setLightPos.bind(this)});
        await this._step(pt, duration, ease);
        emit('updateDepth');
    }

    _attack_Melee(target, onHit)
    {
        const {emit}=this.ctx
        emit('face', target.pos);
        let [pos,duration,ease] = [target.pos, 200, 'expo.in'];
        return this._step( pos, duration, ease, {yoyo: true, onYoyo: onHit} );  
    }

    _attack_Ranged(target, onHit)
    {
        const {emit}=this.ctx
        emit('face', target.pos);
        const sprite = {img:'arrow', scl:0.25};
        return new Promise((resolve)=>{
                new Projectile(this.scene, this.ent.x, this.ent.y, sprite)
                    .shoot( target.pos.x, target.pos.y,
                            {onComplete:()=>{onHit?.();resolve();}}
                        );
            })
    }

    _attack_Spell(target, onHit, ability)
    {
        const {emit}=this.ctx
        emit('face', target.pos);
        return new Promise((resolve)=>{
                new Projectile(this.scene, this.ent.x, this.ent.y, ability.sprite)
                    .shoot( target.pos.x, target.pos.y,
                            {onComplete:()=>{onHit?.();resolve();}, bias:0}
                        );
            })  
    }

    _onDamage(target, ability)
    {
        const dmg = computeDamage(this._root, target, ability);
        target.takeDamage(dmg, this._root);
    }

    async _moveToward(target, {maxSteps=1}={})
    {
        const {bb,emit} = this.ctx;

        emit('findPath', target.pos); // 搜尋路徑，結果會存於 bb.path

        if(bb.path?.state>GM.PATH_NONE)
        {
            for(let i=0;i<maxSteps;i++)
            {
                if(bb.path.pts.length>1)
                {
                    await this._moveTo(bb.path.pts[0])
                    bb.path.pts.splice(0,1);  
                }
                else {break;}
            }

            if(bb.path.pts.length===0) {delete bb.path;}
        }
        return false;
    }

    async _move()
    {
        const {bb,emit} = this.ctx;

        await this._moveTo(bb.path?.pts[0]);

        // bb.path 有可能在被 delete，如 : 在移動中，點擊畫面，會呼叫 player.stop()
        if(bb.path)
        {
            bb.path.pts.splice(0,1);
            if(bb.path.pts.length===0) {delete bb.path;}
        }
        emit('updatePath');
    }

    async _attack(target, ability)
    {
        const onDamage = this._onDamage.bind(this, target, ability);

        if(ability?.type==='spell')
        {
            await this._attack_Spell(target, onDamage, ability);
        }
        else
        {
            const {emit} = this.ctx;
            const total = emit('total');
            if(total.type==='ranged') {await this._attack_Ranged(target, onDamage);}
            else {await this._attack_Melee(target, onDamage);}
        }
        return true;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        this._root = root;
        // 在上層綁定操作介面，提供給其他元件使用
        
        // 註冊 event
        root.on('move', this._move.bind(this));
        root.on('moveToward', this._moveToward.bind(this));
        root.on('attack', this._attack.bind(this));
    }

    
}