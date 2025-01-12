import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';

export let UI =
{
    COLOR_PRIMARY : 0x4e342e,
    COLOR_LIGHT : 0x7b5e57,
    COLOR_DARK : 0x260e04,
    COLOR_SLOT : 0x666666,//0xa4d4ff,
    COLOR_SLOT_OVER : 0x909090,//0x4f9ef7,
    COLOR_SLOT_DRAG : 0x55aa55,
    COLOR_SLOT_DISABLE : 0x333333,
    COLOR_COUNT : 0xff0000,//0x260e04;
    COLOR_WHITE : 0xffffff,
    COLOR_GRAY : 0x777777,
    COLOR_RED : 0xff0000,
    COLOR_YELLOW : 0xffff00,
    COLOR_BLACK : 0x0,
    FONT : "Arial",
    ICON_CLOSE : 'cursors/cross_small',
    ICON_DROP : 'cursors/iconPack_123',
    ICON_USE : 'cursors/iconPack_123',
    ICON_INFO : 'cursors/iconPack_27',
    ICON_MARK : 'buffs/108',
    ICON_WEAPON : 'weapons/5',
    ICON_HELMET : 'weapons/45',
    ICON_ARMOR : 'weapons/54',
    ICON_BOOT : 'weapons/',
    SLOT_SIZE : 80,
}


export function rect(scene, config={})
{
    config.color = config.color ?? UI.COLOR_PRIMARY;
    return scene.rexUI.add.roundRectangle(config);
}

export function sprite(scene, {x, y, icon, name}={})
{
    let [atlas, frame] = icon ? icon.split('/'):[];
    let sprite = scene.add.sprite(x,y,atlas,frame);
    name && (sprite.name = name);
    return sprite;
}

export function text(scene, config={})    
{
    // fixedWidth:fixedWidth,
    config.fontSize = config.fontSize ?? 20;
    config.fontFamily = config.fontFamily ?? UI.FONT;
    config.wrapWidth && (config.wordWrap = {width:config.wrapWidth, useAdvancedWrap:true});
    config.wrapWidth && delete config.wrapWidth;
    let t = scene.add.text(config?.x, config?.y, config?.text, config);
    return t;
}

export function bbcText(scene, config={})    
{
    // fixedWidth:fixedWidth,
    let style = {};
    style.fontSize = config.fontSize ?? 20;
    style.fontFamily = config.fontFamily ?? FONT;
    style.strokeThickness = config.strokeThickness ?? 1;
    config.color && (style.color = config.color);
    config.stroke && (style.stroke = config.stroke);
    config.strokeThickness && (style.strokeThickness = config.strokeThickness);
    config.wrapWidth && (style.wrap = {mode:'char',width:config.wrapWidth}); 
    //mode: 0|'none'|1|'word'|2|'char'|'character'|3|'mix'
    config.backgroundColor && (style.backgroundColor = config.backgroundColor);
    let t = scene.add.rexBBCodeText(config?.x, config?.y, config?.text, style);
    return t;
}

export class Pic extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, color=UI.COLOR_SLOT, radius=0, alpha=0, space=0}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.addBackground(rect(scene,{color:color,radius:radius, alpha:alpha}),'background')
            .add(sprite(this.scene,{icon:icon}),{aspectRatio:true, key:'sprite'})        
            .layout()//.drawBounds(scene.add.graphics(), 0xff0000);   

        scene.add.existing(this);
    }
}

export class Icon extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, count, color=UI.COLOR_SLOT, radius=0, alpha=1, space=10, fontSize=20}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.fontSize=fontSize;
        this.addBackground(rect(scene,{color:color, radius:radius, alpha:alpha}),'background')
            .add(sprite(scene,{icon:icon}),{aspectRatio:true, key:'sprite'})   
            .add(text(scene,{text:count, fontSize:this.fontSize, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false,offsetY:0,offsetX:0})        

        //if(name!=undefined) {this.name = name;}

        this.layout()//.drawBounds(scene.add.graphics(), 0xff0000);
        scene.add.existing(this);
    }

    setIcon(icon,{tint=0xffffff,alpha=1}={})
    {
        let [key,frame] = icon ? icon.split('/') : [undefined,undefined];
        this.getElement('sprite').setTexture(key,frame).setTint(tint).setAlpha(alpha);
        return this;
    }

    setCount(count)
    {
        this.getElement('count').setText(count);
        return this;
    }

    clear()
    {
        this.getElement('sprite').setTexture();
        this.getElement('count').setText('');
    }

}

