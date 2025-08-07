import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import ContainerLite from 'phaser3-rex-plugins/plugins/containerlite.js';
import Utility from './utility.js';
import {rect, divider, sprite, text, bbcText, Pic, Icon, bar, progress, progress_text, scrollBar, label, slider, dropdown} from './uibase.js';
import {GM} from './setting.js';
import * as Role from './role.js';
import DB from './db.js';
import {Mark} from './gameUi.js';
import TimeManager from './time.js';
import Record from './record.js';
import QuestManager from './quest.js';

let uiScene;
let _mode = 0;

export default function createUI(scene)
{
    console.log('createUI');
    GM.w = scene.sys.canvas.width;
    GM.h = scene.sys.canvas.height;
    uiScene = scene;
    console.log('resolution:',GM.w, GM.h)

    //test(scene);
    //t1();
    // rect(scene,{x:GM.w/2, y:GM.h/2-100, width:300, height:100, color:GM.COLOR_WHITE})

    new UiCover(scene);             // 1
    new UiMain(scene);              // 2
    new UiBuff(scene);
    new UiSkill(scene);
    new UiTime(scene);              // 19
    new UiManufacture(scene);       // 3
    new UiProfile(scene);           // 4
    new UiCursor(scene);            // 5
    new UiInv(scene);               // 6
    new UiTrade(scene);             // 7
    new UiStorage(scene);           // 8
    new UiDialog(scene);            // 9
    new UiObserve(scene);           // 10
    new UiCount(scene);             // 11
    new UiDragged(scene, 80, 80);   // 12
    new UiInfo(scene);              // 13
    new UiOption(scene);            // 14
    new UiMessage(scene);           // 15
    new UiGameOver(scene);          // 16
    new UiChangeScene(scene);       // 17
    new UiDebuger(scene);           // 18
    new UiQuest(scene);              // 20
    new UiConfirm(scene);
    


    // t3();
    t4(scene);
    t5();
    t6();
}

async function t3()
{
    // let slot = {itm:{id:'test',count:1}};
    // let itm = slot.itm;
    // // slot.itm = null;
    // slot.itm.id='';
    // slot.itm.count= 0;

    // console.log('slot:',slot, 'itm:',itm);

    let rec={'t1':0,'t2':1};
    console.log('t1:',rec['t1'])
    console.log('t3:',rec['t3'])
    
}

function t4(scene)
{
    const points = [
            new Phaser.Math.Vector2(100, 100),
            new Phaser.Math.Vector2(200, 100),
            new Phaser.Math.Vector2(200, 400),
            new Phaser.Math.Vector2(100, 400),
            new Phaser.Math.Vector2(100, 300),
            new Phaser.Math.Vector2(150, 300),
            new Phaser.Math.Vector2(150, 200),
            new Phaser.Math.Vector2(100, 200),
        ];

    const graphics = scene.add.graphics();
    // Utility.drawPolygon(graphics, points);
    Utility.drawBlock(graphics, 100, 100, 100, 100);
}

function t5()
{
    let cols=3;
    let rows=4;
    let arr = Array.from({ length: rows }, () => Array(cols));
   
    arr[0][0] = 0;
    arr[0][1] = 1;
    arr[0][2] = 2;

    console.log(arr[-1]?.[-1])

     console.log(arr)
}

function t6()
{
    console.log('---------------- t6')
    let t = {t1:{d:2},t2:{d:1},t3:{d:2}};
    for(let[key,p] of Object.entries(t))
    {
        p.d--;
        if(p.d===0) delete t[key];
    }
    console.log('t=',t)

     let tt = [2,1,3];
    tt.forEach((t,i)=>{
       
        console.log(i,t)
        t--;
        if(t==0){tt.splice(i,1)}
    })
    console.log('tt=',tt)

    let ttt = [2,1,3]
    for(let i=0; i<ttt.length; i++)
    {

        ttt[i]=ttt[i]-1
        if(ttt[i]==0) {ttt.splice(i,1), i--}
        
    }

    console.log('ttt=',ttt)
}



function t2(scene)
{
    let dialog =
    {
        0:
        {   
            A:'你好\n1\n2\n3\n4\n5\n6',
            B:['1.交易/trade','2.離開/exit']
        }
    }

    UiDialog.show(dialog);
    // let owner =
    // {
    //     trade:true,
    //     gold:500,
    //     equip:{},
    //     bag:{0:{id:'sword_01'}}
    // }

    // let box={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    // //let box={};
    // UiTrade.show(owner);

    //let inv={0:{cat:'weapon',icon:'weapons/28'},1:{cat:'weapon',icon:'weapons/30'}};
    //UiInv.show(player);
    //new UiButton(scene,{x:100,y:100,icon:GM.ICON_CLOSE})

    //console.log('test')
    //new UiButton(scene,{x:100,y:100,icon:GM.ICON_CLOSE})
    //sprite(scene,{icon:GM.ICON_CLOSE});
}

function t1()
{
    let a={test:1}
    let b;
    let c=b;
    b=a;
    console.log('c',c,b)
}

function test(scene)
{
    let bag={0:{icon:'weapons/28'},1:{icon:'weapons/30'}}
    let slot0 = new Slot(scene,80,80,{x:100,y:100,icon:GM.ICON_CLOSE,space:0});
    //slot1.setIcon('weapons/28').setCount(2);
    slot0.id=0;
    slot0.container=bag;
    slot0.update();

    let slot1 = new Slot(scene,80,80,{x:100,y:200,space:0});
    //slot2.setIcon('weapons/30').setCount(2);
    slot1.id=1;
    slot1.container=bag;
    slot1.update();

    let slot2 = new Slot(scene,80,80,{x:100,y:300,space:0});
    //slot2.setIcon('weapons/30').setCount(2);
    slot2.id=2;
    slot2.container=bag;
    slot2.update();

    console.log(scene);

}

function mark(on) {Mark.visible=on;}

function setCamera(mode) 
{
    _mode |= mode;
    uiScene.events.emit('camera',_mode);
}

function clrCamera(mode) 
{
    _mode &= ~mode;
    uiScene.events.emit('camera',_mode);
}

function clearpath() {uiScene.events.emit('clearpath');}

function send(event, ...args) {uiScene.events.emit(event, ...args);}

export class Ui
{
    static _list = {};
    static _mode = GM.UI_MODE_NORMAL;
    static _to = null;

    static get mode() {return this._mode;}
    //static closeAll(force=false) {for(let key in Ui._list){Ui._list[key].ui.close(force);}}
    static closeAll(mode=GM.UI_FORCE) 
    {
        for(let key in Ui._list)
        {
            if((Ui._list[key].type&mode) != 0) {Ui._list[key].ui.close();}
        }
    }
    static refreshAll() {for(let key in Ui._list){Ui._list[key].ui.refresh?.();}}
    static register(ui,type) {Ui._list[ui.constructor.name]={ui:ui,type:type};}
    static unregister(ui) {delete Ui._list[ui.constructor.name];}
    static setMode(mode) {this._mode = mode;}

    static addLayer(scene, name, top)
    {
        let layer = scene.add.layer();
        layer.name = name;
        layer.add(top);     // 把 top 加入 layer
    }

    static delayCall(func, delay=GM.OVER_DELAY)
    {
        if(!func) {return;}
        this._to = setTimeout(() => {func();}, delay);
    }

    static cancelDelayCall()
    {
        clearTimeout(this._to);
    }
}

class Slot extends Icon
{
    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, config);
        this.add(bar(scene,{width:0,height:5,value:0}),{key:'bar',align:'bottom',expand:{width:true},offsetY:5});
        this.add(progress(scene,{width:0,height:5,value:0}),{key:'progress',align:'bottom',expand:{width:true},offsetY:5});
        this.add(bbcText(scene,{text:'',fontSize:16, lineSpacing:-8,color:'#fff', stroke:'#000', strokeThickness:5}),{key:'times',align:'left-bottom',expand:false,offsetY:10,offsetX:0});
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK, radius:config?.radius??0, alpha:0.6}),'disabled');
        this.getElement('disabled').fillAlpha=0;
        this._i = i;
        this._getOwner = getOwner;
        this._cat = GM.CAT_ALL;
        this.addListener();
    }

    get i() {return this._i;}
    get cps() {return this.dat.cps;}
    get count() {return this.itm.count;}
    set count(value) {return this.itm.count=value;}
    get props() {return this.dat.props;}
    get label() {return this.itm.id.lab();}
    get tp() {return GM.TP_SLOT;}

    get id() {return this.itm?.id;}
    // itm
    get itm() {return this._i>=0?this.container?.[this._i]:this.container;}
    set itm(value) {this._i>=0?this.container[this._i]=value:this.container=value; this.setSlot(value);}
    // dat
    get dat() {return this._dat;}
    set dat(value) {return this._dat=value;}
    // cat
    get cat() {return this._cat;}
    set cat(value) {this._cat=value;}
    get isValid() {return UiDragged.checkCat(this.cat)}
    // owner
    get owner() {return this._getOwner?.();}
    // others
    get gold() {return this.itm.count*this.dat.gold;}

    get isEmpty() {return Utility.isEmpty(this.itm)||this.itm.count==0;}
    get container() {return this.owner?.storage?.items;}
    get capacity() {return this.owner?.storage?.capacity; }

    get storage() 
    {
        if(!this.itm.storage) {this.itm.storage={capacity:this.dat.storage,items:[]}};
        return this.itm.storage;
    }

    get acts()
    {
        let acts = [];
        console.log('useable',this.dat.useable,this.dat)

        if(this.owner.trade)    // 交易
        {
            if(this.owner.trade == GM.BUYER) {acts = ['sell','drop'];}
            else {acts = ['buy'];}
            if(this.itm.count>1) {acts = [...acts,'split'];}
        }
        else
        {
            if(this.dat.useable) 
            {
                if(this.itm?.times===0 || this.itm?.capacity===0)
                    acts = [...acts,'use:false'];
                else
                    acts = [...acts,'use'];
            }

            if(this.owner.target) // 打開箱子
            {
                acts = [...acts,'transfer','drop'];
                if(this.itm.count>1) {acts = [...acts,'split'];}
                else if(this.itm.storage) {acts = [...acts,'open'];}
            }
            else 
            {
                if(this.itm.count>1) {acts = [...acts,'drop','split'];}
                else if(this.dat.storage) {acts = [...acts,'drop','openbag'];}
                else {acts = [...acts,'drop'];}
            }
        }

        return acts;
    }

    get trading() {return this.owner.trade != UiDragged.owner.trade;}
    get enabled() {return this.capacity==-1 || this._i<this.capacity;}
    get dropable() {return true;}

    p(prop) // itm,dat 有可能會是 null/undefined (例如:EquipSlot的第10個)
    {
        let [p,sub] = prop.split('.');
        return sub ? this.itm?.[p]?.[sub] != undefined ? this.itm[p][sub] 
                                                        : this.dat?.[p]?.[sub]
                    : this.itm?.[p] != undefined ? this.itm[p] 
                                                    : this.dat?.[p];
    }  

    incp(prop, value)
    {
        this.setp(prop, this.p(prop)+value)
    }

    setp(prop, value)
    {
        let [p,sub] = prop.split(':');
        if(sub)
        {
            if(this.itm?.[p]?.[sub] != undefined) {this.itm[p][sub] = value;}
        }
        else
        {
            if(this.itm?.[p] != undefined) {this.itm[p] = value;}
        }
    }

    fill(p) {if(this.dat[p] != undefined) {this.itm[p] = this.dat[p].max;}}

    setSlot(itm)
    {
        this.dat = DB.item(itm?.id);
        this.setIcon(this.dat?.icon,{alpha:itm?.count>0?1:0.25});
        this.setCount(itm?.count>1?itm.count:'');

        this.setBar(false);
        this.setProgress(false);
        this.setTimes(false);
        if(this.dat?.endurance)
        {
            if(itm.endurance===undefined) {itm.endurance=this.dat.endurance.cur;}
            this.setBar(true,itm.endurance,this.dat.endurance.max);
        }
        if(this.dat?.capacity)
        {
            if(itm.capacity===undefined) {itm.capacity=this.dat.capacity.cur;}
            this.setProgress(true,itm.capacity,this.dat.capacity.max);
        }
        if(this.dat?.times)
        {
            if(itm.times===undefined) {itm.times=this.dat.times.cur;}
            this.setTimes(true,itm.times,this.dat.times.max);
        }
    }

    setBar(visible, cur, max)
    {
        let elm = this.getElement('bar');
        elm.visible = visible;
        if(visible) {elm.setValue(cur/max);}
    }

    setProgress(visible, cur, max)
    {
        let elm = this.getElement('progress');
        elm.visible = visible;
        if(visible) 
        {
            elm.setValue(cur/max);
        }
    }

    setTimes(visible, cur, max)
    {
        let elm = this.getElement('times');
        elm.visible=visible;
        if(visible) 
        {
            let times = '';
            for(let i=0;i<max;i++) 
            {
                times += cur>i?'■':'□';
                if(i%6==5 && i!=max-1) {times += '\n';}
            }
            elm.setText(times);
            this.layout();  // 長度會改變，所以要加 layout()
        }

    }

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{
            if (pointer.rightButtonDown()) {this.rightButtonDown(x,y);}
            else if(pointer.middleButtonDown()) {}
            else {this.leftButtonDown(x,y);}
        })
        .on('dragleave', (pointer,gameObject)=>{this.leave(gameObject);})
        .on('dragenter', (pointer,gameObject)=>{this.enter(gameObject);})
        // .on('pointerup', (pointer,x,y)=>{
        //     if(pointer.middleButtonUp())
        //     {
        //         //console.log('middle');
        //         UiOption.show(this.x-this.width/2+x,this.y-this.height/2+y);
        //     }
        // })
        // .on('dragstart',(pointer)=>{this.dragStart();})
        // .on('drag',(pointer,x,y)=>{this.drag(x,y);})
        // .on('dragend', (pointer,x,y,dropped)=>{this.dragend(x,y,dropped);})
        // .on('dragenter', (pointer,gameObject)=>{this.dragenter(gameObject);})
        // .on('dragleave', (pointer,gameObject)=>{this.dragleave(gameObject);})
        // .on('dragover', (pointer,gameObject)=>{console.log('dragover',gameObject);})
        // .on('drop', (pointer,gameObject)=>{this.drop(gameObject);})
    }

    setBgColor(color) {this.getElement('background').fillColor = color;}

    // copyData() {return this.itm ? {itm:Utility.deepClone(this.itm),owner:this.owner,dat:this.dat} : null;}

    update(cat)
    {
        cat && (this.cat=cat);  // for EquipSlot, MatSlot
        this.setSlot(this.itm);
        this.setEnable(this.enabled);
    }

    setEnable(on)
    {
        if(on)
        {
            this.setInteractive({draggable:true,dropZone:true});
            this.getElement('disabled').fillAlpha=0;
        }
        else
        {
            this.disableInteractive();
            this.setBgColor(GM.COLOR_SLOT);
            this.getElement('disabled').fillAlpha=0.6;
        }
    }

    empty() {super.empty();this.itm=null;this.dat=null;}
    
    over(check=true)
    {
        if(this.dropable && UiDragged.slot) 
        {
            if(this.trading)
            {
                if(this.isEmpty)
                {
                    this.setBgColor(this.isValid ? GM.COLOR_SLOT_TRADE : GM.COLOR_SLOT_INVALID);
                }
                else
                {
                    this.setBgColor(GM.COLOR_SLOT_DISABLE);
                }
            }
            else
            {
                this.setBgColor(this.isValid ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT_INVALID);
            }
        }
        else if(!this.isEmpty)
        {
            this.setBgColor(GM.COLOR_SLOT_OVER);
           
            Ui.delayCall(() => {UiInfo.show(GM.TP_SLOT,this);}); // 使用 delacyCall 延遲執行 UiInfo.show()
            check && UiInv.check(this.dat.cat);
        }
    }

    out(check=true)
    { 
        Ui.cancelDelayCall();    
        this.setBgColor(GM.COLOR_SLOT);
        UiInfo.close();
        check && UiInv.check();
    }

    leave(gameObject)
    {
        UiDragged.slot && gameObject.setBgColor(GM.COLOR_SLOT);
    }

    enter(gameObject)
    {
        UiDragged.slot && this.noTrade && gameObject.setBgColor(GM.COLOR_SLOT_DRAG);
    }

    rightButtonDown(x,y)
    {
        if(!this.isEmpty) {UiOption.show(this.left+x-20,this.top+y-20, this.acts, this);}
    }

    leftButtonDown(x,y)
    {
        UiInfo.close();
        if(Ui.mode == GM.UI_MODE_NORMAL)
        {
            if(this.dropable && UiDragged.slot)
            {            
                if(this.isValid)
                {
                    if(this.trading) 
                    {
                        if(!this.isEmpty) {return;}

                        if(UiDragged.owner.sell(this.owner, UiDragged.slot, this._i, this.isEquip))
                        {
                            UiDragged.empty();
                            Ui.refreshAll();
                        }
                    }
                    else
                    {
                        if(this.isMergeable())
                        {
                            this.merge();
                        }
                        else
                        {
                            // let dataCopy = this.copyData();
                            // this.itm = UiDragged.slot.itm;
                            // UiDragged.empty();
                            // if(!Utility.isEmpty(dataCopy?.itm)) {UiDragged.setData(dataCopy);}
                            // if(!UiDragged.on) {this.setBgColor(GM.COLOR_SLOT);}

                            // let dataCopy = this.copyData();
                            let tmp = UiDragged.slot.itm;
                            if(this.isEmpty) {UiDragged.empty();}
                            else {UiDragged.slot=this;}
                            this.itm = tmp;
                            if(!UiDragged.slot) {this.setBgColor(GM.COLOR_SLOT);}
                        }  
                    }
                    this.over();
                }
            }
            else if(!this.isEmpty)
            {
                this.setBgColor(GM.COLOR_SLOT_DRAG);
                // UiDragged.setData(this.copyData());
                UiDragged.slot = this;
                UiDragged.setPos(this.left+x,this.top+y);
                
                this.empty();
                UiInv.check();
            }
        }
        else if(Ui.mode == GM.UI_MODE_FILL)
        {
            this.fill('capacity');
            Ui.refreshAll();
        }
    }

    isMergeable() {return this.itm && this.itm.id==UiDragged.slot.itm.id && this.cps>1;}

    merge()
    {
        //console.log('merge',this.slot.count,this.cps)
        if(this.itm.count<this.cps)
        {
            let draggedCount = UiDragged.slot.itm.count;
            let count = Math.min(this.itm.count+draggedCount,this.cps);
            draggedCount -= count-this.itm.count;
            this.itm.count = count;
            UiDragged.slot.itm.count = draggedCount;
            this.update();
            UiDragged.update();
        }
    }



    // dragStart()
    // {
    //     if(this.icon)
    //     {
    //         this.dragged = new Pic(this.scene,this.width,this.height,{x:this.x,y:this.y,icon:this.icon})
    //         this.dragged.icon = this.icon;
    //         this.clear();
    //     }
    // }

    // drag(x,y)
    // {
    //     if(this.dragged) {this.dragged.setPosition(x,y);}
    // }

    // dragend(x,y,dropped)
    // {
    //     if(!dropped)
    //     {
    //         this.setIcon(this.dragged.icon)
    //     }

    //     if(this.dragged)
    //     {
    //         this.dragged.destroy();
    //         delete this.dragged;
    //     }

    // }

    // dragenter(gameObject) {gameObject.emit('pointerover');}

    // dragleave(gameObject) {gameObject.emit('pointerout');}

    // drop(gameObject)
    // {
    //     if(this.dragged) {gameObject.setIcon(this.dragged.icon);}
    // }

}

class EquipSlot extends Slot
{
    static cat2Icon(cat)
    {
        switch(cat)
        {
            case GM.CAT_WEAPON: return GM.ICON_WEAPON;
            case GM.CAT_HELMET: return GM.ICON_HELMET;
            case GM.CAT_CHESTPLATE: return GM.ICON_CHESTPLATE;
            case GM.CAT_GLOVES: return GM.ICON_GLOVES;
            case GM.CAT_BOOTS: return GM.ICON_BOOTS;
            case GM.CAT_NECKLACE: return GM.ICON_NECKLACE;
            case GM.CAT_RING: return GM.ICON_RING;
            case GM.CAT_EQUIP|GM.CAT_BAG: return GM.ICON_BAG;
        }
    }

    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, i, getOwner, config);
        this._cat = config?.cat;
        this.setIcon();
    }

    get container() {return this.owner?.status?.equips;}
    get capacity() {return -1;}

    //get cat() {return this._cat;}

    get isEquip() {return true;}

    //get isValid() {return UiDragged.checkCat(this.cat)}

    // get, set 都要 assign 才會正常 work
    get itm() {return super.itm;}
    set itm(value) {super.itm=value; this.owner.equip();}

    checkCat(cat)   {return (this.cat & cat) == cat;}  

    over() {super.over(false);}
    out() {super.out(false);}

    check(cat)
    {
        this.setBgColor( this.checkCat(cat) ? GM.COLOR_SLOT_DRAG : GM.COLOR_SLOT);
    }

    setIcon(icon)
    {
        if(icon) {return super.setIcon(icon);}
        else {return super.setIcon(EquipSlot.cat2Icon(this.cat),{alpha:0.25,tint:0x0});}
    }

}

class MatSlot extends Slot
{
    constructor(scene, w, h, i, getOwner, config)
    {
        super(scene, w, h, i, getOwner, config);
        this.onset = config?.onset;
    }

    // get, set 都要 assign 才會正常 work
    get itm() {return super.itm;}
    set itm(value) {super.itm=value; this.onset?.();}
}

class OutputSlot extends Slot
{
    constructor(scene, w, h, getOwner, config)
    {
        super(scene, w, h, -1, getOwner, config);
        this.onset = config?.onset;
    }

    get dropable() {return false;}
    get container() {return this.owner?.output;}
    set container(value) {this.owner.output=value;}
    get capacity() {return -1; }

    // get, set 都要 assign 才會正常 work
    get itm() {return super.itm;}
    set itm(value) {super.itm=value; this.onset?.();}

    // empty() {this.itm.count=0;this.itm=this.itm;}
    empty() {this.itm={id:this.itm.id,count:0};}
}

class SkillSlot extends Pic
{
    static selected = null; // 用來記錄目前選擇的技能
    constructor(scene, w, h, i, config)
    {
        super(scene, w, h, config);
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK,radius:config?.radius??0, alpha:0.6}),'disabled');
        this.add(bbcText(scene,{text:'',fontSize:20,color:'#fff'}),{key:'cd',align:'center-center',expand:false});
        this.setIcon(config?.icon);
        this.getElement('disabled').fillAlpha=0;
        this.addListener();
        this._i = i;            // 技能欄位索引
        this._id = null;
        this._state = null;     // 用來存放技能狀態
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return Role.getPlayer();}
    get id() {return this._id;}
    get i() {return this._i;}
    get dat() {return this._dat;}
    get st() {return this._state;}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', (pointer,x,y)=>{this.leftButtonDown(x,y);})
        .on('pointerup', (pointer,x,y)=>{this.leftButtonUp(x,y);})
        .on('dragleave', (pointer,gameObject)=>{this.leave(gameObject);})
        .on('dragenter', (pointer,gameObject)=>{this.enter(gameObject);})
    }

    setBgColor(color) {this.getElement('background').fillColor = color;}
    setStrokeColor(color) {this.getElement('background').strokeColor = color;}
    over() { this._id && Ui.delayCall(()=>{UiInfo.show(GM.TP_SKILL_1,this);}); } // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() { Ui.cancelDelayCall();UiInfo.close(); }

    leave() {UiDragged.interact(true);}
    enter(gameObject) {(gameObject instanceof SkillSlot) && UiDragged.interact(false);}

    leftButtonDown(x,y)
    {
        if(!this._id || SkillSlot.selected) {return;}
        Ui.delayCall(() => {this.drag(x,y);}, GM.PRESS_DELAY) ;
    }

    drag(x,y)
    {
        UiDragged.skill = this;
        UiDragged.setPos(this.left+x, this.top+y);
        this.empty();
    }
    
    leftButtonUp(x,y)
    {
        Ui.cancelDelayCall();   
        if(UiDragged.skill)
        {
            this.owner.status.skillSlots.forEach((slot,i)=>{
                if(slot===UiDragged.skill.id)
                {
                    this.owner.status.skillSlots[i]=null;

                }
                
            })
            this._id && (this.owner.status.skillSlots[UiDragged.skill.i] = this._id);
            this.owner.status.skillSlots[this._i] = UiDragged.skill.id;
            UiDragged.empty();
            Ui.refreshAll();
        }
        else if(this._state)
        {
            // console.log(this._state)
            if(this._dat.type === GM.SELF)
            {
                this.owner.useSkill(this);
            }
            else
            {
                this.toggle();
            }
        }
    }

    update()
    {
        this._id = this.owner.status.skillSlots[this._i];
        if(this._id) {this.set();}
        else {this.empty();}
    }

    toggle()
    {
        if(SkillSlot.selected)
        {
            SkillSlot.selected===this && SkillSlot.selected.unselect();
        }
        else if(this._state.cd===0)
        {
            this.select();
        }
    }

    select()
    {
        SkillSlot.selected = this; // 設定目前選擇的技能
        this.setStrokeColor(GM.COLOR_RED);
        this.owner.setSkill(this); // 設定角色的技能
    }

    unselect()
    {
        SkillSlot.selected = null; // 清除目前選擇的技能
        this.setStrokeColor(GM.COLOR_WHITE);
        this.owner.unsetSkill();
    }

    reset() // call by role.resetSkill()
    {
        SkillSlot.selected = null; // 清除目前選擇的技能
        this.setStrokeColor(GM.COLOR_WHITE);
        this.update();
    }

    set()
    {
        this._state =  this.owner.status.skills[this._id];
        this._dat = DB.skill(this._id);
        let cd = this._state.cd;
        this.setIcon(this._dat.icon);
        this.getElement('cd').setText(cd>0?cd:'');
        this.getElement('disabled').fillAlpha=cd>0 ? 0.5 : 0;
        this.layout();
    }

    empty()
    {
        this._id = null;
        this._state = null;
        this._dat = null
        this.setIcon();
        this.getElement('cd').setText('');
        this.setBgColor(GM.COLOR_SLOT);
        this.getElement('disabled').fillAlpha = 0;
        this.owner.status.skillSlots[this._i] = null; // 清除技能欄位
    }
}


class SkillItem extends Pic
{
    constructor(scene, w, h, config)
    {
        super(scene, w, h, config);
        this.addBackground(rect(scene,{color:GM.COLOR_BLACK,radius:config?.radius??0, alpha:0.6}),'disabled');
        this.add(bbcText(scene,{text:'',fontSize:20,color:'#fff'}),{key:'text',align:'center-center',expand:false});
        this.setIcon(config?.icon);
        this.getElement('disabled').fillAlpha=0;
        this.addListener();
        this._id = null;
        this._skill = null;     // 用來存放技能狀態
        this._dat = null;       // 用來存放技能資料
    }

    get owner() {return Role.getPlayer();}
    get id() {return this._id;}
    get i() {return this._i;}
    get dat() {return this._dat;}

    get en() {return this._skill && this._skill.en;}

    get locked()
    {
        if(this.en) {return false;}
        let ret = this._dat.refs?.find(ref=> this.owner.status.skills[ref]===undefined || this.owner.status.skills[ref].en===false);
        return ret!==undefined;
    }
    

    leave() {UiDragged.interact(true);}
    enter(gameObject) {(gameObject instanceof SkillSlot) && UiDragged.interact(false);}
    over() {Ui.delayCall(() => {UiInfo.show(GM.TP_SKILL,this);});} // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() {Ui.cancelDelayCall();UiInfo.close();}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
        .on('pointerdown', async (pointer,x,y)=>{this.leftButtonDown(x,y);})
        .on('pointerup', (pointer,x,y)=>{this.leftButtonUp(x,y);})
        .on('dragleave', (pointer,gameObject)=>{this.leave(gameObject);})
        .on('dragenter', (pointer,gameObject)=>{this.enter(gameObject);})
    }

    async leftButtonDown(x,y)
    {
        // if(!this._skill?.en || SkillSlot.selected) {return;}
        if(this.locked || SkillSlot.selected) {return;}
       
        if(!this._skill?.en)
        {
            let ret = await UiConfirm.msg('學習此技能?');
            if(ret)
            {
                if(!this._skill)
                {
                    this.owner.status.skills[this._id]={en:false,cd:0}
                    this._skill=this.owner.status.skills[this._id];
                }
                this._skill.en=true;
                Ui.refreshAll();
            }
        }
        else if(this.dat.type !== GM.PASSIVE)
        {
            Ui.delayCall(() => {this.drag(x,y);}, GM.PRESS_DELAY) ;
        }
    }

    leftButtonUp(x,y)
    {
        Ui.cancelDelayCall();   
        UiDragged.empty();
    }

    drag(x,y)
    {
        let mpos=this.scene.input.activePointer;
        UiDragged.skill = this;
        UiDragged.setPos(mpos.x, mpos.y);
        Ui.cancelDelayCall();
        UiInfo.close();
    }

    

    update()
    {
        this.getElement('text').setText(this.locked?'🔒':'');
        this.getElement('disabled').fillAlpha=this.en?0:0.75;

    }

    set(id, x, y)
    {
        this._id = id;
        this.x = x;
        this.y = y;
        this._skill =  this.owner.status.skills[this._id];
        this._dat = DB.skill(this._id);
        this.setIcon(this._dat.icon);
        this.getElement('text').setText(this.locked?'🔒':'');
        this.getElement('disabled').fillAlpha=this.en?0:0.75;
        this.layout();
    }

}





export class UiDragged extends OverlapSizer
{
    static instance = null;
    constructor(scene, w, h)
    {
        super(scene, 0, 0, w, h);
        UiDragged.instance = this;
        Ui.addLayer(scene, 'UiDragged', this);    // 產生layer，並設定layer名稱
        this.addBackground(rect(scene,{color:GM.COLOR_SLOT,radius:0, alpha:0}),'background')
            .add(sprite(this.scene),{aspectRatio:true, key:'sprite'})  
            .addCount(scene)
            .layout()
            .hide()
            .addListener();
    }


    static get on() {return this.instance.visible;}
    static get owner() {return this.instance.slot.owner;}
    // static get itm() {return this.instance.itm;}
    // get owner() {return this.slot.owner;}
    // get itm() {return this.slot.itm;}
    // get dat() {return this.slot.dat;}
    get label() {return this.slot.itm.id.lab();}
    get gold() {return this.slot.itm.count*this.slot.dat.gold;}



    static get slot() {return this.instance.slot;}
    static set slot(value) {this.instance.slot=value;}

    static set skill(value) {this.instance.setSkill(value);}
    static get skill() {return this.instance._skill;}

    set slot(value) {this.setSlot(value)}
    get slot() {return this._slot;}


    addListener()
    {
        this//.setInteractive()
            .on('pointerup',()=>{
                console.log('-drop-')
                this.empty();
                this.disableInteractive();
            })
    }

    interact(on) 
    {
        if(on) {this.setInteractive();}
        else {this.disableInteractive();}
    }

    //checkCat(cat) {return (this.data.item.cat & cat) == this.data.item.cat;}
    checkCat(cat) {return (this.slot.dat.cat & cat) == this.slot.dat.cat;}

    update() 
    {
        if(this.slot.itm.count==0)
        {
            this.empty();
        }
        else
        {
            this.setCount(this.slot.itm.count>1 ? this.slot.itm.count : '')
        }
    }

    empty()
    {
        this.hide();
        delete this._slot;
        delete this._skill;
        UiCover.close();
        UiMain.enable(true);
    }

    addCount(scene)
    {
        this.add(text(scene,{fontSize:20, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false})
        return this
    }

    setData(value)
    {
        // value ={itm:{id:id, count:count}, dat:{}, owner:{}}
        this.show();
        // this._owner = value.owner;
        // this._itm = value.itm;
        // this._dat = value.dat;
        this.slot = value;
        this.setIcon(value.dat.icon)
            .setCount(value.itm.count>1 ? value.itm.count : '')
        UiCover.show();
        UiMain.enable(false);
    }

    setSlot(slot)
    {
        this.show();
        // this.itm = slot.itm;
        // this.dat = slot.dat;
        // this.owner = slot.owner;
        this._slot = {
            itm: slot.itm,
            dat: slot.dat,
            owner: slot.owner,
            gold: slot.gold
        };

        this.setIcon(slot.dat.icon)
            .setCount(slot.itm.count>1 ? slot.itm.count : '')
        UiCover.show();
        UiMain.enable(false);
    }

    setSkill(skill)
    {
        this.show();
        this._skill = 
        {
            id: skill.id,
            i: skill.i,
        }
        let dat = DB.skill(skill.id);
        // this.owner = Role.getPlayer();
        this.setIcon(dat.icon).setCount('')
        UiCover.show();
        // UiMain.enable(false);
    }

    setIcon(icon)
    {
        let [key,frame]=icon.split('/');
        let sp = this.getElement('sprite');
        // this.getElement('sprite').setTexture(key,frame);
        sp.setTexture(key,frame);
        sp.rexSizer.aspectRatio = sp.width/sp.height;
        this.layout();
        return this;
    }

    setCount(count)
    {
        this.getElement('count').setText(count);
        this.layout();
        return this;
    }

    drop()
    {
        if(this.slot&&this.slot.owner.trade!=GM.SELLER)
        {
            this.slot.owner.drop(this.slot);
            this.empty();
        }
    }

    static setData(value) {this.instance.setData(value);}

    static setPos(x,y) {return this.instance?.setPosition(x,y);}

    static empty() {this.instance?.empty();}
    
    static checkCat(cat) {return this.instance?.checkCat(cat);}

    static update() {this.instance?.update();}

    static drop() {this.instance?.drop();}

    static interact(on) {this.instance.interact(on);}

}


class UiButton extends Sizer
{
    constructor(scene,option)
    {
        super(scene,option);
        this.onclick = option?.onclick;
        this.onover = option?.onover;
        this.onout = option?.onout;
        this.type = option?.type ?? GM.BTN_NORMAL;
        this.key = option?.key;
        let radius = option.radius ?? 5;
        let padding = option.padding ?? 5;

        switch(this.type)
        {
            case GM.BTN_NORMAL:
                let bg = option.bg ?? rect(scene,{color:GM.COLOR_DARK,radius:radius,});
                this.addBackground(bg,'bg')
                if(option.text) { this.add(text(scene,{text:option.text}),{padding:padding,key:'text'}); }
                if(option.icon) { this.add(sprite(scene,{icon:option.icon}),{padding:padding,key:'icon'}); }
                break;

            case GM.BTN_NOBG:
                if(option.text) { this.add(text(scene,{text:option.text}),{key:'text'}); }
                if(option.icon) { this.add(sprite(scene,{icon:option.icon}),{key:'icon'}); }
                break;

            case GM.BTN_TEXT:
                this.addBackground( rect(scene,{color:GM.COLOR_SLOT,alpha:0}),'bg' )
                if(option.text) { this.add(text(scene,{text:option.text}),{key:'text'}); }
                break;
        }

        this.layout().addListener()
        scene.add.existing(this);
        
    }

    addListener()
    {
        let bg = this.getElement('bg');
        let icon = this.getElement('icon');
        let text = this.getElement('text');

        let over = (on)=>{

            switch(this.type)
            {
                case GM.BTN_NORMAL: 
                    bg && (bg.fillAlpha = on ? 0.5 : 1); 
                    break;
                case GM.BTN_NOBG: 
                    icon && (icon.setTint( on ? GM.COLOR_GRAY : GM.COLOR_WHITE)); 
                    text && (text.setTint( on ? GM.COLOR_GRAY : GM.COLOR_WHITE)); 
                    break;
                case GM.BTN_TEXT: 
                    bg && (bg.fillAlpha = on ? 1 : 0); 
                    break;
            }
        }

        this.setInteractive();
        this.on('pointerover',()=>{over(true);this.onover&&this.onover(this);})
            .on('pointerout',()=>{over(false);this.onout&&this.onout(this);})
            .on('pointerdown',()=>{this.onclick&&this.onclick(this);})
    }

    setEnable(on)
    {        
        if(on) 
        {
            this.setInteractive();
            this.getElement('bg')?.setAlpha(1);
            this.getElement('icon')?.setAlpha(1);
            this.getElement('text')?.setAlpha(1);
        }
        else 
        {
            this.disableInteractive();
            this.getElement('bg')?.setAlpha(0.5);
            this.getElement('icon')?.setAlpha(0.5);
            this.getElement('text')?.setAlpha(0.5);
        }
    }
}



export class UiCover extends Sizer
{
    static instance = null;
    constructor(scene)
    {
        super(scene,0,0,GM.w,GM.h);
        UiCover.instance = this;
        Ui.addLayer(scene, 'UiCover', this);    // 產生layer，並設定layer名稱

        this.addBackground(rect(scene,{color:GM.COLOR_DARK,alpha:0}))
            .setOrigin(0,0)
            .layout()
            .hide()
        // scene.add.existing(this);
        // Ui.addLayer(scene, 'UiCover', this);


        this.setInteractive()
            .on('pointerdown',()=>{UiDragged.drop();})
        this._cnt=0;
    }

    show()
    {
        super.show();
        this._cnt++;
    }

    close()
    {
        if(--this._cnt<=0)
        {
            this.hide();
            this._cnt=0;
        }
    }

    static show() {UiCover.instance?.show();}
    static close() {UiCover.instance?.close();}
}

class UiInfo extends Sizer
{
    static instance = null;
    static gap = 10;    // show() 有用到，不可移除
    static w = 250;
    constructor(scene)
    {
        super(scene,{orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:0}});
        UiInfo.instance = this;
        Ui.addLayer(scene, 'UiInfo', this);    // 產生layer，並設定layer名稱

        this.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3}))
            .layout()
            .hide();

        // scene.add.existing(this);
        // Ui.addLayer(scene, 'UiInfo', this);
    }

    get lang() {return Record.data.lang;}

    addTitle(slot)
    {
        let title = slot.dat[this.lang]?.lab
        this.add(bbcText(this.scene,{text:title??slot.dat.id}));
        return this;
    }

    addCat(slot)
    {
        if(slot.dat.cat)
        {
            let cat = `[color=gray]${slot.dat.cat.lab()}[/color]`;
            this.add(bbcText(this.scene,{text:cat}));
        }
        return this;
    }

    addDivider()
    {
        this.add(rect(this.scene,{width:200,height:1,color:GM.COLOR_WHITE}),{padding:{top:10,bottom:10}})
        return this;
    }

    addDescript(slot)
    {
        let des = slot.dat[this.lang]?.des
        if(des)
        {
            this.addDivider();
            // this.add(bbcText(this.scene,{text:slot.id.des(),wrapWidth:200}),{align:'left'});
            this.add(bbcText(this.scene,{text:des,wrapWidth:200}),{align:'left'});
        }
        return this;
    }

    addProps(slot)
    {
        if(slot.dat.props || slot.dat.endurance || slot.dat.storage) 
        {
            this.addDivider();
        }

        if(slot.dat.props)
        {
            for(let [key,value] of Object.entries(slot.dat.props))
            {
                //console.log(key,value);
                switch(key)
                {
                    case GM.P_HUNGER: value = `${value}%`; break;
                    case GM.P_THIRST: value = `${value}%`; break;
                }
                this.addProp(key,value);
            }
        }
        if(slot.dat.endurance)
        {
            //this.addProp('耐久',`${slot.endurance}/${item.endurance.max}`);
            this.addProp(GM.P_ENDURANCE,Utility.tick2Str(slot.itm.endurance));
        }
        if(slot.dat.storage)
        {
            let cnt = slot.itm.storage?.items.filter(item => item).length;
            this.addProp(GM.P_STORAGE,`${cnt??0}/${slot.dat.storage}`);
        }
        if(slot.dat.times)
        {
            this.addTimes(GM.P_TIMES,`${slot.itm.times}/${slot.dat.times.max}`);
        }
        return this;
    }

    addProp(key, value)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer//.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}))
            .add(bbcText(this.scene,{text:key.lab(),color:'#888'}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0});
        this.add(sizer,{expand:true});
        return this;
    }

    addTimes(key, value)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer//.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}))
            .add(bbcText(this.scene,{text:`${key.lab()} : `, color:'#888'}))
            .add(bbcText(this.scene,{text:value}));
        this.add(sizer,{expand:true});
        return this;
    }

    addMake(slot)
    {
        if(!slot.dat.make) {return this;}
        this.addDivider();
        let text = `[color=yellow]${'required'.lab()}[/color]\n`;
        Object.entries(slot.dat.make.items).forEach(([key,value])=>{
            text+=`- ${key.lab()} (${value})\n`;
        });
        this.add(bbcText(this.scene,{text:text}),{expand:true});
        return this;
    }

    addGold(slot)
    {
        if(slot.dat.gold)
        {
            let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
            let text = `[color=yellow][img=gold][/color] ${(slot.itm.count??1)*slot.dat.gold}`
            this.add(bbcText(this.scene,{text:text,images:images}),{align:'right'});
        }

        return this;
    }

    addCd(skill)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer//.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}))
            .add(bbcText(this.scene,{text:skill.dat.type}))
            .addSpace()
        if(skill.dat.cd)
        {
            sizer.add(bbcText(this.scene,{text:`⌛${skill.dat.cd}`}));
        }
        this.addDivider();
        this.add(sizer,{expand:true});
        return this;
    }

    addEffect(buff)
    {
        this.addDivider();
        Object.entries(buff.dat.effects).forEach(([key,value])=>{
            this.addProp(key,value.value)
        })
    }

    update(tp, elm)
    {
        // let item = ItemDB.get(slot.id);
        this.removeAll(true)

        switch(tp)
        {
            case GM.TP_SLOT:
                 this.addTitle(elm)
                    .addCat(elm)
                    .addProps(elm)
                    .addMake(elm)
                    .addDescript(elm)
                    .addGold(elm)
                break;

            case GM.TP_PROP:
                this.add(bbcText(this.scene,{text:elm.p.des()}));
                break;

            case GM.TP_BTN:
                this.add(bbcText(this.scene,{text:elm.key.lab()}));
                break;

            case GM.TP_SKILL:
            case GM.TP_SKILL_1:
                 this.addTitle(elm)
                    .addCd(elm)
                    .addDescript(elm)
                break;

            case GM.TP_BUFF:
                this.add(bbcText(this.scene,{text:elm.dat.id}))
                    .addEffect(elm)
                break;
        }

        this.layout()
    }

    show(tp, elm)
    {
        // console.log(elm,elm.left,elm.right,elm.top,elm.bottom);
        super.show();
        let x=elm.x,y=elm.y;

        let parent = elm.parentContainer;
        let parentX=0, parentY=0;
        if(parent)
        {
            parentX = parent.x;
            parentY = parent.y;
            x += parentX;
            y += parentY;
        }

        switch(tp)
        {
            case GM.TP_BTN:
            case GM.TP_BUFF:
            case GM.TP_SKILL_1:
                if(elm.y>GM.h/2)
                {
                    this.setOrigin(0.5,1);
                    y=parentY+elm.top-UiInfo.gap;
                }
                else
                {
                    this.setOrigin(0.5,0);
                    y=parentY+elm.bottom+UiInfo.gap;
                }
                break;

            default:
                if(elm.x>GM.w/2)
                {
                    this.setOrigin(1,0.5);
                    x=parentX+elm.left-UiInfo.gap;
                }
                else
                {
                    this.setOrigin(0,0.5);
                    x=parentX+elm.right+UiInfo.gap;
                }
                break;
        }

        this.update(tp, elm);

        this.setPosition(x,y).rePos();
        this.layout();
    }

    rePos()
    {
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
    }

    static close() {UiInfo.instance?.hide();}

    static show(tp, elm) {UiInfo.instance?.show(tp, elm);}
}

class UiContainerBase extends ContainerLite
{
    constructor(scene, layername, touchClose=true)
    {
        super(scene,0,0,GM.w,GM.h);
        Ui.addLayer(scene, layername, this);    // 產生layer，並設定layer名稱
        this.addBg(scene, touchClose)
        // scene.add.existing(this);
    }

    addBg(scene, touchClose)
    {
        // console.log(GM.w, GM.h)
        let sizer = scene.rexUI.add.sizer(0,0,GM.w,GM.h);
        sizer.addBackground(rect(scene,{alpha:0.5}))
            .setOrigin(0)
            .layout()
            .setInteractive()
        touchClose && sizer.on('pointerdown',()=>{this.visible=false;});
        this.add(sizer);

        return this;
    }

    add(content)
    {
        this.content = content;
        this.content.onclose = this.close.bind(this);
        super.add(this.content);
        return this;
    }

    show(...args)
    {
        this.visible=true;
        return this.content.show(...args);
    }

    close() {this.visible=false;}

}

class UiBase extends Sizer
{
    constructor(scene, config, layername)
    {
        super(scene, config)
        if(layername) {Ui.addLayer(scene, layername, this);}
        else {scene.add.existing(this);}
    }

    closeAll(mode) {Ui.closeAll(mode);}
    refreshAll() {Ui.refreshAll();}
    register(type) {Ui.register(this,type);}
    unregister() {Ui.unregister(this);}

    getOwner() {return this.owner;}

    addBg_Int(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        this.getElement('bg').setInteractive() //避免 UI scene 的 input event 傳到其他 scene
            .on('pointerover',()=>{if(Ui.mode==GM.UI_MODE_NORMAL){UiCursor.set();clearpath();}})
        return this;
    }

    addBg(scene, config)
    {
        this.addBackground(rect(scene,config),'bg');
        return this;
    }

    addTop(scene, {text='',bgColor}={})
    {
        let sz = scene.rexUI.add.overlapSizer();
        if(bgColor!=undefined) {sz.addBackground(rect(scene,{color:bgColor}))}
        sz.add(bbcText(scene,{text:text}),{align:'center',expand:false,key:'label'})
            .add(new UiButton(scene,{icon:GM.ICON_CLOSE,type:GM.BTN_NOBG, onclick:this.close.bind(this)}),{align:'right',expand:false})
        this.add(sz,{padding:{left:0,right:0}, expand:true, key:'top'});
        return this;
    }

    // addGrid(scene, column, row, getOwner, space)
    // {
    //     let config =
    //     {
    //         column: column,
    //         row: row,
    //         space: {column:5,row:5,...space},
    //     }

    //     let grid = scene.rexUI.add.gridSizer(config);
    //     let count = config.column * config.row;
    //     for(let i=0; i<count; i++)
    //     {
    //         let slot = new Slot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE, i, getOwner);
    //         grid.add(slot);
    //     }

    //     this.add(grid,{key:'grid'});
    //     return this;
    // }

    addGrid(scene, column, row, getOwner, ext={})
    {
        let config =
        {
            column: column,
            row: row,
            space: {column:5,row:5,left:5,right:5,top:5,bottom:5,...ext.space},
        }

        let slot_w = ext.slot_w ?? GM.SLOT_SIZE;
        let slot_h = ext.slot_h ?? GM.SLOT_SIZE;

        let classT = ext.classT ?? Slot;
        let classC = ext.classC ?? {};

        let grid = scene.rexUI.add.gridSizer(config);
        grid.addBackground(rect(scene,{strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
        let count = config.column * config.row;
        for(let i=0; i<count; i++)
        {
            let slot = new classT(scene, slot_w, slot_h, i, getOwner, classC);
            grid.add(slot);
        }

        this.add(grid,{key:'grid',padding:ext.padding});
        return this;
    }

    addScroll(scene, {  width=0, height=0,
                        bg={alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2},
                        panel={orientation:'y',space:5},
                        add={expand:true, key:'scroll'},
                    }={})
    {
        let config = 
        {
            width: width,
            height: height,
            background: rect(scene, bg),
            panel: {child:scene.rexUI.add.sizer(panel)},
            slider: {
                track: rect(scene,{width:15,color:GM.COLOR_DARK}),
                thumb: rect(scene,{width:20,height:20,radius:5,color:GM.COLOR_LIGHT}),
                space: 5,
                hideUnscrollableSlider: true,
                disableUnscrollableDrag: true,
            },
        }
        let scroll = scene.rexUI.add.scrollablePanel(config);
        this.add(scroll, add);
        return this;
    }

    addPanel(scene, {  width=0, height=0,
                        orientation='y',space=5,
                        color=GM.COLOR_PRIMARY,strokeColor=GM.COLOR_GRAY,strokeWidth=2,
                    }={})
    {
        let config = 
        {
            width: width,
            height: height,
            orientation: orientation,
            space: space,
        }
        let panel = scene.rexUI.add.sizer(config);
        panel.addBackground(rect(scene,{color:color,strokeColor:strokeColor,strokeWidth:strokeWidth}),'bg')
        this.add(panel,{expand:true, proportion:1, key:'panel'});
        return this;
    }

    addGold(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),'bg')
        let images = {gold:{key:'buffs',frame:210,width:GM.FONT_SIZE,height:GM.FONT_SIZE,tintFill:true }};
        let text = `[color=yellow][img=gold][/color] ${0}`
        sizer.add(bbcText(scene,{text:text,images:images}),{padding:{left:10,top:5,bottom:5},align:'left',key:'gold'});
        this.add(sizer,{expand:true,key:'info'})
        return this;
    }

    addDivider(scene,padding={left:0,right:0,top:10,bottom:10})
    {
        // this.add(rect(scene,{width:200,height:1,color:GM.COLOR_WHITE}),
        //             {padding:padding,expand:true})
        this.add(divider(scene),{padding:padding,expand:true})
        return this;
    }

    item(id,{onover,onout,ondown}={})
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:id,color:'#777777'}),{key:'label'})
        let bg = sizer.getElement('bg').setAlpha(0);
        let lb = sizer.getElement('label');
        sizer.unsel = ()=>{lb.setColor('#777777');}
        sizer.sel = ()=>{lb.setColor('#ffffff');}
        sizer.setInteractive()
            .on('pointerover',()=>{ onover?.(sizer); bg.alpha=1; })
            .on('pointerout',()=>{ bg.alpha=0; onout?.();})
            .on('pointerdown',()=>{ ondown?.(sizer); })
        return sizer;  
    }

    prop(key, value, interactive=true)
    {
        let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
        if(value.max) {value=`${value.cur} / ${value.max}`;}
        else if(value.den) {value=`${Math.floor(value.cur)} %`;}
        sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(bbcText(this.scene,{text:key.lab()}),{proportion:1})
            .add(bbcText(this.scene,{text:value}),{proportion:0})
        let bg = sizer.getElement('bg').setAlpha(0);
        if(interactive)
        {
            sizer.p = key;
            sizer.setInteractive()
                .on('pointerover',()=>{ bg.alpha=1; Ui.delayCall(()=>{UiInfo.show(GM.TP_PROP,sizer);}) })
                .on('pointerout',()=>{ bg.alpha=0; Ui.cancelDelayCall(); UiInfo.close();})
        }
        return sizer;
    }

    setTitle(title) {this.getElement('label',true).setText(title);}

    updateEquip() {this.getElement('equip',true).getElement('items').forEach(item => {item?.update();});}

    updateGrid(cat) {this.getElement('grid',true).getElement('items').forEach(item => {item?.update(cat);});}

    updateGold() {this.getElement('gold',true).setText(`[color=yellow][img=gold][/color] ${this.owner.status.gold}`);}

    close() {this.hide();}

    // destroy() {super.destroy();}

}

class Option extends UiBase
{
    constructor(scene)
    {
        super(scene,{width:100,orientation:'y',space:{left:10,right:10,bottom:10,top:10,item:10}});
        this.btns={};

        this//.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3}))
            .addBg(scene, {color:GM.COLOR_DARK,strokeColor:GM.COLOR_GRAY,strokeWidth:3})
            .addButton(GM.TALK)
            .addButton(GM.TRADE)
            .addButton(GM.OBSERVE, this.observe.bind(this))
            .addButton(GM.ATTACK)
            .addButton(GM.TAKE)
            .addButton(GM.OPEN)
            .addButton(GM.ENTER)
            .addButton(GM.OPEN_DOOR)
            .addButton(GM.CLOSE_DOOR)
            .addButton(GM.INV, this.inv.bind(this))
            .addButton(GM.PROFILE, this.profile.bind(this))
            .addButton(GM.COOK)
            .addButton(GM.DRINK)
            .addButton(GM.FILL)
            .addButton(GM.REST)
            .addButton(GM.WAKE)
            // for slot
            .addButton(GM.BUY, this.trade.bind(this))
            .addButton(GM.SELL, this.trade.bind(this))
            .addButton(GM.TRANSFER, this.transfer.bind(this))
            .addButton(GM.USE, this.use.bind(this))
            .addButton(GM.DROP, this.drop.bind(this))
            .addButton(GM.SPLIT, this.split.bind(this))
            .addButton(GM.OPENBAG, this.openbag.bind(this))
            .setOrigin(0)
            .layout()
            .hide();

        //scene.add.existing(this);
        //Ui.addLayer(scene, 'UiOption', this);
    }

    get owner() {return this.ent.owner;}
    get target() {return this.ent.owner.target;}

    addButton(key,onclick)
    {
        let btn = new UiButton(this.scene,{type:GM.BTN_TEXT,text:key.lab(),onclick:()=>{
            (onclick??this.act.bind(this))(key);
        }});
            
        this.btns[key] = btn;
        this.add(btn,{expand:true})
        return this;
    }

    use()
    {
        this.close();
        this.owner.use(this.ent);
        this.refreshAll();
    }

    drop()
    {
        this.close();
        this.owner.drop(this.ent);
        this.ent.empty();
        this.refreshAll();
    }

    transfer()
    {
        this.close();
        if(this.owner.transfer(this.target, this.ent))
        {
            this.ent.empty();
            this.refreshAll();
        }
    }

    trade()
    {
        this.close();
        if(this.owner.sell(this.target, this.ent))
        {
            this.ent.empty();
            this.refreshAll();
        }
    }

    observe()
    {
        this.close();
        UiObserve.show(this.ent);
    }

    inv()
    {
        this.close();
        UiInv.show(Role.getPlayer());
    }

    profile()
    {
        this.close();
        UiProfile.show(Role.getPlayer());
    }

    async split()
    {
        this.close();
        console.log('split',this.ent);
        let cnt = await UiCount.getCount(1, this.ent.itm.count-1)
        if(cnt==0) {return;}
        this.owner.split(this.ent,cnt);
        this.refreshAll();
    }

    openbag()
    {
        this.close();        
        UiStorage.show(this.ent, ~GM.CAT_BAG);
        this.ent.setEnable(false);
    }
 
    act(act)
    {
        this.close();
        if(act === GM.ATTACK)
        {
            Role.getPlayer().attack(this.ent);
        }
        else
        {
            Role.getPlayer().setDes({ent:this.ent,act});
        }
    }

    show(x,y,options,ent)
    {
        this.ent = ent;
        super.show();        
        Object.values(this.btns).forEach((btn)=>{btn.hide();})
        options.forEach((opt)=>{
            let [type, en] = opt.split(':');
            this.btns[type].show().setEnable(en !== 'false');
        })
        this.layout().setPosition(x,y).rePos(); // 注意要在 layout 之後再 setPosition，否則會有 offset 的問題
        // close
        UiInfo.close();
        UiCursor.set();
    }

    rePos()
    {
        if(this.right>GM.w) {this.x-=this.right-GM.w;}
        else if(this.left<0) {this.x-=this.left;}
        if(this.bottom>GM.h) {this.y-=this.bottom-GM.h;}
        else if(this.top<0) {this.y-=this.top;}
        return this;
    }

    close() 
    {
        this.hide();
        this.onclose?.();
    }

}

class Observe extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : 300,
            // height : 300,
            orientation : 'y',
            space:{left:10,right:10,bottom:10}
        }

        super(scene,config)

        this.addBg(scene)
            .addTop(scene)
            .addContent(scene)
            .layout()
            .hide()
    }

    label()
    {
        return bbcText(this.scene,{text:this.owner.id.lab()});
    }

    des()
    {
        return bbcText(this.scene,{text:this.owner.id.des(),wrapWidth:250});
    }

    props()
    {
        let props = this.scene.rexUI.add.sizer({orientation:'y'})

        // let life = this.owner.status.states['life'];
        // let value = `${life.cur} / ${life.max}`
        // props.add(this.prop('life', value, false),{expand:true,padding:{left:0,right:0}})

        props.add(this.prop(GM.P_LIFE, this.owner.getState(GM.P_LIFE), false),{expand:true,padding:{left:0,right:0}})

        return props;
    }

    addContent(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'y'})
        sizer.addBackground(rect(scene,{strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
        this.add(sizer,{expand:true,key:'content'})
        return this;
    }

    update()
    {
        let sizer = this.getElement('content');
        sizer.removeAll(true)
            .add(this.label(),{padding:{top:10}})
            .add(divider(this.scene),{expand:true,padding:10})
            .add(this.props(),{expand:true,padding:{left:10,right:10}})
            .add(divider(this.scene),{expand:true,padding:10})
            .add(this.des(),{align:'left',padding:{left:10,bottom:10}})
        this.layout()
        return this;
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
    }
}

export class UiStorage extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x:100,
            y:GM.h-150,
            orientation:'y'
        }

        super(scene, config, 'UiStorage');
        UiStorage.instance = this;

        this.addBg_Int(scene)
            .addTop(scene)
            .addGrid(scene,4,4,this.getOwner.bind(this),{padding:{left:10,right:10,bottom:10}})
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(0,1)
            .layout()
            .hide()
        
    }

    setCat(cat)
    {
        this.cat = cat;
        this.updateGrid();
    }

    close() 
    {
        if(!this.visible) {return;}

        super.close();
        // close/unregister/camera
        UiCover.close();
        this.owner.setEnable?.(true);
        clrCamera(GM.CAM_LEFT_TOP);
        this.unregister();

        delete this.owner.target;
        delete Role.getPlayer().target;
    }

    refresh()
    {
        this.updateGrid();
    }

    show(owner, cat=GM.CAT_ALL)
    {
        super.show();
        this.owner = owner;
        this.owner.target = Role.getPlayer();
        Role.getPlayer().target = this.owner;

        this.setTitle(owner.name);
        this.updateGrid(cat);
        this.layout();
        UiCursor.set();
        
        // show
        UiInv.show(Role.getPlayer());
        // cover/closeAll/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);  
        setCamera(GM.CAM_LEFT_TOP);
    }

    static close() {this.instance?.close();}

    static show(owner,cat) {this.instance?.show(owner,cat);}
}

export class UiInv extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w,
            y : 0,
            width : 0,
            height : 0,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }

        super(scene, config, 'UiInv')
        UiInv.instance = this;

        this.addBg_Int(scene)
            .addTop(scene,{text:'bag'.lab()})
            .addEquip(scene,this.getOwner.bind(this))
            .addGold(scene)
            .addGrid(scene,5,4,this.getOwner.bind(this))
            // 透過參數傳遞 function，方法1,2 都可以，方法3 會有問題
            // 方法 1: ()=>{return this.getContainer();};
            // 方法 2: this.getContainer.bind(this);
            // 方法 3: this.getContainer; // Note:這種寫法會出錯，因為this會指向slot，要改成 this.getContainer.bind(this)
            .setOrigin(1,0)
            .layout()
            .hide()
        
           //.on('pointerout',()=>{!this.isPointerInBounds()&&console.log('out')})
        //this.onClickOutside(()=>{console.log('outside')});
        this._opts = null;
    }

    addEquip(scene, getOwner)
    {
        let config =
        {
            column: 5,
            row: 2,
            space: {column:5,row:5,left:5,right:5,top:5,bottom:5},
        }
        let grid = scene.rexUI.add.gridSizer(config);
        grid.addBackground(rect(scene,{strokeColor:GM.COLOR_GRAY,stroleWidth:2}))
        let equip = function(id, cat, getOwner)
        {
            let slot = new EquipSlot(scene, GM.SLOT_SIZE, GM.SLOT_SIZE, id, getOwner, {cat:cat});
            return slot;
        }
        let i=0;
        grid.add(equip(i++, GM.CAT_WEAPON, getOwner))
            .add(equip(i++, GM.CAT_HELMET, getOwner))
            .add(equip(i++, GM.CAT_CHESTPLATE, getOwner))
            .add(equip(i++, GM.CAT_GLOVES, getOwner))
            .add(equip(i++, GM.CAT_BOOTS, getOwner))
            .add(equip(i++, GM.CAT_NECKLACE, getOwner))
            .add(equip(i++, GM.CAT_RING, getOwner))
            .add(equip(i++, GM.CAT_RING, getOwner))
            .add(equip(i++, GM.CAT_EQUIP|GM.CAT_BAG, getOwner))

        this.add(grid,{key:'equip'});
        return this;
        
    }

    update()
    {
        if(!this.visible) {return;}
        this.updateEquip();
        this.updateGrid();
        this.updateGold();
        this.layout();
    }

    refresh()   // call by Ui.refreshAll()
    {
        this.update();
        if(this._opts){this.filter(this._opts);}
    }

    check(cat)
    {
        this.getElement('equip').getElement('items').forEach(item => {item?.check(cat);});
    }

    close()
    {
        if(!this.visible) {return;}
        this._opts = null;

        super.close();
        // closeAll/unregister/camera
        this.unregister();
        Ui.closeAll(GM.UI_LEFT);
        clrCamera(GM.CAM_LEFT);
        Ui.setMode(GM.UI_MODE_NORMAL);
        UiCover.close();
        UiCursor.set();
    }

    show(owner)
    {
        super.show();
        this.owner = owner;
        this.update();
        // register/camera
        this.register(GM.UI_RIGHT);     
        setCamera(GM.CAM_LEFT);
    }

    toggle(owner)
    {
        if(this.visible) {this.close();}
        else {this.show(owner);}
    }


    condition(opts, slot)
    {
        for(let opt of opts)
        {
            let p = slot.p(opt.type);
            let value = opt.value.startsWith('.') ? slot.p(opt.type+opt.value) : opt.value;
            // let value = opt.value.startsWith('$') ? slot.p(opt.type, opt.value.slice(1)) : opt.value;
            // let value = opt.value == 'max' ? slot.get(opt.type, 'max') : opt.value;
            let rst; 
            switch(opt.op)
            {
                case '==': rst = p == value; break;
                case '!=': rst = p != value; break;
                case '>=': rst = p >= value; break;
                case '<=': rst = p <= value; break;
                case '>': rst = p > value; break;
                case '<': rst = p < value; break;
                default: rst = false;
            }
            if(!rst) {return false;}
        }
        return true;
    }


    filter(opts)
    {
        this._opts = opts;
        this.getElement('equip').getElement('items').forEach((slot) => {
            slot?.setEnable( this.condition(opts,slot) );
        });

        this.getElement('grid').getElement('items').forEach((slot) => {
            slot.setEnable( this.condition(opts,slot) );
        }); 

    }

    unfilter()
    {
        this._opts = null;
        this.getElement('equip').getElement('items').forEach((slot) => {
            slot?.setEnable(true);
        });
        this.getElement('grid').getElement('items').forEach((slot) => {
            slot.setEnable(true);
        });
    }   

    static close() {UiInv.instance?.close();}
    static show(owner) {UiInv.instance?.show(owner);}
    static updateGold() {UiInv.instance?.updateGold();}
    // static refresh() {UiInv.instance?.update();}
    static toggle(owner) {UiInv.instance?.toggle(owner);}
    static check(cat) {UiInv.instance?.check(cat);}
    static filter(opts) {UiInv.instance?.filter(opts);}
    static unfilter() {UiInv.instance?.unfilter();}
    
}

export class UiOption extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene, 'UiOption');
        UiOption.instance = this;
        this.add(new Option(scene))
            .close() 
    }

    static show(x,y,acts,target) {UiOption.instance?.show(x,y,acts,target);}

}

class UiObserve extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene, 'UiObserve', false);
        UiObserve.instance = this;
        this.add(new Observe(scene))
            .close()
    }

    destroy(args)
    {
        console.log('-------------destroy', args)
        super.destroy(args)
        
    }

    static show(owner) {this.instance?.show(owner);}
}

class UiCount extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene,'UiCount',false);
        UiCount.instance = this;
        this.add(new Count(scene))
            .close()
    }

    // static show(owner) {this.instance?.show(owner);}
    static getCount(min,max) {return this.instance.show(min,max);}
}

export class UiMain extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config = {space:{item:10,left:10,right:10,top:10,bottom:10}}
        super(scene, config, 'UiMain');
        UiMain.instance = this;

        this.addBg_Int(scene)
            .add(new UiButton(scene,{text:'🎒',key:'inv',onclick:this.inv,onover:this.onover,onout:this.onout}),{align:'bottom'})
            .add(new UiButton(scene,{text:'👤',key:'profile',onclick:this.profile,onover:this.onover,onout:this.onout}),{align:'bottom'})
            .add(new UiButton(scene,{text:'📖',key:'quest',onclick:this.test.bind(this),onover:this.onover,onout:this.onout}),{align:'bottom'})
            .add(new UiButton(scene,{text:'🧠',key:'skill',onclick:this.skill,onover:this.onover,onout:this.onout}),{align:'bottom'})
            .addCtrl(scene)
            .add(new UiButton(scene,{text:'⏳',key:'next',onclick:this.next,onover:this.onover,onout:this.onout}),{align:'bottom'})
            .add(new UiButton(scene,{text:'⚙️',key:'exit',onclick:this.menu.bind(this),onover:this.onover,onout:this.onout}),{align:'bottom'})
            .add(new UiButton(scene,{text:'🐛',key:'debug',onclick:this.debug,onover:this.onover,onout:this.onout}),{align:'bottom'})
            .addEnable(scene)
            .size()
            .hide();
        
        this.addListener();
    }

    addCtrl(scene)
    {
        let config_root = {
            width:400,
            height:60,
            orientation:'y',
            space:{item:5}
        }

        let config_top = {orientation:'x'}

        let config_slots = {orientation:'x',space:{item:5}}

        let root = scene.rexUI.add.sizer(config_root);
        root.addBackground(rect(scene,{color:GM.COLOR_GRAY}));

        let top =  scene.rexUI.add.sizer(config_top);
        top.add(progress_text(scene,{width:200}),{key:'hp'})

        let slots =  scene.rexUI.add.sizer(config_slots);
        root.add(top,{align:'left',key:'top'});

        for(let i=0; i<10; i++)
        {
            slots.add(new SkillSlot(scene,50,50,i,{color:GM.COLOR_SLOT}));
        }

        this.resetSkill = () => {
            slots.children.forEach((slot) => {
                if(slot instanceof SkillSlot) {slot.reset();}
            });
        }

        this.updateSkill = () => {
            slots.children.forEach((slot) => {
                if(slot instanceof SkillSlot) {slot.update();}
            });
        }

        root.add(slots,{align:'left',key:'slots'});

        this.add(root,{key:'root'});
        return this;    
    }

    onover(btn)
    {
        Ui.delayCall(()=>{UiInfo.show(GM.TP_BTN,btn);})
    }

    onout()
    {
        Ui.cancelDelayCall();
        UiInfo.close();
    }


    addEnable(scene)
    {
        this.addBackground(rect(scene,{alpha:0}),'enable');
        this._enable = this.getElement('enable');
        return this;
    }

    enable(en)
    {
        if(en){this._enable.disableInteractive();}
        else{this._enable.setInteractive();}
    }

    inv() {UiInv.toggle(Role.getPlayer());}     // function內沒有用到 this 參數，就不需要 bind(this)

    profile() {UiProfile.toggle(Role.getPlayer());}

    menu() {this.close();send('menu');} // function有用到 this 參數，需要 bind(this)

    next()
    {
        Role.getPlayer().next();
    }

    test()
    {
        //this.closeAll(GM.UI_ALL);
        UiQuest.toggle(Role.getPlayer());
    }

    skill()
    {
        UiSkill.toggle();
    }

    debug() {UiDebuger.show();}

    addListener()
    {
        this.setInteractive();
        this.on('pointerover',()=>{mark(false);})
            .on('pointerout',()=>{mark(true);})
    }

    size()
    {
        let viewport = this.scene.rexUI.viewport;
        this.setPosition(viewport.width/2, viewport.height)
            .setOrigin(0.5,1)
            .setMinWidth(viewport.width-100)
            //.setMinSize(viewport.width-100, 80)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000);
        return this;
    }

    close() 
    {
        super.close();
        this.unregister();   
    }

    refresh()
    {
        let player = Role.getPlayer();
        let hp = this.getElement('hp',true);
        let life = player.getState('life');
        hp.set(life.cur,life.max);
        // hp.set(player.states.life.cur,player.states.life.max);
        // this.resetSkill();
        this.updateSkill();
    }

    show()
    {
        super.show();
        this.register(GM.UI_BOTTOM);
    }

    static show() {this.instance?.show();}

    static close() {this.instance?.close(true);}

    static enable(en) {this.instance?.enable(en);} 

}

export class UiCursor extends Phaser.GameObjects.Sprite
{
    static icons = {
        // none :  {sprite:'cursors/cursor_none', origin:{x:0.25,y:0}, scale:1},
        // aim :   {sprite:'cursors/target_b', origin:{x:0.5,y:0.5}, scale:0.7},
        // attack :  {sprite:'cursors/tool_sword_b', origin:{x:0.5,y:0.5}, scale:0.7},
        // pickup :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
        // talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
        // enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
        // exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
        // open :  {sprite:'cursors/gauntlet_open', origin:{x:0.5,y:0.5}, scale:1},
        // tool :  {sprite:'cursors/tool_wrench', origin:{x:0.5,y:0.5}, scale:1},

        none :  {sprite:GM.ICON_NONE, origin:{x:0.25,y:0}, scale:1},
        aim :   {sprite:GM.ICON_AIM, origin:{x:0.5,y:0.5}, scale:1},
        attack :  {sprite:GM.ICON_ATTACK, origin:{x:0.5,y:0.5}, scale:0.7},
        take :  {sprite:GM.ICON_PICKUP, origin:{x:0.5,y:0.5}, scale:0.7},
        talk :  {sprite:GM.ICON_TALK, origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:GM.ICON_ENTER, origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:GM.ICON_EXIT, origin:{x:0.5,y:0.5}, scale:1},
        open :  {sprite:GM.ICON_OPEN, origin:{x:0.5,y:0.5}, scale:1},
        cook :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        drink :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        open_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
        close_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
    }

    static instance = null;

    constructor(scene)
    {
        super(scene);
        UiCursor.instance = this;
        this.scene = scene;
        scene.add.existing(this);
        this.setDepth(Infinity);
        this.setIcon('none');
    }

    preUpdate(time, delta)
    {
        //console.log(this.scene.input.x,this.scene.input.y);
        this.setPosition(this.scene.input.x, this.scene.input.y);
    }

    setIcon(type)
    {
        let icon = UiCursor.icons[type] ?? UiCursor.icons.none;
        let [key,frame]=icon.sprite.split('/')
        this.setTexture(key,frame);
        this.setOrigin(icon.origin.x,icon.origin.y);
        this.setScale(icon.scale);
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.setDepth(10000);
            this._dbgGraphics.name = 'cursor';
        }

        //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics//.strokeRectShape(rect)
                        .strokeCircleShape(circle);
    }

    setPos(x,y)
    {
        this.setPosition(x,y);
        this.debugDraw();
    }

    static pos(x,y)
    {
        if(this.instance) {this.instance.setPos(x,y);}
    }

    static set(type)
    {
        if(this.instance) {this.instance.setIcon(type);}
    }

}

export class UiTrade extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : 0,
            height : 0,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, 'UiTrade');
        UiTrade.instance = this;    

        this.addBg(scene)    
            .addTop(scene,{text:'trade'.lab()})
            .addInfo(scene)
            .addGold(scene)
            .addGrid(scene,5,6,this.getOwner.bind(this))
            .setOrigin(0)
            .layout()
            .hide()
    }


    addInfo(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
            .add(new Pic(scene,GM.PORTRAITS_W,GM.PORTRAITS_H,{icon:'portraits/0'}),{padding:10, key:'icon'})
            .add(bbcText(scene,{text:'阿凡達\n精靈'}),{align:'top',padding:{top:10},key:'name'})
        this.add(sizer,{expand:true,key:'descript'})
        return this;
    }

    update()
    {
        this.updateInfo();
        this.updateGrid();
        this.updateGold();
        this.layout();
    }

    updateInfo()
    {
        this.getElement('icon',true).setIcon(this.owner.role.icon);
        this.getElement('name',true).setText(`${this.owner.id.lab()}\n${this.owner.role.job?.lab()}`);
    }

    refresh()
    {
        this.update();
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        // close/camera/unregister
        UiCover.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();

        delete this.owner.trade;
        delete this.owner.target;
        delete Role.getPlayer().trade;
        delete Role.getPlayer().target;
    }

    show(owner)
    {
        super.show();
        owner.restock();
        this.owner = owner;
        this.owner.trade = GM.SELLER;
        this.owner.target = Role.getPlayer();
        Role.getPlayer().trade = GM.BUYER;
        Role.getPlayer().target = this.owner;

        this.update();
        // show
        UiInv.show(Role.getPlayer());
        // cover/closeAll/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);    
        setCamera(GM.CAM_RIGHT);         
    }

    static show(owner) {this.instance?.show(owner);}
    static close() {this.instance?.close();}
    static updateGold() {this.instance?.updateGold();}

}

export class UiProfile extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : 450,
            height : 0,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, 'UiProfile');
        UiProfile.instance = this; 

        this.addBg_Int(scene)    
            .addTop(scene,{text:'profile'.lab()})
            .addInfo(scene)
            .addTab(scene)
            .addPage(scene,'attrs')
            .addPage(scene,'states')
            .setOrigin(0)
            .layout()
            .hide()
        
          
    }

    addInfo(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
            .add(new Pic(scene,GM.PORTRAITS_W,GM.PORTRAITS_H,{icon:'portraits/0'}),{padding:10, key:'icon'})
            .add(bbcText(scene,{text:'阿凡達\n精靈'}),{align:'top',padding:{top:10},key:'name'})
        this.add(sizer,{expand:true,key:'info'});
        return this;
    }

    updateInfo()
    {
        let [key,frame]=this.owner.role.icon.split('/');
        this.getElement('icon',true).getElement('sprite')?.setTexture(key,frame);
        this.getElement('name',true).setText(`${this.owner.id.lab()}\n${this.owner.role.job?.lab()}`);
    }

    // addTabPages(scene)
    // {
    //     let config = {
    //         background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 0, GM.COLOR_GRAY),
    //         tabs: {space: { item: 10 }},
    //         //pages: {fadeIn: 300},
    //         align: {tabs: 'left'},
    //         space: { left: 5, right: 5, top: 5, bottom: 5, item: 10 }
    //     }

    //     let tabPages = scene.rexUI.add.tabPages(config); 

    //     tabPages
    //         .addPage({
    //             key: 'page0',
    //             tab: text(scene,{text:'page0'}),
    //             page: text(scene,{text:'page0'})
    //         })
    //         .addPage({
    //             key: 'page1',
    //             tab: text(scene,{text:'page1'}),
    //             page: text(scene,{text:'page1'})
    //         })
    //         .on('tab.focus', function (tab, key) {
    //             //console.log(tab,key)
    //             console.log('focus',key)
    //             tab.setColor('#ff0000');
    //         })
    //         .on('tab.blur', function (tab, key) {
    //             //console.log(tab,key)
    //             console.log('blur',key)
    //             tab.setColor('#ffffff');
    //         })

    //     this.add(tabPages,{expand:true,padding:{left:10,right:10}});
    //     return this;
    // }

    addTab(scene)
    {
        let button_pre;
        let config = {
            background: rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
            topButtons:[
                        label(scene,{text:'🎴',color:GM.COLOR_PRIMARY,key:'attrs',space:{left:20,right:20,top:5,bottom:5}}),
                        label(scene,{text:'❤️',color:GM.COLOR_PRIMARY,key:'states',space:{left:20,right:20,top:5,bottom:5}}),
                    ],

            space: {left:5, top:5, bottom:5, topButton:1}
        }

        let tabs = scene.rexUI.add.tabs(config); 

        tabs.on('button.click', (button, groupName, index)=>{
                UiInfo.close();
                if(button_pre) 
                {
                    button_pre.getElement('background').setFillStyle(GM.COLOR_PRIMARY);
                    this.getElement(button_pre.key)?.hide();
                }
                button_pre = button;
                button.getElement('background').setFillStyle(GM.COLOR_LIGHT);
                this.getElement(button.key)?.show();
                this.layout();
            })

        tabs.on('button.over', (button, groupName, index)=>{
            Ui.delayCall(()=>{UiInfo.show(GM.TP_BTN, button)})
        })

        tabs.on('button.out', (button, groupName, index)=>{
            Ui.cancelDelayCall();
            UiInfo.close();
        })

        this.add(tabs,{expand:true,key:'tags'});
        return this;
    }

    addPage(scene, key)
    {
        let config = {
            //width: 400,
            height: 220,
            background: rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
            panel: {
                child: scene.rexUI.add.sizer({orientation:'y',space:5}),
            },
        }
        let panel = scene.rexUI.add.scrollablePanel(config);
        this.add(panel,{expand:true,key:key});
        panel.hide();
        return this;
    }

    // updatePage(cat)
    // {
    //     let panel = this.getElement(cat);
    //     let childPanel = panel.getElement('panel');

    //     childPanel.removeAll(true);

    //     console.log(this.owner.status);
    //     for(let [key,value] of Object.entries(this.owner.status[cat]))
    //     {
    //         switch(key)
    //         {
    //             case GM.P_LIFE: value = `${value.cur} / ${value.max}`; break;
    //             case GM.P_HUNGER: value = `${Math.floor(value.cur)}%`; break;
    //             case GM.P_THIRST: value = `${Math.floor(value.cur)}%`; break;
    //         }

    //         childPanel.add(this.prop(key,value),{expand:true,padding:{left:5,right:5}})
    //     }

    //     return this;
    // }


    updatePage(cat)
    {
        let panel = this.getElement(cat);
        let childPanel = panel.getElement('panel');

        childPanel.removeAll(true);

        if(cat === 'states')
        {
            let keys=['life','hunger','thirst']
            keys.forEach(key=>{
                childPanel.add(this.prop(key,this.owner.getState(key)),{expand:true,padding:{left:5,right:5}})
            })

            
        }
        else if(cat === 'attrs')
        {
            let keys=['attack','defense']
            keys.forEach(key=>{
                childPanel.add(this.prop(key,this.owner.getAttr(key)),{expand:true,padding:{left:5,right:5}})
            })
        }

        return this;
    }


    update()
    {
        if(this.visible)
        {
            //console.log('update');
            this.updatePage('attrs')
                .updatePage('states')
                .layout();
        }
    }

    refresh() {this.update();}  // call by Ui.refreshAll()

    show(owner)
    {
        this.owner = owner;
        super.show();
        this.updateInfo();
        this.update();
        this.getElement('tags').emitTopButtonClick(0);
        // closeAll/register/camera
        Ui.closeAll(GM.UI_LEFT);
        this.register(GM.UI_LEFT_P);
        setCamera(GM.CAM_RIGHT);
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();
    }

    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner) {this.instance?.show(owner);}
    static close() {this.instance?.close();}
    // static refresh() {UiProfile.instance?.update();}
    static toggle(owner) {this.instance?.toggle(owner);}
    static get shown() {this.instance?.visible;}
}

export class UiDialog extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h,
            width : 600,
            //height : 300,
            orientation : 'y',
            //space:{bottom:20},
        }

        super(scene, config, 'UiDialog');
        UiDialog.instance=this;

        this//.addBackground(rect(scene,{color:GM.COLOR_DARK,strokeColor:0x777777,strokeWidth:3}),'bg')
            .addBg(scene)
            .addSpeakerA(scene)
            .addSpeakerB(scene)
            .setOrigin(0.5,1)
            .layout()
            .hide()

        let iconA = this.getElement('iconA',true);
        let iconB = this.getElement('iconB',true);
        let nameA = this.getElement('nameA',true);
        let textA = this.getElement('textA',true);
        let textB = this.getElement('textB',true).getElement('panel');

        //let typing = scene.plugins.get('rexTextTyping').add(txt,{speed:50,wrap:true});
        const lineCnt=3;
        let page = scene.plugins.get('rexTextPage').add(textA,{maxLines:lineCnt});
 
        this.setIconA = (icon)=>{iconA.setIcon(icon);return this;}
        this.setNameA = (name)=>{nameA.setText(`[color=yellow]${name}[/color]`);return this;}
        this.setTextA = (text)=>{page.setText(text);return this;}

        this.setIconB = (icon)=>{iconB.setIcon(icon);return this;}
        this.setTextB = (options)=>{
            textB.removeAll(true);
            options.forEach((option)=>{
                textB.add(this.createOption(option),{align:'left',expand:true})
            })
            this.layout();
            return this;
        }

        this.nextPage = ()=>{
            let np = page.getNextPage();
            textA.setText(np);
            //console.log(page.pageCount,page.pageIndex)
            if (page.isLastPage) {this.setTextB(this.dialog[this.id].B);} 
            else {this.setTextB(['*聆聽...*/next']);}
        }
    }

    addSpeakerA(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_LIGHT}),'bg')
            .add(new Pic(scene,GM.PORTRAITS_W,GM.PORTRAITS_H,{icon:'portraits/0'}),{padding:{left:10,top:10,bottom:50,right:10},key:'iconA'})
            .add(this.createSub(scene),{align:'top',padding:{top:10},key:'sub'});
        this.add(sizer,{expand:true,padding:{left:10,right:10,top:10},key:'speakerA'});
        return this;
    }

    createSub(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'y'});
        sizer.add(bbcText(scene,{text:'[color=yellow]阿凡達[/color]'}),{align:'left',key:'nameA'})
            .add(bbcText(scene,{text:'說明',wrapWidth:500}),{align:'left',key:'textA'})
        return sizer;
    }
    

    addSpeakerB(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer.addBackground(rect(scene,{color:GM.COLOR_DARK}),'bg')
            .add(new Pic(scene,GM.PORTRAITS_W,GM.PORTRAITS_H,{icon:'portraits/1'}),{padding:{left:10,top:10,bottom:50,right:10},key:'iconB'})
            .add(this.createTextB(),{padding:{top:10},expand:true,align:'top',proportion:1,key:'textB'})
        this.add(sizer,{expand:true,padding:{left:10,right:10,bottom:10},key:'speakerB'});
        return this;
    }

    createTextB()
    {
        let scene = this.scene;
        let scroll = scene.rexUI.add.scrollablePanel({
            //background:rect(scene),
            panel: {child:scene.rexUI.add.sizer({orientation:'y'})},
            mouseWheelScroller: {focus:false,speed:0.1},
            slider: {
                // track: scene.rexUI.add.roundRectangle(0, 0, 20, 10, 10, GM.COLOR_DARK),
                // thumb: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 13, GM.COLOR_LIGHT),
                track: rect(scene,{width:20,color:GM.COLOR_PRIMARY}),
                thumb: rect(scene,{radius:13,color:GM.COLOR_LIGHT}),
                hideUnscrollableSlider: true,
            },
        })
        return scroll;
    }

    createOption(option)
    {
        let [text,args] = option.split('/').map(s => s.trim());
        let scene = this.scene;
        let sizer = scene.rexUI.add.sizer();
        sizer.addBackground(rect(scene,{color:GM.COLOR_GRAY}),'bg')
            .add(bbcText(scene,{text:text}),{align:'left'})
        let bg = sizer.getElement('bg').setAlpha(0);
        if(args)
        {
            sizer.setInteractive()
                .on('pointerover',()=>{bg.setAlpha(1);})
                .on('pointerout',()=>{bg.setAlpha(0);})
                .on('pointerdown',()=>{this.execute(args);})
        }
        return sizer;
    }

    execute(args)
    {
        let cmds = args.split(';').map(s => s.trim());
        cmds.forEach(cmd=>{
            let [op,p1,p2]=cmd.split(' ');
            switch(op)
            {
                case 'next': this.nextPage(); break;
                case 'exit': this.close(); break;
                case 'trade': this.trade(); break;
                case 'goto': this.goto(p1); break;
                case 'quest': this.quest(p1); break;
                case 'close': this.close_quest(p1); break;
                case 'set': this.set(p1,p2)
            }
        })
       
    }

    trade()
    {
        this.close();
        UiTrade.show(this.owner); 
    }

    goto(p1)
    {
        let m = p1.match(/\[([^\]]+)\]/);   //取出[]內的字串
        if(m)
        {
            let [p,val] = m[1].split('=');
            if(this.owner.status[p])
            {
                if(p=='quest')
                {
                    let q = QuestManager.query(this.owner.status[p]);
                    if(q)
                    {
                        this.id = this.owner.status[p]+'_'+q.state();
                    }
                    else
                    {
                        this.id = this.owner.status[p];
                    }
                }
            }
            else
            {
                this.id = val;
            }
        }
        else
        {
            this.id=p1;
        }

        this.setTextA(this.dialog[this.id].A)
            .nextPage();
    }

    set(key, value)
    {
        this.owner.status[key]=value;
    }

    quest(p1)
    {
        this.close();
        console.log('quest',p1)
        QuestManager.add(p1);
        // this.owner.status['quest']=p1;
        this.set('quest', p1);
    }

    close_quest(p1)
    {
        console.log('quest',p1)
        QuestManager.close(p1);
    }

    close()
    {
        super.close(); 
        UiCover.close();
        UiMain.show();
    }

    show(owner)
    {
        console.log(owner)
        this.owner = owner;
        this.dialog = owner.dialog;
        console.log(this.dialog)
        this.id = 0;
        super.show();
        this.setIconA(owner.role.icon)
            .setNameA(owner.id.lab())
            .setIconB(Role.getPlayer().role.icon)
            .setTextA(this.dialog[this.id].A)
            .nextPage();
        // show
        UiCover.show();
        UiCursor.set();
        // close
        this.closeAll(~GM.UI_MSG);
    }

    static show(owner) {if(this.instance) {this.instance.show(owner);}}

}

export class UiChangeScene extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            width : GM.w,
            height : GM.h,
            //orientation : 'x',
            //space:{left:10},
        }

        super(scene, config, 'UiChangeScene');
        UiChangeScene.instance = this;

        this.addBg_Int(scene,{color:GM.COLOR_BLACK,alpha:1})
            .setOrigin(0)
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()
    }

    start(gotoScene, duration=GM.T_CHANGE_SCENE)
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0,to:1},
            duration: duration,
            onComplete: ()=>{gotoScene();this._t = this.scene.time.now;}
        })
    }

    done()
    {
        console.log('t(change scene) =',this.scene.time.now-this._t);
        this.close();
    }

    static done() {this.instance?.done();}
    static start(changeScene) {this.instance?.start(changeScene);}

}

export class UiMessage extends ContainerLite
{
    static instance = null;
    constructor(scene)
    {
        super(scene);
        Ui.addLayer(scene, 'UiMessage', this);
        UiMessage.instance = this;
        this.scene = scene;

        let config =
        {
            x: 10,
            y: GM.h-80,
            width: 200,
            height: 500,
        }

        this.addMask(scene, config)
            .addPanel(scene, config)
            .visible = false;

        this.originY = config.y;
        this.queue = [];
        this.processing = false;

        //this.UnitTest();
    }

    UnitTest()
    {
        this.push('test-1111111111111111111111')
            .push('test-2')
            .push('test-3')
            .push('test-4')
            .push('test-5')
            .push('test-6')
            .push('test-7')
            .push('test-8')
    }

    addMask(scene, config)
    {
        config.alpha=0.5;
        const maskRect = rect(scene,config).setVisible(false);
        maskRect.setOrigin(0,1);
        const mask = maskRect.createGeometryMask();
        this.add(maskRect)
        this.setMask(mask);
        return this;
    }

    addPanel(scene, config)
    {
        this.panel = scene.rexUI.add.sizer({x:config.x,y:config.y,orientation:'y'});
        this.panel.setOrigin(0,1);
        this.add(this.panel);
        return this;
    }

    delayAlpha(delay=3000)
    {
        this.setAlpha(1);
        if (this._interval) {clearTimeout(this._interval);}
        this._interval = setTimeout(() => {this.setAlpha(0.5);}, delay); 
    }

    processNext(msgCnt=5) 
    {
        let msgs = this.panel.getElement('items')
        if(msgs.length > msgCnt)
        {
            this.panel.remove(msgs[0],true);
            this.panel.layout();
        }

        if (this.queue.length === 0) 
        {
            this.processing = false;
            return;
        }

        this.processing = true;
        let msg = this.queue.shift();
        
        this.process(msg);
    }


    process(msg,{wrapWidth=200,duration=250,completeDelay=100}={}) 
    {
        this.delayAlpha();

        let hTmp = this.panel.height;
        this.panel.add(bbcText(this.scene, {text:msg, wrapWidth:wrapWidth}),{align:'left'})
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)

        let from = this.originY + this.panel.height - hTmp;
        let to = this.originY;
        this.panel.y = from;
        
        this.scene.tweens.addCounter({
            from: from,
            to: to,
            duration: duration,
            completeDelay: completeDelay,
            onUpdate: (tween) => {this.panel.y = tween.getValue();},
            onComplete: () => {this.processNext();}
        });
    }

    push(msg) 
    {
        if(!this.visible) {this.show();}
        this.queue.push(msg);
        if (!this.processing) {this.processNext();}

        return this;
    }

    clean()
    {
        this.queue = [];
        this.panel.removeAll(true).layout();
    }

    close() 
    {
        this.visible = false;
        Ui.unregister(this);   
    }

    show()
    {
        this.visible = true;
        Ui.register(this,GM.UI_MSG);
    }

    static clean() {this.instance?.clean();}
    static push(msg) {return this.instance?.push(msg);}
}


export class UiGameOver extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : GM.w,
            height : GM.h,
            orientation: 'x'
        }

        super(scene, config, 'UiGameOver')
        this.scene=scene;
        UiGameOver.instance=this;
        this.addBg(scene,{color:GM.COLOR_BLACK,alpha:0.5})
            .addSpace()
            .add(text(scene,{text:'遊 戲 結 束',fontSize:64}),{align:'bottom',padding:{bottom:GM.h/4}})
            .addSpace()
            .layout()//.drawBounds(this.scene.add.graphics(), 0xff0000)
            .addLisitener()
            .close()
    }

    addLisitener()
    {
        this.setInteractive()
            .on('pointerdown',()=>{this.close(); send('menu');})
        return this;
    }

    show()
    {
        super.show();
        this.scene.tweens.add({
            targets: this,
            alpha: {from:0, to:1},
            duration: 1000,
        })
    }

    static show() {UiGameOver.instance?.show();}

}



class UiDebuger extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            orientation: 'y',
            space:{top:10,bottom:10,left:10,right:10,item:10},
        }

        super(scene, config, 'UiDebuger')
        UiDebuger.instance=this;
        this.scene=scene;
        this.addBg_Int(scene)
            .addTop(scene, {text:'除錯器'})
            .addTextArea(scene)
            .addInput(scene)
            .layout()
            .close()
    }

    addTextArea(scene)
    {
        this.area =  scene.rexUI.add.textArea({
            width: GM.w/2,
            height: GM.h/4,
            background: rect(scene,{color:GM.COLOR_LIGHT}),
            text: bbcText(scene),
            //content: '123\n456\n789\n1111\n777\n888\n999\n111'
        })
        this.add(this.area)
        return this;
    }

    addInput(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});

        let label = scene.rexUI.add.label({
            orientation: 'x',
            background: rect(scene, {color:GM.COLOR_LIGHT}),
            text: bbcText(scene, {fixedWidth:GM.w/2-100, fixedHeight:36, valign:'center'}),
            space: {top:5,bottom:5,left:5,right:5,icon: 10}
        })
        .setInteractive()
        .on('pointerdown', function () {
            var config = {
                enterClose: false,
                onTextChanged: (textObject, text) =>{textObject.text=text;}
            }
            scene.rexUI.edit(label.getElement('text'), config);
        });

        let btn = new UiButton(scene,{text:'送出',onclick:()=>{
            let cmd = label.getElement('text').text;
            label.getElement('text').text='';
            this.process(cmd);

        }})
    
        sizer.add(label)
            .addSpace()
            .add(btn)
        this.add(sizer,{expand:true})

        return this;
    }

    process(cmd)
    {
        console.log('cmd =',cmd)
        let args = cmd.split(' ');
        let func = eval(`this.cmd_${args[0]}`);
        if(func) {func.bind(this)(args);}
        else {this.print(cmd+'  [color=yellow][無效指令!!!][/color]\n')}
    }

    print(str)
    {
        this.area.appendText(str);
        this.area.scrollToBottom();
    }

    cmd_clr(args) 
    {
        //console.log(args)
        this.area.setText('');
    }

    cmd_get(args)
    {
        // [get] [gold/item] [id] [count]
        let rewards=[{type:args[1],id:args[2],count:args[3]}]
        Role.getPlayer().receive(rewards)
    }

    cmd_w(args)
    {
        if(args.length < 4)
        {
            this.print('[color=yellow][參數太少][/color]\n')
        }
        else
        {
            let p={x:Number(args[1]),y:Number(args[2])}
            let weight=Number(args[3])
            send('setWeight',p,weight)
        }
    }

    cmd_t(args)
    {
        //console.log(args);
        if(args.length == 1)
        {
            let t = TimeManager.time;
            let str = `d:${t.d} h:${t.h} m:${t.m}\n`;
            this.print(str)
        }
        else
        {
            for(let i=1;i<args.length;i++)
            {
                let [type,val]=args[i].split(':');
                console.log(type,val);
                TimeManager.set(type,val)
            }
            TimeManager.update();
            this.close();
        }

    }

    static show() {UiDebuger.instance?.show();}
}

export class UiTime extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w-60,
            y : GM.h-70,
            orientation: 'y',
            // space:{top:10,bottom:10,left:10,right:10,item:10},
        }

        super(scene, config ,'UiTime')
        UiTime.instance=this;
        this.scene=scene;
        this.addBg(scene)
            .addTime(scene)
            .setOrigin(1,1)
            .layout()
    }

    addTime(scene)
    {
        this.time = text(scene,{text:'D1 10:01'});
        this.add(this.time)
        return this;
    }

    static updateTime(dt,time)
    {
        let h = String(time.h).padStart(2, '0');
        let m = String(time.m).padStart(2, '0');
        this.instance.time.setText(`D${time.d} ${h}:${m}`);
    }
}

export class UiManufacture extends UiBase
{
    static instance=null;
    constructor(scene)
    {
        let config =
        {
            x : 0,
            y : 0,
            height : 500,
            orientation : 'y',
            space : 0,
        }

        super(scene, config, 'UiManufacture')
        UiManufacture.instance=this;
        this.scene=scene;
        this.addBg_Int(scene)
            .addTop(scene,{text:'make'.lab()})
            .addMain(scene)
            .setOrigin(0)
            .layout()
            .hide()
    }

    addMain(scene)
    {
        let config = 
        {
            height:600,
            orientation:'x',
        }

        let main = scene.rexUI.add.sizer(config);
        main.addMenu = this.addMenu;
        main.addProduce = this.addProduce;
        main.addGrid = this.addGrid;
        main.getOwner = this.getOwner.bind(this);
        main.addScroll = this.addScroll;
        main.check = this.check.bind(this);
        main.make = this.make.bind(this);
        main.addBackground(rect(scene))
            .addMenu(scene)
            .addProduce(scene)
        this.add(main, {padding:{left:10,right:10,bottom:10},expand:true,key:'main'});
        return this;
    }

    addMenu(scene)
    {
        this.addScroll(scene,{width:100})
        return this;
    }

    addProduce(scene)
    {
        let config = {
          width: 300,
          orientation:'y',
        }

        let produce = scene.rexUI.add.sizer(config);
        produce.addGrid = this.addGrid;
        produce.addBackground( rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}) )
                .addGrid(scene, 3, 3, this.getOwner, {padding:{top:10},classT:MatSlot,classC:{onset:this.check}})
                .addSpace()
                .add(new OutputSlot(scene,GM.SLOT_SIZE,GM.SLOT_SIZE,this.getOwner),{key:'output'})
                .addSpace()
                .add(new UiButton(scene,{text:'make'.lab(),onclick:this.make}),{key:'button'})
                .addSpace()
        this.add( produce, {expand:true, key:'produce'} );
        return this;
    }

    check()
    {
        let on = this.owner.check();
        this.getElement('button',true).setEnable(on);
    }

    make()
    {
        this.owner.make();
        this.updateGrid(this.owner.cat);
        this.getElement('output',true).update();
        this.check();
    }

    update()
    {
        let itemSel = null;
        let onover = (item)=>{UiInfo.show(GM.TP_SLOT, item);}
        let onout = ()=>{UiInfo.close();}  
        let ondown = (item)=>{
                if(!this.owner.isFull)
                {
                    itemSel?.unsel();
                    itemSel=item;
                    item.sel();
                    this.owner.sel=item.itm.id;
                    this.getElement('output',true).update();
                    this.check();
                }
            }

        let panel = this.getElement('panel',true);
        panel.removeAll(true);
        this.owner.menu.forEach((id)=>{
            let add = this.item(id.lab(),{onover:onover, onout:onout, ondown:ondown});
            add.itm = {id:id,type:'make'};
            add.dat = DB.item(id)??{};
            if(id==this.owner.sel) {add.sel();itemSel=add;}
            panel.add(add,{expand:true})
        })
        this.layout();
        this.check();

        this.updateGrid(this.owner.cat);
        this.getElement('output',true).update();
    }

    close() 
    {
        super.close();
        UiCover.close();
        clrCamera(GM.CAM_RIGHT);
        this.unregister();
    }


    show(owner)
    {
        this.owner = owner;
        super.show();
        this.update();
        UiCursor.set();

        UiInv.show(Role.getPlayer());
        
        // cover/close/register/camera
        UiCover.show();
        Ui.closeAll(GM.UI_LEFT_P);
        this.register(GM.UI_LEFT);  
        setCamera(GM.CAM_RIGHT);

    }

    static show(owner) {this.instance.show(owner);}
}


class Count extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 300,
            height : 100,
            orientation : 'y',
            space : 0,
        }

        super(scene, config)
        this.scene=scene;
        this.addBg_Int(scene)
            .addSlider(scene)
            .addButtons(scene)
            .layout()
            //.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()
    }

    addSlider(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        let lab = label(scene,{width:50});
        let bar = slider(scene);
        bar.on('valuechange', (value) => {
            this._val = Math.round(this._min+value*(this._max-this._min));
            lab.setText(this._val)
            lab.layout();
        })
        sizer.add(lab)
        sizer.add(bar,{proportion:1,padding:{left:10},key:'bar'});
        this.add(sizer,{expand:true,padding:{left:10,right:10,top:20,bottom:20},key:'slider'});
        return this;
    }

    addButtons(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer
            .add(new UiButton(scene,{text:'❌',onclick:this.cancel.bind(this),radius:5,padding:5}))
            .addSpace()
            .add(new UiButton(scene,{text:'✔️',onclick:this.confirm.bind(this),radius:5,padding:5}))
        this.add(sizer,{expand:true,padding:{left:10,right:10,bottom:20}});
        return this;
    }

    confirm()
    {
        this._resolve(this._val);
        this.close();
    }

    cancel()
    {
        this._resolve(0);
        this.close();
    }

    show(min,max)
    {
        console.log('getCount',min,max)
        super.show();
        this._min = min;
        this._max = max;
        this.getElement('bar',true).setGap(1,min,max);
        this.getElement('bar',true).setValue(1);
        this.getElement('bar',true).setValue(0);

        return new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    
}

export class Confirm extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 250,
            orientation : 'y',
            space : {left:10,right:10,bottom:10,top:20,item:20},
        }

        super(scene,config)
        this.scene=scene;
        this.addBg(scene,{strokeColor:GM.COLOR_GRAY})
            .addText(scene)
            .addButtons(scene)
            .layout()
            //.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()

        // this.getElement('dropdown',true).setValue('tw')   
    }

    addText(scene)
    {
        
        this.add(text(scene,{text:'123'}), {key:'msg'});
        return this;
    }

    addButtons(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'x'});
        sizer
            .add(new UiButton(scene,{text:'❌',onclick:this.cancel.bind(this),radius:5,padding:10}))
            .addSpace()
            .add(new UiButton(scene,{text:'✔️',onclick:this.confirm.bind(this),radius:5,padding:10}))
        this.add(sizer,{expand:true,padding:{left:10,right:10,bottom:10}});
        return this;
    }

    confirm()
    {
        this._resolve(true);
        this.close();
    }

    cancel()
    {
        this._resolve(false);
        this.close();
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    show(msg)
    {
        super.show();
        this.getElement('msg').setText(msg);
        this.layout();
        return new Promise((resolve, reject) => {
            this._resolve = resolve;
        });
    }
}

export class UiConfirm extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene, 'UiConfirm', false);
        UiConfirm.instance = this;

        this.add(new Confirm(scene)).close()
    }



    static msg(msg) {return this.instance?.show(msg);}
}

export class Settings extends UiBase
{
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width: 500,
            orientation : 'y',
            space : {left:10,right:10,bottom:10},
        }

        super(scene,config)
        this.scene=scene;
        this.addBg(scene)
            .addTop(scene)
            .addMain(scene)
            .layout()
            //.drawBounds(this.scene.add.graphics(), 0xff0000)
            .hide()

        // this.getElement('dropdown',true).setValue('tw')   
    }

    addMain(scene)
    {
        let sizer = scene.rexUI.add.sizer({orientation:'y',space:{top:50,bottom:50,item:50}})
        sizer.addLang = this.addLang;
        sizer.addSfxVolume = this.addSfxVolume;
        sizer.addBgmVolume = this.addBgmVolume;

        sizer.addBackground(rect(scene,{strokeColor:GM.COLOR_GRAY, strokeWidth:2}))
        sizer.addLang(scene,200)
            .addSfxVolume(scene,200)
            .addBgmVolume(scene,200)
        this.add(sizer, {key:'main', expand:true});
        return this;
    }

    addLang(scene, width)
    {
        let options = [{text:'中文',value:'tw'},
                        {text:'ENGLISH',value:'us'},]

        let onchange = function(value)
        {
            console.log('lang:',value)
            Record.data.lang=value;
            Record.save();
        }

        let sizer = scene.rexUI.add.sizer({orientation:'x', space:{item:10}});
        sizer.add(text(scene,{text:'🌐', fontSize:40}))
            .add(dropdown(scene,{width:width, options:options, space:{top:5,bottom:5},onchange:onchange}),{key:'dropdown'});
        this.add(sizer,{key:'lang'});
        return this
    }

    addSfxVolume(scene, width)
    {
        let onchange = function(value)
        {
            value = Math.round(value * 10) / 10;
            if(value==0) {sizer.getElement('icon').setText('🔇');}
            else if(value < 0.5) {sizer.getElement('icon').setText('🔈');}
            else if(value < 1) {sizer.getElement('icon').setText('🔉');}
            else {sizer.getElement('icon').setText('🔊');}
            Record.data.sfxVolume = value;
            Record.save();
        }

        let sizer = scene.rexUI.add.sizer({orientation:'x', space:{item:10}});
        sizer.add(text(scene,{text:'🔈', fontSize:40}),{key:'icon'})
            .add(slider(scene,{width:width, gap:0.2}),{key:'sfx_volume'});
        this.add(sizer,{key:'sfx'});

        this.getElement('sfx_volume',true).off('valuechange').on('valuechange',onchange); 
        return this
    }

    addBgmVolume(scene, width)
    {
        let onchange = function(value)
        {
            value = Math.round(value * 10) / 10;
            Record.data.bgmVolume = value;
            Record.save();
        }

        let sizer = scene.rexUI.add.sizer({orientation:'x', space:{item:10}});
        sizer.add(text(scene,{text:'🎵', fontSize:40}),{key:'icon'})
            .add(slider(scene,{width:width, gap:0.2}),{key:'bgm_volume'});
        this.add(sizer,{key:'bgm'});

        this.getElement('bgm_volume',true).off('valuechange').on('valuechange',onchange); 
        return this
    }

    close()
    {
        super.close();
        this.onclose?.();
    }

    show()
    {
        super.show();
        this.getElement('dropdown',true).setValue(Record.data.lang); 
        this.getElement('sfx_volume',true).setValue(Record.data.sfxVolume); 
        this.getElement('bgm_volume',true).setValue(Record.data.bgmVolume); 
    }

}

export class UiSettings extends UiContainerBase
{
    static instance = null;
    constructor(scene)
    {
        super(scene, 'UiSettings', false);
        UiSettings.instance = this;

        this.add(new Settings(scene))
            .close()

        
    }

    static show() {this.instance?.show();}
}


export class UiQuest extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            width : 800,
            height : 500,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, 'UiQuest');
        UiQuest.instance = this; 

        this.addBg_Int(scene)    
            .addTop(scene,{text:'quest'.lab()})
            .addTab(scene)
            .addPage(scene,'quests')
            .setOrigin(0.5)
            .layout()
            .hide()  
    }

    addTab(scene)
    {
        let button_pre;
        let config = {
            background: rect(scene,{alpha:0,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
            topButtons:[
                        label(scene,{text:'🎴',color:GM.COLOR_PRIMARY,key:'quests',space:{left:20,right:20,top:5,bottom:5}}),
                        label(scene,{text:'❤️',color:GM.COLOR_PRIMARY,key:'states',space:{left:20,right:20,top:5,bottom:5}}),
                    ],

            space: {left:5, top:5, bottom:5, topButton:1}
        }

        let tabs = scene.rexUI.add.tabs(config); 

        tabs.on('button.click', (button, groupName, index)=>{
                UiInfo.close();
                if(button_pre) 
                {
                    button_pre.getElement('background').setFillStyle(GM.COLOR_PRIMARY);
                    this.getElement(button_pre.key)?.hide();
                }
                button_pre = button;
                button.getElement('background').setFillStyle(GM.COLOR_LIGHT);
                console.log(button.key)
                this.getElement(button.key)?.show();
                this.layout();
            })

        tabs.on('button.over', (button, groupName, index)=>{
            Ui.delayCall(()=>{UiInfo.show(GM.TP_BTN, button)})
        })

        tabs.on('button.out', (button, groupName, index)=>{
            Ui.cancelDelayCall();
            UiInfo.close();
        })

        this.add(tabs,{expand:true, key:'tags'});
        return this;
    }

    addPage(scene, key)
    {
        let config = {
            orientation:'x',
        }
        let panel = scene.rexUI.add.sizer(config);

        panel.addScroll = this.addScroll;
        panel.addPanel = this.addPanel;
        panel.addBackground(rect(scene,{color:GM.COLOR_PRIMARY,strokeColor:GM.COLOR_GRAY,strokeWidth:2}))
        this.add(panel,{expand:true,proportion:1,key:key});
        
        panel.addScroll(scene,{width:300});
        panel.addPanel(scene,{color:GM.COLOR_LIGHT});

        panel.hide();
        return this;
    }

    updatePage()
    {
        let itemSel = null;
        let ondown = (item)=>{
            itemSel?.unsel();
            itemSel=item;
            item.sel();

            let panel = this.getElement('panel',true);
            panel.addDivider = this.addDivider;
            panel.removeAll(true);
            panel.add(bbcText(this.scene,{text:item.dat.title}))
                .addDivider(this.scene)
                .add(bbcText(this.scene,{text:item.dat.des}),{expand:true})

            let q = QuestManager.query(item.id);
            if(q.status == 'close')
            {
                panel.add(bbcText(this.scene,{text:`🗹 任務完成`}),{expand:true});
            }
            else
            {
                q.conds.forEach((cond)=>{
                    switch(cond.type)
                    {
                        case GM.KILL: 
                            if(cond.shown())
                            {
                                let flag = cond.test() ? '🗹':'☐';
                                panel.add(bbcText(this.scene,{text:`${flag} ${cond.type.lab()} ${cond.id.lab()} (${cond.cur}/${cond.count})`}),{expand:true});
                            }
                            break;
                        case GM.TALK:
                            if(cond.shown())
                            {
                                panel.add(bbcText(this.scene,{text:`☐ ${cond.type} ${cond.id}`}),{expand:true});
                            }
                            break;
                        case GM.FINAL:
                            if(q.state()=='finish')
                            {
                                panel.add(bbcText(this.scene,{text:`☐ ${cond.des}`}),{expand:true});
                            }
                            break;
                    }
                })
            }
            
            panel.add(bbcText(this.scene,{text:'rewards'.lab()}),{expand:true})
            item.dat.rewards.forEach((reward)=>{
                switch(reward.type)
                {
                    case 'gold':
                        panel.add(bbcText(this.scene,{text:`■ ${reward.type.lab()} ${reward.count}`}),{expand:true});
                        break;
                    case 'item':
                        panel.add(bbcText(this.scene,{text:`■ ${reward.id.lab()} ${reward.count}`}),{expand:true});
                        break;
                }
            })

            if(q.status == 'close')
            {
                let onclick=()=>{QuestManager.remove(item.id);this.update();}
                panel.addSpace()
                panel.add(new UiButton(this.scene,{text:'移除',onclick:onclick}),
                            {align:'right'})
            }
            this.layout();
            
        }

        let panel = this.getElement('panel',true);
        panel.removeAll(true);

        let list = this.getElement('scroll',true).getElement('panel');
        list.removeAll(true);

        for(let id in QuestManager.opened)
        {
            let questD = DB.quest(id);
            let q = QuestManager.opened[id]
            let flag = q.status == 'close' ? '🗹':'☐';
            let item = this.item(flag+' '+questD.title,{ondown:ondown});
            item.dat = questD;
            item.id = id;
            list.add(item,{expand:true})
        }

        return this;
    }

    update()
    {
        if(this.visible)
        {
            this.updatePage();
        }
    }

    refresh() {this.update();}  // call by Ui.refreshAll()

    show(owner)
    {
        this.owner = owner;
        super.show();
        this.update();
        this.getElement('tags').emitTopButtonClick(0);
        // closeAll/register/camera
        this.closeAll(GM.UI_CENTER);
        this.register(GM.UI_CENTER);
    }

    close()
    {
        if(!this.visible) {return;}

        super.close();
        this.unregister();
    }

    toggle(owner)
    {
        if(this.visible){this.close();}
        else{this.show(owner)}
    }

    static show(owner) {this.instance?.show(owner);}
    static close() {this.instance?.close();}
    static toggle(owner) {this.instance?.toggle(owner);}
    static get shown() {this.instance?.visible;}
}


export class UiSkill extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : GM.h/2,
            // width : 500,
            // height : 400,
            orientation : 'y',
            space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, 'UiSkill');
        UiSkill.instance = this; 
        this.addBg(scene) 
            .addTop(scene,{text:'skill'.lab()})
            .addMain(scene)
            .layout()
            .hide()

        this._itemSel = null;
    }

    get _graphic() {return this._main._graphic;}
    set _graphic(value) {this._main._graphic = value;}
    get _panel() {return this._main._panel;}

    addMain(scene)
    {
        let config = 
        {
            height:100,
            orientation:'x',
            space:{item:10},
        }

        let main = scene.rexUI.add.sizer(config);
        main.addMenu = this.addMenu;
        main.addPanel = this.addPanel;
        main.addScroll = this.addScroll;    // call by this.addMenu()
        main.createPanel = this.createPanel;
        main.getOwner = this.getOwner;
        main.addMenu(scene)
            .addPanel(scene)
        this.add(main,{key:'main'})
        this._main = main;
        return this;
    }

    addMenu(scene)
    {
        this.addScroll(scene,{width:100});
        return this;
    }

    addPanel(scene)
    {
        let config = 
        {
            width: 300,
            height: 400,
            background: rect(scene,{color:GM.COLOR_BLACK}),
            panel: {child:this.createPanel(scene)},
            slider: {
                track: rect(scene,{width:15,color:GM.COLOR_DARK}),
                thumb: rect(scene,{width:20,height:20,radius:5,color:GM.COLOR_LIGHT}),
                space: 5,
                hideUnscrollableSlider: true,
                disableUnscrollableDrag: true,
            },
        }
        let scroll = scene.rexUI.add.scrollablePanel(config);
        this.add(scroll, {expand:true});
        this._panel = scroll.getElement('panel')
        return this;
    }

    createPanel(scene)
    {
        let sizer = scene.add.container()
        // sizer.setSize(100,200)
        return sizer;
    }

    getOwner()
    {
        return Role.getPlayer();
    }

    toggle()
    {
        if(this.visible){this.close();}
        else{this.show()}
    }

    checkRefs(refs)
    {
        for(let i=0; i<refs.length; i++)
        {
            let id = refs[i];
            let skill = this.getOwner().status.skills[id];
            if(!skill?.en) {return false};
        }

        return true;
    }

    // refresh() {this.update();}
    refresh() 
    {
        let item = this._itemSel;
        this.drawTree(DB.skTree[item.id])
    }

    drawTree(tree)
    {
        this._panel.removeAll(true);
        this._graphic = this.scene.add.graphics();
        this._panel.add(this._graphic);

        this._graphic.lineStyle(4, 0x808080, 1);

        let xMax=0, yMax=0;
        
        tree.forEach(dat=>{
            if(dat.type==='skill')
            {
                let slot = new SkillItem(this.scene,50,50);
                slot.set(dat.id,dat.x,dat.y)
                this._panel.add(slot)
                xMax = Math.max(xMax, dat.x);
                yMax = Math.max(yMax, dat.y);
            }
            else
            {
                let pts = dat.pts;
                this._graphic.lineStyle(4, this.checkRefs(dat.refs)?0xffffff:0x505050, 1);
                for(let i=0;i<pts.length-1;i++)
                {
                    this._graphic.lineBetween(pts[i].x,pts[i].y,pts[i+1].x,pts[i+1].y);
                }
            }
        })

        // console.log(xMax,yMax)
        this._panel.setSize(xMax+50,yMax+50)
        this.layout();
    }

    ondown(item)
    {
         this._itemSel?.unsel();
            this._itemSel = item;
            this.drawTree(DB.skTree[item.id])
            item.sel();
    }


    showMenu()
    {
        if(this._itemSel === null)
        {
            let menu = this.getElement('scroll',true).getElement('panel')

            menu.removeAll(true);
            Object.keys(DB.skTree).forEach((tree,i)=>{
                let item = this.item(tree,{ondown:this.ondown.bind(this)});
                item.id = tree;
                menu.add(item,{expand:true})
                if(i===0)
                {
                    item.emit('pointerdown',item);
                }

            })
            this.layout();
        }
    }


    show()
    {
        super.show();
        this.showMenu();
        this.closeAll(GM.UI_CENTER);
        this.register(GM.UI_CENTER);
    }

    close()
    {
        super.close();
        this.unregister();
    }

    static show() {this.instance?.show();}
    static close() {this.instance?.close();}
    static toggle(owner) {this.instance?.toggle(owner);}
    static get shown() {this.instance?.visible;}
}



class Buff extends Pic
{
    constructor(scene, w, h, buff)
    {
        super(scene, w, h, {icon:buff.icon, strokeWidth:0, space:0});
        let d=0;
        Object.values(buff.effects).forEach(effect=>d=Math.max(d,effect.d))
        this.add(bbcText(scene,{text:d,fontSize:20,color:'#fff'}),{align:'bottom-center',expand:false})
            .layout();
        this.addListener()
        this._dat=buff;
    }

    get dat() {return this._dat;}

    addListener()
    {
        this.setInteractive({draggable:true,dropZone:true})
        .on('pointerover', ()=>{this.over();})
        .on('pointerout', ()=>{this.out();})
    }

    over() {Ui.delayCall(() => {UiInfo.show(GM.TP_BUFF,this);});} // 使用 delacyCall 延遲執行 UiInfo.show()}
    out() {Ui.cancelDelayCall();UiInfo.close();}

}


export class UiBuff extends UiBase
{
    static instance = null;
    constructor(scene)
    {
        let config =
        {
            x : GM.w/2,
            y : 0,
            // width : 500,
            // height : 50,
            orientation : 'y',
            // space:{left:10,right:10,bottom:10,item:5},
        }
        super(scene, config, 'UiBuff');
        UiBuff.instance = this; 
        this.setOrigin(0.5,0);
        this//.addBg(scene,{color:GM.COLOR_WHITE,alpha:0.5}) 
            .addMain(scene)
            .layout()
            .hide()
    }

    getOwner() {return Role.getPlayer();}

    addMain(scene)
    {
        let config = 
        {
            width : (50+5)*10,
            orientation : 'x',
            align : 'center',
            space: {top:0, item:5, line:5},
        }
        this._main = scene.rexUI.add.fixWidthSizer(config);
        this.add(this._main);
        return this;
    }

    refresh()
    {
        this._main.removeAll(true);

        let buffs = this.getOwner()?.status?.buffs;
        if(buffs)
        {
            buffs.forEach(buff=>{
                if(buff.icon){this._main.add(new Buff(this.scene,50,50,buff));}
            })
        }

        this.layout();
    }

    show()
    {
        super.show();
        this.register(GM.UI_TOP);
        this.refresh()
    }

    static show() {this.instance?.show();}

    static close() {this.instance?.close(true);}
}

