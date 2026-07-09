import Record from '../infra/record.js'
import DB from '../data/db.js'
import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import Ui from '../ui/uicommon.js'
import RenderTexture from 'phaser3-rex-plugins/plugins/gameobjects/mesh/perspective/rendertexture/RenderTexture.js';


export default class QuestManager
{
    static quests={active:{}, close:{}};

    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    static _checkSteps(type, id) 
    {
        for (const questId in this.quests.active) 
        {
            const quest = DB.quest(questId);
            if (!quest) continue;

            const state = this.quests.active[questId];
            for (const stepId in quest.steps) 
            {
                const step = quest.steps[stepId];
                if (state.completedSteps[stepId]) continue;
                if (step.complete.type !== type) continue;

                switch (type)
                {
                    case 'kill':   
                        if (step.complete.id === id)
                        {
                            state.counters[stepId] = (state.counters[stepId] ?? 0) + 1;
                            if (state.counters[stepId] >= step.complete.required)
                            {
                                state.completedSteps[stepId] = true;
                            }
                        } 
                        break;

                    case 'collect':
                        break;

                    case 'flag':
                        if (Record.getVar(step.complete.flag))
                        {
                            state.completedSteps[stepId] = true;
                            console.log(`Quest ${questId} step ${stepId} completed due to flag ${step.complete.flag}`);
                        }
                        break; 
                }
            }
        }
    }

    static _exec(action)
    {
        if(action)
        {
            const cmds = action.split(';').map(a => a.trim()).filter(a => a);
            for (const cmd of cmds) 
            {
                const [op, ...args] = cmd.split(/\s+/);
                const [p1, p2] = args;

                switch(op)
                {
                    case 'set':
                        Record.setVar(p1, true);
                        break;
                }
            }
        }
    }
    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    // 開啟任務
    static start(id)
    {
        var qD = DB.quest(id);
        this.quests.active[id] = {completedSteps: {},counters: {}};
        this._exec(qD.action?.start);
        this.save();
        // this.notify({cat:GM.INV}) 
    }

    // 完成任務
    static close(id)
    {
        var q = this.quests.opened[id];
        const qD = DB.quest(id);
        if(qD.rewards) {GM.player.reward(qD.rewards);}
        if(qD.actions) {this.action(qD.actions)}
    }

    // 移除任務
    static remove(id)
    {
        delete this.quests.active[id];
    }

    // 取得任務 title
    static title(q)
    {
        return `[color=yellow]${q.dat.titleKey}[/color]`;
    }

    // 取得任務內容
    static content(q)
    {
        let des = `\n${q.dat.descKey}\n`; 
        Object.entries(q.dat.steps).forEach(([stepId, step]) => {
            const done = q.sta?.completedSteps?.[stepId] ? '🗹' : '☐';
            let stepDesc = step.descKey;

            // 替換 {current} 為實際計數值
            if (stepDesc.includes('{current}')) {
                const current = q.sta?.counters?.[stepId] ?? 0;
                stepDesc = stepDesc.replace('{current}', current);
            }

            // 替換 {required} 為實際需求值
            if (stepDesc.includes('{required}')) {
                const required = step.complete?.required ?? 0;
                stepDesc = stepDesc.replace('{required}', required);
            }

            des += `${done} ${stepDesc}\n`;
        });

        return des;
    }

    
    static query(id)
    {        
        if(!this.quests.active[id]) {return null;}
        const qD = DB.quest(id);
        const q={cat:'一般任務', dat:DB.quest(id), sta:this.quests.active[id]};
        return q;
    }

    static notify({cat, id})
    {
        return; // 暫時關閉通知
        dlog()('------------------- notify=',cat)
        for(const qid in this.quests.active)
        {
            const q = this.query(qid);
            q.notify({cat, id});
        }
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

    
    static onKill(id) {this._checkSteps('kill', id);}
    static onCollect(dbg) {
        console.log('collect...',dbg);
        // this._checkSteps('collect', id);
    }
    static onFlag() {this._checkSteps('flag');}

}