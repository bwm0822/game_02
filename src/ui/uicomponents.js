import {Sizer, OverlapSizer, ScrollablePanel, Toast, Buttons, TextArea} from 'phaser3-rex-plugins/templates/ui/ui-components.js';
import {GM, UI} from '../setting.js';
import ImageData from 'phaser3-rex-plugins/plugins/gameobjects/blitter/blitterbase/bob/image/ImageData.js';

export function uRect(scene, config={})
{
    const {interactive,onover,onout,ondown,...cfg}=config;
    cfg.color = cfg.color ?? GM.COLOR.PRIMARY;
    const r = scene.rexUI.add.roundRectangle(cfg);

    if(interactive)
    {
        r.setInteractive();
        if(onover){r.on('pointerover',()=>{onover()})};
        if(onout){r.on('pointerout',()=>{onout()})};
        if(ondown){r.on('pointerdown',()=>{ondown()})};
    }

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

export function uBg(scene, config={})
{   
    const r = uRect(scene, config);
    if(this&&this.addBackground) {this.addBackground(r, 'bg');}
    return r;
}

export function uPanel(scene, config={})
{
    let {bg, ext, ...panelCfg} = config;
    const panel = scene.rexUI.add.sizer(panelCfg);
    if(bg) {uBg.call(panel, scene, bg)}

    if(this&&this.add) {this.add(panel, ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return panel;
}

export function uLabel(scene, config={})
{
    const {ext,text,icon,bg,...cfg}=config;
    if(bg) {cfg.background=uRect(scene, bg);}
    if(text) {cfg.text=uBbc(scene, {text:text});}
    if(icon) {cfg.icon=uSprite(scene, {icon:icon});}
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

    const cDEF=GM.COLOR.GRAY;
    const cHL=GM.COLOR.WHITE;
    const cBG=GM.COLOR.LIGHT;

    const {onover, onout, ondown, onclick, ext, style=UI.BTN.DEF, ...cfg}=config;
    
    cfg.space = cfg.space ?? 5;

    switch(style)
    {
        case UI.BTN.DEF:
            cfg.bg = cfg.bg ?? {color:cBG, radius:10};
            break;

        case UI.BTN.ITEM:
            cfg.bg = cfg.bg ?? {color:cBG};
            break;
    }

    const btn = uLabel(scene, cfg);

    switch(style)
    {
        case UI.BTN.ITEM:
            btn._bg?.setAlpha(0);    // 不可以用setVisible(false)，因為加入scrollablePanel會被設成true
            btn._text?.setColor(cDEF);
            break;
    }

    const _over = (on)=>
    {
        switch(style)
        {
            case UI.BTN.DEF:
                btn._bg?.setFillStyle(btn._bg.fillColor,on?0.5:1);
                btn._text?.setTint(on?cDEF:cHL);
                btn._icon?.setTint(on?cDEF:cHL);
                break;

            case UI.BTN.ITEM:
                btn._bg?.setAlpha(on?1:0);
                break;
        }
    }

     // 提供外界操作
    btn.setHighlight = (on)=>{btn._text?.setColor(on?cHL:cDEF);}
    btn.setText = (text)=>{btn._text?.setText(text);}
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
    }

    // 事件偵測
    btn.setInteractive()
        .on('pointerover',()=>{_over(true);onover?.(btn);})
        .on('pointerout',()=>{_over(false);onout?.(btn);})
        .on('pointerdown',()=>{ondown?.(btn)})
        .on('pointerup',()=>{onclick?.(btn)})

    if(this&&this.add) {this.add(btn,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return btn;
}

export function uStat(scene, key, value, interactive=true, onover, onout)
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




    // let sizer = this.scene.rexUI.add.sizer({orientation:'x'});
    // if(value.max) {value=`${value.cur} / ${value.max}`;}
    // else if(value.den) {value=`${Math.floor(value.cur)} %`;}
    // sizer.addBackground(rect(this.scene,{color:GM.COLOR_LIGHT}),'bg')
    //     .add(bbcText(this.scene,{text:key.lab()}),{proportion:1})
    //     .add(bbcText(this.scene,{text:value}),{proportion:0})
    // let bg = sizer.getElement('bg').setAlpha(0);
    // if(interactive)
    // {
    //     sizer.p = key;
    //     sizer.setInteractive()
    //         .on('pointerover',()=>{ bg.alpha=1; Ui.delayCall(()=>{UiInfo.show(GM.IF_PROP,sizer);}) })
    //         .on('pointerout',()=>{ bg.alpha=0; Ui.cancelDelayCall(); UiInfo.close();})
    // }
    // return sizer;
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

export function uScroll(scene, {width,height,bg,space,ext}={})
{
    width = width ?? 50;
    height = height ?? 100;
    bg = bg ?? UI.BG.BORDER;
    space = space ?? {left:5,right:5,top:5,bottom:5,column:5,row:5};
    ext = ext ?? {expand:true, key:'scroll'};

    const scroll = scene.rexUI.add.scrollablePanel({
        width: width,
        height: height,
        background: uRect(scene, bg),
        panel: {child:scene.rexUI.add.sizer({space,orientation:'y'})},
        slider: {
            track: uRect(scene,{width:15,color:GM.COLOR.DARK}),
            thumb: uRect(scene,{width:20,height:20,radius:5,color:GM.COLOR.LIGHT}),
            space: 5,
            hideUnscrollableSlider: false,
            disableUnscrollableDrag: false,
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

            console.log('wheel')

            const speed = 0.001;
            scroll.setT(Phaser.Math.Clamp(scroll.t + dy * speed, 0, 1));
    }    

    // 操作介面
    scroll.addItem = (item,config={align:'left',expand:true})=>{_panel.add(item,config); return scroll;}
    scroll.clearAll = ()=>{_panel.removeAll(true); return scroll;}
    scroll.mouseWheel = (on)=>{
        if(on) {scene.input.on('wheel',wheel);}
        else {scene.input.off('wheel',wheel);}
    }

    scroll._panel = _panel;

    if(this&&this.add) {this.add(scroll, ext);}
    return scroll;
}

export function uGridScroll(scene, {width,height,bg,column,row,space,ext}={})
{
    width = width ?? 50;
    height = height ?? 100;
    bg = bg ?? UI.BG.BORDER;
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
            track: uRect(scene,{width:15,color:GM.COLOR.DARK}),
            thumb: uRect(scene,{width:20,height:20,radius:5,color:GM.COLOR.LIGHT}),
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

export function uGrid(scene, {column,row,bg,space,addItem,ext,test}={})
{
    column = column ?? 3;
    row = row ?? 3;
    bg = bg ?? UI.BG.BORDER;
    space = space ?? {column:5,row:5,left:5,right:5,top:5,bottom:5};
    if(!addItem && test)
    {
        addItem = function() {return uRect(scene,{color:GM.COLOR.GRAY,width:50,height:50})};
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
