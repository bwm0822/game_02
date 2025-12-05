
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
    COLOR_BLACK : 0x010101,
    COLOR:{
        PRIMARY : 0x4e342e,
        LIGHT : 0x7b5e57,
        DARK : 0x260e04,
        SLOT : 0x666666,//0xa4d4ff,
        SLOT_OVER : 0x909090,//0x4f9ef7,
        SLOT_DRAG : 0x557755,
        SLOT_INVALID : 0x773333,
        SLOT_DISABLE : 0x333333,
        SLOT_TRADE : 0x555555,
        COUNT : 0xff0000,//0x260e04;
        WHITE : 0xffffff,
        GRAY : 0x777777,
        RED : 0xff0000,
        GREEN : 0x00ff00,
        YELLOW : 0xffff00,
        BLUE : 0x0000ff,
        BLACK : 0x010101,
    },

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

    ICON:{
        MARK : 'buffs/108',

        CLOSE : 'cursors/46',
        NONE : 'cursors/47',
        AIM : 'cursors/169',
        TTACK : 'cursors/179',
        PICKUP : 'cursors/90',
        TALK : 'cursors/117',
        ENTER : 'cursors/72',
        EXIT : 'cursors/73',
        OPEN : 'cursors/87',
        TOOL : 'cursors/58',
        DOOR : 'cursors/70',

        WEAPON : 'icons/80',  //'weapons/5'
        HELMET : 'icons/113', //'weapons/45'
        CHESTPLATE : 'icons/119',//'weapons/54'
        GLOVES : 'icons/128',
        BOOTS : 'icons/130',
        NECKLACE : 'icons/134',
        RING : 'icons/133',
        EQUIP : 'icons/170',
        BAG : 'icons/137', 
    },

    CAT_ALL         :   0b1111_1111_1111_1111,
    CAT_ARMOR       :   0b0000_0000_0001_1110,
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

    CAT:{
        ALL         :   0b1111_1111_1111_1111,
        ARMOR       :   0b0000_0000_0001_1110,
        WEAPON      :   0b0000_0000_0000_0001,
        HELMET      :   0b0000_0000_0000_0010,
        CHESTPLATE  :   0b0000_0000_0000_0100,
        GLOVES      :   0b0000_0000_0000_1000,
        BOOTS       :   0b0000_0000_0001_0000,
        NECKLACE    :   0b0000_0000_0010_0000,
        RING        :   0b0000_0000_0100_0000,
        EQUIP       :   0b0000_0000_1000_0000,
        BAG         :   0b0000_0001_0000_0000,
        FOOD        :   0b0000_0010_0000_0000,
        ITEM        :   0b0000_0100_0000_0000,
    },

    PART:{
        HEAD       :   0b0000_1000_0000_0000,
        BODY       :   0b0001_0000_0000_0000,
        HAND       :   0b0010_0000_0000_0000,
        EXT        :   0b0100_0000_0000_0000,
    },
    
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
    PICKUP : 'pickup',
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
    MOVE: 'move',

    // 基礎屬性
    BASE : ["str", "dex", "con", "int", "luk"],
    STR: "str",
    DEX: "dex",
    CON: "con",
    INT: "int",
    LUK: "luk",

    // 戰鬥屬性 
    COMBAT: ["atk","def","range","acc","eva","cri","crid","type"],
    HPMAX : "hpMax",        // 生命上限
    ATK : "atk",            // 攻擊
    DEF : "def",            // 防禦
    RANGE: "range",         // 攻擊半徑
    // HIT : "hit",            // 命中
    // DODGE : "dodge",        // 閃避
    // CRITR : "critRate",     // 暴擊率
    // CRITD : "critDmg",      // 暴擊率
    ACC : "acc",        // 準確
    EVA : "eva",        // 閃避
    CRI : "cri",        // 暴率
    CRID : "crid",      // 暴傷
    PEN : "pen",        // 穿透
    TYPE : "type",      // 攻擊類型: ranged/melee
    // 攻擊類型
    RANGED : 'ranged',
    MELEE : 'melee',
    
    PCT: [  "acc","eva","cri","pen",
            "phy_res","fire_res","ice_res","poison_res"],

    // 抗性 (Resists)
    RESIST : ["phy_res", "fire_res", "ice_res", "poison_res"],
    PHY_RES : "phy_res",        // 物抗
    FIRE_RES : "fire_res",      // 火炕
    ICE_RES : "ice_res",        // 冰抗
    POISON_RES : "poison_res",  // 毒抗

    // 元素
    ELM : "elm",            // 元素
    PHY : "phy",            // 物理
    FIRE : "fire",          // 火焰
    ICE : "ice",            // 冰凍  
    POISON : "poison",      // 毒藥

    // 生存屬性
    SURVIVAL : ["hp", "hunger", "thirst"],
    HP : 'hp',
    HUNGER : 'hunger',
    THIRST : 'thirst',

    BUFF : 'buff',
    HEAL : 'heal',
    DOT : 'dot',
    HOT : 'hot',
    CRIT : "crit",          // 暴擊
    MISS : "miss",          // 失誤

    META : ['type', 'atk','def','range'],

    // 物品屬性
    ITEMS : ['endurance','storage','capacity','times'],
    ENDURANCE : 'endurance',
    STORAGE : 'storage',
    CAPACITY : 'capacity',
    TIMES : 'times',
    DFT: 'dft',     // 預設值
    KEEP: 'keep',   // 
    
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
    IF_SLOT : 0,
    IF_PROP : 1,
    IF_BTN : 2,
    IF_ABILITY : 3,
    IF_ABILITY_TB : 4,
    IF_ACTIVE : 5,
    IF_ACTIVE_TB : 6,

    // 任務類型
    KILL : 'kill',
    TALK : 'talk',
    FINAL : 'final',

    // 頭像大小
    PORTRAITS_W : 80,
    PORTRAITS_H : 80,
    PORTRAITS: {W:80,H:80},

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
    ST_SLEEP : 'sleep',
    ST_ATTACK : 'attack',
    ST_DEATH : 'death',
    ST_ABILITY : 'ability',
    ST_UNDERATTACK : 'underattack',
    
    ST:{
        IDLE : 'idle',
        NEXT : 'next',
        MOVING : 'moving',
        SLEEP : 'sleep',
        ATTACK : 'attack',
        DEATH : 'death',
        ABILITY : 'ability',
        UNDERATTACK : 'underattack',
    },

    // weight
    W_BLOCK : 1000,   
    W_DOOR : 20,
    W_NODE : 10,

    // schedule 延遲
    SH_LATENCY : 5, // 5 m

    // tile size
    TILE_W : 32,
    TILE_H : 32,

    // ability type
    ACTIVE : 'active',
    PASSIVE : 'passive',
    SPELL : 'spell',
    ATTACK : 'attack',
    SELF : 'self',
    ENEMY : 'enemy',

    // path
    PATH_NONE : -1, // 找不到路徑
    PATH_BLK : 0,   // 有阻擋
    PATH_OK : 1,    // 無阻擋

}

export const UI =
{
    BG:{BORDER:{strokeColor:GM.COLOR_GRAY, strokeWidth:2}},
    BTN:{DEF:'def',ITEM:'itm',OPTION:'option'},
    SPACE:{
        LRTB: { p5:{left:5, right:5, top:5, bottom:5},
                p10:{left:10, right:10, top:10, bottom:10}},
        
        LRTBI: { p5:{left:5, right:5, top:5, bottom:5, item:5},
                p10:{left:10, right:10, top:10, bottom:10, item:10}},

        LRTBIL: {p5:{left:5, right:5, top:5, bottom:5, item:5, line:5}},

        TBIL: {p5:{top:5, bottom:5, item:5, line:5}},

        LRTB_5: {left:5, right:5, top:5, bottom:5},
        LRTBI_5: {left:5, right:5, top:5, bottom:5, item:5},
        
        LRTB_10: {left:10, right:10, top:10, bottom:10},
        LRTBI_10: {left:10, right:10, top:10, bottom:10, item:10},
    },
    TAG:{
        MAIN:'main',
        PROFILE:'profile',
        INV:'inv',
        DIALOG:'dialog',
        STORAGE:'storage',
        QUEST:'quest',
        OPTION:'option',
        TRADE:'trade',
        INFO:'info',
        OBSERVE:'observe',
    },
    INFO:
    {
        SLOT:0,
        PROP:1,
        BTN:2,
        ABILITY:{LR:3,TB:4},
        ACTIVE:{LR:5,TB:6},
    },
}

export const ROLE_ATTRS = {
    [GM.P_ATTACK]: 0,
    [GM.P_DEFENSE]: 0,
    [GM.P_RANGE]: 1,
};

export const RESIST_MAP = { 
    [GM.PHY]: GM.PHY_RES, 
    [GM.FIRE]: GM.FIRE_RES, 
    [GM.ICE]: GM.ICE_RES, 
    [GM.POISON]: GM.POISON_RES, 
};

export const ACT_TYPE = {
    [GM.DOT] : 'act_dot',
    [GM.HOT] : 'act_hot',
    [GM.BUFF] : 'act_buff',
};

export const ORDER = [
    GM.TALK,
    GM.TRADE,
    GM.OBSERVE,
    GM.ATTACK,
    GM.PICKUP,
    GM.OPEN,
    GM.ENTER,
    GM.OPEN_DOOR,
    GM.CLOSE_DOOR,
    GM.INV,
    GM.PROFILE,
    GM.COOK,
    GM.DRINK,
    GM.FILL,
    GM.REST,
    GM.WAKE,
    GM.BUY,
    GM.SELL,
    GM.TRANSFER,
    GM.USE,
    GM.DROP,
    GM.SPLIT,
    GM.OPENBAG,
];
