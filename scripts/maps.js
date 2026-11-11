import fs from 'fs'
import path from 'path'
import {loadMap} from '../src/data/navgrid.js'
import {checkMapRoles} from '../src/data/mapcheck.js'

// 地圖上的角色物件檢查（同工具地圖分頁的 ⚠）：角色不存在／是玩家／站在地圖外 → 錯誤；具名 NPC、站在擋住的格子 → 警告；有錯誤 exit code 1
const ASSETS = './public/assets';
const MAP_DIR = `${ASSETS}/maps`;

const roles = JSON.parse(fs.readFileSync(`${ASSETS}/json/role.json`, 'utf-8'));
const readJson = (rel) => {try {return JSON.parse(fs.readFileSync(`${ASSETS}/${rel}`, 'utf-8'));} catch {return null;}};

function mapNames(dir, pre = '', out = [])
{
    for (const f of fs.readdirSync(dir, {withFileTypes: true}))
    {
        if (f.name.startsWith('_') || f.name.startsWith('.')) continue;
        if (f.isDirectory()) mapNames(path.join(dir, f.name), `${pre}${f.name}/`, out);
        else if (f.name.endsWith('.json')) out.push(`${pre}${f.name.slice(0, -5)}`);
    }
    return out;
}

let errors = 0, warns = 0;
for (const name of mapNames(MAP_DIR))
{
    const d = await loadMap(name, readJson);
    if (!d) continue;
    for (const r of checkMapRoles(d, roles))
    {
        r.level === 'error' ? errors++ : warns++;
        console[r.level === 'error' ? 'error' : 'warn'](`${r.level.toUpperCase()} maps/${name}.json 物件 ${r.oid}（${r.rid}）：${r.msg}`);
    }
}
if (errors) {console.error(`地圖檢查：${errors} 個錯誤、${warns} 個警告`); process.exitCode = 1;}
else console.log(`地圖檢查：OK${warns ? `（${warns} 個警告）` : ''}`);
