 import UiFrame from "./uiframe.js"
import * as ui from './uicomponents.js'
import {GM, UI} from '../core/setting.js'
import {Slot} from './uiclass.js'


export default class UiSteal extends UiFrame
{
    static instance = null;

    constructor(scene)
    {
        const config = {
            x: GM.w/2,
            y: GM.h/2,
            orientation: 'y',
            space: UI.SPACE.FRAME,
            cover: {touchClose:false,alpha:0.5},
        }
        super(scene, config, UI.TAG.STEAL);
        UiSteal.instance = this;

        this.addBg(scene)
            .addTop(scene, GM.STEAL)
            .addInfo(scene)
            .addBag(scene)
            .setOrigin(0.5)
            .layout()
            .hide()
    }

    addInfo(scene)
    {
        const p = ui.uPanel.call(this, scene, {
            bg: UI.BG.BORDER,
            height: 50,
            space: UI.SPACE.LRTBI_10,
            ext: {expand: true}
        })
        const pic = ui.uPic.call(p, scene, {w: GM.PORTRAITS_W, h: GM.PORTRAITS_H, bg: UI.BG.SLOT, icon: 'portraits/0'})
        const bbc = ui.uBbc.call(p, scene, {text: '', ext: {align: 'top'}})

        p.setIcon = (owner) => {pic.setIcon(owner.icon);}
        p.setDes = (owner) => {bbc.setText(`${owner.id.lab()}\n${owner.job?.lab()}`);}
        this._info = p;

        return this;
    }

    addBag(scene)
    {
        this._bag = ui.uStorage.call(this, scene);
        return this;
    }

    updateInfo()
    {
        this._info.setIcon(this.owner);
        this._info.setDes(this.owner);
    }

    refresh()
    {
        this._bag.loop((elm) => elm?.update(this.owner));
    }

    init(owner)
    {
        const addItem = (i) => new Slot(this.scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);
        this._bag.init(addItem, owner.storage);
        this.refresh();
        this.layout();
    }

    close()
    {
        this.owner.stopSteal();
        this.unregister();
        super.close();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.updateInfo();
        this.init(owner);
        this.register(GM.UI_CENTER);
    }

    static show(owner) {this.instance?.show(owner);}
}
