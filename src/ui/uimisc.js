import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import {PQuest} from './pquest.js'
import {PMap} from './pmap.js'

export default class UiMisc extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            // width : 800,
            // height : 500,
            orientation : 'y',
            space:UI.SPACE.FRAME,
        }

        super(scene, config, UI.TAG.MISC);
        UiMisc.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'misc')
            .addTabs(scene)
            .layout()
            .hide()
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
            top: [{text:'任務',name:'quest'},{text:'地圖',name:'map'}],
            onclick:(btn)=>{this._pageName=btn.name;this.updatePage();},
            createpanel:()=>this.createPages(scene),
        }) 
        return this;
    }

    toMap(qid)
    {
        this._tabs.emitButtonClick('top', 1);
        this._page.setQid(qid)
    }

    createPages(scene)
    {
        const config=
        {
            orientation : 'y',
            width : 750,
            height : 400,
        }
        const p=scene.rexUI.add.sizer(config);
        this._quest = new PQuest(scene, this.toMap.bind(this));
        this._map = new PMap(scene)
        p.add(this._quest).add(this._map)
        return p;
    }

    updatePage()
    {
        this._page?.hide();

        switch(this._pageName)
        {
            case 'quest': this._page=this._quest; break;
            case 'map': this._page=this._map; break;
        }

        this._page.update();
        // this.layout();

    }

    refresh()
    {
       this.updatePage();
    }

    show(owner)
    {
        super.show();
        this._owner=owner;
        this._tabs.init();
        //
        this.closeAll(GM.UI_CENTER);
        this.register(GM.UI_CENTER);
    }

    close()
    {
        super.close();
        this.unregister();
    }

    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
    static toggle(owner) {this.instance?.toggle(owner);}
}

