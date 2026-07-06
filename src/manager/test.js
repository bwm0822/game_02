/**
 * QuestManager — 純 static 工具類別
 *
 * 不需要 new，所有方法都吃 (questDb, ..., state) 當參數，
 * 沒有自己的實例狀態，純粹是一組操作 state 的函式集合。
 *
 * 使用方式：
 *   QuestManager.init(questDb);              // 啟動時呼叫一次
 *   QuestManager.startQuest('quest_id', state);
 *   QuestManager.onKill('wolf', 'black_forest', state);
 */
class QuestManager {

  // ───────────────────────────────────────────
  // 初始化：把任務資料庫存起來，之後不用每次都傳
  // ───────────────────────────────────────────
  static _questDb = null;

  static init(questDb) {
    QuestManager._questDb = questDb;
  }

  static _getQuest(questId) {
    const quest = QuestManager._questDb[questId];
    if (!quest) {
      console.warn(`[QuestManager] 找不到任務: ${questId}`);
    }
    return quest;
  }

  // ───────────────────────────────────────────
  // 開始 / 完成任務
  // ───────────────────────────────────────────

  static startQuest(questId, state) {
    if (state.quest.active.has(questId)) return;
    if (state.quest.completed.has(questId)) return;

    const quest = QuestManager._getQuest(questId);
    if (!quest) return;

    state.quest.active.add(questId);
    state.quest.progress[questId] = {
      completedSteps: {},
      counters: {}
    };

    if (quest.onStart) {
      QuestManager.applyEffect(quest.onStart, state);
    }

    console.log(`▶ 任務開始：${questId}`);
  }

  static completeStep(questId, stepId, state) {
    const progress = state.quest.progress[questId];
    if (!progress || progress.completedSteps[stepId]) return;

    progress.completedSteps[stepId] = true;
    console.log(`✓ ${questId} → ${stepId} 完成`);

    const quest = QuestManager._getQuest(questId);
    const allDone = quest.steps.every(
      s => progress.completedSteps[s.id]
    );

    if (allDone) {
      QuestManager.completeQuest(questId, state);
    }
  }

  static completeQuest(questId, state) {
    const quest = QuestManager._getQuest(questId);
    if (!quest) return;

    state.quest.active.delete(questId);
    state.quest.completed.add(questId);
    state.flags.add(`quest_${questId}_done`);

    // 發放獎勵
    state.player.gold += quest.reward.gold ?? 0;
    state.player.exp  += quest.reward.exp  ?? 0;
    for (const itemId of quest.reward.items ?? []) {
      state.inventory[itemId] = (state.inventory[itemId] ?? 0) + 1;
    }

    console.log(`★ 任務完成：${questId}`);
    console.log(`  獎勵：${quest.reward.gold} 金幣、${quest.reward.exp} 經驗`);
  }

  static failQuest(questId, state) {
    if (!state.quest.active.has(questId)) return;

    state.quest.active.delete(questId);
    state.quest.failed.add(questId);
    console.log(`✗ 任務失敗：${questId}`);
  }

  // ───────────────────────────────────────────
  // 各系統呼叫的事件入口
  // ───────────────────────────────────────────

  /** 戰鬥系統：敵人死亡 */
  static onKill(enemyId, zone, state) {
    QuestManager._checkSteps('counter', state, (step, questId, stepId) => {
      if (step.complete.counter !== `kill_${enemyId}`) return false;
      if (step.complete.zone && step.complete.zone !== zone) return false;

      const progress = state.quest.progress[questId];
      progress.counters[stepId] = (progress.counters[stepId] ?? 0) + 1;
      return progress.counters[stepId] >= step.complete.required;
    });
  }

  /** 背包系統：取得物品 */
  static onCollectItem(itemId, count, state) {
    QuestManager._checkSteps('collectItem', state, (step, questId, stepId) => {
      if (step.complete.item !== itemId) return false;

      const progress = state.quest.progress[questId];
      progress.counters[stepId] = (progress.counters[stepId] ?? 0) + count;
      return progress.counters[stepId] >= step.complete.required;
    });
  }

  /** 製作系統：製作完成 */
  static onCraftItem(itemId, state) {
    QuestManager._checkSteps('craftItem', state, (step, questId, stepId) => {
      if (step.complete.item !== itemId) return false;

      const progress = state.quest.progress[questId];
      progress.counters[stepId] = (progress.counters[stepId] ?? 0) + 1;
      return progress.counters[stepId] >= step.complete.required;
    });
  }

  /** 移動系統：玩家位置更新 */
  static onReachPosition(x, y, state) {
    QuestManager._checkSteps('reachZone', state, (step) => {
      const dx = x - step.complete.x;
      const dy = y - step.complete.y;
      return Math.sqrt(dx * dx + dy * dy) <= step.complete.radius;
    });
  }

  /** 護送系統：NPC 抵達目的地 */
  static onEscortArrived(npcId, state) {
    QuestManager._checkSteps('escortNpc', state, (step) => {
      return step.complete.npc === npcId;
    });
  }

  /**
   * 旗標變化：對話系統的 effect.setFlag / removeFlag 之後呼叫
   * 統一檢查 hasFlag / notFlag 類型的步驟
   */
  static onFlagChanged(state) {
    QuestManager._checkSteps('hasFlag', state, (step) => {
      return state.flags.has(step.complete.flag);
    });
    QuestManager._checkSteps('notFlag', state, (step) => {
      return !state.flags.has(step.complete.flag);
    });
  }

  // ───────────────────────────────────────────
  // 內部工具
  // ───────────────────────────────────────────

  /**
   * 掃描所有進行中任務裡符合 type 的步驟，
   * 用 predicate 判斷是否完成
   */
  static _checkSteps(type, state, predicate) {
    for (const questId of state.quest.active) {
      const quest = QuestManager._getQuest(questId);
      if (!quest) continue;

      for (const step of quest.steps) {
        if (step.complete.type !== type) continue;

        const progress = state.quest.progress[questId];
        if (progress.completedSteps[step.id]) continue;

        if (predicate(step, questId, step.id)) {
          QuestManager.completeStep(questId, step.id, state);
        }
      }
    }
  }

  /** 套用效果：setFlag / removeFlag / giveItem / startQuest */
  static applyEffect(effect, state) {
    if (!effect) return;

    if (effect.setFlag) {
      state.flags.add(effect.setFlag);
    }
    if (effect.removeFlag) {
      state.flags.delete(effect.removeFlag);
    }
    if (effect.giveItem) {
      state.inventory[effect.giveItem] =
        (state.inventory[effect.giveItem] ?? 0) + 1;
    }
    if (effect.startQuest) {
      QuestManager.startQuest(effect.startQuest, state);
    }
    if (effect.completeQuest) {
      QuestManager.completeQuest(effect.completeQuest, state);
    }

    // 任何 effect 套用後，旗標可能變了，順便檢查一次
    if (effect.setFlag || effect.removeFlag) {
      QuestManager.onFlagChanged(state);
    }
  }

  // ───────────────────────────────────────────
  // 查詢輔助：給 UI / 任務日誌用
  // ───────────────────────────────────────────

  static getActiveQuests(state) {
    return [...state.quest.active]
      .map(id => QuestManager._getQuest(id))
      .filter(Boolean);
  }

  static getStepProgress(questId, stepId, state) {
    const progress = state.quest.progress[questId];
    return {
      done:    progress?.completedSteps[stepId] ?? false,
      counter: progress?.counters[stepId] ?? 0
    };
  }

  static isQuestActive(questId, state) {
    return state.quest.active.has(questId);
  }

  static isQuestCompleted(questId, state) {
    return state.quest.completed.has(questId);
  }
}

export { QuestManager };