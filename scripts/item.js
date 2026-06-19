import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

const STR_COLS = new Set(['icon', 'cat']);
const ARR_COLS = new Set(['effects', 'procs']);

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
      if (!key || key.startsWith('Unnamed:')) continue;
      const val = row[i];
      if (val === null || val === undefined || val === '') continue;

      const strVal = String(val);

      if (key === 'id') {
        id = strVal;
      } else if (key === 'gold') {
        obj[key] = Math.round(Number(val));
      } else if (STR_COLS.has(key)) {
        obj[key] = strVal;
      } else if (key.startsWith('_')) {
        Object.assign(obj, JSON.parse('{' + strVal + '}'));
      } else if (ARR_COLS.has(key)) {
        obj[key] = JSON.parse('[' + strVal + ']');
      } else if (key === 'bb' || key.startsWith('bb_')) {
        if (!obj.bb) obj.bb = {};
        Object.assign(obj.bb, JSON.parse('{' + strVal + '}'));
      } else {
        obj[key] = JSON.parse('{' + strVal + '}');
      }
    }

    if (id !== undefined && Object.keys(obj).length > 0) output[id] = obj;
  }
  return output;
}

function excelToJson(inputPath, outputPath, allSheets = true) {
  const wb = XLSX.readFile(inputPath);
  const output = {};
  const names = allSheets ? wb.SheetNames : [wb.SheetNames[0]];
  for (const name of names) {
    Object.assign(output, sheetToJson(wb.Sheets[name]));
  }
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('item 轉換完成');
}

excelToJson('./xls/item.xlsx', './public/assets/json/item.json');
