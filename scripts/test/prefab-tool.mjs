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
        const Phaser_intersect = (a, b) => {
            const l = Math.max(a.x, b.x), t = Math.max(a.y, b.y), r = Math.min(a.right, b.right), bt = Math.min(a.bottom, b.bottom);
            return l < r && t < bt ? {x: (l + r) / 2, y: (t + bt) / 2} : null;
        };

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        await write(json, 'item.json', '{}');
        await write(json, 'role.json', await (await fetch('/assets/json/role.json')).text());
        // sandbox 的 DB 讀的是真的 particle.json：用遊戲裡有的 id（fire-charge 的 emitZone 是圓 (0,-16) r18）
        await write(json, 'particle.json', JSON.stringify({'fire-charge': {img: 'p-dot', mode: 'stream', emitZone: {type: 'edge', source: {x: 0, y: -16, r: 18}, quantity: 12}}}));
        const read = async (d, name) => {await sc.flush(); const fh = await d.getFileHandle(name).catch(() => null); return fh ? JSON.parse(await (await fh.getFile()).text()) : null;};
        const pfDisk = () => read(json, 'prefab.json');
        const scDisk = async () => (await read(await dir(proj, 'tools'), 'scenes.json'))?.['測試'];

        await until(() => sc.S.ready && sb()?.map);
        await T.setProject(proj);
        await until(() => sc.S.root);
        await sc.flush();
        out.emptyLib = doc.getElementById('lib').textContent;

        await sc.addScene('測試');
        // 新增空白 prefab：寫 prefab.json、場景中間放一個實例、選起來
        await sc.newPrefab('forge');
        out.newPf = [await pfDisk(), (await scDisk()).prefabs, sc.S.pick, doc.querySelector('#right .sec')?.firstChild.textContent];
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
        out.pick = sb()._pickAt(g.x, g.y - 3)?.key;
        // 點選框＝目前看得見的 png（off：只有 Barrel 17×22，origin 底部中間）
        const bx = sb()._instBox(inst());
        out.box = [bx.x - g.x, bx.y - g.y, bx.width, bx.height];
        out.pickThumb = [sb()._pickAt(g.x + 7, g.y - 20)?.key ?? null, sb()._pickAt(g.x, g.y - 24)?.key ?? null];
        doc.getElementById('chkAnchor').click();
        out.pickOff = await until(() => sb()._anchorOn === false) && [sb()._instAt(g.x, g.y), sb()._pickAt(g.x + 7, g.y - 20)?.key ?? null, sb()._anchorPt()];
        doc.getElementById('chkAnchor').click();
        await until(() => sb()._anchorOn === true);
        sc.pickRole('f1');
        await until(() => sb()._sel === 'f1');
        const fk = (x, y) => ({leftButtonDown: () => true, rightButtonDown: () => false, middleButtonDown: () => false, worldX: x, worldY: y, x, y, event: {shiftKey: false, clientX: 0, clientY: 0}});
        const x0 = g.x, y0 = g.y;
        sb().input.emit('pointerdown', fk(x0 + 2, y0 - 2));
        sb().input.emit('pointermove', fk(x0 + 7, y0 - 2));
        sb().input.emit('pointerup', fk(x0 + 7, y0 - 2));
        out.anchorDragInst = await until(async () => (await scDisk()).prefabs[0].x === x0 + 5) && [(await scDisk()).prefabs[0].x - x0, (await scDisk()).prefabs[0].y - y0];
        // 沒選中時從點選框按下去：一下選取＋拖
        sc.pickRole(null);
        await until(() => sb()._sel === null && inst()?.go?.active && inst().go.x === x0 + 5);
        const g2 = inst().go, x1 = g2.x, y1 = g2.y;
        sb().input.emit('pointerdown', fk(x1 + 7, y1 - 20));
        const selBox = sb()._sel;
        sb().input.emit('pointermove', fk(x1 + 10, y1 - 20));
        sb().input.emit('pointerup', fk(x1 + 10, y1 - 20));
        out.boxDragInst = await until(async () => (await scDisk()).prefabs[0].x === x1 + 3 && sc.S.pick === 'f1') && [selBox, (await scDisk()).prefabs[0].x - x1, sc.S.pick];
        // 角色疊在點選框上：角色優先
        const g3 = await until(() => inst()?.go?.active && inst().go.x === x1 + 3) && inst().go;
        const [rtx, rty] = sb().map.worldToTile(g3.x, g3.y);
        await sc.addRole('mary', rtx, rty);
        const role = await until(() => sb().roles.find(p => p.visible && p.getShapeRect));
        // 錨點（8 螢幕 px）照舊優先於角色，點框裡離錨點最遠的那一排
        const rr = role.getShapeRect(), ib = sb()._instBox(inst());
        const ir = Phaser_intersect(rr, ib) && {x: Phaser_intersect(rr, ib).x, y: Math.max(rr.y, ib.y) + 1};
        out.rolePrio = ir && [sb()._instBoxAt(ir.x, ir.y)?.[0] === 'f1' && !sb()._instAt(ir.x, ir.y) && sb()._pickAt(ir.x, ir.y)?.key === role.key];
        await sc.undo();
        await until(() => !sb().roles.some(p => p.visible));
        sc.pickRole('f1');
        out.right = doc.querySelector('#right .sec').textContent;
        out.lookOpts = [...doc.querySelectorAll('#right [data-k="instLook"] option')].map(o => o.value);

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

        // ---------- 右欄改 prefab 內容：實例面板＋prefab 欄位＋零件清單 ----------
        await sc.setInst('f1', {x: 400, y: 288, look: undefined});
        sc.pickRole('f1');
        const partRows = () => [...doc.querySelectorAll('#right .part')].map(e => [+e.dataset.part, e.classList.contains('off')]);
        const secs = () => [...doc.querySelectorAll('#right .sec')].map(e => [...e.childNodes].find(n => n.nodeType === 3 && n.textContent.trim())?.textContent.trim());
        out.panel0 = [partRows(), secs()];
        // 右欄摺疊：屬性／零件／實例各自收起、記 localStorage；草稿列那條不摺
        const fold = (k) => doc.querySelector(`#right .head[data-fold="${k}"] .tw`)?.textContent;
        sc.toggleFold('right.props');
        sc.toggleFold('right.parts');
        out.rFold = [secs(), fold('right.props'), fold('right.parts'), doc.querySelectorAll('#right .part').length, !!doc.querySelector('#right [data-k="defAct"]'),
            JSON.parse(win.localStorage.getItem('tools.scene.fold'))];
        sc.toggleFold('right.inst');
        out.rFoldInst = [secs()[0], !!doc.querySelector('#right [data-k="instLook"]')];
        sc.toggleFold('right.inst');
        sc.toggleFold('right.props');
        // 零件摺著時開零件（sandbox 點到）＝自動打開、記住
        sc.openPart(1);
        out.rAutoOpen = [fold('right.parts'), doc.querySelectorAll('#right .partform').length, JSON.parse(win.localStorage.getItem('tools.scene.fold'))];
        sc.openPart(null);
        out.rStayOpen = fold('right.parts');
        // 點零件展開表單；改欄位＝草稿（記憶體＋sandbox 照草稿畫），prefab.json／scenes.json 都不動
        sc.openPart(0);
        out.open = [doc.querySelectorAll('#right .partform').length, !!doc.querySelector('#right .partform [data-k="x"]'), doc.querySelector('#right .part.sel')?.dataset.part,
            /\bfalse\b/.test(doc.querySelector('#right').textContent), doc.querySelectorAll('#right .hint').length];
        const sc0 = JSON.stringify(await scDisk()), pf0 = JSON.stringify(await pfDisk());
        const draft = () => sc.S.draft?.pf;
        await sc.setPart('forge', 0, {x: 10});
        out.moveImg = [draft().parts[0], JSON.stringify(await pfDisk()) === pf0, JSON.stringify(await scDisk()) === sc0,
            !!doc.querySelector('#right .head[data-fold="right.inst"] [data-k="saveDraft"]'), doc.querySelector('#lib .item[data-prefab="forge"] .warn')?.textContent];
        out.sbDraft = await until(() => inst()?.go?.view?._shape?.list?.[0]?.x === 10);
        // 加光源：零件摺著時按標題列的＋光源＝放在錨點、沒有 look、自動打開並展開它；光源欄位寫進 light
        sc.toggleFold('right.parts');
        const addBtn = doc.querySelector('#right .head[data-fold="right.parts"] [data-k="addLight"]');
        out.addBtns = [...doc.querySelectorAll('#right .head[data-fold="right.parts"] button')].map(b => b.textContent);
        addBtn.click();
        await until(() => draft().parts.length === 4);
        out.addLight = [draft().parts.at(-1), sc.S.part, fold('right.parts'), doc.querySelectorAll('#right .partform').length];
        await sc.setPart('forge', 3, {r: 90, look: 'on'});
        out.setLight = draft().parts[3];
        await sc.movePart('forge', 3, -1);
        out.movePart = [draft().parts.map(p => p.img ?? p.light?.r), sc.S.part];
        await sc.delPart('forge', 2);
        out.delPart = [draft().parts.length, sc.S.part];
        // prefab 欄位：預設狀態、acts、defAct、占地方塊
        await sc.setPf('forge', {acts: {turn_on: 'on', turn_off: 'off'}, defAct: 'turn_on', grid: {x: -16, y: -16, w: 32, h: 16}});
        out.panel = [[...doc.querySelectorAll('#right tr[data-act]')].map(e => e.dataset.act),
            doc.querySelector('#right [data-k="defAct"]').value, doc.querySelector('#right [data-k="grid.w"]').value];
        // 草稿中 undo＝退草稿裡的步驟
        await sc.undo();
        out.undoPf = [draft().acts ?? null, JSON.stringify(await pfDisk()) === pf0];
        await sc.redo();
        // 儲存：寫 prefab.json；全域 undo 一筆退回整份草稿
        await sc.saveDraft();
        const saved = (await pfDisk()).forge;
        out.save = [saved.parts.map(p => p.img ?? p.light?.r), saved.parts[0].x, saved.defAct, sc.S.draft, sc.S.pick];
        await sc.undo();
        out.saveUndo = JSON.stringify(await pfDisk()) === pf0;
        await sc.redo();
        // 外部 png 零件：草稿中 sandbox 直接載原圖（pct 乘進 scale）；儲存時照 pct 烤進 textures/prefabs/forge/、改成 texture key、算縮圖外框
        await sc.addPart('forge', 'png', 'file:public/assets/textures/props/Crate.png');
        await sc.setPart('forge', 3, {pct: 50});
        const imgs = (o) => (o?.list ?? []).flatMap(c => (c.list ? imgs(c) : [c]));
        const fileImg = () => imgs(inst()?.go?.view?._shape).find(c => c.texture?.key?.startsWith('file|'));
        out.sbFile = await until(() => fileImg()?.scaleX === 0.5) && fileImg().texture.key;
        const crate = await new Promise(res => {const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.src = '/assets/textures/props/Crate.png';});
        await sc.saveDraft();
        const baked = await (await (await dir(proj, 'public', 'assets', 'textures', 'prefabs', 'forge')).getFileHandle('forge-Crate.png').catch(() => null))?.getFile();
        const pf = (await pfDisk()).forge;
        out.exit = [sc.S.pick, pf.parts.find(p => p.img === 'forge-Crate') ?? null, !!baked, pf.thumb, crate];
        // 有草稿時取消選取：問 儲存／放棄／取消
        const dlg = doc.getElementById('dlgAsk');
        const answer = async (v) => {await until(() => dlg.open); dlg.close(v); await sleep(50); await sc.flush();};
        const pf1 = JSON.stringify(await pfDisk());
        await sc.setPf('forge', {look: 'on'});
        sc.pickRole(null);
        await answer('cancel');
        out.leaveCancel = [sc.S.pick, !!sc.S.draft];
        sc.pickRole(null);
        await answer('drop');
        out.leaveDrop = [sc.S.pick, sc.S.draft, JSON.stringify(await pfDisk()) === pf1];
        sc.pickRole('f1');
        await sc.setPf('forge', {look: 'on'});
        sc.pickRole(null);
        await answer('save');
        await until(() => sc.S.pick === null);
        out.leaveSave = [sc.S.pick, (await pfDisk()).forge.look];
        // 別處改了草稿那筆：問 保留草稿／用新的
        sc.pickRole('f1');
        await sc.setPf('forge', {look: 'off'});
        await write(json, 'prefab.json', JSON.stringify({...await pfDisk(), forge: {...(await pfDisk()).forge, defAct: 'turn_off'}}, null, 2) + '\n');
        new BroadcastChannel('tools').postMessage({type: 'saved', file: 'prefab.json'});
        await answer('theirs');
        await until(() => !sc.S.draft);
        out.conflict = [sc.S.draft, sc.S.prefabs.forge.defAct, sc.S.prefabs.forge.look];
        // prefab 庫點一下：選這個場景第一個用它的實例
        sc.pickRole(null);
        doc.querySelector('#lib .item[data-prefab="forge"]').click();
        out.libPick = [sc.S.pick, doc.querySelector('#lib .item[data-prefab="forge"]').classList.contains('sel')];

        // ---------- 組成 prefab ----------
        await sc.addScene('組成');
        const cDisk = async () => (await read(await dir(proj, 'tools'), 'scenes.json'))['組成'];
        await sc.addProp('Barrel', 200, 200);
        await sc.addEmitter('campfire', 0, -30);
        await sc.setEmitter('e1', {follow: 'p1', def: {img: 'p-dot', speedY: -20}});
        await sc.addLight(210, 190);
        await sc.setLight('l1', {follow: 'p1', x: 10, y: -10});
        await sc.composePrefab(null, {keys: ['p1', 'e1'], id: 'brazier'});
        const partDisk = () => read(json, 'particle.json');
        out.compose = [(await pfDisk()).brazier, (await partDisk())?.['brazier-campfire'] ?? null, await cDisk(), sc.S.pick];
        await sc.undo();
        out.composeUndo = [(await pfDisk()).brazier ?? null, (await partDisk())?.['brazier-campfire'] ?? null, (await cDisk()).props?.length, (await cDisk()).prefabs ?? null];
        await sc.redo();
        out.composeRedo = !!(await pfDisk()).brazier?.thumb;

        // ---------- Tiled：縮圖 png、prefabs.tsj、template ----------
        const assets = await dir(proj, 'public', 'assets');
        const has = async (path, name) => !!(await (await dir(assets, ...path.split('/'))).getFileHandle(name).catch(() => null));
        const tsj = await read(await dir(assets, 'tilesets'), 'prefabs.tsj');
        const tplB = await read(await dir(assets, 'templates', 'prefabs'), 'brazier.tj');
        const thB = (await pfDisk()).brazier.thumb;
        out.tiled = [await has('textures/prefabs', 'prefab-forge.png'), await has('textures/prefabs', 'prefab-brazier.png'),
            tsj.name, tsj.tiles.map(t => [t.id, t.image]), tsj.tiles.find(t => t.image.endsWith('prefab-brazier.png')).imagewidth === thB.w,
            tplB.object.gid === tsj.tiles.find(t => t.image.endsWith('prefab-brazier.png')).id + 1, [tplB.object.width, tplB.object.height].join() === [thB.w, thB.h].join(),
            tplB.object.type, tplB.object.properties, tplB.tileset.source];

        // 地圖：一個物件用 template、一個物件自己寫 prefab 屬性
        await write(await dir(assets, 'maps'), 't.json', JSON.stringify({layers: [{type: 'objectgroup', name: 'o', objects: [
            {id: 1, template: '../templates/prefabs/brazier.tj', x: 0, y: 0},
            {id: 2, gid: 1, x: 32, y: 32, width: 32, height: 32, properties: [{name: 'prefab', type: 'string', value: 'brazier'}]}]}]}));
        // 改名：prefab.json key＋所有場景的實例＋地圖／template／縮圖／tsj；複製
        await sc.renamePrefab('brazier', 'fire_pit');
        out.rename = [Object.keys(await pfDisk()), (await cDisk()).prefabs.map(o => o.prefab)];
        const tmap = await read(await dir(assets, 'maps'), 't.json');
        const tsj2 = await read(await dir(assets, 'tilesets'), 'prefabs.tsj');
        out.renameTiled = [tmap.layers[0].objects[0].template, tmap.layers[0].objects[1].properties[0].value,
            await has('templates/prefabs', 'fire_pit.tj'), await has('templates/prefabs', 'brazier.tj'),
            (await read(await dir(assets, 'templates', 'prefabs'), 'fire_pit.tj')).object.properties.find(p => p.name === 'prefab').value,
            await has('textures/prefabs', 'prefab-fire_pit.png'), await has('textures/prefabs', 'prefab-brazier.png'),
            tsj2.tiles.map(t => [t.id, t.image]).filter(([, i]) => i.includes('fire') || i.includes('brazier'))];
        // 刪除：地圖在用就擋
        await sc.deletePrefab('fire_pit', true);
        out.delBlocked = [Object.keys(await pfDisk()).includes('fire_pit'), doc.getElementById('status').textContent];
        await sc.dupPrefab('fire_pit', 'fire_pit-copy');
        out.dup = [Object.keys(await pfDisk()), JSON.stringify((await pfDisk())['fire_pit-copy']) === JSON.stringify((await pfDisk()).fire_pit),
            await has('templates/prefabs', 'fire_pit-copy.tj'), await has('textures/prefabs', 'prefab-fire_pit-copy.png')];
        await sc.deletePrefab('fire_pit-copy', true);
        out.delCopy = [Object.keys(await pfDisk()).includes('fire_pit-copy'), await has('templates/prefabs', 'fire_pit-copy.tj'), await has('textures/prefabs', 'prefab-fire_pit-copy.png'),
            (await read(await dir(assets, 'tilesets'), 'prefabs.tsj')).tiles.some(t => t.image.includes('copy'))];

        // ---------- 草稿中拖實例：直接寫畫面位置、草稿還在；儲存不動實例（錨點編輯已拿掉）----------
        // 組成寫了 particle.json → sandbox 整個重開，等它建好
        await until(() => sc.S.ready && sb()?._insts?.f1?.go);
        sc.pickRole('f1');
        await sc.setPf('fire_pit', {grid: {x: -26, y: -16, w: 32, h: 16}});
        await sc.setPart('fire_pit', 0, {x: -10});
        await sc.setPart('fire_pit', 1, {x: -10});
        out.noAnchorEdit = [doc.querySelector('#right [data-k="anchorDx"]'), doc.querySelector('#right select[data-k="anchor.mode"]'),
            [...doc.querySelectorAll('#right .sec')].some(e => e.textContent.includes('移動錨點')), 'dx' in sc.S.draft, typeof sc.moveAnchor];
        sb()._send({sb: 'moveInst', key: 'f1', x: 230, y: 200});
        out.draftDrag = await until(async () => (await cDisk()).prefabs[0].x === 230) && [!!sc.S.draft, await until(() => sb()._insts.f1?.go?.x === 230),
            doc.querySelector('#right [data-k="x"]')?.value];
        await sc.saveDraft();
        const fp = (await pfDisk()).fire_pit;
        out.draftSave = [fp.parts.map(p => [p.x ?? 0, p.y ?? 0]), fp.grid.x, (await cDisk()).prefabs[0].x, sc.S.draft,
            await until(() => sb()._insts.f1?.go?.x === 230)];

        // ---------- 畫面互動：選中實例畫記號、點零件展開、拖零件、鍵盤 ----------
        sc.pickRole('f1');
        const ins = () => sb()._inspected?.();
        await until(() => ins());
        let go = ins().go;
        const holder0 = () => ins().go.view._parts.find(e => e.i === 0)?.holder;
        // 展開＝自動 edit（hide 的也是）、收起／換展開／取消選取＝回 show
        const pmNow = () => JSON.stringify(sb()._inspect?.partMode);
        const selIcon = (i) => {const s = doc.querySelector(`#right select[data-k="part${i}.mode"]`); return s?.options[s.selectedIndex].textContent;};
        sc.openPart(null);
        await until(() => pmNow() === '["show","show"]');
        sc.setPartMode('fire_pit', 1, 'hide');
        sc.openPart(1);
        out.autoOpen = [await until(() => pmNow() === '["show","edit"]') && pmNow(), selIcon(1)];
        sc.openPart(0);
        out.autoSwap = await until(() => pmNow() === '["edit","show"]') && pmNow();
        sc.openPart(null);
        out.autoClose = await until(() => pmNow() === '["show","show"]') && pmNow();
        sc.openPart(1);
        await until(() => pmNow() === '["show","edit"]');
        sc.pickRole(null);
        await until(() => !sb()._inspected());
        sc.pickRole('f1');
        out.autoDeselect = await until(() => ins() && pmNow() === '["show","show"]') && [pmNow(), sc.S.part];

        // 選中實例的黃點：拖＝拖實例（立刻寫 scenes.json、不開草稿）；方向鍵＝移實例；再搬回原位
        const amFk = (x, y, shift = false) => ({leftButtonDown: () => true, rightButtonDown: () => false, middleButtonDown: () => false, worldX: x, worldY: y, x, y, event: {shiftKey: shift, clientX: 0, clientY: 0}});
        const gx = ins().go.x, gy = ins().go.y;
        sb().input.emit('pointerdown', amFk(gx, gy));
        sb().input.emit('pointermove', amFk(gx + 5.3, gy - 3));
        sb().input.emit('pointerup', amFk(gx + 5.3, gy - 3));
        out.selAnchorDrag = await until(async () => (await cDisk()).prefabs[0].x === gx + 5) && [(await cDisk()).prefabs[0].x - gx, (await cDisk()).prefabs[0].y - gy, sc.S.draft, sc.S.pick];
        const kd = (k, shift = false) => {doc.body.dispatchEvent(new win.KeyboardEvent('keydown', {key: k, shiftKey: shift, bubbles: true})); return sc.flush();};
        await kd('ArrowRight');
        out.selAnchorKey = await until(async () => (await cDisk()).prefabs[0].x === gx + 6) && [(await cDisk()).prefabs[0].x - gx, sc.S.draft];
        sb()._send({sb: 'moveInst', key: 'f1', x: gx, y: gy});
        await until(async () => (await cDisk()).prefabs[0].x === gx && sb()._insts.f1?.go?.x === gx);
        await until(() => ins());
        go = ins().go;
        out.partShow = [sb()._inspect.partMode, sb()._partAt(ins(), go.x - 10, go.y - 5), holder0().visible];
        sc.setPartMode('fire_pit', 0, 'hide');
        out.partHide = await until(() => !holder0().visible) && [holder0().visible, sb()._insts.f1 === ins()];
        // png 藏掉＝點選框退回粒子點（外擴 16、最少 32×32）
        const pg = sb()._partGeom(ins(), 1), nb = sb()._instBox(ins());
        out.boxNoPng = [nb.width, nb.height, nb.centerX - pg.x, nb.centerY - pg.y];
        sc.setPartMode('fire_pit', 0, 'edit');
        sc.setPartMode('fire_pit', 1, 'edit');
        await until(() => sb()._inspect?.partMode?.[1] === 'edit');
        out.partAt = [holder0().visible, sb()._partAt(ins(), go.x - 10, go.y - 5), sb()._partAt(ins(), go.x - 10, go.y - 30), sb()._partAt(ins(), go.x + 500, go.y)];
        sc.setPartMode('fire_pit', 0, 'show');
        sc.setPartMode('fire_pit', 1, 'show');
        await until(() => sb()._inspect?.partMode?.[1] === 'show');
        sb()._send({sb: 'part', key: 'f1', i: 0});
        out.inspect = await until(() => sb()._inspect?.part === 0) && [sc.S.part, sb()._inspect.boxes.grid, !!sb()._partGeom(ins(), 0).rect];
        sb()._send({sb: 'movePart', key: 'f1', i: 0, x: -6, y: 2});
        await until(() => sc.S.draft?.pf.parts[0].x === -6);
        const key = (k) => {doc.body.dispatchEvent(new win.KeyboardEvent('keydown', {key: k, bubbles: true})); return sc.flush();};
        await key('ArrowRight');
        out.dragPart = [sc.S.draft.pf.parts[0], (await pfDisk()).fire_pit.parts[0]];

        // 模式：方塊 edit 出 4 邊把手、拖右邊寫草稿、左邊拉不過對邊；零件 edit 才拖得動
        out.modeBtn = [...doc.querySelectorAll('#right select.mode')].map(b => [b.dataset.k, b.options[b.selectedIndex].textContent, b.disabled]);
        const gsel = doc.querySelector('#right select[data-k="grid.mode"]');
        gsel.value = 'edit';
        gsel.dispatchEvent(new win.Event('change'));
        await until(() => sb()._inspect?.boxMode?.grid === 'edit');
        const hds = sb()._boxHandles();
        out.boxHandles = [hds.map(hd => hd.k + hd.side), win.localStorage.getItem('tools.scene.boxMode')];
        const hr = hds.find(hd => hd.side === 'r');
        out.boxHit = sb()._boxHandleAt(hr.x + 1, hr.y - 1)?.side;
        const b0 = sb()._inspect.boxes.grid;
        sb()._drag = {box: 'grid', side: 'r', inst: ins(), key: 'f1', b0, cur: {...b0}};
        sb()._boxTo(sb()._drag, hr.x + 10.4, hr.y, false);
        sb()._endDrag();
        await until(() => sc.S.draft?.pf.grid.w === b0.w + 10);
        const bl = {box: 'grid', side: 'l', inst: ins(), key: 'f1', b0: sc.S.draft.pf.grid, cur: null};
        sb()._boxTo(bl, ins().go.x + 999, 0, false);
        out.boxDrag = [sc.S.draft.pf.grid, bl.cur, (await pfDisk()).fire_pit.grid];
        await sc.undo();
        out.boxUndo = sc.S.draft.pf.grid.w;
        sc.openPart(null);
        await until(() => sb()._inspect?.partMode?.[0] === 'show');
        out.editPart = [sb()._partAt(ins(), go.x - 10, go.y - 5, ['edit']), (sc.setPartMode('fire_pit', 0, 'edit'), await until(() => sb()._inspect?.partMode?.[0] === 'edit')) && sb()._partAt(ins(), go.x - 10, go.y - 5, ['edit'])];

        const fake = (x, y) => ({leftButtonDown: () => true, rightButtonDown: () => false, middleButtonDown: () => false, worldX: x, worldY: y, x, y, event: {shiftKey: false, clientX: 0, clientY: 0}});
        // 點選順序：edit 粒子／光源點＞錨點＞edit png 圖框
        const downAt = (x, y) => {sb().input.emit('pointerdown', fake(x, y)); const d = sb()._drag; sb()._drag = null; return d?.box ? 'box' : d?.p ? `part${d.part}` : d?.inst ? 'inst' : null;};
        sc.setBoxMode('grid', 'hide');
        await until(() => sb()._inspect?.boxMode?.grid === 'hide');
        const ag = ins().go;
        out.prio = [sb()._partGeom(ins(), 0).rect.contains(ag.x, ag.y), downAt(ag.x, ag.y)];
        sc.setPartMode('fire_pit', 1, 'edit');
        sb()._send({sb: 'movePart', key: 'f1', i: 1, x: 0, y: 0});
        await until(() => sc.S.draft?.pf.parts[1].x === undefined && sb()._inspect?.partMode?.[1] === 'edit' && sb()._partGeom(ins(), 1)?.y === ins().go.y);
        out.prio.push(downAt(ins().go.x, ins().go.y));
        sc.setPartMode('fire_pit', 1, 'show');
        await until(() => sb()._inspect?.partMode?.[1] === 'show');
        out.prio.push(downAt(ins().go.x, ins().go.y));
        await sc.undo();
        await until(() => sc.S.draft?.pf.parts[1].x === -10);
        // ---------- 粒子零件：[新增]＝範本（自己的 def）、換成庫 id 先問、edit 時拖 zone＝共用的自動複製成 def（草稿） ----------
        const nP = sc.S.draft.pf.parts.length, np = () => sc.S.draft.pf.parts[nP];
        const psel = () => doc.querySelector('#right .partform select[data-k="particle"]');
        await sc.addPart('fire_pit', 'particle', '[新增]');
        out.newDef = [!!np()?.def, 'particle' in np(), sc.S.part === nP, psel()?.value, doc.querySelector('#right .partform [data-k="defState"]')?.textContent.includes('自訂'),
            !!doc.querySelector('#right .partform .pform')];
        // 粒子內容可摺：標題（defState）跟 JSON 鈕留著、表單藏起來、記 tools.scene.fold
        const pHead = () => doc.querySelector('#right .partform .head[data-fold="right.partParticle"]');
        sc.toggleFold('right.partParticle');
        out.pFold = [pHead()?.querySelector('.tw')?.textContent, !!pHead()?.querySelector('[data-k="defState"]'), pHead()?.querySelector('button')?.textContent,
            !!doc.querySelector('#right .partform .pform'), JSON.parse(win.localStorage.getItem('tools.scene.fold')).includes('right.partParticle')];
        sc.toggleFold('right.partParticle');
        out.pFold.push(pHead()?.querySelector('.tw')?.textContent, !!doc.querySelector('#right .partform .pform'));
        psel().value = 'fire-charge';
        psel().dispatchEvent(new win.Event('change'));
        await answer('ok');
        out.toLib = await until(() => np()?.particle === 'fire-charge') && [np(), psel().value];
        sc.setPartMode('fire_pit', nP, 'edit');
        const pzw = () => sb()._partZoneOwners().find(w => w.i === nP);
        await until(() => pzw()?.zones.length === 1);
        const zc = pzw().c;
        sb().input.emit('pointerdown', fake(zc.x + 18, zc.y - 16));
        sb().input.emit('pointermove', fake(zc.x + 28, zc.y - 16));
        sb().input.emit('pointerup', fake(zc.x + 28, zc.y - 16));
        out.zoneDrag = await until(() => np()?.def?.emitZone?.source.x === 10) && [np().particle ?? null, np().def.mode, sb()._pzsel?.i === nP, (await pfDisk()).fire_pit.parts.length];
        await sc.delPart('fire_pit', nP);

        sc.setBoxMode('grid', 'edit');
        await until(() => sb()._inspect?.boxMode?.grid === 'edit');

        // 拖曳中右欄數字跟著變＋黃框（屬性摺著自動打開）、草稿放開才寫
        const inp = (s) => doc.querySelector(`#right ${s}`);
        sc.toggleFold('right.props');
        out.propsFolded = !inp('[data-k="grid.h"]');
        const g0 = {...sb()._inspect.boxes.grid}, hb = sb()._boxHandles().find(hd => hd.side === 'b');
        sb()._drag = {box: 'grid', side: 'b', inst: ins(), key: 'f1', b0: g0, cur: {...g0}};
        sb().input.emit('pointermove', fake(hb.x, hb.y + 8));
        await until(() => inp('[data-k="grid.h"]')?.value === String(g0.h + 8));
        out.boxLive = [inp('[data-k="grid.h"]').value, inp('[data-k="grid.h"]').classList.contains('live'), inp('[data-k="grid.w"]').classList.contains('live'), sc.S.draft.pf.grid.h];
        sb().input.emit('pointerup', fake(hb.x, hb.y + 8));
        await until(() => sc.S.draft.pf.grid.h === g0.h + 8);
        out.boxLiveEnd = [doc.querySelectorAll('#right input.live').length, sc.S.draft.pf.grid.h];
        sc.setBoxMode('grid', 'hide');
        await until(() => sb()._inspect?.boxMode?.grid === 'hide');
        sc.openPart(null);
        const p0 = {...sc.S.draft.pf.parts[0]};
        sb().input.emit('pointerdown', fake(go.x - 10, go.y - 20));
        sb().input.emit('pointermove', fake(go.x - 3, go.y - 17));
        await until(() => inp('.partform [data-k="x"]')?.value === String(p0.x + 7));
        out.partLive = [sc.S.part, inp('.partform [data-k="x"]').value, inp('.partform [data-k="y"]').value, inp('.partform [data-k="y"]').classList.contains('live'), sc.S.draft.pf.parts[0].x];
        sb().input.emit('pointerup', fake(go.x - 3, go.y - 17));
        await until(() => sc.S.draft.pf.parts[0].x === p0.x + 7);
        out.partLiveEnd = [doc.querySelectorAll('#right input.live').length, sc.S.draft.pf.parts[0].x, sc.S.draft.pf.parts[0].y];
        await key('Escape');
        out.esc1 = [sc.S.part, sc.S.pick];
        sc.openPart(0);
        await key('Delete');
        out.delKey = [sc.S.draft.pf.parts.length, sc.S.part, sc.S.pick];
        sc.setPartMode('fire_pit', 0, 'hide');
        out.hideBefore = await until(() => ins()?.go.view._parts.find(e => e.i === 0)?.on === false);
        key('Escape');
        await answer('drop');
        out.esc2 = [sc.S.pick, sc.S.draft, (await pfDisk()).fire_pit.parts.length, await until(() => !sb()._inspected())];
        out.unhide = await until(() => sb()._insts.f1?.go.view._parts?.length === 2 && sb()._insts.f1.go.view._parts.every(e => e.on));
        return out;
    });

    t.check('prefab 庫：沒有 prefab 時提示', r.emptyLib.includes('還沒有 prefab'), r.emptyLib);
    t.eq('新增空白 prefab：prefab.json 一筆、場景中間放 f1、選起來（右欄實例面板）', JSON.stringify(r.newPf), JSON.stringify([{forge: {}}, [{key: 'f1', prefab: 'forge', x: 400, y: 288}], 'f1', '實例 f1']));
    t.check('id 不合法擋下', r.badId.includes('英數字'), r.badId);
    t.eq('undo：prefab.json 跟 scenes.json 一起回去', JSON.stringify(r.undoNew), JSON.stringify([{}, null]));
    t.eq('redo：兩個檔一起回來', JSON.stringify(r.redoNew), JSON.stringify([['forge'], 1]));
    t.eq('別處改 prefab.json：sandbox 照新內容建成 Item、預設 off', JSON.stringify(r.built), JSON.stringify(['Item', 'forge', 'off', [true, false]]));
    t.eq('prefab 庫列出、可拖', JSON.stringify(r.libRow), JSON.stringify([['forge', true]]));
    t.eq('sandbox 點錨點選得到實例', r.pick, 'f1');
    t.eq('點選框＝目前看得見的 png 外框（Barrel 17×22）', JSON.stringify(r.box), JSON.stringify([-8.5, -22, 17, 22]));
    t.eq('點選框裡錨點以外選得到、框外選不到', JSON.stringify(r.pickThumb), JSON.stringify(['f1', null]));
    t.eq('工具列錨點沒勾：錨點不畫、點不到，點選框照樣選得到', JSON.stringify(r.pickOff), JSON.stringify([null, 'f1', null]));
    t.eq('從錨點拖：移動實例、寫檔', JSON.stringify(r.anchorDragInst), JSON.stringify([5, 0]));
    t.eq('沒選中時從點選框按下：選起來＋拖、寫檔', JSON.stringify(r.boxDragInst), JSON.stringify(['f1', 3, 'f1']));
    t.eq('角色疊在點選框上：角色優先', JSON.stringify(r.rolePrio), JSON.stringify([true]));
    t.eq('右欄：實例面板', r.right, '實例 f1');
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

    // 右欄改 prefab 內容
    t.eq('右欄：實例＋屬性＋零件清單（沒有 prefab 標題列；不屬實例目前狀態 off 的標灰）', JSON.stringify(r.panel0),
         JSON.stringify([[[0, false], [1, true], [2, true]], ['實例 f1', '屬性', '右鍵動作', '占地方塊', '零件（3）']]));
    t.eq('摺屬性＋零件：只剩標題、▸、記 localStorage', JSON.stringify(r.rFold),
         JSON.stringify([['實例 f1', '屬性', '零件（3）'], '▸', '▸', 0, false, ['right.props', 'right.parts']]));
    t.eq('摺實例', JSON.stringify(r.rFoldInst), JSON.stringify(['實例 f1', false]));
    t.eq('零件摺著時開零件：自動打開、記住', JSON.stringify(r.rAutoOpen), JSON.stringify(['▾', 1, []]));
    t.eq('收起零件不自動摺回', r.rStayOpen, '▾');
    t.eq('點零件：展開它的表單（一次一個）；右欄沒有漏出 false、沒有橘色說明', JSON.stringify(r.open), JSON.stringify([1, true, '0', false, 0]));
    t.eq('改零件＝草稿：相對錨點、兩個檔都不動、右欄出現儲存、庫標 ●', JSON.stringify(r.moveImg), JSON.stringify([{img: 'Barrel', x: 10}, true, true, true, '●']));
    t.check('sandbox 照草稿重建', r.sbDraft);
    t.eq('零件標題列右邊：＋png／＋粒子／＋光源（摺著也在）', JSON.stringify(r.addBtns), JSON.stringify(['＋png', '＋粒子', '＋光源']));
    t.eq('摺著按＋光源：在錨點、沒有 look、自動打開並展開它', JSON.stringify(r.addLight), JSON.stringify([{light: {r: 120, color: '#ffcc88'}}, 3, '▾', 1]));
    t.eq('光源欄位寫進 light、狀態寫在零件上', JSON.stringify(r.setLight), JSON.stringify({light: {r: 90, color: '#ffcc88'}, look: 'on'}));
    t.eq('零件往前：順序換、展開的跟著', JSON.stringify(r.movePart), JSON.stringify([['Barrel', 'Crate', 90, 80], 2]));
    t.eq('刪零件：展開的收起', JSON.stringify(r.delPart), JSON.stringify([3, null]));
    t.eq('prefab 欄位：acts／左鍵動作／占地方塊', JSON.stringify(r.panel), JSON.stringify([['turn_on', 'turn_off'], 'turn_on', '32']));
    t.eq('草稿中 undo：退草稿一步、prefab.json 不動', JSON.stringify(r.undoPf), JSON.stringify([{turn_on: 'on'}, true]));
    t.eq('儲存：寫 prefab.json、草稿結束、實例還選著', JSON.stringify(r.save), JSON.stringify([['Barrel', 'Crate', 80], 10, 'turn_on', null, 'f1']));
    t.check('儲存後全域 undo 一筆退回整份草稿', r.saveUndo);
    t.eq('草稿裡的外部 png：sandbox 載原圖、pct 乘進 scale', r.sbFile, 'file|public/assets/textures/props/Crate.png');
    const [xpick, xpart, xbaked, xthumb, crate] = r.exit;
    t.check('儲存外部 png 零件：照 pct 烤進 textures/prefabs/forge/forge-Crate.png、改成 key', xpick === 'f1' && xbaked && xpart && !('pct' in xpart), JSON.stringify([xpick, xpart]));
    t.check('縮圖外框＝預設狀態看得到的 png 聯集', xthumb && xthumb.w >= Math.round(crate[0] / 2) && xthumb.h >= Math.round(crate[1] / 2), JSON.stringify([xthumb, crate]));
    t.eq('有草稿取消選取 → 取消：還選著、草稿還在', JSON.stringify(r.leaveCancel), JSON.stringify(['f1', true]));
    t.eq('有草稿取消選取 → 放棄：取消選取、prefab.json 不動', JSON.stringify(r.leaveDrop), JSON.stringify([null, null, true]));
    t.eq('有草稿取消選取 → 儲存：寫檔再取消選取', JSON.stringify(r.leaveSave), JSON.stringify([null, 'on']));
    t.eq('別處改了草稿那筆 → 用新的：草稿丟掉、讀到新內容', JSON.stringify(r.conflict), JSON.stringify([null, 'turn_off', 'on']));
    t.eq('prefab 庫點一下：選場景裡用它的實例、庫那列反白', JSON.stringify(r.libPick), JSON.stringify(['f1', true]));

    // 組成
    const [cpf, cpart, cscene, cpick] = r.compose;
    t.eq('組成：零件相對錨點（第一個擺設）、跟著的粒子換成絕對再換相對、自己那份帶進零件（{def}、不留來源 id）', JSON.stringify(cpf?.parts), JSON.stringify([{img: 'Barrel'}, {def: {img: 'p-dot', speedY: -20}, y: -30}]));
    t.check('組成：算縮圖外框', !!cpf?.thumb, JSON.stringify(cpf));
    t.eq('組成：不寫 particle.json', JSON.stringify(cpart), 'null');
    t.eq('組成：原地換成實例、沒勾但跟著的光源改成絕對位置', JSON.stringify(cscene), JSON.stringify({map: 'sandbox', lights: [{key: 'l1', x: 210, y: 190, r: 120, color: '#ffcc88'}], prefabs: [{key: 'f1', prefab: 'brazier', x: 200, y: 200}]}));
    t.eq('組成：選起實例', cpick, 'f1');
    t.eq('undo 組成（含收尾）：一筆退回', JSON.stringify(r.composeUndo), JSON.stringify([null, null, 1, null]));
    t.check('redo 組成：連縮圖外框一起回來', r.composeRedo);
    const [tf, tb, tname, ttiles, tw, tgid, tsize, ttype, tprops, tsrc] = r.tiled;
    t.check('Tiled：每筆 prefab 有縮圖 png（textures/prefabs/prefab-<id>.png）', tf && tb, JSON.stringify(r.tiled));
    t.eq('Tiled：prefabs.tsj（name＝檔名、tile id 照產生順序）', JSON.stringify([tname, ttiles]), JSON.stringify(['prefabs', [[0, '../textures/prefabs/prefab-forge.png'], [1, '../textures/prefabs/prefab-brazier.png']]]));
    t.check('Tiled：tsj 圖大小＝縮圖外框', tw);
    t.check('Tiled：template gid＝那格、寬高＝縮圖外框', tgid && tsize, JSON.stringify(r.tiled));
    t.eq('Tiled：template 預設 type item、屬性 prefab、指 prefabs.tsj', JSON.stringify([ttype, tprops, tsrc]), JSON.stringify(['item', [{name: 'prefab', type: 'string', value: 'brazier'}], '../../tilesets/prefabs.tsj']));
    t.eq('改名：prefab.json＋場景實例', JSON.stringify(r.rename), JSON.stringify([['forge', 'fire_pit'], ['fire_pit']]));
    t.eq('改名：地圖的 template 路徑、物件的 prefab 屬性、template 檔名＋屬性、縮圖、tsj 圖（id 不變）', JSON.stringify(r.renameTiled),
         JSON.stringify(['../templates/prefabs/fire_pit.tj', 'fire_pit', true, false, 'fire_pit', true, false, [[1, '../textures/prefabs/prefab-fire_pit.png']]]));
    t.check('刪除：地圖在用就擋、列出來', r.delBlocked[0] && r.delBlocked[1].includes('maps/t.json'), JSON.stringify(r.delBlocked));
    t.eq('複製：一模一樣的新一筆＋template＋縮圖', JSON.stringify(r.dup), JSON.stringify([['forge', 'fire_pit', 'fire_pit-copy'], true, true, true]));
    t.eq('刪除沒人用的：prefab.json、template、縮圖、tsj 那格都拿掉', JSON.stringify(r.delCopy), JSON.stringify([false, false, false, false]));

    // 錨點編輯已拿掉
    t.eq('沒有移動錨點：右欄沒欄位／模式下拉／標題、草稿沒有 dx、沒有 moveAnchor', JSON.stringify(r.noAnchorEdit), JSON.stringify([null, null, false, false, 'undefined']));
    t.eq('草稿中拖實例：直接寫畫面位置、還在草稿、右欄 x 跟著', JSON.stringify(r.draftDrag), JSON.stringify([true, true, '230']));
    t.eq('儲存：prefab.json 寫草稿、實例位置不動', JSON.stringify(r.draftSave), JSON.stringify([[[-10, 0], [-10, -30]], -26, 230, null, true]));

    // 畫面互動
    t.eq('展開零件：自動 edit（hide 的也是）、下拉跟著變 ✎', JSON.stringify(r.autoOpen), JSON.stringify(['["show","edit"]', '✎']));
    t.eq('換展開別的零件：舊的回 show、新的 edit', r.autoSwap, '["edit","show"]');
    t.eq('收起零件：回 show', r.autoClose, '["show","show"]');
    t.eq('取消選取再選回來：展開的回 show、沒有展開', JSON.stringify(r.autoDeselect), JSON.stringify(['["show","show"]', null]));
    t.eq('選中實例拖黃點＝拖實例：寫 scenes.json、不開草稿、還選著', JSON.stringify(r.selAnchorDrag), JSON.stringify([5, -3, null, 'f1']));
    t.eq('選中實例方向鍵＝移實例、不開草稿', JSON.stringify(r.selAnchorKey), JSON.stringify([6, null]));
    t.eq('零件預設 show：照常顯示、點不到', JSON.stringify(r.partShow), JSON.stringify([['show', 'show'], null, true]));
    t.eq('零件 hide：選中的實例藏零件本身', JSON.stringify(r.partHide), JSON.stringify([false, true]));
    t.eq('png 藏掉：點選框退回粒子點、最少 32×32', JSON.stringify(r.boxNoPng), JSON.stringify([32, 32, 0, 0]));
    t.eq('edit 零件點得到：png 照外框、粒子照點、外面＝沒有', JSON.stringify(r.partAt), JSON.stringify([true, 0, 1, null]));
    t.eq('sandbox 回報點到零件：右欄展開、sandbox 畫外框＋占地方塊', JSON.stringify(r.inspect), JSON.stringify([0, {x: -26, y: -16, w: 32, h: 16}, true]));
    t.eq('拖展開的零件＋方向鍵：寫草稿（相對錨點）、prefab.json 不動', JSON.stringify(r.dragPart), JSON.stringify([{img: 'Barrel', x: -5, y: 2}, {img: 'Barrel', x: -10}]));
    t.check('模式按鈕：方塊兩個（沒勾的反灰）＋每個零件一個', r.modeBtn.length >= 4 && r.modeBtn.some(([k, , dis]) => k === 'grid.mode' && !dis) && r.modeBtn.some(([k, , dis]) => k === 'zone.mode' && dis), JSON.stringify(r.modeBtn));
    t.eq('方塊 edit：4 邊中點把手、模式記 localStorage', JSON.stringify(r.boxHandles), JSON.stringify([['gridl', 'gridr', 'gridt', 'gridb'], '{"grid":"edit"}']));
    t.eq('把手點得到（容許幾 px）', r.boxHit, 'r');
    t.eq('拖右邊：草稿 w+10、prefab.json 不動；左邊拉不過右邊（最少 1px）', JSON.stringify(r.boxDrag),
         JSON.stringify([{x: -26, y: -16, w: 42, h: 16}, {x: 15, y: -16, w: 1, h: 16}, {x: -26, y: -16, w: 32, h: 16}]));
    t.eq('拖方塊一筆 undo', r.boxUndo, 32);
    t.eq('零件 edit 才拖得動', JSON.stringify(r.editPart), JSON.stringify([null, 0]));
    t.eq('點選順序：錨點＞edit png（png 蓋住錨點）、edit 粒子點＞錨點、show 的點不搶', JSON.stringify(r.prio), JSON.stringify([true, 'inst', 'part1', 'inst']));    t.eq('（前置）屬性區摺起來', r.propsFolded, true);
    t.eq('拖方塊下邊中：屬性自動打開、h 跟著變＋黃框（w 不亮）、草稿還沒寫', JSON.stringify(r.boxLive), JSON.stringify(['24', true, false, 16]));
    t.eq('放開：黃框拿掉、草稿寫進去', JSON.stringify(r.boxLiveEnd), JSON.stringify([0, 24]));
    t.eq('拖 edit 零件中：自動展開、x/y 跟著變＋黃框、草稿還沒寫', JSON.stringify(r.partLive), JSON.stringify([0, '2', '5', true, -5]));
    t.eq('放開：黃框拿掉、零件位置寫進草稿', JSON.stringify(r.partLiveEnd), JSON.stringify([0, 2, 5]));
    t.eq('Esc 第一次：收起零件、實例還選著', JSON.stringify(r.esc1), JSON.stringify([null, 'f1']));
    t.eq('展開零件時 Del：刪零件（草稿）、實例還在', JSON.stringify(r.delKey), JSON.stringify([1, null, 'f1']));
    t.eq('＋粒子選 [新增]：範本 def、沒有 particle、展開、下拉停在 [新增]、自訂、嵌粒子表單', JSON.stringify(r.newDef), JSON.stringify([true, false, true, '[新增]', true, true]));
    t.eq('粒子內容摺起來：標題＋JSON 鈕留著、表單藏、記住；再點展開', JSON.stringify(r.pFold), JSON.stringify(['▸', true, 'JSON', false, true, '▾', true]));
    t.eq('自己的換成庫 id：問過、變 {particle}', JSON.stringify(r.toLib), JSON.stringify([{particle: 'fire-charge'}, 'fire-charge']));
    t.eq('edit 粒子零件拖 zone 框線：共用的自動複製成 def（不留 id）、寫草稿、prefab.json 不動', JSON.stringify(r.zoneDrag), JSON.stringify([null, 'stream', true, 2]));
    t.check('（前置）零件 hide 藏起來', r.hideBefore);
    t.eq('Esc 第二次：取消選取（有草稿先問，放棄）、sandbox 不畫記號', JSON.stringify(r.esc2), JSON.stringify([null, null, 2, true]));
    t.check('取消選取：藏的零件全部恢復', r.unhide);
});
