import {Scene} from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {QuestManager} from  '../quest.js';
import {UI} from  '../uibase.js';
import {UiCursor,UiMain} from '../ui.js'

export class GameScene extends Scene
{
    constructor (name)
    {
        super(name);
    }

    init(data) {this._data = data;}

    create ({diagonal,classType,weight})
    {
        this._dbgPos = null;
        this._graphics = null;
        this._dbgPath = null;
        this._pos = null;
        this._act = 'go';
        this._ent = null;
        this.ports = {};
        this.roles = [];
        this.loadRecord();
        this.uiEvent();
        this.initUI();

        new Map(this, this._data.map, diagonal, weight);

        this.setPosition(classType);
        this.processInput();
        
    }

    loadRecord()
    {
        QuestManager.load();
        Role.Player.load();
    }

    setCameraFollow(mode)
    {
        let offsetX=0,offsetY=0;
        switch(mode)
        {
            case UI.CAM_CENTER: 
                offsetX=0; offsetY=0; break;
            case UI.CAM_LEFT: 
                offsetX = -this.cameras.main.width/4; offsetY = 0; break;
        }
        this.cameras.main.startFollow(this._avatar,true,0.01,0.01,offsetX,offsetY);
    }

    setPosition(classType)
    {
        let pos;
        if(this._data.pos) {pos = this._data.pos}
        else {pos = this.ports[this._data.port].pt;}

        this._avatar = new classType(this,pos.x,pos.y);
        this.setCameraFollow(UI.CAM_CENTER);
 
        Record.data.pos = this._avatar.pos;   
        Record.data.map = this._data.map;
        Record.save();
    }

    initUI() 
    {
        UiMain.show();
        UiCursor.set();
        new Mark(this);
    }

    processInput()
    {
        this.keys = this.input.keyboard.createCursorKeys();

        this.input
        .on('pointerdown', (pointer,gameObject)=>{

            if (pointer.rightButtonDown())
            {
               console.log('right');
            }
            else
            {
                if(this._avatar.moving)
                {
                    this._avatar.stop();
                    this.findPath({x:pointer.worldX,y:pointer.worldY});
                }
                else if(this?._rst?.valid)
                {
                    Mark.close();
                    this.clearPath();
                    //this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._act);
                    this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._ent?.act??'go');
                }
            }
            
        })
        .on('pointermove',(pointer)=>{
            this.showMousePos();
            //this.dbg();
            //console.log('map',pointer.x.toFixed(0),pointer.y.toFixed(0),',',pointer.worldX.toFixed(0),pointer.worldY.toFixed(0))

            if(!this._avatar.moving)
            {
                let pos = this._ent ? this._ent.pos : {x:pointer.worldX,y:pointer.worldY};
                this.findPath(pos);
            }
        })

        this.input.keyboard.on('keydown',()=>{this.keyin();})
    }

    findPath(pt)
    {
        let rst = this.map.getPath(this._avatar.pos,pt)
        this._rst = rst;
        if(rst)
        {
            if(rst.valid)
            {
                this.drawPath(rst.path);
                if(!this._ent) {Mark.show(rst.pt,UI.COLOR_WHITE);}
                else {Mark.close();}
            }
            else
            {
                this.clearPath();
                if(rst.pt) {Mark.show(rst.pt,UI.COLOR_RED);}
                else {Mark.close();}
            }
        }
    }

    clearPath() {if(this._dbgPath){this._dbgPath.clear();}}

    drawPath(path)
    {
        if(!this._dbgPath)
        {
            this._dbgPath = this.add.graphics();
            this._dbgPath.name = 'path';
            this._dbgPath.fillStyle(0xffffff);
        }
        this._dbgPath.clear();
        path.forEach((node,i)=>{
            if(i<path.length-1)
            {
                let circle = new Phaser.Geom.Circle(node.pt.x, node.pt.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            }
        })
    }


    menu()
    {
        Record.data.pos = this._avatar.pos;   
        Role.Player.save();
        Record.save();
        this.scene.start('MainMenu');
    }

    showMousePos()
    {
        if(!this._dbgPos)
        {
            this._dbgPos = this.add.text(0,0,'',{fontSize:'16px',color:'#fff',stroke:'#ff0',strokeThickness:0});
            this._dbgPos.setDepth(Infinity);
        }

        let x = this.input.activePointer.worldX;
        let y = this.input.activePointer.worldY;
        this._dbgPos.setPosition(x+20,y).setText(x.toFixed(0)+','+y.toFixed(0));
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

    uiEvent()
    {
        if(!this._done)
        {
            this._done = true;
            this.events
                .on('over', (ent)=>{this._ent=ent;UiCursor.set(this._ent.act);Mark.close();})
                .on('out', ()=>{this._ent=null;UiCursor.set();})
                .on('case',(owner)=>{UiCase.show(owner);})
                .on('talk',(owner)=>{UiDialog.show(owner);})
                .on('trade',(owner)=>{UiTrade.show(owner);})
                .on('option',(x,y,acts,owner)=>{UiOption.show(x,y,acts,owner)})
        }

        const ui = this.scene.get('UI');
        ui.events
            .off('menu').on('menu', ()=>{this.menu();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})

    }

}