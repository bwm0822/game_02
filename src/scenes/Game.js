import { Scene } from 'phaser';
import * as Role from '../role';
import Utility from '../utility';
import Battle from '../battle.js';
import Record from '../record';


export class Game extends Scene
{
    constructor ()
    {
        super('Game');
        this._done = false;
    }

    create ()
    {
        if(!this._done)
        {
            this._done = true;
            this.scene.launch('UI');
            //this.cameras.main.setBackgroundColor(0x555555);
            this.loadRecord();
        }

        this.gotoScene();
    }

    loadRecord()
    {
        Record.load();
        new Role.Player('knight').load(Record?.data?.role);
    }

    gotoScene() 
    {
        if(!Record.data.node){Record.data.node='0';}
        if(!Record.data.map){Record.data.map='';}
        if(Record.data.map)
        {
            this.scene.start('GameTown',{id:Record.data.node,map:Record.data.map});
        }
        else
        {
            this.scene.start('GameMap',{id:Record.data.node});
        }
    }



}


