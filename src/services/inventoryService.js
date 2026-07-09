// services/inventoryService.js
import {GM} from '../core/setting.js'
import QuestManager from '../manager/quest.js'

function sameItem(a, b) {return a?.content && b?.content && a.content.id === b.content.id;}

function mergePossible(from, to) 
{
    return sameItem(from, to) && (to.dat?.cps ?? 1) > 1 && (to.content?.count ?? 0) < to.dat.cps;
}

function doMerge(from, to) 
{
    const toCount = to.content.count ?? 0;
    const dragged = from.content.count ?? 0;
    const cps = to.dat.cps;
    const merged = Math.min(toCount + dragged, cps);
    const remain = dragged - (merged - toCount);
    to.content.count = merged;
    from.content.count = remain;
    if(from.owner!==to.owner) {QuestManager.onCollect('doMerge');}
    return 'merged';
}

function doSwap(from, to) 
{
    const ret = to.isEmpty ? 'moved' : 'swapped';
    const trigger = from.owner!==to.owner;  // 要先判斷，因為下面會改變from.owner 
    const tmp = from.content;
    from.content = to.content;
    to.content = tmp;
    if(trigger) {QuestManager.onCollect('swap');}
    return ret;
}

// function trading(from, to) {return from.owner.tradeType !== to.owner.tradeType;}
function trading(from, to) {return from.owner.info.act===GM.TRADE && from.owner!==to.owner;}

export default class InventoryService 
{
    // 入口：處理放下
    static handleDrop({ from, to }={}) 
    {
        if (!to.enabled) {return 'blocked';}

        // 交易
        if (trading(from, to)) 
        {
            if (!to.isEmpty) {return 'blocked';}
            const ok = from.owner.sell(from, to.i, to.isEquip);
            return ok ? 'traded' : 'blocked';
        }
        // 合併
        else if (mergePossible(from, to)) {return doMerge(from, to);}
        // 移動 / 互換 
        else {return doSwap(from, to);}
    }

    // 分堆（給 Option.split 呼叫）
    static split(slot, count) 
    {
        if (!slot?.content?.count || count <= 0 || count >= slot.content.count) return false;
        slot.owner.split(slot, count);
        return true;
    }
}
