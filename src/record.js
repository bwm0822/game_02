import Utility from './utility.js'

export default class Record
{
    static data = {default:'入口', map:'village_01', 
                    time:{d:0,h:8,m:0},
                    lang:'tw',
                    bgmVolume:1.0,
                    sfxVolume:1.0,
                    }

    static save()
    {
        Utility.save(Record.data);
    }

    static getByUid(mapName, uid)
    {
        return Record.data.scenes?.[mapName]?.prefab[uid];
    }

    static setByUid(mapName, uid, value)
    {
        if(!Record.data.scenes) { Record.data.scenes = {}; }
        if(!Record.data.scenes[mapName]) { Record.data.scenes[mapName] = { prefab:{}, runtime:[] };}
    
        // if(!Record.data[mapName]) { Record.data[mapName] = { prefab:{}, runtime:[] }; }
        if(uid==-1) { Record.data.scenes[mapName].runtime.push(value); }
        else { Record.data.scenes[mapName].prefab[uid] = value; }
    }

    static load()
    {
        let data = Utility.load();
        if(data) {Record.data = data;}
        return data;
    }

    // static add(map,id,x,y)
    // {
    //     if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
    //     Record.data[map].add.push({id:id,x:x,y:y})
    //     Record.save();
    // }
}