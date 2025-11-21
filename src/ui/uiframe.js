import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import * as ui from './uicomponents.js';
import Ui from './uicommon.js';
import {GM} from '../setting.js';

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

}
