import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'
import Record from '../infra/record.js'

const E={CHK:'check',DD:'dropdown'};
const item_width=350;

export default class UiSetting extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 500,
            // height: 500,
            orientation : 'y',
            space:UI.SPACE.FRAME,
        }

        super(scene, config , UI.TAG.SETTING)
        UiSetting.instance=this;
        this.addBg(scene)
            .addTop(scene,UI.TAG.SETTING)
            .addTabs(scene)
            // .addPage(scene)
            .layout()
            .hide()
            // .unit_test()
    }

    unit_test()
    {
        dlog(T.UI)('---------------------------unit_test')
        this.show()
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
                    left:[{text:'main'.lab(),name:'main'},{text:'other'.lab(),name:'other'}],
                    onclick:(btn)=>{this._tab=btn.name;this.updatePage();},
                    createpanel:()=>{return this.createPage(scene)},
                })

        this._page =  this._tabs.getElement('panel');
        
        return this;
    }

    createPage(scene)
    {
        const config=
        {
            bg:{color:GM.COLOR.PRIMARY},
            width: 500,
            height: 300,
            space:{left:10,right:10,top:30,bottom:0,item:30},
            // ext:{expand:true},
            hideUnscrollableSlider:true,
            disableUnscrollableDrag:true,
        }
        return ui.uScroll(scene,config)
    }

    updatePage()
    {
        if(this._tab==='main') {this.page_Main();}
        else if(this._tab==='other') {this.page_Other();}
        this.layout();
    }

    page_Main()
    {
        const options = [{text:'中文',value:'zh-TW'},
                        {text:'ENGLISH',value:'en'},]
        if(import.meta.env.DEV) {options.push({text:'【偽翻譯】',value:'qps'});}
        const icons = ['🔇','🔈','🔉','🔊'];
        this._page.clearAll();

        this._page.add(this.dropdown('🌐',Record.setting,'lang',options),{align:'left'})
        this._page.add(this.slider(icons,Record.setting,'sfxVolume'),{align:'left'})
        this._page.add(this.slider('🎵',Record.setting,'bgmVolume'),{align:'left'})
        // this._page.add(this.slider('🎵',Record.data,'bgmVolume'))
        // this._page.add(this.slider('🎵',Record.data,'bgmVolume'))
        this.layout();
    }

    page_Other()
    {
        this._page.clearAll();
        this._page.add(this.check('mouse_edge_move'.lab(),Record.setting,'mouseEdgeMove'),{align:'left'})
        this._page.add(this.check('pointer_lock'.lab(),Record.setting,'pointerLock'),{align:'left'})

        this.layout();

    }

    dropdown(name, obj, key, options)
    {
        return ui.uDropdown(this.scene,{
                        title:name,
                        width:item_width,
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

    slider(name, obj, key, {style=UI.SLIDER.VR,dp=1}={})
    {
        return ui.uSlider(this.scene,{
                    style:style,
                    icon:name,
                    width:item_width,
                    dp:dp,
                    onchange:(v)=>{obj[key]=v;}
                })
                .setRange(0,1,obj[key])
    }

    close()
    {
        super.close();
        Record.saveSetting();
    }

    show()
    {
        super.show();
        !this._tab&&this._tabs.init('left');
    }

    static show() {this.instance?.show();}
}