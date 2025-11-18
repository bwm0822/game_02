import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
// import {uRect, uSprite, uBg, uBbc, uTop, uPanel, uScroll} from './uibase.js';
import * as ui from './uibase.js';
import {GM} from '../setting.js';


class UiFrame extends Sizer
{
    constructor(scene, config, layername)
    {
        super(scene, config)
        this._addToLayer(layername);
    }

    close()
    {
        console.log('close ui frame');
        this.hide();
    }

    _addToLayer(layername)
    {
        let layer = this.scene.add.layer();
        layer.name = layername;
        layer.add(this);
    }
}


export class UiTest extends UiFrame
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : GM.w/2,
            height : GM.h/2,
            orientation : 'y',
            space:{left:0,right:0,top:0,bottom:0,item:5},
        }

        super(scene, config, 'uiTest');
        ui.uBg.call(this, scene)
        ui.uTop.call(this, scene, {text:'top', color:GM.COLOR_LIGHT, onclose:this.close.bind(this)});

        let cfg_p1={
            color: GM.COLOR_DARK,
            width:50,
            height:100,
            space:{left:5,right:5,top:5,bottom:5,item:5},
        }

        let cfg_p2={
            color:GM.COLOR_BLACK,
            width:50,
            height:50
        }

        const p1 = ui.uPanel.call(this, scene, {...cfg_p1, ext:{expand:true,proportion:1}})
        // const p1 = this.add(panel(scene, cfg_p1), {expand:true,proportion:1})
        // const p2 = ui.uPanel.call(p1, scene, cfg_p2,{expand:true,proportion:1})
        const s = ui.uScroll.call(p1,scene, {bg:{},column:2})
        const p3 = ui.uPanel.call(p1, scene, {ext:{expand:true,proportion:2}})

        p3.add(ui.uProgress(scene))
            .add(ui.uBar(scene))
            .add(ui.uTextProgress(scene))
        // const s = ui.uScroll.call(p3,scene)
        // s.addItem(ui.uBbc(scene,{text:'123'}))
        //     .addItem(ui.uBbc(scene,{text:'123'}))
            // .addItem(ui.uGrid(scene,{column:1}))
        
        const grid = ui.uGrid.call(p3,scene,{bg:{}})
        grid.update((item)=>{console.log(item)})

        s.addItem(ui.uRect(scene,{width:50,height:50,color:GM.COLOR_BLACK}))
            .addItem(ui.uRect(scene,{width:50,height:50,color:GM.COLOR_BLACK}))
            .addItem(ui.uRect(scene,{width:50,height:50,color:GM.COLOR_BLACK}))

        this.layout();

    }
}