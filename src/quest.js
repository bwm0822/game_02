import Record from './record';
import DB from './db';
import {GM} from './setting';
import * as Role from './role.js';

export default class QuestManager
{
    static opened={};
    static closed={};

    static testCond(cond)
    {
        switch(cond.type)
        {
            case GM.KILL: return cond.cur >= cond.cnt;
        }
    }

    static isShowCond(conds, cond)
    {
        if(!cond.cond) {return true;}
        for(let i of cond.cond)
        {
            if(this.testCond(conds[i]) == false) {return false;}
        }
        return true;
    }

    static getState(conds)
    {
        for(let cond of conds)
        {
            if(cond.type != GM.FINAL && this.testCond(cond) == false) {return 'open';}
        }
        return 'finish';
    }

    static add(id)
    {
        let questD = DB.quest(id);
        let conds=[]
        questD.conds.forEach(cond => {
            switch(cond.type)
            {
                case GM.KILL: conds.push({...cond,cur:0,cnt:1}); break;
                case GM.TALK: conds.push({...cond,cur:0}); break;
                case GM.FINAL: conds.push({...cond,cur:0}); break;
            }
            
        });
        QuestManager.opened[id]={status:'open',conds:conds}
        QuestManager.save();
        // let quest = DB.quest(id);
        // QuestManager.process(quest.act);
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
        //console.log(QuestManager.opened,id);
        //return QuestManager.opened.includes(id);
        
        let q = QuestManager.opened[id];
        if(q)
        {
            q.conds.forEach(cond=>{
                cond.test=()=>{return this.testCond(cond)};
                cond.shown=()=>{return this.isShowCond(q.conds,cond)};
            })
            q.state = ()=>{return this.getState(q.conds)}
        }


        return q;

    }

    static check(id, chk)
    {
        let q = QuestManager.opened[id];
        if(q)
        {
            q.conds.forEach(cond=>{
                if(chk.type == cond.type)
                {
                    if(cond.id && cond.id == chk.id)
                    {
                        cond.cur+=1;
                    }
                }
            })
        }
        console.log(q);
    }

    static close(id)
    {
        // let i = QuestManager.opened.indexOf(id);
        // if(i>-1)
        // {
        //     QuestManager.opened.splice(id,1);
        //     QuestManager.closed.push(id)
        // }
        let q = QuestManager.opened[id];
        let questD = DB.quest(id);
        questD.rewards.forEach((reward)=>{
            switch(reward.type)
            {
                case 'gold': Role.getPlayer().status.gold+=reward.count; break;
            }
        })
        q.status='close';
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