// 多國語言 tr()：node scripts/test/lang.mjs
import {run} from './harness.mjs'

run('多國語言', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});

    const zh = await t.eval(d => ({
        item: d.DB.item('sword_01').lab,
        ability: d.DB.ability('fireball').lab,
        des: d.DB.ability('fireball').des,
        ui: d.Local.lab('weapon'),
        missing: d.Local.lab('no_such_key'),
        fill: d.Lang.tr('x', '{#num} 格 {#keep}', {num:3}),
    }));
    t.eq('item 原文', zh.item, '匕首');
    t.eq('ability 原文', zh.ability, '火球術');
    t.check('ability 說明保留佔位符給 fmt_Des', zh.des.includes('{#fmt}'), zh.des);
    t.eq('local 原文', zh.ui, '武器');
    t.eq('local 查不到標紅', zh.missing, '[color=red]no_such_key[/color]');
    t.eq('佔位符只換有給的', zh.fill, '3 格 {#keep}');

    const qps = await t.eval(d => {
        d.Record.setting.lang = 'qps';
        d.DB.load(d.game.scene.getScene('MainMenu'));
        d.DB.load(d.game.scene.getScene('MainMenu'));
        const r = {
            item: d.DB.item('sword_01').lab,
            ui: d.Local.lab('weapon'),
            bbc: d.Lang.tr('x', '[color=red]火[/color]{#n}'),
        };
        d.Record.setting.lang = 'zh-TW';
        d.DB.load(d.game.scene.getScene('MainMenu'));
        r.back = d.DB.item('sword_01').lab;
        return r;
    });
    t.eq('qps 拉長加括號（DB.load 重跑不會疊兩層）', qps.item, '【匕首匕首】');
    t.eq('qps local', qps.ui, '【武器武器】');
    t.eq('qps 只重複看得到的字', qps.bbc, '【[color=red]火[/color]{#n}火】');
    t.eq('切回原文', qps.back, '匕首');

    await t.newGame();
    t.ok('開新遊戲沒有錯誤');
});
