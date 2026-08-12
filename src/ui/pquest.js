import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import QuestManager from '../manager/quest.js'
import DB from '../data/db.js'


export class PQuest extends Sizer
{
    constructor(scene, toMap)
    {
        const config=
        {
            // bg:{color:GM.COLOR.PRIMARY},
            space:{left:5,right:5,top:5,bottom:5,item:5},
        }

        super(scene, config);

        this._toMap=toMap;

        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

        // scroll
        this._scroll = ui.uScroll.call(this, scene, {bg:{},
                                                    width:200,
                                                    ext:{expand:true}});

        // content：title 欄（不捲動）+ 內容（可捲動）
        const contentPanel = ui.uPanel.call(this, scene, {
                    orientation:'y',
                    ext:{expand:true,proportion:1}
                });

        this._title = ui.uPanel.call(contentPanel, scene, {
                    bg:{color:GM.COLOR.GRAY},
                    // space:{left:5,right:5,top:5,bottom:5,item:10},
                    ext:{expand:true}
                });

        this._content = ui.uScroll.call(contentPanel, scene, {
                    bg:{color:GM.COLOR.DARK},
                    space:10,
                    ext:{expand:true,proportion:1}
                });

        this.layout().hide();
    }

    // UiMisc 撐開後的大小是由父層 expand 決定，內部（fold 展開/收合、切換任務內容）
    // 觸發的 relayout 若呼叫無參數的 layout()，rexUI 會以子物件內容大小重新計算，
    // 導致尺寸縮回去，所以這裡固定沿用目前已解析出的大小
    layout()
    {
        if(this.width && this.height) {return this.runLayout(undefined, this.width, this.height);}
        return super.layout();
    }

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _createQuestItem(scene, q, onclick)
    {
        const wrapper = scene.rexUI.add.overlapSizer();

        const btn = ui.uButton(scene, {
            style: UI.BTN.ITEM,
            text: {text: q.dat.titleKey, wrapWidth: 125},
            onclick: () => onclick(wrapper)
        });
        wrapper.q = q;
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
        this._title.removeAll(true);
        this._content.clearAll();

        if(q)
        {
            const scene = this.scene;
            const pos = QuestManager.pos(q);
            const map = ()=>{this._toMap(pos);}

            // 「地圖」按鈕不管有沒有 pos 都固定加入、保留版面空間，沒有 pos 時只是
            // 隱藏＋不能點擊，避免標題欄寬度隨任務有無地點而跳動
            const mapBtn = ui.uButton(scene, {text:'地圖',
                                            // bg:{color:GM.COLOR.RED},
                                            cBG:GM.COLOR.RED,
                                            onclick:map});
            mapBtn.setAlpha(pos?1:0);
            pos ? mapBtn.setInteractive() : mapBtn.disableInteractive();

            // _title 是 x 軸排列，cross axis（高度）本來就是滿版，垂直置中不用
            // 額外處理；水平置中則用左右各一個 addSpace() 撐開空間，讓標題文字
            // 維持原尺寸夾在中間，不會像給 proportion 撐開那樣被硬改 displayWidth
            this._title
                .addSpace()
                .add(ui.uBbc(scene,{text:`[color=yellow]${QuestManager.title(q)}[/color]`}),{align:'center'})
                .addSpace()
                .add(mapBtn,{align:'right'})

            this._content
                .add(ui.uBbc(scene,{text:QuestManager.content(q),wrapWidth:480}),{align:'left'})
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
                this._updateContent(null);
            }
            else
            {
                if(this._itm) {this._itm.setValue(false);}
                this._itm=itm;
                itm.setValue(true);
                this._updateContent(itm.q);
            }
            itm.setDot(false);
            QuestManager.updated.delete(itm.q.dat.id);
        }

        this._itm = null;
        this._scroll.clearAll();
        this._title.removeAll(true);
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
                const q = QuestManager.queryClose(id)
                const itm = this._createQuestItem(scene, q, onclick);
                fold.addItem(itm,{align:'left',padding:{left:10}});
            }
        }

        for(let id in QuestManager.quests.active)
        {
            const q = QuestManager.queryActive(id);
            if (!q || !q.dat) continue;
            const itm = this._createQuestItem(scene, q, onclick);

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

            if(QuestManager.updated.has(id))
            {
                itm.setDot(true);
            }
        }

        this.layout();

    }

    mouseWheel(on)
    {
        this._scroll.mouseWheel(on);
        this._content.mouseWheel(on);
    }
}
