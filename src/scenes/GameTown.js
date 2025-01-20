import {Scene} from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {Avatar} from '../role.js'
import {Block} from '../entity.js'
import {QuestManager} from '../quest.js';
import {UI} from '../uibase.js'
import {UiCursor,UiCase,UiInv,UiTrade,UiDialog,UiMain,UiOption} from '../ui.js'

export class GameTown extends Scene
{
    constructor ()
    {
        console.log('GameTown');
        super('GameTown');
    }

    get camX() {return this.cameras.main.scrollX+this.camOff.x;}
    get camY() {return this.cameras.main.scrollY+this.camOff.y;}
    // set camX(value) {this.cameras.main.scrollX=Utility.clamp(value-this.camOff.x,this.bounds.left,this.bounds.right);}
    // set camY(value) {this.cameras.main.scrollY=Utility.clamp(value-this.camOff.y,this.bounds.top,this.bounds.bottom);}
    set camX(value) {this.cameras.main.scrollX=value-this.camOff.x;}
    set camY(value) {this.cameras.main.scrollY=value-this.camOff.y;}

    init(data) {this._data = data;}

    create ()
    {
        this._dbgPath=null;
        this._act='go';
        new Mark(this);
        this.roles=[];
        this.loadRecord();
        this.uiEvent();
        this.initUI();
       
        new Map(this,this._data.map,true);

        this.setPosition();
        this.processInput();
        this.process();
    }

    loadRecord()
    {
        Role.Player.load();
        QuestManager.load();
    }

    processInput()
    {
        this.keys = this.input.keyboard.createCursorKeys();

        this.input
        .on('pointerdown', (pointer)=>{

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
                this.setDes({x:pointer.worldX,y:pointer.worldY},this._act);
            }
            
        })
        .on('pointermove',(pointer)=>{

            if(!this._avatar.moving)
            {
                this.findPath({x:pointer.worldX,y:pointer.worldY});
            }

            //this.debugWeight(pointer);

        })

         this.input.keyboard.on('keydown',()=>{this.keyin();});
    }

    debugWeight(pointer)
    {
        console.log( this.map.getWeight({x:pointer.worldX,y:pointer.worldY}) );
    }


    setDes(pos,act)
    {
        if(this._avatar.moving)
        {
            this._avatar.stop();
            this.findPath(pos);
        }
        else if(this?._rst?.valid)
        {
            Mark.close();
            this.clearPath();
            this._avatar.setDes(pos,act);
        }
    }

    async process()
    {
        let roles = this.roles;
        while(true)
        {
            for(let i=0;i<roles.length;i++)
            {
                await roles[i].process();
            }
        }
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
                if(this._act=='go') {Mark.show(rst.pt,UI.COLOR_WHITE);}
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
            //if(node.act=='go')
            if(i<path.length-1)
            {
                let circle = new Phaser.Geom.Circle(node.pt.x, node.pt.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            }
        })
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

    setPosition()
    {
        //let pos = this.ports[this._data.id];

        let pos;
        if(this._data.pos) {pos=this._data.pos;}
        else {pos = this.entries[this._data.id];}

        this._avatar = new Avatar(this,pos.x,pos.y);
        this.setCameraFollow(UI.CAM_CENTER);

        Record.data.pos = this._avatar.pos;   
        Record.data.map = this._data.map;
        Record.save();
    }

    keyin()
    {
        let loc = this._avatar.pos;
        if(this.keys.left.isDown){loc.x-=32;}
        if(this.keys.right.isDown){loc.x+=32;}
        if(this.keys.up.isDown){loc.y-=32;}
        if(this.keys.down.isDown){loc.y+=32;}
        this.debugDraw(null,true);
        Mark.close();
        this._avatar.setDes(loc);
    }

    initUI() 
    {
        UiMain.show();
        UiCursor.set();
    }

    exit() {this.scene.start('GameMap');}



    home()
    {
        console.log('home');
        //Record.data.role = Role.Player.role.record();
        console.log(this.objects)
        this.objects.forEach((obj)=>{
            console.log(obj)
            if(obj.save)
            {
                console.log('save');
                obj.save();
            }
        })
        Record.data.pos = this._avatar.pos;   
        Record.save();
        this.scene.start('MainMenu');
    }


    uiEvent()
    {
        if(!this._done)
        {
            this._done = true;
            this.events
            .on('over', (act)=>{this._act=act;UiCursor.set(this._act);Mark.close();})
            .on('out', ()=>{this._act='go';UiCursor.set('none');})
            .on('case',(owner)=>{UiCase.show(owner);})
            .on('talk',(owner)=>{UiDialog.show(owner);})
            .on('trade',(owner)=>{UiTrade.show(owner);})
            .on('option',(x,y,acts,owner)=>{UiOption.show(x,y,acts,owner)})
        }

        const ui = this.scene.get('UI');
        ui.events
            .off('home').on('home', ()=>{this.home();})
            .off('goto').on('goto',(pos,act)=>{this.setDes(pos,act);})
            .off('camera').on('camera',(mode)=>{this.setCameraFollow(mode)})

    }

}



