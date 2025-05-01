import {GM} from './setting.js';

export default class Local
{
    static _local;
    static _lang='us';

    static get lang() {return this._lang;}
    static set lang(value) {this._lang=value;}

    static load(scene)
    {
        this._local = scene.cache.json.get('local');
        console.log(this._local)
    }

    static lab(key)
    {
        return this._local?.[key]?.[this._lang].lab ?? `[color=red]${key}[/color]`;
    }

    static des(key)
    {
        return this._local?.[key]?.[this._lang].des ?? `[color=red]${key}[/color]`;
    }

    static lut(key)
    {
        switch(key)
        {
            case GM.CAT_WEAPON: return 'weapon';
            case GM.CAT_HELMET: return 'helmet';
            case GM.CAT_CHESTPLATE: return 'chestplate';
            case GM.CAT_GLOVES: return 'gloves';
            case GM.CAT_BOOTS: return 'boots';
            case GM.CAT_NECKLACE: return 'necklace';
            case GM.CAT_RING: return 'ring';
            case GM.CAT_EQUIP: return 'equip';
            case GM.CAT_BAG: return 'bag';
            case GM.CAT_ITEM: return 'item';
            case GM.CAT_FOOD: return 'food';
            default: return key.toString();
        }
    }
}

String.prototype.lab = function(){ return Local.lab(this); };
String.prototype.des = function(){ return Local.des(this); };
Number.prototype.lab = function(){ return Local.lab(Local.lut(this)); };

