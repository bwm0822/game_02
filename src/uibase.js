import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';

export let UI =
{
    COLOR_PRIMARY : 0x4e342e,
    COLOR_LIGHT : 0x7b5e57,
    COLOR_DARK : 0x260e04,
    COLOR_SLOT : 0x666666,//0xa4d4ff,
    COLOR_SLOT_OVER : 0x909090,//0x4f9ef7,
    COLOR_SLOT_DRAG : 0x557755,
    COLOR_SLOT_INVALID : 0x773333,
    COLOR_SLOT_DISABLE : 0x333333,
    COLOR_SLOT_TRADE : 0x555555,
    COLOR_COUNT : 0xff0000,//0x260e04;
    COLOR_WHITE : 0xffffff,
    COLOR_GRAY : 0x777777,
    COLOR_RED : 0xff0000,
    COLOR_YELLOW : 0xffff00,
    COLOR_BLACK : 0x0,

    FONT : "Arial",
    FONT_SIZE: 24,

    ICON_CLOSE : 'cursors/cross_small',
    ICON_DROP : 'cursors/iconPack_123',
    ICON_USE : 'cursors/iconPack_123',
    ICON_INFO : 'cursors/iconPack_27',
    ICON_MARK : 'buffs/108',

    ICON_WEAPON : 'icons/80',  //'weapons/5'
    ICON_HELMET : 'icons/113', //'weapons/45'
    ICON_CHESTPLATE : 'icons/119',//'weapons/54'
    ICON_GLOVES : 'icons/128',
    ICON_BOOTS : 'icons/130',
    ICON_NECKLACE : 'icons/134',
    ICON_RING : 'icons/133',

    CAT_WEAPON: 'weapon',
    CAT_HELMET: 'helmet',
    CAT_CHESTPLATE: 'chestplate',
    CAT_GLOVES: 'gloves',
    CAT_BOOTS: 'boots',
    CAT_NECKLACE: 'necklace',
    CAT_RING: 'ring',
    
    SLOT_SIZE : 80,     // slot 的寬、高
    OVER_DELAY : 100,   // 註解延遲時間 (unit:ms)
    CAM_CENTER : 'center',
    CAM_LEFT : 'left',
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
    config.fontSize = config.fontSize ?? UI.FONT_SIZE;
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
    style.fontSize = config.fontSize ?? UI.FONT_SIZE;
    style.fontFamily = config.fontFamily ?? UI.FONT;
    style.strokeThickness = config.strokeThickness ?? 1;
    config.images && (style.images = config.images);
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

