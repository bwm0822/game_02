import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Story from '../systems/story.js'


export class PQuest extends Sizer
{
    constructor(scene, toMap)
    {
        const config=
        {
            // bg:{color:GM.COLOR.PRIMARY},
            orientation:'y',
            space:{left:5,right:5,top:5,bottom:5,item:5},
        }

        super(scene, config);

        this._toMap=toMap;

        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

        // 主要區塊：左側任務清單 + 右側內容
        const mainRow = ui.uPanel.call(this, scene, {
                    orientation:'x',
                    ext:{expand:true,proportion:1}
                });

        // scroll
        this._scroll = ui.uScroll.call(mainRow, scene, {bg:{},
                                                    width:200,
                                                    ext:{expand:true}});

        // content：title 欄（不捲動）+ 內容（可捲動）
        const contentPanel = ui.uPanel.call(mainRow, scene, {
                    orientation:'y',
                    ext:{expand:true,proportion:1}
                });

        this._title = ui.uPanel.call(contentPanel, scene, {
                    bg:{color:GM.COLOR.DARK},
                    ext:{expand:true}
                });

        this._content = ui.uScroll.call(contentPanel, scene, {
                    bg:{color:GM.COLOR.DARK},
                    space:10,
                    ext:{expand:true,proportion:1}
                });

        // 底部：地圖按鈕，跟 title/content 同一個 sizer（contentPanel），固定在右側內容區的右下角
        const footer = ui.uPanel.call(contentPanel, scene, {
                    orientation:'x',
                    bg:{color:GM.COLOR.DARK},
                    ext:{expand:true}
                });

        // 「地圖」按鈕不管有沒有選任務、選到的任務有沒有 pos 都固定加入、保留版面
        // 空間，沒有 pos 時只是隱藏＋不能點擊，避免面板高度跳動
        this._mapBtn = ui.uButton(scene, {text:{text:'🗺️', fontSize:GM.FONT_SIZE+12},
                                        space:UI.SPACE.LRTBI.p5,
                                        cBG:GM.COLOR.DARK,
                                        bg:{color:GM.COLOR.DARK, radius:0},
                                        onclick:()=>{this._toMap(this._pos, this._qid);}});
        footer.addSpace().add(this._mapBtn,{align:'right'});

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
            text: {text: q.title, wrapWidth: 125},
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

        this._pos = q?.pos ?? null;
        this._qid = q?.id ?? null;
        this._mapBtn.setAlpha(this._pos?1:0);
        this._pos ? this._mapBtn.setInteractive() : this._mapBtn.disableInteractive();

        if(q)
        {
            const scene = this.scene;

            // _title 是 x 軸排列，cross axis（高度）本來就是滿版，垂直置中不用
            // 額外處理；水平置中則用左右各一個 addSpace() 撐開空間，讓標題文字
            // 維持原尺寸夾在中間，不會像給 proportion 撐開那樣被硬改 displayWidth
            this._title
                .addSpace()
                .add(ui.uBbc(scene,{text:`[color=yellow]${q.title}[/color]`}),{align:'center',padding:{top:10,bottom:10}})
                .addSpace()

            // 走過的路 ✔、目前這一行 ▸；沒走到的值不列出（不劇透岔路）
            const progress = q.lines.map(l=>`${l.cur?'▸':'✔'} ${l.text}`).join('\n');

            this._content
                .add(ui.uGroup(scene,{title:'description'.lab(),fontSize:GM.FONT_SIZE})
                        .addItem(ui.uBbc(scene,{text:q.desc ?? '',wrapWidth:480})),{align:'left',expand:true})
            if(q.reward)
            {
                this._content
                    .add(ui.uGroup(scene,{title:'rewards'.lab(),fontSize:GM.FONT_SIZE})
                            .addItem(ui.uBbc(scene,{text:q.reward,wrapWidth:480})),{align:'left',expand:true})
            }
            this._content
                .add(ui.uGroup(scene,{title:'progress'.lab(),fontSize:GM.FONT_SIZE})
                        .addItem(ui.uBbc(scene,{text:progress,wrapWidth:480})),{align:'left',expand:true})
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
            Story.updated.delete(itm.q.id);
        }

        this._itm = null;
        this._scroll.clearAll();
        this._updateContent(null);

        const threads = Story.threads();
        const done = threads.filter(q=>q.done);
        const active = threads.filter(q=>!q.done);

        if(done.length > 0)
        {
            const fold = ui.uFold(scene, {title:'completed'.lab(),
                                                fontSize:GM.FONT_SIZE+4,
                                                onclick: ()=>{this.layout();}
                                            });
            this._scroll.addItem(fold);

            for(const q of done)
            {
                const itm = this._createQuestItem(scene, q, onclick);
                fold.addItem(itm,{align:'left',padding:{left:10}});
            }
        }

        if(active.length > 0)
        {
            const group = ui.uGroup(scene, {title:'quest_general'.lab(),
                                            fontSize:GM.FONT_SIZE+4
                                        });
            this._scroll.addItem(group);

            for(const q of active)
            {
                const itm = this._createQuestItem(scene, q, onclick);
                group.addItem(itm,{align:'left',padding:{left:10}});
                if(Story.updated.has(q.id)) {itm.setDot(true);}
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
