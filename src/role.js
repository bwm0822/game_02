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
import {Entity,Pickup,Door} from './entity.js';
import {RoleDB,DialogDB,ItemDB} from './database.js';
import DB from './db.js';
import {text,bbcText,rect} from './uibase.js';
import {GM} from './setting.js';
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

    get msg_name() {return `[weight=900]${this.id.lab()}[/weight] `}

    addPhysics()
    {
        super.addPhysics();
        this.scene.phyGroup.add(this);
    }

    addSprite(sprite)
    {
        //let [key,frame]=ICON_AVATAR.split('/');
        let [key,frame]=sprite.split('/');
        this.setTexture(key,frame);
    }

    initData()
    {
        // let roleD = RoleDB.get(this.id);
        let roleD = DB.role(this.id);
        // console.log('initData',roleD);

        this._faceR = roleD.faceR;

        let b = roleD.b;
        let g = roleD.g;
        let z = roleD.z;

        if(b){this.bl=b.l;this.br=b.r;this.bt=b.t;this.bb=b.b;}
        if(g){this.gl=g.l;this.gr=g.r;this.gt=g.t;this.gb=g.b;}
        if(z){this.zl=z.l;this.zr=z.r;this.zt=z.t;this.zb=z.b;}

        return roleD;
    }

    init_prefab()
    {
        if(!super.init_prefab()){return false;}
        this.registerTimeManager();
        return true;
    }

    init_runtime(id)
    {
        this.registerTimeManager();

        this.id=id;
        let roleD = this.initData();
        this.addSprite(roleD.sprite);
        this.displayWidth = roleD.w 
        this.displayHeight = roleD.h;
        this.anchor = roleD.anchor;
        this.addListener();

        console.log('---------- getPos')
        this.pos = this.getPos(this.pos);

        this.addPhysics();
        this.addGrid();
        this.setAnchor();
        this.updateDepth();
        this.addWeight();
        this.addToObjects();
        // this.debugDraw('zone')

        return this;
    }

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

    setDes({pt, ent, act, next=false}={})
    {
        let pts = ent?.pts ?? [pt];
        let rst = this.scene.map.getPath(this.pos, pts);
        console.log('setDes',rst.state,act)
        if(rst?.state>0)
        {
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
        this._sp.flipX = (pt.x>this.x) != this._faceR;
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
        await this.step(pt,duration,ease,{onUpdate:this.setLightPos.bind(this)});
        //this.addWeight();
        this.updateDepth();
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
                if(this.isPlayer) {this.drawPath(path);}
                else    // npc
                {
                    // 是否離開門，如果是，下一輪，關門
                    if(this._preW==GM.W_DOOR && w!=GM.W_DOOR)    // exit door
                    {
                        let bodys = this.scene.physics.overlapCirc(this._prePt.x,this._prePt.y,0,true,true);
                        this._exec = {ent:bodys[0]?.gameObject, act:GM.CLOSE_DOOR}
                    }
                    this._preW=w;
                    this._prePt=pt;   
                }

                await this.moveTo(pt);  // 移至 pt
                path.shift();           // 移除陣列第一個元素

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
                    let bodys = this.scene.physics.overlapCirc(pt.x,pt.y,0,true,true);
                    let ent = bodys[0]?.gameObject;

                    // 如果是門，則打開
                    if (ent && ent instanceof Door && !ent.opened) 
                    {
                        await this.interact(ent, GM.OPEN_DOOR);
                        return;
                    }
                    else if(repath)     // 重新找路徑
                    {
                        this.setDes({ent:this._ent, act:this._act});
                        let ret = await this.st_moving(false);
                        if(ret)
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

    async action()
    {
        // if(!this._act) {return;}

        if(this._ent) {this.faceTo(this._ent.pos);}

        let act = this._act??this._ent?.act;

        if(this.isPlayer) {console.log(`[player] action : ${act}`);}
        else {console.log(`[npc ${this.id}] action : ${act}`);}
        
        if(act==GM.ATTACK)
        {
            this.state = GM.ST_ATTACK;
            await this.step( this._ent.pos, 200, 'expo.in',
                            {yoyo:true, onYoyo:async ()=>{await this.interact(this._ent,act);}} ); 
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
        // console.log('stop')
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

    async attack()
    {
        if(this.isTouch(this._ent))
        {
            await this.action();
        }
        else
        {
            this.setDes({ent:this._ent, act:this._act});
            await this.st_moving();
        }
    }

    async hurt(attacker)
    {
        let rst = this.calc(attacker);
        switch(rst.state)
        {
            case 'hit':
                this.disp(-rst.dmg,GM.COLOR_GREEN);
                this._sp.setTint(0xff0000);
                await Utility.delay(150);
                this._sp.setTint(0xffffff);
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
       
        if(this.status.states.life.cur<=0)
        {
            this.dead(attacker);
        }
        else
        {
            this.speak('一二三四五六七八九十');
        }
    }

    calc(attacker)
    {
        // console.log(attacker)
        let dmg = attacker.status.attrs.attack;
        let life = this.status.states.life.cur;
        let defense = this.status.attrs.defense ?? 0;
        let dodge = this.status.attrs.dodge ?? 0;
        let block = this.status.attrs.block ?? 0;
        //console.log(this.status.attrs,defense)
        if(Utility.roll()<dodge) { return {state:'dodge'}  }
        if(Utility.roll()<block) { return {state:'block'}  }

        dmg = Math.max(0, dmg-defense);
        life -= dmg;

        this.status.states.life.cur = life;
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

    dead(attacker)
    {
        if(attacker) {this.send('msg', `${attacker.id.lab()} ${'_kill'.lab()} ${this.id.lab()}`);}
        else {this.send('msg', `${this.id.lab()} ${'_die'.lab()}`);}
        this.looties();
        this.removeWeight();
        this.removeFromRoleList();
        this.unregisterTimeManager();
        new Corpse(this.scene, this.x, this.y, this.id);
         let qid = this.data.get('qid');
        console.log(qid)
        if(qid)
        {
            QuestManager.check(qid,{type:GM.KILL,id:this.id})
        }


        this.delete(); 
       
    }

    exit()
    {
        this.removeWeight();
        this.removeFromRoleList();
        this.unregisterTimeManager();
        this.destroy();
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
                this._to = setTimeout(()=>{this._speak.hide();this._to=null;}, duration);
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

    equip()
    {
        this.status.attrs = Utility.deepClone(this.role.attrs);
        //this.status.states = Utility.deepClone(this.role.states); 
        this.removeLight();

        this.status.equips.forEach((equip)=>{
            if(equip && equip.id)
            {
                let item = DB.item(equip.id);

                if(item.props)
                {
                    for(let [key,value] of Object.entries(item.props))
                    {
                        // console.log(key,value);
                        switch(key)
                        {
                            case GM.P_ATTACK:
                                if(item.cat==GM.CAT_WEAPON) { this.status.attrs[key]=value; }
                                else { this.status.attrs[key]+=value; }
                                break;
                            case GM.P_LIFE:
                                this.status.states[key].max+=value; break;
                            default:
                                this.status.attrs[key]+=value; break;
                        }
                    }
                }

                if(item.light) {this.addLight();}
            }
        })

        this.send('refresh');
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
            this.status.equips[i]=ent.itm; this.equip();
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
                case GM.P_HUNGER:
                case GM.P_THIRST:
                    states[key].cur = Utility.clamp(states[key].cur+value, 0, states[key].max); 
                    break;
            }
        }

        if(ent.p(GM.P_TIMES)!=undefined) // 不可以使用 ent.slot?.times，因為 ent.slot.items=0 時，條件不成立
        {
            ent.incp(GM.P_TIMES, -1)
            if(ent.p(GM.P_TIMES)<=0 && !ent.p(GM.P_KEEP))
            {
                ent.empty();
            }
        }
        else if(ent.p(GM.P_CAPACITY) != undefined)
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

    getPos(p)
    {
        console.log('--- chk1')
        if(this.scene.map.getWeight(p)==1) {return p;}
        console.log('--- chk2')
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

    load(record)    // call by Avatar
    {
        // let roleD = RoleDB.get(this.id);
        let roleD = DB.role(this.id);
        if(!record)
        {
            record = {
                gold: roleD.gold??0, 
                equips: [],
                // bag: {capacity:roleD.bag.capacity, items:[]},
                bag: this.toStorage(roleD.bag?.capacity,roleD.bag?.items),
                attrs: Utility.deepClone(roleD.attrs),
                states: Utility.deepClone(roleD.states), 
            }
        }

        this.role = roleD; 
        this.status = record;
        this.equip();
    }

    save() {return this.status;}
   

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
        // if(this.state==GM.ST_MOVING) {await this.move(); return}
        // if(this.state==GM.ST_MOVING) {await this.st_moving(); return}

        if(this.state!=GM.ST_MOVING)
        {
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

        

        // if(this.state == GM.ST_MOVING) {await this.move();}
        // else
        // {
        //     await this.pause();
        //     if(this.state == GM.ST_MOVING) {await this.move();}
        //     else {await this.action();}
        // }
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
    }

    updateStates(dt=1)
    {
        let states = this.status.states;
        if(states.hunger) {states.hunger.cur = Math.min(states.hunger.cur+GM.HUNGER_INC*dt,states.hunger.max);}
        if(states.thirst) {states.thirst.cur = Math.min(states.thirst.cur+GM.THIRST_INC*dt,states.thirst.max);}
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
        this.setTexture(key,frame);
        this.displayWidth = 32;
        this.displayHeight = 32;
    }

    updateDepth()
    {
        this.setDepth(Infinity);
    }

    init_runtime(id)
    {
        this.id=id;
    }

    // load()
    // {}
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
        this.on('attack',(resolve,attacker)=>{this.hurt(attacker);resolve()})
    }

    dead(attacker)
    {
        this.send('gameover');
        super.dead(attacker);
    }

}

export class Npc extends Role
{
    get acts() {return this.state != 'attack' ? ['talk','trade','observe','attack']
                                            : ['attack','observe'];}

    // get state()     {return super.state;}
    // set state(value) {super.state=value;console.log(value);console.trace()}               

    init_prefab()
    {
        if(!super.init_prefab()) {return false;}

        let roleD = this.initData();
        if(roleD.anchor)
        {
            this.setData('anchorX',roleD.anchor.x);
            this.setData('anchorY',roleD.anchor.y);
        }
        
        this.addToRoleList();
        this.load();
        return true;
    }

   
    init_runtime(id)
    {
        this.addToRoleList();
        return super.init_runtime(id);
    }

    load()
    {
        // let roleD = RoleDB.get(this.id);
        let roleD = DB.role(this.id);
        this.role = roleD;
        let data = this.loadData();
        if(data) { this.status = data; }
        else
        {
            this.status = 
            {   
                gold: roleD.gold??0, 
                bag: this.toStorage(roleD.bag?.capacity,roleD.bag?.items),
                attrs: Utility.deepClone(roleD.attrs),
                states: Utility.deepClone(roleD.states), 
            }
        }

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
        this.schedule = this.role.schedule[this.mapName];
    }

    // setStartPos(ents,tSch)
    // {
    //     let rst = this.scene.map.getPath(ents[0].pts[0], ents[1].pts);
    //     let t = tSch.split('~');
    //     let t0 = TimeManager.str2Ticks(t[0])
    //     let t1 = TimeManager.str2Ticks(t[1])
    //     let tc = TimeManager.ticks;
    //     let ratio = (tc-t0) / (t1-t0);
    //     let i = Math.floor(rst.path.length*ratio);
    //     console.log(ratio, rst.path.length, i);

    //     this.removeWeight();
    //     this.pos = tc==t0 ? ents[0].pts[0] : rst.path[i];
    //     this.addWeight();
    // }

    setStartPos(ents,tSch)
    {
        // let rst = this.scene.map.getPath(ents[0].pts[0], ents[1].pts);
        let rst = this.scene.map.getPath(this.pos, ents[1].pts);

        // let t = tSch.split('~');
        // let td = TimeManager.ticks - TimeManager.str2Ticks(t[0]) - 1;
        let ts = this.status.exit ? this.status.exit.t : tSch.split('~')[0];

        let td = TimeManager.ticks - TimeManager.time2Ticks(ts) - 1;

        let i = td <= rst.path.length-1 ? td : rst.path.length-1;
        console.log('setStartPos', td, rst.path.length, i);
        this.removeWeight();
        this.pos = i<=0 ? this.pos : rst.path[i];
        this.addWeight();
    }

    findSchedule()
    {
        let found;
        if(this.status.exit)
        {
            let t = this.status.exit.t;
            let time = this.status.exit.sh.t.split('~')[1];
            found = this.schedule.find((sh)=>{return TimeManager.checkRange(t.d, time, sh.t);});
            if(found) {return found;}
            else {delete this.status.exit;}
        }

        found = this.schedule.find((s)=>{return TimeManager.inRange(s.t);})

        return found;
    
    }

    updateSchedule(init=false)
    {
        // ST_IDLE 或 ST_SLEEP，才檢查 schedule
        if(this.state != GM.ST_IDLE && this.state != GM.ST_SLEEP) {return;}
 
        if(this.schedule)
        {
            // let found = this.schedule.find((s)=>{return TimeManager.inRange(s.t);})
            let found = this.findSchedule();
            if(found)
            {
                console.log(`[npc ${this.id}] updateSchedule`); 

                // 1. 檢查是否第一次進入 updateSchedule
                if(found != this._shCurrent)    
                {
                    this._shCurrent = found;
                    this._shLatency = GM.SH_LATENCY;
                }

                // 2. 取得 起始、目標 地點
                let ents = this.toEnts(found.p);

                if(init)    // 初始化
                {
                    console.log(this.status.exit);
                    if(ents.length==1)  // 只有一個目標，表示已經到達目標，立即執行動作，例如:bed
                    {
                        this.setDes({ent:ents[0]});
                    }
                    else    // 有起訖點，根據時間，計算起始位置
                    {
                        // 如果 npc 正在睡覺，則叫醒
                        if(this.state == GM.ST_SLEEP) {ents[0].wake();}
                        this.setStartPos(ents,found.t);

                        this.setDes({ent:ents.at(-1),next:true});
                    }
                }
                else    // 如果不是初始化，則檢查是否已經到達目標
                {
                    // 1. 如果已達目的地，則離開
                    if(ents.at(-1).isAt(this)) {this._shLatency = 0;return;}

                    // 2. 檢查延遲
                     console.log(`[npc ${this.id}] latency:`,this._shLatency);
                    if(this._shLatency >= GM.SH_LATENCY) {this._shLatency=0;}
                    else {this._shLatency++; return;}

                    // 3. 如果 npc 正在睡覺，則叫醒
                    if(this.state == GM.ST_SLEEP)
                    {
                        this.wake();
                        // this._shLatency = GM.SH_LATENCY;
                        return;
                    }

                    // 4. 執行 schedule
                    this.setDes({ent:ents.at(-1)});
                }

            }
        }
    }



    // checkSchedule()
    // {
    //     if(this.schedule)
    //     {
    //         let found = this.schedule.find((s)=>{return TimeManager.inRange(s.t);})
    //         if(found)
    //         {
    //             console.log('[npc] checkSchedule'); 
    //             this.status.schedule = {map:this.mapName, t:found.t};
    //             console.log(this.status.schedule)
                
    //             let ents = this.toEnts(found.p);

    //             if(ents.length==1)  // 只有一個目標，表示已經到達目標，立即執行動作，例如:bed
    //             {
    //                 this.setDes({ent:ents[0]});
    //             }
    //             else
    //             {
    //                 // 如果 npc 正在睡覺，則叫醒
    //                 if(this.state == GM.ST_SLEEP) {ents[0].wake();}

    //                 // let rst = this.scene.map.getPath(ents[0].pts[0], ents[1].pts);
    //                 // let t = found.t.split('~');
    //                 // let t0 = TimeManager.str2Ticks(t[0])
    //                 // let t1 = TimeManager.str2Ticks(t[1])
    //                 // let tc = TimeManager.ticks;
    //                 // let ratio = (tc-t0) / (t1-t0);
    //                 // let i = Math.floor(rst.path.length*ratio);
    //                 // console.log(ratio, rst.path.length, i);

    //                 // this.removeWeight();
    //                 // this.pos = tc==t0 ? ents[0].pts[0] : rst.path[i];
    //                 // this.addWeight();

    //                 this.setStartPos(ents,found.t);
    //                 this.setDes({ent:ents[1],next:true});
    //             }

    //         }
    //     }
    // }

    toEnts(p)
    {
        return p.split('~').map(id=>this.scene.ents[id])
    }

    // updateSchedule_old()
    // {
    //     // 如果正在移動中，則不檢查 schedule
    //     if(this.state != GM.ST_IDLE && this.state != GM.ST_SLEEP) {return;}
 
    //     if(this.schedule)
    //     {
    //         let found = this.schedule.find((s)=>{return TimeManager.inRange(s.t);})
    //         if(found)
    //         {
    //             console.log('[npc] updateSchedule'); 

    //             // 1. 檢查是否第一次進入 updateSchedule
    //             if(found != this._shCurrent)    
    //             {
    //                 this._shCurrent = found;
    //                 this._shLatency = GM.SH_LATENCY;

    //                 this.status.schedule = {map:this.mapName, t:found.t};
    //                 console.log(this.status.schedule)
    //             }

    //             // 2. 如果已達目的地，則離開
    //             let ents = this.toEnts(found.p);    
    //             let ent = ents.at(-1);
    //             if(ent.isAt(this)) 
    //             {
    //                 this._shLatency = 0;
    //                 return;
    //             }

    //             // 3. 檢查延遲
    //             if(this._shLatency >= GM.SH_LATENCY) 
    //             {
    //                 console.log('[npc] latency:',this._shLatency);
    //                 this._shLatency=0;
    //             }
    //             else 
    //             {
    //                 console.log('[npc] latency:',this._shLatency);
    //                 this._shLatency++; 
    //                 return;
    //             }

    //             // 4. 執行 schedule
    //             if(this.state == GM.ST_SLEEP)
    //             {
    //                 this.wake();
    //                 this._shLatency = GM.SH_LATENCY;
    //                 return;
    //             }
    //             console.log('[setDes]')
    //             this.setDes({ent:ent});
    //         }
    //     }
    // }

    interact(ent, act) 
    {
        if(act == GM.ENTER) 
        {
            this.exit();
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
    
   

    loadData()
    {
        if(this.uid==-1)
        {
            return Record.data.roles?.[this.id];
        }
        else
        {
            return super.loadData();
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
            .on('attack',(resolve,attacker)=>{
                this.hurt(attacker);
                resolve();})
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

    async hurt(attacker)
    {
        super.hurt(attacker);
        this.state = GM.ST_ATTACK;
        this._ent = attacker;
        this._act = 'attack';
    }

    async process()
    {
        // console.log(`[${this.scene.roles.indexOf(this)}]`,this.state);
        
        switch(this.state)
        {
            case GM.ST_IDLE: break;

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
                await this.attack();
                break;
        }
        
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
}

