// 場景分頁的道具實例：左欄道具庫、放／選／移、sandbox 畫直立道具圖＋手上的零件 equip.parts（docs/scene-tool.md「道具實例」）
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
            't-torch': {cat: 'CAT_EQUIP', icon: 'sword-iron', equip: {sprite: 'sword-iron', scale: 0.5, parts: [{particle: 'fire-charge', y: -25}, {light: {r: 70}, y: -25}]}},
            't-wand': {cat: 'CAT_WEAPON', icon: 'sword-bronze', equip: {sprite: 'sword-bronze', parts: [{particle: 'fire-charge', x: 3, y: -20}]}},
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

        // 放置面板的道具分頁：只列拿在手上的（有 equip 的武器／CAT_EQUIP），標手上零件數
        sb()._send({sb: 'ctx', tx: 1, ty: 1, wx: 48, wy: 64, key: null, cx: 30, cy: 30});
        await until(() => doc.querySelector('.addpanel'));
        doc.querySelector('.addpanel [data-tab="item"]').click();
        out.lib = [...doc.querySelectorAll('.addpanel .prow')].map(e => `${e.dataset.item}|${e.querySelector('.lab')?.textContent ?? ''}`);
        sc.panel.close();

        // 放道具實例：寫 scenes.json 的 items、選起來；sandbox 建成 @item:<道具>＝手上的零件＋最後墊道具圖
        await sc.addItemInst('t-torch', 300, 200);
        await sc.addItemInst('t-wand', 400, 200);
        await sc.addItemInst('t-plain', 500, 200);
        await sc.addItemInst('t-bag', 600, 200);
        await sc.flush();
        out.disk = (await scDisk()).items;
        out.pick = [sc.S.pick, sc.instOf('i1').prefab, sc.instOf('i2').prefab, !!doc.querySelector('#right [data-k="item"]')];
        await until(() => sb()?._insts?.i3);
        const gdb = () => doc.getElementById('game').contentWindow.__dbg.DB;
        const sbPf = (k) => gdb()?._prefabDB?.[sb()._insts[k].data.prefab] ?? null;
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
        out.tree = [...doc.querySelectorAll('#tree .item[data-key^="i"]')].map(e => e.dataset.key);

        // ---- 手上零件（草稿）----
        const itDisk = async (id) => (await read(json, 'item.json'))[id].equip;
        const sbParts = (id) => (gdb()?._prefabDB?.[`@item:${id}`]?.parts ?? []);
        // 木偶拿 t-wand：手上跟著草稿（sandbox 讀的是專案的 item.json，補進去）
        gdb()._itemDB['t-wand'] = {cat: 'CAT_WEAPON', equip: {sprite: 'sword-bronze', parts: [{particle: 'fire-charge', x: 3, y: -20}]}};
        await sc.addRole(Object.keys(sc.S.refs.roles)[0], 20, 8);
        await sc.flush();
        await sc.setEquip('r1', 'CAT_WEAPON', 't-wand');
        await sc.flush();
        const pupHand = () => (sb().roles.find(p => p.key === 'r1')?.view?._eqParts ?? []).map(l => l.pts.length);
        await until(() => pupHand().length === 1);
        out.pup0 = pupHand();

        // 右欄：沒有手上下拉、零件清單（只有 ＋粒子／＋光源）
        sc.pickRole('i2');
        await until(() => sb()._inspect?.key === 'i2');
        out.panel = [!doc.querySelector('#right [data-k="hand"]'), doc.querySelectorAll('#right .part').length,
            !doc.querySelector('#right [data-k="addPng"]'), !!doc.querySelector('#right [data-k="addParticle"]'), !!doc.querySelector('#right [data-k="addLight"]')];
        sc.openPart(0);
        out.form = [!!doc.querySelector('#right .partform [data-k="under"]'), !doc.querySelector('#right .partform [data-k="depthNote"]'), !!doc.querySelector('#right .partform [data-k="toScene"]')];

        // 改位置＝@t-wand 的草稿，sandbox 照草稿；儲存寫 item.json 的 equip.parts、一筆 undo
        await sc.setPart('@t-wand', 0, {x: 5});
        await until(() => sbParts('t-wand')[0]?.x === 5);
        out.pDraft = [sc.S.draft?.id, !!doc.querySelector('#right [data-k="saveDraft"]'), JSON.stringify(sc.itemEquip('t-wand').parts)];
        // ＋光源、粒子勾 under、光源停用：木偶跟著草稿（存檔會重開 sandbox、讀回 repo 的 item.json，所以存之前驗）；sandbox 的 under 粒子排在道具圖後面
        await sc.addPart('@t-wand', 'light');
        await until(() => JSON.stringify(pupHand()) === '[2]');
        out.pup1 = pupHand();
        await sc.setPart('@t-wand', 0, {under: true});
        await sc.setPartOn('@t-wand', 1, false);
        await until(() => JSON.stringify(pupHand()) === '[1]');
        out.pup1.push(...pupHand(), sbParts('t-wand')[0]?.depth, sbParts('t-wand')[1]?.off);
        const u0 = sc.S.undo.length;
        await sc.saveDraft();
        await sc.flush();
        out.pSave = [await itDisk('t-wand'), sc.S.draft, sc.S.undo.length - u0];
        await until(() => sc.S.ready && sb()?._insts?.i2);

        // 全部刪掉：儲存拿掉 parts、其他欄位留著；undo 回來
        sc.pickRole('i2');
        await sc.delParts('@t-wand', [0, 1]);
        await until(() => sbParts('t-wand').length === 1);
        await sc.saveDraft();
        await sc.flush();
        const e2 = await itDisk('t-wand');
        out.noneSave = ['parts' in e2, e2.sprite];
        await sc.undo();
        out.noneUndo = (await itDisk('t-wand')).parts?.length;
        await until(() => sc.S.ready && sb()?._insts?.i2);

        // t-torch ＋粒子 [新增]：範本進草稿，儲存寫 particle.json＋item.json
        sc.pickRole('i1');
        await sc.addPart('@t-torch', 'particle', '[新增]', 'torch-new');
        out.newP = [sc.S.draft?.id, Object.keys(sc.S.draft?.ps ?? {})];
        await sc.saveDraft();
        await sc.flush();
        out.newPSave = [(await itDisk('t-torch')).parts.map(p => p.particle ?? 'light'), !!(await read(json, 'particle.json'))['torch-new']];
        await until(() => sc.S.ready && sb()?._insts?.i1);

        // ---- 加到道具 ▸（發射點、光源；prefab 實例沒有）----
        await sc.addEmitter('fire-charge', 330, 180);
        await sc.setEmitter('e1', {def: {img: 'p-dot', mode: 'stream', speedY: -30}});
        await sc.addInst('t-fire', 100, 100);
        await sc.addLight(410, 190);
        await sc.flush();
        const ctx = (key) => {
            doc.querySelector(`#tree .item[data-key="${key}"]`).dispatchEvent(new win.MouseEvent('contextmenu', {bubbles: true, clientX: 50, clientY: 50}));
            const items = [...doc.querySelectorAll('.ctxmenu button')];
            return items;
        };
        const mbtn = ctx('e1').find(b => b.textContent.startsWith('加到道具'));
        mbtn?.click();
        out.menu = [mbtn?.textContent, [...doc.querySelectorAll('.ctxmenu button')].map(b => b.textContent)];
        doc.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        out.menu.push(ctx('l1').some(b => b.textContent.startsWith('加到道具')), !ctx('f1').some(b => b.textContent.startsWith('加到道具')));
        doc.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        // 發射點（✎）→ t-torch：加一筆（不問）；另存 <道具>-<原 id>、位置相對握點、發射點搬走、一筆 undo
        const u1 = sc.S.undo.length;
        await sc.addToItem('e1', 'i1');
        await sc.flush();
        out.addE = [JSON.stringify((await itDisk('t-torch')).parts.at(-1)), (await itDisk('t-torch')).parts.length, JSON.stringify((await read(json, 'particle.json'))['t-torch-fire-charge']),
            (await scDisk()).particles ?? null, sc.S.pick, sc.S.undo.length - u1];
        await sc.undo();
        out.addEUndo = [(await itDisk('t-torch')).parts.length, (await scDisk()).particles?.length];
        // 光源 → t-wand：{light, x, y}、光源搬走
        await sc.addToItem('l1', 'i2');
        await sc.flush();
        out.addL = [JSON.stringify((await itDisk('t-wand')).parts.at(-1)), (await scDisk()).lights ?? null];

        // ---- 移到場景：道具零件 → 場景光源（絕對位置）、item.json 拿掉 ----
        await until(() => sc.S.ready && sb()?._insts?.i2);
        const n2 = (await itDisk('t-wand')).parts.length;
        await sc.partsToScene('i2', [n2 - 1]);
        await sc.flush();
        const l = (await scDisk()).lights?.[0];
        out.toScene = [(await itDisk('t-wand')).parts.length, l && [l.x, l.y, l.r], sc.S.pick];

        // ---- 道具分頁：零件唯讀摘要、不存在的粒子 ⚠、↗ 場景 ----（寫了 item.json 的 sandbox 重開完才切分頁，藏著的 canvas 0 大小）
        await until(() => sc.S.ready && sb()?._insts?.i2);
        T.show('item');
        const iw = () => T.S.frames.item?.contentWindow, ie = () => iw()?.__ie;
        await until(() => ie()?.S.items?.['t-wand']?.equip?.parts, 1000);
        ie().S.sel = 't-wand';
        ie().S.view = 'form';
        ie().set('t-wand', ['equip', 'parts'], [{particle: 'nope', x: 1}, {light: {r: 50}}, {x: 2}]);
        await until(() => iw().document.querySelector('#view .warns'));
        ie().S.open.equip = true;
        ie().render();
        const idoc = iw().document;
        const warns = [...idoc.querySelectorAll('#view .warns li')].map(li => li.textContent);
        out.itemTab = [warns.some(w => w.includes('nope')), warns.some(w => w.includes('parts[2]')),
            idoc.querySelectorAll('#view [data-k="equip.parts"] > div').length, !!idoc.querySelector('#view [data-k="gotoScene"]')];
        ie().undo();
        sc.pickRole(null);
        idoc.querySelector('#view [data-k="gotoScene"]').click();
        await until(() => sc.S.pick === 'i2');
        out.goto = sc.S.pick;

        // ---- 粒子分頁：道具拿在手上用的不能刪 ----
        await until(() => sc.S.ready && sb()?._insts?.i2);
        T.show('particle');
        const pw = () => T.S.frames.particle?.contentWindow, pt = () => pw()?.__pt;
        await until(() => pt()?.S.data?.['torch-new'], 1000);
        pt().S.ext.items = {'t-torch': {equip: {parts: [{light: {}}, {particle: 'torch-new'}]}}};
        const pd = pw().document.getElementById('dlgAsk'), rm = pt().D.remove('torch-new');
        await until(() => pd.open);
        out.pDel = [pd.textContent.includes('不能刪'), pd.textContent.includes('道具 t-torch')];
        pd.close('ok');
        await rm;
        out.pDel.push(!!pt().S.data['torch-new']);
        T.show('scene');
        return out;
    });
    t.eq('面板道具分頁只列拿在手上的、標手上零件數', JSON.stringify(r.lib), JSON.stringify(['t-torch|🔥1 💡1', 't-wand|🔥1', 't-plain|']));
    t.eq('放道具實例：t-bag 擋掉、寫 items', JSON.stringify(r.disk), JSON.stringify([{key: 'i1', item: 't-torch', x: 300, y: 200}, {key: 'i2', item: 't-wand', x: 400, y: 200}, {key: 'i3', item: 't-plain', x: 500, y: 200}]));
    t.eq('選起最後放的、編的 prefab＝@道具、右欄有道具下拉', JSON.stringify(r.pick), JSON.stringify(['i3', '@t-torch', '@t-wand', true]));
    t.eq('sandbox：@item:<道具>＝手上零件＋最後墊道具圖（scale＝equip.scale）', JSON.stringify(r.sandbox), JSON.stringify([
        ['@item:t-torch', ['fire-charge', 'light', 'sword-iron'], 0.5], ['@item:t-wand', ['fire-charge', 'sword-bronze'], 1], ['@item:t-plain', ['sword-bronze'], 1]]));
    t.eq('手上的光源有建', r.view, 1);
    t.eq('改位置寫檔、sandbox 跟著', JSON.stringify(r.move), '[320,true]');
    t.eq('刪除', JSON.stringify(r.del), JSON.stringify([['i1', 'i2'], null]));
    t.eq('左欄樹列道具實例', JSON.stringify(r.tree), JSON.stringify(['i1', 'i2']));
    t.eq('木偶拿 t-wand：手上一個粒子', JSON.stringify(r.pup0), '[1]');
    t.eq('右欄：沒有手上下拉、零件清單、只有＋粒子／＋光源', JSON.stringify(r.panel), '[true,1,true,true,true]');
    t.eq('粒子表單：有「後面」、沒有深度、有移到場景', JSON.stringify(r.form), '[true,true,true]');
    t.eq('改粒子位置＝@t-wand 草稿、出儲存鈕、equip 照草稿', JSON.stringify(r.pDraft), JSON.stringify(['@t-wand', true, '[{"particle":"fire-charge","x":5,"y":-20}]']));
    t.eq('＋光源木偶多一個、停用少一個；sandbox under 粒子排道具圖後面、停用標 off', JSON.stringify(r.pup1), '[2,1,-20000,true]');
    t.eq('儲存：item.json 的 equip.parts（under／off 寫進去）、草稿清掉、一筆 undo', JSON.stringify(r.pSave), JSON.stringify([{sprite: 'sword-bronze',
        parts: [{particle: 'fire-charge', x: 5, y: -20, under: true}, {light: {r: 120, color: '#ffcc88'}, off: true}]}, null, 1]));
    t.eq('全部刪掉：拿掉 parts、其他留著；undo 回來', JSON.stringify([r.noneSave, r.noneUndo]), JSON.stringify([[false, 'sword-bronze'], 2]));
    t.eq('＋粒子 [新增]：範本進草稿', JSON.stringify(r.newP), JSON.stringify(['@t-torch', ['torch-new']]));
    t.eq('儲存：particle.json 寫新的、item.json 加一筆', JSON.stringify(r.newPSave), JSON.stringify([['fire-charge', 'light', 'torch-new'], true]));
    t.eq('右鍵：發射點／光源有加到道具 ▸、prefab 實例沒有', JSON.stringify(r.menu), JSON.stringify(['加到道具 ▸', ['i1　t-torch', 'i2　t-wand'], true, true]));
    t.eq('發射點 ✎ → 道具：加一筆、另存 <道具>-<原 id>、相對握點、搬走、選道具實例、一筆 undo', JSON.stringify(r.addE), JSON.stringify([
        '{"particle":"t-torch-fire-charge","x":10,"y":-20}', 4, JSON.stringify({img: 'p-dot', mode: 'stream', speedY: -30}), null, 'i1', 1]));
    t.eq('undo：道具回原本、發射點回來', JSON.stringify(r.addEUndo), '[3,1]');
    t.eq('光源 → 道具：{light, x, y}、搬走', JSON.stringify(r.addL), JSON.stringify(['{"light":{"r":120,"color":"#ffcc88"},"x":10,"y":-10}', null]));
    t.eq('移到場景：item.json 拿掉、場景光源絕對位置、選起來', JSON.stringify(r.toScene), JSON.stringify([2, [410, 190, 120], 'l1']));
    t.eq('道具分頁：不存在的粒子／空零件標 ⚠、零件摘要列、有 ↗ 場景', JSON.stringify(r.itemTab), '[true,true,3,true]');
    t.eq('↗ 場景：選起場景裡那個道具實例', r.goto, 'i2');
    t.eq('粒子分頁：道具拿在手上用的擋刪除', JSON.stringify(r.pDel), '[true,true,true]');
});
