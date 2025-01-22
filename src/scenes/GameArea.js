import { GameScene } from "./GameScene.js";
import * as Role from '../role.js';


export class GameArea extends GameScene
{
    constructor()
    {
        console.log('GameArea');
        super('GameArea')
    }

    create()
    {
        super.create({diagonal:true,classType:Role.Avatar});
        this.process();
    }

    async process()
    {
        let roles = this.roles;
        while(true)
        {
            for(let i=0;i<roles.length;i++)
            {
                await roles[i].process();
            }
        }
    }
}