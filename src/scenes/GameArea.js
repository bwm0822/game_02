import { GameScene } from "./GameScene.js";
import * as Role from '../role.js';


export class GameArea extends GameScene
{
    constructor()
    {
        console.log('GameArea');
        super('GameArea');
    }

    create()
    {
        this.mode = 'normal';
        super.create({diagonal:true,classType:Role.Avatar});
        this.process();

        //new Role.Role_T(this,400,900)


        console.log(this)
    }

    async process()
    {
        let roles = this.roles;
        while(true)
        {
            if(this.mode=='normal')
            {
                await Promise.all( roles.map((role)=>{return role.process();}) );
            } 
            else
            {
                for(let i=0;i<roles.length;i++) {await roles[i].process();}
            }
        }
    }
}