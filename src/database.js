import Record from './record.js';
import Utility from './utility.js';
export const ItemType = ['weapon','helmet','chestplate','useable','other'];

const ST_STA = 0b0001;      // turn start
const ST_BET = 0b0010;      // turn between
const ST_END = 0b0100;      // turn end
const ST_NXT = 0b1000;      // turn next

const E1    = 0b01000100;
const B1S1  = 0b00110011;
const BE1   = 0b01000110;
const BSE1  = 0b01000011;

export class ItemDB
{
    //{id:{name, icon, prop, descript}}
    static data = {
        'itempack_0':{name:'紅藥水', cat:'useable', icon:'items/itempack_0', price:50, cps:10, prop:{'heal':100}, descript:'這是紅藥水這是紅藥水這是紅藥水這是紅藥水這是紅藥水'},
        'itempack_1':{name:'綠藥水', icon:'items/itempack_1', price:50, cps:2, prop:{}, descript:''},
        'itempack_2':{name:'藍藥水', cat:'other', icon:'items/itempack_2', prop:{}, descript:''},
        'itempack_3':{name:'黑藥水', cat:'other', icon:'items/itempack_3', prop:{}, descript:''},
        'itempack_4':{name:'紅蘋果', cat:'other', icon:'items/itempack_4', prop:{}, descript:''},
        'itempack_5':{name:'綠蘋果', cat:'other', icon:'items/itempack_5', prop:{}, descript:''},
        

        'helmet'    :{name:'頭盔', cat:'helmet',  icon:'weapons/53',  descript:'頭盔',
                        price:500,
                        prop:{shield:5},
                        use:{x:1,y:-10,scl:1.2},
                        drop:1
                    },

        'chestplate'    :{name:'鎧甲', cat:'chestplate',  icon:'weapons/62', descript:'護甲',
                        price:800,
                        prop:{shield:10},
                        use:{x:2,y:15,scl:1.2},
                        drop:1,
                    },


        'axe'       :{name:'斧頭', cat:'weapon', type:'axe', icon:'weapons/8', descript:'斧頭', 
                        price:500,
                        prop:{damage:5}, 
                        use:{class:'Melee', x:0, y:10, anchor:{x:0.2, y:0.7}, swing:'axe_swing', hit:'axe_hit'},
                    },
        
        'sword'     :{name:'劍', cat:'weapon', type:'sword', icon:'weapons/14', descript:'劍', 
                        price:1000,
                        prop:{damage:10}, 
                        use:{class:'Melee', x:0, y:10, anchor:{x:0.2, y:0.7}, swing:'axe_swing', hit:'axe_hit'},
                    },

        'dagger' :{name:'匕首', cat:'weapon', type:'dagger', icon:'weapons/21', descript:'匕首', 
                        price:800,            
                        prop:{damage:5}, 
                        use:{class:'Melee', x:-5, y:20, anchor:{x:0.2, y:0.2}, angle:-80, swing:'axe_swing', hit:'axe_hit'},
                    },

    };

    static get(id)
    {
        if(!ItemDB.data[id]){console.error(`Item [${id}] not found!!!`); return;}
        return ItemDB.data[id];
    }
}

export class RoleDB
{
    static data = {
        'dude':{name:'dude', icon:'dude/dude_idle', descript:'', class:'Npc',
                prop:{life:100, damage:5, speed:100, mass:10},
                anim:{
                        idle:{  left:{key:'dude_idleRight',flip:true},
                                right:{key:'dude_idleRight',flip:false},
                                //up:{key:'dude_idleRight',flip:false},
                                down:{key:'dude_idle',flip:false}},

                        walk:{  left:{key:'dude_walk',flip:true},
                                right:{key:'dude_walk',flip:false},
                                //up:{key:'dude_walk',flip:false},
                                //down:{key:'dude_walk',flip:false}
                            },
                    }
            },

        'goblin_axe':{name:'goblin', icon:'goblin_axe/goblin_axe_0', descript:'', class:'Npc',
                prop:{life:100, damage:5, speed:50, mass:10},
                anim:{  
                        idle:{  left:{key:'goblin_axe_idle',flip:false},
                                right:{key:'goblin_axe_idle',flip:true},
                                up:{key:'goblin_axe_idle_b',flip:false},
                                down:{key:'goblin_axe_idle',flip:false}},

                        walk:{  left:{key:'goblin_axe_walk',flip:false},
                                right:{key:'goblin_axe_walk',flip:true},
                                up:{key:'goblin_axe_walk_b',flip:false},
                                down:{key:'goblin_axe_walk',flip:false}},

                        attack:{    left:{key:'goblin_axe_attack',flip:false},
                                    right:{key:'goblin_axe_attack',flip:true},
                                    up:{key:'goblin_axe_attack_b',flip:false},
                                    down:{key:'goblin_axe_attack',flip:false}},
                        
                        dead:{  left:{key:'goblin_axe_dead',flip:false},
                                right:{key:'goblin_axe_dead',flip:true}},
                    }
            },

        'zombie':{name:'zombie', icon:'dude/dude_idle', descript:'', class:'Npc',
                    prop:{life:100, damage:10, speed:60, mass:10}, 
                    anim:{idleRight:'dude_idleRight', forwardRight:'dude_walk',backwardRight:'dude_walk',
                        idleUp:'dude_idle', forwardUp:'dude_idle',backwardUp:'dude_idle',
                        idleDown:'dude_idle', forwardDown:'dude_idle',backwardDown:'dude_idle'}
                },

        'knight':{  name:'knight', icon:'knight/knight_18', descript:'', class:'Npc',
                    size:{w:64,h:64}, anchor:{x:0.25,y:0.75}, faceTo:'right',
                    prop:{life:100, damage:5, speed:60, mass:10}, 
                    anim:{  idle:'knight_idle', 
                            attack:'knight_attack', 
                            dead:'knight_dead', 
                            hurt:'knight_hurt',
                            defend:'knight_defend'}
                  },

        'npc':{name:'npc',  descript:'',
                size:{w:22,h:44},
                parts:{head:{image:'bodyPack/tint1_head',x:0,y:-11,scl:0.13},
                        body:{image:'bodyPack/body',x:0,y:11,scl:0.13}},
                prop:{life:100, damage:10, speed:60, mass:10}, class:'Npc_NoAnim',
            },

        'player':{name:'player',  descript:'',
                    size:{w:22,h:44},
                    parts:{head:{image:'bodyPack/tint1_head',x:0, y:-11,scl:0.13},
                            body:{image:'bodyPack/body',x:0,y:11,scl:0.13}},
                    prop:{life:100, damage:10, speed:100, mass:10}, class:'Player',
            },

        'god_1': {  name:'天神1', icon:'roles_v12/1', descript:'', class:'Npc',
                    size:{w:64,h:128}, anchor:{x:0.5,y:0.5}, faceTo:'left',
                    prop:{life:5, damage:5, speed:60, mass:10}, 
                    actions:['shield','attack','shield','poison']
                },
        
        'god_26':{  name:'天神26', icon:'roles_v12/26', descript:'', class:'Npc',
                    size:{w:64,h:120}, anchor:{x:0.5,y:0.5}, faceTo:'left',
                    prop:{life:5, damage:5, speed:60, mass:10}, 
                    actions:['strong','attack','attack','shield','attack','cure']
                },

        'god_60':{  name:'天神60', icon:'roles_v12/60', descript:'', class:'Npc',
                    size:{w:64,h:100}, anchor:{x:0.5,y:0.5}, faceTo:'left',
                    prop:{life:5, damage:5, speed:60, mass:10}, 
                    actions:['shield','strong','attack','shield','attack','cure']
                }
    };

    static get(id)
    {
        return RoleDB.data[id];
    }

    static add(scene, id, x, y)
    {
        let dat = RoleDB.get(id);
        let role = eval(`new ${dat.class}(scene, id, x, y)`);
        return role;
    }
}

export class RoleData
{
    constructor(role, id)
    {
        this.base = role;
        this.data = 
        {
            id      : id,
            anim    : role.anim,
            buffs   : [],
            buffs_m : [],
            prop    : {damage:role.prop.damage, shield:0},
            // record
            equips  : {},                           //{weapon:'', helmet:'', chestplate:''}
            bag     : {capacity:10, items:[]},      //{capacity:10, items:[{id:'', count:1}]}
            gold    : 0,
        }
        this.initState();
        this.events=[];
    }

    // record
    get gold() {return this.data.gold;}
    set gold(value) {this.data.gold = value;}
    get equips() {return this.data.equips;}
    set equips(value) {this.data.equips = value;}
    get bag() {return this.data.bag;}
    set bag(value) {this.data.bag = value;}

    //
    get name() {return this.base.name;}
    get actions() {return this.base.actions;}

    get prop() {return this.data.prop;}
    get state() {return this.data.state;}
    get anim() {return this.data.anim;}

    get hp() {return this.data.state.life.val;}  
    get hpMax() {return this.data.state.life.max;}
    get damage() {return this.data.state.damage+this.data.state.buffs.damage;}
    get speed() {return this.data.state.speed;}

    get dead() {return this.hp <= 0;}

    get buffs() {return this.data.buffs;}
    set buffs(value) {return this.data.buffs=value;}
    get buffs_m() {return this.data.buffs_m;}
    set buffs_m(value) {this.data.buffs_m=value;}

    get shield() {return this.data.state.shield+this.data.state.buffs.shield;}
    set shield(value) {this.events['shield']?.(value);}

    get state() {return this.data.state;}

    get action() {return this.state.prepare;}

    set hp(value)
    {
        let val = Utility.clamp(value, 0, this.hpMax);
        let delta = val - this.hp;
        this.data.state.life.val = val;
        //delta!=0&&this.events['hp']?.(delta);
        this.events['hp']?.(delta);
    }

    get ap() {return this.data.ap;}
    set ap(value) {this.data.ap=value; this.events['ap']?.(value);}

    load(data)
    {
        this.gold = data.gold;
        this.bag = data.bag;
        this.equips = data.equips;
    }

    record()
    {
        return {
            gold    : this.gold,
            bag     : this.bag,
            equips  : this.equips,
        }
    }

    initState(life=0)
    {
        let role = this.base;
        this.data.state = {
            i: 0,
            life: {val:life==0?role.prop.life:life, max:role.prop.life}, 
            damage: role.prop.damage,
            shield: 0,
            buffs: {damage:0, shield:0},
        };
    }
    
    async defend(value)
    {
        await this.events['defend']?.(value);
    }

    setText(text,resolve)
    {
        this.events['text']?.(text,resolve);
    }

    setHp(value,type='')
    {
        return new Promise((resolve,reject)=>{
            let val = Utility.clamp(value, 0, this.hpMax);
            let delta = val - this.hp;
            let text = type ? `${type} ${delta}` : delta;
            this.data.state.life.val = val;
            this.events['hp']?.(delta,text,resolve);
        });
    }

    updateFlag()
    {
        return new Promise((resolve,reject)=>{
            this.events['flag']?.(this.state.prepare,this,resolve);
        });
    }

    updateBuffs()
    {
        this.events['updateBuffs']?.();
    }

    init()
    {
        //console.trace();
        console.log('init')
        this.initState(this.hp);
        this.data.state.damage = this.data.prop.damage;
        this.data.state.shield = this.data.prop.shield;
        this.buffs = [];
        this.buffs_m = []
        this.shield = this.shield;  //要放在 initState()之後
        this.hp = this.hp;
    }

    gameOver()
    {
        this.initState(this.hp);
    }

    async apply(effect)
    {
        let promises=[]
        if(effect.damage)
        {
            promises.push( this.hurt(effect.damage) );
        }
        if(effect.heal)
        {
            promises.push( this.setHp(effect.heal,'heal'.local()) );
        }
        if(effect.buffs)
        {
            promises.push( this.add_buffs(effect.buffs) );
        }

        return Promise.all(promises);

    }    

    async hurt(dmg)
    {
        if(this.data.state.buffs.shield > 0)
        {
            this.data.state.buffs.shield -= dmg;
            if(this.data.state.buffs.shield >= 0){
                await this.defend(this.shield);
                return;}
            dmg = -this.data.state.buffs.shield;
            this.data.state.buffs.shield = 0;
        }

        if(this.data.state.shield > 0)
        {
            this.data.state.shield -= dmg;
            if(this.data.state.shield >= 0){
                await this.defend(this.shield);
                return;}
            dmg = -this.data.state.shield;
            this.data.state.shield = 0;
        }

        this.shield = this.shield;
        await this.setHp(this.hp - dmg);
        
    }


    calc_equip()
    {
        //this.data.prop = Utility.deepClone(propBase);
        this.data.prop.damage = this.base.prop.damage;
        this.data.prop.shield = 0;
        
        for (let value of Object.values(this.equips))
        {
            if(value == ''){continue;}
            let dat = ItemDB.get(value);
            for (let [key, value] of Object.entries(dat.prop)) 
            {
                //console.log(`${key} : ${value}`);
                switch(key)
                {
                    case 'damage': this.data.prop.damage += value; break;
                    case 'shield': this.data.prop.shield += value; break;
                }
            }
        }

        this.data.state.damage = this.data.prop.damage;
        this.data.state.shield = this.data.prop.shield;
    }

    async prepare()
    {
        this.state.i = this.state.i >= this.actions.length ? 0 : this.state.i;
        let action = this.actions[this.state.i++];
        this.state.prepare = CardDB.get(action);
        await this.updateFlag();
    }

    async turn_start()
    {
        console.log('turn_start')
        this.data.state.buffs.shield = 0;
        this.ap = 2;
        this.shield = this.shield;    
        await this.process_buffs(ST_STA);
    }

    async turn_end()
    {
        this.data.state.buffs.damage = 0;
        return await this.process_buffs(ST_END);
    }

    async turn_next()
    {
        await this.process_buffs(ST_NXT);
        //this.data.state.buffs.shield = 0;
        //this.shield = this.shield;
    }

    async process_buffs(stage)
    {
        console.log('[process_buffs]',stage,this.buffs);
        for(let i=0;i<this.buffs.length;i++)
        {
            await this.process_buff(this.buffs[i],stage,i);
            if(this.dead){return;}

            // 检查 buff.dur 是否为 0，如果是，则从数组中移除
            if (this.buffs[i].dur === 0) {
                this.buffs.splice(i, 1);
                i--; // 调整索引以正确处理后续元素
            }
        }

    }

    add_buffs(buffs)
    {
        console.log('add_buffs');
        buffs.forEach((buff)=>{this.add_buff(buff);});
    }

    add_buff(buff)
    {
        this.events['addBuff']?.(buff);
        this.process_buff(buff,ST_BET,-1);
    }

    process_buff(buff,stage,i)
    {
        let promises=[];
        //let apply = (buff.stage & 0b1111 & stage) > 0;
        let apply = this.isApply(buff, stage);
        let next = (buff.stage>>4 & stage) > 0;
        if(apply){promises.push(this.apply_buff(buff));}
        promises.push(this.update_buff(buff,apply,next,i));
        return Promise.all(promises);
    }

    isApply(buff,stage)
    {
        let ret = (buff.stage & 0b1111 & stage) > 0;
        switch(buff.name)
        {
            case 'weak':
            case 'strong': return ret && (stage!=ST_END||buff.dur>1);
            default: return ret;
        }
    }

    async apply_buff(buff)
    {
        switch(buff.name)
        {
            case 'strong': 
                this.data.state.buffs.damage += buff.val;
                this.updateFlag();
                break;
            case 'weak': 
                this.data.state.buffs.damage -= buff.val;
                this.updateFlag();
                break;
            case 'shield': 
                this.data.state.buffs.shield += buff.val; 
                break;
            case 'poison': 
                await this.setHp(this.hp - buff.val,'中毒');
                break;
            case 'cure': 
                await this.setHp(this.hp + buff.val,'+');
                break;
        }  
    }

    async update_buff(buff,apply,next,i)
    {
        if(next) {buff.dur--;}
        if(i==-1)
        {
            if(buff.dur>0)
            {
                this.buffs.push(buff);
                //await this.events['updateBuff']?.(buff,apply);
                await this.events['updateBuff']?.(this.merge_buff(buff),apply);
            }
        }
        else
        {
            //await this.events['updateBuff']?.(buff,apply);   
            await this.events['updateBuff']?.(this.merge_buff(buff),apply);
        }
        if(apply && buff.name=='shield'){this.shield=this.shield;}
        
    }

    merge_buff(buf)
    {
        let sta={name:buf.name,icon:buf.icon,val:0,dur:0,descript:buf.descript}
        this.buffs.forEach((buff)=>{
            if(buff.name==sta.name)
            {
                sta.val+=buff.val;
                sta.dur=Math.max(sta.dur,buff.dur)
            }
        });

        let foundIndex = this.buffs_m.findIndex(buff => buff.name === sta.name);

        if(foundIndex != -1)
        {
            if (sta.dur == 0) {this.buffs_m.splice(foundIndex, 1);} 
            else {this.buffs_m[foundIndex] = sta;}
        }
        else if(sta.dur != 0)
        {
            this.buffs_m.push(sta);
        }

        //console.log(this.buffs_m);
        return sta;
    }

    on(event, callback)
    {
        this.events[event] = callback;
        return this;
    }

    off(event)
    {
        delete this.events[event];
        return this;
    }

    // checkSpace(id, count)
    // {
    //     if(this.bag.capacity == -1){return true;}
    //     let cps = ItemDB.get(id).cps??1;
    //     let capacity = (this.bag.capacity - this.bag.items.length)*cps;
    //     capacity += this.bag.items.reduce((acc, item) => {return item.id==id ? acc+cps-item.count : acc;}, 0);
    //     console.log('capacity:',capacity);
    //     return capacity >= count;
    // }

    checkSpace(id)
    {
        if(this.bag.capacity == -1){return Infinity;}
        let cps = ItemDB.get(id).cps??1;
        let capacity = (this.bag.capacity - this.bag.items.length)*cps;
        capacity += this.bag.items.reduce((acc, item) => {return item.id==id ? acc+cps-item.count : acc;}, 0);
        return capacity;
    }

    buy(slot,count)
    {
        let price = slot.price * count;
        if(this.gold < price){return [false,'金幣不夠!!!'];}
        if(this.checkSpace(slot.id) < count){return [false,'空間不夠!!!'];}

        this.gold -= price;
        slot.count -= count;
        if(slot.count <= 0){slot.remove();}
        this.add(slot.id, count);
        return [true];
    }

    sell(slot,count)
    {
        this.gold += slot.price * count;
        slot.count -= count;
        if(slot.count <= 0){slot.remove();}
    }

    use(slot)
    {
        let dat = slot.dat;
        if(dat.cat == 'useable')
        {
            this.calc_useable(dat);
        } 
        else
        {
            this.equips[dat.cat] = slot.id;
            this.calc_equip();
        }
        this.remove(slot, 1);
    }

    unequip(cat, drop)
    {
        let id = this.equips[cat];
        if(id == ''){return;}
        this.equips[cat] = '';
        if(!drop)
        {
            this.add(id, 1);
            this.calc_equip();
        }
    }

    get_equip(cat)
    {
        return this.equips[cat];
    } 

    calc_useable(dat)
    {
        for (let [key, value] of Object.entries(dat.prop)) 
        {
            switch(key)
            {
                case 'heal': this.hp += value; break;
            }
        }
    }

    // calc_equip()
    // {
    //     //this.data.prop = Utility.deepClone(propBase);
    //     this.data.state.life.max = this.base.prop.life;
    //     this.data.state.damage = this.base.prop.damage;

    //     for (let [key, value] of Object.entries(this.equips))
    //     {
    //         if(value == ''){continue;}
    //         let dat = ItemDB.get(value);
    //         for (let [key, value] of Object.entries(dat.prop)) 
    //         {
    //             //console.log(`${key} : ${value}`);
    //             switch(key)
    //             {
    //                 case 'life': this.data.state.life.max += value; break;
    //                 case 'damage': this.data.state.damage = value; break;
    //             }
    //         }
    //     }
    // }

    remove(slot, count)
    {
        slot.count -= count;
        if(slot.count <= 0){slot.remove();}
    }

    // add(id, count)
    // {
    //     let item = this.bag.find((item) => item.id == id);
    //     if(item){item.count += count;}
    //     else{this.bag.push({id:id, count:count});}
    // }

    add(id, count)
    {
        let data = ItemDB.get(id);
        let cps = data.cps??1;

        while(this.bag.capacity==-1 || this.bag.items.length<this.bag.capacity)
        {
            this.bag.items.push({id:id, count:count>cps?cps:count});
            count -= cps;
            if(count <= 0){return 0;}
        }

        for(let i=0;i<this.bag.items.length;i++)
        {
            let item = this.bag.items[i];
            if(item.id == id && item.count < cps)
            {
                count -= cps - item.count;
                if(count > 0){item.count = cps;}
                else{item.count = cps+count; return 0;}
            }
        }

        return count;
        
    }

}

export class Inventory
{
    static classify(items)
    {
        let slots = {}
        items.forEach((item)=>{
            let data = ItemDB.get(item.id);
            if(ItemType.includes(data.cat))
            {
                !slots[data.cat] && (slots[data.cat]=[]);
                slots[data.cat].push(item);
            }
            else
            {
                !slots['other'] && (slots['other']=[]);
                slots['other'].push(item);
            }
        });
        return slots;
    }

    static merge(slots, cps)
    {
        let newSlots = [];
        slots.forEach((slot)=>{
            let _cps = cps ?? ItemDB.get(slot.id).cps ?? 1;
            if(_cps==1) {newSlots.push(slot); return;}
            let rem = slot.count;
            for(let newSlot of newSlots)
            {
                if(newSlot.id==slot.id && newSlot.count<_cps) 
                {
                    rem = slot.count - (_cps - newSlot.count);
                    if(rem<=0) {newSlot.count += slot.count; return;}
                    else {newSlot.count = _cps;}
                }
            }
            if(rem>0) {newSlots.push({id:slot.id, count:rem});}
        });
        return newSlots.sort((a,b)=>a.id.localeCompare(b.id));
    }

    static combine(cats)
    {
        let newItems = [];
        ItemType.forEach((cat)=>{
            if(cats[cat]) {newItems.push(...cats[cat]);}
        });
        return newItems;
    }

    static rearrange(items)
    {        
        let cats = Inventory.classify(items);
        Object.keys(cats).forEach((cat)=>{cats[cat]=Inventory.merge(cats[cat]);});
        return Inventory.combine(cats);
    }
}

const ICON_CURE     = 'buffs/28';
const ICON_ATTACK   = 'buffs/31';
const ICON_SHIELD   = 'buffs/32';
const ICON_POISON   = 'buffs/33';
const ICON_STRONG   = 'buffs/166';
const ICON_WEAK     = 'buffs/165';

export class CardDB
{
    static data = {
        'attack':   {id:'attack',title:'攻擊',icon:ICON_ATTACK,ap:1,target:'enemy',descript:'造成[color=yellow]%dmg[/color]傷害',
                            prepare:'準備[color=yellow]攻擊[/color]，造成[color=yellow]%dmg[/color]傷害'},
        'shield':   {id:'shield',title:'防禦',icon:ICON_SHIELD,ap:1,target:'self',descript:'增加[color=yellow]%val[/color]護盾，持續%dur回合',
                            prepare:'準備施展[color=yellow]防禦[/color]',
                            buffs:[{name:'shield', stage:B1S1, val:12, dur:1, icon:ICON_SHIELD, descript:'增加[color=yellow]%val[/color]護盾'}]},
        'cure':     {id:'cure',title:'治療',icon:ICON_CURE,ap:2,target:'self',descript:'增加[color=yellow]%val[/color]護盾',
                            prepare:'準備施展[color=yellow]治療[/color]',
                            buffs:[{name:'cure', stage:B1S1, val:12, dur:1, icon:ICON_CURE}]},
        'poison':   {id:'poison',title:'下毒',icon:ICON_POISON,ap:1,target:'enemy',descript:'中毒，每回合扣[color=yellow]%val[/color]生命，持續%dur回合',
                            prepare:'準備施展[color=yellow]下毒[/color]',
                            buffs:[{name:'poison', stage:E1, val:1, dur:3, icon:ICON_POISON, descript:'回合結束時扣[color=yellow]%val[/color]生命'}]},
        'strong':   {id:'strong',title:'強壯',icon:ICON_STRONG,ap:1,target:'self',descript:'增加[color=yellow]%val[/color]傷害，持續%dur回合',
                            prepare:'準備施展[color=yellow]強化[/color]',
                            buffs:[{name:'strong', stage:BE1, val:1, dur:2, icon:ICON_STRONG,descript:'增加[color=yellow]%val[/color]傷害'}]},
        'weak':     {id:'weak',title:'虛弱',icon:ICON_WEAK,ap:1,target:'self',descript:'減少[color=yellow]%val[/color]傷害，持續%dur回合',
                            prepare:'準備施展[color=yellow]弱化[/color]',
                            buffs:[{name:'weak', stage:BE1, val:1, dur:2, icon:ICON_WEAK,descript:'減少[color=yellow]%val[/color]傷害'}]},
    }

    static get(id)
    {
        return CardDB.data[id];
    }
}


export class NodeDB
{
    static data = {
        '0': {id:'0', type:'battle', enemys:[ {id:'god_1',loc:0} ]},
        '1': {id:'1',type:'battle', enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1} ]},
        '2': {id:'2',type:'battle', enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1} ]},
        '3': {id:'3',type:'battle', enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1},{id:'god_60',loc:2} ]},
    }

    static get(id)
    {
        return NodeDB.data[id];
    }
}

export class DialogDB
{
    static data = {
        '阿修羅':
        {
            name:'阿修羅',
            0:
                {
                    text:'阿修羅:\nHi~冒險者~\n我是阿修羅，\n我有一些有挑戰性的任務，\n報酬很不錯，\n你有沒有興趣...',
                    next:'go 1',
                },
            1:
                {
                    text:[
                        '你:\n',
                        '[area=1][bgcolor=blue]沒興趣[/bgcolor][/area]\n',
                        '[area=2][bgcolor=blue]說來聽聽[/bgcolor][/area]\n',
                        ],
                    options:{1:'exit',2:'go 任務1'} ,
                },
            任務1:
                {
                    text:'阿修羅:\n殺死哥布林\n'+
                        '[area=1][bgcolor=blue]接受[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]不接受[/bgcolor][/area]\n',
                    options:{1:'save 任務1_going;quest q01;exit',2:'exit'} ,

                },
            任務1_going:
                {
                    text:['阿修羅:\n任務完成了嗎?\n',
                        {cond:false,text:'[area=1][bgcolor=blue]完成了[/bgcolor][/area]\n'},
                        '[area=2][bgcolor=blue]還沒[/bgcolor][/area]\n'],
                    options:{1:'go 任務1_close',2:'exit'} ,
                },
            任務1_close:
                {
                    text:'阿修羅:\n謝謝，請收下你的獎勵',
                    next:'go 任務2',
                },
            任務2:
                {
                    text:'阿修羅:\n任務2:殺死史萊姆，你要接嗎?\n'+
                        '[area=1][bgcolor=blue]接受[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]不接受[/bgcolor][/area]\n',
                    options:{1:'exit',2:'go 1'} ,
                }
        },
        '哥布林':
        {
            name:'哥布林',
            0:  {
                    text:'你:\n你是哥布林嗎?',
                    next:'go 1',
                },
            1:  {
                    text:'哥布林:\n滾~~~想吃拳頭嗎?',
                    next:'go 2',
                },
            2:  {
                    text:'你:\n'+
                        '[area=1][bgcolor=blue]我安排你去見上帝[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]離開[/bgcolor][/area]\n',
                    options:{1:'exit;battle 哥布林',2:'exit'} ,
                },
        }

    }

    static get(id)
    {
        return DialogDB.data[id];
    }
}

export class QuestDB
{
    static data = {
        'q01':{title:'清除哥布林',descript:'清除哥布林',rewards:{gold:100,items:[]},act:{type:'add',map:'town_01',id:'哥布林',x:100,y:100}}
    };

    static get(id)
    {
        return QuestDB.data[id];
    }

}

export class BattleDB
{
    static data = {
        '哥布林': {enemys:[ {id:'god_1',loc:0} ]},
        '1': {enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1} ]},
        '2': {enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1} ]},
        '3': {enemys:[ {id:'god_1',loc:0},{id:'god_26',loc:1},{id:'god_60',loc:2} ]},
    }

    static get(id)
    {
        return BattleDB.data[id];
    }
}


export class CharacterDB
{
    static data = {
        '哥布林': {icon:'hero/112'}
    }

    static get(id)
    {
        return CharacterDB.data[id];
    }
}
