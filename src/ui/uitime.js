import UiFrame from "./uiframe"
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'

export default class UiTime extends UiFrame
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w-60,
            y : GM.h-70,
            orientation: 'y',
            // space:{top:10,bottom:10,left:10,right:10,item:10},
        }

        super(scene, config ,'UiTime')
        UiTime.instance=this;
        this.scene=scene;
        this.addBg(scene)
            .addTime(scene)
            .setOrigin(1,1)
            .layout()
    }

    addTime(scene)
    {
        this.time = ui.uBbc.call(this,scene,{text:'D1 10:01'});
        return this;
    }

    static updateTime(dt,time)
    {
        let h = String(time.h).padStart(2, '0');
        let m = String(time.m).padStart(2, '0');
        this.instance.time.setText(`D${time.d} ${h}:${m}`);
    }
}