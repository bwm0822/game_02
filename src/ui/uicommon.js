import {GM, UI} from '../core/setting.js';

export default class Ui
{
    static _list = {};
    static _regs = {};
    static _mode = UI.MODE.NORMAL;
    static _to = null;

    static get mode() {return this._mode;}
    //static closeAll(force=false) {for(let key in Ui._list){Ui._list[key].ui.close(force);}}
    static closeAll(mode=GM.UI_FORCE) 
    {
        for(let key in this._regs)
        {
            if((this._regs[key].type&mode)!==0) {this._regs[key].ui.close();}
        }
    }
    static refreshAll() {for(let key in this._regs){this._regs[key].ui.refresh?.();}}
    // static register(ui,type) {this._list[ui.constructor.name]={ui:ui,type:type};}
    // static unregister(ui) {delete this._list[ui.constructor.name];}
    static register(ui,type) {this._regs[ui.tag]={ui:ui,type:type};}
    static unregister(ui) {delete this._regs[ui.tag];}
    static setMode(mode) {this._mode=mode;}
    static addToList(ui) {this._list[ui.tag]=ui;}
    static on(tag,...args) {this._list[tag]?.show(...args);}
    static off(tag) {this._list[tag]?.close();}

    static addLayer(scene, name, top)
    {
        let layer = scene.add.layer();
        layer.name = name;
        layer.add(top);     // 把 top 加入 layer
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