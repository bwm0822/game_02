import TimeSystem from '../systems/time.js'
import DB,{Roles} from '../data/db.js'
import Record from '../infra/record.js'
import {Npc} from '../roles/npc.js'


export default class ScheduleManager
{
    static schedules = [];
    static scene;

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
                this.createRole(id, schedule);
            }
        })
    }

    static createRole(id, schedule)
    {
        for(const sh of schedule)
        {
            if(TimeSystem.inRange(sh.t))
            {
                new Npc(this.scene).init_runtime(id);
                return;
            }
        }
    }

    static isExisted(id)
    {
        for(const role of this.scene.roles) 
        {
            if(role.id===id) {return true;}
        }
        return false;
    }

    static update()
    {
        this.schedules.forEach((sh)=>{
            if(this.isExisted(sh.id)) {return;}
            if(TimeSystem.atTime(sh.t))
            {
                const role = this.loadRole(sh.id);
                if(!role?.remove)
                {
                    new Npc(this.scene).init_runtime(sh.id);
                }
            }
        })
    }

    static loadRole(id)
    {
        return Record.game.roles?.[id];
    }
}