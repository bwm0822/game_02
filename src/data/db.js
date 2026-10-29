import {GM} from '../core/setting.js'
import {tr} from '../infra/lang.js'
import {flattenStory, mergeDialog} from './storydata.js'

export default class DB
{
    static _itemDB;

    static get abilities() {return this._abilityDB;}
    static get abTree() {return this._abTree;}

    // 顯示文字在載入時換成目前語言；MainMenu 每次進來都會重跑，所以原文另存在 _src
    static _localize(db, domain)
    {
        for(const [id, val] of Object.entries(db))
        {
            val._src ??= {lab:val.lab ?? id, des:val.des};
            val.lab = tr(`${domain}.${id}`, val._src.lab);
            val.des = tr(`${domain}.${id}`, val._src.des);
        }
    }

    static load(scene)
    {
        this._itemDB = scene.cache.json.get('item');
        for (let val of Object.values(this._itemDB))
        {
            if(typeof val.cat === 'string') {val.cat = this.lut(val.cat);}
        }
        this._localize(this._itemDB, 'item');

        this._roleDB = scene.cache.json.get('role');
        this._localize(this._roleDB, 'role');

        this._dialogDB = mergeDialog(scene.cache.json.get('dialog'), this._roleDB);

        this._abilityDB = scene.cache.json.get('skill');
        this._localize(this._abilityDB, 'ability');

        this._abTree = scene.cache.json.get('sk_tree');

        this._fxDB = scene.cache.json.get('fx');

        this._animDB = scene.cache.json.get('anim');

        this._navDB = scene.cache.json.get('navgraph');

        this._storyDB = flattenStory(scene.cache.json.get('story'));
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

    static itemIds() { return Object.keys(this._itemDB ?? {}); }

    static role(id) { return this._roleDB?.[id]; }

    static roleIds() { return Object.keys(this._roleDB ?? {}); }

    // 可選的玩家角色，順序照 role.json
    static playerIds() { return this.roleIds().filter(id=>this._roleDB[id].kind==='player'); }

    static dialog(id) {return this._dialogDB?.[id]; }

    static ability(id) { return this._abilityDB?.[id]; }

    static fx(id) { return this._fxDB?.[id]; }

    static anim(id) { return this._animDB?.[id]; }

    static navgraph() { return this._navDB; }

    static story() { return this._storyDB; }

    static spawn(group) { return this._storyDB?.spawns?.[group]; }

    static qualities() { return this._storyDB?.qualities ?? {}; }
}