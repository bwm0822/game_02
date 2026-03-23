//--------------------------------------------------
// debug 用

import ComponentBase from "phaser3-rex-plugins/plugins/utils/componentbase/ComponentBase";

//--------------------------------------------------
export const DBG = 
{
    MODE: {
        POINT   : 0b00_0001,
        BODY    : 0b00_0010,
        GRID    : 0b00_0100,
        ZONE    : 0b00_1000,
        SHAPE   : 0b01_0000,
        TEXT    : 0b10_0000,
    },
}

export const T =
{
    NORMAL  : 0b0000_0000_0001,
    UI      : 0b0000_0000_0010, 
    AI      : 0b0000_0000_0100,
    MAP     : 0b0000_0000_1000,
    SCH     : 0b0000_0001_0000,
    PLAYER  : 0b0000_0010_0000,
    NPC     : 0b0000_0100_0000,
    COMBAT  : 0b0000_1000_0000,
    GO      : 0b0001_0000_0000,
    SCENE   : 0b0010_0000_0000,
}

export let DEBUG = 
{
    enable: false,          // 是否開啟 debug 模式
    mode: -1,               // 除錯模式
    loc: true,              // 顯示座標及 weight
    rect : false,           // 顯示邊框
    path : true,            // 顯示 NPC 路徑
    log : true,     
    tag: T.NORMAL,
    filter: '',             // log filter 
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