import {Scene} from 'phaser'
import createUI from '../ui.js'
import {GM} from '../core/setting.js'
import UiCursor from '../ui/uicursor.js'
import DragService from '../services/dragService.js'
import UiDragged from '../ui/uidragged.js'
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
        this.input.enabled = true;
        this._vp={x:GM.w/2,y:GM.h/2}; 


    }

    vp(pointer)     // virtual pointer for mouse lock
    {
        if(!this._vp) {this._vp={x:0,y:0};}

        this._vp.x += pointer.movementX;
        this._vp.y += pointer.movementY;

        this._vp.x = Phaser.Math.Clamp(this._vp.x, 0, this.scale.width);
        this._vp.y = Phaser.Math.Clamp(this._vp.y, 0, this.scale.height);

        const p = this.input.activePointer;
        p.x = this._vp.x;
        p.y = this._vp.y;

        const wp = this.cameras.main.getWorldPoint(this._vp.x, this._vp.y);
        p.worldX = wp.x;
        p.worldY = wp.y;
    }

    _pickTopByVirtual(pointer) 
    {
        // console.log(this.input._list);
        const list = this.input.manager.hitTest(pointer, this.input._list, this.cameras.main);

        if (!list || list.length === 0) {return null;}

        // 取最上層（depth 最大）
        let best = null;
        let bestDepth = -Infinity;
        for (const go of list) 
        {
            if (!go || !go.input || !go.visible) continue;
            const d = go.depth ?? 0;
            if (d >= bestDepth) 
            {
                bestDepth = d;
                best = go;
            }
        }
        return best;
    }

    onPointerUp(pointer)
    {
        this.vp(pointer);
        const top = this._pickTopByVirtual(pointer);
        
        if(top)
        {
            top.emit('pointerup', pointer, top);
        }

        DragService._onpointerup(pointer);

        return top ? true : false;
    }


    onPointerDown(pointer)
    {
        this.vp(pointer);
        const top = this._pickTopByVirtual(pointer);
        
        if(top)
        {
            top.emit('pointerdown', pointer, pointer.x,pointer.y);
        }

        DragService._onpointerdown(pointer);

        return top ? true : false;
    }

    onPointerMove(pointer)
    {
        this.vp(pointer);
        const top = this._pickTopByVirtual(pointer);

        UiCursor.pos(pointer.x, pointer.y);
        DragService._onpointermove(pointer);
        
        if (top && top===this._over) {return true;}

        // pointerout
        if (this._over) 
        {
            this._over.emit('pointerout', pointer);
            this.input.emit('gameobjectout', pointer, this._over);
        }

        this._over = top;

        // pointerover
        if (this._over) 
        {
            this._over.emit('pointerover', pointer);
            this.input.emit('gameobjectover', pointer, this._over);
        }



        return top ? true : false;
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

        const area = this.scene.get('GameArea');
        console.log('------------- area:', area);

        this.input
        .on('pointermove',(pointer)=>{
            if(!this.onPointerMove(pointer)) 
            {
                area.onPointerMove(pointer);
            }
        })
        .on('pointerdown',(pointer)=>{
            if(!this.onPointerDown(pointer)) 
            {
                area.onPointerDown(pointer);
            }
        })
        .on('pointerup',(pointer)=>{
            this.onPointerUp(pointer);
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