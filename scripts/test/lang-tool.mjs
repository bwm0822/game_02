// 翻譯工具（tools/lang）：用 window.__lt 直接呼叫，OPFS 當假的專案根目錄
import {run} from './harness.mjs'

run('lang-tool', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/lang/', base).href);
    await t.page.waitForFunction(() => window.__lt && window.__lt.S.entries.length);

    const r = await t.page.evaluate(async () => {
        const lt = window.__lt, S = lt.S, out = {}, $ = (id) => document.getElementById(id);
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const k = (ctx, src) => `#view tr[data-k="${CSS.escape(JSON.stringify([ctx, src]))}"]`;
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));

        const orig = await (await fetch('/assets/lang/en.json', {cache: 'no-store'})).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const lang = await dir(opfs, 'game', 'public', 'assets', 'lang');
        await dir(opfs, 'game', 'public', 'assets', 'json');
        const disk = async (f = 'en.json') => (await (await lang.getFileHandle(f)).getFile()).text();
        await write(lang, 'en.json', orig);
        await write(lang, 'qps.json', '{}');
        await lt.useProject(await dir(opfs, 'game'));

        out.langs = S.langs.join(',');
        out.stat = S.stat;
        out.status = $('status').textContent;
        await lt.D.save();
        out.roundtrip = (await disk()) === orig;

        // 樹：全部、各領域、_shared、orphan；點 dlg 只列對話
        out.tree = qa('#list .node').map(n => n.dataset.node);
        S.node = 'dlg'; lt.render();
        out.dlgOnly = qa('#view tbody tr').every(tr => JSON.parse(tr.dataset.k)[0].startsWith('dlg.'));
        out.dlgOpen = qa('#list .node').some(n => n.dataset.node === 'dlg._common');

        // 篩選 new 的列數 = 統計
        S.node = ''; $('filter').value = 'new'; $('filter').dispatchEvent(new Event('change'));
        out.newRows = qa('#view tbody tr').length;
        const first = S.rows.find(x => x.check === 'new' && !x.src.includes('{'));
        const tr = q(k(first.ctx, first.src)), ta = tr.querySelector('textarea');
        ta.value = 'Hello {#x}'; ta.dispatchEvent(new Event('change'));
        out.edit = [S.data[first.ctx]?.[first.src]?.t, tr.isConnected && tr.querySelector('textarea') === ta, tr.querySelector('.chk').textContent];
        ta.value = 'Hello'; ta.dispatchEvent(new Event('change'));
        out.fixed = q(k(first.ctx, first.src)).classList.contains('new');      // 篩選中改完先留著，不跳走
        // Enter：存這列、跳到下一列
        const ta2 = tr.nextElementSibling.querySelector('textarea');
        ta2.focus(); ta2.value = 'World';
        ta2.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        const second = JSON.parse(tr.nextElementSibling.dataset.k);
        out.enter = [S.data[second[0]]?.[second[1]]?.t, document.activeElement === tr.nextElementSibling.nextElementSibling.querySelector('textarea')];
        // 審核：空白 → mt → ok → 空白
        $('filter').value = ''; $('filter').dispatchEvent(new Event('change'));
        const rv = () => q(k(first.ctx, first.src)).querySelector('.rv');
        const seq = [];
        for (let i = 0; i < 3; i++) {rv().click(); seq.push(S.data[first.ctx][first.src].r ?? '');}
        out.review = seq.join(',');
        // 清空譯文 = 刪掉那列（情境空了也刪）
        lt.setT(first.ctx, first.src, '');
        out.cleared = first.src in (S.data[first.ctx] ?? {});
        lt.D.undo(); lt.D.undo();
        out.undo = S.data[first.ctx]?.[first.src]?.t;
        await lt.D.save();
        out.saved = JSON.parse(await disk())[first.ctx]?.[first.src]?.t;

        // 搜尋跨整棵樹
        S.node = 'item'; $('search').value = 'Dagger'; $('search').dispatchEvent(new Event('input'));
        out.search = qa('#view tbody tr').map(tr => JSON.parse(tr.dataset.k)[0]);
        $('search').value = ''; $('search').dispatchEvent(new Event('input'));

        // 字型
        $('font').value = 'Georgia'; $('font').dispatchEvent(new Event('change'));
        out.font = S.data._meta.font;
        lt.D.undo();

        // 新增語言 ja：建檔、切過去、全部是 new
        await lt.D.save();
        const p = lt.D.S && (async () => {for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);})();
        $('btnNew').click(); await p;
        $('dlgAsk').querySelector('input').value = 'ja';
        $('dlgAsk').close('ok');
        for (let i = 0; i < 200 && lt.opt.file !== 'ja.json'; i++) await sleep(20);
        await sleep(100);
        out.ja = [lt.opt.file, S.langs.join(','), JSON.parse(await disk('ja.json'))._meta?.font, S.stat.ok, S.stat.new === S.entries.length + S.rows.filter(r => r.ctx === '_shared').length];
        await lt.switchLang('en');
        out.back = [lt.opt.file, S.data[first.ctx]?.[first.src]?.t];

        // orphan：同情境的 new 列建議搬舊譯文
        const nw = S.rows.find(x => x.check === 'new' && S.rows.filter(y => y.ctx === x.ctx && y.check === 'new').length === 1);
        lt.D.commit(() => {(S.data[nw.ctx] ??= {})['舊的句子'] = {t: 'Old line', r: 'ok'};});
        S.node = ''; lt.render();
        const row = () => q(k(nw.ctx, nw.src));
        out.retyped = row().querySelector('.chk').textContent;
        row().querySelector('.sug').click();
        out.adopt = [JSON.stringify(S.data[nw.ctx][nw.src]), '舊的句子' in S.data[nw.ctx]];
        // 刪除全部 orphan
        S.node = '@orphan'; lt.render();
        out.orphans = qa('#view tbody tr').length;
        const p2 = (async () => {for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);})();
        qa('#view button').find(b => b.textContent.startsWith('刪除全部')).click(); await p2;
        $('dlgAsk').close('ok'); await sleep(50);
        out.orphansLeft = S.stat.orphan;

        // shared：兩個情境同一句同一個譯文 → 升為 shared，兩個都刪掉、改顯示 shared
        const cnt = {};
        for (const x of S.rows) if (x.ctx !== '_shared' && x.check === 'new') (cnt[x.src] ??= []).push(x.ctx);
        const src = Object.keys(cnt).find(s => cnt[s].length >= 2 && !s.includes('{'));
        const [c1, c2] = cnt[src];
        lt.setT(c1, src, 'Same'); lt.setT(c2, src, 'Same');
        S.node = ''; lt.render();
        const p3 = (async () => {for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);})();
        q(k(c1, src)).dispatchEvent(new MouseEvent('contextmenu', {bubbles: true})); await p3;
        $('dlgAsk').close('ok'); await sleep(50);
        out.promote = [S.data._shared[src]?.t, src in (S.data[c1] ?? {}), src in (S.data[c2] ?? {}),
            q(k(c2, src)).querySelector('textarea').placeholder, q(k(c2, src)).querySelector('.chk').textContent];
        // 情境自己覆寫 → ↺ 回到 shared
        lt.setT(c2, src, 'Own'); lt.render();
        [...q(k(c2, src)).querySelectorAll('.sug')].find(a => a.textContent.includes('回到 shared')).click();
        out.revert = src in (S.data[c2] ?? {});
        return out;
    });

    t.eq('語言清單（qps 不列）', r.langs, 'en');
    t.check('有統計', r.stat.ok > 500 && r.status.startsWith('en：'), r.status);
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.check('樹有全部／領域／_shared／orphan', ['', 'ui', 'item', 'dlg', 'story', '_shared', '@orphan'].every(n => r.tree.includes(n)), r.tree.join(' '));
    t.check('點 dlg 只列對話', r.dlgOnly);
    t.check('選到的節點展開', r.dlgOpen);
    t.eq('篩選 new 的列數＝統計', r.newRows, r.stat.new);
    t.eq('改譯文：寫進資料、textarea 沒被換掉、檢查欄更新', JSON.stringify(r.edit), JSON.stringify(['Hello {#x}', true, 'error：多 {#x}']));
    t.check('篩選中改完那列先留著', !r.fixed);
    t.eq('Enter 存這列並跳下一列', JSON.stringify(r.enter), JSON.stringify(['World', true]));
    t.eq('審核循環', r.review, 'mt,ok,');
    t.eq('清空譯文就刪掉那列', r.cleared, false);
    t.eq('undo', r.undo, 'Hello');
    t.eq('存檔', r.saved, 'Hello');
    t.check('搜尋跨整棵樹（也搜譯文）', r.search.includes('item.sword_01'), r.search.join(' '));
    t.eq('字型', r.font, 'Georgia');
    t.eq('新增語言 ja', JSON.stringify(r.ja), JSON.stringify(['ja.json', 'en,ja', 'Arial, sans-serif', 0, true]));
    t.eq('切回 en', JSON.stringify(r.back), JSON.stringify(['en.json', 'Hello']));
    t.eq('同情境一筆 new 一筆 orphan 標可能是改字', r.retyped, 'new（可能是改字）');
    t.eq('點建議：搬舊譯文標 mt、orphan 刪掉', JSON.stringify(r.adopt), JSON.stringify([JSON.stringify({t: 'Old line', r: 'mt'}), false]));
    t.check('orphan 節點列出孤兒', r.orphans >= 3, `${r.orphans}`);
    t.eq('刪除全部 orphan', r.orphansLeft, 0);
    t.eq('升為 shared：搬進 _shared、同譯文的情境刪掉、灰字顯示', JSON.stringify(r.promote), JSON.stringify(['Same', false, false, 'Same', 'shared']));
    t.eq('↺ 回到 shared', r.revert, false);
});
