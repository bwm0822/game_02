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
            x: 0,
            y: 0,
            orientation: 'y',
            space: UI.SPACE.FRAME,
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
        const slot = (i) => new Slot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, i);
        this._bag = ui.uGrid.call(this, scene, {column: 5, row: 5, addItem: slot});
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

    close()
    {
        this.owner?.stopSteal?.();
        super.close();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.updateInfo();
        this.refresh();
        this.setPosition(GM.w/2, GM.h/2);
    }

    static show(owner) {this.instance?.show(owner);}
}
