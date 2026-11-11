// 角色分頁右欄「作息」地圖：外觀｜作息切換、畫 Tiled 地圖、具名物件、作息點；node scripts/test/schedule-tool.mjs
import {run} from './harness.mjs'

run('schedule-tool', async t => {
    // 遊戲端：ScheduleManager 改用 src/data/schedplan.js 之後照樣排出時刻表（等等跟工具算的比）
    await t.newGame();
    const game = await t.page.evaluate(async () => {
        const SM = (await import('/src/manager/schedule.js')).default;
        return Object.fromEntries(Object.entries(SM.plans).map(([id, p]) => [id, p.map(x => [x.key, x.dep, x.arr])]));
    });

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

        // ---- 第 3 步：選卡片 → 路線、麵包屑、時刻表 ----
        S.secOpen['作息'] = true; S.open.schedule = true; S.schSel = null; re.render();
        const cards = () => [...document.querySelectorAll('#view .card[data-sch]')];
        const sch = S.data.trump.schedule;
        out.trumpSch = sch.map(s => `${s.t} ${s.map}:${s.go}`);
        out.firstSel = [cards()[0]?.classList.contains('sel'), cards()[1]?.classList.contains('sel')];
        const pl = re.SP.buildPlan(sch, S.ext.nav.edges, S.ext.nav.nodes);
        const p0 = pl.plan[0];
        out.times0 = cards()[0].querySelector('.times')?.textContent;
        out.times0Want = `出發 ${re.SP.hhmm(p0.dep)} → 抵達 06:20（走 ${p0.cost} 分）`;
        out.dep0 = re.SP.mod(p0.dep + p0.cost) === 6 * 60 + 20;
        // 工具算的時刻表跟遊戲 ScheduleManager 一樣（全部角色）
        out.tool = Object.fromEntries(Object.keys(S.data).filter(id => S.data[id].schedule?.length).map(id => {
            const p = re.SP.buildPlan(S.data[id].schedule, S.ext.nav.edges, S.ext.nav.nodes).plan;
            return [id, p && p.map(x => [x.key, x.dep, x.arr])];
        }).filter(([, p]) => p));

        // 選中第 1 筆（預設）：地圖跳到它的目的地，麵包屑＝床那層 → 一樓
        re.SM.setMap(sch[0].map); re.render();
        await until(() => cv()?.st.data && cv().st.route);
        const crumbs = () => [...right().querySelectorAll('.crumbs button')];
        out.crumbs = crumbs().map(b => b.dataset.map + (b.classList.contains('on') ? '*' : ''));
        const rt = cv().st.route, d3 = cv().st.data;
        out.lines = [rt.lines.length > 0, rt.lines.every(l => !l.broken), rt.lines.every(l => l.pts.length >= 2)];
        const last = rt.lines.at(-1).pts.at(-1), dest = d3.named.get(sch[0].go);
        out.endsAtDest = dest.tiles.some(([tx, ty]) => Math.abs((tx + 0.5) * 32 - last.x) < 1 && Math.abs((ty + 0.5) * 32 - last.y) < 1);
        out.labels = rt.labels.map(l => l.text.replace(/^\d\d:\d\d /, '') + (l.go ? `→${l.go}` : ''));

        // 點「從 trump-inn-f2 進來」標籤：切到 f2、那段路畫在 f2 上
        await sleep(50);
        const hit = cv().st.hits[0], rc3 = cv().getBoundingClientRect(), o3 = cv().st.pz.o, K3 = cv().st.pz.K;
        cv().dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: rc3.left + o3.x + (hit.x + 2 - d3.W / 2) * K3, clientY: rc3.top + o3.y + (hit.y + 2 - d3.H / 2) * K3}));
        await until(() => cv()?.st.name !== sch[0].map && cv().st.route);
        out.jumped = [cv().st.name, crumbs().find(b => b.classList.contains('on'))?.dataset.map, cv().st.route.labels.map(l => l.text.replace(/^\d\d:\d\d /, '') + (l.go ? `→${l.go}` : ''))];

        // 點第 2 張卡片：反白換過去、左邊表單不重畫（同一個元素）、地圖跳到床那層
        const card1 = cards()[1];
        card1.querySelector('.sum').click();
        await until(() => cv()?.st.data);
        out.sel2 = [card1.isConnected, card1.classList.contains('sel'), cards()[0].classList.contains('sel'), cv().st.name, S.schSel.i];

        // 排不下：第 2 筆改成比第 1 筆抵達還早出發 → 卡片標紅、寫晚幾分
        re.commit(() => {S.data.trump.schedule[1].t = '06:10';});
        out.late = cards()[1].querySelector('.times')?.className + '|' + cards()[1].querySelector('.times')?.textContent;
        out.lateWant = p0.cost > 10;
        re.undo();

        // ---- 第 4 步：點物件改目的地、Shift＋點插入、顯示 ▾ ----
        const at = async (name, type, opts = {}) => {
            await until(() => cv()?.st.data);
            const c = cv(), s = c.st, d = s.data, n = d.named.get(name), rc = c.getBoundingClientRect(), o = s.pz.o, K = s.pz.K;
            c.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: rc.left + o.x + (n.cen.x - d.W / 2) * K, clientY: rc.top + o.y + (n.cen.y - d.H / 2) * K, ...opts}));
        };
        S.schSel = {id: 'trump', i: 0}; re.SM.setMap('m_04x05/trump-inn-f1'); re.render();
        const hist0 = S.hi;
        await at('sit-1', 'pointermove');
        out.hoverOthers = right().querySelector('.smap .info').textContent;
        await at('sit-1', 'click');
        out.picked = [cards()[0].classList.contains('sel'), S.data.trump.schedule[0].map, S.data.trump.schedule[0].go, S.data.trump.schedule.length];
        re.undo();
        out.pickUndo = S.data.trump.schedule[0].go;
        await sleep(50);
        await at('stair-up', 'click', {shiftKey: true});
        out.inserted = [S.data.trump.schedule.length, JSON.stringify(S.data.trump.schedule[1]), S.schSel.i, cards()[1]?.classList.contains('sel')];
        re.undo();
        out.insUndo = [S.data.trump.schedule.length, S.hi === hist0];

        // 顯示 ▾：預設只勾「這個角色其他行程」；勾「物件名稱」記住
        right().querySelector('.smap .showbtn').click();
        const pop = document.querySelector('.showpop');
        out.showDefault = [...pop.querySelectorAll('input')].map(i => `${i.dataset.show}:${i.checked}`);
        pop.querySelector('[data-show=grid]').click();
        out.showSaved = [localStorage.getItem('tools.role.sched.show'), right().querySelector('.smap .showbtn').textContent, re.SM.show.grid];
        // 格子可走：牆（擋住）那格畫紅
        await sleep(50);
        const c4 = cv(), d4 = c4.st.data, grid = d4.grid;
        let wall = null;
        grid.forEach((row, ty) => row.forEach((w, tx) => {if (!wall && w === 0) wall = [tx, ty];}));
        out.wall = !!wall;
        pop.querySelector('[data-show=grid]').click();
        document.body.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        localStorage.removeItem('tools.role.sched.show');

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
    t.check('滑過物件顯示名稱、type、第幾筆作息', r.hover.startsWith('trump-p1（point）　作息 1　'), r.hover);
    t.eq('地圖的倍率自己一組', JSON.stringify(r.zoomSep), JSON.stringify([1.5, true]));
    t.eq('換地圖記住', r.mapMem, 'm/m_04x05');
    t.check('大地圖 100×100 格、有 musk-p1／trump-inn', JSON.stringify(r.big) === JSON.stringify([3200, 3200, true, true]), JSON.stringify(r.big));
    t.eq('template 物件（旅店建築）有畫', r.innPx, true);
    t.eq('切回外觀', JSON.stringify(r.back), JSON.stringify([true, 'look']));

    t.check('遊戲 ScheduleManager 照樣排出時刻表', Object.keys(game).length > 0 && game.trump?.length === 2, JSON.stringify(Object.keys(game)));
    t.eq('工具算的時刻表跟遊戲一樣（全部角色）', JSON.stringify(r.tool), JSON.stringify(game));
    t.check('trump 作息：06:20 到 1F trump-p1、22:50 到 2F 床', JSON.stringify(r.trumpSch) === JSON.stringify(['@06:20 m_04x05/trump-inn-f1:trump-p1', '@22:50 m_04x05/trump-inn-f2:bed']), JSON.stringify(r.trumpSch));
    t.eq('預設選第 1 張卡片', JSON.stringify(r.firstSel), JSON.stringify([true, false]));
    t.eq('卡片時刻表：出發（倒推）→ 抵達、走幾分', r.times0, r.times0Want);
    t.check('@ 抵達倒推出發', r.dep0);
    t.eq('麵包屑：2F → 1F，目前 1F', JSON.stringify(r.crumbs), JSON.stringify(['m_04x05/trump-inn-f2', 'm_04x05/trump-inn-f1*']));
    t.eq('1F 路線：有線、都走得到、每段至少兩點', JSON.stringify(r.lines), JSON.stringify([true, true, true]));
    t.check('路線終點在目的地的站位格', r.endsAtDest);
    t.eq('1F 標籤：從 2F 進來（可點）、抵達', JSON.stringify(r.labels), JSON.stringify(['從 trump-inn-f2 進來→m_04x05/trump-inn-f2', '抵達']));
    t.eq('點標籤切到 2F：麵包屑跟著、2F 標籤＝出發、→ 1F', JSON.stringify(r.jumped),
        JSON.stringify(['m_04x05/trump-inn-f2', 'm_04x05/trump-inn-f2', ['出發', '→ trump-inn-f1→m_04x05/trump-inn-f1']]));
    t.eq('點第 2 張卡片：反白換過去、表單沒重畫、地圖到床那層', JSON.stringify(r.sel2), JSON.stringify([true, true, false, 'm_04x05/trump-inn-f2', 1]));
    t.check('排不下標紅、寫晚幾分', !r.lateWant || /^times bad\|.*排不下：晚 \d+ 分/.test(r.late), r.late);
    t.check('滑過別人用的點：列出誰的第幾筆、提示點選', /^sit-1（.*）.*musk 2（@12:10）.*點＝設成作息 1 的目的地/.test(r.hoverOthers), r.hoverOthers);
    t.eq('有選卡片時點物件：改那筆的 map＋go', JSON.stringify(r.picked), JSON.stringify([true, 'm_04x05/trump-inn-f1', 'sit-1', 2]));
    t.eq('一筆 undo 回原本的目的地', r.pickUndo, 'trump-p1');
    t.eq('Shift＋點：在選中那筆後面插入（時間抄它、抵達）、選到新的那筆',
        JSON.stringify(r.inserted), JSON.stringify([3, JSON.stringify({t: '@06:20', go: 'stair-up', map: 'm_04x05/trump-inn-f1'}), 1, true]));
    t.eq('插入一筆 undo', JSON.stringify(r.insUndo), JSON.stringify([2, true]));
    t.eq('顯示 ▾ 預設只勾本角色其他行程', JSON.stringify(r.showDefault), JSON.stringify(['mine:true', 'others:false', 'names:false', 'grid:false']));
    t.eq('勾格子可走：記住、按鈕數字', JSON.stringify(r.showSaved), JSON.stringify(['{"mine":true,"grid":true}', '顯示（2）▾', true]));
    t.check('格子權重有算出牆', r.wall);
});
