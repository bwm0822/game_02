// 角色分頁右欄「作息」地圖：外觀｜作息切換、畫 Tiled 地圖、具名物件、作息點；node scripts/test/schedule-tool.mjs
import {run} from './harness.mjs'

run('schedule-tool', async t => {
    await t.page.goto(new URL('tools/role/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__re && Object.keys(window.__re.S.ext.maps).length);

    const r = await t.page.evaluate(async () => {
        const re = window.__re, S = re.S, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (fn) => {for (let i = 0; i < 300 && !fn(); i++) await sleep(20); return fn();};
        localStorage.removeItem('tools.role.rtab');
        localStorage.removeItem('tools.role.sched.map');
        for (const k of Object.keys(localStorage)) if (k.startsWith('tools.preview.view.role')) localStorage.removeItem(k);

        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const assets = await dir(opfs, 'game', 'public', 'assets'), json = await dir(assets, 'json');
        await write(json, 'role.json', await (await fetch('/assets/json/role.json')).text());
        await re.setAssets(assets);
        S.sel = 'trump'; S.view = 'form'; re.render();

        const right = () => document.getElementById('right');
        out.tabs = [...right().querySelectorAll('.rtabs button')].map(b => b.textContent + (b.classList.contains('on') ? '*' : ''));
        out.lookFirst = !!right().querySelector('.pv:not(.smap)');
        const lookZoom = re.PZ.V.zoom;

        right().querySelector('[data-rtab=sched]').click();
        const cv = () => right().querySelector('.smap canvas');
        out.remembered = localStorage.getItem('tools.role.rtab');
        out.mapSel = right().querySelector('[data-k=schedMap]').value;
        out.hasMaps = [...right().querySelectorAll('[data-k=schedMap] option')].map(o => o.value).includes('m/m_04x05');
        await until(() => cv().st.data);
        const st = cv().st, d = st.data;
        out.size = [d.W, d.H];
        out.named = ['trump-p1', 'door', 'stair-up'].map(n => d.named.has(n));
        // 烤好的圖有畫東西：門（template exit_door）那格、樓梯（帶水平翻轉的 gid 物件）那格都不是透明
        const px = (x, y) => d.bake.getContext('2d').getImageData(x, y, 1, 1).data[3];
        const n = (k) => d.named.get(k);
        out.pixels = [px(n('stair-up').cen.x, n('stair-up').cen.y), px(5 * 32 + 16, 5 * 32 + 16)].map(a => a > 0);

        // 滑到 trump-p1 上：資訊列顯示名稱、type、是第幾筆作息
        await sleep(50);
        const rc = cv().getBoundingClientRect(), o = st.pz.o, K = st.pz.K, p = n('trump-p1').cen;
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: rc.left + o.x + (p.x - d.W / 2) * K, clientY: rc.top + o.y + (p.y - d.H / 2) * K}));
        out.hover = right().querySelector('.smap .info').textContent;

        // 地圖的倍率是自己一組，不動外觀預覽的
        re.PZ.setZoom(1.5, 0, 0, st.pz.view);
        out.zoomSep = [st.pz.view.zoom, re.PZ.V.zoom === lookZoom];

        // 換地圖：記住、大地圖也畫得出來（template 的 gid 換算）
        const sel = right().querySelector('[data-k=schedMap]');
        sel.value = 'm/m_04x05';
        sel.dispatchEvent(new Event('change'));
        out.mapMem = localStorage.getItem('tools.role.sched.map');
        await until(() => cv().st.data);
        const d2 = cv().st.data;
        out.big = [d2.W, d2.H, d2.named.has('musk-p1'), d2.named.has('trump-inn')];
        const inn = d2.objs.find(o => o.raw.template?.endsWith('inn-1.tj'));
        out.innPx = d2.bake.getContext('2d').getImageData(inn.x + inn.width / 2, inn.y - inn.height / 2, 1, 1).data[3] > 0;

        right().querySelector('[data-rtab=look]').click();
        out.back = [!!right().querySelector('.pv:not(.smap)'), localStorage.getItem('tools.role.rtab')];
        localStorage.removeItem('tools.role.sched.map');
        localStorage.removeItem('tools.role.rtab');
        return out;
    });

    t.eq('右欄有 外觀｜作息 兩個分頁、預設外觀', JSON.stringify([r.tabs, r.lookFirst]), JSON.stringify([['外觀*', '作息'], true]));
    t.eq('切到作息：記住、預設是作息第一筆的地圖、下拉列路網的地圖', JSON.stringify([r.remembered, r.mapSel, r.hasMaps]), JSON.stringify(['sched', 'm_04x05/trump-inn-f1', true]));
    t.eq('trump-inn-f1 畫成 15×15 格（480×480）', JSON.stringify(r.size), JSON.stringify([480, 480]));
    t.eq('具名物件：trump-p1、door、stair-up', JSON.stringify(r.named), JSON.stringify([true, true, true]));
    t.eq('烤好的圖：翻轉的樓梯、地板都有畫', JSON.stringify(r.pixels), JSON.stringify([true, true]));
    t.eq('滑過物件顯示名稱、type、第幾筆作息', r.hover, 'trump-p1（point）　作息 1');
    t.eq('地圖的倍率自己一組', JSON.stringify(r.zoomSep), JSON.stringify([1.5, true]));
    t.eq('換地圖記住', r.mapMem, 'm/m_04x05');
    t.check('大地圖 100×100 格、有 musk-p1／trump-inn', JSON.stringify(r.big) === JSON.stringify([3200, 3200, true, true]), JSON.stringify(r.big));
    t.eq('template 物件（旅店建築）有畫', r.innPx, true);
    t.eq('切回外觀', JSON.stringify(r.back), JSON.stringify([true, 'look']));
});
