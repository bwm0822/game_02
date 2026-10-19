// 工具殼（tools/index.html）：OPFS 當假的專案根目錄丟給殼，驗證各分頁拿到資料夾、存檔廣播、未存檔圓點
import {run} from './harness.mjs'

run('tools', async t => {
    await t.page.goto(new URL('tools/#item', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__ie);

    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        const tabBtn = (tab) => document.querySelector(`[data-tab="${tab}"]`);

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const items = {apple: {cat: 'CAT_FOOD', gold: 1}, pear: {cat: 'CAT_FOOD', gold: 2}};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        await dir(proj, 'public', 'assets', 'textures');
        await dir(proj, 'images');
        await write(json, 'item.json', JSON.stringify(items, null, 2));
        await write(json, 'role.json', JSON.stringify({r1: {kind: 'npc'}}, null, 2));

        out.bad = await T.setProject(json).then(() => '', e => e.message);
        await T.setProject(proj);
        out.item = await until(() => win('item').__ie.S.items.apple) &&[win('item').__ie.S.assets.root.name, Object.keys(win('item').__ie.S.items).join()];
        out.lazy = Object.keys(T.S.frames).join();

        T.show('role');
        out.role = await until(() => win('role')?.__re?.S.data.r1) &&[win('role').__re.S.assets.root.name, Object.keys(win('role').__re.S.data).join()];
        T.show('paperdoll');
        out.pd = await until(() => win('paperdoll')?.__pd?.S.root) && [win('paperdoll').__pd.S.root.name, win('paperdoll').__pd.S.assets.dir.name];
        out.hash = location.hash;
        out.hidden = ['item', 'role', 'paperdoll'].map(tab => T.S.frames[tab].hidden).join();

        // 別處寫了 item.json（例如紙娃娃）：乾淨的道具分頁自動重讀
        const ie = win('item').__ie, chan = new BroadcastChannel('tools');
        await write(json, 'item.json', JSON.stringify({...items, plum: {cat: 'CAT_FOOD'}}, null, 2));
        chan.postMessage({type: 'saved', file: 'item.json'});
        out.reload = await until(() => ie.S.items.plum) && !!ie.S.items.plum;

        // 有未存修改：不重讀、只提示，分頁標未存圓點
        ie.set('apple', ['gold'], 9);
        out.dot = await until(() => tabBtn('item').classList.contains('dirty'));
        await write(json, 'item.json', JSON.stringify({...items, plum: {cat: 'CAT_FOOD'}, fig: {cat: 'CAT_FOOD'}}, null, 2));
        chan.postMessage({type: 'saved', file: 'item.json'});
        out.keep = await until(() => win('item').document.getElementById('status').textContent.includes('合併')) && [ie.S.items.apple.gold, !ie.S.items.fig];

        // 道具分頁存檔：合併外部的 fig、廣播給其他分頁、圓點消失
        const heard = new Promise(res => chan.addEventListener('message', e => res(e.data.file), {once: true}));
        const p = ie.save();
        const dlg = win('item').document.getElementById('dlgAsk');
        for (const v of ['merge', 'save']) if (await until(() => dlg.open)) {dlg.close(v); await sleep(50);}
        await p;
        out.heard = await Promise.race([heard, sleep(2000).then(() => '')]);
        const disk = JSON.parse(await (await (await json.getFileHandle('item.json')).getFile()).text());
        out.saved = [disk.apple.gold, !!disk.fig];
        out.undot = await until(() => !tabBtn('item').classList.contains('dirty'));
        return out;
    });

    t.check('選錯資料夾會報錯', r.bad.includes('public/assets/json/item.json'), r.bad);
    t.eq('道具分頁拿到專案根目錄', JSON.stringify(r.item), JSON.stringify(['game', 'apple,pear']));
    t.eq('沒點過的分頁不載入', r.lazy, 'item');
    t.eq('角色分頁後載入也拿得到', JSON.stringify(r.role), JSON.stringify(['game', 'r1']));
    t.eq('紙娃娃：工作資料夾是 images/、遊戲資料是 public/assets', JSON.stringify(r.pd), JSON.stringify(['images', 'assets']));
    t.eq('網址 hash 記分頁', r.hash, '#paperdoll');
    t.eq('只顯示目前分頁', r.hidden, 'true,true,false');
    t.check('別處存檔：乾淨分頁自動重讀', r.reload);
    t.check('有未存修改：分頁標圓點', r.dot);
    t.eq('有未存修改：不重讀、只提示', JSON.stringify(r.keep), JSON.stringify([9, true]));
    t.eq('存檔會廣播', r.heard, 'item.json');
    t.eq('存檔合併外部修改', JSON.stringify(r.saved), JSON.stringify([9, true]));
    t.check('存完圓點消失', r.undot);

    await t.page.goto(new URL('/tools/item/', t.page.url()).href);
    t.check('單獨開工具頁會提示從 /tools/ 開', await t.page.evaluate(() => document.body.firstElementChild.textContent.includes('/tools/')));
});
