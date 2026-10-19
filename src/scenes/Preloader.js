import { Scene } from 'phaser';
import Map from '../manager/map.js';
import Record from '../infra/record.js';
import Lang from '../infra/lang.js';

export class Preloader extends Scene
{
    constructor ()
    {
        console.log('[Preloader]');
        super('Preloader');
    }

    init ()
    {
        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;
        //console.log(screenCenterX, screenCenterY);

        //  We loaded this image in our Boot Scene, so we can display it here
        this.add.image(screenCenterX, screenCenterY, 'background').setOrigin(0.5);

        //  A simple progress bar. This is the outline of the bar.
        this.add.rectangle(screenCenterX, screenCenterY, 468, 32).setStrokeStyle(1, 0xffffff);

        //  This is the progress bar itself. It will increase in size from the left based on the % of progress.
        const bar = this.add.rectangle(screenCenterX-230, screenCenterY, 4, 28, 0xffffff);

        //  Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
        this.load.on('progress', (progress) => {
            //  Update the progress bar (our bar is 464px wide, so 100% = 464px)
            bar.width = 4 + (460 * progress);
        });
    }

    preload ()
    {
        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        // 圖片清單由 scripts/textures.js 掃 textures/ 產生，json 載完才排入圖
        this.load.once('filecomplete-json-textures', (key, type, tex) => {
            for (const [k, url] of Object.entries(tex.image)) {this.load.image(k, url);}
            for (const [k, s] of Object.entries(tex.sheet)) {this.load.spritesheet(k, s.url, {frameWidth: s.w, frameHeight: s.h, margin: s.margin, spacing: s.spacing});}
            for (const [k, a] of Object.entries(tex.atlas)) {this.load.atlas(k, a.url, a.json);}
        });
        this.load.json('textures', 'json/textures.json');

        // this.load.plugin('rexbbcodetextplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbbcodetextplugin.min.js', true);
        // this.load.plugin('rextexteditplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rextexteditplugin.min.js', true);

        this.load.json('local', 'json/local.json');
        this.load.json('item', 'json/item.json');
        this.load.json('role', 'json/role.json');
        this.load.json('dialog', 'json/dialog.json');
        this.load.json('skill', 'json/ability.json');
        this.load.json('sk_tree', 'json/ab_tree.json');
        this.load.json('fx', 'json/fx.json');
        this.load.json('navgraph', 'json/navgraph.json');
        this.load.json('story', 'json/story.json');
        Record.loadSetting();
        if(Lang.needsTable) {this.load.json('lang', `lang/${Lang.code}.json`);}
        this.load.json('world', 'maps/main.world');

        // audios
        this.load.audio('doorClose', 'audios/scene/doorClose_1.ogg');
        this.load.audio('doorOpen', 'audios/scene/doorOpen_1.ogg');
        this.load.audio('drop', 'audios/scene/dropLeather.ogg');
        this.load.audio('chop', 'audios/scene/chop.ogg');
        this.load.audio('harvest', 'audios/scene/handleSmallLeather2.ogg');
        this.load.audio('bgm', 'audios/music/今夜妳會不會來.mp3');

    }

    async create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        this.scene.start('MainMenu')
    }
}
