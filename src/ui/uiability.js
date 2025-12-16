import UiFrame from './uiframe.js'
import {GM,UI} from '../setting.js'
import * as ui from './uicomponents.js'

import {AbilityItem} from '../ui.js'


export default class UiAbility extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config=
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 250,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:0},
            cover: {touchClose:false},
        }
        super(scene, config, UI.TAG.ABILITY);
        UiAbility.instance = this;
        this.addBg(scene)
            .addTop(scene, UI.TAG.ABILITY)
            .addMain(scene)
            .layout()
            .hide()

        // this.unit_test(scene)

    }

    unit_test(scene)
    {
        const itm = ui.uButton(scene,{text:'test',style:UI.BTN.ITEM})
        this._menu.addItem(itm);

        this._panel.addItem(ui.uRect(scene,{x:25,y:25,width:50,height:50,color:GM.COLOR.GRAY}))

        this.layout()

        
        // this.drawTree(this.player.abTree[item.id])
    }

    addMain(scene)
    {
        const config=
        {
            bg:UI.BG.BORDER,
            height:300,
            orientation:'x',
            ext:{expand:true}
        }
        const p = ui.uPanel.call(this, scene, config);

        this._menu = ui.uScroll.call(p, scene, {width:100,
                                                hideUnscrollableSlider:true});

        this._panel = ui.uScroll.call(p, scene, {width:300,
                                                hideUnscrollableSlider:true,
                                                ext:{expand:true,padding:10},
                                                bg:{color:GM.COLOR.DARK,},
                                                style:UI.SCROLL.CON});

        return this;
    }


    showMenu()
    {
        const onclick=(item)=>{
            this._itemSel?.setValue(false);
            this._itemSel = item;
            this.drawTree(this.player.abTree[item.id]);
            item.setValue(true);
        }
    

        this._itemSel=null;
        this._menu.clearAll();
        Object.keys(this.player.abTree).forEach((tree,i)=>{

            const item = ui.uButton(this.scene,{text:tree,
                                                style:UI.BTN.ITEM,
                                                onclick:()=>{onclick(item);}});
            item.id = tree;
            this._menu.addItem(item,{expand:true})
            if(i===0)
            {
                item.emit('pointerup',item);
            }

        })
        this.layout();
    }

    drawTree(tree)
    {
        this._panel.clearAll();
        //
        this._graphic = this.scene.add.graphics();
        this._panel.addItem(this._graphic);
        this._graphic.lineStyle(4, 0x808080, 1);

        //
        let xMax=0, yMax=0;
        tree.forEach(dat=>{
            if(dat.type==='skill')
            {
                let slot = new AbilityItem(this.scene,50,50);
                slot.set(dat.id,dat.x,dat.y)
                this._panel.addItem(slot)
                xMax = Math.max(xMax, dat.x);
                yMax = Math.max(yMax, dat.y);
            }
            else
            {
                let pts = dat.pts;
                this._graphic.lineStyle(4, this.checkRefs(dat.refs)?0xffffff:0x505050, 1);
                for(let i=0;i<pts.length-1;i++)
                {
                    this._graphic.lineBetween(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);
                }
            }
        })


        console.log(xMax,yMax)
        this._panel.setContentSize(xMax+50,yMax+50)
        this.layout();
    }

    checkRefs(refs)
    {
        for(let i=0; i<refs.length; i++)
        {
            let id = refs[i];
            let ability = this.player.abilities[id];
            if(!ability) {return false};
        }

        return true;
    }

    refresh() 
    {
        let item = this._itemSel;
        this.drawTree(this.player.abTree[item.id])
    }

    show()
    {
        super.show();
        this.showMenu();
        this.closeAll(GM.UI_CENTER);
        this.register(GM.UI_CENTER);
    }

    close()
    {
        super.close();
        this.unregister();
    }

    toggle()
    {
        if(this.visible){this.close();}
        else{this.show()}
    }

    static toggle() {this.instance?.toggle();}
}
