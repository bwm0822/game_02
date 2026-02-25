import {Scene} from 'phaser'
import createUI from '../ui.js'
import {GM} from '../core/setting.js'
import UiCursor from '../ui/uicursor.js'
import DragService from '../services/dragService.js'
import UiDragged from '../ui/uidragged.js'
import Ui from '../ui/uicommon.js'
// import * as Role from '../role.js';

export class UI extends Scene
{
    constructor ()
    {
        console.log('UI');
        super({key:'UI'});
    }

    create ()
    {
        console.log('create UI')
        createUI(this);
        this.uiEvent();
        this.processInput();
        this.input.setDefaultCursor('none');    // 消除預設的游標

        this.input.mouse.requestPointerLock();
        // this.input.enabled = true;
        // this.input.pollAlways = false;
        // this.input.filterObjects = () => []; // 禁止 Phaser 自動處理遊戲物件的輸入事件
    }



    processInput()
    {
        // this.input.on('pointermove',(pointer)=>{
        //     console.log('ui',pointer.x.toFixed(0),pointer.y.toFixed(0),',',pointer.worldX.toFixed(0),pointer.worldY.toFixed(0))
        //     Cursor.pos(pointer.x,pointer.y);
        // })

        // this.input.on('dragenter', ()=>{console.log('dragenter',this.id);})
        // .on('dragleave', ()=>{console.log('dragleave',this.id);})
        // .on('dragover', ()=>{console.log('dragover',this.id);})
        // .on('drop', ()=>{console.log('drop',this.id);})
        
        // this.input.on('pointermove',(pointer)=>{
        //     if(UiDragged.on) {UiDragged.setPos(pointer.x,pointer.y);}
        // })

        this.input
        .on('pointermove',(pointer)=>{
            UiCursor.pos(pointer.x, pointer.y);
            if(UiDragged.on) {UiDragged.setPos(pointer.x,pointer.y);}
        })
    }

    stop()
    {
        console.log('stop ui')
        this.scene.stop();
    }

    uiEvent()
    {
        console.log('UI_event');
        const area = this.scene.get('GameArea');
        area.events
            .off('stop_ui').on('stop_ui', ()=>{this.stop();})
    }
}