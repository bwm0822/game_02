import { Scene } from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import Battle from '../battle.js';
import {BuffInfo, Mark} from '../gameUi.js'
import Record from '../record.js'
import {Avatar} from '../role.js'
import {Block} from '../entity.js'
import {QuestManager} from '../quest.js';
import {astar} from '../astar.js';

const ICON_NODE='buffs/10';
const ICON_MARK='buffs/108';

export class GameTown extends Scene
{
    constructor ()
    {
        super('GameTown');
    }

    get camX() {return this.cameras.main.scrollX+this.camOff.x;}
    get camY() {return this.cameras.main.scrollY+this.camOff.y;}
    // set camX(value) {this.cameras.main.scrollX=Utility.clamp(value-this.camOff.x,this.bounds.left,this.bounds.right);}
    // set camY(value) {this.cameras.main.scrollY=Utility.clamp(value-this.camOff.y,this.bounds.top,this.bounds.bottom);}
    set camX(value) {this.cameras.main.scrollX=value-this.camOff.x;}
    set camY(value) {this.cameras.main.scrollY=value-this.camOff.y;}

    init(data)
    {
        console.log('init',data);
        this._data = data;
        Record.data.node = data.id;   
        Record.data.map = this._data.map;
        Record.save();
    }

    create ()
    {
        console.log('town_create');
        this._dbgGraphics=null;
        this.roles=[];
        this._act='go';
        this._mark = new Mark(this);
        
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
                    this.debugDraw(null,true);
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
                //this._avatar.path(path);
                this.drawPath(rst.path);
                this._mark.show(rst.pt,0xffffff);
            }
            else
            {
                this.debugDraw(null,true);
                if(rst.pt){this._mark.show(rst.pt,0xff0000);}
                else{this._mark.hide();}
            }
        }
    }


    drawPath(path)
    {
        this.debugDraw(null,true);
        //path.forEach((node,i)=>{if(node.g<1000 && i<path.length-1){this.debugDraw(node.pt)}})
        path.forEach((node,i)=>{if(i<path.length-1){this.debugDraw(node.pt)}})
    }

    debugDraw(pt,clear=false)
    {
        //console.log(i);
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.add.graphics();
            this._dbgGraphics.name = 'path';
            this._dbgGraphics.lineStyle(2, 0xffffff, 1);
        }
        
        if(clear){this._dbgGraphics.clear();}
        else
        {
            //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
            let circle = new Phaser.Geom.Circle(pt.x,pt.y,5);
            this._dbgGraphics.lineStyle(2, 0xffffff, 1)
                        .strokeCircleShape(circle);
        //this._dbgGraphics.strokeRectShape(rect)
        }
    }



    setPosition()
    {
        let pos = this.ports[this._data.id];

        this._avatar = new Avatar(this,pos.x,pos.y);
        this.cameras.main.startFollow(this._avatar,true,0.01,0.01);
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
        this.events.emit('gameTown');
    }

    exit()
    {
        this.scene.start('GameMap');
    }

    battle(id)
    {
        this.scene.start('GameBattle',{id:id});
    }


    uiEvent()
    {
        //if(this._done) return;
        //this._done = true;
        this.events.on('over', (act)=>{this._act=act;this._mark.setIcon(this._act);})
                    .on('out', ()=>{this._act='go';this._mark.setIcon(this._act);});

        const ui = this.scene.get('UI');
        ui.events.off('exit').off('battle');
        ui.events.on('exit', ()=>{this.exit();})
                .on('battle', (id)=>{this.battle(id);})

    }

}



