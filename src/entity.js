import Record from './record.js'

export class Entity extends Phaser.GameObjects.Container
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        console.log(x,y);
        this.scene = scene;
        scene.add.existing(this);
        this.enableOutline();
        //this.addListener();
        this.left=0,this.right=0,this.top=0,this.bottom=0;
        this.bl=0,this.br=0,this.bt=0,this.bb=0;
        this.gl=0,this.gr=0,this.gt=0,this.gb=0;
        this.wBound={}
        this.interactive = false;
        this.outline_en = true;
        this.acts = [];
        this.weight = 0;
        this.uid = 0;   // map.createMap() 會自動設定 uid
    }

    get pos()   {return {x:this.x,y:this.y}}
    get act()   {return this.acts[0];}

    // set displayWidth(value) {this._w=value;this.width==0&&(this.width=value);super.displayWidth=value;} 
    // set displayHeight(value) {this._h=value;this.height==0&&(this.height=value);super.displayHeight=value;}
    // get displayWidth() {return super.displayWidth;}
    // get displayHeight() {return super.displayHeight;}

    set displayWidth(value) {this._w=value;this._sp&&(this._sp.displayWidth=value);} 
    set displayHeight(value) {this._h=value;this._sp&&(this._sp.displayHeight=value);}
    get displayWidth() {return this._w;}
    get displayHeight() {return this._h;}

    enableOutline()
    {
        this._outline = this.scene.plugins.get('rexOutlinePipeline');
        this.on('outline', (on) => {this.outline(on);})
    }

    setPosition(x,y)
    {
        console.log(x,y)
        this._x=x;
        this._y=y;
        super.setPosition(x,y)
    }

    send(type, ...args) {this.scene.events.emit(type, ...args);}

    addListener()
    {
        if(this._sp)
        {
            console.log('chk1')
            this.interactive&&this._sp.setInteractive()
            this._sp.on('pointerover',()=>{this.outline(true);this.send('over',this);})
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
        else
        {
            console.log('chk2')
            this.interactive&&this.setInteractive()
            this.on('pointerover',()=>{this.outline(true);this.send('over',this);})
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
    }

    outline(on)
    {
        if(!this.outline_en) return;

        if(this._sp)
        {
            if(on) {this._outline.add(this._sp,{thickness:3,outlineColor:0xffffff});}
            else {this._outline.remove(this._sp);}
        }
        else
        {
            this.outline_rect(on);
        }
        
    }

    outline_rect(on)
    {
        if(!this._rect)
        {
            this._rect = this.scene.add.rectangle(0, 0, this.width, this.height, 0xffffff, 0.5);
            this._rect.setStrokeStyle(2,0xffffff)
            this.add(this._rect);
            this.setDepth(Infinity);
        }

        this._rect.visible=on;
    }

    setTexture(key,frame)   // map.createFromObjects 會呼叫到
    {
        //console.log(key,frame);
        if(key)
        {
            let sp = this.scene.add.sprite(0,0,key,frame);
            this.add(sp);
            //this.setSize(sp.width,sp.height);
            this._sp = sp;
        }
    }

    setFlip(horizontal,vertical)// map.createFromObjects 會呼叫到
    {
        this._sp&&(this._sp.flipX=horizontal);
        this._sp&&(this._sp.flipY=vertical);
    } 

    addPhysics()
    {
        //this.setSize(this.displayWidth,this.displayHeight);
        this.scene.physics.add.existing(this, true);
        // this.body.setSize(this.displayWidth-this.left-this.right,this.displayHeight-this.top-this.bottom);
        // this.body.setOffset(this.left,this.top);
        //this.body.setSize(this.displayWidth-this.bl-this.br,this.displayHeight-this.bt-this.bb);
        this.body.setSize(this._w-this.bl-this.br,this._h-this.bt-this.bb);
        this.body.setOffset(this.bl,this.bt);
        //this.body.setOffset(0,0);

        console.log(this.displayWidth,this.displayHeight)
    }

    addGrid()
    {
        this.grid={};
        // this.grid.w = this.displayWidth-this.gl-this.gr;
        // this.grid.h = this.displayHeight-this.gt-this.gb;
        this.grid.w = this._w-this.gl-this.gr;
        this.grid.h = this._h-this.gt-this.gb;
        this.grid.x = (this.gl-this.gr)/2;
        this.grid.y = (this.gt-this.gb)/2;
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
        this.addListener();
        //this.interactive&&this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        this.addGrid();
        this.updateDepth();
        //this.scene.map.updateGrid(this.body.center,this.weight,this.body.width,this.body.height);
        
        
        if(this.data)
        {
            let ax = this.data.get('anchorX');
            let ay = this.data.get('anchorY');
            
            // let dx = this.displayWidth/2-ax;
            // let dy = this.displayHeight/2-ay;
            let dx = this._w/2-ax;
            let dy = this._h/2-ay;

            this.x-=dx;
            this.y-=-dy;

            this.grid.x+=dx;
            this.grid.y+=-dy;

            this._sp.x+=dx;
            this._sp.y+=-dy;

            console.log(ax,ay);
        }

        let p = {x:this.x+this.grid.x, y:this.y+this.grid.y}
        console.log(p,this.weight)
        this.scene.map.updateGrid(p,this.weight,this.grid.w,this.grid.h);

        this.debugDraw();

        console.log(this);
    }

    loadData() {return Record.getByUid(this.mapName,this.uid);}

    saveData(data) {Record.setByUid(this.mapName,this.uid,data);}

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'entity';
            this._dbgGraphics.setDepth(Infinity);
        }

        let type = 'grid';
        let rect, circle;

        switch(type)
        {
            case 'body':
                rect = new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
                circle = new Phaser.Geom.Circle(this.body.center.x,this.body.center.y,5);
                break;
            case 'grid':
                let w_2 = this.grid.w/2;
                let h_2 = this.grid.h/2;
                let c = {x:this.x+this.grid.x, y:this.y+this.grid.y}
                rect = new Phaser.Geom.Rectangle(c.x-w_2,c.y-h_2,this.grid.w,this.grid.h);
                //circle = new Phaser.Geom.Circle(c.x,c.y,5);
                circle = new Phaser.Geom.Circle(this.x,this.y,5);
                break;
            default:
                rect = new Phaser.Geom.Rectangle(this.x-this.width/2,this.y-this.height/2,this.width,this.height);
                circle = new Phaser.Geom.Circle(this.x,this.y,5);

        }
       
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0xff0000, 1);
        this._dbgGraphics.strokeRectShape(rect)
                        .strokeCircleShape(circle);

        // if(type=='size')
        // {
        //     let w = this.displayWidth;
        //     let h = this.displayHeight;
        //     let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        //     let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        //     this._dbgGraphics.clear();
        //     this._dbgGraphics.lineStyle(2, 0xff0000, 1);
        //     this._dbgGraphics.strokeRectShape(rect)
        //                     .strokeCircleShape(circle);
        // }
        // else if(type == 'body')
        // {
        //     let rect = new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
        //     let circle = new Phaser.Geom.Circle(this.body.center.x,this.body.center.y,5);

        //     this._dbgGraphics.clear();
        //     this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        //     this._dbgGraphics.strokeRectShape(rect)
        //                     .strokeCircleShape(circle);
        // }
        // else
        // {
        //     let w_2 = this.grid.w/2;
        //     let h_2 = this.grid.h/2;
        //     let c = {x:this.x+this.grid.x, y:this.y+this.grid.y}
        //     let rect = new Phaser.Geom.Rectangle(c.x-w_2,c.y-h_2,this.grid.w,this.grid.h);
        //     //let circle = new Phaser.Geom.Circle(c.x,c.y,5);
        //     let circle = new Phaser.Geom.Circle(this.x,this.y,5);

        //     this._dbgGraphics.clear();
        //     this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        //     this._dbgGraphics.strokeRectShape(rect)
        //                     .strokeCircleShape(circle);
        // }

        
    }

}

export class Case extends Entity
{
    constructor(scene)
    {
        super(scene);
        this.acts = ['open'];     
        this.container = {};   
        this.interactive = true;
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
        this.interactive = true;    
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
            if(!Record.data[this._mapName]) {Record.data[this._mapName]={remove:[],add:[]};}
            Record.data[this._mapName].remove.push(obj);
            Record.save();
        }
    }
}


export class Entry extends Entity
{
    init(mapName)
    {
        //super.init(mapName);
        if(!this.scene.entries) {this.scene.entries={};}
        this.scene.entries[this.name] = {x:this.x,y:this.y}
    }
}


export class Port extends Entity
{
    constructor(scene)
    {
        super(scene);
        this.interactive = true;   
        this.port = '';
        this.map = '';
        this.acts = ['enter'];        
        this.offsetX = 0 ;
        this.offsetY = 0;
    }

    get pt() {return {x:this.x+this.offsetX, y:this.y+this.offsetY}}

    init(mapName)
    {
        super.init(mapName);
        if(!this.scene.ports) {this.scene.ports={};}
        this.scene.ports[this.name] = this;
    }

    addListener()
    {
        super.addListener();
        this.on('enter',()=>{this.enter();})
    }

    async enter()
    {
        this.scene.scene.start(this.map=='map'?'GameMap':'GameArea',{port:this.port,map:this.map});
    }
}

export class Node extends Port
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.weight = 10;
    }

    addText(label)
    {
        let lb = this.scene.add.text(0,-30,label,{fontFamily:'Arial',fontSize:'24px',color:'#000',stroke:'#ff0',strokeThickness:0}).setOrigin(0.5);
        this.add(lb);
    }

    init(mapName)
    {
        super.init(mapName);
        this.addText(this.name);
        this.debugDraw();
    }
}