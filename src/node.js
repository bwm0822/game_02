import Record from './record.js'

export class Node extends Phaser.GameObjects.Container
{
    constructor(scene)
    {
        super(scene);
        this.scene = scene;
        this._sel=false;
        this._enabled=false;
        this.id = 0;
        this.type='';

        this.on('pointerup', () => { if(this._enabled||this._sel){this.enter();} })
            .on('pointerover', () => { this._sp.setTint(this.color&0x777777); })
            .on('pointerout', () => { this._sp.setTint(this.color&0xffffff); })
    }

    get color() {return this._sel ? 0xff0000 : 0xffffff;}
    set selected(value) {this._sel=value;this._sp.setTint(this.color);}
    set enabled(value) {this._enabled=value;}
    get links() {return this.data.get('link').split(',');}


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
        //this.debugDraw();
        this.setInteractive();
        if(!this.scene.nodes){this.scene.nodes={};}
        console.log(this);
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



