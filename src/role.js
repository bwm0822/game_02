import Phaser, { Time } from 'phaser';
//import {RoleDB, ItemDB, RoleData, CardDB} from './database.js';
//import {ItemDrop} from './item.js';
//import {ProgressBar, BuffBar, Buff, Shield, BuffInfo, Flag} from './gameUi.js';
//import {Gun, Melee} from './weapon.js';
import Utility from './utility.js';
//import Battle from './battle.js'ST_IDLE;
import Record from './record';
//import {Container} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
//import Ctrl from './ctrl.js';
import {Entity,Pickup,Door, Projectile} from './entity.js';
import {RoleDB,DialogDB,ItemDB} from './database.js';
import DB from './db.js';
import {text,bbcText,rect, sprite} from './uibase.js';
import {GM, ROLE_ATTRS, RESIST_MAP} from './setting.js';
import TimeManager from './time.js';
import QuestManager from './quest.js';  

const _dLut = {body:0, armor:1, head:2, helmet:3, weapon:4};
const COLOR_RED = 0xff0000;
const COLOR_WHITE = 0xffffff;

const ICON_CURE = 'buffs/28';
const ICON_ATTACK = 'buffs/31';
const ICON_SHIELD = 'buffs/32';
const ICON_POISON = 'buffs/33';
const ICON_TARGET = 'buffs/20';
const ICON_AVATAR = 'role/0';
//const ICON_AVATAR = 'rogues/1';
const ICON_ENEMY = 'role/1';

export let dbg_hover_npc = false;   // 是否有 npc 被 hover
let player = null;

export function setPlayer(value) {player = value;}

export function getPlayer() {return player;}

class _Corpse extends Phaser.GameObjects.Container
{
    constructor(scene, x, y, id)
    {
        super(scene, x, y);
        scene.add.existing(this);
        this.scene = scene;
        let data = DB.role(id);
        this._addSprite(data)
            .addTweens()
    }

    _addSprite(data)
    {
        let [key,frame] = data.corpse.sprite.split('/');
        let sp = this.scene.add.sprite(0,0,key,frame);
        sp.setScale(data.corpse.scale);
        this.add(sp);
        return this;
    }

    addTweens()
    {
        this.scene.tweens.add({
            targets: this,
            alpha: {from:1, to:0},
            delay: 1000,
            duration: 5000,
            onComplete: ()=>{this.destroy();}
        })
    }
}

class _Shape extends Phaser.GameObjects.Container
{
    constructor(scene, roleD)
    {
        super(scene, 0, roleD.anchor.y)
        if(roleD.body) {this._addPart(roleD.body, GM.PART_BODY);}
        if(roleD.head) {this._addPart(roleD.head, GM.PART_HEAD);}
        if(roleD.hand) {this._addPart(roleD.hand, GM.PART_HAND);}
        this._equips = [];
    }

    _addPart(part, type)
    {
        let getDepth = function(type)
        {
            switch(type)
            {
                case GM.PART_BODY : return 0;
                case GM.PART_HEAD : return 2;
                case GM.PART_HAND : return 5;

                case GM.CAT_HELMET : return 3;
                case GM.CAT_CHESTPLATE : return 1;
                case GM.CAT_GLOVES : return 6;
                case GM.CAT_BOOTS : return 1;
                case GM.CAT_WEAPON : return 4;
            }
            return 0;
        }

        let addSp = (sprite, depth)=>
        {
            if(!sprite) {return;}
            let [key,frame]=sprite.split('/');
            if(key)
            {
                let sp = this.scene.add.sprite(0,0,key,frame);
                sp.setScale(part.scale);
                sp.setPipeline('Light2D');
                sp.setOrigin(0.5,1);
                sp.x = part.x ?? 0;
                sp.y = part.y ?? 0;
                sp.angle = part.a ?? 0;
                sp.depth = depth
                this.add(sp);
                sps.push(sp);
            }
        }

        let sps = [];
        addSp(part.sprite, getDepth(type));
        addSp(part.ext, 6);
        return sps;
    }

    _sortParts()
    {
        let children = this.getAll().sort((a, b) => a.depth - b.depth);
        children.forEach(child => {this.bringToTop(child);});
    }

    addEquip(item)
    {
        if(!item.equip) {return;}
        let sps = this._addPart(item.equip, item.cat);
        this._sortParts();
        this._equips.push(...sps);
    }

    removeEquips()
    {
        this._equips.forEach((equip)=>{equip.destroy();})
        this._equips = [];
    }
}

class _RoleInit
{
    constructor(roleD, data)
    {
        this._rec = data ?? this._initData(roleD);
    }

    get gold() {return this._rec.gold;}
    set gold(value) {this._rec.gold=value;}

    get bag() {return this._rec.bag;}
    get equips() {return this._rec.equips;}
    get baseStats() {return this._rec.baseStats;}
    get states() {return this._rec.states;}
    get skillSlots() {return this._rec.skillSlots;}
    get skills() {return this._rec.skills;}
    get buffs() {return this._rec.buffs;}

    get activeEffects() {return this._rec.activeEffects;}
    set activeEffects(value) {return this._rec.activeEffects=value;}

    _initData(roleD)
    {
         return {
                gold: roleD.gold??0, 
                bag: Utility.toStorage(roleD.bag?.capacity,roleD.bag?.items),
                equips: this._initEquips(roleD.equips),
                baseStats: this._initBaseStats(roleD.baseStats),
                states: this._initStates(),
                skillSlots: this._initSkillSlots(),
                skills: this._initSkills(),
                buffs: this._initBuffs(),
                activeEffects: [],
            }
    }

    _initBaseStats(data) {return data ?? {[GM.STR]:10,[GM.DEX]:10,[GM.CON]:10,[GM.INT]:10};}

    _initStates() {return {[GM.HP]: 100,[GM.HUNGER]: 0,[GM.THIRST]: 0};}

    _initEquips(data) {return data ? data.map(id=>({id:id, count:1})): [];}

    _initSkillSlots() {return [];}

    _initSkills() {return {};}

    _initBuffs() {return [];}

    save() {return this._rec;}

}

class _Skill
{
    constructor(role)
    {
        this._role = role;
        this._sel = null;
    }

    get role() {return this._role;}
    get rec() {return this._role.rec;}
    get sel() {return this._sel;}
    
    learn(id)
    {
        this.role.rec.skills[id] = {remain:0}
        this.role.getTotalStats();
    }

    update(skill) {this.role.rec.skills[skill.id] = {newAdd:true, remain:skill.dat.cd};}
    
    getAll() {return this.role.rec.skills;}                     // 取得所有技能
    get(id) {return this.role.rec.skills[id];}
    
    // 技能欄位，call by SkillSlot
    clearSlotAt(i) {this.role.rec.skillSlots[i] = null;}        // 清除技能欄位
    setSlotAt(i, skill) {this.role.rec.skillSlots[i] = skill;}  // 設定技能欄位
    getSlots() {return this.role.rec.skillSlots;}               // 取得所有技能欄位
    getSlotAt(i) {return this.role.rec.skillSlots[i];}          // 取得技能欄位
    
    
    // 使用技能
    async use(skill) // call by SkillSlot
    {   
        await this.role.disp.skill(skill);

        if(skill.dat[GM.HEAL]){ this.role.heal(skill.dat[GM.HEAL]); }

        for(const eff of skill.dat.effects) {this.role.addEffect(eff);}

        this.update(skill)
        skill.reset();

        this.role._send('refresh')
        this.role._resume();
    }

    useTo(pos, target)
    {
        if(!target || !target.isAlive) {return;}

        this.role._faceTo(pos);
        // let bodies = this.getBodiesInRect(this.skill.dat.range, false);

        return this.role._step( pos, 200, 'expo.in',
                        {   
                            yoyo:true, 
                            onYoyo:()=>{this.applyTo(target);},
                            onComplete: () => {this.role._resume();}
                        }
                    );
    }

    applyTo(target)
    {
        if(!target || !target.isAlive) {return;}
        let damage = this.role._calculateDamage(this.role, target, this._sel);
        target.takeDamage(damage, this.role);

        //let bodies = this.getBodiesInRect(this.skill.dat.range, false)

        if(this._sel)
        {
            this.update(this._sel);
            this.reset();
        }
    }

    // 選擇技能，call by SkillItem
    select(skill)
    {
        this.role._showRange(true, skill.dat.range, false);
        this._sel = skill;
        this.role.state = GM.ST_SKILL;
    }

    unselect()
    {
        this.role._showRange(false);
        this._sel = null;
        this.role.state = GM.ST_IDLE;
    }

    reset()
    {
        this._sel.reset();
        this.unselect();
    }

    isInRange(pos)
    {
        let n = DB.skill(this._sel.id).range;
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let rect = this.role.a[y][x];
                if( !rect.block && 
                    pos.x>=rect.x && pos.x<rect.x+rect.width &&
                    pos.y>=rect.y && pos.y<rect.y+rect.height)
                {
                    return true
                }
            }
        }

        return false;
    }
}

class _Action
{
    constructor(role) {this._role = role;}

    sell(target, ent, i, isEquip)
    {
        if(target.buy(ent, i, isEquip))
        {
            this._role.rec.gold+=ent.gold;
            ent.empty();
            return true;
        }
        return false;
    }

    buy(ent, i, isEquip)
    {
        if(this._role.rec.gold>=ent.gold)
        {
            if(this.take(ent, i, isEquip))
            {
                this._role.rec.gold-=ent.gold;
                if(this._role === getPlayer())
                {
                    this._role._send('msg',this._role.msg_name+`${'_buy'.lab()} ${ent.label}`);
                }
                else
                {
                    this._role._send('msg',getPlayer().msg_name+`${'_sell'.lab()} ${ent.label}`)
                }
                return true;
            }
            return false;
        }
        else
        {
            this._role._send('msg','_not_enough_gold'.lab());
            return false;
        }
    }

    take(ent, i, isEquip)
    {
        if(isEquip)
        {
            this._role.rec.equips[i] = ent.itm; 
            this._role.equip();
            return true;   
        }
        else
        {
            // 呼叫 Role 的 父物件 Entity 的 take()
            return Entity.prototype.take.call(this._role, ent, i)
        }
    }

    receive(rewards)
    {
        rewards.forEach((reward)=>{
            console.log(reward.type)
            switch(reward.type)
            {
                case 'gold': this._role.rec.gold+=reward.count; break;
                case 'item': this._role.putStorage(reward.id, reward.count); break;
            }
        })
       
    }

    use(ent)
    {
        // console.log('use',ent.item);
        for(let [key,value] of Object.entries(ent.props))
        {
            switch(key)
            {
                case GM.HP:
                case GM.HUNGER:
                case GM.THIRST:
                    this._role.incState(key,value);
                    break;
            }
        }

        if(ent.p(GM.P_TIMES) !== undefined) // 不可以使用 ent.slot?.times，因為 ent.slot.items=0 時，條件不成立
        {
            ent.incp(GM.P_TIMES, -1)
            if(ent.p(GM.P_TIMES)<=0 && !ent.p(GM.P_KEEP))
            {
                ent.empty();
            }
        }
        else if(ent.p(GM.P_CAPACITY) !== undefined)
        {
            ent.incp(GM.P_CAPACITY,-1)
            if(ent.p(GM.P_CAPACITY)<=0 && !ent.p(GM.P_KEEP))
            {
                ent.empty();
            }
        }
        else
        {
            ent.count--;
            if(ent.count<=0) {ent.empty();}
        }
    }

    drink()
    {
        let states = this._role.rec.states;
        if(states[GM.THIRST]) {states[GM.THIRST]=0; this._role._send('msg',this.msg_name+`${'_drink'.lab()}`);}
    }

    sleep(ent)
    {
        this._role._removeWeight()
        ent.add(this._role);
        this._role.pos = {x:ent.sleepX,y:ent.sleepY}
        this._role.angle = ent.sleepA;
        this._role._zone.disableInteractive();        
        this._role.state = GM.ST_SLEEP;
        this._role.disp.speak('💤',{duration:-1,tween:true});
    }

    wake()
    {
        this._role.disp.speak();
        let ent = this._role.parentContainer;
        ent.remove(this._role)
        ent.user = null;
        this._role.pos = this._role._getUnoccupiedPos(ent.pts[0]);
        this._role.angle = 0;
        this._role._addWeight();
        this._role._updateDepth();
        this._role._zone.setInteractive();
        this._role.state = GM.ST_IDLE;
        
    }

    async attack(ent)
    {
        this._role._faceTo(ent.pos);
        let range = this._role.total[GM.RANGE];
        if(range>1)
        {
            return new Promise((resolve)=>{
                new Projectile(this._role.scene, this._role.x, this._role.y, 'arrow', 0.25)
                    .shoot( ent.x, 
                            ent.y, 
                            // async ()=>{await this.interact(this._ent, this._act);resolve();}
                            ()=>{
                                // this.applySkillTo(this._ent, this.skill.sel);
                                this._role.skill.applyTo(this._ent);
                                resolve();}
                        );
            })
        }
        else
        {
             return this._role._step( ent.pos, 200, 'expo.in',
                                {   
                                    yoyo: true, 
                                    onYoyo: async ()=>{
                                        // await this.interact(this._ent, this._act);
                                        // this.applySkillTo(this._ent, this.skill.sel);
                                         this._role.skill.applyTo(ent);
                                    }
                                } 
                            ); 
        }
    }

    async interact(ent, act) 
    {
        if(!act) {return;}
        if(ent) {this._role._faceTo(ent.pos);}

        console.log('---------------------------',act)
        return new Promise((resolve)=>{ent.emit(act, resolve, this._role);});
    }

    heal(amount) 
    {
        this._role.disp.add('+'+amount, '#0f0', '#000');
        let total = this._role.total;//this.getTotalStats();
        this._role.rec.states[GM.HP] = Math.min(total[GM.HPMAX], total[GM.HP] + amount);
        total[GM.HP] = this._role.rec.states[GM.HP];
        console.log(`${this._role.name} 獲得 ${amount} 治療`);

        if(this._role.isPlayer) {this._role._send('refresh');}
    }

}

class _Anim
{
    constructor(role)   {this._role = role;}

    idle(on)
    {
        if(!this._role._shape){return;}   // 判斷 this._shape ，以避免在地圖上出錯
        if(on)   
        {
            if(!this._twIdle)
            {
                this._twIdle = this._role.scene.tweens.add({
                        targets: this._role._shape,
                        y: {from:this._role.max.y, to:this._role.max.y-1.5},
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

    walk(duration)
    {
        this._role.scene.tweens.add({
            targets: this._role._shape,
            y: {from:this._role.max.y, to:this._role.max.y-5},
            ease:'quint.in',
            duration: duration,
            yoyo: true,  
        });
    }
}

class _Path
{
    constructor(role)   
    {
        this._role = role;
        this._path, this._ent, this._act;
        this._dbgPath;
    }

    _clearPath()
    {
        this._path = [];
        if(this._dbgPath){this._dbgPath.clear();}
    }

    _drawPath(path)
    {
        if(!this._dbgPath)
        {
            this._dbgPath = this._role.scene.add.graphics();
            this._dbgPath.name = 'path';
            this._dbgPath.fillStyle(0xffffff);
            this._dbgPath.setDepth(Infinity);
        }
        this._dbgPath.clear();
        if(path)
        {
            path.forEach(node=>{
                let circle = new Phaser.Geom.Circle(node.x, node.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            })
        }
    }

    _isInRange()
    {
        if(this._act===GM.ATTACK)
        {
            return this._role._isInAttackRange(this._ent);
        }
        else
        {
            return this._role._checkIsTouch(this._ent);
        }
    }

    _closeDoorWhenLeave(pt,w)
    {
        // 是否離開門，如果是，關門
        if(this._preW==GM.W_DOOR && w!=GM.W_DOOR)    // exit door
        {
            let bodys = this._role.scene.physics.overlapCirc(this._prePt.x,this._prePt.y,0,true,true);
            this._role.interact(bodys[0]?.gameObject,GM.CLOSE_DOOR);
        }
        this._preW = w;
        this._prePt = pt;  
    }

    async _openDoorIfNeed(pt)
    {
        let bodys = this._role.scene.physics.overlapCirc(pt.x,pt.y,0,true,true);
        let ent = bodys[0]?.gameObject;

        // 如果是門，則打開
        if (ent && ent instanceof Door && !ent.opened) 
        {
            await this._role.interact(ent, GM.OPEN_DOOR);
            return true;
        }
        return false;
    }

    // public
    setDes({pt, ent, act, next=false}={})
    {
        let pts = ent?.pts ?? [pt];
        let rst = this._role.scene.map.getPath(this._role.pos, pts);
        // console.log('setDes',rst,act)
        if(rst?.state>0)
        {
            // console.log('chk---')
            this._path = rst.path;
            this._ent = ent;
            // this._act = act ?? ent?.act ?? '';
            this._act = act;

            // this._role.state = next ? GM.ST_NEXT : GM.ST_MOVING;

            if(this._role.isPlayer) 
            {
                this._role.state = act===GM.ATTACK ? GM.ST_ATTACK : GM.ST_MOVING;
                this._role._send('clearpath');
                this._role._resume();
            }
            else
            {
                this._role.state = act===GM.ATTACK ? GM.ST_ATTACK 
                                                    : next ? GM.ST_NEXT
                                                           : GM.ST_MOVING;
            }
        }        
    }

    stop()
    {
        this._role.state = GM.ST_IDLE;
        this._clearPath();
    }

    async move(repath=true)
    {
        let path = this._path;

        // 判斷是否接觸目標      
        if(this._isInRange())
        {
            this._clearPath();
            await this._role._cmd(this._ent,this._act);
            return;
        }
        else
        {
            // console.log('[move]',path.length)
            if(path.length==0)
            {
                // console.log('[stop]')
                this.stop();
                return;
            }

            // 取出路徑
            let pt = path[0];
            let w = this._role.scene.map.getWeight(pt);

            // 判斷是否可行走
            if(w < GM.W_BLOCK)    // 可以行走
            {
                await this._role._moveTo(pt);    // 移至 pt
                path.shift();                   // 移除陣列第一個元素
                
                if(this._role.isPlayer) 
                {
                    // state = GM.ST_MOVING 時，才 drawPath()，
                    // 避免移動到一半，點選地圖，呼叫 stop() clearPath()後，還 drawPath()
                    if(this._role.state===GM.ST_MOVING) {this._drawPath(path);} 
                }
                else // npc
                {
                    this._closeDoorWhenLeave(pt,w);
                }

                if(path.length===0) // 到達目的地
                {
                    let act = this._act ?? this._ent?.act;
                    
                    if(!act) {this.stop(); console.log('[reach]')}
                    else {this._clearPath();}
                }
                return;
            }
            else    // 不可行走
            {
                if(this._role.isPlayer)   // for player
                {
                    this.stop(); return;
                }
                else                // for npc
                {
                    if(await this._openDoorIfNeed(pt))
                    {
                        return;
                    }
                    else if(repath)     // 重新找路徑
                    {
                        this.setDes({ent:this._ent, act:this._act});
                        if(await this.move(false))
                        {
                            this._role.disp.speak('操...給老子滾開...💢');
                        }

                        return;
                    }
                    return true;
                }
            }
        }
    }


}

class _Disp
{
    constructor(role)   
    {
        this._role = role;
    }

    async _show()
    {
        this._busy = true;
        let m = this._queue.shift();
        this._promises.push(this._create(m.value,m.color,m.stroke));
        await Utility.delay(100);
        if (this._queue.length === 0) 
        {
            this._busy = false;
        }
        else
        {
            this._busy = true;
            this._show();
        }
    }

    _create(value,color='#fff',stroke='#000')
    {
        let t = text(this._role.scene,{text:value,color:color,stroke:stroke,strokeThickness:5});
        this._role.add(t);
        t.setOrigin(0.5,0.5);
        t.setDepth(100);
        // t.setText(value).setTint(color);
        let x = Phaser.Math.Between(10, -10);
        return new Promise((resolve)=>{
            this._role.scene.tweens.add({
                    targets: t,
                    x: {from:x, to:x},
                    y: {from:-48, to:-64},
                    duration: 300,
                    ease: 'linear',
                    onStart: ()=>{},
                    onComplete: (tween, targets, gameObject)=>{t.destroy();resolve()}         
                });
        });
    }

    // 等待 所有 disp 都結束
    async wait()
    {
        if(!this._promises || this._promises.length===0) {return;}
        await Promise.all(this._promises);    
        this._queue=[]; 
        this._promises=[];
    }

    add(value,color='#fff',stroke='#000')
    {
        if(!this._queue){this._queue=[];}
        if(!this._promises) {this._promises=[];}
        this._queue.push({value:value,color:color,stroke:stroke});
        if(!this._busy) {this._show();}
    }
    
    async skill(skill)
    {
        let sp = sprite(this._role.scene,{icon:skill.dat.icon});
        this._role.add(sp);
        sp.setOrigin(0.5,0.5);
        sp.setDepth(100);
        
        return new Promise((resolve)=>{
            this._role.scene.tweens.add({
                targets: sp,
                y: {from:-32, to:-64},
                scale:{from:1, to:2},
                duration: 300,
                ease: 'linear',
                onStart: ()=>{},
                onComplete: (tween, targets, gameObject)=>{sp.destroy();resolve()}         
            });
        });

    }

    speak(words, {duration=1000,tween=false}={})
    {
        if(!this._speak)
        {
            this._speak = this._role.scene.rexUI.add.sizer(0,-48,{space:5});
            this._speak.addBackground(rect(this._role.scene,{color:GM.COLOR_WHITE,radius:10,strokeColor:0x0,strokeWidth:0}))
                        .add(text(this._role.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
                        .setOrigin(0.5,1);
            this._role.add(this._speak);
            this._role.sort('depth')
        }

        if(tween)
        {
            this._speak.tw = this._role.scene.tweens.add({
                targets: this._speak,
                scale: 0.5,
                loop: -1,
                duration: 1000,
                yoyo:true,
                onStop: ()=>{this._speak.setScale(1);}, 
            })
        }

        if(words)
        {
            this._speak.getElement('text').setText(words);
            this._speak.show();
            this._speak.layout();
            if(duration>0)
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
                this._to = setTimeout(()=>{this._speak?.hide();this._to=null;}, duration);
            }
            else
            {
                if (this._to) {clearTimeout(this._to);this._to=null;}
            }
        }
        else
        {
            if (this._to) {clearTimeout(this._to);this._to=null;}
            this._speak.hide();
            this._speak.tw?.stop();
        }

    }
}

export class Role extends Entity
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.weight = 1000;
        this._faceR = true;
        //
        this._path = [];
        this._act = '';
        this._resolve;
        //
        this.isStatic = false; // true: static body, false: dynamic body
        this.id = '';
        this.interactive = true;
        //       
        this._state = GM.ST_IDLE; 
    }

    get isPlayer() {return false;}

    get storage()   {return this.rec.bag;}

    get state()     {return this._state;}
    set state(value) {this._state=value;}

    get states() {return this.rec.states;}

    get isAlive() {return this.rec.states[GM.HP] > 0;}

    get msg_name() {return `[weight=900]${this.id.lab()}[/weight] `}

    get skill() {return this._skill;}
    get disp() {return this._disp;}
    get anim() {return this._anim;}

    // action
    buy(...args) {return this._action.buy(...args);}
    sell(...args) {return this._action.sell(...args);}
    take(...args) {return this._action.take(...args);}
    use(...args) {return this._action.use(...args);}
    receive(...args) {return this._action.receive(...args);}
    drink(...args) {return this._action.drink(...args);}
    sleep(...args) {return this._action.sleep(...args);}
    wake(...args) {return this._action.wake(...args);}
    attack(...args) {return this._action.attack(...args);}  // attack() 不用加 async
    interact(...args) {return this._action.interact(...args);}  // interact() 不用加 async
    heal(...args) {return this._action.heal(...args);}
    // path
    setDes(...args) {return this._path.setDes(...args);}
    st_moving(...args) {return this._path.move(...args);}
    stop(...args) {return this._path.stop(...args);}

    /////////////////////////////////////////////////////
    // private
    /////////////////////////////////////////////////////

    _addSprite(sprite)
    {
        if(!sprite) {return;}
        let [key,frame]=sprite.split('/');
        this.setTexture(key,frame);
    }

    _initData()
    {
        let roleD = DB.role(this.id);

        this._faceR = roleD.faceR;

        let b = roleD.b;
        let g = roleD.g;
        let z = roleD.z;

        if(b) {this.bl=b.l; this.br=b.r; this.bt=b.t; this.bb=b.b;}
        if(g) {this.gl=g.l; this.gr=g.r; this.gt=g.t; this.gb=g.b;}
        if(z) {this.zl=z.l; this.zr=z.r; this.zt=z.t; this.zb=z.b;}

        this.displayWidth = roleD.w; 
        this.displayHeight = roleD.h;
        this.anchor = roleD.anchor;

        return roleD;
    }

    _loadData()
    {
        if(this.isPlayer) {return Record.data.player;}
        else if(this.uid==-1) {return Record.data.roles?.[this.id];}
        else {return super._loadData();}
    }

    _addLight()
    {
        if(!this.light)
        {
            let a = this.scene.lights.ambientColor;
            this.light = this.scene.lights.addLight(0, 0, 300).setIntensity(GM.LIGHT-a.r);
            this.light.x = this.x;
            this.light.y = this.y;
        }
    }

    _removeLight()
    {
        if(this.light)
        {
            this.scene.lights.removeLight(this.light);
            this.light = null;
        }
    }

    _addToRoleList() {this.scene.roles.push(this);}

    _removeFromRoleList() 
    {
        console.log(this.id,'remove role')
        const index = this.scene.roles.indexOf(this);
        if (index > -1) {this.scene.roles.splice(index, 1);}
    }

    _faceTo(pt)
    {
        if(pt.x==this.x) {return;}
        if(this._sp) {this._sp.flipX = (pt.x>this.x) != this._faceR;}
        if(this._shape) {this._shape.scaleX = (pt.x>this.x) != this._faceR ? -1 : 1;}
    }

    _checkIsTouch(ent)
    {
        // if(ent && this.parentContainer == ent) {return true;}
        // return !ent ? false : this.scene.map.isNearby(ent,this.pos);
        return !ent ? false : ent.isTouch(this);
    }

    _stepMove(h,v)
    {
        let rst = this.scene.map.stepMove(this.pos,h,v);
        if(rst.state>0)
        {
            this._path = rst.path;
            this.state = GM.ST_MOVING;
            this._ent = null;
            this._act = '';
            this._resume();
        }
    }

    async _moveTo(pt,{duration=200,ease='expo.in'}={})
    {
        this._faceTo(pt);
        this._removeWeight();
        this._addWeight(pt);
        this.anim.idle(false);
        this.anim.walk(duration/2);
        await this._step(pt,duration,ease,{onUpdate:this._setLightPos.bind(this)});
        //this._addWeight();
        this._updateDepth();
    }

    async _cmd(ent, act)
    {
        act = act??ent?.act;
        
        if(act===GM.ATTACK)
        {
            if(this.isPlayer) {this.state = GM.ST_IDLE;}
            await this.attack(ent);
        }
        else
        {
            this.state = GM.ST_IDLE;
            await this.interact(ent,act);
        }

        if(this.isPlayer) {this._resume();}
    }

    _step(pos, duration, ease, {yoyo=false, onYoyo, onUpdate, onComplete}={})
    {
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this,
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

    async _pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    _resume() {this._resolve?.();this._resolve=null;}

    _isInAttackRange(ent)
    {
        // let range = this.status.attrs[GM.P_RANGE];
        let range = this.getTotalStats()[GM.RANGE];
        let [tx1, ty1] = this.scene.map.worldToTile(this.x,this.y);
        let [tx2, ty2] = this.scene.map.worldToTile(ent.x,ent.y);
        let dx = Math.abs(tx1 - tx2);
        let dy = Math.abs(ty1 - ty2);
        return dx <= range && dy <= range;
    }

    _looties()
    {
        // let roleD = RoleDB.get(this.id);
        let roleD = DB.role(this.id);

        roleD.looties && 
        roleD.looties.forEach((loot)=>{
            let isObj = Utility.isObject(loot);
            let id = isObj ? loot.id : loot;
            let p = isObj ? loot.p : 100;
            let count = isObj ? loot.count : 1;
            if(p==100 || Utility.roll()<p)
            {
                let pos = this.scene.map.getDropPoint(this.pos);
                let obj = {id:id, count:count};
                new Pickup(this.scene,this.x,this.y-32).init_runtime(obj).falling(pos);
            }
        })
    }

    _checkQuest()
    {
        // let qid = this.data?.get('qid');
        let qid = this.qid;
        // console.log(qid)
        if(qid) {QuestManager.check(qid,{type:GM.KILL,id:this.id});}
    }

    async _dead(attacker)
    {
        if(this.state === GM.ST_DEATH) {return;}
        this.state = GM.ST_DEATH;
        
        if(attacker) {this._send('msg', `${attacker.id.lab()} ${'_kill'.lab()} ${this.id.lab()}`);}
        else {this._send('msg', `${this.id.lab()} ${'_die'.lab()}`);}
       
        this._checkQuest();
        await this.disp.wait();
        this._looties();
        new _Corpse(this.scene, this.x, this.y, this.id);
        this._removed(); 
    }

    _removed()
    {
        // 不可以放到 destroy()，離開場景時，如果呼叫 removeWeight() 會出現錯誤，
        // 因為此時 this.scene.map 已經移除了
        this._removeWeight();
        this._removeFromRoleList();
        this._unregisterTimeManager();

        super._removed();
    }

    // 檢查 p 這個點是否被佔用，如果被佔用，則尋找一個可用的點
    _getUnoccupiedPos(p)
    {
        if(this.scene.map.getWeight(p)<GM.W_BLOCK) {return p;}
        return this.scene.map.getValidPoint(p,false);
    }
   
    _setLightPos()
    {
        if(this.light)
        {
            this.light.x = this.x;
            this.light.y = this.y;
        }
    }

    _setLightInt()
    {
        if(this.light)
        {
            let a = this.scene.lights.ambientColor;
            this.light.intensity = GM.LIGHT - a.r;
        }
    }

    _registerTimeManager()
    {
        this._updateTimeCallback = this._updateTime.bind(this); // 保存回调函数引用
        TimeManager.register(this._updateTimeCallback);
    }

    _unregisterTimeManager() {TimeManager.unregister(this._updateTimeCallback);}

    async _updateTime(dt)
    {
        this._setLightInt();
        this._updateStates(dt);
        this._applyEffects(dt);
        this._updateEquips(dt);
        this.getTotalStats();
        if(this.isPlayer) {this._send('refresh');}

        await this.disp.wait();
    }

    _updateStates(dt=1)
    {
        this.rec.states[GM.HUNGER] = Math.min(this.rec.states[GM.HUNGER] + GM.HUNGER_INC * dt, 100);
        this.rec.states[GM.THIRST] = Math.min(this.rec.states[GM.THIRST] + GM.THIRST_INC * dt, 100);
    }

    _updateEquips(dt)
    {
        for(let i=0; i<this.rec.equips.length;i++)
        {
            let equip = this.rec.equips[i];
            if(equip && equip.endurance)
            {
                equip.endurance -= dt;
                if(equip.endurance<=0)
                {
                    this.rec.equips[i]=null;
                    this.equip();
                }
            }
        }
    }

    _showRange(on, range, checkBlock)
    {
        this._range?.clear();
        if(!on) {return;}
        if(!this._range) {this._range = this.scene.add.graphics();}

        let n = range;
        let rows = 2*n+1;
        let cols = 2*n+1;
        let a = Array.from({ length: rows }, () => Array(cols));
        let [h,w,h_2,w_2] = [GM.TILE_H, GM.TILE_W, GM.TILE_H/2, GM.TILE_W/2];

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let px = this.x + (x-n)*GM.TILE_W;
                let py = this.y + (y-n)*GM.TILE_H;
                let wei = this.scene.map.getWeight({x:px,y:py});
                let hits = checkBlock ? Utility.raycast(this.x,this.y,px,py,[this.scene.staGroup]) : [];
                let block = wei<=0 || hits.length>0;
                a[y][x] = {x:px-w_2, y:py-h_2, width:w, height:h, block:block};
            }
        }

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                a[y][x].l = a[y][x-1]?.block===false ? false : true;
                a[y][x].r = a[y][x+1]?.block===false ? false : true;
                a[y][x].t = a[y-1]?.[x]?.block===false ? false : true;
                a[y][x].b = a[y+1]?.[x]?.block===false ? false : true;
            }
        }

        for(let y=0; y<=2*n; y++)
        {
            for(let x=0; x<=2*n; x++)
            {
                let rect = a[y][x];
                if(!rect.block)
                {
                    Utility.drawBlock(this._range, rect);
                }
            }
        }

        this.a=a;
    }

    _deriveStats(base) 
    {
        const out = {};
        // 1) Vital & resource
        if (base[GM.HPMAX] == null) out[GM.HPMAX] = Math.round((base[GM.CON] || 0) * 10);               // HP = CON x 10

        // 2) Combat basics
        console.log("type=",base.type);
        if (base[GM.ATK] == null) out[GM.ATK] = base.type === "ranged" ? 0 : (base[GM.STR] || 0) * 1.5; // 攻擊 = STR x 1.5
        if (base[GM.DEF] == null) out[GM.DEF] = (base[GM.CON] || 0);                                    // 物防 = CON
        if (base[GM.RANGE] == null) out[GM.RANGE] = base.type ? 0 : 1;                                  // 攻擊半徑
        if (base[GM.HIT] == null) out[GM.HIT] = 1;                                                      // 命中 = 1
        if (base[GM.DODGE] == null) out[GM.DODGE] = (base[GM.DEX] || 0) * 0.01;                         // 閃避 = DEX x 0.01
        
        // 3) Critical
        if (base[GM.CRITR] == null) out[GM.CRITR] = Math.min(0.5, (base[GM.DEX] || 0) * 0.01);          // 每點 DEX +1% 暴擊，上限 50%
        if (base[GM.CRITD] == null) out[GM.CRITD] = 1.5;                                                // 基礎暴擊傷害倍率

        // 4) Resistances
        if (base.resists == null) out.resists = { [GM.FIRE_RES]: 0, [GM.ICE_RES]: 0, [GM.POISON_RES]: 0, [GM.PHY_RES]: 0 };

        return out;
    }

    _calculateDamage(attacker, defender, skill) 
    {
        // console.log('skill------------------',skill?.dat)
        const aStats = attacker.getTotalStats();
        const dStats = defender.getTotalStats(aStats.mTarget);
        console.log(aStats,dStats)

        // 計算是否命中
        let hit = aStats[GM.HIT] + (skill?.dat?.self?.hit??0); 
        let dodge = dStats[GM.DODGE] + (skill?.dat?.target?.dodge??0);
        let rnd = Math.random();
        // console.log('---------------------------------',rnd,hit,hit-dodge)
        if(rnd >= hit) {return {amount:0, type:GM.MISS};}
        else if(rnd >= (hit-dodge)) {return {amount:0, type:GM.DODGE};}


        // 計算 Effect
        let effs = [...aStats.mTarget.effs,...(skill?.dat?.effects??[])]
        // console.log('---------------effs',effs)
        for(const effect of effs)
        {
            defender.addEffect(effect,['dot','debuff']);
        }

        // for(const effect of aStats.mTarget.effs)
        // {
        //     defender.addEffect(effect,['dot','debuff']);
        // }

        // for(const effect of skill?.dat?.effects??[])
        // {
        //     defender.addEffect(effect,['dot','debuff']);
        // }

        // 計算傷害
        let type = 'normal';
        let atk = aStats[GM.ATK] || 0;          // 基本攻擊
        let elm = skill?.dat?.elm ?? GM.PHY;    // 攻擊屬性
        let mul = skill?.dat?.mul ?? 1;         // 傷害倍率
        let penetrate = skill?.dat?.pen ?? 0;   // 防禦穿透率

        // 1. 計算基礎傷害
        let baseDamage = atk * mul;
        // 2. 計算防禦係數
        const effectiveDef = dStats.def * (1 - penetrate);
        let defFactor = baseDamage / (baseDamage + effectiveDef);
        // 3. 計算實際傷害
        let damage = baseDamage * defFactor;
        // const resist = dStats.resists?.[elm+'_res'] || 0;
        const resist = dStats.resists?.[RESIST_MAP[elm]] || 0;
        damage *= 1 - resist;
        // 4. 計算暴擊
        if (Math.random() < aStats[GM.CRITR]) 
        {
            damage *= aStats[GM.CRITD];
            console.log(`💥 ${attacker.name} 暴擊！`);
            type = GM.CRIT;
        }
        // 5. 浮動傷害(0.85 ~ 1.05)
        damage *= 0.95 + Math.random() * 0.1;
        damage = Math.round(Math.max(1, damage))

        return {amount:damage, type:type};
    }

    _applyEffects() 
    {
        const expired = [];
        for (const e of this.rec.activeEffects) 
        {
            if (e.newAdd) {delete e.newAdd; continue;}
            if (e.type === "dot") 
            {
                let finalDamage = e.value;
                if (e.elm) 
                {
                    const resist = this.total.resists?.[RESIST_MAP[e.elm]] || 0;
                    finalDamage *= 1 - resist;
                }
                this.takeDamage({amount:finalDamage});
            }
            else if (e.type === "hot") 
            {
                let finalHeal = e.value;
                this.heal(finalHeal);
            }
            e.remaining -= 1;
            if (e.remaining <= 0) {expired.push(e);}
        }

        for (const e of expired) 
        {
            this.rec.activeEffects = this.rec.activeEffects.filter(x => x !== e);
            console.log(`${this.name} 的 ${e.stat || e.tag} ${e.type} 效果結束`);
        }

        // skill cooldown
        for (const skill of Object.values(this.rec.skills))
        {
            if (skill.newAdd) { delete skill.newAdd; continue}
            skill.remain > 0 && (skill.remain--);
        }
    }

    /////////////////////////////////////////////////////
    // public
    /////////////////////////////////////////////////////
    getTotalStats(extern) 
    {
        let calc = function(stats, out)
        {
            for(let [k,v] of Object.entries(stats))
            {
                if(GM.BASE.includes(k)) // 基礎屬性
                {
                    // 如果 v 為包含'*'的字串(如 '0.1*') => 乘， 其餘 => 加
                    if(v?.includes?.('*')) {out.baseMul[k] = (out.baseMul[k] || 0) + parseFloat(v);}
                    else {out.baseAdd[k] = (out.baseAdd[k] || 0) + parseFloat(v);}
                }
                else    // 次級屬性、抗性
                {
                    // 如果 v 為包含'x'的字串(如 '0.1*') => 乘， 其餘 => 加
                    if(v?.includes?.('*')) {out.secMul[k] = (out.secMul[k] || 0) + parseFloat(v);}
                    else {out.secAdd[k] = (out.secAdd[k] || 0) + parseFloat(v);}
                }
            }
        }

        let addEffs = function(effs, out)
        {
            for(const eff of effs)
            {
                if(['dot','debuff'].includes(eff.type)) {out.effs.push(eff);}
            }
        }

        // 1) 淺層拷貝 [基礎屬性]
        let base = {...this.rec.baseStats};

        // 基礎屬性(加),基礎屬性(乘),次級屬性(加),次級屬性(乘)
        let mSelf = extern ?? {baseAdd:{}, baseMul:{}, secAdd:{}, secMul:{}}
        let mTarget = {baseAdd:{}, baseMul:{}, secAdd:{}, secMul:{}, effs:[]}

        // 2) 計算 [裝備] 加成
        for(const equip of this.rec.equips) 
        {
            if(equip)
            {
                let eq = DB.item(equip.id);
                let self = eq.self || {};
                let target = eq.target || {};
                let effs = eq.effects || [];
                calc(self, mSelf);
                calc(target, mTarget);
                addEffs(effs, mTarget)
                if(eq.cat === GM.CAT_WEAPON) {base.type = self.type;}
            }
        }

        // 3) 計算 [被動技能] 的加成
        for(const key in this.rec.skills)
        {
            let sk = DB.skill(key);
            if(sk.type === GM.PASSIVE) {calc(sk.stats || {}, mSelf);}
        }

        // 4) 計算 [作用中效果] 的加成
        for (const eff of this.rec.activeEffects) 
        {
            if (eff.type === "buff" || eff.type === "debuff") {calc(eff.stats, mSelf)}
        }

        // 4) 修正後的 base
        for (const [k, v] of Object.entries(mSelf.baseAdd)) {base[k] = (base[k] || 0) + v;}
        for (const [k, v] of Object.entries(mSelf.baseMul)) {base[k] = (base[k] || 0) * (1 + v);}

        // 5) 修正後的 base 推導 derived
        const derived = this._deriveStats(base);

        // 6) 合併：base 值優先，derived 補空位
        const total = { ...derived, ...base};
        total.mTarget = mTarget;

        // 7) 再套用「推導後」的裝備加成與抗性、武器
        for (const [k, v] of Object.entries(mSelf.secAdd)) {total[k] = (total[k] || 0) + v;}
        for (const [k, v] of Object.entries(mSelf.secMul)) {total[k] = (total[k] || 0) * ( 1 + v);}

        // 8) 最後合併狀態，並確保當前生命值不超過最大值
        this.rec.states[GM.HP] = Math.min(total[GM.HPMAX], this.rec.states[GM.HP]); 
        Object.assign(total, this.rec.states);

        this.total = total;
        return total;
    }

    takeDamage(dmg) 
    {
        switch(dmg.type)
        {
            case GM.CRIT:
                this.disp.add(`${'暴擊'} -${dmg.amount}`, '#f00', '#fff');
                this.rec.states[GM.HP] = Math.max(0, this.rec.states[GM.HP]-dmg.amount); 
                console.log(`${this.name} 受到 ${dmg.amount} 暴擊傷害`);
                break;
            case GM.DODGE:
                this.disp.add(GM.DODGE.lab(), '#0f0', '#000');
                break;
            case GM.MISS:
                this.disp.add(GM.MISS.lab(), '#0f0', '#000');
                break;
            default:
                this.disp.add(-dmg.amount, '#f00', '#fff');
                this.rec.states[GM.HP] = Math.max(0, this.rec.states[GM.HP]-dmg.amount); 
                console.log(`${this.name} 受到 ${dmg.amount} 傷害`);
        }

        this.total[GM.HP] = this.rec.states[GM.HP];

        if(this.isPlayer) {this._send('refresh');}

        if(this.rec.states[GM.HP] === 0) {this._dead();}   
    }

    addEffect(effect,types=['hot','dot','buff','debuff'])
    {
        if(!types.includes(effect.type)) {return;}

        const maxStack = effect.maxStack || 99;
        if (true)//effect.stackable) 
        {
            const existingStacks = this.rec.activeEffects.filter(e => e.tag === effect.tag && e.type === effect.type);
            if (existingStacks.length >= maxStack) {
                console.log(`${this.name} 的 ${effect.tag} 疊層已達上限 (${maxStack})`);
                return;
            }
            const newEff = { ...effect, remaining: effect.dur, newAdd:true };
            this.rec.activeEffects.push(newEff);
            console.log(`${this.name} 疊加 ${effect.tag} 效果（第 ${existingStacks.length + 1} 層）`);
        } 
        else 
        {
            const existing = this.rec.activeEffects.find(e => e.tag === effect.tag && e.type === effect.type);
            if (existing) 
            {
                existing.remaining = effect.duration;
                existing.value = effect.value;
                console.log(`${this.name} 的 ${effect.tag} 效果已刷新`);
            } 
            else 
            {
                const newEff = { ...effect, remaining: effect.dur, newAdd:true };
                this.rec.activeEffects.push(newEff);
                console.log(`${this.name} 獲得 ${effect.type}：${effect.stat || effect.tag} ${effect.value * 100 || effect.value}% 持續 ${effect.duration} 回合`);
            }
        }
    }

    save() {return this.rec.save();}

    load()
    {
        let roleD = DB.role(this.id);
        this.role = roleD;
        let data = this._loadData();
        this.rec = new _RoleInit(roleD, data);
        this.equip();
        return this;
    }

    init_prefab()
    {
        if(!super.init_prefab()){return false;}
        this._registerTimeManager();
        return true;
    }

    init_runtime(id,modify=false)
    {
        this._registerTimeManager();

        this.id = id;
        let roleD = this._initData();

        // console.log(roleD)
        
        this._shape = new _Shape(this.scene, roleD);
        this.add(this._shape);

        this._skill = new _Skill(this);
        this._anim = new _Anim(this); 
        this._action = new _Action(this);
        this._path = new _Path(this);
        this._disp = new _Disp(this);

        this._addSprite(roleD.sprite);
        this.addListener();
        this.pos = this._getUnoccupiedPos(this.pos);   // 檢查this.pos 這個點是否被佔用，如果被佔用，則尋找一個可用的點
        this._addPhysics();
        this._addGrid();
        this._setAnchor(modify);
        this._updateDepth();
        this._addWeight();
        this._addToObjects();
        // this._debugDraw('zone')
        return this;
    }

    destroy()
    {
        // 強制清除 timeout()，避免離開場景時，觸發 timeout，導致錯誤
        if (this._to) {clearTimeout(this._to);this._to=null;}
        super.destroy();
    }

    equip()
    {
        this._removeLight();
        this._shape?.removeEquips();

        // console.log(`${this.id}-------------------------------${this.rec.equips}`)
        this.rec.equips.forEach((equip)=>{
            if(equip && equip.id)
            {
                let item = DB.item(equip.id);
                this._shape?.addEquip(item);
                if(item.light) {this._addLight();}
            }
        })

        // this.sortParts()

        this.getTotalStats();

        if(this.isPlayer) {this._send('refresh');}
    }

    isInteractive(ent) {return this.state != GM.ST_SLEEP || this.parentContainer === ent;}

    // 跳過這一回合
    next() { this._resume();}

    async execute({pt,ent,act}={})
    {
        if(this.skill.sel)
        {
            // if(this.isInSkillRange(pt??ent.pos))
            if(this.skill.isInRange(pt??ent.pos))
            {
                // this.useSkillTo(pt??ent.pos, ent);
                this.skill.useTo(pt??ent.pos, ent);
            }
        }
        else if( (act===GM.ATTACK && this._isInAttackRange(ent)) ||
            this._checkIsTouch(ent) )
        {
            await this._cmd(ent,act);
            // this.resume();
        }
        else
        {
            this.setDes({pt:pt,ent:ent,act:act});
        }
        
    }

    async process()
    {
        if(this.state!==GM.ST_MOVING)
        {
            // this.tw_idle(true);
            this.anim.idle(true);
            // console.log('[pause-1]')
            await this._pause(); 
            // console.log('[pause-2]')
        }

        switch(this.state)
        {
            case GM.ST_IDLE: break;
            case GM.ST_MOVING:
            case GM.ST_ATTACK:
                console.log('[player] moving');
                await this.st_moving();
                break;
        }
    }

    // TBD
    // getBodiesInRect(range, checkBlock)
    // {
    //     let x = this.x - range * GM.TILE_W;
    //     let y = this.y - range * GM.TILE_H;
    //     let width = 2 * range * GM.TILE_W;
    //     let height = 2 * range * GM.TILE_H;

    //     console.log(x,y,width,height,range)
    //     let includeDynamic = true;
    //     let includeStatic = false;
    //     let bodies = this.scene.physics.overlapRect(x, y, width, height, includeDynamic, includeStatic);
    //     bodies = bodies.filter(body=>{
    //         if(body.gameObject===this) {return false;}
    //         if(checkBlock)
    //         {
    //             let hits = Utility.raycast(this.x,this.y,body.x,body.y,[this.scene.staGroup])
    //             return hits.length===0;
    //         }
    //         return true;
    //     })
    //     return bodies;
    // }

    // getEffects()
    // {
    //     return this.rec.activeEffects;
    // }

}

export class Target extends Role
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.weight=0;
        this._drawPath = true;
        this._addSprite();
        this._updateDepth();
        //this.loop();
        this._debugDraw();
        
    }

    get isPlayer() {return true;}

    _addSprite()
    {
        let [key,frame]=ICON_TARGET.split('/');
        this._sp = this.scene.add.sprite(0,0,key,frame);
        this._sp.setPipeline('Light2D');
        this.add(this._sp);
        this.displayWidth = GM.TILE_W;
        this.displayHeight = GM.TILE_H;
    }

    _updateDepth()
    {
        this.setDepth(Infinity);
    }

    init_runtime(id)
    {
        this.id=id;
        return this;
    }
}

export class Avatar extends Role
{
    static instance;
    get acts() {return ['inv','profile'];}
    constructor(scene, x, y)
    {
        super(scene,x,y);
        Avatar.instance = this;
        this.weight = 1000;
        this._drawPath = true;
    }

    get isPlayer() {return true;}

    // async speak(value){}

    addListener()
    {
        super.addListener();
        this.on('talk',(resolve)=>{this.talk();resolve()})
        this.on('attack',(resolve,attacker)=>{this.hurt(attacker,resolve);})
    }

    _dead(attacker)
    {
        this._send('gameover');
        super._dead(attacker);
    }
}


class _Schedule
{
    constructor(role)
    {
        this._role = role;
        this._init();
    }

    _init()
    {
        this._setSchedule();
        this.update(true)
    }

    _setSchedule()
    {
        if(!this._role.role.schedule) {return;}
        // this.schedule = this.role.schedule[this.mapName];
        this._schedule = this._role.role.schedule?.filter(sh=>sh.map===this._role.mapName);
        console.log(this._schedule)
    }
    
    _setStartPos(ents,tSch)
    {
        if(!this._role.rec.exit && ents.length===1)
        {
            // 如果已經到達目的地，回傳 false( next = false，直接執行動作，不需等下一輪)
            return false;
        }
        else
        {
            console.log(this._role.scene.mapName);

            let ent = ents.at(-1);

            // 1. 取得路徑
            let rst = this._role.scene.map.getPath(this._role.pos, ent.pts);

            // 2. 取得進入時間
            let ts = this._role.rec.exit && this._role.rec.exit.map===this._role.scene.mapName ? this._role.rec.exit.t : tSch.split('~')[0];

            // 3. 計算時間差
            let td = TimeManager.ticks - TimeManager.time2Ticks(ts) - 1;

            // 4. 計算位置
            let i = td <= rst.path.length-1 ? td : rst.path.length-1;
            console.log('[setStartPos]', td, rst.path.length, i);
            this._role._removeWeight();
            // i < 0，表示在初始點
            this._role.pos = i<0 ? this._role.pos : rst.path[i];
            this._role._addWeight();
            this._role._updateDepth();

            // 檢查是否達目的地，如果是，回傳 false( next = false，直接執行動作，不需等下一輪)
            // i = rst.path.length-1 ，代表到達目的地
            return i != rst.path.length-1;
        }
    }

    _toEnts(p)
    {
        return p.split('~').map(id=>this._role.scene.ents[id])
    }

    _findSchedule()
    {
        let found = this._schedule.find((sh)=>{return TimeManager.inRange(sh.t);})
        if(!found && this._role.rec.exit)
        {
            if(this._role.rec.exit.map===this._role.mapName && this._role.rec.exit.t.d===TimeManager.time.d)
            {
                found = this._schedule.find(sh=>sh.i===this._role.rec.exit.sh.i+1);
            }
        }
        return found;
    }

    // public

    update(init=false)
    {
        console.log('--------------- update',init);
        // ST_IDLE 或 ST_SLEEP，才檢查 schedule
        if(this._role.state != GM.ST_IDLE && this._role.state != GM.ST_SLEEP) {return;}
 
        if(this._schedule)
        { 
            console.log('--------------- chk1',this._schedule);
            let found = this._findSchedule();
            if(found)
            {
                console.log(`[npc ${this._role.id}] updateSchedule`); 

                // 1. 檢查是否第一次進入 found 這個 schedule，
                if(found != this._shCurrent)    
                {
                    this._shCurrent = found;
                    this._shLatency = GM.SH_LATENCY;
                }

                // 2. 取得 起始、目標 地點
                let ents = this._toEnts(found.p);

                if(init)    // 初始化
                {
                    // 1. 如果 npc 正在睡覺，則叫醒
                    if(this.state == GM.ST_SLEEP) {ents[0].wake();}

                    // 2. 根據時間，計算起始位置
                    let next = this._setStartPos(ents,found.t);

                    // 3. 執行 schedule, 將 next 設成 true，進到 ST_NEXT，會等一輪再執行
                    this._role.setDes({ent:ents.at(-1), next:next});

                }
                else    // 如果不是初始化，則檢查是否已經到達目標
                {
                    // 1. 如果已達目的地，則離開
                    if(ents.at(-1).isAt(this._role)) {this._shLatency = 0; return;}

                    // 2. 檢查延遲
                     console.log(`[npc ${this._role.id}] latency:`,this._shLatency);
                    if(this._shLatency >= GM.SH_LATENCY) {this._shLatency=0;}
                    else {this._shLatency++; return;}

                    // 3. 如果 npc 正在睡覺，則叫醒，並將 next 設成 true，(起床後，等一輪再執行)
                    let next = false;
                    if(this._role.state == GM.ST_SLEEP) {this._role.wake(); next=true;}

                    // 4. 執行 schedule
                    this._role.setDes({ent:ents.at(-1), next:next});
                }

            }
        }
    }

}

export class Npc extends Role
{
    get acts() {return this.state != GM.ST_ATTACK ? ['talk','trade','observe','attack']
                                            : ['attack','observe'];}           

    ///////////////////////////////////////////////////////
    // private
    ///////////////////////////////////////////////////////                        
    _saveData(value)
    {
        if(this.uid==-1)
        {
            if(!Record.data.roles) {Record.data.roles={};}
            Record.data.roles[this.id]=value;
        }
        else
        {
            super._saveData(value);
        }

    }

    _save() {this._saveData(this.rec.save());}

    _debugDraw(type,text)
    {
        super._debugDraw(type,text);
        if(type === GM.DBG_CLR) 
        {
            dbg_hover_npc = false;
            this.disp.drawPath(null);
        }
        else 
        {
            dbg_hover_npc = true;
            this.disp.drawPath(this._path);
        }
    }

    _updateSchedule() {this._sch?.update();}

    async _updateTime(dt)
    {
        // this.updateSchedule();
        this._updateSchedule();
        this._updateStates();
        this._applyEffects();
        this.getTotalStats();
        await this.disp.wait();
    }

    /////////////////////////////////////////////////
    // public
    /////////////////////////////////////////////////
    addListener()
    {
        super.addListener();
        this.on('talk',(resolve)=>{this.talk();resolve();})
            .on('trade',(resolve,target)=>{this.trade(target);resolve();})
            .on('attack',(resolve,attacker)=>{this.hurt(attacker,resolve);})
    }

    init_prefab()
    {
        this._initData();
        if(!super.init_prefab()) {return false;}
        
        this._addToRoleList();
        this.load();
        return true;
    }

    init_runtime(id,modify=false)
    {
        this._addToRoleList();
        return super.init_runtime(id,modify);
    }

    initSchedule() {this._sch = new _Schedule(this);}

    interact(ent, act) 
    {
        if(act == GM.ENTER) 
        {
            // this.exit();
            this._removed();

            // npc 離開時，將目的地的 map、port、當前時間、當前 shedule 存入 status.exit，
            // 用來檢查 npc 是否要顯示及其正確的位置
            let exit = {map:ent.map, port:ent.port, t:TimeManager.time, sh:this._shCurrent};
            // TimeManager.time、this._shCurrent 是物件，要用 Utility.deepClone，
            // 把當下的 TimeManager.time、this._shCurrent 的值複製一份，
            // 否則在下一輪 TimeManager.time 會變成當前時間，this._shCurrent 也可能指向其他 shedule
            this.rec.exit = Utility.deepClone(exit);
            this._save();    // 只是把 Record.data.roles[id] 指向 this.status，還未真正存檔
        }
        else {super.interact(ent, act);}
    }

    // 回補商品
    restock()
    {
        if(!this.rec.restock)
        {
            this.rec.restock = TimeManager.time.d + 2;
        }

        if(TimeManager.time.d >= this.rec.restock)
        {
            let roleD = RoleDB.get(this.id);
            this.rec.restock = TimeManager.time.d + 2;
            this.rec.bag = Utility.toStorage(roleD.bag.capacity,roleD.bag.items);
        }
    }

    talk() 
    {
        this.dialog = DB.dialog(this.id);
        this._send('talk',this);
    }

    stopTrade() // call by UiTrade.close()
    {
        delete this.tradeType;
        delete this._target.tradeType;
    }

    trade(target)
    {
        this.restock();
        this._target = target;
        this.tradeType = GM.SELLER;
        target.tradeType = GM.BUYER;
        this._send('trade',this);
    }

    isEquipWeapon()
    {
        let weapon = this.rec.equips.find((equip)=>{
                        let dat = DB.item(equip.id);
                        return dat.cat===GM.CAT_WEAPON;
                    });
        return weapon != undefined;
    }

    equipWeapon()
    {
        if(this.role.weapon && !this.isEquipWeapon())
        {
            this.rec.equips.push({id:this.role.weapon,count:1});
            this.equip();
        }
    }

    unEquipWeapon()
    {
        this.rec.equips.find((equip,i)=>{
            let dat = DB.item(equip.id);
            if(dat.cat===GM.CAT_WEAPON)
            {
                this.rec.equips.splice(i, 1);
                this.equip();
                return true;
            }
        });
    }

    takeDamage(dmg, attacker) 
    {
        super.takeDamage(dmg);

        if(this.state!==GM.ST_DEATH && attacker)
        {
            if(this.state === GM.ST_IDLE) {this.equipWeapon();}
            this.state = GM.ST_ATTACK;
            this._ent = attacker;
            this._act = GM.ATTACK;
        }
    }

    async process()
    {
        // console.log(`[${this.scene.roles.indexOf(this)}]`,this.state);
        
        switch(this.state)
        {            
            case GM.ST_IDLE: this.st_idle(); break;

            case GM.ST_NEXT:
                // console.log(`[npc ${this.id}] next`);
                this.state = GM.ST_MOVING;
                break;

            case GM.ST_MOVING:
                // console.log(`[npc ${this.id}] moving`);
                await this.st_moving();
                break;

            case GM.ST_ATTACK:
                // console.log(`[npc ${this.id}] attack`);
                await this.st_attack();
                break;
        }

        // this.tw_idle(true);
        this.anim.idle(true)
        
    }

    async st_attack()
    {
        if( this._isInAttackRange(this._ent) )
        {
            await this._cmd(this._ent,this._act);
        }
        else
        {
            this.setDes({ent:this._ent, act:this._act})
            await this.st_moving();
        }
    }

    st_idle() {}

    dbgRect(range)
    {
        if(!this._dbgGraphics) {this._dbgGraphics = this.scene.add.graphics();}
        this._dbgGraphics.lineStyle(2, 0xff0000, 1);
        let rect = new Phaser.Geom.Rectangle(
                        this.x-range*GM.TILE_W, this.y-range*GM.TILE_H, 
                        2*range*GM.TILE_W, 2*range*GM.TILE_H);
        this._dbgGraphics.strokeRectShape(rect);
    }

    isDetect(range=5)
    {
        this.dbgRect(range);
        let pos = getPlayer()?.pos;
        if(pos)
        {
            return Math.abs(this.pos.x-pos.x) <= range*GM.TILE_W &&
                    Math.abs(this.pos.y-pos.y) <= range*GM.TILE_H;
        }
        return false;
    }

    // schedule
    // initSchedule()
    // {
    //     this.setSchedule();
    //     this.updateSchedule(true); // 初始化時，init 設成 true
    // }

    // setSchedule()
    // {
    //     if(!this.role.schedule) {return;}
    //     // this.schedule = this.role.schedule[this.mapName];
    //     this.schedule = this.role.schedule?.filter(sh=>sh.map===this.mapName)
    // }

    // setStartPos(ents,tSch)
    // {
    //     if(!this.rec.exit && ents.length===1)
    //     {
    //         // 如果已經到達目的地，回傳 false( next = false，直接執行動作，不需等下一輪)
    //         return false;
    //     }
    //     else
    //     {
    //         console.log(this.scene.mapName);

    //         let ent = ents.at(-1);

    //         // 1. 取得路徑
    //         let rst = this.scene.map.getPath(this.pos, ent.pts);

    //         // 2. 取得進入時間
    //         let ts = this.rec.exit && this.rec.exit.map===this.scene.mapName ? this.rec.exit.t : tSch.split('~')[0];

    //         // 3. 計算時間差
    //         let td = TimeManager.ticks - TimeManager.time2Ticks(ts) - 1;

    //         // 4. 計算位置
    //         let i = td <= rst.path.length-1 ? td : rst.path.length-1;
    //         console.log('[setStartPos]', td, rst.path.length, i);
    //         this._removeWeight();
    //         // i < 0，表示在初始點
    //         this.pos = i<0 ? this.pos : rst.path[i];
    //         this._addWeight();
    //         this._updateDepth();

    //         // 檢查是否達目的地，如果是，回傳 false( next = false，直接執行動作，不需等下一輪)
    //         // i = rst.path.length-1 ，代表到達目的地
    //         return i != rst.path.length-1;
    //     }
    // }

    // findSchedule()
    // {
    //     let found = this.schedule.find((sh)=>{return TimeManager.inRange(sh.t);})
    //     if(!found && this.rec.exit)
    //     {
    //         if(this.rec.exit.map===this.mapName && this.rec.exit.t.d===TimeManager.time.d)
    //         {
    //             found = this.schedule.find(sh=>sh.i===this.rec.exit.sh.i+1);
    //         }
    //     }
    //     return found;
    // }

    // updateSchedule(init=false)
    // {
    //     // ST_IDLE 或 ST_SLEEP，才檢查 schedule
    //     if(this.state != GM.ST_IDLE && this.state != GM.ST_SLEEP) {return;}
 
    //     if(this.schedule)
    //     { 
    //         let found = this.findSchedule();
    //         if(found)
    //         {
    //             console.log(`[npc ${this.id}] updateSchedule`); 

    //             // 1. 檢查是否第一次進入 found 這個 schedule，
    //             if(found != this._shCurrent)    
    //             {
    //                 this._shCurrent = found;
    //                 this._shLatency = GM.SH_LATENCY;
    //             }

    //             // 2. 取得 起始、目標 地點
    //             let ents = this.toEnts(found.p);

    //             if(init)    // 初始化
    //             {
    //                 // 1. 如果 npc 正在睡覺，則叫醒
    //                 if(this.state == GM.ST_SLEEP) {ents[0].wake();}

    //                 // 2. 根據時間，計算起始位置
    //                 let next = this.setStartPos(ents,found.t);

    //                 // 3. 執行 schedule, 將 next 設成 true，進到 ST_NEXT，會等一輪再執行
    //                 this.setDes({ent:ents.at(-1), next:next});

    //             }
    //             else    // 如果不是初始化，則檢查是否已經到達目標
    //             {
    //                 // 1. 如果已達目的地，則離開
    //                 if(ents.at(-1).isAt(this)) {this._shLatency = 0; return;}

    //                 // 2. 檢查延遲
    //                  console.log(`[npc ${this.id}] latency:`,this._shLatency);
    //                 if(this._shLatency >= GM.SH_LATENCY) {this._shLatency=0;}
    //                 else {this._shLatency++; return;}

    //                 // 3. 如果 npc 正在睡覺，則叫醒，並將 next 設成 true，(起床後，等一輪再執行)
    //                 let next = false;
    //                 if(this.state == GM.ST_SLEEP) {this.wake(); next=true;}

    //                 // 4. 執行 schedule
    //                 this.setDes({ent:ents.at(-1), next:next});
    //             }

    //         }
    //     }
    // }

    // toEnts(p)
    // {
    //     return p.split('~').map(id=>this.scene.ents[id])
    // }
}


export class Enemy extends Npc
{

    setTexture(key, frame) {}   // map.createFromObjects 會呼叫到，此時 anchorX, anchorY 還沒被設定 

    st_idle()
    {
        if(this.isDetect())
        {
            this.disp.speak('‼️');
            this.attack(getPlayer());
        }
    }

    
    init_prefab()
    {
        console.log('----------------------',this.uid,this.qid)
        let data = this._loadData();
        if(!data?.removed)
        {
            this.init_runtime(this.id,true).load();
        }
        return true;
    }
}

