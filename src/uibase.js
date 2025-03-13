import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {GM} from './setting.js';


export function rect(scene, config={})
{
    config.color = config.color ?? GM.COLOR_PRIMARY;
    return scene.rexUI.add.roundRectangle(config);
}

export function bar(scene, config={})
{
    config.height = config.height ?? 20,
    config.width = config.width ?? 100,
    config.barColor = config.barColor ?? GM.COLOR_PRIMARY,
    config.value = config.value ?? 0.5
    return scene.add.rexRoundRectangleProgress(config);
}

export function progress(scene, config={})
{
    config.height = config.height ?? 20,
    config.width = config.width ?? 100,
    config.barColor = config.barColor ?? GM.COLOR_PRIMARY,
    config.trackColor = config.trackColor ?? GM.COLOR_DARK,
    //config.trackStrokeColor = config.trackStrokeColor ?? GM.COLOR_LIGHT,
    config.value = config.value ?? 0.5
    return scene.add.rexRoundRectangleProgress(config);
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
    config.fontSize = config.fontSize ?? GM.FONT_SIZE;
    config.fontFamily = config.fontFamily ?? GM.FONT;
    config.wrapWidth && (config.wordWrap = {width:config.wrapWidth, useAdvancedWrap:true});
    config.wrapWidth && delete config.wrapWidth;
    let t = scene.add.text(config?.x, config?.y, config?.text, config);
    return t;
}

// export function bbcText(scene, config={})    
// {
//     // fixedWidth:fixedWidth,
//     let style = {};
//     style.fontSize = config.fontSize ?? GM.FONT_SIZE;
//     style.fontFamily = config.fontFamily ?? GM.FONT;
//     style.strokeThickness = config.strokeThickness ?? 1;
//     config.images && (style.images = config.images);
//     config.color && (style.color = config.color);
//     config.stroke && (style.stroke = config.stroke);
//     config.strokeThickness && (style.strokeThickness = config.strokeThickness);
//     config.wrapWidth && (style.wrap = {mode:'char',width:config.wrapWidth}); 
//     //mode: 0|'none'|1|'word'|2|'char'|'character'|3|'mix'
//     config.backgroundColor && (style.backgroundColor = config.backgroundColor);

//     let t = scene.add.rexBBCodeText(config?.x, config?.y, config?.text, style);
//     return t;
// }


export function bbcText(scene, config={})    
{
    let style = {};
    config.fontSize = config.fontSize ?? GM.FONT_SIZE;
    config.fontFamily = config.fontFamily ?? GM.FONT;
    config.strokeThickness = config.strokeThickness ?? 1;

    config.wrapWidth && (config.wrap = {mode:'char',width:config.wrapWidth}); 
    //mode: 0|'none'|1|'word'|2|'char'|'character'|3|'mix'

    let t = scene.add.rexBBCodeText(config?.x, config?.y, config?.text, config);
    return t;
}

export class Pic extends OverlapSizer
{
    constructor(scene, w, h, {x=0, y=0, icon, color=GM.COLOR_SLOT, radius=0, alpha=0, space=0}={})
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
    constructor(scene, w, h, {x=0, y=0, icon, count, color=GM.COLOR_SLOT, radius=0, alpha=1, space=10, fontSize=20}={})
    {
        super(scene, x, y, w, h,{space:space});
        this.fontSize=fontSize;
        this.addBackground(rect(scene,{color:color, radius:radius, alpha:alpha}),'background')
            .add(sprite(scene,{icon:icon}),{aspectRatio:true, key:'sprite'})   
            .add(text(scene,{text:count, fontSize:this.fontSize, color:'#fff', stroke:'#000', strokeThickness:5}),{key:'count',align:'right-bottom',expand:false,offsetY:space,offsetX:space})        

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
        this.layout();
        return this;
    }

    clear()
    {
        this.getElement('sprite').setTexture();
        this.getElement('count').setText('');
    }

}

