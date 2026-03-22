import Utility from '../core/utility.js'
import {setDEBUG} from '../core/debug.js' 

export default class Record
{
    static game_def = { default:'entry', 
                        map:'village-01', 
                        time:{d:0,h:8,m:0},
                    }

    static setting_def = {  lang:'tw',
                            bgmVolume:1.0,
                            sfxVolume:1.0,
                            mouseEdgeMove:false,
                            pointerLock:false,
                        }

    static debug_def = {    enable: false,          // 是否開啟 debug 模式
                            mode: -1,     // 除錯模式
                            loc: true,              // 顯示座標及 weight
                            rect : false,           // 顯示邊框
                            path : true,            // 顯示 NPC 路徑
                            log : true,     
                            filter: [],             // log filter 
                            tag: -1,
                        }
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
        Utility.save(Record.game,'game');
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
        else {return Record.game.scenes?.[mapName]?.prefab[uid];}
    }

    static setByUid(mapName, uid, value, qid)
    {
        if(!Record.game.scenes) { Record.game.scenes = {}; }
        if(!Record.game.scenes[mapName]) { Record.game.scenes[mapName] = { prefab:{}, runtime:[] };}
        if(qid && !Record.game.scenes[mapName][qid] ) { Record.game.scenes[mapName][qid] = {};}
    
        if(uid===-1) {Record.game.scenes[mapName].runtime.push(value); }
        else 
        {
            if(qid) {Record.game.scenes[mapName][qid][uid] = value;}
            else {Record.game.scenes[mapName].prefab[uid] = value;} 
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

    // static add(map,id,x,y)
    // {
    //     if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
    //     Record.data[map].add.push({id:id,x:x,y:y})
    //     Record.save();
    // }
}