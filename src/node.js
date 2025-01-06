import Record from './record.js'
import {Entity} from './entity.js'


export class Node extends Entity
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.id = 0;
        this.type = '';
        this.weight = 10;
        this.act = 'enter';
    }

    addText(label)
    {
        let lb = this.scene.add.text(0,-60,label,{fontFamily:'Arial',fontSize:'48px',color:'#000',stroke:'#ff0',strokeThickness:0}).setOrigin(0.5);
        this.add(lb);
    }

    addListener()
    {
        super.addListener();
        this.on('enter',()=>{this.enter()})
    }

    init(map)
    {
        super.init(map);
        this.addText(this.name);
        if(!this.scene.nodes){this.scene.nodes={};}
        this.scene.nodes[this.name]=this;
    }
    
    async enter()
    {
        console.log('enter',this.type);

        if(this.type=='battle')
        {
            this.scene.scene.start('GameBattle',{id:this.id});
        }
        else
        {
            this.scene.scene.start('GameTown',{id:this.id,map:this.data.get('map')});
        }
    }
}




export class Node_old extends Phaser.GameObjects.Container
{
    constructor(scene)
    {
        super(scene);
        this.scene = scene;
        this.enableOutline();
        this.addListener();
        // this._sel=false;
        // this._enabled=false;
        this.id=0;
        this.type='';
        this.weight=1;
        this.act='enter';

        // this.on('pointerup', () => { if(this._enabled||this._sel){this.enter();} })
        //     .on('pointerover', () => { this._sp.setTint(this.color&0x777777); })
        //     .on('pointerout', () => { this._sp.setTint(this.color&0xffffff); })
    }

    get pos() {return {x:this.x,y:this.y};}
    // get color() {return this._sel ? 0xff0000 : 0xffffff;}
    // set selected(value) {this._sel=value;this._sp.setTint(this.color);}
    // set enabled(value) {this._enabled=value;}
    // get links() {return this.data.get('link').split(',');}

    enableOutline()
    {
        this._outline = this.scene.plugins.get('rexOutlinePipeline');
        this.on('outline', (on) => {this.outline(on);})
    }

    addListener()
    {
        this.on('pointerover',()=>{this.outline(true);this.scene.events.emit('over',this.act)})
            .on('pointerout',()=>{this.outline(false);this.scene.events.emit('out')})
        
        this.on('enter',()=>{this.enter()})
    }

    outline(on,color=0xffffff)
    {
        if(on) {this._outline.add(this,{thickness:3,outlineColor:color});}
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

    addPhysics()
    {
        this.scene.physics.add.existing(this, true);
        this.body.setSize(this.displayWidth,this.displayHeight);
        //this.body.setOffset(this.left,this.top);
        //this.scene.groupStatic.add(this);
    }

    init(map)
    {
        //this.debugDraw();
        this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        if(!this.scene.nodes){this.scene.nodes={};}
        this.scene.nodes[this.name]=this;
        map.updateGrid(this.pos,this.weight);
    }
    
    async enter()
    {
        console.log('enter',this.type);

        if(this.type=='battle')
        {
            this.scene.scene.start('GameBattle',{id:this.id});
        }
        else
        {
            this.scene.scene.start('GameTown',{id:this.id,map:this.data.get('map')});
        }
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



