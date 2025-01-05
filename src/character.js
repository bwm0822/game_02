import {DialogDB} from './database';

export class Character extends Phaser.GameObjects.Container
{
    constructor(scene)
    {
        super(scene);
        this.scene = scene;
        scene.add.existing(this);
        this.id='none';

        this.m={l:20,r:20,t:20,b:20}

        this.interactable=true;
        this.enableOutline();
        this.addListener();

        // this._outline = scene.plugins.get('rexOutlinePipeline');
        // this.on('pointerup', () => {scene.events.emit('dialog',this._dialog);})
        //     .on('pointerover', () => { this._sp.setTint(0x777777); outline.add(this,{thickness:3,outlineColor:0xffffff})})
        //     .on('pointerout', () => { this._sp.setTint(0xffffff); outline.remove(this);})
    }

    enableOutline()
    {
        this._outline = this.scene.plugins.get('rexOutlinePipeline');
        this.on('outline', (on) => {this.outline(on);})
    }

    addListener()
    {
        this.on('pointerup',()=>{this.scene.events.emit('dialog',this._dialog);})
            .on('pointerover', () => {this.scene.events.emit('cursor','talk')})
            .on('pointerout', () => {this.scene.events.emit('cursor','none') })
        this.on('outline', (on)=>{
            if(on){this.setInteractive();}
            else{this.disableInteractive();}
        })
    }

    outline(on)
    {
        if(on) {this._outline.add(this,{thickness:3,outlineColor:0xffffff});}
        else {this._outline.remove(this);}
    }


    setPosition(x,y)    // map.createFromObjects 會呼叫到
    { 
        super.setPosition(x,y);
    }

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
        //console.log(key,frame);
        let sp = this.scene.add.sprite(0,0,key,frame);
        this.add(sp);
        this.setSize(sp.width,sp.height);
        this._sp = sp;
    }

    setFlip(){} // map.createFromObjects 會呼叫到

    init()
    {
        this.debugDraw();
        this.setInteractive();
        this.addPhysics();
        this._dialog=DialogDB.get(this.id);
        console.log('dialog',this._dialog);
        console.log(this);
    }

    addPhysics()
    {
        //scene.physics.world.enable(this);
        this.scene.physics.add.existing(this, false);
        let m = this.m;
        this.body.setSize(this.width-m.l-m.r,this.height-m.t-m.b);
        this.body.setOffset(m.l,m.t);
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'entity';
        }
        let w = this.displayWidth;
        let h = this.displayHeight;
        let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics.strokeRectShape(rect);
    }

    destroy()
    {
        this._dbgGraphics && this._dbgGraphics.destroy();
        super.destroy();
    }

    
}