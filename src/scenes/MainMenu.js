import { Scene } from 'phaser'
import Record from '../infra/record.js'
import Local from '../infra/local.js'
import Lang from '../infra/lang.js'
import DB from '../data/db.js'
import UiSetting from '../ui/uisetting.js'
import UiSelect from '../ui/uiselect.js'
import UiConfirm from '../ui/uiconfirm.js'
import {GM} from '../core/setting.js';
import UiCursor from '../ui/uicursor.js'
import {DEBUG,T,dlog} from '../core/debug.js'

export class MainMenu extends Scene
{
    constructor ()
    {
        console.log('[MainMenu]');
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

        this.input.on('pointermove', (pointer) => {
            UiCursor.pos(pointer.x, pointer.y);
        })
    }


    initUI()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);
        this.add.image(screenCenterX, screenCenterY, 'logo').setOrigin(0.5);

        let y = 400;
        if(Record.hasGame()) {this.button(50, y, 'continue_game'.lab(), ()=>this.scene.start('Game')); y+=50;}
        this.button(50, y, 'new_game'.lab(), ()=>UiSelect.show()); y+=50;
        this.button(50, y, 'game_setting'.lab(), ()=>UiSetting.show());

        GM.w = this.sys.canvas.width;
        GM.h = this.sys.canvas.height;
        this.input.setDefaultCursor('none');    // 消除預設的游標
        new UiSetting(this);
        new UiSelect(this);
        new UiConfirm(this);
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
        console.log('[MainMenu] loadData')
        Record.loadSetting();
        Record.loadDebug();
        Lang.load(Lang.needsTable ? this.cache.json.get('lang') : null);
        Local.load(this);
        DB.load(this);
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
