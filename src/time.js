import Record from './record.js'
import {RoleDB,Roles} from './database.js'
import DB from './db.js'
import * as Role from './role_.js';
import Utility from './utility';
import {Npc} from './roles/npc.js'

const ticksMax = 24*60-1;
export default class TimeManager
{
    static time = {d:0,h:0,m:0};
    static ticks = 0;

    static list = [];

    static async inc(minutes = 1) 
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

        console.log('[time] inc')
        // this.emit(minutes);
        await this.aEmit(minutes);
    }

    static async aEmit(dt)
    {
        let promises=[];
        this.list.forEach( (cb)=>{promises.push(cb(dt,this.time))} )

        await Promise.all(promises);
    }

    static update()
    {
        this.emit(0);
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
        console.log('[time] start')
        this.emit(0, this.time);
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

    static checkRange(day, time, range)
    {
        // console.log(day, time, range);
        if(day != TimeManager.time.d) {return false;}
        let tt = this.time2Ticks(time);
        let r = range.split('~');
        let ts = this.str2Ticks(r[0]);
        let te = this.str2Ticks(r[1]);
        if(te<=ts) 
        {
            return (tt>=ts && tt<=ticksMax) || (tt>=0 && tt<te);
        }
        else 
        {
            return tt>=ts && tt<te;
        }
    }

    static inRange(range)
    {
        let r = range.split('~');
        let ts = this.str2Ticks(r[0]);
        let te = this.str2Ticks(r[1]);
        if(te<=ts) 
        {
            return (this.ticks>=ts && this.ticks<=ticksMax) ||
                    (this.ticks>=0 && this.ticks<te);
        }
        else 
        {
            return this.ticks>=ts && this.ticks<te;
        }
        
    }

    static atTime(t)
    {
        t = t.split('~');
        let ts = this.str2Ticks(t[0]);
        // let te = this.str2Ticks(t[1]);
        return this.ticks==ts;
        
    }

    // static time2Ticks(time)
    // {
    //     return time.h * 60 + time.m;
    // }

    static str2Ticks(str) 
    {
        let sps = str.split(':');
        let hours = parseInt(sps[0], 10);
        let minutes = parseInt(sps[1], 10);
        return hours * 60 + minutes;
    }

    static time2Ticks(time)
    {
        if(typeof time == 'string') {return this.str2Ticks(time);}
        else {return time.h * 60 + time.m;}
    }
}


export class Schedular
{
    static schedules = [];
    static scene;

    static toEnts(p)
    {
        return p.split('~').map(id=>this.scene.ents[id])
    }


    static init(scene, mapName)
    {
        this.schedules = [];
        this.scene = scene;

        Roles.list.forEach((id)=>{
            let role = DB.role(id);
            let schedule = role.schedule?.filter(sh=>sh.map===mapName)
            if(schedule.length>0) 
            {
                schedule.forEach((sh)=>{this.schedules.push({id:id,...sh});})
                this.initCheck(schedule, id, mapName);
            }
        })

    }

    static isExisted(id)
    {
        for(let role of this.scene.roles) {
            if(role.id == id) {return true;}
        }
        return false;
    }

    static initCheck(schedule, id, mapName)
    {
        let role = this.loadRole(id);   

        if(role?.exit)   
        {
            // 如果時間小於role.exit.t(時間到轉，用來 debug)，就刪除 role.exit
            if(TimeManager.ticks < TimeManager.time2Ticks(role.exit.t))
            {
                delete role.exit;
                console.log('[delete role.exit]')
            }
        }

        for(let sh of schedule)
        {
            if(TimeManager.inRange(sh.t))
            {
                if(role?.exit)
                {   
                    // 檢查 npc 離開的時間，是否在這個時間區段，如果是，表示 npc 已經離開了，不需要載入
                    if(sh.i == role.exit.sh.i && TimeManager.time.d==role.exit.t.d){return;}
                }

                let ents = this.toEnts(sh.p);
                // console.log('[time] init',id, sh.t); 
                let ent = role?.exit && role.exit.map == mapName ? this.scene.ents[role.exit.port] : ents[0];
                // let npc = new Role.Npc(this.scene, ent.pts[0].x, ent.pts[0].y);
                // npc.init_runtime(id).load().initSchedule();
                const npc = new Npc(this.scene, ent.pts[0].x, ent.pts[0].y);
                npc.init_runtime(id,true);
                return;
            }
        }

        if(role?.exit && role.exit.map===mapName)
        {
            // npc 進入這個 map，但還在離開的時間區段內，則載入 npc
            if(TimeManager.inRange(role.exit.sh.t))
            {
                let ent = this.scene.ents[role.exit.port];
                // let npc = new Role.Npc(this.scene, ent.pts[0].x, ent.pts[0].y);
                // npc.init_runtime(id).load().initSchedule();
                const npc = new Npc(this.scene, ent.pts[0].x, ent.pts[0].y);
                npc.init_runtime(id,true);
            }
        }
    }

    static check(dt,time)
    {
        // this.schedules.forEach((sh)=>{
        //     if(this.isExisted(sh.id)) {return;}
        //     if(TimeManager.atTime(sh.t))
        //     {
        //         let role = this.loadRole(sh.id);
        //         if(role?.exit)
        //         {
        //             // 檢查 npc 離開的時間，是否在這個時間區段，如果是，表示 npc 已經離開了，不需要載入
        //             if(TimeManager.checkRange(role.exit.t.d, role.exit.t, sh.t)) {return;}
        //         }
        //         let ents = this.toEnts(sh.p);
        //         console.log('[time] check',sh.id, sh.t); 
        //         let npc = new Role.Npc(this.scene,ents[0].pts[0].x,ents[0].pts[0].y);
        //         npc.init_runtime(sh.id,true).load().initSchedule();
        //     }
        // })
    }

    static loadRole(id)
    {
        return Record.data.roles?.[id];
    }
}