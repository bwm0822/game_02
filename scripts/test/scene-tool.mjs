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
        for (const f of ['role.json', 'item.json', 'ability.json', 'fx.json', 'particle.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
        const maps = await dir(proj, 'public', 'assets', 'maps');
        for (const f of ['sandbox.json', '_m_00x00.json']) await write(maps, f, '{}');
        await write(await dir(maps, 'm'), 'm_04x05.json', '{}');
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
        const cur = () => sb().game.canvas.style.cursor;
        sb()._cursor({worldX: pup('r2').x, worldY: pup('r2').y - 8});
        out.armCursor = cur();
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
        // 錨點：選中的擺設＝sprite x/y、角色＝root x/y；工具列沒勾就不畫、記 localStorage
        await until(() => sb()._sel === 'p1');
        const ap = () => sb()._anchorPt();
        out.anchorProp = [ap(), {x: prop('p1').sp.x, y: prop('p1').sp.y}];
        sc.pickRole('r1');
        await until(() => sb()._sel === 'r1');
        out.anchorRole = [ap(), {x: pup('r1').x, y: pup('r1').y}];
        const chkA = doc.getElementById('chkAnchor');
        chkA.checked = false; chkA.dispatchEvent(new Event('change'));
        out.anchorOff = await until(() => ap() === null) && [ap(), localStorage.getItem('tools.scene.anchor')];
        chkA.checked = true; chkA.dispatchEvent(new Event('change'));
        out.anchorOn = await until(() => ap() !== null) && localStorage.getItem('tools.scene.anchor');
        sc.pickRole('p1');
        await until(() => sb()._sel === 'p1');

        // 外部 png（還沒放進 textures/ 也行）：file:<相對專案路徑>
        await sc.addProp(`file:public/assets/${turl}`, 300, 200);
        out.file = await until(() => prop('p2')) && [prop('p2').sp.texture.key, prop('p2').sp.width > 0];
        await sc.addProp('no-such-tex', 0, 0);
        out.badTex = await until(() => doc.getElementById('status').textContent.includes('載不到圖')) && !prop('p3');
        await sc.deleteObj('p3');

        // 屬性
        await sc.setProp('p1', {sx: 2, sy: 2, flip: true, angle: 30, ox: 0, oy: 0.5, depth: 5});
        out.attrs = await until(() => prop('p1')?.sp.scaleX === 2) && [prop('p1').sp.flipX, prop('p1').sp.angle, prop('p1').sp.originX, prop('p1').sp.originY, prop('p1').sp.depth];

        // 大小：sx/sy 分開；pct 只對 file: 圖、乘進畫面
        await sc.setProp('p1', {sy: 3, pct: 50});
        out.sxy = await until(() => prop('p1')?.sp.scaleY === 3) && [prop('p1').sp.scaleX, prop('p1').sp.scaleY];
        await sc.setProp('p1', {sy: 2, pct: undefined});
        await sc.setProp('p2', {pct: 50, sx: 2, sy: 2});
        out.pct = await until(() => prop('p2')?.sp.scaleX === 1) && prop('p2').sp.scaleY;

        // 面板：寬高照鎖改 sx/sy 或 pct、等比勾選
        win.localStorage.removeItem('tools.scene.sizeLock');
        const p2 = async () => (await scDisk()).props.find(p => p.key === 'p2');
        const pick = (k) => doc.querySelector(`#right [data-k="${k}"]`);
        const setIn = (k, v) => {const e = pick(k); e.value = v; e.dispatchEvent(new win.Event('change'));};
        const src = await until(() => sc.srcSize(prop('p2').data.img));
        sc.pickRole('p2');
        out.wh0 = await until(() => pick('w')?.value === String(src.w)) && [pick('w').value, pick('h').value, !!pick('sy'), pick('ratio').checked, !!pick('pct'), pick('lock')?.value];
        out.dims = [pick('srcDim')?.textContent, pick('bakedDim')?.textContent, `原圖 ${src.w}×${src.h}`, `縮放後 ${Math.round(src.w / 2)}×${Math.round(src.h / 2)}`];
        setIn('w', src.w * 2);
        out.wLinked = await until(async () => (await p2()).sx === 4) && [(await p2()).sx, (await p2()).sy, (await p2()).pct];
        pick('ratio').click();
        out.unlinked = await until(() => pick('sy')) && !!pick('sy');
        setIn('h', src.h);
        out.hFree = await until(async () => (await p2()).sy === 2) && [(await p2()).sx, (await p2()).sy];
        setIn('lock', 'scale');
        await until(() => pick('lock')?.value === 'scale' && sb()._size?.lock === 'scale');
        setIn('w', src.w);
        out.wPct = await until(async () => (await p2()).pct === 25) && [(await p2()).pct, (await p2()).sx, (await p2()).sy];
        pick('ratio').click();
        out.relink = await until(async () => (await p2()).sy === 4) && [(await p2()).sx, (await p2()).sy, !pick('sy')];
        win.localStorage.removeItem('tools.scene.sizeLock');

        // 存檔：縮成 pct% 另存，場景不動；撞名擋
        await dir(proj, 'images', 'scene');
        const before4 = await disk();
        const baked = await sc.bakeProp('p2', 'images/scene', 'baked.png');
        const bfh = await (await dir(proj, 'images', 'scene')).getFileHandle('baked.png');
        const bimg = await createImageBitmap(await bfh.getFile());
        out.bake = [baked.path, [baked.w, baked.h], [bimg.width, bimg.height], [Math.max(1, Math.round(src.w / 4)), Math.max(1, Math.round(src.h / 4))], await disk() === before4];
        out.bakeDup = await sc.bakeProp('p2', 'images/scene', 'baked').then(() => '', e => e.message);
        await write(await dir(proj, 'public', 'assets', 'textures', 'sub'), 'Baked2.png', 'x');
        out.bakeKey = await sc.bakeProp('p2', 'public/assets/textures', 'baked2').then(() => '', e => e.message);
        out.bakeOver = await sc.bakeProp('p2', 'images/scene', 'baked', true).then(r => r.path, e => e.message);
        out.bakeOverKey = await sc.bakeProp('p2', 'public/assets/textures/sub', 'Baked2', true).then(r => r.path, e => e.message);
        const own = `public/assets/${turl}`, ownDir = own.split('/').slice(0, -1).join('/'), ownName = own.split('/').pop().slice(0, -4);
        out.bakeOwn = await sc.bakeProp('p2', ownDir, ownName, true).then(() => '', e => e.message);
        // textures.json 更新（存檔進 textures/ 後 vite watcher→殼廣播）：sandbox 不重開，只補載缺的 key；缺圖的木偶重建、其他不動
        const gw = game();
        gw.__keep = 1;
        const missTex = (o) => o.texture?.key === '__MISSING' || (o.list ?? []).some(missTex);
        const texOf = (k) => {const ks = new Set(); const walk = (o) => {if (o.texture) ks.add(o.texture.key); (o.list ?? []).forEach(walk);}; walk(pup(k)); return ks;};
        const r2Tex = texOf('r2'), r1Tex = [...texOf('r1')].find(k => tex.image[k] && !r2Tex.has(k));
        // 同一個 task 裡拿掉圖＋重建，中間不會畫到被拿掉的圖
        sb().textures.remove(r1Tex);
        sb()._apply(sb()._scene, {force: true});
        const missing = await until(() => pup('r1') && missTex(pup('r1')));
        const r2obj = pup('r2');
        new BroadcastChannel('tools').postMessage({type: 'saved', file: 'textures.json'});
        const healed = await until(() => sb().textures.exists(r1Tex) && pup('r1') && !missTex(pup('r1')));
        out.texReload = [missing, healed, game() === gw && gw.__keep === 1, pup('r2') === r2obj];
        // 存檔框的樹：資料夾後面列 .png、點檔案回傳所在資料夾＋檔名、原圖標灰
        await write(await dir(proj, 'images', 'scene'), 'note.txt', 'x');
        await write(await dir(proj, 'images', 'scene', 'zz'), 'a.png', 'x');
        const picks = [];
        const ft = sc.folderTree('images', 'images/scene', (p, f) => picks.push([p, f ?? null]), 'images/scene/BAKED.png');
        doc.body.append(ft.el);
        const rows = () => [...ft.el.querySelectorAll('.fold')].map(e => e.textContent.replace(/^[▸▾]/, ''));
        await until(() => rows().includes('🖼 baked.png'));
        out.ftree = rows();
        const frow = ft.el.querySelector('.fold.file');
        frow.click();
        out.treePick = [picks.at(-1), frow.classList.contains('dim'), frow.classList.contains('sel')];
        ft.el.remove();
        // 存檔框：iframe 很矮時外框不捲、按鈕看得到、只有樹縮
        const ifr = T.S.frames.scene, oldH = ifr.style.height;
        ifr.style.height = '360px';
        await until(() => win.innerHeight <= 360);
        sc.exportProp('p2');
        const dlg = doc.getElementById('dlgAsk');
        await until(() => dlg.open && dlg.querySelector('.treebox .fold'));
        const tb = dlg.querySelector('.treebox'), btn = dlg.querySelector('.buttons button').getBoundingClientRect();
        const noScroll = (e) => e.scrollHeight <= e.clientHeight + 1;
        out.dlgFit = [noScroll(dlg), noScroll(dlg.querySelector('.body')), btn.bottom <= win.innerHeight, tb.clientHeight < 280, tb.clientHeight >= 80];
        // 預設檔名：textures＝原名、原始路徑＝-copy；切模式沒改過才跟著換
        const nameIn = dlg.querySelector('.body input:not([type])'), radio = (v) => dlg.querySelector(`input[name=exMode][value=${v}]`);
        const setMode = (v) => {radio(v).checked = true; radio(v).dispatchEvent(new Event('change'));};
        const ownBase = turl.split('/').pop().slice(0, -4);
        setMode('tex');
        const nTex = nameIn.value;
        setMode('home');
        const nHome = nameIn.value;
        nameIn.value = 'mine';
        setMode('tex');
        out.defName = [nTex === ownBase, nHome === `${ownBase}-copy`, nameIn.value];
        dlg.close('cancel');
        ifr.style.height = oldH;
        await until(() => win.innerHeight > 360);

        // 畫面上拉大小：8 個把手、對邊固定；鎖 % 改 sx/sy（等比照勾選）、鎖 scale 改 pct；Shift 吸 16px；有角度不出把手
        win.localStorage.removeItem('tools.scene.sizeLock');
        await sc.setProp('p2', {pct: undefined, sx: undefined, sy: undefined, x: 300, y: 200});
        sc.pickRole('p2');
        await until(() => prop('p2')?.sp.scaleX === 1 && sb()._sel === 'p2' && sb()._size?.lock === 'pct');
        const r4t = (v) => Math.round(v * 10000) / 10000;
        const bnd = () => {const b = prop('p2').sp.getBounds(); return {l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height};};
        const drag = (hx, hy, wx, wy, shift = false) => {
            const s = sb(), hd = s._handles().find(x => x.hx === hx && x.hy === hy);
            if (!hd || s._handleAt(hd.x, hd.y)?.hx !== hx) return false;
            s._startResize(hd);
            s._resizeTo(s._drag, wx, wy, shift);
            s._endDrag();
            return true;
        };
        const b0 = bnd();
        out.handles = sb()._handles().length;
        out.dragR = drag(1, 0, b0.r + b0.w, b0.t) && await until(async () => (await p2()).sx === 2) && [(await p2()).sx, (await p2()).sy, (await p2()).x, (await p2()).y, b0.l + b0.w];
        await until(() => prop('p2')?.sp.scaleX === 2);
        pick('ratio').click();
        await until(() => sb()._size?.ratio === false);
        const b1 = bnd();
        out.dragB = drag(0, 1, b1.l, b1.b + 10, true) && await until(async () => (await p2()).y === 208) && [(await p2()).sx, (await p2()).sy, r4t((2 * (208 - b1.t)) / b1.h)];
        await until(() => prop('p2')?.data.y === 208);
        setIn('lock', 'scale');
        await until(() => sb()._size?.lock === 'scale');
        const b2 = bnd();
        out.dragTL = drag(-1, -1, b2.l - b2.w / 2, b2.t) && await until(async () => (await p2()).pct === 150) && await until(() => prop('p2')?.data.pct === 150) &&
            (() => {const b = bnd(); return [Math.abs(b.r - b2.r) < 0.6, Math.abs(b.b - b2.b) < 0.6, prop('p2').data.sx, prop('p2').data.sy];})();
        win.localStorage.removeItem('tools.scene.sizeLock');
        await sc.setProp('p2', {angle: 30});
        out.noHandle = await until(() => prop('p2')?.data.angle === 30) && sb()._handles().length;
        await sc.setProp('p2', {angle: undefined, pct: undefined, sx: undefined, sy: undefined, x: 300, y: 200});

        // 右欄把手：拖左邊框改寬、記 localStorage、雙擊回預設
        const right = doc.getElementById('right'), grip = doc.querySelector('.right-grip');
        const rw0 = right.getBoundingClientRect().width;
        const pe = (type, x) => grip.dispatchEvent(new win.PointerEvent(type, {clientX: x, button: 0, bubbles: true}));
        pe('pointerdown', 500); pe('pointermove', 400); pe('pointerup', 400);
        out.rgrip = [grip.previousElementSibling?.id, rw0, right.getBoundingClientRect().width, win.localStorage.getItem('tools.right.scene')];
        grip.dispatchEvent(new win.MouseEvent('dblclick', {bubbles: true}));
        out.rgripReset = [right.getBoundingClientRect().width, win.localStorage.getItem('tools.right.scene')];

        // 拉右欄／左欄：場景裡的東西在螢幕上不動（zoom 不是 1 也一樣）
        const cam = () => sb().cameras.main;
        cam().setZoom(1.5);
        await sleep(50);
        const scr = () => {const c = cam(), f = doc.getElementById('game').getBoundingClientRect(); c.preRender();
                           const p = c.matrix.transformPoint(300 - c.scrollX, 200 - c.scrollY); return [Math.round(f.left + p.x), Math.round(f.top + p.y)];};
        const gripDrag = async (g, x0, x1) => {
            const w0 = cam().width;
            const p = (type, x) => g.dispatchEvent(new win.PointerEvent(type, {clientX: x, button: 0, bubbles: true}));
            p('pointerdown', x0); p('pointermove', x1); p('pointerup', x1);
            await until(() => cam().width !== w0);
        };
        const s0 = scr();
        await gripDrag(grip, 500, 380);
        const s1 = scr();
        const lgrip = doc.querySelector('.left-grip');
        await gripDrag(lgrip, 200, 290);
        out.stay = [s0, s1, scr()];
        await gripDrag(lgrip, 290, 200);
        grip.dispatchEvent(new win.MouseEvent('dblclick', {bubbles: true}));
        lgrip.dispatchEvent(new win.MouseEvent('dblclick', {bubbles: true}));
        await sleep(50);
        // 擺設不再有發光
        out.noPropLight = !doc.querySelector('#right [data-k="light"]');

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

        // ---------- 光源 ----------
        const lo = (k) => sb()._lights?.[k];
        const nLights = () => sb().lights.lights.length;
        const nl0 = nLights();
        await sc.addLight(400, 300);
        out.lightAdd = await until(() => lo('l1')) && [(await scDisk()).lights, sc.S.pick, doc.querySelector('#right .sec').textContent, sb()._pickAt(400, 300)?.key,
                                                      lo('l1').light.radius, lo('l1').light.intensity === 1, !!doc.querySelector('#tree [data-key="l1"]'), nLights() === nl0 + 1];
        await sc.setLight('l1', {i: 2, color: '#ff0000'});
        out.lightFixed = await until(() => lo('l1')?.light.intensity === 2) && [Math.round(lo('l1').light.color.r * 255), Math.round(lo('l1').light.color.g * 255)];
        await sc.setLight('l1', {i: undefined});
        // 強度不跟環境光變（日夜交給 shader）
        await until(() => lo('l1')?.light.intensity === 1);
        await sc.setField('ambient', '#101010');
        await until(() => sb().lights.ambientColor.r < 0.1);
        out.lightAuto = lo('l1').light.intensity;
        await sc.setField('ambient', undefined);
        // 跟著擺設：下拉換對象位置換算、畫面不動；擺設搬了光跟著
        sc.pickRole('l1');
        const folSel = await until(() => doc.querySelector('#right [data-k="follow"]'));
        out.folOpts = [...folSel.options].map(o => o.value);
        folSel.value = 'p2'; folSel.dispatchEvent(new Event('change'));
        out.lightFollow = await until(async () => (await scDisk()).lights[0].follow === 'p2') && await until(() => lo('l1')?.target === prop('p2')?.sp) &&
            [(await scDisk()).lights[0].x, (await scDisk()).lights[0].y, sb()._lightPos(lo('l1'))];
        await sc.setProp('p2', {x: 320});
        out.lightFollowMove = await until(() => lo('l1')?.target === prop('p2')?.sp && prop('p2')?.sp.x === 320) && sb()._lightPos(lo('l1')).x;
        // 半徑把手（Shift 吸 16）、拖曳、方向鍵、👁
        await until(() => sb()._sel === 'l1' && sb()._radiusHandle());
        const rh = sb()._radiusHandle();
        out.rHandle = [rh.x - sb()._lightPos(lo('l1')).x, !!sb()._radiusAt(rh.x, rh.y)];
        sb()._drag = {radius: rh.o, key: 'l1'};
        sb()._radiusTo(sb()._drag, rh.x + 50, rh.y, true);
        sb()._endDrag();
        out.radius = await until(async () => (await scDisk()).lights[0].r === 176) && await until(() => lo('l1')?.light.radius === 176);
        sb()._send({sb: 'moveLight', key: 'l1', x: 10, y: 20});
        await until(async () => (await scDisk()).lights[0].x === 10);
        sb()._send({sb: 'key', key: 'ArrowRight'});
        out.lightMove = await until(async () => (await scDisk()).lights[0].x === 11) && [(await scDisk()).lights[0].x, (await scDisk()).lights[0].y];
        sc.toggleHide('l1');
        out.lightHide = await until(() => sb()._hidden.has('l1')) && lo('l1').light.intensity === 0 && !sb()._lightAt(sb()._lightPos(lo('l1')).x, sb()._lightPos(lo('l1')).y);
        sc.toggleHide('l1');
        out.lightUnhide = await until(() => lo('l1')?.light.intensity === 1);
        // 工具列「光源記號」沒勾：選中的照樣點得到，沒選中的點不到；光照不變
        const lAt = () => {const p = sb()._lightPos(lo('l1')); return !!sb()._lightAt(p.x, p.y);};
        const chkL = doc.getElementById('chkLightIcon');
        chkL.checked = false; chkL.dispatchEvent(new Event('change'));
        out.lightIconSel = await until(() => sb()._icons?.light === false) && [lAt(), localStorage.getItem('tools.scene.lightIcon')];
        sc.pickRole('r1');
        out.lightIconOff = await until(() => sb()._sel === 'r1') && [lAt(), lo('l1').light.intensity];
        chkL.checked = true; chkL.dispatchEvent(new Event('change'));
        out.lightIconOn = await until(() => sb()._icons?.light === true) && [lAt(), localStorage.getItem('tools.scene.lightIcon')];
        sc.pickRole('l1');
        await until(() => sb()._sel === 'l1');
        // 聚光燈：光錐空白＝點光源、方向／柔和反灰；填了 arc 變扇形，中線末端把手改方向＋半徑、弧端把手改光錐
        const kDis = (k) => doc.querySelector(`#right [data-k="${k}"]`)?.disabled;
        out.spotOff = await until(() => doc.querySelector('#right [data-k="arc"]')) && [kDis('dir'), kDis('soft'), lo('l1').light.spot];
        await sc.setLight('l1', {arc: 60, dir: 0});
        out.spotOn = await until(() => lo('l1')?.light.spot) && await until(() => kDis('dir') === false) && [lo('l1').light.spot, kDis('soft')];
        const sc0 = sb()._lightPos(lo('l1')), R0 = lo('l1').light.radius;
        const rel = (h) => [Math.round(h.x - sc0.x), Math.round(h.y - sc0.y)];
        out.spotHandles = [rel(sb()._radiusHandle()), sb()._arcHandles().map(rel)];
        const rh2 = sb()._radiusHandle();
        sb()._drag = {radius: rh2.o, key: 'l1', r0: R0, dir0: 0};
        sb()._radiusTo(sb()._drag, sc0.x + 3, sc0.y + 100, true);
        sb()._endDrag();
        out.spotRadius = await until(async () => (await scDisk()).lights[0].dir === 90) && [(await scDisk()).lights[0].r, (await scDisk()).lights[0].dir];
        const ah2 = await until(() => lo('l1')?.light.spot?.dir === 90 && sb()._arcHandles()[0]);
        sb()._drag = {arc: ah2.o, key: 'l1', arc0: 60};
        const a45 = (90 + 45) * Math.PI / 180;
        sb()._arcTo(sb()._drag, sc0.x + 50 * Math.cos(a45), sc0.y + 50 * Math.sin(a45), true);
        sb()._endDrag();
        out.spotArc = await until(async () => (await scDisk()).lights[0].arc === 90) && await until(() => lo('l1')?.light.spot?.arc === 90);
        // 跟著角色：角色朝左 x 偏移跟方向鏡像
        const spr = sb()._puppet('r1');
        const fake = {target: spr, data: {x: 5, y: 3, dir: 30, arc: 60}, light: sb().lights.addLight(0, 0, 10)};
        spr.face({x: spr.x + 50});
        sb()._lightSpot(fake);
        const faceR = [spr.faceDir(), sb()._lightPos(fake).x - spr.x, fake.light.spot.dir];
        spr.face({x: spr.x - 50});
        sb()._lightSpot(fake);
        out.spotMirror = [faceR, [spr.faceDir(), sb()._lightPos(fake).x - spr.x, fake.light.spot.dir]];
        sb().lights.removeLight(fake.light);
        await sc.setLight('l1', {arc: undefined, dir: undefined});
        out.spotBack = await until(() => lo('l1') && !lo('l1').light.spot) && await until(() => kDis('dir') === true);
        // 粒子也能跟擺設
        const sid0 = Object.entries(sc.S.refs.particles).find(([, d]) => d.mode !== 'burst')[0];
        await sc.addEmitter(sid0, 0, 0);
        await sc.setEmitter('e1', {follow: 'p2', x: 0, y: -10});
        out.emProp = await until(() => sb()._emitters?.e1?.target === prop('p2')?.sp) && [sb()._emitPos(sb()._emitters.e1).x === prop('p2').sp.x, sb()._emitPos(sb()._emitters.e1).y === prop('p2').sp.y - 10];
        // 刪掉被跟的擺設：光源、粒子改成不跟、位置換成絕對；undo 回來
        const absL = sb()._lightPos(lo('l1')), absE = sb()._emitPos(sb()._emitters.e1);
        await sc.deleteObj('p2');
        out.detach = await until(async () => !(await scDisk()).props) && (async () => {const d = await scDisk(); return [d.lights[0].follow, d.lights[0].x === absL.x, d.lights[0].y === absL.y, d.particles[0].follow, d.particles[0].x === absE.x, d.particles[0].y === absE.y];})();
        out.detach = await out.detach;
        await sc.undo();
        out.detachUndo = await until(async () => (await scDisk()).props?.[0]?.key === 'p2') && [(await scDisk()).lights[0].follow, (await scDisk()).particles[0].follow];
        await sc.deleteObj('e1');
        await sc.deleteObj('l1');
        out.lightDel = await until(() => !lo('l1')) && [(await scDisk()).lights, nLights() === nl0];

        // ---------- 第 5 步：特效 ----------
        // 狀態特效：加＝fxOn（不重建角色）、tick、解除＝fxOff；存在角色的 fx
        const fxId = Object.keys(sc.S.refs.fx).find(id => !sc.S.refs.fx[id].cell?.flash && sc.S.refs.fx[id].img);
        const fxOn = (k) => Object.keys(pup(k)?.coms?.disp?._fxMap ?? {});
        const r1 = pup('r1');
        await sc.setRole('r1', {fx: [fxId]});
        out.fxOn = await until(() => fxOn('r1').includes(fxId)) && [(await scDisk()).roles[0].fx, pup('r1') === r1];
        sc.pickRole('r1');
        out.fxRow = await until(() => doc.querySelector(`#right [data-fx="${fxId}"]`)) && !!doc.querySelector(`#right [data-fx="${fxId}"] button`);
        sc.toGame({sb: 'fxTick', key: 'r1', id: fxId});
        await sc.setRole('r1', {fx: undefined});
        out.fxOff = await until(() => !fxOn('r1').includes(fxId)) && [(await scDisk()).roles[0].fx, pup('r1') === r1];

        // 粒子發射點：stream 常駐、burst 定時噴；可跟著角色
        const parts = Object.entries(sc.S.refs.particles);
        const sid = parts.find(([, d]) => d.mode !== 'burst')[0], bid = parts.find(([, d]) => d.mode === 'burst')?.[0];
        const em = (k) => sb()._emitters?.[k];
        await sc.addEmitter(sid, 100, 100);
        out.emit = await until(() => em('e1')?.fx?.emitter?.active) && [(await scDisk()).particles, sc.S.pick, doc.querySelector('#right .sec').textContent, sb()._pickAt(100, 100)?.key];
        // 游標：點得到的＝✋、空地＝預設、拖曳中＝✊
        const cursorAt = (x, y) => {sb()._cursor({worldX: x, worldY: y}); return sb().game.canvas.style.cursor;};
        const rr = sb()._pickAt(pup('r1').x, pup('r1').y - 8)?.key;
        out.cursor = [cursorAt(100, 100), rr, cursorAt(pup('r1').x, pup('r1').y - 8), cursorAt(-200, -200)];
        sb()._drag = {emitter: em('e1'), key: 'e1', dx: 0, dy: 0, moved: false};
        out.cursorDrag = cursorAt(100, 100);
        sb()._drag = null;
        if (bid)
        {
            await sc.addEmitter(bid, 150, 100);
            await sc.setEmitter('e2', {every: 300});
            const f0 = await until(() => em('e2')?.fx) && em('e2').fx;
            out.burst = await until(() => em('e2')?.fx !== f0, 100);
        }
        else out.burst = true;
        // 跟著角色：位置變成相對角色，角色重建也跟上
        const r1p = (await scDisk()).roles[0];
        await sc.setEmitter('e1', {follow: 'r1', x: 0, y: -20});
        out.follow = await until(() => em('e1')?.target === pup('r1')) && [sb()._emitPos(em('e1')).x === pup('r1').x, sb()._emitPos(em('e1')).y === pup('r1').y - 20];
        await sc.setRole('r1', {tx: r1p.tx + 1});
        out.followMove = await until(() => em('e1')?.target === pup('r1') && sb()._emitPos(em('e1')).x === pup('r1').x);
        sb()._send({sb: 'moveEmitter', key: 'e1', x: 4, y: -24});
        out.moveEm = await until(async () => (await scDisk()).particles[0].x === 4);
        sc.toggleHide('e1');
        out.hideEm = await until(() => em('e1')?.fx?.emitter?.visible === false) && !sb()._emitterAt(sb()._emitPos(em('e1')).x, sb()._emitPos(em('e1')).y);
        sc.toggleHide('e1');
        const eAt = () => {const p = sb()._emitPos(em('e1')); return !!sb()._emitterAt(p.x, p.y);};
        const chkP = doc.getElementById('chkParticleIcon');
        sc.pickRole('e1');
        await until(() => sb()._sel === 'e1');
        chkP.checked = false; chkP.dispatchEvent(new Event('change'));
        out.emIconSel = await until(() => sb()._icons?.particle === false) && [eAt(), localStorage.getItem('tools.scene.particleIcon')];
        sc.pickRole('r1');
        out.emIconOff = await until(() => sb()._sel === 'r1') && [eAt(), em('e1')?.fx?.emitter?.visible];
        chkP.checked = true; chkP.dispatchEvent(new Event('change'));
        out.emIconOn = await until(() => sb()._icons?.particle === true) && [eAt(), localStorage.getItem('tools.scene.particleIcon')];

        // 發射點自己那份（def）：表單第一次改＝整筆複製、sandbox 用它、particle.json 不動；丟掉自訂；複製鈕；換粒子有自訂先問
        const pjson = async () => (await (await json.getFileHandle('particle.json')).getFile()).text();
        const pj0 = await pjson(), src0 = structuredClone(sc.S.refs.particles[sid]);
        const rq = (k) => doc.querySelector(`#right [data-k="${k}"]`);
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        sc.pickRole('e1');
        out.defForm = await until(() => rq('img') && rq('copyDef')) && [!!doc.querySelector('#right .pform .box'), rq('defState').textContent.includes('用 particle.json')];
        fire(rq('img'), 'p-spark');
        out.defEdit = await until(async () => (await scDisk()).particles[0].def) && await (async () => {
            const d = (await scDisk()).particles[0].def;
            return [d.img, JSON.stringify({...d, img: src0.img}) === JSON.stringify(src0), await pjson() === pj0, JSON.stringify(sc.S.refs.particles[sid]) === JSON.stringify(src0)];
        })();
        out.defSandbox = await until(() => em('e1')?.def?.img === 'p-spark') && [em('e1').def.img, !!em('e1').fx?.emitter?.active, rq('defState').textContent.includes('自訂'), !!rq('dropDef')];
        out.defTree = doc.querySelector('#tree [data-key="e1"] .id').textContent;
        rq('dropDef').click();
        out.defDrop = await until(async () => !(await scDisk()).particles[0].def) && await until(() => em('e1')?.def?.img === src0.img);
        await until(() => rq('copyDef'));
        rq('copyDef').click();
        out.defCopy = await until(async () => (await scDisk()).particles[0].def) && JSON.stringify((await scDisk()).particles[0].def) === JSON.stringify(src0);
        // 自己那份跟來源一樣：換粒子不問；改過：先問，取消不換
        const other = Object.keys(sc.S.refs.particles).find(id => id !== sid);
        out.defOther = other; out.defSid = sid;
        fire(rq('id'), other);
        out.idNoAsk = await until(async () => (await scDisk()).particles[0].id === other) && [(await scDisk()).particles[0].def, doc.getElementById('dlgAsk').open];
        await until(() => rq('img'));
        fire(rq('img'), 'p-spark');
        await until(async () => (await scDisk()).particles[0].def);
        fire(rq('id'), sid);
        out.idAsk = await until(() => doc.getElementById('dlgAsk').open);
        doc.getElementById('dlgAsk').close('cancel');
        await sleep(100);
        out.idAskCancel = [(await scDisk()).particles[0].id, (await scDisk()).particles[0].def?.img, rq('id').value];
        sc.undo(); sc.undo(); sc.undo(); await sc.flush();
        out.defUndo = [(await scDisk()).particles[0].id, (await scDisk()).particles[0].def === undefined || JSON.stringify((await scDisk()).particles[0].def) === JSON.stringify(src0)];

        // sandbox 拖 zone：選中的發射點畫框、點框內拖本體、放開寫回發射點自己那份
        await sc.setEmitter('e1', {def: {...src0, emitZone: {type: 'random', source: {x: -8, y: -2, w: 16, h: 4}}}});
        sc.pickRole('e1');
        await until(() => sb()._sel === 'e1' && em('e1')?.def?.emitZone);
        const zc = sb()._zoneOrigin(em('e1'));
        const ptr = (x, y, shift = false) => ({worldX: x, worldY: y, event: {shiftKey: shift}});
        const zb = sb()._zoneBodyAt(zc.x + 3, zc.y);
        out.zoneHit = [zb?.k, zb?.part, !!sb()._zoneBodyAt(zc.x + 40, zc.y)];
        sb()._startZone(zb, ptr(zc.x + 3, zc.y));
        sb()._zoneTo(sb()._drag, ptr(zc.x + 13, zc.y + 6));
        sb()._endDrag();
        out.zoneMove = await until(async () => (await scDisk()).particles[0].def.emitZone.source.x === 2) && JSON.stringify((await scDisk()).particles[0].def.emitZone);
        // 選中之後出把手：拖右下角改大小（Shift 吸 4）
        await until(() => em('e1')?.def?.emitZone?.source?.x === 2);
        const zc2 = sb()._zoneOrigin(em('e1'));
        const hd = sb()._zoneHandleAt(zc2.x + 18, zc2.y + 8);
        out.zoneHandle = hd?.part;
        sb()._startZone(hd, ptr(zc2.x + 18, zc2.y + 8));
        sb()._zoneTo(sb()._drag, ptr(zc2.x + 25, zc2.y + 15, true));
        sb()._endDrag();
        out.zoneResize = await until(async () => (await scDisk()).particles[0].def.emitZone.source.w !== 16) && JSON.stringify((await scDisk()).particles[0].def.emitZone.source);
        // zone 蓋在擺設上：點框線（內外 6px）選到 zone、點框內選到擺設
        await until(() => em('e1')?.def?.emitZone?.source?.w === 22);
        const zc3 = sb()._zoneOrigin(em('e1')), mid = {x: zc3.x + 13, y: zc3.y + 10};
        const pk0 = Object.keys(sb()._props);
        await sc.addProp(tkey, Math.round(mid.x), Math.round(mid.y + 8));
        await until(() => Object.keys(sb()._props ?? {}).some(k => !pk0.includes(k)));
        const pz = Object.keys(sb()._props ?? {}).find(k => !pk0.includes(k));
        await sc.setProp(pz, {depth: 500});
        await until(() => sb()._props[pz]?.sp.depth > 400);
        sc.pickRole('e1');
        await until(() => sb()._sel === 'e1');
        const down = (x, y) => sb().input.emit('pointerdown', {worldX: x, worldY: y, x: 0, y: 0, leftButtonDown: () => true, rightButtonDown: () => false,
            middleButtonDown: () => false, event: {shiftKey: false, clientX: 0, clientY: 0}});
        const under = [sb()._pickAt(zc3.x + 2, mid.y)?.key, sb()._pickAt(mid.x, mid.y)?.key];
        down(zc3.x + 2 - 4 / sb().cameras.main.zoom, mid.y);
        const onEdge = [sb()._drag?.zone, sb()._sel];
        sb()._endDrag();
        down(mid.x, mid.y);
        out.zoneEdge = [...under.map(k => k === pz), ...onEdge, sb()._sel === pz];
        sb()._endDrag();
        sc.pickRole(pz);
        sb()._send({sb: 'key', key: 'Delete'});
        await until(() => sb()._props && !sb()._props[pz]);

        sc.pickRole('e1');
        sb()._send({sb: 'key', key: 'Delete'});
        out.delEm = await until(() => !em('e1')) && (await scDisk()).particles.map(e => e.key);

        // ---------- 第 6 步：日夜＋底圖 ----------
        const TS = game().__dbg.TimeSystem;
        const amb = () => {const c = sb().lights.ambientColor; return [c.r, c.g, c.b].map(v => Math.round(v * 255));};
        const rng = doc.getElementById('rngTime');
        out.time0 = [doc.getElementById('lblTime').textContent, TS.time.h, amb()];
        // 拖滑桿：即時預覽（不寫檔）、放開才寫
        rng.value = 22 * 60 + 30; rng.dispatchEvent(new Event('input'));
        out.timeLive = await until(() => TS.time.h === 22) && [TS.time.m, amb(), (await scDisk()).time];
        rng.dispatchEvent(new Event('change'));
        out.timeSave = await until(async () => (await scDisk()).time === '22:30') && [(await scDisk()).time, doc.getElementById('lblTime').textContent];
        // 地圖的燈（com_lamp）照環境光算亮度：換到有燈的地圖晚上才有光（這裡只驗 sandbox 有收到時間）
        // ▶ 播放：時間往前走、分頁跟著、不寫檔；暫停把那個時間寫進場景
        doc.getElementById('selSpeed').value = '240';
        await sc.setPlaying(true);
        out.play = await until(() => sc.S.liveTime && sc.S.liveTime !== '22:30') && [(await scDisk()).time,TS.time.h * 60 + TS.time.m > 22 * 60 + 30 || TS.time.h < 22];
        await sc.setPlaying(false);
        const paused = Number(doc.getElementById('rngTime').value);
        out.pause = [JSON.parse(await disk()).x.time === `${String(Math.floor(paused / 60)).padStart(2, '0')}:${String(paused % 60).padStart(2, '0')}`, sc.S.liveTime];
        // 自訂環境色：蓋掉 LUT
        await sc.setField('ambient', '#336699');
        out.amb = await until(() => amb().join() === '51,102,153') && [(await scDisk()).ambient, doc.getElementById('chkAmb').checked];
        await sc.setField('ambient', undefined);
        await sc.setField('time', '12:00');
        out.ambOff = await until(() => amb().join() === '255,255,255');

        // 底圖：下拉列 maps/，換了 sandbox 重開那張圖、角色跟擺設照樣建
        out.maps = [...doc.querySelectorAll('#selMap option')].map(o => o.value);
        const sel = doc.getElementById('selMap');
        sel.value = 'm/m_04x05'; sel.dispatchEvent(new Event('change'));
        out.map = await until(() => sb()?.mapName === 'm/m_04x05' && sb().roles.length === 2, 1500) && [(await scDisk()).map, Object.keys(sb()._props).length, TS.time.h];
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
    t.eq('sandbox 右鍵：放角色／擺設／粒子／光源／prefab＋刪除', JSON.stringify(r.ctx), JSON.stringify(['在這裡放角色…（3, 3）', '在這裡放擺設…', '在這裡放粒子…', '在這裡放光源', '在這裡放 prefab…', '刪除 mary']));
    t.eq('👁 暫藏：不寫檔、點不到', JSON.stringify(r.hide), JSON.stringify([true, true]));
    t.eq('sandbox 裡按 Del：刪選中的', JSON.stringify(r.delRole), JSON.stringify([null, 'r1']));
    t.eq('sandbox 裡按 Ctrl+Z：復原、選回去', JSON.stringify(r.undoDel), JSON.stringify([['r1', 'r2'], 'r2']));

    t.eq('🎯 指定目標：sandbox 進指定模式、按鈕變取消', JSON.stringify(r.arm), JSON.stringify(['r1', '🎯 取消']));
    t.eq('游標：指定中＝準星（角色上也是）', r.armCursor, 'crosshair');
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
    t.eq('錨點：選中的擺設畫在 sprite x/y', JSON.stringify(r.anchorProp[0]), JSON.stringify(r.anchorProp[1]));
    t.eq('錨點：選中的角色畫在站的點（root x/y）', JSON.stringify(r.anchorRole[0]), JSON.stringify(r.anchorRole[1]));
    t.eq('錨點：工具列取消勾選＝不畫、記 localStorage', JSON.stringify(r.anchorOff), JSON.stringify([null, '0']));
    t.eq('錨點：勾回來', r.anchorOn, '1');
    t.check('外部 png：用網址載入', r.file?.[0]?.startsWith('file:') && r.file[1], JSON.stringify(r.file));
    t.check('載不到的圖：提示、不建', r.badTex);
    t.eq('屬性：翻轉、角度、錨點、深度＝y＋偏移', JSON.stringify(r.attrs), JSON.stringify([true, 30, 0, 0.5, 205]));
    t.eq('大小：sx／sy 分開；textures 圖不吃 pct', JSON.stringify(r.sxy), JSON.stringify([2, 3]));
    t.eq('大小：file: 圖畫面＝pct% × sx/sy', r.pct, 1);
    t.check('面板：寬高＝原圖 × pct × sx、等比勾著＝一格 scale、file 圖有 % 跟鎖（下拉，預設 %）', r.wh0 && r.wh0[2] === false && r.wh0[3] === true && r.wh0[4] && r.wh0[5] === 'pct', JSON.stringify(r.wh0));
    t.check('面板：% 右邊原圖長寬、scale 右邊縮放後（原圖×%）長寬', r.dims[0] === r.dims[2] && r.dims[1] === r.dims[3], JSON.stringify(r.dims));
    t.eq('鎖 %＋等比：改寬 → sx、sy 一起變', JSON.stringify(r.wLinked), JSON.stringify([4, 4, 50]));
    t.check('取消等比：scale 變兩格', r.unlinked);
    t.eq('鎖 %、不等比：改高只動 sy', JSON.stringify(r.hFree), JSON.stringify([4, 2]));
    t.eq('鎖 scale：改寬 → 反算 pct', JSON.stringify(r.wPct), JSON.stringify([25, 4, 2]));
    t.eq('勾回等比：sy＝sx', JSON.stringify(r.relink), JSON.stringify([4, 4, true]));
    t.check('存檔：縮成 pct% 另存 PNG、場景不動', r.bake && r.bake[0] === 'images/scene/baked.png' && r.bake[1].join() === r.bake[3].join() && r.bake[2].join() === r.bake[3].join() && r.bake[4], JSON.stringify(r.bake));
    t.check('存檔：同名檔擋', r.bakeDup.includes('已經有了'), r.bakeDup);
    t.check('存檔：texture key 撞名擋（大小寫不分）', r.bakeKey.includes('texture key') && r.bakeKey.includes('sub/Baked2'), r.bakeKey);
    t.eq('存檔：確認過可以覆蓋同名檔', r.bakeOver, 'images/scene/baked.png');
    t.eq('存檔：覆蓋 textures 裡自己那張不算撞 key', r.bakeOverKey, 'public/assets/textures/sub/Baked2.png');
    t.eq('圖片清單更新：sandbox 不重開、補載缺的 key、缺圖的木偶重建、其他木偶不動', JSON.stringify(r.texReload), JSON.stringify([true, true, true, true]));
    t.check('存檔：擺設正在用的原圖不能蓋', r.bakeOwn.includes('原圖'), r.bakeOwn);
    t.eq('存檔框的樹：子資料夾在前、只列 .png', JSON.stringify(r.ftree), JSON.stringify(['📁 images', '📁 scene', '📁 zz', '🖼 baked.png']));
    t.eq('存檔框的樹：點檔案＝所在資料夾＋檔名、原圖標灰、選起來', JSON.stringify(r.treePick), JSON.stringify([['images/scene', 'baked'], true, true]));
    t.eq('存檔框：視窗矮時外框／body 不捲、按鈕在畫面內、只有樹縮（≥80）', JSON.stringify(r.dlgFit), JSON.stringify([true, true, true, true, true]));
    t.eq('存檔框預設檔名：textures＝原名、原始路徑＝-copy、改過切模式不換', JSON.stringify(r.defName), JSON.stringify([true, true, 'mine']));
    t.eq('畫面把手：選中的擺設 8 個', r.handles, 8);
    t.check('拉右邊（鎖 %＋等比）：sx/sy 一起變、左邊固定、底部（錨點）不動', r.dragR && r.dragR[0] === 2 && r.dragR[1] === 2 && r.dragR[2] === r.dragR[4] && r.dragR[3] === 200, JSON.stringify(r.dragR));
    t.check('拉下邊＋Shift（不等比）：只改 sy、邊吸到 16px', r.dragB && r.dragB[0] === 2 && r.dragB[1] === r.dragB[2], JSON.stringify(r.dragB));
    t.check('拉左上角（鎖 scale）：改 pct、對角固定、sx/sy 不動', r.dragTL && r.dragTL[0] && r.dragTL[1] && r.dragTL[2] === 2, JSON.stringify(r.dragTL));
    t.eq('有角度：不出把手', r.noHandle, 0);
    t.check('右欄把手：在右欄左邊、往左拉變寬、記 tools.right.scene', r.rgrip[0] === 'view' && r.rgrip[2] === r.rgrip[1] + 100 && r.rgrip[3] === String(r.rgrip[2]), JSON.stringify(r.rgrip));
    t.check('右欄把手：雙擊回預設', r.rgripReset[0] === r.rgrip[1] && r.rgripReset[1] === null, JSON.stringify(r.rgripReset));
    t.check('拉右欄／左欄：場景在螢幕上不動（zoom 1.5）', r.stay && r.stay.every(s => Math.abs(s[0] - r.stay[0][0]) <= 1 && Math.abs(s[1] - r.stay[0][1]) <= 1), JSON.stringify(r.stay));
    t.check('擺設面板沒有發光', r.noPropLight);
    t.check('光源：放了存檔（預設 r120、沒寫 i）、選起來、點得到、左欄列、強度＝1',
        r.lightAdd && JSON.stringify(r.lightAdd[0]) === JSON.stringify([{key: 'l1', x: 400, y: 300, r: 120, color: '#ffcc88'}]) && r.lightAdd[1] === 'l1' && r.lightAdd[2] === '光源 l1' && r.lightAdd[3] === 'l1' && r.lightAdd[4] === 120 && r.lightAdd[5] && r.lightAdd[6] && r.lightAdd[7], JSON.stringify(r.lightAdd));
    t.eq('光源：填了 i＝固定、顏色', JSON.stringify(r.lightFixed), JSON.stringify([255, 0]));
    t.eq('光源：沒寫 i＝1，不跟環境光變', r.lightAuto, 1);
    t.check('跟著下拉：不跟／角色／擺設', r.folOpts.join() === ',r1,r2,p2', JSON.stringify(r.folOpts));
    t.check('光源跟擺設：位置換成相對、畫面不動', r.lightFollow && r.lightFollow[0] === 100 && r.lightFollow[1] === 100 && r.lightFollow[2].x === 400 && r.lightFollow[2].y === 300, JSON.stringify(r.lightFollow));
    t.eq('光源跟擺設：擺設搬了光跟著', r.lightFollowMove, 420);
    t.eq('半徑把手：在圈的右邊、抓得到', JSON.stringify(r.rHandle), JSON.stringify([120, true]));
    t.check('拖半徑＋Shift：吸 16 的倍數、寫檔', r.radius);
    t.eq('光源：拖曳放開寫檔、方向鍵', JSON.stringify(r.lightMove), JSON.stringify([11, 20]));
    t.check('光源：👁 藏＝強度 0、點不到', r.lightHide);
    t.check('光源：取消藏＝回到原本強度', r.lightUnhide);
    t.eq('光源記號沒勾：選中的照樣點得到、記 localStorage', JSON.stringify(r.lightIconSel), JSON.stringify([true, '0']));
    t.eq('光源記號沒勾：沒選中的點不到、光照不變', JSON.stringify(r.lightIconOff), JSON.stringify([false, 1]));
    t.eq('光源記號勾回來', JSON.stringify(r.lightIconOn), JSON.stringify([true, '1']));
    t.eq('聚光燈：光錐空白＝點光源、方向／柔和反灰', JSON.stringify(r.spotOff), JSON.stringify([true, true, null]));
    t.eq('聚光燈：填 arc＝light.spot、方向／柔和可填', JSON.stringify(r.spotOn), JSON.stringify([{dir: 0, arc: 60, soft: 0.2}, false]));
    t.eq('聚光燈：半徑把手在中線末端、弧端兩個把手', JSON.stringify(r.spotHandles), JSON.stringify([[176, 0], [[152, -88], [152, 88]]]));
    t.eq('聚光燈：拖中線把手＋Shift＝半徑吸 16、方向吸 15°、寫檔', JSON.stringify(r.spotRadius), JSON.stringify([96, 90]));
    t.check('聚光燈：拖弧端＝光錐（兩倍夾角）、寫檔', r.spotArc);
    t.eq('聚光燈：跟著角色，朝左鏡像 x 跟方向', JSON.stringify(r.spotMirror), JSON.stringify([[1, 5, 30], [-1, -5, 150]]));
    t.check('聚光燈：清掉 arc 回點光源', r.spotBack);
    t.eq('粒子也能跟擺設', JSON.stringify(r.emProp), JSON.stringify([true, true]));
    t.eq('刪被跟的擺設：光源、粒子改成不跟、位置換成絕對', JSON.stringify(r.detach), JSON.stringify([null, true, true, null, true, true].map(v => v ?? undefined)));
    t.eq('刪被跟的擺設：undo 回來', JSON.stringify(r.detachUndo), JSON.stringify(['p2', 'p2']));
    t.check('光源：刪除', r.lightDel && r.lightDel[0] == null && r.lightDel[1], JSON.stringify(r.lightDel));
    t.eq('拖曳放開：寫檔、sandbox 跟著', JSON.stringify(r.moveProp), JSON.stringify([208, 224]));
    t.eq('方向鍵 1px、Shift＋方向鍵一格', JSON.stringify(r.nudge), JSON.stringify([209, 256]));
    t.eq('擺設點得到', r.pickProp, 'p1');
    t.eq('左欄：角色跟擺設都列', JSON.stringify(r.tree2), JSON.stringify(['r1', 'r2', 'p1', 'p2']));
    t.eq('Del 刪擺設', JSON.stringify(r.delProp), JSON.stringify(['p2']));

    t.check('狀態特效：加了存檔、sandbox fxOn、角色沒重建', r.fxOn?.[0]?.length === 1 && r.fxOn[1], JSON.stringify(r.fxOn));
    t.check('狀態特效：右欄一列（tick／解除）', r.fxRow);
    t.eq('狀態特效：解除＝fxOff、欄位拿掉、角色沒重建', JSON.stringify(r.fxOff), JSON.stringify([undefined, true]));
    t.check('粒子：放了存檔、選起來、sandbox 噴、發射點點得到', r.emit && r.emit[0]?.[0]?.key === 'e1' && r.emit[1] === 'e1' && r.emit[2] === '粒子 e1' && r.emit[3] === 'e1', JSON.stringify(r.emit));
    t.eq('游標：粒子／角色上＝grab、空地＝預設', JSON.stringify(r.cursor), JSON.stringify(['grab', 'r1', 'grab', '']));
    t.eq('游標：拖曳中＝grabbing', r.cursorDrag, 'grabbing');
    t.check('粒子：burst 照 every 定時再噴', r.burst);
    t.eq('粒子：跟著角色（位置相對角色）', JSON.stringify(r.follow), JSON.stringify([true, true]));
    t.check('粒子：角色重建後照樣跟上', r.followMove);
    t.check('粒子：拖曳放開寫檔', r.moveEm);
    t.check('粒子：👁 藏起來、點不到', r.hideEm);
    t.eq('粒子記號沒勾：選中的照樣點得到、記 localStorage', JSON.stringify(r.emIconSel), JSON.stringify([true, '0']));
    t.eq('粒子記號沒勾：沒選中的點不到、粒子照噴', JSON.stringify(r.emIconOff), JSON.stringify([false, true]));
    t.eq('粒子記號勾回來', JSON.stringify(r.emIconOn), JSON.stringify([true, '1']));
    t.eq('粒子內容：右欄有粒子表單、標「用 particle.json」', JSON.stringify(r.defForm), JSON.stringify([true, true]));
    t.eq('表單第一次改＝整筆複製到發射點、只差改的那格、particle.json 沒動', JSON.stringify(r.defEdit), JSON.stringify(['p-spark', true, true, true]));
    t.eq('sandbox 用發射點自己那份播、標「自訂」、有丟掉鈕', JSON.stringify(r.defSandbox), JSON.stringify(['p-spark', true, true, true]));
    t.check('物件樹標 ✎', r.defTree.includes('✎'), r.defTree);
    t.check('丟掉自訂：回到用 particle.json', r.defDrop);
    t.check('複製鈕：整筆拷進來', r.defCopy);
    t.eq('跟來源一樣：換粒子不問、丟掉自己那份', JSON.stringify(r.idNoAsk), JSON.stringify([null, false]));
    t.check('改過：換粒子先問', r.idAsk);
    t.eq('取消：不換、保留自訂、下拉回原值', JSON.stringify(r.idAskCancel), JSON.stringify([r.defOther, 'p-spark', r.defOther]));
    t.eq('undo 一路倒回複製完的樣子', JSON.stringify(r.defUndo), JSON.stringify([r.defSid, true]));
    t.eq('sandbox zone：框內點得到本體、框外點不到', JSON.stringify(r.zoneHit), JSON.stringify(['emitZone', 'move', false]));
    t.eq('sandbox zone：拖本體寫回發射點的 def', r.zoneMove, JSON.stringify({type: 'random', source: {x: 2, y: 4, w: 16, h: 4}}));
    t.eq('sandbox zone：選中後右下角有把手', r.zoneHandle, 'se');
    t.eq('sandbox zone：拖把手改大小（Shift 吸 4、左上固定）', r.zoneResize, JSON.stringify({x: 2, y: 4, w: 22, h: 12}));
    t.eq('sandbox zone：蓋在擺設上，點框線選到 zone、點框內選到擺設', JSON.stringify(r.zoneEdge), JSON.stringify([true, true, 'emitZone', 'e1', true]));
    t.eq('粒子：Del 刪', JSON.stringify(r.delEm), JSON.stringify(['e2']));

    t.eq('日夜：沒寫時間＝08:00、白天全亮', JSON.stringify(r.time0), JSON.stringify(['08:00', 8, [255, 255, 255]]));
    t.eq('拖時間滑桿：sandbox 時鐘跟著、環境光照 lutAmbient 變暗、還沒寫檔', JSON.stringify(r.timeLive), JSON.stringify([30, [102, 102, 102], undefined]));
    t.eq('放開滑桿：寫進場景', JSON.stringify(r.timeSave), JSON.stringify(['22:30', '22:30']));
    t.eq('▶ 播放：時間往前走、不寫檔', JSON.stringify(r.play), JSON.stringify(['22:30', true]));
    t.eq('⏸ 暫停：停的時間寫進場景', JSON.stringify(r.pause), JSON.stringify([true, null]));
    t.eq('自訂環境色：蓋掉 LUT、存檔、勾起來', JSON.stringify(r.amb), JSON.stringify(['#336699', true]));
    t.check('取消自訂：回到照時間（12:00 全亮）', r.ambOff);
    t.eq('底圖下拉：sandbox 排第一、列出 maps/（含子資料夾）', JSON.stringify(r.maps), JSON.stringify(['sandbox', '_m_00x00', 'm/m_04x05']));
    t.check('換底圖：sandbox 重開那張圖、角色擺設照建、時間照場景', r.map && r.map[0] === 'm/m_04x05' && r.map[1] === 1 && r.map[2] === 12, JSON.stringify(r.map));
});
