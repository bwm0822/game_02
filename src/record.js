import Utility from './utility.js'

export default class Record
{
    static data = {default:'entry', map:'village-01', 
                    time:{d:0,h:8,m:0},
                    lang:'tw',
                    bgmVolume:1.0,
                    sfxVolume:1.0,
                    }

    static save()
    {
        Utility.save(Record.data);
    }

    static getByUid(mapName, uid, qid)
    {
        if(qid) {return Record.data.scenes?.[mapName]?.[qid]?.[uid];}
        else {return Record.data.scenes?.[mapName]?.prefab[uid];}
    }

    static setByUid(mapName, uid, value, qid)
    {
        if(!Record.data.scenes) { Record.data.scenes = {}; }
        if(!Record.data.scenes[mapName]) { Record.data.scenes[mapName] = { prefab:{}, runtime:[] };}
        if(qid && !Record.data.scenes[mapName][qid] ) { Record.data.scenes[mapName][qid] = {};}
    
        if(uid==-1) { Record.data.scenes[mapName].runtime.push(value); }
        else 
        {
            if(qid) {Record.data.scenes[mapName][qid][uid] = value;}
            else {Record.data.scenes[mapName].prefab[uid] = value;} 
        }
    }

    static load()
    {
        let data = Utility.load();
        if(data) {Record.data = data;}
        return data;
    }

    static remove(mapName, qid)
    {
        delete Record.data.scenes[mapName][qid];
    }

    // static add(map,id,x,y)
    // {
    //     if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
    //     Record.data[map].add.push({id:id,x:x,y:y})
    //     Record.save();
    // }
}