import { Scene } from 'phaser';
import Record from '../record';
import QuestManager from '../quest.js';


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
        this.loadRecord();
        this.scene.launch('UI');
        this.gotoScene();
    }

    loadRecord()
    {
        Record.load();// 執行後，其他 scene 不用再執行 Record.load()
        QuestManager.load();
    }

    gotoScene() 
    {
        let config = {map:Record.data.map,ambient:Record.data.ambient}
        if(Record.data.pos) {config.pos = Record.data.pos;}
        else {config.port = Record.data.default;}

        this.scene.start(Record.data.map=='map'?'GameMap':'GameArea',config);
    }



}


