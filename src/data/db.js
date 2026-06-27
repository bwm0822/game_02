import {GM} from '../core/setting.js'

export default class DB
{
    static _itemDB;

    static get abilities() {return this._abilityDB;}
    static get abTree() {return this._abTree;}

    static load(scene)
    {
        this._itemDB = scene.cache.json.get('item');
        for (let val of Object.values(this._itemDB)) 
        {
            if(val.cat) {val.cat = this.lut(val.cat);}
        }

        this._roleDB = scene.cache.json.get('role');

        this._dialogDB = scene.cache.json.get('dialog');

        this._dialogDB_v2 = scene.cache.json.get('dialog_v2');

        this._questDB = scene.cache.json.get('quest');

        this._abilityDB = scene.cache.json.get('skill');

        this._abTree = scene.cache.json.get('sk_tree');
    }

    static lut(key)
    {
        switch(key)
        {
            case 'CAT_WEAPON':         return GM.CAT.WEAPON;
            case 'CAT_HELMET':         return GM.CAT.HELMET;
            case 'CAT_CHESTPLATE':     return GM.CAT.CHESTPLATE;
            case 'CAT_GLOVES':         return GM.CAT.GLOVES;
            case 'CAT_BOOTS':          return GM.CAT.BOOTS;
            case 'CAT_NECKLACE':       return GM.CAT.NECKLACE;
            case 'CAT_RING':           return GM.CAT.RING;
            case 'CAT_EQUIP':          return GM.CAT.EQUIP;
            case 'CAT_BAG':            return GM.CAT.BAG;
            case 'CAT_FOOD':           return GM.CAT.FOOD;
            case 'CAT_ITEM':           return GM.CAT.ITEM;
            case 'CAT_DEVICE':         return GM.CAT.DEVICE;
            default:                   console.error(`can't find ${key}`); return GM.CAT.ITEM;
        }
    }

    static item(id) { return this._itemDB?.[id]; }

    static role(id) { return this._roleDB?.[id]; }

    static dialog(id) { return this._dialogDB?.[id]; }

    static dialog_v2(id) { return this._dialogDB_v2?.[id]; }

    static quest(id) { return this._questDB?.[id];}

    static ability(id) { return this._abilityDB?.[id]; }

    
}

export class Roles
{
    static list = ['musk','xi','macron','trump','karen','melanie'];
}