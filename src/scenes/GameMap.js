import { Scene } from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {QuestManager} from  '../quest.js';

export class GameMap extends Scene
{
    constructor ()
    {
        console.log('GameMap');
        super('GameMap');
    }

    init(data) {this._data = data;}

    create ()
    {
        this._dbgPos = null;
        this._graphics = null;
        this._dbgPath = null;
        this._act = 'go';
        this._mark = new Mark(this);
       
        new Map(this,'map',false);

        this.loadRecord();
        this.uiEvent();
        this.initUI();
        this.setPosition();
        this.processInput();
        
    }

    loadRecord()
    {
        QuestManager.load();
        Role.Player.load();
    }

    setPosition()
    {
        let pos;
        if(this._data.pos){pos = this._data.pos}
        else
        {
            let node = this.nodes[this._data.id];
            pos = {x:node.x,y:node.y}
        }

        this._avatar = new Role.Target(this,pos.x,pos.y);
        this.cameras.main.startFollow(this._avatar,true,0.01,0.01);

        Record.data.pos = this._avatar.pos;   
        Record.data.map = '';
        Record.save();
    }

    initUI()
    {
        this.events.emit('uiMain');
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
                    this._mark.hide();
                    this.clearPath();
                    this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._act);
                }
            }
            
        })
        .on('pointermove',(pointer)=>{
            this.showMousePos();
            //console.log('map',pointer.x.toFixed(0),pointer.y.toFixed(0),',',pointer.worldX.toFixed(0),pointer.worldY.toFixed(0))

            if(!this._avatar.moving)
            {
                this.findPath({x:pointer.worldX,y:pointer.worldY});
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


    home()
    {
        console.log('home');
        //Record.data.role = Role.Player.role.record();
        Record.data.pos = this._avatar.pos;   
        Role.Player.save();
        Record.save();
        this.scene.start('MainMenu');
    }

    showMousePos()
    {
        if(!this._dbgPos)
        {
            this._dbgPos = this.add.text(0,0,'',{fontSize:'16px',color:'#000',stroke:'#ff0',strokeThickness:0});
        }

        let x = this.input.activePointer.worldX;
        let y = this.input.activePointer.worldY;
        this._dbgPos.setPosition(x+20,y).setText(x.toFixed(0)+','+y.toFixed(0));
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


