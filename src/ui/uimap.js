import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {UiNode} from './uinode.js'
import {GM,UI} from '../core/setting.js'
import {MiniMap} from '../manager/minimap.js'

export default class UiMap extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config = {
            x: GM.w/2,
            y: GM.h/2,
            // width: GM.w/2,
            // height: GM.h/2,
            orientation:'y',
            space:{left:5,right:5,top:5,bottom:5,item:5}
        }

        super(scene, config, UI.TAG.MAP);
        UiMap.instance = this;

        this.addBg(scene)
            .addTop(scene)
            .addScroll(scene)
            .layout()
            .hide()
    }

    addScroll(scene)
    {
        this._scroll = ui.uScroll.call(this, scene,{width:500,height:500,
                                                scrollMode:2,
                                                style:UI.SCROLL.CON});
        return this;
    }


    processObjectLayer()
    {
        const map = MiniMap.map;
        const scene=this.scene;

        map.objects.forEach((layer)=>{
            // map.createFromObjects(layer.name,[{type:'node',classType:Test}]);
            const objs = map.getObjectLayer(layer.name).objects;
            objs.forEach(obj=>{
                const nd = new UiNode(scene,map,obj);
                this._scroll.add(nd)
            })
        })
    }

    show()
    {
        super.show();
        const img = ui.uImage(this.scene,{icon:MiniMap.tex}).setOrigin(0);
        this._scroll.setContentSize(img.displayWidth,img.displayHeight);
        this._scroll.clearAll();
        this._scroll.add(img);
        this.processObjectLayer()
        this.layout();


        // this.unit_test()
        //     .layout()
        // this.p.childOX=-100;
        // this.p.childOY=-100;

    }

    static show(){this.instance?.show();}
}





class Test
{
    constructor(scene)
    {
        this.scene=scene;
    }
    //------------------------------------------------------
    // map.createFromObjects() 會呼叫到以下的 function
    //------------------------------------------------------
    
    //---- function 
    setName(name) {console.log(name)}
    setPosition(x,y) {console.log(x,y)}
    setTexture(key,frame) {console.log(key,frame)}
    setFlip(h,v) {}
    // map.createFromObjects() 會利用 setData() 傳遞參數給 GameObject
    setData(key,value) {}   
}