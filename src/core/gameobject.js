
import {Evt} from './event.js'
import Record from '../record.js'
import {GM, ORDER} from '../setting.js'

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
    constructor(scene,x,y)
    {
        this.scene = scene;
        this._coms = {}; // 元件庫
        this._bb = {};  // bb(blackboard)，共享資料中心，可與各元件共享資訊
        this._ent = scene.add.container(x,y);    // gameObject 的實體，view 掛在其下

        this._pts = null;           // 可互動的點(陣列)
        this._acts = {};            // 可供操作的指令
        this._state = GM.ST.IDLE;   // 狀態

        this.uid = -1;  // map.createMap() 會自動設定 uid
        this.qid = '';  // map.createMap() 會自動設定 qid

        this._init();
    }

    get mapName() {return this.scene._data.map;}    // 取得地圖名稱，存檔時，需要地圖名稱
    get pos() {return {x:this.x, y:this.y};}        // 位置

    get ent() {return this._ent;}                   // 實體
    get coms() {return this._coms;}                 // 元件庫
    get bb() {return this._bb;}                     // blackboard

    // ctx 這個縮寫在程式裡很常見，它通常是 context 的縮寫，意思就是「上下文」或「語境」。
    get ctx() {return { 
                        root : this,
                        bb : this.bb, 
                        emit : this.emit.bind(this), 
                        aEmit : this.aEmit.bind(this),
                        send : this._send.bind(this),
                        sta : this._rwState.bind(this),
                    }}

    // 所有可操作的指令
    get acts() {return this._acts;}
    // 依順序取出第一個可供操作的指令
    get act() 
    {
        for(const key of ORDER)
        {
            if(this._acts[key]) {return key;}
        }
    }
    // 可互動的點(陣列)
    get pts() {return this._pts ? this._pts.map((p)=>{return {x:p.x+this.pos.x,y:p.y+this.pos.y}})
                                : [this.pos]} 

    // 物件狀態
    get state() {return this._state;}

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
    setName(name) {this.bb.name=name;}
    setPosition(x,y) {this.x=x; this.y=y;}
    setTexture(key,frame) {this.bb.key=key; this.bb.frame=frame;}
    setFlip(h,v) {console.log(h,v)}
    // map.createFromObjects() 會利用 setData() 傳遞參數給 GameObject
    setData(key,value) {this.bb[key]=value;}   

    //------------------------------------------------------
    // Local
    //------------------------------------------------------
    // 存取狀態
    _rwState(val) {val&&(this._state=val); return this._state;}
    // 載入紀錄
    _loadData() {return Record.getByUid(this.mapName, this.uid, this.qid);}
    // 儲存紀錄
    _saveData(data) {Record.setByUid(this.mapName, this.uid, data, this.qid);}

    _send(type, ...args) {this.scene.events.emit(type, ...args);}
    _onover() {this._send('over',this);}
    _onout() {this._send('out',this);}
    _ondown()
    {
        let x = this.x - this.scene.cameras.main.worldView.x;
        let y = this.y - this.scene.cameras.main.worldView.y;
        if(Object.keys(this.acts).length>0) {this._send('option',x,y-10,this.acts,this);}
    }

    // 將物件加入List
    _addToList() {this.scene.gos && this.scene.gos.push(this);}
    // 將物件從List移除
    _removeFromList()
    {
        if(!this.scene.gos) {return;}
        const index = this.scene.gos.indexOf(this);
        if(index>-1) {this.scene.gos.splice(index,1);}
    }

    _isRemoved()
    {
        let data = this._loadData();
        if(data?.removed) {this._remove(); return true;}
        return false;
    }

    _setAct(key,value) {this._acts[key]=value;}

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

        // 加入 List
        this._addToList();
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

    //------------------------------------------------------
    // Public
    //------------------------------------------------------
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


    // 處理傳遞給GameObject的參數
    _processBB()
    {
        if(this.bb.name) 
        {
            if(!this.scene.points) {this.scene.points={};}
            this.scene.points[this.bb.name] = this;
        }

        if(this.bb.json_pts)
        {
            this._pts = JSON.parse(this.bb.json_pts);
        }
    }

    //------------------------------------------------------
    // mehod
    //------------------------------------------------------
    init_prefab() 
    {
        if(this._isRemoved()) {return false;}
        this._processBB();
        return true;
    }


}