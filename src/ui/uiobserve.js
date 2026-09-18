import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {Ability} from './uiclass.js'
import {GM,UI} from '../core/setting.js'
import {Effect} from './uiclass.js'
import Utility from '../core/utility.js'
import {DEBUG} from '../core/debug.js'

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

    findEff(parent, id)
    {
        return parent.getElement('items').find(elm=>elm.dat.id===id);
    }
    
    addEff(parent, effect)
    {
        const elm = new Effect(this.scene,50,50,effect);
        parent.add(elm);
        return elm;
    }

    addAbilities(parent, abilities)
    {
        if(Utility.isEmpty(abilities)) {return;}
        const content=this._content;
        const scene=this.scene;
        ui.uBbc.call(parent,scene,{text:'能力'});
        ui.uDiv.call(content,scene);
        const size=50;
        const config=
        {
            width : (size+5)*5,
            space: {item:5, line:5},
        }
        const fix=ui.uFix.call(content,scene,config);
        Object.entries(abilities).forEach(([id, props]) =>{
            fix.add(new Ability(scene,size,size,{id, ...props},{bg:{}}));
        });
    }

    // debug: 顯示所有屬性(固定高度、捲動)
    addDebug(parent, total)
    {
        if(!DEBUG.enable) {return;}
        const scene=this.scene;

        ui.uDiv.call(parent,scene);
        ui.uBbc.call(parent,scene,{text:'[debug] 所有屬性',color:GM.COLOR.LIGHTGRAY})

        const scroll = ui.uScroll.call(parent,scene,{bg:{},height:200,space:5,ext:{expand:true}});
        this._statScroll = scroll;
        for(const key of GM.BASE) {ui.uStat.call(scroll,scene,key.lab(),total[key],{interactive:false})}
        for(const key of GM.COMBAT) {ui.uStat.call(scroll,scene,key.lab(),total[key],{interactive:false})}
        for(const key of GM.RESIST)
        {
            const value = `${Math.round((total.resists?.[key]??0)*100)}%`;
            ui.uStat.call(scroll,scene,key.lab(),value,{interactive:false})
        }
    }

    update()
    {
        const content=this._content;
        const scene=this.scene;

        content.removeAll(true)
        this._statScroll = null;

        // name
        ui.uBbc.call(content,scene,{text:this.owner.id.lab()})

        // favor
        const Fav=Math.floor(this.owner.getFavor(this.player.id));
        ui.uBbc.call(content,scene,{text:`好感 : ${Fav}`,
                                    color:GM.COLOR.LIGHTGRAY,
                                    ext:{padding:{top:5}}})
        // hp
        ui.uDiv.call(content,scene,{expand:true})
        const total = this.owner.total;
        let value = `${total.states[GM.HP]}/${total[GM.HPMAX]}`;
        ui.uStat.call(content,scene,GM.HP.lab(),value,{interactive:false})

        // abilities
        const abilities = this.owner.abilities;
        this.addAbilities(content, abilities);

        // actives
        const actives = this.owner.actives;
        if(actives?.length>0)
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

            actives.forEach(eff=>{
                if(eff.icon)
                {
                    const found = this.findEff(fix, eff.id);
                    if(!found) {this.addEff(fix, eff);}
                    else {found.set(eff);}
                }
            })
        }

        // des
        ui.uDiv.call(content,scene,{expand:true})
        ui.uDes.call(content,scene,this.owner.id.des());

        // debug(放最下面)
        this.addDebug(content, total);

        // layout
        this.layout();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        this._statScroll?.setT(0);
        this._statScroll?.mouseWheel(true);
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        this._statScroll?.mouseWheel(false);
    }

    static show(owner) {this.instance?.show(owner);}
}