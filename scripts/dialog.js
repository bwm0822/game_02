import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

function escapeNewlinesInQuotes(text) {
  return text.replace(/"([\s\S]*?)"/g, (_, inner) => {
    const escaped = inner.replace(/\r\n/g, '\\n').replace(/\r/g, '\\n').replace(/\n/g, '\\n');
    return '"' + escaped + '"';
  });
}

function sheetToJson(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!raw.length) return {};

  const numCols = Math.max(...raw.map(r => r.length));
  const keys = raw.map(r => r[0]); // first column = field names

  const output = {};
  for (let c = 1; c < numCols; c++) {
    let id = null;
    const obj = {};

    for (let r = 0; r < raw.length; r++) {
      const key = keys[r];
      if (key === null || key === undefined || key === '') continue;

      const rawVal = raw[r][c];
      if (rawVal === null || rawVal === undefined || rawVal === '') continue;

      let val = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal);
      val = escapeNewlinesInQuotes(val);

      if (key === 'id') {
        id = val;
      } else {
        obj[key] = JSON.parse('{' + val + '}');
      }
    }

    if (id !== null) output[id] = obj;
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
  console.log('轉換完成！');
}

excelToJson('./xls/dialog.xlsx', './public/assets/json/dialog.json');
