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
        this._done = false;
    }

    create ()
    {
        if(!this._done)
        {
            this._done = true;
            this.scene.launch('UI');
            //this.cameras.main.setBackgroundColor(0x555555);
            // this.loadRecord();
            this.loadData();
        }

        this.gotoScene();
    }

    loadData()
    {
        Local.load(this);
        DB.load(this);
        Record.load();// 執行後，其他 scene 不用再執行 Record.load()
    }

    // loadRecord()
    // {
    //     Record.load();// 執行後，其他 scene 不用再執行 Record.load()
    // }

    gotoScene() 
    {
        let config = {map:Record.data.map}
        if(Record.data.pos) {config.pos = Record.data.pos;}
        else {config.port = Record.data.default;}

        this.scene.start(Record.data.map=='map'?'GameMap':'GameArea',config);
    }



}


