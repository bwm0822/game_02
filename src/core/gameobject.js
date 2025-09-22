import {Evt} from './event.js';
import Record from '../record.js'

//--------------------------------------------------
// 遊戲場景中的物件都繼承 GameObject
// 功能 :
//  1. 提供 加入元件、載入、儲存的功能
//  2. 提供 blackboard，讓元件共享資訊
//  3. 提供事件監聽與觸發的功能(Evt)
//--------------------------------------------------
export class GameObject
{
    constructor(scene)
    {
        this.scene = scene;
        this.con = scene.add.container(0,0);    //
        this.uid = -1;  // map.createMap() 會自動設定 uid
        this.qid = '';  // map.createMap() 會自動設定 qid
        this._bb = {};  // blackboard，共享資料中心，可與各元件共享資訊
        this._init();
    }

    get mapName() {return this.scene._data.map;}    // 取得地圖名稱，存檔時，需要地圖名稱
    get pos() {return {x:this.x, y:this.y};}        // 位置
    //------------------------------------------------------
    // map.createFromObjects() 會呼叫到以下的 function
    //------------------------------------------------------
    set displayWidth(value) {this._bb.wid=value;} 
    set displayHeight(value) {this._bb.hei=value;}  
    // map.createFromObjects 要參考 originX、originY、x、y 才能算出正確的 position
    get originX() {return 0.5;}
    get originY() {return 0.5;}
    get x() {return this.con.x;}
    get y() {return this.con.y;}
    set x(value) {this.con.x=value;}
    set y(value) {this.con.y=value;}
    
    //---- function 
    setName(name) {this._bb.name=name;}
    setPosition(x,y) {this.x=x; this.y=y;}
    setTexture(key,frame) {this._bb.key=key; this._bb.frame=frame;}
    setFlip(h,v) {console.log(h,v)}
    // map.createFromObjects() 會利用 setData() 傳遞參數給 GameObject
    setData(key,value) {this._bb[key]=value;}   

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
    on(...args) {this._evt?.on(...args)}
    emit(...args) {this._evt?.emit(...args)}
    
    // 加入元件(component)
    add(com)
    {   
        if(!this._coms) {this._coms=[];}
        this._coms.push(com);
        return this;
    }

    // 載入資料
    load()
    {
        let data = this._loadData();
        if(data) {for(let com of this._coms) {com.load?.(data);}}
    }

    // 儲存資料
    save() 
    { 
        let data = {};
        for(let com of this._coms) {data = {...data,...com.save?.()}}
        this._saveData(data); 
    }

    // 更新 Z depth
    updateDepth()
    {
        let depth = this.y;
        this.con.setDepth(depth);
    }
    //------------------------------------------------------
    // abstract mehod
    //------------------------------------------------------
    get acts() {}
    get act() {}
    init_prefab() {}

    
}