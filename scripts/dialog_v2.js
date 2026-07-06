import XLSX from 'xlsx';
import fs from 'fs';

// 將原始行資料按表頭分割成多個資料表
// 表頭行以 # 開頭的單元格標識（# 會被移除），後續行為該表的資料
function splitTables(raw)
{
    const tables = [];
    var currentHeader = null;

    for (const row of raw)
    {
        const isEmpty = row.every(cell => cell === '');
        if (isEmpty) continue;                          // 空行直接跳過

        const firstCell = String(row[0] ?? '');
        if (firstCell.startsWith('//')) continue;       // 註解行直接跳過

        if (firstCell.startsWith('#'))
        {
            // 表頭行：去掉 # 符號，保留欄位名稱
            currentHeader = row.map(n => n.startsWith('#')?'':n);
        }
        else if (currentHeader)
        {
            // 資料行：將表頭與該行資料對應成物件，過濾掉空欄位名稱
            const obj = Object.fromEntries(
                currentHeader.map((h, i) => [h, row[i] ?? '']).filter(([h]) => h !== '')
            )
            tables.push(obj)
        }
    }

    return tables;
}

// ── 工具函式 ──
function buildEntry(row) {
  const entry = {
    nodeId: row.node_id,
    order:  Number(row.priority)
  };
  if (row.condition)    entry.condition = row.condition;
  if (row.setFlag)      entry.effect    = row.setFlag;
  return entry;
}

function buildEffect(row) {
    if (row.setFlag === '') return undefined;

    // Parse "cond:setflag" format into {condition, setFlag} object
    if (row.setFlag.includes(':')) {
        const [condition, setFlag] = row.setFlag.split(':').map(s => s.trim());
        return {[condition]:setFlag};
    }

    return row.setFlag;
}

function buildChoice(row) {
  const c = {
    labelKey: row.label_key,
    priority: Number(row.priority),
  };
  if (row.setFlag)      c.effect    = buildEffect(row);
  if (row.action)       c.action    = row.action;
  if (row.next)         c.next      = row.next;
  if (row.condition)    c.condition = row.condition;
  return c;
}

// function buildPost(row) {
//   const e = {};
//   if (row.setFlag) {
//     // Parse "cond:setflag" format into {condition, setFlag} object
//     if (row.setFlag.includes(':')) {
//       const [condition, setFlag] = row.setFlag.split(':').map(s => s.trim());
//       e.condition = condition;
//       e.setFlag = setFlag;
//     } else {
//       e.setFlag = row.setFlag;
//     }
//   }
//   if (row.condition)    e.condition = row.condition;
//   return Object.keys(e).length ? e : undefined;
// }

function buildTextKeys(text_keys_str) {
  if (!text_keys_str) return {};

  // 如果包含 ':' 表示有條件映射
  if (text_keys_str.includes(':')) {
    const textKeys = {};
    const lines = text_keys_str.split('\n').map(s => s.trim()).filter(s => s);

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(':')) {
        const [cond, text] = lines[i].split(':').map(s => s.trim());
        // 如果下一行不是條件行，併入文本
        let fullText = text || '';
        while (i + 1 < lines.length && !lines[i + 1].includes(':')) {
          i++;
          fullText += '\n' + lines[i];
        }
        textKeys[cond] = fullText;
      }
    }
    return textKeys;
  }

  // 簡單文本形式（向後相容）
  return { "true": text_keys_str };
}

function buildNpc(sheetName, rows)
{
    const npc  = { id: sheetName, effects: [], entries: [], nodes: {},  };
    var currentNode = null;

    for (const row of rows) 
    {
        if(row.section === 'effect')
        {
            npc.effects.push(buildEffect(row));
        }
        else if (row.section === 'entry') 
        {
            npc.entries.push(buildEntry(row));
        }
        else if (row.section === 'node')
        {
            currentNode = {
                textKeys: buildTextKeys(row.text_keys),
                effect:   buildEffect(row),
                choices:  [],
                posts:  []
            };
            npc.nodes[row.node_id] = currentNode;
        }
        else if (row.section === 'choice' && currentNode) 
        {
            currentNode.choices.push(buildChoice(row));
        }
        else if (row.section === 'post' && currentNode)
        {
            currentNode.posts.push(buildEffect(row));
        }
    }

    // entries 依 order 排序
    npc.entries.sort((a, b) => a.order - b.order);

    // choices 依 priority 排序
    for (const node of Object.values(npc.nodes)) 
    {
        node.choices.sort((a, b) => a.priority - b.priority);
    }

    return npc;
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
        npcs[sheetName] = buildNpc(sheetName, tables)
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
excelToJson('./xls/dialog_v2.xlsx', './public/assets/json/dialog_v2.json');
// test('./xls/roles.xlsx', './public/assets/json/test.json');