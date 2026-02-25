import { Boot } from './scenes/Boot';
import { Game } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { UI } from './scenes/UI';
import { Top } from './scenes/Top';
import { GameMap } from './scenes/GameMap';
import { GameArea } from './scenes/GameArea';
import UIPlugin from 'phaser3-rex-plugins/templates/ui/ui-plugin.js';
import BBCodeTextPlugin from 'phaser3-rex-plugins/plugins/bbcodetext-plugin.js';
import TextTypingPlugin from 'phaser3-rex-plugins/plugins/texttyping-plugin.js';
import TextPagePlugin from 'phaser3-rex-plugins/plugins/textpage-plugin.js';
import OutlinePipelinePlugin from 'phaser3-rex-plugins/plugins/outlinepipeline-plugin.js';
//import ContainerLitePlugin from 'phaser3-rex-plugins/plugins/containerlite-plugin.js';
//import TextEditPlugin from 'phaser3-rex-plugins/plugins/textedit-plugin.js';
import RoundRectangleProgressPlugin from 'phaser3-rex-plugins/plugins/roundrectangleprogress-plugin.js';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    // width: 800,
    // height: 600,
    parent: 'game-container',
    backgroundColor: '#000000',//'#028af8',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics:{
        default:'arcade',
        arcade:{
            // debug:true,
            //debug:false,
            //gravity:{y:300,}
        }
    },
    plugins: {
        scene: [{
            key: 'rexUI',
            plugin: UIPlugin,
            mapping: 'rexUI'
        },
        ],
        global: [
            {
                key: 'rexBBCodeTextPlugin',
                plugin: BBCodeTextPlugin,
                start: true
            },
            {
                key: 'rexTextTyping',
                plugin: TextTypingPlugin,
                start: true
            },
            {
                key: 'rexTextPage',
                plugin: TextPagePlugin,
                start: true
            },
            {
                key: 'rexOutlinePipeline',
                plugin: OutlinePipelinePlugin,
                start: true
            },
            // {
            //     key: 'rexTextEdit',
            //     plugin: TextEditPlugin,
            //     start: true
            // },
            {
                key: 'rexRoundRectangleProgressPlugin',
                plugin: RoundRectangleProgressPlugin,
                start: true
            },

        ]
    },
    dom: {
        createContainer: true
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        Game,
        GameMap,
        GameArea,
        UI,
        Top,
    ]
};

export default new Phaser.Game(config);
