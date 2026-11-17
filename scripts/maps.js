import fs from 'fs'
import path from 'path'
import {loadMap} from '../src/data/navgrid.js'
import {checkMapRoles, isPortObj, portIssue, isPrefabObj, prefabIssue} from '../src/data/mapcheck.js'

// 地圖檢查（同工具地圖分頁的 ⚠）：角色不存在／是玩家／站在地圖外、門指到不存在的地圖、prefab 不存在 → 錯誤；具名 NPC、站在擋住的格子、門的落腳點找不到 → 警告；有錯誤 exit code 1
const ASSETS = './public/assets';
const MAP_DIR = `${ASSETS}/maps`;

const roles = JSON.parse(fs.readFileSync(`${ASSETS}/json/role.json`, 'utf-8'));
const readJson = (rel) => {try {return JSON.parse(fs.readFileSync(`${ASSETS}/${rel}`, 'utf-8'));} catch {return null;}};
const prefabs = readJson('json/prefab.json') ?? {};

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

// 門要查別張圖的物件名稱，先全部讀進來（門也可能指到 _ 開頭的圖，用到再讀）
const loaded = new Map();
const load = async (name) => {if (!loaded.has(name)) loaded.set(name, await loadMap(name, readJson)); return loaded.get(name);};
const names = new Map();
const namesOf = (name) => names.get(name) ?? null;

let errors = 0, warns = 0;
const report = (level, where, msg) => {
    level === 'error' ? errors++ : warns++;
    console[level === 'error' ? 'error' : 'warn'](`${level.toUpperCase()} ${where}：${msg}`);
};
const all = mapNames(MAP_DIR);
for (const name of all) await load(name);
for (const [name, d] of loaded) if (d) names.set(name, new Set(d.objs.map(o => o.name).filter(Boolean)));
for (const name of all)
{
    const d = loaded.get(name);
    if (!d) continue;
    for (const r of checkMapRoles(d, roles)) report(r.level, `maps/${name}.json 物件 ${r.oid}（${r.rid}）`, r.msg);
    for (const o of d.objs.filter(isPortObj))
    {
        const target = String(o.props.map);
        if (!names.has(target) && await load(target)) names.set(target, new Set(loaded.get(target).objs.map(x => x.name).filter(Boolean)));
        const x = portIssue(o, namesOf);
        if (x) report(x.level, `maps/${name}.json 物件 ${o.id}（門）`, x.msg);
    }
    for (const o of d.objs.filter(isPrefabObj))
    {
        const x = prefabIssue(o, prefabs);
        if (x) report(x.level, `maps/${name}.json 物件 ${o.id}（prefab）`, x.msg);
    }
}
if (errors) {console.error(`地圖檢查：${errors} 個錯誤、${warns} 個警告`); process.exitCode = 1;}
else console.log(`地圖檢查：OK${warns ? `（${warns} 個警告）` : ''}`);
