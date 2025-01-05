import Record from './record';
import {QuestDB} from './database';

export class QuestManager
{
    static opened=[];
    static closed=[];

    static add(id)
    {
        QuestManager.opened.push(id);
        QuestManager.save();
        let quest = QuestDB.get(id);
        QuestManager.process(quest.act);
    }

    static process(act)
    {
        switch(act.type)
        {
            case 'add': 
                Record.add(act.map,act.id,act.x,act.y);
                break;
        }
    }

    static query(id)
    {
        console.log(QuestManager.opened,id);
        return QuestManager.opened.includes(id);
    }

    static close(id)
    {
        let i = QuestManager.opened.indexOf(id);
        if(i>-1)
        {
            QuestManager.opened.splice(id,1);
            QuestManager.closed.push(id)
        }
    }

    static save()
    {
        Record.data.quest = {opened:QuestManager.opened,
                            closed:QuestManager.closed};
        Record.save();
    }

    static load()
    {
        if(Record.data.quest)
        {
            QuestManager.opened = Record.data.quest.opened;
            QuestManager.closed = Record.data.quest.closed;
        }
    }
}