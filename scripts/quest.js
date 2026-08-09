import XLSX from 'xlsx';
import fs from 'fs';
import {toArray} from './tools.js';

// 將原始行資料按表頭分割成多個資料表
// 表頭行以 # 開頭的單元格標識（# 會被移除），後續行為該表的資料
function splitTables(raw) 
{
    const tables = [];
    let currentHeader = null;
    let currentRows   = [];

    for (const row of raw) 
    {
        const isEmpty = row.every(cell => cell === '');
        if (isEmpty) continue;

        const firstCell = String(row[0] ?? '');
        if (firstCell.startsWith('//')) continue;       // 註解行直接跳過

        if (firstCell.startsWith('#')) 
        {
            if (currentHeader) 
            {
                tables.push({ header: currentHeader, rows: currentRows });
                currentRows = [];
            }

            // 表頭行：去掉 # 符號，保留欄位名稱
            currentHeader = row.map(n => n.startsWith('#')?'':n);
        } 
        else if (currentHeader) 
        {
            const obj = Object.fromEntries(
                currentHeader
                .map((h, i) => [h, row[i] ?? ''])
                .filter(([h]) => h !== '')
            );
            currentRows.push(obj);
        }
    }

    if (currentHeader) 
    {
        tables.push({ header: currentHeader, rows: currentRows });
    }

    return tables;
}

// ── 工具函式 ──

function buildComplete(row) 
{
    const complete = {type: row.complete_type};

    if(row.complete_required) complete.required=Number(row.complete_required);
    if(row.complete_flag) complete.flag=row.complete_flag;
    if(row.complete_id) complete.id=row.complete_id;

    return complete;
}

function buildAction(row)
{
    const action={};
    if(row.actions_start) action.start = toArray(row.actions_start);
    if(row.actions_complete) action.complete = toArray(row.actions_complete);
    return action;
}

function buildReward(row)
{
    const rewards = [];

    const gold = Number(row.rewards_gold);
    if (gold) rewards.push({type:'gold', count:gold});

    const exp = Number(row.rewards_exp);
    if (exp) rewards.push({type:'exp', count:exp});

    toArray(row.rewards_items).forEach(id=>rewards.push({type:'item', id, count:1}));

    return rewards;
}

function buildQuest(sheetName, tables)
{
    const allQuests = {}

    if (tables.length % 2 !== 0) {
        console.warn(`${sheetName}: 表格數量是奇數（${tables.length}），最後一個表格沒有配對，已忽略`);
    }

    // 一個 sheet 可以有多組 (任務基本資料表, 任務步驟表) 配對，依序處理每一組
    for (let i = 0; i + 1 < tables.length; i += 2)
    {
        const infoRows = tables[i].rows;       // 任務基本資料
        const stepRows = tables[i + 1].rows;   // 任務步驟

        // 先把所有任務基本資料建好
        for (const info of infoRows)
        {
            allQuests[info.quest_id] = {
                id:       info.quest_id,
                npcId:    sheetName,            // 記錄是哪個 NPC 的任務
                titleKey: info.titleKey,
                descKey:  info.descKey,
                steps:    {},
                rewards:  buildReward(info),
                action:   buildAction(info)
            };
        }

        // 再把步驟塞進對應任務
        for (const row of stepRows)
        {
            const quest = allQuests[row.quest_id];
            if (!quest)
            {
                console.warn(`找不到任務 ${row.quest_id}，跳過步驟 ${row.step_id}`);
                continue;
            }
            quest.steps[row.step_id] = {
                descKey:  row.descKey,
                complete: buildComplete(row)
            };

            if(row.conds) {
                quest.steps[row.step_id].conds = toArray(row.conds);
            }

            if(row.actions) {
                quest.steps[row.step_id].actions = toArray(row.actions);
            }

            // pos：對應到 public/assets/maps/map.json（世界地圖）node 物件的 map 屬性，
            // 給 PMap.focusOn() 用來把地圖捲動到這個 step 相關的地點
            if(row.pos) {
                quest.steps[row.step_id].pos = row.pos;
            }
        }
    }

    return allQuests;
}

// 讀取 Excel 檔案並將每個工作表轉換為 JSON 資料表，輸出到指定路徑
function excelToJson(inputPath, outputPath)
{
    const npcs = {};
    const wb = XLSX.readFile(inputPath);
    const SKIP_SHEETS = ['locales', '說明'];  // 不是 NPC 的 sheet

    for (const sheetName of wb.SheetNames)
    {
        if (SKIP_SHEETS.includes(sheetName)) continue;

        // 1. 將工作表轉為二維陣列（header:1 表示以陣列形式而非物件形式返回）
        const raw = XLSX.utils.sheet_to_json(
                        wb.Sheets[sheetName],
                        {header:1, defval:''}
                    );

        // 2. 根據表頭標記分割出多個資料表
        const tables = splitTables(raw);
        Object.assign(npcs, buildQuest(sheetName, tables));
    }

    fs.writeFileSync(outputPath, JSON.stringify(npcs, null, 2), 'utf-8');
    console.log(`Output written to ${outputPath}`);
}

// 只轉換第一個 sheet
function test(input, output)
{
    const wb = XLSX.readFile(input);
    const firstSheetName = wb.SheetNames[0];
    const raw = XLSX.utils.sheet_to_json(
        wb.Sheets[firstSheetName],
        {header:1, defval:''}
    );
    const tables = splitTables(raw);
    fs.writeFileSync(output, JSON.stringify(tables, null, 2), 'utf-8');
    console.log(`Output first sheet "${firstSheetName}" to ${output}`);
}

// 執行轉換
excelToJson('./xls/quest.xlsx', './public/assets/json/quest.json');