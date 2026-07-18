import Record from '../infra/record.js'
import DB from '../data/db.js'
import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import Ui from '../ui/uicommon.js'
import RenderTexture from 'phaser3-rex-plugins/plugins/gameobjects/mesh/perspective/rendertexture/RenderTexture.js';

function _checkCond(state, step)
{
    return !step.conds || step.conds.every(id=>state?.steps?.[id]);
}

function _exec(actions)
{
    if(!actions||actions.length===0) return; 

    actions.forEach((action)=>{

        const [op, ...args] = action.split(/\s+/);
        const [p1, p2] = args;

        switch(op)
        {
            case 'set':
                Record.setVar(p1, p2??true);
                break;
            case 'close':
                QuestManager.close(p1);
                break;
        }
        
    });
    
}

function _popup(msg) {Ui.get(UI.TAG.POPUP).push(msg);}

function _queryCount(id)
{
    return GM.player.queryItem(itm=>itm.id===id)
                    .reduce((sum, itm) => sum + itm.count, 0);
}

function _isQuestDone(q)
{
    // q = {cat:{}, dat:{}, sta:{}}
    return Object.entries(q.dat.steps).every(([stepId,step])=>_isStepDone(q,stepId,step))
}

function _isStepDone(q, stepId, step)
{
    const type = step.complete.type;
    if(type==='collect') return _queryCount(step.complete.id) >= step.complete.required;
    if(type==='none') return true;
    return q.sta.steps[stepId];
}

export default class QuestManager
{
    static quests={active:{}, close:{}};
    static updated=new Set(); // 追蹤有更新的 quest

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
                if (state.steps[stepId]) continue;
                if (step.complete.type !== type) continue;
                if (!_checkCond(state, step)) continue;

                switch (type)
                {
                    case 'kill':
                        if (step.complete.id === id)
                        {
                            state.counters[stepId] = (state.counters[stepId] ?? 0) + 1;
                            if (state.counters[stepId] >= step.complete.required)
                            {
                                state.steps[stepId] = true;
                                this.updated.add(questId);
                                _exec(step.actions);
                                _popup(`更新任務`);
                            }
                        }
                        break;

                    case 'collect':
                        // const sum = GM.player.queryItem(itm=>itm.id===step.complete.id)
                        //                     .reduce((sum, itm) => sum + itm.count, 0);
                        const sum = _queryCount(step.complete.id);
                        const required = step.complete.required;
                        state.counters[stepId] = Math.min(sum,required)
                        if (sum >= required)
                        {
                            state.steps[stepId] = true;
                            this.updated.add(questId);
                            _exec(step.actions);
                            _popup(`更新任務`);
                        }
                        break;

                    case 'flag':
                        if (Record.getVar(step.complete.flag))
                        {
                            state.steps[stepId] = true;
                            this.updated.add(questId);
                            _exec(step.actions);
                            _popup(`更新任務`);
                        }
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
        const qD = DB.quest(id);
        if (!qD) {
            console.error(`Quest not found: ${id}`);
            return;
        }
        this.quests.active[id] = {steps:{},counters:{}, sta:'open', close:false};
        _exec(qD.action?.start);
        this.updated.add(id);
        this.save();
        _popup(`更新任務`);
        // this.notify({cat:GM.INV})
    }

    // 完成任務
    static close(id)
    {
        const q = this.quests.active[id];
        if (!q) return;

        q.sta = 'close';
        q.close = true;
        const qD = DB.quest(id);
        if (qD) {
            if(qD.rewards) {GM.player.reward(qD.rewards);}
            if(qD.actions) {_exec(qD.actions);}
        }

        this.quests.close[id] = q;
        delete this.quests.active[id];
        this.save();
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
        // q = {cat:{}, dat:{}, sta:{}}

        let des = `\n${q.dat.descKey}\n`;
        Object.entries(q.dat.steps).forEach(([stepId, step]) => {
            // 
            if (!_checkCond(q.sta,step)) return;

            let prefix='';
            if(q.sta.close)
            {
                if(step.complete.type!=='none')
                {
                    prefix = q.sta.steps[stepId] ?'🗹 ':'☐ ';  
                }
            }
            else
            {
                if(step.complete.type!=='none')
                {
                    prefix = _isStepDone(q, stepId, step) ?'🗹 ':'☐ ';   
                }
            }

            // const done = q.sta.close ? q.sta.steps[stepId] 
            //                          : _isStepDone(q, stepId, step);

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

            // des += `${done?'🗹':'☐'} ${stepDesc}\n`;
            des += `${prefix}${stepDesc}\n`;
        });

        return des;
    }

    static queryClose(id)
    {
        if(!this.quests.close[id]) {return null;}
        const qD = DB.quest(id);
        if (!qD) {return null;}
        const q={cat:'已完成', dat:qD, sta:this.quests.close[id]};
        return q;
    }

    
    static queryActive(id)
    {
        if(!this.quests.active[id]) {return null;}
        const qD = DB.quest(id);
        if (!qD) {return null;}
        const q={cat:'一般任務', dat:qD, sta:this.quests.active[id]};
        return q;
    }

    static getState(id)
    {
        let ret;
        if(this.quests.active[id])  
        {
            const q={dat:DB.quest(id), sta:this.quests.active[id]}
            ret = _isQuestDone(q) ? 'done' : 'open';
        }
        else
        {
            console.log(this.quests.close[id])
            ret = this.quests.close[id]?.close ? 'close' : undefined;
        }

        console.log(id, ret)

        return ret;
    }

    // static notify({cat, id})
    // {
    //     return; // 暫時關閉通知
    //     for(const qid in this.quests.active)
    //     {
    //         const q = this.query(qid);
    //         q.notify({cat, id});
    //     }
    // }

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
    static onCollect(dbg) {this._checkSteps('collect');}
    static onFlag() {this._checkSteps('flag');}

}