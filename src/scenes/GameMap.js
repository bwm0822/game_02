import { Scene } from 'phaser';
import Map from '../map.js';
import * as Role from '../role.js';
import Utility from '../utility.js';
import Battle from '../battle.js';
import {Mark} from '../gameUi.js'
import Record from '../record.js'
import {QuestManager} from  '../quest.js';

const ICON_NODE='buffs/10';

export class GameMap extends Scene
{
    constructor ()
    {
        super('GameMap');
    }

    init(data)
    {
        this._data=data;
        Record.data.node = data.id;   
        Record.data.map = '';
        Record.save();
    }

    create ()
    {
        console.log('map_create');
        this._dbgPos = null;
        this._graphics =null;
        this._dbgPath = null;
       

        new Map(this,'map',false);

        this._mark = new Mark(this);
        
        this.loadRecord();
        this.uiEvent();
        this.initUI();
        this.setPosition();
        this.processInput();
        
    }

    loadRecord()
    {
        Record.load();
        QuestManager.load();
    }

    setPosition()
    {
        let node = this.nodes['家'];
        console.log(node)
        this._avatar = new Role.Target(this,node.x,node.y);
        this.cameras.main.startFollow(this._avatar,true,0.01,0.01);
    }

    initUI()
    {
        this.events.emit('gameMap');
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
                    this.clearPath();
                    this._avatar.setDes({x:pointer.worldX,y:pointer.worldY},this._act);
                }
            }
            
        })
        .on('pointermove',(pointer)=>{
            this.showMousePos();

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
                //this._avatar.path(path);
                this.drawPath(rst.path);
                this._mark.show(rst.pt,0xffffff);
            }
            else
            {
                //this.debugDraw(null,true);
                if(rst.pt){this._mark.show(rst.pt,0xff0000);}
                else{this._mark.hide();}
            }
        }
    }

    clearPath() {this._dbgPath.clear();}

    drawPath(path)
    {
        if(!this._dbgPath)
        {
            this._dbgPath = this.add.graphics();
            this._dbgPath.name = 'path';
            this._dbgPath.fillStyle(0xffffff);
        }
        this._dbgPath.clear();
        path.forEach(node=>{
            if(node.act=='go')
            {
                let circle = new Phaser.Geom.Circle(node.pt.x, node.pt.y, 5);
                this._dbgPath.fillStyle(0xffffff).fillCircleShape(circle);
            }
        })
    }


    home()
    {
        console.log('home');
        Record.data.role = Role.Player.role.record();
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
        // if(this._done) return;
        // this._done = true;

        this.events.on('over', (act)=>{this._act=act;this._mark.setIcon(this._act);})
                    .on('out', ()=>{this._act='go';this._mark.setIcon(this._act);});

        const ui = this.scene.get('UI');
        ui.events.off('home')
        ui.events.on('home', ()=>{this.home();console.log('home')})
    }

}


