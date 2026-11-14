// 角色分頁右欄「作息」地圖：外觀｜作息切換、畫 Tiled 地圖、具名物件、作息點；node scripts/test/schedule-tool.mjs
import {run} from './harness.mjs'
import fs from 'fs'
import path from 'path'
import {roundtrip} from '../../tools/common/tiledjson.js'

// 手改過排版的地圖（有 `},` 少空白、多空行），工具寫的時候會整理成 Tiled 的樣子
const HAND_EDITED = ['house-08.json', 'trump-inn-f1.json'];

run('schedule-tool', async t => {
    const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []));
    const maps = walk('public/assets/maps'), bad = maps.filter(f => !roundtrip(fs.readFileSync(f, 'utf8'))).map(f => path.basename(f));
    t.check(`Tiled 排版：${maps.length} 張地圖讀進來再寫出去一字不差（手改過的除外）`, bad.every(f => HAND_EDITED.includes(f)), bad.join(', '));

    // 遊戲端：ScheduleManager 改用 src/data/schedplan.js 之後照樣排出時刻表（等等跟工具算的比）
    await t.newGame();
    const game = await t.page.evaluate(async () => {
        const SM = (await import('/src/manager/schedule.js')).default;
        return Object.fromEntries(Object.entries(SM.plans).map(([id, p]) => [id, p.map(x => [x.key, x.dep, x.arr])]));
    });

    // 遊戲端 at:[x,y]：trump 第 1 筆改成 trump-p1 那一格（路網補一個 "地圖:@x,y" 節點、邊抄 trump-p1 的），12:00 進 1F 站在那格
    const F1g = 'm_04x05/trump-inn-f1';
    const atGame = await t.eval(async (d, F1) => {
        const DB = (await import('/src/data/db.js')).default, SM = (await import('/src/manager/schedule.js')).default;
        const NG = (await import('/src/core/navgraph.js')).default;
        const map = await (await fetch(`/assets/maps/${F1}.json`)).json();
        const p1 = map.layers.filter(l => l.objects).flatMap(l => l.objects).find(o => o.name === 'trump-p1');
        const tx = Math.floor(p1.x / map.tilewidth), ty = Math.floor(p1.y / map.tileheight);
        const nav = DB.navgraph(), from = `${F1}:trump-p1`, key = `${F1}:@${tx},${ty}`;
        nav.nodes[key] = {};
        nav.edges[key] = nav.edges[from].map(e => ({...e}));
        for (const e of nav.edges[from]) nav.edges[e.to].push({...nav.edges[e.to].find(x => x.to === from), to: key});
        DB.role('trump').schedule[0] = {t: '@06:20', map: F1, at: [tx, ty]};
        NG._routes.clear();
        delete d.Record.game.schedule.trump;
        Object.assign(d.TimeSystem.time, {h: 12, m: 0});
        SM.init(SM.scene);
        return {tile: [tx, ty], key, plan: SM.plans.trump?.[0]?.key, st: d.Record.game.schedule.trump?.node};
    }, F1g);
    await t.gotoMap(F1g);
    await t.waitFor(d => d.objs().some(g => g.id === 'trump'), {what: 'trump 出現在 1F'});
    const atPos = await t.eval(d => {const g = d.objs().find(g => g.id === 'trump'), m = g.scene.map; return m.worldToTile(g.x, g.y);});
    t.eq('遊戲 at：時刻表的 key＝地圖:@x,y、12:00 停在那個節點', JSON.stringify([atGame.plan, atGame.st]), JSON.stringify([atGame.key, atGame.key]));
    t.eq('遊戲 at：進 1F 時 trump 站在那一格', JSON.stringify(atPos), JSON.stringify(atGame.tile));
    await t.page.reload();

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
        S.sel = 'trump'; S.view = 'form'; S.schSel = {id: 'trump', i: 0}; re.render();

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

        // 滑到 trump-p1 上：浮動框顯示名稱、type、是第幾筆作息＋時間（選中的加粗）；下方沒有資訊列、canvas 沒有 title
        await sleep(50);
        const rc = cv().getBoundingClientRect(), o = st.pz.o, K = st.pz.K, p = n('trump-p1').cen;
        cv().dispatchEvent(new PointerEvent('pointermove', {bubbles: true, clientX: rc.left + o.x + (p.x - d.W / 2) * K, clientY: rc.top + o.y + (p.y - d.H / 2) * K}));
        const tip = () => right().querySelector('.smap .smaptip');
        const tipText = () => (tip().hidden ? '' : [...tip().children].map(c => c.textContent).join('\n'));
        out.hover = tipText();
        // 占用時間圖：每列 label（mine＝*）、選中那筆那段加白框、有刻度
        const occLabs = () => [...tip().querySelectorAll('.occ .orow:not(.axis) .olab')].map(x => x.textContent + (x.closest('.mine') ? '*' : ''));
        out.hoverOcc = occLabs();
        out.hoverBold = [!!tip().querySelector('.occ .mine .oseg.sel'), !!tip().querySelector('.occ .oaxis'), !tip().querySelector('.occ .onow')];
        out.noInfo = [!right().querySelector('.smap .info'), !cv().hasAttribute('title'), !!right().querySelector('.smap .help[title]')];
        // 選中那張的編號反白：膠囊裡數字左邊是白底（橘點畫在藍線上面）
        const dpr = devicePixelRatio || 1, px0 = cv().getContext('2d').getImageData(Math.round((o.x + (p.x - d.W / 2) * K) * dpr), Math.round((o.y + (p.y - d.H / 2) * K - 7) * dpr), 1, 1).data;
        out.selWhite = [...px0.slice(0, 3)].every(v => v > 230);
        cv().dispatchEvent(new PointerEvent('pointerleave', {bubbles: true}));
        out.tipGone = tip().hidden;

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
        const card = (i) => document.querySelector(`#view .card[data-sch="${i}"]`);
        const sch = S.data.trump.schedule;
        out.trumpSch = sch.map(s => `${s.t} ${s.map}:${s.go}`);
        out.firstSel = [cards().length, document.querySelector('#view .schhint')?.textContent, re.S.schSel];
        S.schSel = {id: 'trump', i: 0}; re.render();
        out.oneCard = cards().map(c => c.dataset.sch);
        const pl = re.SP.buildPlan(sch, S.ext.nav.edges, S.ext.nav.nodes);
        const p0 = pl.plan[0];
        out.times0 = card(0).querySelector('.times')?.textContent;
        const p1 = pl.plan[1];
        out.times0Want = `走：${re.SP.hhmm(p0.dep)}（${re.SB.dur(p0.cost)}）待：06:20 ~ ${re.SP.hhmm(p1.dep)}（${re.SP.hhmm(re.SP.mod(p1.dep - p0.arr)).replace(':', ' 時 ')} 分）`;
        out.cardNoMap = [!document.querySelector('#view .card [data-k="schedule.0.map"]'), !document.querySelector('#view .card [data-k="schedule.0.t#mode"]'),
            document.querySelector('#view .card [data-k="schedule.0.dest"]')?.textContent];
        out.dep0 = re.SP.mod(p0.dep + p0.cost) === 6 * 60 + 20;

        // 時間選擇器：不能打字，點時／分彈出 5 格（中間＝目前值、循環），滾就寫、連續滾一步 undo，點格子寫入並關閉，Esc 關
        const tpop = () => document.querySelector('.tpick-pop');
        const cellsOf = () => [...tpop().children].map(c => c.textContent + (c.classList.contains('cur') ? '*' : ''));
        const wheel = (n) => {for (let i = 0; i < Math.abs(n); i++) tpop().dispatchEvent(new WheelEvent('wheel', {deltaY: Math.sign(n) * 100, bubbles: true, cancelable: true}));};
        const seg = (k, s) => document.querySelector(`[data-k="${k}.${s}"]`);
        const down = (el) => el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
        const h0 = S.hi, tk = 'schedule.0.t';
        out.tpNoInput = [document.querySelector(`.tpick[data-k="${tk}"]`)?.textContent, !document.querySelector(`input[data-k="${tk}"]`)];
        down(seg(tk, 'h')); seg(tk, 'h').click();
        out.tpOpen = cellsOf();
        wheel(3);
        out.tpWheel = [S.data.trump.schedule[0].t, S.hi - h0, cellsOf()];
        down(tpop().children[4]); tpop().children[4].click();
        out.tpClick = [S.data.trump.schedule[0].t, S.hi - h0, !tpop()];
        re.undo();
        out.tpUndo = S.data.trump.schedule[0].t;
        down(seg(tk, 'm')); seg(tk, 'm').click();
        wheel(-21);
        out.tpWrap = [S.data.trump.schedule[0].t, cellsOf()];
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.tpEsc = !tpop();
        re.undo();
        re.set('trump', ['schedule', 0, 't'], undefined);
        out.tpEmpty = document.querySelector(`.tpick[data-k="${tk}"]`)?.textContent;
        down(seg(tk, 'm')); seg(tk, 'm').click();
        out.tpEmptyOpen = cellsOf();
        down(tpop().children[3]); tpop().children[3].click();
        out.tpEmptyPick = S.data.trump.schedule[0].t;
        while (S.hi > h0) re.undo();
        out.tpBack = [S.data.trump.schedule[0].t, S.hi === h0];
        // 用滾輪把選擇器捲到 want（每段走最短的方向），捲完點外面關掉
        // straight＝不繞過 23→00（有夾範圍的欄位：夾到了滾輪會卡在邊界，繞圈會卡住）
        const pickT =(k, want, straight = false) => want.split(':').forEach((w, i) => {
            const s = seg(k, 'hm'[i]), n = i ? 60 : 24;
            down(s); s.click();
            const raw = +w - +tpop().querySelector('.cur').textContent, d = (raw % n + n) % n;
            wheel(straight ? raw : d > n / 2 ? d - n : d);
            down(document.body);
        });
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

        // 點時序條第 2 段：下面換成第 2 筆的卡片、橫條沒重畫（同一個元素）、地圖跳到床那層
        const bar1 = document.querySelector('#view .daybar');
        // 換選中那筆：鏡頭對準目的地（中心在畫布正中、倍率不動）、閃那個框
        const focused = (i) => {
            const s = cv().st, n = re.SM.spotOf(s.data, re.SP.destOf(S.data.trump.schedule[i]));
            const cx = n.rect.x + n.rect.w / 2 - s.data.W / 2, cy = n.rect.y + n.rect.h / 2 - s.data.H / 2;
            return [Math.abs(s.pz.view.ox + cx * s.pz.K) < 0.5 && Math.abs(s.pz.view.oy + cy * s.pz.K) < 0.5, s.flash?.rect === n.rect];
        };
        const zb = [cv().st.name, cv().st.pz.view.zoom];
        bar1.querySelector('.seg.stay[data-i="1"]').click();
        await until(() => cv()?.st.data && cv().st.flash);
        out.sel2 = [bar1.isConnected, cards().map(c => c.dataset.sch).join(), cv().st.name, S.schSel.i];
        out.focus2 = [...focused(1), zb[0] === cv().st.name, zb[1] === cv().st.pz.view.zoom];
        // 同一筆再點：鏡頭不動
        const v2 = cv().st.pz.view;
        v2.ox += 37;
        const ox2 = v2.ox;
        bar1.querySelector('.seg.stay[data-i="1"]').click();
        await sleep(50);
        out.focusSame = cv().st.pz.view.ox === ox2;
        // 換回第 1 筆（另一張圖）
        bar1.querySelector('.seg.stay[data-i="0"]').click();
        await until(() => cv()?.st.data && cv().st.flash && cv().st.name === sch[0].map);
        out.focus1 = focused(0);
        // 目的地找不到：鏡頭不動、顯示 ⚠
        const s1 = S.data.trump.schedule[1], go1 = s1.go;
        s1.go = 'no-such-spot';
        bar1.querySelector('.seg.stay[data-i="1"]').click();
        await until(() => cv()?.st.data && !right().querySelector('.smap .smapmsg').hidden);
        out.focusMiss = [right().querySelector('.smap .smapmsg').textContent, !cv().st.flash];
        s1.go = go1;
        re.render();
        await until(() => cv()?.st.data);

        // 排不下：第 2 筆改成比第 1 筆抵達還早出發 → 卡片標紅、寫晚幾分
        re.commit(() => {S.data.trump.schedule[1].t = '06:10';});
        out.late = card(1).querySelector('.times')?.className + '|' + card(1).querySelector('.times')?.textContent;
        out.lateWant = p0.cost > 10;
        out.lateBar = [...document.querySelectorAll('#view .daybar .seg.late')].map(s => `${s.dataset.i}:${s.title.split('\n')[0]}`);
        re.undo();

        // ---- 24 小時橫條 ----
        const bar = () => document.querySelector('#view .daybar');
        const segs = () => [...bar().querySelectorAll('.seg')];
        S.schSel = {id: 'trump', i: 0}; re.render();
        out.barFirst = bar()?.nextElementSibling?.firstElementChild === card(0);
        // trump：06:20 到 1F、22:50 到 2F 床 → 1F 停留一段、床跨午夜切兩截、兩段走路
        out.barSegs = segs().map(s => `${s.className.replace(/^seg /, '').replace(' sel', '')}${s.dataset.i}`).sort().join();
        const SB = re.SB, segs0 = SB.daySegs(pl.plan, sch, pl.warns);
        out.barSum = segs0.filter(g => g.kind !== 'late' && g.kind !== 'nope').reduce((a, g) => a + g.len, 0);
        const bed = segs().filter(s => s.classList.contains('stay') && s.dataset.i === '1');
        out.bedCut = [bed.length, bed.map(s => s.style.left === '0%' || parseFloat(s.style.left) + parseFloat(s.style.width) > 99.99).every(Boolean),
            bed[0]?.style.backgroundColor !== segs().find(s => s.classList.contains('stay') && s.dataset.i === '0')?.style.backgroundColor];
        out.bedTip = bed[0]?.title;
        out.legend = [...bar().querySelectorAll('.legend span')].map(s => s.textContent);
        out.barSel = segs().filter(s => s.classList.contains('sel')).map(s => s.dataset.i);
        // 點床那段：下面換成第 2 筆（不重畫橫條）、橫條反白跟著換
        const bar0 = bar();
        bed[0].click();
        await until(() => S.schSel?.i === 1);
        out.barPick = [S.schSel.i, bar0.isConnected, cards().map(c => c.dataset.sch).join(), [...new Set(segs().filter(s => s.classList.contains('sel')).map(s => s.dataset.i))].join()];
        // 走不到：紅線；資料有問題：不畫橫條
        out.nopeSeg = SB.daySegs([{key: 'a', dep: 600, arr: 600, cost: 0, from: 'b', path: null}, {key: 'b', dep: 900, arr: 960, cost: 60, from: 'a', path: []}], [{map: 'x'}, {map: 'y'}], [])
            .map(g => `${g.kind}${g.i}@${g.s}+${g.len}`).join();
        re.commit(() => {S.data.trump.schedule[0].go = 'no-such-point';});
        out.barNone = [!!bar(), document.querySelector('#view .daybar.none')?.textContent];
        re.undo();
        S.schSel = {id: 'trump', i: 0}; re.render();

        // ---- 總覽「作息」分頁（全 NPC 甘特圖）----
        localStorage.removeItem('tools.role.gantt.t'); localStorage.removeItem('tools.role.gantt.map');
        re.GT.setT(18 * 60); re.GT.setMap(null);
        const npcs = Object.keys(S.data).filter(id => S.data[id].kind === 'npc');
        S.view = 'table'; S.grp = re.ALL; S.tab = re.SC.TABS.findIndex(t => t.gantt); re.render();
        const g = () => document.querySelector('#view .gantt');
        const rowOf = (id) => g().querySelector(`.grole[data-id="${id}"]`);
        out.gTab = document.querySelector('#view .tabs button.on')?.textContent;
        out.gTabWant = `作息（${npcs.length}）`;
        out.gRows = [g().querySelectorAll('.grole:not(.ghead)').length, g().querySelectorAll('.grole.nosch').length, npcs.length, npcs.filter(id => !S.data[id].schedule?.length).length];
        out.gGroups = [...g().querySelectorAll('.ggrp')].map(e => e.textContent);
        out.gGroupsWant = [...new Set(npcs.map(id => S.data[id].grp || '（無子分類）'))];
        const typeT = (v) => {const i = g().querySelector('[data-k=ganttT]'); i.value = v; i.dispatchEvent(new Event('change'));};
        typeT('12:00');
        out.gNoon = [rowOf('trump').querySelector('.gnow').textContent, localStorage.getItem('tools.role.gantt.t'), rowOf('trump').querySelector('.cur').style.left];
        typeT('03:00');
        out.gNight = rowOf('trump').querySelector('.gnow').textContent;
        // 時間軸按住拖：拖到正中間＝12:00
        const ax = g().querySelector('.gaxis'), tr = ax.querySelector('.track').getBoundingClientRect();
        ax.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0, pointerId: 1, clientX: tr.left + tr.width * 0.25, clientY: tr.top + 3}));
        ax.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, button: 0, pointerId: 1, clientX: tr.left + tr.width * 0.5, clientY: tr.top + 3}));
        ax.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, button: 0, pointerId: 1}));
        out.gDrag = [Math.abs(re.GT.G.t - 720) <= 1, g().querySelector('[data-k=ganttT]').value.slice(0, 2)];
        // 圖例人數＝此刻停在那張圖的 NPC 數
        const F1m = 'm_04x05/trump-inn-f1';
        const want = npcs.filter(id => {
            const sc = S.data[id].schedule;
            if (!sc?.length) return false;
            const p = re.SP.buildPlan(sc, S.ext.nav.edges, S.ext.nav.nodes);
            if (!p.plan) return false;
            const at = re.SB.whereAt(p.plan, sc, re.GT.G.t, re.SB.daySegs(p.plan, sc, p.warns));
            return at?.kind === 'stay' && at.map === F1m;
        }).length;
        const leg = () => g().querySelector(`.glegend [data-map="${F1m}"]`);
        out.gCount = [leg()?.querySelector('small').textContent, `（${want}）`, want > 0];
        // 點圖例：只看這張圖（其他變淡、此刻欄加粗、記住），再點取消
        leg().click();
        out.gMap = [localStorage.getItem('tools.role.gantt.map'), leg().classList.contains('on'),
            [...g().querySelectorAll('.seg.stay')].every(s => s.classList.contains('dim') === (s.dataset.map !== F1m)),
            rowOf('trump').querySelector('.gnow').classList.contains('on')];
        leg().click();
        out.gMapOff = [localStorage.getItem('tools.role.gantt.map'), g().querySelectorAll('.seg.dim').length];
        // 總覽也能拖分界線：trump 走去床那段往左 30 分＝@22:50 → @22:20，段內寫類型名
        {
            const hg = S.hi, w = rowOf('trump').querySelector('.seg.walk[data-i="1"]'), tr2 = rowOf('trump').querySelector('.track');
            const r2 = w.getBoundingClientRect(), y2 = r2.top + r2.height / 2, x2 = r2.left + r2.width / 2, dx = tr2.getBoundingClientRect().width * 30 / 1440;
            const pe2 = (type, x, el = tr2) => el.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: y2}));
            pe2('pointerdown', x2, w); pe2('pointermove', x2 - dx / 2); pe2('pointermove', x2 - dx);
            out.gHovDrag = [g().querySelector('.ghovt').hidden, [...g().querySelectorAll('.gendt:not([hidden])')].map(x => x.textContent).at(-1),
                g().querySelectorAll('.gendt:not([hidden])').length, g().querySelectorAll('.gend:not([hidden])').length === 2 * g().querySelectorAll('.track').length,
                !!rowOf('trump').querySelector('.gend:not([hidden])')];
            const gst = g().querySelector('.ghead .gaxis .axis'), gdt = [...g().querySelectorAll('.gendt:not([hidden])')].map(x => x.getBoundingClientRect());
            out.gStays = [gst.querySelectorAll('.stayt').length, gdt.every(r => r.bottom <= gst.getBoundingClientRect().top + 1)];
            pe2('pointerup', x2 - dx);
            out.gShift = [S.data.trump.schedule[1].t, S.hi - hg, S.view];
            out.gEndsGone = g().querySelectorAll('.gendt:not([hidden]), .gend:not([hidden]), .stayt').length;
            re.undo();
        }
        // 滑過總覽某列的時序條：頂端時間軸標籤（對齊 10 分、Shift＝1 分）＋每列＆時間軸一條細白線（同位置），離開就藏
        {
            const tr3 = rowOf('trump').querySelector('.track'), rc3 = tr3.getBoundingClientRect();
            const mv3 = (min, extra = {}) => tr3.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 1, clientX: rc3.left + rc3.width * min / 1440, clientY: rc3.top + 8, ...extra}));
            const hovs = () => [...g().querySelectorAll('.ghov')];
            mv3(14 * 60 + 33);
            const lefts = new Set(hovs().map(c => c.style.left));
            out.gHov = [g().querySelector('.ghovt').hidden, g().querySelector('.ghovt').textContent, hovs().length === g().querySelectorAll('.grole .track').length,
                hovs().every(c => !c.hidden), lefts.size, !!g().querySelector('.ghead .ghov'), !!rowOf('musk').querySelector('.ghov')];
            mv3(14 * 60 + 33, {shiftKey: true});
            out.gHovShift = g().querySelector('.ghovt').textContent;
            tr3.dispatchEvent(new PointerEvent('pointerleave', {pointerId: 1}));
            out.gHovGone = [g().querySelector('.ghovt').hidden, hovs().every(c => c.hidden), !!g().querySelector('.hovt:not([hidden])')];
        }
        // 相衝：假 NPC zc 10:00～11:00 也停在 trump-p1 → trump 那段撞的那截紅斜線、提示多一行；藏起來照算（已隱藏）；拖 zc 即時重畫 trump 那列
        {
            S.data.zc = {kind: 'npc', schedule: [{t: '@10:00', map: F1m, go: 'trump-p1'}, {t: '11:00', map: F1m, go: 'sit-2'}]};
            re.render();
            const tSeg = () => rowOf('trump').querySelector('.seg.stay[data-i="0"]');
            out.gClash = [rowOf('trump').querySelectorAll('.clash').length > 0, tSeg().title.split('\n').some(l => /^⚠ 撞了 10:00～11:00：.*\bzc\b/.test(l)),
                getComputedStyle(rowOf('trump').querySelector('.clash')).pointerEvents, !!rowOf('zc').querySelector('.clash')];
            re.GT.G.hide.add('zc'); re.render();
            out.gClashHide = [!rowOf('zc'), tSeg().title.split('\n').some(l => /^⚠ 撞了 10:00～11:00：.*zc（已隱藏）/.test(l))];
            re.GT.G.hide.delete('zc'); re.render();
            // 拖 zc 那段中間往右 30 分：放開前 trump 那列就重畫成 10:30～11:30
            const zs = rowOf('zc').querySelector('.seg.stay[data-i="0"]'), ztr = rowOf('zc').querySelector('.track'), zr = zs.getBoundingClientRect();
            const zx = zr.left + zr.width / 2, zy = zr.top + zr.height / 2, zdx = ztr.getBoundingClientRect().width * 30 / 1440;
            const pz = (type, x, el = ztr) => el.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: zy}));
            pz('pointerdown', zx, zs); pz('pointermove', zx + zdx / 2); pz('pointermove', zx + zdx);
            out.gClashLive = [S.data.zc.schedule[0].t, tSeg().title.split('\n').some(l => /^⚠ 撞了 10:30～11:30：.*\bzc\b/.test(l))];
            pz('pointerup', zx + zdx);
            out.gClashDrop = [S.data.zc.schedule.map(s => s.t).join(), tSeg().title.split('\n').some(l => /^⚠ 撞了 10:30～11:30：.*\bzc\b/.test(l))];
            re.undo();
            // 表單的單條時序條也標（undo 會連 zc 一起還原掉，重塞）
            S.data.zc = {kind: 'npc', schedule: [{t: '@10:00', map: F1m, go: 'trump-p1'}, {t: '11:00', map: F1m, go: 'sit-2'}]};
            S.view = 'form'; S.sel = 'trump'; re.render();
            const fSeg = document.querySelector('#view .daybar .seg.stay[data-i="0"]');
            out.fClash = [document.querySelectorAll('#view .daybar .track .clash').length > 0, fSeg.title.split('\n').some(l => /^⚠ 撞了 10:00～11:00：.*\bzc\b/.test(l))];
            delete S.data.zc;
            S.view = 'table'; re.render();
            out.clashGone = !rowOf('trump').querySelector('.seg.stay[data-i="0"]').title.includes('zc');
        }
        // 點 trump 的床那段：進表單、選第 2 張卡片、右欄作息
        rowOf('trump').querySelector('.seg.stay[data-i="1"]').click();
        await until(() => cv()?.st.data && cv().st.flash);
        out.gPick = [S.view, S.sel, S.schSel.i, S.rtab, !!card(1), cv()?.st.name, ...focused(1)];
        // 點角色名＝進表單
        S.view = 'table'; re.render();
        rowOf('musk').querySelector('.gname a').click();
        out.gName = [S.view, S.sel];

        // ---- 總覽也能編輯：右鍵同一份選單、Shift＋點多選、在地圖上選進表單；角色 ▾ 勾選顯示 ----
        {
            localStorage.removeItem('tools.role.gantt.hide'); re.GT.G.hide.clear();
            S.view = 'table'; S.schMulti = null; re.render();
            const hg = S.hi, sch0g = JSON.stringify(S.data.trump.schedule);
            const trk = (id) => rowOf(id).querySelector('.track');
            const gx = (id, min) => {const rc = trk(id).getBoundingClientRect(); return rc.left + rc.width * min / 1440;};
            const gMenu = async (id, min) => {
                document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
                trk(id).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, button: 2, clientX: gx(id, min), clientY: trk(id).getBoundingClientRect().top + 8}));
                await until(() => document.querySelector('.ctxmenu'));
            };
            const gItems = (lv) => [...document.querySelectorAll(`.ctxmenu[data-lv="${lv}"] button`)];
            const gHover = (lv, rx) => gItems(lv).find(x => rx.test(x.textContent))?.dispatchEvent(new MouseEvent('mouseenter'));
            const gSeg = (id, i, shiftKey) => rowOf(id).querySelector(`.seg.stay[data-i="${i}"]`).dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, shiftKey}));
            const gSel = (id) => [...rowOf(id).querySelectorAll('.seg.stay.sel')].map(s => +s.dataset.i);
            await gMenu('trump', 12 * 60 + 2);
            out.ggMenu = gItems(0).map(b => b.textContent);
            gItems(0).find(b => b.textContent.startsWith('分割')).click();
            out.ggSplit = [S.data.trump.schedule.length, S.view, S.hi - hg];
            gSeg('trump', 0, true);
            out.ggShift1 = [gSel('trump'), S.view];
            gSeg('trump', 1, true);
            out.ggShift2 = [gSel('trump'), S.view];
            await gMenu('trump', 8 * 60);
            out.ggMulti = gItems(0).map(b => b.textContent);
            gHover(0, /^合併/);
            gItems(1)[0].click();
            out.ggMerged = [JSON.stringify(S.data.trump.schedule) === sch0g, S.view, !S.schMulti];
            // 範圍外右鍵：清掉多選、一般選單
            re.undo(); re.render();
            gSeg('trump', 0, true); gSeg('trump', 1, true);
            await gMenu('trump', 23 * 60);
            out.ggOutside = [gItems(0)[0]?.textContent.startsWith('插入作息'), !S.schMulti, gSel('trump')];
            // 在地圖上選：進表單、右欄挑選模式
            gHover(0, /^插入作息/);
            gItems(1).find(b => b.textContent.includes('在地圖上選')).click();
            await until(() => right()?.querySelector('.smap .pickbar'));
            out.ggPick = [S.view, S.sel, !!S.pick, S.rtab];
            document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
            while (S.hi > hg) re.undo();
            out.ggUndo = JSON.stringify(S.data.trump.schedule) === sch0g;
            // 沒作息的那列：右鍵能插入
            S.view = 'table'; re.render();
            const empty = npcs.find(id => !S.data[id].schedule?.length);
            if (empty) {await gMenu(empty, 9 * 60); out.ggEmpty = [gItems(0)[0]?.textContent, rowOf(empty).querySelector('.empty')?.textContent];}
            document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
            // 角色 ▾：取消 trump → 那列消失、記住、按鈕數字；全部 → 回來
            const rb = () => g().querySelector('[data-k=ganttRoles]');
            out.ggBtn = rb()?.textContent;
            rb().click();
            const pk = () => document.querySelector('.gpick');
            out.ggPop = [!!pk(), pk()?.querySelectorAll('input[data-role]:not([data-role=""])').length, pk()?.querySelectorAll('.ggrphead').length];
            const cb = pk().querySelector('input[data-role="trump"]');
            cb.checked = false; cb.dispatchEvent(new Event('change'));
            out.ggHide = [!rowOf('trump'), localStorage.getItem('tools.role.gantt.hide'), rb()?.textContent, !!pk()];
            [...pk().querySelectorAll('.gpall button')].find(b => b.textContent === '全部').click();
            out.ggAll = [!!rowOf('trump'), localStorage.getItem('tools.role.gantt.hide'), rb()?.textContent];
            pk()?.remove();
        }
        S.sel = 'trump'; S.view = 'form'; S.tab = 0; S.schSel = {id: 'trump', i: 0}; re.render();
        localStorage.removeItem('tools.role.gantt.t'); localStorage.removeItem('tools.role.gantt.map');

        // ---- 第 4 步：左鍵只看、右鍵選單改目的地／新增目的地（問抵達時間、照時間插入）、點門進去、顯示 ▾ ----
        const $ = (id) => document.getElementById(id);
        // 依序回答 #dlgAsk：fn(dlg) 回傳要按的值（可以順便填輸入框）；記下標題
        const answering = (...fns) => {
            const seen = [];
            let stop = false;
            (async () => {
                while (!stop)
                {
                    if ($('dlgAsk').open) {seen.push($('dlgAsk').querySelector('.title').textContent); $('dlgAsk').close((fns.shift() ?? (() => 'cancel'))($('dlgAsk')));}
                    await sleep(20);
                }
            })();
            return {seen, stop: () => {stop = true;}};
        };
        const runAns = async (p, ...fns) => {const a = answering(...fns); await p; await sleep(60); a.stop(); return a.seen;};
        const evAt = (x, y, type, opts = {}) => {
            const c = cv(), s = c.st, d = s.data, rc = c.getBoundingClientRect(), o = s.pz.o, K = s.pz.K;
            c.dispatchEvent(new (type.startsWith('pointer') ? PointerEvent : MouseEvent)(type, {bubbles: true, cancelable: true, button: type === 'contextmenu' ? 2 : 0, pointerId: 1,
                clientX: rc.left + o.x + (x - d.W / 2) * K, clientY: rc.top + o.y + (y - d.H / 2) * K, ...opts}));
        };
        const at = async (name, type, opts = {}) => {
            await until(() => cv()?.st.data);
            const n = cv().st.data.named.get(name);
            evAt(n.cen.x, n.cen.y, type, opts);
        };
        // 右鍵 → 等選單出來 → 列出項目（反灰標 ×）；pick＝要按的項目文字
        const ctx = async (x, y, pick) => {
            document.querySelector('.ctxmenu')?.remove();
            evAt(x, y, 'contextmenu');
            await until(() => document.querySelector('.ctxmenu'));
            const bs = [...document.querySelectorAll('.ctxmenu button')];
            const items = bs.map(b => b.textContent + (b.disabled ? '×' : ''));
            if (pick) bs.find(b => (pick instanceof RegExp ? pick.test(b.textContent) : b.textContent === pick))?.click();
            else document.querySelector('.ctxmenu')?.remove();
            return items;
        };
        const ctxObj = async (name, pick) => {await until(() => cv()?.st.data); const n = cv().st.data.named.get(name); return ctx(n.cen.x, n.cen.y, pick);};
        const F1 = 'm_04x05/trump-inn-f1';
        S.schSel = {id: 'trump', i: 0}; re.SM.setMap(F1); re.render();
        const hist0 = S.hi;
        await at('sit-1', 'pointermove');
        out.hoverOthers = tipText();
        out.hoverOthersOcc = occLabs();
        await at('sit-1', 'click');
        out.leftNoop = [S.data.trump.schedule[0].go, S.hi === hist0];
        out.objMenu = await ctxObj('sit-1', /^改成選中那筆/);
        out.picked = [!!card(0), S.data.trump.schedule[0].map, S.data.trump.schedule[0].go, S.data.trump.schedule.length];
        re.undo();
        out.pickUndo = S.data.trump.schedule[0].go;
        // 空地：方框對齊格子、浮動框寫格子；右鍵 新增目的地 → 問抵達時間（預設選中那筆 +1 小時）→ 照時間插在第 2 筆、寫 at
        await until(() => cv()?.st.data);
        const d6 = cv().st.data, g6 = re.SM.gridOf(d6);
        const noObj = (tx, ty) => ![...d6.named.values()].some(n => {const c = {x: tx * 32 + 16, y: ty * 32 + 16}; return Math.hypot(c.x - n.cen.x, c.y - n.cen.y) < 24 || (c.x >= n.rect.x && c.x <= n.rect.x + n.rect.w && c.y >= n.rect.y && c.y <= n.rect.y + n.rect.h);});
        let cell = null, wall0 = null;
        for (let ty = 0; ty < 15; ty++) for (let tx = 0; tx < 15; tx++)
        {
            if (!cell && ty >= 2 && tx >= 2 && g6[ty][tx] !== 0 && noObj(tx, ty)) cell = [tx, ty];
            if (!wall0 && g6[ty][tx] === 0 && noObj(tx, ty)) wall0 = [tx, ty];
        }
        await sleep(30);
        evAt(cell[0] * 32 + 5, cell[1] * 32 + 5, 'pointermove');
        out.cellHover = [cv().st.cell?.key, JSON.stringify(cv().st.cell?.rect), tipText()];
        // 顯示 ▾ 座標沒勾：空地沒浮動框、方框照畫
        re.SM.show.coord = false;
        evAt(cell[0] * 32 + 6, cell[1] * 32 + 5, 'pointermove');
        out.noCoord = [tip().hidden, cv().st.cell?.key === out.cellHover[0]];
        re.SM.show.coord = true;
        let defT = '';
        out.addAsk = await runAns(ctx(cell[0] * 32 + 16, cell[1] * 32 + 16, '新增目的地…'), dl => {defT = dl.querySelector('[data-k=arriveAt]').textContent; pickT('arriveAt', '12:00'); return 'ok';});
        await until(() => S.data.trump.schedule.length === 4);
        out.addedAt = [defT, S.data.trump.schedule.length, JSON.stringify(S.data.trump.schedule[1]), S.schSel.i, JSON.stringify(S.data.trump.schedule[2])];
        out.addedAtWant = JSON.stringify({t: '@12:00', map: F1, at: cell});
        // 臨時補路網：時刻表算得出來、橫幅說有格子還沒進路網
        await until(() => /待：12:00/.test(card(1)?.querySelector('.times')?.textContent ?? ''));
        out.atTimes = card(1)?.querySelector('.times')?.textContent;
        await until(() => right().querySelector('.smap .stale'));
        out.atBanner = right().querySelector('.smap .stale')?.textContent;
        await until(() => cv()?.st.data);
        out.atStop = [...cv().st.data.named.keys()].length > 0 && !!re.SM.spotOf(cv().st.data, `@${cell.join(',')}`);
        // 地圖上畫 at 方框：畫的時候就算好這張圖的作息點（含這一格）
        await sleep(30);
        out.atBox = [!!cv().st.spots?.has(`@${cell.join(',')}`), cv().st.spots?.get(`@${cell.join(',')}`)?.[0]?.id];
        // 改成物件：at 換成 go、key 位置不變
        await ctxObj('sit-1', /^改成選中那筆/);
        out.atToGo = JSON.stringify(S.data.trump.schedule[1]);
        // 同一時間擋下
        out.dupAsk = await runAns(ctx(cell[0] * 32 + 16, cell[1] * 32 + 16, '新增目的地…'), () => {pickT('arriveAt', '06:20'); return 'ok';});
        out.dupT = [S.data.trump.schedule.length, $('status').textContent];
        // 走不到的格子：新增目的地反灰
        out.wallMenu = wall0 ? await ctx(wall0[0] * 32 + 16, wall0[1] * 32 + 16) : null;
        while (S.hi > hist0) re.undo();
        out.insUndo = [S.data.trump.schedule.length, S.hi === hist0];

        // ---- 時序條編輯：右鍵分層選單插入（夾一小時）、拖分界線、類型、刪除合併、在地圖上選 ----
        S.schSel = {id: 'trump', i: 0}; re.SM.setMap(F1); re.render();
        const h1 = S.hi, sch0 = JSON.stringify(S.data.trump.schedule);
        const tb = () => document.querySelector('#view .daybar .track');
        const xOf = (min) => {const rc = tb().getBoundingClientRect(); return rc.left + rc.width * min / 1440;};
        const ctxBar = async (min) => {
            document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
            tb().dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, button: 2, clientX: xOf(min), clientY: tb().getBoundingClientRect().top + 8}));
            await until(() => document.querySelector('.ctxmenu'));
        };
        const mItems = (lv) => [...document.querySelectorAll(`.ctxmenu[data-lv="${lv}"] button`)];
        const hover = (lv, rx) => {const b = mItems(lv).find(x => rx.test(x.textContent)); b?.dispatchEvent(new MouseEvent('mouseenter')); return b;};
        await ctxBar(10 * 60 + 3);
        out.barMenu = mItems(0).map(b => b.textContent);
        hover(0, /^插入作息/);
        out.barL1 = mItems(1).map(b => b.textContent);
        hover(1, /^m_04x05$/);
        out.barL2 = mItems(2).map(b => b.textContent);
        hover(2, /trump-inn-f1$/);
        out.barL3 = mItems(3).map(b => b.textContent);
        mItems(3).find(b => b.textContent === 'sit-1').click();
        out.barIns = [S.data.trump.schedule.map(s => `${s.t} ${s.go}`).join(' | '), S.schSel.i, !document.querySelector('.ctxmenu'), S.hi - h1];
        // 拖第 3 筆（回 trump-p1）的走路段往右 30 分＝出發 11:00 → 11:30
        const walk2 = () => tb().querySelector('.seg.walk[data-i="2"]');
        const wr = walk2().getBoundingClientRect(), wy = wr.top + wr.height / 2, wx = wr.left + wr.width / 2;
        const pe = (type, x, el = tb()) => el.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: wy}));
        pe('pointerdown', wx, walk2());
        pe('pointermove', wx + (xOf(30) - xOf(0)) / 2);
        pe('pointermove', wx + (xOf(30) - xOf(0)));
        const endTs = () => [...document.querySelectorAll('#view .daybar .endt:not([hidden])')].map(x => x.textContent);
        const plWalk = re.SP.buildPlan(S.data.trump.schedule.map((s, k) => (k === 2 ? {...s, t: '11:30'} : s)), re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
        out.dragEnds = [endTs().join(' '), `11:30 ${re.SP.hhmm(plWalk[2].arr)}`, document.querySelectorAll('#view .daybar .endmk:not([hidden])').length,
            document.querySelector('#view .daybar .hovt').hidden, document.querySelector('#view .daybar .hovline').hidden, !document.querySelector('#view .daybar .dragtip')];
        out.dragStays = [document.querySelectorAll('#view .daybar .axis .stayt').length, [...document.querySelectorAll('#view .daybar .stayt')].every(x => /^待 \d+:\d\d$/.test(x.textContent)),
            tb().classList.contains('grabbing')];
        pe('pointerup', wx + (xOf(30) - xOf(0)));
        out.dragged = [S.data.trump.schedule[2].t, S.data.trump.schedule[1].t, S.hi - h1];
        out.dragEndsGone = endTs().length;
        // 拖過頭夾住：往左拖 3 小時，sit-1 最少停 10 分
        const wr2 = walk2().getBoundingClientRect(), wx2 = wr2.left + wr2.width / 2;
        pe('pointerdown', wx2, walk2()); pe('pointermove', wx2 - (xOf(180) - xOf(0))); pe('pointerup', wx2 - (xOf(180) - xOf(0)));
        const plc = re.SP.buildPlan(S.data.trump.schedule, re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
        out.clamped = re.SP.mod(plc[2].dep - plc[1].arr);
        re.undo();
        // 停留段中間＝整塊平移：sit-1（第 1 筆）往右 20 分，第 1、2 筆一起動、停留不變、一筆 undo；兩端＝抵達／離開
        {
            const plOf = () => re.SP.buildPlan(S.data.trump.schedule, re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
            const stay1 = () => {const p = plOf(); return re.SP.mod(p[2].dep - p[1].arr);};
            const st = () => tb().querySelector('.seg.stay[data-i="1"]');
            const sr = st().getBoundingClientRect(), sx = sr.left + sr.width / 2, hb = S.hi, len0 = stay1(), t0 = S.data.trump.schedule.map(s => s.t);
            pe('pointermove', sx, st());
            out.moveCur = [tb().classList.contains('move'), tb().classList.contains('grab'), getComputedStyle(st()).cursor];
            pe('pointerdown', sx, st());
            pe('pointermove', sx + (xOf(10) - xOf(0)));
            pe('pointermove', sx + (xOf(20) - xOf(0)));
            const p20 = re.SP.buildPlan(S.data.trump.schedule.map((s, k) => (k === 1 || k === 2 ? {...s, t: re.SE.shiftT(s.t, 20)} : s)), re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
            out.blockEnds = [endTs().join(' '), `${re.SP.hhmm(p20[1].arr)} ${re.SP.hhmm(p20[2].dep)}`, document.querySelector('#view .daybar .hovt').hidden];
            const fmt = (m) => `待 ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
            const stayOf = (p, k) => re.SP.mod(p[(k + 1) % p.length].dep - p[k].arr);
            const sts = [...document.querySelectorAll('#view .daybar .axis .stayt')], rs = sts.map(x => x.getBoundingClientRect()).sort((a, b) => a.left - b.left);
            out.blockStays = [sts.map(x => x.textContent).sort().join(), [0, 1, 2].map(k => fmt(stayOf(p20, k))).sort().join(), sts.includes(sts.find(x => x.textContent === fmt(len0))),
                rs.every((r, k) => k === 0 || r.left >= rs[k - 1].right), tb().classList.contains('grabbing'), getComputedStyle(st()).cursor];
            pe('pointerup', sx + (xOf(20) - xOf(0)));
            out.block = [S.data.trump.schedule.map(s => s.t).join(), [t0[0], re.SE.shiftT(t0[1], 20), re.SE.shiftT(t0[2], 20), ...t0.slice(3)].join(), stay1() === len0, S.hi - hb];
            out.blockStaysGone = [document.querySelectorAll('#view .daybar .stayt').length, tb().classList.contains('grabbing')];
            re.undo();
            // 往左拖過頭：前一筆最少停 10 分，自己的停留還是不變
            const sr2 = st().getBoundingClientRect(), sx2 = sr2.left + sr2.width / 2;
            pe('pointerdown', sx2, st()); pe('pointermove', sx2 - (xOf(300) - xOf(0))); pe('pointerup', sx2 - (xOf(300) - xOf(0)));
            const pb = plOf();
            out.blockClamp = [re.SP.mod(pb[1].dep - pb[0].arr), stay1() === len0];
            re.undo();
            // 單擊中間（沒拖）照舊是選取
            const sr3 = st().getBoundingClientRect(), sx3 = sr3.left + sr3.width / 2;
            pe('pointerdown', sx3, st()); pe('pointerup', sx3, st());
            st().dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: sx3}));
            out.blockClick = [S.schSel.i, S.hi - hb];
        }
        // 類型：卡片下拉選午餐 → 時序條段內寫「午餐」
        const tsel = document.querySelector('#view [data-k="schedule.1.type"]');
        out.typeOpts = [...tsel.options].map(o => o.textContent);
        tsel.value = 'lunch'; tsel.dispatchEvent(new Event('change'));
        out.typed = [S.data.trump.schedule[1].type, tb().querySelector('.seg.stay[data-i="1"]')?.textContent, Object.keys(S.data.trump.schedule[1]).join()];
        // 右鍵 sit-1 那段：改目的地／類型／刪除；刪除＝前後同目的地合併，回到原本
        await ctxBar(10 * 60 + 20);
        out.segMenu = mItems(0).map(b => b.textContent);
        mItems(0).find(b => b.textContent === '刪除這筆').click();
        out.delMerged = [JSON.stringify(S.data.trump.schedule) === sch0, S.schSel.i];
        // 同目的地插入：也夾一小時（不是佔掉剩下的），刪中間那筆合併回原本
        const insSame = async (min) => {
            await ctxBar(min);
            hover(0, /^插入作息/); hover(1, /^m_04x05$/); hover(2, /trump-inn-f1$/);
            mItems(3).find(b => b.textContent.replace('✔ ', '') === 'trump-p1').click();
            return S.data.trump.schedule.map(s => `${s.t} ${s.go}`).join(' | ');
        };
        out.sameIns = [await insSame(12 * 60), S.schSel.i];
        re.undo();
        out.sameFull = await insSame(22 * 60 + 10);
        re.undo();
        out.sameUndo = JSON.stringify(S.data.trump.schedule) === sch0;
        // 右鍵「待多久 [HH 時 MM 分]」：選單裡直接點時／分（timePick），選了就寫（只平移下一筆）、選單不關
        const plNow = () => re.SP.buildPlan(S.data.trump.schedule, re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
        const sRow = () => document.querySelector('.ctxmenu .ctxrow');
        const hs0 = S.hi, stay0 = plNow()[1].dep - plNow()[0].arr;
        await ctxBar(12 * 60);
        out.stayRow = sRow()?.textContent;
        down(seg('stayMenu', 'h')); seg('stayMenu', 'h').click();
        const c3 = tpop().children[3];
        c3.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
        down(c3); c3.click();
        out.stayKeep = [!!document.querySelector('.ctxmenu'), plNow()[1].dep - plNow()[0].arr - stay0, S.hi - hs0];
        re.undo();
        pickT('stayMenu', '13:40', true);
        out.stayOk = [sRow().textContent, plNow()[1].dep, S.data.trump.schedule[0].t, S.data.trump.schedule[1].t.startsWith('@')];
        pickT('stayMenu', '23:59', true);
        const plMax = plNow();
        out.stayMax = [re.SP.mod(plMax[0].dep - plMax[1].arr), sRow().textContent === `待多久${re.SP.hhmm(re.SP.mod(plMax[1].dep - plMax[0].arr)).replace(':', ' 時 ')} 分`, /^最多待到 \d\d:\d\d（下一筆至少停 10 分）$/.test($('status').textContent)];
        pickT('stayMenu', '00:00', true);
        out.stayMenuMin = [plNow()[1].dep - plNow()[0].arr, sRow().textContent, $('status').textContent];
        while (S.hi > hs0) re.undo();
        out.stayUndo = JSON.stringify(S.data.trump.schedule) === sch0;
        document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        // 卡片的停留欄也夾：拉到 23 時 59 分＝下一筆剩 10 分
        pickT('schedule.0.stay', '23:59', true);
        const plc2 = plNow();
        out.stayCard = re.SP.mod(plc2[0].dep - plc2[1].arr);
        while (S.hi > hs0) re.undo();
        const keep = S.data.trump.schedule;
        S.data.trump.schedule = [keep[0]]; re.render();
        await ctxBar(12 * 60);
        out.stayOne = [!!document.querySelector('.ctxmenu .ctxrow.dis'), !seg('stayMenu', 'h')];
        document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        S.data.trump.schedule = keep; re.render();
        // 在地圖上選：插入 15:00 → 挑選模式 → 點 sit-2
        await ctxBar(15 * 60);
        hover(0, /^插入作息/);
        mItems(1).find(b => b.textContent.includes('在地圖上選')).click();
        await until(() => right().querySelector('.smap .pickbar'));
        out.pickBar = right().querySelector('.smap .pickbar')?.textContent;
        await until(() => cv()?.st.data && cv().st.name === F1);
        await at('sit-2', 'click');
        await until(() => S.data.trump.schedule.length === 4);
        out.picked2 = [S.data.trump.schedule.map(s => `${s.t} ${s.go}`).join(' | '), !right().querySelector('.smap .pickbar')];
        // Esc 取消挑選
        await ctxBar(16 * 60 + 30);
        hover(0, /^插入作息/);
        mItems(1).find(b => b.textContent.includes('在地圖上選')).click();
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.pickEsc = [!right().querySelector('.smap .pickbar'), !re.S.pick];
        while (S.hi > h1) re.undo();
        out.barUndo = JSON.stringify(S.data.trump.schedule) === sch0;

        // ---- 分割、Shift 多選、合併（挑留哪筆）／刪除多筆、只有一筆也能拖、選單不超出畫面 ----
        const segEl = (i, k = 'stay') => tb().querySelector(`.seg.${k}[data-i="${i}"]`);
        const clickSeg = (i, shiftKey = false) => segEl(i).dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, shiftKey}));
        const selIs = () => [...tb().querySelectorAll('.seg.stay.sel')].map(s => +s.dataset.i);
        await ctxBar(6 * 60 + 23);
        const spNear = mItems(0).find(b => b.textContent.startsWith('分割'));
        out.splitNear = [spNear?.textContent, spNear?.disabled, spNear?.title];
        await ctxBar(12 * 60 + 2);
        out.splitMenu = mItems(0).map(b => b.textContent);
        mItems(0).find(b => b.textContent.startsWith('分割')).click();
        out.split = [JSON.stringify(S.data.trump.schedule[1]), S.data.trump.schedule.length, S.schSel.i, S.hi - h1];
        // 單選 0 → Shift＋點 1：反白兩段、卡片區寫已選 2 筆
        clickSeg(0); clickSeg(1, true);
        out.multi = [selIs(), document.querySelector('#view .schslot')?.textContent];
        // 右鍵範圍內：只有合併／刪除；合併子選單同內容去重
        await ctxBar(8 * 60);
        out.multiMenu = mItems(0).map(b => b.textContent);
        hover(0, /^合併/);
        out.mergeL1 = mItems(1).map(b => b.textContent);
        mItems(1)[0].click();
        out.merged = [JSON.stringify(S.data.trump.schedule) === sch0, S.schSel.i, !S.schMulti];
        re.undo(); re.render();
        // 選 1 → Shift＋點 2（床），合併留床：時間用第 1 筆的
        clickSeg(1); clickSeg(2, true);
        await ctxBar(13 * 60);
        hover(0, /^合併/);
        out.mergeL1b = mItems(1).map(b => b.textContent);
        mItems(1).find(b => b.textContent.includes('bed')).click();
        out.mergedBed = JSON.stringify(S.data.trump.schedule);
        re.undo(); re.render();
        // 右鍵範圍外：回到單選選單
        clickSeg(1); clickSeg(2, true);
        await ctxBar(8 * 60);
        out.outside = [mItems(0)[0]?.textContent.startsWith('插入作息'), !S.schMulti, selIs()];
        document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        // 刪除 2 筆 → 剩一筆
        clickSeg(1); clickSeg(2, true);
        await ctxBar(13 * 60);
        mItems(0).find(b => b.textContent === '刪除 2 筆').click();
        out.delRange = [JSON.stringify(S.data.trump.schedule), S.schSel.i];
        // 只有一筆：抓 06:20 的分界線往右拖 1 小時（浮框只寫抵達）
        const one = segEl(0), or = one.getBoundingClientRect(), oy = or.top + or.height / 2, ox = or.left + 1;
        const pe1 = (type, x, el = tb()) => el.dispatchEvent(new PointerEvent(type, {bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: oy}));
        pe1('pointermove', ox, one);
        out.oneGrab = tb().classList.contains('grab');
        pe1('pointerdown', ox, one);
        pe1('pointermove', ox + (xOf(30) - xOf(0)));
        pe1('pointermove', ox + (xOf(60) - xOf(0)));
        out.oneTip = [...document.querySelectorAll('#view .daybar .endt:not([hidden])')].map(x => x.textContent).join(' ');
        pe1('pointerup', ox + (xOf(60) - xOf(0)));
        out.oneDrag = S.data.trump.schedule.map(s => s.t);
        // 選單不超出畫面：展開到第 3 層，每層都在視窗裡、可捲動
        await ctxBar(23 * 60 + 50);
        hover(0, /^插入作息/); hover(1, /^m_04x05$/); hover(2, /trump-inn-f1$/);
        out.menuFit = [...document.querySelectorAll('.ctxmenu')].map(m => {const r = m.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5;});
        out.menuScroll = getComputedStyle(document.querySelector('.ctxmenu')).overflowY;
        document.querySelectorAll('.ctxmenu').forEach(m => m.remove());
        while (S.hi > h1) re.undo();
        out.multiUndo = JSON.stringify(S.data.trump.schedule) === sch0;

        // ---- 卡片：點時間改（出發型／訖＝下一筆平移）、目的地按鈕＝分層選單打 ✔ ----
        S.schSel = {id: 'trump', i: 0}; re.render();
        const plk = re.SP.buildPlan(S.data.trump.schedule, re.S.ext.nav.edges, re.S.ext.nav.nodes).plan;
        pickT('schedule.0.end', '22:00');
        out.endPick = [S.data.trump.schedule[1].t, `@${re.SP.hhmm(22 * 60 + plk[1].cost)}`, S.data.trump.schedule[0].t];
        pickT('schedule.0.dep', '06:00');
        out.depPick = S.data.trump.schedule[0].t;
        while (S.hi > h1) re.undo();
        // 停留長度：「HH 時 MM 分」選擇器，改了下一筆平移；最短 10 分
        S.schSel = {id: 'trump', i: 0}; re.render();
        out.stayText = document.querySelector('#view .tpick[data-k="schedule.0.stay"]')?.textContent;
        pickT('schedule.0.stay', '02:00', true);
        out.stayPick = [S.data.trump.schedule[1].t, `@${re.SP.hhmm(6 * 60 + 20 + 120 + plk[1].cost)}`];
        pickT('schedule.0.stay', '00:05', true);
        out.stayMin = [S.data.trump.schedule[1].t, `@${re.SP.hhmm(6 * 60 + 20 + 10 + plk[1].cost)}`];
        while (S.hi > h1) re.undo();
        // hover 時序條：刻度列顯示游標時間（對齊 10 分、Shift＝1 分）；邊緣／走路段游標 ↔；離開就藏
        S.schSel = {id: 'trump', i: 0}; re.render();
        const mv = (el, min, extra = {}) => el.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 1, clientX: xOf(min), clientY: tb().getBoundingClientRect().top + 8, ...extra}));
        const hovT = () => document.querySelector('#view .daybar .hovt');
        mv(tb(), 14 * 60 + 33);
        out.hov = [hovT()?.hidden, hovT()?.textContent, !document.querySelector('#view .daybar .hovline').hidden, tb().classList.contains('grab')];
        mv(tb(), 14 * 60 + 33, {shiftKey: true});
        out.hovShift = hovT()?.textContent;
        const wk = tb().querySelector('.seg.walk[data-i="1"]'), wkr = wk.getBoundingClientRect();
        wk.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 1, clientX: wkr.left + wkr.width / 2, clientY: wkr.top + wkr.height / 2}));
        out.grabCur = [tb().classList.contains('grab'), getComputedStyle(wk).cursor];
        tb().dispatchEvent(new PointerEvent('pointerleave', {pointerId: 1}));
        out.hovGone = [hovT()?.hidden, tb().classList.contains('grab')];
        // hover 一段＝同一筆作息的段都亮（跨午夜切成兩塊的停留段＋走路段），別筆不亮、離開全拿掉
        const stays = [...tb().querySelectorAll('.seg.stay')];
        const wrapI = stays.map(s => s.dataset.i).find((i, k, a) => a.indexOf(i) !== k);
        const ofI = (i) => [...tb().querySelectorAll(`.seg[data-i="${i}"]`)];
        const lastPiece = ofI(wrapI).filter(s => s.dataset.kind === 'stay').at(-1), lr = lastPiece?.getBoundingClientRect();
        lastPiece?.dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerId: 1, clientX: lr.left + lr.width / 2, clientY: lr.top + lr.height / 2}));
        out.hovSame = [wrapI, ofI(wrapI).map(s => `${s.dataset.kind}:${s.classList.contains('hov')}`).join(),
            [...tb().querySelectorAll('.seg')].filter(s => s.dataset.i !== wrapI && s.classList.contains('hov')).length];
        tb().dispatchEvent(new PointerEvent('pointerleave', {pointerId: 1}));
        out.hovSameGone = tb().querySelectorAll('.seg.hov').length;
        S.schSel = {id: 'trump', i: 0}; re.render();
        document.querySelector('#view [data-k="schedule.0.dest"]').click();
        await until(() => document.querySelector('.ctxmenu'));
        out.destL0 = mItems(0).map(b => b.textContent);
        hover(0, /m_04x05$/);
        out.destL1 = mItems(1).filter(b => b.textContent.startsWith('✔')).map(b => b.textContent);
        hover(1, /trump-inn-f1$/);
        out.destL2 = mItems(2).filter(b => b.textContent.startsWith('✔')).map(b => b.textContent);
        mItems(2).find(b => b.textContent === 'sit-1').click();
        out.destSet = [S.data.trump.schedule[0].map, S.data.trump.schedule[0].go, document.querySelector('#view [data-k="schedule.0.dest"]')?.textContent];
        while (S.hi > h1) re.undo();
        // 沒有作息的 NPC 也有時序條（空的、右鍵插入只插一筆）
        re.commit(() => {delete S.data.trump.schedule;});
        S.schSel = null; re.render();
        out.emptyBar = [!!tb(), tb()?.querySelector('.empty')?.textContent];
        await ctxBar(9 * 60);
        hover(0, /^插入作息/); hover(1, /^m_04x05$/);
        mItems(2).find(b => b.textContent === 'musk-p1').click();
        out.firstIns = JSON.stringify(S.data.trump.schedule);
        while (S.hi > h1) re.undo();
        out.cardUndo = JSON.stringify(S.data.trump.schedule) === sch0;
        // 點門：進到目的地圖、← 返回 回來
        S.schSel = {id: 'trump', i: 0}; re.SM.setMap(F1); re.render();
        await until(() => cv()?.st.data && cv().st.ports.length);
        const door = cv().st.ports.find(p => !p.issue);
        out.doorTo = door && String(door.o.props.map);
        evAt(door.rect.x + door.rect.w / 2, door.rect.y + door.rect.h / 2, 'click');
        await until(() => cv()?.st.name === out.doorTo && cv().st.data);
        out.entered = [cv().st.name, right().querySelector('[data-k=schedBack]').disabled, S.data.trump.schedule.length];
        right().querySelector('[data-k=schedBack]').click();
        await until(() => cv()?.st.name === F1);
        out.backed = [cv().st.name, right().querySelector('[data-k=schedBack]').disabled];

        // 顯示 ▾：預設只勾「這個角色其他行程」；勾「物件名稱」記住
        right().querySelector('.smap .showbtn').click();
        const pop = document.querySelector('.showpop');
        out.showDefault = [...pop.querySelectorAll('input[data-show]')].map(i => `${i.dataset.show}:${i.checked}`);
        // 物件名稱後面有過濾框，打字只過濾名字、記在自己的 key
        const sinp = pop.querySelector('[data-filter=names]');
        sinp.value = 'sit-*'; sinp.dispatchEvent(new Event('input'));
        out.schFilter = [pop.querySelector('.fcount')?.textContent.startsWith('符合 '), re.SM.nameOk('sit-1'), re.SM.nameOk('trump-p1'), localStorage.getItem('tools.role.sched.show.filter'), pop.querySelector('[data-show=names]').checked];
        pop.querySelector('.fclear').click();
        pop.querySelector('[data-show=names]').click();
        localStorage.removeItem('tools.role.sched.show.filter');
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

        // ---- 第 5 步：寫 point 到地圖、路網過期 ----
        const mapsDir = await dir(assets, 'maps', 'm_04x05');
        const orig = await (await fetch(`/assets/maps/${F1}.json`)).text();
        await write(mapsDir, 'trump-inn-f1.json', orig);
        await sleep(30);
        await write(json, 'navgraph.json', await (await fetch('/assets/json/navgraph.json')).text());
        const readMap = async () => JSON.parse(await (await (await mapsDir.getFileHandle('trump-inn-f1.json')).getFile()).text());
        const objs = (m) => m.layers.filter(l => l.type === 'objectgroup').flatMap(l => l.objects);
        re.SM.forget();
        S.stale = null;
        await re.checkStale();
        out.notStale = [JSON.stringify(S.stale), !right().querySelector('.smap .stale')];

        // 點空地 → 問名稱（預設 trump-p2）→ 寫進地圖、選中那筆指過去
        S.schSel = {id: 'trump', i: 0}; re.SM.setMap(F1); re.render();
        await until(() => cv()?.st.data);
        const d5 = cv().st.data, m0 = await readMap();
        let empty = null;
        for (let ty = 2; ty < 13 && !empty; ty++) for (let tx = 2; tx < 13 && !empty; tx++)
        {
            const c = {x: tx * 32 + 16, y: ty * 32 + 16};
            if (![...d5.named.values()].some(n => Math.hypot(c.x - n.cen.x, c.y - n.cen.y) < 24 || (c.x >= n.rect.x && c.x <= n.rect.x + n.rect.w && c.y >= n.rect.y && c.y <= n.rect.y + n.rect.h))) empty = [tx, ty];
        }
        const clickAt = (x, y, type = 'click', extra = {}) => {
            const c = cv(), s = c.st, d = s.data, rc = c.getBoundingClientRect(), o = s.pz.o, K = s.pz.K;
            c.dispatchEvent(new PointerEvent(type, {bubbles: true, button: 0, pointerId: 1, clientX: rc.left + o.x + (x - d.W / 2) * K, clientY: rc.top + o.y + (y - d.H / 2) * K, ...extra}));
        };
        let defName = '';
        // 左鍵點空地什麼都不做；右鍵「新增 point…」問名稱、寫進地圖、不碰作息
        clickAt(empty[0] * 32 + 16, empty[1] * 32 + 16);
        await sleep(60);
        out.leftEmpty = [$('dlgAsk').open, objs(await readMap()).length === objs(m0).length];
        out.newAsk = await runAns((async () => {await ctx(empty[0] * 32 + 16, empty[1] * 32 + 16, '新增 point…'); for (let i = 0; i < 100 && !objs(await readMap()).find(o => o.name === 'trump-p2'); i++) await sleep(30);})(),
            dl => {defName = dl.querySelector('input').value; return 'ok';});
        const m1 = await readMap(), np = objs(m1).find(o => o.name === 'trump-p2');
        const goBefore = S.data.trump.schedule[0].go;
        await until(() => cv()?.st.data?.named.has('trump-p2'));
        await ctxObj('trump-p2', /^改成選中那筆/);
        out.added = [defName, JSON.stringify(np), m1.nextobjectid === m0.nextobjectid + 1, np?.id === m0.nextobjectid, goBefore, S.data.trump.schedule[0].go];
        out.addedExpect = JSON.stringify({id: m0.nextobjectid, name: 'trump-p2', template: '../../templates/point.tj', x: empty[0] * 32, y: empty[1] * 32});
        // 寫出來的檔：除了新物件跟 nextobjectid，其他資料一樣；排版照 Tiled（\/ 跳脫、CRLF 照原檔）
        const text1 = await (await (await mapsDir.getFileHandle('trump-inn-f1.json')).getFile()).text();
        const strip = (m) => JSON.stringify({...m, nextobjectid: 0, layers: m.layers.map(l => l.objects ? {...l, objects: l.objects.filter(o => o.name !== 'trump-p2')} : l)});
        out.sameElse = [strip(m1) === strip(JSON.parse(orig)), text1.includes('"template":"..\\/..\\/templates\\/point.tj"'), text1.includes('\r\n') === orig.includes('\r\n')];
        await sleep(60);
        await until(() => right().querySelector('.smap .stale'));
        out.stale = [JSON.stringify(S.stale), right().querySelector('.smap .stale')?.textContent];
        out.cardMiss = card(0).querySelector('.times')?.textContent;

        // 拖 trump-p2 往右兩格
        await until(() => cv()?.st.data?.named.has('trump-p2'));
        const p2 = cv().st.data.named.get('trump-p2').cen;
        clickAt(p2.x, p2.y, 'pointerdown');
        clickAt(p2.x + 40, p2.y, 'pointermove');
        clickAt(p2.x + 64, p2.y, 'pointermove');
        clickAt(p2.x + 64, p2.y, 'pointerup');
        clickAt(p2.x + 64, p2.y, 'click');
        for (let i = 0; i < 50 && objs(await readMap()).find(o => o.name === 'trump-p2').x === np.x; i++) await sleep(30);
        const moved = objs(await readMap()).find(o => o.name === 'trump-p2');
        out.moved = [moved.x - np.x, moved.y - np.y, $('dlgAsk').open];

        // 改名：地圖＋role.json 引用一起改並存檔（有警告的存檔要按「仍然存檔」）
        out.renameAsk = await runAns(re.renamePoint(F1, 'trump-p2'), dl => {dl.querySelector('input').value = 'trump-p9'; return 'ok';}, () => 'save');
        const saved = JSON.parse(await (await (await json.getFileHandle('role.json')).getFile()).text());
        out.renamed = [!!objs(await readMap()).find(o => o.name === 'trump-p9'), !objs(await readMap()).find(o => o.name === 'trump-p2'), S.data.trump.schedule[0].go, saved.trump.schedule[0].go];
        out.dupName = await runAns(re.renamePoint(F1, 'trump-p9'), dl => {dl.querySelector('input').value = 'trump-p1'; return 'ok';});
        out.dupStatus = $('status').textContent;

        // 門改名：右鍵門有「改名 stair-up…」；trump-inn-f2 的 stair-dn（port 指過來）一起改；改回去 f2 一字不差
        const origF2 = await (await fetch('/assets/maps/m_04x05/trump-inn-f2.json')).text();
        await write(mapsDir, 'trump-inn-f2.json', origF2);
        const readF2 = async () => (await (await mapsDir.getFileHandle('trump-inn-f2.json')).getFile()).text();
        const portIn = (m, nm) => objs(m).find(o => o.name === nm)?.properties?.find(p => p.name === 'port')?.value;
        await until(() => cv()?.st.data?.named.has('stair-up'));
        out.doorMenu = await ctxObj('stair-up');
        out.doorAsk = await runAns((async () => {await ctxObj('stair-up', '改名 stair-up…'); await until(() => /改名 stair-up → stair-x：已寫入/.test($('status').textContent));})(),
            dl => {dl.querySelector('input').value = 'stair-x'; return 'ok';});
        out.doorRenamed = [!!objs(await readMap()).find(o => o.name === 'stair-x'), portIn(JSON.parse(await readF2()), 'stair-dn')];
        await until(() => cv()?.st.data?.named.has('stair-x'));
        out.doorBack = await runAns(re.renamePoint(F1, 'stair-x'), dl => {dl.querySelector('input').value = 'stair-up'; return 'ok';});
        out.doorBackSame = [await readF2() === origF2, !!objs(await readMap()).find(o => o.name === 'stair-up')];

        // 刪除：有人用擋、沒人用確認後刪
        out.delUsed = await runAns(re.deletePoint(F1, 'trump-p9'), () => 'ok');
        out.stillThere = !!objs(await readMap()).find(o => o.name === 'trump-p9');
        re.commit(() => {S.data.trump.schedule[0].go = 'trump-p1';});
        out.delAsk = await runAns(re.deletePoint(F1, 'trump-p9'), () => 'ok');
        out.deleted = !objs(await readMap()).find(o => o.name === 'trump-p9');

        // 更新路網：打 POST /__tools/navgraph（這裡攔下來，不真的重跑）、顯示結果
        const realFetch = window.fetch;
        let posted = false;
        window.fetch = (url, opt) => (String(url).includes('/__tools/navgraph') ? (posted = opt?.method === 'POST', Promise.resolve(new Response(JSON.stringify({ok: true, warns: ['測試警告'], count: 61})))) : realFetch(url, opt));
        await re.updateNav();
        window.fetch = realFetch;
        out.nav = [posted, S.navMsg];
        re.SM.forget();

        // ---- 第 6 步：巡邏路線 ----
        // guard-1 的巡邏用凍結的（真的那份會一直在角色分頁調，下面的點數、號碼都寫死）；只改記憶體，跟遊戲比時刻表在前面
        re.commit(() => {S.data['guard-1'].schedule[0] = {t: '@08:00', go: 'guard-p1', map: 'm/m_04x05', do: 'patrol', route: ['guard-p1', 'guard-p2', 'guard-p3', 'guard-p2', 'guard-p4'], wait: 3};});
        S.sel = 'guard-1'; S.schSel = {id: 'guard-1', i: 0}; re.SM.setMap('m/m_04x05'); re.render();
        const g1 = S.data['guard-1'].schedule[0];
        out.patrolInfo = cards()[0].querySelector('.times.patrol')?.textContent;
        const gk = g1.route.map(n => `m/m_04x05:${n}`);
        const walk = gk.reduce((a, k, j) => a + re.SP.edgeCost(S.ext.nav.edges, k, gk[(j + 1) % gk.length]), 0);
        const hm = n => (n >= 60 ? `${Math.floor(n / 60)} 小時${n % 60 ? ` ${n % 60} 分` : ''}` : `${n} 分`);
        out.patrolWant = `巡邏一圈 ${hm(walk + 3 * 5)}（走 ${hm(walk)}＋停 5×3）`;        await until(() => cv()?.st.patrol);
        const pt = cv().st.patrol;
        out.patrolLines = [pt.lines.map(l => l.kind).join(), pt.lines.every(l => !l.broken)];
        await sleep(50);
        out.badges = cv().st.routeHits.map(b => b.idx).join();
        // 編輯路線：按鈕切換、地圖上方提示
        cards()[0].querySelector('.routebtn').click();
        await until(() => cv()?.st.data);
        out.editOn = [cards()[0].querySelector('.routebtn').textContent, !!right().querySelector('.smap .routeedit'), cv().st.editRoute];
        // 點 guard-p3 加到最後
        await at('guard-p3', 'click');
        out.added6 = S.data['guard-1'].schedule[0].route.join();
        re.undo();
        // 右鍵第 4 個號碼（第二次經過 guard-p2）拿掉那一次
        await until(() => cv()?.st.routeHits.length === 5);
        const b4 = cv().st.routeHits.find(b => b.idx === 3);
        {
            const c = cv(), s = c.st, d = s.data, rc = c.getBoundingClientRect(), o = s.pz.o, K = s.pz.K;
            c.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, cancelable: true, clientX: rc.left + o.x + (b4.x + b4.w / 2 - d.W / 2) * K, clientY: rc.top + o.y + (b4.y + b4.h / 2 - d.H / 2) * K}));
        }
        out.removed6 = S.data['guard-1'].schedule[0].route.join();
        re.undo();
        // Shift＋點號碼＝標記（紅底），之後的點插在它前面、標記跟著走
        const badge = async (idx, type, opts = {}) => {
            await until(() => cv()?.st.routeHits.some(b => b.idx === idx));
            const b = cv().st.routeHits.find(x => x.idx === idx);
            evAt(b.x + b.w / 2, b.y + b.h / 2, type, opts);
        };
        const rt6 = () => S.data['guard-1'].schedule[0].route.join();
        await badge(2, 'click', {shiftKey: true});
        await until(() => cv()?.st.routeMark === 2);
        out.mark = [S.routeEdit.mark, right().querySelector('.smap .routeedit').textContent.includes('插在 3 guard-p3 前面')];
        await badge(1, 'pointermove');
        out.markTip = right().querySelector('.smaptip').textContent;
        await at('guard-p4', 'click');
        await at('guard-p1', 'click');
        out.markAdd = [rt6(), S.routeEdit.mark];
        await badge(0, 'contextmenu');
        out.markDelBefore = [rt6(), S.routeEdit.mark];
        await badge(3, 'contextmenu');
        out.markDelSelf = [rt6(), S.routeEdit.mark];
        re.undo(); re.undo(); re.undo(); re.undo();
        await badge(4, 'click', {shiftKey: true});
        await badge(4, 'click', {shiftKey: true});
        out.markToggle = S.routeEdit.mark;
        await badge(1, 'click', {shiftKey: true});
        await badge(4, 'click', {shiftKey: true});
        out.markMove = S.routeEdit.mark;
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.markEsc = [S.routeEdit?.mark, !!S.routeEdit];
        await at('guard-p3', 'click');
        out.markGone = rt6();
        re.undo();
        // 別張圖的點不能加
        re.SM.setMap('m_04x05/trump-inn-f1'); re.render();
        await at('trump-p1', 'click');
        out.otherMap = [S.data['guard-1'].schedule[0].route.length, $('status').textContent];
        // Esc 結束
        document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.editOff = [S.routeEdit, cards()[0].querySelector('.routebtn').textContent];
        S.sel = 'trump';

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
    t.check('滑過物件：浮動框顯示名稱、type、占用時間圖', r.hover.startsWith('trump-p1（point）\n'), r.hover);
    t.check('占用時間圖：這個角色排第一列（橘）、別人在後面', r.hoverOcc[0] === 'trump 1*' && r.hoverOcc.slice(1).every(x => !x.endsWith('*')), JSON.stringify(r.hoverOcc));
    t.eq('占用時間圖：選中那筆加白框、有刻度、沒時刻線；離開就藏', JSON.stringify([...r.hoverBold, r.tipGone]), JSON.stringify([true, true, true, true]));
    t.eq('沒有下方資訊列、canvas 沒 title、說明在 ?', JSON.stringify(r.noInfo), JSON.stringify([true, true, true]));
    t.check('選中那張的編號反白（白底，蓋在路線上面）', r.selWhite);
    t.eq('地圖的倍率自己一組', JSON.stringify(r.zoomSep), JSON.stringify([1.5, true]));
    t.eq('換地圖記住', r.mapMem, 'm/m_04x05');
    t.check('大地圖 100×100 格、有 musk-p1／trump-inn', JSON.stringify(r.big) === JSON.stringify([3200, 3200, true, true]), JSON.stringify(r.big));
    t.eq('template 物件（旅店建築）有畫', r.innPx, true);
    t.eq('切回外觀', JSON.stringify(r.back), JSON.stringify([true, 'look']));

    t.check('遊戲 ScheduleManager 照樣排出時刻表', Object.keys(game).length > 0 && game.trump?.length === 2, JSON.stringify(Object.keys(game)));
    t.eq('工具算的時刻表跟遊戲一樣（全部角色）', JSON.stringify(r.tool), JSON.stringify(game));
    t.check('trump 作息：06:20 到 1F trump-p1、22:50 到 2F 床', JSON.stringify(r.trumpSch) === JSON.stringify(['@06:20 m_04x05/trump-inn-f1:trump-p1', '@22:50 m_04x05/trump-inn-f2:bed']), JSON.stringify(r.trumpSch));
    t.eq('沒選：沒有卡片、一行灰字', JSON.stringify(r.firstSel), JSON.stringify([0, '點時序條上的一段來編輯', null]));
    t.eq('選了：只顯示那一筆的卡片', JSON.stringify(r.oneCard), JSON.stringify(['0']));
    t.eq('卡片第一行：走：出發（倒推）（幾分）待：抵達 ~ 下一筆出發（停多久）', r.times0, r.times0Want);
    t.eq('卡片沒有地圖欄、出發／抵達下拉；目的地是按鈕', JSON.stringify(r.cardNoMap), JSON.stringify([true, true, '🏠 trump-inn-f1 ▸ trump-p1']));
    t.check('@ 抵達倒推出發', r.dep0);
    t.eq('時間選擇器：顯示 HH:MM、沒有輸入框', JSON.stringify(r.tpNoInput), JSON.stringify(['06:20', true]));
    t.eq('點「時」：5 格、中間＝目前值', JSON.stringify(r.tpOpen), JSON.stringify(['04', '05', '06*', '07', '08']));
    t.eq('滾輪 3 格：立刻寫、併成一步 undo、選單跟著捲', JSON.stringify(r.tpWheel), JSON.stringify(['@09:20', 1, ['07', '08', '09*', '10', '11']]));
    t.eq('點格子：寫入、還是同一步 undo、關閉', JSON.stringify(r.tpClick), JSON.stringify(['@11:20', 1, true]));
    t.eq('undo 一次回到原本時間', r.tpUndo, '@06:20');
    t.eq('分鐘往上捲 21 格繞過 00、小時不動', JSON.stringify(r.tpWrap), JSON.stringify(['@06:59', ['57', '58', '59*', '00', '01']]));
    t.check('Esc 關閉選單', r.tpEsc);
    t.eq('空的時間顯示 --:--', r.tpEmpty, '--:--');
    t.eq('空的從 08:00 起算', JSON.stringify(r.tpEmptyOpen), JSON.stringify(['58', '59', '00*', '01', '02']));
    t.eq('空的點一格就寫成合法 HH:MM', r.tpEmptyPick, '08:01');
    t.eq('全部 undo 回原狀', JSON.stringify(r.tpBack), JSON.stringify(['@06:20', true]));
    t.eq('麵包屑：2F → 1F，目前 1F', JSON.stringify(r.crumbs), JSON.stringify(['m_04x05/trump-inn-f2', 'm_04x05/trump-inn-f1*']));
    t.eq('1F 路線：有線、都走得到、每段至少兩點', JSON.stringify(r.lines), JSON.stringify([true, true, true]));
    t.check('路線終點在目的地的站位格', r.endsAtDest);
    t.eq('1F 標籤：從 2F 進來（可點）、抵達', JSON.stringify(r.labels), JSON.stringify(['從 trump-inn-f2 進來→m_04x05/trump-inn-f2', '抵達']));
    t.eq('點標籤切到 2F：麵包屑跟著、2F 標籤＝出發、→ 1F', JSON.stringify(r.jumped),
        JSON.stringify(['m_04x05/trump-inn-f2', 'm_04x05/trump-inn-f2', ['出發', '→ trump-inn-f1→m_04x05/trump-inn-f1']]));
    t.eq('點時序條第 2 段：卡片換成第 2 筆、橫條沒重畫、地圖到床那層', JSON.stringify(r.sel2), JSON.stringify([true, '1', 'm_04x05/trump-inn-f2', 1]));
    t.eq('換選中那筆：鏡頭對準目的地、閃框、倍率不動', JSON.stringify(r.focus2), JSON.stringify([true, true, true, true]));
    t.check('同一筆再點：鏡頭不動', r.focusSame);
    t.eq('換到另一張圖的那筆：也對準＋閃框', JSON.stringify(r.focus1), JSON.stringify([true, true]));
    t.eq('目的地找不到：不閃、顯示 ⚠', JSON.stringify(r.focusMiss), JSON.stringify(['⚠ m_04x05/trump-inn-f2 找不到「no-such-spot」', true]));
    t.check('排不下標紅、寫晚幾分', !r.lateWant || /^times bad\|.*排不下：晚 \d+ 分/.test(r.late), r.late);
    t.check('橫條：排不下那筆塗紅', !r.lateWant || (r.lateBar.length === 1 && r.lateBar[0].startsWith('1:⚠ 排不下')), JSON.stringify(r.lateBar));
    t.eq('橫條在卡片上面', r.barFirst, true);
    t.eq('橫條分段：停留×2（床跨午夜切兩截）＋走路×2', r.barSegs, 'stay0,stay1,stay1,walk0,walk1');
    t.eq('橫條分段加起來剛好 24 小時', r.barSum, 1440);
    t.eq('床跨午夜：兩截貼著兩端、跟 1F 不同色', JSON.stringify(r.bedCut), JSON.stringify([2, true, true]));
    t.check('滑過床那段：目的地、地圖、時段（沒有編號）', /^bed（m_04x05\/trump-inn-f2）\n22:50～\d\d:\d\d，停 \d+ 時/.test(r.bedTip ?? ''), r.bedTip);
    t.eq('圖例：地圖名', JSON.stringify(r.legend), JSON.stringify(['trump-inn-f1', 'trump-inn-f2']));
    t.eq('預設反白第 1 筆（停留＋走過去那段）', JSON.stringify(r.barSel), JSON.stringify(['0', '0']));
    t.eq('點橫條：卡片換成那筆、橫條沒重畫、反白跟著換', JSON.stringify(r.barPick), JSON.stringify([1, true, '1', '1']));
    t.eq('走不到：紅線、沒有走路段', r.nopeSeg, 'nope0@600+0,stay0@600+300,walk1@900+60,stay1@960+1080');
    t.eq('作息資料有問題：不畫橫條、一行灰字', JSON.stringify(r.barNone), JSON.stringify([true, '作息資料有問題，無法排時刻表']));
    t.eq('總覽多一個「作息」分頁（NPC 數）', r.gTab, r.gTabWant);
    t.check('甘特圖：每個 NPC 一列、沒作息的灰條', r.gRows[0] === r.gRows[2] && r.gRows[1] === r.gRows[3] && r.gRows[1] < r.gRows[0], JSON.stringify(r.gRows));
    t.eq('照子分類分組', JSON.stringify(r.gGroups), JSON.stringify(r.gGroupsWant));
    t.eq('打 12:00：trump 在 1F、記住、游標在正中間', JSON.stringify(r.gNoon), JSON.stringify(['trump-inn-f1／trump-p1', '720', '50%']));
    t.eq('打 03:00：trump 在床上', r.gNight, 'trump-inn-f2／bed');
    t.eq('時間軸按住拖到正中間＝12 點', JSON.stringify(r.gDrag), JSON.stringify([true, '12']));
    t.eq('圖例人數＝此刻停在那張圖的人', JSON.stringify(r.gCount), JSON.stringify([r.gCount[1], r.gCount[1], true]));
    t.eq('點圖例：記住、加亮、其他地圖變淡、此刻欄加粗', JSON.stringify(r.gMap), JSON.stringify(['m_04x05/trump-inn-f1', true, true, true]));
    t.eq('再點取消', JSON.stringify(r.gMapOff), JSON.stringify([null, 0]));
    t.eq('點一段：進表單、選那張卡片、右欄作息地圖', JSON.stringify(r.gPick), JSON.stringify(['form', 'trump', 1, 'sched', true, 'm_04x05/trump-inn-f2', true, true]));
    t.eq('點角色名：進表單', JSON.stringify(r.gName), JSON.stringify(['form', 'musk']));
    t.eq('總覽拖分界線：照原型別平移、一筆 undo、留在總覽', JSON.stringify(r.gShift), JSON.stringify(['@22:20', 1, 'table']));
    t.eq('總覽拖曳中：游標標籤藏、頂端時間軸兩端時間（右＝抵達）、豎線貫穿每列', JSON.stringify(r.gHovDrag), JSON.stringify([true, '22:20', 2, true, true]));
    t.eq('總覽拖曳中：待的時間在頂端刻度列（2 個）、兩端時間在它上面', JSON.stringify(r.gStays), JSON.stringify([2, true]));
    t.eq('總覽放開：兩端時間、待的時間收起', r.gEndsGone, 0);
    t.eq('相衝：撞到的那截紅斜線（不擋滑鼠）、段提示多一行「⚠ 撞了 10:00～11:00：zc」、對方那列也標', JSON.stringify(r.gClash), JSON.stringify([true, true, 'none', true]));
    t.eq('相衝：對方藏起來照算、提示寫（已隱藏）', JSON.stringify(r.gClashHide), JSON.stringify([true, true]));
    t.eq('相衝：拖對方那段，放開前這列就重畫成新時間', JSON.stringify(r.gClashLive), JSON.stringify(['@10:00', true]));
    t.eq('相衝：放開寫進去、照樣標', JSON.stringify(r.gClashDrop), JSON.stringify(['@10:30,11:30', true]));
    t.eq('相衝：表單的時序條也標', JSON.stringify(r.fClash), JSON.stringify([true, true]));
    t.eq('相衝：拿掉對方就不標', r.clashGone, true);
    t.eq('總覽滑過：頂端標籤 14:30（對齊 10 分）、每列＋時間軸都有線、同位置', JSON.stringify(r.gHov), JSON.stringify([false, '14:30', true, true, 1, true, true]));
    t.eq('總覽滑過＋Shift：1 分', r.gHovShift, '14:33');
    t.eq('總覽離開時序條：標籤跟線都藏', JSON.stringify(r.gHovGone), JSON.stringify([true, true, false]));
    t.eq('時序條右鍵（落在停留段）：插入／改目的地／類型／刪除', JSON.stringify(r.barMenu), JSON.stringify(['插入作息（10:00 抵達）', '分割（10:00）', '改目的地', '類型', '刪除這筆']));
    t.eq('插入 ▸ 世界圖 ＋ 在地圖上選', JSON.stringify(r.barL1), JSON.stringify(['m_04x05', '🗺 在地圖上選…']));
    t.check('世界圖 ▸ 自己的點＋🏠 室內圖（不列門、樓梯、只有門的空屋）', r.barL2.includes('musk-p1') && r.barL2.includes('🏠 trump-inn-f1') && !r.barL2.includes('trump-inn') && !r.barL2.some(x => /house-0[1-7]$/.test(x)), JSON.stringify(r.barL2));
    t.check('🏠 室內圖 ▸ 點（不列 door／stair-up）', r.barL3.includes('sit-1') && r.barL3.includes('trump-p1') && !r.barL3.includes('door') && !r.barL3.includes('stair-up'), JSON.stringify(r.barL3));
    t.eq('插入夾一小時：10:00 抵達 sit-1、11:00 出發回 trump-p1、選新那筆、一筆 undo', JSON.stringify(r.barIns),
        JSON.stringify(['@06:20 trump-p1 | @10:00 sit-1 | 11:00 trump-p1 | @22:50 bed', 1, true, 1]));
    t.eq('拖分界線中：兩端＝出發／抵達時間＋豎線、游標標籤跟白線藏、沒有下方浮框',
        JSON.stringify([r.dragEnds[0], r.dragEnds.slice(2)]), JSON.stringify([r.dragEnds[1], [2, true, true, true]]));
    t.eq('放開：兩端時間收起', r.dragEndsGone, 0);
    t.eq('拖分界線中：刻度列 2 個「待 H:MM」（前一筆＋這筆）、不是握拳', JSON.stringify(r.dragStays), JSON.stringify([2, true, false]));
    t.eq('滑到停留段中間：游標是手（不是 ↔）', JSON.stringify(r.moveCur), JSON.stringify([true, false, 'grab']));
    t.eq('拖停留段中間：刻度列 3 個待的時間（前、自己不變、後）、不重疊、握拳',
        JSON.stringify([r.blockStays[0], ...r.blockStays.slice(2)]), JSON.stringify([r.blockStays[1], true, true, true, 'grabbing']));
    t.eq('放開：待的時間收起、不握拳', JSON.stringify(r.blockStaysGone), JSON.stringify([0, false]));
    t.eq('拖停留段中間：兩端＝抵達／離開、游標標籤藏', JSON.stringify([r.blockEnds[0], r.blockEnds[2]]), JSON.stringify([r.blockEnds[1], true]));
    t.eq('整塊平移：這筆跟下一筆一起平移 20 分、停留不變、一筆 undo', JSON.stringify([r.block[0], r.block[2], r.block[3]]), JSON.stringify([r.block[1], true, 1]));
    t.eq('整塊往左拖過頭：前一筆最少停 10 分、自己停留不變', JSON.stringify(r.blockClamp), JSON.stringify([10, true]));
    t.eq('單擊停留段中間（沒拖）：照舊選取、不改資料', JSON.stringify(r.blockClick), JSON.stringify([1, 0]));
    t.eq('拖走路段：那筆照原型別平移 30 分、前一筆不動、一筆 undo', JSON.stringify(r.dragged), JSON.stringify(['11:30', '@10:00', 2]));
    t.eq('拖過頭：前一段最少停 10 分', r.clamped, 10);
    t.check('類型下拉：（無）＋清單＋新類型', r.typeOpts[0] === '（無）' && r.typeOpts.includes('午餐') && r.typeOpts.at(-1) === '＋ 新類型…', JSON.stringify(r.typeOpts));
    t.eq('選午餐：寫 type、段內寫午餐、type 排在 t 後面', JSON.stringify(r.typed), JSON.stringify(['lunch', '午餐', 't,map,go,type']));
    t.eq('右鍵段：一樣的選單', JSON.stringify(r.segMenu), JSON.stringify(['插入作息（10:20 抵達）', '分割（10:20）', '改目的地', '類型', '刪除這筆']));
    t.eq('刪除：前後同目的地合併，回到原本、選前一筆', JSON.stringify(r.delMerged), JSON.stringify([true, 0]));
    t.eq('同目的地插入：也夾一小時（12:00 抵達、13:00 出發回原處）、選新那筆', JSON.stringify(r.sameIns),
        JSON.stringify(['@06:20 trump-p1 | @12:00 trump-p1 | 13:00 trump-p1 | @22:50 bed', 1]));
    t.eq('同目的地塞不下一小時：只插一筆（＝分割）', r.sameFull, '@06:20 trump-p1 | @22:10 trump-p1 | @22:50 bed');
    t.eq('同目的地插入 undo 回原狀', r.sameUndo, true);
    t.check('待多久：選單一行「待多久 HH 時 MM 分」', /^待多久\d\d 時 \d\d 分$/.test(r.stayRow ?? ''), r.stayRow);
    t.eq('待多久：點時的格子＝立刻寫（+1 時）、選單不關、一筆 undo', JSON.stringify(r.stayKeep), JSON.stringify([true, 60, 1]));
    t.eq('待多久：調成 13 時 40 分＝下一筆出發平移到 20:00（照原本抵達型）、這筆不動、選單數字跟著', JSON.stringify(r.stayOk),
        JSON.stringify(['待多久13 時 40 分', 1200, '@06:20', true]));
    t.eq('待多久：拉過頭夾到上限（下一筆剩 10 分）、數字跳回、狀態列提示', JSON.stringify(r.stayMax), JSON.stringify([10, true, true]));
    t.eq('待多久：00:00 夾到最少 10 分', JSON.stringify(r.stayMenuMin), JSON.stringify([10, '待多久00 時 10 分', '最少待 10 分']));
    t.eq('待多久：undo 回原狀', r.stayUndo, true);
    t.eq('卡片停留欄也夾上限（下一筆剩 10 分）', r.stayCard, 10);
    t.eq('待多久：只有一筆＝反灰、不能點', JSON.stringify(r.stayOne), JSON.stringify([true, true]));
    t.check('在地圖上選：地圖上方提示', /插入 15:00 抵達的目的地/.test(r.pickBar ?? ''), r.pickBar);
    t.eq('點 sit-2：插入（夾一小時）、提示消失', JSON.stringify(r.picked2), JSON.stringify(['@06:20 trump-p1 | @15:00 sit-2 | 16:00 trump-p1 | @22:50 bed', true]));
    t.eq('Esc 取消挑選', JSON.stringify(r.pickEsc), JSON.stringify([true, true]));
    t.eq('全部 undo 回原狀', r.barUndo, true);
    t.eq('點訖改 22:00：下一筆照原型別平移（@ 抵達＝22:00＋走路）、這筆不動', JSON.stringify(r.endPick), JSON.stringify([r.endPick[1], r.endPick[1], '@06:20']));
    t.eq('點出發改 06:00：這筆變出發型', r.depPick, '06:00');
    t.check('停留長度顯示成「HH 時 MM 分」', /^\d\d 時 \d\d 分$/.test(r.stayText ?? ''), r.stayText);
    t.eq('停留改 2 小時：下一筆照原型別平移', r.stayPick[0], r.stayPick[1]);
    t.eq('停留最短 10 分', r.stayMin[0], r.stayMin[1]);
    t.eq('hover 時序條：刻度列顯示游標時間（對齊 10 分）、直線、中間不是邊緣', JSON.stringify(r.hov), JSON.stringify([false, '14:30', true, false]));
    t.eq('按住 Shift：到 1 分', r.hovShift, '14:33');
    t.eq('滑到走路段：游標 ↔（段自己的 pointer 不蓋掉）', JSON.stringify(r.grabCur), JSON.stringify([true, 'ew-resize']));
    t.eq('離開時序條：時間標籤藏起來', JSON.stringify(r.hovGone), JSON.stringify([true, false]));
    t.check('hover 跨午夜那段：同一筆的兩塊停留＋走路段都亮、別筆不亮', r.hovSame[0] != null && /^(\w+:true,?)+$/.test(r.hovSame[1]) && (r.hovSame[1].match(/stay/g) ?? []).length === 2
        && /walk/.test(r.hovSame[1]) && r.hovSame[2] === 0, JSON.stringify(r.hovSame));
    t.eq('離開時序條：hover 反白全拿掉', r.hovSameGone, 0);
    t.check('目的地按鈕：分層選單、目前所在打 ✔', r.destL0[0] === '✔ m_04x05' && r.destL0.at(-1) === '🗺 在地圖上選…', JSON.stringify(r.destL0));
    t.eq('✔ 掛在室內圖跟點上', JSON.stringify([r.destL1, r.destL2]), JSON.stringify([['✔ 🏠 trump-inn-f1'], ['✔ trump-p1']]));
    t.eq('選 sit-1：改 map＋go、按鈕跟著換', JSON.stringify(r.destSet), JSON.stringify(['m_04x05/trump-inn-f1', 'sit-1', '🏠 trump-inn-f1 ▸ sit-1']));
    t.eq('沒作息的 NPC：空的時序條＋提示', JSON.stringify(r.emptyBar), JSON.stringify([true, '（沒有作息，右鍵插入）']));
    t.eq('第一筆只插一筆', r.firstIns, JSON.stringify([{t: '@09:00', map: 'm/m_04x05', go: 'musk-p1'}]));
    t.eq('卡片測試全部 undo 回原狀', r.cardUndo, true);
    t.eq('總覽右鍵：跟表單同一份選單', JSON.stringify(r.ggMenu), JSON.stringify(['插入作息（12:00 抵達）', '分割（12:00）', '改目的地', '類型', '刪除這筆']));
    t.eq('總覽分割：寫進去、留在總覽、一筆 undo', JSON.stringify(r.ggSplit), JSON.stringify([3, 'table', 1]));
    t.eq('總覽 Shift＋點第一下：反白那段、不跳頁', JSON.stringify(r.ggShift1), JSON.stringify([[0], 'table']));
    t.eq('總覽 Shift＋點第二下：反白範圍', JSON.stringify(r.ggShift2), JSON.stringify([[0, 1], 'table']));
    t.eq('總覽多選右鍵：合併／刪除', JSON.stringify(r.ggMulti), JSON.stringify(['合併 2 筆', '刪除 2 筆']));
    t.eq('總覽合併：回原狀、留在總覽、清掉多選', JSON.stringify(r.ggMerged), JSON.stringify([true, 'table', true]));
    t.eq('總覽範圍外右鍵：一般選單、清掉多選', JSON.stringify(r.ggOutside), JSON.stringify([true, true, []]));
    t.eq('總覽在地圖上選：進表單、挑選模式、右欄作息', JSON.stringify(r.ggPick), JSON.stringify(['form', 'trump', true, 'sched']));
    t.eq('總覽編輯全部 undo 回原狀', r.ggUndo, true);
    t.check('總覽沒作息那列：右鍵能插入', !r.ggEmpty || (/^插入作息/.test(r.ggEmpty[0]) && r.ggEmpty[1] === '（沒有作息，右鍵插入）'), JSON.stringify(r.ggEmpty));
    t.eq('角色 ▾ 按鈕：顯示數/總數', r.ggBtn, `角色（${r.gRows[2]}/${r.gRows[2]}）▾`);
    t.check('角色 ▾：每個角色一格、照子分類分組', r.ggPop[0] && r.ggPop[1] === r.gRows[2] && r.ggPop[2] === r.gGroupsWant.length, JSON.stringify(r.ggPop));
    t.eq('取消 trump：那列消失、記藏的、數字、清單還開著', JSON.stringify(r.ggHide), JSON.stringify([true, '["trump"]', `角色（${r.gRows[2] - 1}/${r.gRows[2]}）▾`, true]));
    t.eq('全部：回來、清掉記錄', JSON.stringify(r.ggAll), JSON.stringify([true, null, `角色（${r.gRows[2]}/${r.gRows[2]}）▾`]));
    t.eq('分割：離邊緣不到 10 分反灰', JSON.stringify(r.splitNear), JSON.stringify(['分割（06:20）', true, '離段的邊緣至少 10 分']));
    t.eq('分割：在選單裡', JSON.stringify(r.splitMenu), JSON.stringify(['插入作息（12:00 抵達）', '分割（12:00）', '改目的地', '類型', '刪除這筆']));
    t.eq('分割：新的一筆 @12:00 同目的地、選它、一筆 undo', JSON.stringify(r.split), JSON.stringify([JSON.stringify({t: '@12:00', go: 'trump-p1', map: 'm_04x05/trump-inn-f1'}), 3, 1, 1]));
    t.check('Shift＋點：反白兩段、卡片區寫已選 2 筆', JSON.stringify(r.multi[0]) === '[0,1]' && /^已選 2 筆（06:20～/.test(r.multi[1]), JSON.stringify(r.multi));
    t.eq('多選右鍵：只有合併／刪除', JSON.stringify(r.multiMenu), JSON.stringify(['合併 2 筆', '刪除 2 筆']));
    t.eq('合併子選單：同內容去重', r.mergeL1.length, 1);
    t.eq('合併同目的地：回到原狀、選合併那筆、清掉多選', JSON.stringify(r.merged), JSON.stringify([true, 0, true]));
    t.eq('合併子選單：兩筆不同各一行', r.mergeL1b.length, 2);
    t.eq('合併留床：時間用範圍第一筆的', r.mergedBed, JSON.stringify([{t: '@06:20', go: 'trump-p1', map: 'm_04x05/trump-inn-f1'}, {t: '@12:00', go: 'bed', map: 'm_04x05/trump-inn-f2'}]));
    t.eq('右鍵範圍外：回到單選選單', JSON.stringify(r.outside), JSON.stringify([true, true, [0]]));
    t.eq('刪除 2 筆：剩一筆', JSON.stringify(r.delRange), JSON.stringify([JSON.stringify([{t: '@06:20', go: 'trump-p1', map: 'm_04x05/trump-inn-f1'}]), 0]));
    t.eq('只有一筆：分界線游標 ↔', r.oneGrab, true);
    t.eq('只有一筆：兩端只標一個抵達時間', r.oneTip, '07:20');
    t.eq('只有一筆：拖 1 小時', JSON.stringify(r.oneDrag), JSON.stringify(['@07:20']));
    t.check('選單每層都在視窗裡', r.menuFit.length >= 3 && r.menuFit.every(Boolean), JSON.stringify(r.menuFit));
    t.eq('選單太高可捲動', r.menuScroll, 'auto');
    t.eq('分割／多選測試全部 undo 回原狀', r.multiUndo, true);
    t.check('滑過別人用的點：占用時間圖列出誰的第幾筆、提示右鍵', r.hoverOthersOcc.some(x => /^musk (\d+,)*2(,|$)/.test(x)) &&r.hoverOthers.endsWith('右鍵＝新增目的地／改目的地…'), JSON.stringify([r.hoverOthersOcc, r.hoverOthers]));
    t.eq('左鍵點物件不改資料', JSON.stringify(r.leftNoop), JSON.stringify(['trump-p1', true]));
    t.eq('右鍵物件：新增目的地／改成選中那筆', JSON.stringify(r.objMenu), JSON.stringify(['新增目的地…', '改成選中那筆（06:20）的目的地']));
    t.eq('改成選中那筆的目的地：改那筆的 map＋go', JSON.stringify(r.picked), JSON.stringify([true, 'm_04x05/trump-inn-f1', 'sit-1', 2]));
    t.eq('一筆 undo 回原本的目的地', r.pickUndo, 'trump-p1');
    t.check('滑過空地：方框對齊格子、浮動框寫格子＋右鍵提示', r.cellHover[0] === `@${r.addedAt && JSON.parse(r.addedAtWant).at.join(',')}` && r.cellHover[2].startsWith('格 ') && r.cellHover[2].endsWith('右鍵＝新增目的地…'), JSON.stringify(r.cellHover));
    t.eq('右鍵空地 新增目的地：問抵達時間（預設選中那筆 +1 小時）', JSON.stringify([r.addAsk, r.addedAt[0]]), JSON.stringify([['新增目的地'], '07:20']));
    t.eq('夾一小時：插在第 2 筆、寫 at、選到新的那筆、13:00 出發回 trump-p1', JSON.stringify(r.addedAt.slice(1)),
        JSON.stringify([4, r.addedAtWant, 1, JSON.stringify({t: '13:00', go: 'trump-p1', map: 'm_04x05/trump-inn-f1'})]));
    t.check('格子還沒進路網：時刻表先臨時算', /待：12:00/.test(r.atTimes ?? ''), r.atTimes);
    t.check('橫幅：N 個作息格子還沒進路網', /1 個作息格子還沒進路網/.test(r.atBanner ?? ''), r.atBanner);
    t.eq('改成物件：at 換成 go、key 位置不變', r.atToGo, JSON.stringify({t: '@12:00', map: 'm_04x05/trump-inn-f1', go: 'sit-1'}));
    t.eq('作息地圖畫 at 格子方框（畫的時候就算好作息點）', JSON.stringify(r.atBox), JSON.stringify([true, 'trump']));
    t.eq('同一時間擋下', JSON.stringify([r.dupAsk, r.dupT]), JSON.stringify([['新增目的地'], [4, '已經有一筆是 06:20 抵達']]));
    t.check('走不到的格子：新增目的地反灰', r.wallMenu?.[0] === '新增目的地…×', JSON.stringify(r.wallMenu));
    t.eq('都 undo 回去', JSON.stringify(r.insUndo), JSON.stringify([2, true]));
    t.check('點門：進到目的地圖、← 返回 能按、作息沒動', r.entered[0] === r.doorTo && r.entered[1] === false && r.entered[2] === 2, JSON.stringify([r.doorTo, r.entered]));
    t.eq('← 返回 回到點門前那張', JSON.stringify(r.backed), JSON.stringify(['m_04x05/trump-inn-f1', true]));
    t.check('座標沒勾：空地沒浮動框、方框照畫', r.noCoord.every(Boolean), r.noCoord.join());
    t.eq('顯示 ▾ 預設勾本角色其他行程、座標', JSON.stringify(r.showDefault), JSON.stringify(['mine:true', 'others:false', 'names:false', 'grid:false', 'coord:true']));
    t.eq('作息地圖也有名稱過濾框：sit-* 只中 sit-1、記自己的 key、自動勾物件名稱', JSON.stringify(r.schFilter), JSON.stringify([true, true, false, 'sit-*', true]));
    t.eq('勾格子可走：記住、按鈕數字', JSON.stringify(r.showSaved), JSON.stringify(['{"mine":true,"coord":true,"grid":true}', '顯示（3）▾', true]));
    t.check('格子權重有算出牆', r.wall);
    t.eq('地圖沒比 navgraph.json 新：沒有過期提示', JSON.stringify(r.notStale), JSON.stringify(['[]', true]));
    t.eq('左鍵點空地：沒問、沒寫地圖', JSON.stringify(r.leftEmpty), JSON.stringify([false, true]));
    t.eq('右鍵空地 新增 point…：問名稱、預設 <角色id>-p<n>', JSON.stringify([r.newAsk, r.added[0]]), JSON.stringify([['在 m_04x05/trump-inn-f1 新增 point'], 'trump-p2']));
    t.eq('新增 point：point.tj、id＝nextobjectid、格子左上角', r.added[1], r.addedExpect);
    t.eq('nextobjectid +1、不碰作息；右鍵新點 改成第 1 筆 才指過去', JSON.stringify(r.added.slice(2)), JSON.stringify([true, true, 'trump-p1', 'trump-p2']));
    t.eq('其他資料不變、排版照 Tiled、換行照原檔', JSON.stringify(r.sameElse), JSON.stringify([true, true, true]));
    t.eq('寫完地圖：路網過期提示＋更新鈕', JSON.stringify(r.stale), JSON.stringify(['["m_04x05/trump-inn-f1"]', '⚠ 路網已過期（trump-inn-f1.json 比 navgraph.json 新）更新路網']));
    t.check('卡片標 ⚠ 路網裡沒有、只剩一個時間欄', (r.cardMiss ?? '').includes('⚠ 路網裡沒有 m_04x05/trump-inn-f1:trump-p2') && r.cardMiss.startsWith('時間：06:20（抵達）'), r.cardMiss);
    t.eq('拖 point：對齊格子、往右兩格、拖完不會當成點空地', JSON.stringify(r.moved), JSON.stringify([64, 0, false]));
    t.eq('改名：問名稱（列出 role.json 會改的）、有警告問存檔', JSON.stringify(r.renameAsk), JSON.stringify(['改名 trump-p2（一起改：role.json：trump 第 1 筆）', '有 1 個問題']));
    t.eq('改名：地圖改了、role.json 引用跟著改並存檔', JSON.stringify(r.renamed), JSON.stringify([true, true, 'trump-p9', 'trump-p9']));
    t.eq('改成同圖已有的名字擋住', JSON.stringify([r.dupName, r.dupStatus]), JSON.stringify([['改名 trump-p9（一起改：role.json：trump 第 1 筆）'], '這張圖已經有 trump-p1']));
    t.check('右鍵門：有「改名 stair-up…」', r.doorMenu.includes('改名 stair-up…'), r.doorMenu.join());
    t.eq('門改名：對話框列出 f2 指過來的門', JSON.stringify(r.doorAsk), JSON.stringify(['改名 stair-up（一起改：m_04x05/trump-inn-f2 的門 stair-dn）']));
    t.eq('門改名：f1 改名、f2 的 stair-dn 的 port 跟著改', JSON.stringify(r.doorRenamed), JSON.stringify([true, 'stair-x']));
    t.check('門改回原名：f2 一字不差', r.doorBackSame.every(Boolean), JSON.stringify([r.doorBack, r.doorBackSame]));
    t.eq('有作息用到不能刪', JSON.stringify([r.delUsed, r.stillThere]), JSON.stringify([['不能刪 trump-p9'], true]));
    t.eq('沒人用：確認後刪掉', JSON.stringify([r.delAsk, r.deleted]), JSON.stringify([['刪除 trump-p9？'], true]));
    t.eq('更新路網：POST、顯示節點數跟警告', JSON.stringify(r.nav), JSON.stringify([true, '路網已更新：61 個節點，1 個警告\n測試警告']));
    t.eq('巡邏卡片：一圈幾小時幾分（走＋停 n×wait）', r.patrolInfo, r.patrolWant);
    t.eq('巡邏路線：入口就是第一點不畫、4 段＋回起點虛線、都走得到', JSON.stringify(r.patrolLines), JSON.stringify(['loop,loop,loop,loop,close', true]));
    t.eq('每經過一次一個號碼', r.badges, '0,1,2,3,4');
    t.eq('編輯路線：按鈕變完成、地圖上方提示', JSON.stringify(r.editOn), JSON.stringify(['✔ 完成', true, true]));
    t.eq('點點加到路線最後', r.added6, 'guard-p1,guard-p2,guard-p3,guard-p2,guard-p4,guard-p3');
    t.eq('右鍵號碼拿掉那一次', r.removed6, 'guard-p1,guard-p2,guard-p3,guard-p4');
    t.eq('Shift＋點號碼：標記、編輯列提示插在它前面', JSON.stringify(r.mark), JSON.stringify([2, true]));
    t.check('號碼 hover：第幾個＋Shift／右鍵提示', r.markTip.startsWith('第 2 個：guard-p2') && r.markTip.includes('Shift＋點＝標記'), r.markTip);
    t.eq('標記後連點：依序插在標記前、標記跟著走', JSON.stringify(r.markAdd), JSON.stringify(['guard-p1,guard-p2,guard-p4,guard-p1,guard-p3,guard-p2,guard-p4', 4]));
    t.eq('右鍵刪標記前面的：標記號碼 −1', JSON.stringify(r.markDelBefore), JSON.stringify(['guard-p2,guard-p4,guard-p1,guard-p3,guard-p2,guard-p4', 3]));
    t.eq('右鍵刪標記那顆：取消標記', JSON.stringify(r.markDelSelf), JSON.stringify(['guard-p2,guard-p4,guard-p1,guard-p2,guard-p4', null]));
    t.eq('Shift＋點同一顆＝取消標記', r.markToggle, null);
    t.eq('Shift＋點別顆＝標記換過去', r.markMove, 4);
    t.eq('Esc 先取消標記、還在編輯路線', JSON.stringify(r.markEsc), JSON.stringify([null, true]));
    t.eq('取消標記後點點照舊加到最後', r.markGone, 'guard-p1,guard-p2,guard-p3,guard-p2,guard-p4,guard-p3');
    t.eq('別張圖的點不能加',JSON.stringify(r.otherMap), JSON.stringify([5, '巡邏路線只能用 m/m_04x05 的點']));
    t.eq('Esc 結束編輯', JSON.stringify(r.editOff), JSON.stringify([null, '✎ 編輯路線']));
});
