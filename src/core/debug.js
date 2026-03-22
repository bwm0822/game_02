//--------------------------------------------------
// debug 用
//--------------------------------------------------
export const DBG = 
{
    MODE: {
        POINT   : 0b000001,
        BODY    : 0b000010,
        GRID    : 0b000100,
        ZONE    : 0b001000,
        SHAPE   : 0b010000,
        TEXT    : 0b100000,
        ALL     : 0b111111,
        CLR     : 0b000000,
    },
}

export const T =
{
    NORMAL  : 0b000_0001,
    UI      : 0b000_0010, 
    AI      : 0b000_0100,
    MAP     : 0b000_1000,
    SCH     : 0b001_0000,
    ROLE    : 0b010_0000,
}

export let DEBUG = 
{
    enable: false,          // 是否開啟 debug 模式
    mode: DBG.MODE.ALL,     // 除錯模式
    loc: true,              // 顯示座標及 weight
    rect : false,           // 顯示邊框
    path : true,            // 顯示 NPC 路徑
    log : true,     
    filter: [],             // log filter 
    tag: -1,
}

export function setDEBUG(value) {DEBUG=value;}
export function dlog(tag=T.NORMAL) 
{
    // 判斷邏輯：如果不符合條件，回傳一個空函數 (noop)
    if(!DEBUG.log) {return ()=>{};}
    if((tag&DEBUG.tag)!==tag) {return ()=>{};}

    // 如果符合條件，回傳綁定好標籤的 console.log
    // bind 會確保輸出的行號指向「呼叫 dlog 的地方」
    // return console.log.bind(console, `[${tag}]`);
    return console.log;
}

export function dtable(tag=T.T0)
{
    // 判斷邏輯：如果不符合條件，回傳一個空函數 (noop)
    if(!DEBUG.log) {return ()=>{};}
    if((tag&DEBUG.tag)!==tag) {return ()=>{};}

    // 如果符合條件，回傳綁定好標籤的 console.table
    return console.table;
}