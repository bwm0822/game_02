import UiFrame from "./uiframe"
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js';

import Record from '../infra/record.js'


export default class UiInfo extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 100,
            y : 100,
            width : 250,
            // height : 100,
            orientation : 'y',
            space:{...UI.SPACE.LRTB.p10,item:0}
        }

        super(scene, config, UI.TAG.INFO);
        UiInfo.instance = this;
        this._w = config.width;
        this._gap = 10;

        this.addBg(scene,{color:GM.COLOR.DARK,...UI.BG.BORDER})
            .layout()
            .hide()
    }

    unit_test()
    {
        ui.uBbc.call(this,scene,{text:'123'});
        ui.uDiv.call(this,scene)
        ui.uBbc.call(this,scene,{text:'123'});
        ui.uDiv.call(this,scene)
        ui.uDiv.call(this,scene)
    }

    get lang() {return Record.setting.lang;}

    uStat(key, val)
    {
        ui.uStat.call(this,this.scene,key,val,{interactive:false})
    }

    addTitle(elm)
    {
        const scene = this.scene;
        let title = elm.dat[this.lang]?.lab
        ui.uBbc.call(this,scene,{text:title??elm.dat.id});   
        return this;
    }

    addCat(elm)
    {
        if(elm.dat.cat)
        {
            const scene = this.scene;
            let cat = `[color=gray]${elm.dat.cat.lab()}[/color]`;
            ui.uBbc.call(this,scene,{text:cat});
            ui.uDiv.call(this,scene)
        }
        return this;
    }

    addDes(des, {stats,total}={}, layout)
    {
        if(des)
        {
            if(layout?.div??true) {ui.uDiv.call(this,this.scene);};
            layout?.div && (layout.div=false);
            ui.uDes.call(this,this.scene,{
                        text:Utility.fmt_Des(des, stats, total),
                        color:GM.COLOR.GRAY})
            layout && (layout.vspace=true);
        }
        return this;
    }

    addMeta(elm)
    {
        const {def,atk}=elm.dat;
        let val = def || atk;
        let key = def ? GM.DEF.lab() : GM.ATK.lab();
        if(val)
        {
            ui.uBbc.call(this,this.scene,{text:`${val} ${key}`})
            ui.uDiv.call(this,this.scene);
        }
        return this;
    }

    addMods(elm)
    {
        if(elm.dat.effects)
        {
            elm.dat.effects.forEach((eff)=>{
                this.uStat(eff.stat,Utility.fmt_Mod(eff));
            })
        }

        return this;
    }

    addProcs(elm, layout)
    {
        if(elm.dat.procs)
        {
            if(layout?.div??true) {ui.uDiv.call(this,this.scene);}
            elm.dat.procs.forEach((proc)=>{
                if(layout?.vspace) {ui.uVspace.call(this,this.scene,15);}
                ui.uDes.call(this,this.scene,{
                            text:Utility.fmt_Proc(proc),
                            color:GM.COLOR_GRAY})
                layout && (layout.vspace = true);
            })
        }

        return this;
    }

    addActive(elm)
    {
        const proc = elm.dat;
        ui.uDes.call(this,this.scene,{
                    text:Utility.fmt_Active(proc),
                    color:GM.COLOR_GRAY})
        return this;
    }

    addStats(keys, elm)
    {
        for(let key of keys)
        {
            let value = elm.dat[key];
            if(value)
            {            
                this.uStat(key,Utility.fmt_Stat(key,value,elm));
            }
        }
        
        return this;
    }

    addMake(elm)
    {
        if(!elm.dat.make) {return this;}
        ui.uDiv.call(this, this.scene);
        let text = `[color=yellow]${'required'.lab()}[/color]\n`;
        Object.entries(elm.dat.make.items).forEach(([key,value])=>{
            text+=`- ${key.lab()} (${value})\n`;
        });
        ui.uBbc.call(this,this.scene,{text:text});
        return this;
    }

    addGold(elm)
    {
        if(elm.dat.gold)
        {
            let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
            let text = `\n[color=yellow][img=gold][/color] ${(elm.content.count??1)*elm.dat.gold}`
            ui.uBbc.call(this,this.scene,{text:text,images:images,ext:{align:'right'}});
        }

        return this;
    }

    addCd(ability)
    {
        const scene=this.scene;
        const p = ui.uPanel.call(this,scene,{ext:{expand:true}});
        ui.uBbc.call(p,scene,{text:ability.dat.type.lab()});
        p.addSpace();
        if(ability.dat.cd)
        {
            ui.uBbc.call(p,scene,{text:`⌛${ability.dat.cd}`});
        }
        ui.uDiv.call(this,scene);

        return this;
    }

    addText(text)
    {
        ui.uBbc.call(this,this.scene,{text:text,ext:{align:'center'}});
    }

    ifAbility(elm)
    {
        let config = {
            des : elm.dat[this.lang]?.des,
            stats : elm.dat,
            total : this.player.total,
        }

        let layout = {div:true, vspace:false}

        this.addTitle(elm)
            .addCd(elm)
            .addStats([GM.RANGE], elm)
            .addDes(config.des, config, layout)
            .addProcs(elm, layout)
    }


    ifActive(elm)
    {
        let tag = elm.dat.tag;
        const scene=this.scene;

        ui.uBbc.call(this,scene,{text:tag.lab()});
        ui.uDiv.call(this,scene);
        this.addActive(elm);
    }

    ifSlot(elm)
    {
        this.addTitle(elm)
            .addCat(elm)
            .addMeta(elm)
            .addStats([GM.RANGE], elm)
            .addMods(elm)
            .addStats(GM.ITEMS, elm)
            .addProcs(elm)
            .addMake(elm)
            .addDes(elm.dat[this.lang].des)
            .addGold(elm)
    }

    ifNode(elm)
    {
        console.log('--------- ifNode')
        const scene = this.scene;
        ui.uBbc.call(this,scene,{text:'test'});   
    }

    update(type, elm)
    {
        this.removeAll(true)

        switch(type)
        {
            case UI.INFO.SLOT:
                if(typeof elm.dat === 'object') {this.ifSlot(elm);}
                // else {this.addText(elm.dat.des(),{align:'center'});}
                else {this.addText(elm.dat,{align:'center'});}
                break;

            case UI.INFO.PROP:
                this.addText(elm.p.des(),{align:'center'});
                break;

            case UI.INFO.BTN:
                this.addText(elm.key.lab(),{align:'center'});
                // this.addText(elm.key.des());
                break;

            case UI.INFO.ABILITY.LR:
            case UI.INFO.ABILITY.TB:
                this.ifAbility(elm)
                break;

            case UI.INFO.ACTIVE.LR:
            case UI.INFO.ACTIVE.TB:
                this.ifActive(elm)
                break;

            case UI.INFO.NODE:
                this.ifNode(elm)
                break;
        }

        this.layout()
    }

    getXY(elm)
    {
        let x=elm.x,y=elm.y;
        let p = elm.parentContainer;
        let parentX=0, parentY=0;
        while(p)
        {
            parentX+=p.x;
            parentY+=p.y;
            x+=p.x;
            y+=p.y;
            p=p.parentContainer;
        }
        return [x,y,parentX,parentY];
    }

    show(type, elm)
    {
        super.show();

        console.log(elm.x,elm.y)

        let [x,y,parentX,parentY]=this.getXY(elm);
        console.log(x,y,parentX,parentY);

        switch(type)
        {
            case UI.INFO.BTN:
            case UI.INFO.ACTIVE.TB:
            case UI.INFO.ABILITY.TB:
                if(elm.y>GM.h/2)
                {
                    this.setOrigin(0.5,1);
                    y=parentY+elm.top-this._gap;
                }
                else
                {
                    this.setOrigin(0.5,0);
                    y=parentY+elm.bottom+this._gap;
                }
                break;
            default:
                if(elm.x>GM.w/2)
                {
                    this.setOrigin(1,0.5);
                    x=parentX+elm.left-this._gap;
                }
                else
                {
                    this.setOrigin(0,0.5);
                    x=parentX+elm.right+this._gap;
                }
                break;
        }

        this.update(type, elm);

        console.log(elm)

        this.setPosition(x,y).rePos();
        this.layout();
    }

    rePos()
    {
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static close() {this.instance?.hide();}

    static show(type, elm) {this.instance?.show(type, elm);}



}