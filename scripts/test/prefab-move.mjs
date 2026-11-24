// 場景分頁：加到 prefab（擺設＋跟著它的 → 實例的 prefab）、零件移到場景、左欄 prefab 庫展開零件（docs/prefab.md）
import {run} from './harness.mjs'

run('prefab-move', async t => {
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
        await write(json, 'item.json', '{}');
        await write(json, 'role.json', await (await fetch('/assets/json/role.json')).text());
        await write(json, 'particle.json', JSON.stringify({'fire-charge': {img: 'p-dot', mode: 'stream'}}));
        await write(json, 'prefab.json', JSON.stringify({forge: {look: 'off', parts: [{img: 'Barrel'}, {img: 'Crate', y: -24, look: 'on', fx: 'burn'}, {light: {r: 80}, x: 5}]}}));
        const read = async (d, name) => {await sc.flush(); const fh = await d.getFileHandle(name).catch(() => null); return fh ? JSON.parse(await (await fh.getFile()).text()) : null;};
        const pfDisk = async () => (await read(json, 'prefab.json')).forge;
        const scDisk = async () => (await read(await dir(proj, 'tools'), 'scenes.json'))?.['測試'];
        const dlg = doc.getElementById('dlgAsk');
        const answer = async (v) => {await until(() => dlg.open); dlg.close(v); await sleep(50); await sc.flush();};
        const strip = (o) => o && Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'thumb'));

        await until(() => sc.S.ready && sb()?.map);
        await T.setProject(proj);
        await until(() => sc.S.root);
        await sc.flush();
        await sc.addScene('測試');
        await sc.addInst('forge', 200, 200);
        await sc.addProp('Crate', 230, 210);
        await sc.addEmitter('fire-charge', 0, -10);
        await sc.setEmitter('e1', {follow: 'p1', def: {img: 'p-dot', mode: 'stream', speedY: -20}});
        await sc.addLight(100, 100);

        // 左欄展開：▸ 點了列出零件、記在 tools.scene.fold
        const libRows = () => [...doc.querySelectorAll('#lib .libpart')].map(e => e.textContent);
        out.libClosed = libRows().length;
        doc.querySelector('#lib .item[data-prefab="forge"] [data-k="libOpen"]').click();
        out.libOpen = [libRows(), JSON.parse(localStorage.getItem('tools.scene.fold')).includes('libOpen:forge'),
            doc.querySelector('#lib .libpart[data-part="1"]').classList.contains('off')];

        // 選單：沒有實例時反灰（這裡有 f1 → 子選單）
        doc.querySelector('#tree .item[data-key="p1"]').dispatchEvent(new win.MouseEvent('contextmenu', {bubbles: true, clientX: 50, clientY: 50}));
        const mbtn = [...doc.querySelectorAll('.ctxmenu button')].find(b => b.textContent.startsWith('加到 prefab'));
        out.menu = [mbtn?.textContent, mbtn?.disabled];
        mbtn.click();
        out.sub = [...doc.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        doc.querySelector('.ctxmenu').remove();

        // 加到 prefab：擺設＋跟著它的 ✎ 發射點；相對錨點、沒有 look；✎ 另存 <prefab>-<原 id>；一筆 undo；選起實例、新零件選取
        await sc.addToPrefab('p1', 'f1');
        await sc.flush();
        const pfA = await pfDisk(), scA = await scDisk();
        out.add = [pfA.parts.slice(3), (await read(json, 'particle.json'))['forge-fire-charge'], scA.props ?? null, scA.particles ?? null, scA.lights.length,
            sc.S.pick, sc.S.psel?.parts, libRows().length];
        await sc.undo();
        out.addUndo = [(await pfDisk()).parts.length, (await scDisk()).props?.length, (await scDisk()).particles?.[0]?.follow];
        await sc.redo();
        out.addRedo = (await pfDisk()).parts.length;

        // 左欄零件列點一下：選實例、選取＋展開那個零件、列反白
        sc.pickRole(null);
        await sc.pickLibPart('forge', 3);
        out.libPick = [sc.S.pick, sc.S.part, sc.S.psel?.parts, doc.querySelector('#lib .libpart[data-part="3"]').classList.contains('sel'),
            !!doc.querySelector('#right .partform [data-k="toScene"]')];

        // 畫面上對選取的零件右鍵：出「移到場景」
        const g = sb()._insts.f1.go;
        await until(() => JSON.stringify(sb()._inspect?.partSel) === '[3]');
        const rk = {leftButtonDown: () => false, rightButtonDown: () => true, middleButtonDown: () => false, worldX: g.x + 30, worldY: g.y + 10 - 12, x: 0, y: 0, event: {shiftKey: false, clientX: 60, clientY: 60}};
        sb().input.emit('pointerdown', rk);
        await until(() => doc.querySelector('.ctxmenu'));
        out.ctx = doc.querySelector('.ctxmenu button')?.textContent;
        doc.querySelector('.ctxmenu')?.remove();

        // 移到場景（兩個：Crate 有 look／fx → 丟掉提示、光源）：絕對位置、prefab 拿掉、一筆 undo、選新的第一個
        await sc.partsToScene('f1', [1, 2]);
        await sc.flush();
        const scM = await scDisk();
        out.move = [(await pfDisk()).parts.map(p => p.img ?? p.particle), scM.props, scM.lights, sc.S.pick, doc.getElementById('status').textContent.includes('狀態 on')];
        await sc.undo();
        out.moveUndo = [(await pfDisk()).parts.length, (await scDisk()).props ?? null, (await scDisk()).lights.length];

        // 有草稿：先問，儲存＝草稿的位置一起帶過去
        sc.pickRole('f1');
        await sc.setPart('forge', 0, {x: 3});
        const p0 = sc.partsToScene('f1', [0]);
        await answer('save');
        await p0;
        await sc.flush();
        out.draftMove = [sc.S.draft, (await scDisk()).props?.find(p => p.img === 'Barrel'), (await pfDisk()).parts.some(p => p.img === 'Barrel')];

        // 最後一個零件也能移：prefab 變空
        const left = (await pfDisk()).parts.length;
        await sc.partsToScene('f1', [...Array(left).keys()]);
        await sc.flush();
        out.empty = [strip(await pfDisk()), libRows()];

        // 沒有實例：選單反灰
        await sc.deleteObj('f1');
        doc.querySelector('#tree .item[data-key="p1"]').dispatchEvent(new win.MouseEvent('contextmenu', {bubbles: true, clientX: 50, clientY: 50}));
        const nb = [...doc.querySelectorAll('.ctxmenu button')].find(b => b.textContent.startsWith('加到 prefab'));
        out.noInst = [nb?.textContent, nb?.disabled];
        doc.querySelector('.ctxmenu')?.remove();
        return out;
    });

    t.eq('左欄 prefab 預設收著', r.libClosed, 0);
    t.eq('▸ 展開：列出零件（off 狀態的標灰）、記 localStorage', JSON.stringify(r.libOpen), JSON.stringify([['Barrel', 'Crateon', '💡光源 r80'], true, false]));
    t.eq('右鍵「加到 prefab ▸」', JSON.stringify(r.menu), JSON.stringify(['加到 prefab ▸', false]));
    t.eq('子選單列場景裡的實例', JSON.stringify(r.sub), JSON.stringify(['f1　forge']));
    t.eq('加到 prefab：擺設＋跟著的 ✎ 粒子（另存 forge-fire-charge）相對錨點、場景拿掉、光源不動、選實例、新零件選取、左欄跟著',
         JSON.stringify(r.add), JSON.stringify([[{img: 'Crate', x: 30, y: 10}, {particle: 'forge-fire-charge', x: 30}], {img: 'p-dot', mode: 'stream', speedY: -20}, null, null, 1, 'f1', [3, 4], 5]));
    t.eq('undo 加到 prefab：一筆退回（跟隨還在）', JSON.stringify(r.addUndo), JSON.stringify([3, 1, 'p1']));
    t.eq('redo', r.addRedo, 5);
    t.eq('左欄點零件：選實例、選取＋展開、列反白、表單有「移到場景」', JSON.stringify(r.libPick), JSON.stringify(['f1', 3, [3], true, true]));
    t.eq('畫面上選取的零件右鍵：移到場景', r.ctx, '移到場景（零件 4）');
    t.eq('移到場景：絕對位置、look/fx 丟掉並提示、prefab 拿掉、選新的', JSON.stringify(r.move),
         JSON.stringify([['Barrel', 'Crate', 'forge-fire-charge'], [{key: 'p1', img: 'Crate', x: 200, y: 176}],
             [{key: 'l1', x: 100, y: 100, r: 120, color: '#ffcc88'}, {key: 'l2', x: 205, y: 200, r: 80, color: '#ffcc88'}], 'p1', true]));
    t.eq('undo 移到場景：一筆退回', JSON.stringify(r.moveUndo), JSON.stringify([5, null, 1]));
    t.eq('有草稿先問、儲存後照草稿位置移', JSON.stringify(r.draftMove), JSON.stringify([null, {key: 'p1', img: 'Barrel', x: 203, y: 200}, false]));
    t.eq('最後一個零件也能移：prefab 變空、左欄「沒有零件」', JSON.stringify(r.empty), JSON.stringify([{look: 'off'}, ['（沒有零件）']]));
    t.eq('沒有實例：「加到 prefab」反灰', JSON.stringify(r.noInst), JSON.stringify(['加到 prefab（場景裡沒有實例）', true]));
});
