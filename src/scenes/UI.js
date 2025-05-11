import {Scene} from 'phaser';
import createUI,{UiDragged} from '../ui.js';
import * as Role from '../role.js';

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
        // this.input.setDefaultCursor('none');    
        console.log(this)
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
        
        this.input.on('pointermove',(pointer)=>{
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