import Phaser, { Time } from 'phaser';
//import {RoleDB, ItemDB, RoleData, CardDB} from './database.js';
//import {ItemDrop} from './item.js';
//import {ProgressBar, BuffBar, Buff, Shield, BuffInfo, Flag} from './gameUi.js';
//import {Gun, Melee} from './weapon.js';
import Utility from './utility.js';
//import Battle from './battle.js';
import Record from './record';
//import {Container} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
//import Ctrl from './ctrl.js';
import {Entity,Pickup,Door, Projectile} from './entity.js';
import {RoleDB,DialogDB,ItemDB} from './database.js';
import DB from './db.js';
import {text,bbcText,rect} from './uibase.js';
import {GM, ROLE_ATTRS} from './setting.js';
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

class Corpse extends Phaser.GameObjects.Container
{
    constructor(scene, x, y, id)
    {
        super(scene, x, y);
        scene.add.existing(this);
        this.scene = scene;
        let data = DB.role(id);
        this.addSprite(data)
            .addTweens()
    }

    addSprite(data)
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

    get storage()   {return this.status.bag;}

    get state()     {return this._state;}
    set state(value) {this._state=value;}

    get states() {return this.status.states;}


    get msg_name() {return `[weight=900]${this.id.lab()}[/weight] `}


    addPhysics()
    {
        super.addPhysics();
        this.scene.phyGroup.add(this);
    }

    addSprite(sprite)
    {
        if(!sprite) {return;}
        let [key,frame]=sprite.split('/');
        this.setTexture(key,frame);
    }

    initData()
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

    init_prefab()
    {
        if(!super.init_prefab()){return false;}
        this.registerTimeManager();
        return true;
    }

    addShape(roleD)
    {
        // 將 _shape 定位在 container 的底部
        this._shape = new Phaser.GameObjects.Container(this.scene, 0, roleD.anchor.y);
        this.add(this._shape);
        if(roleD.body) {this.addPart(roleD.body, GM.PART_BODY);}
        if(roleD.head) {this.addPart(roleD.head, GM.PART_HEAD);}
        if(roleD.hand) {this.addPart(roleD.hand, GM.PART_HAND);}
    }

    addPart(part, type)
    {
        if(!this._shape) {return;}

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
                this._shape.add(sp);
                sps.push(sp);
            }
        }

        let sps = [];
        addSp(part.sprite, getDepth(type));
        addSp(part.ext, 6);
        return sps;
    }

    sortParts()
    {
        if(!this._shape) {return;}
        let children = this._shape.getAll().sort((a, b) => a.depth - b.depth);
        children.forEach(child => {this._shape.bringToTop(child);});
    }

    init_runtime(id,modify=false)
    {
        this.registerTimeManager();

        this.id = id;
        let roleD = this.initData();

        // console.log(roleD)
        
        this.addShape(roleD);
        this.addSprite(roleD.sprite);
        this.addListener();
        this.pos = this.getPos(this.pos);   // 檢查this.pos 這個點是否被佔用，如果被佔用，則尋找一個可用的點
        this.addPhysics();
        this.addGrid();
        this.setAnchor(modify);
        this.updateDepth();
        this.addWeight();
        this.addToObjects();
        // this.debugDraw('zone')
        return this;
    }

    loadData()
    {
        if(this.isPlayer) {return Record.data.player;}
        else if(this.uid==-1) {return Record.data.roles?.[this.id];}
        else {return super.loadData();}
    }

    initAttrs(data)
    {
        let attrs = Utility.deepClone(data);
        for (let [key, value] of Object.entries(ROLE_ATTRS)) 
        {
            if(!(key in attrs)) {attrs[key] = value;}
        }
        return attrs;
    }

    initStates(data) 
    {
        let states = Utility.deepClone(data);
        return states;
    }

    initEquips(data) {return data ? data.map(id=>({id:id, count:1})): [];}

    initStatus(roleD)
    {
        return {
            gold: roleD.gold??0, 
            bag: this.toStorage(roleD.bag?.capacity,roleD.bag?.items),
            equips: this.initEquips(roleD.equips),
            // attrs: this.initAttrs(roleD.attrs),
            states: this.initStates(roleD.states),
            skillSlots: this.initSkillSlots(),
            skills: this.initSkills(),
            buffs: this.initBuffs(),
        }
    }

    initSkillSlots()
    {
        // return ['lunge','fireball'];
        return [];
    }

    initSkills()
    {
        // return {'lunge':{en:false, cd:0}, 
        //         'fireball':{en:true, cd:0},
        //         'lightning':{en:false, cd:0}};
        return {};
    }

    initBuffs()
    {
        return [];
    }

    load()
    {
        let roleD = DB.role(this.id);
        this.role = roleD;
        let data = this.loadData();
        this.status = data ?? this.initStatus(roleD);
        this.equip();
        // this.calcSkills();
        return this;
    }

    
    save() {return this.status;}

    addLight()
    {
        if(!this.light)
        {
            let a = this.scene.lights.ambientColor;
            this.light = this.scene.lights.addLight(0, 0, 300).setIntensity(GM.LIGHT-a.r);
            this.light.x = this.x;
            this.light.y = this.y;
        }
    }

    removeLight()
    {
        if(this.light)
        {
            this.scene.lights.removeLight(this.light);
            this.light = null;
        }
    }

    addToRoleList() {this.scene.roles.push(this);}

    removeFromRoleList() 
    {
        console.log(this.id,'remove role')
        const index = this.scene.roles.indexOf(this);
        if (index > -1) {this.scene.roles.splice(index, 1);}
    }

    stepMove(h,v)
    {
        let rst = this.scene.map.stepMove(this.pos,h,v);
        if(rst.state>0)
        {
            this._path = rst.path;
            this.state = GM.ST_MOVING;
            this._ent = null;
            this._act = '';
            this.resume();
        }
    }

    tw_idle(on)
    {
        if(!this._shape){return;}   // 判斷 this._shape ，以避免在地圖上出錯
        if(on)   
        {
            if(!this._twIdle)
            {
                this._twIdle = this.scene.tweens.add({
                        targets: this._shape,
                        y: {from:this.max.y, to:this.max.y-1.5},
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

    tw_walk(duration)
    {
        this.scene.tweens.add({
            targets: this._shape,
            y: {from:this.max.y, to:this.max.y-5},
            ease:'quint.in',
            duration: duration,
            yoyo: true,  
        });
    }

    setDes({pt, ent, act, next=false}={})
    {
        let pts = ent?.pts ?? [pt];
        let rst = this.scene.map.getPath(this.pos, pts);
        console.log('setDes',rst,act)
        if(rst?.state>0)
        {
            console.log('chk---')
            this._path = rst.path;
            this._ent = ent;
            // this._act = act ?? ent?.act ?? '';
            this._act = act;

            this.state = next ? GM.ST_NEXT : GM.ST_MOVING;

            if(this.isPlayer) 
            {
                this.send('clearpath');
                this.resume();
            }
        }        
    }

    faceTo(pt)
    {
        if(pt.x==this.x) {return;}
        if(this._sp) {this._sp.flipX = (pt.x>this.x) != this._faceR;}
        if(this._shape) {this._shape.scaleX = (pt.x>this.x) != this._faceR ? -1 : 1;}
    }

    isInteractive(ent)
    {
        return this.state != GM.ST_SLEEP || this.parentContainer == ent;
    }

    checkIsTouch(ent)
    {
        // if(ent && this.parentContainer == ent) {return true;}
        // return !ent ? false : this.scene.map.isNearby(ent,this.pos);
        return !ent ? false : ent.isTouch(this);
    }

    async moveTo(pt,{duration=200,ease='expo.in'}={})
    {
        this.faceTo(pt);
        this.removeWeight();
        this.addWeight(pt);
        this.tw_idle(false);
        this.tw_walk(duration/2);
        await this.step(pt,duration,ease,{onUpdate:this.setLightPos.bind(this)});
        //this.addWeight();
        this.updateDepth();
    }

    closeDoorWhenLeave(pt,w)
    {
        // 是否離開門，如果是，關門
        if(this._preW==GM.W_DOOR && w!=GM.W_DOOR)    // exit door
        {
            let bodys = this.scene.physics.overlapCirc(this._prePt.x,this._prePt.y,0,true,true);
            this.interact(bodys[0]?.gameObject,GM.CLOSE_DOOR);
        }
        this._preW = w;
        this._prePt = pt;  
    }

    async openDoorIfNeed(pt)
    {
        let bodys = this.scene.physics.overlapCirc(pt.x,pt.y,0,true,true);
        let ent = bodys[0]?.gameObject;

        // 如果是門，則打開
        if (ent && ent instanceof Door && !ent.opened) 
        {
            await this.interact(ent, GM.OPEN_DOOR);
            return true;
        }
        return false;
    }

    async st_moving(repath=true)
    {
        let path = this._path;

        // 判斷是否接觸目標      
        if(this.checkIsTouch(this._ent))
        {
            this.clearPath();
            await this.action();
            return;
        }
        else
        {
            console.log('[move]',path.length)
            if(path.length==0)
            {
                console.log('[stop]')
                this.stop();
                return;
            }

            // 取出路徑
            let pt = path[0];
            let w = this.scene.map.getWeight(pt);

            // 判斷是否可行走
            if(w < GM.W_BLOCK)    
            {
                await this.moveTo(pt);  // 移至 pt
                path.shift();           // 移除陣列第一個元素
                
                if(this.isPlayer) 
                {
                    // state = GM.ST_MOVING 時，才 drawPath()，
                    // 避免移動到一半，點選地圖，呼叫 stop() clearPath()後，還 drawPath()
                    if(this.state===GM.ST_MOVING) {this.drawPath(path);} 
                }
                else // npc
                {
                    this.closeDoorWhenLeave(pt,w);
                }

                if(path.length==0)
                {
                    let act = this._act ?? this._ent?.act;
                    
                    if(!act) {this.stop(); console.log('[reach]')}
                    else {this.clearPath();}
                }
                return;
            }
            else
            {
                if(this.isPlayer)   // for player
                {
                    this.stop();
                    return;
                }
                else                // for npc
                {
                    if(await this.openDoorIfNeed(pt))
                    {
                        return;
                    }
                    else if(repath)     // 重新找路徑
                    {
                        this.setDes({ent:this._ent, act:this._act});
                        if(await this.st_moving(false))
                        {
                            this.speak('操...給老子滾開...💢');
                        }

                        return;
                    }
                    return true;
                }
            }
        }
    }

    


    action_atk()
    {
        if(this.status.attrs[GM.P_RANGE]>1)
        {
            return new Promise((resolve)=>{
                new Projectile(this.scene, this.x, this.y, 'arrow', 0.25)
                    .shoot(this._ent.x, this._ent.y, 
                        async ()=>{
                            await this.interact(this._ent, this._act);
                            resolve();
                        });
            })
        }
        else
        {
             return this.step( this._ent.pos, 200, 'expo.in',
                            {yoyo:true, onYoyo:async ()=>{await this.interact(this._ent, this._act);}} ); 
        }
    }

    async action()
    {
        // if(!this._act) {return;}

        if(this._ent) {this.faceTo(this._ent.pos);}

        let act = this._act??this._ent?.act;

        if(this.isPlayer) {console.log(`[player] action : ${act}`);}
        else {console.log(`[npc ${this.id}] action : ${act}`);}
        
        if(act===GM.ATTACK)
        {
            this.state = GM.ST_ATTACK;
            // await this.step( this._ent.pos, 200, 'expo.in',
            //                 {yoyo:true, onYoyo:async ()=>{await this.interact(this._ent,act);}} ); 
            await this.action_atk();
        }
        else
        {
            this.state = GM.ST_IDLE;
            await this.interact(this._ent,act);
        }

        // this._act = null;
        // this._ent = null;
    }

    next()
    {
        this.resume();
    }

    clearPath()
    {
        this._path = [];
        if(this._dbgPath){this._dbgPath.clear();}
    }

    stop()
    {
        this.state = GM.ST_IDLE;
        this.clearPath();
    }

    step(pos, duration, ease, {yoyo=false, onYoyo, onUpdate, onComplete}={})
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

    // interact(pt, act)
    // {
    //     let bodys = this.scene.physics.overlapCirc(pt.x, pt.y, 5, true, true);
    //     bodys.forEach((body) => {body.gameObject.emit(act, this.owner);});
    // }

    async interact(ent, act) 
    {
        if(!act) {return;}
        return new Promise((resolve)=>{ent.emit(act, resolve, this);});
    }

    async pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    resume() {this._resolve?.();this._resolve=null;}

    isInRange(ent)
    {
        let range = this.status.attrs[GM.P_RANGE];
        console.log(range)
        let [tx1, ty1] = this.scene.map.worldToTile(this.x,this.y);
        let [tx2, ty2] = this.scene.map.worldToTile(ent.x,ent.y);
        let dx = Math.abs(tx1 - tx2);
        let dy = Math.abs(ty1 - ty2);
        return dx <= range && dy <= range;
    }


    async attack(ent)
    {
        console.log('attack')   
        this._ent = ent;
        this._act = GM.ATTACK;

        if(this.isPlayer)
        {
            if(this.isInRange(ent))
            {
                await this.action();
                this.resume();
            }
            else
            {
                let rst = this.scene.map.getPath(this.pos, this._ent.pts);
                if(rst?.state > 0)    // 找到路徑
                {
                    await this.moveTo(rst.path[0]);  // 移至 pt  
                    this.resume();   
                }        
            }
        }    
        else
        {
            this.state = GM.ST_ATTACK;
            this._ent = ent;
            this._act = GM.ATTACK;
        }
        
    }


    async hurt(attacker,resolve)
    {
        let rst = this.calc(attacker);
        switch(rst.state)
        {
            case 'hit':
                this.disp(-rst.dmg,GM.COLOR_GREEN);
                this._shape.getAll().forEach(child => {child.setTint(0xff0000);});
                await Utility.delay(150);
                this._shape.getAll().forEach(child => {child.setTint(0xffffff);});
                break;
            case 'dodge':
                this.disp('dodge'.local(),GM.COLOR_GREEN);
                await Utility.delay(150);
                break;
            case 'block':
                this.disp('block'.local(),GM.COLOR_GREEN);
                await Utility.delay(150);
                break;
        }
       
        if(this.getState(GM.P_LIFE).cur<=0)
        {
            this.dead(attacker);
        }
        else
        {
            if(Utility.roll()<50) {this.speak('操');}
        }
        resolve?.();
    }

    // calc(attacker)
    // {
    //     // console.log(attacker)
    //     let dmg = attacker.status.attrs.attack;
    //     let life = this.status.states.life.cur;
    //     let defense = this.status.attrs.defense ?? 0;
    //     let dodge = this.status.attrs.dodge ?? 0;
    //     let block = this.status.attrs.block ?? 0;
    //     //console.log(this.status.attrs,defense)
    //     if(Utility.roll()<dodge) { return {state:'dodge'}  }
    //     if(Utility.roll()<block) { return {state:'block'}  }

    //     dmg = Math.max(0, dmg-defense);
    //     life -= dmg;

    //     this.status.states.life.cur = life;
    //     if(this.isPlayer) {this.send('refresh');}
    //     return {state:'hit',dmg:dmg};
    // }

    calc(attacker)
    {
        // console.log(attacker)
        let dmg = attacker.getAttr('attack',0);
        let life = this.getState('life').cur;
        let defense = this.getAttr('defense',0)
        let dodge = this.getAttr('dodge',0);
        let block = this.getAttr('block',0);
        //console.log(this.status.attrs,defense)
        if(Utility.roll()<dodge) { return {state:'dodge'}  }
        if(Utility.roll()<block) { return {state:'block'}  }

        dmg = Math.max(0, dmg-defense);
        // this.status.states.life.cur = life;
        this.setState('life', life-dmg)
        if(this.isPlayer) {this.send('refresh');}
        return {state:'hit',dmg:dmg};
    }

    looties()
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

    checkQuest()
    {
        // let qid = this.data?.get('qid');
        let qid = this.qid;
        // console.log(qid)
        if(qid) {QuestManager.check(qid,{type:GM.KILL,id:this.id});}
    }

    dead(attacker)
    {
        if(attacker) {this.send('msg', `${attacker.id.lab()} ${'_kill'.lab()} ${this.id.lab()}`);}
        else {this.send('msg', `${this.id.lab()} ${'_die'.lab()}`);}
        this.looties();
        new Corpse(this.scene, this.x, this.y, this.id);
        this.checkQuest();
        this.removed(); 
    }

    removed()
    {
        // 不可以放到 destroy()，離開場景時，如果呼叫 removeWeight() 會出現錯誤，
        // 因為此時 this.scene.map 已經移除了
        this.removeWeight();
        this.removeFromRoleList();
        this.unregisterTimeManager();

        super.removed();
    }

    destroy()
    {
        // 強制清除 timeout()，避免離開場景時，觸發 timeout，導致錯誤
        if (this._to) {clearTimeout(this._to);this._to=null;}
        
        super.destroy();
    }

    speak(words, {duration=1000,tween=false}={})
    {
        if(!this._speak)
        {
            this._speak = this.scene.rexUI.add.sizer(0,-48,{space:5});
            this._speak.addBackground(rect(this.scene,{color:GM.COLOR_WHITE,radius:10,strokeColor:0x0,strokeWidth:0}))
                        .add(text(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
                        .setOrigin(0.5,1);
            this.add(this._speak);
            this.sort('depth')
        }

        if(tween)
        {
            this._speak.tw = this.scene.tweens.add({
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

    disp(value,color=GM.COLOR_RED)
    {
        if(!this._disp)
        {
            this._disp = text(this.scene,{stroke:'#000',strokeThickness:5});
            this.add(this._disp);
            this._disp.setDepth(100);
        }

        this._disp.setText(value).setTint(color);
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this._disp,
                x: 0,
                y: {from:-48, to:-64},
                duration: 200,
                ease: 'linear',
                onStart: ()=>{this._disp.visible=true;},
                onComplete: (tween, targets, gameObject)=>{resolve();this._disp.visible=false}         
            });
        });

    }

    removeEquip(equip)
    {
        let index = this.status.equips.indexOf(equip);
        if(index>=0)
        {
            this.status.equips[index] = null;
            this.equip();
        }
    }

    addEquip(item)
    {
        if(!this._shape) {return;}
        if(!item.equip) {return;}
        let sps = this.addPart(item.equip, item.cat);
        if(!this.equips) {this.equips=[];}
        this.equips.push(...sps);
    }

    removeEquip()
    {
        if(!this.equips) {return;}
        this.equips.forEach((equip)=>{equip.destroy();})
        this.equips=[];
    }

    attrs(key)
    {
        if(!(key in this.status.attrs)) {this.status.attrs[key]=0;}
        return this.status.attrs[key];
    }

    setAttrs(key, value)
    {
        this.status.attrs[key] = value
    }

    addAttrs(key, value)
    {
        this.status.attrs[key] = this.attrs(key)+value;
    }

    getAttr(prop, def=undefined)
    {
        let value = this.role.attrs?.[prop];
        if(value===undefined) {return def;}
        value += this.fromSkill(prop)
        value += this.fromEquip(prop)
        value += this.fromBuff(prop)
        return value;
        
    }

    getState(prop)
    {
        if(this.status.states[prop]===undefined) {return;}
        let cur = this.status.states[prop];
        let max = this.getAttr(prop+'Max')
        if(max) 
        {
            if(cur>max){this.status.states[prop]=max;cur=max;}
            return {cur:cur,max:max};
        }
        else {return {cur:cur,den:100};}
    }

    setState(prop, value)
    {
        if(this.status.states[prop]===undefined) {return;}
        let max = this.getAttr(prop+'Max') ?? 100;
        this.status.states[prop] = Utility.clamp(value,0,max);
    }

    incState(prop, value)
    {
        if(this.status.states[prop]===undefined) {return;}
        let cur = this.getState(prop).cur;
        this.setState(prop,cur+value);
    }

    fromSkill(prop)
    {
        let value = 0;
        Object.keys(this.status.skills).forEach(id=>{
            let skill = DB.skill(id);
            if(skill.type===GM.PASSIVE)
            {
                let val = skill.props?.[prop];
                if(val){value+=val;}
            }
        })
        return value;
    }

    fromEquip(prop)
    {
        let value = 0;
        this.status.equips.forEach((equip)=>{
            if(equip && equip.id)
            {
                let item = DB.item(equip.id);
                let val = item.props?.[prop]
                if(val) {value+=val;}
            }
        })

        return value;
    }

    fromBuff(prop)
    {
        let value=0;
        this.status.buffs.forEach(buff=>{
            let p = buff.effects?.[prop];
            if(p) {value +=p.value;}
        })

        return value;
    }

    processBuffs(dt)
    {
        // this.status.buffs.forEach((buff,i)=>{
        //     for(let [key,p] of Object.entries(buff.effects))
        //     {
        //         p.d--;
        //         console.log(key,p)
        //         if(p.d==0)
        //         {
        //             delete buff.effects[key];
        //         }
        //     }

        //     if(Utility.isEmpty(buff.effects))
        //     {
        //         this.status.buffs.splice(i,1)
        //     }
        // })

        for(let i=0; i<this.status.buffs.length; i++)
        {
            let buff = this.status.buffs[i];
            for(let [key,p] of Object.entries(buff.effects))
            {
                if(--p.d===0) {delete buff.effects[key];}
            }

            if(Utility.isEmpty(buff.effects))
            {
                this.status.buffs.splice(i,1);
                i--;
            }
        }

        console.log(this.status.buffs)
    }

    equip()
    {
        this.status.attrs = this.initAttrs(this.role.attrs);
        this.removeLight();
        this.removeEquip();

        this.status.equips.forEach((equip)=>{
            if(equip && equip.id)
            {
                let item = DB.item(equip.id);

                this.addEquip(item);

                // if(item.props)
                // {
                //     for(let [key,value] of Object.entries(item.props))
                //     {
                //         // console.log(key,value);
                //         switch(key)
                //         {
                //             case GM.P_RANGE:
                //             case GM.P_ATTACK: 
                //                 if(item.cat==GM.CAT_WEAPON) { this.status.attrs[key]=value; }
                //                 else { this.status.attrs[key]+=value; }
                //                 break;
                //             case GM.P_LIFE:
                //                 this.status.states[key].max+=value; break;
                //             default:
                //                 this.status.attrs[key]+=value; break;
                //         }
                //     }
                // }

                if(item.light) {this.addLight();}
            }
        })

        this.sortParts()

        if(this.isPlayer) {this.send('refresh');}
    }

    sell(target, ent, i, isEquip)
    {
        if(target.buy(ent, i, isEquip))
        {
            this.status.gold+=ent.gold;
            return true;
        }
        return false;
    }

    buy(ent, i, isEquip)
    {
        console.log(this.status.gold, ent)
        if(this.status.gold>=ent.gold)
        {
            if(this.take(ent, i, isEquip))
            {
                this.status.gold-=ent.gold;
                if(this == Avatar.instance)
                {
                    this.send('msg',this.msg_name+`${'_buy'.lab()} ${ent.label}`);
                }
                else
                {
                    this.send('msg',Avatar.instance.msg_name+`${'_sell'.lab()} ${ent.label}`)
                }
                return true;
            }
            return false;
        }
        else
        {
            this.send('msg','_not_enough_gold'.lab());
            return false;
        }
    }

    take(ent, i, isEquip)
    {
        if(isEquip)
        {
            this.status.equips[i]=ent.itm; 
            this.equip();
            return true;   
        }
        else
        {
            return super.take(ent, i);
        }
    }

    receive(rewards)
    {
        rewards.forEach((reward)=>{
            console.log(reward.type)
            switch(reward.type)
            {
                case 'gold': this.status.gold+=reward.count; break;
                case 'item': this.putStorage(reward.id, reward.count); break;
            }
        })
       
    }

    use(ent)
    {
        // console.log('use',ent.item);
        let states = this.status.states;
        for(let [key,value] of Object.entries(ent.props))
        {
            switch(key)
            {
                case GM.P_LIFE:
                case GM.P_HUNGER:
                case GM.P_THIRST:
                    this.incState(key,value)
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
        let states = this.status.states;
        if(states.thirst) {states.thirst.cur=0; this.send('msg',this.msg_name+`${'_drink'.lab()}`);}
    }

    sleep(ent)
    {
        this.removeWeight()
        ent.add(this);
        this.pos = {x:ent.sleepX,y:ent.sleepY}
        this.angle = ent.sleepA;
        this._zone.disableInteractive();        
        this.state = GM.ST_SLEEP;
        this.speak('💤',{duration:-1,tween:true});
    }

    // 檢查 p 這個點是否被佔用，如果被佔用，則尋找一個可用的點
    getPos(p)
    {
        if(this.scene.map.getWeight(p)<GM.W_BLOCK) {return p;}
        return this.scene.map.getValidPoint(p,false);
    }

    wake()
    {
        console.log('wake')
        this.speak();
        let ent = this.parentContainer;
        ent.remove(this)
        ent.user = null;
        this.pos = this.getPos(ent.pts[0]);
        this.angle = 0;
        this.addWeight();
        this.updateDepth();
        this._zone.setInteractive();
        this.state = GM.ST_IDLE;
        
    }

   
    drawPath(path)
    {
        if(!this._dbgPath)
        {
            this._dbgPath = this.scene.add.graphics();
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

    async process()
    {
        if(this.state!=GM.ST_MOVING)
        {
            this.tw_idle(true);
            console.log('[pause-1]')
            await this.pause(); 
            console.log('[pause-2]')
        }

        switch(this.state)
        {
            case GM.ST_IDLE: break;
            case GM.ST_MOVING:
                console.log('[player] moving');
                await this.st_moving();
                break;
        }
    }

    registerTimeManager()
    {
        this._updateTimeCallback = this.updateTime.bind(this); // 保存回调函数引用
        TimeManager.register(this._updateTimeCallback);
    }

    unregisterTimeManager()
    {
        TimeManager.unregister(this._updateTimeCallback);
    }

    setLightPos()
    {
        if(this.light)
        {
            this.light.x = this.x;
            this.light.y = this.y;
        }
    }

    setLightInt()
    {
        if(this.light)
        {
            let a = this.scene.lights.ambientColor;
            this.light.intensity = GM.LIGHT - a.r;
        }
    }

    updateTime(dt)
    {
        this.setLightInt();
        this.updateStates(dt);
        this.processBuffs(dt);
        this.status.equips.forEach((equip)=>{
            if(equip && equip.endurance)
            {
                equip.endurance -= dt;
                if(equip.endurance<=0)
                {
                    this.removeEquip(equip);
                }
            }
        })
        Object.values(this.status.skills).forEach((skill)=>{skill.cd>0 && (skill.cd--);});
        if(this.isPlayer) {this.send('refresh');}
    }

    updateStates(dt=1)
    {
        // let states = this.status.states;
        // if(states.hunger) {states.hunger.cur = Math.min(states.hunger.cur+GM.HUNGER_INC*dt,states.hunger.max);}
        // if(states.thirst) {states.thirst.cur = Math.min(states.thirst.cur+GM.THIRST_INC*dt,states.thirst.max);}

        this.incState(GM.P_HUNGER,GM.HUNGER_INC*dt);
        this.incState(GM.P_THIRST,GM.THIRST_INC*dt);
    }

    useSkill(skill) // call by SkillSlot
    {
        skill.st.cd = skill.dat.cd;
        console.log(skill.dat.buff);
        this.status.buffs.push(Utility.deepClone(skill.dat.buff))
        console.log(this.buffs);
        this.status.buffs.forEach(buff=>{
            console.log(buff)
        })
        console.log(this.status.buffs,skill.dat.buff)
        skill.reset();

        this.send('refresh')
    }

    applySkillAt(pos)
    {
        this.faceTo(pos);
        this.skill.st.cd = this.skill.dat.cd;
        return this.step( pos, 200, 'expo.in',
                        {   yoyo:true, 
                            onYoyo:()=>{this.resetSkill(true);}} 
                    );
        
    }

    setSkill(skill)
    {
        this.showRange(true, skill.dat.range);
        this.skill = skill;
        this.state = GM.ST_SKILL;
    }

    unsetSkill()
    {
        this.showRange(false);
        this.skill = null;
        this.state = GM.ST_IDLE;
    }

    resetSkill()
    {
        this.skill.reset();
        this.unsetSkill();
    }

    isInSkillRange(pos)
    {
        let n=DB.skill(this.skill.id).range;
        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                let rect = this.a[y][x];
                if( rect.w===1 && 
                    pos.x>=rect.x && pos.x<rect.x+rect.width &&
                    pos.y>=rect.y && pos.y<rect.y+rect.height)
                {
                    return true
                }
            }
        }

        return false;
    }

    showRange(on,range)
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
                a[y][x] = {x:px-w_2, y:py-h_2, width:w, height:h, w:wei};
            }
        }

        for(let x=0; x<=2*n; x++)
        {
            for(let y=0; y<=2*n; y++)
            {
                a[y][x].l = a[y][x-1]?.w==1 ? false : true;
                a[y][x].r = a[y][x+1]?.w==1 ? false : true;
                a[y][x].t = a[y-1]?.[x]?.w==1 ? false : true;
                a[y][x].b = a[y+1]?.[x]?.w==1 ? false : true;
            }
        }

        for(let y=0; y<=2*n; y++)
        {
            for(let x=0; x<=2*n; x++)
            {
                let rect = a[y][x];
                if(rect.w==1)
                {
                    Utility.drawBlock(this._range, rect);
                }
            }
        }

        this.a=a;
        
    }

    showRange_old(on)
    {
        if(!this._range)
        {
            this._range = this.scene.add.graphics();
        }

        this._range.clear();

        if(on)
        {
            const points = [
                new Phaser.Math.Vector2(this.x-48, this.y-48),
                new Phaser.Math.Vector2(this.x+48, this.y-48),
                new Phaser.Math.Vector2(this.x+48, this.y+48),
                new Phaser.Math.Vector2(this.x-48, this.y+48),
            ];
            Utility.drawPolygon(this._range,points)
        }
    }
}

export class Target extends Role
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.weight=0;
        this._drawPath = true;
        this.addSprite();
        this.updateDepth();
        //this.loop();
        this.debugDraw();
        
    }

    get isPlayer() {return true;}

    addSprite()
    {
        let [key,frame]=ICON_TARGET.split('/');
        this._sp = this.scene.add.sprite(0,0,key,frame);
        this._sp.setPipeline('Light2D');
        this.add(this._sp);
        this.displayWidth = GM.TILE_W;
        this.displayHeight = GM.TILE_H;
    }

    updateDepth()
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

    dead(attacker)
    {
        this.send('gameover');
        super.dead(attacker);
    }

    apply({pt,ent}={})
    {
        if(this.skill)
        {
            if(this.isInSkillRange(pt??ent.pos))
            {
                this.applySkillAt(pt??ent.pos);
            }
        }
        else if(ent?.act===GM.ATTACK)
        {
            this.attack(ent);
        }
        else
        {
            this.setDes({pt:pt,ent:ent});
        }
    }



}

export class Npc extends Role
{
    get acts() {return this.state != GM.ST_ATTACK ? ['talk','trade','observe','attack']
                                            : ['attack','observe'];}           

    init_prefab()
    {
        this.initData();
        if(!super.init_prefab()) {return false;}
        
        this.addToRoleList();
        this.load();
        return true;
    }

   
    init_runtime(id,modify=false)
    {
        this.addToRoleList();
        return super.init_runtime(id,modify);
    }

    initSchedule()
    {
        this.setSchedule();
        this.updateSchedule(true); // 初始化時，init 設成 true
    }

    updateTime(dt)
    {
        this.updateSchedule();
        this.updateStates();
    }

    setSchedule()
    {
        if(!this.role.schedule) {return;}
        // this.schedule = this.role.schedule[this.mapName];
        this.schedule = this.role.schedule?.filter(sh=>sh.map===this.mapName)
    }

    setStartPos(ents,tSch)
    {
        if(!this.status.exit && ents.length===1)
        {
            // 如果已經到達目的地，回傳 false( next = false，直接執行動作，不需等下一輪)
            return false;
        }
        else
        {
            console.log(this.scene.mapName);

            let ent = ents.at(-1);

            // 1. 取得路徑
            let rst = this.scene.map.getPath(this.pos, ent.pts);

            // 2. 取得進入時間
            let ts = this.status.exit && this.status.exit.map===this.scene.mapName ? this.status.exit.t : tSch.split('~')[0];

            // 3. 計算時間差
            let td = TimeManager.ticks - TimeManager.time2Ticks(ts) - 1;

            // 4. 計算位置
            let i = td <= rst.path.length-1 ? td : rst.path.length-1;
            console.log('[setStartPos]', td, rst.path.length, i);
            this.removeWeight();
            // i < 0，表示在初始點
            this.pos = i<0 ? this.pos : rst.path[i];
            this.addWeight();
            this.updateDepth();

            // 檢查是否達目的地，如果是，回傳 false( next = false，直接執行動作，不需等下一輪)
            // i = rst.path.length-1 ，代表到達目的地
            return i != rst.path.length-1;
        }
    }

    findSchedule()
    {
        let found = this.schedule.find((sh)=>{return TimeManager.inRange(sh.t);})
        if(!found && this.status.exit)
        {
            if(this.status.exit.map===this.mapName && this.status.exit.t.d===TimeManager.time.d)
            {
                found = this.schedule.find(sh=>sh.i===this.status.exit.sh.i+1);
            }
        }
        return found;
    }

    updateSchedule(init=false)
    {
        // ST_IDLE 或 ST_SLEEP，才檢查 schedule
        if(this.state != GM.ST_IDLE && this.state != GM.ST_SLEEP) {return;}
 
        if(this.schedule)
        { 
            let found = this.findSchedule();
            if(found)
            {
                console.log(`[npc ${this.id}] updateSchedule`); 

                // 1. 檢查是否第一次進入 found 這個 schedule，
                if(found != this._shCurrent)    
                {
                    this._shCurrent = found;
                    this._shLatency = GM.SH_LATENCY;
                }

                // 2. 取得 起始、目標 地點
                let ents = this.toEnts(found.p);

                if(init)    // 初始化
                {
                    // 1. 如果 npc 正在睡覺，則叫醒
                    if(this.state == GM.ST_SLEEP) {ents[0].wake();}

                    // 2. 根據時間，計算起始位置
                    let next = this.setStartPos(ents,found.t);

                    // 3. 執行 schedule, 將 next 設成 true，進到 ST_NEXT，會等一輪再執行
                    this.setDes({ent:ents.at(-1), next:next});

                }
                else    // 如果不是初始化，則檢查是否已經到達目標
                {
                    // 1. 如果已達目的地，則離開
                    if(ents.at(-1).isAt(this)) {this._shLatency = 0; return;}

                    // 2. 檢查延遲
                     console.log(`[npc ${this.id}] latency:`,this._shLatency);
                    if(this._shLatency >= GM.SH_LATENCY) {this._shLatency=0;}
                    else {this._shLatency++; return;}

                    // 3. 如果 npc 正在睡覺，則叫醒，並將 next 設成 true，(起床後，等一輪再執行)
                    let next = false;
                    if(this.state == GM.ST_SLEEP) {this.wake(); next=true;}

                    // 4. 執行 schedule
                    this.setDes({ent:ents.at(-1), next:next});
                }

            }
        }
    }

    toEnts(p)
    {
        return p.split('~').map(id=>this.scene.ents[id])
    }

    interact(ent, act) 
    {
        if(act == GM.ENTER) 
        {
            // this.exit();
            this.removed();


            // npc 離開時，將目的地的 map、port、當前時間、當前 shedule 存入 status.exit，
            // 用來檢查 npc 是否要顯示及其正確的位置
            let exit = {map:ent.map, port:ent.port, t:TimeManager.time, sh:this._shCurrent};
            // TimeManager.time、this._shCurrent 是物件，要用 Utility.deepClone，
            // 把當下的 TimeManager.time、this._shCurrent 的值複製一份，
            // 否則在下一輪 TimeManager.time 會變成當前時間，this._shCurrent 也可能指向其他 shedule
            this.status.exit = Utility.deepClone(exit);
            this.save();    // 只是把 Record.data.roles[id] 指向 this.status，還未真正存檔
        }
        else {super.interact(ent, act);}
    }

    restock()
    {
        if(!this.status.restock)
        {
            this.status.restock = TimeManager.time.d + 2;
        }

        if(TimeManager.time.d >= this.status.restock)
        {
            let roleD = RoleDB.get(this.id);
            this.status.restock = TimeManager.time.d + 2;
            this.status.bag = this.toStorage(roleD.bag.capacity,roleD.bag.items);
        }
    }
    
   



    saveData(value)
    {
        if(this.uid==-1)
        {
            if(!Record.data.roles) {Record.data.roles={};}
            Record.data.roles[this.id]=value;
        }
        else
        {
            super.saveData(value);
        }

    }

    save() {this.saveData(this.status);}

    addListener()
    {
        super.addListener();
        this.on('talk',(resolve)=>{this.talk();resolve();})
            .on('trade',(resolve)=>{this.trade();resolve();})
            .on('attack',(resolve,attacker)=>{this.hurt(attacker,resolve);})
    }

    talk() 
    {
        // this.dialog = DialogDB.get(this.id);
        this.dialog = DB.dialog(this.id);
        this.send('talk',this);
    }

    trade() 
    {
        this.send('trade',this);
    }

    isEquipWeapon()
    {
        let weapon = this.status.equips.find((equip)=>{
                        let dat = DB.item(equip.id);
                        return dat.cat===GM.CAT_WEAPON;
                    });
        return weapon != undefined;
    }

    equipWeapon()
    {
        if(this.role.weapon && !this.isEquipWeapon())
        {
            this.status.equips.push({id:this.role.weapon,count:1});
            this.equip();
        }
    }

    unEquipWeapon()
    {
        this.status.equips.find((equip,i)=>{
            let dat = DB.item(equip.id);
            if(dat.cat===GM.CAT_WEAPON)
            {
                this.status.equips.splice(i, 1);
                this.equip();
                return true;
            }
        });
    }

    async hurt(attacker,resolve)
    {
        super.hurt(attacker,resolve);
        if(this.state === GM.ST_IDLE)
        {
            this.equipWeapon();
        }
        this.state = GM.ST_ATTACK;
        this._ent = attacker;
        this._act = GM.ATTACK;
    }

    async process()
    {
        // console.log(`[${this.scene.roles.indexOf(this)}]`,this.state);
        
        switch(this.state)
        {            
            case GM.ST_IDLE: this.st_idle(); break;

            case GM.ST_NEXT:
                console.log(`[npc ${this.id}] next`);
                this.state = GM.ST_MOVING;
                break;

            case GM.ST_MOVING:
                console.log(`[npc ${this.id}] moving`);
                await this.st_moving();
                break;

            case GM.ST_ACTION:
                console.log(`[npc ${this.id}] action`);
                await this.action();
                break;

            case GM.ST_ATTACK:
                console.log(`[npc ${this.id}] attack`);
                await this.st_attack();
                break;
        }

        this.tw_idle(true);
        
    }

    debugDraw(type,text)
    {
        super.debugDraw(type,text);
        if(type === GM.DBG_CLR) 
        {
            dbg_hover_npc = false;
            this.drawPath(null);
        }
        else 
        {
            dbg_hover_npc = true;
            this.drawPath(this._path);
        }
    }

    async st_attack()
    {
        if(this.isInRange(this._ent))
        {
            await this.action();
        }
        else
        {
            let rst = this.scene.map.getPath(this.pos, this._ent.pts);
            if(rst?.state > 0)    // 找到路徑
            {
                await this.moveTo(rst.path[0]);  // 移至 pt     
            }        
            else
            {
                this.state = GM.ST_IDLE;
            }
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
}


export class Enemy extends Npc
{

    setTexture(key, frame) {}   // map.createFromObjects 會呼叫到，此時 anchorX, anchorY 還沒被設定 

    st_idle()
    {
        if(this.isDetect())
        {
            this.speak('‼️');
            this.attack(getPlayer());
        }
    }

    
    init_prefab()
    {
        console.log('----------------------',this.uid,this.qid)
        let data = this.loadData();
        if(!data?.removed)
        {
            this.init_runtime(this.id,true).load();
        }
        return true;
    }
}

