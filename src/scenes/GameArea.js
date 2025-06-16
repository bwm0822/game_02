import { GameScene } from "./GameScene.js";
import * as Role from '../role.js';
import {UiMain, UiTime} from '../ui.js'
import TimeManager,{Schedular} from '../time.js';
import {Roles,RoleDB} from '../database.js';
import Utility from '../utility';

let lutAmbient = [   
    0x666666	,// 0x333333    ,
    0x666666	,// 0x333333    ,
    0x666666	,// 0x333333    ,
    0x666666	,// 0x333333	,
    0x666666	,
    0x999999	,
    0xcccccc	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xf0f0f0	,
    0xcccccc	,
    0x999999	,
    0x666666	,
    0x666666	,// 0x333333	,
    0x666666	,// 0x333333	,
    0x666666	,// 0x333333	,
    0x666666	,// 0x333333	,
    0x666666	,// 0x333333	,
    ]

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
        this.phyGroup = this.physics.add.group();
        this.mode = 'normal';
        //this.mode = 'combat';
        await super.create({diagonal:true,classType:Role.Avatar});       
        // await Utility.delay(5000)
        this.process();
    }

    getAmbientColor(time)
    {
        return lutAmbient[time.h];
    }

    initUI() 
    {
        super.initUI();
        UiMain.show();
        TimeManager.register(UiTime.updateTime.bind(UiTime))
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
                await Promise.all( [this._player.process(),...roles] );

                // await this._player.process();
                // let roles = this.roles.map((role)=>{return role.process();});
                // await Promise.all(roles);
            } 
            else
            {
                await this._player.process();
                for(let i=0;i<this.roles.length;i++) {await this.roles[i].process();}
            }
            TimeManager.inc();
        }
    }
}