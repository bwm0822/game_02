import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'
import {MiniMap} from '../manager/minimap.js'
import QuestManager from '../manager/quest.js'
import Record from '../infra/record.js'


export class PMap extends Sizer
{
    constructor(scene)
    {
        const config = {
            space:{left:5,right:5,top:5,bottom:5,item:5},
        }

        super(scene, config);

        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

         // scroll
        this._scroll = ui.uScroll.call(this, scene, {bg:{},
                                                    width:200,
                                                    ext:{expand:true}});

        // map
        this._map = ui.uScroll.call(this, scene,{
                                            bg:{color:GM.COLOR.DARK},
                                            scrollMode:2,
                                            style:UI.SCROLL.CON,
                                            ext:{expand:true,proportion:1}});


        this.layout().hide();
    }

    // UiMisc 撐開後的大小是由父層 expand 決定，內部 relayout 若呼叫無參數的
    // layout()，rexUI 會以子物件內容大小重新計算，導致尺寸縮回去，所以這裡
    // 固定沿用目前已解析出的大小
    layout()
    {
        if(this.width && this.height) {return this.runLayout(undefined, this.width, this.height);}
        return super.layout();
    }

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _updateMap()
    {
        //
        const img = ui.uImage(this.scene,{icon:MiniMap.tex}).setOrigin(0);
        this._map.setContentSize(img.displayWidth,img.displayHeight);
        this._map.clearAll();
        this._map.add(img);

        // 節點/裝飾物件層暫時關閉，只顯示地圖縮圖背景
        this._nds = {};
        this._props = Utility.getProps(GM.map);
    }

    // 把玩家目前所在地圖的縮圖置中顯示，玩家標記畫在縮圖裡對應的實際相對位置
    // 一定要在 this.layout() 之後呼叫，不然剛設好的捲動位置會被 layout() 重新排版蓋掉
    _updatePlayerMark()
    {
        const cur = MiniMap.layout[Record.game.map];
        if(cur)
        {
            this._centerOn({x:cur.x+cur.w/2, y:cur.y+cur.h/2});
            const pt = MiniMap.worldToTex(Record.game.map, GM.player.x, GM.player.y);
            if(pt) {this._setPlayer(pt);}
        }
        else {console.warn(`[PMap] MiniMap.layout 找不到 Record.game.map="${Record.game.map}"，可用的 key:`, Object.keys(MiniMap.layout));}
    }

    _updateQuest()
    {
        const margin={  left:this._map.left,
                        right:this._map.right,
                        top:this._map.top,
                        bottom:this._map.bottom,}

        const onclick = (btn)=>{
            if(this._btn) {this._btn.setValue(false);}
            this._btn=btn;
            btn.setValue(true);
            if(btn.isPlayer) {this._updatePlayerMark();}
            else {this._focusOn(btn.nid)}
        }

        const scene = this.scene;

        this._btn = null;
        this._scroll.clearAll();

        // 1. 玩家
        const btn = ui.uButton(scene, {style:UI.BTN.ITEM,
                                        text:'玩家',
                                        onclick:onclick});
        this._scroll.addItem(btn);
        btn.isPlayer = true;
        btn.emit('pointerup');
        
        // 2. 任務
        for(let id in QuestManager.quests.active)
        {
            const q = QuestManager.queryActive(id);
            if (!q || !q.dat) continue;

            const pos = QuestManager.pos(q);
            if (!pos || !this._nds[pos]) continue;

            const btn = ui.uButton(scene,{
                            style: UI.BTN.ITEM,
                            text: {text:QuestManager.title(q),wrapWidth:125},
                            onclick: onclick});

            let group = this._scroll.getChildren().find(child=>child.cat===q.cat);
            if(!group)
            {
                group = ui.uGroup(scene, {title:`[size=${GM.FONT_SIZE+4}]${q.cat}[/size]`});
                this._scroll.addItem(group);
                group.cat=q.cat
            }
            group.addItem(btn);
            btn.q=q;
            btn.nid=pos;
            btn.qid=id;
            this._nds[pos].addTag(q,margin);
        }

        
    }

    _setPlayer(pt)
    {
        const tag=ui.uPic(this.scene,{x:pt.x,y:pt.y,icon:'buffs:20',w:25,h:25,bg:{}})
        this._map.add(tag);
    }

    _findQuestBtn(questId)
    {
        for(const child of this._scroll.getChildren())
        {
            if(child.qid===questId) {return child;}
            if(child.getChildren)
            {
                const found = child.getChildren().find(btn=>btn.qid===questId);
                if(found) {return found;}
            }
        }
        return null;
    }

    _focusOn(nid)
    {
        const nd = this._nds[nid];
        if(!nd) {return;}
        this._centerOn({x:nd.x, y:nd.y});
    }

    // 把地圖捲動到讓 pt（縮圖背景座標系）置中顯示
    _centerOn(pt)
    {
        const w = this._map.width;
        const h = this._map.height;
        const img_w =  this._map._panel.width;
        const img_h =  this._map._panel.height;
        const min = {x:w-img_w,y:h-img_h};

        // 設置範圍，不要超過邊界
        // 縮圖比面板大時 min<0，比面板小時 min>0（無需限制，clamp 範圍要照大小排好，不然 min>max 會恆為 0）
        const ox = Utility.clamp(-pt.x+w/2, Math.min(min.x,0), Math.max(min.x,0));
        const oy = Utility.clamp(-pt.y+h/2, Math.min(min.y,0), Math.max(min.y,0));

        this._map.childOX = ox;
        this._map.childOY = oy;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    focusOn(pos, questId)
    {
        const btn = questId ? this._findQuestBtn(questId) : null;
        if(btn) {btn.emit('pointerup');}
        else {this._focusOn(pos);}
    }

    update()
    {
        this.show();
        this._updateMap();
        this._updateQuest();
        this.layout();
        this._updatePlayerMark();
    }

    mouseWheel(on)
    {
        this._scroll.mouseWheel(on);
    }

    

    
}