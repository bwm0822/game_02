// services/dragService.js
import { Ui, UiInv, UiCover, UiMain } from '../ui.js';
import { GM } from '../setting.js';
import InventoryService from './inventoryService.js';

export default class DragService {
  static _scene = null;
  static _active = null; // { type:'slot'|'skill', payload:any }
  static init(scene) {
    if (this._scene) return;
    this._scene = scene;

    // 跟著滑鼠移動拖曳影像
    scene.input.on('pointermove', (pointer) => {
      if (!this._active) return;
      const x = pointer.x, y = pointer.y;
      if (this._active.type === 'slot') {
        UiDragged.setPos(x, y);
      } else if (this._active.type === 'skill') {
        UiDragged.setPos(x, y);
      }
    });

    // 任何處放開都判定「結束」
    scene.input.on('pointerup', (pointer) => {
      if (this._active) this.end();
    });

    scene.events.once('shutdown', () => { this.cancel(); });
  }

  // --- Slot 拖曳 ---
  static tryPickFromSlot(slot, pointerX, pointerY) {
    if (slot.isEmpty) return false;
    this._active = { type: 'slot', payload: { from: slot } };
    UiDragged.slot = slot;           // 顯示拖曳影像
    UiDragged.setPos(pointerX, pointerY);
    // 取出：把原格子清空（沿用你原本的互動體驗）
    slot.empty();
    UiInv.check();                   // 跟你原本流程一致
    UiCover.show();                  // 擋底層點擊
    UiMain.enable(false);
    return true;
  }

  static dropOnSlot(targetSlot) {
    if (!this._active || this._active.type !== 'slot') return;
    const from = this._active.payload.from;
    const result = InventoryService.handleDrop({ from, to: targetSlot });
    this.finish(result !== 'blocked');
  }

  // --- Skill 拖曳 ---
  static startSkillDrag(skillSlot) {
    this._active = { type: 'skill', payload: { skillSlot } };
    UiDragged.skill = skillSlot;
    const p = skillSlot.scene.input.activePointer;
    UiDragged.setPos(p.x, p.y);
    UiCover.show();
    // 不預先清除 SkillSlot；放下時才交換
  }

  static dropOnSkillSlot(targetSkillSlot) {
    if (!this._active || this._active.type !== 'skill') return;
    const src = this._active.payload.skillSlot;
    // 清除重複、交換（沿用你原先邏輯）
    const owner = targetSkillSlot.owner;
    owner.skill.getSlots().find((slotId, i) => {
      if (slotId === src.id) owner.skill.clearSlotAt(i);
    });
    targetSkillSlot.id && owner.skill.setSlotAt(src.i, targetSkillSlot.id);
    owner.skill.setSlotAt(targetSkillSlot.i, src.id);
    Ui.refreshAll();
    this.finish(true);
  }

  // --- 通用結束 ---
  static end() {
    // 放在空白處 => 丟地上（slot 模式才有）
    if (this._active?.type === 'slot') {
      UiDragged.drop();    // 沿用你現有丟地面邏輯（有 GM.SELLER 判斷）
    }
    this.finish(true);
  }

  static cancel() { this.finish(false); }

  static finish(success) {
    UiCover.close();
    UiMain.enable(true);
    UiDragged.empty();
    this._active = null;
    if (success) Ui.refreshAll();
  }

  // --- 小工具給 Slot/SkillSlot 呼叫 ---
  static onSlotClick(slot, pointer, x, y) {
    if (Ui.mode === GM.UI_MODE_FILL) {
      slot.fill('capacity');
      Ui.refreshAll();
      return;
    }

    if (this._active?.type === 'slot') {
      this.dropOnSlot(slot);                 // 目前有拖曳 => 視為放下
    } else if (!slot.isEmpty) {
      this.tryPickFromSlot(slot, slot.left + x, slot.top + y);
    }
  }

  static onSkillDown(skillSlot, x, y, pressIdHolder) {
    // 建議用 PressService 在外部包（見上），這裡提供直接開始的方法：
    this.startSkillDrag(skillSlot);
  }
}
