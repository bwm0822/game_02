// 粒子分頁（tools/particle）：用 window.__pt 直接呼叫，OPFS 當假的 public/assets
import {run} from './harness.mjs'

run('particle-tool', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/particle/', base).href);
    await t.page.waitForFunction(() => window.__pt);

    const r = await t.page.evaluate(async () => {
        const pt = window.__pt, S = pt.S, D = pt.D, out = {};
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const get = (f) => fetch(f, {cache: 'no-store'}).then(r => r.text());
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const dlg = document.getElementById('dlgAsk');
        const save = async () => {
            let done = false;
            const p = D.save().finally(() => {done = true;});
            while (!done) {if (dlg.open) dlg.close('save'); await sleep(20);}
            await p;
        };

        const orig = await get('/assets/json/particle.json');
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const assets = await dir(opfs, 'assets'), json = await dir(assets, 'json');
        const disk = async () => (await (await json.getFileHandle('particle.json')).getFile()).text();
        await write(json, 'particle.json', orig);
        // Tiled：地圖本身＝環境粒子、物件的自訂屬性
        await write(await dir(assets, 'maps', 'm'), 'x.json', JSON.stringify({properties: [{name: 'particle', type: 'string', value: 'rain'}],
            layers: [{name: 'obj', objects: [{id: 7, name: 'fire', properties: [{name: 'particle', type: 'string', value: 'smoke'}, {name: 'px', type: 'int', value: 2}]}, {id: 8}]}]}));

        await D.setAssets(assets);
        for (let i = 0; i < 100 && !S.refsP; i++) await sleep(20);
        await S.refsP;
        out.tiled = ['rain', 'smoke'].map(k => (S.refs[k] ?? []).map(x => `${x.tab}:${x.id}:${x.at}`).join('|'));
        out.tiledUsed = [pt.isUnused('rain'), pt.isUnused('smoke')];
        out.load = Object.keys(S.data).length === Object.keys(JSON.parse(orig)).length;
        await save();
        out.roundtrip = (await disk()) === orig;

        // 引用：ability 的 cast／travel／fx、fx.json 的 particle／tickParticle；沒有的列在缺粒子
        const refs = {};
        pt.collectRefs({fireball: {cast: {particle: 'fire-charge'}, travel: {particle: 'ember'}, fx: {particle: 'nope-1'}}}, 'ability', refs);
        pt.collectRefs({burn: {particle: 'ember', tickParticle: 'fire-burst'}}, 'fx', refs);
        out.collect = Object.entries(refs).map(([k, v]) => `${k}=${v.map(x => `${x.tab}:${x.id}:${x.at}`).join('|')}`).join(' ');
        S.refs = refs; pt.render();
        out.missing = pt.missing();
        out.groups = qa('#list .group').map(g => g.textContent.replace(/[▾▸]/g, '').trim());

        // 缺粒子：用範本建立
        S.sel = 'nope-1'; S.view = 'form'; pt.render();
        qa('#view button').find(b => b.textContent === '用範本建立').click();
        out.created = [!!S.data['nope-1']?.img, !pt.missing().includes('nope-1')];
        D.undo();

        // 自己的欄位：模式切一次噴 → 顯示顆數、藏噴多久
        S.sel = 'ember'; S.view = 'form'; pt.render();
        out.streamFields = [!!q('[data-k="duration"]'), !!q('[data-k="count"]')];
        fire(q('[data-k="mode"]'), 'burst');
        out.burstFields = [S.data.ember.mode, !!q('[data-k="count"]'), !!q('[data-k="duration"]')];
        out.burstWarn = pt.validate('ember').some(w => w.includes('frequency'));
        D.undo();
        fire(q('[data-k="img#builtin"]'), 'p-dot');
        out.img = S.data.ember.img;
        D.undo();

        // Phaser 欄位：值的寫法切換、範圍、漸變＋曲線、顏色、加屬性、移除
        const e0 = JSON.stringify(S.data.ember);
        fire(q('[data-k="lifespan#mode"]'), 'num');
        out.toNum = S.data.ember.lifespan;
        fire(q('[data-k="lifespan"]'), '900');
        out.num = S.data.ember.lifespan;
        out.steps = ['lifespan', 'scale.start', 'scale.end'].map(k => `${q(`[data-k="${k}"]`).type}:${q(`[data-k="${k}"]`).step}`);
        fire(q('[data-k="scale.end"]'), '0.2');
        fire(q('[data-k="scale.ease"]'), 'Quad.Out');
        out.se = JSON.stringify(S.data.ember.scale);
        fire(q('[data-k="tint.start"]'), '#00ff00');
        out.tint = S.data.ember.tint.start;
        fire(q('[data-k="move.#add"]'), 'gravityY');
        out.add = S.data.ember.gravityY;
        D.set('ember', ['scale', 'ease'], 'Nope.Out');
        out.easeWarn = pt.validate('ember').some(w => w.includes('Nope.Out'));
        for (let i = 0; i < 7; i++) D.undo();
        out.undo = JSON.stringify(S.data.ember) === e0;

        // 檢查：emoji 吃 tint 警告、持續噴寫 count 警告
        D.set('ember', ['img'], '✨');
        out.emojiWarn = pt.validate('ember').some(w => w.includes('emoji'));
        D.undo();
        D.set('ember', ['count'], 5);
        out.countWarn = pt.validate('ember').some(w => w.includes('count'));
        D.undo();

        // 整筆 JSON
        q('#view .head button.on, #view .head button[title="切換表單／整筆 JSON"]').click();
        out.full = !!q('[data-k="#full"]');
        S.json = false; pt.render();

        // 預覽：跑 playParticle；情境切換；改了重播、畫布不重建
        const PV = pt.PV, st = PV.st;
        PV.P.auto = false;
        S.sel = 'ember'; pt.render();
        out.pvEl = !!q('#view .pv .stage canvas');
        await until(() => st.def?.img === 'p-soft' && st.fx);
        await sleep(300);
        out.pvAlive = st.fx.alive > 0;
        const cv = q('#view .pv .stage canvas');
        D.commit(() => {S.data.ember.frequency = 30;});
        await until(() => st.def?.frequency === 30);
        out.rerender = [q('#view .pv .stage canvas') === cv, !!st.fx];
        D.undo();
        await until(() => st.def?.frequency === 60);
        PV.halt();
        out.halt = st.fx.emitter?.emitting;
        await until(() => !st.fx.emitter);
        out.halted = st.fx.emitter === null;
        // 拖尾：跟著移動點
        PV.P.scene = 'trail'; PV.replay();
        await sleep(200);
        out.trail = [!!st.mover, st.fx.target === st.mover];
        // 角色身上
        PV.P.scene = 'role'; PV.replay();
        await until(() => st.role);
        out.role = [st.fx.target === st.role?.root, st.role.root.visible];
        // 區域：quantity 乘格數
        PV.P.scene = 'zone'; PV.P.zw = 3; PV.P.zh = 2; PV.replay();
        const qn = st.fx.emitter.quantity;
        out.zone = [typeof qn === 'number' ? qn : qn?.propertyValue, !!st.grid, st.role.root.visible];
        // 一次噴：自動重播
        PV.P.scene = 'point'; PV.P.auto = true;
        S.sel = 'fire-burst'; pt.render();
        await until(() => st.def?.mode === 'burst');
        const first = st.fx;
        await until(() => st.fx && st.fx !== first);
        out.autoReplay = st.fx !== first;
        PV.stop();
        PV.P.auto = false;
        // textures 的圖切成貼圖
        D.set('fire-burst', ['img'], 'arrow');
        await until(() => st.def?.img?.startsWith('pimg-'));
        out.texImg = st.def?.img?.startsWith('pimg-');
        D.undo();

        // 改名：確認框列引用（這裡沒有其他檔，至少要能開確認框）
        const p = D.rename('ember', 'ember2');
        for (let i = 0; i < 200 && !dlg.open; i++) await sleep(20);
        out.renameDlg = dlg.open;
        dlg.close('cancel'); await p;
        return out;
    });

    t.eq('Tiled 的 particle 屬性算引用（地圖本身、物件名稱）', JSON.stringify(r.tiled), JSON.stringify(['null:maps/m/x.json:地圖', 'null:maps/m/x.json:fire']));
    t.eq('Tiled 引用到的不算未使用', JSON.stringify(r.tiledUsed), JSON.stringify([false, false]));
    t.check('讀入全部', r.load);
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('引用：技能 cast／travel／fx、fx.json 的 particle／tickParticle',
        r.collect, 'fire-charge=ability:fireball:cast.particle ember=ability:fireball:travel.particle|fx:burn:particle nope-1=ability:fireball:fx.particle fire-burst=fx:burn:tickParticle');
    t.eq('缺粒子', JSON.stringify(r.missing), JSON.stringify(['nope-1']));
    t.check('左欄分組', r.groups.some(g => g.includes('缺粒子')) && r.groups.some(g => g.includes('未使用')), r.groups.join(' | '));
    t.eq('缺粒子用範本建立', JSON.stringify(r.created), JSON.stringify([true, true]));
    t.eq('持續噴：有噴多久、沒顆數', JSON.stringify(r.streamFields), JSON.stringify([true, false]));
    t.eq('切一次噴：有顆數、沒噴多久', JSON.stringify(r.burstFields), JSON.stringify(['burst', true, false]));
    t.check('一次噴還有 frequency 會警告', r.burstWarn);
    t.eq('內建形狀下拉', r.img, 'p-dot');
    t.eq('範圍切成數值（取 min）', r.toNum, 400);
    t.eq('改數值', r.num, 900);
    t.eq('數值欄有步進（schema 的 step）', r.steps.join(' '), 'number:50 number:0.05 number:0.05');
    t.eq('漸變改 end＋曲線', r.se, JSON.stringify({start: 0.35, end: 0.2, ease: 'Quad.Out'}));
    t.eq('顏色選擇器寫 #hex', r.tint, '#00ff00');
    t.eq('加屬性用預設值', r.add, 0);
    t.check('不認識的曲線會警告', r.easeWarn);
    t.check('表單 undo 回原樣', r.undo);
    t.check('emoji 有 tint 會警告', r.emojiWarn);
    t.check('持續噴寫 count 會警告', r.countWarn);
    t.check('整筆 JSON', r.full);
    t.check('預覽有 Phaser 畫布', r.pvEl);
    t.check('預覽在噴粒子', r.pvAlive);
    t.eq('改欄位就重播、畫布不重建', JSON.stringify(r.rerender), JSON.stringify([true, true]));
    t.eq('停止：不再發射、飄完收掉', JSON.stringify([r.halt, r.halted]), JSON.stringify([false, true]));
    t.eq('拖尾：跟著移動點', JSON.stringify(r.trail), JSON.stringify([true, true]));
    t.eq('角色身上：跟著角色', JSON.stringify(r.role), JSON.stringify([true, true]));
    t.eq('區域 3×2：quantity×6、畫格子、藏角色', JSON.stringify(r.zone), JSON.stringify([6, true, false]));
    t.check('一次噴自動重播', r.autoReplay);
    t.check('textures 的圖切成貼圖', r.texImg);
    t.check('改名有確認框', r.renameDlg);
    await t.page.evaluate(() => {const d = document.getElementById('dlgAsk'); if (d?.open) d.close('cancel');});

    // zone：表單（形狀／type 切換、陣列退回 JSON、deathZone 沒有線段）、純函式拖曳、預覽真的用滑鼠拖
    const z = await t.page.evaluate(async () => {
        const pt = window.__pt, S = pt.S, D = pt.D, SC = pt.SC, PV = pt.PV, out = {};
        const q = (s) => document.querySelector(s);
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        S.view = 'form'; S.json = false; S.sel = 'campfire'; pt.render();
        out.shape = q('[data-k="emitZone#shape"]')?.value;
        fire(q('[data-k="emitZone#shape"]'), 'circle');
        out.toCircle = JSON.stringify(S.data.campfire.emitZone.source);
        D.undo();
        fire(q('[data-k="emitZone.type"]'), 'edge');
        out.edge = [S.data.campfire.emitZone.quantity, !!q('[data-k="emitZone.yoyo"]'), q('[data-k="emitZone.seamless"]')?.checked];
        fire(q('[data-k="emitZone.type"]'), 'random');
        out.unEdge = 'quantity' in S.data.campfire.emitZone;
        D.undo(); D.undo();
        fire(q('[data-k="emitZone.source.w"]'), '20');
        out.w = S.data.campfire.emitZone.source.w;
        D.undo();
        fire(q('[data-k="zone.#add"]'), 'deathZone');
        out.deathShapes = [...q('[data-k="deathZone#shape"]').options].map(o => o.value).join(',');
        out.deathType = q('[data-k="deathZone.type"]').value;
        D.undo();
        D.set('campfire', ['emitZone'], [{type: 'random', source: {w: 4, h: 4}}]);
        out.arrJson = q('[data-k="emitZone"]')?.tagName === 'INPUT' && !q('[data-k="emitZone#shape"]');
        D.undo();
        D.set('campfire', ['deathZone'], {source: {x1: 0, y1: 0, x2: 9, y2: 0}});
        out.lineWarn = pt.validate('campfire').some(w => w.includes('deathZone 不能用線段'));
        D.undo();
        // 純函式
        const r = {x: -8, y: -2, w: 16, h: 4};
        out.dragMove = JSON.stringify(SC.dragZone('rect', r, 'move', {x: 0, y: 0}, {x: 5.4, y: 1.2}));
        out.dragSe = JSON.stringify(SC.dragZone('rect', r, 'se', {x: 8, y: 2}, {x: 13, y: 9}, 4));
        out.dragR = SC.dragZone('circle', {r: 5}, 'r', {x: 5, y: 0}, {x: 0, y: 12}).r;
        out.dragLine = JSON.stringify(SC.dragZone('line', {x1: 0, y1: 0, x2: 10, y2: 0}, 'move', {x: 0, y: 0}, {x: 3, y: 2}));
        out.noXY = JSON.stringify(SC.rectOf({w: 32, h: 8}));
        // 預覽：原地情境、預設鏡頭，回傳發射點在畫面上的位置
        PV.P.scene = 'point'; PV.P.view = null; PV.P.zbox = true; PV.P.auto = false; PV.st.zsel = null;
        S.sel = 'campfire'; pt.render(); PV.replay();
        for (let i = 0; i < 100 && PV.st.def?.emitZone?.source?.w !== 16; i++) await sleep(20);
        await sleep(100);
        const cv = q('#view .pv .stage canvas').getBoundingClientRect();
        return {...out, cx: cv.left + cv.width / 2, cy: cv.top + cv.height / 2, k: cv.width / 240};
    });
    // 從發射點（框的中心）往右下拖 10×6 遊戲 px
    await t.page.mouse.move(z.cx, z.cy);
    await t.page.mouse.down();
    await t.page.mouse.move(z.cx + 5 * z.k, z.cy + 3 * z.k, {steps: 3});
    await t.page.mouse.move(z.cx + 10 * z.k, z.cy + 6 * z.k, {steps: 3});
    await t.page.mouse.up();
    const zd = await t.page.evaluate(async () => {
        const pt = window.__pt, S = pt.S, D = pt.D, PV = pt.PV;
        const src = JSON.stringify(S.data.campfire.emitZone.source), sel = PV.st.zsel;
        D.undo();
        const undone = JSON.stringify(S.data.campfire.emitZone.source);
        // 滾輪：以游標為中心縮放、記在 P.view；置中回預設
        const box = document.querySelector('#view .pv .stage'), cv = box.querySelector('canvas').getBoundingClientRect();
        box.dispatchEvent(new WheelEvent('wheel', {deltaY: -100, clientX: cv.left + cv.width / 2, clientY: cv.top + cv.height / 2, bubbles: true, cancelable: true}));
        const zoomed = PV.P.view?.zoom;
        [...document.querySelectorAll('#view .pv button')].find(b => b.textContent === '置中').click();
        return {src, sel, undone, zoomed, reset: PV.P.view === null && PV.st.scene.cameras.main.zoom === 1};
    });
    t.eq('zone 表單：認得矩形', z.shape, 'rect');
    t.eq('矩形換成圓：保留中心、r＝短邊一半', z.toCircle, JSON.stringify({x: 0, y: 0, r: 2}));
    t.eq('換成 edge：補 quantity、有 yoyo／seamless（預設勾）', JSON.stringify(z.edge), JSON.stringify([12, true, true]));
    t.check('換回 random：拿掉 quantity', !z.unEdge);
    t.eq('改寬', z.w, 20);
    t.eq('deathZone 只有矩形／圓、type 預設 onLeave', `${z.deathShapes} ${z.deathType}`, 'rect,circle onLeave');
    t.check('陣列 zone 退回 JSON 框', z.arrJson);
    t.check('deathZone 用線段會警告', z.lineWarn);
    t.eq('拖曳移動：吸整數', z.dragMove, JSON.stringify({x: -3, y: -1, w: 16, h: 4}));
    t.eq('拖右下把手：Shift 吸 4、左上固定', z.dragSe, JSON.stringify({x: -8, y: -2, w: 20, h: 10}));
    t.eq('拖圓周把手改 r（游標到圓心的距離）', z.dragR, 12);
    t.eq('線段整條移動', z.dragLine, JSON.stringify({x1: 3, y1: 2, x2: 13, y2: 2}));
    t.eq('矩形沒寫 x／y＝置中', z.noXY, JSON.stringify({x: -16, y: -4, w: 32, h: 8}));
    t.eq('預覽真的拖：框跟著移、選中 emitZone', `${zd.src} ${zd.sel}`, `${JSON.stringify({x: 2, y: 4, w: 16, h: 4})} emitZone`);
    t.eq('拖曳一步 undo', zd.undone, JSON.stringify({x: -8, y: -2, w: 16, h: 4}));
    t.check('滾輪放大記在 P.view、置中回預設', zd.zoomed > 1 && zd.reset, `${zd.zoomed} ${zd.reset}`);

    // 捲到下面點數值欄的上三角：重畫還原焦點不能把畫面捲走
    await t.page.setViewport({width: 1400, height: 500});
    const sp = await t.page.evaluate(async () => {
        const pt = window.__pt, S = pt.S;
        S.view = 'form'; S.json = false; S.sel = 'rain'; pt.render();
        const view = document.getElementById('view'), el = document.querySelector('[data-k="speedY.min"]');
        el.scrollIntoView({block: 'center'});
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const b = el.getBoundingClientRect();
        return {top: view.scrollTop, v: S.data.rain.speedY.min, x: b.right - 8, y: b.top + 4};
    });
    await t.page.mouse.click(sp.x, sp.y);
    await new Promise(r => setTimeout(r, 200));
    const sp2 = await t.page.evaluate(() => {
        const pt = window.__pt, v = pt.S.data.rain.speedY.min, top = document.getElementById('view').scrollTop;
        pt.D.undo();
        return {top, v};
    });
    t.check('捲到下面點上三角：值加上去、畫面不跳', sp2.v > sp.v && sp2.top === sp.top, `${sp.v}→${sp2.v} scrollTop ${sp.top}→${sp2.top}`);
    await t.page.setViewport({width: 1024, height: 768});

    await t.rightResize('__pt', 'particle', 240, 180);
    await t.formFits('__pt');

    // 殼：有粒子分頁，排在特效後面；↗ 跳到特效分頁
    await t.page.goto(new URL('tools/#particle', base).href);
    await t.page.waitForFunction(() => window.__tools);
    const s = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const get = (f) => fetch(f, {cache: 'no-store'}).then(r => r.text());
        const opfs = await navigator.storage.getDirectory();
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game'), json = await dir(proj, 'public', 'assets', 'json');
        for (const f of ['particle', 'fx', 'ability', 'item', 'role', 'part']) await write(json, `${f}.json`, await get(`/assets/json/${f}.json`));
        out.order = [...document.querySelectorAll('#tabs button')].map(b => b.dataset.tab).join(',');
        await T.setProject(proj);
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        await until(() => win('particle')?.__pt?.S.assets);
        const pt = win('particle').__pt;
        pt.S.refs = {ember: [{tab: 'fx', id: 'burn', at: 'particle'}]};
        pt.S.sel = 'ember'; pt.S.view = 'form'; pt.render();
        const a = win('particle').document.querySelector('#view .refs a.go');
        a.click();
        out.jump = !!await until(() => location.hash === '#fx' && win('fx')?.__fx?.S.sel === 'burn');
        return out;
    });
    t.check('殼的分頁：粒子排在特效後面', s.order.includes('fx,particle,'), s.order);
    t.check('↗ 跳到特效分頁那一筆', s.jump);
});
