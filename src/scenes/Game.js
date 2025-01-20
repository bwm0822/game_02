import { Scene } from 'phaser';
import * as Role from '../role';
import Record from '../record';


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
            this.loadRecord();
        }

        this.gotoScene();
    }

    loadRecord()
    {
        Record.load();// 執行後，其他 scene 不用再執行 Record.load()
        //new Role.Player('knight').load(Record?.data?.role);
    }

    gotoScene() 
    {
        if(Record.data.map)
        {
            let config = {map:Record.data.map}
            if(Record.data.pos) {config.pos = Record.data.pos;}
            else {config.id = Record.data.default;}

            this.scene.start('GameArea',config);
        }
        else
        {
            //console.log(Record.data.node);
            this.scene.start('GameMap',{pos:Record.data.pos});
        }
    }



}


