import { Scene } from 'phaser'
import Record from '../infra/record.js'
import Local from '../infra/local.js'
import DB from '../data/db.js'
import UiSetting from '../ui/uisetting.js'
import {GM} from '../core/setting.js';
import UiCursor from '../ui/uicursor.js'

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
        // this.cameras.main.setBackgroundColor(0x555555);
        if(!this._done)
        {
            this._done = true;
            this.loadData();
        }
        this.initUI()

    }


    initUI()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);
        this.add.image(screenCenterX, screenCenterY, 'logo').setOrigin(0.5);

        this.btn_start(50, 400);
        this.btn_setting(50, 450);

        GM.w = this.sys.canvas.width;
        GM.h = this.sys.canvas.height;
        this.input.setDefaultCursor('none');    // 消除預設的游標
        new UiSetting(this);
        new UiCursor(this);
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
        Record.loadSetting();
        Local.load(this);
        DB.load(this);
    }


    btn_start(x, y) 
    {
        this.button(x, y, '開始遊戲', () => {
            this.scene.start('Game');}
        );
    }


    btn_setting(x, y)
    {
        this.button(x, y, '遊戲設定',()=>{
            UiSetting.show()
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
