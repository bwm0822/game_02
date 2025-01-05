import { Scene } from 'phaser';
import Map from '../map.js';

export class Preloader extends Scene
{
    constructor ()
    {
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
        this.load.image('logo', 'logo.png');
        this.load.image('rip', 'rip.png');

        this.load.atlas('cursors', 'icons/cursors.png', 'icons/cursors_atlas.json');
        this.load.spritesheet('buffs', 'icons/buffs.png', { frameWidth: 64, frameHeight: 64 });
        
        //this.load.spritesheet('knight', 'Knight/Idle.png', { frameWidth: 128, frameHeight: 128 });
        this.load.atlas('knight', 'Knight/knight.png', 'Knight/knight_atlas.json');
        this.load.animation('knight_anim', 'Knight/knight_anim.json');

        this.load.atlas('items', 'items/items.png', 'items/items_atlas.json');
        this.load.spritesheet('weapons', 'items/weapons.png', { frameWidth: 32, frameHeight: 32 });

        this.load.atlas('roles_v12', 'roles/roles_v12.png', 'roles/roles_v12_atlas.json');
        this.load.atlas('hero', 'roles/hero.png', 'roles/hero_atlas.json');
        this.load.spritesheet('role', 'roles/Color A Spitesheet.png', { frameWidth: 90, frameHeight: 64 });

        this.load.tilemapTiledJSON('map', 'map.json');
        this.load.tilemapTiledJSON('town_00', 'town_00.json');
        this.load.tilemapTiledJSON('town_01', 'town_01.json');
        this.load.tilemapTiledJSON('town_02', 'town_02.json');
        this.load.tilemapTiledJSON('hole', 'hole.json');

        this.load.plugin('rexbbcodetextplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexbbcodetextplugin.min.js', true);
        
    }

    async create ()
    {
        //  When all the assets have loaded, it's often worth creating global objects here that the rest of the game can use.
        //  For example, you can define global animations here, so we can use them in other scenes.

        //  Move to the MainMenu. You could also swap this for a Scene Transition, such as a camera fade.
        //this.scene.start('MainMenu');
        //Map.preload(this, ()=>{this.scene.start('MainMenu')});
        await Map.load(this, ['map','town_00','town_01','town_02','hole']);
        this.scene.start('MainMenu')
    }
}
