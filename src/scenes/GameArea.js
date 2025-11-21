import { GameScene } from "./GameScene.js";
// import {UiMain, UiTime, UiEffect} from '../ui.js';
import {UiTime, UiEffect} from '../ui.js';
import UiMain from '../ui/uimain.js';

import TimeManager,{Schedular} from '../time.js';
// import * as Role from '../role.js';
// import {Avatar} from '../role.js';
import {Player} from '../roles/player.js';

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
        this.dynGroup = this.physics.add.group();
        this.staGroup = this.physics.add.staticGroup();
        this.mode = 'normal';
        //this.mode = 'combat';
        // await super.create({diagonal:true,classType:Avatar});   
        await super.create({diagonal:true,classType:Player});        
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
        UiEffect.show();
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
                await Promise.all( roles );
            } 
            else
            {
                await this._player.process();
                for(let i=0;i<this.roles.length;i++) 
                {
                    if(this.roles[i].isPlayer) {continue;}
                    await this.roles[i].process();
                }
            }
            await TimeManager.inc();
        }
    }
}