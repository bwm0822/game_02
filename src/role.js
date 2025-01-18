import Phaser from 'phaser';
//import {RoleDB, ItemDB, RoleData, CardDB} from './database.js';
//import {ItemDrop} from './item.js';
//import {ProgressBar, BuffBar, Buff, Shield, BuffInfo, Flag} from './gameUi.js';
//import {Gun, Melee} from './weapon.js';
import {UiBattle, UiMessage, UiWeaponState} from './ui_old.js';
import Utility from './utility.js';
//import Battle from './battle.js';
import Record from './record';
//import {Container} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
//import Ctrl from './ctrl.js';
import {Entity} from './entity.js';
import {RoleDB,DialogDB} from './database.js';

const _dLut = {body:0, armor:1, head:2, helmet:3, weapon:4};
const COLOR_RED = 0xff0000;
const COLOR_WHITE = 0xffffff;

const ICON_CURE = 'buffs/28';
const ICON_ATTACK = 'buffs/31';
const ICON_SHIELD = 'buffs/32';
const ICON_POISON = 'buffs/33';
const ICON_TARGET = 'buffs/20';
const ICON_AVATAR = 'role/0';
const ICON_ENEMY = 'role/1';

// export class Role_old extends Phaser.GameObjects.Container
// {
//     constructor(scene, id, {x, y, faceTo='right', data}={})
//     {
//         super(scene, x, y);
//         this.scene = scene;
//         let role = RoleDB.get(id);
//         this.addData(role, id, data);
//         this.setSize(role.size.w,role.size.h);
//         this.addSprite(role,faceTo);
        
//         this.createHp();
//         this.createShield();
//         this.createBuff();
//         this.createFlag();
//         this.addListener();
//         scene.add.existing(this);

//         this.updateHp();
//         //this.debugDraw();
//     }

//     get pos() {return {x:this.x, y:this.y};} 
//     get dead() {return this.role.dead;}

//     addData(role, id, data)
//     {
//         this.role = data??new RoleData(role, id);
//         this.role
//             .on('hp', async (delta,text,resolve)=>{
//                 this._hpBar?.set(this.role.hp,this.role.hpMax);
//                 if(delta != 0)
//                 {
//                     if(delta<0){this.getHurt();}
//                     await this.createText(text);
//                 }
//                 resolve?.();
//             })
//             .on('shield', (num)=>{this._shield?.setNum(num);})
//             .on('text', (text,reslove)=>{this.createText(text,reslove);})
//             .on('defend', (num,resolve)=>{
//                 this.defend();
//                 this.createText('defend'.local(),resolve);
//                 this._shield.setNum(num);
//             })
//             .on('addBuff', (buff)=>{this.addBuff(buff);})
//             .on('updateBuff', async(buff,apply)=>{await this.updateBuff(buff,apply);})
//             .on('ap', (ap)=>{this.scene.events.emit('ap',ap);})  // ui.js/UiBattle.setAp()
//             .on('flag',async(prepare,role,resolve)=>{
//                 await this._flag.set(prepare,role);
//                 resolve?.();
//             })

//     }

//     addListener()
//     {
//         let tween;
//         let addTween = ()=>{
//             tween = this.scene.tweens.add({
//                     targets: this._sprite,
//                     alpha: 0.5,
//                     duration: 500,
//                     ease: 'Sine.easeInOut',
//                     yoyo: true,
//                     repeat: -1
//             });
//         }

//         let delTween = ()=>{ this._sprite.setAlpha(1); tween.remove(); }

//         this.setInteractive();
//         this.on('pointerover', (pointer, x, y, event) => {
//                 BuffInfo.show(this,this.role.action,this.role.buffs_m);
//                 Battle.interact('over',this);
//             })
//             .on('pointerout', (pointer, x, y, event) => {
//                 BuffInfo.hide();
//                 Battle.interact('out',this);
//             })
//             .on('pointerup', (pointer, x, y, event) => {
//                 Battle.interact('up',this);
//             })


//         this.on('apply', (effect,resolve)=>{
//             this.apply(effect,resolve);
//         });
//     }

//     addSprite(role, faceTo)
//     {
//         let [atlas, frame] = role.icon.split('/');
//         let anchor = role.anchor;
//         this._sprite = this.scene.add.sprite(0, 0, atlas,frame).setOrigin(anchor.x,anchor.y);
//         this._sprite.faceTo = role.faceTo??'right';
//         this.add([this._sprite]);
//         this._sprite.on('animationupdate', ()=>{ 
//             this._sprite.setOrigin(anchor.x,anchor.y);
//         });        
//         this.faceTo(faceTo);
//     }

//     faceTo(faceTo)
//     {
//         this._faceTo=faceTo;
//         this._sprite.flipX = this._sprite.faceTo != faceTo;
//         return this;
//     }

//     death()
//     {
//         this._sprite.setTexture('rip')
//                     .setScale(0.5)
//                     .setOrigin(0.5)
//                     .setPosition(0,0);
//     }

//     updateDepth()
//     {
//         let depth = this.y + this.height/2;
//         this.setDepth(depth);
//         //this.debug(depth.toFixed(1));
//     }

//     createHp()
//     {
//         let w=this.width*1.5, h=10;
//         this._hpBar = new ProgressBar(this.scene, 0, this.height/2+10, w, h); 
//         this.add(this._hpBar);
//     }

//     createShield()
//     {
//         let x = -this.width*1.5/2-5;
//         let y = this.height/2+10;
//         //this._shield = new Buff(this.scene, 20, 20, {x:x, y:y, buff:{icon:ICON_SHIELD, dur:''}, align:'center'}).setOrigin(1,0.5);
//         this._shield = new Shield(this.scene, 30, 30,{x:x, y:y}).setOrigin(1,0.5);
//         this.add(this._shield);
//         this._shield.layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
//     }

//     createBuff()
//     {
//         let w=this.width*1.5, h=10;
//         this._buffBar = new BuffBar(this.scene, 0, this.height/2+h+15, w, h); 
//         this._buffBar.setDepth(1000);
//         this.add(this._buffBar);
//     }

//     createFlag()
//     {
//         this._flag = new Flag(this.scene, 0, -this.height/2-20); 
//         this.add(this._flag);
//     }

//     updateHp()
//     {
//         this._hpBar.set(this.role.hp,this.role.hpMax);
//     }

//     updateShield()
//     {
//         this._shield.setNum(this.role.shield);
//     }

//     addBuff(buff)
//     {
//         this.createSprite(buff.icon);
//     }

//     async updateBuff(buff,apply)
//     {
//         this.scene.events.emit('updateCard');
//         await this._buffBar.updateBuff(buff,apply);
//     }

//     updateShield()
//     {
//         if(this.role.shield<=0){this._shield.hide();}
//         else{this._shield.setNum(this.role.shield).show();}
//     }

//     async hideDisp(delay=-1)
//     {
//        // this._hpBar.hide(dealy);
//         await Utility.delay(delay);
//         this._hpBar.hide();
//         this._buffBar.hide();
//         this._shield.hide();
//     }

//     async createText(val)
//     {
//         let x=0, y=-this.height/2;
//         let config = {fontSize: '24px', fill: val>0?'#f00':'#0f0', stroke:'#000', strokeThickness:5};
//         let text = this.scene.add.text(x,y,`${val>0?'+':''}`+`${val}`, config).setOrigin(0.5);
//         this.bringToTop(text);
//         this.add(text);
//         return new Promise((resolve)=>{
//             this.scene.tweens.add({
//                 targets: text,
//                 x: Phaser.Math.Between(-10, 10),
//                 y: y-Phaser.Math.Between(20, 30),
//                 scale: 2,
//                 alpha: 0,
//                 duration: 1000,
//                 onComplete: () => {text.destroy(); resolve();}
//             });
//         })
//     }

//     async createSprite(icon)
//     {
//         let [frame,key]=icon.split('/');
//         let sprite = this.scene.add.sprite(0,0,frame,key).setOrigin(0.5);
//         this.add(sprite);
//         //this.bringToTop(sprite);
//         return new Promise((resolve)=>{
//             this.scene.tweens.add({
//                 targets: sprite,
//                 scale : {from:1, to:2.5},
//                 alpha: 0,
//                 duration: 1000,
//                 onComplete: () => {sprite.destroy(); resolve();}
//             });
//         })
//     }

//     // async updateAnim(type='idle',cb)
//     // {
//     //     let anim = this.role.anim;
//     //     await this.animate(anim?.[type]);
//     //     cb?.();
//     // }

//     async updateAnim(type='idle',cb)
//     {
//         let anim = this.role.anim;
//         if(anim && anim[type])
//         {
//             await this.animate(anim[type]);
//         }
//         else
//         {
//             switch(type)
//             {
//                 case 'idle': await this.tw_Idle(); break;
//                 case 'attack': await this.tw_Attack(); break;
//                 case 'hurt': await this.tw_Hurt(); break;
//                 case 'dead': return this.tw_Dead();;
//             }
//         }

//         cb?.();
//         return true;
//     }

//     tw_Idle()
//     {
//         return new Promise((resolve)=>{
//             if(this._tw){this._tw.remove();this._sw=null;}
//             this._tw = this.scene.tweens.add({
//                 targets: this._sprite,
//                 scaleY: {from:1, to:1.1},
//                 yoyo: true,
//                 repeat: -1,
//                 duration: 1000,
//             })
//             resolve();
//         })
//     }

//     tw_Attack()
//     {
//         return new Promise((resolve)=>{
//             if(this._tw){this._tw.remove();this._sw=null;}
//             this.scene.tweens.add({
//                 targets: this._sprite,
//                 x: {from:0, to:this._faceTo==='left'?-50:50},
//                 yoyo: true,
//                 ease:'back.out',
//                 repeat: 0,
//                 duration: 100,
//                 onComplete:()=>{resolve();this._sw=null;}
//             })
//         })
//     }

//     tw_Hurt()
//     {
//         return new Promise((resolve)=>{
//             if(this._tw){this._tw.remove();this._sw=null;}
//             this.scene.tweens.add({
//                 targets: this._sprite,
//                 x: {from:0, to:this._faceTo=='left'?10:-10},
//                 yoyo: true,
//                 repeat: 0,
//                 ease:'back.out',
//                 duration: 100,
//                 onComplete:()=>{resolve();this._sw=null;}
//             })
//         })
//     }

//     tw_Dead()
//     {
//         if(this._tw){this._tw.remove();this._sw=null;}
//         return false;
//     }

//     animate(animation)
//     {
//         return new Promise((resolve)=>{
//             if(animation)
//             {
//                 this._sprite.play(animation,true).setOrigin(0.25,0.75);
//                 this._sprite.once('animationcomplete',()=>{resolve(true);});
//             }
//             else
//             {
//                 resolve(false);
//             }
//         })
//     }

//     debugText(text)
//     {
//         if(!this._dbg)
//         {
//             this._dbg = this.scene.add.text(0,this.height/2,'', {fontSize: '12px', fill: '#fff'});
//             this.add(this._dbg);
//         }
//         this._dbg.setText(text);
//     }


//     debugDraw()
//     {
//         if(!this._dbgGraphics)
//         {
//             this._dbgGraphics = this.scene.add.graphics();
//             this._dbgGraphics.name = 'Role';
//         }

//         let circle = new Phaser.Geom.Circle(this.x, this.y, 4);
//         let rect = new Phaser.Geom.Rectangle(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
//         this._dbgGraphics.lineStyle(1, 0x00ff00)
//                         .strokeRectShape(this.getBounds())
//                         .lineStyle(1, 0xff0000)
//                         .strokeRectShape(rect)
//                         .lineStyle(3, 0x00fff00)
//                         .strokeCircleShape(circle);
//     }

//     destroy()
//     {
//         console.log('destroy')
//         this.getAll().forEach((child)=>{child.destroy();});
//         super.destroy();
//     }

//     idle() {this.updateAnim('idle');}

//     defend(resolve)
//     {
//         this.updateAnim('defend',()=>{
//             this.idle();
//             resolve?.();
//         });
//     }

//     async getHurt()
//     {
//         this._sprite.setTintFill(COLOR_WHITE);
//         await this.updateAnim('hurt');
//         this._sprite.setTint(COLOR_WHITE);
//         if(this.dead){this.death();}
//         else{this.idle();}
//     }
// }



// export class Npc_old extends Role
// {
//     constructor(scene, id, config)
//     {
//         super(scene, id, config);
//         this.idle();
//         this.role.init();
//         this._act;
//         this._i=0;
//     }

//     get ap()        {return this.role.ap;}
//     set ap(value)   {this.role.ap=value;}


//     async action(act,target)
//     {
//         if(this.dead) {return;}
//         switch(act.id)
//         {
//             case 'attack': await this.attack(target); break;
//             default:
//                 let buffs = act.buffs.map((buff)=>{return Utility.shallowClone(buff)});
//                 let effect = {buffs:buffs};
//                 await this.applyTo(target,effect);
//                 break;
//         }
//     }

//     async prepare()
//     {
//         if(this.dead) {return;}
//         await this.role.prepare();
//     }

//     async execute(player)
//     {
//         if(this.dead) {return;}
//         this._flag.hide();
//         let act = this.role.action;
//         let target = act.target == 'enemy' ? player : this;
//         await this.action(act, target);
//     }

//     async apply(effect,resolve)
//     {
//         await this.role.apply(effect);
//         resolve?.();
//     }

//     async attack(target)
//     {
//         await this.updateAnim('attack');
//         let effect={damage:this.role.damage};
//         this.idle();
//         await this.applyTo(target,effect);
        
//     }

//     applyTo(target, effect)
//     {
//         return new Promise((resolve)=>{
//             target.emit('apply',effect,resolve);
//         });
//     }

//     async turnStart()
//     {
//         if(this.dead){this.destroy();return;}
//         await this.role.turn_start();
//     }

//     async turnEnd(cb)
//     {
//         if(this.dead) {cb?.(); return;}
//         await this.role.turn_end();
//         //await Utility.delay(500);
//         cb?.();
//     }

//     async turnNext()
//     {
//         if(this.dead) {return;}
//         await this.role.turn_next();
//     }

//     gameOver()
//     {
//         this.role.gameOver();
//         this.destroy();
//     }
    
//     async death()
//     {
//         this.removeAllListeners();
//         this._flag.hide();
//         this.hideDisp(250);
//         await this.updateAnim('dead');
//         super.death();
//     }   

// }


// export class Npc_NoAnim extends Npc
// {
//     constructor(scene, id, x, y)
//     {
//         super(scene, id, x, y);
//     }

//     addSprite(role)
//     {
//         this._parts = {};
//         for (let [key, value] of Object.entries(role.parts))
//         {
//             let [atlas, frame] = value.image.split('/');
//             let part = this.scene.add.image(value.x, value.y, atlas, frame)
//                                     .setScale(value.scl)
//                                     .setDepth(_dLut[key]);
//             this.add(part);
//             this._parts[key] = part;
//         }
//         this.sort('depth');
//     }

//     enablePhysics(role)
//     {
//         this.setSize(role.size.w, role.size.h);
//         this.scene.physics.world.enable(this)
//         this.scene.dynamic.add(this);
//         this.body.setMass(role.mass);
//         this.body.setSize(role.size.w, role.size.h/2);
//         this.body.setOffset(0, role.size.h/2);

        
//         //this.body.setSize(role.size.w, role.size.h/4);
//         //this.body.setOffset(0,0 );
//         //this.body.setOffset(0, role.size.h/2);
//         // let zone = this.scene.add.zone(0, 0, role.size.w, role.size.h);
//         // this.add(zone);
//         // this.scene.dynamic.add(zone);
//     }

//     enablePhysics_bounds(role)
//     {
//         let bounds = this.getBounds();
//         this.setSize(bounds.width, bounds.height);
//         console.log(bounds);
//         this.scene.physics.world.enable(this)
//         this.scene.dynamic.add(this);
//         this.body.setOffset(0, bounds.centerY-this.y);
//         this.body.setMass(role.mass);
//     }

//     updateAnim()
//     {
//         let dir = this._dir;
//         if (dir=='left')
//         {
//             Object.values(this._parts).forEach((part)=>{part && (part.flipX=true);});
//         }
//         else if (dir=='right')
//         {
//             Object.values(this._parts).forEach((part)=>{part && (part.flipX=false);});
//         }
//     }

//     debugDraw()
//     {
//         if(!this._dbgGraphics)
//         {
//             this._dbgGraphics = this.scene.add.graphics({ lineStyle: { width: 1, color: 0x00ff00 }, fillStyle: { color: 0x0000aa } });
//             //this._dbgGraphics = this.scene.add.graphics();
//             this._dbgGraphics.name = 'Npc_NoAnim';
//         }

//         let bounds = this.getBounds();
//         this._dbgGraphics.clear()
//                         //.lineStyle(2, 0x00ff00)
//                         .strokeRectShape(bounds);
//     }
// }

// export class Player_old extends Npc_NoAnim
// {
//     static instance = null;
//     constructor(scene, id, x, y)
//     {
//         super(scene, id, x, y);
//         Player.instance = this;
//         //scene.physics.add.overlap(this, scene.interactables, this.onoverlap, null, this);
//     }

//     onoverlap(player, item)
//     {
//         //console.log(player, item);
//         item.highlight(true);

//         console.log(item);
//     }

//     static get pos() {return Player.instance.pos;}
//     static getBounds() {return Player.instance.getBounds();}
//     static get role() {return Player.instance.role;}
//     static get dead() {return Player.instance.dead;}

//     detect()
//     {
//         !this._list && (this._list=[]);
//         let list = this.scene.physics.overlapCirc(this.x, this.y, 50, true, true);
//         list = list.filter((body) => {return body.gameObject.interactable;});
//         this._list.forEach((body) => {
//             body.gameObject && !list.includes(body) && body.gameObject.emit('highlight', false);
//         });
//         this._list = list;
//         this._list.forEach((body) => {body.gameObject.emit('highlight', true);});
//     }

//     addData(id, role)
//     {
//         super.addData(id, role);
//         this.role.gold = 1000;
//         this.role.bag = {
//             capacity: 15,
//             items: [  
//                         {id:'itempack_0', count:2}, 
//                         {id:'itempack_1', count:3}, 
//                         {id:'smg', count:1},
//                         {id:'rifle', count:1},
//                         {id:'shotgun', count:1},
//                         {id:'vest', count:1},
//                         {id:'helmet', count:1},
//                         {id:'shirt', count:1},
//                         {id:'axe', count:1},
//                         {id:'sword', count:1},
//                         {id:'helmet_53', count:1},
//                         {id:'armor_62', count:1},
//                         {id:'dagger_21', count:1},
//                         {id:'itempack_2', count:1},
//                     ]
//             };
//     }



//     drop(slot, count)
//     {
//         this.role.remove(slot, count);
//         let x = this.x + Phaser.Math.Between(-20, 20);
//         let y = this.y + Phaser.Math.Between(-20, 20);
//         //let data = ItemDB.get(item.id);
//         //eval(`new ${data.class}(this.scene, item.id, x, y, count)`);
//         //eval(`new ItemDrop(this.scene, x, y, slot.id, count)`);

//         UiMessage.show(`丟棄 ${count} ${slot.label}`);
//     }

//     drop_equip(cat)
//     {
//         let id = this.role.get_equip(cat);
//         this.unequip(cat, true);
//         let x = this.x + Phaser.Math.Between(-20, 20);
//         let y = this.y + Phaser.Math.Between(-20, 20);
//         let data = ItemDB.get(id);
//         let count = 1;
//         eval(`new ItemDrop(this.scene, x, y, id, count)`);
        
//         UiMessage.show(`丟棄 ${count} ${data.name}`);
//     }

//     setCursor(type)
//     {
//         this.scene.events.emit('cursor', type);
//     }


//     use(slot)
//     {        
//         //let dat = ItemDB.get(item.id);
//         let dat = slot.dat;
//         if(dat.cat == 'useable')
//         {
//             this.role.use(slot);
//         }
//         else
//         {
//             this.unequip(dat.cat);
//             //this.role.use(item, container);    // 要先執行這行，計算正確的裝備屬性
//             this.role.use(slot)
//             let equip;
//             if(dat.cat == 'weapon')
//             {
//                 let dmg = this.role.damage;
//                 equip = eval(`new ${dat.use.class}(this.scene, dat, dmg, [this])`);      
//                 this._weapon = equip;
//                 UiWeaponState.show(dat.icon, '0');
//                 this.setCursor(this._weapon.aim?'aim':'melee');
//             }
//             else
//             {
//                 let [atlas, frame] = dat.icon.split('/');
//                 equip = this.scene.add.sprite(dat.use.x, dat.use.y, atlas, frame)
//                                         .setScale(dat.use.scl)
//                 this._parts[dat.cat] = equip;
//             }

//             equip.setDepth(_dLut[dat.cat]);
//             this.add(equip);
//             this.sort('depth');
//         }

//     }

//     unequip(cat, drop=false)
//     {
//         if(this.role.equips[cat])
//         {
//             this.role.unequip(cat, drop);
//             if(cat == 'weapon')
//             {
//                 this._weapon.destroy();
//                 this._weapon = null;
//                 UiWeaponState.hide();
//                 this.setCursor('none');
//             }
//             else
//             {
//                 this._parts[cat].destroy();
//                 this._parts[cat] = null;
//             }
//         }
//     }

//     pickup(go)
//     {
//         let count = go.data.get('count');
//         let rem = this.role.add(go.data.get('id'), count);
//         if(rem==count){UiMessage.show(`背包已滿!!!`);}
//         else{UiMessage.show(`撿起 ${count-rem} ${go.data.get('name')}`);}
//         if(rem>0){go.data.set('count', rem);} 
//         else{go.destroy();}
//     }

//     buy(slot, count)
//     {
//         let [state,text] = this.role.buy(slot, count);
//         if(state){UiMessage.show(`購買 ${count} ${slot.label}`)}
//         else{UiMessage.show(text)};    
//         return state;
//     }

//     sell(slot, count)
//     {
//         this.role.sell(slot, count);
//         UiMessage.show(`出售 ${count} ${slot.label}`);
//     }
    
//     static drop(slot, count)
//     {
//         if(Player.instance){Player.instance.drop(slot, count);}
//     }

//     static drop_equip(cat)
//     {
//         if(Player.instance){Player.instance.drop_equip(cat);}
//     }

//     static use(item)
//     {
//         if(Player.instance){Player.instance.use(item);}
//     }

//     static unequip(cat)
//     {
//         if(Player.instance){Player.instance.unequip(cat);}
//     }

//     static buy(slot, count)
//     {
//         if(Player.instance){return Player.instance.buy(slot,count);}
//     }

//     static sell(slot, count)
//     {
//         if(Player.instance){Player.instance.sell(slot,count);}
//     }

// }


// export class Player 
// {
//     static instance = null;
//     constructor(id)
//     {
//         Player.instance = this;
//         let role = RoleDB.get(id);
//         this.addData(role, id);
//     }

//     static get pos() {return Player.instance.pos;}
//     //static getBounds() {return Player.instance.getBounds();}
//     static get role() {return Player.instance.role;}
//     static get dead() {return Player.instance.dead;}

//     avatar(scene, x, y)
//     {
//         return new Npc(scene, this.role.data.id, {x:x, y:y, data:this.role});
//     }

//     addData(role, id)
//     {
//         this.role = new RoleData(role, id);

//         this.role.gold = 1000;
//         this.role.bag = {
//             capacity: 15,
//             items: [  
//                         {id:'itempack_0', count:2}, 
//                         {id:'itempack_1', count:3}, 
//                         {id:'axe', count:1},
//                         {id:'sword', count:1},
//                         {id:'helmet', count:1},
//                         {id:'chestplate', count:1},
//                         {id:'dagger', count:1},
//                         {id:'itempack_2', count:1},
//                     ]
//         };
        
//         this.role.calc_equip();

//     }

//     load(data)
//     {
//         if(data)
//         {
//             this.role.load(data);
//             this.role.calc_equip();
//         }
//     }

//     drop(slot, count)
//     {
//         this.role.remove(slot, count);
//         UiMessage.show(`丟棄 ${count} ${slot.label}`);
//     }

//     drop_equip(cat)
//     {
//         let id = this.role.get_equip(cat);
//         this.unequip(cat, true);
//         let count = 1;
//         let data = ItemDB.get(id);
//         UiMessage.show(`丟棄 ${count} ${data.name}`);
//     }

//     use(slot)
//     {        
//         //let dat = ItemDB.get(item.id);
//         let dat = slot.dat;
//         if(dat.cat == 'useable')
//         {
//             this.role.use(slot);
//         }
//         else
//         {
//             this.unequip(dat.cat);
//             this.role.use(slot)
//         }

//     }

//     unequip(cat, drop=false)
//     {
//         if(this.role.equips[cat])
//         {
//             this.role.unequip(cat, drop);
//         }
//     }

//     buy(slot, count)
//     {
//         console.log(slot,count);
//         let [state,text] = this.role.buy(slot, count);
//         console.log(state,text);
//         if(state){UiMessage.show(`購買 ${count} ${slot.label}`)}
//         else{UiMessage.show(text)};    
//         return state;
//     }

//     static save()
//     {
//         return Player.instance.role.save();
//     }

//     static drop(slot, count)
//     {
//         if(!Player.instance){Player.instance=new Player('knight');}
//         if(Player.instance){Player.instance.drop(slot, count);}
//     }

//     static drop_equip(cat)
//     {
//         if(!Player.instance){Player.instance=new Player('knight');}
//         if(Player.instance){Player.instance.drop_equip(cat);}
//     }

//     static use(item)
//     {
//         if(!Player.instance){Player.instance=new Player('knight');}
//         if(Player.instance){Player.instance.use(item);}
//     }

//     static unequip(cat)
//     {
//         if(!Player.instance){Player.instance=new Player('knight');}
//         if(Player.instance){Player.instance.unequip(cat);}
//     }

//     static avatar(scene, x, y)
//     {
//         if(!Player.instance){Player.instance=new Player('knight');}
//         if(Player.instance){return Player.instance.avatar(scene, x, y);}
//     }

//     static buy(slot, count)
//     {
//         if(Player.instance){return Player.instance.buy(slot,count);}
//     }

// }


export class Player
{
    static instance = null;
    constructor()
    {
        Player.instance = this;
    }

    get gold() {return this.data.gold;}
    set gold(value) {return this.data.gold=value;}

    static get data() {return Player.instance.data;}

    buy(seller, gold)
    {
        console.log(seller.gold, gold)
        if(this.gold < gold){return false;}
        this.gold -= gold;
        seller.gold += gold;
        console.log(this.gold)
        return true;
    }

    sell(buyer, gold)
    {
        console.log(buyer.gold, gold)
        if(buyer.gold < gold){return false;}
        this.gold -= gold;
        buyer.gold += gold;
        console.log(this.gold)
        return true;
    }

    load()
    {
        this.data = Record.data.player;
        console.log(this.data);
    }

    save()
    {
        Record.data.player = this.data;
    }

    static buy(seller,gold)
    {
        if(Player.instance) {return Player.instance.buy(seller,gold);}
    }

    static sell(seller,gold)
    {
        if(Player.instance) {return Player.instance.sell(seller,gold);}
    }

    static load()
    {
        if(!Player.instance) {new Player();}
        Player.instance.load();
    }

    static save()
    {
        if(Player.instance) {Player.instance.save();}
    }

    
}



export class Role_old extends Phaser.GameObjects.Container
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.scene = scene;
        scene.add.existing(this);
        this._path = [];
        this._des = null;
        this._act = '';
        this._resolve;
        this._weight = 0;
        this.id = '';
    }

    get pos()       {return {x:this.x,y:this.y};}
    set pos(value)  {this.x=value.x;this.y=value.y;}
    get moving()    {return this._des!=null;}

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
        //console.log(key,frame);
        let sp = this.scene.add.sprite(0,16,key,frame).setOrigin(0.5,1);
        this.setSize(sp.width,sp.height);
        this.add(sp);
        this._sp = sp;
    }

    setPosition(x,y) // map.createFromObjects 會呼叫到
    {
        super.setPosition(x,y);
    }

    setFlip(){} // map.createFromObjects 會呼叫到

    // preUpdate(time, delta){//console.log(time,delta);this.debugDraw();}

    addPhysics()
    {
        //scene.physics.world.enable(this);
        this.scene.physics.add.existing(this, false);
        this.body.setSize(this.width,this.height);
    }

    updateDepth()
    {
        let depth = this.y + this.height/2;
        this.setDepth(depth);
        //this.debug(depth.toFixed(1));
    }

    removeWeight(){this._weight!=0 && this.scene.map.updateGrid(this.pos,-this._weight);}

    addWeight(){this._weight!=0 && this.scene.map.updateGrid(this.pos,this._weight);}

    addToRoleList() {this.scene.roles.push(this);}

    setDes(des, act)
    {
        let rst = this.scene.map.getPath(this.pos, des, act);
        if(rst && rst.valid)
        {
            this._path = rst.path;
            this._des = des; 
            this._act = act;
            this.resume();
        }
        else
        {
            this.stop();
        }
    }

    async moveTo({duration=200,ease='expo.in',draw=true}={})
    {
        if(this._path.length==0) {return;}
        let path = this._path;
        if(path[0].act=='go')
        { 
            let pt = path[0].pt;
            if(this.scene.map.isValid(pt))
            {
                if(draw) {this.drawPath(path);}
                this.removeWeight();
                await this.step(path[0].pt,duration,ease);
                this.addWeight();
                this.updateDepth();
                path.splice(0,1);
                if(path.length>0) {return;}
            }
        }
        else
        {
            this.interact(path[0].pt,path[0].act)
        }

        this.stop();
    }

    stop()
    {
        this._des = null;
        if(this._dbgPath){this._dbgPath.clear();}
    }

    step(pos, duration, ease)
    {
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this,
                x: pos.x,
                y: pos.y,
                duration: duration,
                ease: ease,
                //delaycomplete: 1000,
                onComplete: (tween, targets, gameObject)=>{resolve();}         
            });
        });
    }

    interact(pt, act)
    {
        let bodys = this.scene.physics.overlapCirc(pt.x, pt.y, 5, true, true);
        bodys.forEach((body) => {body.gameObject.emit(act);});
    }

    async pause() {this._resolve = await new Promise((resolve)=>{this._resolve=resolve;});}

    resume() {this._resolve?.(null);}

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
            if(node.act=='go')
            {
                let circle = new Phaser.Geom.Circle(node.pt.x, node.pt.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            }
        })
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            console.log('debugDraw');
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'Role';
        }

        let circle = new Phaser.Geom.Circle(this.x, this.y, 32);
        let rect = new Phaser.Geom.Rectangle(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
        this._dbgGraphics.clear()
                        .lineStyle(3, 0x00ff00)
                        //.strokeRectShape(this.getBounds())
                        //.lineStyle(1, 0xff0000)
                        //.strokeRectShape(rect)
                        //.lineStyle(3, 0x00fff00)
                        .strokeCircleShape(circle);
    }
}


export class Role extends Entity
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.weight = 1000;
        this.acts = ['talk','trade'];
        //
        this._path = [];
        this._des = null;
        this._resolve;
        //
        this.id='';
    }

    get pos()       {return {x:this.x,y:this.y};}
    set pos(value)  {this.x=value.x;this.y=value.y;}
    get moving()    {return this._des!=null;}

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
        //console.log(key,frame);
        let sp = this.scene.add.sprite(0,16,key,frame).setOrigin(0.5,1);
        this.setSize(sp.width,sp.height);
        this.add(sp);
        this._sp = sp;
    }

    addPhysics()
    {
        //scene.physics.world.enable(this);
        this.scene.physics.add.existing(this, false);
        this.body.setSize(this.width,this.height);
    }

    removeWeight(){this.weight!=0 && this.scene.map.updateGrid(this.pos,-this.weight);}

    addWeight(){this.weight!=0 && this.scene.map.updateGrid(this.pos,this.weight);}

    addToRoleList() {this.scene.roles.push(this);}

    setDes(des, act)
    {
        let rst = this.scene.map.getPath(this.pos, des, act);
        if(rst && rst.valid)
        {
            this._path = rst.path;
            this._des = des; 
            this.resume();
        }
        else
        {
            this.stop();
        }
    }

    async moveTo({duration=200,ease='expo.in',draw=true}={})
    {
        if(this._path.length==0) {return;}
        let path = this._path;
        if(path[0].act=='go')
        { 
            let pt = path[0].pt;
            if(this.scene.map.isValid(pt))
            {
                if(draw) {this.drawPath(path);}
                this.removeWeight();
                await this.step(path[0].pt,duration,ease);
                this.addWeight();
                this.updateDepth();
                path.splice(0,1);
                if(path.length>0) {return;}
            }
        }
        else
        {
            this.interact(path[0].pt,path[0].act)
        }

        this.stop();
    }

    stop()
    {
        this._des = null;
        if(this._dbgPath){this._dbgPath.clear();}
    }

    step(pos, duration, ease)
    {
        return new Promise((resolve)=>{
            this.scene.tweens.add({
                targets: this,
                x: pos.x,
                y: pos.y,
                duration: duration,
                ease: ease,
                //delaycomplete: 1000,
                onComplete: (tween, targets, gameObject)=>{resolve();}         
            });
        });
    }

    interact(pt, act)
    {
        let bodys = this.scene.physics.overlapCirc(pt.x, pt.y, 5, true, true);
        bodys.forEach((body) => {body.gameObject.emit(act);});
    }

    async pause() {this._resolve = await new Promise((resolve)=>{this._resolve=resolve;});}

    resume() {this._resolve?.(null);}

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
            if(node.act=='go')
            {
                let circle = new Phaser.Geom.Circle(node.pt.x, node.pt.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            }
        })
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            console.log('debugDraw');
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'Role';
        }

        let circle = new Phaser.Geom.Circle(this.x, this.y, 32);
        let rect = new Phaser.Geom.Rectangle(this.x-this.width/2, this.y-this.height/2, this.width, this.height);
        this._dbgGraphics.clear()
                        .lineStyle(3, 0x00ff00)
                        //.strokeRectShape(this.getBounds())
                        //.lineStyle(1, 0xff0000)
                        //.strokeRectShape(rect)
                        //.lineStyle(3, 0x00fff00)
                        .strokeCircleShape(circle);
    }
}

export class Target extends Role
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.addSprite();
        this.loop();
    }

    addSprite()
    {
        let [key,frame]=ICON_TARGET.split('/');
        this.setTexture(key,frame);
    }

    async loop()
    {
        while(true)
        {
            await this.process();
        }
    }

    async process()
    {
        if(this.moving) {await this.moveTo({duration:150,ease:'linear'});}
        else {await this.pause();}
    }

}


export class Avatar extends Role
{
    static instance;
    constructor(scene, x, y)
    {
        super(scene,x,y);
        Avatar.instance = this;
        this.weight = 1000;
        this.addSprite();
        this.setSize(32,32);
        this.addPhysics();
        this.updateDepth();
        this.addWeight();
        this.addToRoleList();
    }

    addSprite()
    {
        let [key,frame]=ICON_AVATAR.split('/');
        this.setTexture(key,frame);
    }

    async process()
    {
        if(this.moving) {await this.moveTo();}
        else
        {
            await this.pause();
            if(this.moving) {await this.moveTo();}
        }
    }

}

export class Npc extends Role
{
    init(mapName)
    {
        this.setSize(32,32);    //必須在 addPhysics() 之前執行
        super.init(mapName);
        this.addToRoleList();
        this.load();
    }
    

    load()
    {
        let roleD = RoleDB.get(this.id);
        this.owner = {role:roleD}
        let data = this.loadData();
        if(data) { this.owner.state = data; }
        else
        {
            this.owner.state = { trade:true, gold:roleD.gold, bag:this.toBag(roleD.bag) }
        }
    }

    save() {this.saveData(this.owner.state);}

    addListener()
    {
        super.addListener();
        this.on('talk',()=>{this.talk()})
    }

    talk() 
    {
        this.owner.dialog = DialogDB.get(this.id);
        this.send('talk',this.owner);
    }

    trade() {this.send('trade',this.owner);}

    async process()
    {
        this.setDes(Avatar.instance.pos);
        await this.moveTo({draw:false});
    }
}

