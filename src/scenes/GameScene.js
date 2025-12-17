import {Scene} from 'phaser';
import Map from '../map.js';

import {Mark} from '../gameUi.js'
import Record from '../record.js'
import QuestManager from  '../quest.js';
// import {Pickup} from '../entity.js';
import {Pickup} from '../items/pickup.js';
import {GM,DEBUG} from '../setting.js';
import {UiChangeScene, UiGameOver, UiManufacture, UiCover} from '../ui.js'
import Ui from '../ui/uicommon.js'
import UiStorage from '../ui/uistorage.js'
import UiOption from '../ui/uioption.js'
import UiInv from '../ui/uiinv.js'
import UiDialog from '../ui/uidialog.js'
import UiTrade from '../ui/uitrade.js'
import UiCursor from '../ui/uicursor.js'
import UiMessage from '../ui/uimessage.js'


import TimeManager from '../time.js';
import AudioManager from '../audio.js';
import {Projectile} from '../entity';

// import * as Role from '../role.js';
// import {setPlayer,dbg_hover_npc} from '../role.js';
import {setPlayer, dbg_hover_npc} from '../roles/player.js';


export class GameScene extends Scene
{
    constructor (name)
    {
        super(name);
    }

    init(data) 
    {
        console.log('[1] init');
        this._data = data;
    }

    async create ({diagonal,classType,weight})
    {
        console.log('[2] create')
        this._dbgPos = null;
        this._graphics = null;
        this._dbgPath = null;
        this._pos = null;
        this._act = 'go';
        this._ent = null;
        this.roles = [];
        this.entities = [];
        this.gos = [];
        this.loadRecord();
        this.setEvent();
        this.initUI();
        
        await new Map(this).createMap(this._data.map, diagonal, weight);
        this.createRuntime();
        this.initAmbient(this._data.ambient);
        this.initSchedule();

        this.setPosition(classType);
        this.processInput();

        AudioManager.init(this);
        TimeManager.start();
        UiMessage.clean();
        UiChangeScene.done();
        AudioManager.bgmStart();

        this.log();
    }

    log()
    {
        console.log("Roles:", this.roles);
        console.log("Entities:", this.entities);
    }

    initAmbient(amb)
    {
        this.lights.enable();
        if(amb) {this.lights.setAmbientColor(parseInt(amb));}
        else {TimeManager.register(this.setAmbient.bind(this));}
    }

    setAmbient(dt,time)
    {
        this.lights.setAmbientColor(this.getAmbientColor(time));
    }

    getAmbientColor(time)
    {
        return 0x808080;
    }

    createRuntime()
    {
        let objs = Record.data.scenes?.[this._data.map]?.runtime;
        if(objs)
        {
            objs.forEach((obj)=>{new Pickup(this,obj.x,obj.y,obj.angle).init_runtime(obj);});
            Record.data.scenes[this._data.map].runtime = [];
        }
    }

    loadRecord()
    {
        QuestManager.load();
        TimeManager.load();
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
            this.cameras.main.startFollow(this._player,true,0.01,0.01,offsetX,offsetY);
        }
      
    }

    setPosition(classType)
    {
        let pos;
        console.log('------------',this.points)
        if(this._data.pos) {pos = this._data.pos}
        else {pos = this.points[this._data.port].pts[0];}

        this._player = new classType(this,pos.x,pos.y);
        // Role.setPlayer(this._player); // load() 的 equip() 會呼叫 Ui.refreshAll()，所以要先 setPlayer()
        setPlayer(this._player);
        this._player.init_runtime('wick').load();
        this.setCameraFollow(GM.CAM_CENTER);
 
        Record.data.pos = this._player.pos;   
        Record.data.map = this._data.map;
        Record.data.ambient = this._data.ambient;
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

            if(this._player.state==GM.ST_SLEEP) {return;}

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
                let pt = {x:pointer.worldX, y:pointer.worldY};
                if(this._player.state===GM.ST_MOVING)
                {
                    this._player.stop();
                }
                else if(this._player.state===GM.ST_ABILITY)
                {
                    this._player.execute({pt:pt,ent:this._ent});
                }
                else if(this._path?.state===GM.PATH_OK)
                {
                    this._player.execute({pt:pt,ent:this._ent,path:this._path});
                    Mark.close();
                    this._path=null;
                }
            }
            
        })
        .on('pointermove',(pointer)=>{
            if(DEBUG.loc) {this.showMousePos();}
            if(this._player.state===GM.ST_ABILITY) 
            {
                let pt = {x:pointer.worldX,y:pointer.worldY};
                if(this._player.isInRange(pt)) {UiCursor.set('aim');}
                else {UiCursor.set('none');}
                return;
            }
            else if(this._player.state===GM.ST_SLEEP) {return;}
            else if(this._player.state!==GM.ST_MOVING)
            {
                let pt = {x:pointer.worldX,y:pointer.worldY};
                this.showPath(pt, this._ent);
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
            this._player.stepMove(mx,my);
            this.clearPath();
            Mark.close();
        }
    }

    showPath(pt, ent)
    {
        if(ent===this._player) {this._path=null; return;}
        let pts = ent?.pts ?? [pt];
        let path = this._player.showPath(pts,!!ent);
        // console.log('showPath:',path)
        if(path)
        {
            if(path.state===GM.PATH_OK)
            {
                if(this._ent) {Mark.close();}
                else {Mark.show(path.ep,GM.COLOR_WHITE);}
            }
            else
            {
                Mark.show(path.ep,GM.COLOR_RED);
            }
        }
        else
        {
            Mark.close();
        }

        this._path = path;
    }

    clearPath() {if(this._dbgPath){this._dbgPath.clear();Mark.close();}}

    save()
    {
        Record.data.pos = this._player.pos;   
        // Record.data.player = this._player.save();
        // this._player.save();

        if(Record.data[this._data.map]?.runtime) {Record.data[this._data.map].runtime = [];}
        // console.log('objects:',this.objects)
        // this.objects.forEach((obj)=>{obj.save?.();})
        console.log('gos:',this.gos)
        this.gos.forEach(go=>go.save?.())
        // this.roles.forEach((role)=>{role.uid===-1 && role.save();})
        this.roles.forEach((role)=>{role.save();})
        TimeManager.save();
        Record.save();
    }

    mainMenu()
    {
        console.log('------------------------ mainMenu')
        this.save();
        this.scene.stop('UI');
        this.scene.start('MainMenu');
        AudioManager.bgmPause();
    }

    restart()
    {
        console.log('------------------------ restart')
        Record.delete();
        this.scene.stop('UI');
        this.scene.start('MainMenu');
        
        AudioManager.bgmPause();
    }

    gotoScene(config)
    {
        this.save();
        Ui.closeAll(GM.UI_ALL);
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

    fill()
    {
        UiInv.show(this._player);
        UiInv.filter([{type:'capacity',op:'<',value:'.max'}]);
        UiCursor.set('aim');
        UiCover.show();
        Ui.setMode(GM.UI_MODE_FILL)
    }

    setEvent()
    {        
        // 切換場景時，this.events 不會被清除，所以設過後就無須再設
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
                .on('refresh', ()=>{Ui.refreshAll()})
                .on('msg', (msg)=>{UiMessage.push(msg);})
                .on('scene', (config)=>{UiChangeScene.start(()=>{this.gotoScene(config);})})
                .on('gameover',()=>{this.gameOver();})
                .on('stove',(owner)=>{UiManufacture.show(owner);})
                .on('clearpath',()=>{this.clearPath();})
                .on('fill',()=>{this.fill();})
        }


        // 切換場景時，events 不會被清除，所以重設時，須先清除之前的設定
        const ui = this.scene.get('UI');
        ui.events
            .off('menu').on('menu', ()=>{this.mainMenu();})
            .off('restart').on('restart', ()=>{this.restart();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})
            .off('clearpath').on('clearpath',(mode)=>{this.clearPath();})
            .off('setWeight').on('setWeight',(p,weight)=>{
                console.log(p,weight)
                this.map.setWeight(p,weight)
            })
            .off('log').on('log',()=>{this.log();})

    }

}