// 地圖分頁（tools/map/）：地圖樹＋徽章、世界總覽、畫地圖＋角色、右欄圖層／群組／角色；node scripts/test/map-tool.mjs
import {run} from './harness.mjs'

// 頁面裡用：OPFS 假專案（真的 json＋幾張地圖），回傳 {assets}
const SETUP = async () => {
    const opfs = await navigator.storage.getDirectory();
    for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
    const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
    const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
    const assets = await dir(opfs, 'game', 'public', 'assets'), json = await dir(assets, 'json'), maps = await dir(assets, 'maps');
    for (const f of ['role.json', 'item.json', 'part.json', 'story.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
    const copy = async (rel) => {
        const segs = rel.split('/'), d = await dir(maps, ...segs.slice(0, -1));
        await write(d, segs.at(-1), await (await fetch(`/assets/maps/${rel}`)).text());
    };
    for (const f of ['main.world', 'm/m_03x05.json', 'm/m_04x05.json', 'm_04x05/karen-home.json', 'forest-01.json', 'village-01.json', '_m_00x00.json']) await copy(f);
    const tdir = await dir(assets, 'templates', 'animals');
    await write(tdir, 'wolf.tj', await (await fetch('/assets/templates/animals/wolf.tj')).text());
    await write(await dir(assets, 'templates'), 'point.tj', await (await fetch('/assets/templates/point.tj')).text());
    return {assets};
};

run('map-tool', async t => {
    await t.page.goto(new URL('tools/map/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__mt);

    const r = await t.page.evaluate(async (SETUP) => {
        const mt = window.__mt, S = mt.S, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 300 && !f(); i++) await sleep(20); return f();};
        for (const k of Object.keys(localStorage)) if (k.startsWith('tools.map') || k.startsWith('tools.preview.view.map')) localStorage.removeItem(k);
        S.sel = null;
        const {assets} = await new Function(`return (${SETUP})()`)();
        await mt.setRoot(assets);

        // ---- 左欄 ----
        out.cats = Object.fromEntries(['world', 'room', 'other'].map(c => [c, S.maps.filter(m => m.cat === c).map(m => m.name)]));
        out.sum = [S.sums['m/m_03x05'], S.sums['forest-01']?.roles, S.sums['m/m_04x05']?.roles];
        for (const g of [...document.querySelectorAll('#list .group.fold')]) if (g.querySelector('.arrow').textContent === '▸') g.click();
        for (const g of [...document.querySelectorAll('#list .group.fold')]) if (g.querySelector('.arrow').textContent === '▸') g.click();
        const items = () => [...document.querySelectorAll('#list .item')];
        out.badge = items().find(e => e.dataset.map === 'm/m_03x05')?.querySelector('.badges')?.textContent;
        out.emptyDim = items().find(e => e.dataset.map === 'm_04x05/karen-home')?.classList.contains('empty');
        document.getElementById('onlyRoles').click();
        out.only = items().map(e => e.dataset.map);
        out.onlyMem = localStorage.getItem('tools.map.only');
        document.getElementById('onlyRoles').click();

        // ---- 總覽 ----
        const cells = () => [...document.querySelectorAll('#view .world .cell')];
        out.cells = cells().length;
        const c35 = cells().find(c => c.dataset.map === 'm/m_03x05');
        out.cell35 = [c35?.classList.contains('has'), c35?.querySelector('.bd')?.textContent, c35?.querySelector('img')?.getAttribute('src')];
        out.noRight = document.getElementById('right').children.length;
        c35.click();
        out.sel = [S.sel, localStorage.getItem('tools.map.sel')];

        // ---- 地圖 ----
        const cv = () => document.querySelector('#view canvas');
        await until(() => cv()?.st.data && document.querySelector('#right .roles'));
        const st = cv().st;
        out.size = [st.data.W, st.data.H];
        out.roles = st.roles.map(it => `${it.layer}:${it.rid}`).sort();
        const wolf = st.roles.find(it => it.rid === 'wolf' && it.o.x === 512 && it.o.y === 224);
        out.wolfRoot = wolf && [wolf.at.root.x, wolf.at.root.y];
        const sp = st.sprites.get('wolf'), rog = st.sprites.get('rogue-1');
        const opaque = (c) => {const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n;};
        out.sprites = [!!sp && opaque(sp) > 50, !!rog && opaque(rog) > 50];
        // 角色不烤進底圖（另外畫）：tag map 的烤圖跟作息地圖那份（有烤 template 狼）在狼那格不一樣
        // （m_03x05 的狼 template 用的 tileset 不在地圖裡，兩份都沒畫；改看 village-01 的圖塊物件 orc）
        const plain = await mt.MV.mapData('village-01'), noRole = await mt.MV.mapData('village-01', {skip: (o) => o.type === 'npc' && !!o.props.id, tag: 'map'});
        const orc = plain.objs.find(o => o.props.id === 'orc');
        const px = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].join();
        let diff = 0;
        for (let y = orc.y - orc.height; y < orc.y; y += 2) for (let x = orc.x; x < orc.x + orc.width; x += 2) if (px(plain.bake, x, y) !== px(noRole.bake, x, y)) diff++;
        out.skipBake = diff;

        // 右欄：常駐＋兩個群組（條件照 story.json）、角色清單
        const right = document.getElementById('right');
        out.layers = [...right.querySelectorAll('.layer')].map(e => `${e.dataset.layer}=${e.querySelector('.n').textContent}`);
        out.cond = right.querySelector('.layer[data-layer="@wolves"] .cond')?.textContent;
        out.roleRows = right.querySelectorAll('.roles .r').length;

        // 點畫布上的狼：選取、右欄顯示
        await sleep(50);
        const rc = cv().getBoundingClientRect(), o = st.pz.o, K = st.pz.K;
        const at = (p) => ({clientX: rc.left + o.x + (p.x - st.data.W / 2) * K, clientY: rc.top + o.y + (p.y - st.data.H / 2) * K});
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...at(wolf.at.cen)}));
        out.tip = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent);
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...at(wolf.at.cen)}));
        out.pick = S.pick === wolf.o.id;
        out.picked = [...right.querySelectorAll('.picked table tr')].map(tr => tr.textContent);
        out.pickedSel = [right.querySelector('.picked [data-k=rid]')?.value, right.querySelector('.picked [data-k=layer]')?.value];
        out.rowSel = right.querySelector('.roles .r.sel')?.dataset.oid == wolf.o.id;
        // 點空地取消
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...at({x: 5, y: 5})}));
        out.unpick = S.pick === null && !right.querySelector('table');

        // ---- 作息 point 淡色唯讀：滑過顯示誰在用 ----
        mt.selectMap('m/m_04x05');
        await until(() => cv()?.st.name === 'm/m_04x05' && cv().st.data);
        const st2 = cv().st, kp = st2.data.named.get('karen-p1');
        await sleep(50);
        const rc2 = cv().getBoundingClientRect(), o2 = st2.pz.o, K2 = st2.pz.K;
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: rc2.left + o2.x + (kp.cen.x - st2.data.W / 2) * K2, clientY: rc2.top + o2.y + (kp.cen.y - st2.data.H / 2) * K2}));
        out.ptip = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent);

        // 再點同一張＝回總覽
        mt.selectMap('m/m_04x05');
        out.back = [S.sel, cells().length > 0, localStorage.getItem('tools.map.sel')];

        // ================= 第 3 步：放置／移動／換角色／屬性／刪除／undo =================
        const mapsDir = await assets.getDirectoryHandle('maps');
        const readText = async (rel) => {let d = mapsDir; const s = rel.split('/'); for (const n of s.slice(0, -1)) d = await d.getDirectoryHandle(n); return (await (await d.getFileHandle(s.at(-1))).getFile()).text();};
        const KH = 'm_04x05/karen-home', orig = await readText(`${KH}.json`), origData = JSON.parse(orig);
        const readKH = async () => JSON.parse(await readText(`${KH}.json`));
        const saved = [];
        const chan = new BroadcastChannel('tools');
        chan.onmessage = (e) => saved.push(e.data.file);
        out.tpls = Object.keys(S.tpls).join();
        mt.selectMap(KH);
        await until(() => cv()?.st.name === KH && cv().st.data);
        await sleep(50);
        const tileAt = ([tx, ty]) => {
            const s = cv().st, b = cv().getBoundingClientRect(), oo = s.pz.o, k = s.pz.K;
            return {clientX: b.left + oo.x + ((tx + 0.5) * 32 - s.data.W / 2) * k, clientY: b.top + oo.y + ((ty + 0.5) * 32 - s.data.H / 2) * k};
        };
        const clickTile = (tile, opt = {}) => cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...tileAt(tile), ...opt}));
        const settle = async () => {await sleep(30); await until(() => cv()?.st.data && !document.querySelector('#view .msg:not([hidden])')); await sleep(30);};

        // 調色盤：沒有 player、有種類分頁；點狼＝放置模式（提示列）
        const pcells = () => [...document.querySelectorAll('#right .pcell')];
        out.palette = [pcells().some(c => c.dataset.rid === 'wolf'), pcells().some(c => S.roles[c.dataset.rid]?.kind === 'player'),
            [...document.querySelectorAll('#right .ktabs button')].map(b => b.textContent).join()];
        pcells().find(c => c.dataset.rid === 'wolf').click();
        out.placing = [S.place, !document.querySelector('#view .placing').hidden, document.querySelector('#right .pcell.on')?.dataset.rid];
        await until(() => cv()?.st.data);
        await sleep(50);
        // 滑過：綠框鬼影；點一下放（有 template 用 template），放完結束放置模式、選到新的
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...tileAt([3, 3])}));
        out.ghost = cv().st.ghost?.join();
        const nextId = origData.nextobjectid, nextLayer = origData.nextlayerid;
        clickTile([3, 3]);
        await until(() => S.hi === 1);
        await settle();
        let m = await readKH();
        const rl = m.layers.find(l => l.name === 'roles');
        out.placed = [rl?.id === nextLayer, m.nextlayerid === nextLayer + 1, m.nextobjectid === nextId + 1, JSON.stringify(rl?.objects[0]), S.place, S.pick === nextId];
        out.placedRoot = cv().st.roles.map(it => `${it.rid}@${Math.floor(it.at.root.x / 32)},${Math.floor(it.at.root.y / 32)}`).join();
        out.saved1 = saved.includes(`maps/${KH}.json`);
        out.badge3 = S.sums[KH]?.roles;
        out.text = await readText(`${KH}.json`);

        // 沒 template（orc）：寫成點物件；Shift＋點連放兩個，放置模式還在；Esc 結束
        mt.setPlace('orc');
        await settle();
        clickTile([5, 3], {shiftKey: true});
        await until(() => S.hi === 2);
        await settle();
        clickTile([6, 3], {shiftKey: true});
        await until(() => S.hi === 3);
        await settle();
        out.orcPlace = S.place;
        m = await readKH();
        const orcs = m.layers.find(l => l.name === 'roles').objects.filter(o => o.properties?.some(p => p.value === 'orc'));
        out.orcs = orcs.map(o => JSON.stringify(o));
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.esc = S.place;
        await settle();
        out.roots = cv().st.roles.map(it => `${it.rid}@${Math.floor(it.at.root.x / 32)},${Math.floor(it.at.root.y / 32)}`).sort().join();

        // 拖狼 (3,3) → (4,5)
        const wolfIt = cv().st.roles.find(it => it.rid === 'wolf');
        const from = tileAt([3, 3]), to = tileAt([4, 5]);
        cv().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0, ...from}));
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...to}));
        out.dragGhost = cv().st.drag?.tile.join();
        cv().dispatchEvent(new PointerEvent('pointerup', {bubbles: true, ...to}));
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...to}));
        await until(() => S.hi === 4);
        await settle();
        m = await readKH();
        const w2 = m.layers.find(l => l.name === 'roles').objects.find(o => o.id === wolfIt.o.id);
        out.dragged = [w2.x, w2.y, S.place];

        // 換角色：第一隻 orc（點物件）換成 wolf → template、同一格、同 id；屬性：respawn、自訂、拿掉
        const orcId = orcs[0].id;
        S.pick = orcId; mt.render();
        await settle();
        const rsel = document.querySelector('#right .picked [data-k=rid]');
        rsel.value = 'wolf'; rsel.dispatchEvent(new Event('change'));
        await until(() => S.hi === 5);
        await settle();
        m = await readKH();
        out.replaced = JSON.stringify(m.layers.find(l => l.name === 'roles').objects.find(o => o.id === orcId));
        out.replacedRoot = cv().st.roles.filter(it => it.o.id === orcId).map(it => `${it.rid}@${Math.floor(it.at.root.x / 32)},${Math.floor(it.at.root.y / 32)}`).join();
        const resp = document.querySelector('#right .picked [data-k=respawn]');
        resp.value = '60'; resp.dispatchEvent(new Event('change'));
        await until(() => S.hi === 6);
        await settle();
        const pr = document.querySelector('#right .picked .addprop');
        pr.querySelector('.pn').value = 'mood'; pr.querySelector('select').value = 'string'; pr.querySelector('.pv').value = 'angry';
        pr.querySelector('button').click();
        await until(() => S.hi === 7);
        await settle();
        m = await readKH();
        out.props = JSON.stringify(m.layers.find(l => l.name === 'roles').objects.find(o => o.id === orcId).properties);
        document.querySelector('#right .picked tr[data-prop=mood] .del').click();
        await until(() => S.hi === 8);
        await settle();
        m = await readKH();
        out.propsDel = JSON.stringify(m.layers.find(l => l.name === 'roles').objects.find(o => o.id === orcId).properties);

        // 具名 NPC：放了提示 ⚠，不擋
        mt.setPlace('karen');
        await settle();
        clickTile([8, 3]);
        await until(() => S.hi === 9);
        await settle();
        out.named = [document.getElementById('status').textContent.includes('⚠ 具名 NPC'), cv().st.roles.some(it => it.rid === 'karen')];

        // Del 刪選取的
        const kid = cv().st.roles.find(it => it.rid === 'karen').o.id;
        S.pick = kid;
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true}));
        await until(() => S.hi === 10);
        await settle();
        out.deleted = [cv().st.roles.some(it => it.rid === 'karen'), S.pick];

        // 右鍵選單：移到別層（m_03x05 的狼 → 常駐＝roles 層）
        mt.selectMap('m/m_03x05');
        await settle();
        const w3 = cv().st.roles.find(it => it.layer === '@wolves');
        const ctr = {clientX: 0, clientY: 0}, b3 = cv().getBoundingClientRect(), s3 = cv().st;
        ctr.clientX = b3.left + s3.pz.o.x + (w3.at.cen.x - s3.data.W / 2) * s3.pz.K;
        ctr.clientY = b3.top + s3.pz.o.y + (w3.at.cen.y - s3.data.H / 2) * s3.pz.K;
        cv().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, ...ctr}));
        out.menu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        [...document.querySelectorAll('.ctxmenu button')].find(b => b.textContent === '移到「常駐」').click();
        await until(() => S.hi === 11);
        await settle();
        out.moved = cv().st.roles.filter(it => it.o.id === w3.o.id).map(it => it.layer).join();
        out.layerCounts = [...document.querySelectorAll('#right .layer')].map(e => `${e.dataset.layer}=${e.querySelector('.n').textContent}`).join();
        // 放到群組：點 @bandits 那層再放
        document.querySelector('#right .layer[data-layer="@bandits"]').click();
        mt.setPlace('wolf');
        await settle();
        clickTile([10, 10]);
        await until(() => S.hi === 12);
        await settle();
        out.toGroup = cv().st.roles.filter(it => it.o.id === S.pick).map(it => it.layer).join();

        // undo 全部：兩張地圖都回到原檔一字不差；redo 一步
        for (let i = 0; i < 12; i++) await mt.undo();
        out.undoAll = [S.hi, await readText(`${KH}.json`) === orig, await readText('m/m_03x05.json') === await (await fetch('/assets/maps/m/m_03x05.json')).text()];
        await mt.redo();
        m = await readKH();
        out.redo = [S.hi, !!m.layers.find(l => l.name === 'roles')];
        // 別處改過就不復原
        const kd = await mapsDir.getDirectoryHandle('m_04x05'), w = await (await kd.getFileHandle('karen-home.json')).createWritable();
        await w.write((await readText(`${KH}.json`)) + ' '); await w.close();
        await mt.undo().catch(e => {out.refuse = e.message;});
        out.refuseHi = S.hi;
        chan.close();
        return out;
    }, SETUP.toString());

    t.check('地圖分類：世界／室內／其他，_ 開頭的舊檔不列', r.cats.world.join() === 'm/m_03x05,m/m_04x05' && r.cats.room.join() === 'm_04x05/karen-home'
        && r.cats.other.join() === 'forest-01,village-01', JSON.stringify(r.cats));
    t.check('徽章：m_03x05 六個角色、兩個群組；forest-01 兩個', r.sum[0]?.roles === 6 && r.sum[0]?.groups.join() === 'wolves,bandits' && r.sum[1] === 2, JSON.stringify(r.sum));
    t.eq('左欄徽章文字', r.badge, '🐾6@2');
    t.check('沒角色的地圖變淡', r.emptyDim);
    t.check('只看有角色的：記住、沒角色的不列', r.onlyMem === '1' && !r.only.includes('m_04x05/karen-home') && r.only.includes('m/m_03x05'), r.only.join());
    t.eq('總覽：main.world 每張一格', r.cells, 100);
    t.check('總覽格子：有東西的加框、列群組、縮圖路徑', r.cell35[0] && r.cell35[1] === '🐾6@wolves@bandits' && r.cell35[2] === '/assets/textures/minimap/m/m_03x05.png', JSON.stringify(r.cell35));
    t.eq('沒選地圖：右欄空的', r.noRight, 0);
    t.check('點格子：選那張、記住', r.sel[0] === 'm/m_03x05' && r.sel[1] === 'm/m_03x05', r.sel.join());
    t.check('地圖 100×100 格', r.size.join() === '3200,3200', r.size.join());
    t.check('角色：三隻狼在 @wolves、三個土匪在 @bandits', r.roles.join() === '@bandits:rogue-1,@bandits:rogue-1,@bandits:rogue-1,@wolves:wolf,@wolves:wolf,@wolves:wolf', r.roles.join());
    t.check('站的位置＝物件中心＋錨點（狼 512,224 → 528,208）', r.wolfRoot?.join() === '528,208', r.wolfRoot?.join());
    t.check('角色照 role.json 合成出圖', r.sprites.every(Boolean), r.sprites.join());
    t.check('角色不烤進底圖', r.skipBake > 20, r.skipBake);
    t.check('右欄圖層：常駐 0、@wolves 3、@bandits 3', r.layers.join() === '=0,@wolves=3,@bandits=3', r.layers.join());
    t.eq('@wolves 條件照 story.json', r.cond, 'wolf_hunt && wolf_hunt<9');
    t.eq('右欄角色清單', r.roleRows, 6);
    t.check('滑過角色：浮動框 id、種類、圖層、格子', r.tip[0]?.startsWith('wolf') && r.tip[1] === '動物・@wolves・格 16,6', r.tip.join(' | '));
    t.check('點角色：選取、右欄詳細、清單反白', r.pick && r.rowSel && r.pickedSel.join() === 'wolf,@wolves' && r.picked.some(s => s.startsWith('站的格子16, 6')), r.picked.join(' | '));
    t.check('點空地取消選取', r.unpick);
    t.check('滑過作息 point：列出誰在用、提示到角色分頁', r.ptip[0] === 'karen-p1（作息 point）' && /karen 1/.test(r.ptip[1]) && /角色分頁/.test(r.ptip[2]), r.ptip.join(' | '));
    t.check('再點同一張回總覽、清掉記住的', r.back[0] === null && r.back[1] && r.back[2] === null, JSON.stringify(r.back));

    // ---- 第 3 步 ----
    t.eq('掃 templates/：有 id 的 npc template', r.tpls, 'wolf');
    t.check('調色盤：有狼、沒有玩家、種類分頁只列有的', r.palette[0] && !r.palette[1] && r.palette[2] === '全部,動物,怪物,土匪,NPC,其他', JSON.stringify(r.palette));
    t.check('點調色盤：放置模式、提示列、反白', r.placing.join() === 'wolf,true,wolf', r.placing.join());
    t.eq('放置模式滑過：鬼影在那格', r.ghost, '3,3');
    const KH_TPL = '../../templates/animals/wolf.tj';
    t.check('放狼：建 roles 層（nextlayerid／nextobjectid +1）、template 物件、站在點的那格、放完結束、選到新的',
        r.placed[0] && r.placed[1] && r.placed[2] && r.placed[3] === JSON.stringify({id: JSON.parse(r.placed[3] ?? '{}').id, template: KH_TPL, x: 96, y: 128}) && r.placed[4] === null && r.placed[5],
        JSON.stringify(r.placed));
    t.eq('畫面上狼站在 3,3', r.placedRoot, 'wolf@3,3');
    t.check('寫完廣播 maps/<地圖>.json、徽章跟著更新', r.saved1 && r.badge3 === 1, `${r.saved1} ${r.badge3}`);
    t.check('照 Tiled 排版（\\/ 跳脫、物件陣列縮排）', r.text.includes('"template":"..\\/..\\/templates\\/animals\\/wolf.tj"') && r.text.includes('"name":"roles"'));
    const orcObj = (id, x) => JSON.stringify({height: 0, id, name: '', point: true, properties: [{name: 'id', type: 'string', value: 'orc'}], rotation: 0, type: 'npc', visible: true, width: 0, x, y: 96});
    t.check('沒 template：點物件（x/y＝格子中心−anchor）', r.orcs.length === 2 && r.orcs[0] === orcObj(JSON.parse(r.orcs[0]).id, 192) && r.orcs[1] === orcObj(JSON.parse(r.orcs[1]).id, 224), r.orcs.join('\n    '));
    t.check('Shift＋點連放、Esc 結束', r.orcPlace === 'orc' && r.esc === null, `${r.orcPlace} ${r.esc}`);
    t.eq('三個角色站的格子', r.roots, 'orc@5,3,orc@6,3,wolf@3,3');
    t.check('拖曳：鬼影跟著、整格移動寫檔', r.dragGhost === '4,5' && r.dragged.join() === '128,192,', `${r.dragGhost} ${r.dragged.join()}`);
    t.check('換角色：orc → wolf 變 template、同 id 同格', JSON.parse(r.replaced).template === KH_TPL && JSON.parse(r.replaced).x === 160 && JSON.parse(r.replaced).y === 128 && r.replacedRoot === 'wolf@5,3', `${r.replaced} ${r.replacedRoot}`);
    t.eq('屬性：respawn（int）＋自訂，照名稱排', r.props, JSON.stringify([{name: 'mood', type: 'string', value: 'angry'}, {name: 'respawn', type: 'int', value: 60}]));
    t.eq('拿掉屬性', r.propsDel, JSON.stringify([{name: 'respawn', type: 'int', value: 60}]));
    t.check('具名 NPC：放得下去、狀態列 ⚠', r.named.every(Boolean), r.named.join());
    t.check('Del 刪選取的', !r.deleted[0] && r.deleted[1] === null, r.deleted.join());
    t.check('右鍵選單：移到常駐／別的群組、刪除、↗', r.menu.includes('移到「常駐」') && r.menu.includes('移到「@bandits」') && r.menu.some(s => s.startsWith('刪除')) && r.menu.some(s => s.startsWith('↗')), r.menu.join());
    t.check('移到常駐：搬進 roles 層、數字跟著', r.moved === 'roles' && r.layerCounts === '=1,@wolves=2,@bandits=3', `${r.moved} ${r.layerCounts}`);
    t.eq('點 @bandits 層再放：放進群組', r.toGroup, '@bandits');
    t.check('undo 全部：兩張地圖回到原檔一字不差', r.undoAll[0] === 0 && r.undoAll[1] && r.undoAll[2], r.undoAll.join());
    t.check('redo 一步', r.redo[0] === 1 && r.redo[1], r.redo.join());
    t.check('別處改過不復原', /別處改過/.test(r.refuse ?? '') && r.refuseHi === 1, `${r.refuse} ${r.refuseHi}`);
});
