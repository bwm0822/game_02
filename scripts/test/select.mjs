// 玩家選角：node scripts/test/select.mjs
import {run} from './harness.mjs'

const menuTexts = t => t.eval(d => d.game.scene.getScene('MainMenu').children.list.filter(o => o.type === 'Text').map(o => o.text));

run('選角', async t => {
    await t.waitFor(d => d?.game.scene.isActive('MainMenu'), {what:'主選單'});
    t.eq('可選角色照 role.json 順序', (await t.eval(d => d.DB.playerIds())).join(), 'wick,mary');
    t.check('沒存檔不顯示繼續遊戲', !(await menuTexts(t)).includes('繼續遊戲'));

    await t.newGame('mary');
    const s = await t.eval(d => ({id:d.GM.player.id, pid:d.Record.game.pid, mary:d.Quality.get('pc.mary'), wick:d.Quality.get('pc.wick')}));
    t.eq('玩家是瑪莉', s.id, 'mary');
    t.eq('存檔記 pid', s.pid, 'mary');
    t.eq('pc.mary = 1', s.mary, 1);
    t.eq('pc.wick = 0', s.wick, 0);

    // 回主選單，有存檔：顯示繼續、開新局要先確認
    await t.eval(d => d.game.scene.getScene('GameScene').mainMenu());
    await t.waitFor(d => d.game.scene.isActive('MainMenu'), {what:'回主選單'});
    t.check('有存檔顯示繼續遊戲', (await menuTexts(t)).includes('繼續遊戲'));
    const asked = await t.eval(d => {
        const sel = d.Ui.get(d.UI.TAG.SELECT);
        sel.show(); sel.select('wick'); sel.start();
        const c = d.Ui.get(d.UI.TAG.CONFIRM);
        const open = c.isOpen;
        c.cancle();
        return open;
    });
    t.check('開新局跳覆蓋確認', asked);
    await new Promise(r => setTimeout(r, 300));
    t.check('取消後留在主選單', await t.eval(d => d.game.scene.isActive('MainMenu') && d.Record.game.pid === 'mary'));

    // 舊存檔沒有 pid → 第一個玩家角色
    const map = await t.eval(d => {
        const g = JSON.parse(localStorage.getItem('game'));
        delete g.pid;
        localStorage.setItem('game', JSON.stringify(g));
        window.__oldPlayer = d.GM.player;
        d.game.scene.getScene('MainMenu').scene.start('Game');
        return g.map;
    });
    await t.waitReady(map);
    const o = await t.eval(d => ({id:d.GM.player.id, pid:d.Record.game.pid}));
    t.eq('舊存檔玩家是維克', o.id, 'wick');
    t.eq('舊存檔補上 pid', o.pid, 'wick');
});
