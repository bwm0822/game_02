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
import {Entity,Pickup} from './entity.js';
import {RoleDB,DialogDB,ItemDB} from './database.js';
import DB from './db.js';
import {text,rect} from './uibase.js';
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
        this._des = null;
        this._act = '';
        this._resolve;
        //
        this.static = false; // true: static body, false: dynamic body
        this.id = '';
        this.interactive = true;
        //        
    }

    get isPlayer() {return false;}

    get pos()       {return super.pos;}
    set pos(value)  { this.removeWeight(); super.pos=value; this.addWeight(value); }

    get moving()    {return this._des!=null;}
    get storage()   {return this.status.bag;}

    get msg_name() {return `[weight=900]${this.id.lab()}[/weight] `}

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
        console.log('initData',roleD);

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
        this.addListener();
        this.addPhysics();
        this.addGrid();
        this.setAnchor(roleD.anchor);
        this.updateDepth();
        this.addWeight();
        this.addToObjects();
        //this.debugDraw('zone')

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
            this._des = rst.pt; 
            this._ent = null;
            this._act = '';
            this.resume();
        }
    }

    setDes(des, ent, act)
    {
        if(this.isTouch(ent))
        {
            this._des = null; 
            this._ent = ent;
            this._act = act ?? ent?.act ?? '';
            this.resume();
        }
        else
        {
            let rst = this.scene.map.getPath(this.pos, des);
            if(rst?.state>=0)
            {
                if(this.isPlayer) {this.send('clearpath');}
                this._path = rst.path;
                this._des = des; 
                this._ent = ent;
                this._act = act ?? ent?.act ?? '';
                this.resume();
            }
            else
            {
                this.stop();
            }
        }
    }

    faceTo(pt)
    {
        if(pt.x==this.x) {return;}
        this._sp.flipX = (pt.x>this.x) != this._faceR;
    }

    isTouch(ent)
    {
        return !ent ? false : this.scene.map.isNearby(ent,this.pos);
    }

    async moveTo({duration=200,ease='expo.in'}={})
    {
        if(this._path.length==0) {return;}
        let path = this._path;
        
        if(!this.isTouch(this._ent))
        { 
            let pt = path[0];
            if(this.scene.map.isWalkable(pt))
            {
                if(this.isPlayer) {this.drawPath(path);}
                this.faceTo(pt);
                this.removeWeight();
                this.addWeight(pt);
                await this.step(pt,duration,ease,{onUpdate:this.setLightPos.bind(this)});
                //this.addWeight();
                this.updateDepth();
                path.shift();   //移除陣列第一個元素
                if(path.length>0) {return false;}
            }
        }
        
        await this.action();
        this.stop();
        return true;
    }

   

    async action()
    {
        if(!this._act) {return;}

        if(this._ent) {this.faceTo(this._ent.pos);}

        if(this._act==GM.ATTACK)
        {
            await this.step( this._ent.pos, 200, 'expo.in',
                            {yoyo:true, onYoyo:()=>{this.interact(this._ent,this._act);}} ); 
        }
        else if(this._act==GM.EXIT)
        {
            this.exit();
        }
        else
        {
            this.interact(this._ent,this._act);
        }
    }

    stop()
    {
        this._path = [];
        this._des = null;
        if(this._dbgPath){this._dbgPath.clear();}
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

    interact(ent, act) {ent.emit(act, this);}

    async pause() {await new Promise((resolve)=>{this._resolve=resolve;});}

    resume() {this._resolve?.();}

    async attack()
    {
        if(this.isTouch(this._ent))
        {
            await this.action();
        }
        else
        {
            this.setDes(this._ent.pos,this._ent,this._act);
            await this.moveTo({draw:false});
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

    speak(value)
    {
        if(!this._speak)
        {
            this._speak = this.scene.rexUI.add.sizer(0,-48,{space:5});
            this._speak//.addBackground(rect(this.scene,{color:0xffffff,radius:10,strokeColor:0x0,strokeWidth:0}))
                        .add(text(this.scene,{color:'#000',wrapWidth:5*GM.FONT_SIZE}),{key:'text'})
                        .setOrigin(0.5,1);
            this.add(this._speak);
            this.sort('depth')
        }

        this._speak.getElement('text').setText(value);
        this._speak.layout();
        this._speak.show();
        if (this._to) {clearTimeout(this._to);this._to=null;}
        this._to = setTimeout(()=>{this._speak.hide();this._to=null;}, 1000);

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
        }
        this._dbgPath.clear();
        path.forEach(node=>{
            let circle = new Phaser.Geom.Circle(node.x, node.y, 5);
            this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
        })
    }

    async process()
    {
        if(this.moving) {await this.moveTo();}
        else
        {
            await this.pause();
            if(this.moving) {await this.moveTo();}
            else {await this.action();}
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

    async speak(value){}

    addListener()
    {
        super.addListener();
        this.on('talk',()=>{this.talk();})
        this.on('attack',(attacker)=>{this.hurt(attacker);})
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
        this.state = 'idle';
        //this.debugDraw('zone')
        return true;
    }

   
    init_runtime(id)
    {
        this.state = 'idle';
        this.addToRoleList();
        return super.init_runtime(id);
    }

    updateTime(dt)
    {
        //console.log('updateTime')
        this.checkSchedule();
        this.updateStates();
    }

    setSchedule()
    {
        if(!this.role.schedule) {return;}
        let sch = this.role.schedule[this.mapName];
        this.schedule = sch.filter((s)=>{return s.type=='enter' || s.type=='exit'});
        this.schedule.forEach((s)=>{s.cd=0;})
    }

    checkSchedule()
    {
        if(this.schedule)
        {
            let found = this.schedule.find((s)=>{return s.cd==0 && TimeManager.inRange(s.range);})
            if(found)
            {
                // let pt = this.scene.ports[found.to]?.pt;
                // if(pt)
                // {
                //     let act = found.type == 'exit' ? 'exit' : null;
                //     this.setDes(pt,null,act);
                //     this.state = 'move';
                // }

                found.cd = 60;

                let p0 = this.scene.ports[found.from];
                let p1 = this.scene.ports[found.to];

                let rst = this.scene.map.getPath(p0, p1);
                console.log(found,rst);

                let t0 = TimeManager.str2Ticks(found.range[0])
                let t1 = TimeManager.str2Ticks(found.range[1])
                let tc = TimeManager.ticks;
                let ratio = (tc-t0) / (t1-t0);
                let i = Math.floor(rst.path.length*ratio);
                console.log(ratio, rst.path.length, i);

                this.pos = rst.path[i];
                let act = found.type == 'exit' ? 'exit' : null;
                this.setDes(p1,null,act);
                this.state = 'move';

            }
        }
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
        this.checkSchedule();
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
        this.on('talk',()=>{this.talk();})
            .on('trade',()=>{this.trade();})
            .on('attack',(attacker)=>{this.hurt(attacker);})
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
        this.state = 'attack';
        this._ent = attacker;
        this._act = 'attack';
    }

    async process()
    {
        // console.log(`[${this.scene.roles.indexOf(this)}]`,this.state);
        
        switch(this.state)
        {
            case 'idle': break;
            case 'move':
                //this.setDes(Avatar.instance.pos);
                let ret = await this.moveTo({draw:false});
                if(ret) {this.state = 'idle';}
                break;
            case 'attack':
                await this.attack();
                break;
        }
        
    }
}

