import {OverlapSizer} from 'phaser3-rex-plugins/templates/ui/ui-components.js'
import {GM, UI} from '../core/setting.js'
import Utility from '../core/utility.js'

export class Pic extends OverlapSizer
{
    constructor(scene, w, h, config={})
    {            
        const{
            x, y, space=2, 
            icon, 
            bg={color:GM.COLOR.GRAY,radius:0,alpha:1,
                strokeColor:GM.COLOR.WHITE,strokeWidth:2}
        }=config;

        super(scene, x, y, w, h,{space:space});
        this.addBackground(uRect(scene,bg),'background')
        this._sp=uImage.call(this,scene,{icon:icon,ext:{aspectRatio:true,padding:0}})
        this.layout()

        scene.add.existing(this);
    }

    setIcon(icon,{tint=0xffffff,alpha=1}={})
    {
        let [key,frame] = icon ? icon.split(':') : [undefined,undefined];
        const sp=this._sp;
        sp.setTexture(key,frame).setTint(tint).setAlpha(alpha);
        sp.rexSizer.aspectRatio = sp.width/sp.height;
        this.layout();
        return this;
    }
}

export class Icon extends OverlapSizer
{
    constructor(scene, w, h, config={})
    {
        const{
            x, y, space=10, 
            fontSize=20,
            count,
            icon, 
            bg={color:GM.COLOR.SLOT,radius:0,alpha:1},
        }=config;

        super(scene, x, y, w, h,{space:space});
        this.addBackground(uRect(scene,bg),'background')
        this._sp=uImage.call(this,scene,{icon:icon,ext:{aspectRatio:true,padding:0}})
        this._bbc=uBbc.call(this,scene,{text:count,fontSize:fontSize,color:'#fff',strokeThickness:5,
                                        ext:{align:'right-bottom',expand:false,offsetY:space,offsetX:space}})
        this.layout()

        scene.add.existing(this);

    }

    setIcon(icon,{tint=0xffffff,alpha=1}={})
    {
        let [key,frame] = icon ? icon.split(':') : [undefined,undefined];
        const sp = this._sp;
        sp.setTexture(key,frame).setTint(tint).setAlpha(alpha);
        sp.rexSizer.aspectRatio = sp.width/sp.height;
        this.layout();
        return this;
    }

    setCount(count)
    {
        this._bbc.setText(`[stroke=#000]${count}[/stroke]`)
        this.layout();
        return this;
    }

    empty()
    {
        this._sp.setTexture();
        this._bbc.setText('');
    }

}

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
    const [atlas, frame] = icon ? icon.split(':'):[];
    const sprite = scene.add.sprite(x,y,atlas,frame);
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

export function uImage(scene, {x, y, icon, name, ext}={})
{
    const [atlas, frame] = icon ? icon.split(':'):[];
    const img = scene.add.image(x,y,atlas,frame);
    name && (img.name = name);

    if(this&&this.add) {this.add(img,ext);}  // 如果有 this，表示是在 Sizer 裡面建立的，就加到 Sizer 裡面去
    return img;
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
    const {ext,text,icon,tcon,bg,...cfg}=config;
    if(bg) {cfg.background=uRect(scene, bg);}
    if(text!==undefined) {cfg.text=uBbc(scene, typeof text==='object'?text:{text:text});}
    if(icon) {cfg.icon=uSprite(scene, typeof icon==='object'?icon:{icon:icon});}
    if(tcon) {cfg.icon=uBbc(scene, typeof text==='object'?icon:{text:tcon});}
    
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
            prefix=true,
            cDEF=GM.COLOR.GRAY,
            cHL=GM.COLOR.WHITE,
            cBG=GM.COLOR.DARK,
            cBGH=GM.COLOR.LIGHTGRAY,
            ...cfg}=config;
    
    cfg.space = cfg.space ?? UI.SPACE.LRTBI.p10;

    const UCHK = (style===UI.BTN.CHECK)?'☐':'▸';
    const CHK = (style===UI.BTN.CHECK)?'☑':'▾';

    switch(style)
    {
        case UI.BTN.DEF:
            cfg.bg = cfg.bg ?? {color:cBG, radius:10};
            break;
        case UI.BTN.DROP:
            cfg.bg = cfg.bg ?? {color:cDEF};
            break;
        case UI.BTN.ITEM:
        case UI.BTN.OPTION:    
            cfg.bg = cfg.bg ?? {color:cBGH};
            break;

        case UI.BTN.CHECK:
        case UI.BTN.FOLD:
            if(prefix)
            {
                cfg.tcon = UCHK;

                // if(typeof cfg.text==='object')
                //     cfg.text = UCHK+' '+(cfg.text?.text??'');
                // else
                //     cfg.text = UCHK+' '+(cfg.text??'');
            }
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
        case UI.BTN.FOLD:
            btn.value = false;
            break;
    }

    const _over = (on)=>
    {
        switch(style)
        {
            case UI.BTN.DEF:
                if(btn._bg) 
                {
                    // btn._bg.setFillStyle(btn._bg.fillColor,on?0.5:1);
                    btn._bg.setFillStyle(on?cBGH:cBG);
                }
                else
                {
                    btn._text?.setTint(on?cDEF:cHL);
                    btn._icon?.setTint(on?cDEF:cHL);
                }
                break;
            case UI.BTN.ITEM:
            case UI.BTN.OPTION:
                btn._bg?.setAlpha(on?1:0);
                break;
        }
    }

     // 提供外界操作
    btn.setValue = (on)=>{
        if(style===UI.BTN.CHECK||style===UI.BTN.FOLD)
        {
            btn.value = on;
            // const pre = on?UCHK:CHK;
            // const post = on?CHK:UCHK;
            // btn._text.setText(btn._text.text.replace(pre,post));
            btn._icon.setText(on?CHK:UCHK);
        }
        else
        {
            btn._text?.setColor(on?cHL:cDEF);
        }

        return btn;
    }
    btn.setText = (text)=>{btn._text?.setText(text); return btn;}
    btn.setEnable = (on)=>{
        // console.log(`${btn._text.text} : ${on}`)
        if(on) {    
            btn.setInteractive();
            btn._text?.setAlpha(1);
            btn._icon?.setAlpha(1);
        }
        else {  
            btn.disableInteractive();
            btn._text?.setAlpha(0.5);
            btn._icon?.setAlpha(0.5);
            style===UI.BTN.DEF&&btn._bg.setFillStyle(cBG);
        }
        return btn;
    }

    // 事件偵測
    btn.setInteractive()
        .on('pointerover',()=>{_over(true);onover?.(btn);})
        .on('pointerout',()=>{_over(false);onout?.(btn);})
        .on('pointerdown',()=>{ondown?.(btn)})
        .on('pointerup',()=>{
            if(style===UI.BTN.CHECK||style===UI.BTN.FOLD) {btn.setValue(!btn.value);}
            onclick?.(btn);            
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
                            bg: false,
                            space: 0,
                            ext: {align:'right',expand:false},
                            onclick: onclose,
                            })

    if(this&&this.add) {this.add(row,{padding:{left:0,right:0}, expand:true, key:'top'});}
    return row;
}

export function uBar(scene, config={})
{
    const {ext,...cfg}=config;
    cfg.height = cfg.height ?? 20;
    cfg.width = cfg.width ?? 100;
    cfg.barColor = cfg.barColor ?? GM.COLOR.GREEN;
    // cfg.trackColor = cfg.trackColor ?? GM.COLOR.BLACK;   // 底色
    // cfg.trackStrokeColor = config.trackStrokeColor;      // 邊框
    cfg.value = cfg.value ?? 0.5;
    const bar = scene.add.rexRoundRectangleProgress(cfg);

    if(this&&this.add) {this.add(bar,ext)}
    return bar;
}

export function uProgressBase(scene, config={})
{
    const {ext,style=UI.PROGRESS.BGV,width=100,height=20,...cfg}=config;
    // 建立 sizer，將 bar 與 text 疊在一起
    let p = scene.rexUI.add.overlapSizer({width:width, height:height})
    if(this&&this.add) {this.add(p,ext)}

    if(style===UI.PROGRESS.BGNV || style===UI.PROGRESS.BGV) {cfg.trackColor=cfg.trackColor??GM.COLOR.BLACK;}
    p.bar = uBar.call(p,scene,cfg)
    if(style===UI.PROGRESS.BGV || style===UI.PROGRESS.NBV) {p.bbc = uBbc.call(p,scene,{text:p.bar.value,ext:{expand:false}})}

    // 操作介面
    p.setValue = function(current,max) 
    {
        if(max)
        {
            const percent = Phaser.Math.Clamp(current / max, 0, 1);
            p.bar.setValue(percent);
            p.bbc?.setText(`${current} / ${max}`);
        }
        else
        {
            p.bar.setValue(current);
            p.bbc?.setText(`${Math.round(current*100)}%`);
        }
        p.layout();

        return p;

        // // 根據血量比例改變顏色
        // if (percent > 0.5) {
        //     bar.setColor(0x00ff00); // 綠色
        // } else if (percent > 0.2) {
        //     bar.setColor(0xffff00); // 黃色
        // } else {
        //     bar.setColor(0xff0000); // 紅色
        // }
    };

    return p;
}

export function uProgress(scene, config)
{
    const {
        title,
        width,
        height,
        space={item:10},
        ext,
        ...cfg}=config;

    const p = scene.rexUI.add.sizer({width:width, height:height, space:space})
    if(this&&this.add) {this.add(p,ext)}

    if(title) {p.t=uBbc.call(p,scene,{text:title})}
    p.p = uProgressBase.call(p,scene,{...cfg,ext:{expand:true,proportion:1}});

    // 操作介面
    p.setValue = function(...args){
        p.p.setValue(...args);
        p.layout();
        return p;
    }

    return p;
}

export function uScroll(scene, config={})
{
    const{
        width = 50,
        height = 100,
        bg = UI.BG.BORDER,
        space = {...UI.SPACE.LRTB_5,column:5,row:5},
        ext = {expand:true},
        hideUnscrollableSlider = true,
        disableUnscrollableDrag = true,
        style = UI.SCROLL.DEF,
        column = 1,
        row = 1,
        scrollMode = 0, //0: vertical, 1: horizontal, 2: both
        // style = UI.SCROLL.CON 時，需要設定 con_w,con_h
        con_w = 0, 
        con_h = 0,
        clampChildOX=false,   // 水平不超界
        clampChildOY=false,   // 垂直不超界
    }=config

    const getPanel = ()=>{
        switch(style)
        {
            case UI.SCROLL.DEF:
                return scene.rexUI.add.sizer({space,orientation:'y'});
            case UI.SCROLL.GRID:
                return scene.rexUI.add.gridSizer({column,row,space});
            case UI.SCROLL.CON:
                const con = scene.add.container();
                con.width = con_w;
                con.height = con_h;
                return con;
        }
    }

    // slider 的設定，scrollMode=2 時，不顯示 slider，否則畫面左上角會有一個小方塊
    const slider = scrollMode === 2 ? {} : 
            {
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
            };

    const scroll = scene.rexUI.add.scrollablePanel({
        width: width,
        height: height,
        background: uRect(scene, bg),
        panel: {child:getPanel()},
        scrollMode: scrollMode,
        slider: slider,
        clampChildOX: clampChildOX,
        clampChildOY: clampChildOY,
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
    
    scroll._panel = _panel;

    if(this&&this.add) {this.add(scroll, ext);}

    // 操作介面  
    scroll.addItem = (item,config)=>{
        config = config ?? 
                (style===UI.SCROLL.DEF ? {align:'left',expand:true}
                                        : style === UI.SCROLL.GRID ? {align:'left'}
                                                                    : {});
        _panel.add(item,config); 
        return scroll;
    }
    scroll.add = scroll.addItem; 
    scroll.clearAll = ()=>{_panel.removeAll(true); return scroll;}
    scroll.setContentSize = (w,h)=>{_panel.setSize(w,h); return scroll;}
    scroll.mouseWheel = (on)=>{
        if(on) {scene.input.on('wheel',wheel);}
        else {scene.input.off('wheel',wheel);}
    }
    scroll.getChildren =()=>{return _panel.getChildren()??_panel.list;}

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

export function uTabs(scene,{top,bottom,left,right,onclick,createpanel,onover,onout})
{
    let previous;
    const cDEF = GM.COLOR.DARK;
    const cSEL = GM.COLOR.PRIMARY; 
    const cBG = GM.COLOR.DARK;
    
    let config = {
        // background: uRect(scene,{color:cBG,strokeColor:GM.COLOR_GRAY,strokeWidth:2}),
        background: uRect(scene,{color:cBG}),
        topButtons: top?.map((btn)=>{return uLabel(scene,{space:10,bg:{color:cDEF,radius:{tl:20,tr:20}},...btn})}),
        leftButtons: left?.map((btn)=>{return uLabel(scene,{space:10,bg:{color:cDEF,radius:{tl:20,bl:20}},...btn})}),
        rightButtons: right?.map((btn)=>{return uLabel(scene,{space:10,bg:{color:cDEF,radius:{tr:20,br:20}},...btn})}),
        bottomButtons: bottom?.map((btn)=>{return uLabel(scene,{space:10,bg:{color:cDEF,radius:{bl:20,br:20}},...btn})}),
        space: {left:5, right:5, top:5, bottom:5, leftButton:10, rightButton:10, topButton:10, bottomButton:10},
        panel: createpanel?.(),
    }

    let tabs = scene.rexUI.add.tabs(config); 

    // 提供給外界操作
    tabs.init = (groupName='top')=>{tabs.emitButtonClick(groupName,0);}

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

export function uSliderBase(scene,config={})
{
    const{
        width=100,
        trackRadius=10,
        thumbRadius=20,
        onchange,
        gap,
        space,
        value=0,    // 如果沒設成undefined，create時，會呼叫valuechange(value)
        ext
    }=config;

    const s = scene.rexUI.add.slider({
        orientation: 'x',
        width: width,
        track: uRect(scene,{color:GM.COLOR_DARK,radius:trackRadius}),
        thumb: uRect(scene,{color:GM.COLOR_LIGHT,radius:thumbRadius}),
        gap: gap,
        space: space,
        value: value,
        valuechangeCallback: function(newValue, prevValue){onchange?.(newValue, prevValue)},
        //thumbOffsetY: -10,
        //space: {top: 4,bottom: 4},
        //input: 'drag', // 'drag'|'click'
    })

    if(this&&this.add) {this.add(s,ext);}

    return s;
}

export function uSlider(scene,config={})
{ 
    const {
        style=UI.SLIDER.VL,
        ext={expand:true},
        icon,
        bg={color:GM.COLOR.DARK,
            strokeColor:GM.COLOR.WHITE,
            strokeWidth:2,
            radius:10},
        width=100,
        dp=0,
        space={item:10},
        onchange,
    }=config;

    let {min=0,max=1,gap}=config;

    const C = {fSize:40,w:50,h:50};

    // let icons=['🔇','🔈','🔉','🔊'];
    // let gap=1/(icons.length-1);
    const icons = Array.isArray(icon) ? [...icon] : [icon];
    gap = gap ?? icons.length>1 ? 1/(icons.length-1) : 0;

    const valuechange=(newValue, prevValue)=>{
        p.value = getVal(newValue,dp)
        if(p.l) {p.l.setText(p.value).layout();}
        if(p.i) {p.i.setText(getIcon(newValue));}
        // 判斷prevValue，避免create時，呼叫onchange
        if(prevValue!==undefined) {onchange?.(p.value)}
    }
    const getVal=(value,dp=0)=>{
        let f = Math.pow(10,dp);
        let v = min+value*(max-min);
        return Math.round(v*f)/f;
    }

    const getIcon=(value)=>{
        let i = gap===0 ? 0 : Math.round(value/gap);
        return icons[i];
    }

    const p = uPanel(scene,{width:width,space:space});

    switch(style)
    {
        case UI.SLIDER.NV:
            if(icon){p.i=uBbc.call(p,scene,{text:icons[0],fontSize:C.fSize});}
            p.s=uSliderBase.call(p,scene,{gap:gap,
                                    ext:{proportion:1},onchange:valuechange})
            break;
        case UI.SLIDER.VR:
            if(icon){p.i=uBbc.call(p,scene,{text:icons[0],fontSize:C.fSize});}
            p.s=uSliderBase.call(p,scene,{gap:gap,
                                    ext:{proportion:1},onchange:valuechange})
            p.l=uLabel.call(p,scene,{text:0,align:'center',bg:bg,width:C.w,height:C.h})
            break;
        case UI.SLIDER.VL:
            p.l=uLabel.call(p,scene,{text:0,align:'center',bg:bg,width:C.w,height:C.h})
            p.s=uSliderBase.call(p,scene,{gap:gap,
                                    ext:{proportion:1},onchange:valuechange})
            if(icon){p.i=uBbc.call(p,scene,{text:icons[0],fontSize:C.fSize});}
            break;
    }
    
    if(this&&this.add) {this.add(p,ext);}

    // 操作介面
    p.setRange = (vmin,vmax,value)=>{
        min=vmin; max=vmax;
        if(value)
        {
            value = Utility.clamp(value,min,max);
            p.s.setValue((value-min)/(max-min));
            p.value=value;   
        }
        else
        {
            p.s.setValue(0);
            p.value=min;
        }
        p.l?.setText(p.value)?.layout();
        return p;
    }

    p.setValue = (val)=>{p.s.setValue(val); return p;}

    return p;
    
}

export function uDropdownBase(scene,config={})
{
    const { 
        text='----',
        options=[{text:'中文',value:'tw'},{text:'English',value:'us'}],
        align='center',
        ext,
        onchange,
    }=config;

    let _list=null,_timer=null;

    const setValue=(opt)=>{
        dd._text.setText(opt.text);
        onchange?.(opt.value);
        return dd;
    }
    const removeList=()=>{
        scene.input.off('pointerup',removeList);
        _list?.destroy();
        _list=null;
        _timer=null;
    }
    const createList=(btn)=>{
        const width = btn.right - btn.left;
        _list = uPanel(scene,{x:btn.left,y:btn.bottom,
                        // width:100,
                        orientation:'y',
                        bg:{color:GM.COLOR.GRAY,
                            strokeColor:GM.COLOR.WHITE,
                            strokeWidth:1}})
                        .setOrigin(0)
                        
        options.forEach((opt)=>{
            uButton.call(_list,scene,{text:opt.text,
                                    width:width,
                                    align:align,
                                    style:UI.BTN.OPTION,
                                    onclick:()=>{setValue(opt);}})
        })

        _list.layout()

        // 
        _timer && clearTimeout(_timer);
        _timer = setTimeout(()=>{scene.input.on('pointerup',removeList);}, 100)
    }
    const onclick=(btn)=>{
        if(_list===null) {createList(btn);}
        else {removeList();}
    }

    const dd = uButton(scene,{text:text,style:UI.BTN.DROP,onclick:onclick,align:align});
    if(this&&this.add) {this.add(dd,ext);}

    // 操作介面
    dd.setValue=(value)=>{
        const option = options.find(item => item.value === value);
        setValue(option);
        return dd;
    }

    return dd;
}

export function uDropdown(scene,config={})
{
    const {
        title,
        width,
        ext={expand:true},
        ...cfg
    }=config;

    const p = uPanel(scene,{width:width,space:{item:10}});
    if(title) {uBbc.call(p,scene,{text:title,fontSize:40})}
    const ddb = uDropdownBase.call(p,scene,{...cfg,ext:{proportion:1}});

    if(this&&this.add) {this.add(p,ext)}

    // 操作介面
    p.setValue=(v)=>{ddb.setValue(v); return p;}

    return p;
}

export function uInput(scene, config={})
{
    const{
        width=100,
        height=36,
        bg={color:GM.COLOR.LIGHT},
        btn=true,
        onclick,
        onenter,
    }=config;
    
    const p = uPanel(scene)
    
    const input = uLabel.call(p,scene,{bg:bg,
                                text:{fixedWidth:width, 
                                        fixedHeight:height, 
                                        valign:'center'}})
    input.setInteractive()
        .on('pointerdown', function () {
            const config = {
                enterClose: btn?false:true,
                onTextChanged: (textObject, text) =>{textObject.text=text;},
                onClose: (textObject) => {onenter?.(textObject.text);}
            }
            scene.rexUI.edit(input._text, config);
        });

    if(btn)
    {
        p.addSpace();
        uButton.call(p, scene,{text:'送出',
                                onclick: ()=>{
                                    onclick?.(p.getValue());
                                    p.clearInput();
                        }});
    }

    if(this&&this.add) {this.add(p,config.ext);}

    // 提供外界操作
    p.clearInput = ()=>{input._text.setText('');};
    p.getValue = ()=>{return input._text.text;};

    return p;
}

export function uFold(scene,config={})
{
    const {
        title='Title', 
        color=GM.COLOR.YELLOW, 
        prefix=true, 
        indent=GM.FONT_SIZE,
        ext={expand:true}
    } = config;

    const p = uPanel(scene,{orientation:'y'});

    uButton.call(p,scene,{
        text: {text:title,color:color},
        ext: {align:'left',expand:true},
        style: UI.BTN.FOLD,
        prefix: prefix,
        onclick: (btn)=>{
                        if(btn.value) {_content.show();}
                        else {_content.hide();}
                        this.layout?.();
                        config.onclick?.(btn);
                         }});
    const _content = uPanel.call(p,scene,{
                        orientation:'y',
                        ext:{expand:true,padding:{left:indent}}})
                    .hide();

    _content.add(uBbc(scene,{text:'fold 測試。'}),{align:'left'})   // for test
            .add(uButton(scene,{text:'fold 測試。',style:UI.BTN.ITEM}),{align:'left'})   // for test

    if(this&&this.add) {this.add(p,ext);}

    // 操作介面    
    p.addItem = (item,config)=>{
        config=config??{align:'left'};
        _content.add(item,config); return p;
    }

    p.clearAll = ()=>{_content.removeAll(true); return p;}
    
    return p;
}