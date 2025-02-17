import Record from './record.js'
import {ItemDB} from './database.js';
import Utility from './utility.js';

export class Entity extends Phaser.GameObjects.Container
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.scene = scene;
        scene.add.existing(this);
        this.enableOutline();
        this.bl=0,this.br=0,this.bt=0,this.bb=0;
        this.gl=0,this.gr=0,this.gt=0,this.gb=0;
        this.zl=0,this.zr=0,this.zt=0,this.zb=0;
        this.interactive = false;
        this.en_outline = true;
        this.weight = 0;
        this.static = true; // true: static body, false: dynamic body
        this.uid = 0;   // map.createMap() 會自動設定 uid
    }

    get pos()   {return {x:this.x,y:this.y}}
    set pos(value)  {this.x=value.x;this.y=value.y;}
    get posG() {return {x:this.x+this.grid.x, y:this.y+this.grid.y}}
    get act()   {return this.acts[0];}
    get acts()  {return [''];}

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
        this._x = x;
        this._y = y;
        super.setPosition(x, y);
    }

    send(type, ...args) {this.scene.events.emit(type, ...args);}

    addListener()
    {
        if(!this.interactive) {return;}

        this._zone = this.scene.add.zone((this.zl-this.zr)/2, (this.zt-this.zb)/2, this.displayWidth-this.zl-this.zr, this.displayHeight-this.zt-this.zb)
        this.add(this._zone)
        this._zone.setInteractive()
        this._zone
            .on('pointerover',()=>{this.outline(true);this.send('over',this);})
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
        if(!this.en_outline) {return;}

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
            let cx = this.body.x+this.body.width/2;
            let cy = this.body.y+this.body.height/2;
            this._rect = this.scene.add.rectangle(cx-this.x, cy-this.y, this.body.width, this.body.height, 0xffffff, 0.5);
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
        this.scene.physics.add.existing(this, this.static);
        this.body.setSize(this.displayWidth-this.bl-this.br, this.displayHeight-this.bt-this.bb);
        this.body.x=this.x;
        this.body.y=this.y;
        this.body.setOffset(-this.displayWidth/2+this.bl, -this.displayHeight/2+this.bt);
    }

    addGrid()
    {
        this.grid = {};
        this.grid.w = this.displayWidth -this.gl - this.gr;
        this.grid.h = this.displayHeight - this.gt - this.gb;
        this.grid.x = (this.gl - this.gr) / 2;
        this.grid.y = (this.gt - this.gb) / 2;
    }

    removeWeight(){this.weight!=0 && this.scene.map.updateGrid(this.posG,-this.weight,this.grid.w,this.grid.h);}

    addWeight(pt){this.weight!=0 && this.scene.map.updateGrid(pt??this.posG,this.weight,this.grid.w,this.grid.h);}

    updateDepth()
    {
        let depth = this.y ;//+ this.height/2 - this.gb;
        this.setDepth(depth);
        //this.debug(depth.toFixed(1));
    }

    toBag(capacity,items)
    {
        let bag={capacity:capacity,items:[]};
        items.forEach((item,i)=>{bag.items[i] = typeof item === 'object' ? item : {id:item};})
        return bag;
    }

    setAnchor(anchor,set=false)
    {
        if(!anchor) {return;}
            
        let dx = this.displayWidth/2 - anchor.x;
        let dy = this.displayHeight/2 - anchor.y;

        this.grid.x += dx;
        this.grid.y += -dy;

        if(this._sp) {this._sp.x += dx; this._sp.y += -dy;}
        if(this._zone) {this._zone.x += dx; this._zone.y += -dy;}
        if(this.body) {this.body.offset.x += dx; this.body.offset.y += -dy;}

        if(set) {this.x-=dx;this.y-=-dy}
    }

    init(mapName)
    {
        this.mapName = mapName;
        let anchor;
        if(this.data) 
        {
            let ax = this.data.get('anchorX');
            let ay = this.data.get('anchorY');
            ax && ay && (anchor={x:ax, y:ay});
        }
        this.addListener();
        //this.interactive&&this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        this.addGrid();
        this.setAnchor(anchor,true);
        this.updateDepth();
        this.addWeight();
        //this.debugDraw();
    }

    create(id)
    {
        this.slot = {id:id,count:1};
        let item = ItemDB.get(id);
        let [key,frame] = item.icon.split('/');
        this.setTexture(key,frame);
        this.displayWidth = this._sp.width;
        this.displayHeight = this._sp.height;
        this.addListener();
        this.addPhysics();
        this.addGrid();
        this.updateDepth();
        this.addWeight();
        return this;
    }

    transfer(target, ent)
    {
        if(target.take(ent)) {return true;}
        return false;
    }

    take(ent)
    {
        let capacity = this.status.bag.capacity;
        let count = this.status.bag.items.length;
        let foundIndex = this.status.bag.items.findIndex(slot=>Utility.isEmpty(slot))
        let i = foundIndex!=-1 ? foundIndex 
                                : capacity==-1 || count<capacity ? count 
                                                                : -1;
        if(i!=-1)
        {
            this.status.bag.items[i]=ent.slot;
            return true;
        }
        else
        {  
            this.send('msg','空間已滿!!!');
            return false;
        }
    }

    drop(ent)
    {
        let p = this.scene.map.getDropPoint(this.pos);
        new Pickup(this.scene,this.x,this.y-32).create(ent.slot.id).falling(p);
    }

    falling(p)
    {
        let tx = (this.x+p.x)/2;
        let ty = this.y-32;
        let a = Phaser.Math.Between(-45, 45);
        
        this.scene.tweens.chain({
            targets: this,
            tweens:[{x:tx, angle:a, duration:100, ease:'linear'},
                    {x:p.x, angle:2*a, duration:100, ease:'linear'}]
        });

        this.scene.tweens.chain({
            targets: this,
            tweens:[{y:ty, duration:100, ease:'exp.out'},
                    {y:p.y, duration:100, ease:'exp.in'}]
        });
    }

    loadData() {return Record.getByUid(this.mapName,this.uid);}

    saveData(data) {Record.setByUid(this.mapName,this.uid,data);}

    debugDraw(type='grid')
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.name = 'entity';
            this._dbgGraphics.setDepth(Infinity);
        }

        let rect, circle;

        switch(type)
        {
            case 'body':
                if(this.bidy)
                {
                    rect = new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
                    circle = new Phaser.Geom.Circle(this.body.center.x,this.body.center.y,5);
                }
                break;
            case 'grid':
                if(this.grid)
                {
                    let w_2 = this.grid.w/2;
                    let h_2 = this.grid.h/2;
                    let c = {x:this.x+this.grid.x, y:this.y+this.grid.y}
                    rect = new Phaser.Geom.Rectangle(c.x-w_2,c.y-h_2,this.grid.w,this.grid.h);
                    //circle = new Phaser.Geom.Circle(c.x,c.y,5);
                    circle = new Phaser.Geom.Circle(this.x,this.y,5);
                }
                break;
            case 'zone':
                if(this._zone)
                {
                    let w_2 = this._zone.width/2;
                    let h_2 = this._zone.height/2;
                    let c = {x:this.x+this._zone.x, y:this.y+this._zone.y}
                    rect = new Phaser.Geom.Rectangle(c.x-w_2,c.y-h_2,this._zone.width,this._zone.height);
                    circle = new Phaser.Geom.Circle(this.x,this.y,5);
                    //circle = new Phaser.Geom.Circle(c.x,c.y,5);
                    
                }
                else
                {
                    circle = new Phaser.Geom.Circle(this.x,this.y,5);
                }
                break;
        }
       

        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0xff0000, 1);
        if(rect) {this._dbgGraphics.strokeRectShape(rect);}
        if(circle) {this._dbgGraphics.strokeCircleShape(circle);}
        
    }

}

export class Case extends Entity
{
    constructor(scene)
    {
        super(scene);   
        this.container = [];   
        this.interactive = true;
        this.status = {};
    }

    get acts()  {return ['open'];}

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
        if(data) {this.status.bag = data;}
        else 
        {
            let items = JSON.parse(this.container);
            this.status.bag = this.toBag(-1,items);
        }   
    }

    save() { this.saveData(this.bag); }

    open() { this.send('case', this); }

   
}


export class Pickup extends Entity
{
    constructor(scene,x,y)
    {
        super(scene,x,y);  
        this.interactive = true;    
    }

    get acts()  {return ['take'];}

    addListener()
    {
        super.addListener();
        this.on('take',(taker)=>{this.pickup(taker)})
    }

    pickup(taker)
    {
        console.log('pickeup');

        if(taker.take(this))
        {
            this.send('out');
            this.send('refresh');
            this.set();
            this.destroy();
        }   
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
        this.offsetX = 0;
        this.offsetY = 0;
    }

    get acts()  {return ['enter'];}

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
        //this.debugDraw();
    }
}