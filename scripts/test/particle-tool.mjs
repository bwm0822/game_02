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
