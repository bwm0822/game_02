// 能力編輯器（tools/ability）：透過 window.__ab 直接呼叫，OPFS 當假的專案資料夾（public/assets/json）
import {run} from './harness.mjs'

run('ability', async t => {
    // 畫布在中間欄，太窄的話節點會捲到看不到，elementFromPoint 找不到
    await t.page.setViewport({width: 1600, height: 900});
    await t.page.goto(new URL('tools/ability/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__ab);

    const r = await t.page.evaluate(async () => {
        const ab = window.__ab, S = ab.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        // 跑 fn，跳出的對話框依序回答；answer 是字串（按鈕值）或 (dialog) => 按鈕值（先填輸入框）
        const flow = async (fn, ...answers) => {
            let done = false;
            const p = Promise.resolve(fn()).finally(() => {done = true;}), seen = [];
            while (!done)
            {
                if ($('dlgAsk').open)
                {
                    seen.push($('dlgAsk').textContent);
                    const a = answers.shift() ?? 'cancel';
                    $('dlgAsk').close(typeof a === 'function' ? a($('dlgAsk')) : a);
                }
                await sleep(20);
            }
            await p;
            return seen;
        };
        const save = (...answers) => flow(() => ab.save(), ...answers);

        const FILES = ['ability.json', 'ab_tree.json', 'local.json', 'role.json'];
        const orig = {};
        for (const f of FILES) orig[f] = await (await fetch(`/assets/json/${f}`)).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        const disk = async (f) => (await (await json.getFileHandle(f)).getFile()).text();
        for (const f of FILES) await write(json, f, orig[f]);
        await write(await dir(proj, 'public', 'assets', 'maps'), 'x.json', JSON.stringify({objs: [{props: {ability: 'fireball'}}, {name: 'fireball_2'}]}));
        await write(await dir(proj, 'src'), 'x.js', 'const a = 1;\nconst ab = "fireball";\n');
        await write(await dir(proj, 'src', 'old'), 'y.js', 'fireball');

        await ab.setAssets(proj);
        await ab.IC.ready;
        out.load = [Object.keys(S.doc['ability.json'].data).length, Object.keys(S.doc['ab_tree.json'].data).length, !!S.assets.root];
        out.warns = ab.validateAll();
        out.firstTree = S.tree;
        out.listTrees = document.querySelectorAll('#list .item[data-tree]').length;
        out.listText = [...$('list').childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent);

        // 畫布：Fire 樹的節點跟連線（fireballvolley←fireball、combustion←volley+firewall、meteorshower←combustion，加上 3 條子節點上方短線）
        ab.selectTree('Fire');
        out.nodes = document.querySelectorAll('#view .node').length;
        out.links = document.querySelectorAll('#view svg.links polyline.link').length;
        const fb = document.querySelector('#view .node[data-id="fireball"]');
        out.nodePos = [fb.style.left, fb.style.top];
        fb.click();
        out.sel = [S.sel, S.tree];
        out.formHead = document.querySelector('#pv .bigid')?.textContent;
        out.refsRow = document.querySelector('#pv .refs')?.textContent;
        ab.select('fireballvolley');
        out.refsRow2 = document.querySelector('#pv .refs')?.textContent;
        // 表單沒列到的 key（travel/fx）進其他欄位
        ab.select('fireball');
        out.other = [...document.querySelectorAll('#pv .box .bar')].find(b => b.textContent.includes('其他欄位'))?.querySelector('.dim').textContent;

        // 改欄位：只有 ability.json 變、key 位置不動
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        fire(document.querySelector('#pv [data-k="cd"]'), '4');
        out.cd = S.doc['ability.json'].data.fireball.cd;
        out.keyOrder = Object.keys(S.doc['ability.json'].data.fireball).join() === Object.keys(JSON.parse(orig['ability.json']).fireball).join();
        out.dirtyMark = !!document.querySelector('#list .item[data-tree="Fire"] .dirty');
        // 清空 → 刪 key
        fire(document.querySelector('#pv [data-k="range"]'), '');
        out.cleared = 'range' in S.doc['ability.json'].data.fireball;
        ab.undo();
        out.undo = S.doc['ability.json'].data.fireball.range;

        // 樹名寫進 local.json
        fire(document.querySelector('#view [data-k="tree.Fire.lab"]'), '火焰');
        out.treeLab = JSON.parse(JSON.stringify(S.doc['local.json'].data.Fire));
        // 清空樹名：key 整個拿掉、出現警告
        fire(document.querySelector('#view [data-k="tree.Fire.lab"]'), '');
        out.treeLabGone = 'Fire' in S.doc['local.json'].data;
        out.treeLabWarn = ab.validateTree('Fire').some(w => w.includes('沒有名稱'));
        ab.undo();
        out.treeLabUndo = S.doc['local.json'].data.Fire.lab;

        // 存檔：有改的檔才寫，沒改的 ab_tree.json 原封不動
        await save();
        out.saved = [JSON.parse(await disk('ability.json')).fireball.cd, JSON.parse(await disk('local.json')).Fire.lab, (await disk('ab_tree.json')) === orig['ab_tree.json']];
        out.clean = !$('dirty').hidden;

        // 外部修改合併：外面改了 heal，這裡改 fireball
        const ext = JSON.parse(await disk('ability.json'));
        ext.heal.cd = 99;
        await write(json, 'ability.json', JSON.stringify(ext, null, 2));
        ab.set('fireball', ['cd'], 5);
        let seen = await save('merge');
        const m = JSON.parse(await disk('ability.json'));
        out.merge = [seen.length, m.heal.cd, m.fireball.cd];

        // 樹的檢查：疊格、不存在的技能、同一技能在兩棵樹
        ab.commit(() => {const tr = S.doc['ab_tree.json'].data; tr.Fire.push({id: 'nope', x: 0, y: 0}); tr.Ice.push({id: 'fireball', x: 9, y: 9});});
        out.treeWarns = ab.validateTree('Fire');
        out.orphanWarn = ab.validate('heal').length;
        ab.undo();

        // 不在樹上的技能列在左欄最後
        ab.commit(() => {const tr = S.doc['ab_tree.json'].data; tr.Support = tr.Support.filter(n => n.id !== 'heal');});
        out.orphan = [...document.querySelectorAll('#list .item[data-id]')].map(e => e.dataset.id);
        out.orphanAbWarn = ab.validate('heal').includes('不在任何一棵樹上');
        ab.undo();

        // 搜尋
        $('search').value = '火'; $('search').dispatchEvent(new Event('input'));
        out.search = [...document.querySelectorAll('#list .item[data-id]')].map(e => e.dataset.id);
        $('search').value = ''; $('search').dispatchEvent(new Event('input'));

        // ---------- 畫布編輯 ----------
        const {CELL} = ab;
        const node = (id) => document.querySelector(`#view .node[data-id="${id}"]`);
        const fireAt = (el, type, x, y) => el.dispatchEvent(new PointerEvent(type, {clientX: x, clientY: y, button: 0, pointerId: 1, bubbles: true}));
        const mid = (el) => {const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2];};
        const drag = (id, dx, dy) => {const el = node(id), [x, y] = mid(el); fireAt(el, 'pointerdown', x, y); fireAt(el, 'pointermove', x + dx, y + dy); fireAt(el, 'pointerup', x + dx, y + dy);};
        const tnode = (t, id) => S.doc['ab_tree.json'].data[t].find(n => n.id === id);
        const refs = (id) => S.doc['ability.json'].data[id].refs;
        ab.selectTree('Fire');

        // 拖節點：吸附到格子、key 順序不變
        drag('fireballvolley', 3, CELL + 10);
        out.drag = [tnode('Fire', 'fireballvolley').x, tnode('Fire', 'fireballvolley').y, Object.keys(tnode('Fire', 'fireballvolley')).join(), S.sel];
        // 小於 4px 不算拖
        const h0 = S.hi;
        drag('fireballvolley', 2, 1);
        out.tiny = S.hi === h0;
        // 拖到有人的格子：不動
        drag('fireballvolley', 2 * CELL, -3 * CELL);
        out.occupied = [tnode('Fire', 'fireballvolley').x, tnode('Fire', 'fireballvolley').y, $('status').textContent];
        // 拖到負的座標：夾在 0
        drag('meteorshower', -5 * CELL, 0);
        out.clamp = tnode('Fire', 'meteorshower').x;
        ab.undo(); ab.undo();
        out.dragUndo = [tnode('Fire', 'fireballvolley').y, tnode('Fire', 'meteorshower').x];

        // 拉線：firewall 的把手拉到 meteorshower → meteorshower 多一個前置
        const handle = node('firewall').querySelector('.handle');
        const [hx, hy] = mid(handle), [mx, my] = mid(node('meteorshower'));
        fireAt(handle, 'pointerdown', hx, hy);
        fireAt(handle, 'pointermove', mx, my);
        out.temp = !!document.querySelector('#view polyline.temp');
        fireAt(handle, 'pointerup', mx, my);
        out.addRef = [JSON.stringify(refs('meteorshower')), !!document.querySelector('#view polyline.temp'), S.link && `${S.link.ref}>${S.link.child}`];
        out.linkSel = !!document.querySelector('#view g[data-link="firewall>meteorshower"] polyline.link.sel');
        // 重複拉不會加第二次
        ab.addRef('meteorshower', 'firewall');
        out.dupRef = refs('meteorshower').length;
        // 拉到空白：不改
        const n0 = S.hi;
        fireAt(handle, 'pointerdown', hx, hy); fireAt(handle, 'pointerup', 5, 5);
        out.dropNowhere = S.hi === n0;
        // 點線選取、Del 刪掉
        S.link = null; ab.render();
        document.querySelector('#view g[data-link="firewall>meteorshower"] polyline.hit').dispatchEvent(new MouseEvent('click', {bubbles: true}));
        out.clickLink = S.link && `${S.link.ref}>${S.link.child}`;
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Delete', bubbles: true}));
        out.delRef = [JSON.stringify(refs('meteorshower')), S.link];
        // 刪掉最後一個前置：refs 整個拿掉、短線也不畫
        ab.removeRef('fireballvolley', 'fireball');
        out.delLast = ['refs' in S.doc['ability.json'].data.fireballvolley, document.querySelectorAll('#view svg.links polyline.link').length];
        ab.undo(); ab.undo(); ab.undo();
        out.refUndo = [JSON.stringify(refs('meteorshower')), JSON.stringify(refs('fireballvolley'))];

        // 前置不在上面：警告、線標紅
        ab.moveNode('meteorshower', 3, 2);
        out.badLink = [ab.validate('meteorshower').some(w => w.includes('沒有在上面')), !!document.querySelector('#view g[data-link="combustion>meteorshower"] polyline.link.bad')];
        ab.undo();
        out.badLinkUndo = ab.validate('meteorshower').length;
        // 繞圈、跨樹
        ab.addRef('fireball', 'meteorshower');
        out.cycle = ab.validate('fireball').some(w => w.includes('繞成一圈'));
        ab.undo();
        ab.addRef('fireball', 'icebolt');
        out.cross = ab.validate('fireball').some(w => w.includes('在別棵樹（Ice）'));
        ab.undo();
        out.final = ab.validateAll().length;

        // ---------- hits／effects 卡片、說明預覽 ----------
        const A = () => S.doc['ability.json'].data;
        ab.select('fireball');
        S.open.hits = S.open.effects = true; ab.render();
        out.cards = [...document.querySelectorAll('#pv .card .sum')].map(e => e.textContent);
        fire(document.querySelector('#pv [data-k="hits.0.pow"]'), '2');
        out.hitPow = A().fireball.hits[0].pow;
        ab.addCard('fireball', 'hits');
        out.addHit = [A().fireball.hits.length, JSON.stringify(A().fireball.hits[1]), document.querySelectorAll('#pv .card').length];
        // 卡片不認識的 key 在額外欄位
        ab.commit(() => {A().fireball.hits[1].zz = 1;});
        out.hitRaw = !!document.querySelector('#pv details[open] [data-k="hits.1.#raw"], #pv details[open] .je');
        ab.delCard('fireball', 'hits', 1);
        ab.delCard('fireball', 'hits', 0);
        out.delHits = 'hits' in A().fireball;
        ab.undo(); ab.undo(); ab.undo(); ab.undo(); ab.undo();
        out.hitsUndo = JSON.stringify(A().fireball.hits) === JSON.stringify(JSON.parse(orig['ability.json']).fireball.hits);
        // 加欄位選 effects：直接加一張卡
        ab.select('heal');
        const addSel = [...document.querySelectorAll('#pv select')].find(s => [...s.options].some(o => o.value === 'effects'));
        addSel.value = 'effects'; addSel.dispatchEvent(new Event('change'));
        out.addEff = JSON.stringify(A().heal.effects);
        ab.undo();

        // 說明預覽：{#fmt} 顯示公式、{#elm} 顯示元素名、{#formula} 自成一行
        ab.select('fireball');
        out.preview = document.querySelector('#pv .despv')?.textContent;
        out.chips = document.querySelectorAll('#pv .despv .chip').length;
        // token 錯誤：超出 hits、沒有的欄位、沒有 w/h、一般欄位帶索引
        fire(document.querySelector('#pv [data-k="des"]'), '{#fmt1}{#foo}{#wh}{#range2}{#range}');
        out.tokWarns = ab.validate('fireball').filter(w => w.startsWith('說明的'));
        out.tokBad = document.querySelectorAll('#pv .despv .tokbad').length;
        ab.undo();
        out.final2 = ab.validateAll().length;

        // ---------- 技能改名／複製／新增／移出放回／刪除 ----------
        const T = () => S.doc['ab_tree.json'].data, R = () => S.doc['role.json'].data;
        const rid = Object.keys(R()).find(k => R()[k].abilities?.includes('fireball'));
        const idx0 = Object.keys(A()).indexOf('fireball');
        seen = await flow(() => ab.rename('fireball', 'fire_ball'), 'ok');
        out.renDlg = [seen[0]?.includes('ability.json：fireballvolley.refs'), seen[0]?.includes('ab_tree.json：Fire'), seen[0]?.includes(`role.json：${rid}.abilities`),
                      seen[0]?.includes('maps/x.json'), seen[0]?.includes('src/x.js'), seen[0]?.includes('src/old'), seen[0]?.includes('fireball_2'), seen[0]?.includes('json/role.json')];
        out.ren = [Object.keys(A()).indexOf('fire_ball') === idx0, 'fireball' in A(), JSON.stringify(A().fireballvolley.refs), !!T().Fire.find(n => n.id === 'fire_ball'),
                   R()[rid].abilities.includes('fire_ball'), S.sel];
        out.renBad = await flow(() => ab.rename('fire_ball', 'heal'), 'ok');
        ab.undo();
        out.renUndo = ['fireball' in A(), R()[rid].abilities.includes('fireball')];

        ab.dup('firewall');
        out.dup = [Object.keys(A())[Object.keys(A()).indexOf('firewall') + 1], JSON.stringify(T().Fire.find(n => n.id === 'firewall_copy')), S.sel];
        ab.undo();

        // 空格右鍵 → 新增技能（排在這棵樹最後一個技能後面）
        ab.selectTree('Fire');
        const tree = document.querySelector('#view .tree'), tb = tree.getBoundingClientRect();
        const ctx = (el, x, y) => el.dispatchEvent(new MouseEvent('contextmenu', {clientX: x, clientY: y, bubbles: true, cancelable: true}));
        ctx(tree, tb.left + ab.M + 3 * CELL + 5, tb.top + ab.M + 2 * CELL + 5);
        out.cellMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent);
        seen = await flow(() => document.querySelector('.ctxmenu button').click(), (d) => {
            const [id, lab] = d.querySelectorAll('input'); id.value = 'flame'; lab.value = '火焰'; return 'ok';
        });
        out.menuGone = !document.querySelector('.ctxmenu');
        out.added = [JSON.stringify(A().flame), Object.keys(A()).indexOf('flame') === Object.keys(A()).indexOf('meteorshower') + 1,
                     JSON.stringify(T().Fire.at(-1)), S.sel];
        // 移出樹 → 不在樹上 → 空格右鍵放回去
        ab.unplace('flame');
        out.unplaced = [!T().Fire.some(n => n.id === 'flame'), 'flame' in A()];
        ctx(tree.isConnected ? tree : document.querySelector('#view .tree'), tb.left + ab.M + 4 * CELL + 5, tb.top + ab.M + 5);
        const put = [...document.querySelectorAll('.ctxmenu button')].find(b => b.textContent.startsWith('放上 flame'));
        out.placeItem = put?.textContent;
        put?.click();
        out.placed = JSON.stringify(T().Fire.find(n => n.id === 'flame'));
        // 節點右鍵選單
        ctx(document.querySelector('#view .node[data-id="flame"]'), 0, 0);
        out.nodeMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => b.textContent).join();
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        out.escMenu = !document.querySelector('.ctxmenu');
        ab.undo(); ab.undo(); ab.undo();
        out.addUndo = 'flame' in A();

        // 刪除：別人的前置、樹節點、角色 abilities 一起拿掉
        seen = await flow(() => ab.remove('fireball'), 'ok');
        out.del = ['fireball' in A(), 'refs' in A().fireballvolley, T().Fire.some(n => n.id === 'fireball'), R()[rid].abilities.includes('fireball'), seen[0]?.includes('src/x.js')];
        ab.undo();

        // ---------- 樹 ----------
        ab.addTree('Holy', '神聖');
        out.addTree = [Object.keys(T()).at(-1), JSON.stringify(T().Holy), S.doc['local.json'].data.Holy?.lab, S.tree];
        out.addTreeBad = (ab.addTree('Fire'), Object.keys(T()).length);
        seen = await flow(() => ab.renameTree('Holy', 'Light'), 'ok');
        out.renTree = [Object.keys(T()).at(-1), S.doc['local.json'].data.Light?.lab, 'Holy' in S.doc['local.json'].data, S.tree];
        ab.moveTree('Light', -1);
        out.moveTree = Object.keys(T()).slice(-2).join();
        ab.moveTree('General', -1);
        out.moveTop = Object.keys(T())[0];
        seen = await flow(() => ab.removeTree('Fire'), 'ok');
        out.delTree = ['Fire' in T(), 'Fire' in S.doc['local.json'].data, 'fireball' in A(), ab.validate('fireball').includes('不在任何一棵樹上'), seen[0]?.includes('5 個技能')];
        // 樹列右鍵選單
        ctx(document.querySelector('#list .item[data-tree="General"]'), 10, 10);
        out.treeMenu = [...document.querySelectorAll('.ctxmenu button')].map(b => `${b.textContent}${b.disabled ? '(x)' : ''}`).join();
        document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        for (let i = 0; i < 4; i++) ab.undo();
        out.treeUndo = [Object.keys(T()).join(), 'Holy' in S.doc['local.json'].data];

        // 存檔：role.json 也寫
        await flow(() => ab.rename('heal', 'heal2'), 'ok');
        const rid2 = Object.keys(R()).find(k => R()[k].abilities?.includes('heal2'));
        await save('save');
        out.saveRole = rid2 && JSON.parse(await disk('role.json'))[rid2].abilities.includes('heal2');
        return out;
    });

    t.eq('讀入技能數', r.load[0], 32);
    t.eq('讀入樹數', r.load[1], 8);
    t.check('給專案根目錄', r.load[2]);
    t.eq('現有資料沒有警告', r.warns.length, 0);
    if (r.warns.length) console.log('    ' + r.warns.join('\n    '));
    t.eq('預設選第一棵樹', r.firstTree, 'General');
    t.eq('左欄列出 8 棵樹', r.listTrees, 8);
    t.eq('左欄沒有多餘文字（沒有不在樹上的技能時不印 0）', JSON.stringify(r.listText), '[]');
    t.eq('Fire 樹 5 個節點', r.nodes, 5);
    t.eq('Fire 樹連線 4＋短線 3', r.links, 7);
    t.eq('節點位置照格子', r.nodePos.join(), '8px,8px');
    t.eq('點節點選技能', r.sel.join(), 'fireball,Fire');
    t.eq('表單標題', r.formHead, 'fireball');
    t.eq('沒有前置顯示 —', r.refsRow, '—');
    t.eq('前置唯讀顯示', r.refsRow2, 'fireball');
    t.check('travel/fx 進其他欄位', r.other?.startsWith('（2）'), r.other);
    t.eq('改 cd', r.cd, 4);
    t.check('改值不動 key 順序', r.keyOrder);
    t.check('樹列出現未存點', r.dirtyMark);
    t.eq('清空刪 key', r.cleared, false);
    t.eq('undo', r.undo, 5);
    t.eq('樹名寫進 local.json', JSON.stringify(r.treeLab), JSON.stringify({lab: '火焰'}));
    t.eq('清空樹名拿掉整個 key', r.treeLabGone, false);
    t.check('沒有樹名有警告', r.treeLabWarn);
    t.eq('樹名 undo', r.treeLabUndo, '火焰');
    t.eq('存檔寫 ability.json', r.saved[0], 4);
    t.eq('存檔寫 local.json', r.saved[1], '火焰');
    t.check('沒改的檔不動', r.saved[2]);
    t.check('存完不是未存狀態', !r.clean);
    t.eq('外部修改問一次', r.merge[0], 1);
    t.eq('合併保留外部修改', r.merge[1], 99);
    t.eq('合併保留這裡的修改', r.merge[2], 5);
    t.check('疊格警告', r.treeWarns.some(w => w.includes('疊在同一格')), r.treeWarns.join('；'));
    t.check('不存在的技能警告', r.treeWarns.some(w => w.includes('nope 不在 ability.json')));
    t.check('兩棵樹警告', r.treeWarns.some(w => w.includes('fireball 也在 Ice')));
    t.eq('heal 沒警告', r.orphanWarn, 0);
    t.eq('不在樹上的技能列在左欄', r.orphan.join(), 'heal');
    t.check('不在樹上有警告', r.orphanAbWarn);
    t.check('搜尋名稱', r.search.includes('fireball') && r.search.includes('firewall') && !r.search.includes('heal'), r.search.join());

    t.eq('拖節點吸附格子', r.drag.join(), '0,3,id,x,y,fireballvolley');
    t.check('小於 4px 不算拖', r.tiny);
    t.check('拖到有人的格子不動', r.occupied[0] === 0 && r.occupied[1] === 3 && r.occupied[2].includes('已經有'), r.occupied.join());
    t.eq('拖到負座標夾在 0', r.clamp, 0);
    t.eq('拖節點 undo', r.dragUndo.join(), '2,1');
    t.check('拉線時有虛線', r.temp);
    t.eq('拉線加前置', r.addRef[0], '["combustion","firewall"]');
    t.check('放開後虛線消失', !r.addRef[1]);
    t.eq('新線被選中', r.addRef[2], 'firewall>meteorshower');
    t.check('選中的線標色', r.linkSel);
    t.eq('重複拉不加', r.dupRef, 2);
    t.check('拉到空白不改', r.dropNowhere);
    t.eq('點線選取', r.clickLink, 'firewall>meteorshower');
    t.eq('Del 刪前置', JSON.stringify(r.delRef), JSON.stringify(['["combustion"]', null]));
    t.eq('刪最後一個前置拿掉 refs', r.delLast[0], false);
    t.eq('沒有 refs 就不畫短線', r.delLast[1], 5);
    t.eq('前置 undo', r.refUndo.join(' '), '["combustion"] ["fireball"]');
    t.check('前置不在上面：警告＋紅線', r.badLink[0] && r.badLink[1], JSON.stringify(r.badLink));
    t.eq('移回去沒警告', r.badLinkUndo, 0);
    t.check('繞圈警告', r.cycle);
    t.check('跨樹警告', r.cross);
    t.eq('最後沒有警告', r.final, 0);

    t.eq('卡片摘要', r.cards.join(' | '), '火 10+1.5×int | 命中時・對目標・持續傷害 🔥burn 火 -5・3 回合・最多 3 層');
    t.eq('卡片改欄位', r.hitPow, 2);
    t.eq('新增傷害卡', r.addHit.slice(0, 2).join(' '), '2 {"elm":"phy","pow":1}');
    t.eq('新增後卡片數', r.addHit[2], 3);
    t.check('卡片不認識的 key 進額外欄位', r.hitRaw);
    t.eq('刪光卡片拿掉 key', r.delHits, false);
    t.check('卡片 undo', r.hitsUndo);
    t.eq('加欄位 effects 直接加卡', r.addEff, '[{"type":"mod"}]');
    t.check('預覽 fmt 顯示公式', r.preview?.includes('10+1.5×'), r.preview);
    t.check('預覽 formula 換行', r.preview?.includes('\n'), r.preview);
    t.eq('預覽色塊數', r.chips, 2);
    t.eq('token 錯誤 4 個', r.tokWarns.length, 4);
    if (r.tokWarns.length !== 4) console.log('    ' + r.tokWarns.join('\n    '));
    t.eq('預覽標紅 4 個', r.tokBad, 4);
    t.eq('改回來沒警告', r.final2, 0);

    t.eq('改名對話框列出一起改的（refs／樹／角色）', r.renDlg.slice(0, 3).join(), 'true,true,true');
    t.eq('改名對話框列出外部引用（maps、src）', r.renDlg.slice(3, 5).join(), 'true,true');
    t.eq('不列 src/old、fireball_2、role.json', r.renDlg.slice(5).join(), 'false,false,false');
    t.eq('改名保留位置、舊 id 消失', r.ren.slice(0, 2).join(), 'true,false');
    t.eq('改名連動 refs', r.ren[2], '["fire_ball"]');
    t.check('改名連動樹節點', r.ren[3]);
    t.check('改名連動 role.json abilities', r.ren[4]);
    t.eq('改名後選新 id', r.ren[5], 'fire_ball');
    t.eq('改成已有的 id 不跳對話框', r.renBad.length, 0);
    t.eq('改名 undo', r.renUndo.join(), 'true,true');
    t.eq('複製排在後面、樹上放右邊空格', r.dup.join(' '), 'firewall_copy {"id":"firewall_copy","x":3,"y":0} firewall_copy');
    t.check('空格右鍵有新增', r.cellMenu[0]?.startsWith('新增技能…（3,2）'), r.cellMenu.join());
    t.check('選完選單關掉', r.menuGone);
    t.eq('新增技能內容', r.added[0], '{"icon":"❓","mode":"active","lab":"火焰","des":""}');
    t.check('新增排在這棵樹最後一個後面', r.added[1]);
    t.eq('新增放在右鍵的格子', r.added[2], '{"id":"flame","x":3,"y":2}');
    t.eq('新增後選取', r.added[3], 'flame');
    t.eq('移出樹保留技能', r.unplaced.join(), 'true,true');
    t.check('空格選單有放上不在樹上的', r.placeItem?.startsWith('放上 flame'), r.placeItem);
    t.eq('放回樹上', r.placed, '{"id":"flame","x":4,"y":0}');
    t.eq('節點右鍵選單', r.nodeMenu, '改名…,複製,移出這棵樹,刪除…');
    t.check('Esc 關選單', r.escMenu);
    t.eq('新增 undo', r.addUndo, false);
    t.eq('刪除連帶清 refs／樹／角色', r.del.slice(0, 4).join(), 'false,false,false,false');
    t.check('刪除對話框列外部引用', r.del[4]);
    t.eq('新增樹', r.addTree.join(' '), 'Holy [] 神聖 Holy');
    t.eq('樹 id 重複不加', r.addTreeBad, 9);
    t.eq('樹改名連 local.json', r.renTree.join(), 'Light,神聖,false,Light');
    t.eq('樹上移', r.moveTree, 'Light,Enhancement');
    t.eq('第一棵不能再上移', r.moveTop, 'General');
    t.eq('刪除樹：技能留著變不在樹上', r.delTree.join(), 'false,false,true,true,true');
    t.eq('樹列右鍵選單', r.treeMenu, '改名…,上移(x),下移,新增樹…,刪除…');
    t.check('樹 undo', r.treeUndo[0] === 'General,Sword,Archery,Fire,Ice,Poison,Support,Enhancement' && !r.treeUndo[1], r.treeUndo.join(' '));
    t.check('存檔寫 role.json', r.saveRole);
});
