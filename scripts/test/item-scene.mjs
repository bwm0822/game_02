// 場景分頁的道具實例：左欄道具庫、放／選／移、sandbox 畫直立道具圖＋手上的 prefab／粒子（docs/scene-tool.md「道具實例」）
import {run} from './harness.mjs'

run('item-scene', async t => {
    await t.page.goto(new URL('/tools/#scene', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__sc);
    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f, n = 500) => {for (let i = 0; i < n && !await f(); i++) await sleep(20); return f();};
        const win = T.S.frames.scene.contentWindow, sc = win.__sc, doc = win.document;
        const sb = () => doc.getElementById('game').contentWindow.__sb;

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        await write(json, 'item.json', JSON.stringify({
            't-torch': {cat: 'CAT_EQUIP', icon: 'sword-iron', equip: {sprite: 'sword-iron', scale: 0.5, prefab: 't-fire'}},
            't-wand': {cat: 'CAT_WEAPON', icon: 'sword-bronze', equip: {sprite: 'sword-bronze', particle: {particle: 'fire-charge', x: 3, y: -20}}},
            't-plain': {cat: 'CAT_WEAPON', icon: 'sword-bronze', equip: {sprite: 'sword-bronze'}},
            't-bag': {cat: 'CAT_BAG', icon: 'Barrel'},
        }, null, 2));
        await write(json, 'role.json', await (await fetch('/assets/json/role.json')).text());
        await write(json, 'particle.json', JSON.stringify({'fire-charge': {img: 'p-dot', mode: 'stream'}}));
        await write(json, 'prefab.json', JSON.stringify({'t-fire': {parts: [{particle: 'fire-charge', y: -25}, {light: {r: 70}, y: -25}]}}));
        const read = async (d, name) => {await sc.flush(); const fh = await d.getFileHandle(name).catch(() => null); return fh ? JSON.parse(await (await fh.getFile()).text()) : null;};
        const scDisk = async () => (await read(await dir(proj, 'tools'), 'scenes.json'))?.['測試'];

        await until(() => sc.S.ready && sb()?.map);
        await T.setProject(proj);
        await until(() => sc.S.root);
        await sc.flush();
        await sc.addScene('測試');

        // 左欄道具庫：只列拿在手上的（有 equip 的武器／CAT_EQUIP），標手上掛的
        out.lib = [...doc.querySelectorAll('#itemLib .item')].map(e => `${e.dataset.item}|${e.querySelector('.lab').textContent}`);

        // 放道具實例：寫 scenes.json 的 items、選起來；sandbox 建成 @item:<道具>＝手上的零件＋最後墊道具圖
        await sc.addItemInst('t-torch', 300, 200);
        await sc.addItemInst('t-wand', 400, 200);
        await sc.addItemInst('t-plain', 500, 200);
        await sc.addItemInst('t-bag', 600, 200);
        await sc.flush();
        out.disk = (await scDisk()).items;
        out.pick = [sc.S.pick, sc.instOf('i1').prefab, sc.instOf('i2').prefab, !!doc.querySelector('#right [data-k="item"]')];
        await until(() => sb()?._insts?.i3);
        const sbPf = (k) => doc.getElementById('game').contentWindow.__dbg?.DB._prefabDB?.[sb()._insts[k].data.prefab] ?? null;
        out.sandbox = ['i1', 'i2', 'i3'].map(k => {const pf = sbPf(k); return [sb()._insts[k].data.prefab, pf?.parts.map(p => p.img ?? p.particle ?? (p.light && 'light')), pf?.parts.at(-1).sx];});
        out.view = (sb()._insts.i1.go.view?._parts ?? []).filter(e => e.light).length;

        // 移動（setInst）／Del 刪掉
        await sc.setInst('i1', {x: 320});
        await sc.flush();
        out.move = [(await scDisk()).items[0].x, await until(() => sb()._insts.i1?.go.x === 320)];
        sc.pickRole('i3');
        await sc.deleteObj('i3');
        await sc.flush();
        out.del = [(await scDisk()).items.map(o => o.key), sc.S.pick];
        // 左欄樹：道具段
        out.tree = [...doc.querySelectorAll('#tree .item[data-key^="i"]')].map(e => e.dataset.key);
        return out;
    });
    t.eq('道具庫只列拿在手上的、標手上掛的', JSON.stringify(r.lib), JSON.stringify(['t-torch|prefab t-fire', 't-wand|粒子 fire-charge', 't-plain|']));
    t.eq('放道具實例：t-bag 擋掉、寫 items', JSON.stringify(r.disk), JSON.stringify([{key: 'i1', item: 't-torch', x: 300, y: 200}, {key: 'i2', item: 't-wand', x: 400, y: 200}, {key: 'i3', item: 't-plain', x: 500, y: 200}]));
    t.eq('選起最後放的、編的 prefab＝equip.prefab／@道具、右欄有道具下拉', JSON.stringify(r.pick), JSON.stringify(['i3', 't-fire', '@t-wand', true]));
    t.eq('sandbox：@item:<道具>＝手上零件＋最後墊道具圖（scale＝equip.scale）', JSON.stringify(r.sandbox), JSON.stringify([
        ['@item:t-torch', ['fire-charge', 'light', 'sword-iron'], 0.5], ['@item:t-wand', ['fire-charge', 'sword-bronze'], 1], ['@item:t-plain', ['sword-bronze'], 1]]));
    t.eq('手上 prefab 的光源有建', r.view, 1);
    t.eq('改位置寫檔、sandbox 跟著', JSON.stringify(r.move), '[320,true]');
    t.eq('刪除', JSON.stringify(r.del), JSON.stringify([['i1', 'i2'], null]));
    t.eq('左欄樹列道具實例', JSON.stringify(r.tree), JSON.stringify(['i1', 'i2']));
});
