import {Scene} from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {Avatar} from '../role.js'
import {Block} from '../entity.js'
import {QuestManager} from '../quest.js';

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
        this._mark = new Mark(this);
        this.roles=[];
        
        this.uiEvent();
        this.initUI();
        QuestManager.load();
        new Map(this,this._data.map,true);

        this.setPosition();
        this.processInput();
        this.process();
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
                if(this._avatar.moving)
                {
                    this._avatar.stop();
                    this.findPath({x:pointer.worldX,y:pointer.worldY});
                }
                else if(this?._rst?.valid)
                {
                    this._mark.hide();
                    this.clearPath();
                    this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._act);
                }
            }
            
        })
        .on('pointermove',(pointer)=>{

            if(!this._avatar.moving)
            {
                this.findPath({x:pointer.worldX,y:pointer.worldY});
            }

        })

        this.input.keyboard.on('keydown',()=>{this.keyin();})
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
                if(this._act=='go') {this._mark.show(rst.pt,0xffffff);}
                else {this._mark.hide();}
            }
            else
            {
                this.clearPath();
                if(rst.pt){this._mark.show(rst.pt,0xff0000);}
                else{this._mark.hide();}
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

    // findPath(pt)
    // {
    //     let rst = this.map.getPath(this._avatar.pos,pt)
    //     this._rst = rst;
    //     if(rst)
    //     {
    //         if(rst.valid)
    //         {
    //             this.drawPath(rst.path);
    //             if(this._act=='go') {this._mark.show(rst.pt,0xffffff);}
    //             else {this._mark.hide();}
    //         }
    //         else
    //         {
    //             this.debugDraw(null,true);
    //             if(rst.pt) {this._mark.show(rst.pt,0xff0000);}
    //             else {this._mark.hide();}
    //         }
    //     }
    // }


    // drawPath(path)
    // {
    //     this.debugDraw(null,true);
    //     //path.forEach((node,i)=>{if(node.g<1000 && i<path.length-1){this.debugDraw(node.pt)}})
    //     path.forEach((node,i)=>{if(i<path.length-1){this.debugDraw(node.pt)}})
    // }

    // debugDraw(pt,clear=false)
    // {
    //     //console.log(i);
    //     if(!this._dbgGraphics)
    //     {
    //         this._dbgGraphics = this.add.graphics();
    //         this._dbgGraphics.name = 'path';
    //         this._dbgGraphics.lineStyle(2, 0xffffff, 1);
    //     }
        
    //     if(clear){this._dbgGraphics.clear();}
    //     else
    //     {
    //         //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
    //         let circle = new Phaser.Geom.Circle(pt.x,pt.y,5);
    //         this._dbgGraphics.lineStyle(2, 0xffffff, 1)
    //                     .strokeCircleShape(circle);
    //     //this._dbgGraphics.strokeRectShape(rect)
    //     }
    // }



    setPosition()
    {
        //let pos = this.ports[this._data.id];

        let pos;
        if(this._data.pos) {pos=this._data.pos;}
        else {pos = this.ports[this._data.id];}

        this._avatar = new Avatar(this,pos.x,pos.y);
        this.cameras.main.startFollow(this._avatar,true,0.01,0.01);

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
        this._mark.hide();
        this._avatar.setDes(loc);
    }

    initUI()
    {
        this.events.emit('uiMain');
    }

    exit()
    {
        this.scene.start('GameMap');
    }

    home()
    {
        console.log('home');
        //Record.data.role = Role.Player.role.record();
        Record.data.pos = this._avatar.pos;   
        Record.save();
        this.scene.start('MainMenu');
    }


    uiEvent()
    {
        if(!this._done)
        {
            this._done = true;
            this.events.on('over', (act)=>{this._act=act;this.events.emit('cursor',this._act);})
                        .on('out', ()=>{this._act='go';this.events.emit('cursor','none');})
        }

        const ui = this.scene.get('UI');
        ui.events.off('home').on('home', ()=>{this.home();})
                .off('mark').on('mark', (on)=>{this._mark.visible=on;})

    }

}



