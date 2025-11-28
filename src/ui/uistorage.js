import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../setting.js'
import {Slot} from '../ui.js'
import UiInv from '../ui/uiinv.js'

export default class UiStorage extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x:100,
            y:GM.h-150,
            orientation : 'y',
            space:{left:5,right:5,top:5,bottom:5,item:5},
        }

        super(scene, config, UI.TAG.STORAGE);
        UiStorage.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'storage')
            .addGrid(scene)
            .setOrigin(0,1)
            .layout()
            .hide()
    }

    addGrid(scene)
    {
        this._grid = ui.uGrid.call(this, scene, {
            column: 4, row: 4,
            addItem: (i)=>{return new Slot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE,i);}
        })

        return this;
    }

    refresh()
    {
        this._grid.loop((elm)=>elm.update(this._owner));
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        this.unregister();
    }

    show(owner)
    {
        super.show();
        this._owner=owner;
        this.refresh();
        this.register(GM.UI_LEFT);
        
        UiInv.show(this.player);
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
}

