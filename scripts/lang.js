import fs from 'fs'
import {flattenStory, mergeDialog} from '../src/data/storydata.js'
import {extract, analyze} from '../src/data/langdata.js'

// 翻譯檔 public/assets/lang/<lang>.json 是手寫來源檔（用工具殼的「翻譯」分頁編），這裡只做檢查、印統計，不寫檔
// 設計見 docs/i18n-architecture.md §11
//   node scripts/lang.js

const JSON_DIR = './public/assets/json';
const LANG_DIR = './public/assets/lang';

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = f => read(`${JSON_DIR}/${f}.json`);

const entries = extract({
    local: data('local'), item: data('item'), role: data('role'), ability: data('ability'),
    dialog: mergeDialog(data('dialog'), data('role')),
    story: flattenStory(data('story')),
});
const langs = fs.existsSync(LANG_DIR) ? fs.readdirSync(LANG_DIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)) : [];
for (const lang of langs)
{
    const {rows, stat} = analyze(read(`${LANG_DIR}/${lang}.json`), entries);
    console.log(`${lang}: ${stat.ok} ok / ${stat.new} new / ${stat.orphan} orphan / ${stat.error} error`);
    for (const r of rows) if (r.check === 'error') console.log(`  error ${r.ctx} 「${r.src}」：${r.err}`);
}
if (!langs.length) console.log('還沒有任何翻譯檔，到工具殼的「翻譯」分頁新增語言');
