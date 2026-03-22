import Record from '../infra/record.js'
import DB from '../data/db.js'
import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import Ui from '../ui/uicommon.js'
import RenderTexture from 'phaser3-rex-plugins/plugins/gameobjects/mesh/perspective/rendertexture/RenderTexture.js';


function isDone(cond) 
{
    if(cond.state==='done') {return true;}

    if(cond.cat===GM.INV)
    {
        cond.cur = Math.min( GM.player.query(cond.dat), cond.dat.count );  
    }

    const done = cond.cur>=cond.dat.count
    if(done&&!cond.state) 
    {
        cond.state=cond.cat===GM.INV?'check':'done';
        Ui.get(UI.TAG.MESSAGE).push(fmt_done(cond));
    }
    return done;
}

function isShown(conds, cond)
{
    if(!cond.dat.refs) {return true;}
    for(let i of cond.dat.refs)
    {
        if(!conds[i].state) {return false;}
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
    for(const cond of q.conds)
    {
        if(cond.dat.type===GM.REPORT) {return GM.REPORT;}
        if(!cond.done) {return 'open';}
    }
    return 'close';
}

function getNid(q)
{
    if(q.state==='close') {return null;}
    let nid;
    for(const cond of q.conds)
    {
        if(cond.shown) {nid=cond.dat.nid;}
    }
    return nid;
}

function fmt_done(cond)
{
    return `[完成] ${cond.dat.type.lab()} ${cond.dat.id.lab()}`;
}

function fmt_des(q)
{
    return `\n${q.dat.des}\n`;
}

function fmt_cond(q)
{
    let ret='';
    q.conds.forEach((cond) => {
        switch (cond.dat.type) 
        {
            case GM.KILL:
            case GM.TALK:
            case GM.FIND:
                if(cond.shown & !cond.state)
                {ret+=`\n- ${cond.dat.type.lab()} ${cond.dat.id.lab()}`;}
                break;
            case GM.REPORT:
                if (cond.shown) {ret+=`\n- ${cond.dat.des}`;}
                break;
        }
    });
    return ret;
}

function fmt_conds(q)
{
    let ret = `\n[color=yellow]${'conditions'.lab()}[/color]\n`;

    q.conds.forEach((cond) => {
        switch (cond.dat.type) 
        {
            case GM.KILL:
            case GM.FIND:
                if(cond.shown)
                {
                    let flag = cond.done ? '🗹':'☐';
                    ret+=`${flag} ${cond.dat.type.lab()} ${cond.dat.id.lab()} (${cond.cur}/${cond.dat.count})\n`
                }
                break;
            case GM.TALK:
                if(cond.shown) {ret+=`☐ ${cond.dat.type} ${cond.dat.id}\n`;}
                break;
            case GM.REPORT:
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

// function check(q, chk)
// {
//     q.conds.forEach(cond=>{
//         if(!cond.done && chk.type===cond.dat.type)
//         {
//             if(cond.dat.id && cond.dat.id===chk.id)
//             {
//                 cond.cur+=1;
//             }
//         }
//     })
// }

// function check(q, chk)
// {
//     q.conds.forEach(cond=>{
//         if(!cond.done && chk.type===cond.dat.type)
//         {
//             if(cond.dat.id && cond.dat.id!==chk.id) { return;}
//             if(cond.dat.q && cond.dat.q!==chk.tag) { return;}
//             cond.cur+=1;
//         }
//     })
// }

function typeToCat(type)
{
    switch(type)
    {
        case GM.KILL: return GM.KILL;
        default: return GM.INV;
    }
}


function notify(q, chk)
{
    q.conds.forEach(cond=>{
        if(!cond.chk && cond.cat===chk.cat)
        {
            switch (cond.dat.type)
            {
                case GM.KILL:
                    if(cond.dat.id && cond.dat.id!==chk.id) { break;}
                    if(cond.dat.q && cond.dat.q!==chk.tag) { break;}
                    cond.cur+=1;
                    break;
            }

            cond.done;
            
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
        // console.log(q)
        if(q)
        {
            const qD = DB.quest(id);
            q.conds.forEach((cond, i) => {
                if(!("dat" in cond)) {Object.defineProperty( cond, 'dat', {get() {return qD.conds[i];}} );}
                if(!("done" in cond)) {Object.defineProperty( cond, 'done', {get() {return isDone(cond);}} );}
                if(!("shown" in cond)) {Object.defineProperty( cond, 'shown', {get() {return isShown(q.conds,cond);}} );}
                if(!("cat" in cond)) {Object.defineProperty( cond, 'cat', {get() {return typeToCat(qD.conds[i].type);}} );}
            })

            if(!("dat" in q)) {Object.defineProperty(q, 'dat', {get() {return qD;}});}
            if(!("state" in q)) {Object.defineProperty(q, 'state', {get() {return q.result??getState(q);}});}
            if(!("nid" in q)) {Object.defineProperty(q, 'nid', {get() {return getNid(q);}});}

            if(!("fmt" in q)) {q.fmt = ()=>{return this.fmt(id);};}
            if(!("notify" in q)) {q.notify = (chk)=>{return notify(q,chk);};}
            if(!("title" in q)) {q.title = ()=>{return fmt_title(q);}}
            if(!("cat" in q)) {q.cat=q.dat.id.split('_')[0];}
            if(!("cond" in q)) {q.cond= ()=>{return fmt_cond(q);}}

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

    static notify({cat, id})
    {
        dlog()('------------------- notify=',cat)
        for(const qid in this.quests.opened)
        {
            const q = this.query(qid);
            q.notify({cat, id});
        }
    }

    static action(actions)
    {
        actions.forEach((act)=>{
            switch(act.type)
            {
                case 'remove':
                    dlog()('remove')
                    GM.player.remove(act);
                    break;
            }
        })
    }

    static close(id)
    {
        let q = this.quests.opened[id];
        q.conds.forEach(cond=>cond.state='done');
        let qD = DB.quest(id);
        if(qD.rewards) {GM.player.reward(qD.rewards);}
        if(qD.actions) {this.action(qD.actions)}
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