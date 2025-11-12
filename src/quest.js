import Record from './record';
import DB from './db';
import {GM} from './setting';
import * as Role from './role.js';


function isDone(cond)
{
    switch(cond.dat.type)
    {
        case GM.KILL: return cond.cur >= cond.dat.count;
    }
}

function isShown(conds, cond)
{
    if(!cond.dat.cond) {return true;}
    for(let i of cond.dat.cond)
    {
        if(isDone(conds[i]) === false) {return false;}
    }
    return true;
}

function getState(conds)
{
    for(let cond of conds)
    {
        if(cond.dat.type !== GM.FINAL && isDone(cond) === false) {return 'open';}
    }
    return 'finish';
}

function fmt_conds(q)
{
    let ret = `\n[color=yellow]${'conditions'.lab()}[/color]\n`;

    q.conds.forEach((cond) => {
        console.log(cond.dat);
        switch (cond.dat.type) 
        {
            case GM.KILL:
                if(cond.shown())
                {
                    let flag = cond.done() ? '🗹':'☐';
                    ret+=`${flag} ${cond.dat.type.lab()} ${cond.dat.id.lab()} (${cond.cur}/${cond.dat.count})\n`
                }
                break;
            case GM.TALK:
                if(cond.shown())
                {
                    ret+=`☐ ${cond.dat.type} ${cond.dat.id}\n`;
                }
                break;
            case GM.FINAL:
                if (q.state() == 'finish') {
                    ret += `☐ ${cond.dat.des}\n`;
                }
                break;
        }
    });
    return ret;
}

function fmt_rewards(rewards)
{
    let ret = `\n[color=yellow]${'rewards'.lab()}[/color]\n`;

    rewards.forEach((reward) => {
        switch (reward.type) {
            case 'gold':
                ret += `■ ${reward.type.lab()} x${reward.count}\n`;
                break;
            case 'item':
                ret += `■ ${reward.id.lab()} x${reward.count}\n`;
                break;
        }
    });
    return ret;
}

export default class QuestManager
{
    static quests={opened:{}, closed:{}};

    static add(id)
    {
        let qD = DB.quest(id);
        let conds = [];
        qD.conds.forEach(() => {conds.push({cur:0})});
        this.quests.opened[id]={status:'open',conds:conds}
        this.save();
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
        let q = this.quests.opened[id];
        if(q)
        {
            let qD = DB.quest(id);
            q.conds.forEach((cond, i) => {
                if(!cond.dat) {Object.defineProperty(cond, 'dat', {get() {return qD.conds[i];}});}
                if(!cond.done) {cond.done=()=>{return isDone(cond)};}
                if(!cond.shown) {cond.shown=()=>{return isShown(q.conds,cond)};}
            })
            if(!q.state) {q.state = ()=>{return getState(q.conds)};}
            if(!q.fmt) {q.fmt = ()=>{return this.fmt(id);};}

        }
        return q;
    }

    static fmt(id)
    {
        let qD = DB.quest(id);
        let q = this.quests.opened[id];
        if(q.state==='close')
        {
            return `🗹 任務完成`;
        }
        else
        {
            let ret='';
            ret += fmt_conds(q);
            ret += fmt_rewards(qD.rewards);
            return ret;
        }
    }

    static check(id, chk)
    {
        let q = this.quests.opened[id];
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
    }

    static close(id)
    {
        let q = this.quests.opened[id];
        let qD = DB.quest(id);
        Role.getPlayer().receive(qD.rewards);
        q.status='close';
    }

    static remove(id)
    {
        delete this.quests.opened[id];
    }

    static save()
    {
        Record.data.quest = this.quests;
        Record.save();
    }

    static load()
    {
        if(Record.data.quest) {this.quests = Record.data.quest;}
    }
}