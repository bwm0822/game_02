// 角色編輯器的部位（part.json）：pool 選圖器、改名／刪除條目、由頭+髮產生頭像；node scripts/test/role-part.mjs
import {run} from './harness.mjs'

run('role-part', async t => {
    await t.page.goto(new URL('tools/role/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__re && Object.keys(window.__re.S.ext.parts).length);

    const r = await t.page.evaluate(async () => {
        const re = window.__re, S = re.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        // 依序回答 #dlgAsk：fn(dlg) 回傳要按的值（可以順便填輸入框）；記下每個對話框的文字
        const answering = (...fns) => {
            const seen = [];
            let stop = false;
            (async () => {
                while (!stop)
                {
                    if ($('dlgAsk').open) {seen.push($('dlgAsk').querySelector('.title').textContent); $('dlgAsk').close((fns.shift() ?? (() => 'cancel'))($('dlgAsk')));}
                    await sleep(20);
                }
            })();
            return {seen, stop: () => {stop = true;}};
        };
        const run = async (p, ...fns) => {const a = answering(...fns); await p; a.stop(); return a.seen;};

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const assets = await dir(opfs, 'game', 'public', 'assets'), json = await dir(assets, 'json');
        const read = async (f) => JSON.parse(await (await (await json.getFileHandle(f)).getFile()).text());
        await write(json, 'role.json', await (await fetch('/assets/json/role.json')).text());
        const parts0 = JSON.parse(await (await fetch('/assets/json/part.json')).text());
        parts0['hair-unused'] = {kind: 'hair', sprite: 'hair-01', scale: 0.25};
        delete parts0['hair-mary'].sex;
        await write(json, 'part.json', JSON.stringify(parts0, null, 2));
        await re.setAssets(assets);
        S.ext.parts = parts0;
        await re.IC.ready;
        const sel = (id) => {S.sel = id; S.view = 'form'; S.secOpen['外觀'] = S.secOpen['基本'] = true; re.render();};

        // 表單：部位欄有縮圖＋選…；選圖器照 kind 列（含「無」）、點一下選、點「無」清掉
        sel('wick');
        const row = [...document.querySelectorAll('#view .fields .k')].find(k => k.title === 'hair').nextElementSibling;
        out.field = [!!row.querySelector('canvas.ico'), row.querySelector('input').value, row.querySelector('button').textContent];
        let p = re.pickPart('hair', 'hair-wick');
        const tiles = () => [...$('dlgPart').querySelectorAll('.tile')];
        out.tiles = [tiles().map(t => t.dataset.id).join(), $('dlgPart').querySelector('.tile.sel').dataset.id, $('dlgPart').querySelector('.title').textContent];
        $('dlgPart').close();
        await p;
        S.ext.parts['hair-mary'].name = '瑪莉的頭髮';
        p = re.pickPart('hair', 'hair-wick');
        out.tileName = tiles().find(t => t.dataset.id === 'hair-mary').querySelector('.lab').textContent;
        delete S.ext.parts['hair-mary'].name;
        tiles().find(t => t.dataset.id === 'hair-mary').click();
        out.pick = await p;
        p = re.pickPart('hair', 'hair-wick');
        tiles()[0].click();
        out.none = await p;
        p = re.pickPart('hair', 'hair-wick');
        $('dlgPart').close();
        out.cancel = await p;

        // 改名：part.json 立刻寫（順序不變）、role.json 的引用一起改並存檔
        out.rename = await run(re.renamePart('hair-wick'),
            d => {d.querySelector('input').value = 'hair-john'; return 'ok';}, () => 'ok', () => 'save');
        const parts = await read('part.json'), roles = await read('role.json');
        out.renamed = [Object.keys(parts).indexOf('hair-john') === Object.keys(parts0).indexOf('hair-wick'), 'hair-wick' in parts, roles.wick.hair, S.data.wick.hair, S.ext.parts['hair-john']?.sprite];
        out.dupName = await run(re.renamePart('hair-john'), d => {d.querySelector('input').value = 'hair-mary'; return 'ok';});
        out.dupStatus = $('status').textContent;

        // 刪除：有角色在用擋住；沒人用的刪掉
        out.delUsed = await run(re.deletePart('hair-mary'), () => 'ok');
        out.delUnused = await run(re.deletePart('hair-unused'), () => 'ok');
        out.deleted = ['hair-mary' in await read('part.json'), 'hair-unused' in await read('part.json')];

        // 由頭+髮產生頭像：寫 roles/portraits/portrait-<id>.png（設定的尺寸）、icon 改掉；沒有頭髮的角色按鈕停用
        sel('karen');
        await re.genPortrait('karen');
        const tex = await dir(assets, 'textures', 'roles', 'portraits');
        const bmp = await createImageBitmap(await (await tex.getFileHandle('portrait-karen.png')).getFile());
        const c = Object.assign(document.createElement('canvas'), {width: bmp.width, height: bmp.height});
        c.getContext('2d').drawImage(bmp, 0, 0);
        out.portrait = [bmp.width, bmp.height, c.getContext('2d').getImageData(50, 50, 1, 1).data[3] > 0, S.data.karen.icon];        S.data.karen.icon = 'head-karen'; re.render();
        out.overwrite = await run(re.genPortrait('karen'), () => 'cancel');
        out.kept = S.data.karen.icon;
        sel(Object.keys(S.data).find(k => S.data[k].kind === 'npc' && !S.data[k].head));
        const btn =[...document.querySelectorAll('#view button')].find(b => b.textContent === '由頭+髮產生');
        out.noHeadBtn = btn?.disabled;

        // 頭髮後片：畫在最底下、不影響臉的大小，超出方格裁掉
        const {portraitOf} = await import('/tools/common/portrait.js');
        const head = {sprite: 'head-karen', scale: 0.25}, hair = {sprite: 'hair-karen', scale: 0.25};
        const opt = {size: 100, fill: 90}, data = (cv) => cv.getContext('2d').getImageData(0, 0, 100, 100).data;
        const front = data(await portraitOf([head, hair], opt)), both = data(await portraitOf([head, {...hair, back: 'body-man'}], opt));
        let same = true, more = 0;
        for (let i = 3; i < both.length; i += 4)
        {
            if (front[i] === 255 && both[i] !== 255) same = false;
            if (front[i] === 0 && both[i] > 0) more++;
        }
        out.portraitBack = [same, more > 0];
        return out;
    });

    t.eq('部位欄：縮圖、id、選…', JSON.stringify(r.field), JSON.stringify([true, 'hair-wick', '選…']));
    t.eq('選圖器：有名稱顯示名稱', r.tileName, '瑪莉的頭髮');
    t.check('選圖器只列同 kind、第一格是「無」、標出目前的',r.tiles[0].startsWith(',') && r.tiles[0].includes('hair-mary') && !r.tiles[0].includes('head-') && r.tiles[1] === 'hair-wick', JSON.stringify(r.tiles));
    t.eq('點條目回傳 id、點「無」回傳空字串、關掉回傳 null', JSON.stringify([r.pick, r.none, r.cancel]), JSON.stringify(['hair-mary', '', null]));
    t.eq('改名問新 id、再確認一次（存檔沒有警告就不問）', JSON.stringify(r.rename), JSON.stringify(['改名 hair-wick', '改名 hair-wick → hair-john']));
    t.eq('改名：part.json 位置不變、role.json 跟著改並存檔', JSON.stringify(r.renamed), JSON.stringify([true, false, 'hair-john', 'hair-john', 'hair-wick']));
    t.eq('改成已有的 id 擋住', r.dupStatus, 'part.json 已經有 hair-mary');
    t.eq('有角色在用不能刪、沒人用的刪掉', JSON.stringify([r.delUsed, r.delUnused, r.deleted]), JSON.stringify([['不能刪 hair-mary'], ['刪除 hair-unused'], [true, false]]));
    t.eq('由頭+髮產生：100×100、有畫東西、icon 改成 portrait-<id>', JSON.stringify(r.portrait), JSON.stringify([100, 100, true, 'portrait-karen']));
    t.eq('icon 不是它、檔案已經有了：先問、取消不動', JSON.stringify([r.overwrite, r.kept]), JSON.stringify([['覆蓋 portrait-karen.png'], 'head-karen']));
    t.eq('沒有頭／頭髮的角色按鈕停用', r.noHeadBtn, true);
    t.eq('頭像畫頭髮後片：臉的位置大小不變、後片多畫在空白處', JSON.stringify(r.portraitBack), JSON.stringify([true, true]));
});
