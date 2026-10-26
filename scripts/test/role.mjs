// 角色編輯器（tools/role）：用 window.__re 直接呼叫，OPFS 當假的專案根目錄（public/assets、xls、src）
import {run} from './harness.mjs'

run('role', async t => {
    await t.page.goto(new URL('tools/role/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__re && Object.keys(window.__re.S.ext.items).length);

    const r = await t.page.evaluate(async () => {
        const re = window.__re, S = re.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const answer = async (v) => {
            for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);
            if (!$('dlgAsk').open) return null;
            const text = $('dlgAsk').textContent;
            $('dlgAsk').close(v);
            return text;
        };
        const save = async (...answers) => {
            let done = false;
            const p = re.save().finally(() => {done = true;}), seen = [];
            while (!done)
            {
                if ($('dlgAsk').open) {seen.push($('dlgAsk').textContent); $('dlgAsk').close(answers.shift() ?? 'cancel');}
                await sleep(20);
            }
            await p;
            return seen;
        };

        const orig = await (await fetch('/assets/json/role.json')).text();
        const xlsx = await (await fetch('/xls/role.xlsx')).blob();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json');
        const disk = async () => (await (await json.getFileHandle('role.json')).getFile()).text();
        await write(json, 'role.json', orig);
        await write(await dir(proj, 'public', 'assets', 'm'), 'test.json', JSON.stringify({objs: [{name: 'karen'}, {name: 'karen_2'}]}));
        await write(await dir(proj, 'xls'), 'role.xlsx', xlsx);
        await write(await dir(proj, 'xls', 'lang'), 'en.xlsx', xlsx);
        await write(await dir(proj, 'src'), 'x.js', 'const a = 1;\nconst who = "karen";\n');
        await write(await dir(proj, 'src', 'old'), 'y.js', 'karen');

        await re.setAssets(proj);
        await re.IC.ready;
        out.warns = re.validateAll();
        out.load = [Object.keys(S.data).length === Object.keys(JSON.parse(orig)).length, !!S.assets.root, S.assets.dir.name];
        await save('save');
        out.roundtrip = (await disk()) === orig;

        // 物品欄：字串留字串、數量不是 1 才變物件；物件留物件
        const items = () => S.data.trump.inv.storage.items;
        const sel = (id) => {S.sel = id; S.view = 'form'; re.render();};
        sel('trump');
        const cellInputs = () => [...document.querySelectorAll('#view .cell input')];
        const fire = (el, v) => {el.value = v; el.dispatchEvent(new Event('change'));};
        fire(cellInputs()[0], 'sword_02');
        out.invRename = JSON.stringify(items()[0]);
        fire(document.querySelector('#view .cell input.cnt'), '3');
        out.invCount = JSON.stringify(items()[0]);
        fire(cellInputs()[2], 'gloves_01');
        out.invObj = JSON.stringify(items()[1]);
        fire(document.querySelector('#view .cells input.add'), 'apple');
        out.invAdd = items().at(-1);
        const n0 = items().length;
        document.querySelector('#view .cell button').click();
        out.invDel = [items().length === n0 - 1, JSON.stringify(items()[0])];
        for (let i = 0; i < 5; i++) re.undo();
        out.invUndo = JSON.stringify(items()) === JSON.stringify(JSON.parse(orig).trump.inv.storage.items);
        re.set('trump', ['inv', 'storage', 'items', 0], 'nope');
        out.invBad = [re.validate('trump').some(w => w.includes('nope')), !!document.querySelector('#view .cell.bad')];
        re.undo();

        // 作息
        const sch = () => S.data.karen.schedule;
        sel('karen');
        out.style = re.validate('karen').some(w => w.includes('weak'));
        out.schCards = document.querySelectorAll('#view .card').length === sch().length;
        re.addSch('karen');
        out.schAdd = [sch().length, JSON.stringify(sch().at(-1)), re.validate('karen').filter(w => w.startsWith('作息')).length];
        re.set('karen', ['schedule', 5, 'go'], 'nowhere');
        re.set('karen', ['schedule', 5, 't'], '8:00');
        out.schBad = re.validate('karen').filter(w => w.startsWith('作息 6')).length;
        re.set('karen', ['schedule', 5, 'do'], 'patrol');
        out.patrol = [re.validate('karen').some(w => w.includes('巡邏沒有 route')), !!document.querySelector('#view .card:last-child input[data-tags]')];
        re.undo(); re.undo(); re.undo(); re.undo();
        out.schUndo = sch().length;
        const mode = document.querySelector('#view .card select');
        mode.value = ''; mode.dispatchEvent(new Event('change'));
        out.schMode = sch()[0].t;
        re.undo();
        out.navMaps = !!document.getElementById('dl-nav-m/m_04x05')?.options.length;

        // 預覽
        await sleep(300);
        out.preview = +document.querySelector('.pv canvas').dataset.drawn;
        sel('guard-1');
        await sleep(300);
        out.previewEquip = +document.querySelector('.pv canvas').dataset.drawn;

        // 改名：掃 assets、xls（不含 xls/lang）、src（不含 src/old）
        let p = re.rename('karen', 'karen2');
        const dlg = await answer('cancel'); await p;
        out.dlgText = dlg;
        out.renameDlg = [dlg.includes('m/test.json'), dlg.includes('xls/role.xlsx'), dlg.includes('xls/lang'), dlg.includes('src/x.js：2 行'), dlg.includes('src/old'), (dlg.match(/karen_2/g) ?? []).length];
        p = re.rename('karen', 'karen2');
        await answer('ok'); await p;
        const ks = Object.keys(S.data);
        out.rename = [ks.indexOf('karen2') === Object.keys(JSON.parse(orig)).indexOf('karen'), 'karen' in S.data, S.sel];
        re.undo();

        p = re.remove('dummy');
        await answer('ok'); await p;
        out.remove = 'dummy' in S.data;
        re.undo();

        re.add('npc_new', 'npc');
        const k2 = Object.keys(S.data);
        out.add = [k2.indexOf('npc_new') === k2.indexOf('guard-2') + 1, S.data.npc_new.kind, S.sel, Array.isArray(S.data.npc_new.schedule), re.validate('npc_new').length];
        re.add('wolf2', 'animal');
        out.addAnimal = [S.data.wolf2.animal, S.data.wolf2.w];
        re.add('bad id', 'npc');
        out.badId = 'bad id' in S.data;

        // 清單分組、總覽表
        out.groups = [...document.querySelectorAll('#list .group')].map(g => g.textContent.replace(/^[▾▸]/, ''));
        S.view = 'table'; S.tab = 2; re.render();
        out.table = [document.querySelectorAll('#view tbody tr').length, Object.values(S.data).filter(x => x.kind === 'npc').length];
        S.loc = 'nowhere'; re.render();
        out.tableLoc = [document.querySelectorAll('#view tbody tr').length, !!document.querySelector('#view .tabs select')];
        S.loc = ''; S.tab = 5; re.render();
        out.tableAnimal = [...document.querySelectorAll('#view thead th')].map(th => th.textContent).join('|');
        S.view = 'form'; S.sel = 'wick'; re.render();
        out.dom = [document.body.innerText.includes('[object'), [...document.querySelector('#view .form').childNodes].some(n => n.nodeType === Node.TEXT_NODE),
                   document.querySelectorAll('#list .item').length === Object.keys(S.data).length];

        // 存檔：有警告仍可存、外部修改合併
        const seen = await save('save');
        out.saved = [seen.length, JSON.parse(await disk()).npc_new?.kind, $('dirty').hidden];
        const ext = JSON.parse(await disk());
        ext.wick.body.y = 30;
        await write(json, 'role.json', JSON.stringify(ext, null, 2));
        re.set('trump', ['gold'], 300);
        await save('merge', 'save');
        const after = JSON.parse(await disk());
        out.merge = [after.wick.body.y, after.trump.gold];
        return out;
    });

    if (r.warns.length) console.log(`  （現有資料的警告 ${r.warns.length} 個：${r.warns.join('；')}）`);
    t.eq('讀入全部角色', r.load[0], true);
    t.check('選專案根目錄：找到 public/assets', r.load[1] && r.load[2] === 'assets');
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('字串道具改 id 還是字串', r.invRename, '"sword_02"');
    t.eq('字串道具數量改成 3 變物件', r.invCount, JSON.stringify({id: 'sword_02', count: 3}));
    t.eq('物件道具改 id 還是物件', r.invObj, JSON.stringify({id: 'gloves_01', count: 1}));
    t.eq('加道具是字串', r.invAdd, 'apple');
    t.check('移除道具', r.invDel[0]);
    t.check('物品欄 undo 回原樣', r.invUndo);
    t.check('不存在的道具有警告、格子標紅', r.invBad[0] && r.invBad[1]);
    t.check('性格 weak 不在 wTBL 有警告', r.style);
    t.check('每筆作息一張卡片', r.schCards);
    t.eq('新增作息接在最後、沿用上一筆的地圖', r.schAdd[0], 6);
    t.check('新增的作息沒有警告', r.schAdd[2] === 0, `${r.schAdd[1]}`);
    t.eq('目的地不在路網、時間格式錯都有警告', r.schBad, 2);
    t.check('巡邏沒 route 有警告、出現路線欄', r.patrol[0] && r.patrol[1]);
    t.eq('作息 undo', r.schUndo, 5);
    t.eq('切成出發時間', r.schMode, '08:00');
    t.check('路網選項依地圖分', r.navMaps);
    t.check('預覽畫出身體', r.preview >= 1, `${r.preview}`);
    t.check('預覽畫出裝備', r.previewEquip > 2, `${r.previewEquip}`);
    t.check('改名列出 assets 裡的引用', r.renameDlg[0], r.dlgText);
    t.check('改名列出 xlsx 儲存格', r.renameDlg[1]);
    t.eq('不列 xls/lang', r.renameDlg[2], false);
    t.check('改名列出 src 的行號', r.renameDlg[3]);
    t.eq('不列 src/old', r.renameDlg[4], false);
    t.eq('karen_2 不算引用', r.renameDlg[5], 0);
    t.eq('改名留在原位、舊 id 消失、選到新 id', JSON.stringify(r.rename), JSON.stringify([true, false, 'karen2']));
    t.eq('刪除', r.remove, false);
    t.check('新角色排在同分類最後', r.add[0]);
    t.eq('新角色的分類', r.add[1], 'npc');
    t.eq('新角色選取', r.add[2], 'npc_new');
    t.check('npc 範本有作息', r.add[3]);
    t.eq('範本沒有警告', r.add[4], 0);
    t.eq('動物範本', JSON.stringify(r.addAnimal), JSON.stringify([true, 64]));
    t.eq('不合法 id 不新增', r.badId, false);
    t.check('清單依分類、NPC 再依地點分組', r.groups.some(g => g.startsWith('NPC・brooklyn')) && r.groups.some(g => g.startsWith('玩家')) && r.groups.some(g => g.startsWith('無分類')), r.groups.join(' '));
    t.eq('總覽 NPC 頁', r.table[0], r.table[1]);
    t.check('地點篩選', r.tableLoc[0] === 0 && r.tableLoc[1]);
    t.check('總覽動物頁的欄位', r.tableAnimal.includes('掉落肉') && r.tableAnimal.includes('hpMax'), r.tableAnimal);
    t.eq('畫面沒有 [object …]', r.dom[0], false);
    t.eq('表單沒有多出來的文字（例如 0）', r.dom[1], false);
    t.check('清單每個角色一列', r.dom[2]);
    t.check('存檔（有警告就問）', r.saved[0] === 1 && r.saved[1] === 'npc' && r.saved[2], JSON.stringify(r.saved));
    t.eq('合併保留外部的修改', r.merge[0], 30);
    t.eq('合併保留這邊的修改', r.merge[1], 300);
});
