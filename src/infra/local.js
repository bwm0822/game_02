import {GM} from '../core/setting.js';
import {tr} from './lang.js';

// local.json 是 UI 原文表，情境 ui.<key>
export default class Local
{
    static _local;

    static load(scene)
    {
        this._local = scene.cache.json.get('local');
    }

    static lab(key, args)
    {
        const src = this._local?.[key]?.lab;
        return src === undefined ? `[color=red]${key}[/color]` : tr(`ui.${key}`, src, args);
    }

    // 不一定有列在 local.json 的 key（例如採集工具的 cat_sub），查不到就顯示 key 本身；角色名稱用 role.label
    static name(id)
    {
        const src = this._local?.[id]?.lab;
        return src === undefined ? `${id}` : tr(`ui.${id}`, src);
    }

    static des(key, args)
    {
        return tr(`ui.${key}`, this._local?.[key]?.des ?? '', args);
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

String.prototype.lab = function(args){ return Local.lab(this, args); };
String.prototype.des = function(args){ return Local.des(this, args); };
Number.prototype.lab = function(){ return Local.lab(Local.lut(this)); };

