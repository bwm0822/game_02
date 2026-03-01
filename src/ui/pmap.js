import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'
import {MiniMap} from '../manager/minimap.js'
import {UNode, uTag} from './unode.js'
import QuestManager from '../manager/quest.js'


export class PMap extends Sizer
{
    constructor(scene)
    {
        const config = {
            space:{left:5,right:5,top:5,bottom:5,item:5}, 
            width:750,
            height:400,
        }

        super(scene, config);

        this._map_w = config.width-config.space.left-config.space.right;
        this._map_h = config.height-config.space.top-config.space.bottom;
        
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

    //------------------------------------------------------
    //  Local
    //------------------------------------------------------
    _processObjectLayer()
    {
        const map = MiniMap.map;
        const scene = this.scene;
        this._nds={};

        map.objects.forEach((layer)=>{
            // map.createFromObjects(layer.name,[{type:'node',classType:Test}]);
            const objs = map.getObjectLayer(layer.name).objects;
            objs.forEach(obj=>{
                if(obj.type==='node') {this._addNode(map,obj);}
                else {this._addImage(map,obj);}
            })
        })
    }

    _addNode(map,obj)
    {
        const nd = new UNode(this.scene,map,obj);
        this._map.add(nd);
        this._nds[nd.dat.map]=nd;
    }

    _addImage(map,obj)
    {
        const [key,frame] = Utility.getbygid(map,obj.gid);
        const icon = key+':'+frame;
        const img = ui.uImage(this.scene,{x:obj.x,y:obj.y,icon:icon}).setOrigin(0,1);
        this._map.add(img);
    }

    _updateMap()
    {
        //
        const img = ui.uImage(this.scene,{icon:MiniMap.tex}).setOrigin(0);
        this._map.setContentSize(img.displayWidth,img.displayHeight);
        this._map.clearAll();
        this._map.add(img);
        this._processObjectLayer();

        // 取出目前地圖所在地的nid
        this._props = Utility.getProps(GM.map);
        if(this._props.nid) 
        {
            this._setPlayer(this._props.nid);
        }
    }

    _updateQuest()
    {
        const onclick = (btn)=>{
            if(this._btn) {this._btn.setValue(false);}
            this._btn=btn;
            btn.setValue(true);
            this._focusOn(btn.nid)
        }

        const scene = this.scene;

        this._btn = null;
        this._scroll.clearAll();

        // 1. 玩家
        const btn = ui.uButton(scene, {style:UI.BTN.ITEM,
                                        text:'玩家',
                                        onclick:onclick});
        this._scroll.addItem(btn);
        btn.nid=this._props.nid;
        btn.emit('pointerup');
        
        // 2. 任務
        for(let id in QuestManager.quests.opened)
        {
            let q = QuestManager.query(id);
            if(q.dat.nid)
            {
                const btn = ui.uButton(scene,{
                                style: UI.BTN.ITEM,
                                tcon: {text:q.state==='finish'?'🗹':'☐',ext:{align:'top'}},
                                text: {text:q.title(),wrapWidth:125},
                                onclick: onclick});

                let fold = this._scroll.getChildren().find(child=>child.cat===q.cat);
                if(!fold)
                {
                    fold = ui.uFold(scene, {prefix:true,title:`[i]${q.cat}[/i]`,onclick:()=>this.layout()});
                    this._scroll.addItem(fold);
                    fold.cat=q.cat
                }
                fold.addItem(btn);

                btn.q=q;
                btn.nid=q.dat.nid;
                btn.qid=id;
                this._nds[q.dat.nid].addTag();
            }
        }

        
    }

    _setPlayer(nid)
    {
        const nd=this._nds[nid];
        // const tag=uTag(this.scene,{x:nd.loc.x,y:nd.loc.y})
        const tag=ui.uPic(this.scene,{x:nd.loc.x,y:nd.loc.y,icon:'buffs:20',w:40,h:40,bg:{}})
        this._map.add(tag);
    }

    _focusOn(nid)
    {
        const nd = this._nds[nid];

        if(!nd) {return;}

        const w = this._map.width;
        const h = this._map.height;
        const img_w =  this._map._panel.width;
        const img_h =  this._map._panel.height;
        const min = {x:w-img_w,y:h-img_h};

        // 設置範圍，不要超過邊界
        const ox = Utility.clamp(-nd.x+w/2,min.x,0);
        const oy = Utility.clamp(-nd.y+h/2,min.y,0);

        this._map.childOX = ox;
        this._map.childOY = oy;
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    setQid(qid)
    {
        const ret = this.findQid(this._scroll, qid);
        ret.cat.unfold();
        ret.found.emit('pointerup');
        this.layout();
    }

    findQid(top,qid)
    {
        const children = top.getChildren();
        for(var child of children)
        {
            if(child.cat)
            {
                const ret = this.findQid(child,qid);
                if(ret) {ret.cat=child;return ret}
            }
            else if(child.qid===qid)
            {
                return {found:child};
            }
        }
    }

    update()
    {
        this.show();
        this._updateMap();
        this._updateQuest();
        this.layout();
    }

    

    
}