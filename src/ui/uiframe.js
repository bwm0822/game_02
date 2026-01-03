import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import Ui from './uicommon.js'
import {GM} from '../core/setting.js'
import {getPlayer} from '../roles/player.js'
import {Mark} from '../gameUi.js'
import UiCursor from './uicursor.js'

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
    constructor(scene, config, tag)
    {
        const {cover,...cfg}=config;
        super(scene, cfg);

        this._tag=tag;
        Ui.addToList(this);

        if(cover)   // 產生 container,將 cover 及 UiFrame 都加入
        {
            this.genCon(scene, tag, cover);
        }
        else
        {
            if(tag) {Ui.addLayer(scene, tag, this);}
            else {scene.add.existing(this);}
        }
    }

    get tag() {return this._tag;}
    get player() {return getPlayer();}

    send(event, ...args) {this.scene.events.emit(event, ...args);}

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}
    on(tag,...args) {Ui.on(tag,...args);}
    off(tag) {Ui.off(tag);}

    addBg(scene,config)
    {
        const onover = ()=>{
            UiCursor.set(); 
            Mark.close();
            this.player?.hidePath();
        }

        config = config ?? {color:GM.COLOR.PRIMARY};
        ui.uBg.call(this,scene,{interactive:true,onover:onover,...config})

        return this;
    }

    addTop(scene,title)
    {
        ui.uTop.call(this, scene, {text:title?.lab(),
                                    onclose:this.close.bind(this)})
        return this;
    }

    // 新增 container，將 rect 及 uiFrame 都加入這個 container 之下
    genCon(scene, layername, cover)
    {
        const color = cover.color ?? GM.COLOR.PRIMARY;
        const touchClose = cover.touchClose ?? true;
        const alpha = cover.alpha ?? 0;

        // 1. 產生 container
        const con = scene.rexUI.add.container();

        // 2. 產生 rect，全螢幕大小，點擊時 close
        const config =
        {
            x: GM.w/2,
            y: GM.h/2,
            width: GM.w,
            height: GM.h,
            color: color,
            alpha: alpha,
            interactive: true,
            ondown: ()=>{touchClose&&this.close()}
        }
        const rect = ui.uRect(scene, config)

        // 3. container 加入 rect 及 uiFrame 
        con.add(rect).add(this)    

        // 4. 將 container 加入 layer
        Ui.addLayer(scene, layername, [con,rect,this]);

        // 5. 
        this._con=con;
    }

    hide()
    {
        if(this._con) {this._con.visible=false;} 
        else {super.hide();}
        return this;
    }

    show()
    {
        if(this._con) {this._con.visible=true;} 
        else {super.show();}
        return this;
    }

    close() {this.hide(); return this;}

}
