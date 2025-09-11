// services/dragService.js
import { Ui, UiInv, UiCover, UiMain, UiDragged, UiInfo } from '../ui.js';
import { GM } from '../setting.js';
import InventoryService from './inventoryService.js';

export default class DragService 
{
    static _scene = null;
    static _downOnSlot = false;
    
    // ---  拖曳 Slot ---
    static _tryPickFromSlot(slot, pointerX, pointerY) 
    {
        if (slot.isEmpty) {return false;}
        // 1. 顯示拖曳影像
        UiDragged.set(slot);           
        UiDragged.setPos(pointerX, pointerY);
        // 2. 取出：把原格子清空
        slot.empty();
        // 3. 將裝備欄位的背景顏色設置為 COLOR_SLOT
        UiInv.checkEquipSlots(null);  
        return true;
    }

    static _dropOnSlot(slot) 
    {
        if (!slot.isValid) { return; }
        // const from = this._active.payload.from;
        const from = UiDragged.obj;
        const result = InventoryService.handleDrop({ from, to: slot });
        this._finish(result, slot);
    }

    // --- 拖曳 Skill ---
    static _startSkillDrag(skillSlot) 
    {
        const p = skillSlot.scene.input.activePointer;
        // 1. 顯示拖曳影像
        UiDragged.set(skillSlot);
        UiDragged.setPos(p.x, p.y);
        // 2. 取出：把原格子清空
        skillSlot.empty?.();
    }

    static _dropOrClickOnSkillSlot(skillSlot) 
    {
        const owner = skillSlot.owner;
        if(UiDragged.on)    // 放下技能格
        {
            const src = UiDragged.obj;
            // 1. 清除重複
            owner.skill.getSlots().find((slotId, i) => {
                    if (slotId === src.id) {owner.skill.clearSlotAt(i);}
                }
            );
            // 2. 如果 skillSlot 不是空的，要交換位置
            !skillSlot.isEmpty && owner.skill.setSlotAt(src.i, skillSlot.id);
            // 3. 設定新的技能
            owner.skill.setSlotAt(skillSlot.i, src.id);
            // 4. 清空拖曳
            src.empty();
            // 5. 更新畫面
            Ui.refreshAll();
        }
        else if(!skillSlot.isEmpty) // 點擊 SkillSlot
        {
            if(skillSlot.dat.type === GM.ACTIVE) 
            {
                skillSlot.use();  // 使用技能
            }
            else 
            {
                skillSlot.toggle();
            }
        }
    }

    static _finish(result, slot) 
    {
        if(result === 'moved')
        {
            UiCover.close();
            UiMain.enable(true);
            slot.over();
        }
        else if(result === 'traded')
        {
            UiCover.close();
            UiMain.enable(true);
            Ui.refreshAll();    // 更新 gold
            slot.over();
        }
        else if(result === 'merged')
        {
            UiDragged.update();
            slot.update();
        }
    }

    // 跟著滑鼠移動拖曳影像
    static _onpointermove(pointer)
    {
        if (!UiDragged.on) return;
        const x = pointer.x, y = pointer.y;
        UiDragged.setPos(x, y);
    }

    static _onpointerup(pointer) 
    {
        if(UiDragged.isSkill) // 在 SkillSlot 以外的地方放開，就會清除
        {
            UiDragged.empty();
        }
    }

    static _onpointerdown(pointer)
    {
        if(this._downOnSlot) // 代表按在 slot 上，_downOnSlot 設 false
        {
            this._downOnSlot = false;
        }
        else if(UiDragged.isSlot) // 按在 Slot 以外的地放，就會 drop
        {
            UiDragged.drop();
        }
    }

    ////////////////////////////////////////////////////////////////
    // public
    ////////////////////////////////////////////////////////////////
    static init(scene) 
    {
        if (this._scene) return;    // 防止重複 init()
        this._scene = scene;

        scene.input.on('pointermove', (pointer) => {this._onpointermove(pointer);});

        scene.input.on('pointerup', (pointer) => {this._onpointerup(pointer);});

        scene.input.on('pointerdown', (pointer) => {this._onpointerdown(pointer);});

        // scene.events.once('shutdown', () => { this._cancel(); });
    }

    // --- 小工具給 Slot/SkillSlot 呼叫 ---
    static onSlotDown(slot, x, y) 
    {
        UiInfo.close(); 
        
        this._downOnSlot = true;    // 按在 slot 上時，_downOnSlot 設 true
        if (Ui.mode === GM.UI_MODE_FILL) 
        {
            slot.fill('capacity');
            Ui.refreshAll();
            return;
        }

        if (UiDragged.on) // 目前有拖曳 => 視為放下
        {
            this._dropOnSlot(slot);     
        } 
        else if (!slot.isEmpty) // 無拖曳，且 slot 不為空 => 視為選取
        {
            this._tryPickFromSlot(slot, slot.left + x, slot.top + y);
        }
    }

    static onSkillDown(skillSlot, x, y, pressIdHolder) 
    {
        this._startSkillDrag(skillSlot);
    }

    static onSkillUp(skillSlot) 
    {
        this._dropOrClickOnSkillSlot(skillSlot);
    }
}
