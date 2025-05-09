import { Scene } from 'phaser';
import Utility from '../utility.js';
import Record from '../record';
import Local from '../local';
import DB from '../db';
import {UiSettings} from '../ui.js'

export class MainMenu extends Scene
{
    constructor ()
    {
        console.log('MainMenu');
        super('MainMenu');
        this._done = false;
    }

    create ()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);

        this.add.image(screenCenterX, screenCenterY, 'logo').setOrigin(0.5);

        this.start(50, 400);
        this.setting(50, 450);

        // new UiSettings(this);

        // this.scene.launch('UI');
        // this.cameras.main.setBackgroundColor(0x555555);
         if(!this._done)
        {
            this._done = true;
            this.loadData();
        }

    }

    button(x,y,text,cb)
    {
        let button = this.add.text(x, y, text, {
            fontFamily: 'Arial Black', fontSize: 32, color: '#ffffff',
            stroke: '#000000', strokeThickness: 10,
            align: 'center'
        })
        .setOrigin(0);

        button.setInteractive()
            .on('pointerover', () => {button.setColor('#ff0000');})
            .on('pointerout', () => {button.setColor('#ffffff');})
            .on('pointerdown', ()=>{cb&&cb()});
    }

    loadData()  // function 不能叫 load()
    {
        Local.load(this);
        DB.load(this);
        Record.load();// 執行後，其他 scene 不用再執行 Record.load()
    }

    startGame()
    {
        let config = {map:Record.data.map}
        if(Record.data.pos) {config.pos = Record.data.pos;}
        else {config.port = Record.data.default;}

        this.scene.start(Record.data.map=='map'?'GameMap':'GameArea',config);
    }

    start(x, y) 
    {
        this.button(x, y, '開始遊戲', () => {this.scene.start('Game');});
        // this.button(x, y, '開始遊戲', () => {this.startGame();});
    }



    setting(x, y)
    {
        this.button(x, y, '遊戲設定',()=>{
            UiSettings.show()
        });//, () => {this.scene.start('Setting');});
    }
}
