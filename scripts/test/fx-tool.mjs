// 特效工具（tools/fx）：用 window.__fx 直接呼叫，OPFS 當假的 public/assets
import {run} from './harness.mjs'

run('fx-tool', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/fx/', base).href);
    await t.page.waitForFunction(() => window.__fx && Object.keys(window.__fx.S.refs).length);

    const r = await t.page.evaluate(async () => {
        const fx = window.__fx, S = fx.S, D = fx.D, out = {};
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const get = (f) => fetch(f, {cache: 'no-store'}).then(r => r.text());
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const dlg = document.getElementById('dlgAsk');
        const save = async () => {
            let done = false;
            const p = D.save().finally(() => {done = true;});
            while (!done) {if (dlg.open) dlg.close('save'); await sleep(20);}
            await p;
        };

        const orig = await get('/assets/json/fx.json');
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const assets = await dir(opfs, 'assets'), json = await dir(assets, 'json');
        const disk = async () => (await (await json.getFileHandle('fx.json')).getFile()).text();
        await write(json, 'fx.json', orig);
        await write(json, 'ability.json', await get('/assets/json/ability.json'));

        await D.setAssets(assets);
        out.load = Object.keys(S.data).length === Object.keys(JSON.parse(orig)).length;
        await save();
        out.roundtrip = (await disk()) === orig;

        // 引用：action 類（lifesteal）不算；ability／item 有、fx 沒有的列在缺特效
        out.refsBurn = S.refs.burn?.some(r => r.tab === 'ability');
        out.noAction = !('lifesteal' in S.refs);
        out.missing = fx.missing();
        out.groups = qa('#list .group').map(g => g.textContent);

        // 缺特效：選了顯示「用範本建立」，建立後離開缺特效
        const m = out.missing[0];
        S.sel = m; S.view = 'form'; fx.render();
        qa('#view button').find(b => b.textContent === '用範本建立').click();
        out.created = [!!S.data[m]?.img, !fx.missing().includes(m), S.sel];
        D.undo();

        // cell 表單：縮放填範圍、翻面選隨機、清空刪 key
        S.sel = 'burn'; S.view = 'form'; fx.render();
        fire(q('[data-k="cell.scale"]'), '0.8, 1.2');
        out.scale = JSON.stringify(S.data.burn.cell.scale);
        fire(q('[data-k="cell.flipX"]'), 'random');
        out.flip = S.data.burn.cell.flipX;
        fire(q('[data-k="cell.scale"]'), '');
        out.scaleGone = 'scale' in S.data.burn.cell;
        D.undo(); D.undo(); D.undo();
        out.undo = JSON.stringify(S.data.burn) === JSON.stringify(JSON.parse(orig).burn);

        // 檢查：flash 有 idle 要警告；body 只能 angle
        out.flashIdle = fx.validate('burn').some(w => w.includes('idle'));
        D.set('stun', ['body'], {angle: {from: -5, to: 5}, x: 3, duration: 200});
        out.bodyWarn = fx.validate('stun').some(w => w.includes('body 只支援 angle'));
        D.undo();

        // 階段移除、建立
        const before = JSON.stringify(S.data.stun);
        S.sel = 'stun'; fx.render();
        D.set('stun', ['tick'], undefined);
        out.tickGone = 'tick' in S.data.stun;
        D.undo();
        out.stageUndo = JSON.stringify(S.data.stun) === before;

        // tween 表單：時間參數、值的寫法切換、相對值、改屬性名（位置不變）、加屬性、JSON 切換
        S.sel = 'burn'; S.view = 'form'; fx.render();
        const burn0 = JSON.stringify(S.data.burn);
        fire(q('[data-k="spawn.duration"]'), '300');
        fire(q('[data-k="spawn.scale#mode"]'), 'num');
        out.twNum = [S.data.burn.spawn.duration, S.data.burn.spawn.scale];
        out.relSign = q('[data-k="tick.y#sign"]')?.value;
        fire(q('[data-k="tick.y"]'), '6');
        out.rel = S.data.burn.tick.y;
        fire(q('[data-k="spawn.scale#name"]'), 'alpha');
        out.renameProp = Object.keys(S.data.burn.spawn).join(',');
        fire(q('[data-k="end.#add"]'), 'angle');
        out.addProp = S.data.burn.end.angle;
        D.set('burn', ['spawn', 'ease'], 'Nope.Out');
        out.easeWarn = fx.validate('burn').some(w => w.includes('Nope.Out'));
        for (let i = 0; i < 6; i++) D.undo();
        out.twUndo = JSON.stringify(S.data.burn) === burn0;
        [...q('#view').querySelectorAll('.box')].find(b => b.querySelector('.bar [title="spawn"]')).querySelector('button.on, .bar button[title="整段用 JSON 改"]').click();
        out.jsonMode = !!q('[data-k="spawn.#json"]');
        S.sel = 'stun'; fx.render();
        out.bodyOnly = [q('[data-k="body.#add"]'), q('[data-k="body.angle#name"]')?.options.length];

        // 改名：確認框列出 ability.json 的引用
        const p = D.rename('burn', 'burn2');
        for (let i = 0; i < 200 && !dlg.open; i++) await sleep(20);
        out.renameDlg = dlg.textContent.includes('json/ability.json');
        dlg.close('cancel'); await p;

        // 預覽：Phaser 跑遊戲的 FxCell；預設角色是怪物
        const PV = fx.PV, st = PV.st;
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        PV.P.auto = false;
        S.sel = 'stun'; S.view = 'form'; fx.render();
        out.pvEl = !!q('#view .pv .stage canvas');
        await until(() => st.fx?.img === '💫' && st.root);
        out.pvRole = st.ext.roles[PV.P.role]?.kind;
        PV.replay();
        // stun：align top → 掛在 view 上緣；有 body → 身體會擺
        out.stunCell = [!!st.cur, st.cur?.cell.holder.y === st.view.Min.y, !!st.cur?.body];
        await sleep(200);
        out.bodySwing = st.view.shape.angle !== 0;
        PV.off();
        out.offReset = [st.cur, st.view.shape.angle];
        // 改了就重播、預覽元素不重建
        const cv = q('#view .pv .stage canvas');
        // body 會讓圖示繞腳底轉，比位置前先拿掉
        D.commit(() => {S.data.stun.cell.align = 'bottom'; delete S.data.stun.body;});
        await until(() => st.fx?.cell.align === 'bottom');
        out.rerender = [q('#view .pv .stage canvas') === cv, st.cur?.cell.holder.y === st.view.Max.y];
        D.undo();
        // burn：閃一下，不常駐，播完自己消失
        S.sel = 'burn'; fx.render();
        await until(() => st.fx?.img === '🔥');
        PV.stop(); PV.on();
        out.flash = [st.cur, st.flashes.size];
        await until(() => st.flashes.size === 0);
        out.flashDone = st.flashes.size;
        // 自動循環
        PV.P.auto = true; PV.replay();
        await until(() => st.flashes.size > 0);
        out.auto = st.flashes.size > 0;
        PV.stop();
        return out;
    });

    t.check('讀入全部', r.load);
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.check('ability 的 burn 算引用', r.refsBurn);
    t.check('action 類效果不收', r.noAction);
    t.check('有缺特效的效果', r.missing.length > 0, r.missing.join(','));
    t.check('左欄分組', r.groups.some(g => g.includes('缺特效')), r.groups.join(' | '));
    t.eq('缺特效用範本建立', JSON.stringify(r.created), JSON.stringify([true, true, r.missing[0]]));
    t.eq('縮放填範圍', r.scale, '[0.8,1.2]');
    t.eq('翻面隨機', r.flip, 'random');
    t.eq('清空刪 key', r.scaleGone, false);
    t.check('undo 回原樣', r.undo);
    t.check('閃一下有 idle 會警告', r.flashIdle);
    t.check('body 有 angle 以外的屬性會警告', r.bodyWarn);
    t.eq('移除階段', r.tickGone, false);
    t.check('階段 undo', r.stageUndo);
    t.eq('時長、從→到切成數值（取 to）', JSON.stringify(r.twNum), JSON.stringify([300, 1]));
    t.eq('相對值顯示 -=', r.relSign, '-=');
    t.eq('改相對值數字', r.rel, '-=6');
    t.eq('改屬性名，位置不變', r.renameProp, 'alpha,duration,ease');
    t.eq('加屬性用預設值', r.addProp, 0);
    t.check('不認識的曲線會警告', r.easeWarn);
    t.check('tween 表單 undo 回原樣', r.twUndo);
    t.check('JSON 切換', r.jsonMode);
    t.eq('body 只有 angle', JSON.stringify(r.bodyOnly), JSON.stringify([null, 1]));
    t.check('改名列出 ability.json 的引用', r.renameDlg);
    t.check('預覽有 Phaser 畫布', r.pvEl);
    t.eq('預設角色是怪物', r.pvRole, 'monster');
    t.eq('stun 上身：常駐、掛在 view 上緣、有 body', JSON.stringify(r.stunCell), JSON.stringify([true, true, true]));
    t.check('body 讓身體擺動', r.bodySwing);
    t.eq('解除後身體轉回正', JSON.stringify(r.offReset), JSON.stringify([null, 0]));
    t.eq('改欄位就重播、畫布不重建', JSON.stringify(r.rerender), JSON.stringify([true, true]));
    t.eq('閃一下不常駐', JSON.stringify(r.flash), JSON.stringify([null, 1]));
    t.eq('閃一下播完自己消失', r.flashDone, 0);
    t.check('自動循環會播', r.auto);

    // 殼：「用到的」↗ 跳到能力分頁那個技能；特效存檔後能力分頁的效果 id 建議跟著更新
    await t.page.goto(new URL('tools/#fx', base).href);
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
        for (const f of ['fx', 'ability', 'ab_tree', 'item', 'role', 'local']) await write(json, `${f}.json`, await get(`/assets/json/${f}.json`));
        await T.setProject(proj);
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        await until(() => win('fx')?.__fx?.S.assets);
        const fx = win('fx').__fx;
        fx.S.sel = 'burn'; fx.S.view = 'form'; fx.render();
        const a = win('fx').document.querySelector('#view .refs a.go');
        out.target = a?.textContent;
        a.click();
        out.jump = !!await until(() => location.hash === '#ability' && win('ability')?.__ab?.S.sel && out.target.includes(win('ability').__ab.S.sel));
        return out;
    });
    t.check('↗ 跳到能力分頁那個技能', s.jump, s.target);
});
