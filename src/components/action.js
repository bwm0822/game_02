import Com from './com.js'
import {Projectile} from '../misc/effs.js'
import {computeDamage} from '../core/combat.js'
import {GM} from '../core/setting.js'


//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : action
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view、anim 元件
//--------------------------------------------------

export class COM_Action extends Com
{

    get tag() {return 'action';}  // 回傳元件的標籤

    get ent() {return this._root.ent;}
    get scene() {return this._root.scene;}


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
        const {root}=this.ctx
        root.face?.(pt);
        root.removeWeight?.();
        root.addWeight?.(pt);
        root.anim_idle?.(false);
        root.anim_walk?.(duration/2);
        // await this._step(pt,duration,ease,{onUpdate:this._setLightPos.bind(this)});
        await this._step(pt, duration, ease);
        root.updateDepth();
    }

    _attack_Melee(target, onHit)
    {
        const {root}=this.ctx
        root.face?.(target.pos);
        let [pos,duration,ease] = [target.pos, 200, 'expo.in'];
        return this._step( pos, duration, ease, {yoyo: true, onYoyo: onHit} );  
    }

    _attack_Ranged(target, onHit)
    {
        const {root}=this.ctx
        root.face?.(target.pos);
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
        const {root}=this.ctx
        root.face?.(target.pos);
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
        const {bb,root} = this.ctx;

        root.findPath?.(target.pos); // 搜尋路徑，結果會存於 bb.path

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

    // async _move()
    // {
    //     const {bb,emit} = this.ctx;

    //     const pt = bb.path?.pts[0];
    //     let ret = true;

    //     if(pt)
    //     {
    //         // 判斷前面是否有障礙物
    //         const blocked = this.scene.map.getWeight(pt) > GM.W_BLOCK;
            
    //         if(blocked) // 前面有障礙物
    //         {
    //             // 判斷是否是目的地，如果不是，回傳值設成 false
    //             bb.path.pts.length>1 && (ret=false);
    //             bb.path=null;
    //         }
    //         else
    //         {
    //             await this._moveTo(pt);
    //             if(bb.path.stop) {bb.path=null;}
    //             else
    //             {
    //                 bb.path.pts.splice(0,1);
    //                 bb.path.pts.length===0 && (bb.path=null);
    //             }
    //         }
    //     }

    //     emit('updatePath');

    //     return ret;
    // }

    async _move()
    {
        const {bb,root} = this.ctx;

        // const pt = bb.path?.pts[0];
        let ret = 'moving';

        if(bb.path.pts.length===0)
        {
            ret = 'reach';
            bb.path=null;
        }
        else
        {
            const pt = bb.path.pts[0];

            // 判斷前面是否有障礙物
            const blocked = this.scene.map.getWeight(pt) > GM.W_BLOCK;
            
            if(blocked) // 前面有障礙物
            {
                // 判斷是否是目的地，如果不是，回傳值設成 'blocked'
                ret = bb.path.pts.length>1 ? 'blocked' : 'reach';
                bb.path=null;
            }
            else
            {
                await this._moveTo(pt);
                if(bb.path.stop) {bb.path=null; ret='stopped';}
                else
                {
                    bb.path.pts.splice(0,1);
                    if(bb.path.pts.length===0) {bb.path=null; ret='reach';}
                }
            }
        }

        root.updatePath?.();

        return ret;
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
            const total = this.root.total;
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
        super.bind(root);

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.move = this._move.bind(this);
        root.moveToward = this._moveToward.bind(this);
        root.attack = this._attack.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
        // root.on('move', this._move.bind(this));
        // root.on('moveToward', this._moveToward.bind(this));
        // root.on('attack', this._attack.bind(this));
    }

    
}