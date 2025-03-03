import { GameScene } from "./GameScene";
import * as Role from '../role.js';
import TimeManager from '../time.js';


export class GameMap extends GameScene
{
    constructor()
    {
        console.log('GameMap');
        super('GameMap')
    }

    async create()
    {
        await super.create({diagonal:false,classType:Role.Target,weight:0});

        
        this.lights.enable();
        this.lights.setAmbientColor(0x808080);
        
        this.process();
    }

    async process()
    {
        while(true)
        {
            await this._avatar.process();
            TimeManager.inc(60);
        }
    }
}