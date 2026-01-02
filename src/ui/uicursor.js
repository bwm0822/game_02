import {GM,UI} from '../setting.js'
import Ui from './uicommon.js'

export default class UiCursor extends Phaser.GameObjects.Sprite
{
    static icons = {
        // none :  {sprite:'cursors/cursor_none', origin:{x:0.25,y:0}, scale:1},
        // aim :   {sprite:'cursors/target_b', origin:{x:0.5,y:0.5}, scale:0.7},
        // attack :  {sprite:'cursors/tool_sword_b', origin:{x:0.5,y:0.5}, scale:0.7},
        // pickup :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
        // talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
        // enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
        // exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
        // open :  {sprite:'cursors/gauntlet_open', origin:{x:0.5,y:0.5}, scale:1},
        // tool :  {sprite:'cursors/tool_wrench', origin:{x:0.5,y:0.5}, scale:1},

        none :  {sprite:GM.ICON_NONE, origin:{x:0.25,y:0}, scale:1},
        aim :   {sprite:GM.ICON_AIM, origin:{x:0.5,y:0.5}, scale:1},
        attack :  {sprite:GM.ICON_ATTACK, origin:{x:0.5,y:0.5}, scale:0.7},
        pickup :  {sprite:GM.ICON_PICKUP, origin:{x:0.5,y:0.5}, scale:0.7},
        talk :  {sprite:GM.ICON_TALK, origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:GM.ICON_ENTER, origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:GM.ICON_EXIT, origin:{x:0.5,y:0.5}, scale:1},
        open :  {sprite:GM.ICON_OPEN, origin:{x:0.5,y:0.5}, scale:1},
        cook :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        drink :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        open_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
        close_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
        rest :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
    }

    static instance = null;

    constructor(scene)
    {
        super(scene);
        UiCursor.instance = this;
        this.scene = scene;
        scene.add.existing(this);
        this.setDepth(Infinity);
        this.setIcon('none');
    }

    preUpdate(time, delta)
    {
        //console.log(this.scene.input.x,this.scene.input.y);
        this.setPosition(this.scene.input.x, this.scene.input.y);
    }

    setIcon(type)
    {
        if(Ui.mode===UI.MODE.FILL){return;}
        let icon = UiCursor.icons[type] ?? UiCursor.icons.none;
        let [key,frame]=icon.sprite.split('/')
        this.setTexture(key,frame);
        this.setOrigin(icon.origin.x,icon.origin.y);
        this.setScale(icon.scale);
    }

    debugDraw()
    {
        if(!this._dbgGraphics)
        {
            this._dbgGraphics = this.scene.add.graphics();
            this._dbgGraphics.setDepth(10000);
            this._dbgGraphics.name = 'cursor';
        }

        //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
        let circle = new Phaser.Geom.Circle(this.x,this.y,5);
        this._dbgGraphics.clear();
        this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
        this._dbgGraphics//.strokeRectShape(rect)
                        .strokeCircleShape(circle);
    }

    setPos(x,y)
    {
        this.setPosition(x,y);
        this.debugDraw();
    }

    static pos(x,y)
    {
        if(this.instance) {this.instance.setPos(x,y);}
    }

    static set(key)
    {
        if(this.instance) {this.instance.setIcon(key);}
    }

}