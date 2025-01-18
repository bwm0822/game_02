import {Scene} from 'phaser';
import createUI,{UiMain,UiCursor,UiDragged,UiCase,UiInv,UiTrade,UiDialog,UiOption} from '../ui.js';
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
        createUI(this);
        this.uiEvent();
        this.processInput();
        this.input.setDefaultCursor('none');
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

    uiEvent()
    {
        console.log('UI_event');
    }
}