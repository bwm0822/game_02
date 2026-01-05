import TimeSystem from '../systems/time.js'
import {Roles} from '../database.js'
import DB from '../data/db.js'
import Record from '../infra/record.js'
import {Npc} from '../roles/npc.js'


export default class Schedular
{
    static schedules = [];
    static scene;

    static toEnts(p)
    {
        // return p.split('~').map(id=>this.scene.ents[id])
        return p.split('~').map(id=>this.scene.gos[id]);
    }


    static init(scene, mapName)
    {
        this.schedules = [];
        this.scene = scene;

        console.log('---------------------- init')

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
        console.log('---------------------- initCheck')
        let role = this.loadRole(id);   

        if(role?.exit)   
        {
            // 如果時間小於role.exit.t(時間到轉，用來 debug)，就刪除 role.exit
            if(TimeSystem.ticks < TimeSystem.time2Ticks(role.exit.t))
            {
                delete role.exit;
                console.log('[delete role.exit]')
            }
        }

        for(let sh of schedule)
        {
            if(TimeSystem.inRange(sh.t))
            {
                if(role?.exit)
                {   
                    // 檢查 npc 離開的時間，是否在這個時間區段，如果是，表示 npc 已經離開了，不需要載入
                    if(sh.i == role.exit.sh.i && TimeSystem.time.d==role.exit.t.d){return;}
                }

                let ents = this.toEnts(sh.p);
                // console.log('[time] init',id, sh.t); 
                // let ent = role?.exit && role.exit.map == mapName ? this.scene.ents[role.exit.port] : ents[0];
                let ent = role?.exit && role.exit.map == mapName ? this.scene.gos[role.exit.port] : ents[0];

                const npc = new Npc(this.scene, ent.pts[0].x, ent.pts[0].y);
                npc.init_runtime(id,true);
                return;
            }
        }

        if(role?.exit && role.exit.map===mapName)
        {
            // npc 進入這個 map，但還在離開的時間區段內，則載入 npc
            if(TimeSystem.inRange(role.exit.sh.t))
            {
                // let ent = this.scene.ents[role.exit.port];
                let ent = this.scene.gos[role.exit.port];
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
        return Record.game.roles?.[id];
    }
}