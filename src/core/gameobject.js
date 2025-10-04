import {Evt} from './event.js';
import Record from '../record.js'

//--------------------------------------------------
// 遊戲場景中的物件都繼承 GameObject
// 功能 :
//  1. 提供 元件庫、載入、儲存的功能
//  2. 提供 blackboard，讓元件共享資訊
//  3. 提供 事件監聽與觸發的功能(Evt)
//--------------------------------------------------

export class GameObject
{
    constructor(scene,x,y)
    {
        this.scene = scene;
        this._coms = {}; // 元件庫
        this._bb = {};  // blackboard，共享資料中心，可與各元件共享資訊
        this._ent = scene.add.container(x,y);    // gameObject 的實體，view 掛在其下

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
    get ctx() {return {...this.coms,bb:this.bb};}
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
    _loadData() {return Record.getByUid(this.mapName, this.uid, this.qid);}
    _saveData(data) {Record.setByUid(this.mapName, this.uid, data, this.qid);}
    _send(type, ...args) {this.scene.events.emit(type, ...args);}
    _onover() {this._send('over',this);}
    _onout() {this._send('out',this);}
    _ondown()
    {
        let x = this.x - this.scene.cameras.main.worldView.x;
        let y = this.y - this.scene.cameras.main.worldView.y;
        if(this.acts.length>0) {this._send('option',x,y-10,this.acts,this);}
    }

    _addToList() {this.scene.gos && this.scene.gos.push(this);}
    _removeFromList()
    {
        if(!this.scene.gos) {return;}
        const index = this.scene.gos.indexOf(this);
        if(index>-1) {this.scene.gos.splice(index,1);}
    }

    _init()
    {
        // 提供事件監聽與觸發的功能(Evt)
        this._evt = new Evt();  
        // view 會觸發
        this.on('over', this._onover.bind(this))
        this.on('out', this._onout.bind(this))
        this.on('down', this._ondown.bind(this))
    }

    //------------------------------------------------------
    // Public
    //------------------------------------------------------

    // 事件監聽與觸發
    on(...args) {this._evt?.on(...args);}
    emit(...args) {this._evt?.emit(...args);}
    aEmit(...args) {return new Promise(resolve=>this._evt?.emit(...args,resolve));}

    // 讓元件在 root 加入 prop
    prop(name, target, key)
    {
        Object.defineProperty(this, name, {
            get: () => target[key],
            set: v => { target[key] = v; },
            enumerable: true,
            configurable: true
        });
    }
    
    // 插入元件(component)
    add(com, config={})
    {   
        this.coms[com.tag] = com;
        com.bind?.(this, config);
        return this;
    }

    // 拔除元件(component)
    remove(tag)
    {
        this.coms[tag]?.unbind?.(this);
        delete this.coms[tag];
    }

    // 載入資料
    load()
    {
        let data = this._loadData();
        if(data) {for(let com of Object.values(this.coms)) {com.load?.(data);}}
    }

    // 儲存資料
    save() 
    { 
        let data = {};
        for(let com of Object.values(this.coms)) {data = {...data,...com.save?.()}}
        this._saveData(data); 
    }

    // 更新 Z depth
    updateDepth()
    {
        let depth = this.y;
        this.ent.setDepth(depth);
    }
    //------------------------------------------------------
    // abstract mehod
    //------------------------------------------------------
    get acts() {}
    get act() {}
    init_prefab() {}

    
}