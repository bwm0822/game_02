import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {GM, UI} from '../setting.js'
import {Pic} from '../uibase.js'
import Utility from '../utility.js'

export function uRect(scene, config={})
{
    const {interactive,onover,onout,ondown,ext,...cfg}=config;
    const r = scene.rexUI.add.roundRectangle(cfg);

    if(interactive)
    {
        r.setInteractive();
        if(onover){r.on('pointerover',()=>{onover()})};
        if(onout){r.on('pointerout',()=>{onout()})};
        if(ondown){r.on('pointerdown',()=>{ondown()})};
    }

    if(this&&this.add) {this.add(r,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return r;
}

export function uDiv(scene,config={})
{
    const {ext={expand:true,padding:{top:10,bottom:10}},...cfg}=config;
    cfg.width=cfg.width??100;
    cfg.height=cfg.height??1;
    cfg.color=cfg.color??GM.COLOR.GRAY;
    const r = uRect(scene,cfg);
    if(this&&this.add) {this.add(r,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return r;
}

export function uVspace(scene,height)
{
    const r = uRect(scene,{height:height});
    if(this&&this.add) {this.add(r);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
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

export function uDes(scene, text_or_config, wrapWidth=250)    
{
    const config={wrapWidth:wrapWidth,ext:{align:'left'}};
    if(typeof text_or_config === 'object')
    {
        Object.assign(config, text_or_config);
    }
    else
    {
        config.text=text_or_config;
    }
    
    if(this&&this.add){return uBbc.call(this,scene,config);}
    else {return uBbc(scene,config);}
    
}

export function uPic(scene, config={})
{
    const {w,h,ext,...cfg}=config;
    const pic = new Pic(scene,w,h,cfg);
    if(this&&this.add) {this.add(pic,ext);}
    return pic;
}

export function uBg(scene, config={})
{   
    const r = uRect(scene, config);
    if(this&&this.addBackground) {this.addBackground(r, 'bg');}
    return r;
}

export function uPanel(scene, config={})
{
    let {bg, ext, ...cfg} = config;
    const panel = scene.rexUI.add.sizer(cfg);
    if(bg) {uBg.call(panel, scene, bg)}

    if(this&&this.add) {this.add(panel, ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return panel;
}

export function uLabel(scene, config={})
{
    const {ext,text,icon,bg,...cfg}=config;
    if(bg) {cfg.background=uRect(scene, bg);}
    if(text) {cfg.text=uBbc(scene, typeof text === 'object' ? text : {text:text});}
    if(icon) {cfg.icon=uSprite(scene, typeof icon === 'object' ? icon : {icon:icon});}
    const lab = scene.rexUI.add.label(cfg); 
    lab._bg=cfg.background;
    lab._text=cfg.text;
    lab._icon=cfg.icon;
    if(this&&this.add) {this.add(lab, ext);}
    return lab;
}

export function uButton(scene,config={})
{
    // 避免 config 傳入非物件參數(如:123、null)時，產生錯誤
    if (typeof config !== 'object' || config === null) {config = {};}

    const {onover, onout, ondown, onclick, ext, 
            style=UI.BTN.DEF, 
            cDEF=GM.COLOR.GRAY,
            cHL=GM.COLOR.WHITE,
            cBG=GM.COLOR.LIGHT,
            ...cfg}=config;
    
    cfg.space = cfg.space ?? 5;

    switch(style)
    {
        case UI.BTN.BG:
        case UI.BTN.DEF:
            cfg.bg = cfg.bg ?? {color:cBG, radius:10};
            break;

        case UI.BTN.ITEM:
        case UI.BTN.OPTION:    
            cfg.bg = cfg.bg ?? {color:cBG};
            break;

        case UI.BTN.CHECK:
            cfg.text = '☐ ' + (cfg.text ?? '');
            break;
    }

    const btn = uLabel(scene, cfg);

    switch(style)
    {
        case UI.BTN.ITEM:
            btn._bg?.setAlpha(0);    // 不可以用setVisible(false)，因為加入scrollablePanel會被設成true
            btn._text?.setColor(cDEF);
            break;
        case UI.BTN.OPTION:  
            btn._bg?.setAlpha(0);    // 不可以用setVisible(false)，因為加入scrollablePanel會被設成true
            break;
        case UI.BTN.CHECK:
            btn.checked = false;
            break;
    }

    const _over = (on)=>
    {
        switch(style)
        {
            case UI.BTN.BG:
                btn._bg?.setFillStyle(btn._bg.fillColor,on?0.5:1);
                break;
            case UI.BTN.DEF:
                btn._bg?.setFillStyle(btn._bg.fillColor,on?0.5:1);
                btn._text?.setTint(on?cDEF:cHL);
                btn._icon?.setTint(on?cDEF:cHL);
                break;
            case UI.BTN.ITEM:
            case UI.BTN.OPTION:
                btn._bg?.setAlpha(on?1:0);
                break;
        }
    }

     // 提供外界操作
    btn.setValue = (on)=>{
        if(style===UI.BTN.CHECK)
        {
            btn.checked = on;
            const pre = on?'☐':'☑';
            const post = on?'☑':'☐';
            btn._text.setText(btn._text.text.replace(pre,post));
        }
        else
        {
            btn._text?.setColor(on?cHL:cDEF);
        }

        return btn;
    }
    btn.setText = (text)=>{btn._text?.setText(text); return btn;}
    btn.setEnable = (on)=>{
        if(on) {    
            btn.setInteractive();
            btn._text?.setAlpha(1);
            btn._icon?.setAlpha(1);
        }
        else {  
            btn.disableInteractive();
            btn._text?.setAlpha(0.5);
            btn._icon?.setAlpha(0.5);
        }
        return btn;
    }

    // 事件偵測
    btn.setInteractive()
        .on('pointerover',()=>{_over(true);onover?.(btn);})
        .on('pointerout',()=>{_over(false);onout?.(btn);})
        .on('pointerdown',()=>{ondown?.(btn)})
        .on('pointerup',()=>{
            if(style===UI.BTN.CHECK) {btn.setValue(!btn.checked);}
            onclick?.(btn)
        })

    if(this&&this.add) {this.add(btn,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return btn;
}

export function uStat(scene, key, value, {interactive=true, onover, onout}={})
{
    const p = uPanel(scene);

    if(interactive)
    {
        const bg = uBg.call(p, scene, {color:GM.COLOR.LIGHT})
        bg.alpha=0;
        p.setInteractive()
        .on('pointerover',()=>{ bg.alpha=1; onover?.(); })
        .on('pointerout',()=>{ bg.alpha=0; onout?.(); })
    }

    uBbc.call(p, scene, {text:key, ext:{proportion:1}});
    uBbc.call(p, scene, {text:value});

    if(this&&this.add) {this.add(p, {expand:true});}
    return p;
}

export function uTop(scene, {text,color,onclose}={})
{
    const row = scene.rexUI.add.overlapSizer();
    if(color) { uBg.call(row, scene, {color}); }
    if(text) { uBbc.call(row, scene, {text, ext:{align:'center',expand:false,key:'label'}}) }

    //{bg:strokeColor:GM.COLOR_GRAY,strokeWidth:2}
    uButton.call(row,scene,{
                            icon: GM.ICON_CLOSE,
                            bg: {},
                            space: 0,
                            ext: {align:'right',expand:false},
                            onclick: onclose,
                            })

    if(this&&this.add) {this.add(row,{padding:{left:0,right:0}, expand:true, key:'top'});}
    return row;
}

// 沒有底色
export function uBar(scene, config={})
{
    const {ext, ...cfg}=config;
    cfg.height = cfg.height ?? 20;
    cfg.width = cfg.width ?? 100;
    cfg.barColor = cfg.barColor ?? GM.COLOR.GREEN;
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
    cfg.barColor = cfg.barColor ?? GM.COLOR.GREEN;
    cfg.trackColor = cfg.trackColor ?? GM.COLOR.BLACK;
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
    cfg.barColor = cfg.barColor ?? GM.COLOR.RED;
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
        bbc.setText(`${current}/${max}`);
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

export function uScroll(scene, {width, height, bg,
                                space,
                                ext,
                                style,
                                column, row,
                                hideUnscrollableSlider,
                                disableUnscrollableDrag}={})
{

    const getPanel = ()=>{
        switch(style)
        {
            case UI.SCROLL.DEF:
                return scene.rexUI.add.sizer({space,orientation:'y'});
            case UI.SCROLL.GRID:
                return scene.rexUI.add.gridSizer({column,row,space});
            case UI.SCROLL.CON:
                return scene.add.container();
        }
    }

    width = width ?? 50;
    height = height ?? 100;
    bg = bg ?? UI.BG.BORDER;
    space = space ?? {...UI.SPACE.LRTB_5,column:5,row:5};
    ext = ext ?? {expand:true};
    hideUnscrollableSlider = hideUnscrollableSlider ?? false;
    disableUnscrollableDrag = disableUnscrollableDrag ?? false;
    style = style ?? UI.SCROLL.DEF;
    column = column ?? 1;
    row = row ?? 1;

    const scroll = scene.rexUI.add.scrollablePanel({
        width: width,
        height: height,
        background: uRect(scene, bg),
        panel: {child:getPanel()},
        slider: {
            track: uRect(scene,{width:15,color:GM.COLOR.DARK}),
            thumb: uRect(scene,{width:20,height:20,radius:5,color:GM.COLOR.LIGHT}),
            space: 5,
            hideUnscrollableSlider: hideUnscrollableSlider,
            disableUnscrollableDrag: disableUnscrollableDrag,
            buttons: {
                left: scene.rexUI.add.triangle(0, 0, 20, 20, GM.COLOR.DARK).setDirection('up'),
                right: scene.rexUI.add.triangle(0, 0, 20, 20, GM.COLOR.DARK).setDirection('down'),
                // step: 0.01,
            },
        },
    });

    const _panel = scroll.getElement('panel');

    const wheel = (pointer, gameObjects, dx, dy)=>{
        const x = pointer.worldX;
        const y = pointer.worldY;
        const bounds = scroll.getBounds();

        if (!Phaser.Geom.Rectangle.Contains(bounds, x, y)) {
            return;
        }
        
        const speed = 0.001;
        scroll.setT(Phaser.Math.Clamp(scroll.t + dy * speed, 0, 1));
    }    

    // 操作介面    
    scroll.addItem = (item,config)=>{
        config = config ?? (style === UI.SCROLL.DEF ? {align:'left',expand:true}
                                                    : style === UI.SCROLL.GRID ? {align:'left'}
                                                                                : {});
        _panel.add(item,config); 
        return scroll;
    }

    scroll.clearAll = ()=>{_panel.removeAll(true); return scroll;}
    scroll.setContentSize = (w,h)=>{_panel.setSize(w,h); return scroll;}
    scroll.mouseWheel = (on)=>{
        if(on) {scene.input.on('wheel',wheel);}
        else {scene.input.off('wheel',wheel);}
    }

    scroll._panel = _panel;

    if(this&&this.add) {this.add(scroll, ext);}
    return scroll;
}

export function uFix(scene, config={})
{
    let {bg, ext, ...cfg} = config;
    const fix = scene.rexUI.add.fixWidthSizer(cfg);
    if(bg) {uBg.call(fix, scene, bg)}

    if(this&&this.add) {this.add(fix, ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return fix;
}

export function uGrid(scene, {column,row,bg,space,addItem,ext,test}={})
{
    column = column ?? 3;
    row = row ?? 3;
    bg = bg ?? UI.BG.BORDER;
    space = space ?? {column:5,row:5,left:5,right:5,top:5,bottom:5};
    if(!addItem && test)
    {
        addItem = function() {return uRect(scene,
                {color:GM.COLOR.GRAY,width:50,height:50})};
    }

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
        const count = column*row;
        for(let i=0; i<count; i++)
        {
            const itm = addItem(i);
            itm&&grid.add(itm);
        }
    }

    // 3. 操作介面
    grid.loop = (cb)=>{grid.getElement('items').forEach((item)=>{cb(item);})}

    if(this&&this.add) { this.add(grid,{key:'grid', ...ext}); }
    return grid;
}

export function uTabs(scene,{btns,onclick,onover,onout})
{
    let previous;
    const cDEF = GM.COLOR.DARK;
    const cSEL = GM.COLOR.PRIMARY; 
    const cBG = GM.COLOR.BLACK;
    
    let config = {
        // background: uRect(scene,{color:cBG,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
        background: uRect(scene,{color:cBG}),
        topButtons: btns.map((btn)=>{return uLabel(scene,{space:10,bg:{color:cDEF,radius:{tl:20,tr:20}},...btn})}),
        space: {left:5, right:5, top:5, bottom:0, topButton:10}
    }

    let tabs = scene.rexUI.add.tabs(config); 

    // 提供給外界操作
    tabs.init = ()=>{tabs.emitButtonClick('top',0);}

    // events
    tabs.on('button.click', (button, groupName, index)=>{
           if(previous) {previous._bg.setFillStyle(cDEF);}
           previous=button;
           button._bg.setFillStyle(cSEL);
           onclick?.(button);
        })

    tabs.on('button.over', (button, groupName, index)=>{
        onover?.();
    })

    tabs.on('button.out', (button, groupName, index)=>{
        onout?.();
    })

    if(this&&this.add) {this.add(tabs,{expand:true,key:'tags'});}

    return tabs;
}

export function uSlider(scene,{width=100,trackRadius=10,thumbRadius=20,onchange,gap,space,ext}={})
{
    const s = scene.rexUI.add.slider({
        orientation: 'x',
        width: width,
        track: uRect(scene,{color:GM.COLOR_DARK,radius:trackRadius}),
        thumb: uRect(scene,{color:GM.COLOR_LIGHT,radius:thumbRadius}),
        valuechangeCallback: function(value){onchange?.(value)},
        gap: gap,
        space: space,
        //thumbOffsetY: -10,
        //space: {top: 4,bottom: 4},
        //input: 'drag', // 'drag'|'click'
    })

    if(this&&this.add) {this.add(s,ext);}

    return s;
}

export function uValueSlider(scene,config={})
{
    let {ext}=config;
    let _min=0,_max=10;
    ext = ext??{expand:true};

    const p = uPanel(scene,{space:{item:10}})
    const lab = uLabel(scene,{  bg:{color:GM.COLOR.DARK},
                                text:'0',width:50,height:50,
                                align:'center'});
    const s = uSlider(scene);

    s.on('valuechange', (value) => {
        p.value = Math.round(_min+value*(_max-_min));
        lab.setText(p.value)
        lab.layout();
    })
    p.add(lab)
    p.add(s,{proportion:1});

    // 操作介面
    p.setRange = (min,max,value)=>{
        _min=min;_max=max;
        if(value)
        {
            value = Utility.clamp(value,min,max);
            s.setValue((value-min)/(max-min));
            p.value=value;   
        }
        else
        {
            s.setValue(0);
            p.value=min;
        }
        lab.setText(p.value)
        lab.layout();
    }
    p.setValue = (val)=>{s.setValue(val);}

    if(this&&this.add) {this.add(p,ext);}
    return p;
}

export function uDropdown(scene, {width=100,space={top:5,bottom:5},ext,
                                text='----', 
                                options=[{text:'中文',value:'tw'},{text:'English',value:'us'}],
                                stringOption=false,
                                onchange}={})
{

    const config = {
        // x: 400, y: 300,
        options: options,
        // background: uRect(scene,{color:GM.COLOR_GRAY, radius:10, strokeColor:GM.COLOR_WHITE, strokeThickness:3}),
        background: uRect(scene,{color:GM.COLOR.GRAY}),
        // icon: rect(scene, {color:GM.COLOR_DARK, radius:10}),
        text: uBbc(scene, {text:text, align:'center'}).setFixedSize(width, 0),
        space: space,
        list: {
            createBackgroundCallback: function (scene) {
                return uRect(scene, {color:GM.COLOR.GRAY,strokeColor:GM.COLOR.WHITE, strokeThickness:3});
            },
            createButtonCallback: function (scene, option, index, options) {
                var txt = (stringOption) ? option : option.text;
                var button = uLabel(scene,{ text:{text:txt,padding:5}, bg:{color:GM.COLOR.GRAY} });
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
                // button.getElement('background').setStrokeStyle(2, GM.COLOR_WHITE);
                button._bg.setFillStyle(GM.COLOR.LIGHTGRAY);
            },

            // scope: dropDownList
            onButtonOut: function (button, index, pointer, event) {
                // button.getElement('background').setStrokeStyle();
                button._bg.setFillStyle(GM.COLOR.GRAY);
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
    }

    const dd = scene.rexUI.add.dropDownList(config)

    if(this&&this.add) {this.add(dd,ext);}
    return dd;
}

export function uInput(scene, config={})
{
    const width = config.width ?? 100;
    const height = config.height ?? 36;
    const bg = config.bg ?? {color:GM.COLOR.LIGHT};
    
    const p = uPanel(scene)
    
    const input = uLabel.call(p,scene,{bg:bg,
                                text:{fixedWidth:width, 
                                        fixedHeight:height, 
                                        valign:'center'}})
    input.setInteractive()
        .on('pointerdown', function () {
            const config = {
                enterClose: false,
                onTextChanged: (textObject, text) =>{textObject.text=text;}
            }
            scene.rexUI.edit(input._text, config);
        });

    p.addSpace();

    uButton.call(p, scene,{text:'送出',
                            style:UI.BTN.BG,
                            onclick: ()=>{
                                config.onclick?.(p.getValue());
                                p.clearInput();
                    }});

    if(this&&this.add) {this.add(p,config.ext);}

    // 提供外界操作
    p.clearInput = ()=>{input._text.setText('');};
    p.getValue = ()=>{return input._text.text;};

    return p;
}
