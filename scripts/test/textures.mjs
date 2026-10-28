// 自動載入圖片：scripts/textures.js 的檢查（假資料夾）、Preloader 照 textures.json 載、進地圖才載 textures/maps/、同一張圖只有一份 texture
import {run} from './harness.mjs'
import {run as gen} from '../textures.js'
import fs from 'fs'
import path from 'path'

const TOWN = 'm/m_04x05';
const INN = 'm_04x05/trump-inn-f1';
const TMP = './scripts/test/out/tex';

function fake(files, write = false)
{
    fs.rmSync(TMP, {recursive: true, force: true, maxRetries: 5});
    for (const [p, s] of Object.entries(files))
    {
        fs.mkdirSync(path.dirname(`${TMP}/${p}`), {recursive: true});
        fs.writeFileSync(`${TMP}/${p}`, s);
    }
    fs.mkdirSync(`${TMP}/tilesets`, {recursive: true});
    fs.mkdirSync(`${TMP}/json`, {recursive: true});
    return gen({assets: TMP, write});
}

run('textures', async t => {
    const real = gen({write: false});
    t.check('目前的 textures/ 檢查通過', real.ok, real.errors.join('；'));
    const committed = JSON.parse(fs.readFileSync('./public/assets/json/textures.json', 'utf8'));

    let r = fake({'textures/a/x.png': '', 'textures/b/x.png': ''});
    t.check('撞名報錯', !r.ok && /撞名「x」/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/.tbd/x.png': '', 'textures/b/x.png': ''});
    t.check('.tbd/ 不算撞名', r.ok, r.errors.join('；'));
    const sheet = JSON.stringify({w: 32});
    r = fake({'textures/a/x.png': '', 'textures/a/y_sheet.json': sheet});
    t.check('_sheet.json 找不到圖報錯', !r.ok && /找不到圖「y」/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/a/x.png': '', 'textures/b/x_atlas.json': '{}'});
    t.check('_atlas.json 不在圖的資料夾報錯', !r.ok && /找不到圖「x」/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/a/x.png': '', 'textures/a/x_sheet.json': sheet, 'textures/a/x_atlas.json': '{}'});
    t.check('同時有 _sheet 跟 _atlas 報錯', !r.ok && /同時有/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/maps/m.png': '', 'textures/maps/m_sheet.json': sheet});
    t.check('maps/ 底下有 _sheet.json 報錯', !r.ok && /以 tsj 為準/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/a/x.png': '', 'textures/a/x_sheet.json': sheet, 'tilesets/x.tsj': JSON.stringify({name: 'x', image: '../textures/a/x.png', tilewidth: 16, tileheight: 16, margin: 0, spacing: 0})});
    t.check('tsj 格子跟 _sheet.json 不一樣報錯', !r.ok && /不一樣/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/a/x.png': '', 'tilesets/x.tsj': JSON.stringify({name: 'x', image: '../textures/a/x.png', tilewidth: 32, tileheight: 32})});
    t.check('單張圖被當 tileset 用報錯', !r.ok && /要加 x_sheet\.json/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/a/x.png': '', 'textures/a/x_sheet.json': sheet, 'tilesets/x.tsj': JSON.stringify({name: 'y', image: '../textures/a/x.png', tilewidth: 32, tileheight: 32})});
    t.check('tsj name 跟檔名不一樣報錯', !r.ok && /name「y」/.test(r.errors[0]), r.errors.join('；'));
    r = fake({'textures/maps/m.png': '', 'textures/a/x.png': '', 'textures/a/s.png': '', 'textures/a/s_sheet.json': JSON.stringify({w: 16, margin: 1})}, true);
    const out = r.ok && JSON.parse(fs.readFileSync(`${TMP}/json/textures.json`, 'utf8'));
    t.check('maps/ 不進清單', out && out.image.x && !out.image.m, r.errors.join('；'));
    t.eq('_sheet.json 讀成 spritesheet', JSON.stringify(out?.sheet?.s), JSON.stringify({url: 'textures/a/s.png', w: 16, h: 16, margin: 1, spacing: 0}));
    t.check('清單沒變回報 changed:false', r.changed && gen({assets: TMP}).changed === false);
    fs.rmSync(TMP, {recursive: true, force: true});

    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what: '主選單'});
    const boot = await t.eval((d, tex) => {
        const tm = d.game.textures;
        const keys = [...Object.keys(tex.image), ...Object.keys(tex.sheet), ...Object.keys(tex.atlas)];
        return {
            missing: keys.filter(k => !tm.exists(k)),
            frames: Object.entries(tex.sheet).filter(([k, s]) => tm.get(k).frameTotal - 1 < 1).map(([k]) => k),
            lazy: ['terrain_tiles_v2', 'Full', 'well_01'].filter(k => tm.exists(k)),
            cursors: tm.get('cursors').frameTotal - 1,
        };
    }, committed);
    t.eq('textures.json 的圖開機都載好', boot.missing.join(','), '');
    t.eq('spritesheet 都有切格', boot.frames.join(','), '');
    t.eq('textures/maps/ 的圖開機不載', boot.lazy.join(','), '');
    t.eq('cursors 補邊後 14×13 格', boot.cursors, 182);

    await t.newGame();
    for (const map of [TOWN, INN])
    {
        await t.gotoMap(map);
        const m = await t.eval(d => {
            const tm = d.game.textures;
            const srcs = {};
            const files = tm.getTextureKeys().filter(k => !k.startsWith('minimap_') && tm.get(k).source[0].image instanceof HTMLImageElement);
            for (const k of files) (srcs[tm.get(k).source[0].image.src] ??= []).push(k);
            return {
                paths: files.filter(k => k.includes('/')),
                dup: Object.values(srcs).filter(ks => ks.length > 1).map(ks => ks.join('=')),
                bad: d.objs().filter(g => g.bb?.key && !tm.exists(g.bb.key)).map(g => `${g.id ?? g.name}:${g.bb.key}`),
            };
        });
        t.eq(`${map}：沒有用路徑當 key 的 texture`, m.paths.join(','), '');
        t.eq(`${map}：同一張圖沒有載兩份`, m.dup.join(','), '');
        t.eq(`${map}：物件的圖都存在`, m.bad.join(','), '');
    }
    t.check('進城後 textures/maps/ 的圖載進來了', await t.eval(d => d.game.textures.exists('terrain_tiles_v2')));

    const before = fs.readFileSync('./public/assets/json/textures.json', 'utf8');
    await t.page.goto(new URL('tools/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools);
    const heard = t.page.evaluate(() => new Promise(res => {
        const c = new BroadcastChannel('tools');
        c.onmessage = (e) => res(e.data);
        setTimeout(() => res(null), 10000);
    }));
    await t.page.click('#btnTextures');
    await t.page.waitForFunction(() => /圖片清單(已|沒)更新/.test(document.getElementById('status').textContent), {timeout: 10000});
    t.check('殼的按鈕跑 textures.js', /已更新：image \d+/.test(await t.page.$eval('#status', e => e.textContent)), await t.page.$eval('#status', e => e.textContent));
    t.eq('更新後廣播 textures.json', (await heard)?.file, 'textures.json');
    t.check('重產結果跟 commit 的一樣', fs.readFileSync('./public/assets/json/textures.json', 'utf8') === before);

    // dev server 監看 textures/：新增／刪除圖自動重產並廣播
    const NEW = './public/assets/textures/others/__watch_test.png';
    const listen = () => t.page.evaluate(() => new Promise(res => {
        const c = new BroadcastChannel('tools');
        c.onmessage = (e) => res(e.data);
        setTimeout(() => res(null), 10000);
    }));
    try
    {
        let h = listen();
        fs.copyFileSync('./public/assets/textures/icons/icons.png', NEW);
        t.eq('新增圖自動廣播', (await h)?.file, 'textures.json');
        t.check('新圖進清單', '__watch_test' in JSON.parse(fs.readFileSync('./public/assets/json/textures.json', 'utf8')).image);
        h = listen();
        fs.rmSync(NEW);
        t.eq('刪除圖自動廣播', (await h)?.file, 'textures.json');
    }
    finally {if (fs.existsSync(NEW)) fs.rmSync(NEW);}
    t.check('刪掉後清單復原', fs.readFileSync('./public/assets/json/textures.json', 'utf8') === before);
});
