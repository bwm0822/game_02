import Utility from './utility.js'

export default class Record
{
    static data = {
        node:'0',
    }

    static save()
    {
        Utility.save(Record.data);
    }

    static load()
    {
        let data = Utility.load();
        if(data){Record.data = data;}
        return data;
    }

    static add(map,id,x,y)
    {
        if(!Record.data[map]){Record.data[map]={remove:[],add:[]};}
        Record.data[map].add.push({id:id,x:x,y:y})
        Record.save();
    }
}