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
        out.picked = [...right.querySelectorAll('table tr')].map(tr => tr.textContent);
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
    t.check('點角色：選取、右欄詳細、清單反白', r.pick && r.rowSel && r.picked.some(s => s.startsWith('idwolf')) && r.picked.includes('圖層@wolves') && r.picked.includes('站的格子16, 6'), r.picked.join(' | '));
    t.check('點空地取消選取', r.unpick);
    t.check('滑過作息 point：列出誰在用、提示到角色分頁', r.ptip[0] === 'karen-p1（作息 point）' && /karen 1/.test(r.ptip[1]) && /角色分頁/.test(r.ptip[2]), r.ptip.join(' | '));
    t.check('再點同一張回總覽、清掉記住的', r.back[0] === null && r.back[1] && r.back[2] === null, JSON.stringify(r.back));
});
