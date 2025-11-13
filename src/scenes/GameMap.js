import { GameScene } from "./GameScene";
// import * as Role from '../role.js';
import TimeManager from '../time.js';
import {UiMain, UiTime} from '../ui.js'

let lutAmbient = [   
    0x707070    ,
    0x707070    ,
    0x707070    ,
    0x707070	,
    0x949494	,
    0xB8B8B8	,
    0xDBDBDB	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xF4F4F4	,
    0xDBDBDB	,
    0xB8B8B8	,
    0x949494	,
    0x707070	,
    0x707070	,
    0x707070	,
    0x707070	,
    0x707070	,
    ]

export class GameMap extends GameScene
{
    constructor()
    {
        console.log('GameMap');
        super('GameMap');
    }

    async create()
    {
        await super.create({diagonal:false,classType:Role.Target,weight:0});        
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

    async process()
    {
        while(true)
        {
            await this._player.process();
            TimeManager.inc(60);
        }
    }
}