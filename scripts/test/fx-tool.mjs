// 特效工具（tools/fx）：用 window.__fx 直接呼叫，OPFS 當假的 public/assets
import {run} from './harness.mjs'

run('fx-tool', async t => {
    await t.page.goto(new URL('tools/fx/', t.page.url()).href);
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

        // 改名：確認框列出 ability.json 的引用
        const p = D.rename('burn', 'burn2');
        for (let i = 0; i < 200 && !dlg.open; i++) await sleep(20);
        out.renameDlg = dlg.textContent.includes('json/ability.json');
        dlg.close('cancel'); await p;
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
    t.check('改名列出 ability.json 的引用', r.renameDlg);
});
