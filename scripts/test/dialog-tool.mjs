// 對話編輯器（tools/dialog）：用 window.__dl 直接呼叫，OPFS 當假的專案根目錄；最後在殼裡測任務↔對話分頁互跳
import {run} from './harness.mjs'

run('dialog-tool', async t => {
    const base = t.page.url();
    await t.page.goto(new URL('tools/dialog/', base).href);
    await t.page.waitForFunction(() => window.__dl && Object.keys(window.__dl.S.refs.roles).length);

    const r = await t.page.evaluate(async () => {
        const dl = window.__dl, S = dl.S, out = {}, $ = (id) => document.getElementById(id);
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const k = (...p) => `[data-k="${CSS.escape(JSON.stringify(p))}"]`;
        const change = (el, v) => {el.value = v; el.dispatchEvent(new Event('change', {bubbles: true}));};

        const orig = await (await fetch('/assets/json/dialog.json', {cache: 'no-store'})).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const json = await dir(opfs, 'game', 'public', 'assets', 'json');
        const disk = async () => (await (await json.getFileHandle('dialog.json')).getFile()).text();
        await write(json, 'dialog.json', orig);
        await dl.setAssets(await dir(opfs, 'game'));

        out.load = Object.keys(S.data).join(',');
        out.groups = qa('#list .group').map(g => g.textContent.trim());
        out.clean = S.results.filter(r => r.level === 'error').map(r => r.msg);
        await dl.save();
        out.roundtrip = (await disk()) === orig;

        // _common
        S.sel = '_common'; dl.render();
        out.common = [qa('#view .erow:not(.inh)').length, qa('#view .lrow').length, qa('#view .card.node').length, q('#view').textContent.includes('[object')];
        change(q(k('_common', 'entries', 0, 'node')), 'n_zz');
        out.bad = [q(k('_common', 'entries', 0, 'node')).classList.contains('bad'), $('checks').textContent.includes('n_zz')];
        dl.undo();

        // karen：沿用 _common 的入口、節點，可以覆寫；劇情卡唯讀列出
        S.sel = 'karen'; dl.render();
        out.karen = [qa('#view .erow.inh').length, qa('#view .chip').length, qa('#view .chk.go').length > 0];
        qa('#view .chip').find(c => c.textContent.startsWith('n_chat')).querySelector('button').click();
        out.override = JSON.stringify(S.data.karen.nodes?.n_chat) === JSON.stringify(S.data._common.nodes.n_chat) && !!q(k('karen', 'nodes', 'n_chat', 'choices', 0));
        dl.undo();
        // 沿用的節點連結跳到 _common
        qa('#view .chip a').find(a => a.textContent === 'n_where').click();
        out.jumpCommon = [S.sel, !!q(k('_common', 'nodes', 'n_where', 'texts', 'true'))];

        // 加掛選項
        S.sel = 'xi'; dl.render();
        dl.commit(() => {S.data.xi.extend = {n_default: [{label: '最近好嗎', next: 'n_chat'}]};});
        out.extend = [!!q(k('xi', 'extend', 'n_default', 0, 'label')), S.results.filter(r => r.level === 'error').length];
        dl.undo();

        // 只用 _common 的 unique NPC：建立自己的對話
        S.sel = 'trump'; dl.render();
        out.only = q('#view').textContent.includes('整套用 _common');
        qa('#view button').find(b => b.textContent.startsWith('建立')).click();
        out.create = JSON.stringify(S.data.trump);
        dl.undo();
        out.after = 'trump' in S.data;
        return out;
    });

    t.eq('讀入 _common＋karen＋xi', r.load, '_common,karen,xi');
    t.check('清單有「只用 _common」組', r.groups.some(g => g.includes('只用 _common（6）')), r.groups.join(' '));
    t.eq('現有資料沒有錯誤', r.clean.join('；'), '');
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('_common：入口／台詞／節點數、沒有 [object', JSON.stringify(r.common), JSON.stringify([2, 4, 7, false]));
    t.check('入口指到不存在的節點：標紅、面板列出', r.bad[0] && r.bad[1], JSON.stringify(r.bad));
    t.check('karen：沿用 _common 的入口與節點、列出劇情卡', r.karen[0] === 2 && r.karen[1] === 7 && r.karen[2], JSON.stringify(r.karen));
    t.check('覆寫 _common 的節點', r.override);
    t.eq('沿用的節點連結跳到 _common', JSON.stringify(r.jumpCommon), JSON.stringify(['_common', true]));
    t.eq('加掛選項：畫出選項、沒有錯誤', JSON.stringify(r.extend), JSON.stringify([true, 0]));
    t.check('只用 _common 的 NPC 有提示', r.only);
    t.eq('建立自己的對話', r.create, '{}');
    t.eq('undo 拿掉', r.after, false);

    // 殼：任務分頁點 dialog.json 的節點跳到對話分頁，對話分頁點劇情卡跳回任務分頁
    await t.page.goto(new URL('tools/#story', base).href);
    await t.page.waitForFunction(() => window.__tools);
    const s = await t.page.evaluate(async () => {
        const T = window.__tools, out = {};
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const until = async (f) => {for (let i = 0; i < 250 && !f(); i++) await sleep(20); return f();};
        const win = (tab) => T.S.frames[tab]?.contentWindow;
        const opfs = await navigator.storage.getDirectory();
        const proj = await opfs.getDirectoryHandle('game');
        const json = await (await (await proj.getDirectoryHandle('public')).getDirectoryHandle('assets')).getDirectoryHandle('json');
        for (const f of ['item.json', 'story.json', 'role.json'])
        {
            const w = await (await json.getFileHandle(f, {create: true})).createWritable();
            await w.write(await (await fetch(`/assets/json/${f}`, {cache: 'no-store'})).text()); await w.close();
        }
        await T.setProject(proj);
        await until(() => win('story')?.__st?.S.data.wolf_hunt);
        const st = win('story').__st;
        st.S.sel = 'wolf_hunt'; st.render(); st.S.open[JSON.stringify(['wolf_hunt', 'nodes', 'xi', 'n_wolf_ask'])] = true; st.render();
        // n_wolf_ask 的「接受」→ n_default 在 dialog.json 的 _common
        win('story').document.querySelector(`[data-k="${CSS.escape(JSON.stringify(['wolf_hunt', 'nodes', 'xi', 'n_wolf_ask', 'choices', 0, 'next']))}"]`).parentElement.querySelector('button').click();
        out.toDialog = await until(() => win('dialog')?.__dl?.S.sel === '_common' && location.hash === '#dialog'
            && win('dialog').document.querySelector(`[data-k="${CSS.escape(JSON.stringify(['_common', 'nodes', 'n_default', 'choices', 0]))}"]`));
        out.toDialog = !!out.toDialog;
        const dl = win('dialog').__dl;
        dl.S.sel = 'karen'; dl.render();
        [...win('dialog').document.querySelectorAll('#view .chk.go')].find(e => e.textContent.includes('wolf_karen')).click();
        out.toStory = !!await until(() => location.hash === '#story' && st.S.open[JSON.stringify(['wolf_hunt', 'storylets', 3])]
            && win('story').document.querySelector(`.flash[data-k="${CSS.escape(JSON.stringify(['wolf_hunt', 'storylets', 3]))}"]`));
        return out;
    });
    t.check('任務分頁跳到對話分頁的 _common 節點', s.toDialog);
    t.check('對話分頁的劇情卡跳回任務分頁', s.toStory);
});
