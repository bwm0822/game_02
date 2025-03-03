import Record from './record.js'
import {RoleDB,Roles} from './database.js'
import * as Role from './role.js';


export default class TimeManager
{
    static time = {d:0,h:0,m:0};

    static list = [];

    static inc(minutes = 1) 
    {
        this.time.m += minutes;

        if (this.time.m >= 60) {
            this.time.h += Math.floor(this.time.m / 60);
            this.time.m = this.time.m % 60;
        }

        if (this.time.h >= 24) {
            this.time.d += Math.floor(this.time.h / 24);
            this.time.h = this.time.h % 24;
        }

        this.emit();
    }

    static set(type,val)
    {
        if(this.time[type]) 
        {
            this.time[type] = parseInt(val, 10);
            console.log(this.time);
        }
    }

    static register(cb)
    {
        this.list.push(cb)
    }

    static unregister(cb)
    {
        let index = this.list.indexOf(cb);
        if(index>-1) {this.list.splice(index,1);}
    }

    static emit()
    {
        this.list.forEach((cb)=>{cb(this.time);})
    }

    static start()
    {
        this.emit();
    }

    static load()
    {
        if(Record.data.time) {this.time = Record.data.time;}
        this.list = [];
    }

    static save()
    {
        Record.data.time = this.time;
    }

    static inRange(range)
    {
        if(range.length == 1)
        {
            return this.time.h==range[0] && this.time.m==0;
        }
        else
        {
            return this.time.h>=range[0] && this.time.h<range[1];
        }
    }
}


export class Schedular
{
    static schedules = [];
    static scene;
    static init(scene, mapName)
    {
        this.schedules = [];
        this.scene = scene;

        Roles.list.forEach((id)=>{
            console.log(id);
            let role = RoleDB.get(id);
            let sh = role.schedule?.[mapName];
            if(sh)
            {
                let found = sh.find((s)=>{return s.type=='stay' && TimeManager.inRange(s.range);});
                if(found)
                {
                    let npc = new Role.Npc(scene,found.pos.x,found.pos.y);
                    npc.init_runtime(id).load();
                }

                let shs = sh.filter((s)=>{return s.type=='enter'});
                shs.forEach( (sh)=>{this.schedules.push({id:id,...sh});} )
                
            }
        })

        console.log(this.schedules);
    }

    static check()
    {
        //console.log('check',Schedular.schedules);
        this.schedules.forEach((sh)=>{
            if(TimeManager.inRange(sh.range))
            {
                let npc = new Role.Npc(this.scene,sh.from.x,sh.from.y);
                npc.init_runtime(sh.id).load();
            }
        })
    }
}