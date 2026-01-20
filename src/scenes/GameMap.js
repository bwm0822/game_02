import { GameScene } from "./GameScene"
import {GM,UI,DEBUG} from '../core/setting.js'
import {Player} from '../roles/player.js'
import TimeSystem from '../systems/time.js'
import UiTime from '../ui/uitime.js'
import UiMain from '../ui/uimain.js'

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
        // await super.create({diagonal:false,classType:Role.Target,weight:0});  
        await super.create({diagonal:false,classType:Player,weight:0});              
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
        TimeSystem.register(UiTime.updateTime.bind(UiTime))
    }

    async process()
    {
        while(true)
        {
            await GM.player.process();
            TimeSystem.inc(60);
        }
    }
}