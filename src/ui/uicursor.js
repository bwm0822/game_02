import {GM,UI} from '../core/setting.js'
import Ui from './uicommon.js'
import {Pic, Icon, uRect, uBbc, uBar, uPic} from './uicomponents.js'


export default class UiCursor extends Phaser.GameObjects.Container
{
    static icons = {
        none :  {sprite:GM.ICON_NONE, origin:{x:0.25,y:0}, scale:1},
        aim :   {sprite:GM.ICON_AIM, origin:{x:0.5,y:0.5}, scale:1},
        attack :  {sprite:GM.ICON_ATTACK, origin:{x:0.5,y:0.5}, scale:0.7},
        pickup :  {sprite:GM.ICON_PICKUP, origin:{x:0.5,y:0.5}, scale:1},
        talk :  {sprite:GM.ICON_TALK, origin:{x:0.5,y:0.5}, scale:0.7},   
        enter :  {sprite:GM.ICON_ENTER, origin:{x:0.5,y:0.5}, scale:1},  
        exit :  {sprite:GM.ICON_EXIT, origin:{x:0.5,y:0.5}, scale:1},
        open :  {sprite:GM.ICON_OPEN, origin:{x:0.5,y:0.5}, scale:1},
        cook :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        drink :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        open_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
        close_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
        rest :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
        cross:  {sprite:GM.ICON_CROSS, origin:{x:0.5,y:0.5}, scale:1},
    }

    static instance = null;

    constructor(scene,x,y)
    {
        super(scene,x,y);
        UiCursor.instance = this;
        const layer = Ui.addLayer(scene, UI.TAG.CURSOR, this);
        layer.setDepth(Infinity);
        this.setIcon('none');
        this.setText('');
    }

    setIcon(type)
    {
        const icon = UiCursor.icons[type] ?? UiCursor.icons.none;

        if(!this._pic)
        {
            this._pic=uPic.call(this,this.scene,{
                            w:30,h:30,
                            // bg:{strokeColor:GM.COLOR.RED,strokeWidth:3} 
                        })
        }
        
        this._pic.setIcon(icon.sprite)
                    .setOrigin(icon.origin.x,icon.origin.y)
                    // .setScale(icon.scale)
                    .layout();
    }

    setText(text)
    {
        text=`[stroke=#000]${text}[/stroke]`;
        if(!this._text)
        {
            this._text=uBbc.call(this, this.scene,{
                    text:text,
                    fontSize:20,
                    x:0,y:-30}).setOrigin(0.5)
        }
        else
        {
            this._text.setText(text);
        }
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
        const circle = new Phaser.Geom.Circle(this.x,this.y,5);
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

    static set(key='none',text='')
    {
        if(this.instance) 
        {
            if(Ui.mode===UI.MODE.FILL){return;}

            this.instance.setIcon(key);
            this.instance.setText(text);
        }
    }


}



// export default class UiCursor extends Pic
// {
//     static icons = {
//         none :  {sprite:GM.ICON_NONE, origin:{x:0.25,y:0}, scale:1},
//         aim :   {sprite:GM.ICON_AIM, origin:{x:0.5,y:0.5}, scale:1},
//         attack :  {sprite:GM.ICON_ATTACK, origin:{x:0.5,y:0.5}, scale:0.7},
//         pickup :  {sprite:GM.ICON_PICKUP, origin:{x:0.5,y:0.5}, scale:0.7},
//         talk :  {sprite:GM.ICON_TALK, origin:{x:0.5,y:0.5}, scale:0.7},   
//         enter :  {sprite:GM.ICON_ENTER, origin:{x:0.5,y:0.5}, scale:1},  
//         exit :  {sprite:GM.ICON_EXIT, origin:{x:0.5,y:0.5}, scale:1},
//         open :  {sprite:GM.ICON_OPEN, origin:{x:0.5,y:0.5}, scale:1},
//         cook :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         drink :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         open_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
//         close_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
//         rest :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         cross:  {sprite:GM.ICON_CROSS, origin:{x:0.5,y:0.5}, scale:1},
//     }

//     static instance = null;

//     constructor(scene)
//     {
//         super(scene,35,35,{bg:{color:GM.COLOR.RED}});
//         UiCursor.instance = this;
//         // setDepth(value,cascade)
//         // cascade 為 true : 只有 sizer 會設 depth
//         // cascade 預設是 false : 子物件也會設 depth
//         // 在此將cascade設成true，只有sizer設depth，子物件不設，
//         // 保留由子物件加入的先後來決定 depth，
//         // 以避免bg蓋到前景(因為有時候前景會在setDepth()之後才加入)

//         const layer = Ui.addLayer(scene, UI.TAG.CURSOR, this);
//         // layer.setDepth(Infinity);
//         this.setIcon('none');
//         this.setText('');
        
        
//         // this.setDepth(Infinity,true);
//         console.log(this);
        
//         this.layout()
//     }

//     setIcon(type)
//     {
//         if(Ui.mode===UI.MODE.FILL){return;}
        
//         const icon = UiCursor.icons[type] ?? UiCursor.icons.none;
//         super.setIcon(icon.sprite)
//             .setOrigin(icon.origin.x,icon.origin.y)
//             .setScale(icon.scale)

//         this.layout();
//     }

//     setText(text)
//     {
//         text=`[stroke=#000]${text}[/stroke]`;
//         if(!this._text)
//         {
//             this._text=uBbc.call(this, this.scene,{
//                     text:text,
//                     fontSize:28,
//                     ext:{offsetY:-40,align:'top',expand:false}})
//         }
//         else
//         {
//             this._text.setText(text);
//         }

//         this.layout();
//     }

//     debugDraw()
//     {
//         if(!this._dbgGraphics)
//         {
//             this._dbgGraphics = this.scene.add.graphics();
//             this._dbgGraphics.setDepth(10000);
//             this._dbgGraphics.name = 'cursor';
//         }

//         //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
//         let circle = new Phaser.Geom.Circle(this.x,this.y,5);
//         this._dbgGraphics.clear();
//         this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
//         this._dbgGraphics//.strokeRectShape(rect)
//                         .strokeCircleShape(circle);
//     }

//     setPos(x,y)
//     {
//         this.setPosition(x,y);
//         this.debugDraw();
//     }

//     static pos(x,y)
//     {
//         if(this.instance) {this.instance.setPos(x,y);}
//     }

//     static set(key='none',text='')
//     {
//         if(this.instance) 
//         {
//             this.instance.setIcon(key);
//             this.instance.setText(text);
//         }
//     }

// }

// export default class UiCursor extends Phaser.GameObjects.Sprite
// {
//     static icons = {
//         // none :  {sprite:'cursors/cursor_none', origin:{x:0.25,y:0}, scale:1},
//         // aim :   {sprite:'cursors/target_b', origin:{x:0.5,y:0.5}, scale:0.7},
//         // attack :  {sprite:'cursors/tool_sword_b', origin:{x:0.5,y:0.5}, scale:0.7},
//         // pickup :  {sprite:'cursors/hand_open', origin:{x:0.5,y:0.5}, scale:0.7},
//         // talk :  {sprite:'cursors/message_dots_square', origin:{x:0.5,y:0.5}, scale:0.7},   
//         // enter :  {sprite:'cursors/door_enter', origin:{x:0.5,y:0.5}, scale:1},  
//         // exit :  {sprite:'cursors/door_exit', origin:{x:0.5,y:0.5}, scale:1},
//         // open :  {sprite:'cursors/gauntlet_open', origin:{x:0.5,y:0.5}, scale:1},
//         // tool :  {sprite:'cursors/tool_wrench', origin:{x:0.5,y:0.5}, scale:1},

//         none :  {sprite:GM.ICON_NONE, origin:{x:0.25,y:0}, scale:1},
//         aim :   {sprite:GM.ICON_AIM, origin:{x:0.5,y:0.5}, scale:1},
//         attack :  {sprite:GM.ICON_ATTACK, origin:{x:0.5,y:0.5}, scale:0.7},
//         pickup :  {sprite:GM.ICON_PICKUP, origin:{x:0.5,y:0.5}, scale:0.7},
//         talk :  {sprite:GM.ICON_TALK, origin:{x:0.5,y:0.5}, scale:0.7},   
//         enter :  {sprite:GM.ICON_ENTER, origin:{x:0.5,y:0.5}, scale:1},  
//         exit :  {sprite:GM.ICON_EXIT, origin:{x:0.5,y:0.5}, scale:1},
//         open :  {sprite:GM.ICON_OPEN, origin:{x:0.5,y:0.5}, scale:1},
//         cook :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         drink :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         open_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
//         close_door :  {sprite:GM.ICON_DOOR, origin:{x:0.5,y:0.5}, scale:1},
//         rest :  {sprite:GM.ICON_TOOL, origin:{x:0.5,y:0.5}, scale:1},
//         cross:  {sprite:GM.ICON_CROSS, origin:{x:0.5,y:0.5}, scale:1},
//     }

//     static instance = null;

//     constructor(scene)
//     {
//         super(scene);
//         UiCursor.instance = this;
//         this.scene = scene;
//         scene.add.existing(this);
//         this.setDepth(Infinity);
//         this.setIcon('none');
//     }

//     // preUpdate(time, delta)
//     // {
//     //     //console.log(this.scene.input.x,this.scene.input.y);
//     //     this.setPosition(this.scene.input.x, this.scene.input.y);
//     // }

//     setIcon(type)
//     {
//         console.trace();
//         if(Ui.mode===UI.MODE.FILL){return;}
//         let icon = UiCursor.icons[type] ?? UiCursor.icons.none;
//         let [key,frame]=icon.sprite.split(':')
//         this.setTexture(key,frame);
//         this.setOrigin(icon.origin.x,icon.origin.y);
//         this.setScale(icon.scale);
//     }

//     debugDraw()
//     {
//         if(!this._dbgGraphics)
//         {
//             this._dbgGraphics = this.scene.add.graphics();
//             this._dbgGraphics.setDepth(10000);
//             this._dbgGraphics.name = 'cursor';
//         }

//         //let rect = new Phaser.Geom.Rectangle(this.x-w/2,this.y-h/2,w,h);
//         let circle = new Phaser.Geom.Circle(this.x,this.y,5);
//         this._dbgGraphics.clear();
//         this._dbgGraphics.lineStyle(2, 0x00ff00, 1);
//         this._dbgGraphics//.strokeRectShape(rect)
//                         .strokeCircleShape(circle);
//     }

//     setPos(x,y)
//     {
//         this.setPosition(x,y);
//         this.debugDraw();
//     }

//     static pos(x,y)
//     {
//         if(this.instance) {this.instance.setPos(x,y);}
//     }

//     static set(key)
//     {
//         if(this.instance) {this.instance.setIcon(key);}
//     }

// }