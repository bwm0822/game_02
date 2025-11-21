import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import Ui from './uicommon.js'
import {UiCursor} from '../ui.js'
import {GM} from '../setting.js'
import {getPlayer} from '../roles/player.js'
import {Mark} from '../gameUi.js'

//--------------------------------------------------
// 類別 : UI 視窗框架
// 功能 :
//  所有 UI 視窗都繼承此框架
//--------------------------------------------------
export default class UiFrame extends Sizer
{
    constructor(scene, config, layername)
    {
        super(scene, config)
        if(layername) {Ui.addLayer(scene, layername, this);}
        else {scene.add.existing(this);}
    }

    send(event, ...args) {this.scene.events.emit(event, ...args);}

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}

    close() {this.hide();}

    addBg(scene, config={})
    {
        let {interactive, ...cfg}=config;
        interactive = interactive??true;

        const bg = ui.uBg.call(this, scene, cfg);
        if(interactive) 
        { 
            bg.setInteractive() //避免 UI scene 的 input event 傳到其他 scene
                // .on('pointerover',()=>{if(Ui.mode==GM.UI_MODE_NORMAL){UiCursor.set();clearpath();}})
                .on('pointerover',()=>{
                    UiCursor.set(); Mark.close();
                    getPlayer().hidePath();
                })
        }
    }

}
