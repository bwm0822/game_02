import { Scene } from 'phaser'
import Record from '../infra/record.js'
import QuestManager from '../manager/quest.js'


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
        Record.loadGame();// 執行後，其他 scene 不用再執行 Record.loadGame()
        QuestManager.load();
    }

    gotoScene() 
    {
        let config = {map:Record.game.map,ambient:Record.game.ambient}
        if(Record.game.pos) {config.pos = Record.game.pos;}
        else {config.port = Record.game.default;}

        this.scene.start(Record.game.map=='map'?'GameMap':'GameArea',config);
    }



}


