import Com from './com.js'
import {Projectile} from '../misc/effs.js'
import {computeDamage} from '../core/combat.js'
import {GM, GS} from '../core/setting.js'
import {DEBUG} from '../core/debug.js'
const _tag = 'action';

//--------------------------------------------------
// 類別 : 元件(component) 
// 標籤 : action
// 功能 :
//  1. 負責角色的動畫，如 : idle、walk...
//  2. 會用到 view、anim 元件
//  3. 提供角色移動、攻擊等行為的 API
//  4. 透過 bb.cACT 來傳遞訊息
//--------------------------------------------------

export class COM_Action extends Com
{

    get tag() {return _tag;}  // 回傳元件的標籤

    get root() {return this._root;}
    get scene() {return this._root.scene;}


    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _step(pos, duration, ease, {yoyo=false, onYoyo, onUpdate, onComplete}={})
    {
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this.root,
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
        const {root,bb}=this.ctx
        // pt.x=bb.meta.w>32?pt.x+16:pt.x;// 如果格子寬度大於角色寬度，則讓角色的座標對齊到格子中心
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
        const sprite = {img:'arrow', deg:0};
        return new Promise((resolve)=>{
                new Projectile(this.scene, this.root.x, this.root.y, sprite)
                    .shoot( target.pos.x, target.pos.y,
                            {onComplete:()=>{onHit?.();resolve();}}
                        );
            })
    }

    _attack_Spell(target, onHit, sprite)
    {
        const {root}=this.ctx
        root.face?.(target.pos);
        return new Promise((resolve)=>{
                new Projectile(this.scene, this.root.x, this.root.y, sprite)
                    .shoot( target.pos.x, target.pos.y,
                            {onComplete:()=>{onHit?.();resolve();}, bias:0}
                        );
            })
    }

    _castImg(ability) {return ability.cast.img ?? ability.icon;}

    async _onDamage(target, ability)
    {
        GS.mode = GM.MODE.COMBAT;   // 任何一方發動攻擊，強制進入戰鬥模式
        const dmg = computeDamage(this._root, target, ability);
        target.takeDamage(dmg, this._root);
        if(ability) {await target.fx?.({icon: ability.fx?.img ?? ability.icon});}   // stage3: 命中特效
    }

    async _moveToward(target, {maxSteps=1}={})
    {
        const {bb,root} = this.ctx;

        // root.findPath?.(target.pos); // 搜尋路徑，結果會存於 bb.path
        root.findPath?.({ent:target}); // 搜尋路徑，結果會存於 bb.path

        if(bb.path?.state>GM.PATH_NONE)
        {
            for(let i=0;i<maxSteps;i++)
            {
                if(bb.path.pts.length>1)
                {
                    await this._moveTo(bb.path.pts[0])
                    bb.path.pts.shift(); //bb.path.pts.splice(0,1);  
                }
                else {break;}
            }

            if(bb.path.pts.length===0) {delete bb.path;}
        }
        return false;
    }

    async _move()
    {
        const {bb,root,gw} = this.ctx;

        // stop() 只是設旗標，這裡要在「開始移動這一步之前」就攔下來，
        // 不然旗標設定的當下如果已經跑完上一步，還是會多走一步才停（下面 159 行那個檢查點太晚）
        if(bb.path.stop)
        {
            root.clearPath?.();
            bb.cACT.st='stopped';
            if(root.isPlayer) {root.updatePath?.();}
            else if(DEBUG.path) {root.updateDebugPath?.();}
            return;
        }

        bb.cACT.st='moving';

        if(bb.path.pts.length===0)
        {
            bb.cACT.st = 'reach';
            root.clearPath?.();
        }
        else
        {
            const pt = bb.path.pts[0];

            // 判斷前面是否有障礙物（寬角色只查新進入的 tile，避免自擋）
            const w = gw(pt);
            
            if(w > GM.W.BLOCK) // 前面有障礙物
            // if(false) // 先不處理障礙物，直接嘗試移動，移動失敗再處理
            {
                // 判斷是否是目的地，如果不是，回傳值設成 'blocked'
                bb.cACT.st = bb.path.pts.length>1 ? 'blocked' : 'reach';
                this._pt = pt;
                if( bb.cACT.st==='reach') {root.clearPath?.();} 
            }
            else
            {
                await this._moveTo(pt);
                
                this._pre=this._cur;
                this._cur={w:w,pt:pt};

                if(bb.path.stop)
                {
                    root.clearPath?.();
                    bb.cACT.st='stopped';   // 玩家中途取消，不是真的抵達，不能跟 'reach' 混在一起
                }
                else
                {
                    bb.path.pts.shift();    // bb.path.pts.splice(0,1);
                    if(bb.path.pts.length===0) 
                    {
                        root.clearPath?.();
                        bb.cACT.st='reach';
                    }
                }
            }
        }

        if(root.isPlayer) {root.updatePath?.();}
        else if(DEBUG.path) {root.updateDebugPath?.();}
    }

    async _attack(target, ability)
    {
        const {root} = this.ctx;
        const onHit = ()=>this._onDamage(target, ability);

        if(!ability)   // 純武器普攻(沒使用技能)，依武器類型決定動畫
        {
            if(root.total.type==='ranged') {await this._attack_Ranged(target, onHit);}
            else {await this._attack_Melee(target, onHit);}
            return true;
        }

        if(ability.cast) {await root.fx?.({icon:this._castImg(ability)});}   // stage1: 施法動作

        const travel = ability.travel;
        if(!travel)                     {await onHit();}                            // 無 stage2，直接命中
        else if(travel.type==='spell')  {await this._attack_Spell(target, onHit, travel);}
        else if(travel.type==='ranged') {await this._attack_Ranged(target, onHit);}
        else if(travel.type==='melee')  {await this._attack_Melee(target, onHit);}

        return true;
    }

    async _attackAll(targets, ability)   // 給無 travel 的技能：施法動畫只播一次，之後全部目標同時命中
    {
        const {root} = this.ctx;
        if(ability.cast) {await root.fx?.({icon:this._castImg(ability)});}
        await Promise.all(targets.map(t=>this._onDamage(t, ability)));
        return true;
    }
    
    _checkBlock()
    {
        const{bb,probe}=this.ctx;
        const obs = probe(this._pt);      // 取得障礙物
        if(obs?.tag===GM.TP.DOOR)        // 障礙物為門
        {
            return obs.aEmit(GM.OPEN_DOOR);
        }
        else
        {
            bb.path = null;
            bb.sta=GM.ST.IDLE;
        }
    }

    _closeDoorIfNeed()
    {
        const{probe}=this.ctx;
        const pre=this._pre;
        const cur=this._cur;
        if(pre?.w===GM.W.DOOR&&cur?.w!==GM.W.DOOR)
        {
            const go = probe(pre.pt);
            go.emit(GM.CLOSE_DOOR)
        }
    }

    async _flee(pos)
    {
        const{root,bb,fpt}=this.ctx;
        bb.path = null;
        const np = fpt(pos);
        if(np) {await this._moveTo(np);}
        else {root.speak?.('不要殺我!!!');}
        if(DEBUG.path) {root.updateDebugPath?.();}
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    bind(root)
    {
        super.bind(root);

        // 0. 初始化
        this.ctx.bb.cACT={}; 

        // 1.提供 [外部操作的指令]

        // 2.在上層(root)綁定API/Property，提供給其他元件或外部使用
        root.move = this._move.bind(this);
        root.moveToward = this._moveToward.bind(this);
        root.attack = this._attack.bind(this);
        root.attackAll = this._attackAll.bind(this);
        root.anim_melee = (target) => this._attack_Melee(target, null);
        root.checkBlock = this._checkBlock.bind(this);
        root.closeDoorIfNeed = this._closeDoorIfNeed.bind(this);
        root.flee = this._flee.bind(this);
        
        // 3.註冊(event)給其他元件或外部呼叫
    }

    
}