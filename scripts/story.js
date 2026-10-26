import fs from 'fs'
import path from 'path'
import {checkStory} from '../src/data/storycheck.js'

// story.json / dialog.json 是手寫來源檔（任務／對話工具編），這支只做靜態檢查，有錯誤 exit code 1
const JSON_DIR = './public/assets/json';
const MAP_DIR  = './public/assets/maps';

const read = f => JSON.parse(fs.readFileSync(`${JSON_DIR}/${f}.json`, 'utf-8'));

function layerNames(layers, out = [])
{
    for (const l of layers ?? [])
    {
        if (l.name) out.push(l.name);
        layerNames(l.layers, out);
    }
    return out;
}

function readMaps(dir, out = [])
{
    for (const f of fs.readdirSync(dir, {withFileTypes:true}))
    {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {readMaps(p, out); continue;}
        if (!f.name.endsWith('.json')) continue;
        try {out.push({file: p, layers: layerNames(JSON.parse(fs.readFileSync(p, 'utf-8')).layers)});}
        catch {}
    }
    return out;
}

const res = checkStory({story: read('story'), dialog: read('dialog'), roles: read('role'), items: read('item'), maps: readMaps(MAP_DIR)});
for (const r of res) console[r.level === 'error' ? 'error' : 'warn'](`${r.level.toUpperCase()} ${r.file} ${r.path.join('.')}：${r.msg}`);
const errors = res.filter(r => r.level === 'error').length;
if (errors) {console.error(`story 檢查：${errors} 個錯誤`); process.exitCode = 1;}
else {console.log('story 檢查：OK');}
