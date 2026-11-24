// 場景分頁的道具實例：左欄道具庫、放／選／移、sandbox 畫直立道具圖＋手上的 prefab／粒子（docs/scene-tool.md「道具實例」）
import {run} from './harness.mjs'

run('item-scene', async t => {
    await t.page.goto(new URL('/tools/#scene', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__sc);    const r = await t.page.evaluate(async () => {
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
            't-torch': {cat: 'CAT_EQUIP', icon: 'sword-iron', equip: {sprite: 'sword-iron', scale: 0.5, prefab: {prefab: 't-fire'}}},
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

        // ---- 手上（草稿）----
        const itDisk = async (id) => (await read(json, 'item.json'))[id].equip;
        const sbParts = (id) => (doc.getElementById('game').contentWindow.__dbg?.DB._prefabDB?.[`@item:${id}`]?.parts ?? []).map(p => p.img ?? p.particle ?? 'light');
        // 木偶拿 t-wand：手上的粒子跟著草稿（sandbox 讀的是專案的 item.json，補進去）
        const gdb = () => doc.getElementById('game').contentWindow.__dbg.DB;
        gdb()._itemDB['t-wand'] = {cat: 'CAT_WEAPON', equip: {sprite: 'sword-bronze', particle: {particle: 'fire-charge', x: 3, y: -20}}};
        gdb()._prefabDB['t-fire'] ??= {parts: [{particle: 'fire-charge', y: -25}, {light: {r: 70}, y: -25}]};
        await sc.addRole(Object.keys(sc.S.refs.roles)[0], 20, 8);
        await sc.flush();
        await sc.setEquip('r1', 'CAT_WEAPON', 't-wand');
        await sc.flush();
        const pupHand = () => (sb().roles.find(p => p.key === 'r1')?.view?._eqPrefabs ?? []).map(l => l.pts.length);
        await until(() => pupHand().length === 1);
        out.pup0 = pupHand();

        sc.pickRole('i2');
        await until(() => sb()._inspect?.key === 'i2');
        out.mode = [sc.handMode(sc.instOf('i2')), doc.querySelector('#right [data-k="hand"]')?.value, !!doc.querySelector('#right .partform [data-k="particle"]'),
            !doc.querySelector('#right .partform [data-k="depthNote"]'), JSON.stringify(sb()._inspect?.partSel)];
        // 木偶跟著草稿：手上換成 prefab（粒子＋光源），放棄回來（存檔會重開 sandbox，讀回專案的 item.json，所以在這裡驗）
        await sc.setHand('i2', 'prefab', 't-fire');
        await until(() => JSON.stringify(pupHand()) === '[2]');
        out.pup1 = pupHand();
        sc.dropDraft();
        await until(() => JSON.stringify(pupHand()) === '[1]');
        out.pup1.push(...pupHand());
        // 粒子：改位置＝@t-wand 的草稿，sandbox 照草稿；儲存寫 item.json 的 equip.particle、一筆 undo
        await sc.setPart('@t-wand', 0, {x: 5});
        await until(() => sb()._insts.i2 && doc.getElementById('game').contentWindow.__dbg.DB._prefabDB['@item:t-wand'].parts[0].x === 5);
        out.pDraft = [sc.S.draft?.id, !!doc.querySelector('#right [data-k="saveDraft"]'), JSON.stringify(sc.itemEquip('t-wand').particle)];
        const u0 = sc.S.undo.length;
        await sc.saveDraft();
        await sc.flush();
        out.pSave = [JSON.stringify(await itDisk('t-wand')), sc.S.draft, sc.S.undo.length - u0];
        await until(() => sc.S.ready && sb()?._insts?.i2);

        // 換成 prefab：草稿管 t-fire＋hand；sandbox 跟木偶跟著；儲存 equip.prefab、拿掉 particle
        await sc.setHand('i2', 'prefab', 't-fire');
        await until(() => sbParts('t-wand').includes('light'));
        out.toPf = [sc.S.draft?.id, sc.S.draft?.hand?.id, sc.instOf('i2').prefab, sbParts('t-wand'), sc.itemEquip('t-wand').particle ?? null];
        // 偏移：草稿的 hand、sandbox 錨點＝握點＋偏移、道具圖挪回握點；undo 一起退
        const gx = sc.instOf('i2').x, gy = sc.instOf('i2').y;
        sc.setHandOff('i2', {x: 3});
        sc.setHandOff('i2', {y: -4});
        await until(() => sb()?._insts?.i2?.data.y === gy - 4);
        const refPart = () => doc.getElementById('game').contentWindow.__dbg.DB._prefabDB['@item:t-wand'].parts.at(-1);
        out.off = [JSON.stringify(sc.itemEquip('t-wand').prefab), sb()._insts.i2.data.x - gx, refPart().x, refPart().y,
            !!doc.querySelector('#right [data-k="handOff.x"]') && doc.querySelector('#right [data-k="handOff.y"]').value];
        sc.undo();
        out.offUndo = JSON.stringify(sc.itemEquip('t-wand').prefab);
        sc.redo();
        await sc.saveDraft();
        await sc.flush();
        const e1 = await itDisk('t-wand');
        out.pfSave = [e1.prefab, e1.particle ?? null, sc.S.draft];
        await until(() => sc.S.ready && sb()?._insts?.i2);

        // 無：@t-wand 的空草稿，儲存兩個都拿掉
        sc.pickRole('i2');
        await sc.setHand('i2', 'none');
        await until(() => sbParts('t-wand').length === 1);
        out.none = [sc.S.draft?.id, sc.handMode(sc.instOf('i2')), sbParts('t-wand')];
        await sc.saveDraft();
        await sc.flush();
        const e2 = await itDisk('t-wand');
        out.noneSave = [e2.prefab ?? null, e2.particle ?? null, e2.sprite];
        await sc.undo();
        out.noneUndo = (await itDisk('t-wand')).prefab;
        await until(() => sc.S.ready && sb()?._insts?.i2);

        // t-torch（prefab）→ [新增] 粒子：範本進草稿，儲存寫 particle.json＋item.json
        sc.pickRole('i1');
        await sc.setHand('i1', 'particle', '[新增]', 'torch-new');
        out.newP = [sc.S.draft?.id, Object.keys(sc.S.draft?.ps ?? {})];
        await sc.saveDraft();
        await sc.flush();
        const e3 = await itDisk('t-torch');
        out.newPSave = [e3.prefab ?? null, JSON.stringify(e3.particle), !!(await read(json, 'particle.json'))['torch-new'], !!(await read(json, 'prefab.json'))['t-fire']];
        await until(() => sc.S.ready && sb()?._insts?.i1);

        // ---- 加到道具 ▸ ----
        await sc.addEmitter('fire-charge', 330, 180);
        await sc.setEmitter('e1', {def: {img: 'p-dot', mode: 'stream', speedY: -30}});
        await sc.addInst('t-fire', 100, 100);
        await sc.flush();
        doc.querySelector('#tree .item[data-key="e1"]').dispatchEvent(new win.MouseEvent('contextmenu', {bubbles: true, clientX: 50, clientY: 50}));
        const mbtn = [...doc.querySelectorAll('.ctxmenu button')].find(b => b.textContent.startsWith('加到道具'));
        mbtn?.click();
        out.menu = [mbtn?.textContent, [...doc.querySelectorAll('.ctxmenu button')].map(b => b.textContent)];
        doc.querySelector('.ctxmenu')?.remove();
        // 發射點（✎）→ t-torch：已有粒子先問取代；另存 <道具>-<原 id>、位置相對握點、發射點搬走、一筆 undo
        const dlg = doc.getElementById('dlgAsk');
        const u1 = sc.S.undo.length, p = sc.addToItem('e1', 'i1');
        await until(() => dlg.open);
        out.ask = dlg.textContent.includes('torch-new');
        dlg.close('ok');
        await p;
        await sc.flush();
        out.addE = [JSON.stringify((await itDisk('t-torch')).particle), JSON.stringify((await read(json, 'particle.json'))['t-torch-fire-charge']),
            (await scDisk()).particles ?? null, sc.S.pick, sc.S.undo.length - u1];
        await sc.undo();
        out.addEUndo = [JSON.stringify((await itDisk('t-torch')).particle), (await scDisk()).particles?.length];
        // prefab 實例 → t-wand（sure）：equip.prefab、實例留著
        await sc.addToItem('f1', 'i2', true);
        await sc.flush();
        const e4 = await itDisk('t-wand');
        out.addF = [e4.prefab, e4.particle ?? null, (await scDisk()).prefabs.map(o => o.key)];

        // ---- 道具分頁：粒子欄位（id／x／y 同一列）、二選一 ⚠、↗ 場景 ----（寫了 item.json 的 sandbox 重開完才切分頁，藏著的 canvas 0 大小）
        await until(() => sc.S.ready && sb()?._insts?.i2);
        T.show('item');
        const iw = () => T.S.frames.item?.contentWindow, ie = () => iw()?.__ie;
        await until(() => ie()?.S.items?.['t-wand']?.equip?.prefab?.prefab === 't-fire', 1000);
        ie().S.sel = 't-wand';
        ie().S.view = 'form';
        ie().set('t-wand', ['equip', 'particle'], {particle: 'fire-charge', x: 1});
        await until(() => iw().document.querySelector('#view .warns'));
        ie().S.open.equip = true;
        ie().render();
        const idoc = iw().document;
        out.itemTab = [[...idoc.querySelectorAll('#view .warns li')].some(li => li.textContent.includes('二選一')),
            idoc.querySelector('#view [data-k="equip.particle.particle"]')?.closest('.nums')?.querySelector('[data-k="equip.particle.y"]') != null,
            !!idoc.querySelector('#view [data-k="gotoScene"]')];        ie().undo();
        sc.pickRole(null);
        idoc.querySelector('#view [data-k="gotoScene"]').click();
        await until(() => sc.S.pick === 'i2');
        out.goto = [T.S.tab ?? location.hash, sc.S.pick];

        // ---- 粒子分頁：道具拿在手上用的不能刪 ----
        await until(() => sc.S.ready && sb()?._insts?.i2);
        T.show('particle');
        const pw = () => T.S.frames.particle?.contentWindow, pt = () => pw()?.__pt;
        await until(() => pt()?.S.data?.['torch-new'], 1000);
        pt().S.ext.items = {'t-torch': {equip: {particle: {particle: 'torch-new'}}}};
        const pd = pw().document.getElementById('dlgAsk'), rm = pt().D.remove('torch-new');
        await until(() => pd.open);
        out.pDel = [pd.textContent.includes('不能刪'), pd.textContent.includes('道具 t-torch')];
        pd.close('ok');
        await rm;
        out.pDel.push(!!pt().S.data['torch-new']);
        T.show('scene');
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
    t.eq('木偶拿 t-wand：手上一個粒子', JSON.stringify(r.pup0), '[1]');
    t.eq('手上＝粒子：右欄下拉、粒子表單沒有深度、粒子一直算選取', JSON.stringify(r.mode), JSON.stringify(['particle', 'particle', true, true, '[0]']));
    t.eq('改粒子位置＝@t-wand 草稿、出儲存鈕、equip 照草稿', JSON.stringify(r.pDraft), JSON.stringify(['@t-wand', true, '{"particle":"fire-charge","x":5,"y":-20}']));
    t.eq('儲存：item.json 的 equip.particle、草稿清掉、一筆 undo', JSON.stringify(r.pSave),
         JSON.stringify([JSON.stringify({sprite: 'sword-bronze', particle: {particle: 'fire-charge', x: 5, y: -20}}), null, 1]));
    t.eq('換成 prefab：草稿管 t-fire＋hand、sandbox 照它、equip 沒有 particle', JSON.stringify(r.toPf), JSON.stringify(['t-fire', 't-wand', 't-fire', ['fire-charge', 'light', 'sword-bronze'], null]));
    t.eq('木偶手上跟著草稿換成 prefab（粒子＋光源）、放棄回來', JSON.stringify(r.pup1), '[2,1]');
    t.eq('手上 prefab 偏移：equip.prefab 的 x/y、sandbox 錨點＝握點＋偏移、道具圖挪回握點、右欄 x/y', JSON.stringify(r.off),
         JSON.stringify(['{"prefab":"t-fire","x":3,"y":-4}', 3, -3, 4, '-4']));
    t.eq('偏移 undo 一步', r.offUndo, '{"prefab":"t-fire","x":3}');
    t.eq('儲存 prefab：equip.prefab（含偏移）、particle 拿掉', JSON.stringify(r.pfSave), JSON.stringify([{prefab: 't-fire', x: 3, y: -4}, null, null]));
    t.eq('手上＝無：@ 空草稿、sandbox 只剩道具圖', JSON.stringify(r.none), JSON.stringify(['@t-wand', 'none', ['sword-bronze']]));
    t.eq('儲存無：兩個都拿掉、其他欄位留著；undo 回來', JSON.stringify([r.noneSave, r.noneUndo]), JSON.stringify([[null, null, 'sword-bronze'], {prefab: 't-fire', x: 3, y: -4}]));
    t.eq('prefab → [新增] 粒子：範本進草稿', JSON.stringify(r.newP), JSON.stringify(['@t-torch', ['torch-new']]));
    t.eq('儲存：particle.json 寫新的、item.json 換 particle、prefab 本身留著', JSON.stringify(r.newPSave), JSON.stringify([null, '{"particle":"torch-new"}', true, true]));
    t.eq('發射點右鍵：加到道具 ▸ 道具實例', JSON.stringify(r.menu), JSON.stringify(['加到道具 ▸', ['i1　t-torch', 'i2　t-wand']]));
    t.check('已有粒子先問取代', r.ask);
    t.eq('發射點 ✎ → 道具：另存 <道具>-<原 id>、相對握點、搬走、選道具實例、一筆 undo', JSON.stringify(r.addE), JSON.stringify([
        '{"particle":"t-torch-fire-charge","x":10,"y":-20}', JSON.stringify({img: 'p-dot', mode: 'stream', speedY: -30}), null, 'i1', 1]));
    t.eq('undo：道具回原本、發射點回來', JSON.stringify(r.addEUndo), JSON.stringify(['{"particle":"torch-new"}', 1]));
    t.eq('prefab 實例 → 道具：equip.prefab、拿掉 particle、實例留著', JSON.stringify(r.addF), JSON.stringify([{prefab: 't-fire'}, null, ['f1']]));
    t.eq('道具分頁：兩個都寫標二選一、粒子欄位同一列、有 ↗ 場景', JSON.stringify(r.itemTab), '[true,true,true]');
    t.eq('↗ 場景：選起場景裡那個道具實例', r.goto[1], 'i2');
    t.eq('粒子分頁：道具拿在手上用的擋刪除', JSON.stringify(r.pDel), '[true,true,true]');
});
