import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI,DEBUG} from '../setting.js'
import Record from '../record.js'

const E={CHK:'check',DD:'dropdown'};

export default class UiSettings_1 extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 500,
            // height: 300,
            orientation : 'y',
            space : {left:10,right:10,bottom:10},
        }

        super(scene, config , UI.TAG.SETTINGS)
        UiSettings_1.instance=this;
        this.addBg(scene)
            .addTop(scene)
            .addTabs(scene)
            .addPage(scene)
            .layout()
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
                    btns: [{text:'主要',name:'main'},{text:'其他',name:'other'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage();}
                })
        
        return this;
    }

    addPage(scene)
    {
        const config=
        {
            bg:{},
            height: 300,
            space:{...UI.SPACE.LRTB_10,item:30},
            ext:{expand:true},
            hideUnscrollableSlider:true,
        }
        this._page = ui.uScroll.call(this,scene,config)

        return this;
    }

    updatePage()
    {
        if(this._tab==='main') {this.page_Main();}
        else if(this._tab==='other') {this.page_Other();}

        this.layout();
    }



    page_Main()
    {
        const options = [{text:'中文',value:'tw'},
                        {text:'ENGLISH',value:'us'},]
        const scene = this.scene;
        const elm=this.element.bind(this);
        this._page.clearAll();

        this//.addElm(elm(E.DD,'🌐',Record.data,'lang',options),{expand:true})
            // .addElm(ui.uValueSlider(scene,{gap:0.2}))
            // .addElm(this.slider(['🔇','🔈','🔉','🔊'],Record.data,'sfxVolume'),{expand:false})
            // .addElm(ui.uSlider(scene,{icon:'🔇',width:200}),{expand:false})
            // .addElm(ui.uSlider(scene,{icon:['🔇','🔈','🔉','🔊'],type:UI.SLIDER.VR}),{expand:false})
            // .addElm(ui.uSlider(scene,{icon:['🔇','🔈','🔉','🔊'],type:UI.SLIDER.VL}),{expand:false})
            // .addElm(ui.uSlider(scene,{type:UI.SLIDER.VL}),{expand:false})
            // .addElm(ui.uSlider(scene,{type:UI.SLIDER.VR}),{expand:false})
            // .addElm(ui.uButton(scene,{text:'123',style:UI.BTN.CHECK}))
            // .addElm(ui.uuDropdown(scene,{parent:this}))
            // .addElm(ui.uLabel(scene,{text:'123',tcon:'🔊',space:{item:20}}))
        // ui.uuDropdown.call(this._page,scene,{
        //             title:'🌐',
        //             width:300,
        //             // ext:{align:'left'},
        //             onchange:(value)=>{this.layout()}})
        //             .setValue(Record.data.lang)

        // this._page.add(this.dropdown('🌐',Record.data,'lang'),{})
        // this._page.add(this.check('loc',DEBUG,'loc'))
        this._page.add(this.slider(['🔇','🔈','🔉','🔊'],
                            Record.data,'sfxVolume'),{})
        this._page.add(this.slider('🎵',Record.data,'bgmVolume'),{})
        // this._page.add(ui.uuBar(scene,{trackStrokeColor:GM.COLOR.RED,style:UI.BAR.DEF}))
        this._page.add(ui.uProgressBase(scene,{style:UI.PROGRESS.NBNV,height:25}).setValue(0.9));
        this._page.add(ui.uProgress(scene,{title:'hp',style:UI.PROGRESS.BGV,height:50}).setValue(0.9));


        this.layout();


    }

    addElm(elm,config)
    {
        this._page.addItem(elm,config);
        return this;
    }

    element(type, name, obj, key, options)
    {
        // if(type===E.CHK) {return this.check(name, obj, key);}
        // else if(type===E.DD) {return this.dropdown(name, obj, key, options);}
        switch(type)
        {
        
        }

    }

    dropdown(name, obj, key, options)
    {
        return ui.uDropdown(this.scene,{
                        title:name,
                        width:200,
                        options:options,
                        onchange:(v)=>{obj[key]=v;this.layout();}
                    })
                    .setValue(obj[key]);
    }

    check(name, obj, key)
    {
        return ui.uButton(this.scene, {
                        text:name, 
                        style:UI.BTN.CHECK,
                        onclick:(btn)=>{obj[key]=btn.value;}
                    })
                    .setValue(obj[key]);
    }

    // dropdown(name, obj, key, options)
    // {
    //     const p = ui.uPanel(this.scene,{width:200,space:{item:10}});
    //     ui.uBbc.call(p,this.scene, {text:name, fontSize:40});
    //     ui.uDropdown.call(p,this.scene, {options:options,
    //                     ext:{proportion:1},
    //                     onchange:(v)=>{ obj[key]=v; this.layout()}})
    //                 .setValue(obj[key]);
    //     return p;
    // }

    slider(name, obj, key, {style=UI.SLIDER.VR,dp=1}={})
    {
        return ui.uSlider(this.scene,{
                    style:style,
                    icon:name,
                    width:200,
                    dp:dp,
                    onchange:(v)=>{obj[key]=v;}
                })
                .setRange(0,1,obj[key])
    }
}