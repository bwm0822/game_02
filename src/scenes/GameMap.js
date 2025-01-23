import { GameScene } from "./GameScene";
import * as Role from '../role.js';


export class GameMap extends GameScene
{
    constructor()
    {
        console.log('GameMap');
        super('GameMap')
    }

    create()
    {
        super.create({diagonal:false,classType:Role.Target,weight:0});
    }
}