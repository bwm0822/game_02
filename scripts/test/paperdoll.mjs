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

        const rgba = (L) => [...L.canvas.getContext('2d').getImageData(0, 0, L.canvas.width, 1).data].join();
        const strip = () => img(4, 1, g => [[0, 255, 0, 10], [255, 0, 0, 255], [10, 20, 30, 255]].forEach(([r, gg, b, a], i) => {g.fillStyle = `rgba(${r},${gg},${b},${a / 255})`; g.fillRect(i + 1, 0, 1, 1);}));
        const F = pd.addLayer(await strip(), 'f', null, null, null);
        const fBefore = rgba(F);
        Object.assign(document.getElementById('colRgb'), {value: '#0000ff'});
        document.getElementById('colA').value = 200;
        document.getElementById('colT').value = 20;
        document.getElementById('colFill').checked = true;
        pd.setMode('color');
        pd.applyMode();
        out.fill = [rgba(F).split(',').filter((_, i) => i % 4 === 3).join(), rgba(F).split(',').slice(8, 12).join(), F.ops.at(-1).type];
        pd.undo();
        out.fillUndo = rgba(F) === fBefore;

        const K = pd.addLayer(await strip(), 'k', null, null, null);
        document.getElementById('colKey').checked = true;
        pd.setMode('color');
        pd.pickColor(pd.toWorld(K, 2.5, 0.5));
        out.picked = document.getElementById('colRgb').value;
        pd.applyMode();
        out.key = rgba(K).split(',').filter((_, i) => i % 4 === 3).join();
        document.getElementById('colFill').checked = true;
        pd.S.layers.splice(pd.S.layers.indexOf(F), 2);
        pd.select(A);

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

        const toNew = (how) => {
            pd.select(E);
            document.getElementById(how).checked = true;
            pd.setMode('crop');
            pd.S.mode.rect = {ax: 2, ay: 3, bx: 6, by: 8};
            pd.applyMode();
            document.getElementById('cropKeep').checked = true;
            const C = pd.S.active, i = pd.S.layers.indexOf(E);
            const p = pd.toWorld(C, 0, 0), q = pd.toWorld(E, 2, 3);
            return [C !== E && pd.S.layers[i + 1] === C, C.canvas.width, C.canvas.height, p.x === q.x && p.y === q.y, a(2, 3), C.name === E.name];
        };
        const n0 = pd.S.layers.length;
        out.copyNew = toNew('cropCopy');
        pd.undo();
        out.moveNew = toNew('cropMove');
        pd.undo();
        out.moveUndo = [pd.S.layers.length === n0, pd.S.active === E, a(2, 3)];
        pd.redo();
        out.moveRedo = [pd.S.layers.length === n0 + 1, a(2, 3)];
        return out;
    });

    const w = await ev(async () => {
        const pd = window.__pd, out = {};
        const $ = (id) => document.getElementById(id);
        const sq = (n) => {const c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').fillRect(0, 0, n, n); return createImageBitmap(c);};
        const alpha = (L, x, y) => L.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const L = pd.addLayer(await sq(40), 'w', null, null, {x: 5, y: 7, scale: 1});
        L.a = 30;
        const x0 = L.x, y0 = L.y, ops0 = L.ops.length;
        const center0 = pd.toWorld(L, 20, 20);

        $('wpCols').value = 2;
        $('wpRows').value = 2;
        pd.setMode('warp');
        out.empty = pd.S.mode.frames.length;
        let f = pd.warpAddFrame(pd.S.mode, {x: 0, y: 0, w: 40, h: 40});
        f.pts[0] = {x: -10, y: -10};
        pd.applyMode();
        const center1 = pd.toWorld(L, 30, 30);
        out.size = [L.canvas.width, L.canvas.height, L.ops.at(-1)?.type];
        out.centerKeep = Math.hypot(center0.x - center1.x, center0.y - center1.y) < 1e-6;
        out.corner = alpha(L, 1, 1);

        const x1 = L.x, y1 = L.y, n1 = L.ops.length;
        pd.setMode('warp');
        out.resume = pd.S.mode.frames.length === 1 && pd.S.mode.frames[0].pts[0].x === -10 && !pd.S.mode.changed;
        pd.applyMode();
        out.resumeSame = L.ops.length === n1 && Math.abs(L.x - x1) < 1e-6 && Math.abs(L.y - y1) < 1e-6;

        pd.setMode('warp');
        $('wpReset').click();
        pd.applyMode();
        out.reset = L.ops.length === ops0 && L.canvas.width === 40 && Math.abs(L.x - x0) < 1e-6 && Math.abs(L.y - y0) < 1e-6;
        pd.undo();
        out.undo = L.canvas.width === 50 && L.ops.at(-1)?.type === 'warp';
        pd.S.layers.splice(pd.S.layers.indexOf(L), 1);

        // 局部框：右邊一排點往左推 5，框外不動、框內右側空出來
        const M = pd.addLayer(await sq(40), 'm', null, null, null);
        const mx = M.x, my = M.y;
        pd.setMode('warp');
        f = pd.warpAddFrame(pd.S.mode, {x: 10, y: 10, w: 20, h: 20});
        for (const k of [2, 5, 8]) f.pts[k] = {x: 25, y: f.pts[k].y};
        pd.applyMode();
        out.local = [M.canvas.width, M.canvas.height, M.x === mx && M.y === my, alpha(M, 20, 20), alpha(M, 27, 20), alpha(M, 35, 20), alpha(M, 27, 5)];

        // Delete 刪框；有沒套用的修改時切換模式會問
        pd.setMode('warp');
        const m3 = pd.S.mode;
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true}));
        out.del = [m3.frames.length, m3.cur];
        let asked = 0;
        const conf = window.confirm;
        window.confirm = () => (asked++, true);
        pd.setMode('move');
        window.confirm = conf;
        out.leave = [asked, M.ops.length, M.canvas.width];
        pd.undo();
        out.leaveUndo = M.ops.length;
        pd.S.layers.splice(pd.S.layers.indexOf(M), 1);

        // 互動：真的派 pointer 事件
        const Q = pd.addLayer(await sq(40), 'q', null, null, null);
        $('wpCols').value = 4;
        $('wpRows').value = 4;
        pd.setMode('warp');
        pd.S.view.zoom = 10;
        const m = pd.S.mode, cv = $('cv'), rc = cv.getBoundingClientRect(), o = pd.toWorld(Q, 0, 0), K = pd.S.view.zoom;
        const at = (x, y) => ({clientX: rc.left + pd.S.view.px + (o.x + x) * K, clientY: rc.top + pd.S.view.py + (o.y + y) * K, pointerId: 1, button: 0, bubbles: true});
        const fire = (type, [x, y], extra) => cv.dispatchEvent(new PointerEvent(type, {...at(x, y), ...extra}));
        const drag = (a, b, extra = {}) => {fire('pointerdown', a, extra); fire('pointermove', b, {buttons: 1, ...extra}); fire('pointerup', b, extra);};
        drag([4, 4], [36, 36]);
        const f1 = m.frames[0];
        out.made = [m.frames.length, f1.x, f1.y, f1.w, f1.h, f1.cols, f1.pts.length];
        drag([34, 0], [39, 39], {shiftKey: true});
        const n1sel = f1.sel.size;
        drag([34, 0], [39, 6], {ctrlKey: true});
        const n2sel = f1.sel.size;
        fire('pointerdown', [36, 12], {ctrlKey: true}); fire('pointerup', [36, 12], {ctrlKey: true});
        out.sel = [n1sel, n2sel, f1.sel.size];
        drag([36, 20], [39, 21], {shiftKey: true});
        const r4 = (v) => Math.round(v * 1e4) / 1e4;
        out.lock = [...f1.sel].sort((a, b) => a - b).map(k => `${r4(f1.pts[k].x)},${r4(f1.pts[k].y)}`).join(' ');
        const hx = 4 - Math.SQRT1_2, hy = 4 - Math.SQRT1_2;
        drag([hx, hy], [hx - 2, hy]);
        out.resize = [f1.x, f1.y, f1.w, f1.h, r4(f1.pts[24].x)];
        drag([0, 30], [3, 39]);
        const n = m.frames.length;
        fire('pointerdown', [20, 20], {}); fire('pointerup', [20, 20], {});
        out.switch = [n, m.cur];
        const key = (k, extra) => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, ...extra}));
        key('z', {ctrlKey: true});
        const u1 = m.frames.length;
        key('z', {ctrlKey: true});
        const u2 = m.frames[0].x;
        key('y', {ctrlKey: true});
        out.modeUndo = [u1, u2, m.frames[0].x, pd.S.mode.type];
        pd.cancelMode();
        pd.S.layers.splice(pd.S.layers.indexOf(Q), 1);
        return out;
    });
    const pg = await ev(async () => {
        const pd = window.__pd, out = {};
        const c = document.createElement('canvas'); c.width = c.height = 10;
        c.getContext('2d').fillRect(0, 0, 10, 10);
        const Q = pd.addLayer(await createImageBitmap(c), 'q', null, null, null);
        const a = (L, x, y) => L.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const tri = [{x: 2, y: 2}, {x: 8, y: 2}, {x: 2, y: 8}];
        const run = (how) => {
            pd.select(Q);
            document.getElementById('cropPolyShape').checked = true;
            document.getElementById(how).checked = true;
            pd.setMode('crop');
            pd.S.mode.poly = {pts: tri, closed: true};
            pd.applyMode();
            document.getElementById('cropKeep').checked = true;
            return pd.S.active;
        };
        const q0 = pd.toWorld(Q, 2, 2);
        run('cropKeep');
        const p = pd.toWorld(Q, 0, 0);
        out.keep = [Q.canvas.width, Q.canvas.height, a(Q, 1, 1), a(Q, 5, 5), Q.ops.map(o => o.type).join(), p.x === q0.x && p.y === q0.y];
        const pix = [...Q.canvas.getContext('2d').getImageData(0, 0, 6, 6).data].join();
        const {replay} = await import('./pixels.js');
        out.replay = [...replay(Q.src, JSON.parse(JSON.stringify(Q.ops))).getContext('2d').getImageData(0, 0, 6, 6).data].join() === pix;
        pd.undo();
        out.keepUndo = Q.canvas.width;
        run('cropCut');
        out.cut = [Q.canvas.width, a(Q, 3, 3), a(Q, 7, 7), Q.ops.at(-1).type];
        pd.undo();
        const n0 = pd.S.layers.length;
        const C = run('cropMove');
        out.move = [C !== Q, C.canvas.width, C.canvas.height, a(C, 1, 1), a(Q, 3, 3), a(Q, 7, 7)];
        pd.undo();
        out.moveUndo = [pd.S.layers.length === n0, a(Q, 3, 3)];

        // 互動：真的派 pointer 事件
        pd.select(Q);
        document.getElementById('cropPolyShape').checked = true;
        pd.setMode('crop');
        pd.S.view.zoom = 10;
        const cv = document.getElementById('cv'), rc = cv.getBoundingClientRect();
        const at = (x, y) => {const w = pd.toWorld(Q, x, y), K = pd.S.view.zoom; return {clientX: rc.left + pd.S.view.px + w.x * K, clientY: rc.top + pd.S.view.py + w.y * K, pointerId: 1, button: 0, bubbles: true};};
        const fire = (type, x, y, extra) => cv.dispatchEvent(new PointerEvent(type, {...at(x, y), ...extra}));
        const click = (x, y) => {fire('pointerdown', x, y, {detail: 1}); fire('pointerup', x, y);};
        const pts = () => pd.S.mode.poly.pts.map(v => `${Math.round(v.x)},${Math.round(v.y)}`).join(' ');
        const key = (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
        click(1, 1); click(9, 1); click(9, 9);
        fire('pointerdown', 1, 9.5, {detail: 1, shiftKey: true}); fire('pointerup', 1, 9.5);
        out.shift = pts();
        key('Backspace');
        click(1.05, 1.05);
        out.closed = [pd.S.mode.poly.closed, pts()];
        fire('pointerdown', 5, 1, {detail: 1}); fire('pointermove', 5, 0, {buttons: 1}); fire('pointerup', 5, 0);
        out.insert = pts();
        click(7, 4);
        out.miss = pts();
        key('Backspace');
        out.reopen = pd.S.mode.poly.closed;
        key('Escape');
        out.esc = [pd.S.mode.type, pd.S.mode.poly];
        pd.cancelMode();
        document.getElementById('cropRectShape').checked = true;
        pd.S.layers.splice(pd.S.layers.indexOf(Q), 1);
        return out;
    });
    t.eq('多邊形（保留）：裁到外接矩形、多邊形外透明、內容不跳位', JSON.stringify(pg.keep), JSON.stringify([6, 6, 255, 0, 'mask,xform', true]));
    t.check('多邊形：步驟 JSON 來回後重播結果相同（專案存讀）', pg.replay);
    t.eq('多邊形（保留）：undo', pg.keepUndo, 10);
    t.eq('多邊形（移除）：多邊形內挖透明、尺寸不變', JSON.stringify(pg.cut), JSON.stringify([10, 0, 255, 'mask']));
    t.eq('多邊形（移到新圖層）：新層只有多邊形內、原圖挖掉', JSON.stringify(pg.move), JSON.stringify([true, 6, 6, 255, 0, 255]));
    t.eq('多邊形（移到新圖層）：一次 undo 還原', JSON.stringify(pg.moveUndo), JSON.stringify([true, 255]));
    t.eq('多邊形互動：Shift 鎖 45°', pg.shift, '1,1 9,1 9,9 1,9');
    t.eq('多邊形互動：點第一點閉合', JSON.stringify(pg.closed), JSON.stringify([true, '1,1 9,1 9,9']));
    t.eq('多邊形互動：點邊插點並直接拖曳', pg.insert, '1,1 5,0 9,1 9,9');
    t.eq('多邊形互動：閉合後點空白不變', pg.miss, '1,1 5,0 9,1 9,9');
    t.check('多邊形互動：Backspace 解開閉合', pg.reopen === false);
    t.eq('多邊形互動：Esc 清掉多邊形、留在裁切模式', JSON.stringify(pg.esc), JSON.stringify(['crop', null]));

    t.eq('變形：一開始沒有框', w.empty, 0);
    t.eq('變形：拉出左上角，畫布擴大', JSON.stringify(w.size), JSON.stringify([50, 50, 'warp']));
    t.check('變形：沒動到的點留在原地（含旋轉）', w.centerKeep);
    t.check('變形：拉出去的角有像素', w.corner > 0, `alpha=${w.corner}`);
    t.check('變形：再按一次接著編輯同一組框', w.resume);
    t.check('變形：不改直接確定，結果不變', w.resumeSame);
    t.check('變形：重設後確定＝拿掉變形、位置還原', w.reset);
    t.check('變形：undo 回到變形後', w.undo);
    t.eq('變形：局部框只動框內、框外不變', JSON.stringify(w.local), JSON.stringify([40, 40, true, 255, 0, 255, 255]));
    t.eq('變形：Delete 刪掉目前的框', JSON.stringify(w.del), JSON.stringify([0, -1]));
    t.eq('變形：有沒套用的修改時切換模式會問，確定就套用', JSON.stringify(w.leave), JSON.stringify([1, 0, 40]));
    t.eq('變形：離開模式後整段一筆 undo', w.leaveUndo, 1);
    t.eq('變形互動：拖曳拉出 4×4 的框', JSON.stringify(w.made), JSON.stringify([1, 4, 4, 32, 32, 4, 25]));
    t.eq('變形互動：Shift 拖曳選點、Ctrl 拖曳／點取消', JSON.stringify(w.sel), JSON.stringify([5, 4, 3]));
    t.eq('變形互動：拖點時 Shift 只沿水平', w.lock, '39,20 39,28 39,36');
    t.eq('變形互動：拖把手調框大小，點等比例跟著', JSON.stringify(w.resize), JSON.stringify([2, 4, 34, 32, 39.1875]));
    t.eq('變形互動：點另一個框切換', JSON.stringify(w.switch), JSON.stringify([2, 0]));
    t.eq('變形：模式裡 Ctrl+Z／Ctrl+Y 一步一步退', JSON.stringify(w.modeUndo), JSON.stringify([1, 4, 2, 'warp']));

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

        const log = [], {confirm, alert} = window;
        window.confirm = (m) => {log.push(m); return confirm.call(window, m);};
        window.alert = (m) => {log.push(m); return alert.call(window, m);};
        const $ = (id) => document.getElementById(id);
        const text = async (name) => (await (await root.getFileHandle(`${name}.pdproj.json`)).getFile()).text();
        const shown = (id, p) => Promise.race([p.then(() => false), new Promise(r => {const f = () => $(id).open ? r(true) : requestAnimationFrame(f); f();})]);
        // 回傳對話框預設檔名；沒跳對話框（被擋下）回傳 null
        const saveProj = async (name) => {
            const p = pd.saveProject();
            if (!await shown('dlgSave', p)) return p.then(() => null);
            const def = $('dlgName').value;
            $('dlgName').value = name;
            $('dlgSave').close('ok');
            await p;
            return def;
        };
        const openProj = async (name, how) => {
            const p = pd.openProject(await root.getFileHandle(`${name}.pdproj.json`), root, '');
            if (await shown('dlgOpen', p)) $('dlgOpen').close(how);
            await p;
        };
        const title = () => new Promise(r => requestAnimationFrame(() => r($('projName').textContent)));

        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        pd.hist.undos.length = pd.hist.redos.length = 0;
        await pd.setRoot(root);
        await pd.loadHandle(fh, img, 'img');
        const L = pd.S.active;
        pd.setMode('scale'); pd.S.mode.sx = pd.S.mode.sy = 0.5; pd.applyMode();
        $('colRgb').value = '#ff0000';
        $('colA').value = 128;
        $('colT').value = 1;
        pd.setMode('color'); pd.applyMode();
        L.x = 7;
        out.defNew = await saveProj('t');
        out.savedClean = [!pd.isUnsaved(), L.proj, await title()];
        L.x = 9;
        out.dirty = pd.isUnsaved();

        await openProj('t', 'replace');
        const M = pd.S.layers[0];
        out.reopen = [pd.S.layers.length, M.x, M.canvas.width, M.ops.length, M.srcPath, pd.isUnsaved(), pd.hist.undos.length, M.proj?.name, await title()];
        out.reopenPix = [...M.canvas.getContext('2d').getImageData(5, 5, 1, 1).data].join();

        log.length = 0;
        out.defOwn = [await saveProj('t'), log.length === 1 && !log[0].includes('不同')];

        pd.duplicateLayer();
        const D = pd.S.active;
        out.dupTag = D.proj === M.proj;
        M.save = false;
        await saveProj('u');
        M.save = true;
        pd.removeLayer(D);

        log.length = 0;
        pd.S.scale = 0.5;
        await openProj('u', 'add');
        pd.S.scale = 0.25;
        const U = pd.S.layers.at(-1);
        out.add = [pd.S.layers.length, U.proj?.name, pd.S.active === U, U.x === M.x, await title(), log.some(m => m.includes('scale'))];
        await openProj('u', 'add');
        out.addTwice = pd.S.layers.length;
        pd.undo();
        out.addUndo = [pd.S.layers.length, (await title()).replace(' *', '')];
        pd.redo();

        log.length = 0;
        out.defMulti = await saveProj('t');
        out.diffNote = log.some(m => m.includes('不同'));
        out.tagKeep = [M.proj.name, U.proj.name, JSON.parse(await text('t')).layers.length];
        U.save = false;
        await saveProj('only');
        out.onlySaved = JSON.parse(await text('only')).layers.length;
        U.save = true;

        pd.select(M);
        const before = await text('t');
        const X = pd.addLayer(await createImageBitmap(c), 'dropped', null, null, null);
        out.dropTag = X.proj === M.proj;
        out.looseBlocked = await saveProj('t') === null && before === await text('t');
        for (const K of pd.S.layers) K.save = false;
        pd.select(M);
        out.btnOff = $('btnSaveProj').disabled;
        Object.assign(window, {confirm, alert});
        return out;
    });
    t.eq('專案：沒有專案時預設存成新專案', p.defNew, 'project');
    t.eq('專案：存完沒有未存修改、存檔不改圖層歸屬', JSON.stringify(p.savedClean), JSON.stringify([true, null, '（未命名）']));
    t.check('專案：改了就標記未存', p.dirty);
    t.eq('專案：重開還原圖層、步驟、位置，undo 清空、記得歸屬', JSON.stringify(p.reopen), JSON.stringify([1, 7, 20, 2, 'img/a.png', false, 0, 't', 't']));
    t.eq('專案：重開後重播填色', p.reopenPix, '255,0,0,128');
    t.eq('專案：只開一個專案時預設存回它，圖層相同不提示', JSON.stringify(p.defOwn), JSON.stringify(['t', true]));
    t.check('專案：複製的圖層沿用歸屬', p.dupTag);
    t.eq('專案：加入疊在上面、選取加入的圖層、座標不變、scale 不同會警告', JSON.stringify(p.add), JSON.stringify([2, 'u', true, true, 't + u *', true]));
    t.eq('專案：同一個專案不能加入兩次', p.addTwice, 2);
    t.eq('專案：undo 拿掉加入的圖層', JSON.stringify(p.addUndo), JSON.stringify([1, 't']));
    t.eq('專案：多個專案時預設新專案', p.defMulti, 'project');
    t.check('專案：存進舊專案但圖層不同時，確認視窗會提示', p.diffNote);
    t.eq('專案：存進別的專案不改歸屬', JSON.stringify(p.tagKeep), JSON.stringify(['t', 'u', 2]));
    t.eq('專案：只存 💾 打勾的圖層', p.onlySaved, 1);
    t.check('專案：新圖層歸選取圖層的專案', p.dropTag);
    t.check('專案：有拖進來的圖層時擋下存檔', p.looseBlocked);
    t.check('專案：💾 全關時存專案按鈕不能按', p.btnOff);

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
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
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
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
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
    t.eq('填色：alpha >= 門檻的整組換掉，其餘不動', JSON.stringify(r.fill), JSON.stringify(['0,10,200,200', '0,0,255,200', 'fill']));
    t.check('填色：undo 還原', r.fillUndo);
    t.eq('去色：滴管吸 RGB', r.picked, '#ff0000');
    t.eq('去色：RGB 完全相等的變透明', r.key, '0,10,0,255');
    t.eq('sidecar 的 xlsx 字串', r.xlsx, '"sprite":"foo","scale":0.25,"x":-3,"y":6.75,"a":30');
    t.eq('icon 是 32×32', JSON.stringify(r.icon), JSON.stringify([32, 32, 2]));
    t.eq('trim 忽略低於門檻的雜訊', JSON.stringify(r.noise), JSON.stringify([20, 30]));
    t.eq('裁切（移除）：框內挖透明、尺寸位置不變', JSON.stringify(r.erase), JSON.stringify([10, 10, true, 0, 0, 255, 255, 'erase']));
    t.eq('裁切（移除）：undo 還原', JSON.stringify(r.eraseUndo), JSON.stringify([0, 255]));
    t.eq('裁切（複製到新圖層）：新層在上面、內容不跳位、原圖不變、名字沿用', JSON.stringify(r.copyNew), JSON.stringify([true, 4, 5, true, 255, true]));
    t.eq('裁切（移到新圖層）：原圖框內變透明', JSON.stringify(r.moveNew), JSON.stringify([true, 4, 5, true, 0, true]));
    t.eq('裁切（移到新圖層）：一次 undo 拿掉新層＋還原原圖', JSON.stringify(r.moveUndo), JSON.stringify([true, true, 255]));
    t.eq('裁切（移到新圖層）：redo', JSON.stringify(r.moveRedo), JSON.stringify([true, 0]));
});
