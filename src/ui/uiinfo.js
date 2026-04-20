import UiFrame from "./uiframe"
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js';
import Record from '../infra/record.js'

const WIDTH=250;
export default class UiInfo extends UiFrame
{
    static instance = null;

    constructor(scene)
    {
        let config =
        {
            x : 100,
            y : 100,
            // width : 250,
            // height : 100,
            orientation : 'y',
            space:{...UI.SPACE.LRTB.p10,item:10}
        }

        super(scene, config, UI.TAG.INFO);
        UiInfo.instance = this;
        this._w = config.width;

        this.addBg(scene,{color:GM.COLOR.DARK,...UI.BG.BORDER})
            .layout()
            .hide()
    }

    setW(wid)
    {
        this.setMinWidth(wid)
            .layout()
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

    addDes(elm, div=true)
    {
        if(elm)
        {
            const scene=this.scene;
            const des = elm.dat[this.lang]?.des;
            if(des)
            {
                div && ui.uDiv.call(this,scene);
                ui.uDes.call(this,scene,{
                        text:Utility.fmt_Des(des, elm),
                        color:GM.COLOR.GRAY},300)
            }
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
        const effs=elm.dat.effects;
        if(effs)
        {
            effs.forEach((eff)=>{
                if(!eff.stage)
                {
                    this.uStat(eff.key.lab(),Utility.fmt_Mod(eff));
                }
            })
        }

        return this;
    }

    addEffs(elm, div=true)
    {
        const effs=elm.dat.effects;
        if(effs)
        {
            let hasDiv=false;
            effs.forEach((eff)=>{
                if(!eff.stage) {return;}
                if(div&&!hasDiv) {ui.uDiv.call(this,this.scene);hasDiv=true;}
                ui.uDes.call(this,this.scene,{
                            text:Utility.fmt_Eff(eff),
                            color:GM.COLOR_GRAY},300);
            })
        }
        return this;
    }

    addActive(elm)
    {
        const eff = elm.dat;
        const stack = elm.stack;
        ui.uDes.call(this,this.scene,{
                    text:Utility.fmt_Active(eff, stack),
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
                this.uStat(key.lab(),Utility.fmt_Stat(key,value,elm));
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

    addCd(ability, div=true)
    {
        const scene=this.scene;
        div && ui.uDiv.call(this,scene);
        const p = ui.uPanel.call(this,scene,{ext:{expand:true}});
        ui.uBbc.call(p,scene,{text:ability.dat.type.lab()});
        p.addSpace();
        if(ability.dat.cd)
        {
            ui.uBbc.call(p,scene,{text:`⌛${ability.dat.cd}`});
        }

        return this;
    }

    addText(text)
    {
        ui.uBbc.call(this,this.scene,{text:text,ext:{align:'center'}});
    }

    ifAbility(elm)
    {
        this.addTitle(elm)
            .addCd(elm)
            .addStats([GM.RANGE], elm)
            .addMods(elm)
            .addDes(elm)
            .addEffs(elm,false)
            .setW(WIDTH)
    }


    ifActive(elm)
    {
        const scene=this.scene;
        const id = elm.dat.id;

        ui.uBbc.call(this,scene,{text:id.lab()});
        ui.uDiv.call(this,scene);
        this.addActive(elm)
            .setW(WIDTH)
    }

    ifSlot(elm)
    {
        this.addTitle(elm)
            .addCat(elm)
            .addMeta(elm)
            .addStats([GM.RANGE], elm)
            .addMods(elm)
            .addStats(GM.ITEMS, elm)
            .addEffs(elm)
            .addMake(elm)
            .addDes(elm)
            .addGold(elm)
            .setW(WIDTH)
    }

    ifNode(elm)
    {
        const scene = this.scene;
        let text='';
        elm.qs.forEach((q)=>{text+=`[color=yellow]${q.title()}[/color]${q.cond()}\n\n`;})
        ui.uBbc.call(this,scene,{text:text,wrapWidth:250,ext:{align:'left'}}); 
        this.setW(0)  
    }

    update(style, elm)
    {
        this.removeAll(true);

        switch(style)
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

    show(style, elm, cam)
    {
        super.show();
        let b=Utility.getBound(elm, cam);
        let [x,y]=[b.x,b.y];
        
        switch(style)
        {
            case UI.INFO.BTN:
            case UI.INFO.ACTIVE.TB:
            case UI.INFO.ABILITY.TB:
                if(y>GM.h/2) {this.setOrigin(0.5,1); y=b.t;}
                else {this.setOrigin(0.5,0); y=b.b;}
                break;
            case UI.INFO.NODE:
                this.setOrigin(0.5,1); y=b.t;
                break;
            default:
                if(x>GM.w/2) {this.setOrigin(1,0.5); x=b.l;}
                else {this.setOrigin(0,0.5); x=b.r;}
                break;
        }

        this.update(style, elm);
        this.setPosition(x,y).rePos(style, b);
    }

    rePos(style, b)
    {
        switch(style)
        {
            case UI.INFO.NODE:
                if(this.top<b.m.top) {this.setOrigin(0.5,0);this.y=b.b;}
                break;
        }
        super.rePos(b.m);
    }

    static close() {
        // console.log('close info')
        this.instance?.hide();
    }

    static show(type, elm, cam) {this.instance?.show(type, elm, cam);}



}