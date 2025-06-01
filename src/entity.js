import Record from './record.js'
import {ItemDB} from './database.js';
import Utility from './utility.js';
import { GM } from './setting.js';
import DB from './db.js';
import AudioManager from './audio.js';
import {bbcText} from './uibase'
import * as Role from './role';

let DEBUG=true;
let DBG_TYPE=GM.DBG_ALL;

export class Entity extends Phaser.GameObjects.Container
{
    constructor(scene, x, y)
    {
        super(scene, x, y);
        this.scene = scene;
        scene.add.existing(this);
        this.enableOutline();
        this.bl=0,this.br=0,this.bt=0,this.bb=0;    // body
        this.gl=0,this.gr=0,this.gt=0,this.gb=0;    // grid
        this.zl=0,this.zr=0,this.zt=0,this.zb=0;    // zone，interactive=true 才有作用
        this.anchorX = 0;
        this.anchorY = 0;
        this.interactive = false;
        this.en_outline = true;
        this.weight = 0;
        this.isStatic = true; // true: static body, false: dynamic body
        this.uid = -1;   // map.createMap() 會自動設定 uid
        this._pGrids=[];   // grid 所佔據的點
    }

    get pos()   {return {x:this.x,y:this.y}}
    set pos(value)  {this.x=value.x;this.y=value.y;}
    get posG() {return {x:this.x+this.grid.x, y:this.y+this.grid.y}}
    get act()   {return this.acts.length > 0 ? this.acts[0] : '';}
    get acts()  {return [];}
    get pts() {return this._pGrids;}
    set pts(value) {this._pGrids=value;}
    get anchor() {return {x:this.anchorX, y:this.anchorY};}
    set anchor(value) {this.anchorX=value.x;this.anchorY=value.y;}
    get min() {return {x:-this.displayWidth/2-this.anchorX, y:-this.displayHeight/2-this.anchorY};}
    get max() {return {x:this.displayWidth/2-this.anchorX, y:this.displayHeight/2-this.anchorY};}

    set displayWidth(value) {this._w=value;this._sp&&(this._sp.displayWidth=value);} 
    set displayHeight(value) {this._h=value;this._sp&&(this._sp.displayHeight=value);}
    get displayWidth() {return this._w;}
    get displayHeight() {return this._h;}

    get mapName() {return this.scene._data.map;}

    

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

        // scene.add.zone( centerX, centerY, w, h )
        let cx = (this.min.x + this.zl + this.max.x - this.zr)/2;
        let cy = (this.min.y + this.zt + this.max.y - this.zb)/2;
        this._zone = this.scene.add.zone(cx, cy, this.displayWidth-this.zl-this.zr, this.displayHeight-this.zt-this.zb)
        this.add(this._zone)
        this._zone.setInteractive()
        this._zone
            .on('pointerover',()=>{
                if(!Role.getPlayer().isInteractive(this)) {return;}
                this.outline(true);this.send('over',this);this.debugDraw(undefined,this.y);})
            .on('pointerout',()=>{
                if(!Role.getPlayer().isInteractive(this)) {return;}
                this.outline(false);this.send('out');this.debugDraw(GM.DBG_CLR);})
            .on('pointerdown',(pointer)=>{
                if(!Role.getPlayer().isInteractive(this)) {return;}
                if (pointer.rightButtonDown()) {this.rightButtonDown();}
            })
    }

    rightButtonDown()
    {
        // world space to screen space
        let x = this.x - this.scene.cameras.main.worldView.x;
        let y = this.y - this.scene.cameras.main.worldView.y;
        if(this.acts.length>0) {this.send('option',x,y-10,this.acts,this);}
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

    setTexture(key,frame)   // map.createFromObjects 會呼叫到，此時 anchorX, anchorY 還沒被設定
    {
        console.log(key,frame);
        // console.trace();
        if(key)
        {
            let sp = this.scene.add.sprite(0,0,key,frame);
            sp.setPipeline('Light2D');
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
        // (body.x, body.y) 是 body 的左上角， body.center 才是中心點
        this.scene.physics.add.existing(this, this.isStatic);
        this.body.setSize(this.displayWidth-this.bl-this.br, this.displayHeight-this.bt-this.bb);
        if(this.isStatic) {this.body.setOffset(this.bl, this.bt);}
        else {this.body.setOffset(this.min.x+this.bl, this.min.y+this.bt);}
    }

    isInGrid(pos)
    {
        let p = {x:pos.x-this.x,y:pos.y-this.y};
        return p.x > (this.min.x + this.gl) && 
                p.x < (this.max.x - this.gr) && 
                p.y > (this.min.y + this.gt) && 
                p.y < (this.max.y - this.gb);
    }

    addGrid()
    {
        this.grid = {};

        this.grid.w = this.displayWidth - this.gl - this.gr;
        this.grid.h = this.displayHeight - this.gt - this.gb;
        // this.grid.x = (this.gl - this.gr) / 2;
        // this.grid.y = (this.gt - this.gb) / 2;

        this.grid.x = (this.min.x + this.gl + this.max.x - this.gr)/2; 
        this.grid.y = (this.min.y + this.gt + this.max.y - this.gb)/2;

        this.grid.left = this.min.x + this.gl;
        this.grid.top = this.min.y + this.gt;
    }

    // removeWeight(){this.weight!=0 && this.scene.map.updateGrid(this.posG,-this.weight,this.grid.w,this.grid.h);}

    // addWeight(pt){this.weight!=0 && this.scene.map.updateGrid(pt??this.posG,this.weight,this.grid.w,this.grid.h);}

    removeWeight(weight)
    {
        let wei = weight ?? this.weight;
        wei!=0 && this.scene.map.updateGrid(this.posG,-wei,this.grid.w,this.grid.h);
    }

    addWeight(pt,weight)
    {
        let wei = weight ?? this.weight;
        // wei!=0 && this.scene.map.updateGrid(pt??this.posG,wei,this.grid.w,this.grid.h);
        this.pts = this.scene.map.updateGrid(pt??this.posG,wei,this.grid.w,this.grid.h);
    }

    updateDepth()
    {
        let depth = this.y;
        this.setDepth(depth);
        //this.debug(depth.toFixed(1));
    }

    toStorage(capacity,items)
    {
        if(capacity == undefined) {capacity = -1;}
        if(!items) {items = [];}
        let bag={capacity:capacity,items:[]};
        items.forEach((item,i)=>{bag.items[i] = typeof item === 'object' ? item : {id:item,count:1};})
        return bag;
    }

    setAnchor(modify=false)
    {
        if(this._sp) {this._sp.x = -this.anchorX; this._sp.y = -this.anchorY;}
        // prefab 才需要將 modify 設成 true，用以修正位置
        if(modify) {this.x+=this.anchorX;this.y+=this.anchorY;}
    }

    init_prefab()
    {
        let data = this.loadData();
        if(data?.removed) 
        {
            if(this.uid!=-1) {this.saveData({removed:true})}
            this.destroy(); 
            return false;
        }

        this.addListener();
        //this.interactive&&this.setInteractive();  //必須在 this.setSize()之後執行才會有作用
        this.addPhysics();
        this.addGrid();
        this.setAnchor(true);
        this.updateDepth();
        this.addWeight();
        this.addToObjects();
        // this.debugDraw();
        return true;
        
    }

    init_runtime(itm)
    {
        // console.log(itm);
        this.itm = itm;
        this.dat = ItemDB.get(itm.id);
        let [key,frame] = this.dat.icon.split('/');
        this.setTexture(key,frame);
        this.displayWidth = this._sp.width;
        this.displayHeight = this._sp.height;
        this.addListener();
        this.addPhysics();
        this.addGrid();
        this.updateDepth();
        this.addWeight();
        this.addToObjects();
        return this;
    }

    transfer(target, ent)
    {
        if(target.take(ent)) {return true;}
        return false;
    }

    findEmpty()
    {
        let capacity = this.storage.capacity;
        let count = this.storage.items.length;
        let foundIndex = this.storage.items.findIndex(slot=>Utility.isEmpty(slot))
        let i = foundIndex!=-1 ? foundIndex 
                            : capacity==-1 || count<capacity ? count 
                                                                : -1;
        return i;
    }

    putStorage(id, count)
    {
        let cps = DB.item(id).cps ?? 1;

        let i = 0;
        let capacity = this.storage.capacity;
        let len = this.storage.items.length;
        let items = this.storage.items;
        while(count>0 && (capacity == -1 || i<capacity))
        {
            if(i<len)
            {
                if(Utility.isEmpty(items[i]))
                {
                    items[i]={id:id, count:Math.min(count,cps)}
                    count-=items[i].count

                }
                else if(items[i].id==id && items[i].count<cps)
                {
                    let sum = items[i].count+count;
                    items[i].count = Math.min(sum,cps)
                    count = sum-cps;
                }
            }
            else
            {
                let min = Math.min(count,cps);
                items.push({id:id, count:min});
                count-=min;
            }
            i++;
        }

        if(count>0)
        {
            let ent = {label:id.lab(),itm:{id:id,count:count}}
            this.drop(ent)
        }
       
    }

    take(ent, i, isEquip)
    {
        !i && (i = this.findEmpty());

        if(i!=-1)
        {
            if(isEquip) {this.status.equips[i]=ent.itm; this.equip();}
            else {this.storage.items[i]=ent.itm;}
            return true;
        }
        else
        {  
            this.send('msg','_space_full'.lab());
            return false;
        }
    }

    split(ent, cnt)
    {
        // let count = ent.slot.count;
        // let half = Math.floor(count/2);
        ent.itm.count -= cnt;
        let split = {id:ent.itm.id,count:cnt};
        let i = this.findEmpty();
        if(i!=-1) {this.storage.items[i]=split;}
    }

    drop(ent)   // ent 有可能是 slot 或 UiDragged
    {
        let p = this.scene.map.getDropPoint(this.pos);
        let obj = new Pickup(this.scene,this.x,this.y-32).init_runtime(ent.itm);
        obj.falling(p);
        AudioManager.drop();
        this.send('msg',`${'_drop'.lab()} ${ent.itm.id.lab()}`);
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

    loadData() {return Record.getByUid(this.mapName, this.uid);}
    saveData(data) {Record.setByUid(this.mapName, this.uid, data);}

    debugDraw(type=DBG_TYPE,text)
    {
        if(!DEBUG) {return;}

        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.setDepth(Infinity);
        }

        if(text && !this._dbgText)
        {
            this._dbgText = bbcText(this.scene,{text:'dbg'});
            this._dbgText.setDepth(Infinity);
            this._dbgText.setOrigin(0.5,1);
        }

        let draw_body = ()=>{
            if((type & GM.DBG_BODY)===0) {return;}
            if(this.body)
            {
                // body 的 x, y 是 body 的左上角
                // Phaser.Geom.Rectangle( left, top, w, h )
                this._dbgGraphics.lineStyle(6, 0x0000ff, 1);
                let rect = new Phaser.Geom.Rectangle(this.body.x,this.body.y,this.body.width,this.body.height);
                let circle = new Phaser.Geom.Circle(this.body.center.x,this.body.center.y,5);
                this._dbgGraphics.strokeRectShape(rect);
                this._dbgGraphics.strokeCircleShape(circle);
            } 
        }

        let draw_grid = ()=>{
            if((type & GM.DBG_GRID)===0) {return;}
            if(this.grid)
            {
                // grid 的 x, y 是 body 的中心點
                // Phaser.Geom.Rectangle( left, top, w, h )
                this._dbgGraphics.lineStyle(4, 0x00ff00, 1);
                let x = this.x + this.min.x + this.gl;
                let y = this.y + this.min.y + this.gt;
                let rect = new Phaser.Geom.Rectangle( x, y, this.grid.w, this.grid.h );
                this._dbgGraphics.strokeRectShape(rect);
            }
        }

        let draw_zone = ()=>{
            if((type & GM.DBG_ZONE)===0) {return;}
            if(this._zone)
            {
                // zone 的 x, y 是 zone 的中心點
                // Phaser.Geom.Rectangle( left, top, w, h )
                this._dbgGraphics.lineStyle(2, 0xff0000, 1);
                let p = {x:this.x + this._zone.x - this._zone.width/2, 
                        y:this.y + this._zone.y - this._zone.height/2}
                let rect = new Phaser.Geom.Rectangle(p.x,p.y,this._zone.width,this._zone.height); 
                this._dbgGraphics.strokeRectShape(rect);            
            }
        }

        let draw_pts = ()=>{
            if(type === GM.DBG_CLR) {return;}
            for(let p of this.pts)
            {
                this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
                let circle = new Phaser.Geom.Circle(p.x,p.y,2.5);
                this._dbgGraphics.strokeCircleShape(circle);
            }
            this._dbgGraphics.lineStyle(2, 0xffffff, 1);
            let circle = new Phaser.Geom.Circle(this.x,this.y,5);
            this._dbgGraphics.strokeCircleShape(circle);
        }

        let clr = ()=>{
            this._dbgGraphics.clear();
            if(this._dbgText) {this._dbgText.text='';}
            this._dbgGraphics.lineStyle(2, 0xff0000, 1);
        }

        let show_text = (text)=>{
            if(type === GM.DBG_CLR) {return;}
            if(this._dbgText)
            {
                this._dbgText.x = this.x;
                this._dbgText.y = this.y-this.displayHeight*2/3;
                this._dbgText.setText(`[bgcolor=white][color=black]${text}[/color][/bgcolor]`)
            }
        }


        clr();

        draw_body();
        draw_grid();
        draw_zone();
        draw_pts();
        show_text(text);

        console.log(this)
    }

    removeFromObjects()
    {
        const index = this.scene.objects.indexOf(this);
        if(index>-1) {this.scene.objects.splice(index,1);}
    }

    addToObjects() {this.scene.objects.push(this);}

    delete()
    {
        if(this.uid!=-1) {this.saveData({removed:true})}
        this.removeFromObjects();
        this.destroy();
    }
    
    destroy()
    {
        if(this._dbgGraphics){this._dbgGraphics.clear();}
        super.destroy();

    }

    // destroy()
    // { 
    //     if(this.removed)
    //     {
    //         if(this.uid!=-1) {this.saveData({removed:true})}
    //     }
    //     else
    //     {
    //         this.save?.();
    //     }
    //     super.destroy();
    // }

}


export class Case extends Entity
{
    constructor(scene)
    {
        super(scene);    
        this.interactive = true;
        this._storage = {};
    }

    get acts()  {return ['open'];}
    get storage() {return this._storage;}

    addListener()
    {
        super.addListener();
        this.on('open',()=>{this.open()})
    }

    init_prefab()
    {
        super.init_prefab();
        this.load();
    }

    load()
    {
        this.owner={name:this.name};
        let data = this.loadData();
        if(data) {this._storage = data;}
        else 
        {
            let jsonData = this.data?.get('items');
            let items = jsonData ? JSON.parse(jsonData) : [];
            this._storage = this.toStorage(-1,items);
        }   
    }

    save() { this.saveData(this._storage); }

    open() { this.send('storage', this); }
}


export class Pickup extends Entity
{
    constructor(scene,x,y,angle=0)
    {
        super(scene,x,y);  
        this.angle = angle;
        this.interactive = true;    
    }

    get acts()  {return [GM.TAKE];}

    addListener()
    {
        super.addListener();
        this.on(GM.TAKE,(taker)=>{this.pickup(taker)})
    }

    pickup(taker)
    {
        if(taker.take(this))
        {
            this.send('msg',`${'_pickup'.lab()} ${this.itm.id.lab()}`)
            this.send('out');
            this.send('refresh');
            this.delete();
        }   
    }

    init_prefab()
    {
        if(!super.init_prefab()) {return false;}
        let id = this.data.get('id');
        let count = this.data.get('count') ?? 1;
        this.itm = {id:id,count:count};
        return true;
        
    }

    save()
    {
        if(this.uid!=-1) {this.saveData({removed:false})}
        else {this.saveData({...this.pos,angle:this.angle,slot:this.itm});}
    }

    // remove()
    // {
    //     console.log('remove',this);
    //     if(this.uid!=-1) {this.saveData({removed:true})}
    //     this.destroy();
    // }
}

export class Stove extends Entity
{
    constructor(scene,x,y)
    {
        super(scene,x,y);  
        this.weight = 1000;
        this.interactive = true;  
        this._storage = {capacity:-1,items:[]};  
        this._output = null;
        this.cat = GM.CAT_FOOD;
    }

    get acts()  {return [GM.COOK];}
    get storage() {return this._storage;}
    get output() {return this._output;}
    set output(value) {return this._output=value;}
    get menu()  {return ['cook','salt_baked_fish'];}    
    get isFull() {return this._output?.count>0;}
    get sel() {return this._sel;}
    set sel(id) {
        this._sel = id;
        this._make = ItemDB.get(id).make;
        this._output = {id:id,count:0};
    }

    init_prefab()
    {
        super.init_prefab();
        this.load();
    }

    addListener()
    {
        super.addListener();
        this.on('cook',()=>{this.send('stove',this)})
    }

    check()
    {
        if(!this._sel) {return false}
        if(this.isFull) {return false;}
        if(this._sel=='cook') 
        {
            let found = this._storage.items.find(slot=>{
                return DB.item(slot?.id)?.cook
            })
            return found;
        }
        else
        {
            for(let [id,count] of Object.entries(this._make.items))
            {
                if(this.count(id)<count) {return false;}
            }
            return true;
        }
        
    }

    count(id)
    {
        let count = 0;
        this._storage.items.forEach(slot=>{
            if(slot?.id==id) {count+=slot.count;}
        })
        return count;
    }

    make()
    {
        if(this._sel=='cook') 
        {
            this._storage.items.forEach(slot=>{
                let cook = ItemDB.get(slot?.id)?.cook;
                if(cook) {slot.id = cook.id;}
            })
        }
        else
        {
            for(let [id,count] of Object.entries(this._make.items))
            {

                for(let i=0;i<this._storage.items.length;i++)
                {
                    if(this._storage.items[i]?.id==id)
                    {
                        if(this._storage.items[i].count >= count)
                        {
                            this._storage.items[i].count -= count;
                            if(this._storage.items[i].count==0) {this._storage.items[i]=null;}
                            break;
                        }
                        else
                        {
                            count -= this._storage.items[i].count;
                            this._storage.items[i]=null;
                        }
                    }
                }
            }

            this._output.count++;
        }
    }

    load()
    {
        this.owner={name:this.name};
        let data = this.loadData();
        if(data) 
        {
            this._storage = data.storage;
            this._output = data.output;
        }
        else 
        {
            this._storage = {capacity:-1,items:[]}; 
            this._output = null;
        }   
    }

    save() 
    { 
        let output = this._output?.count>0 ? this._output : null;
        this.saveData({storage:this._storage,output:output}); 
    }

}

export class Well extends Entity
{
    constructor(scene, x, y)
    {
        super(scene,x,y);  
        this.weight = 1000;
        this.interactive = true;  
    }

    get acts()  {return [GM.DRINK, GM.FILL];}

    addListener()
    {
        super.addListener();
        this.on(GM.DRINK,(role)=>{role.drink();})
        this.on(GM.FILL,(role)=>{this.send('fill');})
    }
}

export class Door extends Entity
{
     constructor(scene, x, y)
    {
        super(scene,x,y);  
        this.weight = 1000;
        this.interactive = true;  
        this.opened=false;
    }

    get acts()  {return [this.opened ? GM.CLOSE_DOOR : GM.OPEN_DOOR];}

    addListener()
    {
        super.addListener();
        this.on(GM.OPEN_DOOR,()=>{this.open();})
        this.on(GM.CLOSE_DOOR,(role)=>{this.close(role);})
    }

    open()
    {
        this.opened=true;
        this._sp.setTexture('doors',1);
        this.removeWeight();
        this.addWeight(undefined,25);
        this._zone.setPosition(-this.displayWidth/2+10,-16);
        this._zone.setSize(20,this.displayHeight)
        AudioManager.doorOpen();
        // this.debugDraw('zone');
    }

    close(role)
    {
        if(!this.isInGrid(role.pos))
        {
            this.opened=false;
            this._sp.setTexture('doors',0);
            this.removeWeight(25);
            this.addWeight();
            this._zone.setPosition(0,-16);
            this._zone.setSize(this.displayWidth,this.displayHeight);
            AudioManager.doorClose();
            // this.debugDraw('zone');
        }
        else
        {
            console.log('inGrid')
        }
    }
}

export class Bed extends Entity
{
    constructor(scene, x, y)
    {
        super(scene,x,y);  
        this.weight = 1000;
        this.interactive = true;  
        this.offsetX = 0;
        this.offsetY = 0;
        this.user = null;
        this._blanket;
    }   

    get pt() {return {x:this.x+this.offsetX, y:this.y+this.offsetY}}

    get acts()  {return [!this.user ? GM.REST : GM.WAKE];}

    init_prefab()
    {
        super.init_prefab();
        this.addBlanket()

    }

    addBlanket()   
    {
        let key='props/blanket.png';
        let sp = this.scene.add.sprite(0,0,key);
        sp.setPipeline('Light2D');
        sp.displayWidth = this.displayWidth;
        sp.displayHeight = this.displayHeight;
        this.add(sp);
        this._blanket = sp;
        
    }

    addListener()
    {
        super.addListener();
        this.on(GM.REST,(role)=>{this.rest(role);})
        this.on(GM.WAKE,()=>{this.wake();})
    }

    rest(role)
    {
        role.sleep(this);
        this.user = role;
        this.bringToTop(this._blanket);
    }

    wake()
    {
        this.user.wake(this)
        this.user = null;
    }
    
}


export class Point extends Entity
{

    get pt() {return {x:this.x, y:this.y}}

    init_prefab()
    {
        super.init_prefab();
        if(!this.scene.ports) {this.scene.ports={};}
        this.scene.ports[this.name] = this;
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

    get acts()  {return [GM.ENTER];}

    get pt() {return {x:this.x+this.offsetX, y:this.y+this.offsetY}}

    init_prefab()
    {
        super.init_prefab();
        if(!this.scene.ports) {this.scene.ports={};}
        this.scene.ports[this.name] = this;
    }

    addListener()
    {
        super.addListener();
        this.on(GM.ENTER,()=>{this.enter();})
    }

    enter()
    {
        this.send('scene',{map:this.map, port:this.port});
    }
}

export class Node extends Port
{
    constructor(scene,x,y)
    {
        super(scene,x,y);
        this.weight = 10;
    }

    rightButtonDown() {}

    addText(label)
    {
        let lb = this.scene.add.text(0,-30,label,{fontFamily:'Arial',fontSize:'24px',color:'#000',stroke:'#ff0',strokeThickness:0}).setOrigin(0.5);
        this.add(lb);
    }

    init_prefab(mapName)
    {
        super.init_prefab(mapName);
        this.addText(this.name);
        //this.debugDraw();
    }
}