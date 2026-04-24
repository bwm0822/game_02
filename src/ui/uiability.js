import UiFrame from './uiframe.js'
import {GM,UI} from '../core/setting.js'
import * as ui from './uicomponents.js'
import {AbilityItem} from './uiclass.js'
import {T,dlog} from '../core/debug.js'


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
            // space:{left:10,right:10,bottom:10,item:0},
            space:UI.SPACE.FRAME,
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
                                                hideUnscrollableSlider:false});

        this._panel = ui.uScroll.call(p, scene, {width:300,
                                                scrollMode:2,
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

    drawLink(p0,p1,en)
    {
        this._graphic.lineStyle(4, en?0xffffff:0x505050, 1);

        if(p0.x===p1.x)
        {
            const s0={x:p1.x, y:p0.y===p1.y?p1.y-50:p0.y+25};
            const s1={x:p1.x, y:p0.y===p1.y?p1.y-25:p0.y+50};
            this._graphic.lineBetween(s0.x,s0.y,s1.x,s1.y);
        }
        else
        {
            const s0={x:p0.x, y:p0.y+25};
            const s1={x:p0.x, y:p0.y+50};
            const s2={x:p1.x, y:p1.y-50};
            this._graphic.lineBetween(s0.x,s0.y,s1.x,s1.y);
            this._graphic.lineBetween(s1.x,s1.y,s2.x,s2.y);
        }
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
        const slots=[];
        tree.forEach(dat=>{
            const slot = new AbilityItem(this.scene,50,50);
            slots.push(slot);
            const x = 25+(dat.x-1)*50;
            const y = 25+(dat.y-1)*50
            slot.set(dat.id,x,y)
            this._panel.addItem(slot)
            xMax = Math.max(xMax, x);
            yMax = Math.max(yMax, y);
        })

        slots.forEach((slot)=>{
            slot.dat.refs?.forEach(ref=>{
                const found=slots.find(slot=>slot.id===ref);
                this.drawLink(found,slot,found.en);
            })
            if(slot.dat.refs) {this.drawLink(slot,slot,!slot.locked);}
        });

        dlog(T.UI)(xMax,yMax)
        this._panel.setContentSize(xMax+25,yMax+25);
        this.layout();
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
        this._menu.mouseWheel(true);

    }

    close()
    {
        super.close();
        this.unregister();
        this._menu.mouseWheel(false);
    }

    toggle()
    {
        if(this.visible){this.close();}
        else{this.show()}
    }

    static toggle() {this.instance?.toggle();}
}
