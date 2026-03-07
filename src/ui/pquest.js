import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import Ui from './uicommon.js'


export class PQuest extends Sizer
{
    constructor(scene, toMap)
    {
        const config=
        {
            // bg:{color:GM.COLOR.PRIMARY},
            space:{left:5,right:5,top:5,bottom:5,item:5}, 
            width:750,
            height:400,
            // ext:{expand:true,proportion:1}
        }

        super(scene, config);

        this._toMap=toMap;

        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

        // scroll
        this._scroll = ui.uScroll.call(this, scene, {bg:{},
                                                    width:200,
                                                    ext:{expand:true}});

        // content
        this._content = ui.uScroll.call(this, scene, {
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
        const remove = ()=>{QuestManager.remove(q.dat.id);Ui.refreshAll();}
        const map = ()=>{this._toMap(q.dat.id);}

        this._content
            .clearAll()
            .add(ui.uBbc(scene,{text:`[color=yellow]${q.title()}[/color]`}),{align:'center'})
            .add(ui.uBbc(scene,{text:q.fmt(),wrapWidth:500}),{align:'left'})

        // if(q.dat.nid)
        if(q.nid)
        {
            this._content
                .add(ui.uButton(scene, {text:'地圖',
                                        // bg:{color:GM.COLOR_RED},
                                        cBG:GM.COLOR.RED,
                                        onclick:map}),
                    {align:'right'})
        }

        if(q.state==='close')
        {
            this._content
                .add(ui.uButton(scene, {text:'移除',
                                        // bg:{color:GM.COLOR_RED},
                                        cBG:GM.COLOR.RED,
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
        this._content.clearAll();
        
        for(let id in QuestManager.quests.opened)
        {
            let q = QuestManager.query(id);
            const itm = ui.uButton(scene,{
                            style: UI.BTN.ITEM,
                            tcon: {text:q.state==='open'?'☐':'🗹',ext:{align:'top'}},
                            text: {text:q.title(),wrapWidth:125},
                            onclick: onclick});

            let fold = this._scroll.getChildren().find(child=>child.cat===q.cat);
            if(!fold)
            {
                fold = ui.uGroup(scene, {title:`[size=${GM.FONT_SIZE+4}]${q.cat}[/size]`});
                this._scroll.addItem(fold);
                fold.cat=q.cat
            }

            fold.addItem(itm);
            itm.q=q;
        }
        
        this.layout();

    }

    mouseWheel(on)
    {
        this._scroll.mouseWheel(on);
        this._content.mouseWheel(on);
    }
}
