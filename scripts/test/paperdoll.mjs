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
        pd.select(G1); pd.setMode('scale');
        const pct = document.getElementById('scPct'), shown = pct.value;
        pct.value = 50; pct.dispatchEvent(new Event('input')); pd.applyMode();
        out.srcPct = [shown, G1.canvas.width];
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
        const ctl = (k) => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, ctrlKey: true, bubbles: true}));
        ctl('z');
        out.undoAtStart = [pd.S.mode.type, pd.S.mode.frames.length];
        ctl('z');
        out.undoAtStart2 = [pd.S.mode.type, pd.S.mode.frames.length];
        ctl('y');
        out.redoAtStart = [pd.S.mode.frames.length, pd.S.mode.frames[0]?.pts[0].x];
        pd.applyMode();
        out.resumeSame = L.ops.length === n1 && Math.abs(L.x - x1) < 1e-6 && Math.abs(L.y - y1) < 1e-6;

        pd.setMode('warp');
        $('wpReset').click();
        pd.applyMode();
        out.reset = L.ops.length === ops0 + 1 && L.ops.at(-1).frames[0].hist.length === 1 && L.canvas.width === 40 && Math.abs(L.x - x0) < 1e-6 && Math.abs(L.y - y0) < 1e-6;
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
        ctl('z');
        out.delUndo = [m3.frames.length, m3.cur];
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true}));
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
        const selPts = () => [...f1.sel].sort((a, b) => a - b).map(k => `${r4(f1.pts[k].x)},${r4(f1.pts[k].y)}`).join(' ');
        out.lock = selPts();
        fire('pointerdown', [39, 28], {shiftKey: true});
        fire('pointermove', [42, 29], {buttons: 1, shiftKey: true});
        fire('pointermove', [43, 40], {buttons: 1, shiftKey: true});
        const keep = selPts();
        fire('pointermove', [43, 40], {buttons: 1});
        const free = selPts();
        fire('pointermove', [43, 46], {buttons: 1, shiftKey: true});
        fire('pointerup', [43, 46], {});
        out.relock = [keep, free, selPts()];
        ctl('z');
        const hx = 4 - Math.SQRT1_2, hy = 4 - Math.SQRT1_2;
        drag([hx, hy], [hx - 2, hy]);
        out.resize = [f1.x, f1.y, f1.w, f1.h, r4(f1.pts[24].x)];
        drag([0, 30], [3, 39]);
        const n = m.frames.length;
        fire('pointerdown', [20, 20], {}); fire('pointerup', [20, 20], {});
        out.switch = [n, m.cur];
        // 目前是第一個框：Ctrl+Z 只退它（調大小 → 拖點 → 拿掉框），第二個框不動
        ctl('z');
        const u1 = f1.x;
        ctl('z');
        const u2 = r4(f1.pts[24].x);
        ctl('z');
        const u3 = [m.frames.length, m.frames[0].x];
        ctl('y');
        const u4 = [m.frames.length, m.cur];
        ctl('y');
        out.modeUndo = [u1, u2, ...u3, ...u4, r4(f1.pts[24].x), m.frames[1].x];

        // 步驟跟著框寫進 op（存專案也在），重新進來還能退
        pd.applyMode();
        const op = Q.ops.at(-1);
        pd.setMode('warp');
        const m4 = pd.S.mode;
        out.persist = [m4.frames.length, m4.frames[0].hist.length, JSON.parse(JSON.stringify(op)).frames[0].hist.length];
        ctl('z');
        const p1 = r4(m4.frames[0].pts[24].x);
        ctl('z'); ctl('z');
        out.persistUndo = [p1, m4.frames.length, pd.S.mode.type];
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
    t.eq('變形：框沒有步驟時 Ctrl+Z 拿掉框', JSON.stringify(w.undoAtStart), JSON.stringify(['warp', 0]));
    t.eq('變形：沒東西可退時 Ctrl+Z 停住、留在變形模式', JSON.stringify(w.undoAtStart2), JSON.stringify(['warp', 0]));
    t.eq('變形：Ctrl+Y 把框加回來', JSON.stringify(w.redoAtStart), JSON.stringify([1, -10]));
    t.check('變形：不改直接確定，結果不變', w.resumeSame);
    t.check('變形：重設後確定＝拿掉變形、位置還原（框和步驟留著）', w.reset);
    t.check('變形：undo 回到變形後', w.undo);
    t.eq('變形：局部框只動框內、框外不變', JSON.stringify(w.local), JSON.stringify([40, 40, true, 255, 0, 255, 255]));
    t.eq('變形：Delete 刪掉目前的框', JSON.stringify(w.del), JSON.stringify([0, -1]));
    t.eq('變形：沒有框時 Ctrl+Z 救回刪掉的框', JSON.stringify(w.delUndo), JSON.stringify([1, 0]));
    t.eq('變形：有沒套用的修改時切換模式會問，確定就套用', JSON.stringify(w.leave), JSON.stringify([1, 0, 40]));
    t.eq('變形：離開模式後整段一筆 undo', w.leaveUndo, 1);
    t.eq('變形互動：拖曳拉出 4×4 的框', JSON.stringify(w.made), JSON.stringify([1, 4, 4, 32, 32, 4, 25]));
    t.eq('變形互動：Shift 拖曳選點、Ctrl 拖曳／點取消', JSON.stringify(w.sel), JSON.stringify([5, 4, 3]));
    t.eq('變形互動：拖點時 Shift 只沿水平', w.lock, '39,20 39,28 39,36');
    t.eq('變形互動：Shift 方向拖到一半不換，放開再按才重新決定', JSON.stringify(w.relock),
         JSON.stringify(['43,20 43,28 43,36', '43,32 43,40 43,48', '43,38 43,46 43,54']));
    t.eq('變形互動：拖把手調框大小，點等比例跟著', JSON.stringify(w.resize), JSON.stringify([2, 4, 34, 32, 39.1875]));
    t.eq('變形互動：點另一個框切換', JSON.stringify(w.switch), JSON.stringify([2, 0]));
    t.eq('變形：每個框各自 Ctrl+Z／Ctrl+Y，退到底拿掉框', JSON.stringify(w.modeUndo), JSON.stringify([4, 36, 1, 0, 2, 0, 39, 0]));
    t.eq('變形：步驟跟著框寫進 op，重新進來還能退', JSON.stringify(w.persist), JSON.stringify([1, 1, 1]));
    t.eq('變形：重新進來退到沒變形、再拿掉框、再按停住', JSON.stringify(w.persistUndo), JSON.stringify([36, 0, 'warp']));

    const px = await ev(async () => {
        const pd = window.__pd, out = {};
        const $ = (id) => document.getElementById(id);
        const c = document.createElement('canvas'); c.width = c.height = 10;
        c.getContext('2d').fillRect(0, 0, 10, 10);
        const L = pd.addLayer(await createImageBitmap(c), 'px', null, null, null);
        const at = (cv, x, y) => [...cv.getContext('2d').getImageData(x, y, 1, 1).data].join();
        const key = (k, extra = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, ...extra}));
        const cv = $('cv'), rc = cv.getBoundingClientRect();
        const scr = (x, y) => {const w = pd.toWorld(L, x, y), K = pd.S.view.zoom; return {clientX: rc.left + pd.S.view.px + w.x * K, clientY: rc.top + pd.S.view.py + w.y * K, pointerId: 1, button: 0, bubbles: true};};
        const fire = (type, x, y, extra) => cv.dispatchEvent(new PointerEvent(type, {...scr(x, y), ...extra}));
        const stroke = (pts, extra = {}) => {
            fire('pointerdown', ...pts[0], extra);
            for (const p of pts.slice(1)) fire('pointermove', ...p, {buttons: 1, ...extra});
            fire('pointerup', ...pts.at(-1), extra);
        };
        const types = () => L.ops.map(o => o.type).join();
        const {alert, confirm} = window;
        let alerts = 0, asked = 0;
        window.alert = () => {alerts++;};
        window.confirm = () => (asked++, true);

        $('pxPen').checked = true;
        $('pxSize').value = 1;
        $('pxRgb').value = '#ff0000';
        $('pxA').value = 128;
        pd.setMode('pixel');
        pd.S.view.zoom = 10;
        const m = pd.S.mode;
        stroke([[1.5, 1.5], [4.5, 1.5]]);
        out.stroke = [at(m.preview, 2, 1), at(m.preview, 4, 1), at(L.canvas, 2, 1), m.map.size];

        key('e'); key(']');
        stroke([[7.5, 7.5]]);
        out.erase = [$('pxErase').checked, +$('pxSize').value, at(m.preview, 8, 8), at(m.preview, 6, 6), m.map.size];
        stroke([[20, 20]]);
        out.outside = m.hist.length;
        key('z', {ctrlKey: true});
        const u = [m.map.size, at(m.preview, 8, 8)];
        key('y', {ctrlKey: true});
        out.modeUndo = [...u, m.map.size];

        $('pxRgb').value = '#00ff00';
        $('pxA').value = 255;
        stroke([[2.5, 1.5]], {altKey: true});
        out.pick = [$('pxRgb').value, $('colRgb').value, +$('pxA').value, m.map.size];

        const n0 = pd.hist.undos.length;
        pd.applyMode();
        out.apply = [pd.S.mode.type, types(), at(L.canvas, 2, 1), at(L.canvas, 7, 7), pd.hist.undos.length - n0];

        pd.setMode('pixel');
        key('b'); key('[');
        out.resume = pd.S.mode.map.size;
        stroke([[5.5, 5.5]]);
        pd.applyMode();
        out.merged = [types(), L.ops.at(-1).px.length];

        pd.setMode('scale');
        const s1 = pd.S.mode.type;
        pd.setMode('warp');
        out.blocked = [s1, pd.S.mode.type, alerts];

        pd.setMode('crop');
        pd.S.mode.rect = {ax: 0, ay: 0, bx: 6, by: 6};
        pd.applyMode();
        out.crop = [types(), L.canvas.width, at(L.canvas, 2, 1)];
        const {replay} = await import('./pixels.js');
        out.replay = at(replay(L.src, JSON.parse(JSON.stringify(L.ops))), 2, 1) === at(L.canvas, 2, 1);

        pd.setMode('pixel');
        $('pxClear').click();
        out.clear = [pd.S.mode.type, types(), at(L.canvas, 2, 1), pd.S.mode.map.size];
        pd.cancelMode();
        pd.undo();
        out.clearUndo = [types(), at(L.canvas, 2, 1)];

        pd.setMode('pixel');
        stroke([[0.5, 0.5]]);
        pd.setMode('move');
        out.leave = [asked, types(), L.ops.at(-1).px.length];
        pd.undo();
        out.leaveUndo = types();

        L.visible = false;
        pd.setMode('pixel');
        out.hidden = pd.S.mode.type;
        Object.assign(window, {alert, confirm});
        $('pxA').value = 255;
        pd.S.layers.splice(pd.S.layers.indexOf(L), 1);
        return out;
    });
    t.eq('像素：拖曳畫線（取代成色票 RGBA），確定前只改預覽', JSON.stringify(px.stroke), JSON.stringify(['255,0,0,128', '255,0,0,128', '0,0,0,255', 4]));
    t.eq('像素：E 切橡皮擦、] 放大筆刷，2px 筆刷擦成透明', JSON.stringify(px.erase), JSON.stringify([true, 2, '0,0,0,0', '0,0,0,255', 8]));
    t.eq('像素：點在圖外不記筆畫', px.outside, 2);
    t.eq('像素：模式內 Ctrl+Z／Ctrl+Y 一筆一筆', JSON.stringify(px.modeUndo), JSON.stringify([4, '0,0,0,255', 8]));
    t.eq('像素：Alt+點吸 RGB 連 alpha，跟顏色模式共用色票，不算筆畫', JSON.stringify(px.pick), JSON.stringify(['#ff0000', '#ff0000', 128, 8]));
    t.eq('像素：確定寫成一步 paint、一筆 undo', JSON.stringify(px.apply), JSON.stringify(['move', 'paint', '255,0,0,128', '0,0,0,0', 1]));
    t.eq('像素：最後一步是 paint 時接著編輯', px.resume, 8);
    t.eq('像素：再畫併進同一步', JSON.stringify(px.merged), JSON.stringify(['paint', 9]));
    t.eq('像素：有修補時擋下縮放、變形', JSON.stringify(px.blocked), JSON.stringify(['move', 'move', 2]));
    t.eq('像素：裁切放行，照順序疊在後面', JSON.stringify(px.crop), JSON.stringify(['paint,xform', 6, '255,0,0,128']));
    t.check('像素：步驟 JSON 來回後重播結果相同（專案存讀）', px.replay);
    t.eq('像素：清除修補拿掉所有 paint、留在像素模式', JSON.stringify(px.clear), JSON.stringify(['pixel', 'xform', '0,0,0,255', 0]));
    t.eq('像素：清除修補可以 undo', JSON.stringify(px.clearUndo), JSON.stringify(['paint,xform', '255,0,0,128']));
    t.eq('像素：有沒套用的筆畫時切換模式會問，確定就套用', JSON.stringify(px.leave), JSON.stringify([1, 'paint,xform,paint', 1]));
    t.eq('像素：undo 拿掉這次的修補', px.leaveUndo, 'paint,xform');
    t.eq('像素：圖層隱藏時不能進模式', px.hidden, 'move');

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

        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        const kc = document.createElement('canvas'); kc.width = 40; kc.height = 20;
        kc.getContext('2d').fillRect(24, 0, 16, 20);
        const kh = await img.getFileHandle('kit.png', {create: true});
        const kw = await kh.createWritable(); await kw.write(await new Promise(r => kc.toBlob(r))); await kw.close();
        await pd.loadHandle(kh, img, 'img');
        pd.setMode('auto'); pd.applyMode(); pd.cancelMode();
        await saveProj('auto');
        await openProj('auto', 'replace');
        const [AS, AP] = pd.S.layers;
        pd.select(AP);
        pd.setMode('auto');
        out.autoKeep = [pd.S.layers.length, AP.auto?.key, AP.auto?.gid === AS.autoSrc, AS.visible, pd.S.mode.parts?.length, pd.S.mode.src === AS];
        pd.cancelMode();
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
    t.eq('專案：自動拆的關係跟著存讀，重開還能再調', JSON.stringify(p.autoKeep), JSON.stringify([2, 'helmet', true, false, 1, true]));

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

    // 存到 item.json：OPFS 底下建一份假的 public/assets
    const it = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), img = await root.getDirectoryHandle('img');
        const assets = await root.getDirectoryHandle('assets', {create: true});
        const json = await assets.getDirectoryHandle('json', {create: true});
        const tex = await assets.getDirectoryHandle('textures', {create: true});
        const equips = await tex.getDirectoryHandle('equips', {create: true});
        const output = await root.getDirectoryHandle('output', {create: true});
        const items = {
            h1: {cat: 'CAT_HELMET', equip: {sprite: 'hat', scale: 0.25, y: -6, a: 30, aim: 1}, drop: {sprite: 'hat', scale: 0.25}},
            h2: {equip: {sprite: 'cap', scale: 0.25}},
            h3: {equip: {sprite: 'cap', scale: 0.25}},
            x1: {cat: 'CAT_FOOD'},
        };
        const fh = await json.getFileHandle('item.json', {create: true});
        const w = await fh.createWritable(); await w.write(JSON.stringify(items, null, 2)); await w.close();
        const readItems = async () => (await (await json.getFileHandle('item.json')).getFile()).text();
        const has = async (dir, name) => !!await dir.getFileHandle(name).catch(() => null);
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const until = async (f) => {for (let i = 0; i < 100 && !f(); i++) await frame();};
        const open = async () => {
            const p = pd.saveLayer();
            await until(() => $('dlgSave').open);
            await until(() => !$('dlgItem').disabled || $('dlgItemLab').title);
            return {p};
        };
        const rename = async (n) => {$('dlgName').value = n; $('dlgName').dispatchEvent(new Event('input')); await frame();};

        Object.assign(pd.S, {layers: [], active: null, projSig: null, assets: null});
        await pd.loadHandle(await img.getFileHandle('a.png'), img, 'img');
        const L = pd.S.active;
        let {p} = await open();
        out.noAssets = [!$('dlgItemRow').hidden, $('dlgItem').disabled, $('dlgItemLab').title.includes('專案資料夾'), $('dlgName').value];
        $('dlgSave').close('cancel'); await p;

        await pd.setAssets(assets);
        L.name = 'hat';
        L.x = 8; L.y = 0; L.a = 0;
        ({p} = await open());
        await until(() => !$('dlgPath').textContent.endsWith('…'));
        out.def = [$('dlgName').value, $('dlgItem').checked, $('dlgPath').textContent, $('dlgTree').classList.contains('off'), $('dlgItemIds').textContent];
        $('dlgSave').close('ok'); await p;
        const after = JSON.parse(await readItems());
        out.hat = [JSON.stringify(after.h1.equip), JSON.stringify(after.h1.drop), await has(equips, 'hat.png'), await has(equips, 'hat.json'), L.srcPath];
        out.format = (await readItems()) === JSON.stringify(after, null, 2);

        ({p} = await open());
        await rename('nope');
        out.nope = [$('dlgItem').disabled, $('dlgItem').checked, $('dlgItemLab').title, $('dlgPath').textContent];
        $('dlgSave').close('ok'); await p;
        out.nopeSaved = [await has(output, 'nope.png'), await has(output, 'nope.json'), await has(equips, 'nope.png')];

        ({p} = await open());
        await rename('cap');
        const boxes = [...$('dlgItemIds').querySelectorAll('input')];
        out.capBoxes = boxes.map(c => `${c.value}:${c.checked}`).join();
        boxes[1].checked = false;
        $('dlgSave').close('ok'); await p;
        const cap = JSON.parse(await readItems());
        out.cap = [JSON.stringify(cap.h2.equip), JSON.stringify(cap.h3.equip)];

        // 存到 role.json：同一個檔名也配角色的 body/head/hair/hand/corpse
        const roleTxt = JSON.stringify({r1: {kind: 'npc', body: {sprite: 'cap', scale: 0.25, y: 32}, head: {sprite: 'hat2', scale: 0.25}, hand: {sprite: 'cap'}}}, null, 2);
        const rw = await (await json.getFileHandle('role.json', {create: true})).createWritable(); await rw.write(roleTxt); await rw.close();
        const readRoles = async () => (await (await json.getFileHandle('role.json')).getFile()).text();
        await pd.setAssets(assets);
        L.x = 8; L.y = 0;
        ({p} = await open());
        await rename('cap');
        const rb = [...$('dlgItemIds').querySelectorAll('input')];
        out.roleBoxes = rb.map(c => c.value).join();
        rb.filter(c => c.value.endsWith('.equip')).forEach(c => {c.checked = false;});
        const itemsBefore = await readItems();
        $('dlgSave').close('ok'); await p;
        const role = JSON.parse(await readRoles());
        out.role = [JSON.stringify(role.r1.body), JSON.stringify(role.r1.hand), JSON.stringify(role.r1.head), role.r1.kind, (await readRoles()) === JSON.stringify(role, null, 2), (await readItems()) === itemsBefore];
        ({p} = await open());
        await rename('nope');
        out.roleNope = $('dlgItemLab').title;
        $('dlgSave').close('cancel'); await p;
        return out;
    });
    t.eq('item.json：沒選專案資料夾時反灰、提示去上方選、檔名預設 -copy', JSON.stringify(it.noAssets), JSON.stringify([true, true, true, 'a-copy']));
    t.eq('item.json：檔名配對得到時預設勾、存進 textures/equips', JSON.stringify(it.def), JSON.stringify(['hat', true, 'assets/textures/equips', true, 'h1.equip']));
    t.eq('item.json：只改擺放欄位、預設值刪掉、其他不動、不寫 sidecar、原圖不換', JSON.stringify(it.hat),
         JSON.stringify(['{"sprite":"hat","scale":0.25,"y":0,"aim":1,"x":2}', '{"sprite":"hat","scale":0.25}', true, false, 'img/a.png']));
    t.check('item.json：照 2 格縮排重寫', it.format);
    t.eq('item.json：配不到時反灰、說明原因、存到 output', JSON.stringify(it.nope), JSON.stringify([true, false, '沒有 item 的 equip.sprite 跟檔名一樣', 'output']));
    t.eq('item.json：沒勾就存 output 的 PNG＋sidecar', JSON.stringify(it.nopeSaved), JSON.stringify([true, true, false]));
    t.eq('item.json：好幾筆共用 sprite 時列出來各自勾', it.capBoxes, 'h2.equip:true,h3.equip:true');
    t.eq('item.json：只寫有勾的', JSON.stringify(it.cap), JSON.stringify(['{"sprite":"cap","scale":0.25,"x":2,"y":0}', '{"sprite":"cap","scale":0.25}']));
    t.eq('role.json：同檔名的角色部件也列出來', it.roleBoxes, 'h2.equip,h3.equip,r1.body,r1.hand');
    t.eq('role.json：只改勾的部件的擺放、其他不動', JSON.stringify(it.role.slice(0, 4)),
         JSON.stringify(['{"sprite":"cap","scale":0.25,"y":0,"x":2}', '{"sprite":"cap","scale":0.25,"x":2,"y":0}', '{"sprite":"hat2","scale":0.25}', 'npc']));
    t.check('role.json：照 2 格縮排重寫、沒勾 item 就不動 item.json', it.role[4] && it.role[5]);
    t.check('role.json：配不到時說明也提到角色部件', it.roleNope.includes('body/head/hair/hand/corpse'), it.roleNope);

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
    t.eq('縮放的 % 以原圖為 100', JSON.stringify(r.srcPct), JSON.stringify(['25', 32]));
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

    const au = await ev(async () => {
        const pd = window.__pd, out = {};
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200);
        g.fillStyle = '#ffff00'; g.fillRect(20, 20, 50, 50);
        g.fillStyle = '#ff0000'; g.fillRect(120, 30, 60, 40);
        g.fillStyle = '#0000ff'; g.fillRect(10, 90, 80, 80);
        g.fillRect(150, 150, 2, 2);
        g.clearRect(95, 5, 1, 1); g.fillStyle = 'rgba(255,0,0,0.04)'; g.fillRect(95, 5, 1, 1);
        const O = pd.addLayer(await createImageBitmap(c), 'other', null, null, null);
        const S = pd.addLayer(await createImageBitmap(c), 'src', null, null, null);
        const before = pd.S.layers.length, conf = window.confirm;
        const $ = (id) => document.getElementById(id);
        const type = (id, v) => {const e = $(id); e.value = v; e.dispatchEvent(new Event('change'));};
        const find = (n) => pd.S.layers.find(L => L.name === n);
        const px = (L, x, y) => [...L.canvas.getContext('2d').getImageData(x, y, 1, 1).data].join();
        pd.autoSet({helmet: {pct: 50, x: -2, y: 2}});
        out.stored = JSON.parse(localStorage.getItem('paperdoll.auto')).helmet.pct;

        pd.setMode('auto');
        out.enter = [pd.S.mode.type, pd.S.layers.length === before, S.visible, $('modeAuto').querySelector('.ok').disabled];
        pd.autoRevoke();
        out.revokeEarly = [pd.S.mode.type, pd.S.layers.length === before];

        pd.setMode('auto');
        const m = pd.S.mode, n0 = pd.hist.undos.length;
        pd.applyMode();
        const H = find('src-helmet'), A = find('src-armor');
        out.split = [pd.S.mode === m, $('modeAuto').querySelector('.ok').disabled, pd.hist.undos.length - n0, $('au-boots-pct').disabled];
        out.layers = pd.S.layers.slice(before - 1).map(L => L.name).join();
        out.boots = !!find('src-boots');
        out.helmet = [H.canvas.width, H.canvas.height, H.x * pd.S.scale, H.y * pd.S.scale, H.ox, H.oy, px(H, 15, 10), H.ops.map(o => o.type).join()];
        out.armor = [A.canvas.width, A.canvas.height, A.x * pd.S.scale, A.y * pd.S.scale, px(A, 8, 5)];
        out.hidden = [S.visible, pd.S.active === H];
        pd.applyMode();
        out.splitOnce = pd.S.layers.length - before;
        pd.undo();
        out.undoStop = [pd.S.mode === m, !!find('src-helmet'), pd.hist.undos.length - n0];

        const c0 = H.canvas, T = m.T.canvas;
        type('au-helmet-x', 4);
        out.moved = [H.canvas === c0, H.x * pd.S.scale];
        type('au-helmet-pct', 25);
        out.rescaled = [H.canvas.width, m.T.canvas === T, pd.S.mode === m, pd.hist.undos.length - n0, pd.S.auto.helmet.pct];
        pd.undo();
        out.stepUndo = [pd.S.mode === m, H.canvas.width, H.x * pd.S.scale, pd.S.auto.helmet.pct, $('au-helmet-pct').value];
        pd.redo();
        out.stepRedo = [H.canvas.width, pd.S.auto.helmet.pct];
        pd.select(S);
        out.keepMode = pd.S.mode === m;
        pd.select(O);
        out.leaveOther = [pd.S.mode.type, !!find('src-helmet'), pd.hist.undos.length - n0];

        pd.autoSet({...pd.S.auto, helmet: {pct: 40, x: 0, y: 0}});
        pd.select(S);
        pd.setMode('auto');
        const r = pd.S.mode;
        out.resume = [r.type, r.parts?.length, $('au-helmet-pct').value, $('au-helmet-x').value, $('modeAuto').querySelector('.ok').disabled];
        const n1 = pd.hist.undos.length;
        type('au-helmet-x', 6);
        type('au-helmet-y', 3);
        out.resumeUndo = [pd.hist.undos.length - n1, r.hist.length];
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.esc = [pd.S.mode.type, !!find('src-helmet'), H.x * pd.S.scale];
        pd.undo();
        out.resumeUndone = [H.x * pd.S.scale, H.y * pd.S.scale, !!find('src-helmet')];

        // 畫布拖曳：真的派 pointer 事件；cover 疊在頭盔上面，要穿過它抓頭盔
        const cv = $('cv'), rc = cv.getBoundingClientRect();
        const atW = (w) => ({clientX: rc.left + pd.S.view.px + w.x * pd.S.view.zoom, clientY: rc.top + pd.S.view.py + w.y * pd.S.view.zoom, pointerId: 1, button: 0, bubbles: true});
        const fireW = (type, w, extra = {}) => cv.dispatchEvent(new PointerEvent(type, {...atW(w), ...extra}));
        const dragW = (a, b) => {fireW('pointerdown', a); fireW('pointermove', b, {buttons: 1}); fireW('pointerup', b);};
        const arrow = (k, extra = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, ...extra}));
        const cover = pd.addLayer(await createImageBitmap(c), 'cover', null, null, null);
        const h0 = pd.toWorld(H, 7, 1), Hx = H.x;
        pd.setMode('auto');
        out.dragBefore = [pd.S.mode.parts, (dragW(h0, {x: h0.x + 8, y: h0.y}), cover.x)];
        pd.cancelMode();
        pd.select(S);
        pd.setMode('auto');
        const n2 = pd.hist.undos.length;
        dragW(h0, {x: h0.x + 8, y: h0.y + 4});
        const am = pd.S.mode;
        out.drag = [pd.S.mode.type, pd.S.active === H, cover.x, H.x * pd.S.scale, H.y * pd.S.scale, $('au-helmet-x').value, pd.S.auto.helmet.x, am.hist.length];
        arrow('ArrowRight', {shiftKey: true});
        arrow('ArrowUp');
        out.arrow = [H.x * pd.S.scale, H.y * pd.S.scale, $('au-helmet-y').value, pd.S.auto.helmet.x, am.hist.length, pd.hist.undos.length - n2];
        arrow('z', {ctrlKey: true});
        out.arrowUndo = [pd.S.mode === am, H.y * pd.S.scale, pd.S.auto.helmet.y, $('au-helmet-y').value];
        arrow('y', {ctrlKey: true});
        out.arrowRedo = H.y * pd.S.scale;
        const Hx1 = H.x;
        dragW({x: 1000, y: 1000}, {x: 1010, y: 1000});
        H.locked = true;
        dragW(pd.toWorld(H, 7, 1), {x: h0.x + 30, y: h0.y});
        H.locked = false;
        out.dragMiss = [pd.S.mode.type, pd.S.active === H, H.x === Hx1];
        pd.cancelMode();
        pd.undo();
        out.dragUndo = [H.x === Hx, H.y * pd.S.scale];
        pd.removeLayer(cover);

        // 零件拆前後片：mask 插在縮小前面（追線用縮小前的圖），改 scale% 前後片跟著重播、拖曳一起搬
        pd.select(H);
        pd.setMode('split');
        const sm = pd.S.mode;
        sm.poly = {pts: [{x: 0, y: 0}, {x: 30, y: 0}, {x: 30, y: 20}], closed: true};
        out.splitImg = [sm.img.width, sm.img.height];
        pd.applyMode();
        const HF = find('src-helmet-front'), HB = find('src-helmet-back');
        out.autoSplit = [HF.ops.map(o => o.type).join(), HB.canvas.width === H.canvas.width, H.visible];
        pd.select(HF);
        pd.setMode('auto');
        type('au-helmet-pct', 35);
        out.autoSplitScale = [H.canvas.width, HF.canvas.width, HB.canvas.width, HF.ops.map(o => o.type).join()];
        arrow('ArrowRight');
        out.autoSplitMove = [HF.x === H.x, HB.x === H.x];
        type('au-helmet-pct', 25);
        arrow('ArrowLeft');
        pd.cancelMode();
        pd.select(HF); pd.setMode('split'); pd.splitRevoke();
        out.autoSplitRevoke = [!!find('src-helmet-front'), !!find('src-helmet-back'), H.visible];

        H.ops = [...H.ops, {type: 'paint', px: [[0, 0, 0, 255, 0, 255]]}];
        pd.select(H);
        pd.setMode('auto');
        out.paintEnter = pd.S.mode.type;
        window.confirm = () => false;
        type('au-helmet-pct', 30);
        out.paintNo = [H.canvas.width, H.ops.at(-1).type, $('au-helmet-pct').value];
        window.confirm = () => true;
        type('au-helmet-pct', 30);
        out.paintYes = [H.canvas.width, H.ops.map(o => o.type).join()];
        window.confirm = conf;
        pd.cancelMode();

        const ops = H.ops;
        H.ops = [...ops.slice(0, -1), {...ops.at(-1), pct: undefined}];
        pd.setMode('auto');
        out.edited = pd.S.mode.type;
        H.ops = ops;

        pd.setMode('auto');
        pd.autoRevoke();
        out.revoke = [pd.S.mode.type, pd.S.layers.length === before, S.visible, pd.S.active === S];
        pd.undo();
        out.revokeUndo = [pd.S.layers.length - before, S.visible, !!find('src-helmet')];

        pd.select(S);
        pd.setMode('auto');
        type('au-armor-x', 5);
        pd.removeLayer(find('src-armor'));
        out.delPart = [pd.S.mode.type, pd.S.mode.parts?.length];
        pd.undo();
        pd.cancelMode();
        pd.undo();
        out.delNoRevive = [!!find('src-armor'), !!find('src-helmet')];
        pd.select(S);
        pd.setMode('auto');
        pd.removeLayer(find('src-helmet'));
        out.delAll = [pd.S.mode.type, S.visible];
        pd.select(S);
        pd.setMode('auto');
        out.again = [pd.S.mode.type, pd.S.mode.parts];
        pd.cancelMode();

        pd.autoSet(null);
        out.reset = [JSON.parse(localStorage.getItem('paperdoll.auto')).helmet.pct, $('au-helmet-pct').value];
        pd.removeLayer(S);
        pd.removeLayer(O);
        return out;
    });
    t.eq('自動：數字寫進 localStorage', au.stored, 50);
    t.eq('自動：進模式什麼都不動、確定可以按', JSON.stringify(au.enter), JSON.stringify(['auto', true, true, false]));
    t.eq('自動：還沒拆時取消＝離開', JSON.stringify(au.revokeEarly), JSON.stringify(['move', true]));
    t.eq('自動：確定才拆、留在模式、確定反灰、記一筆 undo、空的零件那行反灰', JSON.stringify(au.split), JSON.stringify([true, true, 1, true]));
    t.eq('自動：零件疊在原圖上（由下往上 護甲、頭盔）', au.layers, 'src,src-armor,src-helmet');
    t.check('自動：象限裡只有雜點就略過', !au.boots);
    t.eq('自動：頭盔＝右上的塊去綠裁到剛好再縮放（裁切、縮小分兩步）、x/y 是遊戲單位', JSON.stringify(au.helmet), JSON.stringify([30, 20, -2, 2, 0.5, 1, '255,0,0,255', 'alpha,removeGreen,blobs,xform,xform']));
    t.eq('自動：護甲跨過中線也整塊留下、預設 20%', JSON.stringify(au.armor), JSON.stringify([16, 16, 0.25, 27, '0,0,255,255']));
    t.eq('自動：原圖隱藏、選取頭盔', JSON.stringify(au.hidden), JSON.stringify([false, true]));
    t.eq('自動：拆完再按確定不會再拆', au.splitOnce, 2);
    t.eq('自動：剛拆完 Ctrl+Z 停住、不退拆', JSON.stringify(au.undoStop), JSON.stringify([true, true, 1]));
    t.eq('自動：只改 x 不重新縮放', JSON.stringify(au.moved), JSON.stringify([true, 4]));
    t.eq('自動：改 scale 只重取樣、不重新去綠、模式內不記全域 undo、寫回預設', JSON.stringify(au.rescaled), JSON.stringify([15, true, true, 1, 25]));
    t.eq('自動：模式內 Ctrl+Z 退一步、預設跟著退', JSON.stringify(au.stepUndo), JSON.stringify([true, 30, 4, 50, '50']));
    t.eq('自動：模式內 Ctrl+Y 重做', JSON.stringify(au.stepRedo), JSON.stringify([15, 25]));
    t.check('自動：點原圖不離開模式', au.keepMode);
    t.eq('自動：點別的圖層＝離開、保留零件、調整另記一筆', JSON.stringify(au.leaveOther), JSON.stringify(['move', true, 2]));
    t.eq('自動：選原圖再進來是調整，面板顯示零件的實際值', JSON.stringify(au.resume), JSON.stringify(['auto', 2, '25', '4', true]));
    t.eq('自動：調整中每個修改各一步、離開前不記全域', JSON.stringify(au.resumeUndo), JSON.stringify([0, 2]));
    t.eq('自動：Esc＝離開、保留結果', JSON.stringify(au.esc), JSON.stringify(['move', true, 6]));
    t.eq('自動：undo 退回這次調整', JSON.stringify(au.resumeUndone), JSON.stringify([4, 2, true]));
    t.eq('自動：還沒拆時拖畫布不做事', JSON.stringify(au.dragBefore), JSON.stringify([null, 0]));
    t.eq('自動：拖零件（穿過上面的圖層）、面板跟預設跟著改、一次拖曳一步', JSON.stringify(au.drag), JSON.stringify(['auto', true, 0, 6, 3, '6', 6, 1]));
    t.eq('自動：方向鍵微調（Shift 10px）、每按一下一步', JSON.stringify(au.arrow), JSON.stringify([8.5, 2.75, '2.75', 8.5, 3, 0]));
    t.eq('自動：Ctrl+Z 退一下方向鍵、面板跟預設跟著退', JSON.stringify(au.arrowUndo), JSON.stringify([true, 3, 3, '3']));
    t.eq('自動：Ctrl+Y 重做方向鍵', au.arrowRedo, 2.75);
    t.eq('自動：點空白／鎖定的零件不動、不離開模式', JSON.stringify(au.dragMiss), JSON.stringify(['auto', true, true]));
    t.eq('自動：undo 退回拖曳', JSON.stringify(au.dragUndo), JSON.stringify([true, 2]));
    t.eq('自動：有 paint 的零件可以進來調', au.paintEnter, 'auto');
    t.eq('自動：改 scale 問清除修補，否＝數字退回', JSON.stringify(au.paintNo), JSON.stringify([15, 'paint', '25']));
    t.eq('自動：零件拆前後片：追線用縮小前的圖、mask 插在縮小前面、原圖隱藏', JSON.stringify([au.splitImg, au.autoSplit]), JSON.stringify([[60, 40], ['alpha,removeGreen,blobs,xform,mask,xform', true, false]]));
    t.eq('自動：改 scale% 前後片跟著重播', JSON.stringify(au.autoSplitScale), JSON.stringify([21, 21, 21, 'alpha,removeGreen,blobs,xform,mask,xform']));
    t.eq('自動：方向鍵搬零件，前後片跟著搬', JSON.stringify(au.autoSplitMove), JSON.stringify([true, true]));
    t.eq('自動：撤掉零件的前後片', JSON.stringify(au.autoSplitRevoke), JSON.stringify([false, false, true]));
    t.eq('自動：是＝清掉 paint 再縮放', JSON.stringify(au.paintYes), JSON.stringify([18, 'alpha,removeGreen,blobs,xform,xform']));
    t.eq('自動：零件拆完後改過就擋下', au.edited, 'move');
    t.eq('自動：取消＝刪零件、顯示原圖、選原圖', JSON.stringify(au.revoke), JSON.stringify(['move', true, true, true]));
    t.eq('自動：取消可以 undo', JSON.stringify(au.revokeUndo), JSON.stringify([2, false, true]));
    t.eq('自動：刪部分零件留在模式', JSON.stringify(au.delPart), JSON.stringify(['auto', 1]));
    t.eq('自動：刪掉的零件不會被 undo 復活', JSON.stringify(au.delNoRevive), JSON.stringify([false, true]));
    t.eq('自動：零件刪光就離開、原圖維持隱藏', JSON.stringify(au.delAll), JSON.stringify(['move', false]));
    t.eq('自動：零件刪光後可以再拆', JSON.stringify(au.again), JSON.stringify(['auto', null]));
    t.eq('自動：還原預設', JSON.stringify(au.reset), JSON.stringify([22, '22']));

    // 自動模式的頭盔切線：進模式就追線、確定時一起拆前後片、拆完改切線即時套用
    const ac = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200);
        g.fillStyle = '#a05030'; g.fillRect(110, 10, 80, 80);
        g.strokeStyle = '#000'; g.lineWidth = 3; g.strokeRect(111.5, 11.5, 77, 77);
        g.fillStyle = '#000'; g.fillRect(110, 38, 80, 3); g.fillRect(134, 40, 3, 50);
        const before = pd.S.layers.length;
        const K = pd.addLayer(await createImageBitmap(c), 'kit', null, null, null);
        const find = (n) => pd.S.layers.find(L => L.name === n);
        const slide = (v) => {const e = $('sp-lum'); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change'));};
        const t0 = +$('sp-lum').value;
        pd.setMode('auto');
        const m = pd.S.mode;
        out.pre = [!!m.sp?.poly, $('auSplit').hidden, pd.S.layers.length - before, m.sp.img.width];
        slide(t0 + 30);
        out.preStep = [m.hist.length, m.sp.c.lum];
        pd.undo();
        out.preUndo = [m.sp.c.lum, $('sp-lum').value === String(t0)];
        pd.applyMode();
        const H = find('kit-helmet'), F = find('kit-helmet-front'), B = find('kit-helmet-back');
        out.made = [!!F, !!B, H.visible, pd.S.active === F, F?.ops.map(o => o.type).join(), pd.S.mode === m];
        out.order = [pd.S.layers[0] === B, pd.S.layers.indexOf(F) === pd.S.layers.indexOf(H) + 1];
        const c0 = F.canvas;
        slide(t0 + 30);
        out.after = [m.sp, document.querySelector('[name=auHow]').disabled, $('sp-lum').disabled, F.canvas === c0];
        pd.cancelMode();
        pd.select(F);
        pd.setMode('auto');
        out.resume = [pd.S.mode.type, pd.S.mode.sp];
        pd.autoRevoke();
        out.revoke = [!!find('kit-helmet-front'), !!find('kit-helmet'), !!find('kit-helmet-back')];

        // 不拆：不追線，只拆零件；切回前後片立刻追線
        const how = (v) => {const r = document.querySelector(`[name=auHow][value=${v}]`); r.checked = true; r.dispatchEvent(new Event('change'));};
        how('none');
        pd.select(K);
        pd.setMode('auto');
        const m2 = pd.S.mode;
        out.off = [m2.sp, $('sp-lum').disabled, JSON.parse(localStorage.getItem('paperdoll.auto')).split];
        how('split');
        out.on = !!m2.sp?.poly;
        how('none');
        pd.applyMode();
        out.offMade = [!!find('kit-helmet'), !!find('kit-helmet-front'), !!find('kit-helmet-back')];
        pd.autoRevoke();

        // 挖除：只拆前片，-front 的 mask 帶 cut
        how('cut');
        pd.select(K);
        pd.setMode('auto');
        const m3 = pd.S.mode;
        out.cutPre = [m3.sp?.cut, !!m3.sp?.poly, $('spCutRow').hidden];
        how('split');
        out.cutSwap = [m3.sp.cut, m3.hist.length];
        pd.undo();
        out.cutUndo = [m3.sp.cut, document.querySelector('[name=auHow]:checked').value];
        pd.applyMode();
        const CF = find('kit-helmet-front');
        out.cutMade = [!!CF, !!find('kit-helmet-back'), CF?.ops.find(o => o.type === 'mask')?.split.cut];
        pd.autoRevoke();
        how('split');
        pd.removeLayer(K);
        slide(t0);
        return out;
    });
    t.eq('自動切線：進模式就在原圖頭盔上追線（縮小前的圖）、不建圖層', JSON.stringify(ac.pre), JSON.stringify([true, false, 1, 80]));
    t.eq('自動切線：拆之前改門檻記一步', JSON.stringify(ac.preStep[0]), '1');
    t.eq('自動切線：拆之前 undo 退回門檻', JSON.stringify(ac.preUndo), JSON.stringify([ac.preUndo[0], true]));
    t.eq('自動切線：確定時頭盔一起拆前後片、選前片、留在模式', JSON.stringify(ac.made), JSON.stringify([true, true, false, true, 'alpha,removeGreen,blobs,xform,mask,xform', true]));
    t.eq('自動切線：後片放到最底層、前片疊在頭盔上', JSON.stringify(ac.order), JSON.stringify([true, true]));
    t.eq('自動切線：拆完不再顯示切線、勾選框和門檻反灰、拉門檻不動前後片', JSON.stringify(ac.after), JSON.stringify([null, true, true, true]));
    t.eq('自動切線：選前片再進自動，不帶切線', JSON.stringify(ac.resume), JSON.stringify(['auto', null]));
    t.eq('自動切線：取消自動一起刪前後片', JSON.stringify(ac.revoke), JSON.stringify([false, false, false]));
    t.eq('自動切線：不拆就不追線、記進 localStorage', JSON.stringify(ac.off), JSON.stringify([null, true, 'none']));
    t.eq('自動切線：拆之前切回前後片立刻追線', JSON.stringify(ac.on), 'true');
    t.eq('自動切線：不拆只拆零件', JSON.stringify(ac.offMade), JSON.stringify([true, false, false]));
    t.eq('自動挖除：淹水描外圈、顯示閉運算／往下射', JSON.stringify(ac.cutPre), JSON.stringify([true, true, false]));
    t.eq('自動挖除：切回前後片記一步', JSON.stringify(ac.cutSwap), JSON.stringify([false, 1]));
    t.eq('自動挖除：undo 退回挖除、radio 跟著', JSON.stringify(ac.cutUndo), JSON.stringify([true, 'cut']));
    t.eq('自動挖除：只拆 -front、mask 帶 cut', JSON.stringify(ac.cutMade), JSON.stringify([true, false, true]));

    // 自動只留自己的塊：左上的頭沒人認領，下巴伸進護甲的範圍也不會被裁進去
    const ab = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const type = (id, v) => {const e = $(id); e.value = v; e.dispatchEvent(new Event('change'));};
        const a = (L, x, y) => L.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200);
        g.fillStyle = '#ffff00'; g.fillRect(20, 20, 40, 60);
        g.fillStyle = '#0000ff'; g.fillRect(10, 100, 80, 70); g.fillRect(75, 60, 15, 40);
        const saved = pd.S.auto;
        pd.autoSet({...saved, split: false, armor: {pct: 100, x: 0, y: 0}});
        const K = pd.addLayer(await createImageBitmap(c), 'chin', null, null, null);
        pd.setMode('auto');
        pd.applyMode();
        const A = pd.S.layers.find(L => L.name === 'chin-armor');
        out.made = [pd.S.layers.filter(L => L.auto).map(L => L.auto.key).join(), A.canvas.width, A.canvas.height, A.ops.map(o => o.type).join()];
        out.cut = [a(A, 20, 10), a(A, 70, 10), a(A, 5, 50)];
        pd.cancelMode();
        pd.select(A);
        pd.setMode('auto');
        type('au-armor-pct', 50);
        type('au-armor-pct', 100);
        out.resume = [pd.S.mode.type, a(A, 20, 10), a(A, 70, 10)];
        pd.autoRevoke();
        pd.removeLayer(K);
        pd.autoSet(saved);
        return out;
    });
    t.eq('自動只留自己的塊：左上的頭丟掉、護甲範圍照外接矩形', JSON.stringify(ab.made), JSON.stringify(['armor', 80, 110, 'alpha,removeGreen,blobs,xform,xform']));
    t.eq('自動只留自己的塊：伸進範圍的下巴清成透明、自己的塊留著', JSON.stringify(ab.cut), JSON.stringify([0, 255, 255]));
    t.eq('自動只留自己的塊：再進來改 scale% 照樣只留自己的塊', JSON.stringify(ab.resume), JSON.stringify(['auto', 0, 255]));

    // 左上的頭盔用細線黏著護甲、重心落在左上：侵蝕到斷開再分，護甲不會整塊被丟掉
    const ae = await ev(async () => {
        const pd = window.__pd;
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200);
        g.fillStyle = '#ffff00'; g.fillRect(10, 5, 80, 85); g.fillRect(110, 20, 70, 60);
        g.fillStyle = '#0000ff'; g.fillRect(48, 90, 2, 10); g.fillRect(20, 100, 60, 50); g.fillRect(120, 120, 60, 50);
        const saved = pd.S.auto;
        pd.autoSet({...saved, split: false, armor: {pct: 100, x: 0, y: 0}});
        const K = pd.addLayer(await createImageBitmap(c), 'glued', null, null, null);
        pd.setMode('auto');
        pd.applyMode();
        const A = pd.S.layers.find(L => L.name === 'glued-armor');
        const out = [pd.S.layers.filter(L => L.auto).map(L => L.auto.key).join(), A?.canvas.width, A?.canvas.height <= 60, A?.ops.find(o => o.type === 'blobs').erode];
        pd.autoRevoke();
        pd.removeLayer(K);
        pd.autoSet(saved);
        return out;
    });
    t.eq('自動：左上頭盔黏著護甲時侵蝕分開，護甲留下、侵蝕量記在 blobs', JSON.stringify(ae), JSON.stringify(['boots,armor,helmet', 60, true, 1]));

    // 前後片追線：左線下段的後片那側是開口時，繼續沿線外緣走到底，斜出去的線不會被延伸線切到
    const so = await ev(async () => {
        const pd = window.__pd, out = {};
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        const poly = (pts) => {g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill();};
        g.fillStyle = '#a05030'; g.fillRect(20, 20, 160, 160);
        g.fillStyle = '#000'; g.fillRect(20, 60, 160, 4); g.fillRect(60, 60, 4, 60);
        poly([[60, 120], [64, 120], [84, 180], [80, 180]]);
        g.save(); g.globalCompositeOperation = 'destination-out'; poly([[64, 120], [180, 120], [180, 180], [84, 180]]); g.restore();
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        pd.addLayer(await createImageBitmap(c), 'open', null, null, null);
        pd.setMode('split');
        const m = pd.S.mode;
        m.start = {x: 120, y: 90};
        pd.splitRun(m);
        out.err = m.err;
        pd.applyMode();
        const a = (n, x, y) => pd.S.layers.find(M => M.name === n).canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        out.alpha = [a('open-front', 78, 170), a('open-back', 78, 170), a('open-front', 120, 90), a('open-back', 120, 90)];
        return out;
    });
    t.eq('前後片：後片那側是開口時沿線外緣走到底，斜出去的線整條留給前片', JSON.stringify(so), JSON.stringify({err: null, alpha: [255, 0, 0, 255]}));

    // 自動零件存到 item.json：沿用上面 OPFS 的假 public/assets
    const si = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), assets = await root.getDirectoryHandle('assets');
        const json = await assets.getDirectoryHandle('json'), tex = await assets.getDirectoryHandle('textures');
        const equips = await tex.getDirectoryHandle('equips'), icons = await tex.getDirectoryHandle('icons', {create: true});
        const put = async (dir, name, text) => {const w = await (await dir.getFileHandle(name, {create: true})).createWritable(); await w.write(text); await w.close();};
        const has = async (dir, name) => !!await dir.getFileHandle(name).catch(() => null);
        const items = {
            helmet_01: {cat: 'CAT_HELMET', icon: 'old-hat', equip: {sprite: 'old-hat', scale: 0.25}, drop: {sprite: 'old-hat'}},
            chest_01: {cat: 'CAT_CHESTPLATE', icon: 'src-armor', gold: 5, equip: {sprite: 'src-armor', scale: 0.25}, drop: {sprite: 'src-armor'}},
            boots_01: {cat: 'CAT_BOOTS', equip: {sprite: 'boot'}},
            x1: {cat: 'CAT_FOOD'},
        };
        await put(json, 'item.json', JSON.stringify(items, null, 2));
        for (const n of ['src-armor.png', 'old-hat.png']) await put(equips, n, 'x');
        await put(icons, 'tak.png', 'x');
        const readItems = async () => JSON.parse(await (await (await json.getFileHandle('item.json')).getFile()).text());
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const until = async (f) => {for (let i = 0; i < 100 && !f(); i++) await frame();};
        const set = (id, v) => {const e = $(id); if (e.type === 'checkbox') e.checked = v; else e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' || e.type === 'checkbox' ? 'change' : 'input'));};
        const open = async () => {const p = pd.saveItems(); await until(() => $('dlgItems').open); return {p};};
        const close = async ({p}, v) => {$('dlgItems').close(v); await p;};

        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#00ff00'; g.fillRect(0, 0, 200, 200);
        g.fillStyle = '#ff0000'; g.fillRect(120, 30, 60, 40);
        g.fillStyle = '#0000ff'; g.fillRect(10, 90, 80, 80);
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        pd.addLayer(await createImageBitmap(c), 'src', null, null, null);
        await pd.setAssets(assets);
        pd.setMode('auto');
        out.before = $('auItem').disabled;
        pd.applyMode();
        out.after = $('auItem').disabled;

        let p = await open();
        out.rows = [$('di-helmet-sel').value, $('di-helmet-id').value, $('di-helmet-png').disabled, $('di-armor-sel').value, $('di-armor-name').value,
                    $('di-boots-on').disabled, $('di-helmet-msg').textContent, $('diOk').disabled];
        set('di-helmet-lab', '鐵盔');
        out.labOk = $('diOk').disabled;
        set('di-helmet-name', 'tak');
        out.tak = [$('di-helmet-msg').textContent, $('diOk').disabled];
        set('di-helmet-name', 'src-armor');
        out.dup = $('di-helmet-msg').textContent;
        set('di-helmet-name', 'src-helmet');
        await close(p, 'ok');
        const a = await readItems();
        out.saved = [Object.keys(a).join(), JSON.stringify(a.helmet_02), JSON.stringify(a.chest_01), await has(equips, 'src-helmet.png'), pd.S.mode.type];
        delete a.helmet_02.drop;
        await put(json, 'item.json', JSON.stringify(a, null, 2));

        p = await open();
        out.match = [$('di-helmet-sel').value, $('di-helmet-new').hidden];
        set('di-helmet-png', false);
        out.locked = [$('di-helmet-name').disabled, $('di-helmet-name').value];
        set('di-armor-name', 'new-armor');
        out.rename = $('di-armor-msg').textContent;
        await close(p, 'ok');
        const b = await readItems();
        out.renamed = [JSON.stringify(b.chest_01), await has(equips, 'new-armor.png'), await has(equips, 'src-armor.png')];
        out.dropFill = JSON.stringify(b.helmet_02.drop);

        p = await open();
        set('di-helmet-on', false);
        set('di-armor-sel', '');
        out.newRow = [$('di-armor-name').value, $('di-armor-id').value, $('di-armor-png').checked];
        set('di-armor-lab', '甲');
        set('di-armor-name', 'old-hat');
        out.ask = $('di-armor-msg').textContent;
        const conf = window.confirm;
        let asked = '';
        window.confirm = (s) => {asked = s; return false;};
        const txt = JSON.stringify(await readItems());
        await close(p, 'ok');
        window.confirm = conf;
        out.declined = [asked.includes('equips/old-hat.png'), txt === JSON.stringify(await readItems())];

        await put(json, 'item.json', JSON.stringify({
            'helmet-hvy-1': {cat: 'CAT_HELMET', lab: '盔'},
            'armor-hvy-1': {cat: 'CAT_CHESTPLATE', lab: '甲'},
            'armor-hvy-2': {cat: 'CAT_CHESTPLATE', icon: 'keep', lab: '甲2'},
        }, null, 2));
        p = await open();
        set('di-helmet-sel', 'helmet-hvy-1');
        out.follow = [$('di-armor-sel').value, $('di-armor-icon').checked, $('di-boots-sel').value];
        set('di-armor-sel', 'armor-hvy-2');
        set('di-armor-icon', false);
        set('di-helmet-sel', 'helmet-hvy-1');
        out.manual = $('di-armor-sel').value;
        window.confirm = () => true;
        await close(p, 'ok');
        window.confirm = conf;
        const f = await readItems();
        out.icons = [f['helmet-hvy-1'].icon, f['helmet-hvy-1'].equip.sprite, f['armor-hvy-2'].icon, f['armor-hvy-2'].equip.sprite, !!f['armor-hvy-1'].equip];
        pd.cancelMode();
        return out;
    });
    t.eq('存到 item：拆完才能按', JSON.stringify([si.before, si.after]), JSON.stringify([true, false]));
    t.eq('存到 item：配不到預設新增、帶流水號、新增時 PNG 反灰；配得到就選它；沒零件的列反灰；lab 空的擋存',
         JSON.stringify(si.rows), JSON.stringify(['', 'helmet_02', true, 'chest_01', 'src-armor', true, '要填 lab', true]));
    t.check('存到 item：填了 lab 就能存', !si.labOk);
    t.eq('存到 item：撞到 equips 以外的圖擋存', JSON.stringify(si.tak), JSON.stringify(['textures/icons/tak.png 已經有了，換個檔名', true]));
    t.eq('存到 item：跟別列檔名重複', si.dup, '跟別列檔名重複');
    t.eq('存到 item：新增插在同 cat 後面、頭盔 hideHair、帶 drop；已存在的只改擺放＋drop.scale', JSON.stringify(si.saved), JSON.stringify([
        'helmet_01,helmet_02,chest_01,boots_01,x1',
        '{"cat":"CAT_HELMET","icon":"src-helmet","lab":"鐵盔","equip":{"sprite":"src-helmet","scale":0.25,"x":-2,"y":2,"hideHair":true},"drop":{"sprite":"src-helmet","scale":0.25}}',
        '{"cat":"CAT_CHESTPLATE","icon":"src-armor","gold":5,"equip":{"sprite":"src-armor","scale":0.25,"x":0.25,"y":27},"drop":{"sprite":"src-armor","scale":0.25}}',
        true, 'auto']));
    t.eq('存到 item：存過的下次就配得到', JSON.stringify(si.match), JSON.stringify(['helmet_02', true]));
    t.eq('存到 item：PNG 沒勾時檔名鎖成原本的 sprite', JSON.stringify(si.locked), JSON.stringify([true, 'src-helmet']));
    t.eq('存到 item：改檔名提示 sprite 會換', si.rename, 'sprite：src-armor → new-armor');
    t.eq('存到 item：改檔名連 icon、drop 一起換、舊圖留著', JSON.stringify(si.renamed), JSON.stringify([
        '{"cat":"CAT_CHESTPLATE","icon":"new-armor","gold":5,"equip":{"sprite":"new-armor","scale":0.25,"x":0.25,"y":27},"drop":{"sprite":"new-armor","scale":0.25}}', true, true]));
    t.eq('存到 item：只勾更新設定時沒有 drop 就補上（sprite 照 equip）', si.dropFill, '{"sprite":"src-helmet","scale":0.25}');
    t.eq('存到 item：切成新增時檔名回到圖層名、PNG 強制勾', JSON.stringify(si.newRow), JSON.stringify(['src-armor', 'chest_02', true]));
    t.eq('存到 item：覆蓋別人的圖要提示', si.ask, '會覆蓋 equips/old-hat.png（helmet_01 也用這張）');
    t.eq('存到 item：存檔時 confirm 覆蓋、取消就不寫', JSON.stringify(si.declined), JSON.stringify([true, true]));
    t.eq('存到 item：選了 <部位>-<系>-<階> 其他有零件的列帶到同系同階、更新ICON 預設勾', JSON.stringify(si.follow), JSON.stringify(['armor-hvy-1', true, '']));
    t.eq('存到 item：手動選過的列不被別列帶走', si.manual, 'armor-hvy-2');
    t.eq('存到 item：更新ICON 勾了補上空的 icon、沒勾就不動', JSON.stringify(si.icons), JSON.stringify(['src-helmet', 'src-helmet', 'keep', 'src-armor', false]));

    const th = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('th', {create: true});
        const put = async (draw) => {
            const c = document.createElement('canvas'); c.width = c.height = 100; draw(c.getContext('2d'));
            const w = await (await dir.getFileHandle('x.png', {create: true})).createWritable(); await w.write(await new Promise(r => c.toBlob(r))); await w.close();
        };
        const until = (f) => new Promise(r => {const n = Date.now(), k = () => f() || Date.now() - n > 3000 ? r(f()) : requestAnimationFrame(k); k();});
        const px = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].join();
        await put(g => {g.fillStyle = '#f00'; g.fillRect(80, 80, 10, 10);});
        await pd.setRoot(root);
        (await until(() => [...$('tree').querySelectorAll('.row.dir')].find(r => r.title === 'th'))).click();
        const c = await until(() => $('tree').querySelector('canvas.thumb')?.loaded && $('tree').querySelector('canvas.thumb'));
        out.trim = c ? [px(c, 0, 0), px(c, 31, 31)] : null;
        await new Promise(r => setTimeout(r, 20));
        await put(g => {g.fillStyle = '#00f'; g.fillRect(0, 0, 100, 100);});
        await pd.refreshThumbs();
        out.update = c && px(c, 0, 0);
        out.projSpacer = !!$('tree').querySelector('.row.proj span.thumb');
        const b = $('splitL').getBoundingClientRect();
        out.bar = [b.x + b.width / 2, b.y + b.height / 2];
        return out;
    });
    t.eq('縮圖：裁掉透明邊再縮', JSON.stringify(th.trim), JSON.stringify(['255,0,0,255', '255,0,0,255']));
    t.eq('縮圖：檔案改了重產', th.update, '0,0,255,255');
    t.check('縮圖：專案檔留同寬空位', th.projSpacer);

    // images/ 有變動：vite 推 'tools:images'，這裡直接呼叫處理函式（工作資料夾是 OPFS）
    const tw = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('th');
        const png = async (d, name) => {
            const c = document.createElement('canvas'); c.width = c.height = 4;
            const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(await new Promise(r => c.toBlob(r))); await w.close();
        };
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const names = (path) => [...$('tree').querySelector(`.tdir[data-path="${path}"]`).lastChild.children].map(k => k.classList.contains('tdir') ? `[${k.dataset.name}]` : k.title).join();
        const sub = await dir.getDirectoryHandle('sub', {create: true});
        await png(dir, 'y.png');
        out.before = names('th');
        await pd.imagesChanged({dirs: ['th']});
        out.added = names('th');
        [...$('tree').querySelectorAll('.row.dir')].find(r => r.title === 'sub').click();
        for (let i = 0; i < 10; i++) await frame();
        await png(sub, 'z.png');
        await dir.removeEntry('y.png');
        await pd.imagesChanged({dirs: ['TH', 'th/sub', 'nope']});
        out.removed = [names('th'), names('th/sub'), !$('tree').querySelector('.tdir[data-path="th/sub"]').lastChild.hidden];
        await dir.removeEntry('sub', {recursive: true});
        await pd.imagesChanged({dirs: ['th']});
        out.gone = names('th');
        return out;
    });
    t.eq('檔案變動：重列前看不到新檔', tw.before, 'x.png');
    t.eq('檔案變動：重列展開中的資料夾，新資料夾、新檔出現', tw.added, '[sub],x.png,y.png');
    t.eq('檔案變動：刪檔消失、子資料夾維持展開並重列、路徑不分大小寫', JSON.stringify(tw.removed), JSON.stringify(['[sub],x.png', 'z.png', true]));
    t.eq('檔案變動：資料夾刪掉就拿掉', tw.gone, 'x.png');

    // 檔案樹右鍵：改名／刪除（png 連同名 .json、專案引用、開著的圖層跟著動）
    const fm = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('rn', {create: true});
        const put = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const c = document.createElement('canvas'); c.width = c.height = 4;
        const png = await new Promise(r => c.toBlob(r));
        await put(dir, 'a.png', png);
        await put(dir, 'b.png', png);
        await put(dir, 'a.json', '{}');
        await put(root, 'p.pdproj.json', JSON.stringify({version: 1, layers: [{name: 'a', src: 'rn/a.png', srcW: 4, srcH: 4, path: 'rn', ops: [], x: 0, y: 0, a: 0, ox: 0.5, oy: 1, visible: true, opacity: 1, locked: false}]}));
        const files = async (d) => {const n = []; for await (const k of d.keys()) n.push(k); return n.sort().join();};
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const until = async (f) => {for (let i = 0; i < 100 && !f(); i++) await frame(); return f();};
        const row = (name) => [...$('tree').querySelectorAll('.row.file')].find(r => r.title === name);
        const menu = (name, label) => {
            row(name).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: 10, clientY: 10}));
            const items = [...document.querySelectorAll('.ctx div')];
            out.menu = items.map(d => d.textContent).join();
            items.find(d => d.textContent === label).click();
        };
        const key = (inp, k) => inp.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true}));
        const log = [], {confirm} = window;
        window.confirm = (m) => {log.push(m); return confirm.call(window, m);};
        const title = () => new Promise(r => requestAnimationFrame(() => r($('projName').textContent)));

        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        await pd.setRoot(root);
        out.projIcon = (await until(() => row('p.pdproj.json')))?.querySelector('span.thumb').textContent;
        [...$('tree').querySelectorAll('.row.dir')].find(r => r.title === 'rn').click();
        await until(() => row('a.png'));
        await pd.loadHandle(await dir.getFileHandle('a.png'), dir, 'rn');
        const L = pd.S.active;

        menu('a.png', '改名');
        let inp = row('a.png').querySelector('input');
        out.edit = inp?.value;
        inp.value = 'zz';
        key(inp, 'Escape');
        out.esc = [!row('a.png').querySelector('input'), row('a.png').querySelector('.name').textContent, await files(dir)];

        menu('a.png', '改名');
        inp = row('a.png').querySelector('input');
        inp.value = 'c';
        key(inp, 'Enter');
        await until(() => row('c.png'));
        await until(() => $('status').textContent.startsWith('已改名'));
        const p = JSON.parse(await (await (await root.getFileHandle('p.pdproj.json')).getFile()).text());
        out.renamed = [await files(dir), p.layers[0].src, L.srcPath, L.name, $('status').textContent.includes('p.pdproj.json')];

        await pd.renameFile({fh: await dir.getFileHandle('c.png'), dir, path: 'rn', node: {reload: async () => {}}}, 'b');
        out.clash = [await files(dir), $('status').textContent];
        await pd.renameFile({fh: await dir.getFileHandle('c.png'), dir, path: 'rn', node: {reload: async () => {}}}, 'x:y');
        out.bad = $('status').textContent;

        const rootNode = $('tree').querySelector('.tdir');
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        await pd.openProject(await root.getFileHandle('p.pdproj.json'), root, '');
        await pd.renameFile({fh: await root.getFileHandle('p.pdproj.json'), dir: root, path: '', node: rootNode}, 'q');
        out.projRename = [!!await root.getFileHandle('q.pdproj.json').catch(() => null), pd.S.layers[0].proj?.name, await title()];
        log.length = 0;
        await pd.deleteFile({fh: await root.getFileHandle('q.pdproj.json'), dir: root, path: '', node: rootNode});
        out.projDelete = [!!await root.getFileHandle('q.pdproj.json').catch(() => null), pd.S.layers[0].proj, await title()];
        await put(root, 'p.pdproj.json', JSON.stringify(p));

        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        await pd.loadHandle(await dir.getFileHandle('c.png'), dir, 'rn');
        const M = pd.S.active;
        log.length = 0;
        menu('c.png', '刪除');
        await until(() => !row('c.png'));
        out.deleted = [await files(dir), log[0]?.includes('c.json'), log[0]?.includes('p.pdproj.json'), M.srcPath ?? null];
        window.confirm = confirm;
        await root.removeEntry('rn', {recursive: true});
        await root.removeEntry('p.pdproj.json');
        return out;
    });
    t.eq('檔案樹：專案檔前面是 🧩', fm.projIcon, '🧩');
    t.eq('右鍵選單：改名、刪除', fm.menu, '改名,刪除');
    t.eq('改名：原地編輯不含副檔名', fm.edit, 'a');
    t.eq('改名：Esc 取消不動檔案', JSON.stringify(fm.esc), JSON.stringify([true, 'a.png', 'a.json,a.png,b.png']));
    t.eq('改名：連同名 json、專案 src、開著的圖層 srcPath／名稱一起改', JSON.stringify(fm.renamed), JSON.stringify(['b.png,c.json,c.png', 'rn/c.png', 'rn/c.png', 'c', true]));
    t.eq('改名：撞名拒絕', JSON.stringify(fm.clash), JSON.stringify(['b.png,c.json,c.png', 'rn/b.png 已經存在，沒有改名']));
    t.eq('改名：不合法檔名拒絕', fm.bad, '檔名不合法：「x:y」');
    t.eq('改名專案：檔案改名、開著的圖層歸屬跟著改', JSON.stringify(fm.projRename), JSON.stringify([true, 'q', 'q']));
    t.eq('刪除專案：圖層保留、脫鉤、標未存', JSON.stringify(fm.projDelete), JSON.stringify([false, null, '（未命名） *']));
    t.eq('刪除 png：連 json 刪、確認列出引用的專案、開著的圖層清掉 srcPath', JSON.stringify(fm.deleted), JSON.stringify(['b.png', true, true, null]));
    const [bx, by] = th.bar;
    await t.page.mouse.move(bx, by);
    await t.page.mouse.down();
    await t.page.mouse.move(bx + 100, by, {steps: 5});
    await t.page.mouse.up();
    const dragged = await ev(() => [document.getElementById('left').offsetWidth, localStorage.getItem('paperdoll.leftW')]);
    await t.page.mouse.click(bx + 100, by, {clickCount: 2});
    const reset = await ev(() => document.getElementById('left').offsetWidth);
    t.eq('分隔線：拖曳改寬並記住、雙擊還原', JSON.stringify([...dragged, reset]), JSON.stringify([330, '330', 230]));

    // 前後片：橫線（帽帶）跟直線（耳罩）圍起來的右下塊是後片；沿用上面 OPFS 的假 public/assets
    const sp = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), assets = await root.getDirectoryHandle('assets');
        const json = await assets.getDirectoryHandle('json'), equips = await (await assets.getDirectoryHandle('textures')).getDirectoryHandle('equips');
        const put = async (dir, name, text) => {const w = await (await dir.getFileHandle(name, {create: true})).createWritable(); await w.write(text); await w.close();};
        const has = async (dir, name) => !!await dir.getFileHandle(name).catch(() => null);
        const readItems = async () => JSON.parse(await (await (await json.getFileHandle('item.json')).getFile()).text());
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const until = async (f) => {for (let i = 0; i < 100 && !f(); i++) await frame();};
        const c = document.createElement('canvas'); c.width = c.height = 200;
        const g = c.getContext('2d');
        g.fillStyle = '#a05030'; g.fillRect(20, 20, 160, 160);
        g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(22, 22, 156, 156);
        g.fillStyle = '#000'; g.fillRect(20, 78, 160, 4); g.fillRect(68, 80, 4, 100);
        g.fillRect(5, 5, 1, 1); g.fillRect(194, 194, 1, 1);
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        const L = pd.addLayer(await createImageBitmap(c), 'hood', null, null, null);
        const a = (M, x, y) => M.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const probe = [[120, 120], [100, 50], [100, 80], [70, 120], [40, 120], [74, 84]];
        const bits = (M) => probe.map(([x, y]) => a(M, x, y) > 128 ? 1 : 0).join('');

        pd.setMode('split');
        const m = pd.S.mode;
        out.enter = [m.type, m.err, m.start.x, m.start.y, !!m.poly];
        m.start = {x: 100, y: 80};
        pd.splitRun(m);
        out.onLine = [m.err?.includes('輪廓線上'), m.poly];
        m.start = {x: 100, y: 100};
        pd.splitRun(m);
        pd.applyMode();
        const find = (n) => pd.S.layers.find(M => M.name === n);
        const F = find('hood-front'), B = find('hood-back');
        out.layers = [pd.S.layers.map(M => M.name).join(), L.visible, pd.S.active === F, L.ops.length];
        out.same = [F.canvas.width, B.canvas.width, L.canvas.width, B.x === L.x && F.x === L.x && B.y === L.y];
        out.bits = [bits(F), bits(B), bits(L)];
        const grp = pd.splitGroup(B);
        out.group = grp?.O === L && grp.F === F && pd.splitGroup(L)?.B === B;
        out.replay = JSON.stringify(JSON.parse(JSON.stringify(F.ops))) === JSON.stringify(F.ops);

        const n = F.ops.at(-1).pts.length;
        pd.select(B); pd.setMode('split');
        out.resume = [pd.S.mode.layer === L, pd.S.mode.poly.pts.length === n, $('spRevoke').disabled];
        pd.cancelMode();
        out.cancel = [a(F, 120, 120), F.ops.length, pd.S.mode.type];
        pd.undo();
        out.undo = [pd.S.layers.map(M => M.name).join(), L.visible];
        pd.redo();
        out.redo = [pd.S.layers.length, L.visible];

        // 擺放連動：改任一層的 x，三層一起改、一起 undo
        pd.select(F);
        $('pX').value = 5; $('pX').dispatchEvent(new Event('change'));
        out.linked = [L.x, B.x, F.x].map(v => v * (pd.S.applyScale ? pd.S.scale : 1));
        pd.undo();
        out.linkedUndo = [L.x, B.x, F.x];

        await put(json, 'item.json', JSON.stringify({hd: {cat: 'CAT_HELMET', icon: 'hood', equip: {sprite: 'hood', scale: 0.25}, drop: {sprite: 'hood'}}}, null, 2));
        const save = async (icon = true) => {
            const p = pd.saveLayer();
            await until(() => $('dlgSave').open);
            await until(() => !$('dlgItem').disabled);
            const tags = $('dlgItemIds').textContent;
            out.iconRow = [!$('dlgIconRow').hidden, $('dlgIcon').checked];
            $('dlgIcon').checked = icon;
            $('dlgSave').close('ok');
            await p;
            return tags;
        };
        const alert = window.alert;
        let said = '';
        window.alert = (s) => {said = s;};
        pd.select(F);
        out.tags = await save();
        const it = (await readItems()).hd;
        out.saved = [JSON.stringify(it), await has(equips, 'hood.png'), await has(equips, 'hood-front.png'), await has(equips, 'hood-back.png')];
        await put(json, 'item.json', JSON.stringify({hd: {...it, icon: 'custom'}}, null, 2));
        pd.select(B);
        out.again = await save(false);
        out.keepIcon = [...out.iconRow, (await readItems()).hd.icon];

        // 原圖改過尺寸：存檔擋下；重進前後片模式重新追線、前後片跟著原圖重產
        pd.trimLayer(L);
        said = '';
        await save();
        out.stale = said;
        pd.select(L); pd.setMode('split');
        const rm = pd.S.mode;
        out.retrace = [rm.img.width, rm.start.x !== 100 || rm.start.y !== 100];
        rm.start = {x: 95, y: 95};
        pd.splitRun(rm);
        pd.applyMode();
        out.resplit = [F.canvas.width === L.canvas.width, B.canvas.width === L.canvas.width, F.x === L.x, pd.S.layers.length];
        pd.undo();
        pd.undo();

        pd.select(L); pd.setMode('split'); pd.splitRevoke();
        out.revoke = [pd.S.layers.map(M => M.name).join(), L.visible, pd.S.mode.type, pd.S.active === L];
        await save();
        out.unsplit = JSON.stringify((await readItems()).hd);
        pd.undo();
        out.revokeUndo = [pd.S.layers.length, L.visible];
        window.alert = alert;

        // 舊格式（前片就是原圖、split 沒有 w）不認
        const Q = pd.addLayer(await createImageBitmap(c), 'old', null, null, null);
        Q.ops = [{type: 'mask', pts: [[0, 0], [10, 0], [10, 10]], keep: false, split: {gid: 'old', x: 0, y: 0, t: 24}}];
        pd.setMode('split');
        out.old = pd.S.mode.type;
        pd.removeLayer(Q);
        return out;
    });
    t.eq('前後片：進模式就追線，起點是中央那一直行上、線圍起來那段的中點', JSON.stringify(sp.enter), JSON.stringify(['split', null, 100, 128, true]));
    t.eq('前後片：起點在線上時報錯、沒有多邊形', JSON.stringify(sp.onLine), JSON.stringify([true, null]));
    t.eq('前後片：三層（-back 在最底層、原圖、-front），原圖隱藏、步驟不動、選前片', JSON.stringify(sp.layers), JSON.stringify(['hood-back,hood,hood-front', false, true, 0]));
    t.eq('前後片：三層同尺寸同位置', JSON.stringify(sp.same), JSON.stringify([200, 200, 200, true]));
    t.eq('前後片：右下塊歸後片、線（帽帶、耳罩）留給前片、原圖完整', JSON.stringify(sp.bits), JSON.stringify(['011110', '100001', '111111']));
    t.check('前後片：三層互相認得', sp.group);
    t.check('前後片：步驟 JSON 來回不變（專案存讀）', sp.replay);
    t.eq('前後片：選後片再進來＝調原圖、帶回多邊形、可以撤掉', JSON.stringify(sp.resume), JSON.stringify([true, true, false]));
    t.eq('前後片：取消＝前後片不動', JSON.stringify(sp.cancel), JSON.stringify([0, 1, 'move']));
    t.eq('前後片：一次 undo 拿掉前後片、原圖重新顯示', JSON.stringify(sp.undo), JSON.stringify(['hood', true]));
    t.eq('前後片：redo', JSON.stringify(sp.redo), JSON.stringify([3, false]));
    t.eq('前後片：擺放三層連動', JSON.stringify(sp.linked), JSON.stringify([5, 5, 5]));
    t.eq('前後片：連動一起 undo', JSON.stringify(sp.linkedUndo), JSON.stringify([0, 0, 0]));
    t.eq('前後片存檔：選前片也配得到原圖名的 item', sp.tags, 'hd.equip');
    t.eq('前後片存檔：三張 PNG 一起寫，sprite 指前片、back 指後片、icon／drop 是原圖', JSON.stringify(sp.saved), JSON.stringify([
        '{"cat":"CAT_HELMET","icon":"hood","equip":{"sprite":"hood-front","scale":0.25,"x":0,"y":0,"back":"hood-back"},"drop":{"sprite":"hood","scale":0.25}}', true, true, true]));
    t.eq('前後片存檔：sprite 換成 -front 後再存還配得到', sp.again, 'hd.equip');
    t.eq('存到遊戲資料：更新ICON 預設勾、取消就不動 icon', JSON.stringify(sp.keepIcon), JSON.stringify([true, true, 'custom']));
    t.eq('前後片存檔：原圖改過尺寸就擋', sp.stale, '沒有存檔：hood 跟 hood-front 尺寸不一樣（原圖改過，先到「前後片」按確定更新）');
    t.eq('前後片：原圖尺寸變了重進＝重新追線', JSON.stringify(sp.retrace), JSON.stringify([190, true]));
    t.eq('前後片：重拆照原圖現在的樣子重產前後片', JSON.stringify(sp.resplit), JSON.stringify([true, true, true, 3]));
    t.eq('前後片：撤掉＝刪前後片、原圖重新顯示並選取、離開模式', JSON.stringify(sp.revoke), JSON.stringify(['hood', true, 'move', true]));
    t.eq('前後片存檔：沒拆的原圖存檔把 sprite 換回、拿掉 back', sp.unsplit, '{"cat":"CAT_HELMET","icon":"hood","equip":{"sprite":"hood","scale":0.25,"x":0,"y":0},"drop":{"sprite":"hood","scale":0.25}}');
    t.eq('前後片：撤掉可以 undo', JSON.stringify(sp.revokeUndo), JSON.stringify([3, false]));
    t.eq('前後片：舊格式不認、不進模式', sp.old, 'move');

    // 色塊＋亮度門檻＋挖除：紅色上線／下線（亮度 57）、黑色左線，亮度 24 抓不到紅線、60 抓得到；沿用上面 OPFS 的假 public/assets
    const cu = await ev(async () => {
        const pd = window.__pd, out = {}, $ = (id) => document.getElementById(id);
        const root = await navigator.storage.getDirectory(), assets = await root.getDirectoryHandle('assets');
        const json = await assets.getDirectoryHandle('json'), equips = await (await assets.getDirectoryHandle('textures')).getDirectoryHandle('equips');
        const put = async (dir, name, text) => {const w = await (await dir.getFileHandle(name, {create: true})).createWritable(); await w.write(text); await w.close();};
        const has = async (dir, name) => !!await dir.getFileHandle(name).catch(() => null);
        const frame = () => new Promise(r => requestAnimationFrame(r));
        const until = async (f) => {for (let i = 0; i < 100 && !f(); i++) await frame();};
        const fire = (id, ev, set) => {const e = $(id); set(e); e.dispatchEvent(new Event(ev));};
        const radio = (v) => {const r = document.querySelector(`[name=spHow][value=${v}]`); r.checked = true; r.dispatchEvent(new Event('change'));};
        const method = (v) => {const r = document.querySelector(`[name=spMethod][value=${v}]`); r.checked = true; r.dispatchEvent(new Event('change'));};
        const draw = (bottom) => {
            const c = document.createElement('canvas'); c.width = c.height = 200;
            const g = c.getContext('2d');
            g.fillStyle = '#a05030'; g.fillRect(20, 20, 160, 160);
            g.fillStyle = '#c00000'; g.fillRect(20, 60, 160, 4);
            if (bottom) g.fillRect(20, 140, 160, 4);
            g.fillStyle = '#000'; g.fillRect(60, 60, 4, 120);
            return createImageBitmap(c);
        };
        const a = (M, x, y) => M.canvas.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const saved = JSON.stringify(pd.S.sp);
        Object.assign(pd.S, {layers: [], active: null, projSig: null});
        const L = pd.addLayer(await draw(true), 'visor', null, null, null);
        fire('sp-lum', 'input', e => {e.value = 24;}); fire('sp-lum', 'change', () => {});
        fire('sp-close', 'change', e => {e.value = 10;});
        fire('sp-drop', 'change', e => {e.value = 20;});
        fire('sp-right', 'change', e => {e.checked = false;});
        radio('split');
        pd.setMode('split');
        const m = pd.S.mode;
        m.start = {x: 120, y: 100};
        pd.splitRun(m);
        out.lumOnly = !!m.err;

        // 移動滑鼠：色塊跟 (R,G,B,A) 即時顯示游標底下的顏色，離開畫布清空
        const w = pd.toWorld(m.view, 100.5, 61.5);
        const cv = $('cv'), rc = cv.getBoundingClientRect(), K = pd.S.view.zoom;
        const at = (p) => ({clientX: rc.left + pd.S.view.px + p.x * K, clientY: rc.top + pd.S.view.py + p.y * K, bubbles: true});
        cv.dispatchEvent(new PointerEvent('pointermove', at(w)));
        out.hover = [$('spRgba').textContent, $('spSwatch').classList.contains('empty')];
        cv.dispatchEvent(new PointerEvent('pointermove', at(pd.toWorld(m.view, 5.5, 5.5))));
        out.hoverClear = [$('spRgba').textContent, $('spSwatch').classList.contains('empty')];
        cv.dispatchEvent(new PointerEvent('pointerleave'));
        out.leave = $('spRgba').textContent;

        // -／+：一下記一步、重新追線；按住只記一步
        const step = (d, n = 1) => {
            const b = document.querySelector(`.spStep[data-d="${d}"]`);
            b.dispatchEvent(new PointerEvent('pointerdown', {button: 0}));
            for (let i = 1; i < n; i++) pd.spStep(d);
            b.dispatchEvent(new PointerEvent('pointerup'));
        };
        const h0 = m.hist.length;
        step(1);
        step(-1, 3);
        out.step = [pd.S.sp.lum.trace, m.c.lum, m.hist.length - h0, $('sp-lum-v').textContent];

        // 亮度 < 60：紅線（57）、黑線都算線，棕色（100）不算
        fire('sp-lum', 'input', e => {e.value = 60;}); fire('sp-lum', 'change', () => {});
        out.lum60 = [m.err, m.c];

        // 挖除＝魔術棒：停在下線，下線外 20px 內沒透明不往下挖；切到挖除帶魔術棒＋下、關掉右
        fire('sp-right', 'change', e => {e.checked = true;});
        radio('cut');
        out.preset = [m.method, m.down, m.right, $('sp-right').checked, document.querySelector('[name=spMethod]:checked').value];
        // 亮度依切割方法各存一份：魔術棒設 61，切回沿線是剛剛的 60
        fire('sp-lum', 'input', e => {e.value = 61;}); fire('sp-lum', 'change', () => {});
        method('trace');
        out.lumSep = [$('sp-lum').value, m.c.lum];
        method('wand');
        out.lumSep.push($('sp-lum').value, m.c.lum, pd.S.sp.lum);
        out.cutUi = [m.cut, $('spCutRow').hidden, m.err];
        pd.applyMode();
        const F = pd.S.layers.find(M => M.name === 'visor-front');
        out.layers = [pd.S.layers.map(M => M.name).join(), L.visible, pd.S.active === F];
        const probe = [[120, 100], [120, 150], [120, 141], [120, 62], [40, 100], [62, 100]];
        out.bits = probe.map(([x, y]) => a(F, x, y) > 128 ? 1 : 0).join('');
        const grp = pd.splitGroup(F);
        out.group = [grp.cut, grp.B, grp.O === L];

        // 再進來＝帶回挖除；下 50px＝碰到圖底的透明，挖到底
        pd.select(F); pd.setMode('split');
        const m2 = pd.S.mode;
        out.resume = [m2.cut, document.querySelector('[name=spHow]:checked').value, $('spCutRow').hidden, m2.close, m2.drop];
        fire('sp-drop', 'change', e => {e.value = 50;});
        out.overStep = m2.hist.length;
        const maxY = () => Math.max(...m2.poly.pts.map(p => p.y));
        fire('sp-down', 'change', e => {e.checked = false;});
        out.downOff = [maxY(), m2.hist.length, pd.S.sp.drop];
        fire('sp-down', 'change', e => {e.checked = true;});
        out.downOn = maxY();
        fire('sp-right', 'change', e => {e.checked = true;});
        fire('sp-reach', 'change', e => {e.value = 7;});
        out.rightOn = [m2.right, m2.reach, m2.hist.length];
        fire('sp-right', 'change', e => {e.checked = false;});
        pd.applyMode();
        out.overBits = probe.map(([x, y]) => a(F, x, y) > 128 ? 1 : 0).join('');

        // 存到 item：sprite 指 -front、沒有 back、icon／drop 是原圖、不寫 -back.png
        await put(json, 'item.json', JSON.stringify({vs: {cat: 'CAT_HELMET', icon: 'visor', equip: {sprite: 'visor', scale: 0.25}, drop: {sprite: 'visor'}}}, null, 2));
        const p = pd.saveLayer();
        await until(() => $('dlgSave').open);
        await until(() => !$('dlgItem').disabled);
        $('dlgSave').close('ok');
        await p;
        const it = JSON.parse(await (await (await json.getFileHandle('item.json')).getFile()).text()).vs;
        out.saved = [JSON.stringify(it), await has(equips, 'visor-front.png'), await has(equips, 'visor-back.png')];

        // 挖除→前後片：補回 -back
        pd.select(L); pd.setMode('split');
        radio('split');
        pd.applyMode();
        out.toSplit = [pd.S.layers.map(M => M.name).join(), pd.splitGroup(L).cut];
        pd.undo();
        out.toSplitUndo = pd.S.layers.map(M => M.name).join();

        // 下面沒有線：淹到圖底，外圈是剛好貼著格子邊的矩形
        pd.removeLayer(F); pd.removeLayer(L);
        const N = pd.addLayer(await draw(false), 'open2', null, null, null);
        radio('cut');
        pd.setMode('split');
        const m3 = pd.S.mode;
        m3.start = {x: 120, y: 100};
        pd.splitRun(m3);
        out.noLine = [m3.err, m3.poly.pts.map(p => `${p.x},${p.y}`).sort().join(' ')];
        pd.cancelMode();
        pd.removeLayer(N);

        // 存成跟切割分開：前後片＋魔術棒（選到的那塊變後片）、挖除＋沿線（右下整塊挖空）；手動改切法不動存成
        fire('sp-drop', 'change', e => {e.value = 20;});
        const V = pd.addLayer(await draw(true), 'combo', null, null, null);
        pd.setMode('split');
        const m4 = pd.S.mode;
        radio('split');
        out.splitPreset = m4.method;
        method('wand');
        m4.start = {x: 120, y: 100};
        pd.splitRun(m4);
        out.manual = [m4.cut, m4.method, document.querySelector('[name=spHow]:checked').value, $('spCutRow').hidden];
        pd.applyMode();
        const F4 = pd.S.layers.find(M => M.name === 'combo-front'), B4 = pd.S.layers.find(M => M.name === 'combo-back');
        const mk = () => F4.ops.find(o => o.type === 'mask').split;
        out.splitWand = [a(F4, 120, 100), a(B4, 120, 100), a(F4, 120, 150), a(B4, 120, 150), mk().method, mk().close];
        pd.select(F4); pd.setMode('split');
        const m5 = pd.S.mode;
        out.resumeWand = [m5.cut, m5.method];
        radio('cut');
        method('trace');
        out.cutTraceUi = [m5.cut, m5.method, $('spCutRow').hidden];
        pd.applyMode();
        out.cutTrace = [pd.S.layers.map(M => M.name).join(), [[120, 100], [120, 150], [120, 62], [40, 100]].map(([x, y]) => a(F4, x, y) > 128 ? 1 : 0).join(''),
                        mk().method, 'close' in mk()];
        // 舊資料沒有 method：挖除而且有 close 當魔術棒，其他當沿線
        delete mk().method;
        pd.select(F4); pd.setMode('split');
        out.oldTrace = pd.S.mode.method;
        pd.cancelMode();
        mk().close = 10;
        pd.select(F4); pd.setMode('split');
        out.oldWand = pd.S.mode.method;
        pd.cancelMode();
        pd.S.layers.filter(M => M.name.startsWith('combo')).forEach(M => pd.removeLayer(M));
        radio('split');
        pd.S.sp = JSON.parse(saved);
        return out;
    });
    t.check('亮度 < 24 抓不到紅線', cu.lumOnly);
    t.eq('色塊：移動滑鼠顯示游標底下的 RGBA', JSON.stringify(cu.hover), JSON.stringify(['(192,0,0,255)', false]));
    t.eq('色塊：透明的地方是空的、(0,0,0,0)', JSON.stringify(cu.hoverClear), JSON.stringify(['(0,0,0,0)', true]));
    t.eq('色塊：離開畫布清空', cu.leave, '—');
    t.eq('-／+：重新追線、按住只記一步', JSON.stringify(cu.step), JSON.stringify([22, 22, 2, '22']));
    t.eq('亮度 < 60 抓到紅線跟黑線', JSON.stringify(cu.lum60), JSON.stringify([null, {lum: 60}]));
    t.eq('存成挖除：帶魔術棒＋下、關掉右', JSON.stringify(cu.preset), JSON.stringify(['wand', true, false, false, 'wand']));
    t.eq('亮度依切割方法各存一份', JSON.stringify(cu.lumSep), JSON.stringify(['60', 60, '61', 61, {trace: 60, wand: 61}]));
    t.eq('挖除：切換重新淹水、顯示閉運算／往下射', JSON.stringify(cu.cutUi), JSON.stringify([true, false, null]));
    t.eq('存成前後片：帶沿線', cu.splitPreset, 'trace');
    t.eq('手動改魔術棒：存成不變、顯示閉運算那列', JSON.stringify(cu.manual), JSON.stringify([false, 'wand', 'split', false]));
    t.eq('前後片＋魔術棒：選到的那塊變後片、下線外面留在前片、split 記 method/close', JSON.stringify(cu.splitWand), JSON.stringify([0, 255, 255, 0, 'wand', 10]));
    t.eq('再進來帶回魔術棒', JSON.stringify(cu.resumeWand), JSON.stringify([false, 'wand']));
    t.eq('存成挖除後手動改沿線：存成不變、藏閉運算那列', JSON.stringify(cu.cutTraceUi), JSON.stringify([true, 'trace', true]));
    t.eq('挖除＋沿線：右下整塊挖空、刪後片、沿線不記魔術棒參數', JSON.stringify(cu.cutTrace), JSON.stringify(['combo,combo-front', '0011', 'trace', false]));
    t.eq('舊資料沒有 method：挖除沒 close 當沿線', cu.oldTrace, 'trace');
    t.eq('舊資料沒有 method：挖除有 close 當魔術棒', cu.oldWand, 'wand');
    t.eq('挖除：只有原圖（隱藏）＋前片、選前片', JSON.stringify(cu.layers), JSON.stringify(['visor,visor-front', false, true]));
    t.eq('挖除：挖到下線為止，上線、下線、左線、線外面都留著', cu.bits, '011111');
    t.eq('挖除：一組認得是挖除、沒有後片', JSON.stringify(cu.group), JSON.stringify([true, null, true]));
    t.eq('挖除：再進來帶回挖除、閉運算、往下射', JSON.stringify(cu.resume), JSON.stringify([true, 'cut', false, 10, 20]));
    t.eq('挖除：改往下射記一步', cu.overStep, 1);
    t.eq('挖除：不勾「下」就停在下線、記一步、X 留著', JSON.stringify(cu.downOff), JSON.stringify([140, 2, 50]));
    t.eq('挖除：勾回「下」再挖到底', cu.downOn, 180);
    t.eq('挖除：勾「右」、改右的 X 各記一步', JSON.stringify(cu.rightOn), JSON.stringify([true, 7, 5]));
    t.eq('挖除：往下 50px 碰到圖底的透明，挖到底', cu.overBits, '000111');
    t.eq('挖除存檔：sprite 指 -front、沒有 back、icon／drop 是原圖', JSON.stringify(cu.saved), JSON.stringify([
        '{"cat":"CAT_HELMET","icon":"visor","equip":{"sprite":"visor-front","scale":0.25,"x":0,"y":0},"drop":{"sprite":"visor","scale":0.25}}', true, false]));
    t.eq('挖除→前後片：補回 -back', JSON.stringify(cu.toSplit), JSON.stringify(['visor-back,visor,visor-front', false]));
    t.eq('挖除→前後片：undo', cu.toSplitUndo, 'visor,visor-front');
    t.eq('挖除：下面沒有線就淹到圖底，外圈貼著格子邊', JSON.stringify(cu.noLine), JSON.stringify([null, '180,180 180,64 64,180 64,64']));

    // 挖除淹水：20×20，x≥18 透明；黑框 (2..15)，框內 (8,8) 孤島、(3..5,11) 連著左牆的半島；n＝每一步收了幾格（淹水、閉運算、往下射）
    const fl = await ev(async () => {
        const PX = await import(new URL('pixels.js', location.href).href);
        const c = document.createElement('canvas'); c.width = c.height = 20;
        const g = c.getContext('2d');
        g.fillStyle = '#808080'; g.fillRect(0, 0, 18, 20);
        g.fillStyle = '#000'; g.fillRect(2, 2, 14, 1); g.fillRect(2, 15, 14, 1); g.fillRect(2, 2, 1, 14); g.fillRect(15, 2, 1, 14);
        g.fillRect(8, 8, 1, 1); g.fillRect(3, 11, 3, 1);
        const o = (v) => ({x: 10, y: 5, c: {lum: 24}, ...v});
        const run = (v) => {const r = PX.splitFlood(c, o(v)); return r.err ?? [1, 2, 3, 4].map(k => r.R.filter(q => q === k).length);};
        const cut = (v) => PX.splitCut(c, o(v)).pts.map(p => `${p.x},${p.y}`).sort().join(' ');
        const out = {plain: run({}), close: run({close: 2}), d5: run({drop: 5}), d6: run({drop: 6}), line: run({x: 2, y: 5}),
                     r4: run({close: 2, right: 4}), r3: run({close: 2, right: 3}), dr: run({close: 2, drop: 6, right: 4}),
                     cutClose: cut({close: 2}), cutNotch: cut({}).split(' ').length};
        g.clearRect(0, 16, 20, 4);
        g.fillStyle = '#808080'; g.fillRect(0, 16, 18, 2);
        out.d3 = run({drop: 3});
        out.d4 = run({drop: 4});
        return out;
    });
    t.eq('淹水：停在線上，孤島、半島不淹', JSON.stringify(fl.plain), JSON.stringify([140, 0, 0, 0]));
    t.eq('淹水：閉運算補孤島跟半島、外框不動', JSON.stringify(fl.close), JSON.stringify([140, 4, 0, 0]));
    t.eq('淹水：往右 4px 才透明，right=4 收線＋2 格', fl.r4[3], 36);
    t.eq('淹水：往右 4px 才透明，right=3 不收', fl.r3[3], 0);
    t.eq('淹水：先下後右，往下收進來的列也往右射（右下角轉角收到）', JSON.stringify(fl.dr), JSON.stringify([140, 4, 60, 51]));
    t.eq('淹水：往下 5px 內沒透明，孤島、半島、下線都不收', fl.d5[2], 0);
    t.eq('淹水：往下 6px 碰到圖邊，中間 5 格都收', fl.d6[2], 60);
    t.eq('淹水：往下 4px 才透明，drop=3 不收', fl.d3[2], 0);
    t.eq('淹水：往下 4px 才透明，drop=4 收線＋2 格', fl.d4[2], 36);
    t.eq('淹水：起點在線上報錯', fl.line, '起點在輪廓線上，拖到線圍起來的區域裡');
    t.eq('挖除外圈：孤島不管、閉運算補掉半島＝框內矩形', fl.cutClose, '15,15 15,3 3,15 3,3');
    t.eq('挖除外圈：沒閉運算，半島留一道凹口', fl.cutNotch, 8);
});
