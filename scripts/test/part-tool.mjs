// 部位分頁（tools/part/）：縮圖牆、檢查、詳細、改名／改 kind／換圖／新增／複製／刪除，跟角色分頁未存修改的合併、↗ 到試穿；node scripts/test/part-tool.mjs
import {run} from './harness.mjs'

// 頁面裡用：OPFS 做假專案（真的 role/part/item/anim.json，part.json 多幾筆測試用的），回傳 {proj, assets, json, read}
const SETUP = async () => {
    const opfs = await navigator.storage.getDirectory();
    for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
    const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
    const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
    const proj = await dir(opfs, 'game'), assets = await dir(proj, 'public', 'assets'), json = await dir(assets, 'json');
    for (const f of ['role.json', 'item.json', 'anim.json']) await write(json, f, await (await fetch(`/assets/json/${f}`)).text());
    const parts = await (await fetch('/assets/json/part.json')).json();
    Object.assign(parts, {
        'hair-unused': {kind: 'hair', sprite: 'hair-01', scale: 0.25, f: {scale: 0.2, x: 1, y: 2}},
        'bad-sprite': {kind: 'hair', sprite: 'no-such-texture'},
        'weird': {kind: 'tail', sprite: 'hair-01'},
        'hand-man': {...parts['hand-man'], kind: 'handF'},
        'hand-b': {kind: 'handB', sprite: 'hand-man', scale: 0.25},
    });
    await write(json, 'part.json', JSON.stringify(parts, null, 2));
    const roles = JSON.parse(await (await fetch('/assets/json/role.json')).text());
    roles.tester = {kind: 'npc', body: 'body-man', hair: 'head-karen'};
    await write(json, 'role.json', JSON.stringify(roles, null, 2));
    const read = async (f) => JSON.parse(await (await (await json.getFileHandle(f)).getFile()).text());
    return {proj, assets, json, read};
};

run('part-tool', async t => {
    await t.page.goto(new URL('tools/part/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__pt);

    const r = await t.page.evaluate(async (SETUP) => {
        const pt = window.__pt, S = pt.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        // 依序回答 #dlgAsk：fn(dlg) 回傳要按的值（可以順便填輸入框）；記下每個對話框的標題
        const run = async (p, ...fns) => {
            const seen = [];
            let stop = false;
            (async () => {
                while (!stop)
                {
                    if ($('dlgAsk').open && !$('dlgIcon').open) {seen.push($('dlgAsk').querySelector('.title').textContent); $('dlgAsk').close(await (fns.shift() ?? (() => 'cancel'))($('dlgAsk')));}
                    await sleep(20);
                }
            })();
            await p;
            stop = true;
            return seen;
        };
        const pickIcon = async (v) => {await until(() => $('dlgIcon').open); $('dlgIcon').querySelector('input').value = v; $('dlgIcon').close('ok'); await sleep(30);};

        const {assets, read} = await eval(`(${SETUP})`)();
        await pt.setRoot(assets);
        await pt.IC.ready;
        pt.setTab('all');

        // 縮圖牆：照 kind 分段（六種＋不認識的）、使用次數、未使用標灰、壞的標紅
        out.secs = [...document.querySelectorAll('#view .sec')].map(s => s.firstChild.textContent);
        const cell = (id) => document.querySelector(`#view .cell[data-id="${id}"]`);
        out.cells = [cell('body-man').querySelector('.n')?.textContent > '0', cell('hair-unused').classList.contains('unused'),
                     cell('bad-sprite').classList.contains('bad'), cell('weird').classList.contains('bad'), cell('head-karen').classList.contains('bad'),
                     cell('hair-mary').classList.contains('bad')];
        out.probs = [pt.problems('bad-sprite')[0]?.startsWith('sprite：'), pt.problems('weird')[0]?.startsWith('kind「tail」'), pt.problems('head-karen').join()];

        // 篩選、搜尋
        const filter = (f) => document.querySelector(`#filters [data-filter="${f}"]`).click();
        filter('bad');
        out.bad = [...document.querySelectorAll('#view .cell')].map(c => c.dataset.id).sort().join();
        filter('unused');
        out.unused = [...document.querySelectorAll('#view .cell')].map(c => c.dataset.id).includes('hair-unused')
                     && ![...document.querySelectorAll('#view .cell')].map(c => c.dataset.id).includes('body-man');
        filter('all');
        $('search').value = 'mary'; $('search').dispatchEvent(new Event('input'));
        out.search = [...document.querySelectorAll('#view .cell')].map(c => c.dataset.id).sort().join();
        $('search').value = ''; $('search').dispatchEvent(new Event('input'));

        // 總覽上方分頁切部位：一次只列一個部位、不畫分段標題、記住；篩選後數量跟著變、目前分頁空了也留著
        const tabBtns = () => [...document.querySelectorAll('#view .tabs button')].map(b => b.textContent);
        const tab = (k) => document.querySelector(`#view .tabs [data-tab="${k}"]`).click();
        const cellIds = () => [...document.querySelectorAll('#view .cell')].map(c => c.dataset.id);
        out.tabs = tabBtns()[0].startsWith('全部（') && tabBtns().length === 9;
        tab('hair');
        out.tabHair = [cellIds().every(id => S.parts[id].kind === 'hair'), cellIds().includes('hair-wick'), document.querySelectorAll('#view .sec').length,
                       localStorage.getItem('tools.part.tab'), document.querySelector('#view .tabs .on').dataset.tab];
        filter('bad');
        out.tabBad = [cellIds().join(), tabBtns().join()];
        $('search').value = 'zzz'; $('search').dispatchEvent(new Event('input'));
        out.tabEmpty = [document.querySelector('#view .tabs .on')?.dataset.tab, cellIds().length, tabBtns().join()];
        $('search').value = ''; $('search').dispatchEvent(new Event('input'));
        filter('all');
        tab('all');

        // 左樹：照 kind 分組、左欄可拖寬度；沒選時右欄空著
        const heads = () => [...document.querySelectorAll('#list .group')];
        const head = (k) => heads().find(g => g.textContent.includes(`　${k}（`));
        const rows = () => [...document.querySelectorAll('#list .item')].map(i => i.dataset.id);
        out.tree = [heads().map(g => g.textContent.slice(1).replace(/（\d+）$/, '')).join(), !!document.querySelector('.left-grip'), $('right').childElementCount];
        out.midGrip = [document.querySelector('.mid-grip').style.display];
        // 點總覽卡片：選到它、展開那組、列標 sel，中間換詳細
        cell('hair-wick').click();
        await sleep(300);
        out.midGrip.push(document.querySelector('.mid-grip').style.display);
        out.pickCell = [S.sel, head('hair').querySelector('.arrow').textContent, document.querySelector('#list .item.sel')?.dataset.id, !document.querySelector('#view .cell')];
        const row = (id) => document.querySelector(`#list .item[data-id="${id}"]`);
        out.rowMarks = [row('hair-unused').classList.contains('unused'), !!row('bad-sprite').querySelector('.warn'), row('hair-wick').querySelector('.n').textContent];

        // 詳細：中間原圖＋唯讀欄位＋使用者、右欄人偶合成、到試穿（沒有紙娃娃型角色在用就停用）
        const btn = (txt) => [...document.querySelectorAll('#view button')].find(b => b.textContent === txt);
        out.detail = [document.querySelectorAll('#right .pv canvas').length, +document.querySelector('#right .pv canvas').dataset.drawn,
                      [...document.querySelectorAll('#view .users li')].map(li => li.firstChild.textContent).join(), btn('↗ 到試穿調').disabled];
        // 合成切男女：套 body-woman，沒有 f 標「用基準」，有 f 標「用女版 f」；記住
        const sex = (sx) => document.querySelector(`#right .sexsw [data-sex="${sx}"]`).click();
        const cap = () => document.querySelector('#right .cap').textContent;
        sex('f');
        await sleep(300);
        out.female = [cap(), +document.querySelector('#right .pv canvas').dataset.drawn, localStorage.getItem('tools.part.sex'),
                      document.querySelector('#right .sexsw .on').dataset.sex];
        row('hair-unused').click();
        await sleep(300);
        out.femaleF = [cap(), btn('↗ 到試穿調').disabled, [...document.querySelectorAll('#view td.k')].map(td => td.textContent).join()];

        // 擺放數字：女改 f、男改基準、清空刪 key，立刻寫檔；undo／redo（按鈕、Ctrl+Z）也立刻寫；刪除女版
        const fire = async (k, v) => {const el = document.querySelector(`[data-k="${k}"]`); el.value = v; el.dispatchEvent(new Event('change')); await pt.idle();};
        const hu = async () => (await read('part.json'))['hair-unused'];        out.nums = [[...document.querySelectorAll('#view table.nums th')].map(th => th.textContent).join()];
        await fire('part.json|hair-unused|f.x', '7');
        out.nums.push(JSON.stringify((await hu()).f));
        sex('m');
        await sleep(300);
        await fire('part.json|hair-unused|x', '3');
        out.nums.push((await hu()).x);
        await fire('part.json|hair-unused|x', '');
        out.nums.push('x' in await hu(), $('btnUndo').disabled, $('btnRedo').disabled);
        $('btnUndo').click(); await sleep(50); await pt.idle();
        out.nums.push((await hu()).x);
        dispatchEvent(new KeyboardEvent('keydown', {key: 'z', ctrlKey: true}));
        await sleep(50); await pt.idle();
        out.nums.push('x' in await hu(), (await hu()).f.x);
        dispatchEvent(new KeyboardEvent('keydown', {key: 'y', ctrlKey: true}));
        await sleep(50); await pt.idle();
        out.nums.push((await hu()).x, $('btnRedo').disabled);
        sex('f');
        await sleep(300);
        btn('刪除女版').click();
        await sleep(50); await pt.idle();
        out.nums.push('f' in await hu(), document.querySelector('#view .sexnote').textContent.startsWith('沒有 f'));
        sex('m');
        await sleep(300);

        // 右欄合成：不是身體的條目沒有可拖的東西
        const drag = async (fn) => {
            const cv = document.querySelector('#right .pv canvas'), st = cv.st, g = st.geo, rc = cv.getBoundingClientRect();
            const at = (x, y) => ({clientX: rc.left + (g.vc.x + (g.flip ? -x : x)) * g.K, clientY: rc.top + (g.vc.y + y) * g.K, pointerId: 1, bubbles: true});
            const ptr = (type, q) => cv.dispatchEvent(new PointerEvent(type, q));
            await fn({cv, st, g, at, ptr});
            await sleep(50); await pt.idle(); await sleep(200);
        };
        out.noDrag = [document.querySelector('#right .pv canvas').st.geo, !document.querySelector('#right .pv canvas').onpointerdown];

        // 身體：支點表（三列、改數字寫 body 條目）、右欄十字拖位置／白點轉 a、undo；女也寫基準（不建 f）
        S.sel = 'body-man'; pt.render(); await sleep(300);
        const bm = async () => (await read('part.json'))['body-man'];
        const bm0 = await bm(), hb = S.hi;
        out.body = [document.querySelectorAll('#view table.pivots tr').length - 1, [...document.querySelectorAll('#view td.k')].some(td => td.textContent === 'wristF' && td.closest('table:not(.pivots)'))];
        const wf = (await bm()).wristF ?? {x: 0, y: 0};
        await fire('part.json|body-man|wristF.x', String((wf.x ?? 0) + 1));
        out.body.push((await bm()).wristF.x === (wf.x ?? 0) + 1, (await bm()).wristF.y === (wf.y ?? 0));
        await drag(async ({cv, st, g, at, ptr}) => {
            const p = g.pts.wristB;
            ptr('pointermove', at(p.x, p.y));
            out.body.push(JSON.stringify(st.live), cv.style.cursor);
            ptr('pointerdown', at(p.x, p.y)); ptr('pointermove', at(p.x + 2, p.y + 3)); ptr('pointerup', at(p.x + 2, p.y + 3));
        });
        const wb0 = bm0.wristB ?? {x: 0, y: 0};
        out.body.push((await bm()).wristB.x === (wb0.x ?? 0) + 2 && (await bm()).wristB.y === (wb0.y ?? 0) + 3);
        await drag(async ({g, at, ptr}) => {
            const c = g.pts.neck, hd = {x: c.x + Math.sin((c.a ?? 0) * Math.PI / 180) * 16, y: c.y - Math.cos((c.a ?? 0) * Math.PI / 180) * 16};
            const a = Math.atan2(hd.y - c.y, hd.x - c.x) + Math.PI / 2, r = 16;
            ptr('pointerdown', at(hd.x, hd.y)); ptr('pointermove', at(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r)); ptr('pointerup', at(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r));
        });
        out.body.push(Math.round((await bm()).neck.a - (bm0.neck?.a ?? 0)), S.hi - hb);
        await pt.undo(); await pt.undo(); await pt.undo(); await sleep(200);
        out.body.push(JSON.stringify(await bm()) === JSON.stringify(bm0));
        // 身體沒有男女：就算記住的是女，也沒有切換、數字欄不標 f、改了寫基準
        S.sex = 'f'; pt.render(); await sleep(300);
        out.body.push(!document.querySelector('#right .sexsw'), [...document.querySelectorAll('#view table.nums:not(.pivots) th')].map(th => th.textContent).join(), $('right').querySelector('.cap').textContent);
        await fire('part.json|body-man|y', String((bm0.y ?? 0) + 1));
        out.body.push(!(await bm()).f, (await bm()).y === (bm0.y ?? 0) + 1);
        await pt.undo(); await sleep(200);
        out.body.push(JSON.stringify(await bm()) === JSON.stringify(bm0));
        S.sex = 'm'; pt.render(); await sleep(300);
        S.sel = 'hair-unused'; pt.render();
        out.male = [cap(), document.querySelectorAll('#right .pv canvas').length, localStorage.getItem('tools.part.sex')];
        // ×6：男女在最下面，選項列跟男女留在右欄裡（畫布那層自己捲）
        const zoom = document.querySelector('#right .pv select');
        zoom.value = '6'; zoom.dispatchEvent(new Event('change'));
        await sleep(300);
        const box = $('right').getBoundingClientRect(), inside = (sel) => {const b = document.querySelector(sel).getBoundingClientRect(); return b.top >= box.top && b.bottom <= box.bottom + 1;};
        const cvbox = document.querySelector('#right .cvbox');
        out.zoom6 = [$('right').lastElementChild.classList.contains('sexsw'), inside('#right .opts'), inside('#right .sexsw'),
                     cvbox.scrollHeight > cvbox.clientHeight || cvbox.scrollWidth > cvbox.clientWidth, $('right').scrollTop];
        zoom.value = '3'; zoom.dispatchEvent(new Event('change'));

        // 合成底色：純色、記住；棋盤格恢復
        const px = (cv) => [...cv.getContext('2d').getImageData(1, 1, 1, 1).data.slice(0, 3)].join();
        const color = document.querySelector('#right input.bg');
        color.value = '#ff0000'; color.dispatchEvent(new Event('input')); color.dispatchEvent(new Event('change'));
        await sleep(200);
        out.bg = [px(document.querySelector('#right .pv canvas')), localStorage.getItem('tools.preview.bg')];
        document.querySelector('#right .bgchk').click();
        await sleep(200);
        out.bgReset = [px(document.querySelector('#right .pv canvas')) !== '255,0,0', localStorage.getItem('tools.preview.bg')];

        // 再點一次選到的列：取消選取、回總覽；摺起選到的那組也取消選取
        row('hair-unused').click();
        out.unpick = [S.sel, !!document.querySelector('#view .cell'), $('right').childElementCount];
        row('hair-wick').click();
        head('hair').click();
        out.foldUnpick = [S.sel, head('hair').querySelector('.arrow').textContent, rows().includes('hair-wick')];
        pt.S.sel = 'hair-unused'; pt.render();

        // 改 kind：有人在用擋住；沒人用的改掉
        out.kindUsed = await run(pt.changeKind('hair-wick'), () => 'ok');
        out.kind = await run(pt.changeKind('hair-unused'), d => {d.querySelector('select').value = 'head'; return 'ok';});
        out.kindDisk = (await read('part.json'))['hair-unused'].kind;

        // 換圖
        const p1 = pt.changeSprite('hair-unused');
        await pickIcon('hair-karen');
        await p1;
        out.sprite = (await read('part.json'))['hair-unused'].sprite;

        // 新增：選圖帶出 id、數字抄同 kind 第一筆、排在同 kind 最後
        const p2 = run(pt.askEntry(), async d => {
            d.querySelector('select').value = 'hair';
            d.querySelector('.iconField button').click();
            await pickIcon('hair-01');
            out.autoId = d.querySelector('input').value;
            return 'ok';
        });
        out.add = await p2;
        let parts = await read('part.json'), keys = Object.keys(parts);
        const firstHair = Object.values(parts).find(x => x.kind === 'hair');
        const lastHair = keys.filter(k => parts[k].kind === 'hair' && k !== 'hair-01').at(-1);
        out.added = [JSON.stringify(parts['hair-01']), JSON.stringify({kind: 'hair', sprite: 'hair-01', ...(firstHair.scale !== undefined && {scale: firstHair.scale}), ...(firstHair.x !== undefined && {x: firstHair.x}), ...(firstHair.y !== undefined && {y: firstHair.y})}),
                     keys.indexOf('hair-01') === keys.indexOf(lastHair) + 1, S.sel];

        // 複製：預設 id <src>-2、整筆照抄、排在 src 後面
        out.copy = await run(pt.askEntry('hair-mary'), () => 'ok');
        parts = await read('part.json'); keys = Object.keys(parts);
        out.copied = [JSON.stringify(parts['hair-mary-2']) === JSON.stringify(parts['hair-mary']), keys.indexOf('hair-mary-2') === keys.indexOf('hair-mary') + 1];
        out.badId = await run(pt.askEntry('hair-mary'), d => {d.querySelector('input').value = 'a b'; return 'ok';});
        out.badIdStatus = $('status').textContent;

        // 改名：part.json 位置不變、role.json 直接寫
        const before = Object.keys(await read('part.json')).indexOf('hair-wick');
        out.rename = await run(pt.renamePart('hair-wick'), d => {d.querySelector('input').value = 'hair-john'; return 'ok';}, () => 'ok');
        parts = await read('part.json');
        out.renamed = [Object.keys(parts).indexOf('hair-john') === before, 'hair-wick' in parts, (await read('role.json')).wick.hair, S.sel];

        // 刪除：有人在用擋住、沒人用的刪掉
        out.delUsed = await run(pt.deletePart('hair-mary'), () => 'ok');
        out.del = await run(pt.deletePart('hair-mary-2'), () => 'ok');
        out.deleted = ['hair-mary' in await read('part.json'), 'hair-mary-2' in await read('part.json'), S.sel];
        return out;
    }, SETUP.toString());

    t.eq('分段照 kind，不認識的另一段', JSON.stringify(r.secs), JSON.stringify(['身體　body', '鞋子　shoes', '衣服　cloth', '頭　head', '頭髮　hair', '前手　handF', '後手　handB', '不認識的 kind']));
    t.eq('卡片：使用次數、未使用灰、壞的紅（圖不存在、kind 不認識、放錯欄位）', JSON.stringify(r.cells), JSON.stringify([true, true, true, true, true, false]));
    t.eq('檢查訊息', JSON.stringify(r.probs), JSON.stringify([true, true, 'tester 的 hair 指到它，但它是 head']));
    t.eq('篩選壞的', r.bad, 'bad-sprite,head-karen,weird');
    t.check('篩選未使用', r.unused);
    t.eq('搜尋 id／sprite', r.search, 'hair-mary,head-mary');
    t.check('總覽分頁：全部＋七個部位＋不認識的', r.tabs);
    t.eq('分頁頭髮：只列頭髮、沒有分段標題、記住', JSON.stringify(r.tabHair), JSON.stringify([true, true, 0, 'hair', 'hair']));
    t.eq('分頁＋篩選壞的：只剩有壞的部位分頁', JSON.stringify(r.tabBad), JSON.stringify(['bad-sprite', ['全部（3）', '頭（1）', '頭髮（1）', '不認識的 kind（1）'].join()]));
    t.eq('篩選後空了的分頁', JSON.stringify(r.tabEmpty), JSON.stringify(['hair', 0, '全部（0）,頭髮（0）']));
    t.eq('中間欄把手：沒選（右欄空）藏、選了出現', JSON.stringify(r.midGrip), JSON.stringify(['none', '']));
    t.eq('左樹：照 kind 分組、左欄可拖、沒選右欄空', JSON.stringify(r.tree), JSON.stringify([['身體　body', '鞋子　shoes', '衣服　cloth', '頭　head', '頭髮　hair', '前手　handF', '後手　handB', '不認識的 kind'].join(), true, 0]));
    t.eq('點總覽卡片：選取、展開那組、列標 sel、中間換詳細', JSON.stringify(r.pickCell), JSON.stringify(['hair-wick', '▾', 'hair-wick', true]));
    t.eq('樹的列：沒人用變灰、壞的 ⚠、使用次數', JSON.stringify(r.rowMarks), JSON.stringify([true, true, '1']));
    t.eq('詳細：右欄套在人偶上（身體＋部位）、使用者、可到試穿', JSON.stringify(r.detail), JSON.stringify([1, 2, 'wick', false]));
    t.eq('合成切女：套 body-woman、沒有 f 用基準、記住', JSON.stringify(r.female), JSON.stringify(['套在 body-woman（沒有 f，用基準數字）', 2, 'f', 'f']));
    t.eq('換一筆保留女：有 f 用女版、到試穿停用、擺放以外唯讀列出', JSON.stringify(r.femaleF), JSON.stringify(['套在 body-woman，用女版 f', true, 'sprite']));
    t.eq('擺放數字：女改 f、男改基準、清空刪 key、undo／Ctrl+Z／Ctrl+Y 立刻寫、刪除女版', JSON.stringify(r.nums),
        JSON.stringify(['scale（f）,x（f）,y（f）,a,ox,oy', '{"scale":0.2,"x":7,"y":2}', 3, false, false, true, 3, false, 7, 3, false, false, true]));
    t.eq('右欄合成：不是身體的條目不能拖', JSON.stringify(r.noDrag), JSON.stringify([null, true]));
    t.eq('身體支點：三列、不在唯讀欄、改數字補 y、拖十字（hover、游標）、白點轉 90、三筆 undo 復原；身體沒有男女切換、不標 f、寫基準、undo',
        JSON.stringify(r.body), JSON.stringify([3, false, true, true, '{"rot":false,"k":"wristB"}', 'move', true, 90, 3, true,
            true, 'scale,x,y,a,ox,oy', '身體 body-man', true, true, true]));
    t.eq('切回男：一張合成', JSON.stringify(r.male), JSON.stringify(['套在 body-man', 1, 'm']));
    t.eq('×6：男女在最下面、選項列跟男女留在右欄、只有畫布捲', JSON.stringify(r.zoom6), JSON.stringify([true, true, true, true, 0]));
    t.eq('合成底色：純色、記住',JSON.stringify(r.bg), JSON.stringify(['255,0,0', '#ff0000']));
    t.eq('合成底色：棋盤格恢復、清掉記憶', JSON.stringify(r.bgReset), JSON.stringify([true, null]));
    t.eq('再點一次取消選取、回總覽、右欄空', JSON.stringify(r.unpick), JSON.stringify([null, true, 0]));
    t.eq('摺起選到的那組：取消選取', JSON.stringify(r.foldUnpick), JSON.stringify([null, '▸', false]));
    t.eq('改 kind：有人用擋住、沒人用的改掉', JSON.stringify([r.kindUsed, r.kind, r.kindDisk]), JSON.stringify([['不能改 hair-wick 的 kind'], ['改 hair-unused 的 kind'], 'head']));
    t.eq('換圖', r.sprite, 'hair-karen');
    t.eq('新增：選圖帶出 id', r.autoId, 'hair-01');
    t.eq('新增：數字抄同 kind 第一筆、排在同 kind 最後、選到它', JSON.stringify([r.added[0] === r.added[1], r.added[2], r.added[3]]), JSON.stringify([true, true, 'hair-01']));
    t.eq('複製：整筆照抄、排在原本後面', JSON.stringify(r.copied), JSON.stringify([true, true]));
    t.eq('不合法 id 擋住', r.badIdStatus, 'id 只能用英數字、底線、減號');
    t.eq('改名問兩次', JSON.stringify(r.rename), JSON.stringify(['改名 hair-wick', '改名 hair-wick → hair-john']));
    t.eq('改名：位置不變、role.json 跟著改、選到新 id', JSON.stringify(r.renamed), JSON.stringify([true, false, 'hair-john', 'hair-john']));
    t.eq('刪除：有人用擋住、沒人用的刪掉', JSON.stringify([r.delUsed, r.del, r.deleted]), JSON.stringify([['不能刪 hair-mary'], ['刪除 hair-mary-2'], [true, false, null]]));

    // 殼：角色分頁有未存修改時，部位分頁改名 → 角色分頁記憶體跟著改、存檔合併保留兩邊；↗ 到試穿
    await t.page.goto(new URL('/tools/#role', t.page.url()).href);
    await t.page.waitForFunction(() => window.__tools && document.querySelector('iframe')?.contentWindow.__re);
    const s = await t.page.evaluate(async (SETUP) => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        const answer = async (tab, p, ...vals) => {
            const dlg = win(tab).document.getElementById('dlgAsk');
            let done = false;
            p.then(() => {done = true;});
            while (!done) {if (dlg.open) {const v = vals.shift(); dlg.close(typeof v === 'function' ? v(dlg) : v ?? 'save');} await sleep(20);}
            return p;
        };
        const {proj, read} = await eval(`(${SETUP})`)();
        await T.setProject(proj);
        const re = await until(() => win('role')?.__re?.S.data.wick && win('role').__re);
        re.set('wick', ['lab'], '改過');
        T.show('fit');
        const fit = await until(() => win('fit')?.__fit?.S.json && win('fit').__fit);
        fit.commit(() => {fit.S.doc['part.json'].data['hair-wick'].x = 7;});
        T.show('part');
        const pt = await until(() => win('part')?.__pt?.S.parts['hair-wick'] && win('part').__pt);
        await answer('part', pt.renamePart('hair-wick'), d => {d.querySelector('input').value = 'hair-john'; return 'ok';}, 'ok');
        out.mem = await until(() => re.S.data.wick.hair === 'hair-john') && [re.S.data.wick.hair, re.S.data.wick.lab];
        out.fitMem = await until(() => fit.S.doc['part.json'].data['hair-john'] && fit.S.doc['role.json'].data.wick.hair === 'hair-john') && [fit.S.doc['part.json'].data['hair-john'].x, 'hair-wick' in fit.S.doc['part.json'].data, fit.S.doc['role.json'].data.wick.hair];
        await answer('role', re.save(), 'merge');
        const roles = await read('role.json');
        out.disk = [roles.wick.hair, roles.wick.lab];
        await answer('fit', fit.save(), 'merge', 'merge');
        const parts = await read('part.json');
        out.fitDisk = [parts['hair-john']?.x, 'hair-wick' in parts];

        // ↗ 到試穿：切到試穿分頁、選第一個紙娃娃型使用者、游標在那個部位的數字欄
        pt.S.sel = 'hair-john'; pt.render();
        [...win('part').document.querySelectorAll('#view button')].find(b => b.textContent === '↗ 到試穿調').click();
        out.goto = await until(() => T.S.tab === 'fit' && fit.S.rid === 'wick') && [T.S.tab, fit.S.rid, win('fit').document.activeElement?.dataset?.k?.startsWith('part.json|hair-john|')];
        return out;
    }, SETUP.toString());

    t.eq('角色分頁未存：記憶體跟著改名、自己的修改還在', JSON.stringify(s.mem), JSON.stringify(['hair-john', '改過']));
    t.eq('試穿分頁未存：part.json 換 key 保留數字、role 引用跟著改', JSON.stringify(s.fitMem), JSON.stringify([7, false, 'hair-john']));
    t.eq('角色分頁存檔合併：新 id、自己的修改都在', JSON.stringify(s.disk), JSON.stringify(['hair-john', '改過']));
    t.eq('試穿分頁存檔合併：沒有復活舊 id', JSON.stringify(s.fitDisk), JSON.stringify([7, false]));
    t.eq('↗ 到試穿：切分頁、選角色、游標在部位數字欄', JSON.stringify(s.goto), JSON.stringify(['fit', 'wick', true]));
});
