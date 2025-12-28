import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import {Block} from './uiclass.js'

export default class UiObserve extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : 300,
            // height : 300,
            orientation : 'y',
            space:UI.SPACE.FRAME,
            cover: {alpha:0.5},
        }

        super(scene, config, UI.TAG.OBSERVE);
        UiObserve.instance = this;

        this.addBg(scene)
            // .addTop(scene)
            .addContent(scene)
            .layout()
            .hide()

        // this.unit_test();

    }

    unit_test()
    {
        const content=this._content;
        const scene=this.scene;

        content.removeAll(true)
        ui.uBbc.call(content,scene,{text:'karen'})
        ui.uDiv.call(content,scene,{expand:true})
        ui.uStat.call(content,scene,'life',100,{interactive:false})

        ui.uDiv.call(content,scene)
        const p=ui.uPanel.call(content,scene,{ext:{expand:true}})
        ui.uBbc.call(p,scene,{text:'效果'})

        const fix = ui.uFix.call(content,scene,{space:UI.SPACE.TBIL.p5,ext:{expand:true}})
        fix.add(ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY}))
            .add(ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY}))
            .add(ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY}))
            .add(ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY}))
            .add(ui.uRect(scene,{width:50,height:50,color:GM.COLOR.GRAY}))


        ui.uDiv.call(content,scene)
        ui.uDes.call(content,scene,'每天從村外的田地或森林帶回最新鮮的農作物，推著小車叫賣，聲音又甜又響亮～');

        this.layout();
        return;
    }

    addContent(scene)
    {
        const config=
        {
            bg:UI.BG.BORDER,
            orientation:'y',
            height:100,
            space:10,
            ext:{expand:true}
        }
        this._content=ui.uPanel.call(this,scene,config)

        return this;
    }

    update()
    {
        const content=this._content;
        const scene=this.scene;

        content.removeAll(true)

        // name
        ui.uBbc.call(content,scene,{text:this.owner.id.lab()})
        
        // hp
        ui.uDiv.call(content,scene,{expand:true})
        const total = this.owner.total;
        let value = `${total.states[GM.HP]}/${total[GM.HPMAX]}`;
        ui.uStat.call(content,scene,GM.HP.lab(),value,{interactive:false})

        // actives
        if(this.owner.actives?.length>0)
        {
            ui.uBbc.call(content,scene,{text:'效果'});
            ui.uDiv.call(content,scene);
            const size=50;
            const config=
            {
                width : (size+5)*5,
                space: {item:5, line:5},
            }
            const fix=ui.uFix.call(content,scene,config);

            this.owner.actives.forEach(effect=>{
                if(effect.icon){fix.add(new Block(this.scene,size,size,effect));}
            })
        }

        // des
        ui.uDiv.call(content,scene,{expand:true})
        ui.uDes.call(content,scene,this.owner.id.des());

        // layout
        this.layout();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
    }

    static show(owner) {this.instance?.show(owner);}
}