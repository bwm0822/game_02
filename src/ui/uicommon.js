import {GM, UI} from '../core/setting.js'

export default class Ui
{
    static _list = {};
    static _regs = {};
    static _mode = UI.MODE.NORMAL;
    static _to = null;

    static get mode() {return this._mode;}

    static reset()
    {
        this._list = {};
        this._regs = {};
        this._mode = UI.MODE.NORMAL;
        this._to = null;
    }

    static closeAll(mode=~GM.UI_BOTTOM) 
    {
        for(let tag in this._regs)
        {
            if((this._regs[tag].type&mode)!==0) {this._regs[tag].ui.close();}
        }
    }
    static refreshAll() {for(let tag in this._regs){this._regs[tag].ui.refresh?.();}}
    static register(ui,type) {this._regs[ui.tag]={ui:ui,type:type};}
    static unregister(ui) {delete this._regs[ui.tag];}
    static setMode(mode) {this._mode=mode;}
    static addToList(ui) {this._list[ui.tag]=ui;}
    static on(tag,...args) {return this._list[tag]?.show(...args);}
    static off(tag) {this._list[tag]?.close();}
    static get(tag) {return this._list[tag];}

    static addLayer(scene, name, top)
    {
        const layer = scene.add.layer();
        layer.name = name;
        layer.add(top);     // 把 top 加入 layer
        return layer;
    }

    static delayCall(func, delay=GM.OVER_DELAY)
    {
        if(!func) {return;}
        this._to = setTimeout(() => {func();}, delay);
    }

    static cancelDelayCall()
    {
        clearTimeout(this._to);
    }
}