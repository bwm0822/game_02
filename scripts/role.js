import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

function sheetToJson(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (!raw.length) return {};

  const numCols = Math.max(...raw.map(r => r.length));
  const keys = raw.map(r => r[0]); // first column = field names
  let scheduleIdx = 0;

  const output = {};
  for (let c = 1; c < numCols; c++) {
    let id = null;
    const obj = {};

    for (let r = 0; r < raw.length; r++) {
      const key = keys[r];
      if (key === null || key === undefined || key === '') continue;

      let val = raw[r][c];
      if (val === null || val === undefined) continue;
      if (typeof val === 'string') {
        val = val.trim();
        if (val === '') continue;
      }

      const strVal = String(val);

      if (key === 'id') {
        id = strVal;
      } else if (key === 'icon') {
        obj[key] = strVal;
      } else if (key.startsWith('_')) {
        Object.assign(obj, JSON.parse('{' + strVal + '}'));
      } else if (key === 'equips') {
        obj[key] = JSON.parse(strVal);
      } else if (key === 'schedule') {
        if (!obj[key]) obj[key] = [];
        obj[key].push(JSON.parse('{"i":' + scheduleIdx + ',' + strVal + '}'));
        scheduleIdx++;
      } else {
        obj[key] = JSON.parse('{' + strVal + '}');
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

excelToJson('./xls/role.xlsx', './public/assets/json/role.json');
