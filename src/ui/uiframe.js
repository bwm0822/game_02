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
//  參數 : 
//  config = {
//      cover: true,
//  }
//--------------------------------------------------
export default class UiFrame extends Sizer
{
    constructor(scene, config, layername)
    {
        const {cover,...cfg}=config;
        super(scene, cfg);
        if(cover)   // 產生 container,將 cover 及 UiFrame 都加入
        {
            this.createCon(scene, layername);
        }
        else
        {
            if(layername) {Ui.addLayer(scene, layername, this);}
            else {scene.add.existing(this);}
        }
        
    }

    send(event, ...args) {this.scene.events.emit(event, ...args);}

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}

    addBg(scene,config)
    {
        const onover = ()=>{
            UiCursor.set(); 
            Mark.close();
            getPlayer().hidePath();
        }

        ui.uBg.call(this,scene,{interactive:true,onover:onover,...config})

        return this;
    }

    // 新增 container，將 rect 及 uiFrame 都加入這個 container 之下
    createCon(scene, layername)
    {
        // 1. 產生 container
        const con = scene.rexUI.add.container();

        // 2. 產生 rect，全螢幕大小，點擊時 close
        const config =
        {
            x: GM.w/2,
            y: GM.h/2,
            width: GM.w,
            height: GM.h,
            // color: GM.COLOR_RED,
            alpha: 0,
            interactive: true,
            ondown: ()=>{this.close()}
        }
        const rect = ui.uRect(scene, config)

        // 3. container 加入 rect 及 uiFrame 
        con.add(rect).add(this)    

        // 4. 將 container 加入 layer
        Ui.addLayer(scene, layername, con);

        // 5. 
        this._con=con;
    }

    hide()
    {
        if(this._con) {this._con.visible=false;} 
        else {super.hide();}
    }

    show()
    {
        if(this._con) {this._con.visible=true;} 
        else {super.show();}
    }

    close() {this.hide();}

}
