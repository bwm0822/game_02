import {GM} from '../core/setting.js';
import Record from './record.js';

export default class Local
{
    static _local;

    static get lang() {return Record.setting.lang;}

    static load(scene)
    {
        this._local = scene.cache.json.get('local');
        // console.log(this._local)
    }

    static lab(key)
    {
        return this._local?.[key]?.[this.lang]?.lab ?? `[color=red]${key}[/color]`;
    }

    static des(key)
    {
        return this._local?.[key]?.[this.lang]?.des ?? '';//`[color=red]${key}[/color]`;
    }

    static des(key,{num}={})
    {
        const str = this._local?.[key]?.[this.lang]?.des ?? '';

        return str.replace(/{#(\w+)}/g, (match, arg) => {
            switch(arg)
            {
                case 'num': return `${num}`;
            }}
        );
    }

    static lut(key)
    {
        switch(key)
        {
            case GM.CAT.WEAPON: return 'weapon';
            case GM.CAT.HELMET: return 'helmet';
            case GM.CAT.CHESTPLATE: return 'chestplate';
            case GM.CAT.GLOVES: return 'gloves';
            case GM.CAT.BOOTS: return 'boots';
            case GM.CAT.NECKLACE: return 'necklace';
            case GM.CAT.RING: return 'ring';
            case GM.CAT.EQUIP: return 'equip';
            case GM.CAT.BAG: return 'bag';
            case GM.CAT.ITEM: return 'item';
            case GM.CAT.FOOD: return 'food';
            case GM.CAT.DEVICE: return 'device';
            default: return key.toString();
        }
    }
}

String.prototype.lab = function(){ return Local.lab(this); };
String.prototype.des = function(args){ return Local.des(this, args); };
Number.prototype.lab = function(){ return Local.lab(Local.lut(this)); };

