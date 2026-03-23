import {GameScene} from "./GameScene"
import Ui from '../ui/uicommon.js'
import {GM,UI} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'
import {MPlayer} from '../roles/mplayer.js'
import TimeSystem from '../systems/time.js'
import UiTime from '../ui/uitime.js'
import QuestManager from '../manager/quest.js'


let lutAmbient = [   
    0x707070    ,
    0x707070    ,
    0x707070    ,
    0x707070	,
    0x949494	,
    0xB8B8B8	,
    0xDBDBDB	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xFFFFFF	,
    0xF4F4F4	,
    0xDBDBDB	,
    0xB8B8B8	,
    0x949494	,
    0x707070	,
    0x707070	,
    0x707070	,
    0x707070	,
    0x707070	,
    ]

export class GameMap extends GameScene
{
    constructor()
    {
        console.log('GameMap');
        super('GameMap');
    }

    updateQuest()
    {
        for(let id in QuestManager.quests.opened)
        {
            let q = QuestManager.query(id);
            if(q.nid)
            {
                const found = Object.values(this.scene.scene.gos)
                                    .find(go=>go.map===q.nid);
                found && found.addTag(q)
            }
        }
    }

    showNodeTag(on)
    {
        dlog(T.SCENE)('---------------- showNodeTag')
        Object.values(this.scene.scene.gos).forEach(go=>go.showTag?.(on))
    }

    showNodeName(on)
    {
        dlog(T.SCENE)('----------------- showNodeName')
        Object.values(this.scene.scene.gos).forEach(go=>go.showName?.(on))
    }

    focusOnPlayer() {this.cameraPan();}

    setEvent()
    {        
        super.setEvent();
        const ui = this.scene.get('UI');
        ui.events
            .off('focusOnPlayer').on('focusOnPlayer', ()=>{this.focusOnPlayer();})
            .off('showNodeName').on('showNodeName', (on)=>{this.showNodeName(on);})
            .off('showNodeTag').on('showNodeTag', (on)=>{this.showNodeTag(on);})
    }



    async create()
    {
        // await super.create({diagonal:false,classType:Role.Target,weight:0});  
        await super.create({diagonal:false,classType:MPlayer,weight:0});  
        this.updateQuest();            
        this.process();
    }

    getAmbientColor(time)
    {
        return lutAmbient[time.h];
    }

    initUI() 
    {
        super.initUI();
        // UiMain.show();
        Ui.on(UI.TAG.MAPLEGEND);
        TimeSystem.register(UiTime.updateTime.bind(UiTime))
    }

    async process()
    {
        while(true)
        {
            await GM.player.process();
            TimeSystem.inc(60);
        }
    }
}