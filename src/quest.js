import Record from './record.js'
import DB from './db.js'
import {GM} from './setting.js'
import {getPlayer} from './roles/player.js'


function isDone(cond) { return cond.cur >= cond.dat.count; }

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
        if(cond.dat.type!==GM.FINAL && isDone(cond)===false) {return 'open';}
    }
    return 'finish';
}

function fmt_des(q)
{
    return `\n${q.dat.des}\n`;
}

function fmt_conds(q)
{
    let ret = `\n[color=yellow]${'conditions'.lab()}[/color]\n`;

    q.conds.forEach((cond) => {
        switch (cond.dat.type) 
        {
            case GM.KILL:
                if(cond.shown)
                {
                    let flag = cond.done ? '🗹':'☐';
                    ret+=`${flag} ${cond.dat.type.lab()} ${cond.dat.id.lab()} (${cond.cur}/${cond.dat.count})\n`
                }
                break;
            case GM.TALK:
                if(cond.shown)
                {
                    ret+=`☐ ${cond.dat.type} ${cond.dat.id}\n`;
                }
                break;
            case GM.FINAL:
                if (q.state === 'finish') {
                    ret += `☐ ${cond.dat.des}\n`;
                }
                else if(q.state === 'close') {
                    ret += `🗹 ${cond.dat.des}\n`;
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

function fmt_title(q)
{
    return `${q.state==='close' ? '🗹':'☐'} ${q.dat.title}`;
}

function check(q, chk)
{
    q.conds.forEach(cond=>{
        if(!cond.done && chk.type===cond.dat.type)
        {
            if(cond.dat.id && cond.dat.id===chk.id)
            {
                cond.cur+=1;
            }
        }
    })
}

export default class QuestManager
{
    static quests={opened:{}, closed:{}};

    static add(id)
    {
        let qD = DB.quest(id);
        let conds = [];
        qD.conds.forEach(() => {conds.push({cur:0})});
        this.quests.opened[id] = {conds:conds}
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
                if(!cond.dat) {Object.defineProperty( cond, 'dat', {get() {return qD.conds[i];}} );}
                if(cond.done===undefined) {Object.defineProperty( cond, 'done', {get() {return isDone(cond);}} );}
                if(cond.shown===undefined) {Object.defineProperty( cond, 'shown', {get() {return isShown(q.conds,cond);}} );}
            })
            if(!q.dat) {Object.defineProperty(q, 'dat', {get() {return qD;}});}
            if(!q.state) {Object.defineProperty(q, 'state', {get() {return q.result??getState(q.conds);}});}
            if(!q.fmt) {q.fmt = ()=>{return this.fmt(id);};}
            if(!q.check) {q.check = (chk)=>{return check(q,chk);};}
            if(!q.title) {q.title = ()=>{return fmt_title(q);}}

        }
        return q;
    }

    static fmt(id)
    {
        let qD = DB.quest(id);
        let q = this.quests.opened[id];
        let ret = fmt_des(q) + fmt_conds(q) + fmt_rewards(qD.rewards);
        return ret;
        
    }

    static notify({type, id})
    {
        for(let qid in this.quests.opened)
        {
            const q = this.query(qid);
            q.check({type,id});
        }
    }

    static close(id)
    {
        let q = this.quests.opened[id];
        let qD = DB.quest(id);
        getPlayer().receive(qD.rewards);
        q.result = 'close';
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