// services/inventoryService.js

function sameItem(a, b) {return a?.itm && b?.itm && a.itm.id === b.itm.id;}

function mergePossible(from, to) 
{
    return sameItem(from, to) && (to.dat?.cps ?? 1) > 1 && (to.itm?.count ?? 0) < to.dat.cps;
}

function doMerge(from, to) 
{
    const toCount = to.itm.count ?? 0;
    const dragged = from.itm.count ?? 0;
    const cap = to.dat.cps;
    const merged = Math.min(toCount + dragged, cap);
    const remain = dragged - (merged - toCount);
    to.itm.count = merged;
    from.itm.count = remain;
}

function swap(from, to) 
{
    const tmp = from.itm;
    from.itm = to.itm;
    to.itm = tmp;
}

function trading(from, to) {return from.owner.tradeType !== to.owner.tradeType;}

export default class InventoryService 
{
    // 入口：處理放下
    static handleDrop({ from, to }) 
    {
        if (!to.enabled) {return 'blocked';}

        // 交易
        if (trading(from, to)) 
        {
            if (!to.isEmpty) {return 'blocked';}
            const ok = from.owner.sell(to.owner, from, to.i, to.isEquip);
            return ok ? 'traded' : 'blocked';
        }

        // 合併
        if (mergePossible(from, to)) 
        {
            doMerge(from, to);
            return 'merged';
        }

        // 移動 / 互換 
        if (to.isEmpty) // 目標空 => 移動
        {
            to.itm = from.itm;
            from.itm = null;
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
        if (!slot?.itm?.count || count <= 0 || count >= slot.itm.count) return false;
        slot.owner.split(slot, count);
        return true;
    }
}
