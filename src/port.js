
export class Port extends Phaser.GameObjects.Container
{
    constructor(scene)
    {
        super(scene);
        this.scene = scene;
        this.id='';
        this.type='';
        this.map='';
    }


    setPosition(x,y)    // map.createFromObjects 會呼叫到
    { 
        super.setPosition(x,y);
    }

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
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
        this.addPhysics();
        if(!this.scene.ports){this.scene.ports={}}
        this.scene.ports[this.name]={x:this.x,y:this.y}
    }

    addPhysics()
    {
        this.scene.physics.add.existing(this, true);
        this.body.setSize(this.displayWidth-this.left-this.right,this.displayHeight-this.top-this.bottom);
        this.body.setOffset(this.left,this.top);
        this.scene.groupStatic.add(this);
    }

    addListener()
    {
        this.on('pointerup', () => { this.enter(); })
        .on('pointerover', () => { this._sp.setTint(0x777777); })
        .on('pointerout', () => { this._sp.setTint(0xffffff); })
    }
    
    async enter()
    {
        console.log('enter',this.id,this.type,this.map);
        if(this.type=='map')
        {
            this.scene.scene.start('GameMap',{id:this.id});
        }
        else
        {
            //this.scene.scene.start('GameTown',{id:this.id,map:this.data.get('map')});
            this.scene.scene.start('GameTown',{id:this.id,map:this.map});
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



