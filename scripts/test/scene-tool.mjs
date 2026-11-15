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
        for (const f of ['role.json', 'item.json', 'ability.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
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

        // ---------- 第 3 步：動作 ----------
        const G = game().__dbg.GM;
        const hits = [];
        const spy = (k) => {const p = pup(k), take = p.takeDamage; p.takeDamage = (d, a) => {hits.push([k, d.type ?? 'dmg', d.amount]); take(d, a);};};
        const hp = (k) => [pup(k).total.states[G.HP], pup(k).total[G.HPMAX], pup(k).isAlive];
        spy('r2');
        // 指定目標：分頁按 🎯 → sandbox 進指定模式；點角色＝普攻（遠了就原地揮，照樣命中）
        sc.pickRole('r1');
        sc.S.act = 'attack';
        sc.arm(true);
        out.arm = await until(() => sb()._arm?.kind === 'attack') && [sb()._arm.key, doc.querySelector('[data-k="arm"]').textContent];
        const tr2 = tileOf(pup('r2'));
        await sb()._do({...sb()._arm, tx: tr2[0], ty: tr2[1], tkey: 'r2'});
        out.attack = [hits.length, hp('r2')];
        // 致命一擊也不會死：扣完剛好滿血
        pup('r2').takeDamage({amount: -99999}, pup('r1'));
        out.lethal = hp('r2');
        // 空白鍵重播上一個
        const n0 = hits.length;
        sc.toGame({sb: 'replay'});
        out.replay = await until(() => hits.length > n0 && !pup('r1')._busy);

        // 技能（忽略射程）：fireball 打 r2；firewall 放在空格生出區域
        hits.length = 0;
        await sb()._do({key: 'r1', kind: 'ability', id: 'fireball', tx: tr2[0], ty: tr2[1], tkey: 'r2'});
        out.fireball = [hits.length > 0, hp('r2')[2], doc.getElementById('status').textContent.includes('放不出來')];
        await sb()._do({key: 'r1', kind: 'ability', id: 'firewall', tx: 3, ty: 10});
        out.firewall = Object.values(sb().gos).some(g => g.constructor.name === 'HazardZone');

        // 走路：真的沿路徑走過去、不寫檔；重置回場景檔的位置
        const before3 = await disk();
        await sb()._do({key: 'r1', kind: 'walk', tx: 5, ty: 8});
        out.walk = [tileOf(pup('r1')), await disk() === before3];
        sc.toGame({sb: 'reset'});
        await until(() => pup('r1') && tileOf(pup('r1')).join() === '5,4');
        out.reset = [tileOf(pup('r1')), Object.values(sb().gos).some(g => g.constructor.name === 'HazardZone' && g.active)];

        // 倒地／復活
        sc.toGame({sb: 'die', key: 'r2'});
        const dead = await until(() => pup('r2').isAlive === false);
        sc.toGame({sb: 'revive', key: 'r2'});
        out.die = [dead, await until(() => pup('r2').isAlive === true)];

        // sandbox 右鍵取消、Esc 取消
        sb()._send({sb: 'disarm'});
        out.disarm = await until(() => sc.S.arm === null);
        sc.arm(true);
        sb()._send({sb: 'key', key: 'Escape'});
        out.esc = await until(() => sc.S.arm === null && sb()._arm === null);

        // ---------- 第 4 步：擺設 ----------
        const tex = await (await fetch('/assets/json/textures.json')).json();
        const [tkey, turl] = Object.entries(tex.image)[0];
        const prop = (k) => sb()._props[k];
        await sc.addProp(tkey, 200, 200);
        out.prop = await until(() => prop('p1')) && [(await scDisk()).props, sc.S.pick, prop('p1').sp.texture.key, [prop('p1').sp.x, prop('p1').sp.y, prop('p1').sp.depth],
                                                     [prop('p1').sp.originX, prop('p1').sp.originY], prop('p1').sp.pipeline?.name, doc.querySelector('#right .sec').textContent];
        // 外部 png（還沒放進 textures/ 也行）：file:<相對專案路徑>
        await sc.addProp(`file:public/assets/${turl}`, 300, 200);
        out.file = await until(() => prop('p2')) && [prop('p2').sp.texture.key, prop('p2').sp.width > 0];
        await sc.addProp('no-such-tex', 0, 0);
        out.badTex = await until(() => doc.getElementById('status').textContent.includes('載不到圖')) && !prop('p3');
        await sc.deleteObj('p3');

        // 屬性
        await sc.setProp('p1', {scale: 2, flip: true, angle: 30, ox: 0, oy: 0.5, depth: 5});
        out.attrs = await until(() => prop('p1')?.sp.scaleX === 2) && [prop('p1').sp.flipX, prop('p1').sp.angle, prop('p1').sp.originX, prop('p1').sp.originY, prop('p1').sp.depth];
        const nl = () => sb().lights.lights.length;
        const l0 = nl();
        await sc.setProp('p1', {light: {r: 150, color: '#ff0000', i: 2, y: -10}});
        out.light = await until(() => nl() === l0 + 1) && (() => {const l = sb().lights.lights.at(-1); return [l.radius, l.intensity, l.y, Math.round(l.color.r * 255)];})();
        await sc.setProp('p1', {light: undefined});
        out.unlight = await until(() => nl() === l0);

        // 拖曳放開／方向鍵（Shift＝一格）
        sb()._send({sb: 'moveProp', key: 'p1', x: 208, y: 224});
        out.moveProp = await until(async () => (await scDisk()).props[0].x === 208) && [prop('p1')?.sp.x, prop('p1')?.sp.y];
        sc.pickRole('p1');
        sb()._send({sb: 'key', key: 'ArrowRight'});
        await until(async () => (await scDisk()).props[0].x === 209);
        sb()._send({sb: 'key', key: 'ArrowDown', shift: true});
        out.nudge = await until(async () => (await scDisk()).props[0].y === 256) && [(await scDisk()).props[0].x, (await scDisk()).props[0].y];
        // 點選：擺設也點得到
        out.pickProp = await until(() => prop('p1')?.sp.y === 256) && sb()._pickAt(prop('p1').sp.getBounds().centerX, prop('p1').sp.getBounds().centerY)?.key;
        out.tree2 = [...doc.querySelectorAll('#tree .item')].map(e => e.dataset.key);
        sb()._send({sb: 'key', key: 'Delete'});
        out.delProp = await until(() => !prop('p1')) && (await scDisk()).props.map(p => p.key);
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
    t.eq('sandbox 右鍵：放角色／擺設＋刪除', JSON.stringify(r.ctx), JSON.stringify(['在這裡放角色…（3, 3）', '在這裡放擺設…', '刪除 mary']));
    t.eq('👁 暫藏：不寫檔、點不到', JSON.stringify(r.hide), JSON.stringify([true, true]));
    t.eq('sandbox 裡按 Del：刪選中的', JSON.stringify(r.delRole), JSON.stringify([null, 'r1']));
    t.eq('sandbox 裡按 Ctrl+Z：復原、選回去', JSON.stringify(r.undoDel), JSON.stringify([['r1', 'r2'], 'r2']));

    t.eq('🎯 指定目標：sandbox 進指定模式、按鈕變取消', JSON.stringify(r.arm), JSON.stringify(['r1', '🎯 取消']));
    t.check('普攻：走真的傷害、打完滿血', r.attack[0] === 1 && r.attack[1][0] === r.attack[1][1] && r.attack[1][2], JSON.stringify(r.attack));
    t.check('致命一擊不會死、滿血', r.lethal[0] === r.lethal[1] && r.lethal[2], JSON.stringify(r.lethal));
    t.check('空白鍵重播上一個動作', r.replay);
    t.eq('技能（忽略射程）：fireball 命中、目標沒死、沒報錯', JSON.stringify(r.fireball), JSON.stringify([true, true, false]));
    t.check('技能：firewall 在空格生出區域', r.firewall);
    t.eq('走路：沿路徑走到那格、不寫檔', JSON.stringify(r.walk), JSON.stringify([[5, 8], true]));
    t.eq('重置：回到場景檔的位置、火牆清掉', JSON.stringify(r.reset), JSON.stringify([[5, 4], false]));
    t.eq('倒地／復活', JSON.stringify(r.die), JSON.stringify([true, true]));
    t.check('sandbox 右鍵取消指定', r.disarm);
    t.check('Esc 取消指定（分頁跟 sandbox 都清掉）', r.esc);

    const p0 = r.prop;
    t.check('放擺設：寫檔、選起來、sandbox 用那張圖、錨點底部中間、深度＝y、受光', p0 && p0[0]?.[0]?.key === 'p1' && p0[1] === 'p1' && p0[3].join() === '200,200,200' && p0[4].join() === '0.5,1' && p0[5] === 'Light2D' && p0[6] === '擺設 p1', JSON.stringify(p0));
    t.check('外部 png：用網址載入', r.file?.[0]?.startsWith('file:') && r.file[1], JSON.stringify(r.file));
    t.check('載不到的圖：提示、不建', r.badTex);
    t.eq('屬性：翻轉、角度、錨點、深度＝y＋偏移', JSON.stringify(r.attrs), JSON.stringify([true, 30, 0, 0.5, 205]));
    t.eq('發光：加一盞燈（半徑、強度、位移、顏色）', JSON.stringify(r.light), JSON.stringify([150, 2, 190, 255]));
    t.check('取消發光：燈拿掉', r.unlight);
    t.eq('拖曳放開：寫檔、sandbox 跟著', JSON.stringify(r.moveProp), JSON.stringify([208, 224]));
    t.eq('方向鍵 1px、Shift＋方向鍵一格', JSON.stringify(r.nudge), JSON.stringify([209, 256]));
    t.eq('擺設點得到', r.pickProp, 'p1');
    t.eq('左欄：角色跟擺設都列', JSON.stringify(r.tree2), JSON.stringify(['r1', 'r2', 'p1', 'p2']));
    t.eq('Del 刪擺設', JSON.stringify(r.delProp), JSON.stringify(['p2']));
});
