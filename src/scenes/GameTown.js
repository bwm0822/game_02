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
        this.list=[];
        this._interact=false;
        
        this.uiEvent();
        this.initUI();
        this.groupStatic = this.physics.add.staticGroup();
        QuestManager.load();
        this.map = new Map(this,this._data.map);
        this.keys = this.input.keyboard.createCursorKeys();

        // let margin = {w:map.map.width*map.map.tileWidth, h:map.map.height*map.map.tileHeight};
        // let camSz = {w:this.cameras.main._width, h:this.cameras.main._height};
        // this.camOff = {x:this.cameras.main._width/2,y:this.cameras.main._height/2}

        // this.bounds = {left:0, right:margin.w-camSz.w, top:0, bottom:margin.h-camSz.h};


        
        //new Block(this,100,100);
        this.setPosition();

        this._mark = new Mark(this);

        this.input.on('pointerup', (pointer)=>{

            if(this._avatar.moving)
            {
                this._avatar.stop();
                this.findPath({x:pointer.worldX,y:pointer.worldY});
            }
            else if(this?._rst?.valid)
            {
                this._mark.hide();
                this.debugDraw(null,true);
                //this._avatar.path(this._rst.path);
                //this._avatar.setTarget({x:pointer.worldX,y:pointer.worldY});
                console.log(this._interact)
                this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._interact);
                //cb.resolve();
            }
        })

        this.input.on('pointermove',(pointer)=>{

            if(!this._avatar.moving)
            {
                this.findPath({x:pointer.worldX,y:pointer.worldY});
            }
        })


        this.input.keyboard.on('keydown',()=>{
            this.keyin();
        })

        this.process();

    }

    async process()
    {
        let list = this.list;
        list.push(this._avatar);
        while(true)
        {
            for(let i=0;i<list.length;i++)
            {
                await list[i].process();
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
        this._avatar.setDes(loc);
    }

    update_1()
    {
        if(this.keys.left.isDown){this.keyL=3;}
        else{this.keyL=Math.max(0, this.keyL-1);}
        if(this.keys.right.isDown){this.keyR=3;}
        else{this.keyR=Math.max(0, this.keyR-1);}
        if(this.keys.up.isDown){this.keyU=3;}
        else{this.keyU=Math.max(0, this.keyU-1);}
        if(this.keys.down.isDown){this.keyD=3;}
        else{this.keyD=Math.max(0, this.keyD-1);}

        let v={x:0,y:0};
        if(this.keyL>0){v.x+=-1;}
        if(this.keyR>0){v.x+=1;}
        if(this.keyU>0){v.y+=-1;}
        if(this.keyD>0){v.y+=1;}
        //this._avatar.move(v);
        let loc={x:this._avatar.pos.x+v.x*16,y:this._avatar.pos.y+v.y*16}
        //this._avatar.setDes(loc)

        // if (this.cursors.left.isDown){this.camX=this.camX-1;}
        // else if (this.cursors.right.isDown){this.camX=this.camX+1;}

        // if (this.cursors.up.isDown){this.camY=this.camY-1;}
        // else if (this.cursors.down.isDown){this.camY=this.camY+1;}

        // let d={x:0,y:0}

        // if (this.cursors.left.isDown){d.x-=1;}
        // if (this.cursors.right.isDown){d.x+=1;}
        // if (this.cursors.up.isDown){d.y-=1;}
        // if (this.cursors.down.isDown){d.y+=1;}

        // this._avatar.move(d);
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
        this.events.on('over', (obj)=>{console.log('over');this._interact=true;})
                    .on('out', (obj)=>{console.log('out');this._interact=false;});

        const ui = this.scene.get('UI');
        ui.events.off('exit').off('battle');
        ui.events.on('exit', ()=>{this.exit();})
                .on('battle', (id)=>{this.battle(id);})

    }

}



