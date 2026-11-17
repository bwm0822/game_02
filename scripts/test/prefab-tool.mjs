// 場景分頁的 prefab（docs/prefab.md 第 3 步）：prefab 庫、新增／刪除（prefab.json＋scenes.json 一筆 undo）、實例放置／拖放／拖曳／狀態、sandbox 建成遊戲物件、左欄摺疊
import {run} from './harness.mjs'

run('prefab-tool', async t => {
    await t.page.goto(new URL('/tools/#scene', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__sc);
    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f, n = 500) => {for (let i = 0; i < n && !await f(); i++) await sleep(20); return f();};
        const win = T.S.frames.scene.contentWindow, sc = win.__sc, doc = win.document;
        const game = () => doc.getElementById('game').contentWindow;
        const sb = () => game().__sb;

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        await write(json, 'item.json', '{}');
        const read = async (d, name) => {await sc.flush(); const fh = await d.getFileHandle(name).catch(() => null); return fh ? JSON.parse(await (await fh.getFile()).text()) : null;};
        const pfDisk = () => read(json, 'prefab.json');
        const scDisk = async () => (await read(await dir(proj, 'tools'), 'scenes.json'))?.['測試'];

        await until(() => sc.S.ready && sb()?.map);
        await T.setProject(proj);
        await until(() => sc.S.root);
        out.emptyLib = doc.getElementById('lib').textContent;

        await sc.addScene('測試');
        // 新增空白 prefab：寫 prefab.json、場景中間放一個實例、選起來
        await sc.newPrefab('forge');
        out.newPf = [await pfDisk(), (await scDisk()).prefabs, sc.S.edit && {...sc.S.edit}, !doc.getElementById('editBar').hidden];
        await sc.exitEdit();
        await sc.newPrefab('bad id');
        out.badId = doc.getElementById('status').textContent;
        await sc.undo();
        out.undoNew = [await pfDisk(), (await scDisk()).prefabs ?? null];
        await sc.redo();
        out.redoNew = [Object.keys(await pfDisk()), (await scDisk()).prefabs?.length];

        // 別的分頁改了 prefab.json（廣播）：分頁重讀、sandbox 照新內容重建
        const def = {look: 'off', acts: {turn_on: 'on'}, thumb: {x: -16, y: -32, w: 32, h: 32},
                     parts: [{img: 'Barrel'}, {img: 'Crate', y: -24, look: 'on'}, {light: {r: 80}, look: 'on'}]};
        await write(json, 'prefab.json', JSON.stringify({forge: def}, null, 2) + '\n');
        new BroadcastChannel('tools').postMessage({type: 'saved', file: 'prefab.json'});
        await until(() => sc.S.prefabs.forge?.parts);
        const inst = () => sb()._insts?.f1;
        out.built = await until(() => inst()?.go?.view?._parts?.length === 3) && [inst().go.constructor.name, inst().go.bb.prefab, inst().go.getLook(),
            inst().go.view._shape.list.map(c => c.visible)];
        out.libRow = [...doc.querySelectorAll('#lib .item')].map(e => [e.dataset.prefab, e.draggable]);

        // 點選：sandbox 點得到、右欄
        const g = inst().go;
        out.pick = sb()._pickAt(g.x, g.y - 8)?.key;
        sc.pickRole('f1');
        out.right = doc.querySelector('#right .sec').textContent;
        out.lookOpts = [...doc.querySelectorAll('#right [data-k="look"] option')].map(o => o.value);

        // 狀態：寫進實例、sandbox 重建成 on（Crate 出現、光源一盞）
        await sc.setInst('f1', {look: 'on'});
        out.look = await until(() => inst()?.go?.getLook?.() === 'on') && [(await scDisk()).prefabs[0].look, inst().go.view._shape.list.map(c => c.visible),
            inst().go.view._parts.filter(e => e.light).length];

        // sandbox 拖曳放開（moveInst）→ 寫檔
        sb()._send({sb: 'moveInst', key: 'f1', x: 200, y: 160});
        out.move = await until(async () => (await scDisk()).prefabs[0].x === 200) && [(await scDisk()).prefabs[0], await until(() => inst()?.go?.x === 200) && [inst().go.x, inst().go.y]];

        // 方向鍵
        await sc.nudge(1, 0);
        out.nudge = (await scDisk()).prefabs[0].x;

        // 從 prefab 庫拖進畫面（HTML5 drop 事件）
        const cv = game().document.querySelector('canvas'), rect = cv.getBoundingClientRect();
        const dt = new (game().DataTransfer)();
        dt.setData('application/x-prefab', 'forge');
        cv.dispatchEvent(new (game().DragEvent)('drop', {dataTransfer: dt, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, bubbles: true, cancelable: true}));
        out.drop = await until(async () => (await scDisk()).prefabs?.length === 2) && [(await scDisk()).prefabs[1].key, (await scDisk()).prefabs[1].prefab, sc.S.pick,
            await until(() => sb()._insts?.f2?.go?.active)];

        // 👁 藏＝sandbox 不建
        sc.toggleHide('f2');
        out.hide = await until(() => !sb()._insts.f2) && !sb()._insts.f2;
        sc.toggleHide('f2');
        out.unhide = await until(() => sb()._insts.f2?.go?.active);

        // 左欄摺疊：prefab 庫收起來、記 localStorage
        sc.toggleFold('lib');
        out.fold = [doc.querySelectorAll('#lib .item').length, doc.querySelector('#lib .head .tw').textContent, JSON.parse(win.localStorage.getItem('tools.scene.fold'))];
        sc.toggleFold('lib');
        sc.toggleFold('prefabs');
        out.foldTree = doc.querySelectorAll('#tree .item[data-key^="f"]').length;
        sc.toggleFold('prefabs');

        // 刪 prefab：連場景裡的實例一起拿掉；undo 一起回來
        await sc.deletePrefab('forge', true);
        out.delPf = [await pfDisk(), (await scDisk()).prefabs ?? null, await until(() => !sb()._insts.f1 && !sb()._insts.f2)];
        await sc.undo();
        out.undoDel = [Object.keys(await pfDisk()), (await scDisk()).prefabs?.length];

        // 刪實例（Del）
        sc.pickRole('f2');
        await sc.deleteObj('f2');
        out.delInst = (await scDisk()).prefabs.map(o => o.key);

        // ---------- 編輯模式 ----------
        await sc.setInst('f1', {x: 400, y: 288, look: undefined});
        await sc.addProp('Crate', 300, 200);              // 場景本身的擺設 p1
        sc.enterEdit('f1');
        const sbProps = () => Object.keys(sb()._props).sort();
        out.enter = await until(() => sb()._props.xp1 && sb()._props.p2) && [sc.S.edit.id, doc.getElementById('editBar').textContent.includes('forge'),
            sbProps(), sb()._props.xp1.sp.alpha, sb()._pickAt(300, 190)?.key ?? null, [...doc.querySelectorAll('#tree .item')].map(e => e.dataset.key),
            doc.querySelector('#right .sec').textContent];
        // 零件編輯＝寫 prefab.json（相對錨點），scenes.json 不動
        const sc0 = JSON.stringify(await scDisk());
        await sc.setProp('p1', {x: 410});
        out.moveImg = [(await pfDisk()).forge.parts[0], JSON.stringify(await scDisk()) === sc0];
        // 篩選 on：新零件標 on；只看得到 on＋沒標的
        sc.S.edit.look = 'on';
        await sc.addLight(400, 260);
        out.addLight = [(await pfDisk()).forge.parts.at(-1), [...doc.querySelectorAll('#tree .item')].map(e => e.dataset.key)];
        sc.S.edit.look = 'off';
        sc.toggleFold('lights'); sc.toggleFold('lights');
        out.filterOff = [...doc.querySelectorAll('#tree .item')].map(e => e.dataset.key);
        sc.S.edit.look = null;
        // prefab 欄位：預設狀態、acts、defAct、占地方塊
        await sc.setPf({acts: {turn_on: 'on', turn_off: 'off'}, defAct: 'turn_on', grid: {x: -16, y: -16, w: 32, h: 16}});
        sc.pickRole(null);
        out.panel = [doc.querySelector('#right .sec').textContent, [...doc.querySelectorAll('#right tr[data-act]')].map(e => e.dataset.act),
            doc.querySelector('#right [data-k="defAct"]').value, doc.querySelector('#right [data-k="grid.w"]').value];
        // undo：零件編輯一步步退
        await sc.undo();
        out.undoPf = (await pfDisk()).forge.acts ?? null;
        await sc.redo();
        // 外部 png 零件：離開時照 pct 烤進 textures/prefabs/forge/、改成 texture key、算縮圖外框
        await sc.addProp('file:public/assets/textures/props/Crate.png', 380, 288);
        await sc.setProp('p3', {pct: 50});
        const crate = await new Promise(res => {const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = '/assets/textures/props/Crate.png';});
        await sc.exitEdit();
        const baked = await (await (await dir(proj, 'public', 'assets', 'textures', 'prefabs', 'forge')).getFileHandle('forge-Crate.png').catch(() => null))?.getFile();
        const pf = (await pfDisk()).forge;
        out.exit = [sc.S.edit, sc.S.pick, pf.parts.find(p => p.img === 'forge-Crate') ?? null, !!baked, pf.thumb, crate];
        return out;
    });

    t.check('prefab 庫：沒有 prefab 時提示', r.emptyLib.includes('還沒有 prefab'), r.emptyLib);
    t.eq('新增空白 prefab：prefab.json 一筆、場景中間放 f1、直接進編輯模式', JSON.stringify(r.newPf), JSON.stringify([{forge: {}}, [{key: 'f1', prefab: 'forge', x: 400, y: 288}], {id: 'forge', key: 'f1', look: null}, true]));
    t.check('id 不合法擋下', r.badId.includes('英數字'), r.badId);
    t.eq('undo：prefab.json 跟 scenes.json 一起回去', JSON.stringify(r.undoNew), JSON.stringify([{}, null]));
    t.eq('redo：兩個檔一起回來', JSON.stringify(r.redoNew), JSON.stringify([['forge'], 1]));
    t.eq('別處改 prefab.json：sandbox 照新內容建成 Item、預設 off', JSON.stringify(r.built), JSON.stringify(['Item', 'forge', 'off', [true, false]]));
    t.eq('prefab 庫列出、可拖', JSON.stringify(r.libRow), JSON.stringify([['forge', true]]));
    t.eq('sandbox 點得到實例', r.pick, 'f1');
    t.eq('右欄：實例面板', r.right, 'prefab f1');
    t.eq('狀態下拉：預設＋零件／acts 的狀態', JSON.stringify(r.lookOpts), JSON.stringify(['', 'off', 'on']));
    t.eq('改狀態：寫檔、sandbox 重建成 on（Crate 出現、一盞光）', JSON.stringify(r.look), JSON.stringify(['on', [true, true], 1]));
    t.eq('sandbox 拖曳放開：寫檔、重建在新位置', JSON.stringify(r.move), JSON.stringify([{key: 'f1', prefab: 'forge', x: 200, y: 160, look: 'on'}, [200, 160]]));
    t.eq('方向鍵 1px', r.nudge, 201);
    t.check('從 prefab 庫拖進畫面：放 f2、選起來、sandbox 建好', r.drop && r.drop[0] === 'f2' && r.drop[1] === 'forge' && r.drop[2] === 'f2' && r.drop[3], JSON.stringify(r.drop));
    t.check('👁 藏：sandbox 不建', r.hide);
    t.check('取消藏：建回來', r.unhide);
    t.eq('摺疊 prefab 庫：沒有列、▸、記 localStorage', JSON.stringify(r.fold), JSON.stringify([0, '▸', ['lib']]));
    t.eq('摺疊物件樹的 prefab 段', r.foldTree, 0);
    t.eq('刪 prefab：prefab.json 拿掉、實例一起刪、sandbox 清掉', JSON.stringify(r.delPf), JSON.stringify([{}, null, true]));
    t.eq('undo 刪除：兩個檔一起回來', JSON.stringify(r.undoDel), JSON.stringify([['forge'], 2]));
    t.eq('刪實例', JSON.stringify(r.delInst), JSON.stringify(['f1']));

    // 編輯模式
    const [eid, ebar, eprops, ealpha, epick, etree, eright] = r.enter || [];
    t.check('進編輯：上方編輯條', eid === 'forge' && ebar, JSON.stringify(r.enter));
    t.eq('sandbox：場景本身的東西改 key（xp1）＋零件攤成擺設 p1/p2', JSON.stringify(eprops), JSON.stringify(['p1', 'p2', 'xp1']));
    t.check('場景本身的東西變暗、點不到', ealpha < 0.5 && epick !== 'xp1', JSON.stringify([ealpha, epick]));
    t.eq('左欄只列零件（off 的 Barrel、on 的 Crate、on 的光源）', JSON.stringify(etree), JSON.stringify(['p1', 'p2', 'l1']));
    t.eq('右欄沒選＝prefab 面板', eright, 'prefab forge');
    t.eq('拖零件：寫 prefab.json 相對錨點、scenes.json 不動', JSON.stringify(r.moveImg), JSON.stringify([{img: 'Barrel', x: 10}, true]));
    t.eq('篩選 on 時新加的光源標 on、相對錨點', JSON.stringify(r.addLight[0]), JSON.stringify({light: {r: 120, color: '#ffcc88'}, y: -28, look: 'on'}));
    t.eq('篩選 off：只列 off＋沒標的', JSON.stringify(r.filterOff), JSON.stringify(['p1']));
    t.eq('prefab 面板：acts／左鍵動作／占地方塊', JSON.stringify(r.panel), JSON.stringify(['prefab forge', ['turn_on', 'turn_off'], 'turn_on', '32']));
    t.eq('undo：prefab 欄位退一步', JSON.stringify(r.undoPf), JSON.stringify({turn_on: 'on'}));
    const [xedit, xpick, xpart, xbaked, xthumb, crate] = r.exit;
    t.check('離開：不在編輯、選回實例', xedit === null && xpick === 'f1', JSON.stringify([xedit, xpick]));
    t.check('離開：外部 png 照 pct 烤進 textures/prefabs/forge/forge-Crate.png、改成 key、去掉 pct', xbaked && xpart && !('pct' in xpart) && xpart.x === -20, JSON.stringify(xpart));
    t.check('離開：縮圖外框＝預設狀態看得到的 png 聯集', xthumb && xthumb.w >= Math.round(crate[0] / 2) && xthumb.h >= Math.round(crate[1] / 2), JSON.stringify([xthumb, crate]));
});
