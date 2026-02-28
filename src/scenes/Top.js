import {Scene} from 'phaser'
import {GM} from '../core/setting.js'

export class Top extends Scene
{
    constructor ()
    {
        console.log('Top');
        super({key:'Top'});
    }

    create ()
    {
        console.log('create Top')
        this.processInput();
    }

    _syncVirtualPointer(pointer)     // virtual pointer for mouse lock
    {
        if(!this._vp) {this._vp={x:GM.w/2,y:GM.h/2};}

        const m = 1.5;

        this._vp.x += m*pointer.movementX;
        this._vp.y += m*pointer.movementY;

        this._vp.x = Phaser.Math.Clamp(this._vp.x, 0, this.scale.width);
        this._vp.y = Phaser.Math.Clamp(this._vp.y, 0, this.scale.height);

        const p = this.input.activePointer;
        p.x = this._vp.x;
        p.y = this._vp.y;

        p.updateWorldPoint(this.cameras.main);
    }

    processInput()
    {
        this.input
        .on('pointermove',(pointer)=>{
            if(this.input.mouse.locked) {this._syncVirtualPointer(pointer);}
            // console.log('top move:',pointer.x,pointer.y,pointer.worldX,pointer.worldY)
        })
        .on('pointerdown',(pointer)=>{
           if(this.input.mouse.locked) {this._syncVirtualPointer(pointer);}
        })
        .on('pointerup',(pointer)=>{
            if(this.input.mouse.locked) {this._syncVirtualPointer(pointer);}
        })
        .on('wheel',(pointer, gameobject, dx, dy)=>{
            if(this.input.mouse.locked) {this._syncVirtualPointer(pointer);}
        })
    }

}