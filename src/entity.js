import Record from './record.js'

export class Block extends Phaser.GameObjects.Container
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.scene = scene;
        scene.add.existing(this);
        this.left=0;
        this.right=0;
        this.top=0;
        this.bottom=0;        
    }

    set displayWidth(value) {this.width = value;}
    set displayHeight(value) {this.height = value;}
    get displayWidth() {return this.width;}
    get displayHeight() {return this.height;}

    setTexture(key,frame) {}  // map.createFromObjects 會呼叫到

    setFlip(){} // map.createFromObjects 會呼叫到

    addPhysics()
    {
        this.scene.physics.add.existing(this, true);
        this.body.setSize(this.width-this.left-this.right,this.height-this.top-this.bottom);
        this.body.setOffset(this.left,this.top);
        this.scene.groupStatic.add(this);
    }

    updateDepth()
    {
        let depth = this.y + this.height/2 - this.bottom;
        this.setDepth(depth);
        //this.debug(depth.toFixed(1));
    }

    init()
    {
        //console.log('block')
        this.addPhysics();
        this.updateDepth();
        //this.debugDraw();
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'entity';
        }
        let w = this.width;
        let h = this.height;
        let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics.strokeRectShape(rect)
                        .strokeCircleShape(circle);
    }

    
}


export class Entity extends Phaser.GameObjects.Container
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.scene = scene;
        scene.add.existing(this);
        this.left=0,this.right=0,this.top=0,this.bottom=0;
        this.interactable=true;
        this.collide=true;
        this.enableOutline();
        this.addListener();
    }

    get pos()       {return {x:this.x,y:this.y}}

    enableOutline()
    {
        this._outline = this.scene.plugins.get('rexOutlinePipeline');
        this.on('outline', (on) => {this.outline(on);})
    }

    addListener()
    {
        //this.on('pointerover',()=>{console.log('over')})
        // this.on('outline', (on)=>{
        //     if(on){this.setInteractive();}
        //     else{this.disableInteractive();}
        // })

        this.on('pointerover',()=>{this.outline(true);this.scene.events.emit('over',this)})
            .on('pointerout',()=>{this.outline(false);this.scene.events.emit('out',this)})
    }

    outline(on)
    {
        if(on) {this._outline.add(this,{thickness:3,outlineColor:0xffffff});}
        else {this._outline.remove(this);}
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
        this.body.setSize(this.displayWidth-this.left-this.right,this.displayHeight-this.top-this.bottom);
        this.body.setOffset(this.left,this.top);
        //this.scene.groupStatic.add(this);
    }

    updateDepth()
    {
        let depth = this.y + this.height/2 - this.bottom;
        this.setDepth(depth);
        //this.debug(depth.toFixed(1));
    }

    init(map)
    {
        console.log('entity')
        this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        this.updateDepth();
        map.updateGrid(this.pos,1000);
        //this.debugDraw();
        console.log(this);
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
        let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics.strokeRectShape(rect)
                        .strokeCircleShape(circle);
    }

}


export class Pickup extends Entity
{
    addListener()
    {
        super.addListener();
        this.on('pointerup',()=>{this.pickup()})
    }

    pickup()
    {
        console.log('pickeup');
        this.set();
       

        this.destroy();
        
    }

    init(mapName)
    {
        this._mapName = mapName;
        super.init();
        this.check();
    }

    check()
    {
        let obj = this.data?.get('obj');
        if(obj && Record.data[this._mapName]?.remove?.includes(obj))
        {
            this.destroy();
        }
    }

    set()
    {
        let obj = this.data?.get('obj');
        if(obj)
        {
            if(!Record.data[this._mapName]){Record.data[this._mapName]={remove:[],add:[]};}
            Record.data[this._mapName].remove.push(obj);
            Record.save();
        }
    }
}

export class Port extends Entity
{
    constructor(scene)
    {
        super(scene);
        this.id='';
        this.type='';
        this.map='';
    }

    addListener()
    {
        super.addListener();
        this.on('pointerup', () => { this.enter(); })
    }

    init(map)
    {
        super.init(map);
        if(!this.scene.ports){this.scene.ports={}}
        this.scene.ports[this.name]={x:this.x,y:this.y}
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
}