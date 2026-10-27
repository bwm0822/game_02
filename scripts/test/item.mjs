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
        out.load = [Object.keys(S.items).length === Object.keys(JSON.parse(orig)).length];
        out.canonical = orig === JSON.stringify(JSON.parse(orig), null, 2);

        await save('save');
        out.roundtrip = (await disk()) === orig;

        const keys0 = Object.keys(S.items['sword-1']);
        ie.set('sword-1', ['atk'], 99);
        out.edit = [S.items['sword-1'].atk, Object.keys(S.items['sword-1']).join() === keys0.join()];
        ie.set('sword-1', ['def'], 5);
        out.append = Object.keys(S.items['sword-1']).at(-1);
        ie.set('sword-1', ['def'], undefined);
        out.clear = 'def' in S.items['sword-1'];
        ie.set('sword-1', ['equip', 'x'], 4);
        out.keepUnknown = [JSON.stringify([S.items['sword-1'].equip.oy, S.items['sword-1'].equip.a]), S.items['sword-1'].equip.x];
        ie.set('raw_meat', ['cook', 'id'], undefined);
        out.cleanup = 'cook' in S.items.raw_meat;
        ie.undo();
        out.undoCook = S.items.raw_meat.cook?.id;
        ie.undo(); ie.undo(); ie.undo(); ie.undo();
        out.undoAll = [S.items['sword-1'].atk, S.items['sword-1'].equip.x];
        ie.redo();
        out.redo = S.items['sword-1'].atk;
        ie.undo();

        ie.addEff('bow-1');
        out.addEff = S.items['bow-1'].effects?.length;
        ie.delEff('bow-1', 0);
        out.delEff = 'effects' in S.items['bow-1'];

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

        const lastWeapon = Object.keys(S.items).findLast(k => S.items[k].cat === 'CAT_WEAPON');
        ie.add('new_sword', 'CAT_WEAPON');
        const ks = Object.keys(S.items);
        out.add = [ks.indexOf('new_sword') === ks.indexOf(lastWeapon) + 1, S.items.new_sword.cat, S.sel];
        ie.add('bad id', 'CAT_WEAPON');
        out.badId = 'bad id' in S.items;
        ie.dup('sword-1');
        const ks2 = Object.keys(S.items);
        out.dup = [ks2.indexOf('sword-1_copy') === ks2.indexOf('sword-1') + 1, JSON.stringify(S.items['sword-1_copy']) === JSON.stringify(S.items['sword-1'])];

        ie.set('sword-2', ['gold'], 'abc');
        out.warn = ie.validate('sword-2').some(w => w.includes('不是數字'));
        out.badRef = (ie.set('raw_meat', ['cook', 'id'], 'nope'), ie.validate('raw_meat').some(w => w.includes('不存在')));
        const seen = await save('save');
        out.saveWarn = [seen[0]?.includes('個問題'), JSON.parse(await disk())['sword-2'].gold, $('dirty').hidden];

        const ext = JSON.parse(await disk());
        ext.helmet_01.equip.x = 7;
        await write(json, 'item.json', JSON.stringify(ext, null, 2));
        ie.set('sword-2', ['gold'], 25);
        ie.set('raw_meat', ['cook', 'id'], 'cooked_meat');
        const seen2 = await save('merge', 'save');
        const after = JSON.parse(await disk());
        out.merge = [seen2[0]?.includes('helmet_01'), after.helmet_01.equip.x, after['sword-2'].gold, S.items.helmet_01.equip.x];

        await ie.IC.ready;
        out.icons = [ie.IC.SHEETS.icons?.fw, ie.IC.check('🔑'), !!ie.IC.check('nope'), !!ie.IC.check('icons:99999'), ie.IC.check('cloth-hood'), ie.IC.check('icons:134')];
        out.atlas = [ie.IC.check('hero:001'), !!ie.IC.check('hero'), !!ie.IC.check('hero:1'), (await ie.IC.frameOf('hero:001'))?.f.w];

        // 選圖器：開著的時候跑 fn，回傳 [fn 的結果, 選到的值]
        const dlgI = $('dlgIcon'), q = (s) => dlgI.querySelector(s), qa = (s) => [...dlgI.querySelectorAll(s)];
        const pick = async (v, fn) => {
            const p = ie.IC.pickIcon(v);
            const r = await fn();
            if (dlgI.open) dlgI.close('cancel');
            return [r, await p];
        };
        const canvas = async () => {for (let i = 0; i < 100 && !q('.body > canvas'); i++) await sleep(20); return q('.body > canvas');};
        const labels = () => qa('.imgCell').map(c => c.lastChild.textContent);
        const cellOf = (label) => qa('.imgCell').find(c => c.lastChild.textContent === label);
        out.pickTabs = (await pick('', () => qa('.tabs button').map(b => b.textContent).join()))[0];
        out.pickImage = (await pick('macron', () => [q('.crumb').textContent, q('.imgCell.sel')?.lastChild.textContent]))[0];
        out.pickSheet = (await pick('icons:134', async () => [q('.crumb').textContent, !!await canvas()]))[0];
        out.pickNav = (await pick('macron', () => {
            cellOf('32rogues').onclick();
            const inner = labels().join();
            qa('.crumb a').find(a => a.textContent === 'roles').onclick();
            return [inner, q('.crumb').textContent, labels().join()];
        }))[0];
        out.pickAtlas = await pick('hero:001', async () => {
            const cv = await canvas();
            const k = cv.width / (await ie.IC.frameOf('hero:001')).img.width;
            const f = ie.IC.ATLASES.hero.frames.get('125'), b = cv.getBoundingClientRect();
            cv.dispatchEvent(new MouseEvent('click', {clientX: b.left + (f.x + f.w / 2) * k, clientY: b.top + (f.y + f.h / 2) * k, bubbles: true}));
            const r = [q('.crumb').parentElement.className, q('.crumb').textContent, dlgI.open, q('input').value];
            dlgI.close('ok');
            return r;
        });
        out.pickCancel = (await pick('macron', () => {cellOf('melanie').onclick({currentTarget: cellOf('melanie')}); return q('.imgCell.sel').lastChild.textContent;}));

        S.view = 'table'; S.tab = 1; ie.render();
        out.table = [document.querySelectorAll('#view tbody tr').length, Object.values(S.items).filter(it => it.cat === 'CAT_WEAPON').length];
        S.view = 'form'; ie.render();
        out.form = !!document.querySelector('#view .fields');
        S.sel = 'sword-3'; ie.render();
        out.dom = [document.body.innerText.includes('[object'), document.querySelectorAll('#list .item').length === Object.keys(S.items).length,
                   [...document.querySelector('#view').childNodes].some(n => n.nodeType === Node.TEXT_NODE)];

        // 左欄收合（存在 localStorage，測完清掉）
        const FOLD = 'tools.item.fold';
        const foldKeys = () => JSON.parse(localStorage.getItem(FOLD) ?? '[]');
        const head = (t) => [...document.querySelectorAll('#list .group')].find(g => g.textContent.includes(t));
        const rows = () => document.querySelectorAll('#list .item').length;
        const row = (id) => document.querySelector(`#list .item[data-id="${id}"]`);
        const altClick = (el) => el.dispatchEvent(new MouseEvent('click', {altKey: true, bubbles: true}));
        localStorage.removeItem(FOLD);
        S.sel = 'sword-3'; S.view = 'form'; S.search = ''; ie.render();
        const n0 = rows();
        head('武器').click();
        out.fold = [rows() < n0 && !row('sword-3'), S.sel, S.view, head('武器').textContent.startsWith('▸'), foldKeys().includes('CAT_WEAPON')];
        S.search = 'sword-'; ie.render();
        out.foldSearch = [!!row('sword-3'), head('武器').textContent.startsWith('▾')];
        S.search = ''; ie.render();
        out.foldKeep = !row('sword-3');
        S.sel = 'sword-3'; S.view = 'form'; ie.render();
        out.foldOpen = [!!document.querySelector('#list .item.sel'), foldKeys().includes('CAT_WEAPON')];
        altClick(head('武器'));
        out.foldAll = [rows(), S.sel];
        altClick(head('武器'));
        out.foldAll.push(rows() === n0, foldKeys().length);
        row('sword-3').click();
        out.pick = [S.sel, S.view];
        row('sword-3').click();
        out.unpick = [S.sel, S.view];
        localStorage.removeItem(FOLD);
        return out;
    });

    // JSON 框：解析／上色
    const je = await t.page.evaluate(() => {
        const {parse, tokenize, paint} = window.__ie.JE, out = {};
        const at = (src) => {const p = parse(src); return p.err && [src.slice(p.err.tok.s, p.err.tok.e), p.err.msg, p.err.line];};
        out.lenient = JSON.stringify(parse('{a: 1, "b": [1, 2,], c: {},}').value);
        out.empty = JSON.stringify(parse('  ').value);
        out.comma = at('{\n  "a": 1\n  "b": 2\n}');
        out.unclosed = at('{"a": [1, 2}');
        out.eof = at('{"a": 1');
        out.badNum = at('{"a": 01}');
        out.bareVal = at('{"a": abc}');
        out.notObj = at('[1]');
        out.dup = at('{"a": 1, a: 2}');
        out.str = at('{"a": "x}');
        const src = '{"k": ["s", 1, true]}', toks = tokenize(src);
        out.paint = [...paint(src, toks).matchAll(/class="je-(\w+)">([^<]*)/g)].map(m => `${m[1]}:${m[2]}`).join(' ');
        return out;
    });
    t.eq('寬鬆：裸 key、結尾逗號', je.lenient, '{"a":1,"b":[1,2],"c":{}}');
    t.eq('空白當 {}', je.empty, '{}');
    t.eq('少逗號標在下一個 key、第幾行', JSON.stringify(je.comma), JSON.stringify(['"b"', '前面少了 ,', 3]));
    t.eq('陣列沒關標在 }', je.unclosed?.[0], '}');
    t.eq('結尾沒關標在 {', JSON.stringify(je.eof), JSON.stringify(['{', '這個 { 沒有關起來', 1]));
    t.eq('不合法數字', je.badNum?.[0], '01');
    t.eq('值沒加引號', je.bareVal?.[0], 'abc');
    t.eq('最外層要是物件', je.notObj?.[1], '要是 { } 物件');
    t.eq('key 重複', je.dup?.[1], 'key 重複：a');
    t.eq('字串沒結尾', je.str?.[1], '字串沒有結尾的 "');
    t.eq('上色分類', je.paint, 'brace:{ key:"k" punc:: bracket:[ str:"s" punc:, num:1 punc:, lit:true bracket:] brace:}');

    // JSON 框：真的打字
    const ta = '#view [data-k="#raw"]';
    await t.page.evaluate(() => {const ie = window.__ie; ie.S.sel = 'tree'; ie.S.view = 'form'; ie.render();});
    await t.page.focus(ta);
    await t.page.keyboard.down('Control'); await t.page.keyboard.press('a'); await t.page.keyboard.up('Control');
    await t.page.keyboard.press('Backspace');
    await t.page.keyboard.type('{');
    await t.page.keyboard.press('Enter');
    await t.page.keyboard.type('foo: "it\'s",');
    await t.page.keyboard.press('Enter');
    await t.page.keyboard.type("bar: [1, 'x'],");
    const val = () => t.page.$eval(ta, el => el.value);
    const around = () => t.page.$eval(ta, el => el.value.slice(el.selectionStart - 2, el.selectionStart) + '|' + el.value.slice(el.selectionStart, el.selectionStart + 2));
    const typed = await t.page.$eval(ta, el => [el.value, el.closest('.je').querySelectorAll('.je-err').length]);
    t.eq('自動配對、補 key 引號、單引號換雙引號', typed[0], '{\n  "foo": "it\'s",\n  "bar": [1, "x"],\n}');
    t.eq('結尾逗號打字時不標紅', typed[1], 0);
    await t.page.keyboard.press('Tab');
    t.check('Tab 插兩個空白', (await val()).includes('"x"],  \n'));
    await t.page.keyboard.down('Shift'); await t.page.keyboard.press('Tab'); await t.page.keyboard.up('Shift');
    t.check('Shift+Tab 退一層', (await val()).includes('\n"bar"'));
    await t.page.keyboard.press('Backspace'); await t.page.keyboard.press('Backspace');
    await t.page.keyboard.type('[');
    t.eq('[ 自動補 ]', await around(), ',[|]\n');
    await t.page.keyboard.press('Backspace');
    t.eq('空配對中間 Backspace 一起刪', await around(), '],|\n}');
    await t.page.keyboard.down('Control'); await t.page.keyboard.press('z'); await t.page.keyboard.up('Control');
    t.check('Ctrl+Z 退得回去', (await val()).includes(',[]'));
    await t.page.keyboard.press('Backspace');
    await t.page.$eval(ta, el => el.blur());
    const applied = await t.page.evaluate(() => {const it = window.__ie.S.items.tree; return [it.foo, JSON.stringify(it.bar), 'bb' in it, document.querySelector('#view [data-k="#raw"]').value];});
    t.eq('失焦套用', JSON.stringify(applied.slice(0, 3)), JSON.stringify(["it's", '[1,"x"]', false]));
    t.check('套用後整理成標準 JSON', !applied[3].includes(',\n}'));

    // JSON 框：修正規則
    const fx = await t.page.evaluate(() => {
        const {parse} = window.__ie.JE;
        const once = (src) => {const f = parse(src).err?.fix; return f ? src.slice(0, f.s) + f.text + src.slice(f.e) : null;};
        const all = (src) => {for (let n = 0, s; n < 10 && (s = once(src)) !== null; n++) src = s; return src;};
        return {
            comma: [once('{"a": 1 "b": 2}'), parse('{"a": 1 "b": 2}').err.fix.label],
            closer: [parse('{"a": [1, 2}').err.msg, once('{"a": [1, 2}')],
            colon: once('{"a" 1}'),
            eof: all('{"a": [1'),
            bare: once('{"a": abc}'),
            numKey: once('{1: 2}'),
            str: once('{"a": "x\n}'),
            junk: [once('{"a": 1;}'), parse('{"a": 1;}').err.fix.label],
            nums: all('{"a": 01, "b": 1., "c": .5, "d": 1x}'),
            none: ['{"a": ,}', '{"a": 1, a: 2}', '{} 1', '[1]', '{"a": "\\q"}'].map(once),
        };
    });
    t.eq('修正：補 ,', JSON.stringify(fx.comma), JSON.stringify(['{"a": 1, "b": 2}', '補上 ,']));
    t.eq('括號種類錯：這裡應該是 ]', JSON.stringify(fx.closer), JSON.stringify(['這裡應該是 ]', '{"a": [1, 2]}']));
    t.eq('修正：補 :', fx.colon, '{"a": 1}');
    t.eq('修正：沒關的一層一層補', fx.eof, '{"a": [1]}');
    t.eq('修正：值加引號', fx.bare, '{"a": "abc"}');
    t.eq('修正：數字 key 加引號', fx.numKey, '{"1": 2}');
    t.eq('修正：字串在行尾補 "', fx.str, '{"a": "x"\n}');
    t.eq('修正：刪掉不認識的字元', JSON.stringify(fx.junk), JSON.stringify(['{"a": 1}', '刪掉 ;']));
    t.eq('修正：不合法數字', fx.nums, '{"a": 1, "b": 1, "c": 0.5, "d": "1x"}');
    t.eq('修不了的沒有修正', JSON.stringify(fx.none), JSON.stringify([null, null, null, null, null]));

    // JSON 框：右上角按鈕
    const btn = '#view .je:has([data-k="#raw"]) > button';
    const setText = (s) => t.page.evaluate((s) => {document.execCommand('selectAll'); document.execCommand('insertText', false, s);}, s);
    const btnState = () => t.page.$eval(btn, el => {
        const r = el.getBoundingClientRect(), box = el.parentNode.querySelector('textarea').getBoundingClientRect(), off = getComputedStyle(el).visibility === 'hidden';
        return [off ? '' : el.textContent, el.title, !off && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el && r.bottom <= box.top && Math.abs(r.right - box.right) < 1];
    });
    await t.page.focus(ta);
    await setText('{"bb": 1}');
    t.eq('沒錯不顯示按鈕', (await btnState())[0], '');
    await setText('{"bb": 1 2}');
    let b = await btnState();
    t.eq('修得了顯示 [修正]（在框外）、提示怎麼改',JSON.stringify(b), JSON.stringify(['修正', '補上 ,（第 1 行：前面少了 ,）', true]));
    t.eq('只有出錯的 token 紅', await t.page.$eval(ta, el => [...el.closest('.je').querySelectorAll('.je-err')].map(e => e.textContent).join()), '2');
    await t.page.click(btn);
    t.eq('按修正', JSON.stringify(await t.page.$eval(ta, el => [el.value, document.activeElement === el])), JSON.stringify(['{"bb": 1, 2}', true]));
    await t.page.click(btn); await t.page.click(btn);
    b = await btnState();
    t.eq('一次修一個、修到修不了變 [錯誤]', JSON.stringify([await val(), b[0], b[1]]), JSON.stringify(['{"bb": 1, "2":}', '錯誤', '第 1 行：這裡應該是值']));
    await t.page.click(btn);
    t.eq('[錯誤] 按了不會動', await val(), '{"bb": 1, "2":}');
    await t.page.keyboard.down('Control'); await t.page.keyboard.press('z'); await t.page.keyboard.press('z'); await t.page.keyboard.up('Control');
    t.eq('修正可以 Ctrl+Z', await val(), '{"bb": 1, 2}');

    // JSON 框：有錯失焦留草稿
    await setText('{"bb": 1 2}');
    await t.page.$eval(ta, el => el.blur());
    const draft = await t.page.evaluate(async () => {
        const ie = window.__ie, S = ie.S, q = () => document.querySelector('#view [data-k="#raw"]');
        const keep = 'foo' in S.items.tree;
        ie.render();
        const out = [keep, q().value, q().closest('.je').querySelector('button').classList.contains('off')];
        const p = ie.save();
        for (let i = 0; i < 100 && !document.getElementById('dlgAsk').open; i++) await new Promise(r => setTimeout(r, 20));
        out.push(document.getElementById('dlgAsk').textContent.includes('還沒套用（#raw）第 1 行：前面少了 ,'));
        document.getElementById('dlgAsk').close('cancel');
        await p;
        S.sel = 'sword-1'; ie.render(); S.sel = 'tree'; ie.render(); S.open['#raw'] = true; ie.render();
        out.push(q().value.includes('"bb": 1 2'), Object.keys(S.drafts).length);
        return out;
    });
    t.check('有錯不套用', draft[0]);
    t.eq('重繪後草稿還在', draft[1], '{"bb": 1 2}');
    t.eq('草稿的按鈕還在', draft[2], false);
    t.check('存檔時警告有未套用的草稿和原因', draft[3]);
    t.eq('換道具草稿丟掉', JSON.stringify(draft.slice(4)), JSON.stringify([false, 0]));
    await t.page.focus(ta);
    await setText('{"bb": 1 2}');
    await t.page.$eval(ta, el => el.blur());
    await t.page.click(btn);
    t.eq('失焦後按修正會回到框裡', JSON.stringify(await t.page.$eval(ta, el => [el.value, document.activeElement === el])), JSON.stringify(['{"bb": 1, 2}', true]));
    await t.page.$eval(ta, el => el.blur());
    await t.page.evaluate(() => window.__ie.undo());

    // 框的收合
    const fold = await t.page.evaluate(() => {
        const ie = window.__ie, S = ie.S, out = {};
        const box = (label) => [...document.querySelectorAll('#view .box')].find(b => b.querySelector('.bar').textContent.replace(/^[▶▼]/, '').startsWith(label));
        const st = (label) => {const b = box(label); return b && (b.querySelector('.bar .arrow')?.textContent ?? '-');};
        const go = (id) => {S.sel = id; S.view = 'form'; ie.render();};
        go('raw_meat');
        out.def = [st('烹煮成'), st('效果'), box('效果').querySelectorAll('.card').length, box('效果').querySelector('.bar').textContent.includes('效果（1）')];
        box('效果').querySelector('.bar').click();
        out.click = [st('效果'), box('效果').querySelectorAll('.card').length];
        ie.set('raw_meat', ['gold'], 7);
        out.keep = st('效果');
        ie.undo();
        box('烹煮成').querySelector('.bar').click();
        out.close = [st('烹煮成'), !!box('烹煮成').querySelector('.fields')];
        go('sword-2'); go('raw_meat');
        out.reset = [st('效果'), st('烹煮成')];
        go('sword-2');
        out.equip = [st('裝備圖'), box('裝備圖').querySelector('.bar').textContent.replace(/^[▶▼]/, '').startsWith('裝備圖（6）'), box('裝備圖').querySelector('.bar [title]')?.title, box('效果').querySelector('.bar [title]')?.title];
        ie.addEff('sword-2');
        out.addEff = [st('效果'), box('效果').querySelectorAll('.card').length];
        ie.undo();
        go('raw_meat');
        const make0 = st('製作材料');
        box('製作材料').querySelector('button').click();
        out.create = [make0, st('製作材料')];
        ie.undo();
        go('pot');
        const raw0 = st('其他欄位');
        ie.set('pot', ['zz'], 1); ie.set('pot', ['zz2'], 2);
        out.tips = [document.querySelector('#view .fields > .k[title="gold"]')?.textContent, document.querySelector('#view .fields > .k[title="device.class"]')?.textContent];
        out.freeze = [raw0, st('其他欄位'), box('其他欄位').querySelector('.bar').textContent.includes('（3）')];
        ie.undo(); ie.undo();
        return out;
    });
    t.eq('預設：1 個 key 展開、array 收合、收合時看得到個數', JSON.stringify(fold.def), JSON.stringify(['▼', '▶', 0, true]));
    t.eq('點標題列展開', JSON.stringify(fold.click), JSON.stringify(['▼', 1]));
    t.eq('改欄位後還開著', fold.keep, '▼');
    t.eq('點標題列收合', JSON.stringify(fold.close), JSON.stringify(['▶', false]));
    t.eq('換道具照規則重算', JSON.stringify(fold.reset), JSON.stringify(['▶', '▼']));
    t.eq('超過一個 key 收合、標題不寫 key、hover 才看得到', JSON.stringify(fold.equip), JSON.stringify(['▶', true, 'equip', 'effects']));
    t.eq('沒建立的不能收、按建立自動展開', JSON.stringify(fold.create), JSON.stringify(['-', '▼']));
    t.eq('新增效果自動展開', JSON.stringify(fold.addEff), JSON.stringify(['▼', 2]));
    t.eq('hover 中文欄位名看得到 key', JSON.stringify(fold.tips), JSON.stringify(['價格', 'class']));
    t.eq('內容變多不會自己收起來', JSON.stringify(fold.freeze), JSON.stringify(['▼', '▼', true]));

    // 下拉選單：有值也列全部、打字才篩選
    const key = '#view input[data-combo="dl-key"]';
    await t.page.evaluate(() => {const ie = window.__ie; ie.S.sel = 'raw_meat'; ie.S.view = 'form'; ie.render(); ie.S.open.effects = true; ie.render();});
    await t.page.click(key);
    const pop = () => t.page.evaluate(() => {
        const p = document.querySelector('.combo');
        return {shown: !p.hidden, n: p.children.length, total: document.getElementById('dl-key').options.length,
                cur: p.querySelector('.cur')?.firstChild.textContent, all: [...p.children].map(c => c.firstChild.textContent)};
    });
    let p = await pop();
    t.check('有值時點開列出全部選項', p.shown && p.n === p.total && p.n > 5);
    t.eq('目前的值有標出來', p.cur, 'hunger');
    await t.page.keyboard.press('Escape');
    t.eq('Esc 關掉', (await pop()).shown, false);
    await t.page.keyboard.down('Control'); await t.page.keyboard.press('a'); await t.page.keyboard.up('Control');
    await t.page.keyboard.type('max');
    p = await pop();
    t.check('打字才篩選', p.shown && p.n < p.total && p.all.every(v => v.toLowerCase().includes('max')));
    await t.page.keyboard.press('ArrowDown');
    await t.page.keyboard.press('Enter');
    t.eq('上下鍵＋Enter 選了就套用', await t.page.evaluate(() => window.__ie.S.items.raw_meat.effects[0].key), p.all[0]);
    t.eq('選完關掉', (await pop()).shown, false);
    await t.page.evaluate(() => window.__ie.undo());
    await t.page.evaluate(() => {const ie = window.__ie; ie.S.sel = 'salt_baked_fish'; ie.render();});
    await t.page.click('#view input[data-combo="dl-items"][placeholder]');
    t.check('選道具時附名稱', await t.page.evaluate(() => [...document.querySelectorAll('.combo .opt')].some(o => o.querySelector('.lab')?.textContent === '生肉')));
    await t.page.keyboard.press('Escape');

    if (r.warns.length) console.log(`  （現有資料的警告 ${r.warns.length} 個：${r.warns.join('；')}）`);
    t.eq('讀入全部道具', r.load[0], true);
    t.check('item.json 是 JSON.stringify(…, null, 2) 格式', r.canonical);
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('改欄位', r.edit[0], 99);
    t.check('改欄位不動 key 順序', r.edit[1]);
    t.eq('新欄位接在最後', r.append, 'def');
    t.eq('清空欄位會刪 key', r.clear, false);
    t.eq('改 equip.x 不動其他 key', r.keepUnknown[0], JSON.stringify([0.85, 60]));
    t.eq('清空 cook.id 連 cook 一起刪', r.cleanup, false);
    t.eq('undo 一步', r.undoCook, 'cooked_meat');
    t.eq('undo 到底', JSON.stringify(r.undoAll), JSON.stringify([6, -13]));
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
    t.eq('讀 textures.json 的 spritesheet', r.icons[0], 32);
    t.eq('emoji icon 沒問題', r.icons[1], '');
    t.check('不認識的 key 有警告', r.icons[2]);
    t.check('格子超出範圍有警告', r.icons[3]);
    t.eq('單張圖 key 沒問題', r.icons[4], '');
    t.eq('sheet:格子 沒問題', r.icons[5], '');
    t.eq('atlas:frame 保留前導零', r.atlas[0], '');
    t.check('atlas 沒寫 frame 有警告', r.atlas[1]);
    t.check('atlas frame 不存在有警告', r.atlas[2]);
    t.eq('atlas frame 畫得出來', r.atlas[3], 51);
    t.eq('選圖器分頁是第一層資料夾', r.pickTabs, 'equips,icons,items,others,props,roles');
    t.eq('單張圖開在所在資料夾並反白', JSON.stringify(r.pickImage), JSON.stringify(['roles / npcs', 'macron']));
    t.eq('sheet 直接開格子畫面', JSON.stringify(r.pickSheet), JSON.stringify(['icons / icons', true]));
    t.check('子資料夾點進去、麵包屑點回上層', r.pickNav[0].includes('rogues ▦') && r.pickNav[1] === 'roles' && r.pickNav[2].startsWith('animals,'), JSON.stringify(r.pickNav));
    t.eq('atlas 開 frame 畫面、點了選 frame、按確定才回傳', JSON.stringify(r.pickAtlas), JSON.stringify([['tabs', 'roles / npcs / hero', true, 'hero:125'], 'hero:125']));
    t.eq('點圖只換選取、取消不套用', JSON.stringify(r.pickCancel), JSON.stringify(['melanie', null]));
    t.eq('總覽表武器頁', r.table[0], r.table[1]);
    t.check('表單有畫出來', r.form);
    t.eq('畫面沒有 [object …]', r.dom[0], false);
    t.check('清單每個道具一列', r.dom[1]);
    t.eq('表單沒有多出來的文字（例如 0）', r.dom[2], false);
    t.eq('點組標題摺疊：選到的那組取消選擇、回總覽、記在 localStorage', JSON.stringify(r.fold), JSON.stringify([true, null, 'table', true, true]));
    t.eq('搜尋中全部展開', JSON.stringify(r.foldSearch), JSON.stringify([true, true]));
    t.check('清掉搜尋恢復摺疊', r.foldKeep);
    t.eq('從別處選到摺起來組裡的會展開那組', JSON.stringify(r.foldOpen), JSON.stringify([true, false]));
    t.eq('Alt＋點全部摺／全部展開', JSON.stringify(r.foldAll), JSON.stringify([0, null, true, 0]));
    t.eq('點清單選取開表單', JSON.stringify(r.pick), JSON.stringify(['sword-3', 'form']));
    t.eq('再點一次取消選擇、回總覽', JSON.stringify(r.unpick), JSON.stringify([null, 'table']));
});
