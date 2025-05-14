import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {GM} from './setting.js';


export function rect(scene, config={})
{
    config.color = config.color ?? GM.COLOR_PRIMARY;
    return scene.rexUI.add.roundRectangle(config);
}

export function bar(scene, config={})
{
    config.height = config.height ?? 20;
    config.width = config.width ?? 100;
    config.barColor = config.barColor ?? GM.COLOR_GREEN;
    config.value = config.value ?? 0.5;
    return scene.add.rexRoundRectangleProgress(config);
}

export function progress(scene, config={})
{
    config.height = config.height ?? 20;
    config.width = config.width ?? 100;
    config.barColor = config.barColor ?? GM.COLOR_GREEN;
    config.trackColor = config.trackColor ?? GM.COLOR_BLACK;
    //config.trackStrokeColor = config.trackStrokeColor ?? GM.COLOR_LIGHT,
    config.value = config.value ?? 0.5;
    return scene.add.rexRoundRectangleProgress(config);
}

export function sprite(scene, {x, y, icon, name}={})
{
    let [atlas, frame] = icon ? icon.split('/'):[];
    let sprite = scene.add.sprite(x,y,atlas,frame);
    name && (sprite.name = name);

    // // 儲存原本的 destroy 方法
    // let _originalDestroy = sprite.destroy.bind(sprite);
    
    // // 改寫 destroy 方法
    // sprite.destroy = function (...args) {
    //     console.log('sprite.destroy',args)  
    //     _originalDestroy(...args);
           
    // };

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
    t.key = config?.key;
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
    t.key = config?.key;
    return t;
}

export function slider(scene,{width,trackRadius=10,thumbRadius=20,onchange,gap,space}={})
{
    return scene.rexUI.add.slider({
        orientation: 'x',
        width: width,
        track: rect(scene,{color:GM.COLOR_DARK,radius:trackRadius}),
        thumb: rect(scene,{color:GM.COLOR_LIGHT,radius:thumbRadius}),
        valuechangeCallback: function(value){onchange?.(value)},
        gap: gap,
        space: space,
        //thumbOffsetY: -10,
        //space: {top: 4,bottom: 4},
        //input: 'drag', // 'drag'|'click'
    })
}

export function scrollBar(scene) 
{
    return scene.rexUI.add.scrollBar({
        width: 100,
        orientation: 'x',

        background: scene.rexUI.add.roundRectangle(0, 0, 0, 0, 0, GM.COLOR_DARK),

        buttons: {
            left: scene.rexUI.add.triangle(0, 0, 20, 20, GM.COLOR_PRIMARY).setDirection('left'),
            right: scene.rexUI.add.triangle(0, 0, 20, 20, GM.COLOR_PRIMARY).setDirection('right'),
        },

        slider: {
            thumb: scene.rexUI.add.roundRectangle(0, 0, 40, 20, 10, GM.COLOR_LIGHT),
        },

        space: {
            left: 5, right: 5, top: 5, bottom: 5, item: 5
        },
    })
}

export function label(scene,config)
{
    let color = config.color ?? GM.COLOR_DARK;
    let radius = config.radius ?? 5;
    let str = config.text ?? '';
    let space = config.space ?? 5;
    let fontSize = config.fontSize ?? GM.FONT_SIZE;
    let label = scene.rexUI.add.label({
        width: config.width,
        height: config.height,
        background: rect(scene,{color:color,radius:radius}),
        text: text(scene,{text:str, fontSize:fontSize}),
        space: space,
        align: 'center',
    });
    label.key = config.key;
    return label;
}

export function dropdown(scene, {width, space, options=[{text:'中文',value:'tw'},{text:'English',value:'us'}],stringOption=false,onchange})
{
    return scene.rexUI.add.dropDownList({
            // x: 400, y: 300,
            options: options,
            background: rect(scene,{color:GM.COLOR_GRAY, radius:10, strokeColor:GM.COLOR_WHITE, strokeThickness:3}),
            // icon: rect(scene, {color:GM.COLOR_DARK, radius:10}),
            text: text(scene, {text:'', align:'center'}).setFixedSize(width, 0),
            space: space,
            list: {
                    createBackgroundCallback: function (scene) {
                        return rect(scene, {color:GM.COLOR_GRAY});
                    },
                    createButtonCallback: function (scene, option, index, options) {
                        var txt = (stringOption) ? option : option.text;
                        var button = label(scene,{ text:txt, color:GM.COLOR_GRAY });
                        button.value = (stringOption) ? undefined : option.value;
                        return button;
                    },

                    // scope: dropDownList
                    onButtonClick: function (button, index, pointer, event) {
                        // Set label text, and value
                        console.log(`Select ${button.text}, value=${button.value}\n`);
                        this.text = button.text;
                        this.value = button.value;
                        
                    },

                    // scope: dropDownList
                    onButtonOver: function (button, index, pointer, event) {
                        button.getElement('background').setStrokeStyle(2, GM.COLOR_WHITE);
                    },

                    // scope: dropDownList
                    onButtonOut: function (button, index, pointer, event) {
                        button.getElement('background').setStrokeStyle();
                    },
                
                    // expandDirection: 'up',
                },

            setValueCallback: function (dropDownList, value, previousValue) {
                    console.log('setValueCallback',value);
                    const option = options.find(item => item.value === value);
                    dropDownList.text = option.text;
                    onchange?.(value)
                },

            value: undefined,

        })
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

    empty()
    {
        this.getElement('sprite').setTexture();
        this.getElement('count').setText('');
    }

}



