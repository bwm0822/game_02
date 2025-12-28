import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import {MatSlot,OutputSlot} from './uiclass.js'
import DB from '../db.js';
import UiInv from './uiinv.js'
import UiInfo from './uiinfo.js'

export default class UiManufacture extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
         let config =
        {
            x : 0,
            y : 0,
            width: 500,
            height : 500,
            orientation : 'y',
            space:UI.SPACE.FRAME,
        }
        super(scene, config, UI.TAG.MANUFACTURE);
        UiManufacture.instance = this;

        this.addBg(scene)
            .addTop(scene, UI.TAG.MANUFACTURE)
            .addMain(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addMain(scene)
    {
        const cfg_row=
        {
            orientation:'x',
            // bg:{color:GM.COLOR.RED},
            ext:{expand:true,proportion:1},
            space:{item:10},
        }
        let row = ui.uPanel.call(this,scene,cfg_row);

        // 1. menu
        const cfg_menu=
        {
            width:100,
        }
        this._menu = ui.uScroll.call(row,scene,cfg_menu);

        // 2. main
        const cfg_main=
        {
            orientation:'y',
            ext:{expand:true,proportion:1},
            // bg:{color:GM.COLOR.BLACK},
            space:{left:0,bottom:10,top:0,right:0,item:50},
        }
        const main = ui.uPanel.call(row,scene,cfg_main);

        // 3. material
        const addItem=(i)=>{return new MatSlot(scene,80,80,i,
                                                {onset:this.check.bind(this)});}
        const cfg_mat=
        {
            addItem:addItem,
            test:true,
        }
        this._mats = ui.uGrid.call(main,scene,cfg_mat);

        // 4. output
        this._output = new OutputSlot(scene,80,80,
                                        {onset:this.check.bind(this)});
        main.add(this._output)

        // 5. make
        this._make = ui.uButton.call(main, scene, 
                                        {text:'製造',
                                        onclick:this.make.bind(this)})
                            .setEnable(false);

        return this;
    }

    check()
    {
        let on = this.owner.check();
        this._output.update();
        this._make.setEnable(on);
    }

    make()
    {
        const owner = this.owner;
        owner.make();
        this._mats.loop((mat)=>{mat.update()});
        this._output.update();
        this.check();
    }

    update()
    {
        const owner=this.owner;
        const scene=this.scene;

        // 1. menu
        let itmSel = null;
        const onover = (itm)=>{UiInfo.show(GM.IF_SLOT, itm);}
        const onout = ()=>{UiInfo.close();}  
        const onclick=(itm)=>{
            if(itmSel) {itmSel.setValue(false);}
            itmSel=itm;
            itmSel.setValue(true);
            owner.sel=itm.content.id;
            this._output.update();
            this.check();
        }

        this._menu.clearAll();
        owner.menu.forEach((id)=>{
            const itm=ui.uButton(scene,{text:id, 
                                        style:UI.BTN.ITEM,
                                        onclick:onclick,
                                        onover:onover,
                                        onout:onout,
                                    });
            itm.content = {id:id,type:'make'};
            itm.dat = DB.item(id)??id;
            if(id===owner.sel) {itm.setValue(true);itmSel=itm;}
            this._menu.add(itm);
            
        })

        // 2. materials
        this._mats.loop((mat)=>{mat.update(owner,owner.cat)});

        // 3. output
        this._output.update(owner);

        // 4. check
        this.check();

        // 5. layout
        this.layout();
    }

    show(owner)
    {
        super.show();
        this.owner=owner;
        this.update(owner);
        UiInv.show(this.player);
    }

    static show(owner) {this.instance.show(owner);}


}