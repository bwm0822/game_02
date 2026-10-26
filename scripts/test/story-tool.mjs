// 任務編輯器（tools/story）：用 window.__st 直接呼叫，OPFS 當假的專案根目錄（public/assets/json/story.json）
import {run} from './harness.mjs'

run('story-tool', async t => {
    await t.page.goto(new URL('tools/story/', t.page.url()).href);
    await t.page.waitForFunction(() => window.__st && Object.keys(window.__st.S.refs.roles).length);

    const r = await t.page.evaluate(async () => {
        const st = window.__st, S = st.S, out = {}, $ = (id) => document.getElementById(id);
        const sleep = (ms) => new Promise(res => setTimeout(res, ms));
        const q = (s) => document.querySelector(s), qa = (s) => [...document.querySelectorAll(s)];
        const k = (...p) => `[data-k="${CSS.escape(JSON.stringify(p))}"]`;
        const answer = async (v) => {
            for (let i = 0; i < 200 && !$('dlgAsk').open; i++) await sleep(20);
            if (!$('dlgAsk').open) return null;
            const text = $('dlgAsk').textContent;
            $('dlgAsk').close(v);
            return text;
        };
        const change = (el, v) => {el.value = v; el.dispatchEvent(new Event('change', {bubbles: true}));};

        const orig = await (await fetch('/assets/json/story.json', {cache: 'no-store'})).text();
        const opfs = await navigator.storage.getDirectory();
        for await (const name of opfs.keys()) await opfs.removeEntry(name, {recursive: true});
        const dir = async (parent, ...names) => {let d = parent; for (const n of names) d = await d.getDirectoryHandle(n, {create: true}); return d;};
        const write = async (d, name, data) => {const w = await (await d.getFileHandle(name, {create: true})).createWritable(); await w.write(data); await w.close();};
        const json = await dir(opfs, 'game', 'public', 'assets', 'json');
        const disk = async () => (await (await json.getFileHandle('story.json')).getFile()).text();
        await write(json, 'story.json', orig);
        await st.setAssets(await dir(opfs, 'game'));

        out.load = [Object.keys(S.data).join(','), qa('#list .item').length];
        out.clean = S.results.filter(r => r.level === 'error').map(r => r.msg);
        await st.save();
        out.roundtrip = (await disk()) === orig;

        // 劇情線表單
        S.sel = 'wolf_hunt'; st.render();
        out.cards = [qa('#view .card:not(.node)').length, qa('#view .card.node').length, q('#view').textContent.includes('[object')];
        // 展開對話卡，改條件成未宣告的 quality：欄位標紅、面板有錯誤
        S.open[JSON.stringify(['wolf_hunt', 'storylets', 0])] = true; st.render();
        change(q(k('wolf_hunt', 'storylets', 0, 'requires')), 'wolf_huntx==0');
        out.bad = [q(k('wolf_hunt', 'storylets', 0, 'requires')).classList.contains('bad'), $('checks').textContent.includes('wolf_huntx')];
        st.undo();
        out.undo = S.data.wolf_hunt.storylets[0].requires;

        // 收起來的卡有錯：標在卡片上；面板點一下展開並跳到欄位
        S.open = {}; st.render();
        st.commit(() => {S.data.wolf_hunt.storylets[1].effects.push('bogus 1');});
        out.cardBad = q(k('wolf_hunt', 'storylets', 1)).classList.contains('bad');
        qa('#checks .chk.go').find(e => e.textContent.includes('bogus'))?.click();
        out.jump = [document.activeElement === q(k('wolf_hunt', 'storylets', 1, 'effects')), S.sel];
        st.undo();

        // @節點 的連結跳到節點卡
        S.open = {}; S.open[JSON.stringify(['wolf_hunt', 'storylets', 0])] = true; st.render();
        q(k('wolf_hunt', 'storylets', 0, 'text')).parentElement.querySelector('button')?.click();
        out.link = !!q(k('wolf_hunt', 'nodes', 'xi', 'n_wolf_ask', 'choices', 0));

        // 節點：台詞條件改名、加選項、刪選項
        change(q(k('wolf_hunt', 'nodes', 'xi', 'n_wolf_ask', 'texts', 'true')), 'time=night');
        out.texts = Object.keys(S.data.wolf_hunt.nodes.xi.n_wolf_ask.texts);
        const nChoice = S.data.wolf_hunt.nodes.xi.n_wolf_ask.choices.length;
        qa('#view button').find(b => b.textContent === '＋ 選項').click();
        change(q(k('wolf_hunt', 'nodes', 'xi', 'n_wolf_ask', 'choices', nChoice, 'label')), '再想想');
        out.choice = S.data.wolf_hunt.nodes.xi.n_wolf_ask.choices.at(-1);
        st.undo(); st.undo(); st.undo();
        out.nodeUndo = JSON.stringify(S.data.wolf_hunt) === JSON.stringify(JSON.parse(orig).lines.wolf_hunt);

        // 新增對話卡、事件卡
        qa('#view button').find(b => b.textContent === '＋ 對話卡').click();
        qa('#view button').find(b => b.textContent === '＋ 事件卡').click();
        out.add = S.data.wolf_hunt.storylets.slice(-2).map(s => s.on ? 'ev' : 'talk');
        st.undo(); st.undo();

        // 指令欄的自動完成：只補游標前那個字
        S.open[JSON.stringify(['wolf_hunt', 'storylets', 0])] = true; st.render();
        const ta = q(k('wolf_hunt', 'storylets', 0, 'requires'));
        ta.focus(); ta.value = 'wolf_hunt==0 && pelt_tr'; ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.dispatchEvent(new Event('input', {bubbles: true}));
        const pop = q('.combo');
        out.combo = [!pop.hidden, [...pop.children].map(c => c.firstChild.textContent).join(',')];
        ta.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        out.comboPick = ta.value;
        ta.blur();
        st.undo();

        // quality 宣告頁
        S.sel = st.Q; st.render();
        out.qual = qa('#view tbody tr').length === Object.keys(JSON.parse(orig).qualities).length;

        // 改名連帶改引用：quality（條件、指令、日誌佔位符；wolf_hunt 不動）
        const renameBy = async (sel, v) => {change(q(sel), v); out.dlg = await answer('ok'); await sleep(50);};
        await renameBy(k(st.Q, 'wolf_hunt.kills', '#id'), 'wolf_hunt.count');
        const w = S.data.wolf_hunt;
        out.renameQ = [Object.keys(S.data[st.Q]).indexOf('wolf_hunt.count') === Object.keys(JSON.parse(orig).qualities).indexOf('wolf_hunt.kills'),
            w.storylets[1].requires, w.storylets[1].effects[1], w.threads.wolf_hunt.values[1].journal, w.nodes.xi.n_wolf_ask.choices[0].actions[1],
            S.results.filter(r => r.level === 'error').length];
        st.undo();
        out.renameQUndo = JSON.stringify(st.encode(S.data)) === JSON.stringify(JSON.parse(orig));
        // 節點：approach 的參數跟著改
        S.sel = 'wolf_hunt'; st.render();
        await renameBy(k('wolf_hunt', 'nodes', 'karen', 'n_wolf_grudge', '#id'), 'n_grudge');
        out.renameNode = [!!S.data.wolf_hunt.nodes.karen.n_grudge, S.data.wolf_hunt.storylets[6].effects[0], out.dlg.includes('approach n_wolf_grudge')];
        st.undo();
        // spawn：地圖的 @群組 圖層只列不改
        await write(await dir(opfs, 'game', 'public', 'assets', 'maps'), 'm.json', JSON.stringify({layers: [{name: '@wolves'}]}));
        await renameBy(k('wolf_hunt', 'spawns', 'wolves', '#id'), 'wolfpack');
        out.renameSpawn = ['wolfpack' in S.data.wolf_hunt.spawns, out.dlg.includes('maps/m.json')];
        st.undo();

        // 存檔前三方合併：外部改 bandit_hunt、這邊改 wolf_hunt
        const ext = JSON.parse(orig); ext.lines.bandit_hunt.title = '外部';
        await write(json, 'story.json', JSON.stringify(ext, null, 2));
        st.commit(() => {S.data.wolf_hunt.title = '這邊';});
        const p = st.save();
        await answer('merge'); await p;
        const saved = JSON.parse(await disk());
        out.merge = [saved.lines.bandit_hunt.title, saved.lines.wolf_hunt.title, Object.keys(saved).join(',')];

        // 總覽
        S.view = 'table'; st.render();
        out.table = qa('#view tbody tr').length;
        return out;
    });

    t.eq('讀入 qualities＋3 條劇情線', r.load[0], '@qualities,bandit_hunt,wolf_hunt,pelt_trade');
    t.eq('清單 4 列', r.load[1], 4);
    t.eq('現有資料沒有錯誤', r.clean.join('；'), '');
    t.check('沒改就存檔，內容一字不差', r.roundtrip);
    t.eq('劇情卡／節點卡數量、沒有 [object', JSON.stringify(r.cards), JSON.stringify([7, 4, false]));
    t.check('未宣告的 quality：欄位標紅、面板列出', r.bad[0] && r.bad[1], JSON.stringify(r.bad));
    t.eq('undo', r.undo, 'wolf_hunt==0');
    t.check('收起來的卡有錯標在卡片上', r.cardBad);
    t.check('面板點錯誤跳到欄位', r.jump[0] && r.jump[1] === 'wolf_hunt', JSON.stringify(r.jump));
    t.check('@節點 連結跳到節點卡', r.link);
    t.eq('台詞條件改名', r.texts.join(','), 'time=night');
    t.eq('加選項', JSON.stringify(r.choice), JSON.stringify({label: '再想想'}));
    t.check('節點修改 undo 回原樣', r.nodeUndo);
    t.eq('新增對話卡、事件卡', r.add.join(','), 'talk,ev');
    t.check('自動完成只列符合游標前那個字的', r.combo[0] && r.combo[1] === 'pelt_trade', r.combo[1]);
    t.eq('自動完成只換那個字', r.comboPick, 'wolf_hunt==0 && pelt_trade');
    t.check('quality 宣告頁每個一列', r.qual);
    t.eq('quality 改名：原位、條件／指令／日誌／節點選項都改、沒有錯誤', JSON.stringify(r.renameQ), JSON.stringify([true,
        'wolf_hunt==1 && wolf_hunt.count>=3', 'stop wolf_hunt.count', '前往黑森林狩獵，擊殺野狼 ({wolf_hunt.count}/3)', 'count wolf_hunt.count kill:wolf', 0]));
    t.check('quality 改名一步 undo', r.renameQUndo);
    t.eq('節點改名：approach 跟著改、確認框有列', JSON.stringify(r.renameNode), JSON.stringify([true, 'approach n_grudge', true]));
    t.eq('spawn 改名：地圖圖層列在其他檔案', JSON.stringify(r.renameSpawn), JSON.stringify([true, true]));
    t.eq('合併：外部的、這邊的都留著，結構不變', JSON.stringify(r.merge), JSON.stringify(['外部', '這邊', 'qualities,lines']));
    t.eq('總覽 3 條劇情線', r.table, 3);
});
