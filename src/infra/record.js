import Utility from '../core/utility.js'
import {setDEBUG,DEBUG} from '../core/debug.js' 
import QuestManager from '../manager/quest.js'

export default class Record
{
    static game_def = { default:'entry',
                        map:'m/m_04x05',
                        time:{d:0,h:8,m:0},
                        vars:{}
                    }

    static setting_def = {  lang:'tw',
                            bgmVolume:1.0,
                            sfxVolume:1.0,
                            mouseEdgeMove:false,
                            pointerLock:false,
                        }

    static debug_def = DEBUG;
    static game;
    static setting;
    static debug;

    static delete()
    {
        Utility.delete();
    }

    // static save()
    // {
    //     Utility.save(Record.data);
    // }

    static saveGame()
    {
        Record._pruneScenes();
        Utility.save(Record.game,'game');
    }

    // 存檔前清掉空的 scenes 資料：prefab/runtime 空了就刪掉該 key，
    // 整個地圖的 scenes[mapName] 完全沒有任何 key（包含任務用的 qid 命名空間）才整個刪掉
    static _pruneScenes()
    {
        const scenes = Record.game.scenes;
        if(!scenes) {return;}

        for(const mapName in scenes)
        {
            const s = scenes[mapName];
            if(s.prefab && Object.keys(s.prefab).length===0) {delete s.prefab;}
            if(s.runtime && s.runtime.length===0) {delete s.runtime;}
            if(Object.keys(s).length===0) {delete scenes[mapName];}
        }
    }

    static saveSetting()
    {
        Utility.save(Record.setting,'setting');
    }

    static saveDebug()
    {
        Utility.save(Record.debug,'debug');
    }

    static getByUid(mapName, uid, qid)
    {
        if(qid) {return Record.game.scenes?.[mapName]?.[qid]?.[uid];}
        else {return Record.game.scenes?.[mapName]?.prefab?.[uid];}
    }

    // _pruneScenes() 存檔時可能把 prefab/runtime 個別刪掉(地圖整個物件還在，只是空的
    // key 被清掉)，所以這裡不能只檢查 scenes[mapName] 存不存在，prefab/runtime 也要各自補回來
    static setByUid(mapName, uid, value, qid)
    {
        if(!Record.game.scenes) { Record.game.scenes = {}; }
        if(!Record.game.scenes[mapName]) { Record.game.scenes[mapName] = {};}
        const s = Record.game.scenes[mapName];
        if(qid && !s[qid]) { s[qid] = {};}

        if(uid===-1)
        {
            if(!s.runtime) {s.runtime = [];}
            s.runtime.push(value);
        }
        else
        {
            // qid 代表是 quest id
            if(qid) {s[qid][uid] = value;}
            else
            {
                if(!s.prefab) {s.prefab = {};}
                s.prefab[uid] = value;
            }
        }
    }

    // static load()
    // {
    //     let data = Utility.load();
    //     if(data) {this.data = data;}
    //     else {this.data = Utility.deepClone(this.default);}
    //     return data;
    // }

    static loadGame()
    {
        let data = Utility.load('game');
        if(data) {this.game = data;}
        else {this.game = Utility.deepClone(this.game_def);}
        return data;
    }

    static loadSetting()
    {
        let data = Utility.load('setting');
        if(data) {this.setting = data;}
        else {this.setting = Utility.deepClone(this.setting_def);}
        return data;
    }

    static loadDebug()
    {
        let data = Utility.load('debug');
        if(data) {this.debug = data;}
        else {this.debug = Utility.deepClone(this.debug_def);}
        setDEBUG(this.debug);
        return data;
    }

    static remove(mapName, qid)
    {
        delete Record.game.scenes[mapName]?.[qid];
    }

    static deleteByUid(mapName, uid, qid)
    {
        if(qid) { delete Record.game.scenes?.[mapName]?.[qid]?.[uid]; }
        else { delete Record.game.scenes?.[mapName]?.prefab?.[uid]; }
    }

    static setEntry(key, value)
    {
        if(!Record.game.vars[key]) {Record.game.vars[key]={opts:[]};}
        Record.game.vars[key].entry = value;
    }

    static addOpt(key, value)
    {
        if(!Record.game.vars[key]) {Record.game.vars[key]={opts:[]};}
        Record.game.vars[key].opts.push(value);
    }

    static rmOpt(key, value)
    {
        if(Record.game.vars?.[key]?.opts)
        {
            const idx = Record.game.vars[key].opts.indexOf(value);
            if(idx!==-1) { Record.game.vars[key].opts.splice(idx,1); }
        }
    }

    // static getVar(key)
    // {
    //     if(!Record.game.vars[key]) {Record.game.vars[key]={opts:[]};}
    //     return Record.game.vars[key];
    // }

    static setVar(key, value)
    {
        Record.game.vars[key]=value;
        QuestManager.onFlag();
    }

    static rmVar(key)
    {
        delete Record.game.vars[key];
    }

    static getVar(key)
    {
        return Record.game?.vars[key];
    }



    // static add(map,id,x,y)
    // {
    //     if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
    //     Record.data[map].add.push({id:id,x:x,y:y})
    //     Record.save();
    // }
}