
export let GM =
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
    COLOR_GREEN : 0x00ff00,
    COLOR_YELLOW : 0xffff00,
    COLOR_BLUE : 0x0000ff,
    COLOR_BLACK : 0x0,

    FONT : "Arial",
    // FONT : "Segoe UI Emoji",

    FONT_SIZE: 24,

    ICON_MARK : 'buffs/108',

    ICON_CLOSE : 'cursors/46',
    ICON_NONE : 'cursors/47',
    ICON_AIM : 'cursors/169',
    ICON_ATTACK : 'cursors/179',
    ICON_PICKUP : 'cursors/90',
    ICON_TALK : 'cursors/117',
    ICON_ENTER : 'cursors/72',
    ICON_EXIT : 'cursors/73',
    ICON_OPEN : 'cursors/87',
    ICON_TOOL : 'cursors/58',
    ICON_DOOR : 'cursors/70',

    ICON_WEAPON : 'icons/80',  //'weapons/5'
    ICON_HELMET : 'icons/113', //'weapons/45'
    ICON_CHESTPLATE : 'icons/119',//'weapons/54'
    ICON_GLOVES : 'icons/128',
    ICON_BOOTS : 'icons/130',
    ICON_NECKLACE : 'icons/134',
    ICON_RING : 'icons/133',
    ICON_EQUIP : 'icons/170',
    ICON_BAG : 'icons/137',

    CAT_ALL         :   0b1111_1111_1111_1111,
    CAT_WEAPON      :   0b0000_0000_0000_0001,
    CAT_HELMET      :   0b0000_0000_0000_0010,
    CAT_CHESTPLATE  :   0b0000_0000_0000_0100,
    CAT_GLOVES      :   0b0000_0000_0000_1000,
    CAT_BOOTS       :   0b0000_0000_0001_0000,
    CAT_NECKLACE    :   0b0000_0000_0010_0000,
    CAT_RING        :   0b0000_0000_0100_0000,
    CAT_EQUIP       :   0b0000_0000_1000_0000,
    CAT_BAG         :   0b0000_0001_0000_0000,
    CAT_FOOD        :   0b0000_0010_0000_0000,
    CAT_ITEM        :   0b0000_0100_0000_0000,

    PART_HEAD       :   0b0000_1000_0000_0000,
    PART_BODY       :   0b0001_0000_0000_0000,
    PART_HAND       :   0b0010_0000_0000_0000,
    PART_EXT        :   0b0100_0000_0000_0000,
    
    SLOT_SIZE : 80,     // slot 的寬、高
    OVER_DELAY : 100,   // 註解延遲時間 (unit:ms)
    PRESS_DELAY : 250,   // 按壓技能延遲時間 (unit:ms)
    CAM_CENTER : 0b000,
    CAM_LEFT : 0b001,
    CAM_RIGHT : 0b010,
    CAM_LEFT_TOP : 0b100,

    SELLER : 1,
    BUYER : 2,

    BTN_NORMAL : 'normal',
    BTN_NOBG : 'nobg',
    BTN_TEXT : 'text',   

    UI_LEFT :   0b000001,
    UI_LEFT_P : 0b000010,
    UI_RIGHT :  0b000100,
    UI_CENTER : 0b000111,
    UI_BOTTOM : 0b001000,
    UI_TOP :    0b010000,
    UI_MSG :    0b010000,
    UI_ALL :    0b111111,

    T_CHANGE_SCENE : 500, // 轉場漸暗時間 ms

    LIGHT : 1.2,    // 火炬光源強度

    HUNGER_INC : 0.1, // 飢餓每分鐘增加量
    THIRST_INC : 0.1, // 口渴每分鐘增加量

    UI_MODE_NORMAL : 0, //
    UI_MODE_FILL : 1, //  

    // 動作
    TALK: 'talk',
    TRADE : 'trade',
    OBSERVE : 'observe',
    ATTACK : 'attack',
    TAKE : 'take',
    OPEN : 'open',
    ENTER : 'enter',
    INV : 'inv',
    PROFILE : 'profile',
    COOK : 'cook',
    DRINK : 'drink',
    FILL : 'fill',      // 裝滿水
    OPEN_DOOR: 'open_door',
    CLOSE_DOOR: 'close_door',
    REST : 'rest',
    WAKE : 'wake',
    // for slot
    BUY : 'buy',
    SELL : 'sell',
    TRANSFER : 'transfer',
    USE : 'use',
    DROP : 'drop',
    SPLIT : 'split',
    OPENBAG : 'openbag',

    // 角色狀態
    P_LIFE : 'life',
    P_HUNGER : 'hunger',
    P_THIRST : 'thirst',

    // 屬性
    P_ATTACK : 'attack',
    P_DEFENSE : 'defense',
    P_RANGE : 'range',
    P_STORAGE : 'storage',
    P_CAPACITY : 'capacity',
    P_TIMES : 'times',
    P_ENDURANCE : 'endurance',
    P_KEEP : 'keep',

    // UiInfo Type
    TP_SLOT : 0,
    TP_PROP : 1,
    TP_BTN : 2,
    TP_SKILL : 3,
    TP_BUFF : 4,

    // 任務類型
    KILL : 'kill',
    TALK : 'talk',
    FINAL : 'final',

    // 頭像大小
    PORTRAITS_W : 80,
    PORTRAITS_H : 80,

    // debug
    DBG_BODY :  0b001,
    DBG_GRID :  0b010,
    DBG_ZONE :  0b100,
    DBG_ALL :   0b111,
    DBG_CLR :   0b000,

    // state
    ST_IDLE : 'idle',
    ST_NEXT : 'next',
    ST_MOVING : 'moving',
    ST_ACTION : 'action',
    ST_SLEEP : 'sleep',
    ST_ATTACK : 'attack',
    ST_DEATH : 'death',
    ST_SKILL : 'skill',

    // weight
    W_BLOCK : 1000,   
    W_DOOR : 20,
    W_NODE : 10,

    // schedule 延遲
    SH_LATENCY : 5, // 5 m

    // tile size
    TILE_W : 32,
    TILE_H : 32,

    // skill type
    ACTIVE : 'active',
    PASSIVE: 'passive',
    SELF: 'self'
}

export let ROLE_ATTRS = {
    [GM.P_ATTACK]: 0,
    [GM.P_DEFENSE]: 0,
    [GM.P_RANGE]: 1,
};
