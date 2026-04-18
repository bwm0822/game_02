import {GameScene} from "./GameScene.js"
import Ui from '../ui/uicommon.js'
import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import UiTime from '../ui/uitime.js'

import TimeSystem from '../systems/time.js'
import ScheduleManager from '../manager/schedule.js'
import {Player} from '../roles/player.js'
import Utility from "../core/utility.js"



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
        Ui.on(UI.TAG.MAIN);
        Ui.on(UI.TAG.EFFECT)
        TimeSystem.register(UiTime.updateTime.bind(UiTime))
    }

    initSchedule()
    {
        ScheduleManager.init(this, this.mapName);
        TimeSystem.register(ScheduleManager.update.bind(ScheduleManager));
    }

    async process()
    {
        await GM.player.process({skipTurnStart:true});
        await TimeSystem.inc();
        
        while(true)
        {
            if(this.mode=='normal')
            {
                const ps = this.roles.map(role=>role.process());
                const rs = await Promise.allSettled(ps);
                // console.log(rs);
            } 
            else
            {
                await GM.player.process();
                for(let i=0;i<this.roles.length;i++) 
                {
                    if(this.roles[i].isPlayer) {continue;}
                    await this.roles[i].process();
                }
            }
            await TimeSystem.inc();
        }
    }
}