import {Scene} from 'phaser'
import Map from '../manager/map.js'

import Record from '../infra/record.js'
import QuestManager from  '../manager/quest.js'
import Pickup from '../items/pickup.js'
import {GM,UI,DEBUG} from '../core/setting.js'
import Ui from '../ui/uicommon.js'
import UiMark from '../ui/uimark.js'
import UiCover from '../ui/uicover.js'
import UiStorage from '../ui/uistorage.js'
import UiOption from '../ui/uioption.js'
import UiInv from '../ui/uiinv.js'
import UiDialog from '../ui/uidialog.js'
import UiTrade from '../ui/uitrade.js'
import UiCursor from '../ui/uicursor.js'
import UiMessage from '../ui/uimessage.js'
import UiChangeScene from '../ui/uichangescene.js'
import UiGameOver from '../ui/uigameover.js'
import UiManufacture from '../ui/uimanufacture.js'

import TimeSystem from '../systems/time.js'
import AudioManager from '../manager/audio.js'

import {GameObject} from '../core/gameobject.js'

import {MiniMap} from '../manager/minimap.js'


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
        this._mv = {x:0,y:0};
    }

    update()
    {
        this.cameraMove();
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
        GameObject.gid=0;
        this.gos = {};
        this.loadRecord();
        this.setEvent();
        this.initUI();
        
        await new Map(this).createMap(this._data.map, diagonal, weight);
        await MiniMap.init(this);
        this.createRuntime();
        this.initAmbient(this._data.ambient);
        this.setPosition(classType);
        this.initSchedule();
        this.processInput();

        AudioManager.init(this);
        TimeSystem.start();
        UiMessage.clean();
        UiChangeScene.done();
        AudioManager.bgmStart();




        this.log();
    }

    log()
    {
        console.log("Roles:", this.roles);
        console.log("Entities:", this.entities);
        console.log("gos:", this.gos);
    }

    initAmbient(amb)
    {
        this.lights.enable();
        if(amb) {this.lights.setAmbientColor(parseInt(amb));}
        else {TimeSystem.register(this.setAmbient.bind(this));}
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
        let objs = Record.game.scenes?.[this._data.map]?.runtime;
        if(objs)
        {
            objs.forEach((obj)=>{new Pickup(this,obj.x,obj.y,obj.angle).init_runtime(obj);});
            Record.game.scenes[this._data.map].runtime = [];
        }
    }

    loadRecord()
    {
        QuestManager.load();
        TimeSystem.load();
        //Role.Player.load();
    }

    initSchedule()
    {
        // define in GameArea.js
    }

    cameraMove()
    {
        // if(!Record.setting.mouseEdgeMove) return;

        if(this._atEdge)
        {
            this.cameras.main.scrollX += this._mv.x;
            this.cameras.main.scrollY += this._mv.y;
        }
    }

    cameraPan(pt)
    {
        this.cameras.main.pan(GM.player.x, GM.player.y, 100, 'Power2');
        // pan 結束後再開始跟隨
        this.cameras.main.once('camerapancomplete', () => {
            this.setCameraFollow(GM.CAM_CENTER);
        });
    }

    isMouseAtEdge(pointer)
    {
        const p = pointer;
        const m = 5;
        const atEdge = p.x<=m||p.x>=GM.w-m||p.y<=m||p.y>=GM.h-m;
        const d = 3.5;

        if(atEdge && GM.player.state!==GM.ST.MOVING)
        {
            // console.log('--------------- edge:',p.x,p.y)
            this._mv = { x: p.x<GM.w/2?-d:d, y: p.y<GM.h/2?-d:d};

            if(!this._atEdge)
            {
                this._atEdge=true;
                UiCursor.set('cross');
                this.stopCameraFollow();
                this._atEdge=true;
                this._path=null;
                this.clearPath();
            }
        }
        else if(this._atEdge)
        {
            this._atEdge=false;
            UiCursor.set('none');
        }

        return this._atEdge;
    }

    stopCameraFollow()
    {
        this._follow=false;
        this.cameras.main.stopFollow();
    }

    setCameraFollow(mode)
    {
        this._follow=true;
        console.log('setCameraFollow:',mode)
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
            this.cameras.main.startFollow(GM.player,true,0.01,0.01,offsetX,offsetY);
        }
      
    }

    setPosition(classType)
    {
        let pos;
        if(this._data.pos) {pos = this._data.pos}
        else {
            console.log('----- port=',this._data.port)
            console.log(this.gos)
            pos = this.gos[this._data.port].pts[0];
        }

        new classType(this,pos.x,pos.y).init_runtime('wick').load();

        this.setCameraFollow(GM.CAM_CENTER);
 
        Record.game.pos = GM.player.pos;   
        Record.game.map = this._data.map;
        Record.game.ambient = this._data.ambient;
        Record.saveGame();
    }

    initUI() 
    {
        UiCursor.set();
        new UiMark(this);
    }

    processInput()
    {    
        this.input
        .on('pointerdown', (pointer)=>{
            this.onPointerDown(pointer);
            // console.log('game down')
        })
        .on('pointermove',(pointer)=>{
            this.onPointerMove(pointer);
            // console.log('game move:',pointer.x,pointer.y,pointer.worldX,pointer.worldY)
        })

        //this.keys = this.input.keyboard.createCursorKeys();
        //this.input.keyboard.on('keydown',()=>{this.keyin();})
    }

    onPointerDown(pointer,gameObject)
    {        
        if(GM.player.state===GM.ST_SLEEP) {return;}

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
            if(GM.player.state===GM.ST.MOVING)
            {
                GM.player.stop();
            }
            else if(GM.player.state===GM.ST.ABILITY)
            {
                GM.player.cmd({pt:pt,ent:this._ent});
            }
            else if(this._path?.state===GM.PATH_OK)
            {
                if(!this._follow) {this.cameraPan(pt);}
                GM.player.cmd({pt:pt,ent:this._ent,path:this._path});
                UiMark.close();
                this._path=null;
            }
        }
    }

    onPointerMove(pointer)
    {
        if(Record.setting.mouseEdgeMove&&this.isMouseAtEdge(pointer))
        {
            return;
        }

        if(DEBUG.loc) {this.showMousePos();}
        if(GM.player.state===GM.ST.ABILITY) 
        {
            let pt = {x:pointer.worldX,y:pointer.worldY};
            if(GM.player.isInRange(pt)) {UiCursor.set('aim');}
            else {UiCursor.set('none');}
            return;
        }
        else if(GM.player.state===GM.ST.SLEEP) {return;}
        else if(GM.player.state!==GM.ST.MOVING)
        {
            let pt = {x:pointer.worldX,y:pointer.worldY};
            this.showPath(pt, this._ent);
        }
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
            GM.player.stepMove(mx,my);
            this.clearPath();
            UiMark.close();
        }
    }

    showPath(pt, ent)
    {
        if(ent===GM.player) {this._path=null; return;}
        const pts = ent?.pts ?? [pt];
        const path = GM.player.showPath(pts,!!ent);
        if(path)
        {
            if(path.state===GM.PATH_OK)
            {
                if(this._ent) {UiMark.close();}
                else {UiMark.show(path.ep,GM.COLOR_WHITE);}
            }
            else
            {
                UiMark.show(path.ep,GM.COLOR_RED);
            }
        }
        else
        {
            UiMark.close();
        }

        this._path = path;
    }

    clearPath()
    {
        console.log('clearpath')
        GM.player.hidePath();
        UiMark.close();
    }

    npcPath(on) 
    {
        this.roles.forEach(role=>{
            if(role.isPlayer) {return;}
            if(on) {role.updateDebugPath();}
            else  {role.hidePath();}
        });
    }

    save()
    {
        Record.game.pos = GM.player.pos;   
        if(Record.game[this._data.map]?.runtime) {Record.game[this._data.map].runtime = [];}
        console.log('gos:',this.gos)
        // this.gos.forEach(go=>go.save?.())
        Object.values(this.gos).forEach(go=>go.save?.())
        this.roles.forEach(role=>role.save())
        TimeSystem.save();
        Record.saveGame();
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

    // dbg()
    // {
    //     if(!this._dbg)
    //     {
    //         this._dbg = this.add.graphics();
    //         this._dbg.name = 'dbg';
    //     }
    //     this._dbg.clear();
    //     this._dbg.fillStyle(0xff0000);
    //     this._dbg.lineStyle(2, 0xff0000, 1);
    //     let x = this.input.activePointer.worldX;
    //     let y = this.input.activePointer.worldY;
    //     let circle = new Phaser.Geom.Circle(x,y,5);
    //     this._dbg.strokeCircleShape(circle);
    // }

    dbgRect()
    {
        Object.values(this.gos).forEach(go=>{go.debugDraw({clr:!DEBUG.rect})})
    }

    fill()
    {
        UiInv.show(GM.player);
        UiInv.filter([{p:GM.CAPACITY}]);
        UiCursor.set('aim');
        UiCover.show();
        Ui.setMode(UI.MODE.FILL)
    }

    setEvent()
    {        
        // 切換場景時，this.events 不會被清除，所以設過後就無須再設
        if(!this._done)
        {
            this._done = true;
            this.events
                .on('over', (ent)=>{this._ent=ent;UiCursor.set(this._ent.act);UiMark.close();})
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
            .off('setWeight').on('setWeight',(p,weight)=>{this.map.setWeight(p,weight)})
            .off('log').on('log',()=>{this.log();})
            .off('dbgRect').on('dbgRect',()=>{this.dbgRect();})
            .off('npcPath').on('npcPath',(on)=>{this.npcPath(on);})

    }

}