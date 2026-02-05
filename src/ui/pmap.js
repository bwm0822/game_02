import {Sizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import Utility from '../core/utility.js'
import {MiniMap} from '../manager/minimap.js'
import {UNode} from './unode.js'


export class PMap extends Sizer
{
    constructor(scene)
    {
        const config = {
            space:{left:20,right:20,top:20,bottom:20,item:10}, 
            width:750,
            height:400,
        }

        super(scene, config);
        
        // bg
        ui.uBg.call(this, scene, {color:GM.COLOR.PRIMARY})

        // scroll
        this._scroll = ui.uScroll.call(this, scene,{
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
        const scene=this.scene;
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
        this._scroll.add(nd);
        this._nds[nd.dat.map]=nd;
    }

    _addImage(map,obj)
    {
        const [key,frame] = Utility.getbygid(map,obj.gid);
        const icon=key+':'+frame;
        const img = ui.uImage(this.scene,{x:obj.x,y:obj.y,icon:icon}).setOrigin(0,1);
        this._scroll.add(img);
    }

    //------------------------------------------------------
    //  Public
    //------------------------------------------------------
    focusOn(nid)
    {
        const nd = this._nds[nid];

        const w = 750-40;
        const h = 400-40;
        const mx = w-1024;
        const my = h-1024;

        const ox = Utility.clamp(-nd.x+w/2,mx,0);
        const oy = Utility.clamp(-nd.y+h/2,my,0);

        this._scroll.childOX = ox;
        this._scroll.childOY = oy;
    }

    update()
    {
        this.show();

        //
        const img = ui.uImage(this.scene,{icon:MiniMap.tex}).setOrigin(0);
        this._scroll.setContentSize(img.displayWidth,img.displayHeight);
        this._scroll.clearAll();
        this._scroll.add(img);
        this._processObjectLayer();
        this.layout();

        // 取出目前地圖所在地的nid
        this._props = Utility.getProps(GM.map);
        this.focusOn(this._props.nid);
    }
}