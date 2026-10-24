// 除錯面板指令頁的下拉表單：node scripts/test/debuger.mjs
import {run} from './harness.mjs'

const frame = () => new Promise(r => setTimeout(r, 500));

run('debuger', async t => {
    await t.newGame();

    const dbg = d => d.Ui.get(d.UI.TAG.DEBUGER);
    // 列（row）→ 第 i 個下拉的按鈕；點下去打開選單
    const openDD = (rowPath, i) => t.eval((d, rowPath, i) => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        const row = rowPath === 'cmd' ? g._page._panel.getChildren()[1] : g._params;
        const dd = row.getChildren().filter(c => c.setValue && c.getChildren)[i].getChildren()[0];
        dd.emit('pointerup');
        const ui = d.game.scene.getScene('UI');
        const menu = ui.children.list.findLast(o => o.repos);
        return {h: menu.height, gh: d.GM.h, scroll: !!menu.getChildren().find(c => c.type === 'rexScrollablePanel')};
    }, rowPath, i);
    // 用真的滑鼠點，才測得到點擊有沒有被其他物件擋住
    const pick = async (value) => {
        const p = await t.eval((d, value) => {
            const ui = d.game.scene.getScene('UI');
            const btn = ui.children.list.concat(...ui.children.list.filter(c => c.getAllChildren).map(c => c.getAllChildren()))
                            .findLast(o => o.opt?.value === value && o.visible);
            if (!btn) throw new Error(`找不到選項 ${value}`);
            const r = d.game.canvas.getBoundingClientRect();
            return {x: r.left + btn.x * r.width / d.GM.w, y: r.top + btn.y * r.height / d.GM.h};
        }, value);
        await t.page.mouse.move(p.x, p.y);
        await t.page.mouse.click(p.x, p.y, {delay:150});
    };

    await t.eval(d => d.Ui.get(d.UI.TAG.DEBUGER).show());
    t.eq('預設是手打', await t.eval(d => d.Ui.get(d.UI.TAG.DEBUGER)._cmd), 'raw');
    const size = await t.eval(d => {const g = d.Ui.get(d.UI.TAG.DEBUGER); return [g.width, g.height];});
    t.check('面板尺寸正常', size.every(Number.isFinite), JSON.stringify(size));

    await openDD('cmd', 0);
    await pick('q');
    await frame();
    t.eq('選單切到 q', await t.eval(d => d.Ui.get(d.UI.TAG.DEBUGER)._cmd), 'q');
    t.eq('表單重建成 q', await t.eval(d => Object.keys(d.Ui.get(d.UI.TAG.DEBUGER)._vals).join()), 'raw,q');

    const fav = await t.eval(d => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        Object.assign(g._vals.q, {name:'favor', npc:'karen', op:'+'});
        g.buildParams();
        const shown = Object.keys(g._inputs);
        g._inputs.val.setValue('10');
        const before = d.Quality.get('karen.favor');
        g.exec();
        return {shown, diff: d.Quality.get('karen.favor') - before, kept: g._vals.q.val};
    });
    t.eq('q favor 有數值框', fav.shown.join(), 'val');
    t.eq('q karen.favor+10', fav.diff, 10);
    t.eq('執行後值保留', fav.kept, '10');

    const all = await t.eval(d => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        g._vals.q.name = '';
        g.buildParams();
        return g._params.getChildren().length;
    });
    t.eq('q (全部) 只剩 quality 下拉', all, 1);

    await openDD('cmd', 0);
    await pick('get');
    await frame();
    const menu = await openDD('params', 2);
    t.check('96 個道具的選單會捲動、不超出畫面', menu.scroll && menu.h < menu.gh, JSON.stringify(menu));
    const first = await t.eval(d => d.DB.itemIds()[1]);
    await pick(first);
    await frame();
    t.eq('捲動清單的選項點得到', await t.eval(d => d.Ui.get(d.UI.TAG.DEBUGER)._vals.get.id), first);

    await openDD('params', 1);
    const weapon = await t.eval(d => d.GM.CAT.WEAPON);
    await pick(weapon);
    await frame();
    const cat = await t.eval(d => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        return [g._vals.get.cat, d.DB.item(g._vals.get.id).cat];
    });
    t.eq('分類選 WEAPON，道具跟著換', cat.join(), `${weapon},${weapon}`);

    await openDD('params', 0);
    await pick('gold');
    await frame();
    const gold = await t.eval(d => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        const n = g._params.getChildren().length;
        g._inputs.count.setValue('7');
        const before = d.GM.player.gold ?? d.GM.player.inv?.gold;
        g.exec();
        return {n, before, after: d.GM.player.gold ?? d.GM.player.inv?.gold};
    });
    t.eq('gold 時隱藏分類與道具', gold.n, 3);
    if (gold.before !== undefined) t.eq('get gold 7', gold.after - gold.before, 7);

    await t.eval(d => {d.Ui.get(d.UI.TAG.DEBUGER).close(); d.Ui.get(d.UI.TAG.DEBUGER).show('story karen');});
    const st = await t.eval(d => {const g = d.Ui.get(d.UI.TAG.DEBUGER); return [g._cmd, g._vals.story.npc, g._area.text.includes('> story karen')];});
    t.eq('右鍵 story 切表單', st.join(), 'story,karen,true');

    await t.eval(d => {
        const g = d.Ui.get(d.UI.TAG.DEBUGER);
        g._cmd = 'w'; g.buildParams(); g.exec();
    });
    t.check('w 不再是無效指令', !(await t.eval(d => d.Ui.get(d.UI.TAG.DEBUGER)._area.text.includes('無效指令'))));
});
