// 場景分頁選圖器右鍵：textures/prefabs/<id>/ 的圖改名／刪除（docs/prefab.md「prefab 的圖改名／刪除」）
// 引用 prefab.json／scenes.json／草稿一起改、別處有引用擋、刪除＝搬到 .tbd、檔案動作跟 json 同一筆 undo
import {run} from './harness.mjs'

run('prefab-tex', async t => {
    await t.page.goto(new URL('/tools/#scene', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__sc);
    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f, n = 500) => {for (let i = 0; i < n && !await f(); i++) await sleep(20); return f();};
        const win = T.S.frames.scene.contentWindow, sc = win.__sc, doc = win.document;

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        const png = await (await fetch('/assets/textures/props/Barrel.png')).blob();
        const tpf = await dir(proj, 'public', 'assets', 'textures', 'prefabs', 'tpf');
        for (const n of ['zz-a', 'zz-b', 'zz-d']) await write(tpf, `${n}.png`, png);
        await write(await dir(proj, 'public', 'assets', 'textures', 'prefabs'), 'prefab-tpf.png', png);
        await write(json, 'item.json', '{}');
        await write(json, 'role.json', '{}');
        await write(json, 'particle.json', JSON.stringify({smoke: {img: 'zz-b', mode: 'stream'}}));
        await write(json, 'prefab.json', JSON.stringify({tpf: {parts: [{img: 'zz-a'}, {img: 'zz-b', y: -4}]}, other: {parts: [{img: 'zz-a', x: 3}]}}, null, 2) + '\n');
        // 擺設放在沒選的場景（sandbox 不建，不會去載假的 key）
        await write(await dir(proj, 'tools'), 'scenes.json', JSON.stringify({測試: {map: 'sandbox', prefabs: [{key: 'f1', prefab: 'other', x: 100, y: 100}]}, 別的: {map: 'sandbox', props: [{key: 'p1', img: 'zz-a', x: 0, y: 0}]}}, null, 2) + '\n');

        const read = async (d, name) => {await sc.flush(); const fh = await d.getFileHandle(name).catch(() => null); return fh ? JSON.parse(await (await fh.getFile()).text()) : null;};
        const pfDisk = () => read(json, 'prefab.json');
        const scDisk = async () => read(await dir(proj, 'tools'), 'scenes.json');
        const has = async (d, n) => !!await d.getFileHandle(n).catch(() => null);
        const tbdDir = async () => (await dir(proj, 'public', 'assets', 'textures', '.tbd', 'prefabs', 'tpf'));
        // 圖片清單讀的是真的 textures.json：假的 key 自己塞（每次更新清單會被洗掉）
        const fake = (...keys) => {for (const k of keys) sc.IC.IMAGES[k] = `/assets/textures/prefabs/tpf/${k}.png`;};
        const dlg = doc.getElementById('dlgAsk');
        const answer = async (v) => {await until(() => dlg.open); const txt = dlg.textContent; dlg.close(v); await sleep(50); return txt;};
        const statusText = () => doc.getElementById('status').textContent;

        await until(() => sc.S.ready);
        await T.setProject(proj);
        await until(() => sc.S.root);
        await sc.flush();
        sc.select('測試');

        // 只有 prefabs/<id>/ 的單張圖有選單；prefabs/ 底下的 Tiled 縮圖、其他資料夾沒有
        fake('zz-a', 'zz-b', 'zz-d');
        sc.IC.IMAGES['prefab-tpf'] = '/assets/textures/prefabs/prefab-tpf.png';
        out.menuable = [sc.texMenu('zz-a', {clientX: 0, clientY: 0}) !== null, sc.texMenu('prefab-tpf', {}), sc.texMenu('Barrel', {})];
        doc.querySelector('.ctxmenu')?.remove();

        // 檔名檢查
        const bad = [];
        for (const n of ['', 'a b', 'prefab-x', 'ZZ-A', 'Barrel'])
        {
            fake('zz-a');
            bad.push([await sc.renameTex('zz-a', n), statusText()]);
        }
        out.bad = bad.map(([v, s]) => [v, s.slice(0, 8)]);

        // 改名：png 改名、prefab.json（兩筆）＋scenes.json 一起改
        fake('zz-a');
        out.rename = [await sc.renameTex('zz-a', 'zz-c'), await has(tpf, 'zz-c.png'), await has(tpf, 'zz-a.png'),
                      (await pfDisk()).tpf.parts[0].img, (await pfDisk()).other.parts[0].img, (await scDisk()).別的.props[0].img];
        await sc.undo();
        await sc.flush();
        out.undo = [await has(tpf, 'zz-a.png'), await has(tpf, 'zz-c.png'), (await pfDisk()).tpf.parts[0].img, (await scDisk()).別的.props[0].img];
        await sc.redo();
        await sc.flush();
        out.redo = [await has(tpf, 'zz-c.png'), (await pfDisk()).other.parts[0].img];

        // 別處（particle.json）有引用：擋、列出來、檔案不動
        fake('zz-b');
        const p = sc.renameTex('zz-b', 'zz-x');
        out.blockText = (await answer('ok')).includes('particle.json');
        out.block = [await p, await has(tpf, 'zz-b.png')];

        // 刪除：有引用（prefab 零件）擋
        fake('zz-c');
        const pd = sc.deleteTex('zz-c', true);
        out.delBlockText = (await answer('ok')).includes('prefab.json');
        out.delBlock = [await pd, await has(tpf, 'zz-c.png')];
        // 沒人用：搬到 .tbd、undo 搬回來
        fake('zz-d');
        out.del = [await sc.deleteTex('zz-d', true), await has(tpf, 'zz-d.png'), await has(await tbdDir(), 'zz-d.png')];
        await sc.undo();
        await sc.flush();
        out.delUndo = [await has(tpf, 'zz-d.png'), await has(await tbdDir(), 'zz-d.png')];

        // 草稿中改名：草稿（含 undo 快照、base）跟著換，草稿還在；儲存寫新 key
        sc.pickRole('f1');
        await sc.setPart('other', 0, {y: 7});
        out.draft0 = !!sc.S.draft;
        fake('zz-c');
        await sc.renameTex('zz-c', 'zz-e');
        const d = sc.S.draft;
        out.draft = [!!d, d?.pf.parts[0].img, d?.undo.map(s => s.pf.parts[0].img), JSON.parse(d?.base ?? 'null')?.parts[0].img, (await pfDisk()).other.parts[0].img, (await pfDisk()).tpf.parts[0].img];
        await sc.saveDraft();
        out.draftSave = [(await pfDisk()).other.parts[0], sc.S.draft];
        return out;
    });

    t.eq('右鍵選單：只有 prefabs/<id>/ 的單張圖（縮圖、其他資料夾沒有）', JSON.stringify(r.menuable), JSON.stringify([true, null, null]));
    t.eq('檔名不合法：空白／有空白／prefab-／只差大小寫／撞 key 都擋', JSON.stringify(r.bad.map(([v]) => v)), JSON.stringify([null, null, null, null, null]));
    t.check('檔名不合法有說原因', r.bad.every(([, s]) => s), JSON.stringify(r.bad));
    t.eq('改名：png 改名、prefab.json 兩筆＋scenes.json 擺設一起改', JSON.stringify(r.rename), JSON.stringify([{to: 'zz-c'}, true, false, 'zz-c', 'zz-c', 'zz-c']));
    t.eq('undo：png 改回原名、json 回去', JSON.stringify(r.undo), JSON.stringify([true, false, 'zz-a', 'zz-a']));
    t.eq('redo：再改一次', JSON.stringify(r.redo), JSON.stringify([true, 'zz-c']));
    t.check('別處有引用：擋下並列出', r.blockText);
    t.eq('擋下：沒改名', JSON.stringify(r.block), JSON.stringify([null, true]));
    t.check('刪除有引用：擋下並列出', r.delBlockText);
    t.eq('刪除擋下：檔案還在', JSON.stringify(r.delBlock), JSON.stringify([null, true]));
    t.eq('刪除：搬到 .tbd/prefabs/<id>/', JSON.stringify(r.del), JSON.stringify([{gone: true}, false, true]));
    t.eq('undo 刪除：搬回來', JSON.stringify(r.delUndo), JSON.stringify([true, false]));
    t.check('改零件開始草稿', r.draft0);
    t.eq('草稿中改名：草稿、草稿 undo 快照、base 都換新 key，prefab.json 也改了', JSON.stringify(r.draft), JSON.stringify([true, 'zz-e', ['zz-e'], 'zz-e', 'zz-e', 'zz-e']));
    t.eq('儲存草稿：寫新 key', JSON.stringify(r.draftSave), JSON.stringify([{img: 'zz-e', x: 3, y: 7}, null]));
});
