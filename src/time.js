import Record from './record.js'
import {RoleDB,Roles} from './database.js'
import DB from './db.js'
import * as Role from './role.js';


export default class TimeManager
{
    static time = {d:0,h:0,m:0};
    static ticks = 0;

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

        this.ticks = this.time2Ticks(this.time);

        this.emit(minutes);
    }

    static set(type,val)
    {
        if(type in this.time)
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

    static emit(dt)
    {
        this.list.forEach((cb)=>{cb(dt,this.time);})
    }

    static start()
    {
        this.emit(0,this.time);
    }

    static load()
    {
        if(Record.data.time) 
        {
            this.time = Record.data.time;
            this.ticks = this.time2Ticks(this.time);
        }
        this.list = [];
    }

    static save()
    {
        Record.data.time = this.time;
    }

    static inRange(range)
    {
        let t0 = this.str2Ticks(range[0]);
        let t1 = this.str2Ticks(range[1]);
        return this.ticks>=t0 && this.ticks<t1;
        
    }

    static time2Ticks(time)
    {
        return time.h * 60 + time.m;
    }

    static str2Ticks(str) 
    {
        let sps = str.split(':');
        let hours = parseInt(sps[0], 10);
        let minutes = parseInt(sps[1], 10);
        return hours * 60 + minutes;
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
            // let role = RoleDB.get(id);
            let role = DB.role(id);
            let schedule = role.schedule?.[mapName];
            if(schedule)
            {
                let found = schedule.find((s)=>{return s.type=='stay' && TimeManager.inRange(s.range);});
                if(found)
                {
                    let pt = this.scene.ports[found.pos]?.pt;
                    if(pt)
                    {
                        let npc = new Role.Npc(scene,pt.x,pt.y);
                        npc.init_runtime(id).load();
                    }
                }

                let filter = schedule.filter((s)=>{return s.type=='enter'});
                filter.forEach( (s)=>{this.schedules.push({id:id,...s,cd:0});} )
                
            }
        })
    }

    static check()
    {
        //console.log('check',Schedular.schedules);
        this.schedules.forEach((sh)=>{
            if(sh.cd==0 && TimeManager.inRange(sh.range))
            {
                sh.cd=60;
                let pt = this.scene.ports[sh.from]?.pt;
                if(pt)
                {
                    let npc = new Role.Npc(this.scene,pt.x,pt.y);
                    npc.init_runtime(sh.id).load();
                }
            }
            else if(sh.cd>0) {sh.cd--;}
        })
    }
}