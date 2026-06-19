import XLSX from 'xlsx';
import { writeFileSync } from 'fs';

function excelToJson(inputPath, outputPath) {
  const wb = XLSX.readFile(inputPath);
  const output = {};

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
    const items = [];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const val = rows[r][c];
        if (val !== null && val !== undefined) {
          items.push({ id: String(val), x: c, y: r });
        }
      }
    }
    output[name] = items;
  }

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
}

excelToJson('./xls/ab_tree.xlsx', './public/assets/json/ab_tree.json');
