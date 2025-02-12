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
        //this.mode = 'normal';
        this.mode = 'combat';
        super.create({diagonal:true,classType:Role.Avatar});
        this.process();
        //this.input.enabled = false;
        //new Role.Role_T(this,400,900)


        //console.log(this.cameras.main)
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
        }
    }
}