// 文字工具（tools/local）：用 window.__lc 直接呼叫，OPFS 當假的專案根目錄（放一支假的 src 檔測掃描）
import {run} from './harness.mjs'

run('local-tool', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/local/', base).href);
    await t.page.waitForFunction(() => window.__lc);

    const r = await t.page.evaluate(async () => {
        const lc = window.__lc, S = lc.S, out = {}, $ = (id) => document.getElementById(id);
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const row = (k) => q(`#view tr[data-k="${CSS.escape(k)}"]`);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const dlg = async () => {for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);};
        const get = (f) => fetch(f, {cache: 'no-store'}).then(r => r.text());

        const orig = await get('/assets/json/local.json');
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const proj = await dir(opfs, 'game');
        const json = await dir(proj, 'public', 'assets', 'json'), lang = await dir(proj, 'public', 'assets', 'lang');
        const disk = async (d, f) => (await (await d.getFileHandle(f)).getFile()).text();
        await write(json, 'local.json', orig);
        const role = JSON.parse(await get('/assets/json/role.json'));
        role.karen.job = 'zz_job';
        await write(json, 'role.json', JSON.stringify(role));
        await write(json, 'ab_tree.json', await get('/assets/json/ab_tree.json'));
        await write(json, 'item.json', await get('/assets/json/item.json'));
        await write(lang, 'en.json', JSON.stringify({'ui.weapon': {'武器': {t: 'Weapon', r: 'ok'}}, 'ui.armor': {'防具': {t: 'Armor'}}}, null, 2));
        await write(await dir(proj, 'src', 'ui'), 'x.js', "const a = 'weapon'.lab();\nconst b = '_zz_missing'.lab({who});\nLocal.name('helmet');\n// 'boots'.lab()\n");
        await write(await dir(proj, 'src', 'old'), 'y.js', "'gloves'.lab();\n");

        await lc.D.setAssets(proj);
        await lc.rescan();

        out.count = Object.keys(S.data).length;
        out.groups = qa('#list .node').map(n => n.dataset.node);
        await lc.D.save();
        out.roundtrip = (await disk(json, 'local.json')) === orig;

        // 檢查
        out.missing = lc.missing().sort().join(',');
        out.used = [lc.isUnused('weapon'), lc.isUnused('helmet'), lc.isUnused('boots'), lc.isUnused('gloves'), lc.isUnused('rogue')];

        // 分組篩選、改 lab 就地更新
        S.node = 'general'; lc.render();
        out.general = qa('#view tbody tr').every(tr => S.data[tr.dataset.k].grp === 'general');
        const tr = row('weapon'), ta = tr.querySelector('textarea');
        ta.value = '兵器'; ta.dispatchEvent(new Event('change'));
        out.edit = [S.data.weapon.lab, row('weapon') === tr && tr.querySelector('textarea') === ta, tr.classList.contains('dirty')];
        // Enter 跳到下一列同一欄
        ta.focus(); ta.value = '武器';
        ta.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        out.enter = [S.data.weapon.lab, document.activeElement === tr.nextElementSibling.children[1].querySelector('textarea')];
        // 清空 des
        lc.setField('weapon', 'des', '');
        out.desGone = 'des' in S.data.weapon;
        lc.D.undo();
        // 換分組
        lc.setGrp('weapon', 'msg');
        out.grp = [S.data.weapon.grp, !row('weapon')];
        lc.D.undo();

        // 補上缺少的：對話框預填 key、分組猜 msg
        S.node = '#miss'; lc.render();
        out.missRows = qa('#view tbody tr').map(tr => tr.dataset.k).join(',');
        const p = dlg(); row('_zz_missing').querySelector('button').click(); await p;
        const ins = $('dlgAsk').querySelectorAll('input');
        out.prefill = [ins[0].value, $('dlgAsk').querySelector('select').value];
        ins[1].value = '{#who}缺了';
        $('dlgAsk').close('ok'); await sleep(50);
        const keys = Object.keys(S.data);
        out.added = [JSON.stringify(S.data._zz_missing), S.data[keys[keys.indexOf('_zz_missing') - 1]].grp, S.node, lc.missing().includes('_zz_missing')];

        // 改名：lang/*.json 的 ui.<舊> 存檔後一起改
        const p2 = dlg(); const rn = lc.D.rename('armor', 'armor_x'); await p2;
        out.renameDlg = $('dlgAsk').textContent.includes('ui.armor');
        $('dlgAsk').close('ok'); await rn;
        out.renamed = [Object.keys(S.data).indexOf('armor_x') === keys.indexOf('armor'), 'armor' in S.data];
        await lc.D.save();
        const en = JSON.parse(await disk(lang, 'en.json'));
        out.langRenamed = [Object.keys(en).join(','), en['ui.armor_x']?.['防具']?.t];
        // 改名後又 undo 回來再存：翻譯檔不動
        const p3 = dlg(); const rn2 = lc.D.rename('weapon', 'weapon_x'); await p3; $('dlgAsk').close('ok'); await rn2;
        lc.D.undo();
        await lc.D.save();
        out.undoRename = Object.keys(JSON.parse(await disk(lang, 'en.json'))).join(',');
        return out;
    });

    t.eq('讀入 219 筆', r.count, 219);
    t.check('左欄有全部／分組／缺少／未使用', ['#all', 'general', 'msg', 'ability', '#miss', '#unused'].every(n => r.groups.includes(n)), r.groups.join(' '));
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('缺少：src 明確查表＋role.json 的 job', r.missing, '_zz_missing,zz_job');
    t.eq('未使用：weapon/helmet 有用、註解跟 src/old 不算、資料 json 裡有的算有用', JSON.stringify(r.used), JSON.stringify([false, false, true, true, false]));
    t.check('分組只列那組', r.general);
    t.eq('改 lab：寫進資料、列沒重建、標未存', JSON.stringify(r.edit), JSON.stringify(['兵器', true, true]));
    t.eq('Enter 存這格並跳到下一列同一欄', JSON.stringify(r.enter), JSON.stringify(['武器', true]));
    t.eq('清空 des 就拿掉欄位', r.desGone, false);
    t.eq('換分組，離開目前分組', JSON.stringify(r.grp), JSON.stringify(['msg', true]));
    t.eq('缺少分頁列出', r.missRows, '_zz_missing,zz_job');
    t.eq('補上：預填 key、分組猜 msg', JSON.stringify(r.prefill), JSON.stringify(['_zz_missing', 'msg']));
    t.eq('補上：新增在同組後面、切到那組、不再缺少', JSON.stringify(r.added), JSON.stringify([JSON.stringify({lab: '{#who}缺了', grp: 'msg'}), 'msg', 'msg', false]));
    t.check('改名確認框提到翻譯情境', r.renameDlg);
    t.eq('改名：位置不變', JSON.stringify(r.renamed), JSON.stringify([true, false]));
    t.eq('改名：存檔後翻譯情境一起改', JSON.stringify(r.langRenamed), JSON.stringify(['ui.weapon,ui.armor_x', 'Armor']));
    t.eq('改名又 undo：翻譯檔不動', r.undoRename, 'ui.weapon,ui.armor_x');

    // 殼：翻譯分頁 ui.* 的 ↗ 跳到文字分頁，文字分頁的「翻譯 ↗」跳回去
    await t.page.goto(new URL('tools/#lang', base).href);
    await t.page.waitForFunction(() => window.__tools);
    const s = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        const proj = await (await navigator.storage.getDirectory()).getDirectoryHandle('game');
        await T.setProject(proj);
        await until(() => win('lang')?.__lt?.S.rows.length && win('lang').__lt.S.assets);
        const lt = win('lang').__lt;
        lt.S.node = ''; lt.S.search = 'ui.helmet'; lt.render();
        [...win('lang').document.querySelectorAll('#view tr')].find(tr => tr.dataset.k && JSON.parse(tr.dataset.k)[0] === 'ui.helmet').querySelector('a.go').click();
        out.toLocal = !!await until(() => location.hash === '#local' && win('local')?.__lc?.S.node === 'general'
            && win('local').document.querySelector('#view tr.flash[data-k="helmet"]'));
        const doc = win('local').document;
        doc.querySelector('#view tr[data-k="helmet"] td:last-child button').click();
        await until(() => doc.getElementById('dlgAsk').open);
        doc.getElementById('dlgAsk').close('lang');
        out.toLang = !!await until(() => location.hash === '#lang' && lt.S.search === 'ui.helmet');
        return out;
    });
    t.check('翻譯分頁 ui.* ↗ 跳到文字分頁那一列', s.toLocal);
    t.check('文字分頁「翻譯 ↗」跳到翻譯分頁搜那個情境', s.toLang);
});
