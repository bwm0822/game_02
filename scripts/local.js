import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

function sheetToJson(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  if (rows.length < 3) return {};

  const row0 = rows[0];
  const row1 = rows[1];
  const numCols = Math.max(row0.length, row1 ? row1.length : 0);

  // Fill-forward language names across merged/blank columns
  const cols = [];
  let curLang = null;
  for (let c = 0; c < numCols; c++) {
    const top = row0[c];
    const sub = row1 ? row1[c] : null;
    if (top !== null && top !== undefined && top !== '') curLang = String(top);
    cols.push({ lang: curLang, sub: sub !== null && sub !== undefined ? String(sub) : null });
  }

  const output = {};
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    const key = row[0];
    if (key === null || key === undefined || key === '') continue;

    const entry = {};
    for (let c = 1; c < cols.length; c++) {
      const { lang, sub } = cols[c];
      if (!lang || lang === 'key') continue;
      if (sub !== 'lab' && sub !== 'des') continue;
      const val = row[c];
      if (val === null || val === undefined) continue;
      if (!entry[lang]) entry[lang] = {};
      entry[lang][sub] = val;
    }

    if (Object.keys(entry).length > 0) output[String(key)] = entry;
  }
  return output;
}

function localToJson(inputPath, outputPath, allSheets = true) {
  const wb = XLSX.readFile(inputPath);
  const output = {};
  const names = allSheets ? wb.SheetNames : [wb.SheetNames[0]];
  for (const name of names) {
    Object.assign(output, sheetToJson(wb.Sheets[name]));
  }
  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log('所有工作表都處理完囉～轉換完成');
}

localToJson('./xls/local.xlsx', './public/assets/json/local.json');
