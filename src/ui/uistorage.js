import UiFrame from './uiframe.js'
import * as ui from './uicomponents.js'
import {GM,UI} from '../core/setting.js'
import {Slot} from './uiclass.js'
import UiInv from '../ui/uiinv.js'

export default class UiStorage extends UiFrame
{
    static instance = null;
    constructor(scene)
    {
        const config =
        {
            x:100,
            y:GM.h-150,
            orientation : 'y',
            space:10,//UI.SPACE.FRAME,
        }

        super(scene, config, UI.TAG.STORAGE);
        UiStorage.instance = this;

        // layout
        this.addBg(scene)
            .addTop(scene,'storage')
            .addStorage(scene)
            .setOrigin(0,1)
            .layout()
            .hide()
    }

    addStorage(scene)
    {
        this._storage = ui.uStorage.call(this, scene, {column:4,row:3});
        return this;
    }

    refresh()
    {
        this._storage.loop((elm)=>{elm?.update(this.owner);});
    }

    close()
    {
        if(!this.visible) {return;}
        super.close();
        this.unregister();
        this.clrCamera(GM.CAM_RIGHT);
        this.owner.close();
    }

    init(owner)
    {
        const addItem = (i) => new Slot(this.scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);
        this._storage.init(addItem, owner.storage);
        this.refresh();
        this.layout();
    }

    show(owner)
    {
        if(this.visible) {return;}
        super.show();
        this.owner=owner;
        this.init(owner);
        //
        this.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);
        this.setCamera(GM.CAM_RIGHT);
        this.on(UI.TAG.INV, this.player);
    }

    static show(owner,cat) {this.instance?.show(owner,cat);}
}

