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
        this.load.image('logo', 'textures/others/logo.png');
        this.load.image('rip', 'textures/others/rip.png');

        this.load.image('icon_musk', 'textures/icons/icon_musk_m.png');
        this.load.image('icon_trump', 'textures/icons/icon_trump_m.png');
        this.load.image('icon_xi', 'textures/icons/icon_xi_m.png');
        this.load.image('icon_macron', 'textures/icons/icon_macron_m.png');
        this.load.image('icon_karen', 'textures/icons/icon_karen_m.png');

        this.load.image('body-man', 'textures/roles/parts/body-man.png');
        this.load.image('hand-man', 'textures/roles/parts/hand-man.png');

        this.load.image('head-trump', 'textures/roles/parts/head-trump.png');
        this.load.image('head-wick', 'textures/roles/parts/head-wick.png');
        this.load.image('head-musk', 'textures/roles/parts/head-musk.png');
        this.load.image('head-xi', 'textures/roles/parts/head-xi.png');
        this.load.image('head-macron', 'textures/roles/parts/head-macron.png');
        this.load.image('head-melanie', 'textures/roles/parts/head-melanie.png');

        this.load.image('cloth-hood', 'textures/equips/cloth-hood.png');
        this.load.image('cloth-armor', 'textures/equips/cloth-armor.png');
        this.load.image('cloth-boots', 'textures/equips/cloth-boots.png');
        this.load.image('cloth-gloves', 'textures/equips/cloth-gloves.png');

        this.load.image('leather-helmet', 'textures/equips/leather-helmet.png');
        this.load.image('leather-armor', 'textures/equips/leather-armor.png');
        this.load.image('leather-boots', 'textures/equips/leather-boots.png');
        this.load.image('leather-gloves', 'textures/equips/leather-gloves.png');

        this.load.image('trump', 'textures/roles/npcs/trump.png');
        this.load.image('musk', 'textures/roles/npcs/musk.png');
        this.load.image('xi', 'textures/roles/npcs/xi.png');
        this.load.image('macron', 'textures/roles/npcs/macron.png');
        this.load.image('melanie', 'textures/roles/npcs/melanie.png');
        
        this.load.image('rogue', 'textures/roles/npcs/rogue.png');

        this.load.image('arrow', 'textures/others/arrow.png');


        this.load.image('blanket_v', 'textures/props/blanket_v.png');

        



        // this.load.atlas('cursors', 'textures/icons/cursors.png', 'textures/icons/cursors_atlas.json');
        this.load.spritesheet('cursors', 'textures/icons/cursors.png',{ frameWidth: 33, frameHeight: 33, margin: 1, space: 0});
        this.load.spritesheet('buffs', 'textures/icons/buffs.png', { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet('portraits', 'textures/icons/portraits.png', { frameWidth: 64, frameHeight: 64 });

        this.load.spritesheet('items1', 'textures/items/32rogues/items.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('monsters', 'textures/roles/monsters/32rogues/monsters.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('animals', 'textures/roles/animals/32rogues/animals.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('rogues', 'textures/roles/npcs/32rogues/rogues.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('Warrior_Red', 'textures/roles/npcs/tiny/Warrior_Red.png', { frameWidth: 192, frameHeight: 192 });

        this.load.spritesheet('doors', 'textures/props/doors.png', { frameWidth: 32, frameHeight: 32 });
        
        //this.load.spritesheet('knight', 'Knight/Idle.png', { frameWidth: 128, frameHeight: 128 });
        // this.load.atlas('knight', 'Knight/knight.png', 'Knight/knight_atlas.json');
        // this.load.animation('knight_anim', 'Knight/knight_anim.json');

        // this.load.atlas('icons', 'textures/icons/icons.png', 'textures/icons/icons_atlas.json');
        this.load.spritesheet('icons', 'textures/icons/icons.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('weapons', 'textures/items/weapons.png', { frameWidth: 32, frameHeight: 32 });

        this.load.atlas('roles_v12', 'textures/roles/npcs/roles_v12.png', 'textures/roles/npcs/roles_v12_atlas.json');
        this.load.atlas('hero', 'textures/roles/npcs/hero.png', 'textures/roles/npcs/hero_atlas.json');
        this.load.spritesheet('role', 'textures/roles/npcs/Color A Spitesheet.png', { frameWidth: 90, frameHeight: 64 });

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
