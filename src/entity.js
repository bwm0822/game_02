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
        this.enableOutline();
        this.addListener();
        this.left=0,this.right=0,this.top=0,this.bottom=0;
        this.collide = true;
        this.acts = [];
        this.weight = 0;
        this.uid = 0;
    }

    get pos()   {return {x:this.x,y:this.y}}
    get act()   {return this.acts[0];}

    enableOutline()
    {
        this._outline = this.scene.plugins.get('rexOutlinePipeline');
        this.on('outline', (on) => {this.outline(on);})
    }

    send(type, ...args) {this.scene.events.emit(type, ...args);}

    addListener()
    {
        this.on('pointerover',()=>{this.outline(true);this.send('over',this.act);})
            .on('pointerout',()=>{this.outline(false);this.send('out');})
            .on('pointerdown',(pointer)=>{
                if (pointer.middleButtonDown())
                {
                    // world space to screen space
                    let x = this.x - this.scene.cameras.main.worldView.x;
                    let y = this.y - this.scene.cameras.main.worldView.y;
                    this.send('option',x,y-10,this.acts,this);
                }
            })
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

    toBag(items)
    {
        let bag={};
        items.forEach((item,i)=>{bag[i] = typeof item === 'object' ? item : {id:item};})
        return bag;
    }

    init(mapName)
    {
        this.mapName = mapName;
        this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        this.updateDepth();
        this.scene.map.updateGrid(this.pos,this.weight);
        //this.debugDraw();
    }

    loadData() {return Record.getByUid(this.mapName,this.uid);}

    saveData(data) {Record.setByUid(this.mapName,this.uid,data);}

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

export class Case extends Entity
{
    constructor(scene)
    {
        super(scene);
        this.acts = ['open'];     
        this.container = {};   
    }

    addListener()
    {
        super.addListener();
        this.on('open',()=>{this.open()})
    }

    init(mapName)
    {
        super.init(mapName);
        this.load();
    }

    load()
    {
        this.owner={name:this.name};
        let data = this.loadData();
        if(data) {this.owner.bag = data;}
        else 
        {
            let items = JSON.parse(this.container);
            this.owner.bag = this.toBag(items);
        }   
    }

    save() { this.saveData(this.owner.bag); }

    open() { this.send('case', this.owner); }

   
}


export class Pickup extends Entity
{
    constructor(scene)
    {
        super(scene);
        this.acts = ['take'];        
    }

    addListener()
    {
        super.addListener();
        this.on('take',()=>{this.pickup()})
    }

    pickup()
    {
        console.log('pickeup');
        this.set();
        this.destroy();   
    }

    // init(mapName)
    // {
    //     this._mapName = mapName;
    //     super.init();
    //     this.check();
    // }

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
        this.id = '';
        this.type = '';
        this.map = '';
        this.acts = ['exit'];        
    }

    addListener()
    {
        super.addListener();
        this.on('exit',()=>{this.exit();})
    }

    init(map)
    {
        super.init(map);
        if(!this.scene.ports){this.scene.ports={}}
        this.scene.ports[this.name]={x:this.x,y:this.y}
    }

    async exit()
    {
        //console.log('exit',this.id,this.type,this.map);
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
