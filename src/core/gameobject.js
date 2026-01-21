
import {Evt} from './event.js'
import Record from '../infra/record.js'
import {GM, ORDER, DEBUG} from './setting.js'

//--------------------------------------------------
// 遊戲場景中的物件都繼承 GameObject
// 功能 :
//  1. 提供 元件庫、載入、儲存的功能
//  2. 提供 bb(blackboard)，讓元件共享資訊
//  3. 提供 事件監聽與觸發的功能(Evt)
//  4. 提供 drop / falling
//--------------------------------------------------
export class GameObject
{
    static gid=0;   //id，產生一個沒有name的GO，就加1

    constructor(scene,x,y)
    {
        this.scene = scene;
        this._coms = {}; // 元件庫
        this._bb = {};  // bb(blackboard)，共享資料中心，可與各元件共享資訊
        this._ent = scene.add.container(x,y);    // gameObject 的可視實體，view 掛在其下

        this._pts = null;           // 可互動的點(陣列)
        this._acts = {};            // 可供操作的指令

        this.uid = -1;  // map.createMap() 會自動設定 uid
        this.qid = '';  // map.createMap() 會自動設定 qid, (questid)

        // 新增 property
        // 狀態 : this._sta，this.bb.sta 指向 this._sta
        this.addP('sta',{src:this.bb});
        this.bb.sta = GM.ST.IDLE;

        // 初始化
        this._init();
    }

    get mapName() {return this.scene._data.map;}    // 取得地圖名稱，存檔時，需要地圖名稱
    // get pos() {return {x:this.ent.x, y:this.ent.y};}        // 位置
    // 位置(world space)
    get pos() {
        const m = this.ent.getWorldTransformMatrix();
        return { x: m.tx, y: m.ty };
    }       
    set pos(p) {this.ent.x=p.x; this.ent.y=p.y}

    get ent() {return this._ent;}                   // 實體
    get coms() {return this._coms;}                 // 元件庫
    get bb() {return this._bb;}                     // blackboard

    // ctx 這個縮寫在程式裡很常見，它通常是 context 的縮寫，意思就是「上下文」或「語境」。
    get ctx() {return { 
                        root : this,
                        bb : this.bb, 
                        scene : this.scene,
                        pos : this.pos,
                        emit : this.emit.bind(this), 
                        aEmit : this.aEmit.bind(this),
                        send : this._send.bind(this),
                        ept : this._getEmptyPt.bind(this),
                        probe : this._probe.bind(this), 
                        gw : this._getWeight.bind(this), 
                    }}

    // 所有可操作的指令
    get acts() {return this._acts;}

    // 依順序取出第一個可供操作的指令
    get act() { return ORDER.find(key=>this._acts[key]===GM.EN &&
                                        key!==GM.OBSERVE); }

    // 可互動的點(陣列)
    get pts() {return this._pts ? this._pts.map((p)=>{return {x:p.x+this.pos.x,y:p.y+this.pos.y}})
                                : [this.pos]} 

    // 物件狀態
    get state() {return this.bb.sta;}

    // player/npc 會設
    get id() {return this.bb.id;}

    //------------------------------------------------------
    // map.createFromObjects() 會呼叫到以下的 function
    //------------------------------------------------------
    set displayWidth(value) {this.bb.wid=value;} 
    set displayHeight(value) {this.bb.hei=value;}  
    // map.createFromObjects 要參考 originX、originY、x、y 才能算出正確的 position
    get originX() {return 0.5;}
    get originY() {return 0.5;}
    get x() {return this.ent.x;}
    get y() {return this.ent.y;}
    set x(value) {this.ent.x=value;}
    set y(value) {this.ent.y=value;}
    //---- function 
    setName(name) {name!==""&&(this.bb.name=name);}
    setPosition(x,y) {this.x=x; this.y=y;}
    setTexture(key,frame) {this.bb.key=key; this.bb.frame=frame;}
    setFlip(h,v) {this.bb.flipX=h; this.bb.flipY=v;}
    // map.createFromObjects() 會利用 setData() 傳遞參數給 GameObject
    setData(key,value) {this.bb[key]=value;}   

    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    // 載入紀錄
    _loadData() {return Record.getByUid(this.mapName, this.uid, this.qid);}
    // 儲存紀錄
    _saveData(data) {Record.setByUid(this.mapName, this.uid, data, this.qid);}

    _send(type, ...args) {this.scene.events.emit(type, ...args);}
    _onover() {this._send('over',this);}
    _onout() {this._send('out',this);}
    _ondown()
    {
        const wp = this.pos;
        const x = wp.x - this.scene.cameras.main.worldView.x;
        const y = wp.y - this.scene.cameras.main.worldView.y;
        if(Object.keys(this.acts).length>0) {this._send('option',x,y-10,this.acts,this);}
    }

    // 將物件加入List
    _addToList()
    {
        this._gid = this.bb.name??GameObject.gid++;
        this.scene.gos && (this.scene.gos[this._gid]=this);
    }

    // 將物件從List移除
    _removeFromList()
    {
        if(!this.scene.gos) {return;}
        delete this.scene.gos[this._gid];
    }

    _isRemoved()
    {
        let data = this._loadData();
        if(data?.removed) {this._remove(); return true;}
        return false;
    }

    // _setAct(key,value) {this._acts[key]=value;}
    _setAct(key,get)
    {
        Object.defineProperty(this._acts, key, { 
                get: get, 
                enumerable: true, 
                configurable: true }); 
    }

    _delAct(key) {delete this._acts[key];}

    // 初始化物件
    _init()
    {
        // 提供事件監聽與觸發的功能(Evt)
        this._evt = new Evt();  

        // view 會觸發
        this.on('over', this._onover.bind(this))
        this.on('out', this._onout.bind(this))
        this.on('down', this._ondown.bind(this))

        // 移除 gameObject
        this.on('remove', this._remove.bind(this));

        // // 加入 List
        // this._addToList();

    }

    // 物件消滅時，要呼叫 _remove()
    _remove()
    { 
        this._removeFromList();

        // 1) 如果是 prefab，將 removed 設成 true
        if(this.uid!==-1) {this._saveData({removed:true})}

        // 2) 銷毀所有元件（如果元件有自帶 unbind 方法）
        for (let key in this._coms) {this._coms[key].unbind?.();}
        this._coms = null;

        // 3) 銷毀視覺實體
        if(this._ent) {this._ent.destroy(true); this._ent=null;} 

        // 4) 清空共享資料（可選）
        this._bb = null;

        // 5) 移除場景引用，讓 GC 可以回收
        this.scene = null;
    }

    // 處理傳遞給 GameObject 的參數
    _processBB()
    {
        if(this.bb.json_pts)
        {
            this._pts = JSON.parse(this.bb.json_pts);
        }
    }

    // 取得 gameObject
    _probe(p)
    {
        const bodies = this.scene.physics.overlapCirc(p.x,p.y,0,true,true);
        return bodies[0]?.gameObject.root; 
    }

    // 取的空地
    _getEmptyPt(pt,config={})
    {
        return this.scene.map.getValidPoint(pt,config);
    }

    // 取得 weight
    _getWeight(pt)
    {
        return this.scene.map.getWeight(pt)
    }

    // 在 src(this/bb) 加入 get/set, ro 為 readonly
    addP(name,{src,get,set,ro=false}={})
    {
        const srcName = src ? 'bb' : 'root';
        if(!get)
        {
            const key='_'+name;
            Object.defineProperty(src??this, name, { 
                get: ()=>{return this[key]}, 
                set: (v)=>{ if(ro) {this.warn(srcName,name);return;}
                            this[key]=v;
                            this.log(this.id,srcName,name,v);
                        }, 
                enumerable: true, 
                configurable: true }); 
        }
        else
        {
            Object.defineProperty(src??this, name, { 
                get: get, 
                set: (v)=>{set?.(v); this.log(this.id,srcName,name,v);}, 
                enumerable: true, 
                configurable: true }); 
        }
    }

    //------------------------------------------------------
    // debug 用
    //------------------------------------------------------
    warn(src, name)
    {
        if(!DEBUG.log) {return;}
        console.log(`%c[${src}.${name}] is readonly, ignore set`,'color: orange');
    }

    log(id, src, name, v)
    {
        if(!DEBUG.log) {return;}
        // DEBUG.filter 為空陣列或包含name時為 true
        const pass = (DEBUG.filter.length === 0 || 
                        DEBUG.filter.includes(name));
        if(pass) {console.log(`%c[${id}]%c ${src}.${name} = ${v}`,
                                'color:dodgerblue; font-weight:bold;',
                                'color:inhire;');}          
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
    // 在ent下，加入 sprite
    addSprite(key_frame)
    {
        const [key,frame]=key_frame.split('/');
        const sp = this.scene.add.sprite(0,0,key,frame);
        sp.setPipeline('Light2D');
        sp.displayWidth = this.bb.wid;
        sp.displayHeight = this.bb.hei;
        this.ent.add(sp);
        return sp;
    }

    addText(label)
    {
        let lb = this.scene.add.text(
                0, -32, label,
                {   
                    fontFamily:'Arial',
                    fontSize:'24px',
                    color:'#000',
                    // stroke:'#fff',
                    // strokeThickness:3,
                    backgroundColor: '#ccc',
                    padding: {x:1,y:1}    
                })
                .setOrigin(0.5,1);

        this.ent.add(lb);
    }

    // 加入物件
    add(go) {this.ent.add(go.ent);}

    // 移除物件
    remove(go)  {this.ent.remove(go.ent);}

    // 事件監聽與觸發
    on(...args) {this._evt?.on(...args);}
    off(...args) {this._evt?.off(...args);}
    emit(...args) {return this._evt?.emit(...args);}
    aEmit(...args) {return this._evt?.aEmit(...args);}
    // aEmit(k,...args) {return new Promise(resolve=>this._evt?.emit(k,resolve,...args));}
    
    // 插入元件(component)
    addCom(com, config={})
    {   
        this.coms[com.tag] = com;
        com.bind?.(this, config);
        return this;
    }

    // 拔除元件(component)
    rmCom(tag)
    {
        this.coms[tag]?.unbind?.(this);
        delete this.coms[tag];
    }

    // 載入資料
    load()
    {
        let data = this._loadData();
        // if(data) {for(let com of Object.values(this.coms)) {com.load?.(data);}}
        for(let com of Object.values(this.coms)) {com.load?.(data);}
    }

    // 儲存資料
    save(data={}) 
    { 
        for(let com of Object.values(this.coms)) {data = {...data,...com.save?.()}}
        this._saveData(data); 
        
    }

    // 更新 Z depth
    updateDepth()
    {
        let depth = this.y;
        this.ent.setDepth(depth);
    }

    // 掉落動畫
    falling(p)
    {
        console.log('-------------w=',this.weight)
        const{root}=this.ctx;
        root.removeWeight?.();
        root.addWeight?.(p);

        let tx = (this.x+p.x)/2;
        let ty = this.y-32;

        // let a = Phaser.Math.Between(-45, 45);

        // this.scene.tweens.chain({
        //     targets: this._ent,
        //     tweens:[{angle:a, duration:100, ease:'linear'},
        //             {angle:2*a, duration:100, ease:'linear'}]
        // });

        this.scene.tweens.chain({
            targets: this,
            tweens:[{x:tx, duration:100, ease:'linear'},
                    {x:p.x, duration:100, ease:'linear'}]
        });

        this.scene.tweens.chain({
            targets: this,
            tweens:[{y:ty, duration:100, ease:'exp.out'},
                    {y:p.y, duration:100, ease:'exp.in'}]
        });
    }

    // 是否抵達
    isAt(go)
    {
        for(let p of go.pts) {if(p.x===this.x && p.y===this.y){return true;}}
        return false;
    }

    // debug 用
    debugDraw({clr=false}={})
    {
        if(clr)
        {
            this._dg && this._dg.clear();
            if(this._dt) 
            {
                this._dt.destroy();
                this._dt=null;
            }
        }
        else
        {
            // debugInfo
            const[x,y,w,h,name]=[this.x,this.y,
                                this.bb.wid,this.bb.hei,
                                this.bb.name];
            if(!this._dg)
            {
                this._dg = this.scene.add.graphics();
                this._dg.setDepth(Infinity);
            }

            if(name && !this._dt)
            {
                this._dt = this.scene.add.text(x,y-h/2,name,{
                        fontSize: '16px',
                        color: '#000',
                        backgroundColor: '#fff',
                        padding: { x: 6, y: 4 }})
                this._dt.setDepth(Infinity);
                this._dt.setOrigin(0.5,1.5);
            }
            
            this._dg.lineStyle(2, 0xffffff, 1);
            const rect = new Phaser.Geom.Rectangle(x-w/2,y-h/2,w,h);
            const circle = new Phaser.Geom.Circle(x,y,5);
            this._dg.strokeRectShape(rect);
            this._dg.strokeCircleShape(circle);
        }
    }

    //------------------------------------------------------
    // mehod
    //------------------------------------------------------
    init_prefab() 
    {
        if(this._isRemoved()) { return false; }
        else
        {
            if(DEBUG.rect) {this.debugDraw();}

            this._processBB();  // 處理傳遞給 GameObject 的參數            
            this._addToList();  // 加入 List

            return true;
        }

    }

}