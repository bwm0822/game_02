import { Scene } from 'phaser';
import Utility from '../utility.js';

export class MainMenu extends Scene
{
    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);

        this.add.image(screenCenterX, screenCenterY, 'logo').setOrigin(0.5);

        this.start(50, 400);
        this.setting(50, 450);

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

    start(x, y) 
    {
        this.button(x, y, '開始遊戲', () => {this.scene.start('Game');});
    }

    setting(x, y)
    {
        this.button(x, y, '遊戲設定',()=>{console.log('setting')});//, () => {this.scene.start('Setting');});
    }
}
