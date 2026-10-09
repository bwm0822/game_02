// 狼患岔路（wolf_sell → wolf_grudge）：node scripts/test/wolf.mjs
import {run} from './harness.mjs'

const TOWN = 'm/m_04x05';

function options(t, npc)
{
    return t.eval((d, npc) => {
        const who = d.objs().find(g => g.id === npc);
        who.talk();
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        const B = dlg.dialog.B.map(b => ({text:b.text, enabled:b.enabled !== false, hint:b.hint}));
        dlg.close();
        return B;
    }, npc);
}

run('狼患岔路', async t => {
    await t.newGame();
    await t.gotoMap(TOWN);
    await t.eval(d => Object.assign(d.TimeSystem.time, {h:12, m:0}));
    t.ok('開新遊戲、到小鎮');

    await t.setQ('wolf', 2);
    let B = await options(t, 'xi');
    const sell = B.find(b => b.text === '把狼皮直接賣給你');
    t.check('還沒有狼皮：灰色選項＋提示', sell && !sell.enabled && sell.hint === '需要狼皮', JSON.stringify(sell));

    await t.give('plet', 1);
    t.eq('撿到狼皮自動進到 3', await t.q('wolf'), 3);

    const gold = await t.eval(d => d.GM.player.gold);
    const said = await t.talk('xi', '把狼皮直接賣給你');
    t.eq('xi 收下狼皮', said.at(-1), '……也好，省得你跑一趟，那我自己收了。');
    t.eq('狼患=9', await t.q('wolf'), 9);
    t.eq('拿到 80 金幣', await t.eval(d => d.GM.player.gold) - gold, 80);
    t.eq('狼皮被拿走', await t.eval(d => d.GM.player.queryItem(i => i.id === 'plet').length), 0);

    const j = await t.journal('wolf');
    t.check('日誌結束在「賣給 xi」', j?.done && j.lines.at(-1).text === '你把狼皮直接賣給了 xi', JSON.stringify(j?.lines));

    B = await options(t, 'xi');
    t.check('xi 不再有任務選項', !B.some(b => b.text === '關於任務'), B.map(b => b.text).join('/'));
    t.check('karen 沒有交狼皮的選項', !(await options(t, 'karen')).some(b => b.text === '關於黑森林的狼皮'), '');

    const first = await t.eval(d => {
        const karen = d.objs().find(g => g.id === 'karen');
        karen.bb.approach = 'n_wolf_grudge';
        karen.talk();
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        const r = {A: dlg.dialog.A, approach: karen.bb.approach ?? null};
        dlg.close();
        return r;
    });
    t.eq('玩家先開口也進 n_wolf_grudge', first.A, '聽說你把狼皮都賣給 xi 了？哼，有好貨不先找我，倒便宜了那個屠夫。');
    t.eq('玩家先開口後 karen 不再走過來', first.approach, null);

    const walk = await t.eval(async d => {
        const karen = d.objs().find(g => g.id === 'karen');
        d.Story.onSee(karen);
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        for (let i = 0; i < 150 && !dlg.isOpen; i++)
        {
            if (await Promise.race([karen.think(), new Promise(r => setTimeout(() => r('timeout'), 3000))]) === 'timeout') break;
        }
        return {open: dlg.isOpen, A: dlg.dialog?.A, B: dlg.dialog?.B.map(b => b.text), bubble: karen.coms.disp._spk.getElement('text').text};
    });
    t.eq('karen 看到你先喊一聲', walk.bubble, '喂！你給我過來！');
    t.check('karen 走過來開對話', walk.open, '');
    t.eq('進 n_wolf_grudge', walk.A, '聽說你把狼皮都賣給 xi 了？哼，有好貨不先找我，倒便宜了那個屠夫。');

    await t.eval(d => {
        const dlg = d.Ui.get(d.UI.TAG.DIALOG);
        dlg.owner.select(dlg.dialog.B.find(b => b.text === '我想賣給誰就賣給誰'), dlg.cb.bind(dlg));
        dlg.close();
    });
    t.eq('嗆回去：好感 -15', await t.q('karen.favor'), 35);

    const again = await t.eval(d => {
        const karen = d.objs().find(g => g.id === 'karen');
        d.Story.onSee(karen);
        return karen.bb.approach ?? null;
    });
    t.eq('之後看到不會再來', again, null);
});
