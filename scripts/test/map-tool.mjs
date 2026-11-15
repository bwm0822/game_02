// 地圖分頁（tools/map/）：地圖樹＋徽章、世界總覽、畫地圖＋角色、右欄圖層／群組／角色；node scripts/test/map-tool.mjs
import {run} from './harness.mjs'

// 頁面裡用：OPFS 假專案（真的 json＋幾張地圖），回傳 {assets}
const SETUP = async () => {
    const opfs = await navigator.storage.getDirectory();
    for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
    const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
    const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
    const assets = await dir(opfs, 'game', 'public', 'assets'), json = await dir(assets, 'json'), maps = await dir(assets, 'maps');
    for (const f of ['role.json', 'item.json', 'part.json', 'story.json', 'navgraph.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
    // m/m_03x05.json 用凍結的 scripts/test/fixtures/m_03x05.json（真的那張會一直在 Tiled 改，角色數、位置都寫在斷言裡）
    const FROZEN = {'m/m_03x05.json': '/scripts/test/fixtures/m_03x05.json'};
    const copy = async (rel) => {
        const segs = rel.split('/'), d = await dir(maps, ...segs.slice(0, -1));
        await write(d, segs.at(-1), await (await fetch(FROZEN[rel] ?? `/assets/maps/${rel}`)).text());
    };
    for (const f of ['main.world', 'm/m_03x05.json', 'm/m_04x05.json', 'm_04x05/karen-home.json', '_m_00x00.json',
        'm_04x05/trump-inn-f1.json', 'm_04x05/trump-inn-f2.json']) await copy(f);
    // 假地圖（不在 public/）：fixture-01＝圖塊物件的 rogue（role.json 沒有）跟 orc；fixture-02＝門（好的、地圖不存在、落腳點不存在）
    const W = 12, fx = (objs) => JSON.stringify({compressionlevel: -1, height: W, infinite: false,
        layers: [{data: new Array(W * W).fill(0), height: W, id: 1, name: 'map', opacity: 1, type: 'tilelayer', visible: true, width: W, x: 0, y: 0},
            {draworder: 'topdown', id: 2, name: 'layer3', objects: objs, opacity: 1, type: 'objectgroup', visible: true, x: 0, y: 0}],
        nextlayerid: 3, nextobjectid: 10, orientation: 'orthogonal', renderorder: 'right-down', tiledversion: '1.11.0', tileheight: 32,
        tilesets: [{firstgid: 1, source: '../tilesets/monsters.tsj'}, {firstgid: 200, source: '../tilesets/npcs.tsj'}],
        tilewidth: 32, type: 'map', version: '1.10', width: W});
    const npc = (id, gid, rid, x, y, w) => ({gid, height: 64, id, name: '', properties: [{name: 'id', type: 'string', value: rid}], rotation: 0, type: 'npc', visible: true, width: w, x, y});
    const port = (id, name, map, to, x, y) => ({height: 32, id, name, properties: [{name: 'map', type: 'string', value: map}, {name: 'port', type: 'string', value: to}],
        rotation: 0, type: 'port', visible: true, width: 32, x, y});
    await write(maps, 'fixture-01.json', fx([npc(1, 205, 'rogue', 64, 128, 32), npc(3, 1, 'orc', 192, 320, 64)]));
    await write(maps, 'fixture-02.json', fx([port(1, 'to-kh', 'm_04x05/karen-home', 'door', 64, 64), port(2, 'to-nowhere', 'no-such-map', 'door', 160, 64),
        port(3, 'to-kh-bad', 'm_04x05/karen-home', 'nope', 256, 64)]));
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
        out.sum = [S.sums['m/m_03x05'], S.sums['fixture-01']?.roles, S.sums['m/m_04x05']?.roles];
        const items = () => [...document.querySelectorAll('#list .item')];
        const heads = () => [...document.querySelectorAll('#list .group.fold')];
        const itemOf = (m) => items().find(e => e.dataset.map === m);
        const roomArrow = () => itemOf('m/m_04x05')?.querySelector('.arrow.fold');
        out.heads = heads().map(g => g.textContent.slice(1)).join();
        for (const g of heads()) if (g.querySelector('.arrow').textContent === '▸') g.click();
        out.roomFolded = [!itemOf('m_04x05/karen-home'), itemOf('m/m_04x05')?.querySelector('.badges')?.textContent];
        // 摺著：房子的 ⚠ 加總掛在世界地圖那列
        const iss0 = S.sums['m_04x05/trump-inn-f2'].issues;
        S.sums['m_04x05/trump-inn-f2'].issues = [...iss0, '測試1', '測試2'];
        mt.render();
        out.roomWarn = itemOf('m/m_04x05')?.querySelector('.badges .warn:last-child')?.textContent;
        roomArrow().click();
        out.roomOpen = [items().map(e => e.dataset.map).slice(1, 5).join(), itemOf('m_04x05/karen-home')?.classList.contains('sub'),
            itemOf('m_04x05/karen-home')?.textContent.startsWith('karen-home'), /🏠⚠/.test(itemOf('m/m_04x05')?.textContent), localStorage.getItem('tools.map.open')];
        S.sums['m_04x05/trump-inn-f2'].issues = iss0;
        mt.render();
        out.badge = itemOf('m/m_03x05')?.querySelector('.badges')?.textContent;
        out.emptyDim = itemOf('m_04x05/karen-home')?.classList.contains('empty');
        document.getElementById('onlyRoles').click();
        out.only = items().map(e => e.dataset.map);
        out.onlyMem = localStorage.getItem('tools.map.only');
        document.getElementById('onlyRoles').click();
        // 搜尋：房子對到 → 世界地圖跟著列（淡色）、世界地圖對到不帶房子
        const search = (v) => {const s = document.getElementById('search'); s.value = v; s.dispatchEvent(new Event('input'));};
        roomArrow().click();
        search('karen');
        out.search = items().map(e => `${e.dataset.map}${e.classList.contains('empty') ? '~' : ''}`).join();
        search('m/m_04');
        out.search2 = items().map(e => e.dataset.map).join();
        search('');
        // 選著世界地圖時點「世界」摺得起來、重畫也不會彈開
        mt.selectMap('m/m_03x05');
        heads()[0].click();
        mt.render();
        out.foldSel = [heads()[0].querySelector('.arrow').textContent, !itemOf('m/m_03x05')];
        // 從外面換選取（undo、總覽、門…）：展開所在的組＋世界地圖那層
        mt.selectMap('m_04x05/trump-inn-f1');
        out.reveal = [document.querySelector('#list .item.sel')?.dataset.map, heads()[0].querySelector('.arrow').textContent];
        mt.selectMap('m_04x05/trump-inn-f1');

        // ---- 總覽（canvas＋panzoom） ----
        const cv = () => document.querySelector('#view canvas');
        const wst = () => cv()?.st;
        const cells = () => (wst()?.world ? wst().geo.cells : []);
        await until(() => wst()?.world && wst().imgs.size > 0);
        // 測試視窗小，裝滿時一格不到 15px 字的門檻，先放到 1 倍（一格 100px）
        Object.assign(wst().pz.view, {zoom: 1, ox: 0, oy: 0});
        await sleep(50); wst().redraw();
        // 總覽單位 → 螢幕座標
        const wAt = (p) => {const s = wst(), b = cv().getBoundingClientRect(); return {clientX: b.left + s.pz.o.x + p.x * s.pz.K, clientY: b.top + s.pz.o.y + p.y * s.pz.K};};
        const cellAt = (name, fx = 0.5, fy = 0.5) => {const c = cells().find(x => x.w.name === name); return wAt({x: c.x + c.cw * fx, y: c.y + c.ch * fy});};
        out.cells = cells().length;
        const c35 = cells().find(c => c.w.name === 'm/m_03x05');
        const hitsOf = (kind, map) => wst().hits.filter(x => x.kind === kind && (!map || x.map === map));
        out.dots = hitsOf('dot', 'm/m_03x05').map(x => x.d.layer).sort().join();
        // 第一隻狼的位置照地圖檔算：tile 物件中心（y 是底部）＋role.anchor
        const m35src = await (await fetch('/scripts/test/fixtures/m_03x05.json', {cache: 'no-store'})).json();
        const w0 = m35src.layers.find(l => l.name === '@wolves').objects[0];
        const tj = (await (await fetch(new URL(w0.template, `${location.origin}/assets/maps/m/`).href, {cache: 'no-store'})).json()).object;
        const an = S.roles.wolf.anchor ?? {x: 0, y: 0};
        const W0 = {o: [w0.x, w0.y], root: [w0.x + tj.width / 2 + an.x, w0.y - tj.height / 2 + an.y]};
        out.W0 = W0;
        const wolfDot = hitsOf('dot', 'm/m_03x05').find(x => x.d.rid === 'wolf' && x.d.x === W0.root[0] && x.d.y === W0.root[1]);
        out.dotPos = wolfDot && [Math.abs(wolfDot.x + wolfDot.w / 2 - (c35.x + W0.root[0] * wst().geo.unit)) < 0.01, Math.abs(wolfDot.y + wolfDot.h / 2 - (c35.y + W0.root[1] * wst().geo.unit)) < 0.01];
        out.room = hitsOf('room').map(x => x.map).join();
        out.noRight = document.getElementById('right').children.length;
        // 倍率上限 6、倍率欄 max
        const WV = wst().pz.view;
        mt.PZ.setZoom(50, 0, 0, WV);
        out.zmax = [WV.zoom, document.querySelector('#view input.zoom')?.max];
        // 裝滿時格子太小不寫字
        mt.PZ.center(WV);
        await sleep(30); wst().redraw();
        out.smallNoText = [cells()[0].cw * WV.zoom < 15 * 4.5, hitsOf('room').length];
        Object.assign(WV, {zoom: 1, ox: 0, oy: 0});
        await sleep(30); wst().redraw();
        // 左鍵拖：平移、不開地圖
        const ox0 = WV.ox, p0 = cellAt('m/m_00x00');
        cv().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0, ...p0}));
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: p0.clientX + 30, clientY: p0.clientY}));
        cv().dispatchEvent(new PointerEvent('pointerup', {bubbles: true, clientX: p0.clientX + 30, clientY: p0.clientY}));
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: p0.clientX + 30, clientY: p0.clientY}));
        out.drag = [Math.round(WV.ox - ox0), S.sel];
        Object.assign(WV, {zoom: 1, ox: 0, oy: 0});
        await sleep(30); wst().redraw();
        // 🏠：點了列室內地圖、選一張打開
        const rb = hitsOf('room', 'm/m_04x05')[0];
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...wAt({x: rb.x + rb.w / 2, y: rb.y + rb.h / 2})}));
        out.roomMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent.split('　')[0]).join();
        document.querySelector('.ctxmenu')?.remove();
        // 點小點（放大到 6 倍、點放正中央，縮小時點會疊在一起）：打開那張地圖、選取那個角色
        const dc = {x: c35.x + W0.root[0] * wst().geo.unit, y: c35.y + W0.root[1] * wst().geo.unit};
        Object.assign(WV, {zoom: 6, ox: -dc.x * 6, oy: -dc.y * 6});
        wst().redraw();
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...wAt(dc)}));
        out.dotClick = [S.sel, S.pick === wolfDot?.d.oid];
        mt.selectMap(S.sel);        // 回總覽
        await until(() => wst()?.world);
        // 時間游標在總覽：12:00
        mt.setTime(12 * 60, true);
        out.wtime = [wst().npcs.some(n => n.id === 'trump' && n.room === 'm/m_04x05'), wst().npcs.some(n => n.x != null), !document.querySelector('#view .timebar .dim')];
        mt.setTime(12 * 60, false);
        // 點格子打開
        await sleep(30); wst().redraw();
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...cellAt('m/m_03x05', 0.1, 0.9)}));
        out.sel = [S.sel, localStorage.getItem('tools.map.sel')];

        // ---- 地圖 ----
        await until(() => cv()?.st.data && document.querySelector('#right .roles'));
        const st = cv().st;
        out.size = [st.data.W, st.data.H];
        out.roles = st.roles.map(it => `${it.layer}:${it.rid}`).sort();
        const wolf = st.roles.find(it => it.rid === 'wolf' && it.o.x === W0.o[0] && it.o.y === W0.o[1]);
        out.wolfRoot = wolf && [wolf.at.root.x, wolf.at.root.y];
        const sp = st.sprites.get('wolf'), rog = st.sprites.get('rogue-1');
        const opaque = (c) => {const a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < a.length; i += 4) if (a[i]) n++; return n;};
        out.sprites = [!!sp && opaque(sp) > 50, !!rog && opaque(rog) > 50];
        // 角色不烤進底圖（另外畫）：tag map 的烤圖跟作息地圖那份（有烤 template 狼）在狼那格不一樣
        // （m_03x05 的狼 template 用的 tileset 不在地圖裡，兩份都沒畫；改看 fixture-01 的圖塊物件 orc）
        const plain = await mt.MV.mapData('fixture-01'), noRole = await mt.MV.mapData('fixture-01', {skip: (o) => o.type === 'npc' && !!o.props.id, tag: 'map'});
        const orc = plain.objs.find(o => o.props.id === 'orc');
        const px = (c, x, y) => [...c.getContext('2d').getImageData(x, y, 1, 1).data].join();
        let diff = 0;
        for (let y = orc.y - orc.height; y < orc.y; y += 2) for (let x = orc.x; x < orc.x + orc.width; x += 2) if (px(plain.bake, x, y) !== px(noRole.bake, x, y)) diff++;
        out.skipBake = diff;

        // 右欄：常駐＋兩個群組（條件照 story.json）、角色清單
        const right = document.getElementById('right');
        out.layers = [...right.querySelectorAll('.layer')].map(e => `${e.dataset.layer}=${e.querySelector('.n').textContent}`);
        out.cond = right.querySelector('.layer[data-layer="@wolves"] input.cond')?.value;
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
        await until(() => wst()?.world);
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
        out.undoAll = [S.hi, await readText(`${KH}.json`) === orig, await readText('m/m_03x05.json') === await (await fetch('/scripts/test/fixtures/m_03x05.json')).text()];
        await mt.redo();
        m = await readKH();
        out.redo = [S.hi, !!m.layers.find(l => l.name === 'roles')];
        // 別處改過就不復原
        const kd = await mapsDir.getDirectoryHandle('m_04x05'), w = await (await kd.getFileHandle('karen-home.json')).createWritable();
        await w.write((await readText(`${KH}.json`)) + ' '); await w.close();
        await mt.undo().catch(e => {out.refuse = e.message;});
        out.refuseHi = S.hi;

        // ================= 第 4 步：@群組＋spawns =================
        const jsonDir = await assets.getDirectoryHandle('json');
        const readStory = async () => (await (await jsonDir.getFileHandle('story.json')).getFile()).text();
        const FX = 'fixture-01';
        const snap = {story: await readStory(), forest: await readText(`${FX}.json`), m35: await readText('m/m_03x05.json'), kh: await readText(`${KH}.json`)};
        const hi0 = S.hi;
        const dlg = document.getElementById('dlgAsk');
        const answer = async (fn) => {await until(() => dlg.open); const v = fn(dlg); dlg.close(v);};
        const spawnsOf = (st) => Object.fromEntries(Object.entries(JSON.parse(st).lines).flatMap(([l, x]) => Object.entries(x.spawns ?? {}).map(([g, c]) => [g, `${l}:${c}`])));
        const line0 = S.lines[0];
        saved.length = 0;

        // 新群組：選劇情線＋條件，地圖加空圖層、story.json 加 spawns，目標層換過去
        mt.selectMap(FX);
        await settle();
        let pr2 = mt.newGroup();
        await answer(d => {
            const [nm, cd] = d.querySelectorAll('input');
            nm.value = 'deer'; nm.dispatchEvent(new Event('input'));
            d.querySelector('select').value = line0; cd.value = 'wolf_hunt>=2';
            return 'ok';
        });
        await pr2;
        await settle();
        let fm = JSON.parse(await readText(`${FX}.json`));
        const deer = fm.layers.find(l => l.name === '@deer');
        out.newGrp = [!!deer && deer.objects.length === 0 && deer.type === 'objectgroup', spawnsOf(await readStory()).deer, S.target,
            !!document.querySelector('#right .layer[data-layer="@deer"]'), saved.includes('story.json') && saved.includes(`maps/${FX}.json`), localStorage.getItem('tools.map.line')];
        // 已有的群組（wolves）：共用條件、只加圖層、不動 story.json
        mt.selectMap(KH);
        await settle();
        const storyBefore = await readStory();
        pr2 = mt.newGroup();
        await answer(d => {
            const nm = d.querySelector('input');
            nm.value = 'wolves'; nm.dispatchEvent(new Event('input'));
            out.shareHint = [d.querySelector('.hint').textContent, d.querySelector('select').disabled];
            return 'ok';
        });
        await pr2;
        await settle();
        out.shared = [JSON.parse(await readText(`${KH}.json`)).layers.some(l => l.name === '@wolves'), await readStory() === storyBefore, S.hist[S.hi - 1].files.length];
        // 同一張圖重複擋
        pr2 = mt.newGroup();
        await answer(d => {d.querySelector('input').value = 'wolves'; return 'ok';});
        await pr2;
        out.dupBlock = document.getElementById('status').textContent;

        // 改條件（右欄的條件欄）；認不得的 quality 標 ⚠
        mt.selectMap(FX);
        await settle();
        const ci =() => document.querySelector('#right .layer[data-layer="@deer"] input.cond');
        ci().value = 'wolf_hunt>=3'; ci().dispatchEvent(new Event('change'));
        await until(() => spawnsOf(storyBefore).deer !== undefined || true);
        await sleep(200); await settle();
        out.cond3 = spawnsOf(await readStory()).deer;
        ci().value = 'no_such_q>1'; ci().dispatchEvent(new Event('change'));
        await sleep(200); await settle();
        out.condWarn = [...document.querySelectorAll('#right .layer[data-layer="@deer"] .warn')].map(e => e.textContent).join();
        out.dl = !!document.querySelector('#dl-cond option[value="wolf_hunt"]');
        // 群組右鍵選單
        document.querySelector('#right .layer[data-layer="@deer"]').dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: 50, clientY: 50}));
        out.gmenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        document.querySelector('.ctxmenu')?.remove();

        // 👁：藏起 @wolves（只影響畫面）
        mt.selectMap('m/m_03x05');
        await settle();
        document.querySelector('#right .layer[data-layer="@wolves"] .eye').click();
        out.hide = [cv().st.roles.length, cv().st.all.length, document.querySelector('#right .layer[data-layer="@wolves"]').classList.contains('hid'),
            localStorage.getItem('tools.map.hide'), document.querySelectorAll('#right .r.hid').length];
        document.querySelector('#right .layer[data-layer="@wolves"] .eye').click();
        out.unhide = cv().st.roles.length;

        // 改名 wolves → pack：用到的地圖（m_03x05、karen-home）＋story.json 一起改，一筆 undo
        pr2 = mt.renameGroup('wolves');
        await answer(d => {
            out.renameHint = [d.querySelector('.hint').textContent, !!d.querySelector('.warn')];
            d.querySelector('input').value = 'pack';
            return 'ok';
        });
        await pr2;
        await settle();
        const m35 = JSON.parse(await readText('m/m_03x05.json')), kh2 = JSON.parse(await readText(`${KH}.json`)), sps = spawnsOf(await readStory());
        out.renamed = [m35.layers.some(l => l.name === '@pack') && !m35.layers.some(l => l.name === '@wolves'), kh2.layers.some(l => l.name === '@pack'),
            sps.pack, 'wolves' in sps, S.hist[S.hi - 1].files.length, S.sums['m/m_03x05'].groups.join(), cv().st.all.filter(it => it.layer === '@pack').length];
        // 改成已有的名字擋
        pr2 = mt.renameGroup('pack');
        await answer(d => {d.querySelector('input').value = 'bandits'; return 'ok';});
        await pr2;
        out.renameBlock = document.getElementById('status').textContent;
        // 改名 bandits → gang：計數器的 kill:@bandits 跟著改；再改回來
        pr2 = mt.renameGroup('bandits');
        await answer(d => {d.querySelector('input').value = 'gang'; return 'ok';});
        await pr2;
        await settle();
        out.renameKill = (await readStory()).includes('kill:@gang') && !(await readStory()).includes('kill:@bandits');
        pr2 = mt.renameGroup('gang');
        await answer(d => {d.querySelector('input').value = 'bandits'; return 'ok';});
        await pr2;
        await settle();

        // 刪除：karen-home 的 @pack（別張圖還在用）→ 只刪圖層
        mt.selectMap(KH);
        await settle();
        pr2 = mt.deleteGroup('pack');
        await answer(d => {out.delBtns1 = [...d.querySelectorAll('.buttons button')].map(b => b.value).join(); return 'layer';});
        await pr2;
        await settle();
        out.del1 = [JSON.parse(await readText(`${KH}.json`)).layers.some(l => l.name === '@pack'), 'pack' in spawnsOf(await readStory())];
        // fixture-01 的 @deer 是最後一張 → 可以連條件一起刪
        mt.selectMap(FX);
        await settle();
        pr2 = mt.deleteGroup('deer');
        await answer(d => {out.delBtns2 = [...d.querySelectorAll('.buttons button')].map(b => b.value).join(); return 'all';});
        await pr2;
        await settle();
        out.del2 = [JSON.parse(await readText(`${FX}.json`)).layers.some(l => l.name === '@deer'), 'deer' in spawnsOf(await readStory()), S.target];

        // undo 回到第 4 步之前：story.json＋三張地圖一字不差
        while (S.hi > hi0) await mt.undo();
        out.undo4 = [await readStory() === snap.story, await readText(`${FX}.json`) === snap.forest, await readText('m/m_03x05.json') === snap.m35, await readText(`${KH}.json`) === snap.kh];

        // ================= 第 5 步：⚠ 檢查 =================
        // fixture-01 的 rogue 在 role.json 沒有 → 左欄徽章 ⚠
        out.v01 = [S.sums[FX].issues.join(), items().find(e => e.dataset.map === FX)?.querySelector('.badges .warn')?.textContent];
        // karen-home：放一隻狼在牆上（擋路格）、放 karen（具名 NPC）
        mt.selectMap(KH);
        await settle();
        const g5 = mt.MV.gridOf(cv().st.data);
        let wall = null, open = null;
        g5.forEach((row, ty) => row.forEach((w, tx) => {if (!wall && w === 0 && tx > 0 && ty > 1) wall = [tx, ty]; if (!open && w > 0 && tx > 2 && ty > 2) open = [tx, ty];}));
        await mt.placeRole(KH, 'wolf', wall, false);
        await settle();
        await mt.placeRole(KH, 'karen', open, false);
        await settle();
        const iss = [...cv().st.issues.values()].flat();
        out.iss = iss.map(x => `${x.level}:${x.rid}:${x.msg}`);
        out.badgeKH = items().find(e => e.dataset.map === KH)?.querySelector('.badges .warn')?.textContent;
        out.rowWarn = document.querySelectorAll('#right .roles .r .warn').length;
        const kar = cv().st.roles.find(it => it.rid === 'karen');
        S.pick = kar.o.id; mt.render();
        await settle();
        out.pickWarn = [...document.querySelectorAll('#right .picked .issue')].map(e => e.textContent).join();

        // ================= 第 6 步：時間游標 =================
        const F1 = 'm_04x05/trump-inn-f1', F2 = 'm_04x05/trump-inn-f2';
        mt.selectMap(F1);
        await settle();
        out.timeOff = [document.querySelector('#view [data-k=timeOn]')?.checked, (cv().st.npcs ?? []).length];
        const tin = document.querySelector('#view [data-k=timeT]');
        tin.value = '12:00'; tin.dispatchEvent(new Event('change'));
        await sleep(100);
        const n12 = cv().st.npcs.map(x => `${x.id}:${x.at.kind}:${x.n.name}`);
        out.t12 = [n12.join(), S.timeOn, localStorage.getItem('tools.map.t'), localStorage.getItem('tools.map.time'), !document.querySelector('#view .timebar .dim')];
        // 滑過：浮動框
        await sleep(50);
        const tx = cv().st.npcs.find(x => x.id === 'trump');
        if (tx)
        {
            const b = cv().getBoundingClientRect(), s = cv().st, c = {x: tx.n.cen.x - (S.roles.trump.anchor?.x ?? 0), y: tx.n.cen.y - (S.roles.trump.anchor?.y ?? 0)};
            cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: b.left + s.pz.o.x + (c.x - s.data.W / 2) * s.pz.K, clientY: b.top + s.pz.o.y + (c.y - s.data.H / 2) * s.pz.K}));
            out.ttip = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent).join(' | ');
        }
        // 03:00：trump 在 2F 床上，1F 沒有他
        mt.setTime(3 * 60, true);
        out.t3f1 = cv().st.npcs.some(x => x.id === 'trump');
        mt.selectMap(F2);
        await settle();
        out.t3f2 = cv().st.npcs.filter(x => x.id === 'trump').map(x => `${x.at.kind}:${x.n.type}`).join();
        // 關掉
        document.querySelector('#view [data-k=timeOn]').click();
        out.offAgain = [cv().st.npcs.length, localStorage.getItem('tools.map.time')];
        // 📍 跟著：下拉挑 trump
        {
            const TP = await import('/tools/common/schedpos.js');
            const fSel = () => document.querySelector('#view [data-k=timeFollow]');
            const centered = () => {
                const s = cv().st, x = s.npcs.find(n => n.id === 'trump'), c = x && TP.npcCen(x, S.roles);
                return !!c && Math.abs(s.pz.view.ox + (c.x - s.data.W / 2) * s.pz.K) < 0.5 && Math.abs(s.pz.view.oy + (c.y - s.data.H / 2) * s.pz.K) < 0.5;
            };
            out.fDef = [fSel()?.value, S.follow, [...fSel().querySelectorAll('option')].some(o => o.value === 'trump')];
            cv().st.pz.view.ox += 40;
            fSel().value = 'trump'; fSel().dispatchEvent(new Event('change'));
            await sleep(50);
            out.fPick = [S.follow, localStorage.getItem('tools.map.follow'), S.timeOn, S.sel === F2, centered()];
            // 12:00 他在 1F：自動切過去、讀完置中
            mt.setTime(12 * 60, true);
            await until(() => S.sel === F1 && cv()?.st.data && centered());
            out.fSwitch = [S.sel === F1, centered(), fSel().value];
            // 拖滑桿：拖到一半換圖也不斷
            const rng = () => document.querySelector('#view [data-k=timeR]'), rc = rng().getBoundingClientRect();
            const xOf = (m) => rc.left + 8 + (m / 1430) * (rc.width - 16), cy = rc.top + rc.height / 2;
            const ev = (el, type, m) => el.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: xOf(m), clientY: cy}));
            ev(rng(), 'pointerdown', 12 * 60);
            ev(window, 'pointermove', 23 * 60 + 30);
            await until(() => S.sel === F2 && cv()?.st.data);
            ev(window, 'pointermove', 23 * 60 + 40);
            await sleep(30);
            out.fDrag = [S.t, +rng().value, document.querySelector('#view [data-k=timeT]').value, S.sel === F2, centered()];
            ev(window, 'pointerup', 23 * 60 + 40);
            ev(window, 'pointermove', 12 * 60);
            out.fDrag.push(S.t);
            // 總覽：留在總覽、鏡頭移到他所在的世界圖格子（在室內＝房子所屬的那格中心）
            mt.selectMap(F2);
            await until(() => !S.sel && cv()?.st.world);
            mt.setTime(12 * 60, true);
            await sleep(30);
            const ws = cv().st, wn = ws.npcs.find(n => n.id === 'trump'), wc = wn && ws.geo.cells.find(c => c.w.name === wn.room);
            out.fWorld = [S.sel, !!wc, !!wc && Math.abs(ws.pz.view.ox + (wc.x + wc.cw / 2) * ws.pz.K) < 0.5 && Math.abs(ws.pz.view.oy + (wc.y + wc.ch / 2) * ws.pz.K) < 0.5];
            // （不跟）：清掉記錄、動時間不換圖
            fSel().value = ''; fSel().dispatchEvent(new Event('change'));
            mt.selectMap(F2);
            await settle();
            mt.setTime(12 * 60, true);
            await sleep(30);
            out.fNone = [S.follow, localStorage.getItem('tools.map.follow'), S.sel === F2];
            mt.setTime(12 * 60, false);
        }

        // ================= 作息點：at 格子、撞了、巡邏經過、占用時間圖、時刻線、點了選一筆 =================
        // 假作息（不靠真的 role.json）：za 08:00～20:00 在 @8,2、20:00～08:00 在 @3,6 巡邏 @8,2／@10,10；zb 10:00～12:00 在 @8,2 → @8,2 撞 10:00～12:00
        mt.selectMap('fixture-01');
        await until(() => cv()?.st.name === 'fixture-01' && cv().st.data);
        const roles0 = S.roles, occ0 = S.occ;
        // 時間游標畫實際位置：假路網（曼哈頓距離），zw 11:52 從 @1,1 走到 @1,9（8 分）、zp 09:00 起單向巡邏 @5,1 → @9,1（4 分）
        {
            const SP = await import('/src/data/schedplan.js'), SB = await import('/tools/role/schedbar.js');
            const FX = 'fixture-01', K = (x, y) => `${FX}:@${x},${y}`, P = [[1, 1], [1, 9], [5, 1], [9, 1]];
            const nodes = {}, edges = {};
            for (const a of P) {nodes[K(...a)] = {}; edges[K(...a)] = P.filter(b => b !== a).map(b => ({to: K(...b), cost: Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), type: 'walk'}));}
            const zw = [{t: '@08:00', map: FX, at: [1, 1]}, {t: '@12:00', map: FX, at: [1, 9]}];
            const zp = [{t: '@08:00', map: FX, at: [1, 1]}, {t: '@09:00', map: FX, at: [5, 1], do: 'patrol', route: ['@5,1', '@9,1'], mode: 'oneway'}];
            const nav0 = S.nav, plans0 = S.plans;
            S.nav = {nodes, edges};
            S.roles = {...roles0, zw: {schedule: zw}, zp: {schedule: zp}};
            S.plans = {};
            for (const [id, sch] of [['zw', zw], ['zp', zp]]) {const plan = SP.buildPlan(sch, edges, nodes).plan; S.plans[id] = {sch, plan, segs: SB.daySegs(plan, sch)};}
            const tileOf = (id) => {const x = cv().st.npcs.find(n => n.id === id); return x && [Math.floor(x.n.cen.x / 32), Math.floor(x.n.cen.y / 32), x.at.kind];};
            mt.setTime(11 * 60 + 56, true);
            out.posWalk = tileOf('zw');
            mt.setTime(9 * 60 + 2, true);
            out.posPatrol = tileOf('zp');
            mt.setTime(9 * 60 + 30, true);
            out.posDone = tileOf('zp');
            // 從終點出發：zp 回 @1,1 的路從 @9,1 走（8 分），07:56 在 @5,1
            mt.setTime(7 * 60 + 56, true);
            out.posBack = tileOf('zp');
            // 滾輪不調時間
            const rng = document.querySelector('#view [data-k=timeR]');
            const t0 = S.t;
            rng.dispatchEvent(new WheelEvent('wheel', {deltaY: 100, bubbles: true, cancelable: true}));
            out.wheelOff = S.t === t0;
            // ↑↓：整頁（畫布、body）都有效、沒勾會勾起來、跨午夜繞回；HH:MM 欄跟滑桿有焦點也行；按 Ctrl 不理
            const tinp = document.querySelector('#view [data-k=timeT]');
            const kd = (el, key, o = {}) => el.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...o}));
            mt.setTime(23 * 60 + 59, false);
            kd(cv(), 'ArrowUp'); const k1 = [S.t, S.timeOn];
            kd(document.body, 'ArrowUp', {shiftKey: true}); const k2 = S.t;
            kd(document.body, 'ArrowDown'); const k3 = S.t;
            kd(document.body, 'ArrowDown', {ctrlKey: true}); const k4 = S.t;
            tinp.focus();
            kd(tinp, 'ArrowDown'); const k5 = [S.t, tinp.value];
            kd(rng, 'ArrowUp'); const k6 = S.t;
            tinp.blur();
            out.keys = [k1, k2, k3, k4, k5, k6];
            // ←→：上／下一個整 10 分、已整 10 分＝±10、跨午夜、Shift 沒作用、滑桿也行、HH:MM 欄裡不處理（移游標）
            mt.setTime(7 * 60 + 56, true);
            kd(document.body, 'ArrowRight'); const r1 = S.t;
            kd(cv(), 'ArrowRight', {shiftKey: true}); const r2 = S.t;
            mt.setTime(7 * 60 + 56, true);
            kd(document.body, 'ArrowLeft'); const r3 = S.t;
            kd(rng, 'ArrowLeft'); const r4 = S.t;
            mt.setTime(23 * 60 + 55, true);
            kd(document.body, 'ArrowRight'); const r5 = S.t;
            kd(document.body, 'ArrowLeft'); const r6 = S.t;
            tinp.focus();
            const ev = new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true, cancelable: true});
            tinp.dispatchEvent(ev);
            const r7 = [S.t, ev.defaultPrevented];
            tinp.blur();
            out.lr = [r1, r2, r3, r4, r5, r6, r7];
            S.nav = nav0; S.plans = plans0; S.roles = roles0;
            mt.setTime(11 * 60, false);
        }
        const za = [{t: '@08:00', map: 'fixture-01', at: [8, 2]}, {t: '@20:00', map: 'fixture-01', at: [3, 6], do: 'patrol', route: ['@8,2', '@10,10']}];
        const zb = [{t: '@10:00', map: 'fixture-01', at: [8, 2]}];
        S.roles = {...roles0, za: {schedule: za}, zb: {schedule: zb}};
        S.occ = [{id: 'za', sch: za, segs: [{kind: 'stay', i: 0, s: 480, len: 720}, {kind: 'stay', i: 1, s: 1200, len: 720}]},
            {id: 'zb', sch: zb, segs: [{kind: 'stay', i: 0, s: 600, len: 120}]}];
        cv().st.redraw();
        out.spots = [...cv().st.spots.values()].map(x => `${x.name}:${x.n.type}:${x.clash ? '撞' : ''}`).sort();
        const tileMid = (tx, ty) => {const s = cv().st, b = cv().getBoundingClientRect(); return {clientX: b.left + s.pz.o.x + (tx * 32 + 16 - s.data.W / 2) * s.pz.K, clientY: b.top + s.pz.o.y + (ty * 32 + 16 - s.data.H / 2) * s.pz.K};};
        const occLabs = () => [...document.querySelectorAll('#view .tip .occ .orow:not(.axis) .olab')].map(x => x.textContent + (x.tagName === 'B' ? '*' : ''));
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...tileMid(8, 2)}));
        out.spotTip = [document.querySelector('#view .tip .tname')?.textContent, occLabs(), document.querySelectorAll('#view .tip .oseg.clash').length,
            document.querySelectorAll('#view .tip .oseg.patrol').length, !document.querySelector('#view .tip .onow'), cv().style.cursor];
        mt.setTime(11 * 60, true);
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...tileMid(8, 2), clientX: tileMid(8, 2).clientX + 1}));
        out.spotNow = [occLabs(), !!document.querySelector('#view .tip .onow')];
        mt.setTime(11 * 60, false);
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...tileMid(8, 2)}));
        out.spotMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        document.querySelector('.ctxmenu')?.remove();
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...tileMid(10, 10)}));
        out.patrolTip = [document.querySelector('#view .tip .tname')?.textContent, occLabs(), document.querySelectorAll('#view .tip .oseg.clash').length];
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...tileMid(3, 6)}));
        out.oneNoMenu = !document.querySelector('.ctxmenu');
        S.roles = roles0;
        S.occ = occ0;
        cv().st.redraw();

        // ================= 物件名稱過濾 =================
        const {nameFilter} = await import('/tools/common/showmenu.js');
        const NM = ['sit-1', 'sit-2', 'cabinet-sit', 'bed', 'trump-p1', 'Musk-P1'];
        out.nf = ['', 'sit', 'sit-*', '*-p1', 'sit bed', 'bed,trump', 'SIT-1', '*'].map(q => `${q}=${NM.filter(nameFilter(q)).join('|')}`);
        mt.selectMap('fixture-02');
        await until(() => cv()?.st.name === 'fixture-02' && cv().st.data);
        const showBtn = () => document.querySelector('#view .showbtn');
        showBtn().click();
        const fpop = document.querySelector('.showpop'), finp = fpop.querySelector('[data-filter=names]'), fcount = () => fpop.querySelector('.fcount').textContent;
        const type = (v) => {finp.value = v; finp.dispatchEvent(new Event('input'));};
        out.f0 = [fcount(), fpop.querySelector('[data-show=names]').checked];
        type('kh');
        out.f1 = [fcount(), fpop.querySelector('[data-show=names]').checked, mt.SHOW.show.names, /🔍/.test(showBtn().textContent), localStorage.getItem('tools.map.show.filter')];
        type('*-bad');
        out.f2 = [fcount(), mt.SHOW.nameOk('to-kh-bad'), mt.SHOW.nameOk('to-kh')];
        fpop.querySelector('.fclear').click();
        out.f3 = [fcount(), finp.value, /🔍/.test(showBtn().textContent), localStorage.getItem('tools.map.show.filter'), mt.SHOW.nameOk('anything')];
        fpop.querySelector('[data-show=names]').click();
        showBtn().click();

        // ================= 門：點了進那張圖 =================
        const scr = (p) => {const s = cv().st, b = cv().getBoundingClientRect(); return {clientX: b.left + s.pz.o.x + (p.x - s.data.W / 2) * s.pz.K, clientY: b.top + s.pz.o.y + (p.y - s.data.H / 2) * s.pz.K};};
        const doorOf = (nm) => cv().st.ports.find(p => p.o.name === nm);
        const mid = (d) => scr({x: d.rect.x + d.rect.w / 2, y: d.rect.y + d.rect.h / 2});
        const centered = (nm) => {const n = cv().st.data.named.get(nm), p = scr(n.cen), b = cv().getBoundingClientRect(); return Math.abs(p.clientX - (b.left + b.width / 2)) < 1 && Math.abs(p.clientY - (b.top + b.height / 2)) < 1;};
        const backBtn = () => document.querySelector('#view button.back');
        out.doorShow = [mt.SHOW.show.doors, localStorage.getItem('tools.map.show')];
        mt.selectMap('m/m_04x05');
        await settle();
        // 假專案只抄了 karen-home、trump-inn 兩間（其他 15 間在這裡算不存在）
        out.doors = [cv().st.ports.length, cv().st.ports.filter(p => !p.issue).map(p => p.o.name).sort().join('+'), backBtn()?.disabled, S.back.length];
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...mid(doorOf('karen-home'))}));
        out.dtip = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent).join(' | ');
        out.dcursor = cv().style.cursor;
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...mid(doorOf('karen-home'))}));
        await settle();
        out.enter = [S.sel, S.back.join(), localStorage.getItem('tools.map.sel'), centered('door'), !!cv().st.flash, backBtn()?.disabled,
            document.querySelector('#list .item.sel')?.dataset.map];
        await sleep(1400);
        out.flashOff = cv().st.flash;
        // 從房裡的 door 出去：回到世界地圖、鏡頭在 karen-home 門上
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...mid(doorOf('door'))}));
        await settle();
        out.exit = [S.sel, S.back.join(), centered('karen-home')];
        // ← 返回
        backBtn().click();
        await settle();
        out.goBack = [S.sel, S.back.join(), backBtn()?.disabled];
        // 壞門：地圖不存在＝紅、點了不跳只提示；落腳點不存在＝黃、照樣進去＋提示
        mt.selectMap('fixture-02');
        await settle();
        out.bad = cv().st.ports.map(p => `${p.o.name}:${p.issue?.level ?? 'ok'}`).join();
        out.badBadge = [items().find(e => e.dataset.map === 'fixture-02')?.querySelector('.badges .warn')?.textContent, S.sums['fixture-02'].issues.join(' | ')];
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...mid(doorOf('to-nowhere'))}));
        out.badTip = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent).join(' | ');
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...mid(doorOf('to-nowhere'))}));
        await settle();
        out.noJump = [S.sel, document.getElementById('status').textContent];
        // 顯示 ▾ 關掉門：不畫也點不到；舊存檔沒寫 doors 也照預設勾
        mt.SHOW.show.doors = false;
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...mid(doorOf('to-kh-bad'))}));
        await settle();
        out.hidden = S.sel;
        mt.SHOW.show.doors = true;
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...mid(doorOf('to-kh-bad'))}));
        await settle();
        out.noLand = [S.sel, document.getElementById('status').textContent, S.back.at(-1)];

        // ================= 門改名：右鍵選單；別張圖指過來的門（m_04x05 的 karen-home、fixture-02 的 to-kh）port 一起改、一筆 undo =================
        const W4 = 'm/m_04x05';
        const origKh = await readText(`${KH}.json`), origW4 = await readText(`${W4}.json`), origF2 = await readText('fixture-02.json');
        const objsOf = async (m) => JSON.parse(await readText(`${m}.json`)).layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
        const portOf = async (m, nm) => (await objsOf(m)).find(o => o.name === nm)?.properties?.find(p => p.name === 'port')?.value;
        await settle();
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...mid(doorOf('door'))}));
        out.dtipKh = [...document.querySelectorAll('#view .tip > div')].map(e => e.textContent).join(' | ');
        cv().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, ...mid(doorOf('door'))}));
        out.doorMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        const hiD = S.hi;
        saved.length = 0;
        document.querySelector('.ctxmenu button').click();
        await answer(d => {out.doorRenTitle = d.querySelector('.title').textContent; d.querySelector('input').value = 'front'; return 'ok';});
        await until(() => S.hi === hiD + 1);
        await settle();
        out.doorRenamed = [!!(await objsOf(KH)).find(o => o.name === 'front'), await portOf(W4, 'karen-home'), await portOf('fixture-02', 'to-kh'), await portOf('fixture-02', 'to-kh-bad'),
            S.hist[S.hi - 1].files.map(f => f.rel).sort().join(), [`maps/${KH}.json`, `maps/${W4}.json`, 'maps/fixture-02.json'].every(f => saved.includes(f)),
            S.sums['fixture-02'].issues.length];
        await mt.undo();
        out.doorUndo = [await readText(`${KH}.json`) === origKh, await readText(`${W4}.json`) === origW4, await readText('fixture-02.json') === origF2];

        // ================= 作息 point：右鍵新增、拖曳、改名（連 role.json 一筆 undo）、刪除 =================
        const roleFile = async () => (await (await jsonDir.getFileHandle('role.json')).getFile()).text();
        const writeRole = async (text) => {const w = await (await jsonDir.getFileHandle('role.json')).createWritable(); await w.write(text); await w.close();};
        const orig01 = await readText(`${FX}.json`), origRole = await roleFile();
        const objs01 = async () => JSON.parse(await readText(`${FX}.json`)).layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
        const pt01 = async (nm) => (await objs01()).find(o => o.name === nm);
        mt.selectMap(FX);
        await settle();
        out.navBanner = document.querySelector('#view .navstale')?.textContent ?? '';
        const hiP = S.hi;
        saved.length = 0;
        cv().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, ...tileMid(9, 2)}));
        out.emptyMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        let pp = (document.querySelector('.ctxmenu button').click(), null);
        await answer(d => {out.newDef = d.querySelector('input').value; return 'ok';});
        await until(() => S.hi === hiP + 1);
        await settle();
        const f1 = JSON.parse(await readText(`${FX}.json`));
        out.added = [JSON.stringify(await pt01('p1')), f1.nextobjectid, f1.layers[1].objects.length, saved.includes(`maps/${FX}.json`), !!cv().st.data.named.get('p1')];
        // 滑過：手掌、提示拖曳／右鍵
        const p1c = () => scr(cv().st.data.named.get('p1').cen);
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...p1c()}));
        out.ptHover = [cv().style.cursor, document.querySelector('#view .tip .thint')?.textContent];
        // 拖到 5,4
        cv().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0, ...p1c()}));
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, ...tileMid(5, 4)}));
        out.pdrag = [cv().st.pdrag?.moved, cv().st.pdrag?.to.x, cv().st.pdrag?.to.y];
        cv().dispatchEvent(new PointerEvent('pointerup', {bubbles: true, ...tileMid(5, 4)}));
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, ...tileMid(5, 4)}));
        await until(() => S.hi === hiP + 2);
        await settle();
        out.ptMoved = [(await pt01('p1'))?.x, (await pt01('p1'))?.y];
        // 有作息用 p1：刪除擋、改名連 role.json
        const roleData = JSON.parse(origRole);
        roleData.zz = {schedule: [{t: '@08:00', map: FX, go: 'p1'}, {t: '@12:00', map: FX, at: [1, 1], do: 'patrol', route: ['p1', '@1,1']}]};
        await writeRole(JSON.stringify(roleData, null, 2));
        const roleWithZz = await roleFile();
        chan.postMessage({type: 'saved', file: 'role.json'});
        await until(() => S.roles.zz);
        cv().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, ...p1c()}));
        out.ptMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        document.querySelector('.ctxmenu')?.remove();
        pp = mt.deletePoint(FX, 'p1');
        await answer(d => {out.delBlock = [d.querySelector('.title').textContent, d.querySelector('.body').textContent]; return 'ok';});
        await pp;
        out.delBlocked = [!!await pt01('p1'), S.hi];
        // 改成已有的名字擋：先加 p2 在 1,1
        pp = mt.newPoint(FX, [1, 1]);
        await answer(d => {out.newDef2 = d.querySelector('input').value; return 'ok';});
        await pp;
        pp = mt.renamePoint(FX, 'p1');
        await answer(d => {d.querySelector('input').value = 'p2'; return 'ok';});
        await pp;
        out.renameDup = [document.getElementById('status').textContent, S.hi];
        saved.length = 0;
        pp = mt.renamePoint(FX, 'p1');
        await answer(d => {out.renameTitle = d.querySelector('.title').textContent; d.querySelector('input').value = 'home'; return 'ok';});
        await pp;
        await settle();
        const rz = JSON.parse(await roleFile()).zz?.schedule;
        out.ptRenamed = [!!await pt01('home'), !await pt01('p1'), rz?.[0].go, rz?.[1].route.join(), saved.includes('role.json'), saved.includes(`maps/${FX}.json`),
            S.hist[S.hi - 1].files.map(f => f.rel).join(), S.roles.zz?.schedule[0].go];
        // 沒人用的 p2：確認後刪
        pp = mt.deletePoint(FX, 'p2');
        await answer(() => 'ok');
        await pp;
        out.ptDeleted = !await pt01('p2');
        // undo 改名：地圖＋role.json 一起回去
        await mt.undo();
        await mt.undo();
        out.undoRename = [!!await pt01('p1'), JSON.parse(await roleFile()).zz?.schedule[0].go, S.roles.zz?.schedule[0].go];
        // 記住上次的前綴：新增 inn-sit3 → 下次預設 inn-sit1；取消不記
        pp = mt.newPoint(FX, [3, 3]);
        await answer(d => {d.querySelector('input').value = 'inn-sit3'; return 'ok';});
        await pp;
        pp = mt.newPoint(FX, [4, 3]);
        await answer(d => {out.prefixDef = d.querySelector('input').value; d.querySelector('input').value = 'zzz9'; return 'cancel';});
        await pp;
        out.prefixKey = localStorage.getItem('tools.map.pointPrefix');
        // 全部 undo：地圖一字不差，role.json 回到加了 zz 那時
        while (S.hi > hiP) await mt.undo();
        out.undoAllPt = [await readText(`${FX}.json`) === orig01, await roleFile() === roleWithZz];
        await writeRole(origRole);
        chan.close();
        return out;
    }, SETUP.toString());

    t.check('地圖分類：世界／室內／其他，_ 開頭的舊檔不列', r.cats.world.join() === 'm/m_03x05,m/m_04x05' && r.cats.room.join() === 'm_04x05/karen-home,m_04x05/trump-inn-f1,m_04x05/trump-inn-f2'
        && r.cats.other.join() === 'fixture-01,fixture-02', JSON.stringify(r.cats));
    t.check('徽章：m_03x05 六個角色、兩個群組；fixture-01 兩個', r.sum[0]?.roles === 6 && r.sum[0]?.groups.join() === 'wolves,bandits' && r.sum[1] === 2, JSON.stringify(r.sum));
    t.eq('左欄只有 世界／其他 兩組（室內掛在世界地圖底下）', r.heads, '世界（2）,其他（2）');
    t.check('m_04x05 預設摺著、徽章 🏠3', r.roomFolded[0] && /🏠3/.test(r.roomFolded[1]), r.roomFolded.join());
    t.eq('摺著：房子的 ⚠ 加總', r.roomWarn, '🏠⚠2');
    t.check('點 ▸ 展開：房子排在 m_04x05 底下、縮排、短名、⚠ 回到房子身上、記住', r.roomOpen[0] === 'm/m_04x05,m_04x05/karen-home,m_04x05/trump-inn-f1,m_04x05/trump-inn-f2'
        && r.roomOpen[1] && r.roomOpen[2] && !r.roomOpen[3] && /room:m\/m_04x05/.test(r.roomOpen[4]), r.roomOpen.join(' | '));
    t.eq('搜尋房子：世界地圖跟著列（淡色）', r.search, 'm/m_04x05~,m_04x05/karen-home~');
    t.eq('搜尋世界地圖：不帶出沒對到的房子', r.search2, 'm/m_04x05');
    t.check('選著世界地圖時點「世界」摺得起來、重畫不彈開', r.foldSel[0] === '▸' && r.foldSel[1], r.foldSel.join());
    t.check('換選取：展開所在的組＋世界地圖那層', r.reveal.join() === 'm_04x05/trump-inn-f1,▾', r.reveal.join());
    t.eq('左欄徽章文字', r.badge, '🐾6@2');
    t.check('沒角色的地圖變淡', r.emptyDim);
    t.check('只看有角色的：記住、沒角色的不列', r.onlyMem === '1' && !r.only.includes('m_04x05/karen-home') && r.only.includes('m/m_03x05'), r.only.join());
    t.eq('總覽：main.world 每張一格', r.cells, 100);
    t.eq('總覽小點：m_03x05 六個角色都在群組（粉紅）', r.dots, '@bandits,@bandits,@bandits,@wolves,@wolves,@wolves');
    t.check('小點位置＝格子＋站的位置 × 縮放', r.dotPos?.every(Boolean), JSON.stringify(r.dotPos));
    t.eq('🏠 徽章在有室內地圖的格子', r.room, 'm/m_04x05');
    t.check('倍率上限 6、倍率欄 max', r.zmax[0] === 6 && r.zmax[1] === '6', r.zmax.join());
    t.check('格子比 15px 字的門檻小：不寫字（沒有 🏠 可點）', !r.smallNoText[0] || r.smallNoText[1] === 0, r.smallNoText.join());
    t.check('左鍵拖：平移 30px、不開地圖', r.drag[0] === 30 && r.drag[1] === null, r.drag.join());
    t.eq('點 🏠：列室內地圖', r.roomMenu, 'm_04x05/karen-home,m_04x05/trump-inn-f1,m_04x05/trump-inn-f2');
    t.check('點小點：打開地圖、選取那個角色', r.dotClick[0] === 'm/m_03x05' && r.dotClick[1], r.dotClick.join());
    t.check('總覽時間游標：室內的算進 🏠、世界地圖上有青點、時間軸沒有人數', r.wtime[0] && r.wtime[1] && r.wtime[2], JSON.stringify(r.wtime));
    t.eq('沒選地圖：右欄空的', r.noRight, 0);
    t.check('點格子：選那張、記住', r.sel[0] === 'm/m_03x05' && r.sel[1] === 'm/m_03x05', r.sel.join());
    t.check('地圖 100×100 格', r.size.join() === '3200,3200', r.size.join());
    t.check('角色：三隻狼在 @wolves、三個土匪在 @bandits', r.roles.join() === '@bandits:rogue-1,@bandits:rogue-1,@bandits:rogue-1,@wolves:wolf,@wolves:wolf,@wolves:wolf', r.roles.join());
    t.check(`站的位置＝物件中心＋錨點（狼 ${r.W0.o} → ${r.W0.root}）`, r.wolfRoot?.join() === r.W0.root.join(), r.wolfRoot?.join());
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

    // ---- 第 4 步 ----
    t.check('新群組：地圖加空 @deer 層、story.json 加 spawns、目標換過去、兩個檔都廣播、記住劇情線',
        r.newGrp[0] && r.newGrp[1]?.endsWith(':wolf_hunt>=2') && r.newGrp[2] === '@deer' && r.newGrp[3] && r.newGrp[4] && r.newGrp[5] === r.newGrp[1]?.split(':')[0], JSON.stringify(r.newGrp));
    t.check('已有的群組：提示共用、劇情線鎖住', /共用/.test(r.shareHint[0]) && r.shareHint[1], r.shareHint.join(' | '));
    t.check('共用：只加圖層、不動 story.json', r.shared[0] && r.shared[1] && r.shared[2] === 1, r.shared.join());
    t.check('同一張圖重複擋', /已經有 @wolves/.test(r.dupBlock), r.dupBlock);
    t.check('改條件寫進 story.json', r.cond3?.endsWith(':wolf_hunt>=3'), r.cond3);
    t.check('條件有認不得的 quality 標 ⚠', /未宣告的 quality「no_such_q」/.test(r.condWarn), r.condWarn);
    t.check('條件自動完成：dl-cond 有 quality', r.dl);
    t.check('群組右鍵：改名、刪除、↗ 任務分頁', r.gmenu.join().startsWith('改名…,刪除…,↗ 到任務分頁'), r.gmenu.join());
    t.check('👁：藏起來的組不畫（清單還在、變淡）、記住；再點顯示', r.hide[0] === 3 && r.hide[1] === 6 && r.hide[2] && r.hide[3] === '["wolves"]' && r.hide[4] === 3 && r.unhide === 6, `${r.hide.join()} ${r.unhide}`);
    t.check('改名對話框：列出要改的檔、存檔命名空間警告', /m_03x05/.test(r.renameHint[0]) && /karen-home/.test(r.renameHint[0]) && /story\.json/.test(r.renameHint[0]) && r.renameHint[1], r.renameHint.join(' | '));
    t.check('改名：兩張地圖＋story.json 一筆寫完、徽章／畫面跟著', r.renamed[0] && r.renamed[1] && r.renamed[2]?.endsWith(':wolf_hunt && wolf_hunt<9') && !r.renamed[3]
        && r.renamed[4] === 3 && r.renamed[5] === 'pack,bandits' && r.renamed[6] === 3, JSON.stringify(r.renamed));
    t.check('改成已有的名字擋', /已經有 @bandits/.test(r.renameBlock), r.renameBlock);
    t.check('改名：story.json 的 kill:@群組 跟著改', r.renameKill);
    t.check('刪除（別張圖還在用）：只刪圖層、條件留著', r.delBtns1 === 'layer,cancel' && !r.del1[0] && r.del1[1], `${r.delBtns1} ${r.del1.join()}`);
    t.check('刪除最後一張：可以連條件一起刪、目標回常駐', r.delBtns2 === 'all,layer,cancel' && !r.del2[0] && !r.del2[1] && r.del2[2] === '', `${r.delBtns2} ${r.del2.join()}`);
    t.check('undo 回到第 4 步之前：story.json＋三張地圖一字不差', r.undo4.every(Boolean), r.undo4.join());

    // ---- 第 5 步 ----
    t.check('左欄：角色不存在的地圖標 ⚠', /沒有角色「rogue」/.test(r.v01[0]) && r.v01[1] === '⚠1', r.v01.join(' | '));
    t.check('擋路格、具名 NPC 標警告', r.iss.some(s => /^warn:wolf:站在擋住的格子/.test(s)) && r.iss.some(s => /^warn:karen:.*具名 NPC/.test(s)), r.iss.join(' | '));
    t.eq('左欄徽章只算不用格子的（具名 NPC）', r.badgeKH, '⚠1');
    t.eq('角色清單標 ⚠', r.rowWarn, 2);
    t.check('選取的角色列出問題', /具名 NPC/.test(r.pickWarn), r.pickWarn);

    // ---- 第 6 步 ----
    t.check('時間游標預設關、不畫', r.timeOff[0] === false && r.timeOff[1] === 0, r.timeOff.join());
    t.eq('時間游標：走路中畫在路上那格（走了一半＝@1,5）', JSON.stringify(r.posWalk), JSON.stringify([1, 5, 'walk']));
    t.eq('時間游標：巡邏畫在路線上（@5,1 → @9,1 走了一半）', JSON.stringify(r.posPatrol), JSON.stringify([7, 1, 'stay']));
    t.eq('時間游標：單向巡邏跑完畫在終點', JSON.stringify(r.posDone), JSON.stringify([9, 1, 'stay']));
    t.eq('時間游標：下一筆從巡邏終點出發', JSON.stringify(r.posBack), JSON.stringify([5, 1, 'walk']));
    t.check('時間軸滾輪不調時間', r.wheelOff);
    t.eq('↑↓ 整頁調時間：畫布上 ↑ 從 23:59 繞回 00:00 並勾起、Shift 沒作用、↓ −1、Ctrl 不理、HH:MM 欄／滑桿有焦點也行', JSON.stringify(r.keys),
        JSON.stringify([[0, true], 1, 0, 0, [1439, '23:59'], 0]));
    t.eq('←→：07:56 → 08:00 → 08:10（Shift 沒作用）、07:56 ← 07:50 ← 07:40（滑桿）、23:55 → 00:00 ← 23:50、HH:MM 欄裡不處理', JSON.stringify(r.lr),
        JSON.stringify([480, 490, 470, 460, 0, 1430, [1430, false]]));
    t.check('打 12:00：自動打開、trump 停在 1F trump-p1、記住、時間軸沒有人數', /trump:stay:trump-p1/.test(r.t12[0]) && r.t12[1] && r.t12[2] === '720' && r.t12[3] === '1' && r.t12[4], JSON.stringify(r.t12));
    t.check('滑過作息 NPC：浮動框時間、點名、第幾筆', /trump.*（作息）/.test(r.ttip ?? '') && /12:00 在 trump-p1（第 \d+ 筆）/.test(r.ttip ?? ''), r.ttip);
    t.check('03:00：1F 沒有 trump、2F 床上有', !r.t3f1 && r.t3f2 === 'stay:bed', `${r.t3f1} ${r.t3f2}`);
    t.check('關掉：不畫、記住', r.offAgain[0] === 0 && r.offAgain[1] === '0', r.offAgain.join());
    t.eq('📍 跟著：預設（不跟）、下拉有 trump', JSON.stringify(r.fDef), JSON.stringify(['', null, true]));
    t.eq('📍 跟著：挑 trump＝記住、勾 🕒、在這張圖就置中', JSON.stringify(r.fPick), JSON.stringify(['trump', 'trump', true, true, true]));
    t.eq('📍 跟著：他在別張圖＝自動切過去、置中、下拉還在', JSON.stringify(r.fSwitch), JSON.stringify([true, true, 'trump']));
    t.eq('📍 跟著：拖滑桿拖到一半換圖也不斷、放開後不再動', JSON.stringify(r.fDrag), JSON.stringify([1420, 1420, '23:40', true, true, 1420]));
    t.eq('📍 跟著：總覽留在總覽、鏡頭移到房子所屬的世界格', JSON.stringify(r.fWorld), JSON.stringify([null, true, true]));
    t.eq('📍 跟著：（不跟）＝清記錄、不換圖', JSON.stringify(r.fNone), JSON.stringify([null, null, true]));

    // ---- 門 ----
    t.check('顯示 ▾「門」預設勾', r.doorShow[0] === true, r.doorShow.join());
    t.check('m_04x05：17 個門、有抄進假專案的兩間是好的、返回鈕灰的', r.doors.join() === '17,karen-home+trump-inn,true,0', r.doors.join());
    t.check('滑過門：浮動框目的地、落腳點、手指', /🚪 karen-home → m_04x05\/karen-home/.test(r.dtip) && /落腳點 door/.test(r.dtip) && /點＝進去/.test(r.dtip) && r.dcursor === 'pointer', `${r.dtip} ${r.dcursor}`);
    t.check('點門：打開那張、左欄選到、記住、鏡頭在落腳點、閃一下、返回鈕亮',
        r.enter[0] === 'm_04x05/karen-home' && r.enter[1] === 'm/m_04x05' && r.enter[2] === 'm_04x05/karen-home' && r.enter[3] && r.enter[4] && r.enter[5] === false && r.enter[6] === 'm_04x05/karen-home', r.enter.join());
    t.check('閃完就停', r.flashOff === null, String(r.flashOff));
    t.check('房裡的門出去：回世界地圖、鏡頭在 karen-home 門上', r.exit[0] === 'm/m_04x05' && r.exit[1] === 'm/m_04x05,m_04x05/karen-home' && r.exit[2], r.exit.join());
    t.check('← 返回：回上一張、堆疊少一筆', r.goBack.join() === 'm_04x05/karen-home,m/m_04x05,false', r.goBack.join());
    t.eq('壞門：地圖不存在紅、落腳點找不到黃', r.bad, 'to-kh:ok,to-nowhere:error,to-kh-bad:warn');
    t.check('壞門算進左欄 ⚠', r.badBadge[0] === '⚠2' && /不存在的地圖「no-such-map」/.test(r.badBadge[1]) && /落腳點「nope」/.test(r.badBadge[1]), r.badBadge.join(' | '));
    t.check('滑過門：提示右鍵改名', /右鍵＝改名/.test(r.dtipKh), r.dtipKh);
    t.eq('右鍵門：改名／進去', r.doorMenu.join(), '改名 door…,↗ 進去 m/m_04x05');
    t.check('門改名對話框：列出指過來的門', /m\/m_04x05 的門 karen-home/.test(r.doorRenTitle) && /fixture-02 的門 to-kh/.test(r.doorRenTitle) && !/to-kh-bad/.test(r.doorRenTitle), r.doorRenTitle);
    t.check('門改名：自己改名、指過來的門 port 一起改（to-kh-bad 不動）、三檔一筆 undo、都廣播、沒多出 ⚠',
        r.doorRenamed[0] && r.doorRenamed[1] === 'front' && r.doorRenamed[2] === 'front' && r.doorRenamed[3] === 'nope'
        && r.doorRenamed[4] === `maps/fixture-02.json,maps/m/m_04x05.json,maps/m_04x05/karen-home.json` && r.doorRenamed[5] && r.doorRenamed[6] === 2, JSON.stringify(r.doorRenamed));
    t.check('門改名 undo：三張圖一字不差', r.doorUndo.every(Boolean), r.doorUndo.join());
    t.check('滑過壞門：⚠ 原因、點了不會跳', /⚠ 門「to-nowhere」指到不存在的地圖/.test(r.badTip) && /點了不會跳/.test(r.badTip), r.badTip);
    t.check('點地圖不存在的門：不跳、狀態列提示', r.noJump[0] === 'fixture-02' && /不存在的地圖/.test(r.noJump[1]), r.noJump.join(' | '));
    t.eq('顯示 ▾ 關掉門：點不到', r.hidden, 'fixture-02');
    t.eq('作息點：at 格子（含巡邏 route 經過的）都算、兩人同時停留＝撞', JSON.stringify(r.spots), JSON.stringify(['@10,10:at:', '@3,6:at:', '@8,2:at:撞']));
    t.eq('滑過格子：名稱（作息格子）、每人一列、撞了一段、巡邏經過斜線（跨午夜兩截）、沒開時間游標沒白線、手指',
        JSON.stringify(r.spotTip), JSON.stringify(['@8,2（作息格子）', ['撞了', 'za 1,2 ↻', 'zb 1'], 1, 2, true, 'pointer']));
    t.eq('時間游標 11:00：白線、此刻停在這的人加粗', JSON.stringify(r.spotNow), JSON.stringify([['撞了', 'za 1,2 ↻*', 'zb 1*'], true]));
    t.eq('點多人用的點：小選單列每一筆（時間）', JSON.stringify(r.spotMenu), JSON.stringify(['za 1（@08:00）', 'za 2（@20:00）', 'zb 1（@10:00）']));
    t.eq('只有巡邏經過的點：一列、不算撞', JSON.stringify(r.patrolTip), JSON.stringify(['@10,10（作息格子）', ['za 2 ↻'], 0]));
    t.check('只有一筆的點：直接跳、不跳選單', r.oneNoMenu);
    t.eq('名稱過濾：部分比對、* 整個對上、空白逗號任一個、不分大小寫', JSON.stringify(r.nf), JSON.stringify([
        '=sit-1|sit-2|cabinet-sit|bed|trump-p1|Musk-P1', 'sit=sit-1|sit-2|cabinet-sit', 'sit-*=sit-1|sit-2', '*-p1=trump-p1|Musk-P1',
        'sit bed=sit-1|sit-2|cabinet-sit|bed', 'bed,trump=bed|trump-p1', 'SIT-1=sit-1', '*=sit-1|sit-2|cabinet-sit|bed|trump-p1|Musk-P1']));
    t.eq('過濾框：一開始全部符合、物件名稱沒勾', JSON.stringify(r.f0), JSON.stringify(['符合 3／3', false]));
    t.eq('打字：邊打邊算、自動勾物件名稱、按鈕 🔍、記住', JSON.stringify(r.f1), JSON.stringify(['符合 2／3', true, true, true, 'kh']));
    t.eq('萬用字元：*-bad 只中 to-kh-bad', JSON.stringify(r.f2), JSON.stringify(['符合 1／3', true, false]));
    t.eq('✕ 清空：全部符合、沒 🔍', JSON.stringify(r.f3), JSON.stringify(['符合 3／3', '', false, '', true]));
    t.check('落腳點找不到：照樣進去、提示', r.noLand[0] === 'm_04x05/karen-home' && /找不到落腳點「nope」/.test(r.noLand[1]) && r.noLand[2] === 'fixture-02', r.noLand.join(' | '));

    // ---- 作息 point ----
    t.check('路網過期橫幅：這張圖比 navgraph.json 新', /路網已過期（fixture-01\.json 比 navgraph\.json 新）更新路網/.test(r.navBanner), r.navBanner);
    t.eq('右鍵空地：新增 point…', JSON.stringify(r.emptyMenu), JSON.stringify(['新增 point…']));
    t.eq('新增：預設 p1', r.newDef, 'p1');
    t.check('新增：point.tj template、格子左上角、放第一個物件層、nextobjectid +1、廣播、畫面有',
        r.added[0] === JSON.stringify({id: 10, name: 'p1', template: '../templates/point.tj', x: 288, y: 64}) && r.added[1] === 11 && r.added[2] === 3 && r.added[3] && r.added[4], JSON.stringify(r.added));
    t.check('滑過 point：手掌、提示拖曳右鍵', r.ptHover[0] === 'grab' && /拖＝移動、右鍵＝改名／刪除/.test(r.ptHover[1] ?? ''), r.ptHover.join(' | '));
    t.eq('拖曳：黃框在放開的格子', r.pdrag.join(), 'true,160,128');
    t.eq('放開寫檔', r.ptMoved.join(), '160,128');
    t.eq('右鍵 point：改名、刪除、↗', JSON.stringify(r.ptMenu), JSON.stringify(['改名 p1…', '刪除 p1…', '↗ 到角色分頁看作息']));
    t.check('有作息用：刪除擋、列出誰的第幾筆', r.delBlock[0] === '不能刪 p1' && /zz 第 1 筆、zz 第 2 筆/.test(r.delBlock[1]) && r.delBlocked[0], r.delBlock.join(' | '));
    t.eq('預設名稱取最小空號', r.newDef2, 'p2');
    t.check('改成已有的名字擋', /這張圖已經有 p2/.test(r.renameDup[0]), r.renameDup.join());
    t.check('改名對話框列出 role.json 會改的', /一起改：role\.json：zz 第 1 筆、zz 第 2 筆/.test(r.renameTitle), r.renameTitle);
    t.check('改名：地圖＋role.json 的 go／route 一筆寫完、兩個都廣播、重讀角色',
        r.ptRenamed[0] && r.ptRenamed[1] && r.ptRenamed[2] === 'home' && r.ptRenamed[3] === 'home,@1,1' && r.ptRenamed[4] && r.ptRenamed[5] && r.ptRenamed[6] === 'maps/fixture-01.json,json/role.json' && r.ptRenamed[7] === 'home',
        JSON.stringify(r.ptRenamed));
    t.check('沒人用的 point：確認後刪', r.ptDeleted);
    t.check('undo 改名：地圖跟 role.json 一起回去', r.undoRename.join() === 'true,p1,p1', r.undoRename.join());
    t.check('新增記住前綴：inn-sit3 → 下次預設 inn-sit1、取消不記', r.prefixDef === 'inn-sit1' && r.prefixKey === 'inn-sit', `${r.prefixDef} ${r.prefixKey}`);
    t.check('undo 全部：地圖、role.json 一字不差', r.undoAllPt.every(Boolean), r.undoAllPt.join());

    // ---- 角色分頁改名／刪除連動地圖 ----
    await t.page.goto(new URL('/tools/role/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__re);
    const r2 = await t.page.evaluate(async () => {
        const re = window.__re, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 300 && !f(); i++) await sleep(20); return f();};
        const opfs = await navigator.storage.getDirectory();
        const assets = await (await (await opfs.getDirectoryHandle('game')).getDirectoryHandle('public')).getDirectoryHandle('assets');
        const read = async (rel) => {let d = assets; const s = rel.split('/'); for (const n of s.slice(0, -1)) d = await d.getDirectoryHandle(n); return (await (await d.getFileHandle(s.at(-1))).getFile()).text();};
        await re.setAssets(assets);
        const dlg = document.getElementById('dlgAsk');
        const answer = async (fn) => {await until(() => dlg.open); const v = fn(dlg); dlg.close(v);};
        const saved = [], chan = new BroadcastChannel('tools');
        chan.onmessage = (e) => saved.push(e.data.file);
        // orc：fixture-01 物件自己寫 id → 改名連帶改、role.json 一起存
        let p = re.rename('orc', 'orc_x');
        await answer(d => {out.orcDlg = d.querySelector('.body').textContent; return 'ok';});
        await p;
        await sleep(100);
        const v01 = JSON.parse(await read('maps/fixture-01.json'));
        out.orc = [v01.layers.flatMap(l => l.objects ?? []).find(o => o.id === 3)?.properties.find(x => x.name === 'id').value,
            Object.keys(JSON.parse(await read('json/role.json'))).includes('orc_x'), saved.includes('maps/fixture-01.json')];
        // wolf：用 template → 改 template 的值（其他一字不動）
        const tplBefore = await read('templates/animals/wolf.tj');
        p = re.rename('wolf', 'wolf_x');
        await answer(d => {out.wolfDlg = d.querySelector('.body').textContent; return 'ok';});
        await p;
        await sleep(100);
        const tplAfter = await read('templates/animals/wolf.tj');
        out.wolf = [tplAfter === tplBefore.replace('"value":"wolf"', '"value":"wolf_x"'), tplAfter !== tplBefore, saved.includes('templates/animals/wolf.tj')];
        // 刪除：有地圖用到擋；沒人用的照常
        p = re.remove('orc_x');
        await answer(d => {out.delBlock = [d.querySelector('.title').textContent, d.querySelector('.body').textContent]; return 'ok';});
        await p;
        out.stillThere = !!re.S.data.orc_x;
        p = re.remove('bandit-5');
        await answer(d => {out.delNormal = d.querySelector('.title').textContent; return 'cancel';});
        await p;
        chan.close();
        return out;
    });
    t.check('角色改名：對話框列出地圖物件', /maps\/fixture-01\.json：物件 3/.test(r2.orcDlg), r2.orcDlg);
    t.check('角色改名：地圖物件的 id 跟著改、role.json 存好、廣播', r2.orc.every(Boolean) && r2.orc[0] === 'orc_x', r2.orc.join());
    t.check('角色改名：對話框列出 template 跟在用的地圖', /templates\/animals\/wolf\.tj（template，.*maps\/m\/m_03x05\.json/.test(r2.wolfDlg), r2.wolfDlg);
    t.check('角色改名：template 只換那個值、廣播', r2.wolf.every(Boolean), r2.wolf.join());
    t.check('刪除角色：地圖還在用就擋', r2.delBlock[0] === '不能刪 orc_x' && /fixture-01/.test(r2.delBlock[1]) && r2.stillThere, r2.delBlock.join(' | '));
    t.eq('刪除沒人用的角色照常問', r2.delNormal, '刪除 bandit-5');
});
