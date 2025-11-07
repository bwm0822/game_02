// services/inventoryService.js

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
}

function swap(from, to) 
{
    const tmp = from.content;
    from.content = to.content;
    to.content = tmp;
}

function trading(from, to) {return from.owner.tradeType !== to.owner.tradeType;}

export default class InventoryService 
{
    // 入口：處理放下
    static handleDrop({ from, to }={}) 
    {
        console.log('---------------- handleDrop')

        if (!to.enabled) {return 'blocked';}

        // 交易
        if (trading(from, to)) 
        {
            if (!to.isEmpty) {return 'blocked';}
            const ok = from.owner.sell(from, to.i, to.isEquip);
            return ok ? 'traded' : 'blocked';
        }

        // 合併
        if (mergePossible(from, to)) 
        {
            console.log(from,to)
            doMerge(from, to);
            return 'merged';
        }

        // 移動 / 互換 
        if (to.isEmpty) // 目標空 => 移動
        {
            to.content = from.content;
            from.content = null;
            return 'moved';
        } 
        else // 互換位置
        {
            swap(from, to); 
            return 'swapped';
        }
    }

    // 分堆（給 Option.split 呼叫）
    static split(slot, count) 
    {
        if (!slot?.content?.count || count <= 0 || count >= slot.content.count) return false;
        slot.owner.split(slot, count);
        return true;
    }
}
