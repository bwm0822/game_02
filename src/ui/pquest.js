import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import DB from '../data/db.js'
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
    _createQuestItem(scene, titleKey, q, onclick)
    {
        const wrapper = scene.rexUI.add.overlapSizer();

        const btn = ui.uButton(scene, {
            style: UI.BTN.ITEM,
            text: {text: titleKey, wrapWidth: 125},
            onclick: () => onclick(wrapper)
        });
        // btn.q = q;
        wrapper.q = q;
        // wrapper._btn = btn;
        wrapper.add(btn, {key: 'btn'});

        const dot = ui.uBbc(scene, {
            text: '🔴',
            fontSize: 18,
            color: GM.COLOR.RED,
            ext: {align: 'left-top', expand: false}
        });

        dot.setAlpha(0);
        wrapper.add(dot, {key: 'dot', align: 'left-top', offsetX: -10, offsetY: -10});
        wrapper.layout();

        // method
        wrapper.setDot = (on) => {dot.setAlpha(on?1:0);return wrapper;};
        wrapper.setValue = (on) => {btn.setValue(on);return wrapper;};

        return wrapper;
    }

    _updateContent(q)
    {
        const scene = this.scene;
        const remove = ()=>{QuestManager.remove(q.dat.id);Ui.refreshAll();}
        const map = ()=>{this._toMap(q.dat.id);}

        this._content
            .clearAll()
            .add(ui.uBbc(scene,{text:QuestManager.title(q)}),{align:'center'})
            .add(ui.uBbc(scene,{text:QuestManager.content(q),wrapWidth:500}),{align:'left'})

        if(q.nid)
        {
            this._content
                .add(ui.uButton(scene, {text:'地圖',
                                        // bg:{color:GM.COLOR.RED},
                                        cBG:GM.COLOR.RED,
                                        onclick:map}),
                    {align:'right'})
        }

        if(q.state==='close')
        {
            this._content
                .add(ui.uButton(scene, {text:'移除',
                                        // bg:{color:GM.COLOR.RED},
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
            if(this._itm === itm)
            {
                this._itm.setValue(false);
                this._itm=null;
                this._content.clearAll();
            }
            else
            {
                if(this._itm) {this._itm.setValue(false);}
                this._itm=itm;
                itm.setValue(true);
                this._updateContent(itm.q);
            }
            itm.setDot(false)
        }

        this._itm = null;
        this._scroll.clearAll();
        this._content.clearAll();

        if(Object.keys(QuestManager.quests.close).length > 0)
        {
            const fold = ui.uFold(scene, {title:'已完成',
                                                fontSize:GM.FONT_SIZE+4, 
                                                onclick: ()=>{this.layout();}
                                            });
            this._scroll.addItem(fold);
            fold.cat='close';

            for(let id in QuestManager.quests.close)
            {
                const qD = DB.quest(id);
                const state = QuestManager.quests.close[id];
                const q = {cat:`${fold.cat}`, dat:qD, sta:state};

                const itm = this._createQuestItem(scene, qD.titleKey, q, onclick);
                fold.addItem(itm,{align:'left',padding:{left:10}});
            }
        }

        for(let id in QuestManager.quests.active)
        {
            const q = QuestManager.query(id);
            const itm = this._createQuestItem(scene, q.dat.titleKey, q, onclick);

            let fold = this._scroll.getChildren().find(child=>child.cat===q.cat);
            if(!fold)
            {
                fold = ui.uFold(scene, {title:`${q.cat}`,
                                        fontSize:GM.FONT_SIZE+4,
                                        onclick: ()=>{this.layout();}
                                    });
                this._scroll.addItem(fold);
                fold.cat=q.cat
            }

            fold.addItem(itm,{align:'left',padding:{left:10}});
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
