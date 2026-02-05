import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import QuestManager from '../manager/quest.js'


export class PQuest extends Sizer
{
    constructor(scene)
    {
        const config=
        {
            // bg:{color:GM.COLOR.PRIMARY},
            space:{left:5,right:5,top:5,bottom:5,item:10}, 
            width:750,
            height:400,
            // ext:{expand:true,proportion:1}
        }

        super(scene, config);

        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

        // scroll
        this._scroll = ui.uScroll.call(this, scene, {bg:{},width:200,ext:{expand:true}});

        // content
        this._content = ui.uPanel.call(this, scene, {
                    orientation:'y',
                    bg:{color:GM.COLOR.DARK},
                    space:10,
                    ext:{expand:true,proportion:1}
                });

        this.layout().hide();
    }

    
    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _updateContent(q)
    {
        const scene = this.scene;
        const remove = ()=>{QuestManager.remove(q.dat.id);this.updatePage();}

        this._content
            .removeAll(true)
            .add(ui.uBbc(scene,{text:q.fmt()}),{align:'left'})

        if(q.state==='close')
        {
            this._content
                .add(ui.uButton(scene, {text:'移除',
                                        bg:{color:GM.COLOR_RED},
                                        onclick:remove}),
                    {align:'right'})
        }

        this.layout();  
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    update()
    {
        this.show();

        const scene = this.scene;

        const onclick = (itm)=>{
            if(this._itm) {this._itm.setValue(false);}
            this._itm=itm;
            itm.setValue(true);
            this._updateContent(itm.q);
        }

        this._itm = null;
        this._scroll.clearAll();
        this._content.removeAll(true);
        
        for(let id in QuestManager.quests.opened)
        {
            let q = QuestManager.query(id);
            const itm = ui.uButton(scene,{
                            style: UI.BTN.ITEM,
                            text: q.title(),
                            onclick: onclick});
            this._scroll.addItem(itm);
            itm.q=q;
        }
        
        this.layout();

    }
}
