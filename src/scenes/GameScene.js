import {Scene} from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {QuestManager} from  '../quest.js';
//import {UI} from  '../uibase.js';
import {Pickup} from '../entity.js';
import {GM} from '../setting.js';
import {UiCursor, UiOption, UiDialog, UiTrade, UiStorage, UiInv, UiMessage, 
        UiProfile, UiChangeScene, Ui, UiGameOver, UiManufacture} from '../ui.js'
import TimeManager from '../time.js';


let lutAmbient = [   
    0x333333    ,
    0x333333    ,
    0x333333    ,
    0x333333	,
    0x666666	,
    0x999999	,
    0xcccccc	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xffffff	,
    0xcccccc	,
    0x999999	,
    0x666666	,
    0x333333	,
    0x333333	,
    0x333333	,
    0x333333	,
    0x333333	,
    ]

export class GameScene extends Scene
{
    constructor (name)
    {
        super(name);
    }

    init(data) 
    {
        //console.log('1.init',data);
        this._data = data;
    }

    async create ({diagonal,classType,weight})
    {
        //console.log('2.create')
        this._dbgPos = null;
        this._graphics = null;
        this._dbgPath = null;
        this._pos = null;
        this._act = 'go';
        this._ent = null;
        this.ports = {};
        this.roles = [];
        this.loadRecord();
        this.setEvent();
        this.initUI();
        
        await new Map(this).createMap(this._data.map, diagonal, weight);
        this.createRuntime();
        this.initAmbient();
        this.initSchedule();

        this.setPosition(classType);
        this.processInput();

        TimeManager.start();
        UiMessage.clear();
        UiChangeScene.done();
    }

    initAmbient()
    {
        console.log('enable light')
        this.lights.enable();
    }

    setAmbient(time)
    {
        this.lights.setAmbientColor(lutAmbient[time.h]);
    }

    createRuntime()
    {
        let objs = Record.data[this._data.map]?.runtime;
        if(objs)
        {
            objs.forEach((obj)=>{new Pickup(this,obj.x,obj.y,obj.angle).init_runtime(obj.slot);});
            //Record.data[this._data.map].runtime = [];
        }
    }

    loadRecord()
    {
        QuestManager.load();
        TimeManager.load();
        TimeManager.register(this.setAmbient.bind(this));
        //Role.Player.load();
    }

    initSchedule()
    {
        // define in GameArea.js
    }

    setCameraFollow(mode)
    {
        let offsetX=0,offsetY=0;
        if((mode&GM.CAM_LEFT_TOP)==GM.CAM_LEFT_TOP) {mode=GM.CAM_LEFT_TOP;}
        else {mode&=~GM.CAM_LEFT_TOP;}
        
        switch(mode)
        {
            case GM.CAM_CENTER: 
                offsetX = 0; offsetY = 0; break;
            case GM.CAM_LEFT: 
                offsetX = -this.cameras.main.width/4; offsetY = 0; break;
            case GM.CAM_RIGHT: 
                offsetX = this.cameras.main.width/4; offsetY = 0; break;
            case GM.CAM_LEFT_TOP: 
                offsetX = -this.cameras.main.width/4; 
                offsetY = this.map.small ? 0 : -this.cameras.main.width/4; break;
            default:
                offsetX = 0; offsetY = 0; break;
        }

    
        if(this.map.small)
        {
            this.cameras.main.centerOn(this.map.center.x-offsetX,this.map.center.y-offsetY);
        }
        else
        {
            this.cameras.main.startFollow(this._avatar,true,0.01,0.01,offsetX,offsetY);
        }
      
    }

    setPosition(classType)
    {
        let pos;
        if(this._data.pos) {pos = this._data.pos}
        else {pos = this.ports[this._data.port].pt;}

        this._avatar = new classType(this,pos.x,pos.y);
        this._avatar.init_runtime('knight');
        this._avatar.load(Record.data.player);
        this.setCameraFollow(GM.CAM_CENTER);
 
        Record.data.pos = this._avatar.pos;   
        Record.data.map = this._data.map;
        Record.save();
    }

    initUI() 
    {
        UiCursor.set();
        new Mark(this);
    }

    processInput()
    {
        
        this.input
        .on('pointerdown', (pointer,gameObject)=>{

            if (pointer.rightButtonDown())
            {
               console.log('right');
            }
            else if (pointer.middleButtonDown())
            {
                console.log('middle');
            }
            else
            {
                if(this._avatar.moving)
                {
                    this._avatar.stop();
                    this.findPath({x:pointer.worldX,y:pointer.worldY});
                }
                else if(this._rst?.state>=0)
                {
                    if(this._rst.state==1 || this._ent)
                    {
                        Mark.close();
                        this.clearPath();
                        let pos = this._ent?.pos ?? {x:pointer.worldX,y:pointer.worldY};
                        this._avatar.setDes(pos,this._ent);
                    }
                }
            }
            
        })
        .on('pointermove',(pointer)=>{

            this.showMousePos();
            if(!this._avatar.moving)
            {
                let pos = this._ent?.pos ?? {x:pointer.worldX,y:pointer.worldY};
                this.findPath(pos);
            }
        })

        //this.keys = this.input.keyboard.createCursorKeys();
        //this.input.keyboard.on('keydown',()=>{this.keyin();})
    }

    keyin()
    {
        let mx=0,my=0
        if(this.keys.left.isDown){mx--;}
        if(this.keys.right.isDown){mx++;}
        if(this.keys.up.isDown){my--;}
        if(this.keys.down.isDown){my++;}
        if(mx!=0||my!=0)
        {
            this._avatar.stepMove(mx,my);
            this.clearPath();
            Mark.close();
        }
    }

    findPath(pt)
    {
        let rst = this.map.getPath(this._avatar.pos,pt)
        this._rst = rst;
        
        if(rst)
        {
            if(rst.state>0)
            {
                this.drawPath(rst.path,this._ent);
                if(!this._ent) {Mark.show(rst.pt,GM.COLOR_WHITE);}
                else {Mark.close();}
            }
            else
            {
                this.clearPath();
                if(rst.state==-1) {Mark.show(rst.pt,GM.COLOR_RED);}
                else {Mark.close();}
            }
        }
        else
        {
            this.clearPath();
            Mark.close();
        }
    }

    clearPath() {if(this._dbgPath){this._dbgPath.clear();Mark.close();}}

    drawPath(path,ent)
    {
        if(!this._dbgPath)
        {
            this._dbgPath = this.add.graphics();
            this._dbgPath.name = 'path';
            this._dbgPath.fillStyle(0xffffff);
        }
        this._dbgPath.clear();
        path.pop(); //移除陣列最後一個元素
        path.forEach((node)=>{
            let circle = new Phaser.Geom.Circle(node.x, node.y, 5);
            this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
        })
    }

    save()
    {
        Record.data.pos = this._avatar.pos;   
        Record.data.player = this._avatar.save();
        if(Record.data[this._data.map]?.runtime) {Record.data[this._data.map].runtime = [];}
        this.objects.forEach((obj)=>{obj.save?.();})
        this.roles.forEach((role)=>{role.uid==-1 && role.save();})
        TimeManager.save();
        Record.save();
    }

    mainMenu()
    {
        this.save();
        Ui.closeAll(true);
        this.scene.start('MainMenu');
    }

    gotoScene(config)
    {
        this.save();
        Ui.closeAll(true);
        this.scene.start(config.map=='map'?'GameMap':'GameArea',config);
    }

    gameOver()
    {
        this.clearPath()
        this.input.keyboard.off('keydown');
        UiGameOver.show();
    }

    showMousePos()
    {
        if(!this._dbgPos)
        {
            this._dbgPos = this.add.text(0,0,'',{fontSize:'16px',color:'#fff',stroke:'#000',strokeThickness:3});
            this._dbgPos.setDepth(Infinity);
        }

        let x = this.input.activePointer.worldX;
        let y = this.input.activePointer.worldY;
        let w = this.map.getWeight({x:x,y:y});
        let text = `${x.toFixed(0)},${y.toFixed(0)},(${w})`;
        this._dbgPos.setPosition(x+20,y).setText(text);
    }

    dbg()
    {
        if(!this._dbg)
        {
            this._dbg = this.add.graphics();
            this._dbg.name = 'dbg';
        }
        this._dbg.clear();
        this._dbg.fillStyle(0xff0000);
        this._dbg.lineStyle(2, 0xff0000, 1);
        let x = this.input.activePointer.worldX;
        let y = this.input.activePointer.worldY;
        let circle = new Phaser.Geom.Circle(x,y,5);
        this._dbg.strokeCircleShape(circle);
    }

    setEvent()
    {
        if(!this._done)
        {
            this._done = true;
            this.events
                .on('over', (ent)=>{this._ent=ent;UiCursor.set(this._ent.act);Mark.close();})
                .on('out', ()=>{this._ent=null;UiCursor.set();})
                .on('storage', (owner)=>{UiStorage.show(owner);})
                .on('talk', (owner)=>{UiDialog.show(owner);})
                .on('trade', (owner)=>{UiTrade.show(owner);})
                .on('option', (x,y,acts,owner)=>{UiOption.show(x,y,acts,owner)})
                .on('refresh', ()=>{UiInv.refresh()})
                .on('msg', (msg)=>{UiMessage.push(msg);})
                .on('equip', ()=>{UiProfile.refresh();})
                .on('scene', (config)=>{UiChangeScene.start(()=>{this.gotoScene(config);})})
                .on('gameover',()=>{this.gameOver();})
                .on('stove',(owner)=>{UiManufacture.show(owner);})
        }

        const ui = this.scene.get('UI');
        ui.events
            .off('menu').on('menu', ()=>{this.mainMenu();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})
            .off('clearpath').on('clearpath',(mode)=>{this.clearPath();})

    }

}