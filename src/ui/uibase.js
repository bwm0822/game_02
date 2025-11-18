import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {GM} from '../setting.js';

export function uRect(scene, config={})
{
    config.color = config.color ?? GM.COLOR_PRIMARY;
    const r = scene.rexUI.add.roundRectangle(config);

    if(this&&this.add) {this.add(r,config);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return r;
}

export function uSprite(scene, {x, y, icon, name, ext}={})
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

    if(this&&this.add) {this.add(sprite,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return sprite;
}

export function uBbc(scene, config={})    
{
    const {x,y,text,key,ext,...cfg} = config;
    cfg.fontSize = cfg.fontSize ?? GM.FONT_SIZE;
    cfg.fontFamily = cfg.fontFamily ?? GM.FONT;
    // 描邊 : 要用指令才有作用 [stroke=#000]text[/stroke]
    cfg.strokeThickness = cfg.strokeThickness ?? 3;   // 設成3才會有明顯描邊的效果
    // wrapWidth 用來控制最大寬度，超過自動換行
    cfg.wrapWidth && (cfg.wrap = {mode:'char',width:cfg.wrapWidth}); 
    //mode: 0|'none'|1|'word'|2|'char'|'character'|3|'mix'

    let t = scene.add.rexBBCodeText(x, y, text, cfg);
    t.key = key;
    
    if(this&&this.add) {this.add(t,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return t;
}

export function uBg(scene, config)
{   
    const r = uRect(scene, config);
    if(this&&this.addBackground) {this.addBackground(r, 'bg');}
    return r;
}

export function uPanel(scene, config={})
{
    const {color, ext, ...panelCfg} = config;
    const panel = scene.rexUI.add.sizer(panelCfg);
    if(color) {uBg.call(panel, scene, {color})}

    if(this&&this.add) {this.add(panel, ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return panel;
}

export function uButton(scene,{space, bg, text, icon, 
                        onover, onout, onclick, ext}={})
{
    const btn = scene.rexUI.add.sizer({space});

    
    if(bg) {uBg.call(btn, scene, bg);}
    if(text) {uBbc.call(btn, scene, {text});}
    if(icon) {uSprite.call(btn, scene, {icon});}

    let over = (on)=>{
        btn.children.forEach(child=>{
            child.setTint?.(on? GM.COLOR_GRAY : GM.COLOR_WHITE);
            child.setFillStyle?.(child.fillColor, on? 0.5 : 1);
        })
    }

    btn.setInteractive()
        .on('pointerover',()=>{over(true);onover?.();})
        .on('pointerout',()=>{over(false);onout?.();})
        .on('pointerdown',()=>{onclick?.()})

    if(this&&this.add) {this.add(btn,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return btn;
}

export function uTop(scene, {text,color,onclose}={})
{
    const row = scene.rexUI.add.overlapSizer();
    if(color) { uBg.call(row, scene, {color}); }
    if(text) { uBbc.call(row, scene, {text, ext:{align:'center',expand:false,key:'label'}}) }

    //{bg:strokeColor:GM.COLOR_GRAY,strokeWidth:2}
    uButton.call(row,scene,{
                            // bg:{},
                            // text:'X',
                            icon:GM.ICON_CLOSE,
                            ext:{align:'right',expand:false},
                            onclick:onclose,
                            })

   
    this.add(row,{padding:{left:0,right:0}, expand:true, key:'top'});
    return row;
}

// export function uScroll(scene, config1, config2)
// {
//     config1 = config1 ?? {};
//     const width = config1.width ?? 50;
//     const height = config1.height ?? 100;
//     const bg = config1.bg ?? {alpha:1,strokeColor:GM.COLOR_GRAY,strokeWidth:2};
//     const panelCfg = config1.panel ?? {orientation:'y',space:5}; 
//     config2 = config2 ?? {expand:true, key:'scroll'};

//     const scroll = scene.rexUI.add.scrollablePanel({
//         width: width,
//         height: height,
//         background: uRect(scene, bg),
//         panel: {child:scene.rexUI.add.sizer(panelCfg)},
//         slider: {
//             track: uRect(scene,{width:15,color:GM.COLOR_DARK}),
//             thumb: uRect(scene,{width:20,height:20,radius:5,color:GM.COLOR_LIGHT}),
//             space: 5,
//             hideUnscrollableSlider: false,
//             disableUnscrollableDrag: false,
//         },
//     });

//     const panel = scroll.getElement('panel');

//     // 操作介面
//     scroll.addItem = (item,config={align:'left'})=>{panel.add(item,config); return scroll;}
//     scroll.clearAll = ()=>{panel.removeAll(true); return scroll;}

//     if(this&&this.add) {this.add(scroll, config2);}
//     return scroll;
// }




// 沒有底色
export function uBar(scene, config={})
{
    const {ext, ...cfg}=config;
    cfg.height = cfg.height ?? 20;
    cfg.width = cfg.width ?? 100;
    cfg.barColor = cfg.barColor ?? GM.COLOR_GREEN;
    cfg.value = cfg.value ?? 0.5;
    const bar = scene.add.rexRoundRectangleProgress(cfg);

    if(this&&this.add) {this.add(bar,ext)}
    return bar;
}

// 有底色
export function uProgress(scene, config={})
{
    const {ext,...cfg}=config;
    cfg.height = cfg.height ?? 20;
    cfg.width = cfg.width ?? 100;
    cfg.barColor = cfg.barColor ?? GM.COLOR_GREEN;
    cfg.trackColor = cfg.trackColor ?? GM.COLOR_BLACK;
    //config.trackStrokeColor = config.trackStrokeColor ?? GM.COLOR_LIGHT,
    cfg.value = cfg.value ?? 0.5;
    const bar = scene.add.rexRoundRectangleProgress(cfg);

    if(this&&this.add) {this.add(bar,ext)}
    return bar;
}

// 有底色及文字
export function uTextProgress(scene, config={}) 
{
    let {text,ext,...cfg}=config;
    // 建立進度條
    cfg.barColor = cfg.barColor ?? GM.COLOR_RED;
    let bar = uProgress(scene,cfg);
    // 建立文字
    text = text ?? '0.5';
    let bbc = uBbc(scene,{text})
    // 建立 sizer，將 bar 與 text 疊在一起
    let sizer = scene.rexUI.add.overlapSizer()
    sizer.add(bar).add(bbc,{expand:false})

    // 添加 setHP 方法到 sizer
    sizer.set = function(current,max) {
        let percent = Phaser.Math.Clamp(current / max, 0, 1);
        bar.setValue(percent);
        text.setText(`${current}/${max}`);
        this.layout();

        // // 根據血量比例改變顏色
        // if (percent > 0.5) {
        //     bar.setColor(0x00ff00); // 綠色
        // } else if (percent > 0.2) {
        //     bar.setColor(0xffff00); // 黃色
        // } else {
        //     bar.setColor(0xff0000); // 紅色
        // }
    };

    // 初始設為滿血
    // sizer.setValue(50,100);

    if(this&&this.add) {this.add(sizer,ext)}
    return sizer;
}

export function uScroll(scene, {width,height,bg,column,row,space,ext}={})
{
    width = width ?? 50;
    height = height ?? 100;
    bg = bg ?? {alpha:1,strokeColor:GM.COLOR_GRAY,strokeWidth:2};
    column = column ?? 1;
    row = row ?? 1;
    space = space ?? {left:5,right:5,top:5,bottom:5,column:5,row:5};
    ext = ext ?? {expand:true, key:'scroll'};

    const scroll = scene.rexUI.add.scrollablePanel({
        width: width,
        height: height,
        background: uRect(scene, bg),
        panel: {child:scene.rexUI.add.gridSizer({column,row,space})},
        slider: {
            track: uRect(scene,{width:15,color:GM.COLOR_DARK}),
            thumb: uRect(scene,{width:20,height:20,radius:5,color:GM.COLOR_LIGHT}),
            space: 5,
            hideUnscrollableSlider: false,
            disableUnscrollableDrag: false,
        },
    });

    const panel = scroll.getElement('panel');

    // 操作介面
    scroll.addItem = (item,config={align:'left'})=>{panel.add(item,config); return scroll;}
    scroll.clearAll = ()=>{panel.removeAll(true); return scroll;}

    if(this&&this.add) {this.add(scroll, ext);}
    return scroll;
}

export function uGrid(scene, {column,row,bg,space,addItem,ext}={})
{
    column = column ?? 3;
    row = row ?? 3;
    bg = bg ?? {strokeColor:GM.COLOR_GRAY,strokeWidth:2};
    space = space ?? {column:5,row:5,left:5,right:5,top:5,bottom:5};
    addItem = addItem ?? function() {return uRect(scene,{color:GM.COLOR_GRAY,width:50,height:50})};

    // 1. 產生 grid
    const grid = scene.rexUI.add.gridSizer({
        column: column,
        row: row,
        space: space,
    });

    uBg.call(grid, scene, bg)

    // 2. 新增 Item
    if(addItem)
    {
        const count = column * row;
        for(let i=0; i<count; i++)
        {
            grid.add(addItem());
        }
    }

    // 3. 操作介面
    grid.update = (cb)=>{grid.getElement('items').forEach((item)=>{cb(item);})}

    if(this&&this.add) { this.add(grid,{key:'grid', ext}); }
    return grid;
}
