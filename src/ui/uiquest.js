import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import QuestManager from '../manager/quest.js';

export default class UiQuest extends UiFrame
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

        super(scene, config, UI.TAG.QUEST);
        UiQuest.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'quest')
            .addTabs(scene)
            // .addPage(scene)
            .layout()
            .hide()
    }

    addTabs(scene)
    {
        this._tabs = ui.uTabs.call(this, scene, {
            top: [{text:'open',name:'open'},{text:'close',name:'close'}],
            onclick:(btn)=>{this._pageName=btn.name;this.updatePage();},
            createpanel:()=>this.createPage(scene),
        })
        this._page =  this._tabs.getElement('panel');     
        return this;
    }

    createPage(scene)
    {
        const config=
        {
            bg:{color:GM.COLOR.PRIMARY},
            space:{left:5,right:5,top:5,bottom:5,item:10}, 
            width:750,
            height:400,
            // ext:{expand:true,proportion:1}
        }

        const p = ui.uPanel(scene, config);

        p.scroll = ui.uScroll.call(p, scene, {bg:{},width:200,ext:{expand:true}});

        p.content = ui.uPanel.call(p, scene, {
                    orientation:'y',
                    bg:{color:GM.COLOR_DARK},
                    space:10,
                    ext:{expand:true,proportion:1}
                });

        return p;
    }

    updateContent(q)
    {
        const scene = this.scene;
        const remove = ()=>{QuestManager.remove(q.dat.id);this.updatePage();}

        this._page.content
            .removeAll(true)
            .add(ui.uBbc(scene,{text:q.fmt()}),{align:'left'})

        if(q.state==='close')
        {
            this._page.content
                .add(ui.uButton(scene, {text:'移除',
                                        bg:{color:GM.COLOR_RED},
                                        onclick:remove}),
                    {align:'right'})
        }

        this.layout();  
    }

    updatePage()
    {
        const scene = this.scene;

        const onclick = (itm)=>{
            if(this._itm) {this._itm.setValue(false);}
            this._itm=itm;
            itm.setValue(true);
            this.updateContent(itm.q);
        }

        this._itm = null;
        this._page.scroll.clearAll();
        this._page.content.removeAll(true);
        
        if(this._pageName==='open')
        {
            for(let id in QuestManager.quests.opened)
            {
                let q = QuestManager.query(id);
                const itm = ui.uButton(scene,{
                                style: UI.BTN.ITEM,
                                text: q.title(),
                                onclick: onclick});
                this._page.scroll.addItem(itm);
                itm.q=q;
            }
        }

        this.layout();
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
    }

    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
    static toggle(owner) {this.instance?.toggle(owner);}
}

