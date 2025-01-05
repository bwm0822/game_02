import { Scene } from 'phaser';
import * as Role from '../role';
import Utility from '../utility';
import Battle from '../battle.js';
import {BuffInfo} from '../gameUi.js';
import {NodeDB, BattleDB} from '../database.js';
import Record from '../record.js'

export class GameBattle extends Scene
{
    constructor ()
    {
        super('GameBattle');
        this._done=false;
    }

    // init(data)
    // {
    //     console.log('init',data);
    //     this._node = NodeDB.get(data.id);
    //     console.log(this._node);
    // }

    init(data)
    {
        console.log('init',data);
        this._node = BattleDB.get(data.id);
        console.log(this._node);
    }

    create ()
    {
        Battle.init(this);
        // if(!this._done)
        // {
        //     this._done=true;
        //     this.events.on('exit',()=>{this.exit();});
        //     this.uiEvent();
        // }
        this.uiEvent();
        this.initUI();
       
    }

    initUI()
    {
        this.events.emit('gameBattle');
    }

    exit()
    {
        //this.events.off('exit');
        //this.scene.start('GameMap');
        console.log(Record.data);
        this.scene.start('GameTown',Record.data.id,Record.data.map);
    }

    uiEvent()
    {
        const ui = this.scene.get('UI');
        ui.events.off('battle').off('selected').off('exit');
        // ui.events.on('battle', (n)=>{Battle.init(this);} )
        //         .on('selected', (sel)=>{Battle.setSelected(sel);} )
        //         .on('exit', ()=>{this.exit();} )
        ui.events.off('selected').off('exit');
        ui.events.on('selected', (sel)=>{Battle.setSelected(sel);} )
                .on('exit', ()=>{this.exit();} )
    }

}


