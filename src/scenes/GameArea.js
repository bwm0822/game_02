import { GameScene } from "./GameScene.js";
import * as Role from '../role.js';
import {UiMain} from '../ui.js'
import TimeManager,{Schedular} from '../time.js';
import {Roles,RoleDB} from '../database.js';


export class GameArea extends GameScene
{
    constructor()
    {
        console.log('GameArea');
        super('GameArea');
    }

    get mapName() {return this._data.map;}

    async create()
    {
        this.mode = 'normal';
        //this.mode = 'combat';
        await super.create({diagonal:true,classType:Role.Avatar});        
        this.process();
    }

    initUI() 
    {
        super.initUI();
        UiMain.show();
    }

    initSchedule()
    {
        Schedular.init(this, this.mapName);
        TimeManager.register(Schedular.check.bind(Schedular));
    }

    async process()
    {
        while(true)
        {
            if(this.mode=='normal')
            {
                let roles = this.roles.map((role)=>{return role.process();});
                await Promise.all( [this._avatar.process(),...roles] );
            } 
            else
            {
                await this._avatar.process();
                for(let i=0;i<this.roles.length;i++) {await this.roles[i].process();}
            }
            TimeManager.inc();
        }
    }
}