// 紙娃娃編輯器（tools/paperdoll）：用 window.__pd 直接呼叫，驗證像素操作與位置補償
import {run} from './harness.mjs'

run('paperdoll', async t => {
    await t.page.goto(new URL('tools/paperdoll/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__pd);
    const ev = (fn) => t.page.evaluate(fn);

    const r = await ev(async () => {
        const pd = window.__pd, out = {};
        const img = (w, h, draw) => {const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); return createImageBitmap(c);};
        const pos = (L) => ({w: L.canvas.width, h: L.canvas.height, x: L.x, y: L.y});

        const L = pd.addLayer(await img(100, 50, g => g.fillRect(10, 5, 80, 40)), 't', null, null, {x: 2, y: 8, scale: 0.25});
        out.load = pos(L);
        pd.trimLayer(L);
        out.trim = pos(L);

        pd.setMode('crop');
        pd.S.mode.rect = {ax: 0, ay: 0, bx: 40, by: 40};
        pd.applyMode();
        out.crop = pos(L);
        pd.undo();
        out.undo = pos(L);
        pd.redo();
        out.redo = pos(L);

        pd.setMode('scale');
        pd.S.mode.sx = pd.S.mode.sy = 0.5;
        pd.applyMode();
        out.scale = pos(L);
        out.ops = L.ops.length;

        const grad = (g) => {const gr = g.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#f00'); gr.addColorStop(1, '#00f'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);};
        const pix = (L) => [...L.canvas.getContext('2d').getImageData(0, 0, L.canvas.width, L.canvas.height).data].join();
        const scaleBy = (L, f) => {pd.select(L); pd.setMode('scale'); pd.S.mode.sx = pd.S.mode.sy = f; pd.applyMode();};
        const G1 = pd.addLayer(await img(64, 64, grad), 'g1', null, null, null);
        const G2 = pd.addLayer(await img(64, 64, grad), 'g2', null, null, null);
        scaleBy(G1, 0.5); scaleBy(G1, 0.5);
        scaleBy(G2, 0.25);
        out.fromSrc = G1.ops.length === 1 && pix(G1) === pix(G2);
        pd.S.layers.splice(pd.S.layers.indexOf(G1), 2);
        pd.select(L);

        const before = pd.toWorld(L, 0, 0);
        pd.setOrigin(L, 0.5, 0.5);
        const after = pd.toWorld(L, 0, 0);
        out.originKeep = Math.hypot(before.x - after.x, before.y - after.y) < 1e-9;
        pd.setOrigin(L, 0.5, 1);

        const A = pd.addLayer(await img(4, 1, g => [10, 50, 200, 255].forEach((a, i) => {g.fillStyle = `rgba(255,0,0,${a / 255})`; g.fillRect(i, 0, 1, 1);})), 'a', null, null, null);
        document.getElementById('alT').value = 60;
        pd.setMode('alpha');
        pd.applyMode();
        out.alpha = [...A.canvas.getContext('2d').getImageData(0, 0, 4, 1).data].filter((_, i) => i % 4 === 3);

        L.a = 30;
        out.xlsx = pd.sidecar(L, 'foo').xlsx;
        const icon = pd.iconCanvas(32);
        out.icon = [icon.width, icon.height, pd.S.layers.length];

        const N = pd.addLayer(await img(100, 50, g => {g.fillRect(40, 10, 20, 30); g.fillStyle = 'rgba(0,0,0,0.02)'; g.fillRect(0, 0, 1, 1);}), 'n', null, null, null);
        pd.trimLayer(N);
        out.noise = [N.canvas.width, N.canvas.height];

        const E = pd.addLayer(await img(10, 10, g => g.fillRect(0, 0, 10, 10)), 'e', null, null, null);
        const ex = E.x, ey = E.y;
        document.getElementById('cropCut').checked = true;
        pd.setMode('crop');
        pd.S.mode.rect = {ax: 2, ay: 3, bx: 6, by: 8};
        pd.applyMode();
        document.getElementById('cropKeep').checked = true;
        const a = (x, y) => E.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        out.erase = [E.canvas.width, E.canvas.height, E.x === ex && E.y === ey, a(2, 3), a(5, 7), a(6, 7), a(1, 3), E.ops.at(-1)?.type];
        pd.undo();
        out.eraseUndo = [E.ops.length, a(2, 3)];
        return out;
    });

    const w = await ev(async () => {
        const pd = window.__pd, out = {};
        const c = document.createElement('canvas'); c.width = c.height = 40;
        c.getContext('2d').fillRect(0, 0, 40, 40);
        const L = pd.addLayer(await createImageBitmap(c), 'w', null, null, {x: 5, y: 7, scale: 1});
        L.a = 30;
        const x0 = L.x, y0 = L.y, ops0 = L.ops.length;
        const center0 = pd.toWorld(L, 20, 20);

        document.getElementById('wpCols').value = 2;
        document.getElementById('wpRows').value = 2;
        pd.setMode('warp');
        pd.S.mode.pts[0] = {x: -10, y: -10};
        pd.S.mode.stale = true;
        pd.applyMode();
        const center1 = pd.toWorld(L, 30, 30);
        out.size = [L.canvas.width, L.canvas.height, L.ops.at(-1)?.type];
        out.centerKeep = Math.hypot(center0.x - center1.x, center0.y - center1.y) < 1e-6;
        out.corner = L.canvas.getContext('2d').getImageData(1, 1, 1, 1).data[3];

        const x1 = L.x, y1 = L.y, n1 = L.ops.length;
        pd.setMode('warp');
        out.resume = pd.S.mode.edited && pd.S.mode.pts[0].x === -10;
        pd.applyMode();
        out.resumeSame = L.ops.length === n1 && Math.abs(L.x - x1) < 1e-6 && Math.abs(L.y - y1) < 1e-6;

        pd.setMode('warp');
        document.getElementById('wpReset').click();
        pd.applyMode();
        out.reset = L.ops.length === ops0 && L.canvas.width === 40 && Math.abs(L.x - x0) < 1e-6 && Math.abs(L.y - y0) < 1e-6;
        pd.undo();
        out.undo = L.canvas.width === 50 && L.ops.at(-1)?.type === 'warp';
        pd.S.layers.splice(pd.S.layers.indexOf(L), 1);
        return out;
    });
    t.eq('變形：拉出左上角，畫布擴大', JSON.stringify(w.size), JSON.stringify([50, 50, 'warp']));
    t.check('變形：沒動到的點留在原地（含旋轉）', w.centerKeep);
    t.check('變形：拉出去的角有像素', w.corner > 0, `alpha=${w.corner}`);
    t.check('變形：再按一次接著編輯同一張網格', w.resume);
    t.check('變形：不改直接確定，結果不變', w.resumeSame);
    t.check('變形：重設後確定＝拿掉變形、位置還原', w.reset);
    t.check('變形：undo 回到變形後', w.undo);

    // 專案存讀：用 OPFS 當工作資料夾（無頭 Chrome 開不了資料夾選擇視窗）
    t.page.on('dialog', d => d.accept());
    const p = await ev(async () => {
        const pd = window.__pd, out = {};
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, {recursive: true});
        const img = await root.getDirectoryHandle('img', {create: true});
        const c = document.createElement('canvas'); c.width = 40; c.height = 20;
        c.getContext('2d').fillRect(0, 0, 40, 20);
        const fh = await img.getFileHandle('a.png', {create: true});
        const w = await fh.createWritable(); await w.write(await new Promise(r => c.toBlob(r))); await w.close();

        Object.assign(pd.S, {layers: [], active: null, project: null, projSig: null});
        await pd.setRoot(root);
        await pd.loadHandle(fh, img, 'img');
        const L = pd.S.active;
        pd.setMode('scale'); pd.S.mode.sx = pd.S.mode.sy = 0.5; pd.applyMode();
        L.x = 7;
        pd.S.project = {dir: root, path: '', name: 't'};
        await pd.saveProject(false);
        out.savedClean = !pd.isUnsaved();
        L.x = 9;
        out.dirty = pd.isUnsaved();

        await pd.openProject(await root.getFileHandle('t.pdproj.json'), root, '');
        const M = pd.S.layers[0];
        out.reopen = [pd.S.layers.length, M.x, M.canvas.width, M.ops.length, M.srcPath, pd.isUnsaved(), pd.hist.undos.length];

        const before = await (await (await root.getFileHandle('t.pdproj.json')).getFile()).text();
        pd.addLayer(await createImageBitmap(c), 'dropped', null, null, null);
        await pd.saveProject(false);
        out.looseBlocked = before === await (await (await root.getFileHandle('t.pdproj.json')).getFile()).text();
        return out;
    });
    t.check('專案：存完沒有未存修改', p.savedClean);
    t.check('專案：改了就標記未存', p.dirty);
    t.eq('專案：重開還原圖層、步驟、位置，undo 清空', JSON.stringify(p.reopen), JSON.stringify([1, 7, 20, 1, 'img/a.png', false, 0]));
    t.check('專案：有拖進來的圖層時擋下存檔', p.looseBlocked);

    const o = await ev(async () => {
        const pd = window.__pd, out = {};
        const root = await navigator.storage.getDirectory(), img = await root.getDirectoryHandle('img');
        const alphaOf = async (c) => {c = c instanceof Blob ? await createImageBitmap(c) : c; const k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const g = k.getContext('2d'); g.drawImage(c, 0, 0); return Math.max(...g.getImageData(0, 0, k.width, k.height).data.filter((_, i) => i % 4 === 3));};
        const save = async (name, bake) => {
            const p = pd.saveLayer();
            const dlg = document.getElementById('dlgSave');
            await new Promise(r => {const f = () => dlg.open ? r() : requestAnimationFrame(f); f();});
            out.shown = !document.getElementById('dlgBakeRow').hidden;
            document.getElementById('dlgName').value = name;
            document.getElementById('dlgBake').checked = bake;
            dlg.close('ok');
            await p;
            return alphaOf(await (await img.getFileHandle(`${name}.png`)).getFile());
        };
        Object.assign(pd.S, {layers: [], active: null, project: null, projSig: null});
        await pd.loadHandle(await img.getFileHandle('a.png'), img, 'img');
        const L = pd.S.active;
        L.opacity = 0.5;
        out.baked = await save('b', true);
        out.keep = [out.shown, L.opacity, L.srcPath];
        out.solid = await save('c', false);
        out.icon = [await alphaOf(pd.iconCanvas(32, true)), await alphaOf(pd.iconCanvas(32))];
        out.self = [await save('a', true), L.opacity, L.ops.length, await alphaOf(L.canvas)];
        out.hidden = !(await save('d', true), out.shown);
        return out;
    });
    t.check('不透明度：勾選烘入，PNG 變半透明', Math.abs(o.baked - 128) <= 1, `alpha=${o.baked}`);
    t.eq('不透明度：存成別的檔，勾選有出現、opacity 不變', JSON.stringify(o.keep), JSON.stringify([true, 0.5, 'img/a.png']));
    t.eq('不透明度：沒勾就存實心', o.solid, 255);
    t.check('不透明度：icon 勾選烘入才變淡', Math.abs(o.icon[0] - 128) <= 1 && o.icon[1] === 255, JSON.stringify(o.icon));
    t.check('不透明度：覆蓋原圖後 opacity 歸 1，不會乘兩次', Math.abs(o.self[0] - 128) <= 1 && o.self[1] === 1 && o.self[2] === 0 && o.self[3] === o.self[0], JSON.stringify(o.self));
    t.check('不透明度：100% 時不顯示勾選', o.hidden);

    // 合併：dialog 一律 accept，所以有半透明時會烘入
    const m = await ev(async () => {
        const pd = window.__pd, out = {};
        const sq = (n, color) => {const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, n, n); return createImageBitmap(c);};
        const at = (L, wx, wy) => [...L.canvas.getContext('2d').getImageData(Math.floor(wx - L.x + L.ox * L.canvas.width), Math.floor(wy - L.y + L.oy * L.canvas.height), 1, 1).data];
        const names = () => pd.S.layers.map(L => L.name).join();
        Object.assign(pd.S, {layers: [], active: null, project: null, projSig: null});
        pd.hist.undos.length = pd.hist.redos.length = 0;
        const A = pd.addLayer(await sq(20, '#f00'), 'A', null, null, null);
        const B = pd.addLayer(await sq(10, '#00f'), 'B', null, null, null);
        const C = pd.addLayer(await sq(10, '#0f0'), 'C', null, null, null);
        B.x = 30;
        C.visible = false;

        pd.mergeDown();
        out.hidden = names();
        pd.select(B);
        pd.mergeDown();
        const M = pd.S.active;
        out.down = [names(), M.x, M.y, M.a, M.canvas.width, M.canvas.height, M.oy, M.srcPath ?? null];
        out.pix = [at(M, 0, -10).join(), at(M, 30, -5).join()];
        pd.undo();
        out.undo = [names(), pd.S.layers[1] === B];
        pd.redo();
        out.redo = pd.S.layers[0] === M;
        pd.undo();

        C.visible = true;
        C.locked = true;
        B.opacity = 0.5;
        pd.mergeVisible();
        out.visible = [names(), at(pd.S.layers[0], 30, -5)[3]];

        pd.undo();
        pd.removeLayer(C);
        pd.redo();
        pd.undo();
        out.removed = names();

        pd.select(A);
        pd.duplicateLayer();
        const D = pd.S.active, samePos = D.x === A.x && D.y === A.y;
        pd.setMode('crop');
        pd.S.mode.rect = {ax: 0, ay: 0, bx: 5, by: 5};
        pd.applyMode();
        out.dup = [names(), samePos, D.canvas.width, A.canvas.width];
        pd.undo(); pd.undo();
        out.dupUndo = names();
        return out;
    });
    t.eq('合併：向下合併遇到隱藏的圖層會拒絕', m.hidden, 'A,B,C');
    t.eq('合併：新圖層在底層位置、沿用底層中心點、旋轉歸零、沒有原圖', JSON.stringify(m.down), JSON.stringify(['A-merged,C', 0, 0, 0, 45, 20, 1, null]));
    t.eq('合併：像素位置不變', JSON.stringify(m.pix), JSON.stringify(['255,0,0,255', '0,0,255,255']));
    t.eq('合併：undo 換回原本的圖層', JSON.stringify(m.undo), JSON.stringify(['A,B,C', true]));
    t.check('合併：redo 換回合併後的圖層', m.redo);
    t.check('合併可見：跳過鎖定的圖層、烘入不透明度', m.visible[0] === 'A-merged,C' && Math.abs(m.visible[1] - 128) <= 1, JSON.stringify(m.visible));
    t.eq('合併：刪掉的圖層不會被 undo 合併復活', m.removed, 'A,B');
    t.eq('複製：放在原圖層上面、位置相同、改副本不影響原圖層', JSON.stringify(m.dup), JSON.stringify(['A,A-copy,B', true, 5, 20]));
    t.eq('複製：undo 拿掉副本', m.dupUndo, 'A,B');

    t.eq('載入時套用 json（遊戲單位 ÷ scale）', JSON.stringify(r.load), JSON.stringify({w: 100, h: 50, x: 8, y: 32}));
    t.eq('trim 後內容不跳位', JSON.stringify(r.trim), JSON.stringify({w: 80, h: 40, x: 8, y: 27}));
    t.eq('裁切後內容不跳位', JSON.stringify(r.crop), JSON.stringify({w: 40, h: 40, x: -12, y: 27}));
    t.eq('undo 還原裁切', JSON.stringify(r.undo), JSON.stringify(r.trim));
    t.eq('redo 重做裁切', JSON.stringify(r.redo), JSON.stringify(r.crop));
    t.eq('縮放以中心點為準，x/y 不變', JSON.stringify(r.scale), JSON.stringify({w: 20, h: 20, x: -12, y: 27}));
    t.eq('trim＋裁切＋縮放合成一步', r.ops, 1);
    t.check('縮兩次 50% 跟直接縮 25% 像素相同（都從原圖取樣）', r.fromSrc);
    t.check('改中心點時內容不跳位', r.originKeep);
    t.eq('alpha < 60 清除', JSON.stringify(r.alpha), JSON.stringify([0, 0, 200, 255]));
    t.eq('sidecar 的 xlsx 字串', r.xlsx, '"sprite":"foo","scale":0.25,"x":-3,"y":6.75,"a":30');
    t.eq('icon 是 32×32', JSON.stringify(r.icon), JSON.stringify([32, 32, 2]));
    t.eq('trim 忽略低於門檻的雜訊', JSON.stringify(r.noise), JSON.stringify([20, 30]));
    t.eq('裁切（移除）：框內挖透明、尺寸位置不變', JSON.stringify(r.erase), JSON.stringify([10, 10, true, 0, 0, 255, 255, 'erase']));
    t.eq('裁切（移除）：undo 還原', JSON.stringify(r.eraseUndo), JSON.stringify([0, 255]));
});
