import Utility from './utility.js'

export default class Record
{
    static data = {default:'出口', map:'town_02', player:{equip:{},bag:{}}}

    static save()
    {
        Utility.save(Record.data);
    }

    static getByUid(mapName, uid)
    {
        return Record.data[mapName]?.[uid];
    }

    static setByUid(mapName, uid, value)
    {
        if(!Record.data[mapName]){Record.data[mapName]={};}
        Record.data[mapName][uid] = value;
    }

    static load()
    {
        let data = Utility.load();
        if(data) {Record.data = data;}
        return data;
    }

    static add(map,id,x,y)
    {
        if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
        Record.data[map].add.push({id:id,x:x,y:y})
        Record.save();
    }
}