import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const ARRAY_COLS = new Set(['rewards', 'conds', 'actions']);

function sheetToJson(ws) {
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!allRows.length) return {};
  const headers = allRows[0].map(h => (h !== null && h !== undefined ? String(h) : null));
  const output = {};

  for (let r = 1; r < allRows.length; r++) {
    const row = allRows[r];
    const obj = {};
    let id;

    for (let i = 0; i < headers.length; i++) {
      const key = headers[i];
      if (!key) continue;
      const val = row[i];
      if (val === null || val === undefined || val === '') continue;

      if (key === 'id') {
        id = val;
        obj[key] = val;
      } else if (ARRAY_COLS.has(key)) {
        obj[key] = JSON.parse('[' + val + ']');
      } else {
        obj[key] = typeof val === 'string' ? val.trim() : val;
      }
    }

    if (id !== undefined && Object.keys(obj).length > 0) output[id] = obj;
  }
  return output;
}

function excelToJson(inputPath, outputPath, allSheets = true) {
  const wb = XLSX.readFile(inputPath);
  const output = {};

  if (allSheets) {
    for (const name of wb.SheetNames) {
      output[name] = sheetToJson(wb.Sheets[name]);
    }
  } else {
    Object.assign(output, sheetToJson(wb.Sheets[wb.SheetNames[0]]));
  }

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('轉換完成！');
}

excelToJson('./xls/quest.xlsx', './public/assets/json/quest.json', false);
