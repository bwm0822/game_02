import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM} from '../setting.js'
import {Slot} from '../ui.js'

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

        super(scene, config, 'UiStorage');
        UiStorage.instance = this;

        // bg/top
        this.addBg(scene).addTop(scene,'storage')

        // grid
        this._grid = ui.uGrid.call(this, scene, {
            column: 4, row: 4,
            addItem: (i)=>{return new Slot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE,i);}
        })

        this.setOrigin(0,1)
            .layout()
            .hide()
    }

    refresh()
    {
        this._grid.loop((elm)=>elm.update(this._owner));
    }

    show(owner)
    {
        super.show();
        this._owner=owner;
        this.refresh();
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
}

