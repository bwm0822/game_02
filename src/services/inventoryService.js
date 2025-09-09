// services/inventoryService.js
import { Ui } from '../ui.js';
import { GM } from '../setting.js';

function sameItem(a, b) {
  return a?.itm && b?.itm && a.itm.id === b.itm.id;
}

function mergePossible(from, to) {
  return sameItem(from, to) && (to.dat?.cps ?? 1) > 1 && (to.itm?.count ?? 0) < to.dat.cps;
}

function doMerge(from, to) {
  const toCount = to.itm.count ?? 0;
  const dragged = from.itm.count ?? 0;
  const cap = to.dat.cps;
  const merged = Math.min(toCount + dragged, cap);
  const remain = dragged - (merged - toCount);
  to.itm.count = merged;
  from.itm.count = remain;
  if (from.itm.count === 0) { /* 由 DragService 做結束時清理 */ }
  to.update();
}

function swap(from, to) {
  const tmp = from.itm;
  from.itm = to.itm;
  to.itm = tmp;
}

function isTrading(from, to) {
  const a = from.owner?.trade ?? null;
  const b = to.owner?.trade ?? null;
  return a !== b;
}

export default class InventoryService {
  // 入口：處理放下
  static handleDrop({ from, to }) {
    if (!to.enabled) return 'blocked';

    if (isTrading(from, to)) {
      // 沿用你原本的交易 API
      if (!to.isEmpty) return 'blocked';
      const ok = from.owner.sell(to.owner, from, to.i, to.isEquip);
      return ok ? 'traded' : 'blocked';
    }

    if (mergePossible(from, to)) {
      doMerge(from, to);
      return 'merged';
    }

    // 互換
    const isTargetEmpty = to.isEmpty;
    const tmp = from.itm;
    if (isTargetEmpty) {
      // 目標空 => 移動
      to.itm = tmp;
      from.itm = null;
      to.setBgColor(GM.COLOR_SLOT);
      return 'moved';
    } else {
      // 互換
      const keepDraggedAt = from; // 讓 DragService 維持語意
      const curTarget = to.itm;
      to.itm = tmp;
      keepDraggedAt.itm = curTarget;
      return 'swapped';
    }
  }

  // 分堆（給 Option.split 呼叫）
  static split(slot, count) {
    if (!slot?.itm?.count || count <= 0 || count >= slot.itm.count) return false;
    slot.owner.split(slot, count);
    return true;
  }
}
