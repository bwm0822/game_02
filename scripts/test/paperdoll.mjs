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
});
