// 場景分頁（tools/scene）＋遊戲開發版 /?sandbox：Sandbox 場景（不存檔、只建地形＋靜態物件、格線、鏡頭）、tools/scenes.json 讀寫＋undo
import {run} from './harness.mjs'

run('scene-tool', async t => {
    // ---------- 遊戲端 /?sandbox ----------
    await t.page.evaluate(() => localStorage.setItem('game', JSON.stringify({keep: 1})));
    await t.page.goto(new URL('/?sandbox=1', t.page.url()).href);
    await t.page.waitForFunction(() => window.__sb?.map?.map, {timeout: 30000});
    const sb = await t.page.evaluate(() => {
        const s = window.__sb, d = window.__dbg;
        return {map: s.mapName, size: [s.map.map.width, s.map.map.height], roles: s.roles.length, player: !!d.GM.player,
                active: d.game.scene.getScenes(true).map(x => x.sys.settings.key), noSave: d.Record.noSave,
                grid: s._grid.commandBuffer.length > 0};
    });
    t.eq('sandbox：Preloader 完直接進 Sandbox、預設 sandbox 底圖、沒有玩家／角色',
         JSON.stringify([sb.map, sb.size, sb.roles, sb.player, sb.active]), JSON.stringify(['sandbox', [24, 16], 0, false, ['Sandbox']]));
    t.check('sandbox：格線有畫', sb.grid);

    // 不寫存檔：Record.saveGame() 不動 localStorage
    const save = await t.page.evaluate(() => {window.__dbg.Record.saveGame(); return localStorage.getItem('game');});
    t.eq('sandbox：saveGame 不寫存檔', save, JSON.stringify({keep: 1}));

    // 現有地圖：只建地形＋靜態物件，不建 NPC、不跑 @群組
    await t.page.evaluate(() => {window.__loaded = []; addEventListener('message', e => e.data?.sb === 'loaded' && window.__loaded.push(e.data.map)); window.postMessage({sb: 'load', scene: {map: 'm/m_04x05'}}, '*');});
    await t.page.waitForFunction(() => window.__loaded.includes('m/m_04x05'), {timeout: 30000});
    const m = await t.page.evaluate(() => {
        const s = window.__sb;
        const types = new Set(Object.values(s.gos).map(g => g.constructor.name));
        return {map: s.mapName, roles: s.roles.length, gos: Object.keys(s.gos).length, types: [...types].sort(), player: !!window.__dbg.GM.player};
    });
    t.check(`現有地圖：只建靜態物件（${m.gos} 個：${m.types.join('、')}），不建角色`, m.map === 'm/m_04x05' && m.roles === 0 && m.gos > 0 && !m.player, JSON.stringify(m));

    // ---------- 場景分頁 ----------
    await t.page.goto(new URL('/tools/#scene', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__sc);
    const r = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f, n = 500) => {for (let i = 0; i < n && !await f(); i++) await sleep(20); return f();};
        const win = T.S.frames.scene.contentWindow, sc = win.__sc, doc = win.document;
        const game = () => doc.getElementById('game').contentWindow;

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        await write(await dir(proj, 'public', 'assets', 'json'), 'item.json', '{}');
        const disk = async () => {
            const fh = await (await proj.getDirectoryHandle('tools').catch(() => null))?.getFileHandle('scenes.json').catch(() => null);
            return fh ? await (await fh.getFile()).text() : null;
        };

        out.boot = await until(() => sc.S.ready && game()?.__sb?.map) && [game().__sb.mapName, game().__dbg.Record.noSave];
        await T.setProject(proj);
        out.empty = await until(() => sc.S.root) && [JSON.stringify(sc.S.data), await disk(), doc.getElementById('list').textContent];

        // 新增：立刻寫 tools/scenes.json、選起來
        await sc.addScene('夜晚');
        await sc.addScene('白天');
        out.add = [JSON.parse(await disk()), sc.S.sel, [...doc.querySelectorAll('#list .item .id')].map(e => e.textContent)];
        await sc.renameScene('白天', '正午');
        await sc.dupScene('夜晚', '夜晚2');
        out.edit = [Object.keys(JSON.parse(await disk())), sc.S.sel];
        await sc.addScene('夜晚');
        out.dupName = doc.getElementById('status').textContent;
        await sc.deleteScene('夜晚2', true);
        out.del = [Object.keys(JSON.parse(await disk())), sc.S.sel];

        // undo／redo：寫回硬碟、選取跟著回去
        sc.undo(); await sc.flush();
        out.undo = [Object.keys(JSON.parse(await disk())), sc.S.sel];
        sc.undo(); await sc.flush();
        out.undo2 = [Object.keys(JSON.parse(await disk())), sc.S.sel];
        sc.redo(); await sc.flush();
        out.redo = [Object.keys(JSON.parse(await disk())), sc.S.sel];

        // 別處改過檔：undo 不蓋、留在堆疊
        const ext = JSON.stringify({x: {map: 'sandbox'}}, null, 2) + '\n';
        await write(await proj.getDirectoryHandle('tools'), 'scenes.json', ext);
        sc.undo(); await sc.flush();
        out.conflict = [await disk() === ext, doc.getElementById('status').textContent.includes('別處改過'), sc.S.undo.length > 0];

        // 換底圖：sandbox 重開那張圖（step 6 才有 UI，這裡直接寫資料）
        await win.__sc.select('x');
        out.sel = await until(() => game().__sb?.mapName === 'sandbox' && game().__sb._scene?.map === 'sandbox');
        // 格線開關送進 sandbox、記住
        const chk = doc.getElementById('chkGrid');
        chk.checked = false; chk.dispatchEvent(new Event('change'));
        out.grid = await until(() => game().__sb._gridOn === false) && [game().__sb._grid.commandBuffer.length, localStorage.getItem('tools.scene.grid')];
        chk.checked = true; chk.dispatchEvent(new Event('change'));
        return out;
    });
    t.eq('分頁：iframe 跑 /?sandbox、不寫存檔', JSON.stringify(r.boot), JSON.stringify(['sandbox', true]));
    t.eq('分頁：沒有 scenes.json＝空清單、不建檔', JSON.stringify(r.empty?.slice(0, 2)), JSON.stringify(['{}', null]));
    t.eq('新增：立刻寫 tools/scenes.json、選起來、清單照順序', JSON.stringify(r.add),
         JSON.stringify([{'夜晚': {map: 'sandbox'}, '白天': {map: 'sandbox'}}, '白天', ['夜晚', '白天']]));
    t.eq('改名保留順序、選取跟著改；複製選到新的', JSON.stringify(r.edit), JSON.stringify([['夜晚', '正午', '夜晚2'], '夜晚2']));
    t.check('重名擋下、提示', r.dupName.includes('已經有'), r.dupName);
    t.eq('刪除選中的＝取消選取', JSON.stringify(r.del), JSON.stringify([['夜晚', '正午'], null]));
    t.eq('undo 刪除：回來、選回去', JSON.stringify(r.undo), JSON.stringify([['夜晚', '正午', '夜晚2'], '夜晚2']));
    t.eq('undo 複製：選回複製前選的', JSON.stringify(r.undo2), JSON.stringify([['夜晚', '正午'], '正午']));
    t.eq('redo 複製', JSON.stringify(r.redo), JSON.stringify([['夜晚', '正午', '夜晚2'], '夜晚2']));
    t.eq('別處改過：undo 不蓋檔、提示、步驟留著', JSON.stringify(r.conflict), JSON.stringify([true, true, true]));
    t.check('選場景：送進 sandbox', r.sel);
    t.eq('格線：開關送進 sandbox、記在 localStorage', JSON.stringify(r.grid), JSON.stringify([0, '0']));
});
