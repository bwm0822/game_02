import XLSX from 'xlsx';
import { writeFileSync, readFileSync, existsSync } from 'fs';

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
        obj[key].push(JSON.parse('{' + strVal + '}'));
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
  checkSchedule(output);
  console.log('轉換完成！');
}

// 作息目的地要在路網裡(navgraph.json 由 scripts/navgraph.js 產生，改了地圖要先重跑它)
function checkSchedule(roles) {
  const navPath = './public/assets/json/navgraph.json';
  if (!existsSync(navPath)) return;
  const {nodes} = JSON.parse(readFileSync(navPath, 'utf-8'));
  for (const [id, role] of Object.entries(roles)) {
    for (const sh of role.schedule ?? []) {
      const key = `${sh.map}:${sh.go}`;
      if (!nodes[key]) console.warn(`WARN 角色 ${id} 的作息目的地 ${key} 不在路網裡`);
    }
  }
}

excelToJson('./xls/role.xlsx', './public/assets/json/role.json');
