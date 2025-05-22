import { Scene } from 'phaser';
import Utility from '../utility.js';
import Record from '../record';
import Local from '../local';
import DB from '../db';
import {UiSettings, UiCursor} from '../ui.js'
import {GM} from '../setting.js';
import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {rect,sprite,text} from '../uibase.js'
import QuestManager from '../quest.js';

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
       
        this.initUI()

        // this.cameras.main.setBackgroundColor(0x555555);
        if(!this._done)
        {
            this._done = true;
            this.loadData();
        }

    }


    initUI()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);
        this.add.image(screenCenterX, screenCenterY, 'logo').setOrigin(0.5);

        this.start(50, 400);
        this.setting(50, 450);

        GM.w = this.sys.canvas.width;
        GM.h = this.sys.canvas.height;
        this.input.setDefaultCursor('none');    // 消除預設的游標
        new UiSettings(this);
        new UiCursor(this);

        // new UiTest(this)
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

    loadData()  // 注意: func 的名稱不能叫 load()
    {
        Local.load(this);
        DB.load(this);
        Record.load();// 執行後，其他 scene 不用再執行 Record.load()
        QuestManager.load();
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

    debug()
    {
        this.input.keyboard.on('keyup', (event) => {
            console.log(event.key)
            if(event.key=='q')
            {
                this.scene.start('Game');
            }
            else if(event.key=='a')
            {
                t.inc(this)
                console.log(this)
            }
        }); 
    }
}


class UiTest extends Sizer
{
    constructor(scene)
    {
        super(scene,0,0,GM.w,GM.h);
        
        this.addLayer(scene);
        scene.add.existing(this);

        this//.addBackground(rect(scene,{alpha:0.5}))
            .add(sprite(scene,{icon:'buffs/0'}))
            // .add(text(scene,{text:'123'}))

        this.setOrigin(0,0)
            .layout()
                
        // this.getLayer().name = 'UiTest';    // 產生layer，並設定layer名稱


        console.log('Children:', this.getAllChildren());
        console.log(this)
        console.log(scene)
    }

    addLayer(scene)
    {
        let layer = scene.add.layer();
        layer.name = 'UiTest';
        layer.add(this);   
    }

    inc(scene)
    {
        this.add(sprite(scene,{icon:'buffs/0'}))
            .layout()
    }

    destroy(...args) 
    {

        console.log('UiTest.destroy',args)
        super.destroy(args)
    }
}
