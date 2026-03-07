import Record from '../infra/record.js'
import DB from '../data/db.js'
import {GM} from '../core/setting.js'
import RenderTexture from 'phaser3-rex-plugins/plugins/gameobjects/mesh/perspective/rendertexture/RenderTexture.js';


function isDone(cond) { return cond.cur >= cond.dat.count; }

function isShown_old(conds, cond)
{
    if(!cond.dat.cond) {return true;}
    for(let i of cond.dat.cond)
    {
        if(isDone(conds[i]) === false) {return false;}
    }
    return true;
}

function isShown(conds, cond)
{
    if(!cond.dat.refs) {return true;}
    for(let i of cond.dat.refs)
    {
        if(isDone(conds[i]) === false) {return false;}
    }
    return true;
}

function getState_old(conds)
{
    for(let cond of conds)
    {
        if(cond.dat.type!==GM.FINAL && isDone(cond)===false) {return 'open';}
    }
    return 'finish';
}

function getState(q)
{
    for(let cond of q.conds)
    {
        if(isDone(cond)===false) {return 'open';}
    }
    return 'finish';
}

function getNid(q)
{
    if(q.state!=='open') {return null;}
    let nid;
    for(let cond of q.conds)
    {
        if(isShown(q.conds,cond)) {nid=cond.dat.nid;}
    }
    return nid;
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
            // case GM.FINAL:
            //     if (q.state === 'finish') {
            //         ret += `☐ ${cond.dat.des}\n`;
            //     }
            //     else if(q.state === 'close') {
            //         ret += `🗹 ${cond.dat.des}\n`;
            //     }
            //     break;

            default:
                if (cond.shown) 
                {
                    if(q.state === 'close') {ret += `🗹 ${cond.dat.des}\n`;}
                    else {ret += `☐ ${cond.dat.des}\n`;}
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
    // return `${q.state==='close' ? '🗹':'☐'} ${q.dat.title}`;
    return q.dat.title;
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
        console.log(q)
        if(q)
        {
            let qD = DB.quest(id);
            q.conds.forEach((cond, i) => {
                if(!("dat" in cond)) {Object.defineProperty( cond, 'dat', {get() {return qD.conds[i];}} );}
                if(!("done" in cond)) {Object.defineProperty( cond, 'done', {get() {return isDone(cond);}} );}
                if(!("shown" in cond)) {Object.defineProperty( cond, 'shown', {get() {return isShown(q.conds,cond);}} );}
            })

            if(!("dat" in q)) {Object.defineProperty(q, 'dat', {get() {return qD;}});}
            if(!("state" in q)) {Object.defineProperty(q, 'state', {get() {return q.result??getState(q);}});}
            if(!("nid" in q)) {Object.defineProperty(q, 'nid', {get() {return getNid(q);}});}

            if(!("fmt" in q)) {q.fmt = ()=>{return this.fmt(id);};}
            if(!("check" in q)) {q.check = (chk)=>{return check(q,chk);};}
            if(!("title" in q)) {q.title = ()=>{return fmt_title(q);}}
            if(!("cat" in q)) {q.cat=q.dat.id.split('_')[0];}

        }
        return q;
    }

    static fmt(id)
    {
        let qD = DB.quest(id);
        let q = this.quests.opened[id];
        let ret =   fmt_des(q) + 
                    fmt_conds(q) + 
                    fmt_rewards(qD.rewards);
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
        GM.player.receive(qD.rewards);
        q.result = 'close';
    }

    static remove(id)
    {
        delete this.quests.opened[id];
    }

    static save()
    {
        Record.game.quest = this.quests;
        Record.saveGame();
    }

    static load()
    {
        if(Record.game.quest) {this.quests = Record.game.quest;}
    }
}