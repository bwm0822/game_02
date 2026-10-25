// 提示詞（tools/prompt）：用 window.__pe 直接呼叫，OPFS 當假的專案根目錄
import {run} from './harness.mjs'

run('prompt', async t => {
    await t.page.goto(new URL('tools/prompt/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__pe);

    const r = await t.page.evaluate(async () => {
        const pe = window.__pe, S = pe.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const answer = async (v) => {
            for (let i = 0; i < 100 && !$('dlgAsk').open; i++) await sleep(20);
            if (!$('dlgAsk').open) return null;
            const text = $('dlgAsk').textContent;
            $('dlgAsk').close(v);
            return text;
        };

        const root = await navigator.storage.getDirectory();
        for await (const name of root.keys()) await root.removeEntry(name, {recursive: true});
        const write = async (dir, name, text) => {const w = await (await dir.getFileHandle(name, {create: true})).createWritable(); await w.write(text); await w.close();};
        const disk = async () => JSON.parse(await (await (await (await root.getDirectoryHandle('prompts')).getFileHandle('prompt.json')).getFile()).text());

        // 檔案不存在：問要不要建骨架
        S.path = 'prompts/prompt.json';
        const p = pe.setRoot(root);
        out.ask = (await answer('ok'))?.includes('骨架');
        await p;
        out.skeleton = [Object.keys((await disk()).items).join(), Object.keys(S.data.common).join()];

        // 新增物品預設帶同名 common；組合規則
        pe.addItem('武器');
        out.newItem = {...S.data.items.武器[0]};
        pe.setItem(S.sel, 'desc', 'iron sword');
        pe.commit(() => {S.data.common.武器 = 'pixel art';});
        out.plain = pe.compose(S.data.items.武器[0], S.data.common);
        pe.commit(() => {S.data.common.武器 = 'icon of {name}: {desc}, 32x32';});
        pe.setItem(S.sel, 'name', '鐵劍');
        out.holder = pe.compose(S.data.items.武器[0], S.data.common);
        out.noCommon = pe.compose({desc: 'x', common: ''}, S.data.common);

        // 複製、跨分類拖曳
        pe.dupItem({cat: '武器', i: 0});
        pe.moveItem({cat: '武器', i: 1}, {cat: '護具', i: 0});
        out.move = [S.data.items.武器.length, S.data.items.護具[0].name, JSON.stringify(S.sel)];
        pe.moveItem({cat: '護具', i: 0}, {cat: '武器', i: 0});
        out.order = S.data.items.武器.length === 2 && S.sel.i === 0;

        // common 改名連動、刪除後顯示遺失、undo
        pe.renameCommon('武器', '像素-武器');
        out.rename = S.data.items.武器.map(it => it.common).join();
        out.users = pe.usersOf('像素-武器').length;
        pe.removeCommon('像素-武器');
        S.mode = 'items'; S.sel = {cat: '武器', i: 0}; pe.commit(() => {});
        out.lost = !!document.querySelector('#list .missing') && [...document.querySelectorAll('#view option')].some(o => o.textContent.includes('遺失'));
        pe.undo();
        out.undo = '像素-武器' in S.data.common;

        // 同一條清單：共用組在最上面，點了右欄換成共用畫面；分組可摺疊，搜尋中全展開
        const names = () => [...document.querySelectorAll('#list .item .id')].map(e => e.textContent);
        const groups = [...document.querySelectorAll('#list .group .name')].map(e => e.textContent);
        document.querySelector('#list .item').click();
        out.list = [groups[0], S.mode, !!document.querySelector('[data-k="ctext"]')];
        document.querySelector('#list .item').click();
        out.unpick = S.sel;
        document.querySelector('#list .item').click();
        const n0 = names().length;
        document.querySelector('#list .group').click();
        const n1 = names().length;
        out.foldSel = S.sel;
        S.search = '鐵'; pe.commit(() => {});
        const n2 = names().length;
        S.search = ''; document.querySelector('#list .group').click();
        out.fold = [n0 - n1, n2, names().length === n0];
        const altClick = () => document.querySelector('#list .group').dispatchEvent(new MouseEvent('click', {altKey: true, bubbles: true}));
        altClick();
        out.foldAll = [names().length, S.fold.size];
        altClick();
        out.foldAll.push(names().length === n0);

        // 分類：新增、改名、刪除非空要確認
        const pc = pe.addCat();
        await answer('ok');
        await pc;
        out.cat = '新分類' in S.data.items;
        const pr = pe.renameCat('新分類');
        for (let i = 0; i < 100 && !$('dlgAsk').open; i++) await sleep(20);
        $('dlgAsk').querySelector('input').value = '飾品';
        $('dlgAsk').close('ok');
        await pr;
        const pd = pe.removeCat('武器');
        out.catAsk = (await answer('cancel'))?.includes('2 個物品');
        await pd;
        out.cats = Object.keys(S.data.items).join();

        // 存檔：外部改了 common 會合併
        out.dirty = !$('dirty').hidden;
        const d = await disk();
        d.common.道具 = 'external';
        await write(await root.getDirectoryHandle('prompts'), 'prompt.json', JSON.stringify(d, null, 2));
        const ps = pe.save();
        out.merge = (await answer('merge'))?.includes('道具');
        await ps;
        const saved = await disk();
        out.saved = [saved.common.道具, saved.items.武器.length, Object.keys(saved.items).join()];
        out.clean = $('dirty').hidden;

        // 換路徑：記在 localStorage
        const pp = pe.setPath('other/p.json');
        await answer('cancel');
        await pp;
        out.path = [localStorage.getItem('tools.prompt.path'), S.data];
        localStorage.removeItem('tools.prompt.path');
        return out;
    });

    t.check('檔案不存在會問要不要建骨架', r.ask);
    t.eq('骨架內容', JSON.stringify(r.skeleton), JSON.stringify(['武器,護具,道具', '武器,護具,道具']));
    t.eq('新增物品預設帶同名 common', JSON.stringify(r.newItem), JSON.stringify({name: '新物品', desc: '', common: '武器'}));
    t.eq('沒佔位符：描述＋換行＋common', r.plain, 'iron sword\npixel art');
    t.eq('佔位符代換', r.holder, 'icon of 鐵劍: iron sword, 32x32');
    t.eq('沒有 common 只有描述', r.noCommon, 'x');
    t.eq('跨分類拖曳', JSON.stringify(r.move), JSON.stringify([1, '鐵劍', JSON.stringify({cat: '護具', i: 0})]));
    t.check('拖回原分類插在前面', r.order);
    t.eq('common 改名連物品引用一起改', r.rename, '像素-武器,像素-武器');
    t.eq('用到的物品', r.users, 2);
    t.check('刪掉 common：清單 ⚠、下拉顯示遺失', r.lost);
    t.check('undo 回來', r.undo);
    t.eq('共用組在最上面、點了顯示共用', JSON.stringify(r.list), JSON.stringify(['⚙ 共用（3）', 'common', true]));
    t.eq('分組摺疊、搜尋中全展開', JSON.stringify(r.fold), JSON.stringify([3, 2, true]));
    t.eq('摺起選到的那組會清除選擇', r.foldSel, null);
    t.check('Alt＋點全部摺／全部展開', r.foldAll[0] === 0 && r.foldAll[1] > 1 && r.foldAll[2], JSON.stringify(r.foldAll));
    t.eq('再點一次選到的會取消選擇', r.unpick, null);
    t.check('新增分類', r.cat);
    t.check('刪除非空分類要確認', r.catAsk);
    t.eq('分類改名、取消刪除', r.cats, '武器,護具,道具,飾品');
    t.check('有修改顯示未存檔', r.dirty);
    t.check('外部修改會問合併', r.merge);
    t.eq('合併後存檔', JSON.stringify(r.saved), JSON.stringify(['external', 2, '武器,護具,道具,飾品']));
    t.check('存完未存檔標記消失', r.clean);
    t.eq('換路徑記住、沒建檔就沒資料', JSON.stringify(r.path), JSON.stringify(['other/p.json', null]));
});
