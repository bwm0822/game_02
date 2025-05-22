import { Scene } from 'phaser';
import * as Role from '../role';
import Record from '../record';
import Local from '../local';
import DB from '../db';


export class Game extends Scene
{
    constructor ()
    {
        console.log('Game');
        super('Game');
    }

    create ()
    {
        console.log('create Game')

        this.scene.launch('UI');
        this.gotoScene();
    }

    gotoScene() 
    {
        let config = {map:Record.data.map}
        if(Record.data.pos) {config.pos = Record.data.pos;}
        else {config.port = Record.data.default;}

        this.scene.start(Record.data.map=='map'?'GameMap':'GameArea',config);
    }



}


