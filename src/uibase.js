
export let UI =
{
    COLOR_PRIMARY : 0x4e342e,
    COLOR_LIGHT : 0x7b5e57,
    COLOR_DARK : 0x260e04,
    COLOR_SLOT : 0x666666,//0xa4d4ff,
    COLOR_SLOT_OVER : 0xAAAAAA,//0x4f9ef7,
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