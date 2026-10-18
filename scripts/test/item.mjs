// 道具編輯器（tools/item）：用 window.__ie 直接呼叫，OPFS 當假的 public/assets（無頭 Chrome 開不了資料夾選擇視窗）
import {run} from './harness.mjs'

run('item', async t => {
    await t.page.goto(new URL('tools/item/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__ie);

    const r = await t.page.evaluate(async () => {
        const ie = window.__ie, S = ie.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        // 等對話框打開、記下標題和內容後用 value 關掉
        const answer = async (v) => {
            for (let i = 0; i < 100 && !$('dlgAsk').open; i++) await sleep(20);
            if (!$('dlgAsk').open) return null;
            const text = $('dlgAsk').textContent;
            $('dlgAsk').close(v);
            return text;
        };
        // 存檔：中途跳出的對話框依序回答，多出來的一律取消
        const save = async (...answers) => {
            let done = false;
            const p = ie.save().finally(() => {done = true;}), seen = [];
            while (!done)
            {
                if ($('dlgAsk').open) {seen.push($('dlgAsk').textContent); $('dlgAsk').close(answers.shift() ?? 'cancel');}
                await sleep(20);
            }
            await p;
            return seen;
        };

        const orig = await (await fetch('/assets/json/item.json')).text();
        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, {recursive: true});
        const assets = await root.getDirectoryHandle('assets', {create: true});
        const json = await assets.getDirectoryHandle('json', {create: true});
        const m = await assets.getDirectoryHandle('m', {create: true});
        const write = async (dir, name, text) => {const w = await (await dir.getFileHandle(name, {create: true})).createWritable(); await w.write(text); await w.close();};
        const disk = async () => (await (await json.getFileHandle('item.json')).getFile()).text();
        await write(json, 'item.json', orig);
        await write(m, 'test.json', JSON.stringify({objs: [{loot: 'raw_fish'}, {loot: 'raw_fish_2'}]}));

        await ie.setAssets(assets);
        await ie.IC.ready;
        out.warns = ie.validateAll();
        out.load = [Object.keys(S.items).length === Object.keys(JSON.parse(orig)).length, $('assetsName').textContent];
        out.canonical = orig === JSON.stringify(JSON.parse(orig), null, 2);

        await save('save');
        out.roundtrip = (await disk()) === orig;

        const keys0 = Object.keys(S.items.sword_01);
        ie.set('sword_01', ['atk'], 99);
        out.edit = [S.items.sword_01.atk, Object.keys(S.items.sword_01).join() === keys0.join()];
        ie.set('sword_01', ['def'], 5);
        out.append = Object.keys(S.items.sword_01).at(-1);
        ie.set('sword_01', ['def'], undefined);
        out.clear = 'def' in S.items.sword_01;
        ie.set('sword_01', ['equip', 'x'], 4);
        out.keepUnknown = [JSON.stringify(S.items.sword_01.equip.swing), S.items.sword_01.equip.x];
        ie.set('raw_meat', ['cook', 'id'], undefined);
        out.cleanup = 'cook' in S.items.raw_meat;
        ie.undo();
        out.undoCook = S.items.raw_meat.cook?.id;
        ie.undo(); ie.undo(); ie.undo(); ie.undo();
        out.undoAll = [S.items.sword_01.atk, 'x' in S.items.sword_01.equip];
        ie.redo();
        out.redo = S.items.sword_01.atk;
        ie.undo();

        ie.addEff('sword_03');
        out.addEff = S.items.sword_03.effects?.length;
        ie.delEff('sword_03', 0);
        out.delEff = 'effects' in S.items.sword_03;

        const bb = JSON.stringify(S.items.tree.bb);
        ie.set('tree', ['lab'], '樹');
        out.raw = JSON.stringify(S.items.tree.bb) === bb;
        ie.undo();

        const idx = Object.keys(S.items).indexOf('raw_fish');
        let p = ie.rename('raw_fish', 'fish_raw');
        const dlg = await answer('ok'); await p;
        out.rename = [Object.keys(S.items).indexOf('fish_raw') === idx, 'raw_fish' in S.items, Object.keys(S.items.salt_baked_fish.make.items).join(), S.sel];
        out.renameDlg = [dlg.includes('salt_baked_fish.make.items'), dlg.includes('m/test.json'), (dlg.match(/raw_fish_2/g) ?? []).length];

        p = ie.remove('salt');
        const del = await answer('cancel'); await p;
        out.removeCancel = ['salt' in S.items, del.includes('salt_baked_fish.make.items')];
        p = ie.remove('mushtree');
        await answer('ok'); await p;
        out.remove = 'mushtree' in S.items;

        ie.add('new_sword', 'CAT_WEAPON');
        const ks = Object.keys(S.items);
        out.add = [ks.indexOf('new_sword') === ks.indexOf('axe_01') + 1, S.items.new_sword.cat, S.sel];
        ie.add('bad id', 'CAT_WEAPON');
        out.badId = 'bad id' in S.items;
        ie.dup('sword_01');
        const ks2 = Object.keys(S.items);
        out.dup = [ks2.indexOf('sword_01_copy') === ks2.indexOf('sword_01') + 1, JSON.stringify(S.items.sword_01_copy) === JSON.stringify(S.items.sword_01)];

        ie.set('sword_02', ['gold'], 'abc');
        out.warn = ie.validate('sword_02').some(w => w.includes('不是數字'));
        out.badRef = (ie.set('raw_meat', ['cook', 'id'], 'nope'), ie.validate('raw_meat').some(w => w.includes('不存在')));
        const seen = await save('save');
        out.saveWarn = [seen[0]?.includes('個問題'), JSON.parse(await disk()).sword_02.gold, $('dirty').hidden];

        const ext = JSON.parse(await disk());
        ext.helmet_01.equip.x = 7;
        await write(json, 'item.json', JSON.stringify(ext, null, 2));
        ie.set('sword_02', ['gold'], 25);
        ie.set('raw_meat', ['cook', 'id'], 'cooked_meat');
        const seen2 = await save('merge', 'save');
        const after = JSON.parse(await disk());
        out.merge = [seen2[0]?.includes('helmet_01'), after.helmet_01.equip.x, after.sword_02.gold, S.items.helmet_01.equip.x];

        await ie.IC.ready;
        out.icons = [ie.IC.SHEETS.weapons?.fw, ie.IC.check('🔑'), !!ie.IC.check('nope'), !!ie.IC.check('weapons:99999'), ie.IC.check('cloth-hood'), ie.IC.check('weapons:3')];

        S.view = 'table'; S.tab = 1; ie.render();
        out.table = [document.querySelectorAll('#view tbody tr').length, Object.values(S.items).filter(it => it.cat === 'CAT_WEAPON').length];
        S.view = 'form'; ie.render();
        out.form = !!document.querySelector('#view .fields');
        S.sel = 'sword_03'; ie.render();
        out.dom = [document.body.innerText.includes('[object'), document.querySelectorAll('#list .item').length === Object.keys(S.items).length,
                   [...document.querySelector('#view').childNodes].some(n => n.nodeType === Node.TEXT_NODE)];
        return out;
    });

    if (r.warns.length) console.log(`  （現有資料的警告 ${r.warns.length} 個：${r.warns.join('；')}）`);
    t.eq('讀入全部道具', r.load[0], true);
    t.eq('表頭顯示資料夾名', r.load[1], 'assets');
    t.check('item.json 是 JSON.stringify(…, null, 2) 格式', r.canonical);
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('改欄位', r.edit[0], 99);
    t.check('改欄位不動 key 順序', r.edit[1]);
    t.eq('新欄位接在最後', r.append, 'def');
    t.eq('清空欄位會刪 key', r.clear, false);
    t.eq('改 equip.x 不動 swing', r.keepUnknown[0], JSON.stringify({aim: -45, grip: {x: 3, y: 28}}));
    t.eq('清空 cook.id 連 cook 一起刪', r.cleanup, false);
    t.eq('undo 一步', r.undoCook, 'cooked_meat');
    t.eq('undo 到底', JSON.stringify(r.undoAll), JSON.stringify([15, false]));
    t.eq('redo', r.redo, 99);
    t.eq('新增效果', r.addEff, 1);
    t.eq('刪光效果連 effects 一起刪', r.delEff, false);
    t.check('不認識的 bb 原封不動', r.raw);
    t.eq('改名留在原位、舊 id 消失', JSON.stringify(r.rename.slice(0, 2)), JSON.stringify([true, false]));
    t.eq('改名一起改 make.items', r.rename[2], 'fish_raw,salt');
    t.eq('改名後選到新 id', r.rename[3], 'fish_raw');
    t.check('改名對話框列出 item.json 裡的引用', r.renameDlg[0]);
    t.check('改名對話框列出其他檔案', r.renameDlg[1]);
    t.eq('raw_fish_2 不算引用', r.renameDlg[2], 0);
    t.eq('刪除取消', r.removeCancel[0], true);
    t.check('刪除對話框列出引用', r.removeCancel[1]);
    t.eq('刪除', r.remove, false);
    t.check('新道具排在同分類最後', r.add[0]);
    t.eq('新道具的分類', r.add[1], 'CAT_WEAPON');
    t.eq('新道具選取', r.add[2], 'new_sword');
    t.eq('不合法 id 不新增', r.badId, false);
    t.check('複製排在原道具後面、內容一樣', r.dup[0] && r.dup[1]);
    t.check('數字欄位填文字有警告', r.warn);
    t.check('指到不存在的道具有警告', r.badRef);
    t.check('存檔前跳出問題清單', r.saveWarn[0]);
    t.eq('只警告、仍然可以存', r.saveWarn[1], 'abc');
    t.eq('存完不再標未存檔', r.saveWarn[2], true);
    t.check('外部改過會提示是哪個道具', r.merge[0]);
    t.eq('合併保留外部的修改', r.merge[1], 7);
    t.eq('合併保留這邊的修改', r.merge[2], 25);
    t.eq('合併後畫面上也是新的', r.merge[3], 7);
    t.eq('解析 Preloader 的 spritesheet', r.icons[0], 32);
    t.eq('emoji icon 沒問題', r.icons[1], '');
    t.check('不認識的 key 有警告', r.icons[2]);
    t.check('格子超出範圍有警告', r.icons[3]);
    t.eq('單張圖 key 沒問題', r.icons[4], '');
    t.eq('sheet:格子 沒問題', r.icons[5], '');
    t.eq('總覽表武器頁', r.table[0], r.table[1]);
    t.check('表單有畫出來', r.form);
    t.eq('畫面沒有 [object …]', r.dom[0], false);
    t.check('清單每個道具一列', r.dom[1]);
    t.eq('表單沒有多出來的文字（例如 0）', r.dom[2], false);
});
