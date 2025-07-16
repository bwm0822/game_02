import {Scene} from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import QuestManager from  '../quest.js';
import {Pickup} from '../entity.js';
import {GM} from '../setting.js';
import {UiCursor, UiOption, UiDialog, UiTrade, UiStorage, UiInv, UiMessage, 
        UiProfile, UiChangeScene, Ui, UiGameOver, UiManufacture, UiCover} from '../ui.js'
import TimeManager from '../time.js';
import AudioManager from '../audio.js';
import {Projectile} from '../entity';


export class GameScene extends Scene
{
    constructor (name)
    {
        super(name);
    }

    init(data) 
    {
        console.log('[1] init',data);
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
            objs.forEach((obj)=>{new Pickup(this,obj.x,obj.y,obj.angle).init_runtime(obj.slot);});
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
        console.log(this._data.port)
        if(this._data.pos) {pos = this._data.pos}
        else {pos = this.ents[this._data.port].pts[0];}

        this._player = new classType(this,pos.x,pos.y);
        Role.setPlayer(this._player); // load() 的 equip() 會呼叫 Ui.refreshAll()，所以要先 setPlayer()
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
                if(this._player.state == GM.ST_MOVING)
                {
                    this._player.stop();
                    this.findPath(pt);
                }
                else if(this._player.state == GM.ST_SKILL)
                {
                    this._player.apply({pt:pt,ent:this._ent});
                }
                else if(this._rst && this._rst.state==1 && !this._rst.block)
                {
                    this._player.apply({pt:pt,ent:this._ent});
                }
            }
            
        })
        .on('pointermove',(pointer)=>{

            this.showMousePos();
            if(this._player.state==GM.ST_SKILL) 
            {
                let pt = {x:pointer.worldX,y:pointer.worldY};
                if(this._player.isInSkillRange(pt))
                {
                    UiCursor.set('aim');
                }
                else
                {
                    UiCursor.set('none');
                }
                
                return;
            }
            else if(this._player.state==GM.ST_SLEEP) {return;}
            else if(this._player.state!=GM.ST_MOVING)
            {
                let pt = {x:pointer.worldX,y:pointer.worldY};
                this.findPath(pt, this._ent);
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


    findPath(pt, ent)
    {
        if(ent==this._player) {this._rst={status:-1};return;}

        let pts = ent?.pts ?? [pt];

        let rst = this.map.getPath(this._player.pos,pts)

        this._rst = rst;
        
        if(rst)
        {
            if(rst.state==1 && !rst.block)
            {
                this.drawPath(rst.path);
                if(this._ent) {Mark.close();}
                else {Mark.show(rst.pt,GM.COLOR_WHITE);}
            }
            else
            {
                this.clearPath();
                Mark.show(this.map.getPt(pt),GM.COLOR_RED);
                // if(rst.state==-1||rst.block) 
                // {
                //     Mark.show(this.map.getPt(pt),GM.COLOR_RED);
                // }
                // else {Mark.close();}
            }
        }
        else
        {
            this.clearPath();
            Mark.close();
        }
    }

    clearPath() {if(this._dbgPath){this._dbgPath.clear();Mark.close();}}

    drawPath(path)
    {    
        if(!this._dbgPath)
        {
            this._dbgPath = this.add.graphics();
            this._dbgPath.name = 'path';
            this._dbgPath.fillStyle(0xffffff);
            this._dbgPath.setDepth(Infinity);
        }
        this._dbgPath.clear();

        if(Role.dbg_hover_npc) {return;}    // DEBUG 用，如果有 NPC 被滑鼠指向，則不畫 player 的路徑，以免干擾 npc 路徑的顯示
        
        path.pop(); //移除陣列最後一個元素
        path.forEach((node)=>{
            let circle = new Phaser.Geom.Circle(node.x, node.y, 5);
            this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
        })
    }

    save()
    {
        Record.data.pos = this._player.pos;   
        Record.data.player = this._player.save();
        if(Record.data[this._data.map]?.runtime) {Record.data[this._data.map].runtime = [];}
        console.log(this.objects)
        this.objects.forEach((obj)=>{obj.save?.();})
        // this.roles.forEach((role)=>{role.uid==-1 && role.save();})
        TimeManager.save();
        Record.save();
    }

    mainMenu()
    {
        this.save();
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

        const ui = this.scene.get('UI');
        ui.events
            .off('menu').on('menu', ()=>{this.mainMenu();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})
            .off('clearpath').on('clearpath',(mode)=>{this.clearPath();})
            .off('setWeight').on('setWeight',(p,weight)=>{
                console.log(p,weight)
                this.map.setWeight(p,weight)
            })

    }

}