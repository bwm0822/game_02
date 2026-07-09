import XLSX from 'xlsx';
import fs from 'fs';

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
// function buildComplete(row) {
//   switch (row.complete_type) {
//     case 'counter':
//       return {
//         type:     'counter',
//         counter:  row.complete_counter,
//         required: Number(row.complete_required)
//       };
//     case 'hasFlag':
//     case 'notFlag':
//       return {
//         type: row.complete_type,
//         flag: row.complete_flag
//       };
//     default:
//       return null;
//   }
// }

function buildComplete(row) 
{
    const complete={
        type:       row.complete_type,
        counter:    row.complete_counter,
    }

    if(row.complete_required) complete.required=row.complete_required;
    if(row.complete_flag) complete.flag=row.complete_flag;

    return complete;
}

function buildAction(row)
{
    const action={};
    if(row.action_start) action.start=row.action_start;
    if(row.action_complete) action.complete =row.action_complete;
    return action;
}

function buildReward(row)
{
    return {
                gold:  Number(row.reward_gold),
                exp:   Number(row.reward_exp),
                items: row.reward_items
                        ? row.reward_items.split(',').map(s => s.trim())
                        : []
            };
}

function buildQuest(sheetName, tables)
{
    const allQuests = {}

    const infoRows = tables[0].rows;   // 任務基本資料
    const stepRows = tables[1].rows;   // 任務步驟

    // 先把所有任務基本資料建好
    for (const info of infoRows) 
    {
        allQuests[info.quest_id] = {
            id:       info.quest_id,
            npcId:    sheetName,            // 記錄是哪個 NPC 的任務
            titleKey: info.titleKey,
            descKey:  info.descKey,
            steps:    {},
            reward:   buildReward(info),
            action:   buildAction(info)
        };
    }

    // 再把步驟塞進對應任務
    for (const row of stepRows) 
    {
        const quest = allQuests[row.quest_id];
        if (!quest) {
            console.warn(`找不到任務 ${row.quest_id}，跳過步驟 ${row.step_id}`);
            continue;
        }
        quest.steps[row.step_id] = {
        descKey:  row.descKey,
        complete: buildComplete(row)
        };
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
excelToJson('./xls/quest_v2.xlsx', './public/assets/json/quest_v2.json');