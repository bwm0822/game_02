import Record from '../infra/record.js'
import DB from '../data/db.js'
import {GM,UI} from '../core/setting.js'
import {dlog} from '../core/debug.js'
import Ui from '../ui/uicommon.js'
import RenderTexture from 'phaser3-rex-plugins/plugins/gameobjects/mesh/perspective/rendertexture/RenderTexture.js';


export default class QuestManager
{
    static quests={active:{}, close:{}};

    static add(id)
    {
        var qD = DB.quest(id);
        this.quests.active[id] = {completedSteps: {},counters: {}}
        this.save();
        this.notify({cat:GM.INV}) 
    }

    static query(id)
    {                
        return q;
    }

    static notify({cat, id})
    {
        dlog()('------------------- notify=',cat)
        for(const qid in this.quests.active)
        {
            const q = this.query(qid);
            q.notify({cat, id});
        }
    }

    

    static close(id)
    {
        var q = this.quests.opened[id];
        const qD = DB.quest(id);
        if(qD.rewards) {GM.player.reward(qD.rewards);}
        if(qD.actions) {this.action(qD.actions)}
    }

    static remove(id)
    {
        delete this.quests.active[id];
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