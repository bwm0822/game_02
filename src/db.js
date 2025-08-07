import {GM} from './setting.js';

export default class DB
{
    static _itemDB;

    static get skills() {return this._skillDB;}
    static get skTree() {return this._skTree;}

    static load(scene)
    {
        this._itemDB = scene.cache.json.get('item');
        for (let val of Object.values(this._itemDB)) 
        {
            if(val.cat) {val.cat = this.lut(val.cat);}
        }

        this._roleDB = scene.cache.json.get('role');

        this._dialogDB = scene.cache.json.get('dialog');

        this._questDB = scene.cache.json.get('quest');

        this._skillDB = scene.cache.json.get('skill');

        this._skTree = scene.cache.json.get('sk_tree');
    }

    static lut(key)
    {
        switch(key)
        {
            case 'CAT_WEAPON':         return GM.CAT_WEAPON;  
            case 'CAT_HELMET':         return GM.CAT_HELMET;    
            case 'CAT_CHESTPLATE':     return GM.CAT_CHESTPLATE;
            case 'CAT_GLOVES':         return GM.CAT_GLOVES;    
            case 'CAT_BOOTS':          return GM.CAT_BOOTS;    
            case 'CAT_NECKLACE':       return GM.CAT_NECKLACE;  
            case 'CAT_RING':           return GM.CAT_RING;      
            case 'CAT_EQUIP':          return GM.CAT_EQUIP;     
            case 'CAT_BAG':            return GM.CAT_BAG;       
            case 'CAT_ITEM':           return GM.CAT_ITEM;      
            case 'CAT_FOOD':           return GM.CAT_FOOD;      
            default:                   console.error(`can't find ${key}`); return GM.CAT_ITEM;
        }
    }

    static item(id) { return this._itemDB?.[id]; }

    static role(id) { return this._roleDB?.[id]; }

    static dialog(id) { return this._dialogDB?.[id]; }

    static quest(id) { return this._questDB?.[id];}

    static skill(id) { return this._skillDB?.[id]; }

    
}