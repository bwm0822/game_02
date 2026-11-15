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
        // 先等分頁寫完，不然 OPFS 讀到寫一半的檔會 NotReadableError
        const disk = async () => {
            await sc.flush();
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

        // ---------- 第 2 步：角色 ----------
        const json = await proj.getDirectoryHandle('public').then(d => d.getDirectoryHandle('assets')).then(d => d.getDirectoryHandle('json'));
        for (const f of ['role.json', 'item.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
        await T.setProject(proj);
        await until(() => Object.keys(sc.S.refs.roles).length && JSON.stringify(Object.keys(sc.S.data)) === '["x"]');
        await sc.select('x');
        const sb = () => game().__sb;
        const pup = (k) => sb().roles.find(p => p.key === k);
        const tileOf = (p) => sb().map.worldToTile(p.x, p.y);
        const scDisk = async () => JSON.parse(await disk()).x;

        await sc.addRole('mary', 5, 4);
        await sc.addRole('wick', 8, 4);
        out.add2 = await until(() => sb().roles.length === 2) && [(await scDisk()).roles, sc.S.pick, tileOf(pup('r1')), pup('r2').id, !!sb()._roleAt(pup('r1').x, pup('r1').y - 8)];
        out.tree = [...doc.querySelectorAll('#tree .item .id')].map(e => e.textContent);
        out.right = doc.querySelector('#right .sec')?.textContent;
        await sc.addRole('nobody', 1, 1);
        out.noRole = doc.getElementById('status').textContent;

        // 裝備覆寫：武器換掉、空著、拿掉＝回 role.json 的
        const wpn = Object.entries(sc.S.refs.items).find(([, it]) => it.cat === 'CAT_WEAPON' && it.equip && !it.sex)[0];
        const eqIds = (k) => (pup(k)?.bb.equips ?? []).map(e => e?.id ?? e);
        const orig = eqIds('r2');
        await sc.setEquip('r2', 'CAT_WEAPON', wpn);
        const cat = (ids) => ids.filter(id => sc.S.refs.items[id]?.cat === 'CAT_WEAPON');
        out.eqSet = await until(() => eqIds('r2').includes(wpn)) && [(await scDisk()).roles[1].equip, JSON.stringify(cat(eqIds('r2'))) === JSON.stringify([wpn]),
                                                                     eqIds('r2').length - cat(eqIds('r2')).length === orig.length - cat(orig).length];
        await sc.setEquip('r2', 'CAT_WEAPON', '');
        out.eqEmpty = await until(() => !eqIds('r2').includes(wpn)) && eqIds('r2').filter(id => sc.S.refs.items[id]?.cat === 'CAT_WEAPON');
        await sc.setEquip('r2', 'CAT_WEAPON', undefined);
        out.eqOrig = await until(() => eqIds('r2').length === orig.length) && [(await scDisk()).roles[1].equip, JSON.stringify(eqIds('r2')) === JSON.stringify(orig)];

        // 面向
        await sc.setRole('r1', {face: 'l'});
        const fl = await until(() => pup('r1')?.faceDir() === -1);
        await sc.setRole('r1', {face: 'r'});
        out.face = [fl, await until(() => pup('r1')?.faceDir() === 1)];

        // sandbox 回報：點選、拖曳放開、右鍵、Del
        sb()._send({sb: 'select', key: 'r2'});
        out.pick = await until(() => sc.S.pick === 'r2') && doc.querySelector('#tree .item.sel')?.dataset.key;
        sb()._send({sb: 'move', key: 'r2', tx: 9, ty: 6});
        out.move = await until(async () => (await scDisk()).roles[1].tx === 9) && await until(() => tileOf(pup('r2') ?? {x: 0, y: 0}).join() === '9,6');
        sb()._send({sb: 'ctx', tx: 3, ty: 3, key: 'r1', cx: 10, cy: 10});
        out.ctx = await until(() => doc.querySelector('.ctxmenu')) && [...doc.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        doc.querySelector('.ctxmenu').remove();

        // 👁 只藏 sandbox、不寫檔
        const before = await disk();
        sc.toggleHide('r1');
        out.hide = await until(() => pup('r1').visible === false) && [await disk() === before, !sb()._roleAt(pup('r1').x, pup('r1').y - 8)];
        sc.toggleHide('r1');

        sb()._send({sb: 'key', key: 'Delete'});
        out.delRole = await until(async () => (await scDisk()).roles.length === 1) && await until(() => sb().roles.length === 1) && [sc.S.pick, sb().roles[0].key];
        sb()._send({sb: 'key', key: 'z', ctrl: true});
        out.undoDel = await until(() => sb().roles.length === 2) && [(await scDisk()).roles.map(r => r.key), sc.S.pick];
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

    t.eq('放角色：寫檔、key 照順序、選起來、sandbox 建在那格、點得到',
         JSON.stringify(r.add2), JSON.stringify([[{key: 'r1', id: 'mary', tx: 5, ty: 4}, {key: 'r2', id: 'wick', tx: 8, ty: 4}], 'r2', [5, 4], 'wick', true]));
    t.eq('左欄角色清單＋右欄屬性', JSON.stringify([r.tree, r.right]), JSON.stringify([['mary', 'wick'], '角色 r2']));
    t.check('role.json 沒有的角色擋下', r.noRole.includes('nobody'), r.noRole);
    t.check('裝備覆寫：武器換成那把、其他格照舊', r.eqSet && r.eqSet[0]?.CAT_WEAPON && r.eqSet[1] && r.eqSet[2], JSON.stringify(r.eqSet));
    t.eq('裝備覆寫：空著＝沒有武器', JSON.stringify(r.eqEmpty), JSON.stringify([]));
    t.eq('裝備覆寫：拿掉＝回 role.json 的、equip 欄位清掉', JSON.stringify(r.eqOrig), JSON.stringify([undefined, true]));
    t.eq('面向左／右', JSON.stringify(r.face), JSON.stringify([true, true]));
    t.eq('sandbox 點選：左欄跟著選', r.pick, 'r2');
    t.check('sandbox 拖曳放開：寫檔、重建在新格子', r.move);
    t.eq('sandbox 右鍵：放角色＋刪除', JSON.stringify(r.ctx), JSON.stringify(['在這裡放角色…（3, 3）', '刪除 mary']));
    t.eq('👁 暫藏：不寫檔、點不到', JSON.stringify(r.hide), JSON.stringify([true, true]));
    t.eq('sandbox 裡按 Del：刪選中的', JSON.stringify(r.delRole), JSON.stringify([null, 'r1']));
    t.eq('sandbox 裡按 Ctrl+Z：復原、選回去', JSON.stringify(r.undoDel), JSON.stringify([['r1', 'r2'], 'r2']));
});
